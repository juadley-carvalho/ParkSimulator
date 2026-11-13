/* ============================================================
   salvar.js — salvar e carregar o jogo (serialização + API + tela)
   Depende de: estado.js, objetos.js, atracoes.js, financas.js, utils.js
   ============================================================ */

// Versão do formato do arquivo de save. Ao mudar a estrutura do estado, aumente este número
// e acrescente uma conversão em migrar() para os saves antigos continuarem abrindo.
const VERSAO_SAVE = 1;
const SAVES_URL = '/api/saves';

// ---------- Serialização: estado do jogo -> objeto simples (JSON) ----------
// Referências entre objetos não cabem em JSON. As filas das atrações apontam para convidados,
// então elas viram índices na lista de convidados e são religadas ao carregar.
function serializarJogo() {
  const indice = new Map(convidados.map((g, i) => [g, i]));
  const comoIndices = lista => lista.map(g => indice.get(g));
  return {
    versao: VERSAO_SAVE,
    resumo: { mes: fin.mes, caixa: fin.caixa, convidados: convidados.length },
    estado: {
      mapa, objetos, fin, parque, tempo, tChegada, stats,
      gestao: Object.fromEntries(gestao),
      rotacoes: Object.fromEntries(rotacoes),
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
  // Exemplo para o futuro:  if (doc.versao < 2) { ...ajusta doc.estado para o formato 2... }
  return doc.estado;
}

function matrizValida(m) {
  return Array.isArray(m) && m.length === MAPA && m.every(l => Array.isArray(l) && l.length === MAPA);
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

// Em duas etapas: 1) valida e monta tudo à parte (se algo estiver errado, lança erro e o jogo
// atual fica intacto); 2) só então substitui o estado.
function aplicarJogo(doc) {
  const e = migrar(doc);
  if (!matrizValida(e.mapa) || !matrizValida(e.objetos)) throw new Error('Save inválido: o mapa não tem o tamanho esperado');

  // --- etapa 1: sanear terrenos e objetos (chaves que não existem mais viram grama / vazio) ---
  const novoMapa = e.mapa.map(l => l.map(c => (TIPOS[c] ? c : 'GRAMA')));
  const novoObjetos = e.objetos.map(l => l.map(c => {
    if (typeof c === 'string') return OBJETOS[c] ? c : null;
    if (c && c.ancora && Number.isInteger(c.ancora.gx) && Number.isInteger(c.ancora.gy)) return { ancora: { gx: c.ancora.gx, gy: c.ancora.gy } };
    return null;
  }));
  for (let gy = 0; gy < MAPA; gy++)          // célula secundária sem âncora válida: vazia
    for (let gx = 0; gx < MAPA; gx++) {
      const c = novoObjetos[gy][gx];
      if (c && typeof c !== 'string') {
        const { gx: ax, gy: ay } = c.ancora;
        if (!dentroDoMapa(ax, ay) || typeof novoObjetos[ay][ax] !== 'string') novoObjetos[gy][gx] = null;
      }
    }

  // --- etapa 2: substituir o estado (mapa e objetos são constantes: copiamos linha a linha) ---
  novoMapa.forEach((l, gy) => { mapa[gy] = l; });
  novoObjetos.forEach((l, gy) => { objetos[gy] = l; });

  const f = e.fin || {};
  Object.assign(fin, finInicial());   // parte dos padrões (fin é const: mutamos, não reatribuímos)
  for (const k of Object.keys(fin)) if (typeof f[k] === typeof fin[k]) fin[k] = f[k];
  fin.aviso = ''; fin.tAviso = -99;
  // Parque: save antigo (sem "parque") fica com os padrões
  const p = e.parque || {};
  Object.assign(parque, parqueInicial());
  if (typeof p.nome === 'string') parque.nome = p.nome.slice(0, NOME_PARQUE_MAX);
  parque.precoEntrada = Math.max(0, num(p.precoEntrada, PRECO_ENTRADA_PADRAO));
  tempo = num(e.tempo, 0);
  tChegada = num(e.tChegada, 1);
  stats.sairam = num(e.stats && e.stats.sairam, 0);
  selecionado = null; selObj = null;

  // Convidados: completa campos que um save antigo possa não ter e descarta os inválidos.
  const base = { ox: 0, oy: 0, alvo: null, anterior: null, resgate: false, estado: 'andando', objetivo: null, uso: null,
                 dinheiro: 50, tolerancia: 5, paciencia: 35, evitar: {}, saindo: false, foi: false, cor: 'hsl(200 70% 55%)' };
  const baseN = { fome: 0, sede: 0, banheiro: 0, nausea: 0, energia: 100, felicidade: 100 };
  const porIndice = (Array.isArray(e.convidados) ? e.convidados : []).map(s => {
    if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return null;
    // Necessidades e números: um valor que não seja número (save editado à mão) viraria NaN e
    // "contaminaria" todas as contas seguintes. Cada campo é conferido e cai no padrão.
    const sn = s.n || {};
    const n = Object.fromEntries(Object.entries(baseN).map(([c, padrao]) => [c, limitar(num(sn[c], padrao))]));
    return { ...base, ...s, n, evitar: { ...s.evitar },
             dinheiro: Math.max(0, num(s.dinheiro, base.dinheiro)), tolerancia: num(s.tolerancia, base.tolerancia),
             paciencia: num(s.paciencia, base.paciencia), ox: num(s.ox, 0), oy: num(s.oy, 0),
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

  // Refaz o "def" do serviço em uso (ver serializarJogo) e solta quem ficou em estado incoerente
  for (const g of convidados) {
    if (g.uso) {
      const o = g.uso.ancora && dentroDoMapa(g.uso.ancora.gx, g.uso.ancora.gy) ? objetoEm(g.uso.ancora.gx, g.uso.ancora.gy) : null;
      g.uso.def = (o && OBJETOS[o.chave].servicos && OBJETOS[o.chave].servicos[g.uso.servico]) || null;
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

async function salvarEm(nome) {
  const id = slugDoNome(nome);
  if (!id) throw new Error('Dê um nome ao save');
  const corpo = JSON.stringify({ ...serializarJogo(), nome: nome.trim() });   // o instantâneo é tirado agora
  await chamarApi(`${SAVES_URL}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corpo });
  return id;
}

async function carregarDe(id) {
  aplicarJogo(await chamarApi(`${SAVES_URL}/${encodeURIComponent(id)}`));
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
    detalhe.textContent = `${new Date(s.salvoEm).toLocaleString('pt-BR')} · ${r.mes ? nomeDoMes(r.mes) : '?'} · ${moeda(r.caixa ?? 0)} · ${r.convidados ?? 0} convidados`;
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

  $('btnJogo').addEventListener('click', () => {
    $('inNomeSave').value = nomeDoParque();   // sugere o nome do parque (pode ser trocado antes de salvar)
    mensagem(''); modal.classList.add('aberto'); atualizarLista();
  });
  $('btnFecharJogo').addEventListener('click', () => modal.classList.remove('aberto'));
  $('btnSalvar').addEventListener('click', salvar);
  $('inNomeSave').addEventListener('keydown', e => { if (e.key === 'Enter') salvar(); });
}
