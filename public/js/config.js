/* ============================================================
   config.js — constantes e valores de balanceamento (mexa aqui para ajustar o jogo)
   Só dados: não depende de nenhum outro arquivo.
   ============================================================ */

const TILE_W = 64, TILE_H = 32, PROFUNDIDADE = 14;

// Tamanho da grade (MAPA x MAPA). É "let" porque cada partida escolhe o seu: o modo livre oferece
// TAMANHOS_MAPA na tela inicial, e cenários e saves trazem o tamanho no próprio mapa. Só
// redimensionarMapa (estado.js) muda este valor. Saves e cenários aceitam de MAPA_MIN a MAPA_MAX.
let MAPA = 24;
const MAPA_PADRAO = 24;
const TAMANHOS_MAPA = [24, 32, 48, 64];
const MAPA_MIN = 16, MAPA_MAX = 128;

// Fonte dos textos desenhados no canvas (a mesma da interface, declarada em style.css)
const FONTE_JOGO = "'Fredoka', 'Segoe UI', sans-serif";

// Catálogo de terrenos
const TIPOS = {
  GRAMA:   { nome: 'Grama', icone: '🌱',   cor: ['#6fbf5a', '#65b350'], corRetro: ['#6fbf5a', '#65a950'] },
  CAMINHO: { nome: 'Caminho', icone: '👣', cor: ['#cbb98b', '#c3b082'], corRetro: ['#cbb98b', '#c3b064'] },
  AGUA:    { nome: 'Água', icone: '💧',    cor: ['#4aa3d8', '#429bd0'], corRetro: ['#4aa3d8', '#429bca'] },
};
// corRetro: o par do quadriculado nos estilos retrô. Os dois tons de `cor` são tão próximos que o filtro de paleta
// (#retro em index.html) os funde e a grade some; estes foram escolhidos para continuarem DISTINTOS depois dele.
// Mudou os níveis do filtro? Reescolha estes pares (o teste de fumaça confere).

// Categorias da barra de construção (a ordem aqui é a ordem das abas). Cada objeto do catálogo
// escolhe a sua em "categoria"; sem categoria, cai em "cenario". Categoria vazia não aparece.
const CATEGORIAS = [
  { id: 'ferramentas', nome: 'Ferramentas', icone: '🧰' },
  { id: 'terreno',     nome: 'Terreno',     icone: '⛰️' },
  { id: 'cenario',     nome: 'Cenário',     icone: '🌳' },
  { id: 'servicos',    nome: 'Serviços',    icone: '🍔' },
  { id: 'atracoes',    nome: 'Atrações',    icone: '🎢' },
  { id: 'funcionarios', nome: 'Funcionários', icone: '👷' },
  { id: 'teste',       nome: 'Teste',       icone: '🧪' },
];

const ECONOMIA = {          // custo = construção; manutencao = por mês
  ARVORE:    { custo: 30,   manutencao: 2 },
  BANCO:     { custo: 60,   manutencao: 5 },
  BARRACA:   { custo: 350,  manutencao: 80 },
  BANHEIRO:  { custo: 350,  manutencao: 50 },
  CARROSSEL: { custo: 800, manutencao: 100 },
  RODA_GIGANTE: { custo: 700, manutencao: 100 },
  MONTANHA_RUSSA: { custo: 1200, manutencao: 200 },
  BARRACA_BEBIDAS: { custo: 350, manutencao: 40 },
  NAVIO_PIRATA: { custo: 900, manutencao: 120 },
  BARRACA_SORVETE: { custo: 400, manutencao: 60 },
  BARCOS: { custo: 750, manutencao: 90 },
  LIXEIRA: { custo: 50, manutencao: 3 },
  CASA_ASSOMBRADA: { custo: 1000, manutencao: 110 },
  CORREDEIRA: { custo: 1100, manutencao: 130 },
  TREM: { custo: 950, manutencao: 70 },
  TOBOGA: { custo: 600, manutencao: 60 },
};

const PRECO_PADRAO = { BANCO: { descanso: 0 }, BARRACA: { comida: 4 }, BARRACA_SORVETE: { comida: 3 },
                      BANHEIRO: { banheiro: 0 }, CARROSSEL: { diversao: 5 },
                      RODA_GIGANTE: { diversao: 6 },
                      MONTANHA_RUSSA: { diversao: 8 },
                      BARRACA_BEBIDAS: { bebida: 3 }, NAVIO_PIRATA: { diversao: 7 },
                      BARCOS: { diversao: 4 }, CASA_ASSOMBRADA: { diversao: 6 }, CORREDEIRA: { diversao: 7 },
                      TREM: { diversao: 4 }, TOBOGA: { diversao: 3 } };

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

// Animação de caminhada (só visual: não muda nenhuma regra). A fase do passo cresce com a DISTÂNCIA
// andada, não com o tempo: quem anda mais rápido mexe as pernas mais depressa, o aperto da multidão
// (que encurta o passo) aparece nas pernas e o pé não "patina" sobre o chão.
const ANIMACAO = {
  ciclosPorTile: 1.25,   // passadas completas (esquerda + direita) por tile: a 1,6 tile/s dá 2 por segundo
  perna: 2.2,            // quanto o pé vai para frente/trás (px de mundo)
  braco: 1.6,            // balanço da mão, ao contrário da perna do mesmo lado
  quique: 0.8,           // o corpo sobe um pouco a cada passo
  zoomMinimo: 0.5,       // abaixo deste zoom os membros teriam ~1 px: volta o boneco simples
  // Poses (todas só visuais). Usam o relógio do JOGO (tempo): na pausa, todo mundo congela.
  pulo: { felicidade: 85, intervalo: 7, duracao: 0.45, altura: 4 },   // bem feliz: um pulinho de braços para cima a cada ~7 s
  impaciencia: { desde: 0.4, balanco: 1.4, batePe: 0.7 },   // na fila: fração da paciência gasta; batendo o pé a partir de 70%
  nausea: { desde: 50, verde: 70, inclina: 1.6 },           // cambaleia a partir de 50 de náusea; rosto esverdeado a partir de 70
};
const ANIMACAO_DINHEIRO = {
  duracao: 1.4, elevacao: 30, subida: 24, separacao: 15, fonte: 16, fade: 0.3, janelaEmpilhamento: 0.3,
};
// Funções de funcionário: contratação, salário (cobrado no fechamento do mês), passo (tiles/s) e o
// uniforme (a cor da roupa diz o que ele faz). A aba 👷 da barra ganha um cartão para cada função.
const FUNCOES = {
  faxineiro: { nome: 'Faxineiro', icone: '🧹', contratacao: 500, salario: 150, velocidade: 1.5,
               camisa: '#2e7d32', calca: '#1b5e20', bone: '#1b5e20', ferramenta: 'vassoura',
               dica: 'Limpa vômito, recolhe lixo e esvazia lixeiras.' },
  mecanico:  { nome: 'Mecânico', icone: '🔧', contratacao: 600, salario: 200, velocidade: 1.7,
               camisa: '#1565c0', calca: '#0d47a1', bone: '#ef6c00', ferramenta: 'chave',
               dica: 'Conserta os brinquedos quebrados (vai ao mais perto que ninguém está atendendo).' },
};

// ---------- Defeitos dos brinquedos (ver manutencao.js) ----------
// Só atrações com fila quebram (lojas, banheiros, bancos e lixeiras não). O DESGASTE cresce com a idade e
// com o uso; a chance de quebrar é sorteada a cada corrida e cresce com o desgaste. Assim um brinquedo
// popular (mais corridas por mês) envelhece mais depressa e quebra mais cedo que um pouco usado.
const DEFEITOS = {
  desgastePorMes: 1,         // idade: +1 ponto por mês de jogo
  desgastePorCorrida: 0.05,  // uso: +1 ponto a cada 20 corridas
  chanceBase: 0.003,         // chance por corrida de um brinquedo novo (0,3%)...
  chancePorDesgaste: 0.0015, // ...mais 0,15% por ponto de desgaste...
  chanceMax: 0.06,           // ...até 6% por corrida
  reparoTira: 0.3,           // o conserto tira 30% do desgaste (velho consertado continua mais frágil que novo)
  garantia: 15,              // e garante as próximas 15 corridas sem quebrar
  tempoConserto: 10,         // segundos de trabalho do mecânico
  presoFelicPorSeg: 0.4,     // quem ficou preso no brinquedo perde felicidade por segundo...
  resgate: 60,               // ...até o conserto, ou até a equipe evacuar após 60 s (ingresso devolvido)
  resgateFelic: 10,          // felicidade perdida a mais por quem é evacuado
  evitar: 60,                // segundos que quem estava na fila evita o brinquedo quebrado
};
// Assento do banco (desenharBanco e sentarNoBanco usam as mesmas medidas): a "dist" do centro do tile, em
// direção a cada lado sem caminho; cabem 2 pessoas por lado, a ±"espaco" ao longo dele; "altura" em px
const ASSENTO_BANCO = { dist: 0.3, espaco: 0.1, altura: 6 };
// Cores de calça (sorteadas em semear): a camisa sozinha deixava muitos convidados parecidos
const CORES_CALCA = ['#2f4f7f', '#3b5d99', '#37474f', '#212121', '#6d4c41', '#8d7b5a', '#2e5e3a', '#5d4037'];

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
const ICONES = { comida: '🍔', bebida: '🥤', descanso: '💤', banheiro: '🚻', diversao: '🎠', saida: '👋', lixo: '🗑️' };

const FILA_MAX = 12;       // acima disso, quem chega desiste e tenta outra coisa

const TEMPO_CARGA = 5;     // segundos esperando passageiros antes de partir meio vazio

// Tile da borda por onde todos entram e saem (já é CAMINHO): meio da borda de baixo.
// O objeto é constante, mas gx e gy mudam com o tamanho do mapa (redimensionarMapa).
const ENTRADA = { gx: MAPA / 2, gy: MAPA - 1 };

// Volume da música de fundo (0 a 1). As faixas são os .mp3 de public/musicas (ver musica.js).
const VOLUME_MUSICA = 0.35;
// Volume dos efeitos sonoros (0 a 1), independente da música de fundo.
const VOLUME_EFEITOS = 0.05;

// Parque: nome e ingresso (editáveis na janela "Parque"). O ingresso é cobrado na chegada, e o
// convidado só entra se ele custar até uma fração do dinheiro que trouxe: de FRACAO_ENTRADA_MIN (parque
// com avaliação 0) a FRACAO_ENTRADA_MAX (avaliação máxima). Com avaliação 500 e $100 no bolso, até $30.
// Preço alto = menos gente entrando e menos dinheiro sobrando para os brinquedos e barracas.
const NOME_PARQUE_PADRAO = 'Meu parque', NOME_PARQUE_MAX = 30;
const PRECO_ENTRADA_PADRAO = 0;
const FRACAO_ENTRADA_MIN = 0.15, FRACAO_ENTRADA_MAX = 0.45;

// Velocidades do jogo (0 = pausa), escolhidas na barra superior ou pelas teclas: Espaço pausa/retoma,
// 1, 2 e 3 = 1x, 2x e 4x. PASSO_MAX = maior passo de simulação: em 4x o quadro vira vários subpassos.
const VELOCIDADES = [0, 1, 2, 4];
const PASSO_MAX = 0.1;

// Salvamento automático (escolhido na janela de saves; a preferência fica no localStorage). Grava sempre
// no mesmo save (ID_AUTOSAVE), substituindo o anterior. "minuto" conta tempo REAL com o jogo aberto.
const OPCOES_AUTOSAVE = { desligado: 'Desligado', minuto: 'A cada 1 minuto', mes: 'A cada virada de mês', ano: 'A cada virada de ano' };
const ID_AUTOSAVE = 'autosave', CHAVE_AUTOSAVE = 'parque.autosave', INTERVALO_AUTOSAVE = 60;

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

// ---------- Avaliação do parque (0 a NOTA_MAX, ver avaliacao.js) ----------
// A nota é a SOMA de partes; cada fator vale até o seu peso em pontos. Penalidades descontam.
const NOTA_MAX = 999, NOTA_INICIAL = 500;
const AVALIACAO = {
  felicidade: 400,      // felicidade média dos convidados (0..100) x 4
  porTipoAtracao: 40,   // variedade: cada TIPO diferente de atração (o 2º carrossel não conta)...
  variedade: 200,       // ... até este total
  servicos: 150,        // dividido entre os serviços de SERVICOS_AVALIADOS que existem no parque
  necessidades: 250,    // quão longe do pior estão fome, sede, banheiro e náusea, em média
  // Penalidades por PROPORÇÃO (contar por cabeça saturaria: a maioria das visitas termina por tédio):
  infelizes: 150,       // fração das saídas recentes que foram por infelicidade x 150
  recusas: 100,         // fração das chegadas recentes que desistiram no portão x 100
  sujeira: 150,         // sujeira no chão (vômito vale 2 itens) por tile de caminho, x 150...
  sujeiraSatura: 1,     // ... chegando ao máximo com 1 item por tile de caminho
  amostraMinima: 10,    // denominador mínimo: o 1º convidado infeliz não vale 100%
  // Sem convidados no parque, os fatores que dependem deles usam estes valores neutros
  felicidadeNeutra: 60, necessidadesNeutras: 0.6,
};
const SERVICOS_AVALIADOS = ['comida', 'bebida', 'banheiro', 'descanso'];
const INTERVALO_AVALIACAO = 5;   // s entre um cálculo e outro
const SUAVIZAR_AVALIACAO = 15;   // s: a nota mostrada persegue a calculada, sem saltos
// Ritmo de chegada: o intervalo sorteado (3 a 8 s) é multiplicado por 2^((500 - nota) / 500):
// nota 0 = 2x mais lento, 500 = normal, 999 = quase 2x mais rápido.

// ---------- Pensamentos (balão sobre a cabeça e queixas do mês) ----------
const PENSAMENTOS = {
  fila:     { icone: '😤', texto: 'Que fila demorada!' },
  fome:     { icone: '🍔', texto: 'Estou com fome e não acho comida' },
  sede:     { icone: '🥤', texto: 'Estou com sede e não acho bebida' },
  banheiro: { icone: '🚻', texto: 'Preciso de um banheiro!' },
  caro:     { icone: '💸', texto: 'Está tudo caro demais!' },
  intenso:  { icone: '🤢', texto: 'Esse brinquedo foi intenso demais!' },
  entrada:  { icone: '🎟️', texto: 'Ingresso caro demais!' },
  embora:   { icone: '😞', texto: 'Este parque é chato, vou embora' },
  sujeira:  { icone: '🗑️', texto: 'Que sujeira!' },
  nojo:     { icone: '😖', texto: 'Que nojo, pisei em vômito!' },
  enjoo:    { icone: '🤮', texto: 'Passei mal...' },
  lotado:   { icone: '😣', texto: 'Que aperto! Lotado demais aqui' },
  quebrado: { icone: '🛠️', texto: 'O brinquedo quebrou!' },
  preso:    { icone: '😰', texto: 'Fiquei preso no brinquedo!' },
};

// ---------- Superlotação (ver atualizarLotacao em convidados.js) ----------
// Densidade de um convidado = convidados ANDANDO no tile dele e nos 4 vizinhos, dividido pelo número de
// tiles de CAMINHO entre esses 5. Caminho de 1 tile de largura tem 3 tiles na vizinhança (o dele + 2);
// alargado para 2, tem 4 ou 5: a mesma multidão fica menos densa. Acima do "limite", cada unidade de
// excesso tira felicidade por segundo e deixa o passo mais lento (ele fica mais tempo no aperto).
const LOTACAO = {
  limite: 2.5,          // convidados por tile de caminho (com 1,5 o cruzamento do parque inicial já lotava)
  felicPorSeg: 1,       // felicidade perdida por segundo, por unidade acima do limite...
  felicMax: 2.5,        // ...até este máximo por segundo
  queixaA: 0.5,         // excesso a partir do qual ele reclama (balão): aperto leve só incomoda
  lentidao: 0.25,       // velocidade cai 25% por unidade acima do limite...
  velocidadeMin: 0.5,   // ...até a metade
};
const DURACAO_PENSAMENTO = 5;     // s que o balão fica na tela
const INTERVALO_PENSAMENTO = 30;  // s até o mesmo convidado repetir a MESMA queixa (senão contaria a cada tile)

// ---------- Cenários (ver cenarios.js; cada um é um arquivo public/cenarios/<id>.json) ----------
// A ORDEM desta lista é a ordem de desbloqueio: concluir um cenário libera o seguinte.
const CENARIOS = ['primeiro-parque', 'lagoa-azul', 'heranca-falida', 'so-ingresso'];
const CHAVE_PROGRESSO = 'parque.cenariosConcluidos';   // localStorage: ids dos cenários já vencidos

// ---------- Lixo, lixeiras e faxineiros (ver lixo.js) ----------
const LIXO = {
  // Quem come ou bebe fica com o lixo na mão e o segura de seguraMin a seguraMax segundos, conforme o
  // "capricho" dele (0 a 1, sorteado na chegada). Se acha uma lixeira até "desvio" tiles de caminho, vai até ela.
  seguraMin: 8, seguraMax: 30, desvio: 6,
  maxPorTile: 4,                          // itens de sujeira num mesmo tile
  capacidadeLixeira: 30, esvaziarEm: 0.75, // o faxineiro esvazia a partir de 75% da capacidade
  pisarLixo: 3, pisarVomito: 6,           // felicidade perdida ao ENTRAR num tile sujo
  nauseaVomito: 40, chanceVomito: 0.2,    // chance de vomitar a cada tile andado com náusea >= 40
  aliviaVomito: 40, felicVomito: 5,       // depois de vomitar: menos náusea, um pouco menos de felicidade
  tempoLixo: 1, tempoVomito: 3, tempoLixeira: 2,   // segundos de trabalho do faxineiro
  // Prioridade do faxineiro: escolhe a tarefa de menor (distância − bônus): vômito "parece" 8 tiles mais perto
  bonusVomito: 8, bonusLixeira: 4,
  // (contratação, salário e passo do faxineiro: FUNCOES.faxineiro)
};

// Estilo visual (botão 🎨 da barra superior). `escala`: cada "pixel" do desenho ocupa escala x escala
// pixels da tela (1 = original). `paleta`: reduz as cores com o filtro SVG #retro (index.html).
// O primeiro da lista é o padrão. A escolha fica no localStorage (CHAVE_ESTILO).
const ESTILOS_VISUAIS = [
  { id: 'original', nome: 'Original', escala: 1, paleta: false },
  { id: 'retro2', nome: 'Retrô 2×', escala: 2, paleta: true },
  { id: 'retro3', nome: 'Retrô 3×', escala: 3, paleta: true },
];
const CHAVE_ESTILO = 'parque.estiloVisual';
