# Parque de Diversões

Simulador de parque de diversões isométrico (inspirado em RollerCoaster Tycoon), feito em JavaScript puro com `<canvas>`, servido por Node.js + Express.

## Como rodar

Requer [Node.js](https://nodejs.org) 18 ou superior.

```bash
npm install     # só na primeira vez
npm start       # http://localhost:3000
```

- `PORT=8080 npm start` usa outra porta.
- `npm run dev` reinicia o servidor ao editar o `server.js`. Para o código do jogo basta recarregar a página (o servidor manda `no-cache`).

## Controles

| Ação | Como |
|---|---|
| Pintar terreno / construir | botão esquerdo (arraste para pintar vários tiles) |
| Mover o mapa | botão do meio pressionado |
| Zoom | roda do mouse |
| Girar a atração antes de construir | tecla **Z** (muda a tecla em `TECLA_GIRAR`, `config.js`) |
| Ver detalhes de convidado ou preços de um objeto | ferramenta **Inspecionar** |
| Empréstimo e balanço | botão **Finanças** |
| Salvar e carregar o parque | botão **Salvar / Carregar** |

## Estrutura

```
server.js            servidor Express: arquivos estáticos e API de saves
armazenamento.js     camada de armazenamento dos saves (arquivos JSON em ./saves)
saves/               criada automaticamente; um arquivo .json por save (fora do git)
package.json
public/
  index.html         estrutura da página e ordem dos scripts
  css/style.css      estilos e tema claro/escuro
  js/
    config.js        constantes e balanceamento (custos, preços, juros, taxas)
    utils.js         funções genéricas (moeda, aleatório, ...)
    dom.js           referências aos elementos da página
    estado.js        dados mutáveis do jogo (mapa, objetos, caixa, convidados)
    iso.js           matemática isométrica
    desenho.js       tudo que desenha no canvas
    objetos.js       catálogo OBJETOS e regras de construção
    atracoes.js      filas, embarque e corrida das atrações
    necessidades.js  necessidades dos convidados e busca de serviços
    convidados.js    criação e movimentação
    entrada.js       entrada/saída do parque
    financas.js      caixa, empréstimo, cobranças, fechamento do mês
    ui.js            painéis de detalhes e tela de finanças
    barra.js         barra de construção (abas por categoria, cartões, dicas)
    salvar.js        serializar, validar e restaurar o estado; cliente da API; tela de saves
    input.js         mouse/toque, câmera, regras das ferramentas
    main.js          mapa inicial, loop do jogo e partida
```

### Ordem dos scripts

Os arquivos são scripts clássicos que compartilham o mesmo escopo global. Cada um usa o que foi definido nos anteriores, e a ordem das tags `<script>` no `index.html` importa:

- `desenho.js` vem antes de `objetos.js`, porque o catálogo `OBJETOS` referencia as funções de desenho ao ser criado.
- `main.js` é sempre o último: ele monta o mapa inicial e dá a partida.

### Onde mexer

- **Balanceamento** (custos, preços, juros, velocidade, filas): `js/config.js`.
- **Novo terreno**: entrada em `TIPOS` (com `icone`) e `CUSTO_TERRENO`.
- **Novo objeto**: função `desenhar...` em `desenho.js`, entrada em `OBJETOS` (`objetos.js`) e custos em `ECONOMIA`/`PRECO_PADRAO` (`config.js`). O cartão na barra aparece sozinho, na categoria e com o ícone que você declarar em `categoria` e `icone`.
- **Campos opcionais de uma atração** (em `OBJETOS`): `tam` (pegada em tiles), `altura` (posição do rótulo da fila) e, no serviço, `capacidade`, `duracao`, `voltas` (atração de circuito: a corrida dá n voltas e o trem volta à estação), `intensidade` (1 a 10, compara com a `tolerancia` do convidado; regras e limites em `config.js`) e `giro` (velocidade de rotação parado/em movimento).
- **Mapa inicial**: `montarMapaInicial()` em `main.js`.

## Salvar e carregar

Cada save é um arquivo `saves/<id>.json`, onde o id vem do nome digitado (`"Meu Parque"` vira `meu-parque`). Ele guarda o terreno, os objetos, preços e receitas, filas das atrações, finanças e todos os convidados, com o que cada um está fazendo.

- A orientação dos objetos girados fica em `estado.rotacoes` (campo opcional: saves anteriores a ele carregam normalmente, sem giros).
- O arquivo tem um campo `versao`. **Ao mudar a estrutura do estado do jogo, aumente `VERSAO_SAVE` em `salvar.js`** e acrescente a conversão em `migrar()`, para os saves antigos continuarem abrindo.
- Ao carregar, o save é validado antes de tocar no jogo: se estiver inválido, o parque atual fica intacto. Terrenos e objetos que não existem mais viram grama e vazio, e campos novos de convidado ganham valores padrão.
- A gravação é atômica (arquivo temporário + renomear), então uma queda no meio não corrompe o save anterior.
- Para usar outra pasta: `SAVES_DIR=/caminho npm start`.

### API

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/saves` | lista os saves (id, nome, salvoEm, resumo) |
| GET | `/api/saves/:id` | devolve um save completo |
| PUT | `/api/saves/:id` | cria ou substitui (corpo: `versao`, `nome`, `resumo`, `estado`) |
| DELETE | `/api/saves/:id` | apaga |

O id só aceita letras minúsculas, números e hífen. Para trocar o armazenamento (por exemplo, SQLite), reescreva só o `armazenamento.js`, mantendo `listar`, `ler`, `gravar` e `apagar`.

## Barra de construção

A barra inferior tem **abas por categoria** (Ferramentas, Terreno, Cenário, Serviços, Atrações e Teste). Cada aba mostra cartões com ícone, nome e preço; passe o mouse sobre um cartão para ver custo, manutenção, tamanho e, nos brinquedos, intensidade e lugares. A aba que contém a ferramenta ativa mostra um ponto laranja, e cartões acima do saldo do caixa ficam esmaecidos com o preço em vermelho.

- As categorias e a ordem das abas ficam em `CATEGORIAS` (`config.js`). Uma categoria sem itens não aparece.
- Itens com `camada` selecionam uma ferramenta; itens com `acao` executam algo na hora (veja `listaDeItens()` em `barra.js`).
