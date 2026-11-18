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
// Convidados sentados, por banco ("gx,gy" -> lista), refeito a cada quadro em desenhar()
const SENTADOS = new Map();
function sentadoNoBanco(g) {
  const u = g.uso;
  return g.estado === 'usando' && !!u && !!u.lado && !!u.ancora && dentroDoMapa(u.ancora.gx, u.ancora.gy) &&
         typeof objetos[u.ancora.gy][u.ancora.gx] === 'string' && ficaSobreCaminho(objetos[u.ancora.gy][u.ancora.gx]);
}

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
    peca(ASSENTO_BANCO.dist, 0.2, ASSENTO_BANCO.altura, ['#b07a40', '#6e4521', '#85552a']);   // assento
    peca(0.42, 0.05, 13, ['#8b5a2b', '#5d3a1a', '#734a22']);  // encosto
  }
  // Quem está sentado entra na MESMA ordenação, logo depois do seu assento: nos lados de trás (−gx, −gy)
  // ele fica na frente do encosto; nos da frente (+gx, +gy) o encosto, mais à frente, cobre as costas dele.
  // Por isso os sentados não vão na lista geral de desenhar() (ver SENTADOS).
  const sentados = ancora && SENTADOS.get(chaveAtr(ancora.gx, ancora.gy));
  if (sentados)
    for (const g of sentados) {
      const [dx, dy] = g.uso.lado;
      pecas.push({ prof: (dx + dy) * ASSENTO_BANCO.dist + 0.01, desenhar: () => desenharConvidado(g) });
    }
  pecas.sort((a, b) => a.prof - b.prof).forEach(p => p.desenhar());   // algoritmo do pintor, dentro do tile
}

// Lixeira: um cesto verde na borda do caminho (o primeiro lado livre, como o banco), com tampa.
// Do nível 75% para cima aparecem papéis saindo pela boca; cheia, eles caem para fora.
function desenharLixeira(cx, cy, atr, rot, ancora) {
  const [dx, dy] = (ancora && ladosSemCaminho(ancora.gx, ancora.gy)[0]) || [0, 1];
  const p = gradeParaMundo(dx * 0.34, dy * 0.34), x = cx + p.x, y = cy + p.y;
  caixaRet(x, y, 0.2, 0.2, 13, '#43a047', '#1b5e20', '#2e7d32');
  caixaRet(x, y - 13, 0.24, 0.24, 2, '#66bb6a', '#2e7d32', '#388e3c');   // tampa
  const nivel = ancora ? (lixeiras.get(chaveAtr(ancora.gx, ancora.gy)) || 0) / OBJETOS.LIXEIRA.lixeira.capacidade : 0;
  if (nivel >= LIXO.esvaziarEm) {
    ctx.fillStyle = '#fafafa'; ctx.fillRect(x - 4, y - 19, 4, 4); ctx.fillStyle = '#e53935'; ctx.fillRect(x + 1, y - 18, 3, 3);
  }
  if (nivel >= 1) { ctx.fillStyle = '#fff59d'; ctx.fillRect(x + 5, y - 3, 4, 3); ctx.fillStyle = '#fafafa'; ctx.fillRect(x - 9, y - 1, 4, 3); }
}

// Sujeira no chão: desenhada logo depois do terreno (é plana, fica embaixo de quem passa).
// Cada item tem posição e giro próprios (sorteados ao cair), para o tile sujo parecer bagunçado.
function desenharSujeira() {
  for (const [k, lista] of sujeira) {
    const [gx, gy] = k.split(',').map(Number);
    for (const it of lista) {
      const { x, y } = gradeParaMundo(gx + 0.5 + it.dx, gy + 0.5 + it.dy);
      ctx.save();
      ctx.translate(x, y);
      if (it.tipo === 'vomito') {   // poça amarelo-esverdeada com respingos
        ctx.fillStyle = '#c0ca33';
        ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9e9d24';
        ctx.beginPath(); ctx.ellipse(-3, -1, 3, 1.5, 0, 0, Math.PI * 2); ctx.ellipse(5, 2, 2, 1, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.scale(1, 0.5); ctx.rotate(it.giro);   // "deitado" no chão isométrico
        if (it.tipo === 'copo') { ctx.fillStyle = '#e53935'; ctx.fillRect(-2, -4, 4, 8); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -1, 4, 2); }
        else if (it.tipo === 'palito') { ctx.fillStyle = '#a1887f'; ctx.fillRect(-1, -5, 2, 10); }
        else { ctx.fillStyle = '#f5f5f5'; ctx.fillRect(-4, -3, 8, 6); ctx.fillStyle = '#bdbdbd'; ctx.fillRect(-4, -1, 8, 1); }
      }
      ctx.restore();
    }
  }
}

// Funcionário: o mesmo boneco animado dos convidados (desenharBoneco), com o uniforme da função
// (FUNCOES em config.js), boné e a ferramenta na mão. Faxineiro: vassoura, que balança ao varrer.
// Mecânico: chave inglesa, que gira para lá e para cá enquanto ele conserta.
function desenharFuncionario(f) {
  const { x, y } = gradeParaMundo(f.x, f.y);
  const u = FUNCOES[f.funcao] || FUNCOES.faxineiro;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  const p = poseDoFuncionario(f);
  desenharBoneco(x, y, p);
  ctx.fillStyle = u.bone; ctx.fillRect(p.cabecaX - 4, p.cabecaY - 4.5, 8, 2.5);   // boné
  if (u.ferramenta === 'vassoura') {
    // O cabo passa pela mão (que balança ao andar) e desce até o chão; varrendo, a ponta vai e vem
    const balanco = f.trabalho > 0 ? Math.sin(tempo * 12) * 4 : 0;
    const bx = p.maoX + 2.5 + balanco, by = y + 1;
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.maoX - 0.8, p.maoY - 4); ctx.lineTo(bx, by); ctx.stroke();   // cabo
    ctx.fillStyle = '#fdd835'; ctx.fillRect(bx - 2, by - 1, 6, 2);                              // cerdas
  } else if (u.ferramenta === 'chave') {
    // Cabo saindo da mão; a "boca" da chave é um círculo cinza com um corte (outro círculo da cor do chão não
    // serviria: o fundo muda). Consertando, o ângulo vai e vem rápido, como quem aperta um parafuso.
    const ang = -0.9 + (f.trabalho > 0 ? Math.sin(tempo * 10) * 0.7 : 0);
    const ex = p.maoX + Math.cos(ang) * 5, ey = p.maoY + Math.sin(ang) * 5;
    ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.maoX, p.maoY); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(ex, ey, 1.6, ang + 0.6, ang + 2 * Math.PI - 0.6); ctx.stroke();   // boca aberta para a ponta
    if (f.trabalho > 0 && Math.sin(tempo * 10) > 0.8) {   // faísca
      ctx.fillStyle = '#ffeb3b'; ctx.fillRect(ex + 1.5, ey - 2.5, 1.5, 1.5); ctx.fillRect(ex - 2.5, ey - 1.5, 1.2, 1.2);
    }
  }
  if (f === selFunc) {
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2 / camera.zoom;
    ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
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

// Passeio de barco (3x2, na água): píeres de madeira nas duas laterais (onde os convidados embarcam,
// com toldo listrado) e um píer central; entre eles, 4 vagas com um barco cada, de proa para a frente.
// Na corrida os barcos saem pela frente, somem no canal (o passeio pelo lago) e voltam pelos fundos
// até a vaga. Tudo é desenhado num sistema local: "a" = tiles ao longo do eixo, "f" = tiles para a frente.
const VAGAS_BARCO = [-0.9, -0.36, 0.36, 0.9];
const CORES_BARCO = [['#e53935', '#a32020'], ['#fdd835', '#c49000'], ['#43a047', '#2a6e2d'], ['#1e88e5', '#125a9e']];

// Posição de um barco no passeio: "p" = progresso da corrida (0 a 1). Cada barco sai com um pequeno
// atraso (ordem) e todos terminam exatamente na vaga (f = 0) quando p chega a 1.
function trajetoDoBarco(p, ordem) {
  const q = Math.min(1, Math.max(0, (p - 0.04 * ordem) / 0.88));
  const lim = v => Math.min(1, Math.max(0, v));
  if (q <= 0.4) { const t = q / 0.4, f = 2 * t * t; return { f, alfa: 1 - lim((f - 1.25) / 0.5), andando: q > 0 }; }   // acelera para fora
  if (q < 0.6) return { f: 0, alfa: 0, andando: true };                                                         // passeando pelo lago
  const t = (q - 0.6) / 0.4, f = -2 + 2 * (1 - (1 - t) ** 2);                                                 // volta freando
  return { f, alfa: lim((f + 1.75) / 0.5), andando: q < 1 };
}

function desenharPasseioBarco(cx, cy, atr, rot = 0) {
  const { eixo, frente } = direcoesDe(rot);
  const E = vetorTela(eixo), F = vetorTela(frente);
  const P = (a, f, alt = 0) => ({ x: cx + E.x * a + F.x * f, y: cy + E.y * a + F.y * f - alt });
  const prof = (a, f) => (eixo[0] + eixo[1]) * a + (frente[0] + frente[1]) * f;   // profundidade local (gx + gy)
  // Retângulo deitado de a0..a1 por f0..f1, na altura alt
  const ret = (a0, a1, f0, f1, alt) => [P(a0, f0, alt), P(a1, f0, alt), P(a1, f1, alt), P(a0, f1, alt)];
  // Laje (píer) com espessura: as quatro faces laterais numa cor só e a tampa por cima
  const laje = (a0, a1, f0, f1, alt, corTopo, corLado) => {
    const b = ret(a0, a1, f0, f1, 0), t = ret(a0, a1, f0, f1, alt);
    for (let i = 0; i < 4; i++) poligono([b[i], b[(i + 1) % 4], t[(i + 1) % 4], t[i]], corLado);
    poligono(t, corTopo);
  };
  ctx.save();
  poligono(ret(-1.5, 1.5, -1, 1, 0), 'rgba(13,71,161,0.25)');   // água da doca, um pouco mais funda
  laje(-0.07, 0.07, -0.75, 0.75, 3, '#b07a45', '#7a5230');       // píer central
  for (const s of [-1, 1]) {
    laje(s * 1.18, s * 1.5, -1, 1, 4, '#c08a55', '#7a5230');      // píeres de embarque
    ctx.strokeStyle = 'rgba(90,55,25,0.5)'; ctx.lineWidth = 1;
    for (let f = -0.75; f < 1; f += 0.25) {                       // tábuas
      const a = P(s * 1.18, f, 4), b = P(s * 1.5, f, 4);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  // Barcos e toldos entram numa lista ordenada pela profundidade local (o pintor, dentro da atração)
  const itens = [];
  const p = atr && atr.fase === 'rodando' ? atr.angulo / (2 * Math.PI) : 0;
  const ocupadas = atr ? atr.passageiros.length : 0;
  VAGAS_BARCO.forEach((a, i) => {
    const { f, alfa, andando } = trajetoDoBarco(p, [1, 0, 2, 3][i]);
    if (alfa <= 0) return;
    itens.push({ prof: prof(a, f), desenhar: () => {
      ctx.globalAlpha = alfa;
      const alt = 1 + Math.sin(tempo * 2.2 + i * 1.7);   // balança na água
      if (andando) {                                     // marola atrás da popa
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
        for (const s of [-1, 1]) {
          const u = P(a + s * 0.18, f - 0.36), v = P(a + s * 0.36, f - 0.8);
          ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke();
        }
      }
      const forma = [[-0.2, -0.36], [0.2, -0.36], [0.2, 0.16], [0, 0.4], [-0.2, 0.16]];   // proa pontuda
      const base = forma.map(([da, df]) => P(a + da, f + df, alt)), topo = forma.map(([da, df]) => P(a + da, f + df, alt + 6));
      const [cor, escura] = CORES_BARCO[i];
      for (let k = 0; k < forma.length; k++) poligono([base[k], base[(k + 1) % 5], topo[(k + 1) % 5], topo[k]], escura);
      poligono(topo, cor, 'rgba(0,0,0,0.3)');
      poligono([P(a - 0.13, f - 0.27, alt + 6), P(a + 0.13, f - 0.27, alt + 6), P(a + 0.13, f + 0.1, alt + 6), P(a - 0.13, f + 0.1, alt + 6)], '#eceff1');   // assento
      const nesse = Math.min(2, Math.max(0, ocupadas - 2 * i));   // 2 lugares por barco
      for (let k = 0; k < nesse; k++) {
        const c = P(a + (k ? 0.07 : -0.07), f - 0.08, alt + 6);
        ctx.fillStyle = k ? '#7e57c2' : '#ff7043'; ctx.fillRect(c.x - 2, c.y - 6, 4, 6);
        ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(c.x, c.y - 8, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } });
  });
  for (const s of [-1, 1])
    itens.push({ prof: prof(s * 1.34, 0) + 0.01, desenhar: () => {   // toldo sobre o píer de embarque
      ctx.fillStyle = '#eceff1';
      // Só sobre o píer (estreito e baixo), para não esconder os barcos das vagas vizinhas
      for (const f of [-0.6, 0.6]) { const b = P(s * 1.34, f, 4); ctx.fillRect(b.x - 1, b.y - 18, 2, 18); }
      for (let k = 0; k < 6; k++) {                                   // listras na cor da atração
        const f0 = -0.75 + k / 4;
        poligono(ret(s * 1.2, s * 1.5, f0, f0 + 1 / 4, 22), k % 2 ? '#ffffff' : OBJETOS.BARCOS.cor);
      }
      poligono(ret(s * 1.2, s * 1.5, -0.75, 0.75, 22), null, 'rgba(0,0,0,0.3)');
    } });
  itens.sort((x, y) => x.prof - y.prof);
  for (const it of itens) it.desenhar();
  ctx.restore();
}

// Telhado em pirâmide sobre um quadrado de meio-lado "s" tiles, centrado em (cx, cy), com a base na
// altura "alt" e o pico "pico" px acima dela. As faces de trás primeiro (o pintor, dentro do telhado).
function telhadoPiramide(cx, cy, s, alt, pico, corTras, corEsq, corDir) {
  const P = (gx, gy, h) => { const p = gradeParaMundo(gx, gy); return { x: cx + p.x, y: cy + p.y - h }; };
  const T = P(-s, -s, alt), R = P(s, -s, alt), B = P(s, s, alt), L = P(-s, s, alt), C = P(0, 0, alt + pico);
  poligono([T, R, C], corTras); poligono([L, T, C], corTras);
  poligono([L, B, C], corEsq); poligono([R, B, C], corDir);
}

// Casa mal-assombrada (2x2): casa roxa com torre no canto de trás, janelas que piscam durante o passeio
// e um fantasma voando em volta (atr.angulo). A porta fica na face da frente quando ela está virada
// para a câmera; virada para trás, só o portal aparece (desenhado antes da casa).
function desenharCasaAssombrada(cx, cy, atr, rot = 0) {
  const { eixo, frente } = direcoesDe(rot);
  const a = atr ? atr.angulo : 0, rodando = !!atr && atr.fase === 'rodando';
  const P = (gx, gy, h = 0) => { const p = gradeParaMundo(gx, gy); return { x: cx + p.x, y: cy + p.y - h }; };
  const portal = () => desenharPortalAtracao(cx, cy, rot, 0.98, 0.45, OBJETOS.CASA_ASSOMBRADA.cor);
  // Fantasma: lençol branco com a barra ondulada. Os de trás (gx + gy < 0) antes da casa, os da frente depois.
  const fantasma = atras => {
    const gx = Math.cos(a) * 1.2, gy = Math.sin(a) * 1.2;
    if ((gx + gy < 0) !== atras) return;
    const c = P(gx, gy, 52 + Math.sin(tempo * 3) * 4);
    ctx.save();
    ctx.globalAlpha = 0.88; ctx.fillStyle = '#f5f5f5';
    ctx.beginPath(); ctx.arc(c.x, c.y, 6, Math.PI, 0);
    for (let i = 0; i <= 4; i++) ctx.lineTo(c.x + 6 - i * 3, c.y + (i % 2 ? 6 : 9));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.fillRect(c.x - 3, c.y - 2, 2, 3); ctx.fillRect(c.x + 1, c.y - 2, 2, 3);
    ctx.restore();
  };
  fantasma(true);
  if (frenteAtras(rot)) portal();
  // Torre no canto de trás (mais alta que a casa, aparece por cima do telhado)
  const t = P(-0.45, -0.45);
  caixaRet(t.x, t.y, 0.6, 0.6, 60, '#5b4a7a', '#3a2e52', '#4a3b63');
  telhadoPiramide(t.x, t.y, 0.36, 60, 26, '#1f1630', '#2c1f45', '#24193a');
  ctx.fillStyle = rodando && Math.sin(tempo * 9) > 0 ? '#ffeb3b' : '#6d4c41';
  const jt = P(-0.15, -0.35, 46); ctx.fillRect(jt.x - 2, jt.y - 3, 4, 6);   // janela da torre
  // Corpo e telhado
  caixaRet(cx, cy, 1.8, 1.8, 34, '#5b4a7a', '#3a2e52', '#4a3b63');
  telhadoPiramide(cx, cy, 0.95, 34, 26, '#1f1630', '#2c1f45', '#24193a');
  // Janelas nas duas faces visíveis (+gy à esquerda, +gx à direita): acesas em amarelo durante o passeio
  [[-0.45, 0.9], [0.45, 0.9], [0.9, -0.45], [0.9, 0.45]].forEach(([gx, gy], i) => {
    const naPorta = gx * frente[0] + gy * frente[1] > 0.5 && Math.abs(gx * eixo[0] + gy * eixo[1] - 0.45) < 0.1;
    if (naPorta) return;   // a porta ocupa esse lugar
    const j = P(gx, gy, 20);
    ctx.fillStyle = rodando ? (Math.sin(tempo * 11 + i * 2.1) > -0.2 ? '#ffeb3b' : '#3e2723') : '#ffb300';
    ctx.fillRect(j.x - 3, j.y - 4, 6, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(j.x - 0.5, j.y - 4, 1, 8);
  });
  if (!frenteAtras(rot)) {   // porta na face da frente, alinhada com o portal
    const base = (u, h) => P(frente[0] * 0.9 + eixo[0] * (0.45 + u), frente[1] * 0.9 + eixo[1] * (0.45 + u), h);
    poligono([base(-0.16, 0), base(0.16, 0), base(0.16, 17), base(0, 21), base(-0.16, 17)], '#1a1022', 'rgba(0,0,0,0.5)');
  }
  fantasma(false);
  if (!frenteAtras(rot)) portal();
}

// Corredeira (3x3 na água): muro de pedra, canal com espuma em volta de uma ilha e um bote redondo
// de 6 lugares que dá uma volta por corrida (atr.angulo de 0 a 2π) e para na doca, do lado da frente.
function desenharCorredeira(cx, cy, atr, rot = 0) {
  const { eixo, frente } = direcoesDe(rot);
  const P = (gx, gy, h = 0) => { const p = gradeParaMundo(gx, gy); return { x: cx + p.x, y: cy + p.y - h }; };
  const quad = (s, h) => [P(-s, -s, h), P(s, -s, h), P(s, s, h), P(-s, s, h)];
  const rodando = !!atr && atr.fase === 'rodando';
  const portal = () => desenharPortalAtracao(cx, cy, rot, 1.45, 0, OBJETOS.CORREDEIRA.cor);
  ctx.save();
  if (frenteAtras(rot)) portal();
  caixaRet(cx, cy, 2.9, 2.9, 5, '#9e9e9e', '#616161', '#757575');   // muro de pedra em volta
  poligono(quad(1.25, 5), '#1976d2');                               // canal
  // Espuma correndo pelo canal (mais rápida durante a corrida)
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let k = 0; k < 14; k++) {
    const ang = k * Math.PI / 7 + tempo * (rodando ? 1.6 : 0.5), r = 0.9 + (k % 3 - 1) * 0.15;
    const e = P(Math.cos(ang) * r, Math.sin(ang) * r, 5);
    ctx.beginPath(); ctx.ellipse(e.x, e.y, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Doca de madeira do lado da frente (onde o bote embarca)
  const d = P(frente[0] * 1.12, frente[1] * 1.12);
  caixaRet(d.x, d.y, eixo[0] ? 0.9 : 0.22, eixo[0] ? 0.22 : 0.9, 7, '#b07a45', '#7a5230', '#8d6239');
  // Bote: posição no círculo do canal. Começa (ângulo 0) na doca, do lado da frente.
  const ang = Math.atan2(frente[1], frente[0]) + (atr ? atr.angulo : 0);
  const bx = Math.cos(ang) * 0.9, by = Math.sin(ang) * 0.9;
  const bote = () => {
    const balanco = rodando ? Math.sin(tempo * 7) * 1.5 : Math.sin(tempo * 2) * 0.5;
    const c = P(bx, by, 8 + balanco);
    ctx.fillStyle = '#e64a19'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 2, 13, 6.5, 0, 0, Math.PI * 2); ctx.fill();   // lateral
    ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 13, 6.5, 0, 0, Math.PI * 2); ctx.fill();       // boia
    ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 8, 4, 0, 0, Math.PI * 2); ctx.fill();          // miolo
    const n = atr ? Math.min(6, atr.passageiros.length) : 0, giro = rodando ? tempo * 2.5 : 0;   // o bote gira
    const pessoas = [];
    for (let j = 0; j < n; j++) {
      const t = giro + j * Math.PI / 3;
      pessoas.push({ x: c.x + Math.cos(t) * 10, y: c.y + Math.sin(t) * 5, cor: CORES_BARCO[j % 4][0] });
    }
    pessoas.sort((p, q) => p.y - q.y).forEach(p => {   // de trás para a frente
      ctx.fillStyle = p.cor; ctx.fillRect(p.x - 2, p.y - 6, 4, 6);
      ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(p.x, p.y - 8, 2.3, 0, Math.PI * 2); ctx.fill();
    });
  };
  const atrasDaIlha = bx + by < 0;
  if (atrasDaIlha) bote();
  // Ilha no meio, com pedras e um pinheiro
  caixaRet(cx, cy, 1.0, 1.0, 9, '#689f38', '#33691e', '#558b2f');
  for (const [gx, gy, s] of [[-0.25, 0.2, 0.22], [0.25, -0.1, 0.18]]) { const r = P(gx, gy, 9); caixaRet(r.x, r.y, s, s, 6, '#bdbdbd', '#757575', '#9e9e9e'); }
  const pin = P(-0.1, -0.25, 9);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(pin.x - 1.5, pin.y - 6, 3, 6);
  poligono([{ x: pin.x - 7, y: pin.y - 5 }, { x: pin.x + 7, y: pin.y - 5 }, { x: pin.x, y: pin.y - 24 }], '#2e7d32');
  if (!atrasDaIlha) bote();
  if (!frenteAtras(rot)) portal();
  ctx.restore();
}

// Trem (4x3): trilho oval no chão em volta de um jardim, estação coberta na frente e uma locomotiva
// com 3 vagões (4 lugares cada) que dá "voltas" por corrida e para na estação (atr.angulo = 0).
// Como no resto das atrações grandes, o que fica em pé entra numa lista ordenada pela profundidade no chão.
function desenharTrem(cx, cy, atr, rot = 0) {
  const { eixo, frente } = direcoesDe(rot);
  const [w, h] = rot % 2 ? [3, 4] : [4, 3];
  // (u, v) = posição em tiles ao longo do eixo e da frente, a partir do centro; z = altura em px
  const G = (u, v, z = 0) => {
    const p = gradeParaMundo(eixo[0] * u + frente[0] * v, eixo[1] * u + frente[1] * v);
    return { x: cx + p.x, y: cy + p.y - z, chao: cy + p.y };
  };
  const RU = 1.55, RV = 1.0;                                       // raios do oval
  const noOval = (a, k = 1, z = 0) => G(RU * k * Math.cos(a), RV * k * Math.sin(a), z);
  const A0 = Math.PI / 2;                                          // a estação fica no meio da frente
  const rodando = !!atr && atr.fase === 'rodando';
  const portal = () => desenharPortalAtracao(cx, cy, rot, 1.45, -1.3, OBJETOS.TREM.cor);
  ctx.save();
  ctx.lineCap = 'round';
  if (frenteAtras(rot)) portal();
  caixaRet(cx, cy, w - 0.1, h - 0.1, 3, '#7cb342', '#558b2f', '#689f38');   // gramado
  // Trilho: dormentes e dois trilhos (é chato: vai antes de tudo que fica em pé)
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2, A = noOval(a, 0.9, 3), B = noOval(a, 1.1, 3);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  }
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.5;
  for (const k of [0.94, 1.06]) {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) { const p = noOval(i / 64 * Math.PI * 2, k, 3); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
    ctx.stroke();
  }
  const itens = [];
  // Jardim no meio: um morrinho, árvores e um lago
  const lago = G(0.45, -0.15, 3);
  itens.push({ d: lago.chao - 30, f: () => { ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.ellipse(lago.x, lago.y, 16, 7, 0, 0, Math.PI * 2); ctx.fill(); } });
  for (const [u, v] of [[-0.6, -0.2], [-0.15, 0.25], [0.95, 0.3]]) {
    const t = G(u, v, 3);
    itens.push({ d: t.chao, f: () => { ctx.save(); ctx.translate(t.x, t.y); ctx.scale(0.7, 0.7); desenharArvore(0, 0); ctx.restore(); } });
  }
  // Estação: plataforma do lado de fora do trilho, 4 postes e telhado listrado
  const E = (u, v, z) => G(u, v, z);
  itens.push({ d: G(0, 1.3).chao, f: () => {
    const pl = G(0, 1.3, 3);
    caixaRet(pl.x, pl.y, eixo[0] ? 1.0 : 0.3, eixo[0] ? 0.3 : 1.0, 4, '#bcaaa4', '#8d6e63', '#a1887f');
    ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 2;
    for (const [u, v] of [[-0.5, 1.15], [0.5, 1.15], [-0.5, 1.45], [0.5, 1.45]]) {
      const a = E(u, v, 7), b = E(u, v, 30); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let k = 0; k < 4; k++)
      poligono([E(-0.55 + k * 0.275, 1.1, 30), E(-0.55 + (k + 1) * 0.275, 1.1, 30), E(-0.55 + (k + 1) * 0.275, 1.5, 30), E(-0.55 + k * 0.275, 1.5, 30)],
               k % 2 ? '#fafafa' : OBJETOS.TREM.cor);
  } });
  // Locomotiva (na frente) e 3 vagões, 0,38 rad atrás um do outro
  const aLoco = A0 + (atr ? atr.angulo : 0);
  const ocupados = atr ? atr.passageiros.length : 0;
  const CORES = ['#fdd835', '#42a5f5', '#66bb6a'];
  for (let c = 0; c < 4; c++) {
    const P = noOval(aLoco - c * 0.38, 1, 3);
    itens.push({ d: P.chao + 0.5, f: () => {
      if (c === 0) {                                             // locomotiva: corpo, cabine e chaminé
        ctx.fillStyle = '#c62828'; ctx.fillRect(P.x - 8, P.y - 10, 16, 8);
        ctx.fillStyle = '#37474f'; ctx.fillRect(P.x - 8, P.y - 17, 7, 7);
        ctx.fillStyle = '#212121'; ctx.fillRect(P.x + 3, P.y - 16, 3, 6);
        ctx.fillStyle = '#ffeb3b'; ctx.fillRect(P.x - 6.5, P.y - 15.5, 4, 3);   // janela da cabine
      } else {                                                   // vagão com até 4 cabeças
        ctx.fillStyle = CORES[c - 1]; ctx.fillRect(P.x - 7, P.y - 8, 14, 6);
        ctx.fillStyle = '#f1c9a5';
        for (let k = 0; k < Math.max(0, Math.min(4, ocupados - (c - 1) * 4)); k++) {
          ctx.beginPath(); ctx.arc(P.x - 4.5 + k * 3, P.y - 10, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = '#263238';                                 // rodas
      ctx.beginPath(); ctx.arc(P.x - 4, P.y - 1.5, 1.8, 0, Math.PI * 2); ctx.arc(P.x + 4, P.y - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
    } });
  }
  itens.sort((a, b) => a.d - b.d).forEach(it => it.f());
  // Fumaça: bolinhas que sobem da chaminé e somem (só andando)
  if (rodando) {
    const L = noOval(aLoco, 1, 3);
    for (let k = 0; k < 4; k++) {
      const f = (tempo * 1.5 + k / 4) % 1;
      ctx.globalAlpha = 0.6 * (1 - f); ctx.fillStyle = '#eceff1';
      ctx.beginPath(); ctx.arc(L.x + 4.5 - f * 6, L.y - 18 - f * 22, 2.5 + f * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (!frenteAtras(rot)) portal();
  ctx.restore();
}

// Tobogã (3x2): torre na ponta "-eixo" e uma rampa larga de 4 pistas coloridas com ondas, até o chão
// na ponta "+eixo". Na corrida, os passageiros descem um de cada vez, sentados num saco: a fração
// atr.angulo / 2π ("voltas: 1") diz quem está descendo e onde. Os outros esperam no alto da torre.
const PISTAS_TOBOGA = ['#fdd835', '#e53935', '#1e88e5', '#43a047'];
function alturaDoToboga(t) {   // t = 0 no alto da torre, 1 no fim da rampa (px acima do chão)
  return 4 + 58 * (1 - t) ** 1.4 + 9 * Math.sin(t * Math.PI * 3) ** 2 * (1 - t);
}
function desenharToboga(cx, cy, atr, rot = 0) {
  const { eixo, frente } = direcoesDe(rot);
  const G = (u, v, z = 0) => {
    const p = gradeParaMundo(eixo[0] * u + frente[0] * v, eixo[1] * u + frente[1] * v);
    return { x: cx + p.x, y: cy + p.y - z, chao: cy + p.y };
  };
  const U0 = -0.65, U1 = 1.45, V = 0.85, N = 24, ALT = 64;   // rampa de U0 a U1, largura 2V; torre com ALT px
  const uDe = t => U0 + (U1 - U0) * t;
  const portal = () => desenharPortalAtracao(cx, cy, rot, 0.95, -1.05, OBJETOS.TOBOGA.cor);
  ctx.save();
  if (frenteAtras(rot)) portal();
  const [w, h] = rot % 2 ? [2, 3] : [3, 2];
  // Piso de grama: o chão aparece por baixo da rampa elevada, entre os pilares (em areia clara parecia uma parede)
  caixaRet(cx, cy, w - 0.1, h - 0.1, 2, '#7cb342', '#558b2f', '#689f38');
  const itens = [];
  // Torre: caixa de madeira com mureta vermelha e bandeira
  const T = G(-1.08, 0);
  itens.push({ d: T.chao, f: () => {
    const [tw, th] = eixo[0] ? [0.8, 1.8] : [1.8, 0.8];
    caixaRet(T.x, T.y, tw, th, ALT, '#a1887f', '#6d4c41', '#8d6e63');
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;   // degraus (traços na lateral)
    for (let z = 8; z < ALT; z += 8) { const a = G(-1.48, 0.9, z), b = G(-0.68, 0.9, z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    caixaRet(T.x, T.y - ALT, tw, th, 6, '#ef5350', '#b71c1c', '#c62828');
    const m = G(-1.08, -0.6, ALT + 6);
    ctx.fillStyle = '#eceff1'; ctx.fillRect(m.x - 1, m.y - 22, 2, 22);
    poligono([{ x: m.x + 1, y: m.y - 22 }, { x: m.x + 13, y: m.y - 18 + Math.sin(tempo * 5) }, { x: m.x + 1, y: m.y - 14 }], OBJETOS.TOBOGA.cor);
  } });
  // Rampa: um quadrilátero por pista e por trecho, cada um na sua profundidade (como o terreno)
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, z0 = alturaDoToboga(t0), z1 = alturaDoToboga(t1);
    for (let j = 0; j < 4; j++) {
      const v0 = -V + j * V / 2, v1 = v0 + V / 2;
      const c = G((uDe(t0) + uDe(t1)) / 2, (v0 + v1) / 2);
      itens.push({ d: c.chao + 0.2, f: () => {
        poligono([G(uDe(t0), v0, z0), G(uDe(t1), v0, z1), G(uDe(t1), v1, z1), G(uDe(t0), v1, z0)],
                 PISTAS_TOBOGA[j], 'rgba(0,0,0,0.15)');
      } });
    }
    if (i % 4 === 2) for (const v of [-V, V]) {   // pilares sob as bordas
      const p = G(uDe(t0), v, z0);
      itens.push({ d: p.chao, f: () => { ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.chao); ctx.stroke(); } });
    }
  }
  // Passageiros: quem está descendo (um de cada vez) e quem espera no alto
  const n = atr ? atr.passageiros.length : 0;
  const rodando = !!atr && atr.fase === 'rodando';
  const p = rodando ? atr.angulo / (2 * Math.PI) : 0;
  const descendo = rodando ? Math.min(n - 1, Math.floor(p * n)) : -1;
  for (let k = 0; k < n; k++) {
    const pista = (k % 4) * V / 2 - V + V / 4;
    if (k === descendo) {
      const t = p * n - k, P = G(uDe(t), pista, alturaDoToboga(t) + 2);
      itens.push({ d: P.chao + 0.4, f: () => {
        ctx.fillStyle = '#a1887f'; ctx.fillRect(P.x - 5, P.y - 4, 10, 4);   // saco
        ctx.fillStyle = CORES_BARCO[k % 4][0]; ctx.fillRect(P.x - 2, P.y - 9, 4, 5);
        ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(P.x, P.y - 11, 2.3, 0, Math.PI * 2); ctx.fill();
      } });
    } else if (k > descendo) {                       // na fila do alto da torre
      const P = G(-1.3 + (k % 3) * 0.2, -0.5 + Math.floor(k / 3) * 0.5, ALT + 6);
      itens.push({ d: T.chao + 0.01, f: () => {
        ctx.fillStyle = CORES_BARCO[k % 4][0]; ctx.fillRect(P.x - 2, P.y - 6, 4, 6);
        ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(P.x, P.y - 8, 2.3, 0, Math.PI * 2); ctx.fill();
      } });
    }
  }
  itens.sort((a, b) => a.d - b.d).forEach(it => it.f());
  if (!frenteAtras(rot)) portal();
  ctx.restore();
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
  if (a.quebrada) desenharFumaca(cx, cy - alt + 20, emConserto(a));
  const t = !a.quebrada ? `Fila ${a.fila.length}/${FILA_MAX}` : emConserto(a) ? '🔧 Consertando' : '⚠️ Quebrado';
  ctx.font = `500 12px ${FONTE_JOGO}`; ctx.textAlign = 'center';
  const w = ctx.measureText(t).width + 10;
  // Quebrado: rótulo vermelho que pisca (pelo relógio real, para piscar também com o jogo pausado)
  ctx.fillStyle = !a.quebrada ? 'rgba(0,0,0,0.6)' : emConserto(a) ? 'rgba(230,120,0,0.85)'
    : (Math.floor(tempoReal * 2) % 2 ? 'rgba(200,30,30,0.9)' : 'rgba(120,10,10,0.9)');
  ctx.fillRect(cx - w / 2, cy - alt, w, 16);
  ctx.fillStyle = '#fff'; ctx.fillText(t, cx, cy - alt + 12);
}

// Fumaça saindo do brinquedo quebrado: 4 baforadas que sobem e somem em ciclo (pelo tempo do jogo).
// Em conserto, a fumaça fica clara (o mecânico já está cuidando).
function desenharFumaca(x, y, clara) {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const t = modulo(tempo * 0.6 + i / 4, 1);   // 0..1: idade da baforada
    ctx.globalAlpha = 0.55 * (1 - t);
    ctx.fillStyle = clara ? '#eeeeee' : '#616161';
    ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.3 + t * 3) * 6, y - t * 28, 4 + t * 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- Bonecos animados (convidados e funcionários) ----------
// A POSE (o que o corpo está fazendo) é calculada à parte do DESENHO: poseDoConvidado e
// poseDoFuncionario leem o estado da pessoa e preenchem a pose; desenharBoneco só desenha.
// As duas reaproveitam SEMPRE o mesmo objeto, POSE: criar um objeto novo por pessoa a cada quadro
// (300 convidados x 60 quadros = 18 mil objetos por segundo) daria trabalho à toa ao coletor de lixo.
const POSE = { camisa: '', calca: '', pele: '', andando: false, fase: 0, fx: 1, fy: 0, desvio: 0, inclina: 0,
               pulo: 0, sentado: false, noBanco: false, joelhoX: 0, joelhoY: 0, bracosAcima: false, batePe: 0,
               maoX: 0, maoY: 0, cabecaX: 0, cabecaY: 0 };
const PELE = '#f1c9a5', PELE_ENJOADA = '#cfdc9a';

function limparPose(camisa, calca) {
  const p = POSE;
  p.camisa = camisa; p.calca = calca; p.pele = PELE; p.andando = false; p.fase = 0; p.fx = 1; p.fy = 0;
  p.desvio = 0; p.inclina = 0; p.pulo = 0; p.sentado = false; p.noBanco = false; p.bracosAcima = false; p.batePe = 0;
  return p;
}

// Resto da divisão sempre positivo (o % do JavaScript mantém o sinal: -1 % 7 dá -1, não 6)
function modulo(a, n) { return ((a % n) + n) % n; }

function poseDoConvidado(g) {
  const p = limparPose(g.cor, g.corCalca), A = ANIMACAO;
  const semente = (g.ox + g.oy) * 10 + g.paciencia;   // campos sorteados em semear: cada um no seu ritmo
  p.andando = g.estado === 'andando' && g.movendo;
  p.fase = g.passo * A.ciclosPorTile * Math.PI * 2;
  p.fx = g.olhaX; p.fy = g.olhaY;
  p.sentado = g.estado === 'usando' && !!g.uso && !!g.uso.def && g.uso.def.atividade === 'sentar';
  if (p.sentado && g.uso.lado) {
    // No assento, virado para o centro do tile (o encosto fica do lado de fora): o joelho vai 0,13 tile
    // para dentro. (−dx, −dy) na grade vira deslocamento na tela pela conta de gradeParaMundo.
    const jx = -g.uso.lado[0] * 0.13, jy = -g.uso.lado[1] * 0.13;
    p.noBanco = true; p.joelhoX = (jx - jy) * TILE_W / 2; p.joelhoY = (jx + jy) * TILE_H / 2;
  }
  // Na fila: passada a fração "desde" da paciência, muda o peso de um pé para o outro, cada vez mais;
  // perto de desistir, também bate o pé
  if (g.estado === 'esperando' && g.uso && g.paciencia > 0) {
    const gasto = (g.uso.espera || 0) / g.paciencia, I = A.impaciencia;
    if (gasto > I.desde) {
      p.desvio = Math.sin(tempo * 2.5 + semente) * I.balanco * Math.min(1, (gasto - I.desde) / (1 - I.desde));
      if (gasto > I.batePe) p.batePe = Math.max(0, Math.sin(tempo * 9 + semente)) * 1.5;
    }
  }
  // Enjoado: o tronco pende de um lado para o outro (mais quanto pior a náusea) e o rosto esverdeia
  const nausea = g.n.nausea, N = A.nausea;
  if (nausea >= N.desde && !p.sentado) {
    p.inclina = Math.sin(tempo * 3 + semente) * N.inclina * (0.4 + 0.6 * (nausea - N.desde) / (100 - N.desde));
    if (nausea >= N.verde) p.pele = PELE_ENJOADA;
  }
  // Muito feliz (e não enjoado nem ocupado): de vez em quando, um pulinho com os braços para cima.
  // A semente desencontra os pulos: sem ela, todo mundo feliz pularia no mesmo instante.
  const P = A.pulo;
  if (g.n.felicidade >= P.felicidade && !p.inclina && g.estado !== 'usando') {
    const c = modulo(tempo + semente * 3, P.intervalo);
    if (c < P.duracao) { p.pulo = Math.sin(c / P.duracao * Math.PI) * P.altura; p.bracosAcima = true; }
  }
  return p;
}

function poseDoFuncionario(f) {
  const u = FUNCOES[f.funcao] || FUNCOES.faxineiro;
  const p = limparPose(u.camisa, u.calca);
  p.andando = f.movendo && !(f.trabalho > 0);
  p.fase = f.passo * ANIMACAO.ciclosPorTile * Math.PI * 2;
  p.fx = f.olhaX; p.fy = f.olhaY;
  return p;
}

// Pernas e braços que balançam ao andar. s = seno da fase do passo, de -1 a 1: a perna esquerda vai
// para s e a direita para -s (uma à frente, outra atrás); cada braço vai ao contrário da perna do
// seu lado, como numa caminhada de verdade. "Frente" é a direção do movimento NA TELA (fx, fy),
// por isso o pé também sobe/desce um pouco na diagonal da isometria.
// Desempenho: os 2 membros de cada cor saem num só stroke (vários moveTo/lineTo num caminho): são
// 5 chamadas de desenho por pessoa (sombra, pernas, tronco, braços, cabeça) contra 3 do boneco simples.
// Deixa em p a posição da mão direita (maoX, maoY: lixo, vassoura) e da cabeça (cabecaX, cabecaY: boné).
function desenharBoneco(x, y, p) {
  const s = p.andando ? Math.sin(p.fase) : 0;
  const sobe = (p.andando ? Math.abs(Math.cos(p.fase)) * ANIMACAO.quique : 0) + p.pulo;   // mais alto com as pernas juntas
  // Sentado no chão (sem assento conhecido) desce 3 px; no banco, o quadril fica na altura do assento
  const abaixa = p.noBanco ? 5 - ASSENTO_BANCO.altura : p.sentado ? 3 : 0;
  const xq = x + p.desvio, xt = xq + p.inclina * 0.6, xc = xq + p.inclina;   // quadril, tronco e cabeça (a cabeça pende mais)
  const quadril = y - 5 - sobe + abaixa, ombro = y - 10 - sobe + abaixa;
  p.cabecaX = xc; p.cabecaY = y - 14 - sobe + abaixa;
  if (camera.zoom < ANIMACAO.zoomMinimo) {   // de longe: o boneco simples (membros teriam ~1 px)
    ctx.fillStyle = p.camisa; ctx.fillRect(xt - 3, ombro - 1, 6, 9 - abaixa);
    ctx.fillStyle = p.pele; ctx.beginPath(); ctx.arc(p.cabecaX, p.cabecaY, 3.5, 0, Math.PI * 2); ctx.fill();
    p.maoX = xt + 3.5; p.maoY = ombro + 4;
    return;
  }
  const pe = ANIMACAO.perna * s, b = ANIMACAO.braco * s, fx = p.fx, fy = p.fy;
  // Sem ctx.save()/restore(): eles copiam TODO o estado do contexto, e com 300 convidados medi
  // ~4,8 ms por quadro contra ~4,0 ms devolvendo à mão só o que muda aqui (espessura e ponta da linha)
  const espessura = ctx.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = p.calca;   // pernas
  ctx.beginPath();
  if (p.noBanco) {   // coxas sobre o assento, para dentro do tile, e canelas descendo até o chão
    const kx = p.joelhoX, ky = p.joelhoY;
    ctx.moveTo(xq - 1.3, quadril); ctx.lineTo(xq - 1.3 + kx, quadril + ky); ctx.lineTo(xq - 1.3 + kx, y + ky);
    ctx.moveTo(xq + 1.3, quadril); ctx.lineTo(xq + 1.3 + kx, quadril + ky); ctx.lineTo(xq + 1.3 + kx, y + ky);
  } else if (p.sentado) {   // coxas para a frente (para quem olha) e canelas descendo até o chão
    ctx.moveTo(xq - 1.3, quadril); ctx.lineTo(xq - 1.9, quadril + 1.6); ctx.lineTo(xq - 1.9, y - 0.3);
    ctx.moveTo(xq + 1.3, quadril); ctx.lineTo(xq + 1.9, quadril + 1.6); ctx.lineTo(xq + 1.9, y - 0.3);
  } else {
    const chao = y - 0.5 - p.pulo;
    ctx.moveTo(xq - 1.3, quadril); ctx.lineTo(xq - 1.3 + pe * fx, chao + pe * fy * 0.5);
    ctx.moveTo(xq + 1.3, quadril); ctx.lineTo(xq + 1.3 - pe * fx, chao - pe * fy * 0.5 - p.batePe);
  }
  ctx.stroke();
  ctx.fillStyle = p.camisa;   // tronco
  ctx.fillRect(xt - 3, ombro - 1, 6, 6.5);
  ctx.strokeStyle = p.pele; ctx.lineWidth = 1.6;   // braços (manga curta: a pele contrasta com a camisa)
  ctx.beginPath();
  if (p.bracosAcima) {   // comemorando
    ctx.moveTo(xt - 3.2, ombro); ctx.lineTo(xt - 4.8, ombro - 4.5);
    ctx.moveTo(xt + 3.2, ombro); ctx.lineTo(p.maoX = xt + 4.8, p.maoY = ombro - 4.5);
  } else if (p.sentado) {   // mãos no colo (no banco, sobre as coxas)
    const kx = p.noBanco ? p.joelhoX * 0.6 : 0, ky = p.noBanco ? p.joelhoY * 0.6 : 0;
    ctx.moveTo(xt - 3.2, ombro); ctx.lineTo(xt - 2.6 + kx, quadril + 0.8 + ky);
    ctx.moveTo(xt + 3.2, ombro); ctx.lineTo(p.maoX = xt + 2.6 + kx, p.maoY = quadril + 0.8 + ky);
  } else {
    ctx.moveTo(xt - 3.2, ombro); ctx.lineTo(xt - 3.6 - b * fx, ombro + 4.5 - b * fy * 0.5);
    ctx.moveTo(xt + 3.2, ombro); ctx.lineTo(p.maoX = xt + 3.6 + b * fx, p.maoY = ombro + 4.5 + b * fy * 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = p.pele;   // cabeça
  ctx.beginPath(); ctx.arc(p.cabecaX, p.cabecaY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = espessura; ctx.lineCap = 'butt';
}

function desenharConvidado(g) {
  const { x, y } = gradeParaMundo(g.x, g.y);   // com coordenadas contínuas, já dá o ponto no chão
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  const p = poseDoConvidado(g);
  desenharBoneco(x, y, p);
  if (g.lixo) {   // o lixo na mão, procurando lixeira
    ctx.fillStyle = g.lixo.tipo === 'copo' ? '#e53935' : g.lixo.tipo === 'palito' ? '#a1887f' : '#f5f5f5';
    ctx.fillRect(p.maoX - 0.5, p.maoY - 2.5, 3, 4);
  }
  if (g === selecionado) {
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2 / camera.zoom;
    ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Ícone acima da cabeça: o que ele está fazendo ou indo buscar
  const icone = g.estado === 'usando' ? iconeDoUso(g) : g.objetivo && ICONES[g.objetivo];
  if (icone) { ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(icone, x, y - 22); }
  if (g.pensamento && tempo < g.pensamento.ate) desenharBalao(x, y - (icone ? 36 : 24), PENSAMENTOS[g.pensamento.tipo].icone);
}

// Balão de pensamento: retângulo arredondado branco com "rabinho" apontando para a cabeça.
// (bx, by) = ponta do rabinho. roundRect é recente: sem ele, um retângulo simples serve.
function desenharBalao(bx, by, icone) {
  const w = 22, h = 18, x0 = bx - w / 2, y0 = by - h - 4;
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x0, y0, w, h, 6); else ctx.rect(x0, y0, w, h);
  ctx.fill(); ctx.stroke();
  poligono([{ x: bx - 3, y: y0 + h - 0.5 }, { x: bx + 3, y: y0 + h - 0.5 }, { x: bx, y: by }], '#fff');
  ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icone, bx, y0 + h / 2 + 1);
  ctx.restore();
}

function corDaFerramenta() {
  if (ferramenta.camada === 'terreno') return TIPOS[ferramenta.chave].cor[0];
  if (ferramenta.camada === 'objeto') return OBJETOS[ferramenta.chave].cor;
  if (ferramenta.camada === 'inspecionar') return '#ffe14d';
  if (ferramenta.camada === 'contratar') return '#43a047';
  return '#e53935';
}

// Mancha vermelha nos tiles de caminho lotados (mais forte quanto maior o excesso): mostra ao jogador
// onde alargar o caminho. Só olha os tiles com gente (as chaves de lotacao), não o mapa inteiro.
function desenharLotacao() {
  ctx.save();
  for (const k of lotacao.keys()) {
    const [gx, gy] = k.split(',').map(Number);
    const excesso = excessoEm(gx, gy);
    if (!excesso) continue;
    ctx.globalAlpha = Math.min(0.4, 0.15 + 0.12 * excesso);
    poligono(cantos(gx, gy), '#e53935', null);
  }
  ctx.restore();
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
  // Só o que aparece na tela: num mapa 64 x 64 são 4096 tiles, e de perto se vê uma fração deles.
  // Testar se um tile está na vista é bem mais barato do que desenhar o losango.
  const vista = vistaNaGrade();
  const vistaObj = vistaNaGrade(6, 14);   // objetos: pegada até 4 tiles e altura até ~200 px
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) if (naVista(vista, gx, gy)) desenharTile(gx, gy);
  desenharLotacao();
  desenharSujeira();

  // Objetos e convidados entram na MESMA lista, ordenada por profundidade (x + y).
  // Assim um convidado passa atrás ou na frente de uma árvore corretamente.
  const itens = [];
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) {
      const obj = objetos[gy][gx];
      if (typeof obj !== 'string') continue;   // vazio, ou célula secundária de um objeto grande
      if (!naVista(vistaObj, gx, gy)) continue;
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
  // Pessoas fora da tela não entram na lista (nem na ordenação): num parque grande, a maioria
  const vistaGente = vistaNaGrade(1, 4);   // "alto" 4: abaixo da borda, cabeça, ícone e balão (~60 px) ainda aparecem
  // Quem está sentado num banco é desenhado pelo próprio banco (desenharBanco), entre o assento e o encosto.
  // A lista é montada aqui, ANTES de desenhar qualquer item (o banco só a lê depois da ordenação).
  SENTADOS.clear();
  for (const g of convidados) {
    if (g.estado === 'brincando' || !naVista(vistaGente, Math.floor(g.x), Math.floor(g.y))) continue;
    if (sentadoNoBanco(g)) {
      const k = chaveAtr(g.uso.ancora.gx, g.uso.ancora.gy);
      if (!SENTADOS.has(k)) SENTADOS.set(k, []);
      SENTADOS.get(k).push(g);
    } else itens.push({ prof: g.x + g.y, desenhar: () => desenharConvidado(g) });
  }
  for (const f of funcionarios)
    if (naVista(vistaGente, Math.floor(f.x), Math.floor(f.y))) itens.push({ prof: f.x + f.y, desenhar: () => desenharFuncionario(f) });
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
    // Brinquedo aquático: contorno tracejado dos canais (frente e fundos), que também precisam ser água livre
    if (objFerr && ficaNaAgua(objFerr)) {
      ctx.save();
      ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
      for (const c of canaisDe(objFerr, hover.gx, hover.gy, rotacaoAtual)) {
        if (!dentroDoMapa(c.gx, c.gy)) continue;
        const livre = mapa[c.gy][c.gx] === 'AGUA' && !objetos[c.gy][c.gx];
        poligono(cantos(c.gx, c.gy), null, livre ? '#b2ebf2' : '#e53935');
      }
      ctx.restore();
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
