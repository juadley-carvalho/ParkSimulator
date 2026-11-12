/* ============================================================
   barra.js — barra de construção (parte inferior da tela)
   Abas por categoria; cada categoria mostra cartões com ícone, nome e preço.
   Depende de: config.js, utils.js, estado.js, objetos.js, convidados.js
   ============================================================ */

const ITENS_BARRA = [];     // todos os cartões: { el, categoria, camada, chave, custo, acao, ... }
const ABAS_BARRA = [];      // { el, id }
let categoriaAberta = 'terreno';

function limparConvidados() {
  convidados.length = 0; selecionado = null;
  for (const a of atracoes.values()) { a.fila.length = 0; a.passageiros.length = 0; a.fase = 'carregando'; a.tCarga = 0; }
}

// Texto que aparece ao passar o mouse sobre o cartão de um objeto
function dicaDoObjeto(chave) {
  const o = OBJETOS[chave], eco = ECONOMIA[chave] || {}, tam = tamanhoDe(chave);
  const partes = [`${o.nome}: custa ${moeda(custoDe(chave))}`];
  if (eco.manutencao) partes.push(`manutenção ${moeda(eco.manutencao)}/mês`);
  if (tam.w * tam.h > 1) partes.push(`ocupa ${tam.w}×${tam.h} tiles`);
  if (rotacionavel(chave)) partes.push(`tecla ${TECLA_GIRAR.toUpperCase()} gira antes de construir`);
  const brinquedo = o.servicos && Object.values(o.servicos).find(s => s.intensidade);
  if (brinquedo) partes.push(`intensidade ${brinquedo.intensidade}/10`, `${brinquedo.capacidade} lugares`);
  return partes.join(' · ');
}

// Tudo que aparece na barra, vindo dos catálogos. Um objeto novo em OBJETOS ganha o cartão sozinho.
// Itens com "camada" selecionam uma ferramenta; itens com "acao" executam algo na hora.
function listaDeItens() {
  const itens = [
    { categoria: 'ferramentas', nome: 'Inspecionar', icone: '🔍', camada: 'inspecionar', chave: 'X',
      dica: 'Clique em um convidado ou objeto para ver os detalhes e definir preços' },
    { categoria: 'ferramentas', nome: 'Demolir', icone: '🔨', camada: 'remover', chave: 'X',
      dica: `Remove objetos e devolve ${Math.round(REEMBOLSO * 100)}% do custo` },
  ];
  for (const [k, t] of Object.entries(TIPOS)) {
    const custo = CUSTO_TERRENO[k] || 0;
    itens.push({ categoria: 'terreno', nome: t.nome, icone: t.icone || '🟩', camada: 'terreno', chave: k, custo,
                 dica: `${t.nome}: ${custo ? moeda(custo) + ' por tile' : 'grátis'}` });
  }
  for (const [k, o] of Object.entries(OBJETOS))
    itens.push({ categoria: o.categoria || 'cenario', nome: o.nome, icone: o.icone || '📦', camada: 'objeto', chave: k,
                 custo: custoDe(k), dica: dicaDoObjeto(k) });
  itens.push(
    { categoria: 'teste', nome: '+5 convidados', icone: '👥', dica: 'Faz 5 convidados chegarem pela entrada',
      acao: () => semear(5, [ENTRADA.gx, ENTRADA.gy]) },
    { categoria: 'teste', nome: 'Limpar', icone: '🧹', dica: 'Remove todos os convidados', acao: limparConvidados });
  const validas = new Set(CATEGORIAS.map(c => c.id));
  for (const it of itens) if (!validas.has(it.categoria)) it.categoria = 'cenario';
  return itens;
}

const el = (tag, classe, texto) => {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
};

function criarCartao(it) {
  const preco = it.custo === undefined ? '' : it.custo > 0 ? moedaCurta(it.custo) : 'Grátis';
  const b = el('button', 'cartao');
  b.title = it.dica || it.nome;
  b.append(el('span', 'ic', it.icone), el('span', 'nm', it.nome), el('span', 'pr', preco));
  b.addEventListener('click', () => {
    if (it.acao) it.acao();
    else {
      if (ferramenta.camada !== it.camada || ferramenta.chave !== it.chave) rotacaoAtual = 0;   // objeto novo começa sem giro
      ferramenta = { camada: it.camada, chave: it.chave };
    }
    atualizarBarra();
  });
  ITENS_BARRA.push({ el: b, ...it });
  return b;
}

function abrirCategoria(id) {
  categoriaAberta = id;
  for (const linha of barra.querySelectorAll('.itens')) linha.hidden = linha.dataset.cat !== id;
  atualizarBarra();
}

// Monta a barra (chamada uma vez, em main.js)
function montarBarra() {
  barra.replaceChildren();
  ITENS_BARRA.length = 0; ABAS_BARRA.length = 0;
  const itens = listaDeItens();
  const areaItens = el('div'); areaItens.id = 'barraItens';
  const areaAbas = el('div'); areaAbas.id = 'barraAbas';
  for (const cat of CATEGORIAS) {
    const grupo = itens.filter(i => i.categoria === cat.id);
    if (!grupo.length) continue;
    const aba = el('button', 'aba');
    aba.append(el('span', 'ic', cat.icone), el('span', 'tx', cat.nome));
    aba.addEventListener('click', () => abrirCategoria(cat.id));
    areaAbas.appendChild(aba);
    ABAS_BARRA.push({ el: aba, id: cat.id });
    const linha = el('div', 'itens'); linha.dataset.cat = cat.id;
    grupo.forEach(it => linha.appendChild(criarCartao(it)));
    areaItens.appendChild(linha);
  }
  barra.append(areaItens, areaAbas);
  // abre a categoria da ferramenta atual
  const atual = ITENS_BARRA.find(i => !i.acao && i.camada === ferramenta.camada && i.chave === ferramenta.chave);
  abrirCategoria(atual ? atual.categoria : ABAS_BARRA[0].id);
}

// Chamada a cada quadro: destaca a ferramenta ativa, marca a aba que a contém e
// avisa (cartão esmaecido, preço em vermelho) o que o caixa atual não cobre.
function atualizarBarra() {
  const comFerramenta = new Set();
  for (const it of ITENS_BARRA) {
    const ativo = !it.acao && it.camada === ferramenta.camada && it.chave === ferramenta.chave;
    it.el.classList.toggle('ativo', ativo);
    it.el.classList.toggle('sem-saldo', it.custo > 0 && fin.caixa < it.custo);
    if (ativo) comFerramenta.add(it.categoria);
  }
  for (const aba of ABAS_BARRA) {
    aba.el.classList.toggle('aberta', aba.id === categoriaAberta);
    aba.el.classList.toggle('com-ferramenta', comFerramenta.has(aba.id));
  }
}
