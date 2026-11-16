/* ============================================================
   financas.js — caixa, empréstimo, cobranças e fechamento do mês (só lógica)
   ============================================================ */

// Usa o relógio REAL: pausado, o tempo do jogo não anda e o aviso nunca sumiria
// ok = true: mensagem boa (verde), como "Salvo automaticamente"; senão é um problema (vermelho)
function avisar(msg, ok = false) { fin.aviso = msg; fin.avisoOk = ok; fin.tAviso = tempoReal; }

// Tenta debitar do caixa. Sem saldo, avisa e devolve false (a obra não acontece).
function cobrar(v) {
  if (fin.caixa < v) { avisar('Saldo insuficiente'); return false; }
  fin.caixa = arred(fin.caixa - v);
  return true;
}

function precoUso(ancora, servico) {
  if (servico === 'diversao' && partida.precosTravados) return 0;   // cenário "Só ingresso": brinquedos grátis
  const d = gestao.get(chaveAtr(ancora.gx, ancora.gy));
  return d ? (d.precos[servico] || 0) : 0;
}

// O convidado paga: sai do bolso dele, entra no caixa e nas estatísticas do objeto
function pagar(g, ancora, servico, preco) {
  g.dinheiro = arred(g.dinheiro - preco);
  fin.caixa = arred(fin.caixa + preco);
  fin.receitaMes = arred(fin.receitaMes + preco);
  const d = gestao.get(chaveAtr(ancora.gx, ancora.gy));
  if (d) { d.receita = arred(d.receita + preco); d.usos++; }
}

// Ingresso do parque, cobrado na chegada. Entra na receita do mês e também à parte (entradasMes),
// para o balanço mostrar quanto veio do portão e quanto dos objetos.
function pagarEntrada(g) {
  const preco = parque.precoEntrada;
  if (!preco) return;
  g.dinheiro = arred(g.dinheiro - preco);
  fin.caixa = arred(fin.caixa + preco);
  fin.receitaMes = arred(fin.receitaMes + preco);
  fin.entradasMes = arred(fin.entradasMes + preco);
}

function custoManutencaoMensal() {
  let total = 0;
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) {
      const c = objetos[gy][gx];
      if (typeof c === 'string') total += (ECONOMIA[c] || {}).manutencao || 0;   // só âncoras: conta 1x
    }
  return total;
}

// Quanto o parque vale: caixa − dívida + o que os objetos devolveriam se demolidos. É a base do
// objetivo "lucro": demolir não conta como ganho (o caixa sobe, o valor dos objetos desce igual).
function patrimonio() {
  let objetosValem = 0;
  for (const linha of objetos) for (const c of linha) if (typeof c === 'string') objetosValem += custoDe(c) * REEMBOLSO;
  return arred(fin.caixa - fin.divida + objetosValem);
}

function salariosMensais() { return funcionarios.length * LIXO.salario; }

// Fechamento do mês: cobra juros sobre a dívida, a manutenção e os salários (o caixa pode ficar negativo)
function fecharMes() {
  const juros = arred(fin.divida * fin.juros), manut = custoManutencaoMensal(), salarios = salariosMensais();
  fin.caixa = arred(fin.caixa - juros - manut - salarios);
  for (const f of funcionarios) f.recolheuMes = 0;
  fin.balanco = { mes: fin.mes, receita: fin.receitaMes, manut, juros, salarios, visitantes: fin.visitantesMes,
                  entradas: fin.entradasMes, recusas: fin.recusasMes, queixas: fin.queixasMes, nota: Math.round(avaliacao.nota) };
  fin.receitaMes = 0; fin.visitantesMes = 0; fin.entradasMes = 0; fin.recusasMes = 0; fin.queixasMes = {}; fin.mes++;
  objetivoNoFechamento(fin.balanco.mes);   // cenário: vitória ou fim do prazo (cenarios.js)
}

function atualizarFinancas(dt) {
  fin.tMes += dt;
  if (fin.tMes >= SEG_POR_MES) { fin.tMes -= SEG_POR_MES; fecharMes(); }
}

function pegarEmprestimo() {
  if (fin.divida + PARCELA > LIMITE_EMPRESTIMO) return avisar('Limite de empréstimo atingido');
  fin.divida += PARCELA; fin.caixa = arred(fin.caixa + PARCELA);
}

function pagarEmprestimo() {
  if (fin.divida < PARCELA) return avisar('Sem dívida para pagar');
  if (fin.caixa < PARCELA) return avisar('Saldo insuficiente');
  fin.divida -= PARCELA; fin.caixa = arred(fin.caixa - PARCELA);
}
