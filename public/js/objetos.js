/* ============================================================
   objetos.js — catálogo de objetos e regras de construção
   Depende de: desenho.js, estado.js, config.js
   ============================================================ */

// Catálogo de objetos: cada um tem uma função "desenhar" que sabe se pintar
// a partir do centro (cx, cy) do tile.
const OBJETOS = {
  ARVORE:  { categoria: 'cenario', icone: '🌳', nome: 'Árvore',  cor: '#3e8e3e', desenhar: desenharArvore },
  // "servicos": o que o objeto oferece. Cada serviço tem atividade, duração (s) e efeitos nas necessidades;
  // brinquedos também têm "intensidade" (1 a 10).
  BANCO:   { categoria: 'cenario', icone: '🪑', nome: 'Banco',   cor: '#8b5a2b', desenhar: desenharBanco,
             servicos: { descanso: { atividade: 'sentar', duracao: 6, efeitos: { energia: +40, nausea: -35 } } } },
  BARRACA: { categoria: 'servicos', icone: '🍔', nome: 'Barraca', cor: '#d9534f', desenhar: desenharBarraca,
             servicos: { comida: { atividade: 'comer', duracao: 3, efeitos: { fome: -60, banheiro: +12 } },
                         bebida: { atividade: 'beber', duracao: 2, efeitos: { sede: -60, banheiro: +8 } } } },
  BANHEIRO: { categoria: 'servicos', icone: '🚻', nome: 'Banheiro', cor: '#90a4ae', desenhar: desenharBanheiro,
             servicos: { banheiro: { atividade: 'banheiro', duracao: 4, efeitos: { banheiro: -100 } } } },
  // "tam": pegada em tiles (padrão 1x1). A âncora é o tile de trás (menor gx e gy).
  CARROSSEL: { categoria: 'atracoes', icone: '🎠', nome: 'Carrossel', cor: '#ab47bc', tam: { w: 2, h: 2 }, desenhar: desenharCarrossel,
             servicos: { diversao: { atividade: 'brinquedo', capacidade: 6, duracao: 8, intensidade: 5, efeitos: { felicidade: +35, nausea: +25, energia: -10 } } } },
  // "altura": onde o rótulo da fila é desenhado acima do objeto. "giro": velocidade angular (rad/s)
  // parado (embarcando) e em movimento. Intensidade baixa: pouca náusea.
  RODA_GIGANTE: { categoria: 'atracoes', icone: '🎡', nome: 'Roda-gigante', cor: '#26a69a', tam: { w: 3, h: 2 }, altura: 140, desenhar: desenharRodaGigante,
             servicos: { diversao: { atividade: 'brinquedo', capacidade: 8, duracao: 20, intensidade: 2, giro: { parado: 0.12, rodando: 0.5 },
                                     efeitos: { felicidade: +30, nausea: +5, energia: -5 } } } },
  // "voltas": atração de circuito. O ângulo vai de 0 a 2π por volta e a corrida dá exatamente
  // essas voltas, então o trem sempre termina de volta na estação.
  MONTANHA_RUSSA: { categoria: 'atracoes', icone: '🎢', nome: 'Montanha-russa', cor: '#e53935', tam: { w: 4, h: 3 }, altura: 120, desenhar: desenharMontanhaRussa,
             servicos: { diversao: { atividade: 'brinquedo', capacidade: 12, duracao: 25, voltas: 2, intensidade: 8,
                                     efeitos: { felicidade: +45, nausea: +30, energia: -15 } } } },
  // Só bebidas, mas mais eficiente que a barraca comum (e ainda alivia um pouco a náusea).
  BARRACA_BEBIDAS: { categoria: 'servicos', icone: '🥤', nome: 'Barraca de bebidas', cor: '#29b6f6', desenhar: desenharBarracaBebidas,
             servicos: { bebida: { atividade: 'beber', duracao: 2, efeitos: { sede: -80, banheiro: +10, nausea: -10 } } } },
  // Intensidade 7: fica entre o carrossel (5) e a montanha-russa (8). "giro" = velocidade do balanço (rad/s).
  NAVIO_PIRATA: { categoria: 'atracoes', icone: '🏴‍☠️', nome: 'Navio pirata', cor: '#8d5a2b', tam: { w: 3, h: 2 }, altura: 105, desenhar: desenharNavioPirata,
             servicos: { diversao: { atividade: 'brinquedo', capacidade: 10, duracao: 18, intensidade: 7, giro: { parado: 0.6, rodando: 2.0 },
                                     efeitos: { felicidade: +40, nausea: +20, energia: -12 } } } },
};

// Funções simples sobre objetos de vários tiles (ver o formato de "objetos" em estado.js).
function tamanhoDe(chave) { return OBJETOS[chave].tam || { w: 1, h: 1 }; }

function ehGrande(chave) { const { w, h } = tamanhoDe(chave); return w * h > 1; }

// Qual objeto ocupa a célula (gx, gy)? Devolve { gx, gy, chave } da ÂNCORA, ou null.
function objetoEm(gx, gy) {
  const c = objetos[gy][gx];
  if (!c) return null;
  if (typeof c === 'string') return { gx, gy, chave: c };
  return { gx: c.ancora.gx, gy: c.ancora.gy, chave: objetos[c.ancora.gy][c.ancora.gx] };
}

// Valida a pegada inteira: dentro do mapa, sem água, sem outros objetos.
function podeConstruir(chave, gx, gy) {
  const { w, h } = tamanhoDe(chave);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = gx + i, y = gy + j;
      if (!dentroDoMapa(x, y) || mapa[y][x] === 'AGUA' || objetos[y][x] || ehEntrada(x, y)) return false;
      if (ehGrande(chave) && mapa[y][x] === 'CAMINHO') return false;   // atrações não ficam sobre caminhos
    }
  return !(chave === 'BANCO' && mapa[gy][gx] !== 'CAMINHO');          // regra do banco
}

function construir(chave, gx, gy) {
  const { w, h } = tamanhoDe(chave);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      objetos[gy + j][gx + i] = (i === 0 && j === 0) ? chave : { ancora: { gx, gy } };
  if (ehAtracaoComFila(chave)) atracoes.set(chaveAtr(gx, gy), novaAtracao(chave, gx, gy));
  if (OBJETOS[chave].servicos)
    gestao.set(chaveAtr(gx, gy), { precos: { ...(PRECO_PADRAO[chave] || {}) }, receita: 0, usos: 0 });
}

// Demolir qualquer célula do objeto remove o objeto INTEIRO
function removerObjeto(gx, gy) {
  const o = objetoEm(gx, gy);
  if (!o) return;
  const { w, h } = tamanhoDe(o.chave);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) objetos[o.gy + j][o.gx + i] = null;
  desmontarAtracao(o.gx, o.gy);
  gestao.delete(chaveAtr(o.gx, o.gy));
  fin.caixa = arred(fin.caixa + custoDe(o.chave) * REEMBOLSO);   // reembolso parcial
}
