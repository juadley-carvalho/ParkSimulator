// gerar-pdf.js — transforma docs/manual/manual.html em docs/manual/Manual-Parque-de-Diversoes.pdf
//
// Uso (na pasta do projeto):   node docs/manual/ferramentas/gerar-pdf.js
//
// Abre o manual no Edge sem janela e imprime com Page.printToPDF (A4, fundo impresso, margens e números
// de página definidos no CSS do manual). O índice ganha os números de página assim: cada seção
// ".pagina-inicio" começa numa página nova, então imprimimos cada uma SOZINHA, contamos as páginas e
// somamos. Depois preenchemos o índice e imprimimos o documento inteiro, conferindo o total.

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { RAIZ, abrirNavegador } = require('./navegador');

const PASTA = path.join(RAIZ, 'docs', 'manual');
const HTML = path.join(PASTA, 'manual.html');
const PDF = path.join(PASTA, 'Manual-Parque-de-Diversoes.pdf');

// Número de páginas de um PDF: o maior "/Count" da árvore de páginas
function contarPaginas(buf) {
  const texto = buf.toString('latin1');
  let max = 0;
  for (const m of texto.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g))
    max = Math.max(max, Number(m[1] || m[2]));
  return max;
}

async function main() {
  const nav = await abrirNavegador({ largura: 1000, altura: 1400 });
  const imprimir = async () => {
    const r = await nav.enviar('Page.printToPDF', {
      printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, generateDocumentOutline: true,
    });
    return Buffer.from(r.data, 'base64');
  };
  try {
    await nav.abrir(pathToFileURL(HTML).href);
    // Todas as imagens carregadas (uma imagem faltando vira erro, não um buraco no PDF)
    const faltando = await nav.avaliar(`Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))
      .then(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')))`);
    if (faltando.length) throw new Error('Imagens que não abriram: ' + faltando.join(', '));
    await nav.avaliar(`document.fonts.ready.then(() => true)`);

    const ids = await nav.avaliar(`[...document.querySelectorAll('.capa, .pagina-inicio')].map(s => s.id)`);
    const paginas = {};
    for (const id of ids) {
      await nav.avaliar(`document.querySelectorAll('.capa, .pagina-inicio').forEach(s => { s.style.display = s.id === '${id}' ? '' : 'none'; }); true`);
      paginas[id] = contarPaginas(await imprimir());
    }
    await nav.avaliar(`document.querySelectorAll('.capa, .pagina-inicio').forEach(s => { s.style.display = ''; }); true`);

    // Página inicial de cada seção = 1 + soma das anteriores; vai para o índice
    const inicio = {};
    let pagina = 1;
    for (const id of ids) { inicio[id] = pagina; pagina += paginas[id]; }
    const esperado = pagina - 1;
    await nav.avaliar(`(() => {
      for (const [id, p] of Object.entries(${JSON.stringify(inicio)})) {
        const pg = document.querySelector('.indice li[data-alvo="' + id + '"] .pg');
        if (pg) pg.textContent = p;
      }
      return true;
    })()`);

    const pdf = await imprimir();
    const total = contarPaginas(pdf);
    fs.writeFileSync(PDF, pdf);
    console.log('Páginas por seção:', ids.map(id => `${id}=${paginas[id]} (p. ${inicio[id]})`).join(', '));
    console.log(`PDF: ${PDF} · ${total} páginas · ${(pdf.length / 1024 / 1024).toFixed(1)} MB`);
    if (total !== esperado) console.warn(`ATENÇÃO: o PDF tem ${total} páginas, mas a soma das seções deu ${esperado}: confira o índice.`);
  } finally {
    await nav.fechar();
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
