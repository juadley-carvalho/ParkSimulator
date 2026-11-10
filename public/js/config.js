/* ============================================================
   config.js — constantes e valores de balanceamento (mexa aqui para ajustar o jogo)
   Só dados: não depende de nenhum outro arquivo.
   ============================================================ */

const TILE_W = 64, TILE_H = 32, MAPA = 24, PROFUNDIDADE = 14;

// Catálogo de terrenos
const TIPOS = {
  GRAMA:   { nome: 'Grama', icone: '🌱',   cor: ['#6fbf5a', '#65b350'] },
  CAMINHO: { nome: 'Caminho', icone: '👣', cor: ['#cbb98b', '#c3b082'] },
  AGUA:    { nome: 'Água', icone: '💧',    cor: ['#4aa3d8', '#429bd0'] },
};

// Categorias da barra de construção (a ordem aqui é a ordem das abas). Cada objeto do catálogo
// escolhe a sua em "categoria"; sem categoria, cai em "cenario". Categoria vazia não aparece.
const CATEGORIAS = [
  { id: 'ferramentas', nome: 'Ferramentas', icone: '🧰' },
  { id: 'terreno',     nome: 'Terreno',     icone: '⛰️' },
  { id: 'cenario',     nome: 'Cenário',     icone: '🌳' },
  { id: 'servicos',    nome: 'Serviços',    icone: '🍔' },
  { id: 'atracoes',    nome: 'Atrações',    icone: '🎢' },
  { id: 'teste',       nome: 'Teste',       icone: '🧪' },
];

const ECONOMIA = {          // custo = construção; manutencao = por mês
  ARVORE:    { custo: 30,   manutencao: 2 },
  BANCO:     { custo: 60,   manutencao: 5 },
  BARRACA:   { custo: 500,  manutencao: 80 },
  BANHEIRO:  { custo: 350,  manutencao: 50 },
  CARROSSEL: { custo: 3000, manutencao: 200 },
  RODA_GIGANTE: { custo: 5000, manutencao: 300 },
  MONTANHA_RUSSA: { custo: 12000, manutencao: 600 },
};

const PRECO_PADRAO = { BANCO: { descanso: 0 }, BARRACA: { comida: 4, bebida: 2 },
                      BANHEIRO: { banheiro: 0 }, CARROSSEL: { diversao: 5 },
                      RODA_GIGANTE: { diversao: 6 },
                      MONTANHA_RUSSA: { diversao: 8 } };

const CUSTO_TERRENO = { GRAMA: 0, CAMINHO: 10, AGUA: 25 };   // cobrado ao trocar o terreno do tile

const REEMBOLSO = 0.5;                                     // fração do custo devolvida ao demolir

const SEG_POR_MES = 120;                                   // duração de um "mês" do jogo, em segundos reais

const LIMITE_EMPRESTIMO = 20000, PARCELA = 1000;

// Empréstimo inicial: o caixa de abertura do parque vem dele. Os juros podem ser alterados no jogo.
const SALDO_INICIAL = 15000, DIVIDA_INICIAL = 15000, JUROS_MENSAL = 0.03;

const VELOCIDADE = 1.6;                                   // tiles por segundo

const VIZINHOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];     // direita, esquerda, baixo, cima

// Quanto a felicidade cai por segundo, conforme a atividade atual
const FELIC_POR_ATIVIDADE = { andar: 0.8, comer: 0.3, beber: 0.3, sentar: 0.2, banheiro: 0.5, brinquedo: 0, esperar: 1.0 };

// Urgência (0..1) de cada serviço, calculada a partir das necessidades
const URGENCIA = {
  banheiro: n => n.banheiro / 100,
  comida:   n => n.fome / 100,
  bebida:   n => n.sede / 100,
  descanso: n => Math.max((100 - n.energia) / 100, n.nausea / 100),
  diversao: n => (100 - n.felicidade) / 100,
};

const ICONES = { comida: '🍔', bebida: '🥤', descanso: '💤', banheiro: '🚻', diversao: '🎠', saida: '👋' };

const FILA_MAX = 12;       // acima disso, quem chega desiste e tenta outra coisa

const TEMPO_CARGA = 5;     // segundos esperando passageiros antes de partir meio vazio

const ENTRADA = { gx: 12, gy: MAPA - 1 };   // tile da borda por onde todos entram e saem (já é CAMINHO)

const MAX_CONVIDADOS = 40;

// Intensidade (brinquedos) x tolerância (convidados), ambas de 1 a 10.
// O convidado aceita brinquedos até JANELA_INTENSIDADE pontos acima ou abaixo da sua tolerância.
// Com a felicidade em DESESPERO_FELICIDADE ou menos, aceita qualquer um, mas paga por cada ponto
// além da janela: menos felicidade e (se o brinquedo for intenso demais) mais náusea.
const JANELA_INTENSIDADE = 2;
const DESESPERO_FELICIDADE = 25;
const PENALIDADE_FELIC_POR_PONTO = 5;
const NAUSEA_POR_PONTO = 6;
