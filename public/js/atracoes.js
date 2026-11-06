/* ============================================================
   atracoes.js — atrações com capacidade: filas, embarque e corrida
   ============================================================ */

// O serviço do objeto que tem "capacidade" (= precisa de fila), ou null
function defDeFila(chave) {
  const s = OBJETOS[chave].servicos;
  return s ? (Object.values(s).find(d => d.capacidade) || null) : null;
}

function ehAtracaoComFila(chave) { return !!defDeFila(chave); }

function novaAtracao(chave, gx, gy) {
  return { chave, ancora: { gx, gy }, fila: [], passageiros: [], fase: 'carregando', tCarga: 0, resta: 0, angulo: 0 };
}

// Livra todo mundo (fila e passageiros) quando a atração é demolida
function desmontarAtracao(gx, gy) {
  const a = atracoes.get(chaveAtr(gx, gy));
  if (!a) return;
  for (const g of [...a.fila, ...a.passageiros]) {
    g.estado = 'andando'; g.uso = null; g.objetivo = null; g.alvo = null; g.anterior = null;
  }
  atracoes.delete(chaveAtr(gx, gy));
}

function atualizarAtracoes(dt) {
  for (const a of atracoes.values()) {
    const def = defDeFila(a.chave);

    // 1) Paciência: quem espera demais sai da fila, mais infeliz, e evita a atração por um tempo
    for (const g of [...a.fila]) {
      g.uso.espera += dt;
      if (g.uso.espera > g.paciencia) {
        a.fila.splice(a.fila.indexOf(g), 1);
        g.n.felicidade = limitar(g.n.felicidade - 10);
        g.evitar[g.uso.servico] = tempo + 40;
        g.estado = 'andando'; g.uso = null; g.objetivo = null; g.alvo = null; g.anterior = null;
      }
    }

    if (a.fase === 'carregando') {
      // 2) Embarque: a fila (FIFO) vai entrando até lotar
      while (a.fila.length && a.passageiros.length < def.capacidade) {
        const g = a.fila.shift();
        const servico = g.uso.servico, preco = precoUso(a.ancora, servico);
        if (g.dinheiro < preco) {   // não tem (mais) dinheiro para o ingresso: sai da fila
          g.evitar[servico] = tempo + 40;
          g.estado = 'andando'; g.uso = null; g.objetivo = null; g.alvo = null; g.anterior = null;
          continue;
        }
        pagar(g, a.ancora, servico, preco);   // o ingresso é cobrado no embarque
        g.estado = 'brincando';
        a.passageiros.push(g);
      }
      if (a.passageiros.length) a.tCarga += dt;
      const lotado = a.passageiros.length >= def.capacidade;
      if (lotado || (a.passageiros.length && a.tCarga >= TEMPO_CARGA)) { a.fase = 'rodando'; a.resta = def.duracao; }
    } else {
      // 3) Corrida: ao terminar, aplica os efeitos em cada passageiro e libera todos
      a.resta -= dt;
      if (a.resta <= 0) {
        for (const g of a.passageiros) {
          for (const [campo, v] of Object.entries(def.efeitos)) g.n[campo] = limitar(g.n[campo] + v);
          g.estado = 'andando'; g.uso = null; g.objetivo = null; g.alvo = null; g.anterior = null;
        }
        a.passageiros = []; a.fase = 'carregando'; a.tCarga = 0;
      }
    }
    const giro = def.giro || { parado: 0.3, rodando: 2.4 };   // padrão: o do carrossel
    a.angulo += dt * (a.fase === 'rodando' ? giro.rodando : giro.parado);
  }
}
