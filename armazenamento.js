// Camada de armazenamento dos saves: um arquivo JSON por slot, na pasta ./saves.
//
// Todo o resto do servidor só usa as funções exportadas aqui (listar, ler, gravar, apagar).
// Para trocar JSON por outro armazenamento (ex.: SQLite), basta reescrever este arquivo
// mantendo as mesmas funções.

const fs = require('fs/promises');
const path = require('path');

const DIR = process.env.SAVES_DIR || path.join(__dirname, 'saves');

// Só letras minúsculas, números e hífen: impede "../" e outros truques de caminho.
const ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,39}$/;

const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });

function caminho(id) {
  if (!ID_VALIDO.test(id)) throw erro(400, 'Nome de save inválido');
  return path.join(DIR, id + '.json');
}

async function listar() {
  await fs.mkdir(DIR, { recursive: true });
  const saves = [];
  for (const arquivo of await fs.readdir(DIR)) {
    if (!arquivo.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(await fs.readFile(path.join(DIR, arquivo), 'utf8'));
      saves.push({ id: arquivo.slice(0, -5), nome: doc.nome, salvoEm: doc.salvoEm, resumo: doc.resumo || {} });
    } catch { /* arquivo corrompido ou estranho: ignora na listagem */ }
  }
  return saves.sort((a, b) => String(b.salvoEm).localeCompare(String(a.salvoEm)));   // mais recente primeiro
}

async function ler(id) {
  try {
    return JSON.parse(await fs.readFile(caminho(id), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') throw erro(404, 'Save não encontrado');
    throw e;
  }
}

// Gravação atômica: escreve num arquivo temporário e só então renomeia. Se o processo cair
// no meio da escrita, o save anterior continua intacto.
async function gravar(id, doc) {
  const destino = caminho(id);
  await fs.mkdir(DIR, { recursive: true });
  const temporario = `${destino}.${process.pid}.tmp`;
  await fs.writeFile(temporario, JSON.stringify(doc));
  await fs.rename(temporario, destino);
}

async function apagar(id) {
  try {
    await fs.unlink(caminho(id));
  } catch (e) {
    if (e.code === 'ENOENT') throw erro(404, 'Save não encontrado');
    throw e;
  }
}

module.exports = { listar, ler, gravar, apagar, erro };
