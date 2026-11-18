# Parque de Diversões — Documentação técnica

Referência para quem vai ler, manter ou estender o código do jogo (versão **v1.10.0**). Todos os números
abaixo foram conferidos no código (`public/js/config.js`, `public/js/objetos.js`, `public/cenarios/*.json`);
se mudar o balanceamento, atualize este arquivo. O manual do jogador fica em `docs/manual/`.

Sumário

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Referência de funções por arquivo](#4-referência-de-funções-por-arquivo)
5. [Constantes de `config.js`](#5-constantes-de-configjs)
6. [Catálogo de objetos](#6-catálogo-de-objetos)
7. [Regras de simulação](#7-regras-de-simulação)
8. [Cenários e objetivos](#8-cenários-e-objetivos)
9. [Save/Load e API HTTP](#9-saveload-e-api-http)
10. [Música](#10-música)
11. [Interface](#11-interface)
12. [Como estender](#12-como-estender)
13. [Armadilhas conhecidas e observações](#13-armadilhas-conhecidas-e-observações)

---

## 1. Visão geral

Simulador de parque de diversões isométrico inspirado em *RollerCoaster Tycoon*. JavaScript puro no navegador
(desenho num único `<canvas>`), servido por Node.js + Express 4. Sem bundler, sem módulos ES, sem framework;
a única dependência é `express`.

### Como rodar

```
npm install
npm start          # http://localhost:3000
npm run dev        # reinicia ao editar server.js (node --watch; Node >= 18.11)
```

| Variável | Padrão | Efeito |
|---|---|---|
| `PORT` | `3000` | porta do servidor (bash `PORT=8080 npm start`, PowerShell `$env:PORT=8080; npm start`) |
| `SAVES_DIR` | `./saves` | pasta dos saves (um `.json` por save, fora do git) |

O código em `public/` não exige reiniciar o servidor: basta recarregar a página (os estáticos vão com
`Cache-Control: no-cache` e sem ETag).

### Estrutura de pastas

```
server.js              Express: estáticos de public/, API de saves (/api/saves) e lista de músicas (/api/musicas)
armazenamento.js       camada de armazenamento dos saves (listar, ler, gravar, apagar) em arquivos JSON
package.json           scripts start/dev; dependência: express
saves/                 criada sob demanda; um <id>.json por save (fora do git)
docs/                  esta documentação e o manual do jogador (docs/manual/)
public/
  index.html           estrutura da página (canvas, barra, HUD, janelas) e ORDEM dos <script>
  favicon.svg
  css/style.css        tema único de jogo (variáveis no :root), janelas, barra, painéis
  fonts/               Fredoka (fredoka-latin.woff2, licença OFL.txt), funciona offline
  musicas/             .mp3 opcionais para a música de fundo (LEIA-ME.md)
  cenarios/            primeiro-parque, lagoa-azul, heranca-falida, so-ingresso (.json)
  js/                  22 scripts clássicos (tabela abaixo)
```

### Ordem dos scripts (e por que ela importa)

Os scripts de `public/js/` são **clássicos** e compartilham o **escopo global**: uma função ou `const` de um
arquivo é visível em todos os outros. O `index.html` os carrega nesta ordem:

```
config → utils → dom → estado → iso → desenho → objetos → atracoes → necessidades → convidados → entrada
→ financas → avaliacao → lixo → ui → barra → salvar → cenarios → ParkAudio → musica → input → main
```

- **Código de nível superior** (executado na carga) só pode usar o que já foi carregado. Ex.: `OBJETOS`
  (objetos.js) cita as funções `desenhar*` ao ser criado, então `desenho.js` vem antes; `estado.js` usa `MAPA`,
  `SALDO_INICIAL` etc. de `config.js`; `musica.js` faz `new ParkAudio()` na carga, então `ParkAudio.js` vem antes.
- **Dentro de funções** a ordem não importa: elas só rodam depois que todos os scripts carregaram
  (por exemplo, `objetos.js` chama `novaAtracao`, de `atracoes.js`, dentro de `construir`).
- **TDZ (*temporal dead zone*)**: `const f = () => ...` não existe antes da linha que a define
  ("Cannot access 'f' before initialization"). Funções usadas na montagem inicial do mapa são `function`
  declarations (estas sofrem *hoisting*: existem desde o início do script).
- `main.js` é sempre o último: ele liga a interface (`iniciar*`), monta o parque de fundo e chama
  `requestAnimationFrame(loop)`.
- Arquivo novo = tag nova na posição certa do `index.html`.

---

## 2. Arquitetura

### Estado × lógica × desenho

| Camada | Arquivos | Regra |
|---|---|---|
| Dados | `estado.js` (+ `fin`, `parque`, `partida`, `avaliacao`, mapas `Map`) | só dados mutáveis e consultas simples |
| Lógica | `atualizar*(dt)` em convidados, atracoes, lixo, financas, entrada, avaliacao, cenarios | alteram o estado; nunca desenham |
| Desenho | `desenho.js` | só lê o estado e pinta o canvas |
| Interface HTML | `ui.js`, `barra.js`, `salvar.js`, `cenarios.js`, `musica.js` | painéis, janelas e botões |
| Entrada | `input.js` (mouse, roda, tecla Z), `ui.js` (Esc, Espaço, 1/2/3) | `aplicar(gx, gy)` é a única função que muda o mapa por ação do jogador |

Tempo sempre em **segundos** (`dt`), nunca em contagem de quadros.

### O laço principal (`main.js`)

```
loop(t):
  dtReal = min((t − tAnterior)/1000, 0,1)        // volta de outra aba não "teleporta" ninguém
  tempoReal += dtReal
  resta = fase === 'jogando' ? dtReal × velocidade : 0
  enquanto resta > 0 e fase === 'jogando':
      simular(min(resta, PASSO_MAX))               // subpassos de no máximo 0,1 s
  atualizarAutosave(dtReal)                        // tempo REAL
  desenhar(); atualizar HUD, painéis, finanças, janela do parque, barra e objetivo
  requestAnimationFrame(loop)

simular(dt):
  tempo += dt
  atualizarLotacao → atualizar (convidados) → atualizarFuncionarios → atualizarAtracoes
  → atualizarFinancas → atualizarEntrada → atualizarAvaliacao → atualizarPartida
```

- **Subpassos**: em 4× um quadro vale 0,4 s de jogo. Um passo único faria o convidado pular tiles inteiros (e
  as decisões tomadas ao chegar em cada tile); por isso o tempo é fatiado em passos de até `PASSO_MAX` (0,1 s).
  O laço para no meio se a fase mudar (um cenário vencido no 2º subpasso não roda o 3º).
- **Lógica nova vai em `simular(dt)`**, nunca direto no `loop` (senão ignora pausa e velocidade).
- `atualizarLotacao` roda antes de `atualizar` porque o passo de cada convidado depende do aperto.

### Fases (`fase`, estado.js)

`'menu'` (tela inicial) → `'jogando'` → `'vitoria'` | `'derrota'`. O `loop` só chama a simulação em
`'jogando'`; o desenho continua sempre (o parque fica parado atrás das janelas). `fase` **não** vai no save
(carregar sempre volta a `'jogando'`). `abrirInicio()` muda `'jogando'` para `'menu'` (pausa);
`fecharInicio()` volta a `'jogando'` se há jogo em andamento (`jogoEmAndamento`).

### Velocidade e pausa

`velocidade` ∈ `VELOCIDADES` = `[0, 1, 2, 4]` (0 = pausa). `velocidadeAntes` guarda a última velocidade não
nula: **Espaço** alterna entre 0 e ela (`alternarPausa`); as teclas **1, 2, 3** escolhem 1×, 2×, 4×
(`VELOCIDADES[n]`). Pausado dá para construir, demolir, inspecionar e mudar preços. O que precisa andar
pausado (avisos, autosave "a cada minuto") usa `tempoReal`, não `tempo`. Nenhum dos dois vai no save.

---

## 3. Modelo de dados

### Grade

- `MAPA` (config.js) é `let`: o lado da grade da partida atual. Só `redimensionarMapa(n)` (estado.js) o muda,
  junto com `ENTRADA` (`gx = floor(n/2)`, `gy = n − 1`) e as listas `mapa`/`objetos` (esvaziadas e enchidas
  **no lugar**, porque são `const`). Modo livre: `TAMANHOS_MAPA` = 24, 32, 48, 64. Cenários e saves trazem o
  tamanho no próprio mapa (quadrado, de `MAPA_MIN` 16 a `MAPA_MAX` 128).
- **Sempre `[gy][gx]`** (linha primeiro).
- `mapa[gy][gx]` = chave de `TIPOS`: `'GRAMA' | 'CAMINHO' | 'AGUA'`.
- `objetos[gy][gx]` = `null` | `'CHAVE'` (âncora = canto de menor gx e gy, ou objeto 1×1) |
  `{ ancora: { gx, gy } }` (célula secundária de objeto grande). `objetoEm(gx, gy)` resolve qualquer célula
  para `{ gx, gy, chave }` da âncora.
- Isometria 2:1, losango `TILE_W`×`TILE_H` = 64×32 px: `gradeParaMundo(gx, gy)` = `((gx−gy)·32, (gx+gy)·16)`.
  Com coordenadas fracionárias, `gradeParaMundo(gx+0,5, gy+0,5)` é o centro do tile.
- `ENTRADA` = meio da borda de baixo; é sempre CAMINHO, não pode ser alterada nem receber objeto.

### Estruturas indexadas pela âncora (chave `"gx,gy"`, `chaveAtr`)

| `Map` | Valor | Quem cria / remove |
|---|---|---|
| `atracoes` | `{ chave, ancora, fila: [g], passageiros: [g], fase: 'carregando'|'rodando', tCarga, resta, angulo }` | `construir` (se o serviço tem `capacidade`) / `desmontarAtracao` |
| `gestao` | `{ precos: { servico: $ }, receita, usos }` (todo objeto com `servicos`) | `construir` / `removerObjeto` |
| `rotacoes` | `1 | 2 | 3` (girado 90°, 180°, 270°); ausente = 0 | `construir` (só atrações) / `removerObjeto` |
| `lixeiras` | itens dentro (0 a 30) | `construir` (objeto com `lixeira`) / `removerObjeto` |
| `sujeira` | chave do TILE → `[{ tipo: 'papel'|'copo'|'palito'|'vomito', dx, dy, giro }]` (máx. 4) | `sujar` / `recolherItem`; só tiles sujos ficam no `Map` |
| `lotacao` | chave do tile → convidados **andando** nele | refeito a cada passo (`atualizarLotacao`); não vai no save |

### Outras estruturas de estado

| Nome | Conteúdo |
|---|---|
| `convidados` | lista de convidados (abaixo) |
| `funcionarios` | faxineiros `{ numero, nome, x, y, alvo, anterior, tarefa: {gx,gy}|null, trabalho (s restantes), recolheu, recolheuMes }` |
| `fin` (`finInicial()`) | `caixa` 15000, `divida` 15000, `juros` 0,03, `mes` 1 (contador crescente), `tMes` (s no mês), `receitaMes`, `visitantesMes`, `entradasMes`, `recusasMes`, `queixasMes` {tipo: n}, `balanco` (último mês fechado ou null), `aviso`, `avisoOk`, `tAviso` |
| `fin.balanco` | `{ mes, receita, manut, juros, salarios, visitantes, entradas, recusas, queixas, nota }` |
| `parque` (`parqueInicial()`) | `{ nome: 'Meu parque', precoEntrada: 0 }` |
| `avaliacao` (`avaliacaoInicial()`) | `{ nota: 500, alvo: 500, tCalculo: 0, saidas, infelizes, chegadas, recusas }` (contagens que decaem) |
| `partida` (`partidaInicial()`) | `{ modo: 'livre'|'cenario', cenario (id), nome, objetivo: {tipo, valor, prazo, meses}|null, liberados: [chaves]|null, precosTravados, inicio (patrimônio inicial), sequencia, visitantes, concluido }` |
| `stats` | `{ sairam }` (total de convidados que saíram) |
| `camera` | `{ x, y, zoom }` (translação em px de tela e escala) |
| Globais `let` | `hover`, `tempo`, `tempoReal`, `tAnterior`, `tChegada`, `velocidade`, `velocidadeAntes`, `fase`, `ferramenta {camada, chave}`, `rotacaoAtual`, `modo` (null/'mover'/'pintar'), `ultimo`, `selecionado` (convidado), `selObj` (chave da âncora), `selFunc` (faxineiro), `jogoEmAndamento`, `categoriaAberta` |

`ferramenta.camada`: `'terreno'` (chave = tipo), `'objeto'` (chave de `OBJETOS`), `'inspecionar'`,
`'remover'` (demolir), `'contratar'` (faxineiro).

### Convidado (campos criados por `semear`)

| Campo | Valor inicial | Significado |
|---|---|---|
| `x`, `y` | centro do tile | posição contínua na grade |
| `ox`, `oy` | ±0,2 | "faixa" própria ao andar (não andam em fila perfeita) |
| `alvo`, `anterior` | null | próximo tile e o tile de onde veio |
| `resgate` | false | true quando está fora do caminho e vai ao caminho mais próximo |
| `estado` | `'andando'` | `andando | usando | esperando | brincando` |
| `objetivo` | null | serviço que está indo buscar (`comida`, `diversao`, `saida`, `lixo`...) |
| `uso` | null | `{ servico, def, ancora, resta }` (serviço simples) ou `{ servico, def, ancora, espera }` (fila) |
| `velocidade` | 1,6 × U(0,85; 1,15) | tiles/s |
| `dinheiro` | round(U(30, 150)) | $ que trouxe |
| `tolerancia` | round((U(1,10)+U(1,10))/2) | intensidade preferida (1–10), concentrada no meio |
| `paciencia` | U(25, 45) | s que aguenta numa fila |
| `evitar` | {} | serviço → instante até o qual não tenta de novo |
| `pensou` | {} | queixa → instante até o qual ela não conta de novo |
| `pensamento` | null | `{ tipo, ate }`: balão sobre a cabeça |
| `lixo` | null | `{ tipo, ate }`: lixo na mão |
| `capricho` | U(0, 1) | 0 = larga o lixo logo; 1 = segura até 30 s procurando lixeira |
| `n` | fome U(10,50), sede U(10,50), banheiro U(0,30), nausea U(0,10), energia U(60,100), felicidade U(60,100) | necessidades (fome/sede/banheiro/náusea: 100 = pior; energia/felicidade: 100 = melhor) |
| `cor` | hsl aleatório | cor da roupa |
| (depois) `saindo`, `foi`, `aperto` | — | decidiu ir embora; chegou na saída; excesso de lotação no tile |

Invariantes úteis em testes: convidado `esperando` está na `fila` de uma atração; `brincando` está nos
`passageiros`; `usando` tem `uso.def`. `soltarConvidado(g)` volta qualquer um a `andando`.

---

## 4. Referência de funções por arquivo

Funções e constantes de nível superior de cada arquivo de `public/js/` (e do servidor). "Quem chama" lista os
chamadores principais.

### config.js
Só dados (seção 5). Não tem funções, exceto as lambdas de `URGENCIA`.

### utils.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `arred` | `v` | arredonda para centavos | finanças, objetos, saves |
| `moeda` | `v` | formata `$1.234,56` (negativo: `−$`) | interface |
| `moedaCurta` | `v` | `$3.000` sem centavos | cartões da barra |
| `aleatorio` | `min, max` | número uniforme em [min, max) | `semear`, lixo, entrada |
| `limitar` | `v` | prende em 0..100 | necessidades |
| `custoDe` | `chave` | custo de construção (`ECONOMIA`) | construir, demolir, patrimônio, barra |
| `$` | `id` | `document.getElementById` | interface |
| `chaveAtr` | `gx, gy` | `"gx,gy"` (chave dos `Map`) | todos |
| `nomeDoMes` | `mes` | `"Março, Ano 2"` a partir do contador | interface, cenários |
| `diaDoMes` | `tMes` | dia 1–30 a partir dos segundos do mês | barra superior, finanças |
| `iconeDoUso` | `g` | ícone do serviço em uso (o do catálogo ou `ICONES`) | desenho, painel |

### dom.js
Constantes com elementos da página: `canvas` (#tela), `ctx` (contexto 2D), `info`, `painel`, `painelObj`, `qtd`, `barra`.

### estado.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `criarMatriz` | `tamanho, valor` | matriz quadrada preenchida | carga inicial |
| `redimensionarMapa` | `n` | muda `MAPA`, `ENTRADA`, esvazia e recria `mapa`/`objetos` no lugar | `limparParque`, `aplicarJogo` |
| `finInicial` | — | fábrica do objeto `fin` | carga, `limparParque`, `aplicarJogo` |
| `parqueInicial` | — | fábrica de `parque` | idem |
| `nomeDoParque` | — | nome sem espaços ou o padrão | HUD, portão, autosave |
| `avaliacaoInicial` | — | fábrica de `avaliacao` | `iniciarAvaliacao`, `aplicarJogo` |
| `partidaInicial` | — | fábrica de `partida` | `limparParque`, `aplicarJogo` |
| `objetoLiberado` | `chave` | pode construir na partida? (`partida.liberados`) | barra, `aplicar` |
| `dentroDoMapa` (const) | `gx, gy` | dentro da grade? | todos |
| `ehCaminho` (const) | `gx, gy` | tile é CAMINHO? | movimento, BFS |
| `ehEntrada` | `gx, gy` | é o tile da entrada? | construção, saída |
| `ladosSemCaminho` | `gx, gy` | lados `[dx,dy]` sem caminho vizinho (onde ficam banco e lixeira) | `podeConstruir`, desenho, `aplicar` |
| `soltarConvidado` | `g` | interrompe o que ele fazia (volta a andar) | demolição, `aplicarJogo` |

Estado declarado aqui: `camera`, `hover`, `mapa`, `objetos`, `lotacao`, `atracoes`, `rotacoes`, `gestao`,
`fin`, `parque`, `avaliacao`, `partida`, `fase`, `convidados`, `sujeira`, `lixeiras`, `funcionarios`,
`selFunc`, `tempo`, `selecionado`, `selObj`, `stats`, `tChegada`, `tAnterior`, `tempoReal`, `velocidade`,
`velocidadeAntes`, `ferramenta`, `rotacaoAtual`, `modo`, `ultimo`.

### iso.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `gradeParaMundo` | `gx, gy` | grade → pixels do "mundo" (antes da câmera) | desenho, câmera |
| `vistaNaGrade` | `folga = 0, alto = 0` | retângulo visível em diagonais d = gx−gy, s = gx+gy | `desenhar` |
| `naVista` | `v, gx, gy` | o tile aparece na vista? | `desenhar` |
| `telaParaGrade` | `sx, sy` | pixel da tela → tile (com a câmera) | `input.js` |

### desenho.js

Só lê o estado. Funções de objeto recebem `(cx, cy, atr, rot, ancora)`: centro da **pegada**, estado da
atração (ou `undefined` na prévia), rotação 0–3 e âncora `{gx, gy}` (`null` na prévia).

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `poligono` | `pontos, cor, contorno` | preenche/contorna um polígono | todo o desenho |
| `cantos` | `gx, gy` | os 4 cantos do losango do tile | `desenharTile`, prévia, lotação |
| `caixa` | `cx, cy, s, h, corTopo, corEsq, corDir` | caixa isométrica quadrada; devolve a tampa | barracas, carrossel... |
| `desenharTile` | `gx, gy` | piso do tile (e a borda de terra nas bordas do mapa) | `desenhar` |
| `caixaRet` | `cx, cy, w, h, alt, corTopo, corEsq, corDir` | caixa retangular w×h tiles | banco, lixeira, atrações |
| `desenharArvore` | `cx, cy` | árvore | `OBJETOS.ARVORE` |
| `desenharBanco` | `cx, cy, atr, rot, ancora` | um banco em cada lado sem caminho | `OBJETOS.BANCO` |
| `desenharLixeira` | `cx, cy, atr, rot, ancora` | cesto na borda; papéis aparecem a partir de 75% | `OBJETOS.LIXEIRA` |
| `desenharSujeira` | — | papéis, copos, palitos e vômito no chão | `desenhar` (após o terreno) |
| `desenharFaxineiro` | `f` | faxineiro com vassoura (balança trabalhando) | `desenhar` |
| `desenharBarraca` | `cx, cy` | barraca de comida | `OBJETOS.BARRACA` |
| `entre` | `a, b, t, alt` | interpolação entre dois pontos (com altura) | desenhos |
| `desenharBanheiro` | `cx, cy` | banheiro | `OBJETOS.BANHEIRO` |
| `desenharSorveteria` | `cx, cy` | sorveteria | `OBJETOS.BARRACA_SORVETE` |
| `vetorTela` | `[dx, dy], n` | direção da grade com n tiles, em pixels | atrações giradas |
| `frenteAtras` | `rot` | a frente aponta para −gx/−gy? (portal desenhado antes do corpo) | atrações |
| `desenharPortalAtracao` | `cx, cy, rot, prof, desvio, cor` | portal de entrada (2 postes + faixa) na borda da frente | atrações |
| `desenharCarrossel` | `cx, cy, atr, rot` | carrossel com 6 cavalos girando | `OBJETOS.CARROSSEL` |
| `planoDaAtracao` | `rot` | eixo e "lado" na tela de atrações planas (roda, navio) | roda, navio |
| `desenharRodaGigante` | `cx, cy, atr, rot` | roda com 8 cabines penduradas | `OBJETOS.RODA_GIGANTE` |
| `desenharMontanhaRussa` | `cx, cy, atr, rot` | trilho, estação e trem em circuito | `OBJETOS.MONTANHA_RUSSA` |
| `desenharBarracaBebidas` | `cx, cy` | barraca de bebidas | `OBJETOS.BARRACA_BEBIDAS` |
| `desenharNavioPirata` | `cx, cy, atr, rot` | navio balançando entre dois pórticos | `OBJETOS.NAVIO_PIRATA` |
| `trajetoDoBarco` | `p, ordem` | posição/transparência de um barco no passeio (p = progresso 0–1) | `desenharPasseioBarco` |
| `desenharPasseioBarco` | `cx, cy, atr, rot` | píeres, toldos e 4 barcos que saem e voltam pelos canais | `OBJETOS.BARCOS` |
| `telhadoPiramide` | `cx, cy, s, alt, pico, corTras, corEsq, corDir` | telhado em pirâmide | casa assombrada |
| `desenharCasaAssombrada` | `cx, cy, atr, rot` | casa com fantasma voando em volta | `OBJETOS.CASA_ASSOMBRADA` |
| `desenharCorredeira` | `cx, cy, atr, rot` | canal em volta de uma ilha, bote dando a volta | `OBJETOS.CORREDEIRA` |
| `desenharTrem` | `cx, cy, atr, rot` | trilho oval, jardim com lago, estação, locomotiva com fumaça e 3 vagões | `OBJETOS.TREM` |
| `alturaDoToboga` | `t` | altura (px) da rampa em t (0 = topo, 1 = fim) | `desenharToboga` |
| `desenharToboga` | `cx, cy, atr, rot` | torre e rampa com 4 pistas; passageiro descendo | `OBJETOS.TOBOGA` |
| `desenharPortao` | — | portão de circo da entrada com placa do nome do parque | `desenhar` |
| `desenharFila` | `a, cx, cy, alt` | rótulo "Fila n/12" | `desenhar` |
| `desenharConvidado` | `g` | boneco, lixo na mão, seleção, ícone e balão | `desenhar` |
| `desenharBalao` | `bx, by, icone` | balão de pensamento | `desenharConvidado` |
| `corDaFerramenta` | — | cor da prévia conforme a ferramenta | `desenhar` |
| `desenharLotacao` | — | mancha vermelha nos tiles lotados | `desenhar` |
| `desenhar` | — | quadro inteiro: terreno visível, lotação, sujeira, objetos+convidados+faxineiros+portão ordenados por profundidade, prévia da ferramenta (pegada, canais tracejados, "fantasma") | `loop` |

Constantes: `VAGAS_BARCO`, `CORES_BARCO`, `PISTAS_TOBOGA`.

**Ordem de desenho (algoritmo do pintor)**: todo o terreno primeiro; depois uma lista única de objetos,
convidados (exceto `brincando`), faxineiros e portão, ordenada por profundidade `x + y`. A profundidade de um
objeto é o **centro da pegada** (`gx + gy + (w + h)/2`); isso só é correto com `|w − h| ≤ 1` (atrações mais
alongadas exigiriam ordenação topológica). Quem muda estilos usa `ctx.save()/restore()`.

### objetos.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `tamanhoDe` | `chave, rot = 0` | pegada `{w, h}` (rot ímpar troca w/h) | todos |
| `rotacionavel` | `chave` | só atrações giram | `construir`, `girarObjeto`, cenários, saves |
| `rotacaoDe` | `gx, gy` | rotação da âncora (0 se ausente) | desenho, demolir |
| `direcoesDe` | `rot` | `{ eixo, frente }` em direções da grade (`DIRECOES_ROT`) | desenho, canais |
| `ehGrande` | `chave` | pegada maior que 1×1 | — (utilitário) |
| `objetoEm` | `gx, gy` | âncora `{gx, gy, chave}` da célula, ou null | todos |
| `ficaSobreCaminho` | `chave` | objeto `sobreCaminho` (banco, lixeira) | construção, terreno |
| `ficaNaAgua` | `chave` | objeto `naAgua` (barcos, corredeira) | idem |
| `canaisDe` | `chave, gx, gy, rot` | tiles de canal (fileira da frente e de trás) de quem tem `canais` | `podeConstruir`, prévia |
| `donoDoCanal` | `gx, gy` | o tile é canal de algum passeio? devolve a âncora | `podeConstruir`, `aplicar` |
| `podeConstruir` | `chave, gx, gy, rot` | valida pegada, chão, entrada, canais e lado livre | `aplicar`, prévia, cenários |
| `construir` | `chave, gx, gy, rot` | grava o objeto e cria `rotacoes`, `atracoes`, `lixeiras`, `gestao` | `aplicar`, mapa inicial, cenários |
| `removerObjeto` | `gx, gy` | demole o objeto inteiro, solta usuários, reembolsa 50% | `aplicar` |

Constantes: `OBJETOS` (seção 6), `DIRECOES_ROT`.

### atracoes.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `defDeFila` | `chave` | o serviço com `capacidade` do objeto, ou null | várias |
| `ehAtracaoComFila` | `chave` | tem fila? | `construir`, saves |
| `novaAtracao` | `chave, gx, gy` | estado inicial da atração | `construir`, `aplicarJogo` |
| `esperaEstimada` | `a` | s até embarcar quem entrar agora na fila | atratividade, painel |
| `desmontarAtracao` | `gx, gy` | solta fila e passageiros e remove a atração | `removerObjeto` |
| `atualizarAtracoes` | `dt` | paciência na fila, embarque, partida, corrida, efeitos e ângulo | `simular` |

### necessidades.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `atualizarNecessidades` | `g, dt` | taxas por segundo e perda de felicidade | `atualizar` |
| `usar` | `g, dt` | contagem do serviço simples; no fim aplica efeitos e dá o lixo | `atualizar` |
| `servicosPerto` | `x, y, servico, g` | objetos no tile ou vizinhos que oferecem o serviço (filtra preço e intensidade se `g`) | `buscarServico` |
| `atratividade` | `g, servico, def, ancora, dist` | felicidade líquida esperada do brinquedo | `buscarServico` |
| `buscarServico` | `sx, sy, servico, g` | BFS por caminhos; simples = o mais próximo; fila = maior atratividade > 0 | `decidirNecessidade`, `queixarDaFalta` |
| `iniciarServico` | `g, servico, r` | paga e usa (simples) ou entra na fila | `decidirNecessidade` |
| `decidirNecessidade` | `g, cx, cy` | saída > necessidade mais urgente ≥ 0,6 que ele consiga atender | `escolherAlvo` |
| `queixarDaFalta` | `g, cx, cy, servico` | queixa de fome/sede/banheiro ou "caro" | `decidirNecessidade` |
| `diferencaIntensidade` | `g, def` | intensidade − tolerância (0 se sem intensidade) | intensidade |
| `excessoIntensidade` | `g, def` | pontos além da janela de ±2 | idem |
| `aceitaIntensidade` | `g, def` | dentro da janela, ou felicidade ≤ 25 | `servicosPerto` |
| `efeitosFinais` | `g, def` | efeitos do serviço com a penalidade de intensidade | `usar`, atrações, atratividade |

Constante: `QUEIXA_DA_FALTA` (`comida→fome`, `bebida→sede`, `banheiro→banheiro`).

### convidados.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `semear` | `n, ponto` | cria n convidados (no `ponto` ou em caminhos sorteados) | `atualizarEntrada`, aba Teste |
| `proximoPassoAteCaminho` | `sx, sy` | BFS até o caminho mais próximo (atravessa grama, não água) | resgate, faxineiro |
| `escolherAlvo` | `g` | ao chegar num tile: lixo/sujeira, necessidade, lixeira ou passeio aleatório | `atualizar` |
| `densidadeEm` | `gx, gy` | convidados andando por tile de caminho (tile + 4 vizinhos) | lotação |
| `excessoEm` | `gx, gy` | densidade − limite (≥ 0) | lotação, desenho |
| `fatorDeLotacao` | `g` | multiplicador do passo (1 até 0,5) | `atualizar` |
| `atualizarLotacao` | `dt` | refaz `lotacao`, aplica aperto e queixa "lotado" | `simular` |
| `resumoLotacao` | — | `{ apertados, tiles }` para a janela do parque | `atualizarParqueUI` |
| `atualizar` | `dt` | necessidades, uso de serviço e movimento de cada convidado | `simular` |

### entrada.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `passoAteEntrada` | `sx, sy` | BFS por caminhos até a entrada | `decidirSaida` |
| `decidirSaida` | `g, cx, cy` | decide ir embora (felicidade ≤ 10 ou dinheiro < $2) e guia até a saída | `decidirNecessidade` |
| `atualizarEntrada` | `dt` | remove quem saiu; faz chegar convidados; cobra ingresso ou registra recusa | `simular` |

### financas.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `avisar` | `msg, ok = false` | aviso na barra superior (2,5 s reais; verde se `ok`) | várias |
| `cobrar` | `v` | debita do caixa; sem saldo avisa e devolve false | `aplicar` |
| `precoUso` | `ancora, servico` | preço atual do serviço (0 em diversão com `precosTravados`) | busca, embarque, painel |
| `pagar` | `g, ancora, servico, preco` | convidado paga; caixa, receita do mês e do objeto | serviços, embarque |
| `pagarEntrada` | `g` | cobra o ingresso do parque | `atualizarEntrada` |
| `custoManutencaoMensal` | — | soma das manutenções (só âncoras) | fechamento, janela |
| `patrimonio` | — | caixa − dívida + 50% do custo dos objetos | objetivo "lucro" |
| `salariosMensais` | — | faxineiros × $150 | fechamento, janela |
| `fecharMes` | — | cobra juros, manutenção e salários; grava `balanco`; avança o mês; avalia objetivo | `atualizarFinancas` |
| `atualizarFinancas` | `dt` | relógio do mês (300 s) | `simular` |
| `pegarEmprestimo` | — | +$1.000 de dívida e caixa (até $20.000) | botão |
| `pagarEmprestimo` | — | −$1.000 de dívida e caixa | botão |

### avaliacao.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `media` | `lista, f, padrao` | média com `reduce` (padrão se vazia) | `partesDaAvaliacao` |
| `partesDaAvaliacao` | — | as 7 partes da nota (pontos e máximo) | cálculo, janela do parque |
| `iniciarAvaliacao` | — | começa direto na nota calculada | `comecarPartida`, `aplicarJogo` |
| `proporcao` | `parte, total` | fração com denominador mínimo 10 | penalidades |
| `calcularAvaliacao` | — | soma das partes, limitada a 0–999 | `atualizarAvaliacao` |
| `atualizarAvaliacao` | `dt` | decaimento das contagens, recálculo a cada 5 s e suavização | `simular` |
| `notaRelativa` | — | nota / 999 | efeitos |
| `fracaoMaxEntrada` | — | fração máxima do dinheiro que o convidado aceita pagar de ingresso | entrada, janela |
| `escalaChegada` | — | multiplicador do intervalo de chegada | entrada, janela |
| `registrarQueixa` | `tipo` | +1 em `fin.queixasMes` | `pensar`, entrada |
| `pensar` | `g, tipo` | balão de 3 s e queixa (no máx. 1 a cada 30 s por tipo e convidado) | gatilhos |
| `queixasOrdenadas` | `queixas` | lista `[tipo, n]` da mais comum para a menos | janela do parque |

### lixo.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `sujeiraEm` | `gx, gy` | itens no tile | várias |
| `temVomito` | `gx, gy` | há vômito no tile? | faxineiro |
| `sujar` | `gx, gy, tipo` | põe um item (só caminho, máx. 4) | convidados |
| `recolherItem` | `gx, gy` | tira um item (vômito primeiro) | faxineiro |
| `fracaoSujeira` | — | itens (vômito = 2) por tile de caminho, até 1 | avaliação |
| `ehLixeira` | `c` | a célula é âncora de lixeira? | várias |
| `capacidadeLixeira` | `gx, gy` | capacidade (30) | várias |
| `cheiaDeMais` | `gx, gy` | lixeira cheia? | `lixeiraPerto` |
| `lixeiraPerto` | `x, y` | lixeira no tile ou ao lado (prefere com espaço) | convidados |
| `precisaEsvaziar` | `gx, gy` | lixeira ≥ 75%? | faxineiro, janela |
| `melhorNoCaminho` | `sx, sy, avaliar, maxDist` | BFS por caminhos que escolhe o tile de menor nota | lixeira, faxineiro |
| `receberLixo` | `g, tipo` | lixo na mão por 8–30 s (conforme `capricho`) | `usar` |
| `chegarNoTile` | `g, cx, cy` | pisar em sujeira, vomitar, jogar o lixo fora | `escolherAlvo` |
| `irAteLixeira` | `g, cx, cy` | desvia até lixeira com espaço a até 6 tiles | `escolherAlvo` |
| `contratarFaxineiro` | `gx, gy` | cria um faxineiro no tile | `aplicar`, mapa inicial |
| `demitirFuncionario` | `f` | remove o faxineiro | painel |
| `tarefaValida` | `t` | ainda há o que fazer no tile? | `decidirFaxineiro` |
| `duracaoDoTrabalho` | `gx, gy` | 2 s (lixeira), 3 s (vômito) ou 1 s (lixo) | `decidirFaxineiro` |
| `escolherTarefa` | `f, cx, cy` | tarefa de menor (distância − bônus), fora as reservadas | `decidirFaxineiro` |
| `concluirTrabalho` | `f` | esvazia a lixeira ou recolhe um item | `atualizarFuncionarios` |
| `decidirFaxineiro` | `f` | trabalha, segue para a tarefa ou patrulha | `atualizarFuncionarios` |
| `atualizarFuncionarios` | `dt` | movimento e trabalho de todos os faxineiros | `simular` |
| `resumoLimpeza` | — | contagens para a janela do parque | `atualizarParqueUI` |

Constante: `TIPOS_SUJEIRA` = `['papel', 'copo', 'palito', 'vomito']`.

### ui.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `atualizarPainel` | — | barras e texto do convidado selecionado | `loop` |
| `selecionar` | `gx, gy` | Inspecionar: faxineiro > objeto com preços > convidado mais perto | `aplicar` |
| `selecionarFuncionario` | `f` | painel do faxineiro (botão Demitir) | `selecionar` |
| `selecionarObjeto` | `k` | painel de preços do objeto (campos editáveis) | `selecionar` |
| `atualizarPainelObj` | — | estatísticas do objeto/faxineiro selecionado | `loop` |
| `atualizarFinancasUI` | — | barra superior, aviso, botões de velocidade, janela Finanças | `loop` |
| `atualizarParqueUI` | — | janela Parque (portão, limpeza, lotação) | `loop` |
| `corDaNota` | `nota` | vermelho → verde | `atualizarNotaUI` |
| `atualizarNotaUI` | — | nota, barra e partes | `atualizarParqueUI` |
| `atualizarQueixasUI` | — | queixas do mês e do último fechamento | `atualizarParqueUI` |
| `iniciarParqueUI` | — | liga nome e preço de entrada | `iniciarUI` |
| `definirVelocidade` | `v` | muda a velocidade (guarda a última não nula) | botões, teclas |
| `alternarPausa` | — | Espaço | botões, teclas |
| `iniciarVelocidades` | — | cria os botões ⏸ 1× 2× 4× e as teclas | `main.js` |
| `iniciarUI` | — | painel do convidado, Esc, janela Finanças | `main.js` |

Constantes: `CAMPOS` (barras do painel), `NOMES_SERVICO`.

### barra.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `limparConvidados` | — | remove todos os convidados (aba Teste) | cartão "Limpar" |
| `dicaDoObjeto` | `chave` | texto da dica (custo, manutenção, pegada, água, giro, intensidade, lugares) | `listaDeItens` |
| `listaDeItens` | — | todos os cartões (ferramentas, terrenos, objetos liberados, faxineiro, teste) | `montarBarra` |
| `el` (const) | `tag, classe, texto` | cria elemento com classe e `textContent` | barra, cenários, ui |
| `criarCartao` | `it` | botão do cartão e seu clique | `montarBarra` |
| `abrirCategoria` | `id` | mostra a aba | abas, `montarBarra` |
| `montarBarra` | — | recria abas e cartões (a cada partida) | `comecarPartida`, `carregarDe` |
| `atualizarBarra` | — | destaca a ferramenta, marca a aba, esmaece o que o caixa não cobre | `loop`, cliques |

Constantes/estado: `ITENS_BARRA`, `ABAS_BARRA`, `categoriaAberta`.

### salvar.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `serializarJogo` | — | estado → objeto JSON (filas viram índices; `uso.def` sai) | `salvarEm` |
| `migrar` | `doc` | valida o envelope e converte versões antigas | `aplicarJogo` |
| `matrizValida` | `m, n` | matriz n×n? | `aplicarJogo` |
| `num` (const) | `v, padrao` | número finito ou o padrão | `aplicarJogo` |
| `pegadaConfere` | `chave, gx, gy, rot` | as células salvas batem com a pegada girada? | `aplicarJogo` |
| `soNumeros` | `o` | filtra um objeto `{k: número}` | `aplicarJogo` |
| `aplicarJogo` | `doc` | valida tudo e só então substitui o estado (duas etapas) | `carregarDe` |
| `chamarApi` | `url, opcoes` | `fetch` com erro legível | saves |
| `slugDoNome` | `nome` | "Meu Parque 2" → `meu-parque-2` | `salvarEm` |
| `salvarEm` | `nome, id` | PUT do save | janela, autosave |
| `carregarDe` | `id` | GET + `aplicarJogo` + barra + câmera | janela |
| `lerModoAutosave` | — | preferência do `localStorage` | `iniciarSalvar` |
| `definirModoAutosave` | `m` | grava a preferência | seletor |
| `reiniciarAutosave` | — | zera a contagem (jogo novo/carregado) | partidas |
| `atualizarAutosave` | `dtReal` | decide se é hora de salvar | `loop` |
| `fazerAutosave` | — | salva em `autosave` sem travar o jogo | `atualizarAutosave` |
| `textoAutosave` | — | descrição na janela | janela |
| `iniciarSalvar` | — | janela Salvar/Carregar (lista, carregar, apagar, seletor) | `main.js` |

Constantes: `VERSAO_SAVE` = 2, `SAVES_URL` = `/api/saves`, `autosave` `{ modo, t, mes, salvando, ultimo }`.

### cenarios.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `buscarCenario` | `id` | baixa e valida `cenarios/<id>.json` (cache em `DEFS_CENARIOS`) | tela inicial |
| `validarCenario` | `c` | confere e normaliza o arquivo | `buscarCenario` |
| `limparParque` | `tamanho` | jogo novo e vazio do tamanho pedido | partidas |
| `comecarPartida` | — | avaliação, barra, câmera, `fase = 'jogando'`, autosave | partidas |
| `novoJogoLivre` | `tamanho = 24` | modo livre com o parque inicial | botão, carga |
| `iniciarCenario` | `id, def` | monta mapa, objetos, finanças e `partida` do cenário | cartões, "Tentar de novo" |
| `tipoDoObjetivo` | — | entrada de `TIPOS_OBJETIVO` da partida | objetivos |
| `emDisputa` | — | cenário em andamento e não concluído? | objetivos |
| `atualizarPartida` | — | objetivos imediatos vencem na hora | `simular` |
| `objetivoNoFechamento` | `mesFechado` | sequência de meses, vitória ou derrota no prazo | `fecharMes` |
| `vencer` / `perder` | — | muda a fase e mostra o fim | objetivos |
| `lerConcluidos` | — | ids vencidos (`localStorage`) | tela inicial |
| `marcarConcluido` | `id` | grava o id vencido | `vencer` |
| `cenarioAberto` | `i, concluidos` | o 1º sempre; os demais após vencer o anterior | tela inicial |
| `textoDoObjetivo` | `obj` | texto com o prazo | cartões |
| `atualizarObjetivoUI` | — | linha do objetivo no HUD | `loop` |
| `abrirInicio` / `fecharInicio` | — | tela inicial (pausa/retoma) | botões |
| `montarListaCenarios` | — | cartões (baixa todos com `Promise.all`) | `abrirInicio` |
| `cartaoCenario` | `id, def, aberto, vencido` | cartão de um cenário | lista |
| `mostrarFim` | `venceu` | janela de vitória/derrota | `vencer`, `perder` |
| `iniciarCenarios` | — | liga os botões da tela inicial e do fim | `main.js` |

Constantes: `LETRAS_TERRENO`, `TIPOS_OBJETIVO`, `DEFS_CENARIOS`; estado `jogoEmAndamento`.

### ParkAudio.js
Classe `ParkAudio` (som sintetizado com Web Audio). Constantes `ACORDES`, `PROGRESSOES` (6 sequências de 8
compassos), `ESCALA_MAIOR`, `TONS` (Dó, Fá, Sol, Ré), `RITMOS`, `ANTECEDENCIA` (1,5 s), `midiParaHz`, `sortear`.

| Método | O que faz |
|---|---|
| `constructor()` | estado vazio (`ctx`, `isPlaying`, `masterGain`, `vozes`) |
| `init()` | cria o `AudioContext` e o ganho geral (0,25) |
| `toggle()` | liga/desliga (não usado pelo jogo) |
| `start()` / `stop()` | começa (multidão + música) / para com fade e corta as notas agendadas |
| `startCrowdAmbience()` | ruído rosa em laço de 4 s com filtro passa-banda (multidão distante) |
| `startCarouselMusic()` | começa a compor e agendar a valsa |
| `novaSecao()` | sorteia progressão, tom e andamento da próxima seção de 8 compassos |
| `agendarCompasso()` | agenda um compasso (melodia, "um-pá-pá", sininho) com antecedência |
| `escolherNota(s, notasDoAcorde, forte)` | nota da melodia perto da anterior |
| `agendarVoz(osc, inicio, fim)` | registra o oscilador para poder cortá-lo |
| `envelope(inicio, dur, pico, ataque)` | ganho com ataque e decaimento |
| `playCalliopeNote(freq, duration, when)` | nota de realejo |
| `tocarBaixo` / `tocarAcorde` / `tocarSino` | baixo, acorde curto e sininho |

### musica.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `embaralhar` | `v` | Fisher-Yates | `tocarProxima` |
| `tocarProxima` | — | próxima faixa mp3 (reembaralha no fim) | eventos do `<audio>` |
| `tocar` | — | liga o modo atual e desliga o outro | botão, 1ª interação |
| `proximoModo` | `modo` | mp3 → sintetizada → desligada (pula mp3 sem arquivos) | botão |
| `atualizarBotaoMusica` | — | ícone 🎵/🎹/🔇 e dica | vários |
| `lerPreferenciaMusica` / `gravarPreferenciaMusica` | — | `localStorage` `musicaModo` (migra `musicaLigada`) | `iniciarMusica`, botão |
| `iniciarMusica` | — | liga eventos, busca `/api/musicas`, tenta tocar | `main.js` |

Constantes: `musica` `{ lista, ordem, pos, modo, falhas, audio, sintese }`, `MODOS_MUSICA`.

### input.js

| Função | Parâmetros | O que faz | Quem chama |
|---|---|---|---|
| `ajustarTamanho` | — | canvas = janela × `devicePixelRatio` | carga, `resize` |
| `zoomMinimo` | — | 0,3 ou menos para o mapa inteiro caber | roda, `centralizar` |
| `centralizar` | — | câmera na região da entrada, zoom inicial | partidas |
| `aplicar` | `gx, gy` | regras de cada ferramenta (terreno, objeto, contratar, demolir, inspecionar) | `pintarEm` |
| `pintarEm` (const) | `sx, sy` | aplica no tile sob o pixel | ponteiro |
| `pintarLinha` | `a, b` | amostra pontos entre duas posições do mouse (traço contínuo) | arrastar |
| `girarObjeto` | — | tecla Z: `rotacaoAtual` 0→1→2→3 (só atrações) | teclado |
| `iniciarEntradaUsuario` | — | eventos: Z, ponteiro (pintar/mover), roda (zoom no cursor, 0,3–3), `resize` | `main.js` |

### main.js

| Função | O que faz |
|---|---|
| `montarMapaInicial()` | parque livre: bloco 24×24 colado na entrada (cruz de caminhos, lago, 5 árvores, banco, barraca, banheiro, carrossel, roda-gigante, montanha-russa, navio, barraca de bebidas, 2 lixeiras e 1 faxineiro) |
| `simular(dt)` | um passo da simulação (ordem na seção 2) |
| `loop(t)` | laço do `requestAnimationFrame` |

Código de nível superior: `iniciarUI`, `iniciarSalvar`, `iniciarMusica`, `iniciarCenarios`,
`iniciarVelocidades`, `iniciarEntradaUsuario`, `ajustarTamanho`, `novoJogoLivre()` (parque de fundo),
`jogoEmAndamento = false`, `abrirInicio()`, `requestAnimationFrame(loop)`.

### server.js e armazenamento.js (Node)

| Arquivo | Função | O que faz |
|---|---|---|
| server.js | `rota(fn)` | embrulha rotas async para o Express 4 repassar erros |
| server.js | rotas `/api/saves`, `/api/saves/:id`, `/api/musicas` | seção 9 |
| armazenamento.js | `erro(status, msg)` | `Error` com status HTTP |
| armazenamento.js | `caminho(id)` | valida o id (`/^[a-z0-9][a-z0-9-]{0,39}$/`) e monta o caminho |
| armazenamento.js | `listar()` | lê todos os `.json` (ignora corrompidos), mais recente primeiro |
| armazenamento.js | `ler(id)` | um save (404 se não existe) |
| armazenamento.js | `gravar(id, doc)` | grava em `<id>.json.<pid>.tmp` e renomeia (atômico) |
| armazenamento.js | `apagar(id)` | apaga (404 se não existe) |

---

## 5. Constantes de `config.js`

### Grade, desenho e tempo

| Constante | Valor | Uso |
|---|---|---|
| `TILE_W`, `TILE_H`, `PROFUNDIDADE` | 64, 32, 14 | losango e borda de terra (px) |
| `MAPA` (let) | 24 | lado da grade da partida atual |
| `MAPA_PADRAO` | 24 | tamanho padrão do modo livre |
| `TAMANHOS_MAPA` | [24, 32, 48, 64] | opções do modo livre |
| `MAPA_MIN`, `MAPA_MAX` | 16, 128 | limites de cenários e saves |
| `FONTE_JOGO` | `'Fredoka', 'Segoe UI', sans-serif` | textos no canvas |
| `ENTRADA` | `{ gx: MAPA/2, gy: MAPA − 1 }` | portão (recalculado por `redimensionarMapa`) |
| `VIZINHOS` | [[1,0], [−1,0], [0,1], [0,−1]] | 4 vizinhos |
| `SEG_POR_MES`, `DIAS_POR_MES` | 300, 30 | 1 mês = 5 min; 1 dia = 10 s; 1 ano ≈ 1 h |
| `NOMES_MESES` | Janeiro … Dezembro | calendário |
| `VELOCIDADES` | [0, 1, 2, 4] | pausa, 1×, 2×, 4× |
| `PASSO_MAX` | 0,1 s | maior subpasso da simulação |
| `TECLA_GIRAR` | `'z'` | girar a atração |
| `VOLUME_MUSICA` | 0,35 | volume dos mp3 |

### Catálogos

| Constante | Valor |
|---|---|
| `TIPOS` | GRAMA 🌱, CAMINHO 👣, AGUA 💧 (nome, ícone, 2 cores alternadas) |
| `CUSTO_TERRENO` | GRAMA $0, CAMINHO $10, AGUA $25 (por tile trocado) |
| `CATEGORIAS` | ferramentas 🧰, terreno ⛰️, cenario 🌳, servicos 🍔, atracoes 🎢, funcionarios 👷, teste 🧪 (ordem das abas) |
| `ECONOMIA` | custo e manutenção mensal de cada objeto (seção 6) |
| `PRECO_PADRAO` | BANCO descanso 0; BARRACA comida 4; BARRACA_SORVETE comida 3; BANHEIRO 0; CARROSSEL 5; RODA_GIGANTE 6; MONTANHA_RUSSA 8; BARRACA_BEBIDAS bebida 3; NAVIO_PIRATA 7; BARCOS 4; CASA_ASSOMBRADA 6; CORREDEIRA 7; TREM 4; TOBOGA 3 |
| `REEMBOLSO` | 0,5 (demolir devolve 50%) |
| `ICONES` | comida 🍔, bebida 🥤, descanso 💤, banheiro 🚻, diversao 🎠, saida 👋, lixo 🗑️ |

### Finanças e parque

| Constante | Valor |
|---|---|
| `LIMITE_EMPRESTIMO`, `PARCELA` | $20.000, $1.000 |
| `SALDO_INICIAL`, `DIVIDA_INICIAL`, `JUROS_MENSAL` | $15.000, $15.000, 0,03 |
| `NOME_PARQUE_PADRAO`, `NOME_PARQUE_MAX` | 'Meu parque', 30 caracteres |
| `PRECO_ENTRADA_PADRAO` | $0 |
| `FRACAO_ENTRADA_MIN`, `FRACAO_ENTRADA_MAX` | 0,15, 0,45 |

### Convidados, necessidades e brinquedos

| Constante | Valor |
|---|---|
| `VELOCIDADE`, `VARIACAO_VELOCIDADE` | 1,6 tiles/s, ±15% |
| `FELIC_POR_ATIVIDADE` (perda/s) | andar 0,8 · comer 0,3 · beber 0,3 · sentar 0,2 · banheiro 0,5 · brinquedo 0 · esperar 1,0 |
| `LIMIAR_URGENCIA` | 0,6 |
| `FELIC_BUSCA_DIVERSAO` | 55 |
| `URGENCIA` | banheiro = banheiro/100 · comida = fome/100 · bebida = sede/100 · descanso = max((100−energia)/100, náusea/100) · diversao = min(1, 0,6 × (100−felicidade)/45) |
| `PREFERENCIA_INTENSIDADE` | 3 (pontos de felicidade por ponto de diferença) |
| `FELIC_POR_DOLAR` | 1 |
| `FILA_MAX` | 12 |
| `TEMPO_CARGA` | 5 s |
| `JANELA_INTENSIDADE` | 2 |
| `DESESPERO_FELICIDADE` | 25 |
| `PENALIDADE_FELIC_POR_PONTO`, `NAUSEA_POR_PONTO` | 5, 6 |

### Avaliação

| Constante | Valor |
|---|---|
| `NOTA_MAX`, `NOTA_INICIAL` | 999, 500 |
| `AVALIACAO` | felicidade 400 · porTipoAtracao 40 · variedade 200 · servicos 150 · necessidades 250 · infelizes 150 · recusas 100 · sujeira 150 · sujeiraSatura 1 · amostraMinima 10 · felicidadeNeutra 60 · necessidadesNeutras 0,6 |
| `SERVICOS_AVALIADOS` | comida, bebida, banheiro, descanso |
| `INTERVALO_AVALIACAO` | 5 s |
| `SUAVIZAR_AVALIACAO` | 15 s |

### Pensamentos e lotação

| Constante | Valor |
|---|---|
| `PENSAMENTOS` | fila 😤 · fome 🍔 · sede 🥤 · banheiro 🚻 · caro 💸 · intenso 🤢 · entrada 🎟️ · embora 😞 · sujeira 🗑️ · nojo 😖 · enjoo 🤮 · lotado 😣 (com os textos da seção 7) |
| `DURACAO_PENSAMENTO` | 3 s |
| `INTERVALO_PENSAMENTO` | 30 s |
| `LOTACAO` | limite 2,5 · felicPorSeg 1 · felicMax 2,5 · queixaA 0,5 · lentidao 0,25 · velocidadeMin 0,5 |

### Cenários, autosave e lixo

| Constante | Valor |
|---|---|
| `CENARIOS` | ['primeiro-parque', 'lagoa-azul', 'heranca-falida', 'so-ingresso'] (ordem de desbloqueio) |
| `CHAVE_PROGRESSO` | 'parque.cenariosConcluidos' |
| `OPCOES_AUTOSAVE` | desligado, minuto ("A cada 1 minuto"), mes, ano |
| `ID_AUTOSAVE`, `CHAVE_AUTOSAVE`, `INTERVALO_AUTOSAVE` | 'autosave', 'parque.autosave', 60 s |
| `LIXO` | seguraMin 8 · seguraMax 30 · desvio 6 · maxPorTile 4 · capacidadeLixeira 30 · esvaziarEm 0,75 · pisarLixo 3 · pisarVomito 6 · nauseaVomito 40 · chanceVomito 0,2 · aliviaVomito 40 · felicVomito 5 · tempoLixo 1 · tempoVomito 3 · tempoLixeira 2 · bonusVomito 8 · bonusLixeira 4 · contratacao 500 · salario 150 · velocidade 1,5 |

---

## 6. Catálogo de objetos

Fonte: `OBJETOS` (objetos.js), `ECONOMIA` e `PRECO_PADRAO` (config.js). Duração em segundos; efeitos
aplicados de uma vez no fim do uso (necessidades de 0 a 100).

### Cenário, serviços e lixeira

| Chave | Nome | Categoria | Pegada | Custo | Manut./mês | Preço padrão | Serviço: atividade, duração, efeitos | Regras |
|---|---|---|---|---|---|---|---|---|
| `ARVORE` | Árvore 🌳 | cenario | 1×1 | $30 | $2 | — | — | grama |
| `BANCO` | Banco 🪑 | cenario | 1×1 | $60 | $5 | descanso $0 | descanso: sentar, 6 s, energia +40, náusea −35 | `sobreCaminho`; desenhado em cada lado sem caminho; precisa de 1 lado livre |
| `LIXEIRA` | Lixeira 🗑️ | cenario | 1×1 | $50 | $3 | — | — (capacidade 30 itens) | `sobreCaminho`; na borda, sozinha no tile |
| `BARRACA` | Barraca de comida 🍔 | servicos | 1×1 | $350 | $80 | comida $4 | comida: comer, 3 s, fome −60, banheiro +12; lixo papel | grama, encostada no caminho |
| `BARRACA_BEBIDAS` | Barraca de bebidas 🥤 | servicos | 1×1 | $350 | $40 | bebida $3 | bebida: beber, 2 s, sede −80, banheiro +10, náusea −10; lixo copo | idem |
| `BARRACA_SORVETE` | Sorveteria 🍦 | servicos | 1×1 | $400 | $60 | comida (Sorvete) $3 | comida: comer, 2 s, fome −30, sede −25, felicidade +8, banheiro +6; lixo palito; ícone 🍦 | idem |
| `BANHEIRO` | Banheiro 🚻 | servicos | 1×1 | $350 | $50 | banheiro $0 | banheiro: 4 s, banheiro −100 | idem |

### Atrações (categoria `atracoes`, giram com Z, têm fila)

| Chave | Nome | Pegada | Custo | Manut. | Preço | Intens. | Lugares | Duração | Efeitos | Especial |
|---|---|---|---|---|---|---|---|---|---|---|
| `CARROSSEL` | Carrossel 🎠 | 2×2 | $800 | $100 | $5 | 5 | 6 | 8 s | felic +35, náusea +25, energia −10 | giro padrão (0,3 / 2,4 rad/s) |
| `RODA_GIGANTE` | Roda-gigante 🎡 | 3×2 | $700 | $100 | $6 | 2 | 8 | 20 s | felic +30, náusea +5, energia −5 | `giro` 0,12 / 0,5; `altura` 140 |
| `MONTANHA_RUSSA` | Montanha-russa 🎢 | 4×3 | $1.200 | $200 | $8 | 8 | 12 | 25 s | felic +45, náusea +30, energia −15 | `voltas: 2`; `altura` 120 |
| `NAVIO_PIRATA` | Navio pirata 🏴‍☠️ | 3×2 | $900 | $120 | $7 | 7 | 10 | 18 s | felic +40, náusea +20, energia −12 | `giro` 0,6 / 2,0; `altura` 105 |
| `BARCOS` | Passeio de barco 🚣 | 3×2 + canais | $750 | $90 | $4 | 3 | 8 (4 barcos × 2) | 16 s | felic +28, náusea +8, energia −6 | `naAgua`, `canais`, `voltas: 1`; `altura` 62 |
| `CASA_ASSOMBRADA` | Casa mal-assombrada 👻 | 2×2 | $1.000 | $110 | $6 | 4 | 8 | 15 s | felic +34, náusea +3, energia −6 | `giro` 0,5 / 1,4 (fantasma); `altura` 118 |
| `CORREDEIRA` | Corredeira 🛶 | 3×3 | $1.100 | $130 | $7 | 6 | 6 (1 bote) | 20 s | felic +38, náusea +16, energia −10 | `naAgua` sem canais, `voltas: 1`; `altura` 64 |
| `TREM` | Trem 🚂 | 4×3 | $950 | $70 | $4 | 3 | 12 | 30 s | felic +30, náusea +4, **energia +5** | `voltas: 2`; `altura` 58 |
| `TOBOGA` | Tobogã 🛝 | 3×2 | $600 | $60 | $3 | 5 | 6 | 14 s | felic +32, náusea +10, energia −12 | `voltas: 1` (fração da corrida que diz quem desce); `altura` 96 |

Regras de construção (`podeConstruir`): a pegada inteira dentro do mapa, sem objeto e fora da entrada;
`naAgua` → todas as células de ÁGUA e nenhuma num canal de outro passeio; `sobreCaminho` → CAMINHO e com pelo
menos um lado sem caminho; os demais → GRAMA. Objetos com `canais` exigem a fileira da frente e a de trás
(direção `frente` da rotação) dentro do mapa, de água e sem objeto (canal pode ser dividido entre dois
passeios). Atração precisa de CAMINHO encostado em alguma célula da pegada para receber fila (a orientação
é só visual: qualquer lado serve).

---

## 7. Regras de simulação

### Necessidades (por segundo, `atualizarNecessidades`)

- fome +1,2 · sede +1,6 · banheiro +0,25 · náusea −0,4 · energia −0,7 (só andando).
- Felicidade perde `FELIC_POR_ATIVIDADE[atividade]` + 1 por necessidade crítica (fome, sede, banheiro ou
  náusea > 80; energia < 20). Atividade: `usando` → a do serviço; `esperando` → esperar (1,0/s);
  `brincando` → 0; andando → 0,8/s.
- Ao terminar um serviço simples (`usar`), aplica `efeitosFinais` e, se o serviço tem `lixo`, dá o lixo na mão.

### Decisão a cada tile (`escolherAlvo`)

Ao chegar num tile de caminho: (1) `chegarNoTile` (sujeira, vômito, lixo da mão); (2) `decidirNecessidade`;
(3) `irAteLixeira`; (4) passeio: vizinho de caminho sorteado, evitando voltar (a menos que seja beco).
Fora do caminho (o chão sumiu): BFS até o caminho mais próximo (`proximoPassoAteCaminho`), atravessando grama.

### Urgência e busca de serviços

- `decidirNecessidade`: primeiro `decidirSaida`; depois, das necessidades com urgência ≥ 0,6 e fora do
  período `evitar`, da mais urgente para a menos, a primeira que `buscarServico` resolver.
- `buscarServico` = BFS **só por caminhos** a partir do tile atual; em cada tile olha o próprio tile e os 4
  vizinhos (`servicosPerto`), filtrando o que ele pode pagar e cuja intensidade aceita. Serviço simples: o
  **mais próximo**. Atração com fila: percorre toda a rede e escolhe a de **maior atratividade > 0**.
- Diversão é buscada com felicidade ≤ 55 (urgência 0,6 nesse ponto e 1 com felicidade 25).
- Desistências: fila cheia ao chegar ou sem dinheiro → `evitar` 20 s; saiu da fila por paciência ou sem
  dinheiro no embarque → `evitar` 40 s.

### Atratividade

```
atratividade = ganho de felicidade (efeitosFinais, já com penalidade de intensidade)
             − 3 × |intensidade − tolerância|
             − distância / velocidade do convidado × 0,8           (andar)
             − esperaEstimada × 1,0                                  (fila)
             − 1 × preço
```
Fila cheia (12) = −∞. `esperaEstimada` = resto da corrida atual + ⌊fila/capacidade⌋ × (duração + 5 s).

### Intensidade × tolerância

Tolerância 1–10 (média de dois sorteios). Aceita brinquedos com |intensidade − tolerância| ≤ 2. Com
felicidade ≤ 25 aceita qualquer um, mas cada ponto além da janela custa −5 de felicidade e, se o brinquedo
for mais intenso que o suportável, +6 de náusea; ao sair, pensa "Esse brinquedo foi intenso demais!".

### Filas e embarque (`atualizarAtracoes`)

- Fila máxima 12; cada convidado aguenta `paciencia` (25–45 s); ao estourar sai com −10 de felicidade e
  queixa "fila".
- Fase `carregando`: a fila embarca em ordem (FIFO) até lotar; o **ingresso é cobrado no embarque**
  (sem dinheiro, sai). Parte quando lota ou 5 s (`TEMPO_CARGA`) após o 1º passageiro.
- Fase `rodando`: dura `duracao`; no fim aplica os efeitos a cada passageiro e libera todos.
- Ângulo da animação: com `voltas`, gira `voltas × 2π` exatamente durante a corrida e volta a 0 (o trem
  termina na estação); senão usa `giro` (`parado`/`rodando`) ou o padrão 0,3/2,4 rad/s.

### Lixo, vômito e faxineiros (`lixo.js`)

- Comer/beber deixa `papel` (barraca), `copo` (bebidas) ou `palito` (sorvete) na mão por
  8 + 22 × `capricho` segundos.
- A cada tile: lixeira no tile ou vizinha com espaço → deposita; só cheia → larga ao lado dela (transborda);
  tempo esgotado → chão (só CAMINHO, máx. 4 itens por tile; tile cheio → tenta de novo em 3 s).
- Sem urgência e com lixo: desvia até lixeira com espaço a até 6 tiles.
- Náusea ≥ 40: 20% por tile de vomitar (náusea −40, felicidade −5, queixa "enjoo").
- Entrar em tile sujo: −3 de felicidade (vômito −6) e queixa, no máximo 1 vez a cada 30 s por tipo.
- Faxineiro (contratação $500, salário $150/mês, 1,5 tiles/s): tarefa de menor (distância − bônus),
  com bônus 8 para vômito, 4 para lixeira ≥ 75% e 0 para lixo; reserva o alvo para dois não irem ao mesmo.
  No tile, esvazia a lixeira **antes** de varrer (2 s), vômito 3 s, lixo 1 s. Sem tarefa, patrulha.

### Superlotação (`atualizarLotacao`)

Densidade = convidados **andando** no tile e nos 4 vizinhos ÷ tiles de caminho entre esses 5. Acima de 2,5,
o excesso tira `min(2,5; excesso × 1)` de felicidade por segundo e reduz o passo em 25% por unidade (mínimo
50%); excesso ≥ 0,5 gera a queixa "Que aperto!". Tiles lotados ficam em vermelho no mapa. Caminhos de 2 ou 3
tiles de largura têm mais tiles na vizinhança e espalham a multidão.

### Chegada e saída (`entrada.js`)

- Intervalo entre chegadas: U(3, 8) s × `escalaChegada()` = 2^((500 − nota)/500) (nota 0 → 2× mais lento;
  999 → quase 2× mais rápido). **Sem limite** de convidados ao mesmo tempo.
- O convidado nasce na entrada com $30–150; se `precoEntrada > dinheiro × fracaoMaxEntrada()`, desiste
  (`recusasMes`, queixa "entrada"). `fracaoMaxEntrada` = 0,15 + 0,30 × nota/999 (≈ 30% com nota 500).
- Vai embora com felicidade ≤ 10 (conta como infeliz, queixa "embora") ou dinheiro < $2; anda até a entrada
  por BFS e é removido ao pisar nela.

### Avaliação (0–999, `avaliacao.js`)

| Parte | Pontos |
|---|---|
| Felicidade média | média × 4 (até 400; sem convidados, 60 → 240) |
| Variedade de atrações | 40 por TIPO de atração (até 200 = 5 tipos) |
| Serviços | 150 × (tipos existentes entre comida, bebida, banheiro, descanso) / 4 |
| Necessidades em dia | 250 × média de 1 − (fome + sede + banheiro + náusea)/400 (sem convidados, 0,6) |
| Saíram infelizes | −150 × infelizes/saídas recentes (denominador mínimo 10) |
| Desistiram no portão | −100 × recusas/chegadas recentes (denominador mínimo 10) |
| Sujeira no chão | −150 × min(1, itens/tiles de caminho), vômito vale 2 |

Recalculada a cada 5 s; a nota exibida persegue o alvo com constante de 15 s. As contagens das penalidades
decaem com `exp(−dt/300)` (meia-vida ≈ 0,7 mês). Efeitos: ritmo de chegada e fração aceitável do ingresso.

### Pensamentos e queixas

`pensar(g, tipo)`: balão por 3 s e +1 em `fin.queixasMes`; o mesmo tipo do mesmo convidado só conta de novo
após 30 s. Gatilhos:

| Tipo | Texto | Gatilho |
|---|---|---|
| fila | Que fila demorada! | saiu da fila por paciência |
| fome / sede / banheiro | Estou com fome e não acho comida / ... | necessidade urgente sem serviço alcançável |
| caro | Está tudo caro demais! | o serviço existe e é alcançável, mas ele não pode pagar |
| intenso | Esse brinquedo foi intenso demais! | saiu de um brinquedo mais intenso que a janela |
| entrada | Ingresso caro demais! | desistiu no portão (sem balão) |
| embora | Este parque é chato, vou embora | saiu por felicidade ≤ 10 |
| sujeira / nojo | Que sujeira! / Que nojo, pisei em vômito! | entrou num tile sujo |
| enjoo | Passei mal... | vomitou |
| lotado | Que aperto! Lotado demais aqui | excesso de lotação ≥ 0,5 |

### Finanças e calendário

- Calendário: começa em Janeiro, Ano 1; mês = 300 s, 30 dias. `fin.mes` só cresce.
- Construir cobra `ECONOMIA[chave].custo` / `CUSTO_TERRENO` (sem saldo, não constrói); demolir devolve 50%.
- Empréstimo em parcelas de $1.000, dívida até $20.000; juros mensais editáveis na janela (padrão 3%).
- **Fechamento** (`fecharMes`): caixa −= juros (dívida × taxa) + manutenção de todos os objetos + salários
  (pode ficar negativo; não há falência). Grava o balanço, zera os contadores do mês e avalia o objetivo.
- Ingresso: cobrado na chegada, entra na receita e em `entradasMes`.
- `patrimonio()` = caixa − dívida + 50% do custo dos objetos (base do objetivo "lucro").

---

## 8. Cenários e objetivos

### Formato do arquivo (`public/cenarios/<id>.json`)

```json
{
  "nome": "Primeiro parque", "icone": "🌱", "nomeParque": "Parque Primavera",
  "descricao": "...",
  "caixa": 6000, "divida": 6000, "juros": 0.03,
  "precosTravados": false,
  "liberados": ["ARVORE", "BANCO", "..."],
  "objetivo": { "tipo": "visitantes", "valor": 700, "prazo": 12, "meses": 1 },
  "mapa": ["........................", "..."],
  "objetos": [{ "chave": "BANCO", "gx": 12, "gy": 18, "rot": 0 }]
}
```

`validarCenario` exige nome, mapa quadrado de N textos de N letras (`.` grama, `#` caminho, `~` água; letra
desconhecida = grama; N de 16 a 128), tipo de objetivo conhecido, `valor` numérico e `prazo` inteiro ≥ 1.
Caixa/dívida/juros ausentes usam os padrões; dívida limitada a 0–20.000; juros entre 0 e 1. Objetos que não
cabem são ignorados com aviso no console. `liberados` ausente = tudo liberado. A entrada é sempre CAMINHO.

### Tipos de objetivo (`TIPOS_OBJETIVO`)

| Tipo | Imediato? | Valor medido | Cumpre quando |
|---|---|---|---|
| `visitantes` | sim | `partida.visitantes` (entraram desde o início) | ≥ valor |
| `convidados` | sim | convidados no parque agora | ≥ valor |
| `divida` | sim | `fin.divida` | ≤ 0 |
| `lucro` | sim | `patrimonio() − partida.inicio` | ≥ valor |
| `nota` | não | avaliação no fechamento | ≥ valor por `meses` fechamentos **seguidos** |

Imediatos vencem no instante (`atualizarPartida`). Em todo fechamento, `objetivoNoFechamento` conta a
sequência (um mês ruim zera); fechar o mês `prazo` sem cumprir = derrota. Vencer grava o id em
`localStorage['parque.cenariosConcluidos']` e libera o próximo de `CENARIOS`. Nos cenários a aba 🧪 Teste
não aparece.

### Os quatro cenários

| Id | Nome | Mapa | Caixa / dívida / juros | Liberados | Objetivo |
|---|---|---|---|---|---|
| `primeiro-parque` | 🌱 Primeiro parque | 24×24, cruz de caminhos | $6.000 / $6.000 / 3% | árvore, banco, lixeira, 3 barracas, banheiro, carrossel, roda-gigante, navio, montanha-russa | 700 visitantes até Dezembro, Ano 1 (prazo 12) |
| `lagoa-azul` | 🚣 Lagoa Azul | 24×24, lagoa grande | $12.000 / $12.000 / 3% | árvore, banco, lixeira, 3 barracas, banheiro, carrossel, roda-gigante, passeio de barco | avaliação ≥ 550 por 3 meses seguidos até Junho, Ano 2 (prazo 18) |
| `heranca-falida` | 💸 Herança falida | 24×24 (mapa do parque livre) | $1.500 / $20.000 / 5% | tudo | pagar toda a dívida até Março, Ano 2 (prazo 15) |
| `so-ingresso` | 🎟️ Só ingresso | 24×24, anel com lago | $8.000 / $8.000 / 3% | tudo; brinquedos a $0 (`precosTravados`) | patrimônio +$6.000 até Dezembro, Ano 2 (prazo 24) |

---

## 9. Save/Load e API HTTP

### Formato

```
{ versao: 2, nome, salvoEm (ISO, posto pelo servidor),
  resumo: { mes, caixa, convidados, cenario, tamanho },
  estado: { mapa, objetos, fin, parque, avaliacao, partida, tempo, tChegada, stats,
            gestao, rotacoes, sujeira, lixeiras, funcionarios, atracoes, convidados } }
```

- `Map`s viram objetos (`Object.fromEntries`). Filas e passageiros das atrações viram **índices** na lista de
  convidados; `uso.def` (referência ao catálogo) é removido e refeito ao carregar a partir de `uso.ancora` e
  `uso.servico`; o `alvo` dos faxineiros é zerado.
- `VERSAO_SAVE` = 2 (versão 2 introduziu `partida`). `migrar()`: versão maior que a do jogo = erro; versão 1
  vira modo livre.
- `aplicarJogo` valida em **duas etapas**: (1) monta tudo à parte com o tamanho do save (chaves desconhecidas
  viram grama/vazio, célula secundária sem âncora válida vira vazio); qualquer erro lança exceção e o parque
  atual fica intacto; (2) `redimensionarMapa(n)` e substitui o estado. Convidados ganham padrões em `base`
  (save antigo), números inválidos voltam ao padrão, rotações só valem se a pegada girada confere, objetos sem
  dados ganham `gestao`/atração padrão, lixeiras e sujeira são limitadas, convidado em estado incoerente é
  solto. Saves antigos sem tamanho = 24×24.
- Texto do usuário (nome do save, do parque, do faxineiro) entra na tela só por `textContent`/`document.title`.

### Autosave

Seletor na janela 💾 (`OPCOES_AUTOSAVE`): desligado, a cada 1 minuto (60 s **reais** com a fase `jogando`,
mesmo pausado), a cada virada de mês, a cada virada de ano (o novo mês é Janeiro). Grava sempre no id
`autosave` com o nome "Autosave · nome do parque", sem bloquear o jogo (`autosave.salvando` evita dois ao
mesmo tempo). Jogo novo/carregado chama `reiniciarAutosave()`. Preferência em `localStorage['parque.autosave']`.

### API

| Método | Rota | Corpo / resposta |
|---|---|---|
| GET | `/api/saves` | `[{ id, nome, salvoEm, resumo }]`, mais recente primeiro |
| GET | `/api/saves/:id` | o documento completo (404 se não existe) |
| PUT | `/api/saves/:id` | corpo `{ versao (número), nome, resumo, estado (objeto) }` → `{ id, nome, salvoEm }`; 400 se inválido |
| DELETE | `/api/saves/:id` | 204 (404 se não existe) |
| GET | `/api/musicas` | nomes dos `.mp3` de `public/musicas`, em ordem alfabética |

Id: `/^[a-z0-9][a-z0-9-]{0,39}$/` (o cliente gera com `slugDoNome`). Corpo JSON até 5 MB (413 acima).
Erros: `{ erro: mensagem }`; 500 genérico (detalhe só no console do servidor). Rota de API desconhecida: 404.
Só `armazenamento.js` sabe que os saves são arquivos JSON (gravação atômica: temporário + rename).

---

## 10. Música

O botão da barra superior alterna `musica.modo`: **mp3** (🎵, os arquivos de `public/musicas/` em ordem
embaralhada, volume 0,35; arquivo com erro pula para o próximo e para se todos falharem) → **sintetizada**
(🎹, `ParkAudio`: ruído rosa filtrado como multidão + valsa de realejo composta na hora, em seções de 8
compassos com progressões sorteadas, mudanças de tom e andamento, melodia perto da nota anterior,
acompanhamento "um-pá-pá" e sininho, agendada no relógio do áudio com 1,5 s de antecedência) → **desligada**
(🔇). Sem mp3, o modo mp3 é pulado e o padrão vira o sintetizado. Preferência em `localStorage['musicaModo']`
(a chave antiga `musicaLigada = 'nao'` vira desligada). O navegador só libera áudio após o 1º clique/tecla:
`tocar()` é chamado de novo nessa interação (`resume()` do `AudioContext`).

---

## 11. Interface

- **Barra superior** (`#fin`): nome do parque, dia/mês/ano, ⭐ avaliação, 💰 caixa (vermelho se negativo),
  🏦 dívida, botões ⏸ 1× 2× 4×, 📊 Finanças, 🎡 Parque, 💾 Salvar/Carregar, música, 🏠 tela inicial e o aviso.
- **HUD** (`#hud`): tile sob o mouse (coordenadas, terreno, objeto, nível da lixeira, sujeira), convidados
  (e quantos saíram), objetivo do cenário e lembrete dos controles.
- **Barra de construção** (`#barra`): abas de `CATEGORIAS` (vazias somem): Ferramentas (Inspecionar,
  Demolir), Terreno, Cenário, Serviços, Atrações, Funcionários (Faxineiro) e Teste (só no modo livre:
  +5 convidados, Limpar). Cartão acima do caixa fica esmaecido com preço vermelho; a aba da ferramenta ativa
  tem um ponto. Largura máxima 780 px (rola para o lado).
- **Painéis laterais**: convidado (barras, dinheiro, tolerância, estado e pensamento); objeto (preços
  editáveis, receita, usos, manutenção, intensidade, fila, a bordo, espera estimada); faxineiro (situação,
  recolhidos, salário, Demitir).
- **Janelas** (`.modal > .janela > .janela-topo + .janela-corpo`): tela inicial (fixa), fim de cenário (fixa),
  Salvar/Carregar, Finanças (empréstimo, juros, balanço), Parque (nome, avaliação e partes, entrada, portão,
  limpeza, lotação, queixas). Esc fecha janelas não fixas; sem janela, fecha os painéis.
- **Atalhos**: botão esquerdo = aplicar ferramenta (arrastar pinta vários tiles; contratar não arrasta);
  botão do meio = mover o mapa; roda = zoom no cursor (de `zoomMinimo()` a 3); Z = girar atração;
  Espaço = pausa/retoma; 1/2/3 = 1×/2×/4×; Esc = fechar.
- Tema: variáveis no `:root` de `style.css`; fonte Fredoka (`FONTE_JOGO` no canvas).

---

## 12. Como estender

- **Novo objeto**: (1) `desenhar...(cx, cy, atr, rot, ancora)` em desenho.js (atração: trate `rot` com
  `direcoesDe`/`vetorTela` e ponha `desenharPortalAtracao`); (2) entrada em `OBJETOS` com `categoria`, `icone`,
  `nome`, `cor`, `desenhar` e opcionais `tam`, `altura`, `servicos`, `sobreCaminho`, `naAgua`, `canais`,
  `lixeira`; (3) `ECONOMIA` e `PRECO_PADRAO`. Cartão, construção, painel de preços e save funcionam sozinhos.
- **Novo terreno**: `TIPOS` (com `icone` e 2 cores) + `CUSTO_TERRENO` (+ letra em `LETRAS_TERRENO` para cenários).
- **Nova categoria da barra**: `CATEGORIAS`.
- **Novo serviço/necessidade**: `URGENCIA`, `ICONES`, `FELIC_POR_ATIVIDADE` e `atualizarNecessidades`
  (e `SERVICOS_AVALIADOS` se contar na nota).
- **Novo lixo**: `lixo: 'tipo'` no serviço, desenho em `desenharSujeira`/`desenharConvidado`, tipo em
  `TIPOS_SUJEIRA` (e na lista aceita por `aplicarJogo`).
- **Nova queixa**: entrada em `PENSAMENTOS` e `pensar(g, tipo)` no gatilho.
- **Novo fator da nota**: mais uma parte em `partesDaAvaliacao` (a janela do parque lista sozinha).
- **Novo cenário**: arquivo em `public/cenarios/` e o id em `CENARIOS` (a posição define o desbloqueio).
  Teste a viabilidade simulando um jogador.
- **Novo tipo de objetivo**: entrada em `TIPOS_OBJETIVO` (`imediato`, `atual`, `cumpriu`, `texto`,
  `progresso`); contador novo em `partidaInicial` e no save.
- **Mudou o formato do save**: aumente `VERSAO_SAVE` e converta em `migrar()`. Campo opcional com padrão
  sensato não exige migração; convidado novo precisa de padrão em `base` (`aplicarJogo`). Estado que
  referencia convidados/objetos é serializado com índices/chaves.

---

## 13. Armadilhas conhecidas e observações

- `const` arrow chamada antes de definida na carga (TDZ); `;` solto no meio de `.filter().sort()`.
- Inverter `[gx][gy]`; reatribuir `mapa`/`objetos` em vez de mutar; esquecer de zerar `rotacoes`/`gestao`.
- Ao mudar a assinatura de uma função (ex.: `tamanhoDe`), faça `grep` de todos os usos.
- Nada pode guardar `MAPA` ou uma linha de `mapa` de uma partida para outra.
- Atração sem CAMINHO encostado em nenhuma célula da pegada nunca recebe convidados.
- Efeito "por tile" sem intervalo derruba a felicidade (por isso pisar no lixo tem intervalo de 30 s).
- Lógica nova fora de `simular(dt)` ignora pausa e velocidade.
- Testes headless: jsdom com stub de canvas e `requestAnimationFrame = () => 0`, ou um navegador real
  (o manual usa o Edge via CDP: `docs/manual/ferramentas/`). Com o loop real ligado, comparações entre
  instantes diferentes ficam inválidas; passageiros falsos quebram a simulação.
- Receita ≈ visitantes × dinheiro que trazem ($30–150): mudar só preferências redistribui o gasto.
- Construção feita por código (parque inicial, cenários) deve passar por `podeConstruir`: até a v1.10.1 o
  banco do parque livre era posto direto em (13, 11), na grama, contrariando a regra `sobreCaminho`. Desde a
  v1.10.2 `montarMapaInicial` valida cada objeto (avisa no console se não couber) e o banco fica em (12, 11),
  sobre a coluna de caminho logo acima do cruzamento.
