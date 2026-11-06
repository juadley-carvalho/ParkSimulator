/* ============================================================
   ui.js — painéis, tela de finanças e barra de ferramentas
   Depende de: dom.js, estado.js, financas.js, objetos.js
   ============================================================ */

// Painel com as barras de necessidades do convidado selecionado
const CAMPOS = [['fome', 'Fome', true], ['sede', 'Sede', true], ['banheiro', 'Banheiro', true],
                ['nausea', 'Náusea', true], ['energia', 'Energia', false], ['felicidade', 'Felicidade', false]];

const NOMES_SERVICO = { comida: 'Comida', bebida: 'Bebida', descanso: 'Descanso', banheiro: 'Banheiro', diversao: 'Ingresso' };

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
    g.estado === 'usando' ? `Usando ${ICONES[g.uso.servico]} (${Math.ceil(g.uso.resta)}s)` :
    g.objetivo ? `Indo: ${ICONES[g.objetivo]}` : 'Passeando';
  document.getElementById('dinheiro').textContent = `Dinheiro: ${moeda(g.dinheiro)}`;
  if (g.estado === 'esperando')
    document.getElementById('estado').textContent =
      `Na fila ${ICONES[g.uso.servico]} (paciência: ${Math.max(0, Math.ceil(g.paciencia - g.uso.espera))}s)`;
  if (g.estado === 'brincando') document.getElementById('estado').textContent = 'No brinquedo 🎠';
}

function selecionar(gx, gy) {
  const o = objetoEm(gx, gy);   // objeto com preços tem prioridade sobre convidados próximos
  if (o && gestao.has(chaveAtr(o.gx, o.gy))) { selecionarObjeto(chaveAtr(o.gx, o.gy)); return; }
  let melhor = null, d = 1;
  for (const g of convidados) {
    const dist = Math.hypot(g.x - (gx + 0.5), g.y - (gy + 0.5));
    if (dist < d) { d = dist; melhor = g; }
  }
  if (melhor) { selecionado = melhor; selObj = null; }
}

function selecionarObjeto(k) {
  selObj = k; selecionado = null;
  const [gx, gy] = k.split(',').map(Number);
  const chave = objetos[gy][gx], d = gestao.get(k);
  painelObj.innerHTML = `<b>${OBJETOS[chave].nome}</b>` +
    Object.keys(OBJETOS[chave].servicos).map(s =>
      `<div class='linha'><span>${NOMES_SERVICO[s] || s}</span>$ <input type='number' min='0' step='0.5' data-s='${s}' value='${d.precos[s] || 0}'></div>`).join('') +
    `<div id='oStats' style='margin-top:6px;font-size:13px;line-height:1.5'></div>`;
  // Os campos só são criados aqui; o loop atualiza apenas o texto das estatísticas
  painelObj.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
    d.precos[inp.dataset.s] = Math.max(0, arred(parseFloat(inp.value) || 0));
  }));
}

function atualizarPainelObj() {
  if (selObj && !gestao.has(selObj)) selObj = null;   // foi demolido
  painelObj.style.display = selObj ? 'block' : 'none';
  if (!selObj) return;
  const d = gestao.get(selObj), atr = atracoes.get(selObj);
  const [gx, gy] = selObj.split(',').map(Number);
  const manut = (ECONOMIA[objetos[gy][gx]] || {}).manutencao || 0;
  $('oStats').innerHTML = `Receita total: ${moeda(d.receita)}<br>Usos: ${d.usos}<br>Manutenção: ${moeda(manut)}/mês` +
    (atr ? `<br>Fila: ${atr.fila.length}/${FILA_MAX} · A bordo: ${atr.passageiros.length}` : '');
}

function atualizarFinancasUI() {
  $('finTxt').textContent = `💰 ${moeda(fin.caixa)} · 🏦 Dívida ${moeda(fin.divida)} · Mês ${fin.mes}`;
  $('finTxt').style.color = fin.caixa < 0 ? '#e53935' : '';
  $('finAviso').textContent = tempo - fin.tAviso < 2.5 ? fin.aviso : '';
  if (!$('modalFin').classList.contains('aberto')) return;
  $('empInfo').innerHTML =
    `Caixa: <b>${moeda(fin.caixa)}</b><br>Dívida: <b>${moeda(fin.divida)}</b> (limite ${moeda(LIMITE_EMPRESTIMO)})<br>` +
    `Disponível para pegar: ${moeda(LIMITE_EMPRESTIMO - fin.divida)}<br>` +
    `Juros no próximo fechamento: ${moeda(fin.divida * fin.juros)}<br>` +
    `Manutenção mensal: ${moeda(custoManutencaoMensal())}`;
  const b = fin.balanco;
  $('balanco').innerHTML = `Receita do mês em andamento: ${moeda(fin.receitaMes)}<br>` + (b
    ? `Mês ${b.mes}: receita ${moeda(b.receita)} − manutenção ${moeda(b.manut)} − juros ${moeda(b.juros)} = <b>${moeda(b.receita - b.manut - b.juros)}</b>`
    : 'Nenhum mês fechado ainda.');
}

function atualizarBarra() {
  for (const b of barra.querySelectorAll('button'))
    b.classList.toggle('ativo', b.dataset.id === ferramenta.camada + ':' + ferramenta.chave);
}

function addBotao(nome, cor, camada, chave) {
  const b = document.createElement('button');
  b.textContent = nome;
  b.dataset.id = camada + ':' + chave;
  b.style.setProperty('--c', cor);
  b.addEventListener('click', () => { ferramenta = { camada, chave }; atualizarBarra(); });
  barra.appendChild(b);
}

function addSeparador() { const s = document.createElement('div'); s.className = 'sep'; barra.appendChild(s); }

// Ações: botões que executam algo na hora, em vez de selecionar uma ferramenta
function addAcao(nome, cor, fn) {
  const b = document.createElement('button');
  b.textContent = nome;
  b.style.setProperty('--c', cor);
  b.addEventListener('click', fn);
  barra.appendChild(b);
}

// Monta os painéis e liga os botões da tela de finanças (chamada uma vez, em main.js)
function iniciarUI() {
  painel.innerHTML = CAMPOS.map(([c, nome]) =>
    `<div class="linha"><span>${nome}</span><div class="barra"><i id="b-${c}"></i></div></div>`).join('') +
    '<div id="dinheiro" style="margin-top:6px"></div><div id="estado"></div>';
  $('btnPegar').textContent = 'Pegar ' + moeda(PARCELA);
  $('btnPagar').textContent = 'Pagar ' + moeda(PARCELA);
  $('btnPegar').addEventListener('click', pegarEmprestimo);
  $('btnPagar').addEventListener('click', pagarEmprestimo);
  $('btnFechar').addEventListener('click', () => $('modalFin').classList.remove('aberto'));
  $('btnFin').addEventListener('click', () => {
    $('inJuros').value = +(fin.juros * 100).toFixed(2);   // preenchido só ao abrir, para não atrapalhar a digitação
    $('modalFin').classList.add('aberto');
  });
  $('inJuros').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) fin.juros = Math.max(0, v) / 100;
  });
}

// Gera a barra de ferramentas a partir dos catálogos TIPOS e OBJETOS
function montarBarra() {
  for (const [k, t] of Object.entries(TIPOS)) addBotao(t.nome + (CUSTO_TERRENO[k] ? ' $' + CUSTO_TERRENO[k] : ''), t.cor[0], 'terreno', k);
  addSeparador();
  for (const [k, o] of Object.entries(OBJETOS)) addBotao(o.nome + (custoDe(k) ? ' $' + custoDe(k) : ''), o.cor, 'objeto', k);
  addSeparador();
  addBotao('Demolir', '#e53935', 'remover', 'X');
  addBotao('Inspecionar', '#ffe14d', 'inspecionar', 'X');
  addSeparador();
  addAcao('+5 convidados', '#7e57c2', () => semear(5, [ENTRADA.gx, ENTRADA.gy]));
  addAcao('Limpar', '#9e9e9e', () => {
    convidados.length = 0; selecionado = null;
    for (const a of atracoes.values()) { a.fila.length = 0; a.passageiros.length = 0; a.fase = 'carregando'; a.tCarga = 0; }
  });
  atualizarBarra();
}
