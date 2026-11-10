/* ============================================================
   utils.js — funções pequenas e genéricas
   Depende de: config.js
   ============================================================ */

const arred = v => Math.round(v * 100) / 100;

const moeda = v => '$' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Valor curto para os cartões da barra: $3.000 (sem centavos)
const moedaCurta = v => '$' + v.toLocaleString('pt-BR');
const aleatorio = (min, max) => min + Math.random() * (max - min);

// Escala 0..100. Em fome, sede, banheiro e náusea, 100 = PIOR. Em energia e felicidade, 100 = MELHOR.
const limitar = v => Math.max(0, Math.min(100, v));

const custoDe = chave => (ECONOMIA[chave] || {}).custo || 0;

const $ = id => document.getElementById(id);

function chaveAtr(gx, gy) { return gx + ',' + gy; }
