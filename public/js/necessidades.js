/* ============================================================
   necessidades.js — necessidades dos convidados e busca de serviços
   ============================================================ */

// Evolução das necessidades com o tempo (por segundo)
function atualizarNecessidades(g, dt) {
  const n = g.n;
  const atividade = g.estado === 'usando' ? g.uso.def.atividade
    : g.estado === 'esperando' ? 'esperar' : g.estado === 'brincando' ? 'brinquedo' : 'andar';
  n.fome += 1.2 * dt;
  n.sede += 1.6 * dt;
  n.banheiro += 0.25 * dt;
  n.nausea -= 0.4 * dt;
  if (atividade === 'andar') n.energia -= 0.7 * dt;
  // Necessidades críticas pioram o humor, além do custo da atividade
  const criticas = [n.fome > 80, n.sede > 80, n.banheiro > 80, n.nausea > 80, n.energia < 20].filter(Boolean).length;
  n.felicidade -= (FELIC_POR_ATIVIDADE[atividade] + criticas) * dt;
  for (const c in n) n[c] = limitar(n[c]);
}

// Contagem regressiva do serviço; ao terminar, aplica os efeitos de uma vez
function usar(g, dt) {
  g.uso.resta -= dt;
  if (g.uso.resta > 0) return;
  for (const [campo, v] of Object.entries(efeitosFinais(g, g.uso.def))) g.n[campo] = limitar(g.n[campo] + v);
  g.estado = 'andando'; g.uso = null; g.objetivo = null; g.alvo = null; g.anterior = null;
}

// Objetos no tile (x, y) ou ao lado que oferecem esse serviço: lista de { def, ancora }.
// g (opcional): só devolve o que ele pode pagar e aceita.
function servicosPerto(x, y, servico, g = null) {
  const achados = [];
  for (const [dx, dy] of [[0, 0], ...VIZINHOS]) {
    const nx = x + dx, ny = y + dy;
    if (!dentroDoMapa(nx, ny)) continue;
    const o = objetoEm(nx, ny);
    const def = o && OBJETOS[o.chave].servicos && OBJETOS[o.chave].servicos[servico];
    if (def && (!g || (precoUso({ gx: o.gx, gy: o.gy }, servico) <= g.dinheiro && aceitaIntensidade(g, def))))
      achados.push({ def, ancora: { gx: o.gx, gy: o.gy } });
  }
  return achados;
}

// Felicidade líquida esperada do brinquedo para este convidado (ver PREFERENCIA_INTENSIDADE em config.js).
// dist = tiles de caminho até o ponto de acesso.
function atratividade(g, servico, def, ancora, dist) {
  const a = atracoes.get(chaveAtr(ancora.gx, ancora.gy));
  if (!a || a.fila.length >= FILA_MAX) return -Infinity;   // fila cheia: nem considera
  const ganho = efeitosFinais(g, def).felicidade || 0;
  const preferencia = PREFERENCIA_INTENSIDADE * Math.abs(diferencaIntensidade(g, def));
  const andar = dist / VELOCIDADE * FELIC_POR_ATIVIDADE.andar;
  const esperar = esperaEstimada(a) * FELIC_POR_ATIVIDADE.esperar;
  return ganho - preferencia - andar - esperar - FELIC_POR_DOLAR * precoUso(ancora, servico);
}

// BFS apenas sobre CAMINHOS. Serviço simples (sem fila): o ponto de acesso mais PRÓXIMO.
// Atração com fila: percorre toda a rede de caminhos e escolhe a de maior atratividade (> 0).
// Devolve { passo, def, ancora }; passo = próximo tile da rota, ou null se ele já está no ponto de acesso.
function buscarServico(sx, sy, servico, g = null) {
  const k = (x, y) => y * MAPA + x;
  const pai = new Map([[k(sx, sy), null]]);
  const dist = new Map([[k(sx, sy), 0]]);
  const fila = [[sx, sy]];
  const vistos = new Set();   // âncoras já avaliadas: a primeira vez é sempre pelo acesso mais próximo (BFS)
  let melhor = null;
  // Reconstrói a rota de trás para frente até achar o primeiro passo
  const resultado = r => {
    let cur = [r.x, r.y], p = pai.get(k(r.x, r.y));
    while (p && pai.get(k(p[0], p[1]))) { cur = p; p = pai.get(k(p[0], p[1])); }
    return { passo: (r.x === sx && r.y === sy) ? null : cur, def: r.def, ancora: r.ancora };
  };
  for (let i = 0; i < fila.length; i++) {
    const [x, y] = fila[i];
    for (const achado of servicosPerto(x, y, servico, g)) {
      const ka = chaveAtr(achado.ancora.gx, achado.ancora.gy);
      if (vistos.has(ka)) continue;
      vistos.add(ka);
      if (!achado.def.capacidade || !g) return resultado({ ...achado, x, y });   // o mais perto serve
      const nota = atratividade(g, servico, achado.def, achado.ancora, dist.get(k(x, y)));
      if (nota > 0 && (!melhor || nota > melhor.nota)) melhor = { ...achado, x, y, nota };
    }
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx, ny = y + dy;
      if (ehCaminho(nx, ny) && !pai.has(k(nx, ny))) {
        pai.set(k(nx, ny), [x, y]); dist.set(k(nx, ny), dist.get(k(x, y)) + 1); fila.push([nx, ny]);
      }
    }
  }
  return melhor ? resultado(melhor) : null;
}

// Chamada quando o convidado chega ao ponto de acesso. Devolve false se desistiu.
function iniciarServico(g, servico, r) {
  if (!r.def.capacidade) {   // serviço simples: usa na hora
    const preco = precoUso(r.ancora, servico);
    if (g.dinheiro < preco) { g.evitar[servico] = tempo + 20; return false; }   // o preço mudou: sem dinheiro
    pagar(g, r.ancora, servico, preco);
    g.estado = 'usando'; g.uso = { servico, def: r.def, ancora: r.ancora, resta: r.def.duracao }; g.alvo = null;
    return true;
  }
  const a = atracoes.get(chaveAtr(r.ancora.gx, r.ancora.gy));
  if (!a || a.fila.length >= FILA_MAX) { g.evitar[servico] = tempo + 20; return false; }   // fila cheia
  a.fila.push(g);
  g.estado = 'esperando';
  g.uso = { servico, def: r.def, ancora: r.ancora, espera: 0 };
  g.alvo = null;
  return true;
}

// Escolhe a necessidade mais urgente (>= LIMIAR_URGENCIA) que ele consiga atender. Devolve true se agiu.
function decidirNecessidade(g, cx, cy) {
  if (decidirSaida(g, cx, cy)) return true;   // ir embora tem prioridade sobre qualquer necessidade
  const candidatas = Object.entries(URGENCIA)
    .map(([servico, calc]) => [servico, calc(g.n)])
    .filter(([s, u]) => u >= LIMIAR_URGENCIA && tempo >= (g.evitar[s] || 0))
    .sort((a, b) => b[1] - a[1]);
  for (const [servico] of candidatas) {
    const r = buscarServico(cx, cy, servico, g);   // só considera o que ele pode pagar e aceita
    if (!r) continue;   // não existe (ou não há caminho até) esse serviço: tenta o próximo
    g.objetivo = servico;
    if (r.passo) { g.alvo = { gx: r.passo[0], gy: r.passo[1] }; g.anterior = { gx: cx, gy: cy }; g.resgate = false; }
    else if (!iniciarServico(g, servico, r)) { g.objetivo = null; continue; }
    return true;
  }
  g.objetivo = null;
  return false;
}

// ---------- Intensidade x tolerância ----------
// Diferença entre a intensidade do brinquedo e a tolerância do convidado
// (positivo = mais intenso que o ideal; negativo = mais suave). Serviços sem intensidade: 0.
function diferencaIntensidade(g, def) {
  return def.intensidade == null ? 0 : def.intensidade - g.tolerancia;
}

// Quantos pontos passam da janela aceitável (0 = dentro da janela)
function excessoIntensidade(g, def) {
  return Math.max(0, Math.abs(diferencaIntensidade(g, def)) - JANELA_INTENSIDADE);
}

// Dentro da janela sempre aceita. Fora dela, só quem está em "desespero por diversão".
function aceitaIntensidade(g, def) {
  return excessoIntensidade(g, def) === 0 || g.n.felicidade <= DESESPERO_FELICIDADE;
}

// Efeitos do serviço para ESTE convidado. Cada ponto além da janela custa felicidade; se o
// brinquedo for intenso demais, custa também náusea (suave demais só entedia).
function efeitosFinais(g, def) {
  const e = { ...def.efeitos };
  const excesso = excessoIntensidade(g, def);
  if (excesso > 0) {
    e.felicidade = (e.felicidade || 0) - PENALIDADE_FELIC_POR_PONTO * excesso;
    if (diferencaIntensidade(g, def) > 0) e.nausea = (e.nausea || 0) + NAUSEA_POR_PONTO * excesso;
  }
  return e;
}
