/* ============================================================
   avaliacao.js — avaliação do parque (nota 0 a 999) e pensamentos dos convidados
   Depende de: config.js, estado.js, objetos.js
   ============================================================ */

// Média de uma lista com reduce: soma f(item) de todos e divide pelo tamanho.
// reduce((acumulado, item) => novoAcumulado, valorInicial) "dobra" a lista num único valor.
// Lista vazia: devolve o padrão (sem convidados não há média).
function media(lista, f, padrao) {
  return lista.length ? lista.reduce((soma, x) => soma + f(x), 0) / lista.length : padrao;
}

// As partes da nota, cada uma com os pontos que valeu e o máximo possível (penalidades: negativos).
// Devolver as partes (e não só o total) permite mostrar na janela do parque DE ONDE veio a nota.
function partesDaAvaliacao() {
  const A = AVALIACAO;
  const felic = media(convidados, g => g.n.felicidade, A.felicidadeNeutra);
  // Necessidades em dia: 1 = fome, sede, banheiro e náusea todos em 0; 0 = todos no pior (100)
  const emDia = media(convidados, g => 1 - (g.n.fome + g.n.sede + g.n.banheiro + g.n.nausea) / 400, A.necessidadesNeutras);
  // Set guarda cada valor UMA vez: dois carrosséis contam como um tipo só
  const tipos = new Set(), servicos = new Set();
  for (const linha of objetos)
    for (const c of linha) {
      if (typeof c !== 'string') continue;                       // só âncoras: cada objeto conta uma vez
      if (OBJETOS[c].categoria === 'atracoes') tipos.add(c);
      for (const s of Object.keys(OBJETOS[c].servicos || {})) servicos.add(s);
    }
  const atendidos = SERVICOS_AVALIADOS.filter(s => servicos.has(s)).length;
  return [
    { nome: 'Felicidade', icone: '😊', pontos: felic / 100 * A.felicidade, max: A.felicidade },
    { nome: 'Variedade de atrações', icone: '🎢', pontos: Math.min(A.variedade, tipos.size * A.porTipoAtracao), max: A.variedade },
    { nome: 'Serviços', icone: '🍔', pontos: atendidos / SERVICOS_AVALIADOS.length * A.servicos, max: A.servicos },
    { nome: 'Necessidades em dia', icone: '💧', pontos: emDia * A.necessidades, max: A.necessidades },
    { nome: 'Saíram infelizes', icone: '😞', pontos: -A.infelizes * proporcao(avaliacao.infelizes, avaliacao.saidas) },
    { nome: 'Desistiram no portão', icone: '🎟️', pontos: -A.recusas * proporcao(avaliacao.recusas, avaliacao.chegadas) },
  ];
}

// Jogo novo ou save sem avaliação: começa direto na nota calculada (sem "subir" devagar desde 500)
function iniciarAvaliacao() {
  Object.assign(avaliacao, avaliacaoInicial());
  avaliacao.nota = avaliacao.alvo = calcularAvaliacao();
  avaliacao.tCalculo = INTERVALO_AVALIACAO;
}

// Fração 0..1, com denominador mínimo (poucos casos ainda não dizem muito)
function proporcao(parte, total) { return Math.min(1, parte / Math.max(total, AVALIACAO.amostraMinima)); }

function calcularAvaliacao() {
  const total = partesDaAvaliacao().reduce((soma, p) => soma + p.pontos, 0);
  return Math.max(0, Math.min(NOTA_MAX, total));
}

// Chamada a cada quadro pelo loop. As penalidades "esquecem" aos poucos: cada uma cai pela metade
// a cada ~0,7 mês (decaimento exponencial). Assim a nota não dá um salto na virada do mês, como
// aconteceria se a contagem simplesmente zerasse.
function atualizarAvaliacao(dt) {
  const esquecer = Math.exp(-dt / SEG_POR_MES);
  for (const k of ['saidas', 'infelizes', 'chegadas', 'recusas']) avaliacao[k] *= esquecer;
  avaliacao.tCalculo -= dt;
  if (avaliacao.tCalculo <= 0) { avaliacao.alvo = calcularAvaliacao(); avaliacao.tCalculo = INTERVALO_AVALIACAO; }
  // A nota mostrada persegue a calculada: anda uma fração da distância a cada quadro (suavização)
  avaliacao.nota += (avaliacao.alvo - avaliacao.nota) * (1 - Math.exp(-dt / SUAVIZAR_AVALIACAO));
}

// Efeitos da nota (0 = péssima, 1 = máxima)
function notaRelativa() { return avaliacao.nota / NOTA_MAX; }
function maxConvidados() { return Math.round(CONVIDADOS_MIN + (CONVIDADOS_MAX - CONVIDADOS_MIN) * notaRelativa()); }
function fracaoMaxEntrada() { return FRACAO_ENTRADA_MIN + (FRACAO_ENTRADA_MAX - FRACAO_ENTRADA_MIN) * notaRelativa(); }
function escalaChegada() { return 2 ** ((NOTA_INICIAL - avaliacao.nota) / NOTA_INICIAL); }

// ---------- Pensamentos e queixas ----------
// Queixa sem convidado para mostrar o balão (quem desiste no portão nem chega a entrar)
function registrarQueixa(tipo) { fin.queixasMes[tipo] = (fin.queixasMes[tipo] || 0) + 1; }

// O convidado pensa algo: balão sobre a cabeça e +1 nas queixas do mês. A mesma queixa do
// mesmo convidado só conta de novo depois de INTERVALO_PENSAMENTO (senão contaria a cada tile).
function pensar(g, tipo) {
  if (tempo < (g.pensou[tipo] || 0)) return;
  g.pensou[tipo] = tempo + INTERVALO_PENSAMENTO;
  g.pensamento = { tipo, ate: tempo + DURACAO_PENSAMENTO };
  registrarQueixa(tipo);
}

// Queixas ordenadas da mais comum para a menos: [['fila', 12], ['banheiro', 5], ...]
function queixasOrdenadas(queixas) {
  return Object.entries(queixas || {}).filter(([t, n]) => PENSAMENTOS[t] && Number.isFinite(n) && n > 0).sort((a, b) => b[1] - a[1]);
}
