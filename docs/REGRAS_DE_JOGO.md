# Regras de jogo, calibragens e detalhes do modelo

Este arquivo guarda o que o `CLAUDE.md` resume: o **porquê** dos valores, as calibragens por simulação e os detalhes
de rotação, bonecos animados, autosave e música. Leia a seção da área em que for mexer.

- Os **números de verdade** moram no código (`config.js`, `OBJETOS` em `objetos.js`, os JSON de `public/cenarios/`).
  Se este texto divergir do código, vale o código: corrija o texto.
- As calibragens abaixo são **registros históricos** (parque, versão e data em que foram medidas). Ao mudar uma regra,
  refaça a medição e acrescente uma linha, em vez de apagar a anterior.

## 1. Mapa, rotação e desenho de objetos grandes

- **Tamanho por partida**: `MAPA` é `let` (config.js) e só `redimensionarMapa(n)` (estado.js) o muda, junto com `ENTRADA`
  (`gx = n/2`, `gy = n − 1`) e as listas `mapa`/`objetos` (esvaziadas e enchidas no lugar). Modo livre: seletor na tela
  inicial (`TAMANHOS_MAPA`: 24, 32, 48, 64); cenários e saves trazem o tamanho no próprio mapa (quadrado, `MAPA_MIN` 16 a
  `MAPA_MAX` 128; saves antigos = 24, sem migração). `aplicarJogo` valida com o tamanho do SAVE e só redimensiona na etapa 2.
  `montarMapaInicial` põe o bloco 24×24 original colado na entrada (no centro, os convidados andavam 30 tiles vazios
  e a nota caía ~70 pontos). `centralizar` mira a região da entrada; `zoomMinimo()` deixa o mapa inteiro caber.
  Desenho só do visível: `vistaNaGrade`/`naVista` (iso.js) em diagonais d = gx − gy, s = gx + gy (objetos com folga).
  Nada pode guardar `MAPA` ou uma linha de `mapa` de uma partida para outra.
- Objetos grandes: `tam: {w,h}` no catálogo. Só atrações giram (`rotacionavel`): tecla Z (`TECLA_GIRAR`) cicla
  `rot` 0→1→2→3; rot ímpar troca w/h (`tamanhoDe(chave, rot)`). `direcoesDe(rot)` dá `eixo` (comprimento) e `frente`
  (lado da entrada), em direções da grade: frente +gy, +gx, −gy, −gx. No desenho, o portal de entrada (ou a estação
  da montanha-russa, na ponta +eixo) mostra a orientação; frente para −gx/−gy (`frenteAtras`) é desenhada ANTES do corpo.
  Roda e navio usam `planoDaAtracao`: girar 180° = inverter o eixo (são simétricos no próprio plano). A prévia
  desenha um "fantasma" do objeto girado. A orientação é só visual: a fila aceita qualquer caminho encostado.
  Funções de desenho recebem `(cx, cy, atr, rot, ancora)`, com (cx, cy) = centro da PEGADA e `ancora` = `{gx, gy}`
  (para olhar os vizinhos, como o banco); na prévia `atr` = undefined e `ancora` = null.
- Desenho por ordem de profundidade (algoritmo do pintor): todo o terreno, depois objetos e convidados numa lista
  ordenada por `x + y`. Ao desenhar, use `ctx.save()/restore()` se mudar estilos (eles persistem entre itens).
  A profundidade de um objeto é o CENTRO da pegada (`gx + gy + (w + h)/2`), não o tile da frente (isso cobria
  árvores encostadas à esquerda). Só é correto com `|w − h| ≤ 1`: atração mais alongada exige ordenação topológica.

## 2. Bonecos animados

- **Bonecos animados** (`ANIMACAO`, `CORES_CALCA`, `FUNCOES` em config.js; desenho.js): convidados e funcionários usam
  o mesmo `desenharBoneco(x, y, pose)`. A pose sai de `poseDoConvidado`/`poseDoFuncionario`, que preenchem SEMPRE o
  mesmo objeto `POSE` (sem criar objetos por quadro). Pernas e braços por senoide da fase `passo` (tiles ANDADOS,
  somados por `registrarPasso`, convidados.js, não tempo: acompanha velocidade, aperto e pausa); `movendo` (deu passo
  no último subpasso) e `olhaX/olhaY` (direção na tela). Poses: sentado (serviço `sentar`), impaciente na fila
  (`uso.espera / paciencia` > 0,4: balança; > 0,7: bate o pé), enjoado (náusea ≥ 50 cambaleia, ≥ 70 rosto verde),
  pulinho de braços para cima (felicidade ≥ 85, a cada ~7 s, desencontrado por uma semente de `ox`, `oy`, `paciencia`).
  **Banco**: `sentarNoBanco` (necessidades.js) põe o convidado no assento (`ASSENTO_BANCO`: lado sem caminho com menos
  gente, 2 lugares por lado, em `uso.lado`/`uso.lugar`); quem está sentado é desenhado pelo próprio banco (`SENTADOS`,
  montado em `desenhar()` antes de desenhar), entre o assento e o encosto. Usam `tempo` (pausa congela). `desenharBoneco` devolve em `POSE` a mão (`maoX/maoY`: lixo, vassoura) e a cabeça (boné).
  Funcionário tem `funcao` (chave de `FUNCOES`; save antigo = faxineiro). Tudo só visual; vai no save com padrão.
  Abaixo de `ANIMACAO.zoomMinimo`, boneco simples. Sem `ctx.save()/restore()` no boneco (caro com centenas): devolve
  `lineWidth`/`lineCap` à mão. Pessoas fora da tela não entram na lista de desenho (`vistaNaGrade(1, 4)`).
  Medido (Edge headless, 300 convidados na tela, 1/3 enjoados e 1/3 felizes): ~1,5 ms simples → ~2,0 ms animado.

## 3. Regras do jogo e calibragens

- **Tela inicial** (`#modalInicio`, classe `fixa`: Esc não fecha): Continuar, Modo livre (o parque de `montarMapaInicial`),
  Carregar save e os cenários. O botão 🏠 volta a ela (pausando). Ao abrir a página há um parque livre parado ao fundo.
- **Cenários** (`public/cenarios/<id>.json`, ordem em `CENARIOS`): mapa como N textos de N letras, N = tamanho (`.` grama, `#`
  caminho, `~` água), `objetos` `[{chave, gx, gy, rot}]`, caixa, dívida, juros, `liberados` (sem = tudo), `precosTravados`
  (brinquedos a $0, ver `precoUso`) e `objetivo {tipo, valor, prazo, meses}`. `validarCenario` confere tudo antes.
  Nos cenários não há a aba 🧪 Teste. Vencer grava o id no `localStorage` (`CHAVE_PROGRESSO`) e libera o próximo.
- **Objetivos** (`TIPOS_OBJETIVO`): `visitantes` (entraram desde o início, `partida.visitantes`), `convidados` (ao mesmo
  tempo), `divida` (zerar) e `lucro` (variação do `patrimonio()` = caixa − dívida + 50% do custo dos objetos, para demolir
  não contar como lucro) vencem na hora; `nota` conta nos fechamentos e exige `meses` SEGUIDOS (`partida.sequencia`).
  Fechar o mês `prazo` sem cumprir = derrota. "N convidados ao mesmo tempo" é fácil demais no 1º mês (o limite vem da
  nota, que começa alta) e "nota num fechamento" também: por isso visitantes acumulados e meses seguidos.
- **Lixo e limpeza** (`LIXO` em config.js, lixo.js): comer/beber deixa um `lixo` na mão (`lixo` no serviço do catálogo:
  papel, copo, palito), segurado 8–30 s conforme `g.capricho`. A cada tile (`chegarNoTile`): lixeira no tile ou ao lado =
  deposita; cheia = larga ao lado dela (transborda); tempo esgotado = chão (só CAMINHO, máx 4 por tile). Sem urgência,
  desvia até lixeira com espaço a até 6 tiles (`irAteLixeira`). Náusea ≥ 40: 20% de chance por tile de vomitar.
  Entrar em tile sujo: −3 felicidade (vômito −6) e queixa, no máximo 1 vez a cada 30 s (sem isso a felicidade despencava).
  `sujeira` (Map "gx,gy" → itens) é desenhada logo após o terreno. **Lixeira**: $50, cap. 30, sobre caminho como o banco
  mas sozinha no tile. **Faxineiro**: aba 👷 da barra (camada `contratar`, clique num caminho), $500 + $150/mês (no
  fechamento, `fin.balanco.salarios`); demite pelo painel (Inspecionar). Tarefa = menor (distância − bônus): vômito −8,
  lixeira ≥ 75% −4, lixo 0; reserva o alvo (`Set`) para dois não irem ao mesmo. No tile da lixeira, esvazia ANTES de
  varrer (senão ficava preso: o transbordo repunha o lixo). Parque livre começa com 2 lixeiras e 1 faxineiro.
  Calibragem (2 meses, parque livre): nada 411 · só lixeiras 403 (enchem) · só faxineiro 431 · lixeiras + 1 faxineiro 586.
- **Funcionários** (`FUNCOES` em config.js: nome, ícone, contratação, salário, passo, uniforme e ferramenta; um cartão
  por função na aba 👷, `ferramenta.chave` = função). `contratarFuncionario(funcao, gx, gy)` e `atualizarFuncionarios`
  (lixo.js) servem a todos; a cada tile, `decidirFuncionario` chama `decidirFaxineiro` ou `decidirMecanico`.
- **Defeitos e mecânicos** (`DEFEITOS` em config.js, manutencao.js): só atrações com fila quebram. `a.desgaste` cresce
  +1/mês de idade e +0,05 por corrida; na PARTIDA de cada corrida (`sortearDefeito`) a chance é 0,3% + 0,15% por ponto
  (máx 6%), e o instante da quebra é sorteado entre 20% e 80% da corrida (`a.quebraEm`): quebra com gente a bordo.
  `quebrar`: a fila se desfaz (queixa `quebrado`, evita 60 s), quem está a bordo fica PRESO (−0,4 felicidade/s, queixa
  `preso`); após 60 s sem conserto em andamento, evacuação (ingresso devolvido por `devolver`, −10 felicidade). Parada:
  `continue` em `atualizarAtracoes` (não gira, não carrega), não conta na variedade da avaliação, rótulo vermelho e
  fumaça. Mecânico ($600 + $200/mês): vai ao caminho encostado na atração quebrada mais perto que nenhum outro pegou
  (`f.conserto` = chave), conserta em 10 s (`consertar`: −30% do desgaste, garantia de 15 corridas sem quebrar; com
  passageiros, a corrida continua de onde parou). Calibragem (parque livre 24, 12 meses): sem mecânico 3 quebras, nota
  ~670 → ~370; com 1 mecânico 13 quebras (1ª no 2º mês), maior parada 27 s, nota ~550 estável; o carrossel (323
  corridas) teve 6 consertos, a roda-gigante (120), 1. Cenários (jogador simulado que contrata mecânico na 1ª quebra):
  Primeiro parque 765 visitantes (meta 700); Lagoa Azul "melhor" cumpre 550 × 3 meses perto do mês 16 (prazo 18);
  Herança falida zerava a dívida no mês 12–13 sem quebras e 14–15 com elas: prazo 12 → 15. **Só ingresso**: a meta de
  $3.000 saía nos meses 8–10 (fácil demais); virou $6.000 em 24 meses. Lucro (variação de `patrimonio()`, já
  descontando as obras) com mecânico na 1ª quebra e dívida quitada aos poucos: ativo (casa assombrada, tobogã, 2
  barracas, 2 lixeiras, faxineiro) $10 → $6.000 no mês 15, $15 → 14, $20 → ~21; médio (bebidas, 2 lixeiras, faxineiro)
  $12 → 18, $18 → 19; entrada $30 ou só mexer no preço (sem lixeiras, a nota cai para ~100): prejuízo. Cuidado ao
  simular: posição fixa que não cabe faz o jogador "não construir nada" (aconteceu: o cenário pareceu inviável).
- **Calendário**: começa em Janeiro, Ano 1. Mês = 300 s (`SEG_POR_MES`, um ano ≈ 1 h) com 30 dias (1 dia = 10 s).
  `fin.mes` é um contador crescente; nome/ano saem de `nomeDoMes`, o dia de `diaDoMes(fin.tMes)` (utils.js).
- **Finanças ($)**: caixa e dívida iniciais $15.000; empréstimo máx $20.000 em parcelas de $1.000; juros 3%/mês
  (editável na tela Finanças). No fechamento: juros + manutenção de todos os objetos saem do caixa
  (pode ficar negativo); o balanço guarda receita e visitantes do mês (`fin.visitantesMes`, contado na chegada).
  Construir cobra `ECONOMIA`/`CUSTO_TERRENO` (sem saldo: não constrói); demolir devolve 50%.
  O preço de uso é por objeto (ferramenta Inspecionar); padrões em `PRECO_PADRAO`. `fin` nasce de `finInicial()`.
- **Chão x objetos**: só objetos `sobreCaminho` (o banco) ficam sobre CAMINHO; os demais nunca (bloqueariam a
  passagem). Trocar grama/caminho sob um objeto é recusado; água afoga o objeto. Demolir solta quem o usava.
  O banco é desenhado em cada lado do tile NÃO ligado a outro caminho (`ladosSemCaminho`); sem lado livre
  (cruzamento) não se constrói, e um caminho novo que feche o último lado remove o banco (com reembolso).
- **Brinquedo aquático** (`naAgua`): a pegada inteira é ÁGUA. Com `canais: true` (o passeio de barco), os **canais** (`canaisDe`: a fileira
  logo à frente, saída dos barcos, e a logo atrás, por onde voltam) têm de ser água sem objeto. Canal pode ser dividido
  entre dois passeios, mas a pegada de um não pode cair no canal de outro (`donoDoCanal`). Trocar o chão sob ele ou
  nos canais é recusado. A fila liga pelas laterais (caminho encostado). A prévia mostra os canais tracejados.
  A corredeira é `naAgua` sem canais: o bote dá a volta dentro da própria pegada 3×3 (`voltas: 1`, para na doca).
- **Convidados** andam a `VELOCIDADE` ±15% (`g.velocidade`, sorteada em `semear`); a atratividade usa a velocidade dele.
- **Parque** (janela 🎡, `parque` em estado.js): nome (até 30 caracteres, só via `textContent`/`document.title`) e
  preço de entrada (padrão $0). O ingresso é cobrado na chegada (`pagarEntrada`); quem acha caro (preço >
  `fracaoMaxEntrada()` do dinheiro que trouxe: 15% a 45% conforme a avaliação, 30% com nota 500) desiste no portão
  (`fin.recusasMes`). Com a regra antiga (30% fixo) o lucro mensal era máximo perto de $20.
- **Chegada/saída**: convidados entram pela `ENTRADA` (meio da borda de baixo, protegido) a cada 3–8 s × `escalaChegada()`
  (pela avaliação) com $30–150. **Sem limite de convidados ao mesmo tempo** (o antigo `maxConvidados`, 25 a 80, saiu;
  parque 24×24 em 6 meses: pico ~65, média ~50, +5% de visitantes). Isso deixou a Lagoa Azul inviável (nota ~530) e o
  Primeiro parque fácil (760 visitantes): metas recalibradas na v1.9.0 (550 por 3 meses; 700 visitantes).
- **Superlotação** (`LOTACAO` em config.js, `atualizarLotacao` em convidados.js, chamada em `simular` ANTES de `atualizar`):
  `lotacao` (Map "gx,gy" → convidados ANDANDO, derivado, fora do save) é refeito a cada passo. Densidade de um convidado =
  gente no tile dele + 4 vizinhos ÷ tiles de CAMINHO entre esses 5 (caminho largo = mais tiles = menos denso). Acima de
  `limite` (2,5): perde `felicPorSeg` × excesso por segundo (máx `felicMax`), passo × (1 − 0,25 × excesso) (mín 0,5;
  `fatorDeLotacao`), queixa `lotado` com excesso ≥ 0,5. Efeito contínuo com dt (não "ao entrar no tile", como a sujeira).
  Tiles lotados ganham mancha vermelha (`desenharLotacao`); janela do parque, seção Lotação (`resumoLotacao`). Quem
  espera/brinca/usa não conta. Com limite 1,5 o cruzamento do parque inicial já lotava (nota 585 → 517); com 2,5 o
  parque inicial perde pouco, e no cenário cheio alargar o cruzamento devolve 30–50 pontos.
  Saem se felicidade ≤ 10 ou dinheiro < $2, andando até a entrada. Só andam em CAMINHO; se o chão some, BFS até o
  caminho mais próximo (atravessa grama, nunca água).
- **Avaliação** (0–999, `avaliacao` em estado.js, avaliacao.js): soma de partes (`partesDaAvaliacao`, pesos em
  `AVALIACAO`): felicidade média ×4 (400) + 40 por TIPO de atração (até 200) + serviços existentes entre comida,
  bebida, banheiro e descanso (150) + necessidades em dia (250) − fração das saídas recentes por infelicidade ×150 −
  fração das chegadas recusadas no portão ×100 − sujeira (itens no chão por tile de caminho, vômito = 2) ×150. Sem convidados, valores neutros (felicidade 60). Recalculada a cada
  5 s; a nota exibida persegue o alvo (suavização). As contagens das penalidades decaem (meia-vida ≈ 0,7 mês). Penalidade
  por cabeça (proposta original) saturava: ~85% das visitas terminam por felicidade ≤ 10. Parque inicial: ≈ 590.
- **Pensamentos** (`PENSAMENTOS` em config.js): `pensar(g, tipo)` mostra um balão por 3 s e soma em `fin.queixasMes`
  (o balanço do mês guarda `queixas` e `nota`); a mesma queixa do mesmo convidado só conta de novo após 30 s
  (`g.pensou`). Gatilhos: saiu da fila (fila), necessidade urgente sem serviço (fome/sede/banheiro, ou caro se existe
  mas ele não pode pagar), brinquedo intenso demais, saiu infeliz (embora), desistiu no portão (entrada, sem balão).
- **Necessidades**: a cada tile novo, `decidirNecessidade`: urgência ≥ `LIMIAR_URGENCIA` (0.6) → BFS só por caminhos
  até um objeto vizinho que ofereça o serviço, que o convidado pague e aceite. Serviço simples: o mais próximo.
  Atração com fila: a de maior `atratividade` > 0 (felicidade líquida: ganho − preferência de intensidade − custo
  de andar e de esperar `esperaEstimada` − preço; pesos em config.js). Diversão é buscada com felicidade ≤ 55.
  Serviço = `servicos` no catálogo (atividade, duração, efeitos; `capacidade` = tem fila; opcionais `nome` e `icone`
  trocam o rótulo do preço e o ícone sobre a cabeça, ver `iconeDoUso`). Fome/sede satisfeitas aumentam o banheiro.
  A sorveteria oferece `comida` (mais leve, mas também tira sede e dá felicidade): compete com a barraca pela distância.
- **Intensidade x tolerância (1–10)**: aceita brinquedo até ±2 pontos; com felicidade ≤ 25 aceita qualquer um, pagando
  por ponto excedente −5 felicidade e +6 náusea (se mais intenso que o suportável). Ver `efeitosFinais`.
- **Filas**: máx 12; paciência 25–45 s; o ingresso é cobrado no embarque; parte lotada ou 5 s após o 1º passageiro.
  Atração de circuito (`voltas`) dá voltas exatas e o trem volta à estação.

| Chave | Pegada | Custo / manut. mês | Preço padrão | Brinquedo: intensidade · lugares · duração |
|---|---|---|---|---|
| ARVORE | 1×1 | $30 / $2 | | |
| BANCO | 1×1 | $60 / $5 | grátis | só sobre CAMINHO |
| LIXEIRA | 1×1 | $50 / $3 | | só sobre CAMINHO; capacidade 30 |
| BARRACA (de comida) | 1×1 | $350 / $80 | comida $4 | |
| BARRACA_BEBIDAS | 1×1 | $350 / $40 | bebida $3 | |
| BARRACA_SORVETE | 1×1 | $400 / $60 | sorvete $3 | |
| BANHEIRO | 1×1 | $350 / $50 | grátis | |
| CARROSSEL | 2×2 | $800 / $100 | $5 | 5 · 6 · 8 s |
| NAVIO_PIRATA | 3×2 | $900 / $120 | $7 | 7 · 10 · 18 s |
| RODA_GIGANTE | 3×2 | $700 / $100 | $6 | 2 · 8 · 20 s |
| MONTANHA_RUSSA | 4×3 | $1.200 / $200 | $8 | 8 · 12 · 25 s (2 voltas) |
| BARCOS (passeio de barco) | 3×2 + canais | $750 / $90 | $4 | 3 · 8 (4 barcos) · 16 s (1 volta), só na água |
| CASA_ASSOMBRADA | 2×2 | $1.000 / $110 | $6 | 4 · 8 · 15 s (quase sem náusea) |
| CORREDEIRA (rafting) | 3×3 | $1.100 / $130 | $7 | 6 · 6 (1 bote) · 20 s (1 volta), só na água, sem canais |
| TREM | 4×3 | $950 / $70 | $4 | 3 · 12 (loco + 3 vagões) · 30 s (2 voltas), energia +5 |
| TOBOGA (tobogã) | 3×2 | $600 / $60 | $3 | 5 · 6 · 14 s, descem um de cada vez (`voltas: 1` = fração da corrida) |

Efeitos exatos de cada serviço: `OBJETOS` em `objetos.js`. Atrações grandes não ficam sobre CAMINHO nem água (exceto as `naAgua`).

## 4. Autosave e música

- **Autosave** (salvar.js, seletor na janela 💾): `OPCOES_AUTOSAVE` desligado | minuto (60 s REAIS com a fase
  `jogando`, mesmo pausado) | mes | ano (virada = `fin.mes` crescer de 1; o ano vira quando o novo mês é Janeiro).
  Grava sempre no id `autosave` ("Autosave · nome do parque"), sem esperar (o jogo segue); trava `autosave.salvando`.
  Jogo novo/carregado chama `reiniciarAutosave()` (o mês do save carregado não é virada). Preferência no `localStorage`.
  `avisar(msg, true)` = aviso verde; o aviso é um balão abaixo da barra (fora do fluxo, não alarga a barra).
- Música de fundo: o botão alterna `musica.modo` = mp3 (🎵, os `.mp3` de `public/musicas/`, listados em
  `GET /api/musicas`, em ordem embaralhada) → sintetizada (🎹, `ParkAudio.js`: Web Audio, ruído rosa filtrado como
  multidão + valsa de realejo composta na hora: seções de 8 compassos com `PROGRESSOES` de acordes sorteadas, tom e
  andamento variando, melodia por notas do acorde perto da anterior, "um-pá-pá" e sininho; agendada no relógio do
  áudio com 1,5 s de antecedência, não nota a nota com setTimeout) → desligada (🔇). Sem mp3, pula esse modo. Preferência `musicaModo` no `localStorage`
  (a chave antiga `musicaLigada` = 'nao' vira desligada). O navegador só toca após o 1º clique/tecla (o AudioContext
  nasce "suspended"; a primeira interação chama `resume()`). Cada cobrança positiva em `pagar()` (lojas e embarque
  em brinquedos) toca um tilintar sintetizado em Web Audio: um `AudioBuffer` é criado uma vez e cada compra inicia
  uma fonte independente, sem limite de sobreposição. O ganho dos efeitos (`VOLUME_EFEITOS`) é separado do ganho
  da música, então o efeito continua mesmo com a música desligada. `ParkAudio.js` foi escrito como módulo: sem o
  `export` (scripts clássicos).
- **Valores flutuantes**: compras pagas exibem `+$valor` sobre o convidado; ao fechar o mês, cada objeto com
  manutenção e cada funcionário com salário exibem `−$valor` na própria posição. Os textos amarelos sobem,
  enquanto despesas negativas aparecem em vermelho; todos mostram dois dígitos de centavos (ex.: `+$2,00`,
  `−$12,30`). Surgem no instante da transação, sobem, desaparecem em 1,4 s de jogo e respeitam pausa/velocidade.
  São efeitos visuais temporários, não fazem parte do save.
