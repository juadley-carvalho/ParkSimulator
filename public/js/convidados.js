/* ============================================================
   convidados.js — criação e movimentação dos convidados
   ============================================================ */

// Cria n convidados em tiles de caminho sorteados.
// x, y são coordenadas de grade CONTÍNUAS: o convidado fica entre tiles enquanto anda.
function semear(n, ponto) {
  const caminhos = [];
  for (let gy = 0; gy < MAPA; gy++)
    for (let gx = 0; gx < MAPA; gx++) if (ehCaminho(gx, gy)) caminhos.push([gx, gy]);
  if (!caminhos.length) return;
  for (let i = 0; i < n; i++) {
    const [gx, gy] = ponto || caminhos[Math.floor(Math.random() * caminhos.length)];
    convidados.push({
      x: gx + 0.5, y: gy + 0.5,                    // posição (centro do tile)
      ox: aleatorio(-0.2, 0.2), oy: aleatorio(-0.2, 0.2),   // "faixa" própria, para não andarem em fila perfeita
      alvo: null, anterior: null, resgate: false,
      estado: 'andando',      // 'andando' | 'usando'
      objetivo: null,         // serviço que ele está indo buscar (ex.: 'comida')
      uso: null,              // dados do serviço em uso
      // Passo próprio (tiles/s): uns apressados, outros sem pressa. Evita que todos andem em sincronia.
      velocidade: VELOCIDADE * aleatorio(1 - VARIACAO_VELOCIDADE, 1 + VARIACAO_VELOCIDADE),
      dinheiro: Math.round(aleatorio(30, 150)),   // $ com que chegou ao parque
      tolerancia: Math.round((aleatorio(1, 10) + aleatorio(1, 10)) / 2),   // intensidade preferida, 1 a 10 (média de 2 sorteios: concentra no meio)
      paciencia: aleatorio(25, 45),               // segundos que aguenta numa fila
      evitar: {},                                 // serviço -> instante até o qual ele não tenta de novo
      pensou: {},                                 // queixa -> instante até o qual ela não conta de novo
      pensamento: null,                           // { tipo, ate }: balão sobre a cabeça (ver pensar)
      n: { fome: aleatorio(10, 50), sede: aleatorio(10, 50), banheiro: aleatorio(0, 30),
           nausea: aleatorio(0, 10), energia: aleatorio(60, 100), felicidade: aleatorio(60, 100) },
      cor: `hsl(${Math.floor(Math.random() * 360)} 70% 55%)`,
    });
  }
}

// Busca em largura (BFS): expande a partir do tile (sx, sy), camada por camada, até achar
// o caminho mais próximo. Devolve só o PRIMEIRO passo da rota. Atravessa grama (é uma
// emergência), mas nunca água.
function proximoPassoAteCaminho(sx, sy) {
  const chave = (x, y) => y * MAPA + x;
  const pai = new Map([[chave(sx, sy), null]]);   // de onde viemos em cada tile
  const fila = [[sx, sy]];
  for (let i = 0; i < fila.length; i++) {
    const [x, y] = fila[i];
    if (ehCaminho(x, y)) {
      let cur = [x, y], p = pai.get(chave(x, y));
      while (p && pai.get(chave(p[0], p[1]))) { cur = p; p = pai.get(chave(p[0], p[1])); }  // volta até o início
      return cur;
    }
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx, ny = y + dy;
      if (dentroDoMapa(nx, ny) && !pai.has(chave(nx, ny)) && mapa[ny][nx] !== 'AGUA') {
        pai.set(chave(nx, ny), [x, y]);
        fila.push([nx, ny]);
      }
    }
  }
  return null;   // nenhum caminho alcançável
}

// Decide para qual tile o convidado vai a seguir.
function escolherAlvo(g) {
  const cx = Math.floor(g.x), cy = Math.floor(g.y);
  if (ehCaminho(cx, cy)) {
    if (decidirNecessidade(g, cx, cy)) return;   // tem uma necessidade urgente: vai atendê-la
    // Passeio: sorteia um vizinho que seja caminho, evitando voltar (a menos que seja beco sem saída)
    const op = VIZINHOS.map(([dx, dy]) => ({ gx: cx + dx, gy: cy + dy })).filter(t => ehCaminho(t.gx, t.gy));
    const sem = op.filter(t => !(g.anterior && t.gx === g.anterior.gx && t.gy === g.anterior.gy));
    const lista = sem.length ? sem : op;
    g.alvo = lista.length ? lista[Math.floor(Math.random() * lista.length)] : null;
    g.anterior = { gx: cx, gy: cy };
    g.resgate = false;
  } else {
    // Resgate: o chão sumiu, então procura o caminho mais próximo
    const p = proximoPassoAteCaminho(cx, cy);
    g.alvo = p ? { gx: p[0], gy: p[1] } : null;
    g.anterior = null;
    g.resgate = true;
  }
}

// UPDATE: só mexe nos dados, nunca desenha. dt = segundos desde o último quadro.
function atualizar(dt) {
  for (const g of convidados) {
    atualizarNecessidades(g, dt);
    if (g.estado === 'esperando' || g.estado === 'brincando') continue;   // quem cuida deles é a atração
    if (g.estado === 'usando') { usar(g, dt); continue; }   // parado, aproveitando o serviço
    // O alvo ficou inválido? (nenhum, ou o caminho foi apagado/virou água no meio da viagem)
    const invalido = !g.alvo ||
      (g.resgate ? mapa[g.alvo.gy][g.alvo.gx] === 'AGUA' : !ehCaminho(g.alvo.gx, g.alvo.gy));
    if (invalido) { escolherAlvo(g); if (!g.alvo) continue; }   // sem alvo: fica parado e tenta de novo

    const tx = g.alvo.gx + 0.5 + g.ox, ty = g.alvo.gy + 0.5 + g.oy;
    const dx = tx - g.x, dy = ty - g.y, dist = Math.hypot(dx, dy), passo = g.velocidade * dt;
    if (dist <= passo) { g.x = tx; g.y = ty; escolherAlvo(g); }   // chegou: decide o próximo
    else { g.x += dx / dist * passo; g.y += dy / dist * passo; }
  }
}
