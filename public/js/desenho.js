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

// Um banco em cada lado do caminho que não se liga a outro caminho (ver ladosSemCaminho).
// Cada banco = assento (caixa baixa) + encosto (caixa fina e alta) do lado de fora, virado para o caminho.
// "ancora" = tile do banco; sem ela (ex.: prévia), desenha os dois lados de um caminho reto.
function desenharBanco(cx, cy, atr, rot, ancora) {
  const lados = ancora ? ladosSemCaminho(ancora.gx, ancora.gy) : [[0, 1], [0, -1]];
  const pecas = [];
  for (const [dx, dy] of lados) {
    // Medidas em frações de tile: "ao longo" da borda e "através" dela (em direção ao centro)
    // Comprimento 0.4: as pontas (±0.2 do centro) não invadem o banco de um lado vizinho (que começa em 0.2)
    const peca = (dist, largura, alt, cores) => {
      const w = dx ? largura : 0.4, h = dx ? 0.4 : largura;     // lado em gx: fino em gx, comprido em gy
      const p = gradeParaMundo(dx * dist, dy * dist);             // deslocamento a partir do centro
      pecas.push({ prof: dx * dist + dy * dist, desenhar: () => caixaRet(cx + p.x, cy + p.y, w, h, alt, ...cores) });
    };
    peca(0.3, 0.2, 6, ['#b07a40', '#6e4521', '#85552a']);     // assento
    peca(0.42, 0.05, 13, ['#8b5a2b', '#5d3a1a', '#734a22']);  // encosto
  }
  pecas.sort((a, b) => a.prof - b.prof).forEach(p => p.desenhar());   // algoritmo do pintor, dentro do tile
}

// Barraca de comida (1x1): quiosque com telhado vermelho e um hambúrguer gigante no topo.
function desenharBarraca(cx, cy) {
  const topo = caixa(cx, cy, 0.7, 22, '#f2e6d0', '#e0d2b8', '#c9b99c');
  const pico = { x: cx, y: cy - 22 - 20 };
  poligono([topo[3], topo[2], pico], '#d9534f');   // telhado esquerdo
  poligono([topo[1], topo[2], pico], '#a93a37');   // telhado direito
  // Hambúrguer, de baixo para cima (cada camada cobre a anterior): pão, carne, queijo, alface, pão com gergelim
  const y = pico.y - 4;
  const elipse = (dy, rx, ry, cor, ini = 0, fim = Math.PI * 2) => {
    ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(cx, y + dy, rx, ry, 0, ini, fim); ctx.fill();
  };
  elipse(2, 7, 3, '#d9963f');                       // pão de baixo
  elipse(-1, 7.5, 2.6, '#6d3b1f');                  // carne
  poligono([{ x: cx - 7, y: y - 3 }, { x: cx + 7, y: y - 3 }, { x: cx + 3, y: y + 1 }], '#ffca28');   // queijo
  elipse(-3.5, 8, 1.8, '#7cb342');                  // alface
  elipse(-4, 7, 6.5, '#f0b25a', Math.PI, 0);        // pão de cima (meia elipse)
  ctx.fillStyle = '#fff8e1';                        // gergelim
  for (const [dx, dy] of [[-3, -7], [1, -9], [3, -6], [-1, -5]]) ctx.fillRect(cx + dx, y + dy, 1.5, 1);
}

// Ponto a uma fração t do caminho entre a e b, "alt" pixels acima
function entre(a, b, t, alt = 0) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - alt }; }

// Banheiro (1x1): casinha azul com telhado em pirâmide e uma porta em cada face visível,
// com a plaquinha de cada lado (azul e rosa) acima dela.
function desenharBanheiro(cx, cy) {
  const alt = 26, s = 0.6;
  caixa(cx, cy, s, alt, '#90caf9', '#64b5f6', '#42a5f5');
  const hw = TILE_W / 2 * s, hh = TILE_H / 2 * s;
  const esq = { x: cx - hw, y: cy }, baixo = { x: cx, y: cy + hh }, dir = { x: cx + hw, y: cy };
  for (const [a, placa] of [[esq, '#1e88e5'], [dir, '#ec407a']]) {   // face esquerda e face direita
    poligono([entre(a, baixo, 0.3), entre(a, baixo, 0.7), entre(a, baixo, 0.7, 17), entre(a, baixo, 0.3, 17)], '#eceff1', '#90a4ae');
    const m = entre(a, baixo, 0.62, 8);             // maçaneta
    ctx.fillStyle = '#546e7a'; ctx.fillRect(m.x - 0.75, m.y - 0.75, 1.5, 1.5);
    const p = entre(a, baixo, 0.5, 21.5);           // placa
    ctx.fillStyle = placa; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Telhado: pirâmide um pouco maior que as paredes (beiral). Só as duas águas da frente aparecem.
  const tw = TILE_W / 2 * 0.74, th = TILE_H / 2 * 0.74, base = cy - alt;
  const pico = { x: cx, y: base - 16 };
  poligono([{ x: cx - tw, y: base }, { x: cx, y: base + th }, pico], '#1565c0');
  poligono([{ x: cx + tw, y: base }, { x: cx, y: base + th }, pico], '#0d47a1');
}

// Sorveteria (1x1): balcão rosa, toldo e uma casquinha gigante com duas bolas no topo.
function desenharSorveteria(cx, cy) {
  caixa(cx, cy, 0.6, 15, '#fce4ec', '#f8bbd0', '#f48fb1');                  // balcão
  const base = cy - 15 - 6, hw = TILE_W / 2 * 0.74, hh = TILE_H / 2 * 0.74;    // toldo
  const pico = { x: cx, y: base - 11 };
  poligono([{ x: cx - hw, y: base }, { x: cx, y: base + hh }, pico], '#f06292');
  poligono([{ x: cx + hw, y: base }, { x: cx, y: base + hh }, pico], '#c2185b');
  const topoCone = pico.y - 9;
  poligono([{ x: cx - 5, y: topoCone }, { x: cx + 5, y: topoCone }, { x: cx, y: pico.y + 2 }], '#d7a35b');   // casquinha
  ctx.save();
  ctx.strokeStyle = '#a8772f'; ctx.lineWidth = 0.8;                         // xadrez da casquinha
  ctx.beginPath();
  ctx.moveTo(cx - 3, topoCone); ctx.lineTo(cx + 1.5, pico.y - 3);
  ctx.moveTo(cx + 3, topoCone); ctx.lineTo(cx - 1.5, pico.y - 3);
  ctx.stroke();
  ctx.restore();
  const bola = (dy, r, cor) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(cx, topoCone + dy, r, 0, Math.PI * 2); ctx.fill(); };
  bola(-2.5, 5.5, '#f48fb1');                                               // morango
  bola(-9, 4.5, '#a5d6a7');                                                 // menta
  bola(-14, 1.6, '#e53935');                                                // cereja
}

// ---------- Orientação das atrações (rot = 0 a 3, ver direcoesDe em objetos.js) ----------
// Vetor na TELA de uma direção da grade [dx, dy] com "n" tiles de comprimento
function vetorTela([dx, dy], n = 1) { return gradeParaMundo(dx * n, dy * n); }

// A frente está virada para trás (-gx ou -gy, longe da câmera)? Então a entrada fica atrás da atração
// e precisa ser desenhada ANTES dela (algoritmo do pintor).
function frenteAtras(rot) { const [dx, dy] = direcoesDe(rot).frente; return dx < 0 || dy < 0; }

// Portal de entrada de uma atração: dois postes e uma faixa na cor da atração, na borda da frente.
// "prof" = distância (tiles) do centro até a borda da frente; "desvio" = deslocamento ao longo do eixo.
function desenharPortalAtracao(cx, cy, rot, prof, desvio, cor) {
  const { eixo, frente } = direcoesDe(rot);
  const f = vetorTela(frente, prof), d = vetorTela(eixo, desvio), m = vetorTela(eixo, 0.28), alt = 20;
  const c = { x: cx + f.x + d.x, y: cy + f.y + d.y };
  const A = { x: c.x - m.x, y: c.y - m.y }, B = { x: c.x + m.x, y: c.y + m.y };
  ctx.fillStyle = '#eceff1';
  for (const p of [A, B]) ctx.fillRect(p.x - 1.5, p.y - alt, 3, alt);
  poligono([{ x: A.x, y: A.y - alt }, { x: B.x, y: B.y - alt }, { x: B.x, y: B.y - alt - 7 }, { x: A.x, y: A.y - alt - 7 }],
           cor, 'rgba(0,0,0,0.35)');
}

// Carrossel animado: "tempo" (segundos) vem do loop. (cx, cy) = centro da pegada 2x2.
// Redondo: girar só muda o lado do portal de entrada.
function desenharCarrossel(cx, cy, atr, rot = 0) {
  const R = 1.9, alt = 38;
  caixa(cx, cy, R, 5, '#8e5bb5', '#5e3a80', '#4a2e66');   // plataforma
  const portal = () => desenharPortalAtracao(cx, cy, rot, 0.95, 0, OBJETOS.CARROSSEL.cor);
  if (frenteAtras(rot)) portal();
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
  if (!frenteAtras(rot)) portal();
}

// Plano de uma atração "chata" (roda-gigante, navio): D = direção do eixo na tela (vetor unitário),
// P = quase meio tile na direção perpendicular, SEMPRE apontando para a câmera, para que o lado -1
// (desenhado primeiro) seja mesmo o de trás. Como a roda e o navio são simétricos em relação ao
// próprio plano, girar 180° equivale a inverter o sentido do eixo: a roda gira ao contrário, a bandeira
// do navio aponta para o outro lado e o portal de entrada vai para a outra face.
function planoDaAtracao(rot) {
  const e = vetorTela(direcoesDe(rot).eixo), n = Math.hypot(e.x, e.y);
  return { D: { x: e.x / n, y: e.y / n }, P: { x: rot % 2 ? 14 : -14, y: 7 } };
}

// Roda-gigante (3x2 tiles): o aro fica num plano vertical paralelo ao eixo da atração, com um apoio
// na frente e outro atrás. Um círculo nesse plano vira uma elipse inclinada na tela; as
// cabines giram com o aro, mas ficam sempre penduradas na vertical.
function desenharRodaGigante(cx, cy, atr, rot = 0) {
  const R = 52, hub = R + 22, N = 8;
  const { D, P } = planoDaAtracao(rot);
  // (h, v) = posição no plano da roda: h ao longo do aro, v para cima; lado: -1 trás, 0 meio, +1 frente
  const pt = (h, v, lado) => ({ x: cx + h * D.x + lado * P.x, y: cy + h * D.y + lado * P.y - v });
  const ang = atr ? atr.angulo : 0;
  const ocupadas = atr ? atr.passageiros.length : 0;
  const CORES = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da', '#ec407a'];
  const noAro = i => { const a = ang + i * 2 * Math.PI / N; return pt(R * Math.cos(a), hub + R * Math.sin(a), 0); };

  caixaRet(cx, cy, rot % 2 ? 2 : 3, rot % 2 ? 3 : 2, 4, '#9e9e9e', '#757575', '#616161');   // plataforma de embarque
  const portal = () => desenharPortalAtracao(cx, cy, rot, 0.92, 0.85, OBJETOS.RODA_GIGANTE.cor);
  if (frenteAtras(rot)) portal();

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
  if (!frenteAtras(rot)) portal();
}

// Montanha-russa (4x3 tiles): circuito fechado em elipse com três colinas, apoios, uma estação coberta
// e um trem de 3 vagões. A posição do trem é a fração da volta (atr.angulo / 2π). Trilho, apoios, estação
// e vagões entram numa lista ordenada pela profundidade no chão, para se cobrirem corretamente.
// Girar muda o eixo da elipse e o lado da estação (que fica na ponta "+eixo", em t = 0).
function desenharMontanhaRussa(cx, cy, atr, rot = 0) {
  const [w, h] = rot % 2 ? [3, 4] : [4, 3], N = 96;
  const { eixo, frente } = direcoesDe(rot);
  const ex = vetorTela(eixo, 2);      // meio comprimento (4 tiles / 2), ao longo do eixo
  const ey = vetorTela(frente, 1.5);  // meia profundidade (3 tiles / 2), na direção da frente
  const colina = (t, centro, largura) => Math.exp(-(((t - centro) / largura) ** 2));
  const altura = t => 8 + 60 * colina(t, 0.25, 0.12) + 34 * colina(t, 0.6, 0.08) + 20 * colina(t, 0.85, 0.06);
  // Ponto do circuito (t de 0 a 1). "chao" é a posição do ponto no chão: serve para ordenar o desenho.
  const ponto = t => {
    const a = t * 2 * Math.PI, s = 0.9 * Math.cos(a), r = 0.88 * Math.sin(a), z = altura(t);
    return { x: cx + s * ex.x + r * ey.x, y: cy + s * ex.y + r * ey.y - z, chao: cy + s * ex.y + r * ey.y, z };
  };
  const pts = Array.from({ length: N + 1 }, (_, i) => ponto(i / N));
  const itens = [];

  for (let i = 0; i < N; i++) {
    const A = pts[i], B = pts[i + 1];
    itens.push({ d: (A.chao + B.chao) / 2, f: () => {
      ctx.strokeStyle = '#37474f'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(A.x, A.y - 1); ctx.lineTo(B.x, B.y - 1); ctx.stroke();
    } });
    if (i % 4 === 0 && A.z > 14) itens.push({ d: A.chao - 0.1, f: () => {   // apoio vertical até o chão
      ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(A.x, A.y + 2); ctx.lineTo(A.x, A.chao); ctx.stroke();
    } });
  }

  // Estação em t = 0 (ponta do eixo, parte baixa do trilho): 4 postes e um telhado listrado.
  // Ali o trilho corre na direção da "frente", então o telhado se estende nessa direção.
  const E = ponto(0), ao = vetorTela(frente, 0.55), atraves = vetorTela(eixo, 0.3), altE = 30;
  const canto = (a, b, up) => ({ x: E.x + a * ao.x + b * atraves.x, y: E.chao + a * ao.y + b * atraves.y - up });
  itens.push({ d: E.chao + 0.6, f: () => {
    ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 2;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const c0 = canto(a, b, 0), c1 = canto(a, b, altE);
      ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.stroke();
    }
    for (let k = 0; k < 4; k++)                       // telhado em 4 faixas, vermelho e branco
      poligono([canto(-1 + k / 2, -1, altE), canto(-1 + (k + 1) / 2, -1, altE),
                canto(-1 + (k + 1) / 2, 1, altE), canto(-1 + k / 2, 1, altE)], k % 2 ? '#fafafa' : '#e53935');
  } });

  const volta = atr ? (atr.angulo / (2 * Math.PI)) % 1 : 0;
  const ocupadas = atr ? atr.passageiros.length : 0;
  for (let c = 0; c < 3; c++) {                      // vagão 0 na frente; os outros logo atrás
    const P = ponto(((volta - c * 0.03) % 1 + 1) % 1);
    itens.push({ d: P.chao + 0.5, f: () => {
      ctx.fillStyle = ['#ffca28', '#42a5f5', '#66bb6a'][c];
      ctx.fillRect(P.x - 6, P.y - 9, 12, 8);
      ctx.fillStyle = '#f1c9a5';                     // 4 lugares por vagão
      for (let k = 0; k < Math.max(0, Math.min(4, ocupadas - c * 4)); k++) {
        ctx.beginPath(); ctx.arc(P.x - 4.5 + k * 3, P.y - 11, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    } });
  }

  caixaRet(cx, cy, w, h, 3, '#a1887f', '#795548', '#6d4c41');   // plataforma
  ctx.save();
  ctx.lineCap = 'round';
  itens.sort((a, b) => a.d - b.d).forEach(it => it.f());
  ctx.restore();
}

// Barraca de bebidas (1x1): balcão azul, toldo em pirâmide baixa e um copo gigante com canudo no topo.
function desenharBarracaBebidas(cx, cy) {
  caixa(cx, cy, 0.6, 15, '#e1f5fe', '#81d4fa', '#4fc3f7');                  // balcão
  const base = cy - 15 - 6, hw = TILE_W / 2 * 0.74, hh = TILE_H / 2 * 0.74;    // toldo, um pouco maior que o balcão
  const pico = { x: cx, y: base - 11 };
  poligono([{ x: cx - hw, y: base }, { x: cx, y: base + hh }, pico], '#29b6f6');
  poligono([{ x: cx + hw, y: base }, { x: cx, y: base + hh }, pico], '#0277bd');
  ctx.fillStyle = '#ff7043';                                                // copo
  ctx.beginPath();
  ctx.moveTo(cx - 6, pico.y - 13); ctx.lineTo(cx + 6, pico.y - 13); ctx.lineTo(cx + 4, pico.y + 1); ctx.lineTo(cx - 4, pico.y + 1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;                              // canudo
  ctx.beginPath(); ctx.moveTo(cx + 2, pico.y - 13); ctx.lineTo(cx + 5, pico.y - 20); ctx.stroke();
}

// Navio pirata (3x2 tiles): um barco pendurado por braços que balança como pêndulo entre dois pórticos.
// O ângulo é amplitude * sen(atr.angulo). A amplitude sobe e desce ao longo da corrida e fica pequena
// (balanço suave) enquanto embarca. Como na roda-gigante, o plano do movimento é paralelo ao eixo da atração.
function desenharNavioPirata(cx, cy, atr, rot = 0) {
  const H = 78, L = 52;                                       // altura do eixo e comprimento dos braços
  const { D, P } = planoDaAtracao(rot);
  const pt = (h, v, lado) => ({ x: cx + h * D.x + lado * P.x, y: cy + h * D.y + lado * P.y - v });
  const duracao = OBJETOS.NAVIO_PIRATA.servicos.diversao.duracao;
  const progresso = atr && atr.fase === 'rodando' ? 1 - atr.resta / duracao : 0;
  const amplitude = 0.14 + 1.0 * Math.sin(Math.PI * Math.min(1, Math.max(0, progresso)));   // radianos
  const ang = amplitude * Math.sin(atr ? atr.angulo : 0);
  // Ponto do barco: u ao longo do casco, d abaixo do eixo. Gira "ang" em torno do eixo (pêndulo).
  const barco = (u, d) => pt(u * Math.cos(ang) + d * Math.sin(ang), H - d * Math.cos(ang) + u * Math.sin(ang), 0);
  const ocupadas = atr ? atr.passageiros.length : 0;
  const linha = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

  caixaRet(cx, cy, rot % 2 ? 2 : 3, rot % 2 ? 3 : 2, 4, '#4aa3d8', '#2f7fb0', '#276a96');   // "mar" sob o barco
  const portal = () => desenharPortalAtracao(cx, cy, rot, 0.92, 0.95, OBJETOS.NAVIO_PIRATA.cor);
  if (frenteAtras(rot)) portal();
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const portico = lado => {
    const topo = pt(0, H + 4, lado);
    ctx.strokeStyle = '#e53935'; ctx.lineWidth = 4;
    for (const f of [-40, 40]) linha(topo, pt(f, 4, lado));
  };

  portico(-1);                                                  // pórtico de trás
  ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 4;
  linha(pt(0, H, -1), pt(0, H, 1));                             // eixo entre os pórticos
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 2.5;
  for (const u of [-18, 18]) linha(pt(0, H, 0), barco(u, L - 12));   // braços

  const casco = [];                                             // fundo curvo e borda superior
  for (let u = -38; u <= 38; u += 6) casco.push(barco(u, L + 12 - 24 * (u / 38) ** 2));
  casco.push(barco(38, L - 16), barco(32, L - 7), barco(-32, L - 7), barco(-38, L - 16));
  poligono(casco, '#8d5a2b', '#4e342e');
  ctx.strokeStyle = '#ffe0b2'; ctx.lineWidth = 1.5;
  linha(barco(-34, L - 9), barco(34, L - 9));                   // faixa clara
  ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2.5;
  linha(barco(0, L - 7), barco(0, L - 30));                     // mastro
  poligono([barco(0, L - 30), barco(16, L - 25), barco(0, L - 20)], '#212121');   // bandeira pirata
  ctx.fillStyle = '#f1c9a5';                                    // passageiros (10 lugares)
  for (let i = 0; i < Math.min(ocupadas, 10); i++) {
    const p = barco(-30 + i * (60 / 9), L - 11);
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  portico(1);                                                   // pórtico da frente
  ctx.restore();
  if (!frenteAtras(rot)) portal();
}

// Portão de circo: duas torres listradas (vermelho e branco) com telhado de tenda e bandeirola,
// um arco colorido entre elas com franja de lona e uma placa com o nome do parque.
// As torres ficam nas laterais do caminho, ao longo de gx (o caminho de entrada corre ao longo de gy).
function desenharPortao() {
  const c = gradeParaMundo(ENTRADA.gx + 0.5, ENTRADA.gy + 0.5);
  const u = vetorTela([1, 0], 0.42);                       // do centro até cada torre
  const E = { x: c.x - u.x, y: c.y - u.y }, D = { x: c.x + u.x, y: c.y + u.y };
  const altTorre = 40, r = 4.5;                            // altura e raio das torres
  ctx.save();

  // Torre: faixas horizontais alternadas, uma sombra no lado direito (volume) e uma tenda cônica no topo
  const torre = p => {
    for (let y = 0; y < altTorre; y += 6) {
      ctx.fillStyle = (y / 6) % 2 ? '#fafafa' : '#e53935';
      ctx.fillRect(p.x - r, p.y - Math.min(y + 6, altTorre), r * 2, Math.min(6, altTorre - y));
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(p.x + r * 0.2, p.y - altTorre, r * 0.8, altTorre);
    const topo = p.y - altTorre, pico = { x: p.x, y: topo - 15 };
    poligono([{ x: p.x - r - 3, y: topo }, { x: p.x + r + 3, y: topo }, pico], '#e53935');      // tenda
    poligono([{ x: p.x - 2.5, y: topo }, { x: p.x + 2.5, y: topo }, pico], '#fafafa');           // gomo branco
    ctx.fillStyle = '#e53935';                                                                   // franja
    for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.arc(p.x + dx, topo, 2.5, 0, Math.PI); ctx.fill(); }
    // Bandeirola tremulando: a ponta sobe e desce com o tempo (mesmo relógio das animações)
    ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pico.x, pico.y); ctx.lineTo(pico.x, pico.y - 7); ctx.stroke();
    const onda = Math.sin(tempo * 5 + p.x) * 1.5;
    poligono([{ x: pico.x, y: pico.y - 7 }, { x: pico.x + 8, y: pico.y - 5 + onda }, { x: pico.x, y: pico.y - 3 }], '#ffca28');
  };

  // Arco: faixa curva entre as torres, em gomos de cores alternadas, com franja pendurada embaixo.
  // ponto(t, extra): t = 0 na torre esquerda, 1 na direita. O arco sai das torres abaixo do topo e
  // sobe 28 px no meio, passando acima das tendas.
  const ponto = (t, extra = 0) => ({ x: E.x + (D.x - E.x) * t, y: E.y + (D.y - E.y) * t - (altTorre - 14 + 28 * Math.sin(Math.PI * t)) - extra });
  const arco = () => {
    const N = 10, largura = 7;
    for (let k = 0; k < N; k++) {
      const a = k / N, b = (k + 1) / N;
      poligono([ponto(a), ponto(b), ponto(b, largura), ponto(a, largura)], ['#ffca28', '#1e88e5', '#e53935', '#43a047'][k % 4]);
    }
    ctx.fillStyle = '#fafafa';                                                                   // franja de lona
    for (let k = 0; k < N; k++) { const p = ponto((k + 0.5) / N); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI); ctx.fill(); }
  };

  torre(E);
  arco();
  torre(D);

  // Placa com o nome do parque no alto do arco. A fonte diminui para nomes longos (até 6 px);
  // se ainda não couber, o nome é cortado com "…". Canvas desenha texto puro: não há risco de HTML aqui.
  const meio = ponto(0.5, 7), larguraMax = 58;
  let tam = 9, texto = nomeDoParque();
  ctx.textAlign = 'center';
  const medir = () => { ctx.font = `600 ${tam}px ${FONTE_JOGO}`; return ctx.measureText(texto).width; };
  while (medir() > larguraMax && tam > 6) tam -= 0.5;
  while (medir() > larguraMax && texto.length > 1) texto = texto.slice(0, -2) + '…';
  const w = Math.max(30, medir() + 10), h = tam + 6;
  ctx.fillStyle = '#7b1fa2'; ctx.fillRect(meio.x - w / 2, meio.y - h - 2, w, h);
  ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 1.2; ctx.strokeRect(meio.x - w / 2, meio.y - h - 2, w, h);
  ctx.fillStyle = '#fff'; ctx.fillText(texto, meio.x, meio.y - 5);
  ctx.restore();
}

function desenharFila(a, cx, cy, alt = 84) {
  const t = `Fila ${a.fila.length}/${FILA_MAX}`;
  ctx.font = `500 12px ${FONTE_JOGO}`; ctx.textAlign = 'center';
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
  const icone = g.estado === 'usando' ? iconeDoUso(g) : g.objetivo && ICONES[g.objetivo];
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
      const rot = rotacaoDe(gx, gy);
      const { w, h } = tamanhoDe(obj, rot);
      const c = gradeParaMundo(gx + w / 2, gy + h / 2);   // centro da PEGADA do objeto
      // Profundidade = CENTRO da pegada (gx + w/2) + (gy + h/2), na mesma escala dos convidados (g.x + g.y).
      // Não use o tile mais à frente: numa pegada 4x3, uma árvore encostada no lado esquerdo, À FRENTE
      // da atração, tinha profundidade menor e era coberta por ela. O centro fica entre os vizinhos de
      // trás (até gx+gy+max(w,h)-1) e os da frente (a partir de gx+gy+min(w,h)+1) sempre que |w - h| <= 1.
      // Pegadas mais alongadas que isso precisariam de uma ordenação topológica (comparar retângulos).
      const atr = atracoes.get(chaveAtr(gx, gy));   // estado da fila (ou undefined)
      itens.push({ prof: gx + gy + (w + h) / 2,
        desenhar: () => { OBJETOS[obj].desenhar(c.x, c.y, atr, rot, { gx, gy }); if (atr) desenharFila(atr, c.x, c.y, OBJETOS[obj].altura); } });
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
    const { w, h } = objFerr ? tamanhoDe(objFerr, rotacaoAtual) : { w: 1, h: 1 };   // a prévia mostra a pegada girada
    const valido = !objFerr || podeConstruir(objFerr, hover.gx, hover.gy, rotacaoAtual);
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
    // "Fantasma" do objeto sobre a pegada: mostra para onde ele vai ficar virado antes de construir
    if (objFerr) {
      const c = gradeParaMundo(hover.gx + w / 2, hover.gy + h / 2);
      ctx.save();
      ctx.globalAlpha = valido ? 0.7 : 0.35;
      OBJETOS[objFerr].desenhar(c.x, c.y, undefined, rotacaoAtual, null);
      ctx.restore();
    }
  }
}
