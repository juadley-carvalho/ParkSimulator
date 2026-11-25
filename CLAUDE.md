<!--
Notas para quem mantém este arquivo (estas linhas NÃO vão para o contexto do Claude):
- O Claude Code lê este arquivo no início de toda sessão. Mantenha-o abaixo de ~200 linhas e só com o que o
  Claude precisa ter SEMPRE: regras de trabalho, armadilhas, invariantes. Detalhes e histórico vão para
  docs/REGRAS_DE_JOGO.md (lido sob demanda, por caminho; "@arquivo" carregaria tudo junto).
- Números não entram aqui: moram em config.js, objetos.js e nos JSON de cenários. Aqui vão as regras e onde achá-los.
- Ao concluir uma funcionalidade, atualize só as seções afetadas.
- Preferências pessoais que não devem ir para o git: CLAUDE.local.md (já está no .gitignore).
-->
# Parque de Diversões

Simulador de parque de diversões isométrico (inspirado em RollerCoaster Tycoon). JavaScript puro no navegador
(`<canvas>`), servido por Node.js + Express 4. É um projeto de **aprendizado**: o usuário quer aprender
JavaScript na prática enquanto o jogo cresce.

**Leia sob demanda** (não vêm junto deste arquivo; abra antes de mexer na área):
- `docs/REGRAS_DE_JOGO.md`: regras detalhadas, calibragens e o porquê dos valores (avaliação, lixo, defeitos, cenários,
  superlotação...), rotação, bonecos animados, autosave e música.
- `docs/DOCUMENTACAO_TECNICA.md`: referência de funções e constantes (mantida pelo agente `documentador`).
- `README.md`: estrutura de pastas e API de saves. `docs/manual/`: manual do jogador.

## Como trabalhar aqui
- Responda em **português**. Identificadores e comentários do código também são em português; identificadores
  sem acento (`atracoes`, `diversao`, `ehCaminho`), acentos só em comentários e textos da interface.
- Explique em poucas linhas o conceito de JavaScript por trás de mudanças relevantes (hoisting, `Map`, closures...).
- Se o pedido envolve decisões de design de jogo, dê sua opinião e proponha as regras antes; se já está claro, implemente.
- Mudanças focadas, no estilo existente (comentários explicam o *porquê*). Não reorganize arquivos sem pedir.
- Não diga que algo funciona sem verificar (seção "Verificação"). Diga o que foi e o que **não** foi testado.
- Antes de commitar rode `npm test`. Se falhar, não commite: diga o que quebrou.
- **Ao concluir cada pedido: commit e push automáticos** (o usuário autorizou). Mensagem no padrão
  `vX.Y.Z - descrição em português`, incrementando a versão a partir do último commit (`git log`).
- Mudou regra, catálogo ou arquitetura? Atualize este arquivo (só o essencial) e `docs/REGRAS_DE_JOGO.md` (o detalhe).

## Rodar e testar
```
npm install
npm start        # http://localhost:3000
npm run dev      # reinicia ao editar server.js (node --watch; Node >= 18.11)
npm test         # teste de fumaça, ~10 s (tests/smoke.js)
```
- Outra porta: bash `PORT=8080 npm start` · PowerShell `$env:PORT=8080; npm start` · cmd `set PORT=8080 && npm start`.
- Código em `public/` não precisa reiniciar o servidor: recarregue a página (o servidor manda `no-cache`).
- Saves em `./saves/*.json` (ou `SAVES_DIR`), fora do git. Dependência de execução: express (`jsdom` é só do teste).

## Arquitetura (o que não é óbvio)
- **Sem bundler, sem módulos ES, sem framework.** Scripts clássicos em `public/js/`, carregados por `<script>` no
  `public/index.html` e **compartilhando o escopo global**. **A ordem das tags importa**:
  `config, utils, dom, estado, iso, desenho, objetos, atracoes, necessidades, convidados, entrada, financas,
  avaliacao, lixo, manutencao, ui, barra, salvar, cenarios, ParkAudio, musica, estilo, input, main`.
  Arquivo novo = tag nova na posição certa. `main.js` é sempre o último.
- Código de nível superior (executado na carga) só pode usar o que já foi carregado. Funções usadas na montagem
  inicial do mapa devem ser `function` declarations. Já causou bugs: `const f = () => ...` chamada antes da linha
  que a define ("Cannot access ... before initialization", a *temporal dead zone*).
- `OBJETOS` (objetos.js) cita as funções `desenhar*` ao ser criado, por isso `desenho.js` carrega antes dele.
- **Dados x desenho**: `estado.js` guarda o estado mutável; `desenho.js` só lê. A lógica roda em `simular(dt)`
  (main.js), chamada pelo `loop`, que depois chama `desenhar()`. Sempre use `dt` em segundos, nunca contagem de
  quadros. **Lógica nova entra em `simular`**, não direto no `loop` (senão ignora a velocidade e a pausa).
- **Fase** (`fase`: `menu | jogando | vitoria | derrota`): só em `jogando` o `loop` simula (o desenho continua).
  **Velocidade** (0 = pausa, 1, 2, 4): o `loop` multiplica o `dt` real e chama `simular` em subpassos de até
  `PASSO_MAX`. O que deve andar pausado (avisos) usa `tempoReal`, não `tempo`. Fase e velocidade não vão no save.
- Balanceamento (custos, preços, taxas, limites) fica em `config.js`; valores mágicos novos vão para lá.
- `mapa`, `objetos` etc. são `const` **mutadas no lugar**: não reatribua (veja `aplicarJogo`, que copia linha a linha).
- Responsabilidades: `estado` dados · `iso` grade↔tela · `desenho` canvas · `objetos` catálogo e regras de construção ·
  `atracoes` filas/embarque/corrida · `necessidades` necessidades e busca de serviços · `convidados` criação e
  movimento · `entrada` chegada/saída · `financas` caixa/empréstimo (só lógica) · `avaliacao` nota e pensamentos ·
  `lixo` sujeira, lixeiras e o movimento de todos os funcionários · `manutencao` defeitos e mecânicos ·
  `ui` painéis e janelas · `barra` barra de construção · `salvar` serialização + API + tela de saves ·
  `cenarios` tela inicial, cenários, objetivos, fim de jogo · `musica`/`ParkAudio` música e efeitos sonoros · `estilo` estilo visual (🎨) · `input` mouse/teclado/câmera.

## Interface (style.css)
- Tema único de jogo: cores em variáveis no `:root` (sem modo claro/escuro). Fonte Fredoka em `public/fonts/` (OFL,
  funciona offline); no canvas, `FONTE_JOGO` (config.js). Emojis continuam na fonte do sistema.
- Janela = `.modal > .janela > .janela-topo (h3 + .fechar ✕) + .janela-corpo (.secao com h4)`. Painéis laterais
  usam `.painel-topo`. Botões: `.btn` (azul), `.btn-ok` (verde), `.btn-perigo` (vermelho). Esc fecha janelas/painéis.
- **Estilo visual** (botão 🎨, `estilo.js`): Original, Retrô 2× e Retrô 3× (`ESTILOS_VISUAIS`, lembrado no `localStorage`). O retrô
  reduz o canvas a 1/`escalaPixel` e o amplia sem suavizar (CSS `pixelated`); a paleta reduzida é o filtro SVG `#retro`
  (index.html). Só o tamanho do canvas muda: câmera, mouse e lógica seguem em pixels de tela. **Dimensione e converta
  sempre com `fatorCanvas()`, nunca com `devicePixelRatio`/`canvas.width`.** `corRetro` (em `TIPOS`) mantém o
  quadriculado distinto depois do filtro; mudou os níveis do filtro, reescolha os pares (o teste confere). Texto e
  emojis desenhados no canvas e a interface HTML ainda não têm versão pixel art.
- HUD e painéis laterais ficam abaixo da barra superior (`--abaixo-do-topo`); lado a lado, eles se sobrepunham.

## Modelo de dados
- Grade `MAPA`×`MAPA`. `mapa[gy][gx]` = chave de `TIPOS` (GRAMA, CAMINHO, AGUA). **Sempre `[gy][gx]`** (linha primeiro).
- **Tamanho por partida**: `MAPA` é `let` e só `redimensionarMapa(n)` (estado.js) o muda, junto com `ENTRADA` e as
  listas `mapa`/`objetos` (esvaziadas e enchidas no lugar). **Nada pode guardar `MAPA` ou uma linha de `mapa` de uma
  partida para outra.** Cenários e saves trazem o tamanho no próprio mapa; `aplicarJogo` valida com o tamanho do SAVE.
- `objetos[gy][gx]`: `null` | `'CHAVE'` (âncora = canto de menor gx e gy, ou objeto 1×1) | `{ ancora: {gx, gy} }`
  (célula secundária de objeto grande). `objetoEm(gx, gy)` resolve qualquer célula para a âncora.
- Isometria 2:1, losango 64×32: `gradeParaMundo` / `telaParaGrade` (iso.js). Com coordenadas fracionárias,
  `gradeParaMundo(gx + 0.5, gy + 0.5)` é o centro do tile; convidados têm x, y contínuos.
- Mapas indexados pela âncora, chave `"gx,gy"` (`chaveAtr`): `atracoes` (fila, passageiros, fase, ângulo), `gestao`
  (preços, receita, usos de todo objeto com serviços) e `rotacoes` (1, 2 ou 3 = girado 90°, 180°, 270°).
- **Objetos grandes e rotação**: `tam: {w,h}` no catálogo. Só atrações giram (`rotacionavel`): a tecla Z (`TECLA_GIRAR`)
  cicla `rot` 0→1→2→3; `rot` ímpar troca w/h (`tamanhoDe(chave, rot)`). A orientação é só visual: a fila aceita
  qualquer caminho encostado. Funções de desenho recebem `(cx, cy, atr, rot, ancora)`, com (cx, cy) = centro da
  PEGADA (na prévia `atr` = undefined e `ancora` = null). Direção, portal e plano: `docs/REGRAS_DE_JOGO.md` §1.
- **Desenho por profundidade** (algoritmo do pintor): todo o terreno, depois objetos e convidados numa lista
  ordenada por `x + y`; a profundidade de um objeto é o CENTRO da pegada, só correto com `|w − h| ≤ 1` (atração mais
  alongada exige ordenação topológica). Ao desenhar, use `ctx.save()/restore()` se mudar estilos (eles persistem).
- **Convidado**: campos em `semear`. Estados: `andando | usando | esperando | brincando`. Necessidades em `g.n`:
  fome, sede, banheiro, nausea (100 = pior) e energia, felicidade (100 = melhor).
- **Bonecos** (`desenharBoneco(x, y, pose)`): a pose preenche SEMPRE o mesmo objeto `POSE` (sem criar objetos por
  quadro) e o desenho NÃO usa `ctx.save()/restore()` (caro com centenas): devolve `lineWidth`/`lineCap` à mão.
  Pessoas fora da tela não entram na lista de desenho. Detalhes das poses: `docs/REGRAS_DE_JOGO.md` §2.

## Regras do jogo (resumo; números em config.js, detalhes e calibragens em docs/REGRAS_DE_JOGO.md §3)
- **Partida**: tela inicial (`#modalInicio`) com modo livre e cenários (`public/cenarios/<id>.json`, ordem em `CENARIOS`,
  conferidos por `validarCenario`). Objetivos em `TIPOS_OBJETIVO`; passar do prazo = derrota; vitória libera o próximo
  (progresso no `localStorage`). Nos cenários não há a aba 🧪 Teste.
- **Calendário e finanças**: mês = `SEG_POR_MES`; no fechamento saem juros, manutenção e salários (caixa pode ficar
  negativo). Construir cobra `ECONOMIA`/`CUSTO_TERRENO` (sem saldo: não constrói); demolir devolve `REEMBOLSO`. O
  preço de uso é por objeto (ferramenta Inspecionar), padrões em `PRECO_PADRAO`; o parque tem preço de entrada.
- **Convidados** entram pela `ENTRADA` (tile da borda, protegido), sem limite simultâneo, no ritmo de `escalaChegada()`
  (pela avaliação). Saem com felicidade ≤ 10 ou dinheiro < $2. Só andam em CAMINHO; se o chão some, BFS até o caminho
  mais próximo (atravessa grama, nunca água).
- **Necessidades**: a cada tile novo, `decidirNecessidade`: urgência ≥ `LIMIAR_URGENCIA` → BFS só por caminhos até um
  objeto vizinho que ofereça o serviço, que o convidado pague e aceite. Serviço = `servicos` no catálogo (atividade,
  duração, efeitos; `capacidade` = tem fila). Atração com fila: a de maior `atratividade`.
- **Intensidade x tolerância (1–10)**: aceita brinquedo até ±`JANELA_INTENSIDADE`; com felicidade baixa aceita qualquer
  um, pagando por ponto excedente em felicidade e náusea (`efeitosFinais`).
- **Filas**: tamanho máximo, paciência e carga em config.js; o ingresso é cobrado no embarque. Atração de circuito
  (`voltas`) dá voltas exatas e o trem volta à estação.
- **Lixo e funcionários** (`LIXO`, `FUNCOES`; lixo.js): comer/beber deixa lixo; lixeiras; faxineiros contratados pela
  aba 👷. **Defeitos** (`DEFEITOS`; manutencao.js): só atrações com fila quebram; o mecânico conserta.
- **Superlotação** (`LOTACAO`), **avaliação** 0–999 (soma de `partesDaAvaliacao`) e **pensamentos** (`PENSAMENTOS`):
  mexem na felicidade e na nota; a nota define o ritmo de chegada e o limite do ingresso.
- **Chão x objetos**: só `sobreCaminho` (banco, lixeira) fica sobre CAMINHO; os demais nunca. Brinquedos `naAgua` exigem
  a pegada (e os canais) em ÁGUA. Atrações grandes não ficam sobre CAMINHO. Água afoga o objeto; demolir solta quem o usava.
- **Catálogo**: chaves em `OBJETOS` (objetos.js); custos em `ECONOMIA`. Tabela comparativa: `docs/REGRAS_DE_JOGO.md` §3.

## Como estender
- **Novo objeto**: (1) `desenhar...(cx, cy, atr, rot)` em desenho.js; (2) entrada em `OBJETOS` com `categoria`, `icone`,
  `nome`, `cor`, `desenhar`, e opcionais `tam`, `altura` (posição do rótulo da fila), `servicos`, `sobreCaminho`, `naAgua`;
  (3) custo/manutenção em `ECONOMIA` e preços em `PRECO_PADRAO`. Cartão da barra, construção, painel de preços e save
  funcionam sozinhos. Atração nova: trate `rot` (0–3) no desenho com `direcoesDe`/`vetorTela` e ponha um portal
  (`desenharPortalAtracao`). O teste de fumaça já desenha todo objeto do catálogo em todas as rotações.
- **Novo terreno**: `TIPOS` (com `icone`) + `CUSTO_TERRENO`. **Nova categoria da barra**: `CATEGORIAS`.
- **Novo serviço/necessidade**: `URGENCIA`, `ICONES`, `FELIC_POR_ATIVIDADE` (config.js) e `atualizarNecessidades`.
- **Novo lixo**: `lixo: 'tipo'` no serviço, desenho em `desenharSujeira`/`desenharConvidado` e o tipo em `TIPOS_SUJEIRA`.
- **Nova queixa**: entrada em `PENSAMENTOS` e uma chamada `pensar(g, tipo)` no gatilho. **Novo fator da nota**: mais
  uma parte em `partesDaAvaliacao` (a janela do parque lista as partes sozinha).
- **Novo cenário**: arquivo em `public/cenarios/` e o id em `CENARIOS` (a posição define o desbloqueio). Simule um
  jogador para ver se o objetivo é viável. **Novo tipo de objetivo**: entrada em `TIPOS_OBJETIVO` (`imediato`, `atual`,
  `cumpriu(v, o)`, `texto(o)`, `progresso(v, o)`); contador novo vai em `partidaInicial` e no save.
- **Mudou o formato do save**: aumente `VERSAO_SAVE` e converta em `migrar()` (salvar.js). Campo opcional novo com
  padrão sensato não exige migração, mas convidados novos precisam de um padrão em `base` (em `aplicarJogo`).
- Estado novo que referencie convidados/objetos deve ser serializado com índices/chaves em `serializarJogo`/`aplicarJogo`.

## Save/Load
- API: `GET /api/saves`, `GET|PUT|DELETE /api/saves/:id`. Só `armazenamento.js` sabe que os saves são arquivos JSON
  (trocar por SQLite = reescrever só ele). Id `[a-z0-9-]{1,40}`; gravação atômica (temporário + rename).
- `aplicarJogo` valida tudo **antes** de alterar o jogo (save inválido não estraga o parque); chaves desconhecidas
  viram grama/vazio; convidado em estado incoerente é solto. Serviço simples em uso guarda `ancora` para refazer `def`.
- Texto vindo do usuário (nome de save, nome do parque) entra na tela só por `textContent`, nunca `innerHTML`.
- Autosave (id `autosave`), música e efeito sonoro das cobranças: `docs/REGRAS_DE_JOGO.md` §4.

## Verificação
- **`npm test`** (tests/smoke.js, ~10 s, sem navegador): servidor + API de saves, carga da página, modo livre,
  simulação de 5 meses (sem NaN, sem estados incoerentes), construção/custos/rotação, salvar e carregar (inclusive
  saves inválidos e mapa de outro tamanho), os cenários, quebra e conserto, e `desenhar()` de todo objeto em toda
  rotação. Rode antes de commitar. Regra nova = verificação nova em `secao(...)` (veja o cabeçalho do arquivo).
- O canvas do teste é falso: ele garante que `desenhar()` não lança exceção, **não** que o visual está certo. Mudou o
  desenho ou a interface? Abra o jogo no navegador e olhe.
- Sempre confira também: `node --check public/js/*.js` e, no navegador, o que você mudou. Não dá para medir fluidez
  em jsdom (sem GPU); a medição de desempenho do desenho é feita no Edge (ver `docs/REGRAS_DE_JOGO.md` §2).
- Para simular na mão: jsdom com canvas falso, `requestAnimationFrame = () => 0` (o loop real roda durante `await` e
  invalida comparações) e `window.eval` chamando `simular(0.1)`. Cenários: `fetch` lendo de `public/`.
- Invariantes úteis: convidado `esperando`/`brincando` pertence a uma fila/atração; `usando` tem `uso.def`.

## Armadilhas já encontradas
- `const` arrow chamada antes de definida na carga (TDZ); `;` solto no meio de cadeia `.filter().sort()`.
- Inverter `[gx][gy]` na matriz; reatribuir `mapa`/`objetos` em vez de mutar; esquecer de zerar `rotacoes`/`gestao`.
- Editar uma função e esquecer um uso antigo: ao mudar assinatura (ex.: `tamanhoDe`), faça `grep` de todos os usos.
- Teste que calcula o esperado com a própria função testada não pega nada (aconteceu com `tamanhoDe`): derive o
  esperado de outra fonte (o catálogo). Teste com atração sem CAMINHO encostado dá "ninguém usa".
- Efeito "por tile" sem intervalo (pisar no lixo) derruba a felicidade; teste de faxineiro com chegadas ligadas muda o
  nível das lixeiras (use `tChegada = 1e9`).
- Receita ≈ visitantes × dinheiro que trazem ($30–150): mudar só as preferências redistribui o gasto entre os
  objetos, sem aumentar o total.
- Testes no Edge (CDP): matar o processo principal não fecha os filhos; um Edge velho na porta 9333 manda erros da
  cena anterior para a nova. Encerre os `msedge.exe` do perfil de teste entre execuções.
- Retrô: o filtro de paleta funde tons parecidos (o quadriculado sumiu até existir `corRetro`) e o contorno de 1 px entre
  tiles vira pontilhado com o canvas a 1/3 da resolução (no retrô ele é omitido).
- A barra superior tem ~1430 px com todos os botões: botão novo nela estoura telas de 1366 px. Abaixo de 1440 px vale o
  layout estreito (barra em linhas, painéis mais abaixo); conferir a largura ao acrescentar algo.
- Emojis da interface dependem da fonte do sistema operacional.

## Ideias / backlog
- Fila das atrações entrando só pelo portal (hoje a orientação é visual); volume da música na interface.
- Mais cenários e objetivos (ex.: avaliação mínima + visitantes); mais atrações (tiro ao alvo, bate-bate);
  vários slots de autosave; capacidade nos serviços simples; tolerância que evolui com a experiência;
  histórico financeiro em gráfico; ícones SVG próprios; suporte a toque (o mapa só se move com o botão do meio).
- Mecânico com inspeção preventiva (reduzir o desgaste de brinquedos funcionando quando estiver sem conserto).
