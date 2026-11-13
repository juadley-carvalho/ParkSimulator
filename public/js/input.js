/* ============================================================
   input.js — mouse, toque, câmera e regras de aplicação das ferramentas
   Botão esquerdo: pinta/constrói/inspeciona · Botão do meio: move · Roda: zoom
   ============================================================ */

function ajustarTamanho() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}

function centralizar() {
  const c = gradeParaMundo(MAPA / 2, MAPA / 2);
  camera.zoom = Math.min(1, innerWidth / (MAPA * TILE_W * 0.9));
  camera.x = innerWidth / 2 - c.x * camera.zoom;
  camera.y = innerHeight / 2 - c.y * camera.zoom;
}

// Única função que altera os dados. Aqui ficam as regras do jogo.
function aplicar(gx, gy) {
  const { camada, chave } = ferramenta;   // precisa vir ANTES de usar "chave" na linha abaixo
  if (!dentroDoMapa(gx, gy)) return;
  if (camada === 'inspecionar') { selecionar(gx, gy); return; }
  if (camada === 'terreno') {
    const o = objetoEm(gx, gy);
    if (mapa[gy][gx] === chave) return;                  // nada a mudar, nada a cobrar
    if (ehEntrada(gx, gy)) { avisar('A entrada não pode ser alterada'); return; }
    // Água "afoga" qualquer objeto (abaixo). Grama/caminho não podem deixar o objeto no chão errado:
    // nada fica sobre o caminho (bloquearia a passagem), exceto quem é "sobreCaminho" (o banco).
    // Brinquedo aquático: a água sob ele não pode virar grama/caminho
    if (o && chave !== 'AGUA' && (ficaNaAgua(o.chave) || (chave === 'CAMINHO') !== ficaSobreCaminho(o.chave))) {
      avisar(`${OBJETOS[o.chave].nome} está aqui: demola antes de trocar o chão`); return;
    }
    // ... nem a dos canais por onde os barcos saem e voltam
    const canal = mapa[gy][gx] === 'AGUA' && donoDoCanal(gx, gy);
    if (canal) { avisar(`Os barcos do ${OBJETOS[canal.chave].nome} passam por aqui: o canal precisa ser de água`); return; }
    if (!cobrar(CUSTO_TERRENO[chave] || 0)) return;
    mapa[gy][gx] = chave;
    if (chave === 'AGUA') removerObjeto(gx, gy);       // água "afoga" o objeto
    // Um caminho novo pode fechar o último lado livre de um banco vizinho: ele não tem mais onde ficar
    if (chave === 'CAMINHO')
      for (const [dx, dy] of VIZINHOS) {
        const nx = gx + dx, ny = gy + dy;
        if (!dentroDoMapa(nx, ny) || typeof objetos[ny][nx] !== 'string') continue;
        if (ficaSobreCaminho(objetos[ny][nx]) && !ladosSemCaminho(nx, ny).length) {
          avisar(`${OBJETOS[objetos[ny][nx]].nome} removido: o caminho fechou todos os lados`);
          removerObjeto(nx, ny);   // devolve o reembolso normal da demolição
        }
      }
  } else if (camada === 'objeto') {
    if (podeConstruir(chave, gx, gy, rotacaoAtual) && cobrar(custoDe(chave))) construir(chave, gx, gy, rotacaoAtual); // não se constrói na água
  } else {
    removerObjeto(gx, gy);                              // demolir
  }
}

const pintarEm = (sx, sy) => { const g = telaParaGrade(sx, sy); aplicar(g.gx, g.gy); };

// Ao arrastar rápido o mouse "pula" tiles. Amostramos pontos entre a posição
// anterior e a atual para o traço ficar contínuo.
function pintarLinha(a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const passos = Math.max(1, Math.ceil(dist / (TILE_H * camera.zoom / 2)));
  for (let i = 1; i <= passos; i++) {
    const t = i / passos;
    pintarEm(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }
}

// Liga os eventos de mouse/toque ao canvas (chamada uma vez, em main.js)
// Gira 90° a atração que está sendo posicionada: 0 → 1 → 2 → 3 → 0. O resto (%) faz a volta.
function girarObjeto() {
  if (ferramenta.camada !== 'objeto') return;
  if (!rotacionavel(ferramenta.chave)) { avisar(`${OBJETOS[ferramenta.chave].nome}: só as atrações giram`); return; }
  rotacaoAtual = (rotacaoAtual + 1) % 4;
}

function iniciarEntradaUsuario() {
  window.addEventListener('keydown', e => {
    if ((e.key || '').toLowerCase() !== TECLA_GIRAR || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;   // digitando em um campo
    girarObjeto();
  });

  canvas.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }); // sem autoscroll
  canvas.addEventListener('pointerdown', e => {
    if (e.button === 1) { modo = 'mover'; canvas.classList.add('dragging'); }
    else if (e.button === 0) { modo = 'pintar'; pintarEm(e.clientX, e.clientY); }
    else return;
    ultimo = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    const atual = { x: e.clientX, y: e.clientY };
    if (modo === 'mover') {
      camera.x += atual.x - ultimo.x;
      camera.y += atual.y - ultimo.y;
    } else if (modo === 'pintar') {
      pintarLinha(ultimo, atual);
    }
    ultimo = atual;

    hover = telaParaGrade(atual.x, atual.y);
    if (dentroDoMapa(hover.gx, hover.gy)) {
      const o = objetoEm(hover.gx, hover.gy), obj = o && o.chave;
      info.textContent = `(${hover.gx}, ${hover.gy}) · ${TIPOS[mapa[hover.gy][hover.gx]].nome}` +
                         (obj ? ` · ${OBJETOS[obj].nome}` : '');
    } else info.textContent = '–';
  });
  // "pointercancel": o navegador pode cancelar o ponteiro (alt+tab, gesto do sistema, toque).
  // Sem tratá-lo, o modo "pintar" ficaria preso e o próximo movimento continuaria construindo.
  const soltar = () => { modo = null; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const novo = Math.min(3, Math.max(0.3, camera.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    const k = novo / camera.zoom;
    camera.x = e.clientX - (e.clientX - camera.x) * k;
    camera.y = e.clientY - (e.clientY - camera.y) * k;
    camera.zoom = novo;
  }, { passive: false });
  addEventListener('resize', ajustarTamanho);
}
