/* ============================================================
   iso.js — matemática isométrica (grade <-> tela)
   Depende de: estado.js (camera)
   ============================================================ */

function gradeParaMundo(gx, gy) {
  return { x: (gx - gy) * TILE_W / 2, y: (gx + gy) * TILE_H / 2 };
}

// O que a tela mostra, medido nas diagonais da grade: d = gx - gy cresce para a direita e
// s = gx + gy cresce para baixo (é o que gradeParaMundo usa). Um tile ocupa d-1..d+1 e s..s+2.
// "folga" alarga a vista para os lados e para cima; "alto" estende só para baixo: um objeto alto
// plantado abaixo da borda da tela ainda aparece (o desenho sobe a partir do chão).
function vistaNaGrade(folga = 0, alto = 0) {
  const z = camera.zoom, meioW = TILE_W / 2, meioH = TILE_H / 2;
  return { dMin: -camera.x / z / meioW - folga, dMax: (innerWidth - camera.x) / z / meioW + folga,
           sMin: -camera.y / z / meioH - folga, sMax: (innerHeight - camera.y) / z / meioH + alto };
}

// Alguma parte do tile (gx, gy) cai dentro da vista v? (+3 em s: a borda de terra abaixo do mapa)
function naVista(v, gx, gy) {
  const d = gx - gy, s = gx + gy;
  return d + 1 >= v.dMin && d - 1 <= v.dMax && s + 3 >= v.sMin && s <= v.sMax;
}

function telaParaGrade(sx, sy) {
  const a = ((sx - camera.x) / camera.zoom) / (TILE_W / 2);
  const b = ((sy - camera.y) / camera.zoom) / (TILE_H / 2);
  return { gx: Math.floor((a + b) / 2), gy: Math.floor((b - a) / 2) };
}
