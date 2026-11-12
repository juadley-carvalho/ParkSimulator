/* ============================================================
   main.js — mapa inicial, loop do jogo e partida
   Precisa ser o ÚLTIMO script carregado.
   ============================================================ */

// Terreno e construções com que o parque começa. Edite à vontade.
function montarMapaInicial() {
  for (let i = 0; i < MAPA; i++) { mapa[12][i] = 'CAMINHO'; mapa[i][12] = 'CAMINHO'; }
  for (let gy = 3; gy <= 6; gy++) for (let gx = 3; gx <= 7; gx++) mapa[gy][gx] = 'AGUA';
  [[9,9],[15,15],[16,9],[9,16],[2,10]].forEach(([gx, gy]) => objetos[gy][gx] = 'ARVORE');
  construir('BANCO', 13, 11);
  construir('BARRACA', 14, 13);
  construir('BANHEIRO', 10, 11);
  construir('CARROSSEL', 8, 13);
  construir('RODA_GIGANTE', 15, 10);
  construir('MONTANHA_RUSSA', 2, 13);
  construir('NAVIO_PIRATA', 20, 10);
  construir('BARRACA_BEBIDAS', 13, 17);
}

function loop(t) {
  const dt = Math.min((t - tAnterior) / 1000, 0.1);   // limita dt: ao voltar de outra aba, ninguém "teleporta"
  tAnterior = t;
  tempo += dt;
  atualizar(dt);
  atualizarAtracoes(dt);
  atualizarFinancas(dt);
  atualizarEntrada(dt);
  desenhar();
  qtd.textContent = `${convidados.length} (saíram: ${stats.sairam})`;
  atualizarPainel();
  atualizarPainelObj();
  atualizarFinancasUI();
  atualizarParqueUI();
  atualizarBarra();
  requestAnimationFrame(loop);
}

// ---------- Partida ----------
montarMapaInicial();
iniciarUI();
iniciarSalvar();
montarBarra();
iniciarEntradaUsuario();
ajustarTamanho();
centralizar();
// (sem convidados iniciais: eles chegam pela entrada, ver atualizarEntrada)
requestAnimationFrame(loop);
