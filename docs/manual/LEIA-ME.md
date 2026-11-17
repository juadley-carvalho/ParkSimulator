# Manual do jogador

- `Manual-Parque-de-Diversoes.pdf` — o manual pronto (A4).
- `manual.html` — a fonte do manual (texto, layout e CSS de impressão). Pode ser aberto no navegador.
- `img/` — capturas do jogo usadas no manual (geradas automaticamente).
- `ferramentas/` — scripts que regeram as imagens e o PDF:
  - `capturar.js` — sobe o servidor do jogo, abre o Edge sem janela, monta cada cena e salva os PNGs em `img/`;
  - `gerar-pdf.js` — imprime o `manual.html` em PDF e preenche os números de página do índice;
  - `navegador.js` — peças comuns (servidor, Edge e protocolo CDP).

## Como regerar

Requisitos: Node.js 18+ (usa o `fetch` e o `WebSocket` nativos; testado com o Node 22) e o Microsoft Edge
(caminho padrão `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`; outro caminho: variável `EDGE`).
Nenhum pacote extra é instalado.

Na pasta do projeto:

```
node docs/manual/ferramentas/capturar.js     # ~1 min: refaz as 50 imagens de img/
node docs/manual/ferramentas/gerar-pdf.js    # ~30 s: refaz o PDF
```

- O servidor do jogo sobe na porta **3123** e o Edge usa a porta de depuração **9333** (variáveis `PORTA_JOGO`
  e `PORTA_CDP` para trocar). As duas precisam estar livres.
- Saves de teste e o perfil do Edge ficam em `%TEMP%\parque-docs` (variável `PASTA_TEMP`), nunca no repositório.
  A pasta `saves/` do projeto não é tocada.
- No fim, os scripts encerram o servidor e só os processos `msedge.exe` que usam esse perfil temporário.
- As cenas são montadas com as próprias funções do jogo (`limparParque`, `construir`, `semear`, `simular`...);
  se o jogo mudar (novo objeto, função renomeada), ajuste `capturar.js`. Cada objeto de `OBJETOS` ganha a
  sua imagem `img/obj-CHAVE.png` sozinho, mas a ficha no `manual.html` é escrita à mão.
- A simulação tem sorteios: duas execuções nunca dão imagens idênticas. Confira as imagens depois de regerar.

## Ao mudar o jogo

O texto do manual não é gerado do código: números (custos, preços, intensidades, prazos) foram copiados de
`public/js/config.js`, `public/js/objetos.js` e `public/cenarios/*.json` na versão v1.10.0. Ao mudar o
balanceamento, atualize o `manual.html` (fichas, tabelas do capítulo 14 e cenários) e também
`docs/DOCUMENTACAO_TECNICA.md`, e rode os dois scripts.

O índice é numerado automaticamente: cada `<section class="pagina-inicio">` começa numa página nova, e o
`gerar-pdf.js` imprime cada seção sozinha para contar as páginas. Para um capítulo novo, crie a seção com um
`id` e uma linha `<li data-alvo="id">` no índice.
