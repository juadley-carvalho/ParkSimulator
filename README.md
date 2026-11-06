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
| Ver detalhes de convidado ou preços de um objeto | ferramenta **Inspecionar** |
| Empréstimo e balanço | botão **Finanças** |

## Estrutura

```
server.js            servidor Express (serve a pasta public)
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
    ui.js            painéis, tela de finanças, barra de ferramentas
    input.js         mouse/toque, câmera, regras das ferramentas
    main.js          mapa inicial, loop do jogo e partida
```

### Ordem dos scripts

Os arquivos são scripts clássicos que compartilham o mesmo escopo global. Cada um usa o que foi definido nos anteriores, e a ordem das tags `<script>` no `index.html` importa:

- `desenho.js` vem antes de `objetos.js`, porque o catálogo `OBJETOS` referencia as funções de desenho ao ser criado.
- `main.js` é sempre o último: ele monta o mapa inicial e dá a partida.

### Onde mexer

- **Balanceamento** (custos, preços, juros, velocidade, filas): `js/config.js`.
- **Novo terreno**: entrada em `TIPOS` e `CUSTO_TERRENO`.
- **Novo objeto**: função `desenhar...` em `desenho.js`, entrada em `OBJETOS` (`objetos.js`) e custos em `ECONOMIA`/`PRECO_PADRAO` (`config.js`). O botão da barra aparece sozinho.
- **Campos opcionais de uma atração** (em `OBJETOS`): `tam` (pegada em tiles), `altura` (posição do rótulo da fila) e, no serviço, `capacidade`, `duracao` e `giro` (velocidade de rotação parado/em movimento).
- **Mapa inicial**: `montarMapaInicial()` em `main.js`.
