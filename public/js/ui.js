/* ============================================================
   ui.js — painéis, tela de finanças e barra de ferramentas
   Depende de: dom.js, estado.js, financas.js, objetos.js
   ============================================================ */

// Painel com as barras de necessidades do convidado selecionado
const CAMPOS = [['fome', 'Fome', true], ['sede', 'Sede', true], ['banheiro', 'Banheiro', true],
                ['nausea', 'Náusea', true], ['energia', 'Energia', false], ['felicidade', 'Felicidade', false]];

const NOMES_SERVICO = { comida: 'Comida', bebida: 'Bebida', descanso: 'Descanso', banheiro: 'Banheiro', diversao: 'Ingresso' };
let abaCustosAtiva = 'funcionarios';
let proximaAtualizacaoCustos = -Infinity;

function atualizarPainel() {
  painel.style.display = selecionado ? 'block' : 'none';
  if (!selecionado) return;
  for (const [c, , altoRuim] of CAMPOS) {
    const v = selecionado.n[c], ruim = altoRuim ? v : 100 - v;
    const el = document.getElementById('b-' + c);
    el.style.width = v + '%';
    el.style.background = `hsl(${120 * (1 - ruim / 100)} 65% 45%)`;   // verde -> vermelho
  }
  const g = selecionado;
  document.getElementById('estado').textContent =
    g.estado === 'usando' ? `Usando ${iconeDoUso(g)} (${Math.ceil(g.uso.resta)}s)` :
    g.objetivo ? `Indo: ${ICONES[g.objetivo]}` : 'Passeando';
  document.getElementById('dinheiro').textContent = `Dinheiro: ${moeda(g.dinheiro)} · Tolerância: ${g.tolerancia}/10`;
  if (g.estado === 'esperando')
    document.getElementById('estado').textContent =
      `Na fila ${iconeDoUso(g)} (paciência: ${Math.max(0, Math.ceil(g.paciencia - g.uso.espera))}s)`;
  if (g.estado === 'brincando') document.getElementById('estado').textContent = 'No brinquedo 🎠';
  // Última queixa enquanto o balão está na tela
  if (g.pensamento && tempo < g.pensamento.ate)
    document.getElementById('estado').textContent += ` · 💭 "${PENSAMENTOS[g.pensamento.tipo].texto}"`;
}

function selecionar(gx, gy) {
  // Faxineiro bem no clique: tem prioridade (ele anda sobre os caminhos, onde também ficam bancos e lixeiras)
  const f = funcionarios.find(f => Math.hypot(f.x - (gx + 0.5), f.y - (gy + 0.5)) < 0.7);
  if (f) { selecionarFuncionario(f); return; }
  const o = objetoEm(gx, gy);   // objeto com preços tem prioridade sobre convidados próximos
  if (o && gestao.has(chaveAtr(o.gx, o.gy))) { selecionarObjeto(chaveAtr(o.gx, o.gy)); return; }
  let melhor = null, d = 1;
  for (const g of convidados) {
    const dist = Math.hypot(g.x - (gx + 0.5), g.y - (gy + 0.5));
    if (dist < d) { d = dist; melhor = g; }
  }
  if (melhor) { selecionado = melhor; selObj = null; selFunc = null; }
}

// Painel do funcionário: o nome vem do save (pode ter sido editado), então entra por textContent
function selecionarFuncionario(f) {
  selFunc = f; selObj = null; selecionado = null;
  painelObj.innerHTML = `<div class='painel-topo'><span></span><button class='fechar' title='Fechar (Esc)'>✕</button></div>` +
    `<div id='fStats'></div><div class='botoes'><button class='btn btn-perigo' id='btnDemitir'>Demitir</button></div>`;
  painelObj.querySelector('.painel-topo span').textContent = (FUNCOES[f.funcao] || FUNCOES.faxineiro).icone + ' ' + f.nome;
  painelObj.querySelector('.fechar').addEventListener('click', () => { selFunc = null; });
  $('btnDemitir').addEventListener('click', () => {
    if (confirm(`Demitir ${f.nome}? O salário deixa de ser cobrado (a contratação não é devolvida).`)) demitirFuncionario(f);
  });
}

function selecionarObjeto(k) {
  selObj = k; selecionado = null; selFunc = null;
  const [gx, gy] = k.split(',').map(Number);
  const chave = objetos[gy][gx], d = gestao.get(k);
  painelObj.innerHTML = `<div class='painel-topo'><span>${OBJETOS[chave].icone} ${OBJETOS[chave].nome}</span>` +
    `<button class='fechar' title='Fechar (Esc)'>✕</button></div>` +
    Object.entries(OBJETOS[chave].servicos).map(([s, def]) => {
      const travado = s === 'diversao' && partida.precosTravados;   // cenário "Só ingresso"
      return `<div class='linha'><span>${def.nome || NOMES_SERVICO[s] || s}</span>$ <input type='number' min='0' step='0.1' data-s='${s}' ` +
        (travado ? `value='0' disabled title='Neste cenário os brinquedos são grátis'>` : `value='${d.precos[s] || 0}'>`) + `</div>`;
    }).join('') +
    `<div id='oStats'></div>`;
  painelObj.querySelector('.fechar').addEventListener('click', () => { selObj = null; });
  // Os campos só são criados aqui; o loop atualiza apenas o texto das estatísticas
  painelObj.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
    d.precos[inp.dataset.s] = Math.max(0, arred(parseFloat(inp.value) || 0));
  }));
}

function atualizarPainelObj() {
  if (selObj && !gestao.has(selObj)) selObj = null;   // foi demolido
  if (selFunc && !funcionarios.includes(selFunc)) selFunc = null;   // demitido ou jogo carregado
  painelObj.style.display = selObj || selFunc ? 'block' : 'none';
  if (selFunc) {
    const f = selFunc;
    const salario = `<br>Salário: ${moeda((FUNCOES[f.funcao] || FUNCOES.faxineiro).salario)}/mês`;
    if (f.funcao === 'mecanico') {
      const a = f.conserto && atracoes.get(f.conserto), nome = a ? OBJETOS[a.chave].nome : '';
      $('fStats').innerHTML = (f.trabalho > 0 ? `Consertando: ${nome} 🔧 (${Math.ceil(f.trabalho)}s)` : a ? `Indo consertar: ${nome}` : 'Patrulhando os caminhos') +
        `<br>Consertos este mês: ${f.consertosMes}<br>Consertos no total: ${f.consertos}` + salario;
    } else
      $('fStats').innerHTML = (f.trabalho > 0 ? 'Limpando 🧹' : f.tarefa ? `Indo limpar (${f.tarefa.gx}, ${f.tarefa.gy})` : 'Patrulhando os caminhos') +
        `<br>Recolheu este mês: ${f.recolheuMes}<br>Recolheu no total: ${f.recolheu}` + salario;
    return;
  }
  if (!selObj) return;
  const d = gestao.get(selObj), atr = atracoes.get(selObj);
  const [gx, gy] = selObj.split(',').map(Number);
  const manut = (ECONOMIA[objetos[gy][gx]] || {}).manutencao || 0;
  const brinquedo = Object.values(OBJETOS[objetos[gy][gx]].servicos).find(s => s.intensidade);
  $('oStats').innerHTML = `Receita total: ${moeda(d.receita)}<br>Usos: ${d.usos}<br>Manutenção: ${moeda(manut)}/mês` +
    (brinquedo ? `<br>Intensidade: ${brinquedo.intensidade}/10` : '') +
    (atr ? `<br>Fila: ${atr.fila.length}/${FILA_MAX} · A bordo: ${atr.passageiros.length}` +
           (atr.quebrada ? '' : `<br>Espera estimada: ${Math.ceil(esperaEstimada(atr))}s`) + textoManutencao(atr) : '');
}

// Estado de conservação de uma atração (painel do objeto)
function textoManutencao(a) {
  const estado = !a.quebrada ? '<span style="color:#7bd17b">funcionando</span>'
    : emConserto(a) ? '<b style="color:#ffb74d">em conserto 🔧</b>'
    : `<b style="color:#ff6b6b">QUEBRADA</b> há ${Math.floor(a.tQuebrada)}s` + (a.passageiros.length ? ` · ${a.passageiros.length} preso(s)` : '');
  const chance = (chanceDeQuebra(a) * 100).toFixed(1).replace('.', ',');
  return `<br>Estado: ${estado}<br>Desgaste: ${a.desgaste.toFixed(1).replace('.', ',')} · chance de quebrar: ${chance}% por corrida` +
    (a.garantia > 0 ? ` (garantia: ${a.garantia} corrida${a.garantia === 1 ? '' : 's'})` : '') +
    `<br>Corridas: ${a.corridas} · Consertos: ${a.consertos}`;
}

function atualizarFinancasUI() {
  $('finTxt').textContent = `🎡 ${nomeDoParque()} · 📅 Dia ${diaDoMes(fin.tMes)} de ${nomeDoMes(fin.mes)} · ` +
                            `⭐ ${Math.round(avaliacao.nota)} · 💰 ${moeda(fin.caixa)} · 🏦 Dívida ${moeda(fin.divida)}`;
  $('finTxt').style.color = fin.caixa < 0 ? '#e53935' : '';
  $('finAviso').textContent = tempoReal - fin.tAviso < 2.5 ? fin.aviso : '';
  $('finAviso').classList.toggle('ok', fin.avisoOk);
  for (const b of document.querySelectorAll('#velocidades button')) b.classList.toggle('ativo', +b.dataset.v === velocidade);
  $('pausado').hidden = !(velocidade === 0 && fase === 'jogando');
  atualizarCustosManutencaoUI();
  if (!$('modalFin').classList.contains('aberto')) return;
  $('empInfo').innerHTML =
    `Caixa: <b>${moeda(fin.caixa)}</b><br>Dívida: <b>${moeda(fin.divida)}</b> (limite ${moeda(LIMITE_EMPRESTIMO)})<br>` +
    `Disponível para pegar: ${moeda(LIMITE_EMPRESTIMO - fin.divida)}<br>` +
    `Juros no próximo fechamento: ${moeda(fin.divida * fin.juros)}<br>` +
    `Manutenção mensal: ${moeda(custoManutencaoMensal())}<br>` +
    `Salários mensais: ${moeda(salariosMensais())}` + (funcionarios.length
      ? ` (${Object.entries(FUNCOES).map(([k, fn]) => [quantosDaFuncao(k), fn.nome.toLowerCase()]).filter(([n]) => n)
          .map(([n, nome]) => `${n} ${nome}${n === 1 ? '' : 's'}`).join(', ')})` : '');
  const b = fin.balanco;
  // Receita por visitante: quanto cada cliente rende, em média. Comparada com o custo fixo do mês
  // (manutenção + juros), mostra quantos visitantes são precisos para não ter prejuízo.
  const porVisitante = (receita, visitantes) => visitantes ? moeda(receita / visitantes) : '–';
  const resultado = b ? b.receita - b.manut - b.juros - (b.salarios || 0) - (b.investimentos || 0) : 0;
  $('balanco').innerHTML =
    `${nomeDoMes(fin.mes)} (em andamento, dia ${diaDoMes(fin.tMes)}/${DIAS_POR_MES}): receita ${moeda(fin.receitaMes)} · ` +
    `investimentos ${moeda(fin.investimentosMes)} · ${fin.visitantesMes} visitantes · ` +
    `${porVisitante(fin.receitaMes, fin.visitantesMes)} por visitante<br>` + (b
    ? `${nomeDoMes(b.mes)}: receita ${moeda(b.receita)} − manutenção ${moeda(b.manut)} − juros ${moeda(b.juros)}` +
      (b.salarios ? ` − salários ${moeda(b.salarios)}` : '') +
      ` − investimentos ${moeda(b.investimentos || 0)} = <b class='${resultado < 0 ? 'resultado-negativo' : ''}'>${moeda(resultado)}</b><br>` +
      (b.visitantes != null ? `${b.visitantes} visitantes · ${porVisitante(b.receita, b.visitantes)} por visitante` : '') +
      (b.entradas ? ` · entradas ${moeda(b.entradas)}` : '') +
      (b.recusas ? ` · ${b.recusas} acharam a entrada cara` : '') +
      (b.quebras ? ` · ${b.quebras} quebra${b.quebras === 1 ? '' : 's'} de brinquedo` : '')
    : 'Nenhum mês fechado ainda.');
}

function dadosCustosManutencao() {
  const dados = { funcionarios: [], brinquedos: [], lojas: [], outros: [] };
  for (const f of funcionarios) {
    const mesContratacao = Number.isInteger(f.mesContratacao) && f.mesContratacao > 0
      ? Math.min(fin.mes, f.mesContratacao) : fin.mes;
    dados.funcionarios.push({
      nome: f.nome,
      funcao: (FUNCOES[f.funcao] || FUNCOES.faxineiro).nome,
      salario: (FUNCOES[f.funcao] || FUNCOES.faxineiro).salario,
      meses: Math.max(0, fin.mes - mesContratacao),
      limpezas: f.limpezas || 0,
      consertos: f.consertos || 0,
    });
  }
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) {
      const chave = objetos[gy][gx];
      if (typeof chave !== 'string') continue;
      const obj = OBJETOS[chave], chavePos = chaveAtr(gx, gy);
      const item = {
        chave, nome: obj.nome, icone: obj.icone || '📦', gx, gy,
        manutencao: (ECONOMIA[chave] || {}).manutencao || 0,
        gestao: gestao.get(chavePos),
        atracao: atracoes.get(chavePos),
      };
      if (obj.categoria === 'atracoes') dados.brinquedos.push(item);
      else if (Object.values(obj.servicos || {}).some(s => s.atividade === 'comer' || s.atividade === 'beber'))
        dados.lojas.push(item);
      else if (item.manutencao > 0) dados.outros.push(item);
    }
  return dados;
}

function desenharTabelaCustos(id, colunas, linhas, mensagemVazia) {
  const painel = $(id);
  painel.textContent = '';
  if (!linhas.length) {
    const vazio = document.createElement('div');
    vazio.className = 'dica custos-vazio';
    vazio.textContent = mensagemVazia;
    painel.appendChild(vazio);
    return;
  }
  const envolver = document.createElement('div');
  envolver.className = 'custos-tabela-wrap';
  const tabela = document.createElement('table');
  tabela.className = 'custos-tabela';
  const cabecalho = document.createElement('thead');
  const trCabecalho = document.createElement('tr');
  for (const coluna of colunas) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = coluna.nome;
    if (coluna.numero) th.className = 'numero';
    trCabecalho.appendChild(th);
  }
  cabecalho.appendChild(trCabecalho);
  tabela.appendChild(cabecalho);
  const corpo = document.createElement('tbody');
  for (const linha of linhas) {
    const tr = document.createElement('tr');
    linha.forEach((valor, i) => {
      const td = document.createElement('td');
      td.textContent = String(valor);
      if (colunas[i].numero) td.className = 'numero';
      tr.appendChild(td);
    });
    corpo.appendChild(tr);
  }
  tabela.appendChild(corpo);
  envolver.appendChild(tabela);
  painel.appendChild(envolver);
}

function renderizarAbaCustos(dados) {
  if (abaCustosAtiva === 'funcionarios') {
    desenharTabelaCustos('custosFuncionarios',
      [{ nome: 'Funcionário' }, { nome: 'Função' }, { nome: 'Salário/mês', numero: true },
       { nome: 'Tempo de serviço' }, { nome: 'Limpezas', numero: true }, { nome: 'Consertos', numero: true }],
      dados.funcionarios.map(f => [f.nome, f.funcao, moeda(f.salario),
        `${f.meses} ${f.meses === 1 ? 'mês' : 'meses'}`, f.limpezas, f.consertos]),
      'Nenhum funcionário contratado.');
    return;
  }
  if (abaCustosAtiva === 'brinquedos') {
    desenharTabelaCustos('custosBrinquedos',
      [{ nome: 'Brinquedo' }, { nome: 'Local' }, { nome: 'Manutenção/mês', numero: true },
       { nome: 'Estado' }, { nome: 'Desgaste' }, { nome: 'Corridas', numero: true }, { nome: 'Consertos', numero: true }],
      dados.brinquedos.map(item => {
        const a = item.atracao;
        const estado = !a ? '—' : emConserto(a) ? 'Em conserto' : a.quebrada ? 'Quebrado' : 'Funcionando';
        const desgaste = a && Number.isFinite(a.desgaste) ? `${a.desgaste.toFixed(1).replace('.', ',')}%` : '—';
        return [`${item.icone} ${item.nome}`, `${item.gx}, ${item.gy}`, moeda(item.manutencao),
          estado, desgaste, a ? a.corridas : 0, a ? a.consertos : 0];
      }),
      'Nenhum brinquedo construído.');
    return;
  }
  if (abaCustosAtiva === 'lojas') {
    desenharTabelaCustos('custosLojas',
      [{ nome: 'Loja' }, { nome: 'Local' }, { nome: 'Manutenção/mês', numero: true },
       { nome: 'Usos totais', numero: true }, { nome: 'Receita total', numero: true }, { nome: 'Preços atuais' }],
      dados.lojas.map(item => {
        const precos = item.gestao ? Object.entries(item.gestao.precos)
          .filter(([servico]) => OBJETOS[item.chave].servicos[servico])
          .map(([servico, valor]) => {
            const def = OBJETOS[item.chave].servicos[servico];
            return `${def.nome || NOMES_SERVICO[servico] || servico}: ${moeda(valor)}`;
          }).join(' · ') : '—';
        return [`${item.icone} ${item.nome}`, `${item.gx}, ${item.gy}`, moeda(item.manutencao),
          item.gestao ? item.gestao.usos : 0, moeda(item.gestao ? item.gestao.receita : 0), precos];
      }),
      'Nenhuma loja construída.');
    return;
  }
  desenharTabelaCustos('custosOutros',
    [{ nome: 'Item' }, { nome: 'Local' }, { nome: 'Manutenção/mês', numero: true }],
    dados.outros.map(item => [`${item.icone} ${item.nome}`, `${item.gx}, ${item.gy}`, moeda(item.manutencao)]),
    'Nenhum outro item com custo de manutenção.');
}

function atualizarResumoCustos(dados) {
  const resumo = $('custosResumo');
  resumo.textContent = '';
  const itens = [
    { nome: `Funcionários (${dados.funcionarios.length})`, detalhe: 'Salários/mês', valor: salariosMensais() },
    { nome: `Brinquedos (${dados.brinquedos.length})`, detalhe: 'Manutenção/mês', valor: dados.brinquedos.reduce((s, i) => s + i.manutencao, 0) },
    { nome: `Lojas (${dados.lojas.length})`, detalhe: 'Manutenção/mês', valor: dados.lojas.reduce((s, i) => s + i.manutencao, 0) },
    { nome: `Outros itens (${dados.outros.length})`, detalhe: 'Manutenção/mês', valor: dados.outros.reduce((s, i) => s + i.manutencao, 0) },
    { nome: 'Total mensal', detalhe: 'Salários + manutenção', valor: salariosMensais() + custoManutencaoMensal(), total: true },
  ];
  const grade = document.createElement('div');
  grade.className = 'custos-resumo';
  for (const item of itens) {
    const cartao = document.createElement('div');
    cartao.className = `custos-resumo-item${item.total ? ' total' : ''}`;
    const nome = document.createElement('span');
    nome.textContent = item.nome;
    const detalhe = document.createElement('span');
    detalhe.textContent = item.detalhe;
    const valor = document.createElement('b');
    valor.textContent = moeda(item.valor);
    cartao.append(nome, detalhe, valor);
    grade.appendChild(cartao);
  }
  resumo.appendChild(grade);
}

function atualizarCustosManutencaoUI(forcar = false) {
  if (!$('modalCustosManutencao').classList.contains('aberto')) return;
  if (!forcar && tempoReal < proximaAtualizacaoCustos) return;
  proximaAtualizacaoCustos = tempoReal + 1;
  const dados = dadosCustosManutencao();
  renderizarAbaCustos(dados);
  atualizarResumoCustos(dados);
}

// Janela "Parque": estatísticas do portão no mês em andamento (atualizadas a cada quadro, só com ela aberta)
function atualizarParqueUI() {
  document.title = nomeDoParque();
  if (!$('modalParque').classList.contains('aberto')) return;
  const tentaram = fin.visitantesMes + fin.recusasMes;
  $('parqueInfo').innerHTML =
    `<b>${nomeDoMes(fin.mes)}</b> (até agora):<br>` +
    `Entraram: ${fin.visitantesMes} · Desistiram no portão: ${fin.recusasMes}` +
    (tentaram ? ` (${Math.round(fin.recusasMes / tentaram * 100)}%)` : '') + '<br>' +
    `Receita das entradas: ${moeda(fin.entradasMes)}`;
  $('parqueDica').textContent = `Cobrado na chegada. Com a avaliação atual, cada convidado só entra se a entrada ` +
    `custar até ${Math.round(fracaoMaxEntrada() * 100)}% do dinheiro que trouxe; o que pagar no portão não gasta lá dentro.`;
  atualizarNotaUI();
  atualizarQueixasUI();
  const l = resumoLimpeza();
  $('parqueLimpeza').innerHTML =
    `No chão: <b>${l.lixo}</b> lixo${l.lixo === 1 ? '' : 's'} · <b>${l.vomito}</b> vômito${l.vomito === 1 ? '' : 's'}<br>` +
    `Lixeiras: ${l.lixeiras}${l.cheias ? ` (<b>${l.cheias}</b> para esvaziar)` : ''}<br>` +
    `Faxineiros: ${l.faxineiros} · recolheram ${l.recolheuMes} itens neste mês` +
    (l.faxineiros ? '' : `<div class='dica'>Contrate na aba 👷 Funcionários da barra de construção.</div>`);
  const m = resumoManutencao();
  $('parqueManutencao').innerHTML =
    (m.quebradas.length ? `Quebrados agora: <b>${m.quebradas.join(', ')}</b><br>` : 'Todos os brinquedos funcionando 🙂<br>') +
    `Quebras neste mês: ${m.quebrasMes} · Mecânicos: ${m.mecanicos} · consertos neste mês: ${m.consertosMes}` +
    `<div class='dica'>Brinquedos quebram mais com a idade e o uso. Quebrado, prende quem está a bordo e não conta na ` +
    `variedade da avaliação. ${m.mecanicos ? '' : 'Contrate um mecânico na aba 👷 Funcionários.'}</div>`;
  const lot = resumoLotacao();
  $('parqueLotacao').innerHTML = lot.apertados
    ? `<b>${lot.apertados}</b> convidado${lot.apertados === 1 ? '' : 's'} no aperto agora · ${lot.tiles} tile${lot.tiles === 1 ? '' : 's'} lotado${lot.tiles === 1 ? '' : 's'} (em vermelho no mapa)`
    : 'Ninguém no aperto agora 🙂';
  $('parqueLotacao').innerHTML += `<div class='dica'>Mais de ${String(LOTACAO.limite).replace('.', ',')} convidado por tile de ` +
    `caminho (contando os vizinhos) é aperto: andam devagar e perdem felicidade. Caminhos mais largos e rotas ` +
    `alternativas espalham a multidão.</div>`;
}

// Cor da nota: de vermelho (0) a verde (máxima), como as barras do convidado
const corDaNota = nota => `hsl(${Math.round(120 * nota / NOTA_MAX)} 65% 45%)`;

// Nota, barra e as partes que a compõem (de onde vêm os pontos e onde se perde)
function atualizarNotaUI() {
  const nota = Math.round(avaliacao.nota);
  const linhas = partesDaAvaliacao()
    .filter(p => p.max || p.pontos < 0)   // penalidade zerada não aparece
    .map(p => `<div class='nota-parte${p.pontos < 0 ? ' negativa' : ''}'><span>${p.icone} ${p.nome}</span>` +
              `<span>${Math.round(p.pontos)}${p.max ? ' / ' + p.max : ''}</span></div>`).join('');
  $('parqueNota').innerHTML =
    `<div class='nota-topo'><span class='nota-valor'>${nota}</span><span class='dica'>de ${NOTA_MAX}</span></div>` +
    `<div class='nota-barra'><i style='width:${nota / NOTA_MAX * 100}%;background:${corDaNota(nota)}'></i></div>` + linhas +
    `<div class='dica'>Efeitos: chegadas ` +
    `${escalaChegada() < 1 ? 'mais rápidas' : escalaChegada() > 1 ? 'mais lentas' : 'no ritmo normal'} ` +
    `(${(1 / escalaChegada()).toFixed(1).replace('.', ',')}×).</div>`;
}

// Queixas do mês em andamento e do último mês fechado, da mais comum para a menos comum
function atualizarQueixasUI() {
  const lista = queixas => {
    const q = queixasOrdenadas(queixas).slice(0, 5);
    return q.length ? q.map(([t, n]) => `${PENSAMENTOS[t].icone} ${PENSAMENTOS[t].texto}: <b>${n}</b>`).join('<br>') : 'Nenhuma 🙂';
  };
  const b = fin.balanco;
  $('parqueQueixas').innerHTML = `<b>${nomeDoMes(fin.mes)}</b> (até agora):<br>${lista(fin.queixasMes)}` +
    (b ? `<div class='dica'>${nomeDoMes(b.mes)}: ${queixasOrdenadas(b.queixas).slice(0, 3)
      .map(([t, n]) => `${PENSAMENTOS[t].icone} ${n}`).join(' · ') || 'nenhuma queixa'}` +
      (b.nota != null ? ` · avaliação no fechamento: ${b.nota}` : '') + '</div>' : '');
}

// Liga os campos da janela "Parque" (chamada uma vez, em iniciarUI)
function iniciarParqueUI() {
  const nome = $('inNomeParque'), preco = $('inPrecoEntrada');
  nome.maxLength = NOME_PARQUE_MAX;
  $('btnParque').addEventListener('click', () => {
    // Preenchidos só ao abrir, para o loop não sobrescrever o que está sendo digitado
    nome.value = parque.nome;
    preco.value = parque.precoEntrada;
    $('modalParque').classList.add('aberto');
  });
  $('btnFecharParque').addEventListener('click', () => $('modalParque').classList.remove('aberto'));
  // O nome é texto do usuário: só aparece na tela via textContent / document.title (nunca innerHTML)
  nome.addEventListener('input', () => { parque.nome = nome.value.slice(0, NOME_PARQUE_MAX); });
  preco.addEventListener('input', () => {
    const v = parseFloat(preco.value);
    if (!isNaN(v)) parque.precoEntrada = Math.max(0, arred(v));
  });
}

// ---------- Velocidade do jogo ----------
function definirVelocidade(v) {
  if (v > 0) velocidadeAntes = v;
  velocidade = v;
}
function alternarPausa() { definirVelocidade(velocidade ? 0 : velocidadeAntes); }

// Botões da barra superior (um por velocidade de VELOCIDADES) e teclas (chamada uma vez, em main.js)
function iniciarVelocidades() {
  const grupo = $('velocidades');
  VELOCIDADES.forEach((v, i) => {
    const b = el('button', 'btn btn-vel', v ? `${v}×` : '⏸');
    b.dataset.v = v;
    b.title = v ? `Velocidade ${v}× (tecla ${i})` : 'Pausa (Espaço)';
    b.addEventListener('click', () => (v ? definirVelocidade(v) : alternarPausa()));
    grupo.appendChild(b);
  });
  window.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;   // digitando
    if (e.key === ' ') { e.preventDefault(); alternarPausa(); }   // sem preventDefault, Espaço "clicaria" o botão focado
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n < VELOCIDADES.length) definirVelocidade(VELOCIDADES[n]);
  });
}

// Monta os painéis e liga os botões da tela de finanças (chamada uma vez, em main.js)
function iniciarUI() {
  painel.innerHTML = `<div class='painel-topo'><span>🙂 Convidado</span><button class='fechar' title='Fechar (Esc)'>✕</button></div>` +
    CAMPOS.map(([c, nome]) =>
    `<div class="linha"><span>${nome}</span><div class="barra"><i id="b-${c}"></i></div></div>`).join('') +
    '<div id="dinheiro"></div><div id="estado"></div>';
  painel.querySelector('.fechar').addEventListener('click', () => { selecionado = null; });
  // Esc: fecha a janela aberta; sem janela, fecha os painéis de seleção
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const abertas = document.querySelectorAll('.modal.aberto:not(.fixa)');   // tela inicial e fim só fecham pelos botões
    if (abertas.length) abertas.forEach(m => m.classList.remove('aberto'));
    else if (!document.querySelector('.modal.fixa.aberto')) { selecionado = null; selObj = null; selFunc = null; }
  });
  iniciarParqueUI();
  $('btnPegar').textContent = 'Pegar ' + moeda(PARCELA);
  $('btnPagar').textContent = 'Pagar ' + moeda(PARCELA);
  $('btnPegar').addEventListener('click', pegarEmprestimo);
  $('btnPagar').addEventListener('click', pagarEmprestimo);
  $('btnFechar').addEventListener('click', () => $('modalFin').classList.remove('aberto'));
  $('btnCustosDetalhados').addEventListener('click', () => {
    $('modalCustosManutencao').classList.add('aberto');
    atualizarCustosManutencaoUI(true);
  });
  $('btnFecharCustos').addEventListener('click', () => $('modalCustosManutencao').classList.remove('aberto'));
  document.querySelectorAll('[data-aba-custos]').forEach(botao => botao.addEventListener('click', () => {
    abaCustosAtiva = botao.dataset.abaCustos;
    document.querySelectorAll('[data-aba-custos]').forEach(aba => {
      const ativa = aba === botao;
      aba.classList.toggle('ativa', ativa);
      aba.setAttribute('aria-selected', ativa);
    });
    document.querySelectorAll('[data-painel-custos]').forEach(painel => {
      painel.hidden = painel.dataset.painelCustos !== abaCustosAtiva;
    });
    atualizarCustosManutencaoUI(true);
  }));
  $('btnFin').addEventListener('click', () => {
    $('inJuros').value = +(fin.juros * 100).toFixed(2);   // preenchido só ao abrir, para não atrapalhar a digitação
    $('modalFin').classList.add('aberto');
  });
  $('inJuros').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) fin.juros = Math.max(0, v) / 100;
  });
}
