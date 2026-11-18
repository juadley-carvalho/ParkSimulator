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
      lixo: null,                                 // { tipo, ate }: lixo na mão (ver lixo.js)
      capricho: Math.random(),                    // 0 = larga o lixo logo; 1 = procura lixeira por mais tempo
      n: { fome: aleatorio(10, 50), sede: aleatorio(10, 50), banheiro: aleatorio(0, 30),
           nausea: aleatorio(0, 10), energia: aleatorio(60, 100), felicidade: aleatorio(60, 100) },
      cor: `hsl(${Math.floor(Math.random() * 360)} 70% 55%)`,
      corCalca: CORES_CALCA[Math.floor(Math.random() * CORES_CALCA.length)],
      // Animação (só visual): passo = tiles andados (começa sorteado, senão todos marchariam juntos),
      // movendo = andou no último passo da simulação, olhaX/olhaY = direção na TELA (para onde o pé vai)
      passo: Math.random(), movendo: false, olhaX: 1, olhaY: 0,
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
    chegarNoTile(g, cx, cy);                     // sujeira no chão, vômito e o lixo da mão (lixo.js)
    if (decidirNecessidade(g, cx, cy)) return;   // tem uma necessidade urgente: vai atendê-la
    if (irAteLixeira(g, cx, cy)) return;         // sem urgência e com lixo na mão: lixeira por perto?
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

// ---------- Superlotação ----------
// Convidados andando por tile de caminho no tile (gx, gy) e nos 4 vizinhos (0 se não houver caminho)
function densidadeEm(gx, gy) {
  let gente = 0, tiles = 0;
  for (const [dx, dy] of [[0, 0], ...VIZINHOS]) {
    if (!ehCaminho(gx + dx, gy + dy)) continue;
    tiles++;
    gente += lotacao.get(chaveAtr(gx + dx, gy + dy)) || 0;
  }
  return tiles ? gente / tiles : 0;
}

// Quanto a densidade passa do limite (0 = sem aperto)
function excessoEm(gx, gy) { return Math.max(0, densidadeEm(gx, gy) - LOTACAO.limite); }

// Multiplicador do passo: 1 sem aperto, até LOTACAO.velocidadeMin. "|| 0": convidado de save antigo não tem aperto.
function fatorDeLotacao(g) { return Math.max(LOTACAO.velocidadeMin, 1 - LOTACAO.lentidao * (g.aperto || 0)); }

// A cada passo: conta quem anda em cada tile e aplica o aperto. É contínuo (por segundo, com dt), e não
// "ao entrar no tile" como a sujeira: assim quem fica parado no meio da multidão continua incomodado,
// e quem só cruza um trecho cheio perde pouco.
function atualizarLotacao(dt) {
  lotacao.clear();
  for (const g of convidados) {
    if (g.estado !== 'andando') continue;
    const k = chaveAtr(Math.floor(g.x), Math.floor(g.y));
    lotacao.set(k, (lotacao.get(k) || 0) + 1);
  }
  for (const g of convidados) {
    g.aperto = g.estado === 'andando' ? excessoEm(Math.floor(g.x), Math.floor(g.y)) : 0;
    if (!g.aperto) continue;
    g.n.felicidade = limitar(g.n.felicidade - Math.min(LOTACAO.felicMax, g.aperto * LOTACAO.felicPorSeg) * dt);
    if (g.aperto >= LOTACAO.queixaA) pensar(g, 'lotado');
  }
}

// Para a janela do parque: quantos estão no aperto agora
function resumoLotacao() {
  return { apertados: convidados.filter(g => g.aperto > 0).length,
           tiles: [...lotacao.keys()].filter(k => { const [x, y] = k.split(',').map(Number); return excessoEm(x, y) > 0; }).length };
}

// Animação (só visual), para convidados e funcionários: conta a distância andada (a fase do passo) e
// guarda a direção NA TELA (a mesma conta de gradeParaMundo: x = gx - gy, y = (gx + gy) / 2), com tamanho 1.
// (dx, dy) = até o alvo, dist = tamanho disso, passo = quanto ele anda neste dt.
function registrarPasso(p, dx, dy, dist, passo) {
  if (dist < 1e-6) return;
  p.passo += Math.min(dist, passo);
  p.movendo = true;
  const sx = dx - dy, sy = (dx + dy) / 2, n = Math.hypot(sx, sy);
  p.olhaX = sx / n; p.olhaY = sy / n;
}

// UPDATE: só mexe nos dados, nunca desenha. dt = segundos desde o último quadro.
function atualizar(dt) {
  for (const g of convidados) {
    g.movendo = false;   // volta a true só se ele der um passo agora (parado = pernas juntas)
    atualizarNecessidades(g, dt);
    if (g.estado === 'esperando' || g.estado === 'brincando') continue;   // quem cuida deles é a atração
    if (g.estado === 'usando') { usar(g, dt); continue; }   // parado, aproveitando o serviço
    // O alvo ficou inválido? (nenhum, ou o caminho foi apagado/virou água no meio da viagem)
    const invalido = !g.alvo ||
      (g.resgate ? mapa[g.alvo.gy][g.alvo.gx] === 'AGUA' : !ehCaminho(g.alvo.gx, g.alvo.gy));
    if (invalido) { escolherAlvo(g); if (!g.alvo) continue; }   // sem alvo: fica parado e tenta de novo

    const tx = g.alvo.gx + 0.5 + g.ox, ty = g.alvo.gy + 0.5 + g.oy;
    const dx = tx - g.x, dy = ty - g.y, dist = Math.hypot(dx, dy), passo = g.velocidade * fatorDeLotacao(g) * dt;
    registrarPasso(g, dx, dy, dist, passo);
    if (dist <= passo) { g.x = tx; g.y = ty; escolherAlvo(g); }   // chegou: decide o próximo
    else { g.x += dx / dist * passo; g.y += dy / dist * passo; }
  }
}
