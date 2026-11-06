/* ============================================================
   desenho.js — tudo que desenha no canvas
   Só lê o estado; nunca o altera. Precisa carregar ANTES de objetos.js
   (o catálogo OBJETOS usa estas funções ao ser criado).
   ============================================================ */

function poligono(pontos, cor, contorno) {
  ctx.beginPath();
  pontos.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (cor) { ctx.fillStyle = cor; ctx.fill(); }
  if (contorno) { ctx.strokeStyle = contorno; ctx.stroke(); }
}

function cantos(gx, gy) {
  const { x, y } = gradeParaMundo(gx, gy);
  return [
    { x, y },
    { x: x + TILE_W / 2, y: y + TILE_H / 2 },
    { x, y: y + TILE_H },
    { x: x - TILE_W / 2, y: y + TILE_H / 2 },
  ];
}

// Caixa isométrica: base centrada em (cx, cy), "s" = fração do tile ocupada, "h" = altura em px.
// Devolve os pontos da tampa para podermos pôr um telhado em cima.
function caixa(cx, cy, s, h, corTopo, corEsq, corDir) {
  const hw = TILE_W / 2 * s, hh = TILE_H / 2 * s;
  const base = [{ x: cx, y: cy - hh }, { x: cx + hw, y: cy }, { x: cx, y: cy + hh }, { x: cx - hw, y: cy }];
  const topo = base.map(p => ({ x: p.x, y: p.y - h }));
  poligono([base[3], base[2], topo[2], topo[3]], corEsq);   // face esquerda
  poligono([base[1], base[2], topo[2], topo[1]], corDir);   // face direita
  poligono(topo, corTopo);
  return topo;
}

function desenharTile(gx, gy) {
  const [t, d, b, e] = cantos(gx, gy);
  if (gx === MAPA - 1) poligono([d, b, { x: b.x, y: b.y + PROFUNDIDADE }, { x: d.x, y: d.y + PROFUNDIDADE }], '#7a5a3a');
  if (gy === MAPA - 1) poligono([e, b, { x: b.x, y: b.y + PROFUNDIDADE }, { x: e.x, y: e.y + PROFUNDIDADE }], '#5e4429');
  poligono([t, d, b, e], TIPOS[mapa[gy][gx]].cor[(gx + gy) % 2], 'rgba(0,0,0,0.12)');
}

// Caixa isométrica retangular: w x h tiles (ao longo de gx e gy), altura alt, centrada em (cx, cy).
function caixaRet(cx, cy, w, h, alt, corTopo, corEsq, corDir) {
  const ex = { x: TILE_W / 2 * w / 2, y: TILE_H / 2 * w / 2 };    // meio comprimento ao longo de gx
  const ey = { x: -TILE_W / 2 * h / 2, y: TILE_H / 2 * h / 2 };   // meia profundidade ao longo de gy
  const c = (sx, sy, up) => ({ x: cx + sx * ex.x + sy * ey.x, y: cy + sx * ex.y + sy * ey.y - up });
  const base = [c(-1, -1, 0), c(1, -1, 0), c(1, 1, 0), c(-1, 1, 0)];       // topo, direita, base, esquerda
  const topo = [c(-1, -1, alt), c(1, -1, alt), c(1, 1, alt), c(-1, 1, alt)];
  poligono([base[3], base[2], topo[2], topo[3]], corEsq);   // face esquerda
  poligono([base[1], base[2], topo[2], topo[1]], corDir);   // face direita
  poligono(topo, corTopo);
}

function desenharArvore(cx, cy) {
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(cx - 3, cy - 16, 6, 16);
  ctx.fillStyle = '#2f7d32';
  ctx.beginPath(); ctx.arc(cx, cy - 30, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#43a047';
  ctx.beginPath(); ctx.arc(cx - 4, cy - 34, 9, 0, Math.PI * 2); ctx.fill();
}

function desenharBanco(cx, cy) {
  caixa(cx, cy, 0.45, 9, '#a9743d', '#6e4521', '#85552a');
}

function desenharBarraca(cx, cy) {
  const topo = caixa(cx, cy, 0.7, 22, '#f2e6d0', '#e0d2b8', '#c9b99c');
  const pico = { x: cx, y: cy - 22 - 20 };
  poligono([topo[3], topo[2], pico], '#d9534f');   // telhado esquerdo
  poligono([topo[1], topo[2], pico], '#a93a37');   // telhado direito
}

function desenharBanheiro(cx, cy) {
  caixa(cx, cy, 0.6, 28, '#cfd8dc', '#90a4ae', '#78909c');
}

// Carrossel animado: "tempo" (segundos) vem do loop. (cx, cy) = centro da pegada 2x2.
function desenharCarrossel(cx, cy, atr) {
  const R = 1.9, alt = 38;
  caixa(cx, cy, R, 5, '#8e5bb5', '#5e3a80', '#4a2e66');   // plataforma
  const CORES = ['#fff59d', '#ffab91', '#90caf9', '#a5d6a7', '#f48fb1', '#ce93d8'];
  // Cavalos giram numa elipse (círculo achatado pela isometria). Os de trás são desenhados
  // antes do poste e os da frente depois, para o poste ficar entre eles.
  const cavalos = traseiros => {
    for (let i = 0; i < 6; i++) {
      const a = (atr ? atr.angulo : 0) + i * Math.PI / 3;   // o ângulo vem do estado da atração
      if ((Math.sin(a) < 0) !== traseiros) continue;
      const px = cx + Math.cos(a) * TILE_W * 0.55;
      const py = cy + Math.sin(a) * TILE_H * 0.55 - 8 - Math.sin(a * 3 + tempo * 4) * 2.5;   // sobe e desce
      ctx.fillStyle = CORES[i]; ctx.fillRect(px - 4, py - 12, 8, 10);
      ctx.fillStyle = '#fff';   ctx.fillRect(px + 1, py - 15, 4, 4);
    }
  };
  cavalos(true);
  ctx.fillStyle = '#eceff1'; ctx.fillRect(cx - 2, cy - 5 - alt, 4, alt);   // poste central
  cavalos(false);
  const hw = TILE_W / 2 * R, hh = TILE_H / 2 * R, by = cy - alt;
  const pico = { x: cx, y: by - 24 };
  poligono([{ x: cx - hw, y: by }, { x: cx, y: by + hh }, pico], '#e53935');   // telhado esquerdo
  poligono([{ x: cx + hw, y: by }, { x: cx, y: by + hh }, pico], '#b71c1c');   // telhado direito
}

// Roda-gigante (3x2 tiles): o aro fica num plano vertical paralelo ao eixo gx, com um apoio
// na frente e outro atrás. Um círculo nesse plano vira uma elipse inclinada na tela; as
// cabines giram com o aro, mas ficam sempre penduradas na vertical.
function desenharRodaGigante(cx, cy, atr) {
  const R = 52, hub = R + 22, N = 8;
  const D = { x: 0.894, y: 0.447 };   // direção do eixo gx na tela (vetor unitário)
  const P = { x: -14, y: 7 };         // meio tile de profundidade (eixo gy), para a frente
  // (h, v) = posição no plano da roda: h ao longo do aro, v para cima; lado: -1 trás, 0 meio, +1 frente
  const pt = (h, v, lado) => ({ x: cx + h * D.x + lado * P.x, y: cy + h * D.y + lado * P.y - v });
  const ang = atr ? atr.angulo : 0;
  const ocupadas = atr ? atr.passageiros.length : 0;
  const CORES = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da', '#ec407a'];
  const noAro = i => { const a = ang + i * 2 * Math.PI / N; return pt(R * Math.cos(a), hub + R * Math.sin(a), 0); };

  caixaRet(cx, cy, 3, 2, 4, '#9e9e9e', '#757575', '#616161');   // plataforma de embarque

  ctx.save();
  ctx.lineCap = 'round';
  const apoio = lado => {
    const H = pt(0, hub, lado);
    ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 3;
    for (const f of [-34, 34]) { const F = pt(f, 4, lado); ctx.beginPath(); ctx.moveTo(H.x, H.y); ctx.lineTo(F.x, F.y); ctx.stroke(); }
  };
  apoio(-1);                                                    // apoio de trás

  ctx.strokeStyle = '#f48fb1'; ctx.lineWidth = 3;               // aro
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI * 2, p = pt(R * Math.cos(a), hub + R * Math.sin(a), 0);
    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();

  const H0 = pt(0, hub, 0);
  ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 1.5;             // raios
  for (let i = 0; i < N; i++) { const p = noAro(i); ctx.beginPath(); ctx.moveTo(H0.x, H0.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }

  for (let i = 0; i < N; i++) {                                 // cabines (com cabeça se ocupadas)
    const p = noAro(i);
    ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 6); ctx.stroke();
    ctx.fillStyle = CORES[i]; ctx.fillRect(p.x - 5, p.y + 6, 10, 9);
    if (i < ocupadas) { ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(p.x, p.y + 9, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = '#b0bec5'; ctx.beginPath(); ctx.arc(H0.x, H0.y, 5, 0, Math.PI * 2); ctx.fill();   // eixo
  apoio(1);                                                     // apoio da frente
  ctx.restore();
}

// Portão: dois postes nas laterais do caminho e uma viga no alto
function desenharPortao() {
  const c = gradeParaMundo(ENTRADA.gx + 0.5, ENTRADA.gy + 0.5);
  const dx = TILE_W / 2 * 0.42, dy = TILE_H / 2 * 0.42, alt = 40;
  const E = { x: c.x - dx, y: c.y - dy }, D = { x: c.x + dx, y: c.y + dy };
  ctx.fillStyle = '#eceff1';
  for (const p of [E, D]) ctx.fillRect(p.x - 3, p.y - alt, 6, alt);
  poligono([{ x: E.x, y: E.y - alt }, { x: D.x, y: D.y - alt }, { x: D.x, y: D.y - alt - 10 }, { x: E.x, y: E.y - alt - 10 }], '#e53935');
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(c.x - 24, c.y - alt - 26, 48, 13);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ENTRADA', c.x, c.y - alt - 16);
}

function desenharFila(a, cx, cy, alt = 84) {
  const t = `Fila ${a.fila.length}/${FILA_MAX}`;
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  const w = ctx.measureText(t).width + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - w / 2, cy - alt, w, 16);
  ctx.fillStyle = '#fff'; ctx.fillText(t, cx, cy - alt + 12);
}

function desenharConvidado(g) {
  const { x, y } = gradeParaMundo(g.x, g.y);   // com coordenadas contínuas, já dá o ponto no chão
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = g.cor;
  ctx.fillRect(x - 3, y - 11, 6, 9);
  ctx.fillStyle = '#f1c9a5';
  ctx.beginPath(); ctx.arc(x, y - 14, 3.5, 0, Math.PI * 2); ctx.fill();
  if (g === selecionado) {
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2 / camera.zoom;
    ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Ícone acima da cabeça: o que ele está fazendo ou indo buscar
  const icone = g.estado === 'usando' ? ICONES[g.uso.servico] : g.objetivo && ICONES[g.objetivo];
  if (icone) { ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(icone, x, y - 22); }
}

function corDaFerramenta() {
  if (ferramenta.camada === 'terreno') return TIPOS[ferramenta.chave].cor[0];
  if (ferramenta.camada === 'objeto') return OBJETOS[ferramenta.chave].cor;
  if (ferramenta.camada === 'inspecionar') return '#ffe14d';
  return '#e53935';
}

function desenhar() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.lineWidth = 1 / camera.zoom;

  // PASSADA 1: todo o terreno. PASSADA 2: objetos, de trás para frente.
  // Separar as passadas evita que o chão de um tile da frente cubra um objeto alto.
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) desenharTile(gx, gy);

  // Objetos e convidados entram na MESMA lista, ordenada por profundidade (x + y).
  // Assim um convidado passa atrás ou na frente de uma árvore corretamente.
  const itens = [];
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) {
      const obj = objetos[gy][gx];
      if (typeof obj !== 'string') continue;   // vazio, ou célula secundária de um objeto grande
      const { w, h } = tamanhoDe(obj);
      const c = gradeParaMundo(gx + w / 2, gy + h / 2);   // centro da PEGADA do objeto
      // profundidade = tile mais à frente da pegada
      const atr = atracoes.get(chaveAtr(gx, gy));   // estado da fila (ou undefined)
      itens.push({ prof: (gx + w - 1) + (gy + h - 1) + 1,
        desenhar: () => { OBJETOS[obj].desenhar(c.x, c.y, atr); if (atr) desenharFila(atr, c.x, c.y, OBJETOS[obj].altura); } });
    }
  for (const g of convidados) if (g.estado !== 'brincando') itens.push({ prof: g.x + g.y, desenhar: () => desenharConvidado(g) });
  itens.push({ prof: ENTRADA.gx + ENTRADA.gy + 1, desenhar: desenharPortao });
  itens.sort((a, b) => a.prof - b.prof);
  for (const it of itens) it.desenhar();

  if (hover && dentroDoMapa(hover.gx, hover.gy)) {
    ctx.lineWidth = 2 / camera.zoom;
    ctx.globalAlpha = 0.5;
    // Prévia da PEGADA inteira: verde/amarelo se dá para construir, vermelho se não
    const objFerr = ferramenta.camada === 'objeto' ? ferramenta.chave : null;
    const { w, h } = objFerr ? tamanhoDe(objFerr) : { w: 1, h: 1 };
    const valido = !objFerr || podeConstruir(objFerr, hover.gx, hover.gy);
    ctx.globalAlpha = 1;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        if (!dentroDoMapa(hover.gx + i, hover.gy + j)) continue;
        const pts = cantos(hover.gx + i, hover.gy + j);
        ctx.globalAlpha = 0.5;
        poligono(pts, valido ? corDaFerramenta() : '#e53935', null);
        ctx.globalAlpha = 1;
        poligono(pts, null, valido ? '#ffe14d' : '#b71c1c');
      }
  }
}
