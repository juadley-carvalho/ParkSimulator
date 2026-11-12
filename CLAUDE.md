<!--
Notas para quem mantém este arquivo (estas linhas NÃO vão para o contexto do Claude):
- O Claude Code lê este arquivo no início de toda sessão. Mantenha-o abaixo de ~200 linhas e específico.
- Ao concluir uma funcionalidade, atualize as seções afetadas (regras, catálogo, armadilhas).
- Detalhes longos (estrutura de pastas, API) ficam no README.md, que o Claude lê sob demanda.
- Preferências pessoais que não devem ir para o git: CLAUDE.local.md (adicione ao .gitignore).
-->
# Parque de Diversões

Simulador de parque de diversões isométrico (inspirado em RollerCoaster Tycoon). JavaScript puro no navegador
(`<canvas>`), servido por Node.js + Express 4. É um projeto de **aprendizado**: o usuário quer aprender
JavaScript na prática enquanto o jogo cresce. Estrutura de pastas e API de saves: `README.md`.

## Como trabalhar aqui
- Responda em **português**. Identificadores e comentários do código também são em português; identificadores
  sem acento (`atracoes`, `diversao`, `ehCaminho`), acentos só em comentários e textos da interface.
- Explique em poucas linhas o conceito de JavaScript por trás de mudanças relevantes (hoisting, `Map`, closures...).
- Se o pedido envolve decisões de design de jogo, dê sua opinião e proponha as regras antes; se já está claro, implemente.
- Mudanças focadas, no estilo existente (comentários explicam o *porquê*). Não reorganize arquivos sem pedir.
- Não diga que algo funciona sem verificar (seção "Verificação"). Diga o que foi e o que **não** foi testado.

## Rodar
```
npm install
npm start        # http://localhost:3000
npm run dev      # reinicia ao editar server.js (node --watch; Node >= 18.11)
```
- Outra porta: bash `PORT=8080 npm start` · PowerShell `$env:PORT=8080; npm start` · cmd `set PORT=8080 && npm start`.
- Código em `public/` não precisa reiniciar o servidor: recarregue a página (o servidor manda `no-cache`).
- Saves em `./saves/*.json` (ou `SAVES_DIR`), fora do git. Única dependência: express.

## Arquitetura (o que não é óbvio)
- **Sem bundler, sem módulos ES, sem framework.** Scripts clássicos em `public/js/`, carregados por `<script>` no
  `public/index.html` e **compartilhando o escopo global**. **A ordem das tags importa**:
  `config, utils, dom, estado, iso, desenho, objetos, atracoes, necessidades, convidados, entrada, financas, ui,
  barra, salvar, input, main`. Arquivo novo = tag nova na posição certa. `main.js` é sempre o último.
- Código de nível superior (executado na carga) só pode usar o que já foi carregado. Funções usadas na montagem
  inicial do mapa devem ser `function` declarations. Já causou bugs: `const f = () => ...` chamada antes da linha
  que a define ("Cannot access ... before initialization", a *temporal dead zone*).
- `OBJETOS` (objetos.js) cita as funções `desenhar*` ao ser criado, por isso `desenho.js` carrega antes dele.
- Dados x desenho: `estado.js` guarda o estado mutável; `desenho.js` só lê. A lógica roda em `atualizar*(dt)`,
  chamadas pelo `loop` (main.js), que depois chama `desenhar()`. Sempre use `dt` em segundos, nunca contagem de quadros.
- Balanceamento (custos, preços, taxas, limites) fica em `config.js`. Valores mágicos novos vão para lá.
- `mapa`, `objetos` etc. são `const` **mutadas no lugar**: não reatribua (veja `aplicarJogo`, que copia linha a linha).
- Responsabilidades: `estado` dados · `iso` grade↔tela · `desenho` canvas · `objetos` catálogo e regras de construção ·
  `atracoes` filas/embarque/corrida · `necessidades` necessidades e busca de serviços · `convidados` criação e
  movimento · `entrada` chegada/saída · `financas` caixa/empréstimo (só lógica) · `ui` painéis de detalhes e janelas de
  finanças e do parque · `barra` barra de construção · `salvar` serialização + API + tela de saves · `input` mouse/teclado/câmera.

## Modelo de dados
- Grade 24×24 (`MAPA`). `mapa[gy][gx]` = chave de `TIPOS` (GRAMA, CAMINHO, AGUA). **Sempre `[gy][gx]`** (linha primeiro).
- `objetos[gy][gx]`: `null` | `'CHAVE'` (âncora = canto de menor gx e gy, ou objeto 1×1) | `{ ancora: {gx, gy} }`
  (célula secundária de objeto grande). `objetoEm(gx, gy)` resolve qualquer célula para a âncora.
- Isometria 2:1, losango 64×32: `gradeParaMundo` / `telaParaGrade` (iso.js). Com coordenadas fracionárias,
  `gradeParaMundo(gx + 0.5, gy + 0.5)` é o centro do tile; convidados têm x, y contínuos.
- Mapas indexados pela âncora, chave `"gx,gy"` (`chaveAtr`): `atracoes` (fila, passageiros, fase, ângulo), `gestao`
  (preços, receita, usos de todo objeto com serviços) e `rotacoes` (objetos girados 90°).
- Objetos grandes: `tam: {w,h}` no catálogo. Girar (tecla Z, `TECLA_GIRAR`) troca w/h via `tamanhoDe(chave, rot)`;
  só objetos não quadrados giram. Funções de desenho recebem `(cx, cy, atr, rot, ancora)`, com (cx, cy) = centro da
  PEGADA e `ancora` = `{gx, gy}` (para olhar os vizinhos, como o banco).
- Desenho por ordem de profundidade (algoritmo do pintor): todo o terreno, depois objetos e convidados numa lista
  ordenada por `x + y`. Ao desenhar, use `ctx.save()/restore()` se mudar estilos (eles persistem entre itens).
- Convidado: campos em `semear`. Estados: `andando | usando | esperando | brincando`. Necessidades em `g.n`:
  fome, sede, banheiro, nausea (100 = pior) e energia, felicidade (100 = melhor).

## Regras do jogo (valores em config.js)
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
- **Convidados** andam a `VELOCIDADE` ±15% (`g.velocidade`, sorteada em `semear`); a atratividade usa a velocidade dele.
- **Parque** (janela 🎡, `parque` em estado.js): nome (até 30 caracteres, só via `textContent`/`document.title`) e
  preço de entrada (padrão $0). O ingresso é cobrado na chegada (`pagarEntrada`); quem acha caro (preço >
  30% do dinheiro que trouxe, `FRACAO_MAX_ENTRADA`) desiste no portão (`fin.recusasMes`). Na simulação o
  lucro mensal é máximo perto de $20 ($0: +$450 · $10: +$760 · $20: +$930 · $30: +$390).
- **Chegada/saída**: convidados entram pela `ENTRADA` (tile da borda, protegido) a cada 3–8 s (máx 40) com $30–150.
  Saem se felicidade ≤ 10 ou dinheiro < $2, andando até a entrada. Só andam em CAMINHO; se o chão some, BFS até o
  caminho mais próximo (atravessa grama, nunca água).
- **Necessidades**: a cada tile novo, `decidirNecessidade`: urgência ≥ `LIMIAR_URGENCIA` (0.6) → BFS só por caminhos
  até um objeto vizinho que ofereça o serviço, que o convidado pague e aceite. Serviço simples: o mais próximo.
  Atração com fila: a de maior `atratividade` > 0 (felicidade líquida: ganho − preferência de intensidade − custo
  de andar e de esperar `esperaEstimada` − preço; pesos em config.js). Diversão é buscada com felicidade ≤ 55.
  Serviço = `servicos` no catálogo (atividade, duração, efeitos; `capacidade` = tem fila). Fome/sede satisfeitas
  aumentam o banheiro.
- **Intensidade x tolerância (1–10)**: aceita brinquedo até ±2 pontos; com felicidade ≤ 25 aceita qualquer um, pagando
  por ponto excedente −5 felicidade e +6 náusea (se mais intenso que o suportável). Ver `efeitosFinais`.
- **Filas**: máx 12; paciência 25–45 s; o ingresso é cobrado no embarque; parte lotada ou 5 s após o 1º passageiro.
  Atração de circuito (`voltas`) dá voltas exatas e o trem volta à estação.

| Chave | Pegada | Custo / manut. mês | Preço padrão | Brinquedo: intensidade · lugares · duração |
|---|---|---|---|---|
| ARVORE | 1×1 | $30 / $2 | | |
| BANCO | 1×1 | $60 / $5 | grátis | só sobre CAMINHO |
| BARRACA | 1×1 | $500 / $80 | comida $4, bebida $2 | |
| BARRACA_BEBIDAS | 1×1 | $350 / $40 | bebida $3 | |
| BANHEIRO | 1×1 | $350 / $50 | grátis | |
| CARROSSEL | 2×2 | $3.000 / $200 | $5 | 5 · 6 · 8 s |
| NAVIO_PIRATA | 3×2 | $7.500 / $350 | $7 | 7 · 10 · 18 s |
| RODA_GIGANTE | 3×2 | $5.000 / $300 | $6 | 2 · 8 · 20 s |
| MONTANHA_RUSSA | 4×3 | $12.000 / $600 | $8 | 8 · 12 · 25 s (2 voltas) |

Efeitos exatos de cada serviço: `OBJETOS` em `objetos.js`. Atrações grandes não ficam sobre CAMINHO nem água.

## Como estender
- **Novo objeto**: (1) `desenhar...(cx, cy, atr, rot)` em desenho.js; (2) entrada em `OBJETOS` com `categoria`, `icone`,
  `nome`, `cor`, `desenhar`, e opcionais `tam`, `altura` (posição do rótulo da fila), `servicos`, `sobreCaminho`; (3) custo/manutenção
  em `ECONOMIA` e preços em `PRECO_PADRAO`. Cartão da barra, construção, painel de preços e save funcionam sozinhos.
  Objeto direcional e não quadrado: trate `rot` no desenho (plano do movimento segue gx ou gy).
- **Novo terreno**: `TIPOS` (com `icone`) + `CUSTO_TERRENO`. **Nova categoria da barra**: `CATEGORIAS`.
- **Novo serviço/necessidade**: `URGENCIA`, `ICONES`, `FELIC_POR_ATIVIDADE` (config.js) e `atualizarNecessidades`.
- **Mudou o formato do save**: aumente `VERSAO_SAVE` e converta em `migrar()` (salvar.js). Campo opcional novo com
  padrão sensato não exige migração, mas convidados novos precisam de um padrão em `base` (em `aplicarJogo`).
- Estado novo que referencie convidados/objetos deve ser serializado com índices/chaves em `serializarJogo`/`aplicarJogo`.

## Save/Load
- API: `GET /api/saves`, `GET|PUT|DELETE /api/saves/:id`. Só `armazenamento.js` sabe que os saves são arquivos JSON
  (trocar por SQLite = reescrever só ele). Id `[a-z0-9-]{1,40}`; gravação atômica (temporário + rename).
- `aplicarJogo` valida tudo **antes** de alterar o jogo (save inválido não estraga o parque); chaves desconhecidas
  viram grama/vazio; convidado em estado incoerente é solto. Serviço simples em uso guarda `ancora` para refazer `def`.
- Texto vindo do usuário (nome de save) entra na tela só por `textContent`, nunca `innerHTML`.

## Verificação
- Não há testes automatizados no repositório. Mínimo antes de entregar: `node --check public/js/*.js`, subir o servidor
  e abrir o jogo no navegador, exercitando o que mudou (construir, salvar/carregar, deixar convidados andarem).
- Headless sem navegador: jsdom com **stub de canvas** (um `Proxy` que aceita qualquer chamada, e `measureText`),
  `requestAnimationFrame = () => 0` (o loop real roda durante `await` e invalida comparações), `fetch` injetado.
  Simule com `window.eval` chamando `atualizar`, `atualizarAtracoes`, `atualizarFinancas`, `atualizarEntrada` com
  `dt = 0.1`. Invariantes úteis: convidado `esperando`/`brincando` pertence a uma fila/atração; `usando` tem `uso.def`.
- Para ver o desenho de verdade: `canvas` (node-canvas) ligado ao jsdom, ou puppeteer. Rode o servidor e o teste no
  mesmo comando se o shell não mantiver processos em segundo plano.

## Armadilhas já encontradas
- `const` arrow chamada antes de definida na carga (TDZ); `;` solto no meio de cadeia `.filter().sort()`.
- Inverter `[gx][gy]` na matriz; reatribuir `mapa`/`objetos` em vez de mutar; esquecer de zerar `rotacoes`/`gestao`.
- Editar uma função e esquecer um uso antigo: ao mudar assinatura (ex.: `tamanhoDe`), faça `grep` de todos os usos.
- Teste com loop real ligado compara estados em momentos diferentes; teste com objeto sem tile livre até o caminho
  (atração precisa de CAMINHO encostado em alguma célula da pegada) dá "ninguém usa".
- Emojis da interface dependem da fonte do sistema operacional.
- Receita ≈ visitantes × dinheiro que trazem ($30–150): guardam até sair com < $2. Mudar só as preferências
  redistribui o gasto entre os objetos, sem aumentar o total (simulação: ~$8,4/s antes e depois da atratividade).

## Ideias / backlog
- Chegadas e tolerância ao preço de entrada dependentes da avaliação do parque; autosave; mais atrações (trem, casa
  mal-assombrada, tiro ao alvo); capacidade nos serviços simples; tolerância que evolui com a experiência;
  histórico financeiro em gráfico; ícones SVG próprios; suporte a toque (o mapa só se move com o botão do meio).
