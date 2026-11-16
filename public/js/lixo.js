/* ============================================================
   lixo.js — lixo e vômito no chão, lixeiras e faxineiros
   Depende de: config.js, utils.js, estado.js, objetos.js, convidados.js, avaliacao.js (pensar)
   ============================================================ */

const TIPOS_SUJEIRA = ['papel', 'copo', 'palito', 'vomito'];

// ---------- Sujeira no chão ----------
function sujeiraEm(gx, gy) { return sujeira.get(chaveAtr(gx, gy)) || []; }

function temVomito(gx, gy) { return sujeiraEm(gx, gy).some(i => i.tipo === 'vomito'); }

// Põe um item no tile. Só cai no caminho e cabem LIXO.maxPorTile: devolve false se não coube.
// dx, dy e giro são sorteados uma vez, para o papel não "pular" de lugar a cada quadro.
function sujar(gx, gy, tipo) {
  if (!ehCaminho(gx, gy)) return false;
  const k = chaveAtr(gx, gy), lista = sujeira.get(k) || [];
  if (lista.length >= LIXO.maxPorTile) return false;
  lista.push({ tipo, dx: aleatorio(-0.28, 0.28), dy: aleatorio(-0.28, 0.28), giro: aleatorio(0, Math.PI) });
  sujeira.set(k, lista);
  return true;
}

// Tira um item do tile (o vômito primeiro) e devolve o tipo, ou null se estava limpo
function recolherItem(gx, gy) {
  const k = chaveAtr(gx, gy), lista = sujeira.get(k);
  if (!lista) return null;
  const i = Math.max(0, lista.findIndex(it => it.tipo === 'vomito'));
  const [item] = lista.splice(i, 1);
  if (!lista.length) sujeira.delete(k);   // tile limpo: sai do Map (o Map só guarda tiles sujos)
  return item.tipo;
}

// Fração 0..1 usada na avaliação: itens no chão (vômito vale 2) por tile de caminho
function fracaoSujeira() {
  let itens = 0, caminhos = 0;
  for (const lista of sujeira.values()) for (const it of lista) itens += it.tipo === 'vomito' ? 2 : 1;
  for (const linha of mapa) for (const t of linha) if (t === 'CAMINHO') caminhos++;
  return caminhos ? Math.min(1, itens / (caminhos * AVALIACAO.sujeiraSatura)) : 0;
}

// ---------- Lixeiras ----------
function ehLixeira(c) { return typeof c === 'string' && !!OBJETOS[c].lixeira; }
function capacidadeLixeira(gx, gy) { return OBJETOS[objetos[gy][gx]].lixeira.capacidade; }
function cheiaDeMais(gx, gy) { return (lixeiras.get(chaveAtr(gx, gy)) || 0) >= capacidadeLixeira(gx, gy); }

// Lixeira no tile (x, y) ou ao lado. Prefere uma com espaço; se só houver cheia, devolve a cheia.
function lixeiraPerto(x, y) {
  let cheia = null;
  for (const [dx, dy] of [[0, 0], ...VIZINHOS]) {
    const nx = x + dx, ny = y + dy;
    if (!dentroDoMapa(nx, ny) || !ehLixeira(objetos[ny][nx])) continue;
    if (!cheiaDeMais(nx, ny)) return { gx: nx, gy: ny, cheia: false };
    cheia = { gx: nx, gy: ny, cheia: true };
  }
  return cheia;
}

function precisaEsvaziar(gx, gy) {
  return ehLixeira(objetos[gy][gx]) && (lixeiras.get(chaveAtr(gx, gy)) || 0) >= capacidadeLixeira(gx, gy) * LIXO.esvaziarEm;
}

// ---------- Busca pelos caminhos ----------
// BFS só por CAMINHO, até maxDist passos. avaliar(x, y, dist) devolve uma nota (menor = melhor) ou null
// (não serve). Devolve o melhor tile e o primeiro passo até ele (null se já está lá), ou null.
// A mesma busca serve ao convidado (lixeira mais perto) e ao faxineiro (tarefa com prioridade).
function melhorNoCaminho(sx, sy, avaliar, maxDist = Infinity) {
  const k = (x, y) => y * MAPA + x;
  const pai = new Map([[k(sx, sy), null]]), dist = new Map([[k(sx, sy), 0]]), fila = [[sx, sy]];
  let melhor = null;
  for (let i = 0; i < fila.length; i++) {
    const [x, y] = fila[i], d = dist.get(k(x, y));
    const nota = avaliar(x, y, d);
    if (nota != null && (!melhor || nota < melhor.nota)) melhor = { x, y, nota };
    if (d >= maxDist) continue;
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx, ny = y + dy;
      if (ehCaminho(nx, ny) && !pai.has(k(nx, ny))) { pai.set(k(nx, ny), [x, y]); dist.set(k(nx, ny), d + 1); fila.push([nx, ny]); }
    }
  }
  if (!melhor) return null;
  let cur = [melhor.x, melhor.y], p = pai.get(k(melhor.x, melhor.y));
  while (p && pai.get(k(p[0], p[1]))) { cur = p; p = pai.get(k(p[0], p[1])); }
  const jaEsta = melhor.x === sx && melhor.y === sy;
  return { gx: melhor.x, gy: melhor.y, passo: jaEsta ? null : { gx: cur[0], gy: cur[1] } };
}

// ---------- Convidados ----------
// Terminou de comer/beber: o lixo fica na mão até achar lixeira ou cansar de segurar
function receberLixo(g, tipo) {
  g.lixo = { tipo, ate: tempo + LIXO.seguraMin + (LIXO.seguraMax - LIXO.seguraMin) * g.capricho };
}

// Chamada quando o convidado ENTRA num tile de caminho (escolherAlvo): pisa na sujeira, talvez vomite,
// e cuida do lixo da mão (lixeira ao lado, lixeira cheia = transborda, ou cansou e joga no chão).
function chegarNoTile(g, cx, cy) {
  // Pisar na sujeira incomoda no máximo uma vez a cada INTERVALO_PENSAMENTO (o mesmo da queixa):
  // num parque sujo ele pisaria em lixo a cada tile e a felicidade despencaria em segundos.
  const lista = sujeiraEm(cx, cy);
  if (lista.length) {
    const tipo = lista.some(i => i.tipo === 'vomito') ? 'nojo' : 'sujeira';
    if (tempo >= (g.pensou[tipo] || 0)) {
      g.n.felicidade = limitar(g.n.felicidade - (tipo === 'nojo' ? LIXO.pisarVomito : LIXO.pisarLixo));
      pensar(g, tipo);
    }
  }
  if (g.n.nausea >= LIXO.nauseaVomito && Math.random() < LIXO.chanceVomito && sujar(cx, cy, 'vomito')) {
    g.n.nausea = limitar(g.n.nausea - LIXO.aliviaVomito);
    g.n.felicidade = limitar(g.n.felicidade - LIXO.felicVomito);
    pensar(g, 'enjoo');
  }
  if (!g.lixo) return;
  const l = lixeiraPerto(cx, cy);
  if (l && !l.cheia) {
    const k = chaveAtr(l.gx, l.gy);
    lixeiras.set(k, lixeiras.get(k) + 1);
    g.lixo = null;
  } else if (l) {
    if (sujar(l.gx, l.gy, g.lixo.tipo)) g.lixo = null;   // lixeira cheia: deixa ao lado dela (transborda)
  } else if (tempo >= g.lixo.ate) {
    if (sujar(cx, cy, g.lixo.tipo)) g.lixo = null;
    else g.lixo.ate = tempo + 3;   // tile já cheio de lixo: larga no próximo
  }
  if (!g.lixo && g.objetivo === 'lixo') g.objetivo = null;
}

// Com lixo na mão e nenhuma necessidade urgente: se há lixeira com espaço a poucos passos, desvia até ela
function irAteLixeira(g, cx, cy) {
  if (!g.lixo) return false;
  const r = melhorNoCaminho(cx, cy, (x, y, d) => {
    const l = lixeiraPerto(x, y);
    return l && !l.cheia ? d : null;
  }, LIXO.desvio);
  if (!r || !r.passo) return false;
  g.objetivo = 'lixo';
  g.alvo = r.passo; g.anterior = { gx: cx, gy: cy }; g.resgate = false;
  return true;
}

// ---------- Faxineiros ----------
function contratarFaxineiro(gx, gy) {
  const numero = Math.max(0, ...funcionarios.map(f => f.numero || 0)) + 1;
  funcionarios.push({ numero, nome: `Faxineiro ${numero}`, x: gx + 0.5, y: gy + 0.5, alvo: null, anterior: null,
                      tarefa: null, trabalho: 0, recolheu: 0, recolheuMes: 0 });
}

function demitirFuncionario(f) {
  const i = funcionarios.indexOf(f);
  if (i >= 0) funcionarios.splice(i, 1);
  if (selFunc === f) selFunc = null;
}

// Ainda há o que fazer no tile da tarefa? (outro faxineiro ou o jogador podem ter resolvido antes)
function tarefaValida(t) { return sujeiraEm(t.gx, t.gy).length > 0 || precisaEsvaziar(t.gx, t.gy); }

// Duração do próximo trabalho no tile. A lixeira vem PRIMEIRO: cheia, ela faz os convidados largarem
// o lixo no chão do lado dela, e quem só varresse ficaria preso ali para sempre (já aconteceu).
function duracaoDoTrabalho(gx, gy) {
  return precisaEsvaziar(gx, gy) ? LIXO.tempoLixeira : temVomito(gx, gy) ? LIXO.tempoVomito : LIXO.tempoLixo;
}

// Próxima tarefa: a de menor (distância − bônus), fora as já RESERVADAS por outros faxineiros.
// O Set das reservas evita que dois faxineiros corram para o mesmo papel.
function escolherTarefa(f, cx, cy) {
  const reservados = new Set(funcionarios.filter(o => o !== f && o.tarefa).map(o => chaveAtr(o.tarefa.gx, o.tarefa.gy)));
  const r = melhorNoCaminho(cx, cy, (x, y, d) => {
    if (reservados.has(chaveAtr(x, y))) return null;
    if (temVomito(x, y)) return d - LIXO.bonusVomito;
    if (precisaEsvaziar(x, y)) return d - LIXO.bonusLixeira;
    return sujeiraEm(x, y).length ? d : null;
  });
  return r && { gx: r.gx, gy: r.gy };
}

// Uma unidade de trabalho terminou: esvazia a lixeira (se precisa) ou recolhe um item do chão
function concluirTrabalho(f) {
  const cx = Math.floor(f.x), cy = Math.floor(f.y);
  let n = 0;
  if (precisaEsvaziar(cx, cy)) { n = lixeiras.get(chaveAtr(cx, cy)); lixeiras.set(chaveAtr(cx, cy), 0); }
  else if (recolherItem(cx, cy)) n = 1;
  f.recolheu += n; f.recolheuMes += n;
}

// Chamada a cada tile em que o faxineiro chega: trabalha aqui, segue para a tarefa ou patrulha
function decidirFaxineiro(f) {
  const cx = Math.floor(f.x), cy = Math.floor(f.y);
  if (!ehCaminho(cx, cy)) {   // o caminho sumiu debaixo dele: volta para o mais próximo
    const p = proximoPassoAteCaminho(cx, cy);
    f.alvo = p && { gx: p[0], gy: p[1] }; f.tarefa = null;
    return;
  }
  if (f.tarefa && !tarefaValida(f.tarefa)) f.tarefa = null;
  if (!f.tarefa) f.tarefa = escolherTarefa(f, cx, cy);
  if (f.tarefa) {
    if (f.tarefa.gx === cx && f.tarefa.gy === cy) { f.trabalho = duracaoDoTrabalho(cx, cy); f.alvo = null; return; }
    const t = f.tarefa, r = melhorNoCaminho(cx, cy, (x, y) => (x === t.gx && y === t.gy ? 0 : null));
    if (r && r.passo) { f.alvo = r.passo; f.anterior = { gx: cx, gy: cy }; return; }
    f.tarefa = null;   // não dá mais para chegar lá
  }
  // Nada para limpar: patrulha como um convidado passeando (sem voltar, a menos que seja beco)
  const op = VIZINHOS.map(([dx, dy]) => ({ gx: cx + dx, gy: cy + dy })).filter(t => ehCaminho(t.gx, t.gy));
  const sem = op.filter(t => !(f.anterior && t.gx === f.anterior.gx && t.gy === f.anterior.gy));
  const lista = sem.length ? sem : op;
  f.alvo = lista.length ? lista[Math.floor(Math.random() * lista.length)] : null;
  f.anterior = { gx: cx, gy: cy };
}

function atualizarFuncionarios(dt) {
  for (const f of funcionarios) {
    if (f.trabalho > 0) {
      f.trabalho -= dt;
      if (f.trabalho <= 0) { f.trabalho = 0; concluirTrabalho(f); decidirFaxineiro(f); }   // mais trabalho aqui?
      continue;
    }
    if (!f.alvo || mapa[f.alvo.gy][f.alvo.gx] === 'AGUA') { decidirFaxineiro(f); if (!f.alvo) continue; }
    const tx = f.alvo.gx + 0.5, ty = f.alvo.gy + 0.5;
    const dx = tx - f.x, dy = ty - f.y, dist = Math.hypot(dx, dy), passo = LIXO.velocidade * dt;
    if (dist <= passo) { f.x = tx; f.y = ty; f.alvo = null; decidirFaxineiro(f); }
    else { f.x += dx / dist * passo; f.y += dy / dist * passo; }
  }
}

// Resumo para a janela do parque
function resumoLimpeza() {
  let lixo = 0, vomito = 0, cheias = 0;
  for (const lista of sujeira.values()) for (const it of lista) it.tipo === 'vomito' ? vomito++ : lixo++;
  for (const k of lixeiras.keys()) { const [gx, gy] = k.split(',').map(Number); if (precisaEsvaziar(gx, gy)) cheias++; }
  return { lixo, vomito, lixeiras: lixeiras.size, cheias, recolheuMes: funcionarios.reduce((s, f) => s + f.recolheuMes, 0) };
}
