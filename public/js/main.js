/* ============================================================
   main.js — mapa inicial, loop do jogo e partida
   Precisa ser o ÚLTIMO script carregado.
   ============================================================ */

// Terreno e construções com que o parque começa. Edite à vontade.
// As coordenadas são de um bloco 24 x 24. Num mapa maior, o bloco vai para o meio da borda de baixo,
// colado na entrada (dx, dy = deslocamento): se ficasse no centro do mapa, todo convidado andaria
// dezenas de tiles de caminho vazio (e de felicidade perdida) até o primeiro brinquedo.
function montarMapaInicial() {
  const dx = ENTRADA.gx - 12, dy = MAPA - 24, B = 24;   // no mapa 24 x 24: dx = dy = 0
  for (let i = 0; i < B; i++) { mapa[12 + dy][i + dx] = 'CAMINHO'; mapa[i + dy][12 + dx] = 'CAMINHO'; }
  for (let gy = 3; gy <= 6; gy++) for (let gx = 3; gx <= 7; gx++) mapa[gy + dy][gx + dx] = 'AGUA';
  [[9,9],[15,15],[16,9],[9,16],[2,10]].forEach(([gx, gy]) => objetos[gy + dy][gx + dx] = 'ARVORE');
  // Passa pelas mesmas regras do jogador (podeConstruir): sem isso, o banco ficou anos na grama em (13, 11)
  const por = (chave, gx, gy) => {
    if (podeConstruir(chave, gx + dx, gy + dy)) construir(chave, gx + dx, gy + dy);
    else console.warn(`Parque inicial: ${chave} não cabe em (${gx + dx}, ${gy + dy})`);
  };
  por('BANCO', 12, 11);   // sobre o caminho, logo acima do cruzamento (o tile de caminho mais perto de onde estava)
  por('BARRACA', 14, 13);
  por('BANHEIRO', 10, 11);
  por('CARROSSEL', 8, 13);
  por('RODA_GIGANTE', 15, 10);
  por('MONTANHA_RUSSA', 2, 13);
  por('NAVIO_PIRATA', 20, 10);
  por('BARRACA_BEBIDAS', 13, 17);
  por('LIXEIRA', 14, 12);   // perto da comida e da bebida, onde o lixo nasce
  por('LIXEIRA', 12, 15);
  contratarFuncionario('faxineiro', 12 + dx, 20 + dy);
}

// Um passo da simulação (dt em segundos de JOGO, no máximo PASSO_MAX)
function simular(dt) {
  tempo += dt;
  atualizarValoresFlutuantes();
  atualizarLotacao(dt);   // antes de andar: o passo de cada um depende do aperto
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
iniciarEstiloVisual();   // aplica o estilo salvo e já dimensiona o canvas
novoJogoLivre();   // parque de fundo da tela inicial (parado até o jogador escolher)
jogoEmAndamento = false;
abrirInicio();
// (sem convidados iniciais: eles chegam pela entrada, ver atualizarEntrada)
requestAnimationFrame(loop);
