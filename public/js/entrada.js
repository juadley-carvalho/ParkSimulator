/* ============================================================
   entrada.js — entrada/saída do parque
   ============================================================ */

// BFS apenas por caminhos até a entrada. Devolve o próximo passo, ou null se não há caminho.
function passoAteEntrada(sx, sy) {
  const k = (x, y) => y * MAPA + x;
  const pai = new Map([[k(sx, sy), null]]);
  const fila = [[sx, sy]];
  for (let i = 0; i < fila.length; i++) {
    const [x, y] = fila[i];
    if (ehEntrada(x, y)) {
      let cur = [x, y], p = pai.get(k(x, y));
      while (p && pai.get(k(p[0], p[1]))) { cur = p; p = pai.get(k(p[0], p[1])); }
      return cur;
    }
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx, ny = y + dy;
      if (ehCaminho(nx, ny) && !pai.has(k(nx, ny))) { pai.set(k(nx, ny), [x, y]); fila.push([nx, ny]); }
    }
  }
  return null;
}

// Quem está sem dinheiro ou infeliz decide ir embora. Ao pisar na entrada, marca g.foi.
function decidirSaida(g, cx, cy) {
  if (!g.saindo) {
    if (g.n.felicidade <= 10 || g.dinheiro < 2) g.saindo = true; else return false;
  }
  if (ehEntrada(cx, cy)) { g.foi = true; return true; }
  const p = passoAteEntrada(cx, cy);
  if (!p) return false;               // sem caminho até a saída: continua vagando
  g.alvo = { gx: p[0], gy: p[1] };
  g.anterior = { gx: cx, gy: cy }; g.resgate = false; g.objetivo = 'saida';
  return true;
}

// Remove quem saiu e faz novos convidados chegarem de tempos em tempos
function atualizarEntrada(dt) {
  for (let i = convidados.length - 1; i >= 0; i--) {   // de trás para frente: splice não bagunça o índice
    if (!convidados[i].foi) continue;
    if (convidados[i] === selecionado) selecionado = null;
    convidados.splice(i, 1);
    stats.sairam++;
  }
  tChegada -= dt;
  if (tChegada > 0) return;
  if (convidados.length < MAX_CONVIDADOS) {
    semear(1, [ENTRADA.gx, ENTRADA.gy]); tChegada = aleatorio(3, 8);
    fin.visitantesMes++;   // base para avaliar receita por visitante (e, no futuro, o preço da entrada)
  }
  else tChegada = 2;                                   // parque lotado: tenta de novo logo
}
