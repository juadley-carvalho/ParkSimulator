/* ============================================================
   utils.js — funções pequenas e genéricas
   Depende de: config.js
   ============================================================ */

const arred = v => Math.round(v * 100) / 100;

// Negativo com o sinal antes do símbolo: −$2.064,00 (e não $-2.064,00)
const moeda = v => (v < 0 ? '−$' : '$') +
  Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Valor curto para os cartões da barra: $3.000 (sem centavos)
const moedaCurta = v => '$' + v.toLocaleString('pt-BR');
const aleatorio = (min, max) => min + Math.random() * (max - min);

// Escala 0..100. Em fome, sede, banheiro e náusea, 100 = PIOR. Em energia e felicidade, 100 = MELHOR.
const limitar = v => Math.max(0, Math.min(100, v));

const custoDe = chave => (ECONOMIA[chave] || {}).custo || 0;

const $ = id => document.getElementById(id);

function chaveAtr(gx, gy) { return gx + ',' + gy; }

// fin.mes é um contador que só cresce (1, 2, 3...). Daqui saem o nome do mês e o ano:
// mês 1 = Janeiro do Ano 1, mês 13 = Janeiro do Ano 2. O "% 12" (resto da divisão) dá a volta no ano.
function nomeDoMes(mes) {
  return `${NOMES_MESES[(mes - 1) % 12]}, Ano ${Math.floor((mes - 1) / 12) + 1}`;
}

// Dia (1..DIAS_POR_MES) a partir dos segundos já corridos no mês
function diaDoMes(tMes) {
  return Math.min(DIAS_POR_MES, Math.floor(tMes / SEG_POR_MES * DIAS_POR_MES) + 1);
}
