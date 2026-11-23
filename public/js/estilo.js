/* ============================================================
   estilo.js — estilo visual: Original, Retrô 2× e Retrô 3× (botão 🎨 da barra superior)
   Depende de: config.js, estado.js, dom.js (canvas), utils.js ($)
   ============================================================ */

// Pixels do canvas por pixel de tela. No original é a densidade da tela (dpr). No retrô é dpr / escala:
// o canvas passa a ter 1/escala da resolução da tela e o navegador o amplia SEM suavizar (CSS
// `image-rendering: pixelated`), então cada "pixel" do desenho vira um bloco escala x escala da tela.
// Só o tamanho do canvas muda: câmera, mouse e lógica continuam em pixels de tela (CSS), por isso
// `telaParaGrade` e `gradeParaMundo` não sabem que o estilo existe. Para converter coordenadas ou dimensionar
// o canvas, use sempre este fator: nunca `devicePixelRatio` nem `canvas.width` direto.
function fatorCanvas() {
  return (window.devicePixelRatio || 1) / escalaPixel;
}

function estiloPorId(id) {
  return ESTILOS_VISUAIS.find(e => e.id === id) || ESTILOS_VISUAIS[0];   // id desconhecido: o padrão
}

// Estilo guardado de uma sessão anterior (localStorage pode estar bloqueado: aí vale o padrão)
function estiloSalvo() {
  try { return estiloPorId(localStorage.getItem(CHAVE_ESTILO)).id; } catch { return ESTILOS_VISUAIS[0].id; }
}

function estiloAtual() {
  return ESTILOS_VISUAIS.find(e => e.escala === escalaPixel) || ESTILOS_VISUAIS[0];
}

// Aplica o estilo. Redimensionar o canvas o apaga, mas o loop desenha o quadro seguinte sozinho.
function aplicarEstiloVisual(id, { salvar = true } = {}) {
  const estilo = estiloPorId(id);
  escalaPixel = estilo.escala;
  canvas.classList.toggle('pixelado', estilo.escala > 1);
  canvas.classList.toggle('paleta-retro', estilo.escala > 1 && estilo.paleta);
  ajustarTamanho();
  if (salvar) { try { localStorage.setItem(CHAVE_ESTILO, estilo.id); } catch { /* sem localStorage: vale só nesta sessão */ } }
  atualizarBotaoEstilo();
  return estilo;
}

function atualizarBotaoEstilo() {
  const b = $('btnEstilo');
  const atual = estiloAtual();
  const prox = ESTILOS_VISUAIS[(ESTILOS_VISUAIS.indexOf(atual) + 1) % ESTILOS_VISUAIS.length];
  b.textContent = atual.escala > 1 ? `🎨 ${atual.escala}×` : '🎨';   // compacto: a barra superior já é larga
  b.title = `Estilo visual: ${atual.nome} (clique: ${prox.nome})`;
}

// Liga o botão (que alterna os estilos em ciclo) e aplica o que foi escolhido da última vez (chamada em main.js)
function iniciarEstiloVisual() {
  $('btnEstilo').addEventListener('click', () => {
    const prox = ESTILOS_VISUAIS[(ESTILOS_VISUAIS.indexOf(estiloAtual()) + 1) % ESTILOS_VISUAIS.length];
    aplicarEstiloVisual(prox.id);
  });
  aplicarEstiloVisual(estiloSalvo(), { salvar: false });
}
