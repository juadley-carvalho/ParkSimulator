/* ============================================================
   estado.js — todo o estado mutável do jogo (os dados) e consultas simples sobre ele
   Depende de: config.js
   ============================================================ */

const camera = { x: 0, y: 0, zoom: 1 };

let hover = null;

// Duas CAMADAS de dados, ambas indexadas como [gy][gx]:
//   mapa    -> terreno (sempre preenchido)
//   objetos -> o que está em cima (null = vazio)
function criarMatriz(tamanho, valor) {
  return Array.from({ length: tamanho }, () => Array(tamanho).fill(valor));
}

// Cada célula de objetos[gy][gx] guarda: null (vazio) | 'CHAVE' (âncora ou objeto 1x1)
// | { ancora: {gx, gy} } (célula secundária, aponta para a âncora).

const mapa = criarMatriz(MAPA, 'GRAMA');

const objetos = criarMatriz(MAPA, null);

// Estado das atrações com fila, indexado pela âncora ("gx,gy").
const atracoes = new Map();

const rotacoes = new Map();   // âncora -> 1 (objeto girado 90°); ausente = orientação original
const gestao = new Map();   // âncora -> { precos, receita, usos } (todo objeto que oferece serviços)

// Finanças no início de um jogo novo. É uma função (uma "fábrica") para que o carregamento possa
// partir de um objeto limpo: campos que um save antigo não tem ficam com o padrão, não com o valor
// do jogo que estava aberto. mes = contador desde o início (1 = Janeiro, Ano 1; ver nomeDoMes).
function finInicial() {
  return { caixa: SALDO_INICIAL, divida: DIVIDA_INICIAL, juros: JUROS_MENSAL, mes: 1, tMes: 0, receitaMes: 0,
           visitantesMes: 0, balanco: null, aviso: '', tAviso: -99 };
}
const fin = finInicial();

const convidados = [];

let tempo = 0;

let selecionado = null;

let selObj = null;   // chave "gx,gy" da âncora do objeto selecionado

const stats = { sairam: 0 };

let tChegada = 1;                           // segundos até a próxima chegada

// Agora lógica (atualizar) e desenho (desenhar) são separados.
let tAnterior = 0;

let ferramenta = { camada: 'terreno', chave: 'CAMINHO' };
let rotacaoAtual = 0;   // rotação (0 ou 1) do objeto que o jogador está posicionando

let modo = null;                 // null | 'mover' (botão do meio) | 'pintar' (botão esquerdo)

let ultimo = { x: 0, y: 0 };

const dentroDoMapa = (gx, gy) => gx >= 0 && gy >= 0 && gx < MAPA && gy < MAPA;

const ehCaminho = (gx, gy) => dentroDoMapa(gx, gy) && mapa[gy][gx] === 'CAMINHO';

function ehEntrada(gx, gy) { return gx === ENTRADA.gx && gy === ENTRADA.gy; }

// Interrompe o que o convidado estava fazendo: volta a passear e decide tudo de novo no próximo tile
function soltarConvidado(g) {
  g.estado = 'andando'; g.uso = null; g.objetivo = null; g.alvo = null; g.anterior = null;
}
