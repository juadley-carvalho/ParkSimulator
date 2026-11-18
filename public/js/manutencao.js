/* ============================================================
   manutencao.js — defeitos dos brinquedos e mecânicos
   Depende de: config.js, utils.js, estado.js, objetos.js, atracoes.js, financas.js, avaliacao.js (pensar),
   lixo.js (melhorNoCaminho, irAte, patrulhar e o movimento dos funcionários)
   Regras e números: DEFEITOS em config.js.
   ============================================================ */

// Chance de quebrar na próxima corrida: cresce com o desgaste; 0 durante a garantia do último conserto
function chanceDeQuebra(a) {
  if (a.garantia > 0) return 0;
  return Math.min(DEFEITOS.chanceMax, DEFEITOS.chanceBase + DEFEITOS.chancePorDesgaste * a.desgaste);
}

// Na partida de cada corrida: conta o uso e sorteia se ela vai quebrar. O momento também é sorteado
// (entre 20% e 80% da corrida): a quebra acontece com gente a bordo, não parada na estação.
function sortearDefeito(a, def) {
  a.corridas++;
  a.desgaste += DEFEITOS.desgastePorCorrida;
  const chance = chanceDeQuebra(a);
  if (a.garantia > 0) a.garantia--;
  a.quebraEm = Math.random() < chance ? def.duracao * aleatorio(0.2, 0.8) : null;
}

// Quebrou no meio da corrida: para tudo. A fila se desfaz (ninguém sabe quanto vai demorar) e quem
// está a bordo fica preso até o conserto, ou até a evacuação (ver atualizarQuebrada).
function quebrar(a) {
  a.quebrada = true; a.quebraEm = null; a.tQuebrada = 0;
  fin.quebrasMes = (fin.quebrasMes || 0) + 1;
  for (const g of a.fila) {
    pensar(g, 'quebrado');
    g.evitar[g.uso.servico] = tempo + DEFEITOS.evitar;
    soltarConvidado(g);
  }
  a.fila = [];
  for (const g of a.passageiros) pensar(g, 'preso');
  avisar(`🔧 ${OBJETOS[a.chave].nome} quebrou!` +
         (quantosDaFuncao('mecanico') ? '' : ' Contrate um mecânico na aba 👷 Funcionários.'));
}

// Algum mecânico está consertando esta atração agora?
function emConserto(a) {
  const k = chaveAtr(a.ancora.gx, a.ancora.gy);
  return funcionarios.find(f => f.funcao === 'mecanico' && f.conserto === k && f.trabalho > 0) || null;
}

// Parada: os presos perdem felicidade aos poucos. Passado DEFEITOS.resgate sem conserto em andamento,
// a equipe evacua todos e devolve o ingresso. Sem isso, num parque sem mecânico, eles ficariam presos
// para sempre (e nunca iriam embora).
function atualizarQuebrada(a, dt) {
  a.tQuebrada += dt;
  if (!a.passageiros.length) return;
  for (const g of a.passageiros) g.n.felicidade = limitar(g.n.felicidade - DEFEITOS.presoFelicPorSeg * dt);
  if (a.tQuebrada < DEFEITOS.resgate || emConserto(a)) return;   // conserto em andamento: espera terminar
  for (const g of a.passageiros) {
    devolver(g, a.ancora, (g.uso && g.uso.pago) || 0);
    g.n.felicidade = limitar(g.n.felicidade - DEFEITOS.resgateFelic);
    soltarConvidado(g);
  }
  a.passageiros = [];
}

// Conserto concluído: tira parte do desgaste e dá a garantia. Se ainda há gente a bordo, a corrida
// continua de onde parou (fase 'rodando' e "resta" ficaram congelados); senão, volta a carregar.
function consertar(a) {
  a.quebrada = false; a.tQuebrada = 0; a.consertos++;
  a.desgaste *= 1 - DEFEITOS.reparoTira;
  a.garantia = DEFEITOS.garantia;
  if (!a.passageiros.length) {
    a.fase = 'carregando'; a.tCarga = 0;
    if (defDeFila(a.chave).voltas) a.angulo = 0;   // o trem volta à estação
  }
}

// ---------- Mecânicos ----------
// Tiles de caminho encostados na pegada de cada atração quebrada que nenhum outro mecânico já pegou.
// Devolve um Map "gx,gy" do caminho -> chave da atração.
function pontosDeConserto(f) {
  const reservadas = new Set(funcionarios.filter(o => o !== f && o.conserto).map(o => o.conserto));
  const pontos = new Map();
  for (const [k, a] of atracoes) {
    if (!a.quebrada || reservadas.has(k)) continue;
    const { gx, gy } = a.ancora, { w, h } = tamanhoDe(a.chave, rotacaoDe(gx, gy));
    for (let y = gy; y < gy + h; y++)
      for (let x = gx; x < gx + w; x++)
        for (const [dx, dy] of VIZINHOS)
          if (ehCaminho(x + dx, y + dy)) pontos.set(chaveAtr(x + dx, y + dy), k);
  }
  return pontos;
}

// Chamada a cada tile em que o mecânico chega: conserta aqui, segue para a atração quebrada mais
// perto (pelos caminhos) ou patrulha
function decidirMecanico(f, cx, cy) {
  if (f.conserto) {   // a atração foi consertada por outro, demolida ou o jogo foi carregado
    const a = atracoes.get(f.conserto);
    if (!a || !a.quebrada) { f.conserto = null; f.tarefa = null; }
  }
  if (!f.conserto) {
    const pontos = pontosDeConserto(f);
    const r = pontos.size ? melhorNoCaminho(cx, cy, (x, y, d) => (pontos.has(chaveAtr(x, y)) ? d : null)) : null;
    if (r) { f.conserto = pontos.get(chaveAtr(r.gx, r.gy)); f.tarefa = { gx: r.gx, gy: r.gy }; }
  }
  if (f.tarefa) {
    if (f.tarefa.gx === cx && f.tarefa.gy === cy) { f.trabalho = DEFEITOS.tempoConserto; f.alvo = null; return; }
    if (irAte(f, cx, cy, f.tarefa)) return;
    f.tarefa = null; f.conserto = null;   // não dá mais para chegar lá
  }
  patrulhar(f, cx, cy);
}

function concluirConserto(f) {
  const a = f.conserto && atracoes.get(f.conserto);
  if (a && a.quebrada) { consertar(a); f.consertos++; f.consertosMes++; }
  f.conserto = null; f.tarefa = null;
}

// Resumo para a janela do parque
function resumoManutencao() {
  const quebradas = [...atracoes.values()].filter(a => a.quebrada).map(a => OBJETOS[a.chave].nome);
  return { quebradas, quebrasMes: fin.quebrasMes || 0, mecanicos: quantosDaFuncao('mecanico'),
           consertosMes: funcionarios.reduce((s, f) => s + (f.consertosMes || 0), 0) };
}
