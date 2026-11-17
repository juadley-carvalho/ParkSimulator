// navegador.js — peças comuns de capturar.js e gerar-pdf.js (sem pacotes: só o Node 18+)
//
// - subirServidor(): roda o server.js do jogo numa porta própria (3123) com os saves numa pasta temporária;
// - abrirNavegador(): abre o Microsoft Edge sem janela (headless) e conversa com ele pelo protocolo
//   CDP (Chrome DevTools Protocol), usando o WebSocket e o fetch que já vêm no Node;
// - encerrar(): fecha o Edge (inclusive os processos filhos do perfil temporário) e o servidor.
//
// Variáveis de ambiente opcionais: EDGE (caminho do msedge.exe), PORTA_JOGO, PORTA_CDP, PASTA_TEMP.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..', '..');          // pasta do projeto
const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORTA_JOGO = Number(process.env.PORTA_JOGO || 3123);
const PORTA_CDP = Number(process.env.PORTA_CDP || 9333);
const TEMP = process.env.PASTA_TEMP || path.join(os.tmpdir(), 'parque-docs');   // fora do repositório

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function esperarUrl(url, tentativas = 100) {
  for (let i = 0; i < tentativas; i++) {
    try { const r = await fetch(url); if (r.ok) return r; } catch { /* ainda subindo */ }
    await esperar(200);
  }
  throw new Error('Sem resposta de ' + url);
}

// Servidor do jogo com os saves numa pasta temporária (nunca em ./saves)
async function subirServidor() {
  const saves = path.join(TEMP, 'saves');
  fs.mkdirSync(saves, { recursive: true });
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: RAIZ, stdio: 'ignore',
    env: { ...process.env, PORT: String(PORTA_JOGO), SAVES_DIR: saves },
  });
  await esperarUrl(`http://127.0.0.1:${PORTA_JOGO}/`);
  return { proc, url: `http://127.0.0.1:${PORTA_JOGO}/` };
}

// Encerra só os msedge.exe que usam o NOSSO perfil (o Edge deixa processos filhos para trás)
function matarEdgeDoPerfil(perfil) {
  if (process.platform !== 'win32') return;
  const filtro = perfil.replace(/'/g, "''");
  const cmd = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | ` +
    `Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${filtro}') } | ` +
    `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', cmd], { stdio: 'ignore' }); } catch { /* nada a matar */ }
}

async function abrirNavegador({ largura = 1400, altura = 900 } = {}) {
  const perfil = path.join(TEMP, 'edge-perfil');
  matarEdgeDoPerfil(perfil);   // sobra de uma execução interrompida
  fs.mkdirSync(perfil, { recursive: true });
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORTA_CDP}`,
    `--window-size=${largura},${altura}`, `--user-data-dir=${perfil}`, '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });

  let pagina = null;
  for (let i = 0; i < 100 && !pagina; i++) {
    try {
      const alvos = await (await fetch(`http://127.0.0.1:${PORTA_CDP}/json`)).json();
      pagina = alvos.find(a => a.type === 'page');
    } catch { /* ainda abrindo */ }
    if (!pagina) await esperar(200);
  }
  if (!pagina) throw new Error('O Edge não abriu a porta de depuração ' + PORTA_CDP);

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((ok, erro) => { ws.onopen = ok; ws.onerror = () => erro(new Error('WebSocket do CDP falhou')); });
  let proximoId = 0;
  const pendentes = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (!m.id || !pendentes.has(m.id)) return;
    const { ok, erro } = pendentes.get(m.id);
    pendentes.delete(m.id);
    if (m.error) erro(new Error(m.error.message)); else ok(m.result);
  };
  const enviar = (method, params = {}) => new Promise((ok, erro) => {
    const id = ++proximoId;
    pendentes.set(id, { ok, erro });
    ws.send(JSON.stringify({ id, method, params }));
  });

  // Avalia uma expressão na página (escopo global do jogo) e devolve o valor; promessas são esperadas
  async function avaliar(expressao) {
    const r = await enviar('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error((d.exception && d.exception.description) || d.text);
    }
    return r.result.value;
  }

  async function tamanho(l, a) {
    await enviar('Emulation.setDeviceMetricsOverride', { width: l, height: a, deviceScaleFactor: 1, mobile: false });
  }

  async function abrir(url) {
    await enviar('Page.enable');
    await enviar('Page.navigate', { url });
    for (let i = 0; i < 100; i++) {
      await esperar(150);
      try { if (await avaliar('document.readyState') === 'complete') break; } catch { /* navegando */ }
    }
    await avaliar('document.fonts.ready.then(() => true)');
  }

  async function foto(arquivo, clip) {
    const params = { format: 'png' };
    if (clip) params.clip = { x: Math.round(clip.x), y: Math.round(clip.y), width: Math.round(clip.width), height: Math.round(clip.height), scale: 1 };
    const r = await enviar('Page.captureScreenshot', params);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, Buffer.from(r.data, 'base64'));
  }

  async function fechar() {
    try { await Promise.race([enviar('Browser.close'), esperar(3000)]); } catch { /* já fechado */ }
    try { ws.close(); } catch { /* ok */ }
    try { proc.kill(); } catch { /* ok */ }
    await esperar(500);
    matarEdgeDoPerfil(perfil);
  }

  await tamanho(largura, altura);
  return { enviar, avaliar, abrir, foto, tamanho, fechar };
}

module.exports = { RAIZ, TEMP, esperar, subirServidor, abrirNavegador };
