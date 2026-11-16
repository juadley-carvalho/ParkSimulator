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
  construir('LIXEIRA', 14, 12);   // perto da comida e da bebida, onde o lixo nasce
  construir('LIXEIRA', 12, 15);
  contratarFaxineiro(12, 20);
}

// Um passo da simulação (dt em segundos de JOGO, no máximo PASSO_MAX)
function simular(dt) {
  tempo += dt;
  atualizar(dt);
  atualizarFuncionarios(dt);
  atualizarAtracoes(dt);
  atualizarFinancas(dt);
  atualizarEntrada(dt);
  atualizarAvaliacao(dt);
  atualizarPartida();
}

function loop(t) {
  const dtReal = Math.min((t - tAnterior) / 1000, 0.1);   // limita: ao voltar de outra aba, ninguém "teleporta"
  tAnterior = t;
  tempoReal += dtReal;
  // Em 4x, um quadro vale 4 vezes mais tempo de jogo. Um passo único de 0,4 s faria o convidado pular
  // tiles inteiros (e as decisões que ele toma ao chegar em cada um), então o tempo é dividido em
  // subpassos de até PASSO_MAX. Só simula com a fase "jogando" (na tela inicial e no fim, o parque para)
  // e para no meio se a fase mudar (um cenário vencido no 2º subpasso não roda o 3º).
  let resta = fase === 'jogando' ? dtReal * velocidade : 0;
  while (resta > 1e-9 && fase === 'jogando') {
    const dt = Math.min(resta, PASSO_MAX);
    simular(dt);
    resta -= dt;
  }
  atualizarAutosave(dtReal);
  desenhar();
  qtd.textContent = `${convidados.length} (saíram: ${stats.sairam})`;
  atualizarPainel();
  atualizarPainelObj();
  atualizarFinancasUI();
  atualizarParqueUI();
  atualizarBarra();
  atualizarObjetivoUI();
  requestAnimationFrame(loop);
}

// ---------- Partida ----------
iniciarUI();
iniciarSalvar();
iniciarMusica();
iniciarCenarios();
iniciarVelocidades();
iniciarEntradaUsuario();
ajustarTamanho();
novoJogoLivre();   // parque de fundo da tela inicial (parado até o jogador escolher)
jogoEmAndamento = false;
abrirInicio();
// (sem convidados iniciais: eles chegam pela entrada, ver atualizarEntrada)
requestAnimationFrame(loop);
