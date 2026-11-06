// Servidor do Parque de Diversões.
// Serve os arquivos da pasta "public" (HTML, CSS e JavaScript do jogo).
//
// Uso:   npm start            -> http://localhost:3000
//        PORT=8080 npm start  -> escolhe outra porta
//        npm run dev          -> reinicia sozinho ao editar o server.js

const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();

// Arquivos estáticos. Em desenvolvimento, "no-cache" evita ver uma versão antiga do código.
app.use(express.static(PUBLIC_DIR, {
  etag: false,
  setHeaders: res => res.setHeader('Cache-Control', 'no-cache'),
}));

// Espaço para as próximas etapas (salvar e carregar o parque, por exemplo):
// app.use(express.json());
// app.get('/api/parque', (req, res) => { ... });

app.listen(PORT, () => {
  console.log(`Parque de Diversões rodando em http://localhost:${PORT}`);
});
