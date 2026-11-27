// tests/smoke.js — teste de fumaça do Parque de Diversões.   Uso:  npm test
//
// Sobe o servidor numa porta livre (com os saves numa pasta temporária), abre o jogo no jsdom (um navegador
// simulado: sem janela, sem GPU) e confere as áreas de maior risco: API de saves, carga da página, modo livre,
// simulação de 5 meses, estilo visual (retrô), construção e rotação, salvar/carregar, cenários, quebra e conserto e o desenho de
// todas as atrações em todas as rotações.
//
// Como o jogo é feito de scripts clássicos com escopo global, o teste "dirige" o jogo chamando as próprias
// funções dele (simular, construir, aplicar...) por window.eval, sem esperar o relógio real: o
// requestAnimationFrame é desligado e o tempo do jogo avança só quando o teste manda.
//
// O canvas é falso (um Proxy que aceita qualquer chamada): ele só garante que desenhar() não lança
// exceção. Para CONFERIR o visual, abra o jogo no navegador.

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RAIZ = path.resolve(__dirname, '..');
const esperar = ms => new Promise(r => setTimeout(r, ms));

// ---------- mini executor de testes ----------
let total = 0, falhas = 0;
function ok(nome, condicao, detalhe = '') {
  total++;
  if (!condicao) falhas++;
  console.log(`  ${condicao ? 'ok   ' : 'FALHA'} ${nome}${!condicao || detalhe ? ` → ${detalhe}` : ''}`);
}
async function secao(titulo, fn) {
  console.log(`\n${titulo}`);
  try { await fn(); } catch (e) { total++; falhas++; console.log(`  FALHA exceção na seção: ${(e && e.stack) || e}`); }
}

// ---------- servidor ----------
async function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}
async function subirServidor() {
  const porta = await portaLivre();
  const pastaSaves = fs.mkdtempSync(path.join(os.tmpdir(), 'parque-teste-'));
  const proc = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(porta), SAVES_DIR: pastaSaves }, stdio: 'ignore' });
  const base = `http://localhost:${porta}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + '/')).ok) return { base, proc, pastaSaves }; } catch { /* ainda subindo */ }
    await esperar(200);
  }
  proc.kill();
  throw new Error('o servidor não subiu');
}

// ---------- jogo no jsdom ----------
let ultimoSetTransform = null;   // o que desenhar() pediu ao canvas: confere a escala do estilo visual
function ctxFalso() {   // aceita qualquer chamada e qualquer propriedade; measureText devolve uma largura
  const f = new Proxy(function () {}, {
    get: (_, nome) => {
      if (nome === 'measureText') return () => ({ width: 40 });
      if (nome === 'setTransform') return (...a) => { ultimoSetTransform = a; return f; };
      return f;
    },
    apply: () => f,
  });
  return f;
}

async function abrirJogo(base) {
  const problemas = [];   // erros de JS, console.error e console.warn do jogo
  const alertas = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => problemas.push(`erro: ${String((e.detail && e.detail.stack) || e.message).split('\n')[0]}`));
  vc.on('error', (...a) => problemas.push(`console.error: ${a.join(' ')}`));
  vc.on('warn', (...a) => problemas.push(`console.warn: ${a.join(' ')}`));
  const dom = await JSDOM.fromURL(base + '/', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const ctx = ctxFalso();
      w.HTMLCanvasElement.prototype.getContext = () => ctx;
      w.fetch = (url, opcoes) => {
        const destino = new URL(url, base);
        return fetch(destino, opcoes).catch(e => {
          if (e.cause && e.cause.code === 'ECONNRESET') return fetch(destino, opcoes);
          throw e;
        });
      };   // o jsdom não tem fetch; repete uma vez se o keep-alive expirou durante a simulação síncrona
      w.requestAnimationFrame = () => 0;                               // o tempo só anda quando o teste manda
      w.confirm = () => true;
      w.alert = m => alertas.push(String(m));
      Object.assign(w.HTMLMediaElement.prototype, { play: () => Promise.resolve(), pause() {}, load() {} });
      w.__fontesAudioIniciadas = 0;
      w.__fontesAudioAtivas = 0;
      w.__fontesAudioPendentes = [];
      w.__manterFontesAudio = false;
      w.AudioContext = class {
        constructor() { this.state = 'running'; this.sampleRate = 8000; this.currentTime = 0; this.destination = {}; }
        createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
        createBuffer(canais, tamanho) {
          const dados = Array.from({ length: canais }, () => new Float32Array(tamanho));
          return { getChannelData: canal => dados[canal] };
        }
        createBufferSource() {
          return {
            buffer: null, onended: null, connect() {}, disconnect() {},
            start() {
              w.__fontesAudioIniciadas++;
              if (w.__manterFontesAudio) {
                w.__fontesAudioAtivas++;
                w.__fontesAudioPendentes.push(this);
              } else if (this.onended) this.onended();
            },
            terminar() {
              w.__fontesAudioAtivas--;
              if (this.onended) this.onended();
            },
          };
        }
        resume() { this.state = 'running'; return Promise.resolve(); }
      };
      w.addEventListener('unhandledrejection', e => problemas.push(`promessa rejeitada: ${e.reason}`));
    },
  });
  const w = dom.window;
  const run = codigo => w.eval(codigo);
  for (let i = 0; i < 100 && run("typeof fase === 'undefined' || document.querySelectorAll('#listaCenarios > *').length === 0"); i++) await esperar(100);

  // Funções auxiliares DENTRO do jogo (têm acesso ao escopo global dele)
  run(`
    window.__passo = (n, dt = 0.1) => { for (let i = 0; i < n; i++) simular(dt); };
    window.__achaLivre = (chave, rot = 0, aPartirDe = 0) => {       // primeiro lugar onde a construção é permitida
      for (let gy = aPartirDe; gy < MAPA; gy++) for (let gx = 0; gx < MAPA; gx++) if (podeConstruir(chave, gx, gy, rot)) return { gx, gy };
      return null;
    };
    window.__nan = () => {                                           // valores numéricos inválidos no estado
      const ruins = [], olha = (o, nome) => { for (const k in o) if (typeof o[k] === 'number' && !Number.isFinite(o[k])) ruins.push(nome + '.' + k); };
      olha(fin, 'fin'); olha(avaliacao, 'avaliacao'); olha(stats, 'stats');
      convidados.forEach(g => { olha(g, 'convidado'); olha(g.n, 'convidado.n'); });
      funcionarios.forEach(f => olha(f, 'funcionario'));
      for (const a of atracoes.values()) olha(a, 'atracao');
      return ruins;
    };
    window.__invariantes = () => {                                   // estados que não podem existir
      const e = [];
      for (const a of atracoes.values()) {
        a.fila.forEach(g => { if (g.estado !== 'esperando') e.push('fila com convidado ' + g.estado); if (!convidados.includes(g)) e.push('fila com fantasma'); });
        a.passageiros.forEach(g => { if (g.estado !== 'brincando') e.push('passageiro ' + g.estado); if (!convidados.includes(g)) e.push('passageiro fantasma'); });
      }
      const nasAtracoes = new Set([...atracoes.values()].flatMap(a => [...a.fila, ...a.passageiros]));
      convidados.forEach(g => {
        if ((g.estado === 'esperando' || g.estado === 'brincando') && !nasAtracoes.has(g)) e.push('convidado preso em ' + g.estado);
        if (g.estado === 'usando' && !(g.uso && g.uso.def)) e.push('usando sem serviço');
      });
      return e;
    };
    window.__foto = () => JSON.stringify({                           // resumo comparável do estado (para salvar/carregar)
      MAPA, mapa, objetos, rotacoes: [...rotacoes], gestao: [...gestao],
      fin: { caixa: fin.caixa, divida: fin.divida, juros: fin.juros, mes: fin.mes, tMes: +fin.tMes.toFixed(3) },
      conv: convidados.length, func: funcionarios.map(f => [f.funcao, f.nome]), tempo: +tempo.toFixed(3), sairam: stats.sairam,
      atr: [...atracoes].map(([k, a]) => [k, a.fase, a.fila.length, a.passageiros.length, a.quebrada, +a.desgaste.toFixed(3)]),
    });
  `);
  return { w, run, problemas, alertas, fechar: () => w.close() };
}

// ---------- os testes ----------
(async () => {
  const servidor = await subirServidor();
  const { base } = servidor;
  process.on('exit', () => { try { servidor.proc.kill(); } catch { /* já encerrou */ } });
  const pedir = async (url, opcoes) => {
    try { return await fetch(url, opcoes); }
    catch (e) {
      if (!e.cause || e.cause.code !== 'ECONNRESET') throw e;
      return fetch(url, opcoes);
    }
  };
  const json = async (rota, opcoes) => { const r = await pedir(base + rota, opcoes); let corpo = null; try { corpo = await r.json(); } catch { /* sem corpo */ } return { status: r.status, corpo }; };
  const put = (id, corpo) => json('/api/saves/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

  await secao('Servidor e API', async () => {
    const pagina = await fetch(base + '/');
    ok('a página inicial responde', pagina.ok && (await pagina.text()).includes('<canvas'));
    ok('lista de saves começa vazia', JSON.stringify((await json('/api/saves')).corpo) === '[]');
    ok('id com "../" é recusado (400)', (await json('/api/saves/..%2F..%2Fetc')).status === 400);
    ok('save inexistente = 404', (await json('/api/saves/nao-existe')).status === 404);
    ok('corpo inválido = 400', (await put('x', { a: 1 })).status === 400);
    ok('rota desconhecida em /api = 404 em JSON', (await json('/api/xyz')).status === 404);
    const musicas = await json('/api/musicas');
    ok('/api/musicas devolve uma lista', musicas.status === 200 && Array.isArray(musicas.corpo));
  });

  const jogo = await abrirJogo(base);
  const { run, w } = jogo;

  await secao('Carga da página', async () => {
    ok('nenhum erro de JavaScript ao carregar', jogo.problemas.length === 0, jogo.problemas.join(' | '));
    ok('começa na tela inicial (fase "menu")', run("fase === 'menu' && document.getElementById('modalInicio').classList.contains('aberto')"));
    ok('todos os cenários aparecem na lista', run("document.querySelectorAll('#listaCenarios > *').length") === run('CENARIOS.length'), `${run('CENARIOS.length')} esperados`);
  });

  await secao('Modo livre', async () => {
    run("document.getElementById('btnModoLivre').click()");
    ok('o jogo começa (fase "jogando", mapa 24×24)', run("fase === 'jogando' && MAPA === 24"));
    ok('a entrada fica sobre um caminho', run("ehCaminho(ENTRADA.gx, ENTRADA.gy)"));
    ok('o parque inicial foi construído pelas regras do jogador', run('atracoes.size > 0 && gestao.size > 0') && jogo.problemas.length === 0, jogo.problemas.join(' | '));
    ok('a barra tem um cartão para cada objeto do catálogo', run("Object.keys(OBJETOS).every(k => ITENS_BARRA.some(i => i.camada === 'objeto' && i.chave === k))"));
  });

  await secao('Efeito sonoro de compras', async () => {
    const resultado = JSON.parse(run(`
      const caixa = fin.caixa, receita = fin.receitaMes;
      const g = { dinheiro: 100 }, ancora = { gx: MAPA - 1, gy: 0 };
      window.__fontesAudioIniciadas = 0;
      window.__fontesAudioAtivas = 0;
      window.__fontesAudioPendentes = [];
      window.__manterFontesAudio = true;
      for (let i = 0; i < 12; i++) pagar(g, ancora, 'comida', 1);
      const simultaneas = window.__fontesAudioAtivas;
      for (const fonte of window.__fontesAudioPendentes) fonte.terminar();
      window.__manterFontesAudio = false;
      pagar(g, ancora, 'comida', 0);
      const fontes = window.__fontesAudioIniciadas, dinheiro = g.dinheiro;
      fin.caixa = caixa; fin.receitaMes = receita;
      JSON.stringify({ fontes, simultaneas, dinheiro });
    `));
    ok('12 compras simultâneas iniciam 12 fontes Web Audio, sem limite', resultado.fontes === 12 && resultado.simultaneas === 12, `${resultado.simultaneas} vozes simultâneas`);
    ok('serviço gratuito não toca o efeito', resultado.dinheiro === 88);
  });

  await secao('Valores flutuantes de transações', async () => {
    run('novoJogoLivre(); tempo = 10; valoresFlutuantes.length = 0');
    const compra = JSON.parse(run(`
      pagar({ dinheiro: 20, x: 8.25, y: 9.5 }, { gx: MAPA - 1, gy: 0 }, 'comida', 2.5);
      pagar({ dinheiro: 20, x: 8.25, y: 9.5 }, { gx: MAPA - 1, gy: 0 }, 'comida', 0);
      JSON.stringify(valoresFlutuantes.map(v => [v.valor, v.gx, v.gy, v.texto]));
    `));
    ok('compra paga mostra o valor positivo na posição do convidado',
      compra.length === 1 && compra[0][0] === 2.5 && compra[0][1] === 8.25 && compra[0][2] === 9.5 &&
      compra[0][3] === '+$2,50');

    const formatacao = JSON.parse(run(`
      valoresFlutuantes.length = 0;
      mostrarValorFlutuante(2, 1, 1);
      mostrarValorFlutuante(-12.3, 2, 2);
      JSON.stringify(valoresFlutuantes.map(v => v.texto));
    `));
    ok('valores inteiros e despesas exibem sempre dois dígitos de centavos',
      JSON.stringify(formatacao) === JSON.stringify(['+$2,00', '−$12,30']), JSON.stringify(formatacao));

    const despesas = JSON.parse(run(`
      valoresFlutuantes.length = 0;
      fecharMes();
      JSON.stringify({
        valores: valoresFlutuantes.map(v => v.valor),
        objetos: objetos.flat().filter(c => typeof c === 'string').filter(c => (ECONOMIA[c] || {}).manutencao > 0).length,
        funcionarios: funcionarios.filter(f => (FUNCOES[f.funcao] || FUNCOES.faxineiro).salario > 0).length
      });
    `));
    ok('fechamento mostra manutenção negativa por objeto e salário negativo por funcionário',
      despesas.valores.length === despesas.objetos + despesas.funcionarios &&
      despesas.valores.every(v => v < 0) && despesas.funcionarios > 0,
      `${despesas.valores.length} cobranças negativas`);
    run('desenhar()');
    ok('os valores flutuantes são desenhados sem erro', jogo.problemas.length === 0, jogo.problemas.join(' | '));
    run('tempo += ANIMACAO_DINHEIRO.duracao; atualizarValoresFlutuantes()');
    ok('valores flutuantes expiram após a animação', run('valoresFlutuantes.length === 0'));
    run('novoJogoLivre()');
  });

  await secao('Simulação de 5 meses (modo livre)', async () => {
    run('__passo(15000)');   // 15 000 passos de 0,1 s = 1 500 s de jogo = 5 meses
    ok('o relógio andou até o 5º mês', run('fin.mes') >= 5, `mês ${run('fin.mes')}`);
    ok('nenhum valor numérico inválido (NaN/Infinity)', run('__nan().length') === 0, JSON.stringify(run('__nan().slice(0, 5)')));
    ok('nenhum estado incoerente de convidados/filas', run('__invariantes().length') === 0, JSON.stringify(run('__invariantes().slice(0, 5)')));
    ok('convidados chegaram e também saíram', run('convidados.length > 0 && stats.sairam > 0'), `${run('convidados.length')} no parque, ${run('stats.sairam')} saíram`);
    ok('houve receita nos objetos', run('[...gestao.values()].reduce((s, d) => s + d.receita, 0) > 0'));
    ok('a avaliação fica entre 0 e 999', run('avaliacao.nota >= 0 && avaliacao.nota <= 999'), `nota ${run('Math.round(avaliacao.nota)')}`);
    ok('o balanço do mês foi registrado', run('!!fin.balanco && Number.isFinite(fin.balanco.receita)'));
    run('desenhar()');
    ok('desenhar() não lança exceção', jogo.problemas.length === 0, jogo.problemas.join(' | '));
  });

  await secao('Estilo visual (original e retrô)', async () => {
    run('novoJogoLivre()');
    const ids = run('ESTILOS_VISUAIS.map(e => e.id)');
    ok('o original é o padrão (primeiro da lista, escala 1)', ids[0] === 'original' && run('ESTILOS_VISUAIS[0].escala') === 1 && run('escalaPixel') === 1);
    ok('há pelo menos um estilo retrô', ids.length >= 2 && run('ESTILOS_VISUAIS.some(e => e.escala > 1)'));
    // pontos de tela que o mouse "aponta": não podem mudar com o estilo (câmera e mouse ficam em pixels de tela)
    run("window.__celulas = () => JSON.stringify([[100, 100], [400, 300], [640, 500], [900, 120]].map(([x, y]) => telaParaGrade(x, y)))");
    const celulasOriginal = run('__celulas()');
    // espia o contorno de 1 px entre os tiles (some no retrô, onde viraria pontilhado)
    run("window.__poligonoOriginal = poligono; window.__cores = new Set(); window.poligono = (p, cor, contorno) => { window.__cores.add(cor); if (contorno === 'rgba(0,0,0,0.12)') window.__contornos++; return window.__poligonoOriginal(p, cor, contorno); }");
    const cv = w.document.getElementById('tela');
    for (const id of ids) {
      const e = run(`ESTILOS_VISUAIS.find(e => e.id === '${id}')`);
      run(`aplicarEstiloVisual('${id}')`);
      run('window.__contornos = 0; window.__cores = new Set(); desenhar()');
      const fator = run('fatorCanvas()');
      ok(`${id}: o canvas tem 1/${e.escala} da resolução da tela`, cv.width === Math.round(w.innerWidth * fator) && Math.abs(fator * e.escala - (w.devicePixelRatio || 1)) < 1e-9, `${cv.width}×${cv.height}`);
      ok(`${id}: desenhar() usa o mesmo fator na transformação`, !!ultimoSetTransform && Math.abs(ultimoSetTransform[0] - fator) < 1e-9 && Math.abs(ultimoSetTransform[3] - fator) < 1e-9);
      ok(`${id}: as classes do canvas (pixelado, paleta-retro) seguem a escala`, cv.classList.contains('pixelado') === (e.escala > 1) && cv.classList.contains('paleta-retro') === (e.escala > 1 && e.paleta));
      ok(`${id}: o contorno entre tiles ${e.escala > 1 ? 'some' : 'continua'}`, (run('__contornos') > 0) === (e.escala === 1), `${run('__contornos')} chamadas`);
      const usadas = run('[...__cores]'), esperadas = run(e.escala > 1 ? 'TIPOS.GRAMA.corRetro' : 'TIPOS.GRAMA.cor');
      ok(`${id}: a grama usa o par de tons do estilo (${e.escala > 1 ? 'corRetro' : 'cor'})`, esperadas.every(c => usadas.includes(c)), usadas.slice(0, 4).join(' '));
      ok(`${id}: o mouse continua apontando para os mesmos tiles`, run('__celulas()') === celulasOriginal);
      ok(`${id}: a escolha fica salva`, w.localStorage.getItem(run('CHAVE_ESTILO')) === id);
    }
    // O filtro #retro (index.html) reduz os níveis de cor. O quadriculado só aparece se cada par `corRetro` continuar
    // distinto DEPOIS do filtro; simulamos o filtro lendo as tabelas do próprio HTML (feFuncDiscrete).
    const tabelas = ['R', 'G', 'B'].map(c => w.document.querySelector(`#retro feFunc${c}`).getAttribute('tableValues').trim().split(/\s+/).map(Number));
    const filtrado = hex => [1, 3, 5].map((i, canal) => { const n = tabelas[canal].length; return tabelas[canal][Math.min(Math.floor(parseInt(hex.slice(i, i + 2), 16) / 255 * n), n - 1)]; }).join();
    const pares = run('Object.entries(TIPOS).map(([k, t]) => [k, t.corRetro])');
    ok('todo terreno tem um par corRetro', pares.every(([, par]) => Array.isArray(par) && par.length === 2), pares.map(([k]) => k).join(', '));
    ok('depois do filtro de paleta os dois tons de cada terreno continuam distintos (o quadriculado aparece)', pares.every(([, [a, b]]) => filtrado(a) !== filtrado(b)), pares.map(([k, [a, b]]) => `${k}: ${filtrado(a)} / ${filtrado(b)}`).join(' | '));
    ok('...e os terrenos continuam distintos entre si', new Set(pares.flatMap(([, [a, b]]) => [filtrado(a), filtrado(b)])).size === pares.length * 2);
    run("aplicarEstiloVisual('original')");
    const vistos = [];
    for (let i = 0; i < ids.length; i++) { run("document.getElementById('btnEstilo').click()"); vistos.push(run('estiloAtual().id')); }
    ok('o botão 🎨 percorre os estilos em ciclo e volta ao original', vistos.join() === [...ids.slice(1), ids[0]].join(), vistos.join());
    ok('o botão (compacto) mostra o ícone e a dica diz o estilo atual e o próximo', run("document.getElementById('btnEstilo').textContent").startsWith('🎨') && run("document.getElementById('btnEstilo').title").includes(run('estiloAtual().nome')) && run("document.getElementById('btnEstilo').title").includes('clique'));
    // robustez: valor desconhecido e localStorage bloqueado (modo privado, política do navegador)
    w.localStorage.setItem(run('CHAVE_ESTILO'), 'estilo-que-nao-existe');
    ok('valor salvo desconhecido cai no padrão', run('estiloSalvo()') === 'original');
    const desconhecido = run("(() => { try { aplicarEstiloVisual('estilo-que-nao-existe'); return escalaPixel; } catch (e) { return 'erro: ' + e.message; } })()");
    ok('aplicar um estilo desconhecido usa o padrão, sem erro', desconhecido === 1, String(desconhecido));
    run("window.__st = { g: Storage.prototype.getItem, s: Storage.prototype.setItem }; Storage.prototype.getItem = () => { throw new Error('bloqueado'); }; Storage.prototype.setItem = () => { throw new Error('bloqueado'); }");
    const bloqueado = run("(() => { try { aplicarEstiloVisual('retro3'); return estiloSalvo() === 'original' && escalaPixel === 3; } catch (e) { return 'erro: ' + e.message; } })()");
    ok('localStorage bloqueado não derruba o estilo (vale só na sessão)', bloqueado === true, String(bloqueado));
    run("Storage.prototype.getItem = __st.g; Storage.prototype.setItem = __st.s; window.poligono = window.__poligonoOriginal; aplicarEstiloVisual('original')");
    ok('nenhum erro durante a troca de estilos', jogo.problemas.length === 0, jogo.problemas.join(' | '));
  });

  await secao('Construção, custos, regras e rotação', async () => {
    run('novoJogoLivre(32)');
    run('window.__constroi = (chave, gx, gy, rot = 0) => { ferramenta = { camada: "objeto", chave }; rotacaoAtual = rot; aplicar(gx, gy); }');
    run('window.__demole = (gx, gy) => { ferramenta = { camada: "remover", chave: "X" }; aplicar(gx, gy); }');
    const l = run("__achaLivre('ARVORE')");
    const caixa0 = run('fin.caixa');
    run('valoresFlutuantes.length = 0');
    run(`__constroi('ARVORE', ${l.gx}, ${l.gy})`);
    ok('construir cobra o custo', run(`!!objetoEm(${l.gx}, ${l.gy})`) && caixa0 - run('fin.caixa') === run("custoDe('ARVORE')"));
    ok('construir mostra a despesa negativa no centro do objeto',
      run(`valoresFlutuantes.length === 1 && valoresFlutuantes[0].valor === -custoDe('ARVORE') && valoresFlutuantes[0].gx === ${l.gx} + 0.5 && valoresFlutuantes[0].gy === ${l.gy} + 0.5`));
    run(`__demole(${l.gx}, ${l.gy})`);
    ok('demolir remove e devolve a fração do custo', run(`!objetoEm(${l.gx}, ${l.gy})`) && Math.abs(run('fin.caixa') - (caixa0 - run("custoDe('ARVORE')") * (1 - run('REEMBOLSO')))) < 0.01);
    run('fin.caixa = 0; valoresFlutuantes.length = 0');
    run(`__constroi('ARVORE', ${l.gx}, ${l.gy})`);
    ok('sem saldo não constrói nem mostra cobrança', run(`!objetoEm(${l.gx}, ${l.gy}) && valoresFlutuantes.length === 0`));
    run('fin.caixa = 1e6');

    const funcionariosAntes = run('funcionarios.length');
    run(`valoresFlutuantes.length = 0; ferramenta = { camada: 'contratar', chave: 'faxineiro' }; aplicar(ENTRADA.gx, ENTRADA.gy)`);
    ok('contratar funcionário mostra a despesa negativa no local de contratação',
      run(`funcionarios.length === ${funcionariosAntes} + 1 && valoresFlutuantes.length === 1 &&
        valoresFlutuantes[0].valor === -FUNCOES.faxineiro.contratacao &&
        valoresFlutuantes[0].gx === ENTRADA.gx + 0.5 && valoresFlutuantes[0].gy === ENTRADA.gy + 0.5`));

    // terreno x objeto
    run(`__constroi('ARVORE', ${l.gx}, ${l.gy})`);
    run(`ferramenta = { camada: 'terreno', chave: 'CAMINHO' }; aplicar(${l.gx}, ${l.gy})`);
    ok('não se troca o chão sob um objeto', run(`!!objetoEm(${l.gx}, ${l.gy}) && mapa[${l.gy}][${l.gx}] !== 'CAMINHO'`));
    run(`__demole(${l.gx}, ${l.gy})`);
    run("ferramenta = { camada: 'terreno', chave: 'GRAMA' }; aplicar(ENTRADA.gx, ENTRADA.gy)");
    ok('a entrada não pode ser alterada', run('ehCaminho(ENTRADA.gx, ENTRADA.gy)'));

    // rotação: a tecla Z cicla 0 → 1 → 2 → 3 → 0 e só vale para atrações
    const tecla = (alvo, opcoes = {}) => alvo.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'z', bubbles: true, ...opcoes }));
    run("ferramenta = { camada: 'objeto', chave: 'RODA_GIGANTE' }; rotacaoAtual = 0");
    const giros = []; for (let i = 0; i < 4; i++) { tecla(w.document.body); giros.push(run('rotacaoAtual')); }
    ok('Z gira 90° por vez e volta ao início (1, 2, 3, 0)', giros.join() === '1,2,3,0', giros.join());
    tecla(w.document.body, { ctrlKey: true }); tecla(w.document.getElementById('inNomeSave'));
    ok('Ctrl+Z e Z dentro de campo de texto não giram', run('rotacaoAtual') === 0);
    run("ferramenta = { camada: 'objeto', chave: 'ARVORE' }"); tecla(w.document.body);
    ok('objetos que não são atrações não giram', run('rotacaoAtual') === 0);

    // a pegada acompanha a rotação (rot ímpar troca largura e profundidade) e a demolição leva tudo
    for (const chave of ['RODA_GIGANTE', 'NAVIO_PIRATA', 'MONTANHA_RUSSA', 'TREM']) {
      for (const rot of [0, 1, 2, 3]) {
        const tam = run(`OBJETOS['${chave}'].tam`);                   // fonte independente da função tamanhoDe
        const [ww, hh] = rot % 2 ? [tam.h, tam.w] : [tam.w, tam.h];   // rot ímpar troca largura e profundidade
        const p = run(`__achaLivre('${chave}', ${rot})`);
        if (!p) { ok(`${chave} rot ${rot}: há lugar no mapa de teste`, false); continue; }
        run(`__constroi('${chave}', ${p.gx}, ${p.gy}, ${rot})`);
        const celulas = []; for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) celulas.push(`objetoEm(${p.gx + i}, ${p.gy + j})`);
        const ocupada = run(`[${celulas.join(',')}].every(o => o && o.gx === ${p.gx} && o.gy === ${p.gy})`)
          && run(`!objetoEm(${p.gx + ww}, ${p.gy}) && !objetoEm(${p.gx}, ${p.gy + hh})`);   // e nada além da pegada esperada
        const girada = run(`rotacaoDe(${p.gx}, ${p.gy})`) === rot;
        run(`__demole(${p.gx + ww - 1}, ${p.gy + hh - 1})`);   // demolir pela célula do canto oposto
        const vazia = run(`[${celulas.join(',')}].every(o => !o) && !rotacoes.has(chaveAtr(${p.gx}, ${p.gy})) && !gestao.has(chaveAtr(${p.gx}, ${p.gy}))`);
        ok(`${chave} rot ${rot} (${ww}×${hh}): constrói, guarda a rotação e a demolição limpa tudo`, ocupada && girada && vazia);
      }
    }
  });

  await secao('Salvar e carregar', async () => {
    run('novoJogoLivre()');
    const girada = run("__achaLivre('NAVIO_PIRATA', 3)");
    run(`__constroi('NAVIO_PIRATA', ${girada.gx}, ${girada.gy}, 3)`);   // uma atração girada 270° entra no save
    run('__passo(6000)');   // 2 meses: convidados, filas e funcionários em andamento
    const antes = run('__foto()');
    const id = await run("salvarEm('Teste de fumaça')");
    ok('o id do save vem do nome (sem acento nem espaço)', id === 'teste-de-fumaca', id);
    ok('o save aparece na API', (await json('/api/saves')).corpo.some(s => s.id === id));
    run('__passo(1500)');
    run("ferramenta = { camada: 'terreno', chave: 'AGUA' }; aplicar(1, 1); aplicar(2, 1)");
    ok('o estado mudou depois do save', run('__foto()') !== antes);
    await run(`carregarDe('${id}')`);
    ok('carregar restaura mapa, objetos, finanças, convidados, filas e funcionários', run('__foto()') === antes);
    ok('...inclusive a rotação da atração girada', run(`rotacaoDe(${girada.gx}, ${girada.gy})`) === 3);
    ok('nenhum estado incoerente depois de carregar', run('__invariantes().length') === 0 && run('__nan().length') === 0);
    run('__passo(2000); desenhar()');
    ok('o jogo continua normal depois de carregar', run('__invariantes().length') === 0 && run('__nan().length') === 0 && jogo.problemas.length === 0, jogo.problemas.join(' | '));

    // saves inválidos não podem estragar o parque atual
    const bom = (await json('/api/saves/' + id)).corpo;
    const tenta = async nome => { const s = run('__foto()'); let erro = null; try { await run(`carregarDe('${nome}')`); } catch (e) { erro = e.message; } return { erro, intacto: run('__foto()') === s }; };
    await put('mapa-quebrado', { ...bom, estado: { ...bom.estado, mapa: [['GRAMA']] } });
    let r = await tenta('mapa-quebrado'); ok('save com mapa de tamanho errado é recusado e o jogo fica intacto', !!r.erro && r.intacto, r.erro);
    await put('futuro', { ...bom, versao: 99 });
    r = await tenta('futuro'); ok('save de versão futura é recusado', !!r.erro && r.intacto, r.erro);
    await put('lixo', { versao: 2, estado: { mapa: 5 } });
    r = await tenta('lixo'); ok('save sem forma de mapa é recusado', !!r.erro && r.intacto, r.erro);
    const sujo = JSON.parse(JSON.stringify(bom.estado));
    sujo.mapa[0][0] = 'LAVA'; sujo.objetos[0][0] = 'OBJETO_QUE_NAO_EXISTE'; sujo.convidados.push({ x: 'abc' });
    await put('sujo', { ...bom, estado: sujo });
    r = await tenta('sujo'); ok('chaves desconhecidas e convidado inválido são saneados, sem erro', r.erro === null, r.erro);
    ok('...terreno desconhecido virou grama, objeto desconhecido sumiu', run("mapa[0][0] === 'GRAMA' && objetos[0][0] === null"));
    run('__passo(500)');
    ok('...e o jogo segue rodando', run('__invariantes().length') === 0 && run('__nan().length') === 0);

    // mapa de outro tamanho: o save de 24×24 reabre mesmo com o jogo atual em 32×32
    run('novoJogoLivre(32)');
    ok('jogo atual em 32×32', run('MAPA') === 32);
    await run(`carregarDe('${id}')`);
    ok('carregar um save de 24×24 redimensiona o mapa', run('MAPA') === 24 && run('__foto()') === antes);
    fs.writeFileSync(path.join(servidor.pastaSaves, 'estragado.json'), '{ isto não é json');
    ok('arquivo de save corrompido é ignorado na listagem', (await json('/api/saves')).status === 200);
  });

  await secao('Cenários', async () => {
    const ids = run('CENARIOS');
    for (const id of ids) {
      run(`window.__def = null; window.__erroDef = null; buscarCenario('${id}').then(d => { window.__def = d; }).catch(e => { window.__erroDef = e.message; })`);
      for (let i = 0; i < 50 && !run('window.__def || window.__erroDef'); i++) await esperar(100);
      ok(`${id}: o arquivo é válido e carrega`, run('!!window.__def'), run('window.__erroDef') || '');
      if (!run('window.__def')) continue;
      const avisosAntes = jogo.problemas.length;
      run(`iniciarCenario('${id}', window.__def)`);
      ok(`${id}: começa com objetivo, caixa e todos os objetos no lugar`, run("fase === 'jogando' && partida.modo === 'cenario' && !!tipoDoObjetivo()") && jogo.problemas.length === avisosAntes, jogo.problemas.slice(avisosAntes).join(' | '));
      run('__passo(3000)');   // 1 mês
      ok(`${id}: 1 mês de simulação sem valores inválidos e com progresso calculável`, run('__nan().length') === 0 && Number.isFinite(run('tipoDoObjetivo().atual()')));
    }
    // fim de cenário: sem fazer nada, o prazo estoura e o jogo precisa terminar (vitória ou derrota), sem travar
    run("window.__def = null; buscarCenario('primeiro-parque').then(d => { window.__def = d; }).catch(() => {})");
    for (let i = 0; i < 50 && !run('window.__def'); i++) await esperar(100);
    run("iniciarCenario('primeiro-parque', window.__def)");
    const prazo = run('partida.objetivo.prazo');
    for (let i = 0; i < prazo + 2 && run("fase === 'jogando'"); i++) run('__passo(3000)');
    ok('quando o prazo acaba o cenário termina (vitória ou derrota)', ['vitoria', 'derrota'].includes(run('fase')), `fase: ${run('fase')}`);
    ok('...e a janela de fim abre', run("document.getElementById('modalFim').classList.contains('aberto')"));
  });

  await secao('Defeitos e mecânicos', async () => {
    run('novoJogoLivre()');
    run('__passo(600)');
    const [chave] = run('[...atracoes.keys()]');
    run(`window.__a = atracoes.get('${chave}'); quebrar(window.__a)`);
    ok('quebrar para a atração e desfaz a fila', run('__a.quebrada === true && __a.fila.length === 0'));
    run('contratarFuncionario("mecanico", ENTRADA.gx, ENTRADA.gy)');
    let consertou = false, segundos = 0;
    for (; segundos < 600 && !consertou; segundos += 10) { run('__passo(100)'); consertou = run('__a.quebrada === false'); }   // 100 passos = 10 s de jogo
    ok('o mecânico chega pelo caminho e conserta', consertou, `consertado em até ${segundos} s de jogo`);
    ok('o conserto dá garantia de corridas sem quebrar', run('__a.consertos >= 1 && __a.garantia > 0'));
    ok('nenhum estado incoerente', run('__invariantes().length') === 0 && run('__nan().length') === 0);
  });

  await secao('Desenho de todas as atrações em todas as rotações', async () => {
    run('novoJogoLivre(64)');
    // uma poça grande de água para os brinquedos aquáticos; o resto é grama livre
    run("for (let gy = 36; gy < 62; gy++) for (let gx = 36; gx < 62; gx++) mapa[gy][gx] = 'AGUA'");
    run('fin.caixa = 1e9');
    const naoCaberam = [];
    for (const chave of run('Object.keys(OBJETOS)')) {
      const giros = run(`rotacionavel('${chave}')`) ? [0, 1, 2, 3] : [0];
      for (const rot of giros) {
        const p = run(`__achaLivre('${chave}', ${rot})`);
        if (p) run(`construir('${chave}', ${p.gx}, ${p.gy}, ${rot})`); else naoCaberam.push(`${chave}/${rot}`);
      }
    }
    ok('todos os objetos (e rotações) cabem no mapa de teste', naoCaberam.length === 0, naoCaberam.join(', '));
    run('semear(60, [ENTRADA.gx, ENTRADA.gy])');
    for (const zoom of [0.3, 1, 2.5]) run(`camera.zoom = ${zoom}; __passo(300); desenhar()`);   // de longe (boneco simples) a bem de perto
    ok('desenhar() funciona com todos os objetos, convidados e vários zooms', jogo.problemas.length === 0, jogo.problemas.join(' | '));
    ok('nenhum alerta (alert) inesperado', jogo.alertas.length === 0, jogo.alertas.join(' | '));
  });

  jogo.fechar();
  console.log(`\n${total - falhas} de ${total} verificações passaram${falhas ? `, ${falhas} FALHARAM` : ''}.`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('Erro no teste:', e); process.exit(1); });
