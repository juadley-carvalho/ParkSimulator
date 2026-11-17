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

// Troca o tamanho da grade e deixa tudo vazio (grama, sem objetos). mapa e objetos são const:
// esvaziamos (length = 0) e enchemos de novo as MESMAS listas, em vez de criar outras. Quem limpa o
// resto do parque (atrações, convidados...) é limparParque; aplicarJogo chama esta função depois de validar.
function redimensionarMapa(n) {
  MAPA = n;
  ENTRADA.gx = Math.floor(n / 2);
  ENTRADA.gy = n - 1;
  mapa.length = 0;
  objetos.length = 0;
  for (let i = 0; i < n; i++) { mapa.push(Array(n).fill('GRAMA')); objetos.push(Array(n).fill(null)); }
}

// Convidados ANDANDO em cada tile ("gx,gy" -> quantos). É derivado das posições: refeito a cada passo
// da simulação (atualizarLotacao) e não vai no save.
const lotacao = new Map();

// Estado das atrações com fila, indexado pela âncora ("gx,gy").
const atracoes = new Map();

const rotacoes = new Map();   // âncora -> 1, 2 ou 3 (girado 90°, 180°, 270°); ausente = orientação original
const gestao = new Map();   // âncora -> { precos, receita, usos } (todo objeto que oferece serviços)

// Finanças no início de um jogo novo. É uma função (uma "fábrica") para que o carregamento possa
// partir de um objeto limpo: campos que um save antigo não tem ficam com o padrão, não com o valor
// do jogo que estava aberto. mes = contador desde o início (1 = Janeiro, Ano 1; ver nomeDoMes).
function finInicial() {
  return { caixa: SALDO_INICIAL, divida: DIVIDA_INICIAL, juros: JUROS_MENSAL, mes: 1, tMes: 0, receitaMes: 0,
           visitantesMes: 0, entradasMes: 0, recusasMes: 0, queixasMes: {}, balanco: null, aviso: '', avisoOk: false, tAviso: -99 };
}
const fin = finInicial();

// Dados do parque em si (janela "Parque")
function parqueInicial() { return { nome: NOME_PARQUE_PADRAO, precoEntrada: PRECO_ENTRADA_PADRAO }; }
const parque = parqueInicial();

// Nome para exibir: o campo pode estar vazio enquanto o jogador digita
function nomeDoParque() { return parque.nome.trim() || NOME_PARQUE_PADRAO; }

// Avaliação do parque (ver avaliacao.js). nota = a mostrada; alvo = a última calculada.
// saidas/infelizes e chegadas/recusas = contagens recentes que "esquecem" aos poucos (penalidades).
function avaliacaoInicial() {
  return { nota: NOTA_INICIAL, alvo: NOTA_INICIAL, tCalculo: 0, saidas: 0, infelizes: 0, chegadas: 0, recusas: 0 };
}
const avaliacao = avaliacaoInicial();

// Partida: modo livre ou um cenário com objetivo (ver cenarios.js). Vai no save.
// objetivo = { tipo, valor, prazo (mês final), meses (fechamentos seguidos exigidos) }; liberados =
// chaves de OBJETOS que podem ser construídas (null = todas); inicio = patrimônio no começo (base do
// objetivo "lucro"); sequencia = quantos fechamentos seguidos já cumpriram o objetivo;
// visitantes = quantos entraram desde o começo (objetivo "visitantes").
function partidaInicial() {
  return { modo: 'livre', cenario: null, nome: '', objetivo: null, liberados: null, precosTravados: false,
           inicio: 0, sequencia: 0, visitantes: 0, concluido: false };
}
const partida = partidaInicial();

// Máquina de estados da tela: 'menu' (tela inicial) -> 'jogando' -> 'vitoria' | 'derrota'.
// Fora de 'jogando' o tempo do parque para. Não vai no save (carregar sempre volta a 'jogando').
let fase = 'menu';

// Pode construir este objeto na partida atual?
function objetoLiberado(chave) { return !partida.liberados || partida.liberados.includes(chave); }

const convidados = [];

// Lixo e limpeza (ver lixo.js). sujeira: "gx,gy" -> lista de itens no chão { tipo, dx, dy, giro }
// (tipo: papel, copo, palito ou vomito). lixeiras: âncora "gx,gy" -> itens dentro dela.
const sujeira = new Map();
const lixeiras = new Map();
const funcionarios = [];   // faxineiros: { nome, x, y, alvo, tarefa, trabalho, recolheu, recolheuMes }
let selFunc = null;        // faxineiro selecionado (painel com o botão Demitir)

let tempo = 0;

let selecionado = null;

let selObj = null;   // chave "gx,gy" da âncora do objeto selecionado

const stats = { sairam: 0 };

let tChegada = 1;                           // segundos até a próxima chegada

// Agora lógica (atualizar) e desenho (desenhar) são separados.
let tAnterior = 0;
let tempoReal = 0;         // segundos reais desde o início (anda até pausado: avisos e animações da interface)
let velocidade = 1;        // multiplicador do tempo do jogo (um de VELOCIDADES; 0 = pausado)
let velocidadeAntes = 1;   // a última velocidade não pausada (Espaço volta para ela)

let ferramenta = { camada: 'terreno', chave: 'CAMINHO' };
let rotacaoAtual = 0;   // rotação (0 a 3) da atração que o jogador está posicionando

let modo = null;                 // null | 'mover' (botão do meio) | 'pintar' (botão esquerdo)

let ultimo = { x: 0, y: 0 };

const dentroDoMapa = (gx, gy) => gx >= 0 && gy >= 0 && gx < MAPA && gy < MAPA;

const ehCaminho = (gx, gy) => dentroDoMapa(gx, gy) && mapa[gy][gx] === 'CAMINHO';

function ehEntrada(gx, gy) { return gx === ENTRADA.gx && gy === ENTRADA.gy; }

// Lados do tile (como [dx, dy] de VIZINHOS) que NÃO se ligam a outro caminho: a borda do caminho.
// É onde ficam os bancos (um em cada lado livre), como os acessórios de caminho em jogos do gênero.
function ladosSemCaminho(gx, gy) {
  return VIZINHOS.filter(([dx, dy]) => !ehCaminho(gx + dx, gy + dy));
}

// Interrompe o que o convidado estava fazendo: volta a passear e decide tudo de novo no próximo tile
function soltarConvidado(g) {
  g.estado = 'andando'; g.uso = null; g.objetivo = null; g.alvo = null; g.anterior = null;
}
