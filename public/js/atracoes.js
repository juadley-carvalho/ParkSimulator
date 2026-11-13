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

// Estimativa (segundos) de quanto quem entrar agora na fila espera até embarcar: o fim da corrida
// atual, mais uma corrida inteira (com o tempo de carga) para cada leva completa de gente à frente.
function esperaEstimada(a) {
  const def = defDeFila(a.chave);
  const corridaAtual = a.fase === 'rodando' ? a.resta : 0;
  return corridaAtual + Math.floor(a.fila.length / def.capacidade) * (def.duracao + TEMPO_CARGA);
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
        pensar(g, 'fila');
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
      if (lotado || (a.passageiros.length && a.tCarga >= TEMPO_CARGA)) { a.fase = 'rodando'; a.resta = def.duracao; if (def.voltas) a.angulo = 0; }
    } else {
      // 3) Corrida: ao terminar, aplica os efeitos em cada passageiro e libera todos
      a.resta -= dt;
      if (a.resta <= 0) {
        for (const g of a.passageiros) {
          for (const [campo, v] of Object.entries(efeitosFinais(g, def))) g.n[campo] = limitar(g.n[campo] + v);
          if (excessoIntensidade(g, def) > 0 && diferencaIntensidade(g, def) > 0) pensar(g, 'intenso');
          g.estado = 'andando'; g.uso = null; g.objetivo = null; g.alvo = null; g.anterior = null;
        }
        a.passageiros = []; a.fase = 'carregando'; a.tCarga = 0;
        if (def.voltas) a.angulo = 0;   // o trem volta exatamente à estação
      }
    }
    const giro = def.voltas ? { parado: 0, rodando: def.voltas * 2 * Math.PI / def.duracao }   // circuito: n voltas por corrida
                          : (def.giro || { parado: 0.3, rodando: 2.4 });   // senão, o padrão do carrossel
    a.angulo += dt * (a.fase === 'rodando' ? giro.rodando : giro.parado);
  }
}
