/* ============================================================
   musica.js — música de fundo: os .mp3 da pasta public/musicas OU o som sintetizado (ParkAudio.js)
   Depende de: dom.js, config.js, ParkAudio.js
   ============================================================ */

// O servidor lista os arquivos (GET /api/musicas); aqui eles tocam em ordem embaralhada, um depois do
// outro, sem fim. Um único elemento <audio> (new Audio()) é reaproveitado: trocar o "src" troca a faixa.
// modo: 'mp3' | 'sintetizada' | 'desligada' (o botão 🎵 alterna entre eles, nessa ordem)
const musica = { lista: [], ordem: [], pos: 0, modo: 'mp3', falhas: 0, audio: new Audio(), sintese: new ParkAudio() };
const MODOS_MUSICA = ['mp3', 'sintetizada', 'desligada'];

// Embaralhamento de Fisher-Yates: troca cada posição com uma sorteada entre ela e o início.
// Toda ordem tem a mesma chance (ordenar com sort(() => Math.random() - 0.5) NÃO tem essa garantia).
function embaralhar(v) {
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [v[i], v[j]] = [v[j], v[i]];   // troca por desestruturação, sem variável temporária
  }
  return v;
}

function tocarProxima() {
  if (!musica.lista.length) return;
  if (musica.pos >= musica.ordem.length) { musica.ordem = embaralhar([...musica.lista]); musica.pos = 0; }
  const nome = musica.ordem[musica.pos++];
  musica.audio.src = 'musicas/' + encodeURIComponent(nome);   // nomes com espaço ou acento viram %20, %C3...
  tocar();
}

// play() devolve uma Promise que falha se o navegador bloquear o som: ele só deixa tocar áudio
// depois que a pessoa interage com a página (clique ou tecla). Por isso tentamos de novo no 1º clique.
// Liga o som do modo atual e desliga o outro. Com o som sintetizado vale a mesma regra do navegador:
// o AudioContext nasce "suspended" até a 1ª interação; resume() o libera (ver "liberar" em iniciarMusica).
function tocar() {
  if (musica.modo !== 'mp3') musica.audio.pause();
  if (musica.modo !== 'sintetizada' && musica.sintese.isPlaying) musica.sintese.stop();
  if (musica.modo === 'sintetizada') {
    musica.sintese.init();
    if (musica.sintese.ctx.state === 'suspended') musica.sintese.ctx.resume().catch(() => {});
    musica.sintese.start();
  } else if (musica.modo === 'mp3' && musica.lista.length) {
    if (!musica.audio.src) { tocarProxima(); return; }
    musica.audio.play().catch(() => {});
  }
  atualizarBotaoMusica();
}

// Próximo modo do botão; sem nenhum .mp3, pula o modo 'mp3'
function proximoModo(modo) {
  const validos = MODOS_MUSICA.filter(m => m !== 'mp3' || musica.lista.length);
  return validos[(validos.indexOf(modo) + 1) % validos.length];
}

function atualizarBotaoMusica() {
  const b = $('btnMusica');
  const prox = { mp3: 'música mp3', sintetizada: 'som sintetizado', desligada: 'desligar' }[proximoModo(musica.modo)];
  if (musica.modo === 'mp3') {
    const faixa = decodeURIComponent((musica.audio.src.split('/').pop() || '')).replace(/\.mp3$/i, '');
    b.textContent = '🎵';
    b.title = `Tocando: ${faixa || '...'} (clique: ${prox})`;
  } else if (musica.modo === 'sintetizada') {
    b.textContent = '🎹';
    b.title = `Som sintetizado: multidão e órgão de carrossel (clique: ${prox})`;
  } else {
    b.textContent = '🔇';
    b.title = `Som desligado (clique: ${prox})`;
  }
}

// Preferência no localStorage. "musicaLigada" é a chave antiga (só liga/desliga): 'nao' vira 'desligada'.
function lerPreferenciaMusica() {
  try {
    const m = localStorage.getItem('musicaModo');
    if (MODOS_MUSICA.includes(m)) return m;
    return localStorage.getItem('musicaLigada') === 'nao' ? 'desligada' : 'mp3';
  } catch { return 'mp3'; }
}
function gravarPreferenciaMusica() {
  try { localStorage.setItem('musicaModo', musica.modo); } catch { /* sem armazenamento: tudo bem */ }
}

async function iniciarMusica() {
  musica.audio.volume = VOLUME_MUSICA;
  musica.modo = lerPreferenciaMusica();
  musica.audio.addEventListener('ended', () => { musica.falhas = 0; tocarProxima(); });
  musica.audio.addEventListener('playing', () => { musica.falhas = 0; atualizarBotaoMusica(); });
  // Arquivo corrompido ou que não abre: pula para o próximo, mas para se TODOS falharem (senão seria um laço sem fim)
  musica.audio.addEventListener('error', () => { if (++musica.falhas < musica.lista.length) tocarProxima(); });

  $('btnMusica').addEventListener('click', () => {
    musica.modo = proximoModo(musica.modo);
    gravarPreferenciaMusica();
    tocar();
  });
  // Primeira interação com a página: libera o som (ver tocar). "once" remove o ouvinte depois da 1ª vez.
  const liberar = () => tocar();
  addEventListener('pointerdown', liberar, { once: true, capture: true });
  addEventListener('keydown', liberar, { once: true, capture: true });

  try {
    const r = await fetch('/api/musicas');
    if (r.ok) musica.lista = await r.json();
  } catch { /* servidor fora do ar: o jogo segue sem música */ }
  if (musica.modo === 'mp3' && !musica.lista.length) musica.modo = 'sintetizada';   // sem arquivos: usa o sintetizado
  atualizarBotaoMusica();
  tocar();   // talvez o navegador bloqueie agora; nesse caso começa no primeiro clique
}
