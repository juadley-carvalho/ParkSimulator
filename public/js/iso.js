/* ============================================================
   iso.js — matemática isométrica (grade <-> tela)
   Depende de: estado.js (camera)
   ============================================================ */

function gradeParaMundo(gx, gy) {
  return { x: (gx - gy) * TILE_W / 2, y: (gx + gy) * TILE_H / 2 };
}

function telaParaGrade(sx, sy) {
  const a = ((sx - camera.x) / camera.zoom) / (TILE_W / 2);
  const b = ((sy - camera.y) / camera.zoom) / (TILE_H / 2);
  return { gx: Math.floor((a + b) / 2), gy: Math.floor((b - a) / 2) };
}
