/* ============================================================
   salvar.js — salvar e carregar o jogo (serialização + API + tela)
   Depende de: estado.js, objetos.js, atracoes.js, financas.js, utils.js
   ============================================================ */

// Versão do formato do arquivo de save. Ao mudar a estrutura do estado, aumente este número
// e acrescente uma conversão em migrar() para os saves antigos continuarem abrindo.
const VERSAO_SAVE = 2;   // 2: partida (modo livre ou cenário com objetivo)
const SAVES_URL = '/api/saves';

// ---------- Serialização: estado do jogo -> objeto simples (JSON) ----------
// Referências entre objetos não cabem em JSON. As filas das atrações apontam para convidados,
// então elas viram índices na lista de convidados e são religadas ao carregar.
function serializarJogo() {
  const indice = new Map(convidados.map((g, i) => [g, i]));
  const comoIndices = lista => lista.map(g => indice.get(g));
  return {
    versao: VERSAO_SAVE,
    resumo: { mes: fin.mes, caixa: fin.caixa, convidados: convidados.length, cenario: partida.nome, tamanho: MAPA },
    estado: {
      mapa, objetos, fin, parque, avaliacao, partida, tempo, tChegada, stats,
      gestao: Object.fromEntries(gestao),
      rotacoes: Object.fromEntries(rotacoes),
      sujeira: Object.fromEntries(sujeira), lixeiras: Object.fromEntries(lixeiras),
      funcionarios: funcionarios.map(f => ({ ...f, alvo: null })),   // o rumo é refeito no próximo quadro
      atracoes: Object.fromEntries([...atracoes].map(([k, a]) =>
        [k, { ...a, fila: comoIndices(a.fila), passageiros: comoIndices(a.passageiros) }])),
      // "def" aponta para o catálogo (que não é dado de jogo): é refeito a partir do serviço e da âncora
      convidados: convidados.map(g => ({ ...g, uso: g.uso && { ...g.uso, def: undefined } })),
    },
  };
}

// ---------- Carregamento ----------
// Converte saves antigos para o formato atual e devolve só o "estado".
function migrar(doc) {
  if (!doc || typeof doc.versao !== 'number' || !doc.estado || typeof doc.estado !== 'object')
    throw new Error('Arquivo de save inválido');
  if (doc.versao > VERSAO_SAVE) throw new Error('Este save é de uma versão mais nova do jogo');
  // Cada versão converte para a seguinte; um save da versão 1 passa por todos os "if" em ordem.
  // 1 -> 2: antes dos cenários todo jogo era livre
  if (doc.versao < 2) doc.estado.partida = { modo: 'livre' };
  return doc.estado;
}

// Matriz quadrada n x n. O tamanho do mapa vem do próprio save (os antigos têm 24 x 24).
function matrizValida(m, n) {
  return Array.isArray(m) && m.length === n && m.every(l => Array.isArray(l) && l.length === n);
}

const num = (v, padrao) => (Number.isFinite(v) ? v : padrao);

// A âncora está em (gx, gy) e todas as outras células da pegada (na orientação rot) apontam para ela?
function pegadaConfere(chave, gx, gy, rot) {
  const { w, h } = tamanhoDe(chave, rot);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (!dentroDoMapa(gx + i, gy + j)) return false;
      const c = objetos[gy + j][gx + i];
      const certo = (i === 0 && j === 0) ? c === chave : (c && typeof c !== 'string' && c.ancora.gx === gx && c.ancora.gy === gy);
      if (!certo) return false;
    }
  return true;
}

// Objeto { chave: número } vindo de um arquivo: descarta o que não for número finito
function soNumeros(o) {
  return Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => Number.isFinite(v)));
}

// Em duas etapas: 1) valida e monta tudo à parte (se algo estiver errado, lança erro e o jogo
// atual fica intacto); 2) só então substitui o estado.
function aplicarJogo(doc) {
  const e = migrar(doc);
  const n = Array.isArray(e.mapa) ? e.mapa.length : 0;
  if (n < MAPA_MIN || n > MAPA_MAX || !matrizValida(e.mapa, n) || !matrizValida(e.objetos, n))
    throw new Error('Save inválido: o mapa não é quadrado ou tem um tamanho fora do permitido');
  // Na etapa 1 o mapa atual ainda tem o tamanho antigo: "dentro" usa o tamanho do save
  const dentro = (x, y) => x >= 0 && y >= 0 && x < n && y < n;

  // --- etapa 1: sanear terrenos e objetos (chaves que não existem mais viram grama / vazio) ---
  const novoMapa = e.mapa.map(l => l.map(c => (TIPOS[c] ? c : 'GRAMA')));
  const novoObjetos = e.objetos.map(l => l.map(c => {
    if (typeof c === 'string') return OBJETOS[c] ? c : null;
    if (c && c.ancora && Number.isInteger(c.ancora.gx) && Number.isInteger(c.ancora.gy)) return { ancora: { gx: c.ancora.gx, gy: c.ancora.gy } };
    return null;
  }));
  for (let gy = 0; gy < n; gy++)          // célula secundária sem âncora válida: vazia
    for (let gx = 0; gx < n; gx++) {
      const c = novoObjetos[gy][gx];
      if (c && typeof c !== 'string') {
        const { gx: ax, gy: ay } = c.ancora;
        if (!dentro(ax, ay) || typeof novoObjetos[ay][ax] !== 'string') novoObjetos[gy][gx] = null;
      }
    }

  // --- etapa 2: substituir o estado (mapa e objetos são constantes: copiamos linha a linha) ---
  redimensionarMapa(n);   // daqui em diante MAPA e ENTRADA já são os do save
  novoMapa.forEach((l, gy) => { mapa[gy] = l; });
  novoObjetos.forEach((l, gy) => { objetos[gy] = l; });

  const f = e.fin || {};
  Object.assign(fin, finInicial());   // parte dos padrões (fin é const: mutamos, não reatribuímos)
  for (const k of Object.keys(fin)) if (typeof f[k] === typeof fin[k]) fin[k] = f[k];
  fin.aviso = ''; fin.tAviso = -99;
  fin.queixasMes = soNumeros(f.queixasMes);   // objeto vindo do arquivo: só contagens válidas
  // Parque: save antigo (sem "parque") fica com os padrões
  const p = e.parque || {};
  Object.assign(parque, parqueInicial());
  if (typeof p.nome === 'string') parque.nome = p.nome.slice(0, NOME_PARQUE_MAX);
  parque.precoEntrada = Math.max(0, num(p.precoEntrada, PRECO_ENTRADA_PADRAO));
  tempo = num(e.tempo, 0);
  valoresFlutuantes.length = 0;
  tChegada = num(e.tChegada, 1);
  stats.sairam = num(e.stats && e.stats.sairam, 0);
  selecionado = null; selObj = null; selFunc = null;

  // Convidados: completa campos que um save antigo possa não ter e descarta os inválidos.
  const base = { ox: 0, oy: 0, alvo: null, anterior: null, resgate: false, estado: 'andando', objetivo: null, uso: null,
                 dinheiro: 50, tolerancia: 5, paciencia: 35, evitar: {}, pensou: {}, pensamento: null, lixo: null, capricho: 0.5,
                 saindo: false, foi: false, cor: 'hsl(200 70% 55%)', corCalca: CORES_CALCA[0],
                 passo: 0, movendo: false, olhaX: 1, olhaY: 0 };
  const baseN = { fome: 0, sede: 0, banheiro: 0, nausea: 0, energia: 100, felicidade: 100 };
  const porIndice = (Array.isArray(e.convidados) ? e.convidados : []).map(s => {
    if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return null;
    // Necessidades e números: um valor que não seja número (save editado à mão) viraria NaN e
    // "contaminaria" todas as contas seguintes. Cada campo é conferido e cai no padrão.
    const sn = s.n || {};
    const n = Object.fromEntries(Object.entries(baseN).map(([c, padrao]) => [c, limitar(num(sn[c], padrao))]));
    const pens = s.pensamento && PENSAMENTOS[s.pensamento.tipo] && Number.isFinite(s.pensamento.ate) ? { tipo: s.pensamento.tipo, ate: s.pensamento.ate } : null;
    const lixo = s.lixo && ['papel', 'copo', 'palito'].includes(s.lixo.tipo) && Number.isFinite(s.lixo.ate) ? { tipo: s.lixo.tipo, ate: s.lixo.ate } : null;
    return { ...base, ...s, n, evitar: { ...s.evitar }, pensou: soNumeros(s.pensou), pensamento: pens, lixo,
             capricho: Math.max(0, Math.min(1, num(s.capricho, base.capricho))),
             dinheiro: Math.max(0, num(s.dinheiro, base.dinheiro)), tolerancia: num(s.tolerancia, base.tolerancia),
             paciencia: num(s.paciencia, base.paciencia), ox: num(s.ox, 0), oy: num(s.oy, 0),
             // animação: save antigo (sem esses campos) ou editado à mão cai no padrão
             corCalca: CORES_CALCA.includes(s.corCalca) ? s.corCalca : base.corCalca,
             passo: num(s.passo, 0), movendo: s.movendo === true, olhaX: num(s.olhaX, 1), olhaY: num(s.olhaY, 0),
             velocidade: num(s.velocidade, VELOCIDADE) > 0 ? num(s.velocidade, VELOCIDADE) : VELOCIDADE };
  });
  convidados.length = 0;
  porIndice.forEach(g => { if (g) convidados.push(g); });

  // Preços e receitas, só de objetos que ainda existem
  gestao.clear();
  for (const [k, d] of Object.entries(e.gestao || {})) {
    const [gx, gy] = k.split(',').map(Number);
    const o = dentroDoMapa(gx, gy) ? objetoEm(gx, gy) : null;
    if (o && o.gx === gx && o.gy === gy && OBJETOS[o.chave].servicos && d)
      gestao.set(k, { precos: { ...d.precos }, receita: num(d.receita, 0), usos: num(d.usos, 0) });
  }

  // Rotações (1 a 3; saves antigos só têm 1): só de objetos que existem, giram e cuja pegada girada
  // confere com as células salvas
  rotacoes.clear();
  for (const [k, r] of Object.entries(e.rotacoes || {})) {
    const [gx, gy] = k.split(',').map(Number);
    const o = dentroDoMapa(gx, gy) ? objetoEm(gx, gy) : null;
    if ([1, 2, 3].includes(r) && o && o.gx === gx && o.gy === gy && rotacionavel(o.chave) && pegadaConfere(o.chave, gx, gy, r))
      rotacoes.set(k, r);
  }

  // Atrações: religa as filas aos convidados pelos índices
  atracoes.clear();
  const naFila = new Set(), noBrinquedo = new Set();
  const doIndice = lista => (Array.isArray(lista) ? lista : []).map(i => porIndice[i]).filter(Boolean);
  for (const [k, a] of Object.entries(e.atracoes || {})) {
    const [gx, gy] = k.split(',').map(Number);
    const o = dentroDoMapa(gx, gy) ? objetoEm(gx, gy) : null;
    if (!o || o.gx !== gx || o.gy !== gy || o.chave !== a.chave || !ehAtracaoComFila(a.chave)) continue;
    const nova = novaAtracao(a.chave, gx, gy);
    nova.fila = doIndice(a.fila); nova.passageiros = doIndice(a.passageiros);
    nova.fase = a.fase === 'rodando' ? 'rodando' : 'carregando';
    nova.tCarga = num(a.tCarga, 0); nova.resta = num(a.resta, 0); nova.angulo = num(a.angulo, 0);
    // Defeitos (save antigo: brinquedo novo, funcionando)
    nova.desgaste = Math.max(0, num(a.desgaste, 0)); nova.corridas = Math.max(0, Math.floor(num(a.corridas, 0)));
    nova.garantia = Math.max(0, Math.floor(num(a.garantia, 0))); nova.consertos = Math.max(0, Math.floor(num(a.consertos, 0)));
    nova.quebrada = a.quebrada === true; nova.tQuebrada = Math.max(0, num(a.tQuebrada, 0));
    nova.quebraEm = Number.isFinite(a.quebraEm) && nova.fase === 'rodando' ? a.quebraEm : null;
    nova.fila.forEach(g => naFila.add(g)); nova.passageiros.forEach(g => noBrinquedo.add(g));
    atracoes.set(k, nova);
  }

  // Objetos que existem mas não têm dados (save antigo, serviço novo): cria com os padrões
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) {
      const c = objetos[gy][gx], k = chaveAtr(gx, gy);
      if (typeof c !== 'string') continue;
      if (OBJETOS[c].servicos && !gestao.has(k)) gestao.set(k, { precos: { ...(PRECO_PADRAO[c] || {}) }, receita: 0, usos: 0 });
      if (ehAtracaoComFila(c) && !atracoes.has(k)) atracoes.set(k, novaAtracao(c, gx, gy));
    }

  // Lixeiras: o nível de cada uma que existe (save antigo ou sem dado: vazia)
  lixeiras.clear();
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++)
      if (ehLixeira(objetos[gy][gx])) {
        const v = (e.lixeiras || {})[chaveAtr(gx, gy)];
        lixeiras.set(chaveAtr(gx, gy), Math.max(0, Math.min(capacidadeLixeira(gx, gy), Math.floor(num(v, 0)))));
      }
  // Sujeira: só itens conhecidos, sobre caminho, no máximo LIXO.maxPorTile por tile
  sujeira.clear();
  lotacao.clear();   // é refeita no próximo passo; sem isso, pausado, mostraria a multidão do parque anterior
  for (const [k, lista] of Object.entries(e.sujeira || {})) {
    const [gx, gy] = k.split(',').map(Number);
    if (!ehCaminho(gx, gy) || !Array.isArray(lista)) continue;
    const itens = lista.filter(i => i && TIPOS_SUJEIRA.includes(i.tipo))
      .map(i => ({ tipo: i.tipo, dx: Math.max(-0.3, Math.min(0.3, num(i.dx, 0))), dy: Math.max(-0.3, Math.min(0.3, num(i.dy, 0))), giro: num(i.giro, 0) }))
      .slice(0, LIXO.maxPorTile);
    if (itens.length) sujeira.set(chaveAtr(gx, gy), itens);
  }
  // Faxineiros: posição dentro do mapa; a tarefa é conferida de novo quando ele chegar a um tile
  funcionarios.length = 0;
  for (const f of Array.isArray(e.funcionarios) ? e.funcionarios : []) {
    if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.y) || !dentroDoMapa(Math.floor(f.x), Math.floor(f.y))) continue;
    const numero = Number.isInteger(f.numero) && f.numero > 0 ? f.numero : funcionarios.length + 1;
    const t = f.tarefa && Number.isInteger(f.tarefa.gx) && Number.isInteger(f.tarefa.gy) && dentroDoMapa(f.tarefa.gx, f.tarefa.gy) ? { gx: f.tarefa.gx, gy: f.tarefa.gy } : null;
    const funcao = FUNCOES[f.funcao] ? f.funcao : 'faxineiro';   // save antigo: todo funcionário era faxineiro
    funcionarios.push({ numero, nome: typeof f.nome === 'string' ? f.nome.slice(0, 30) : `${FUNCOES[funcao].nome} ${numero}`, x: f.x, y: f.y,
      alvo: null, anterior: null, tarefa: t, trabalho: Math.max(0, num(f.trabalho, 0)),
      mesContratacao: Math.max(1, Math.min(fin.mes, Math.floor(num(f.mesContratacao, fin.mes)))),
      limpezas: Math.max(0, Math.floor(num(f.limpezas, 0))),
      recolheu: Math.max(0, num(f.recolheu, 0)), recolheuMes: Math.max(0, num(f.recolheuMes, 0)),
      funcao, conserto: typeof f.conserto === 'string' ? f.conserto : null,   // conferido na próxima decisão (decidirMecanico)
      consertos: Math.max(0, num(f.consertos, 0)), consertosMes: Math.max(0, num(f.consertosMes, 0)),
      passo: num(f.passo, 0), movendo: false, olhaX: num(f.olhaX, 1), olhaY: num(f.olhaY, 0) });
  }

  // Avaliação: save antigo (sem ela) recalcula a partir do parque carregado
  const av = e.avaliacao;
  if (av && Number.isFinite(av.nota)) {
    Object.assign(avaliacao, avaliacaoInicial());
    avaliacao.nota = Math.max(0, Math.min(NOTA_MAX, av.nota));
    avaliacao.alvo = Math.max(0, Math.min(NOTA_MAX, num(av.alvo, avaliacao.nota)));
    for (const k of ['saidas', 'infelizes', 'chegadas', 'recusas']) avaliacao[k] = Math.max(0, num(av[k], 0));
  } else iniciarAvaliacao();

  // Partida: cenário com objetivo coerente, ou modo livre (save editado à mão com dados estranhos)
  Object.assign(partida, partidaInicial());
  const pt = e.partida || {}, ob = pt.objetivo || {};
  if (pt.modo === 'cenario' && typeof pt.cenario === 'string' && TIPOS_OBJETIVO[ob.tipo] && Number.isFinite(ob.valor) && Number.isInteger(ob.prazo))
    Object.assign(partida, {
      modo: 'cenario', cenario: pt.cenario.slice(0, 40), nome: String(pt.nome || pt.cenario).slice(0, 40),
      objetivo: { tipo: ob.tipo, valor: ob.valor, prazo: ob.prazo, meses: Number.isInteger(ob.meses) && ob.meses > 0 ? ob.meses : 1 },
      liberados: Array.isArray(pt.liberados) ? pt.liberados.filter(k => OBJETOS[k]) : null,
      precosTravados: !!pt.precosTravados, inicio: num(pt.inicio, 0), concluido: !!pt.concluido,
      sequencia: Math.max(0, Math.floor(num(pt.sequencia, 0))), visitantes: Math.max(0, Math.floor(num(pt.visitantes, 0))),
    });

  // Refaz o "def" do serviço em uso (ver serializarJogo) e solta quem ficou em estado incoerente
  for (const g of convidados) {
    if (g.uso) {
      const o = g.uso.ancora && dentroDoMapa(g.uso.ancora.gx, g.uso.ancora.gy) ? objetoEm(g.uso.ancora.gx, g.uso.ancora.gy) : null;
      g.uso.def = (o && OBJETOS[o.chave].servicos && OBJETOS[o.chave].servicos[g.uso.servico]) || null;
      // Lugar no banco: um dos 4 lados; se inválido, ele só não aparece sobre o assento
      if (g.uso.lado && !VIZINHOS.some(([dx, dy]) => Array.isArray(g.uso.lado) && g.uso.lado[0] === dx && g.uso.lado[1] === dy)) delete g.uso.lado;
    }
    if ((g.estado === 'esperando' && !naFila.has(g)) || (g.estado === 'brincando' && !noBrinquedo.has(g))
        || (g.estado === 'usando' && !(g.uso && g.uso.def)) || (g.estado === 'esperando' && !(g.uso && g.uso.def))) soltarConvidado(g);
  }
}

// ---------- Cliente da API ----------
async function chamarApi(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  if (!resposta.ok) {
    let mensagem = resposta.statusText;
    try { mensagem = (await resposta.json()).erro || mensagem; } catch { /* corpo sem JSON */ }
    throw new Error(mensagem);
  }
  return resposta.status === 204 ? null : resposta.json();
}

// "Meu Parque 2" -> "meu-parque-2": o id do arquivo no servidor
function slugDoNome(nome) {
  return nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

async function salvarEm(nome, id = slugDoNome(nome)) {
  if (!id) throw new Error('Dê um nome ao save');
  const corpo = JSON.stringify({ ...serializarJogo(), nome: nome.trim() });   // o instantâneo é tirado agora
  await chamarApi(`${SAVES_URL}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corpo });
  return id;
}

async function carregarDe(id) {
  const tamanhoAntes = MAPA;
  aplicarJogo(await chamarApi(`${SAVES_URL}/${encodeURIComponent(id)}`));
  if (MAPA !== tamanhoAntes) centralizar();   // outro tamanho: a câmera antiga pode mirar fora do mapa
  montarBarra();   // o cenário do save pode liberar outros objetos
  jogoEmAndamento = true; fase = 'jogando';
  reiniciarAutosave();
  $('modalInicio').classList.remove('aberto');   // carregado a partir da tela inicial
}

// ---------- Salvamento automático ----------
// modo: chave de OPCOES_AUTOSAVE; t = segundos reais desde o último; mes = o mês visto no último quadro
// (para perceber a virada); salvando = trava contra dois salvamentos ao mesmo tempo (fetch é assíncrono).
const autosave = { modo: 'desligado', t: 0, mes: 1, salvando: false, ultimo: null };

function lerModoAutosave() {
  try { const m = localStorage.getItem(CHAVE_AUTOSAVE); return OPCOES_AUTOSAVE[m] ? m : 'desligado'; }
  catch { return 'desligado'; }   // localStorage bloqueado: começa desligado
}

function definirModoAutosave(m) {
  autosave.modo = OPCOES_AUTOSAVE[m] ? m : 'desligado';
  autosave.t = 0;
  try { localStorage.setItem(CHAVE_AUTOSAVE, autosave.modo); } catch { /* sem localStorage: vale só nesta sessão */ }
}

// Jogo novo ou carregado: recomeça a contagem. O mês do save carregado não é uma "virada".
function reiniciarAutosave() { autosave.t = 0; autosave.mes = fin.mes; }

// Chamada a cada quadro (main.js) com o tempo REAL. Só conta com o jogo rodando (não na tela inicial).
function atualizarAutosave(dtReal) {
  if (fase !== 'jogando') return;
  let devido = false;
  if (autosave.modo === 'minuto') { autosave.t += dtReal; devido = autosave.t >= INTERVALO_AUTOSAVE; }
  // fin.mes só cresce de 1 em 1 durante o jogo; mês 13, 25... = Janeiro = virou o ano
  else if (fin.mes === autosave.mes + 1) devido = autosave.modo === 'mes' || (autosave.modo === 'ano' && (fin.mes - 1) % 12 === 0);
  autosave.mes = fin.mes;
  if (devido) { autosave.t = 0; fazerAutosave(); }
}

// Não usa "await" de quem chama: o jogo continua enquanto o arquivo vai para o servidor. O instantâneo
// é tirado na hora (serializarJogo dentro de salvarEm, antes do primeiro await).
async function fazerAutosave() {
  if (autosave.salvando) return;
  autosave.salvando = true;
  try {
    await salvarEm(`Autosave · ${nomeDoParque()}`, ID_AUTOSAVE);
    autosave.ultimo = new Date();
    avisar('💾 Salvo automaticamente', true);
  } catch (e) { avisar('Autosave falhou: ' + e.message); }
  finally { autosave.salvando = false; }   // finally roda com sucesso OU erro: a trava sempre se solta
}

function textoAutosave() {
  if (autosave.modo === 'desligado') return 'Desligado.';
  return `Grava no save "Autosave · ${nomeDoParque()}", substituindo o anterior.` +
    (autosave.ultimo ? ` Último: ${autosave.ultimo.toLocaleTimeString('pt-BR')}.` : '');
}

// ---------- Tela de salvar e carregar ----------
function iniciarSalvar() {
  const modal = $('modalJogo');
  const mensagem = (texto, ruim = false) => { $('msgJogo').textContent = texto; $('msgJogo').style.color = ruim ? '#e53935' : ''; };

  async function atualizarLista() {
    const lista = $('listaSaves');
    lista.replaceChildren();
    try {
      const saves = await chamarApi(SAVES_URL);
      if (!saves.length) { lista.textContent = 'Nenhum save ainda.'; return; }
      for (const s of saves) lista.appendChild(linhaDoSave(s));
    } catch (e) { mensagem('Erro ao listar os saves: ' + e.message, true); }
  }

  // Nomes vêm do usuário: sempre textContent (nunca innerHTML), para não executar HTML digitado
  function linhaDoSave(s) {
    const linha = document.createElement('div'); linha.className = 'save-linha';
    const info = document.createElement('div'); info.className = 'info';
    const titulo = document.createElement('b'); titulo.textContent = s.nome || s.id;
    const detalhe = document.createElement('small');
    const r = s.resumo || {};
    detalhe.textContent = `${r.cenario ? '🎯 ' + r.cenario + ' · ' : ''}${new Date(s.salvoEm).toLocaleString('pt-BR')} · ${r.mes ? nomeDoMes(r.mes) : '?'} · ${moeda(r.caixa ?? 0)} · ${r.convidados ?? 0} convidados · ${r.tamanho ?? 24}×${r.tamanho ?? 24}`;   // saves antigos: 24
    info.append(titulo, detalhe);

    const carregar = document.createElement('button'); carregar.className = 'btn'; carregar.textContent = 'Carregar';
    carregar.addEventListener('click', async () => {
      if (!confirm(`Carregar "${s.nome || s.id}"? O parque atual será substituído.`)) return;
      try { await carregarDe(s.id); mensagem(''); modal.classList.remove('aberto'); }
      catch (e) { mensagem('Não foi possível carregar: ' + e.message, true); }
    });
    const apagar = document.createElement('button'); apagar.className = 'btn btn-perigo'; apagar.textContent = 'Apagar';
    apagar.addEventListener('click', async () => {
      if (!confirm(`Apagar "${s.nome || s.id}" para sempre?`)) return;
      try { await chamarApi(`${SAVES_URL}/${encodeURIComponent(s.id)}`, { method: 'DELETE' }); await atualizarLista(); }
      catch (e) { mensagem('Não foi possível apagar: ' + e.message, true); }
    });
    linha.append(info, carregar, apagar);
    return linha;
  }

  async function salvar() {
    const nome = $('inNomeSave').value;
    try {
      const id = slugDoNome(nome);
      if (id) {   // já existe um save com esse nome? pede confirmação antes de sobrescrever
        const existentes = await chamarApi(SAVES_URL);
        if (existentes.some(s => s.id === id) && !confirm('Já existe um save com esse nome. Substituir?')) return;
      }
      await salvarEm(nome);
      mensagem('Parque salvo!');
      await atualizarLista();
    } catch (e) { mensagem('Não foi possível salvar: ' + e.message, true); }
  }

  // Seletor do autosave: uma opção por entrada de OPCOES_AUTOSAVE
  autosave.modo = lerModoAutosave();
  const sel = $('selAutosave');
  for (const [valor, texto] of Object.entries(OPCOES_AUTOSAVE)) {
    const op = document.createElement('option'); op.value = valor; op.textContent = texto; sel.appendChild(op);
  }
  sel.value = autosave.modo;
  sel.addEventListener('change', () => { definirModoAutosave(sel.value); $('infoAutosave').textContent = textoAutosave(); });

  $('btnJogo').addEventListener('click', () => {
    $('inNomeSave').value = nomeDoParque();   // sugere o nome do parque (pode ser trocado antes de salvar)
    $('infoAutosave').textContent = textoAutosave();   // o nome vem do jogador: textContent
    mensagem(''); modal.classList.add('aberto'); atualizarLista();
  });
  $('btnFecharJogo').addEventListener('click', () => modal.classList.remove('aberto'));
  $('btnSalvar').addEventListener('click', salvar);
  $('inNomeSave').addEventListener('keydown', e => { if (e.key === 'Enter') salvar(); });
}
