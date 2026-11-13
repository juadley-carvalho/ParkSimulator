/* ============================================================
   musica.js — música de fundo (os .mp3 da pasta public/musicas)
   Depende de: dom.js, config.js
   ============================================================ */

// O servidor lista os arquivos (GET /api/musicas); aqui eles tocam em ordem embaralhada, um depois do
// outro, sem fim. Um único elemento <audio> (new Audio()) é reaproveitado: trocar o "src" troca a faixa.
const musica = { lista: [], ordem: [], pos: 0, ligada: true, falhas: 0, audio: new Audio() };

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
function tocar() {
  if (!musica.ligada || !musica.lista.length) return;
  if (!musica.audio.src) { tocarProxima(); return; }
  musica.audio.play().catch(() => {});
  atualizarBotaoMusica();
}

function atualizarBotaoMusica() {
  const b = $('btnMusica');
  if (!musica.lista.length) {
    b.textContent = '🎵'; b.disabled = true;
    b.title = 'Sem músicas: coloque arquivos .mp3 na pasta public/musicas e recarregue a página';
    return;
  }
  b.disabled = false;
  b.textContent = musica.ligada ? '🎵' : '🔇';
  const faixa = decodeURIComponent((musica.audio.src.split('/').pop() || '')).replace(/\.mp3$/i, '');
  b.title = musica.ligada ? `Tocando: ${faixa || '...'} (clique para desligar)` : 'Música desligada (clique para ligar)';
}

function lerPreferenciaMusica() {
  try { return localStorage.getItem('musicaLigada') !== 'nao'; } catch { return true; }
}
function gravarPreferenciaMusica() {
  try { localStorage.setItem('musicaLigada', musica.ligada ? 'sim' : 'nao'); } catch { /* sem armazenamento: tudo bem */ }
}

async function iniciarMusica() {
  musica.audio.volume = VOLUME_MUSICA;
  musica.ligada = lerPreferenciaMusica();
  musica.audio.addEventListener('ended', () => { musica.falhas = 0; tocarProxima(); });
  musica.audio.addEventListener('playing', () => { musica.falhas = 0; atualizarBotaoMusica(); });
  // Arquivo corrompido ou que não abre: pula para o próximo, mas para se TODOS falharem (senão seria um laço sem fim)
  musica.audio.addEventListener('error', () => { if (++musica.falhas < musica.lista.length) tocarProxima(); });

  $('btnMusica').addEventListener('click', () => {
    musica.ligada = !musica.ligada;
    gravarPreferenciaMusica();
    if (musica.ligada) tocar(); else musica.audio.pause();
    atualizarBotaoMusica();
  });
  // Primeira interação com a página: libera o som (ver tocar). "once" remove o ouvinte depois da 1ª vez.
  const liberar = () => { if (musica.audio.paused) tocar(); };
  addEventListener('pointerdown', liberar, { once: true, capture: true });
  addEventListener('keydown', liberar, { once: true, capture: true });

  try {
    const r = await fetch('/api/musicas');
    if (r.ok) musica.lista = await r.json();
  } catch { /* servidor fora do ar: o jogo segue sem música */ }
  atualizarBotaoMusica();
  tocar();   // talvez o navegador bloqueie agora; nesse caso começa no primeiro clique
}
