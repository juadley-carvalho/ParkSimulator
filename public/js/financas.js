/* ============================================================
   financas.js — caixa, empréstimo, cobranças e fechamento do mês (só lógica)
   ============================================================ */

function avisar(msg) { fin.aviso = msg; fin.tAviso = tempo; }

// Tenta debitar do caixa. Sem saldo, avisa e devolve false (a obra não acontece).
function cobrar(v) {
  if (fin.caixa < v) { avisar('Saldo insuficiente'); return false; }
  fin.caixa = arred(fin.caixa - v);
  return true;
}

function precoUso(ancora, servico) {
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

function custoManutencaoMensal() {
  let total = 0;
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) {
      const c = objetos[gy][gx];
      if (typeof c === 'string') total += (ECONOMIA[c] || {}).manutencao || 0;   // só âncoras: conta 1x
    }
  return total;
}

// Fechamento do mês: cobra juros sobre a dívida e a manutenção (o caixa pode ficar negativo)
function fecharMes() {
  const juros = arred(fin.divida * fin.juros), manut = custoManutencaoMensal();
  fin.caixa = arred(fin.caixa - juros - manut);
  fin.balanco = { mes: fin.mes, receita: fin.receitaMes, manut, juros };
  fin.receitaMes = 0; fin.mes++;
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
