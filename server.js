// Servidor do Parque de Diversões.
// Serve os arquivos da pasta "public" (HTML, CSS e JavaScript do jogo) e a API de saves.
//
// Uso:   npm start            -> http://localhost:3000
//        PORT=8080 npm start  -> escolhe outra porta
//        npm run dev          -> reinicia sozinho ao editar o server.js
//
// API de saves (JSON):
//   GET    /api/saves        lista os saves (id, nome, salvoEm, resumo)
//   GET    /api/saves/:id    devolve um save completo
//   PUT    /api/saves/:id    cria ou substitui um save
//   DELETE /api/saves/:id    apaga um save

const path = require('path');
const express = require('express');
const armazenamento = require('./armazenamento');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const { erro } = armazenamento;

const app = express();

// ---------- API ----------
const api = express.Router();
api.use(express.json({ limit: '5mb' }));

// Express 4 não captura erros de funções async sozinho: este "embrulho" repassa ao tratador.
const rota = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

api.get('/saves', rota(async (req, res) => {
  res.json(await armazenamento.listar());
}));

api.get('/saves/:id', rota(async (req, res) => {
  res.json(await armazenamento.ler(req.params.id));
}));

api.put('/saves/:id', rota(async (req, res) => {
  const { versao, nome, resumo, estado } = req.body || {};
  if (typeof versao !== 'number' || !estado || typeof estado !== 'object') throw erro(400, 'Corpo do save inválido');
  const doc = {
    versao,
    nome: String(nome || req.params.id).slice(0, 40),
    salvoEm: new Date().toISOString(),
    resumo: resumo && typeof resumo === 'object' ? resumo : {},
    estado,
  };
  await armazenamento.gravar(req.params.id, doc);
  res.json({ id: req.params.id, nome: doc.nome, salvoEm: doc.salvoEm });
}));

api.delete('/saves/:id', rota(async (req, res) => {
  await armazenamento.apagar(req.params.id);
  res.status(204).end();
}));

api.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
app.use('/api', api);

// ---------- Arquivos estáticos ----------
// Em desenvolvimento, "no-cache" evita ver uma versão antiga do código.
app.use(express.static(PUBLIC_DIR, {
  etag: false,
  setHeaders: res => res.setHeader('Cache-Control', 'no-cache'),
}));

// ---------- Tratamento de erros ----------
app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ erro: status === 500 ? 'Erro interno do servidor' : err.message });
});

app.listen(PORT, () => {
  console.log(`Parque de Diversões rodando em http://localhost:${PORT}`);
});
