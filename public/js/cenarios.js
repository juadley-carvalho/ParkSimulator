/* ============================================================
   cenarios.js — tela inicial, cenários com objetivo, vitória e derrota
   Depende de: config.js, utils.js, estado.js, objetos.js, financas.js, avaliacao.js, barra.js
   (chama em tempo de execução centralizar e montarMapaInicial, de input.js e main.js)
   ============================================================ */

// Letras do terreno nos arquivos de cenário: o mapa é uma lista de MAPA textos de MAPA letras
const LETRAS_TERRENO = { '.': 'GRAMA', '#': 'CAMINHO', '~': 'AGUA' };

// Tipos de objetivo. Cada um sabe medir o valor atual, dizer se cumpriu e se descrever.
// "imediato": vence no instante em que cumpre. Os outros contam nos fechamentos de mês e exigem
// o.meses fechamentos SEGUIDOS (a nota do 1º mês é alta demais: ainda não houve penalidades).
// texto e progresso recebem o objetivo inteiro (o = { tipo, valor, prazo, meses }).
const TIPOS_OBJETIVO = {
  convidados: { imediato: true, atual: () => convidados.length, cumpriu: (v, o) => v >= o.valor,
    texto: o => `Ter ${o.valor} convidados no parque ao mesmo tempo`,
    progresso: (v, o) => `${v}/${o.valor} convidados` },
  nota: { imediato: false, atual: () => Math.round(avaliacao.nota), cumpriu: (v, o) => v >= o.valor,
    texto: o => `Fechar ${o.meses > 1 ? o.meses + ' meses seguidos' : 'um mês'} com avaliação de pelo menos ${o.valor}`,
    progresso: (v, o) => `avaliação ${v}/${o.valor}` + (o.meses > 1 ? ` · ${partida.sequencia}/${o.meses} meses` : '') },
  visitantes: { imediato: true, atual: () => partida.visitantes, cumpriu: (v, o) => v >= o.valor,
    texto: o => `Receber ${o.valor} visitantes`,
    progresso: (v, o) => `${v}/${o.valor} visitantes` },
  divida: { imediato: true, atual: () => fin.divida, cumpriu: v => v <= 0,
    texto: () => 'Pagar toda a dívida do empréstimo',
    progresso: v => `faltam ${moeda(v)}` },
  lucro: { imediato: true, atual: () => arred(patrimonio() - partida.inicio), cumpriu: (v, o) => v >= o.valor,
    texto: o => `Aumentar o patrimônio (caixa − dívida + objetos) em ${moeda(o.valor)}`,
    progresso: (v, o) => `lucro ${moeda(v)} de ${moeda(o.valor)}` },
};

// Definições já baixadas (id -> conteúdo do JSON): cada arquivo é buscado uma vez só
const DEFS_CENARIOS = new Map();
let jogoEmAndamento = false;   // a tela inicial mostra "Continuar" só depois do primeiro jogo

// ---------- Carregar e validar ----------
async function buscarCenario(id) {
  if (!DEFS_CENARIOS.has(id)) {
    const resposta = await fetch(`cenarios/${id}.json`);
    if (!resposta.ok) throw new Error(`cenário "${id}" não encontrado`);
    DEFS_CENARIOS.set(id, validarCenario(await resposta.json()));
  }
  return DEFS_CENARIOS.get(id);
}

// Confere o arquivo ANTES de mexer no jogo (como aplicarJogo faz com os saves) e devolve uma
// versão limpa. Um erro aqui vira mensagem na tela inicial, não um parque pela metade.
function validarCenario(c) {
  const erro = msg => { throw new Error('Cenário inválido: ' + msg); };
  if (!c || typeof c !== 'object') erro('não é um objeto');
  if (typeof c.nome !== 'string' || !c.nome) erro('sem nome');
  if (!Array.isArray(c.mapa) || c.mapa.length !== MAPA || !c.mapa.every(l => typeof l === 'string' && l.length === MAPA))
    erro(`o mapa precisa de ${MAPA} linhas de ${MAPA} letras`);
  const o = c.objetivo || {};
  if (!TIPOS_OBJETIVO[o.tipo]) erro('tipo de objetivo desconhecido: ' + o.tipo);
  if (!Number.isFinite(o.valor) || !Number.isInteger(o.prazo) || o.prazo < 1) erro('objetivo sem valor ou prazo');
  const meses = Number.isInteger(o.meses) && o.meses > 1 ? Math.min(o.meses, o.prazo) : 1;
  return {
    nome: c.nome.slice(0, 40), descricao: String(c.descricao || ''), icone: String(c.icone || '🎯'),
    nomeParque: typeof c.nomeParque === 'string' ? c.nomeParque.slice(0, NOME_PARQUE_MAX) : NOME_PARQUE_PADRAO,
    caixa: Number.isFinite(c.caixa) ? c.caixa : SALDO_INICIAL,
    divida: Number.isFinite(c.divida) ? Math.max(0, Math.min(LIMITE_EMPRESTIMO, c.divida)) : DIVIDA_INICIAL,
    juros: Number.isFinite(c.juros) && c.juros >= 0 && c.juros <= 1 ? c.juros : JUROS_MENSAL,
    objetivo: { tipo: o.tipo, valor: o.valor, prazo: o.prazo, meses },
    // [...linha] separa o texto em letras: "#.~" -> ['#', '.', '~']; letra desconhecida vira grama
    mapa: c.mapa.map(l => [...l].map(letra => LETRAS_TERRENO[letra] || 'GRAMA')),
    objetos: (Array.isArray(c.objetos) ? c.objetos : []).filter(x => x && OBJETOS[x.chave] && Number.isInteger(x.gx) && Number.isInteger(x.gy)),
    liberados: Array.isArray(c.liberados) ? c.liberados.filter(k => OBJETOS[k]) : null,
    precosTravados: !!c.precosTravados,
  };
}

// ---------- Começar uma partida ----------
// Deixa tudo como num jogo novo e vazio (mapa, objetos, convidados, finanças, ferramenta)
function limparParque() {
  for (let gy = 0; gy < MAPA; gy++) { mapa[gy].fill('GRAMA'); objetos[gy].fill(null); }   // muta as linhas no lugar
  atracoes.clear(); gestao.clear(); rotacoes.clear(); convidados.length = 0;
  sujeira.clear(); lixeiras.clear(); funcionarios.length = 0; selFunc = null;
  Object.assign(fin, finInicial()); Object.assign(parque, parqueInicial()); Object.assign(partida, partidaInicial());
  tempo = 0; tChegada = 1; stats.sairam = 0; selecionado = null; selObj = null;
  ferramenta = { camada: 'terreno', chave: 'CAMINHO' }; rotacaoAtual = 0;   // a anterior pode estar bloqueada no cenário novo
}

// Terminou de montar: nota inicial, barra (pode ter outros objetos liberados), câmera e relógio
function comecarPartida() {
  iniciarAvaliacao();
  montarBarra();
  centralizar();
  jogoEmAndamento = true;
  fase = 'jogando';
}

function novoJogoLivre() {
  limparParque();
  montarMapaInicial();
  comecarPartida();
}

function iniciarCenario(id, def) {
  limparParque();
  def.mapa.forEach((linha, gy) => { mapa[gy] = [...linha]; });   // cópia: a definição guardada não muda
  mapa[ENTRADA.gy][ENTRADA.gx] = 'CAMINHO';                       // a entrada sempre existe
  for (const o of def.objetos) {
    const rot = rotacionavel(o.chave) ? ((o.rot || 0) % 4 + 4) % 4 : 0;
    if (podeConstruir(o.chave, o.gx, o.gy, rot)) construir(o.chave, o.gx, o.gy, rot);
    else console.warn(`Cenário ${id}: ${o.chave} não cabe em (${o.gx}, ${o.gy})`);
  }
  fin.caixa = def.caixa; fin.divida = def.divida; fin.juros = def.juros;
  parque.nome = def.nomeParque;
  Object.assign(partida, {
    modo: 'cenario', cenario: id, nome: def.nome, objetivo: { ...def.objetivo },
    liberados: def.liberados && [...def.liberados], precosTravados: def.precosTravados,
  });
  partida.inicio = patrimonio();   // depois de construir: os objetos prontos já fazem parte do início
  comecarPartida();
}

// ---------- Objetivo ----------
function tipoDoObjetivo() { return partida.objetivo && TIPOS_OBJETIVO[partida.objetivo.tipo]; }

function emDisputa() { return partida.modo === 'cenario' && !partida.concluido && fase === 'jogando' && !!tipoDoObjetivo(); }

// A cada quadro: objetivos "imediatos" vencem na hora
function atualizarPartida() {
  if (!emDisputa()) return;
  const t = tipoDoObjetivo();
  if (t.imediato && t.cumpriu(t.atual(), partida.objetivo)) vencer();
}

// No fechamento do mês (financas.js): conta a sequência de meses cumpridos (um mês ruim zera);
// vence ao completar o.meses seguidos; senão, no último mês do prazo, perde
function objetivoNoFechamento(mesFechado) {
  if (!emDisputa()) return;
  const t = tipoDoObjetivo(), o = partida.objetivo;
  partida.sequencia = t.cumpriu(t.atual(), o) ? partida.sequencia + 1 : 0;
  if (partida.sequencia >= (o.meses || 1)) vencer();
  else if (mesFechado >= o.prazo) perder();
}

function vencer() {
  partida.concluido = true;
  fase = 'vitoria';
  marcarConcluido(partida.cenario);
  mostrarFim(true);
}

function perder() {
  fase = 'derrota';
  jogoEmAndamento = false;   // não há como "continuar" um cenário perdido: só tentar de novo ou escolher outro
  mostrarFim(false);
}

// ---------- Progresso (localStorage) ----------
// O localStorage pode estar bloqueado (janela anônima, site sem permissão): sem ele, nada fica
// salvo, mas o jogo continua. Por isso todo acesso fica dentro de try/catch.
function lerConcluidos() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_PROGRESSO));
    return Array.isArray(v) ? v.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}

function marcarConcluido(id) {
  const ids = new Set(lerConcluidos()).add(id);   // Set: o mesmo cenário não entra duas vezes
  try { localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify([...ids])); } catch { /* sem localStorage */ }
}

// O 1º cenário está sempre aberto; os outros, quando o anterior foi vencido
function cenarioAberto(i, concluidos) { return i === 0 || concluidos.includes(CENARIOS[i - 1]); }

// ---------- Telas ----------
function textoDoObjetivo(obj) {
  return `${TIPOS_OBJETIVO[obj.tipo].texto(obj)} até o fim de ${nomeDoMes(obj.prazo)}`;
}

// Linha do objetivo no HUD (a cada quadro)
function atualizarObjetivoUI() {
  const el = $('objetivoHud');
  el.hidden = partida.modo !== 'cenario' || !tipoDoObjetivo();
  if (el.hidden) return;
  const t = tipoDoObjetivo(), o = partida.objetivo;
  el.textContent = partida.concluido ? `🏆 ${partida.nome}: objetivo cumprido!`
    : `🎯 ${partida.nome}: ${t.progresso(t.atual(), o)} · prazo: fim de ${nomeDoMes(o.prazo)}`;
}

function abrirInicio() {
  if (fase === 'jogando') fase = 'menu';   // pausa o parque atrás da tela
  $('btnContinuar').hidden = !jogoEmAndamento;
  $('modalInicio').classList.add('aberto');
  montarListaCenarios();
}

function fecharInicio() {
  $('modalInicio').classList.remove('aberto');
  if (fase === 'menu' && jogoEmAndamento) fase = 'jogando';
}

// Cartões dos cenários. Os arquivos são baixados todos juntos: Promise.all espera várias
// promessas ao mesmo tempo (em vez de uma depois da outra) e devolve os resultados na mesma ordem.
async function montarListaCenarios() {
  const lista = $('listaCenarios');
  lista.textContent = 'Carregando cenários...';
  const defs = await Promise.all(CENARIOS.map(id => buscarCenario(id).catch(e => e)));   // erro vira valor
  const concluidos = lerConcluidos();
  lista.replaceChildren(...defs.map((def, i) => cartaoCenario(CENARIOS[i], def, cenarioAberto(i, concluidos), concluidos.includes(CENARIOS[i]))));
}

function cartaoCenario(id, def, aberto, vencido) {
  const cartao = el('div', 'cenario-cartao' + (aberto ? '' : ' bloqueado'));
  if (def instanceof Error) { cartao.append(el('div', 'info', '⚠️ ' + def.message)); return cartao; }
  const info = el('div', 'info');
  info.append(el('b', '', `${def.icone} ${def.nome}${vencido ? ' ✅' : ''}`), el('small', '', def.descricao),
              el('small', 'objetivo', '🎯 ' + textoDoObjetivo(def.objetivo)));
  const jogar = el('button', 'btn btn-ok', aberto ? 'Jogar' : '🔒');
  jogar.disabled = !aberto;
  jogar.title = aberto ? '' : 'Vença o cenário anterior para liberar';
  jogar.addEventListener('click', () => {
    if (jogoEmAndamento && !confirm(`Começar "${def.nome}"? O parque atual (se não foi salvo) será perdido.`)) return;
    iniciarCenario(id, def);
    $('modalInicio').classList.remove('aberto');
  });
  cartao.append(info, jogar);
  return cartao;
}

// Janela de vitória ou derrota
function mostrarFim(venceu) {
  $('fimTitulo').textContent = venceu ? '🏆 Objetivo cumprido!' : '⌛ O prazo acabou';
  $('fimTexto').textContent = venceu
    ? `Parabéns! Você venceu "${partida.nome}" em ${nomeDoMes(fin.mes)}. Pode continuar cuidando deste parque ou escolher outro cenário.`
    : `O objetivo de "${partida.nome}" não foi cumprido a tempo: ${tipoDoObjetivo().progresso(tipoDoObjetivo().atual(), partida.objetivo)}.`;
  $('btnFimContinuar').hidden = !venceu;
  $('btnFimRepetir').hidden = venceu;
  $('modalFim').classList.add('aberto');
}

// Liga os botões (chamada uma vez, em main.js)
function iniciarCenarios() {
  $('btnInicio').addEventListener('click', abrirInicio);
  $('btnContinuar').addEventListener('click', fecharInicio);
  $('btnModoLivre').addEventListener('click', () => {
    if (jogoEmAndamento && !confirm('Começar um parque novo no modo livre? O parque atual (se não foi salvo) será perdido.')) return;
    novoJogoLivre();
    $('modalInicio').classList.remove('aberto');
  });
  $('btnInicioCarregar').addEventListener('click', () => $('btnJogo').click());   // a janela de saves abre por cima
  const fecharFim = () => $('modalFim').classList.remove('aberto');
  $('btnFimContinuar').addEventListener('click', () => { fecharFim(); fase = 'jogando'; });
  $('btnFimRepetir').addEventListener('click', async () => {
    fecharFim();
    try { iniciarCenario(partida.cenario, await buscarCenario(partida.cenario)); }
    catch (e) { alert('Não foi possível recomeçar: ' + e.message); abrirInicio(); }
  });
  $('btnFimInicio').addEventListener('click', () => { fecharFim(); fase = 'menu'; abrirInicio(); });
}
