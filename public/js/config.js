/* ============================================================
   config.js — constantes e valores de balanceamento (mexa aqui para ajustar o jogo)
   Só dados: não depende de nenhum outro arquivo.
   ============================================================ */

const TILE_W = 64, TILE_H = 32, MAPA = 24, PROFUNDIDADE = 14;

// Fonte dos textos desenhados no canvas (a mesma da interface, declarada em style.css)
const FONTE_JOGO = "'Fredoka', 'Segoe UI', sans-serif";

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
  BARRACA_BEBIDAS: { custo: 350, manutencao: 40 },
  NAVIO_PIRATA: { custo: 7500, manutencao: 350 },
  BARRACA_SORVETE: { custo: 400, manutencao: 45 },
};

const PRECO_PADRAO = { BANCO: { descanso: 0 }, BARRACA: { comida: 4 }, BARRACA_SORVETE: { comida: 3 },
                      BANHEIRO: { banheiro: 0 }, CARROSSEL: { diversao: 5 },
                      RODA_GIGANTE: { diversao: 6 },
                      MONTANHA_RUSSA: { diversao: 8 },
                      BARRACA_BEBIDAS: { bebida: 3 }, NAVIO_PIRATA: { diversao: 7 } };

const CUSTO_TERRENO = { GRAMA: 0, CAMINHO: 10, AGUA: 25 };   // cobrado ao trocar o terreno do tile

const REEMBOLSO = 0.5;                                     // fração do custo devolvida ao demolir

// Calendário: o jogo começa em Janeiro do Ano 1. Um mês dura SEG_POR_MES segundos reais
// (5 min: um ano ≈ 1 hora) e tem DIAS_POR_MES dias (então um dia = 10 s).
const SEG_POR_MES = 300;
const DIAS_POR_MES = 30;
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                     'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const LIMITE_EMPRESTIMO = 20000, PARCELA = 1000;

// Empréstimo inicial: o caixa de abertura do parque vem dele. Os juros podem ser alterados no jogo.
const SALDO_INICIAL = 15000, DIVIDA_INICIAL = 15000, JUROS_MENSAL = 0.03;

const VELOCIDADE = 1.6;                                   // tiles por segundo (média)
const VARIACAO_VELOCIDADE = 0.15;                         // cada convidado anda até 15% mais rápido ou mais devagar

const VIZINHOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];     // direita, esquerda, baixo, cima

// Quanto a felicidade cai por segundo, conforme a atividade atual
const FELIC_POR_ATIVIDADE = { andar: 0.8, comer: 0.3, beber: 0.3, sentar: 0.2, banheiro: 0.5, brinquedo: 0, esperar: 1.0 };

// A partir desta urgência o convidado sai procurando o serviço
const LIMIAR_URGENCIA = 0.6;

// Felicidade a partir da qual (para baixo) ele procura um brinquedo
const FELIC_BUSCA_DIVERSAO = 55;

// Urgência (0..1) de cada serviço, calculada a partir das necessidades
const URGENCIA = {
  banheiro: n => n.banheiro / 100,
  comida:   n => n.fome / 100,
  bebida:   n => n.sede / 100,
  descanso: n => Math.max((100 - n.energia) / 100, n.nausea / 100),
  // Escala para que felicidade = FELIC_BUSCA_DIVERSAO dê exatamente LIMIAR_URGENCIA (e 1 = bem infeliz)
  diversao: n => Math.min(1, LIMIAR_URGENCIA * (100 - n.felicidade) / (100 - FELIC_BUSCA_DIVERSAO)),
};

// Atratividade de um brinquedo = felicidade LÍQUIDA que o convidado espera ganhar com ele, em pontos.
// Ele compara todos os brinquedos alcançáveis e vai ao de maior atratividade (não mais ao mais perto):
//   ganho de felicidade (já com a penalidade de intensidade, ver efeitosFinais)
//   − PREFERENCIA_INTENSIDADE por ponto de diferença entre a intensidade e a tolerância dele
//   − o que ele perde de felicidade andando até lá e esperando na fila (mesmas taxas de FELIC_POR_ATIVIDADE)
//   − FELIC_POR_DOLAR por dólar do ingresso
// Se nenhum brinquedo tiver atratividade > 0, ele não vai a nenhum (fila longa demais, caro demais...).
const PREFERENCIA_INTENSIDADE = 3;
const FELIC_POR_DOLAR = 1;

// Ícones por serviço. Um serviço do catálogo pode trocar o seu com "icone" (ver iconeDoUso).
const ICONES = { comida: '🍔', bebida: '🥤', descanso: '💤', banheiro: '🚻', diversao: '🎠', saida: '👋' };

const FILA_MAX = 12;       // acima disso, quem chega desiste e tenta outra coisa

const TEMPO_CARGA = 5;     // segundos esperando passageiros antes de partir meio vazio

const ENTRADA = { gx: 12, gy: MAPA - 1 };   // tile da borda por onde todos entram e saem (já é CAMINHO)

const MAX_CONVIDADOS = 40;

// Volume da música de fundo (0 a 1). As faixas são os .mp3 de public/musicas (ver musica.js).
const VOLUME_MUSICA = 0.35;

// Parque: nome e ingresso (editáveis na janela "Parque"). O ingresso é cobrado na chegada, e o
// convidado só entra se ele custar até FRACAO_MAX_ENTRADA do dinheiro que trouxe (com $100, até $30).
// Preço alto = menos gente entrando e menos dinheiro sobrando para os brinquedos e barracas.
const NOME_PARQUE_PADRAO = 'Meu parque', NOME_PARQUE_MAX = 30;
const PRECO_ENTRADA_PADRAO = 0;
const FRACAO_MAX_ENTRADA = 0.3;

// Tecla que gira 90° a atração que está sendo posicionada (4 posições).
const TECLA_GIRAR = 'z';

// Intensidade (brinquedos) x tolerância (convidados), ambas de 1 a 10.
// O convidado aceita brinquedos até JANELA_INTENSIDADE pontos acima ou abaixo da sua tolerância.
// Com a felicidade em DESESPERO_FELICIDADE ou menos, aceita qualquer um, mas paga por cada ponto
// além da janela: menos felicidade e (se o brinquedo for intenso demais) mais náusea.
const JANELA_INTENSIDADE = 2;
const DESESPERO_FELICIDADE = 25;
const PENALIDADE_FELIC_POR_PONTO = 5;
const NAUSEA_POR_PONTO = 6;
