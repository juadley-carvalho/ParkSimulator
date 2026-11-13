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
  painelObj.innerHTML = `<div class='painel-topo'><span>${OBJETOS[chave].icone} ${OBJETOS[chave].nome}</span>` +
    `<button class='fechar' title='Fechar (Esc)'>✕</button></div>` +
    Object.entries(OBJETOS[chave].servicos).map(([s, def]) =>
      `<div class='linha'><span>${def.nome || NOMES_SERVICO[s] || s}</span>$ <input type='number' min='0' step='0.1' data-s='${s}' value='${d.precos[s] || 0}'></div>`).join('') +
    `<div id='oStats'></div>`;
  painelObj.querySelector('.fechar').addEventListener('click', () => { selObj = null; });
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
  const brinquedo = Object.values(OBJETOS[objetos[gy][gx]].servicos).find(s => s.intensidade);
  $('oStats').innerHTML = `Receita total: ${moeda(d.receita)}<br>Usos: ${d.usos}<br>Manutenção: ${moeda(manut)}/mês` +
    (brinquedo ? `<br>Intensidade: ${brinquedo.intensidade}/10` : '') +
    (atr ? `<br>Fila: ${atr.fila.length}/${FILA_MAX} · A bordo: ${atr.passageiros.length}` +
           `<br>Espera estimada: ${Math.ceil(esperaEstimada(atr))}s` : '');
}

function atualizarFinancasUI() {
  $('finTxt').textContent = `🎡 ${nomeDoParque()} · 📅 Dia ${diaDoMes(fin.tMes)} de ${nomeDoMes(fin.mes)} · ` +
                            `⭐ ${Math.round(avaliacao.nota)} · 💰 ${moeda(fin.caixa)} · 🏦 Dívida ${moeda(fin.divida)}`;
  $('finTxt').style.color = fin.caixa < 0 ? '#e53935' : '';
  $('finAviso').textContent = tempo - fin.tAviso < 2.5 ? fin.aviso : '';
  if (!$('modalFin').classList.contains('aberto')) return;
  $('empInfo').innerHTML =
    `Caixa: <b>${moeda(fin.caixa)}</b><br>Dívida: <b>${moeda(fin.divida)}</b> (limite ${moeda(LIMITE_EMPRESTIMO)})<br>` +
    `Disponível para pegar: ${moeda(LIMITE_EMPRESTIMO - fin.divida)}<br>` +
    `Juros no próximo fechamento: ${moeda(fin.divida * fin.juros)}<br>` +
    `Manutenção mensal: ${moeda(custoManutencaoMensal())}`;
  const b = fin.balanco;
  // Receita por visitante: quanto cada cliente rende, em média. Comparada com o custo fixo do mês
  // (manutenção + juros), mostra quantos visitantes são precisos para não ter prejuízo.
  const porVisitante = (receita, visitantes) => visitantes ? moeda(receita / visitantes) : '–';
  $('balanco').innerHTML =
    `${nomeDoMes(fin.mes)} (em andamento, dia ${diaDoMes(fin.tMes)}/${DIAS_POR_MES}): receita ${moeda(fin.receitaMes)} · ` +
    `${fin.visitantesMes} visitantes · ${porVisitante(fin.receitaMes, fin.visitantesMes)} por visitante<br>` + (b
    ? `${nomeDoMes(b.mes)}: receita ${moeda(b.receita)} − manutenção ${moeda(b.manut)} − juros ${moeda(b.juros)} = ` +
      `<b>${moeda(b.receita - b.manut - b.juros)}</b><br>` +
      (b.visitantes != null ? `${b.visitantes} visitantes · ${porVisitante(b.receita, b.visitantes)} por visitante` : '') +
      (b.entradas ? ` · entradas ${moeda(b.entradas)}` : '') +
      (b.recusas ? ` · ${b.recusas} acharam a entrada cara` : '')
    : 'Nenhum mês fechado ainda.');
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
    `<div class='dica'>Efeitos: até ${maxConvidados()} convidados ao mesmo tempo · chegadas ` +
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
    const abertas = document.querySelectorAll('.modal.aberto');
    if (abertas.length) abertas.forEach(m => m.classList.remove('aberto'));
    else { selecionado = null; selObj = null; }
  });
  iniciarParqueUI();
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
