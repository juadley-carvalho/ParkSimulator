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
  if (preco > 0) {
    mostrarValorFlutuante(preco, g.x, g.y);
    tocarSomMoeda();
  }
}

function mostrarValorFlutuante(valor, gx, gy) {
  if (!valor) return;
  let camada = 0;
  for (let i = valoresFlutuantes.length - 1; i >= 0; i--) {
    const v = valoresFlutuantes[i];
    if (tempo - v.inicio >= ANIMACAO_DINHEIRO.janelaEmpilhamento) break;
    if (Math.hypot(v.gx - gx, v.gy - gy) < 0.65) camada++;
  }
  const quantia = Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  valoresFlutuantes.push({ valor, texto: `${valor > 0 ? '+' : '−'}$${quantia}`, gx, gy, inicio: tempo, camada });
}

function atualizarValoresFlutuantes() {
  for (let i = valoresFlutuantes.length - 1; i >= 0; i--)
    if (tempo - valoresFlutuantes[i].inicio >= ANIMACAO_DINHEIRO.duracao) valoresFlutuantes.splice(i, 1);
}

// Devolve um pagamento (evacuação de brinquedo quebrado): o contrário de pagar, sem desfazer o "uso"
function devolver(g, ancora, valor) {
  if (!(valor > 0)) return;
  g.dinheiro = arred(g.dinheiro + valor);
  fin.caixa = arred(fin.caixa - valor);
  fin.receitaMes = arred(fin.receitaMes - valor);
  const d = gestao.get(chaveAtr(ancora.gx, ancora.gy));
  if (d) d.receita = arred(d.receita - valor);
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

function salariosMensais() { return funcionarios.reduce((s, f) => s + (FUNCOES[f.funcao] || FUNCOES.faxineiro).salario, 0); }

// Fechamento do mês: cobra juros sobre a dívida, a manutenção e os salários (o caixa pode ficar negativo)
function fecharMes() {
  const juros = arred(fin.divida * fin.juros), manut = custoManutencaoMensal(), salarios = salariosMensais();
  fin.caixa = arred(fin.caixa - juros - manut - salarios);
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) {
      const chave = objetos[gy][gx];
      if (typeof chave !== 'string') continue;
      const valor = (ECONOMIA[chave] || {}).manutencao || 0;
      if (!valor) continue;
      const { w, h } = tamanhoDe(chave, rotacaoDe(gx, gy));
      mostrarValorFlutuante(-valor, gx + w / 2, gy + h / 2);
    }
  for (const f of funcionarios) {
    const salario = (FUNCOES[f.funcao] || FUNCOES.faxineiro).salario;
    if (salario) mostrarValorFlutuante(-salario, f.x, f.y);
  }
  for (const f of funcionarios) { f.recolheuMes = 0; f.consertosMes = 0; }
  fin.balanco = { mes: fin.mes, receita: fin.receitaMes, manut, juros, salarios, visitantes: fin.visitantesMes,
                  entradas: fin.entradasMes, recusas: fin.recusasMes, quebras: fin.quebrasMes || 0, queixas: fin.queixasMes, nota: Math.round(avaliacao.nota) };
  fin.receitaMes = 0; fin.visitantesMes = 0; fin.entradasMes = 0; fin.recusasMes = 0; fin.quebrasMes = 0; fin.queixasMes = {}; fin.mes++;
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
