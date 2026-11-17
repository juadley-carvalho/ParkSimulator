// capturar.js — gera as imagens do manual (docs/manual/img/*.png) a partir do jogo de verdade.
//
// Uso (na pasta do projeto):   node docs/manual/ferramentas/capturar.js
//
// Sobe o servidor do jogo na porta 3123 (saves numa pasta temporária), abre o Edge sem janela,
// monta cada cena pelo escopo global do jogo (as mesmas funções que o jogo usa: limparParque,
// construir, semear, simular...) e fotografa. Não altera nada do jogo nem dos saves do repositório.
// Rode de novo depois de mudar o jogo para atualizar as imagens; depois, gerar-pdf.js refaz o PDF.

const path = require('path');
const fs = require('fs');
const { RAIZ, esperar, subirServidor, abrirNavegador } = require('./navegador');

const IMG = path.join(RAIZ, 'docs', 'manual', 'img');
const L = 1400, A = 900;   // tamanho da "tela"

// Funções auxiliares injetadas na página. Tudo do jogo está no escopo global, então elas podem
// chamar limparParque, construir, simular etc. diretamente.
const AJUDANTES = String.raw`
window.UI_IDS = ['barra', 'fin', 'hud', 'painel', 'painelObj', 'pausado'];
window.mostrarUI = sim => { for (const id of UI_IDS) $(id).style.visibility = sim ? '' : 'hidden'; };
window.fecharJanelas = () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('aberto'));
window.mirar = (gx, gy, zoom) => {
  const c = gradeParaMundo(gx, gy); camera.zoom = zoom;
  camera.x = innerWidth / 2 - c.x * zoom; camera.y = innerHeight / 2 - c.y * zoom;
};
// Simula "seg" segundos de jogo em passos de 0,1 s (bem mais rápido que o tempo real)
window.rodar = (seg, parar) => { for (let t = 0; t < seg; t += 0.1) { simular(0.1); if (parar && parar()) break; } };
window.retangulo = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
window.semFerramenta = () => { ferramenta = { camada: 'inspecionar', chave: 'X' }; hover = null; };
window.linha = (gy, x0, x1, t = 'CAMINHO') => { for (let x = x0; x <= x1; x++) mapa[gy][x] = t; };
window.coluna = (gx, y0, y1, t = 'CAMINHO') => { for (let y = y0; y <= y1; y++) mapa[y][gx] = t; };
window.bloco = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mapa[y][x] = t; };
window.arvore = (x, y) => { if (dentroDoMapa(x, y) && mapa[y][x] === 'GRAMA' && !objetos[y][x] && !ehEntrada(x, y)) objetos[y][x] = 'ARVORE'; };
window.por = (chave, gx, gy, rot = 0) => {
  if (!podeConstruir(chave, gx, gy, rot)) throw new Error(chave + ' não cabe em ' + gx + ',' + gy + ' rot ' + rot);
  construir(chave, gx, gy, rot);
};

// O parque de demonstração (32 x 32): todas as atrações, serviços, lixeiras e faxineiros
window.parqueDemo = () => {
  fecharJanelas();
  limparParque(32);
  coluna(16, 8, 31); linha(10, 4, 28); linha(20, 4, 28); coluna(4, 10, 20); coluna(28, 10, 20);
  bloco(18, 14, 27, 19, 'AGUA');
  bloco(7, 3, 11, 6, 'AGUA');
  por('MONTANHA_RUSSA', 6, 11); por('CARROSSEL', 11, 11); por('RODA_GIGANTE', 13, 14);
  por('TREM', 6, 17); por('CASA_ASSOMBRADA', 11, 18); por('CORREDEIRA', 19, 17); por('BARCOS', 25, 16);
  por('NAVIO_PIRATA', 19, 11); por('TOBOGA', 23, 11);
  por('BARRACA', 15, 23); por('BARRACA_BEBIDAS', 17, 23); por('BARRACA_SORVETE', 15, 26); por('BANHEIRO', 17, 26);
  por('BARRACA', 17, 9); por('BANHEIRO', 15, 9); por('BARRACA_BEBIDAS', 3, 15);
  por('BANCO', 16, 22); por('BANCO', 9, 10); por('BANCO', 22, 20); por('BANCO', 28, 13);
  por('LIXEIRA', 16, 25); por('LIXEIRA', 16, 19); por('LIXEIRA', 13, 10); por('LIXEIRA', 25, 20); por('LIXEIRA', 4, 13);
  [[2,8],[3,22],[6,23],[9,25],[20,24],[24,23],[27,26],[2,12],[30,12],[30,17],[22,6],[13,5],[19,3],[26,8],[5,7],
   [14,12],[10,15],[15,17],[18,12],[12,26],[21,28],[11,29],[24,29],[1,18],[30,22],[8,14],[26,13],[17,13],[3,4],[29,4]].forEach(([x, y]) => arvore(x, y));
  contratarFaxineiro(16, 21); contratarFaxineiro(8, 20);
  parque.nome = 'Parque Arco-Íris';
  comecarPartida(); velocidade = 0;
  semear(45);
};

// Vitrine de um objeto: terreno pequeno, um caminho, o objeto e alguns convidados usando-o
window.vitrine = (chave, rot = 0) => {
  fecharJanelas();
  limparParque(24);
  const def = OBJETOS[chave], { w, h } = tamanhoDe(chave, rot);
  linha(14, 0, 23); coluna(12, 14, 23);
  let gx, gy;
  if (def.sobreCaminho) { gx = 9; gy = 14; }
  else if (def.canais) { bloco(5, 6, 13, 13, 'AGUA'); coluna(14, 6, 14); gx = 11; gy = 10; }
  else if (def.naAgua) { bloco(8, 9, 16, 13, 'AGUA'); gx = 11; gy = 11; }
  else { gx = 12 - Math.floor(w / 2); gy = 14 - h; }
  por(chave, gx, gy, rot);
  if (chave !== 'ARVORE') [[5, 17], [19, 17], [6, 9], [19, 10], [16, 20], [8, 20], [4, 12]].forEach(([x, y]) => arvore(x, y));
  comecarPartida(); velocidade = 0;
  return { cx: gx + w / 2, cy: gy + h / 2, gx, gy, w, h };
};

// Põe convidados para usar o serviço do objeto e simula até a cena ficar "viva"
window.animarVitrine = (chave, gx, gy) => {
  const s = OBJETOS[chave].servicos || {};
  const nomeServ = Object.keys(s)[0], def = s[nomeServ];
  semear(18);
  for (const g of convidados) {
    g.dinheiro = 120;
    if (def && def.intensidade) { g.tolerancia = def.intensidade; g.n.felicidade = 45; }
    if (nomeServ === 'comida') g.n.fome = 85;
    if (nomeServ === 'bebida') g.n.sede = 85;
    if (nomeServ === 'banheiro') g.n.banheiro = 85;
    if (nomeServ === 'descanso') g.n.energia = 15;
  }
  const a = atracoes.get(chaveAtr(gx, gy));
  // Para no meio da corrida; os barcos somem no lago no meio do passeio, então ali paramos no começo
  const fracao = chave === 'BARCOS' ? 0.85 : 0.55;
  if (a) rodar(120, () => a.fase === 'rodando' && a.resta < defDeFila(chave).duracao * fracao);
  else rodar(14);
  return a ? { fase: a.fase, passageiros: a.passageiros.length, fila: a.fila.length } : { usando: convidados.filter(g => g.estado === 'usando').length };
};
true;
`;

async function main() {
  fs.mkdirSync(IMG, { recursive: true });
  const servidor = await subirServidor();
  const nav = await abrirNavegador({ largura: L, altura: A });
  const { avaliar, foto, tamanho } = nav;
  const imagens = [];
  const salvar = async (nome, clip) => { await esperar(250); await foto(path.join(IMG, nome), clip); imagens.push(nome); console.log('  ' + nome); };
  const quadro = () => esperar(250);   // deixa o loop do jogo desenhar um quadro

  try {
    // Perfil limpo: progresso dos cenários, autosave e música (o localStorage persiste no perfil)
    await nav.abrir(servidor.url);
    await avaliar(`localStorage.clear(); localStorage.setItem('musicaModo', 'desligada'); true`);
    await nav.abrir(servidor.url);
    await avaliar(AJUDANTES);

    // ---------- Tela inicial ----------
    await avaliar(`montarListaCenarios().then(() => true)`);
    await quadro();
    await salvar('tela-inicial.png', await avaliar(`retangulo('#modalInicio .janela')`));

    // ---------- Parque de demonstração ----------
    await avaliar(`parqueDemo(); rodar(50); velocidade = 0; true`);   // pouco tempo: filas cheias, gente feliz
    // Capa: sem interface, parque inteiro
    await avaliar(`mostrarUI(false); semFerramenta(); mirar(16.5, 18.5, 0.98); true`);
    await salvar('capa.png');
    await avaliar(`mirar(14.5, 16, 1.35); true`);
    await salvar('parque-perto.png');

    // Interface completa (com um convidado selecionado)
    // (em 1x por um instante, para o botão de velocidade aparecer aceso)
    await avaliar(`mostrarUI(true); mirar(15, 17, 1.05);
      selecionado = convidados.find(g => g.estado === 'andando' && Math.abs(g.x - 16) < 3 && Math.abs(g.y - 20) < 3) || convidados[0];
      definirVelocidade(1); true`);
    await quadro();
    await salvar('interface.png');
    await salvar('painel-convidado.png', await avaliar(`(r => ({ x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }))(retangulo('#painel'))`));
    await salvar('barra-superior.png', await avaliar(`(r => ({ x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }))(retangulo('#fin'))`));
    await salvar('hud.png', await avaliar(`(r => ({ x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }))(retangulo('#hud'))`));
    await avaliar(`definirVelocidade(0); true`);
    await quadro();
    await salvar('pausado.png', await avaliar(`(r => ({ x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 }))(retangulo('#pausado'))`));
    await avaliar(`$('pausado').style.visibility = 'hidden'; true`);

    // Abas da barra de construção
    // (no jogo a barra tem no máximo 780 px e rola para o lado; aqui ela é alargada para mostrar todos os cartões)
    for (const cat of ['ferramentas', 'terreno', 'cenario', 'servicos', 'atracoes', 'funcionarios', 'teste']) {
      await avaliar(`abrirCategoria('${cat}'); $('barra').style.width = '${cat === 'atracoes' ? '1080px' : ''}'; true`);
      await quadro();
      await salvar(`barra-${cat}.png`, await avaliar(`(r => ({ x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }))(retangulo('#barra'))`));
    }
    await avaliar(`$('barra').style.width = ''; true`);

    // Painel de um objeto (preços) e de um faxineiro
    await avaliar(`selecionado = null; selecionarObjeto(chaveAtr(6, 11)); true`);
    await quadro();
    await salvar('painel-objeto.png', await avaliar(`(r => ({ x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }))(retangulo('#painelObj'))`));
    await avaliar(`selObj = null; selecionarFuncionario(funcionarios[0]); true`);
    await quadro();
    await salvar('painel-faxineiro.png', await avaliar(`(r => ({ x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }))(retangulo('#painelObj'))`));
    await avaliar(`selFunc = null; true`);

    // Pensamentos: balões sobre vários convidados perto do centro da vista
    await avaliar(`mostrarUI(false); mirar(16, 21, 2.3);
      const tipos = ['fila', 'fome', 'sede', 'banheiro', 'caro', 'intenso', 'embora', 'sujeira', 'nojo', 'enjoo', 'lotado'];
      const perto = convidados.filter(g => g.estado === 'andando' && Math.abs(g.x - 16.5) < 4 && Math.abs(g.y - 21.5) < 4);
      perto.forEach((g, i) => { g.pensamento = { tipo: tipos[i % tipos.length], ate: tempo + 1e6 }; });
      perto.length`);
    await salvar('pensamentos.png', { x: 250, y: 120, width: 900, height: 620 });
    await avaliar(`for (const g of convidados) g.pensamento = null; true`);

    // Janelas (antes, mais um mês de jogo: o balanço das finanças precisa de um mês fechado)
    await avaliar(`rodar(300); velocidade = 0; true`);
    const janela = sel => avaliar(`(r => ({ x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 }))(retangulo('${sel} .janela'))`);
    await avaliar(`mostrarUI(true); $('btnFin').click(); true`);
    await quadro();
    await salvar('janela-financas.png', await janela('#modalFin'));
    await avaliar(`fecharJanelas(); true`);
    await tamanho(L, 1750);   // a janela do parque é comprida: tela alta para caber inteira
    await avaliar(`$('btnParque').click(); true`);
    await quadro();
    await salvar('janela-parque.png', await janela('#modalParque'));
    await avaliar(`fecharJanelas(); true`);
    await tamanho(L, A);
    await avaliar(`salvarEm('Parque Arco-Íris').then(() => { definirModoAutosave('mes'); $('btnJogo').click(); return true; })`);
    await esperar(800);
    await salvar('janela-saves.png', await janela('#modalJogo'));
    await avaliar(`fecharJanelas(); true`);

    // Lotação: um caminho estreito (1 tile) e um largo (3 tiles) com a mesma multidão
    await avaliar(`fecharJanelas(); limparParque(24); linha(14, 0, 23); coluna(12, 14, 23);
      linha(8, 3, 10); coluna(3, 8, 14); coluna(10, 8, 14);
      bloco(14, 7, 20, 9, 'CAMINHO'); coluna(14, 9, 14); coluna(20, 9, 14);
      comecarPartida(); velocidade = 0; mostrarUI(false); semFerramenta();
      for (let i = 0; i < 26; i++) semear(1, [3 + (i % 8), 8]);
      for (let i = 0; i < 26; i++) semear(1, [14 + (i % 7), 7 + (i % 3)]);
      for (const g of convidados) { g.n.fome = 0; g.n.sede = 0; g.n.banheiro = 0; g.n.felicidade = 90; }
      tChegada = 1e9; rodar(1.5); atualizarLotacao(0.1); mirar(12, 8.5, 1.6); resumoLotacao().tiles`);
    await salvar('lotacao.png', { x: 120, y: 150, width: 1160, height: 560 });

    // Lixo e limpeza: sujeira no chão, vômito, lixeira cheia e faxineiro
    await avaliar(`fecharJanelas(); limparParque(24); linha(14, 0, 23); coluna(12, 14, 23); coluna(12, 8, 13);
      por('LIXEIRA', 10, 14); por('BARRACA', 13, 13); por('BANCO', 12, 10);
      lixeiras.set(chaveAtr(10, 14), 30);
      sujar(9, 14, 'papel'); sujar(9, 14, 'copo'); sujar(11, 14, 'papel'); sujar(8, 14, 'palito'); sujar(7, 14, 'copo');
      sujar(12, 16, 'vomito'); sujar(12, 12, 'papel'); sujar(14, 14, 'copo'); sujar(15, 14, 'palito');
      contratarFaxineiro(13, 14); funcionarios[0].x = 13.6; funcionarios[0].trabalho = 1;
      comecarPartida(); velocidade = 0; mostrarUI(false); semFerramenta(); tChegada = 1e9;
      semear(1, [11, 14]); semear(1, [12, 15]); semear(1, [8, 14]);
      convidados[0].lixo = { tipo: 'copo', ate: 1e9 }; convidados[1].pensamento = { tipo: 'nojo', ate: 1e9 };
      convidados[2].pensamento = { tipo: 'sujeira', ate: 1e9 };
      mirar(11.5, 14, 2.8); true`);
    await salvar('lixo.png', { x: 200, y: 160, width: 1000, height: 560 });

    // Terreno: grama, caminho e água
    await avaliar(`fecharJanelas(); limparParque(24); linha(14, 0, 23); coluna(12, 14, 23); coluna(7, 8, 14); linha(8, 7, 15);
      bloco(13, 10, 17, 12, 'AGUA'); [[9, 11], [10, 12], [5, 12], [17, 15], [15, 16]].forEach(([x, y]) => arvore(x, y));
      comecarPartida(); velocidade = 0; mostrarUI(false); semFerramenta(); mirar(12, 12, 1.9); true`);
    await salvar('terreno.png', { x: 250, y: 180, width: 900, height: 520 });

    // Prévia verde (pode) e vermelha (não pode)
    await avaliar(`fecharJanelas(); limparParque(24); linha(14, 0, 23); coluna(12, 14, 23); bloco(14, 9, 18, 13, 'AGUA');
      arvore(8, 10); comecarPartida(); velocidade = 0; mostrarUI(false);
      ferramenta = { camada: 'objeto', chave: 'CARROSSEL' }; rotacaoAtual = 0; hover = { gx: 9, gy: 12 }; mirar(11, 12.5, 2.4); true`);
    await salvar('previa-ok.png', { x: 360, y: 200, width: 680, height: 460 });
    await avaliar(`hover = { gx: 13, gy: 12 }; mirar(13.5, 12.5, 2.4); true`);
    await salvar('previa-erro.png', { x: 360, y: 200, width: 680, height: 460 });

    // Canais do passeio de barco na prévia
    await avaliar(`fecharJanelas(); limparParque(24); linha(14, 0, 23); coluna(12, 14, 23); bloco(5, 6, 13, 13, 'AGUA'); coluna(14, 6, 14);
      comecarPartida(); velocidade = 0; mostrarUI(false);
      ferramenta = { camada: 'objeto', chave: 'BARCOS' }; rotacaoAtual = 0; hover = { gx: 10, gy: 10 }; mirar(11, 10.5, 2.3); true`);
    await salvar('canais.png', { x: 330, y: 180, width: 740, height: 480 });

    // As quatro orientações de uma atração (tecla Z)
    await avaliar(`fecharJanelas(); limparParque(24); linha(14, 0, 23); coluna(12, 14, 23);
      por('NAVIO_PIRATA', 2, 12, 0); por('NAVIO_PIRATA', 7, 11, 1); por('NAVIO_PIRATA', 11, 12, 2); por('NAVIO_PIRATA', 16, 11, 3);
      comecarPartida(); velocidade = 0; mostrarUI(false); semFerramenta(); mirar(10.5, 12.5, 1.3); true`);
    await salvar('girar.png', { x: 60, y: 130, width: 1280, height: 560 });

    // Fichas: cada objeto do catálogo na sua vitrine
    const chaves = await avaliar(`Object.keys(OBJETOS)`);
    for (const chave of chaves) {
      const v = await avaliar(`(() => { const v = vitrine('${chave}'); mostrarUI(false); semFerramenta(); return v; })()`);
      const estado = await avaliar(`animarVitrine('${chave}', ${v.gx}, ${v.gy})`);
      // Enquadramento: o zoom faz caber a pegada (losango de (w+h)*16 px de altura no zoom 1) mais a
      // altura do objeto ("altura" do catálogo = onde fica o rótulo da fila, perto do topo)
      const grande = Math.max(v.w, v.h) > 1;
      const info = await avaliar(`({ canais: !!OBJETOS['${chave}'].canais, altura: OBJETOS['${chave}'].altura || 0 })`);
      const n = v.w + v.h + (info.canais ? 2 : 0), alt = info.altura || (grande ? 80 : 50);
      const W = grande ? 640 : 420, H = grande ? 500 : 360;
      const zoom = Math.min(grande ? 2.7 : 3, (H - 30) / (n * 16 + alt * 1.15), (W - 40) / (n * 32));
      const meio = A / 2 + (n * 8 * zoom - alt * zoom - 20) / 2;
      await avaliar(`velocidade = 0; mirar(${v.cx}, ${v.cy}, ${zoom}); true`);
      await salvar(`obj-${chave}.png`, { x: L / 2 - W / 2, y: meio - H / 2, width: W, height: H });
      console.log('    ', JSON.stringify(estado));
    }

    // Cenários: o parque como começa (com o objetivo no HUD) e as janelas de fim
    const cenarios = await avaliar(`CENARIOS`);
    for (const id of cenarios) {
      await avaliar(`fecharJanelas(); buscarCenario('${id}').then(def => { iniciarCenario('${id}', def); velocidade = 0; mostrarUI(true); semFerramenta();
        $('pausado').style.visibility = 'hidden'; centralizar(); return true; })`);
      await quadro();
      await salvar(`cenario-${id}.png`);
    }
    await avaliar(`mostrarFim(true); true`);
    await quadro();
    await salvar('fim-vitoria.png', await janela('#modalFim'));
    await avaliar(`fecharJanelas(); mostrarFim(false); true`);
    await quadro();
    await salvar('fim-derrota.png', await janela('#modalFim'));
    await avaliar(`fecharJanelas(); fase = 'jogando'; true`);

    console.log(`${imagens.length} imagens em ${IMG}`);
  } finally {
    await nav.fechar();
    servidor.proc.kill();
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
