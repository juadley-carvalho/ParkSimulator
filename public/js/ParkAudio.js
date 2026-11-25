/* ============================================================
   ParkAudio.js — som de fundo SINTETIZADO (Web Audio API): multidão distante + valsa de realejo.
   Script clássico (sem "export"): o projeto não usa módulos ES, então a classe fica no escopo
   global compartilhado e o musica.js (carregado depois) a usa com "new ParkAudio()".

   A música é COMPOSTA enquanto toca, para não repetir sempre as mesmas notas:
   - seções de 8 compassos de valsa (3/4), cada uma com uma sequência de acordes sorteada
     (PROGRESSOES), às vezes em outro tom e num andamento um pouco diferente;
   - a melodia anda pelas notas do acorde perto da nota anterior, com ritmos sorteados por compasso;
     os compassos 5 e 6 repetem o ritmo dos compassos 1 e 2 (é isso que dá a sensação de "frase");
   - acompanhamento "um-pá-pá": baixo no 1º tempo, acorde curto nos tempos 2 e 3;
   - em algumas seções um sininho dobra a melodia uma oitava acima.
   ============================================================ */

// Acordes em semitons a partir da tônica do tom (0 = Dó em Dó maior)
const ACORDES = {
  I: [0, 4, 7], ii: [2, 5, 9], iii: [4, 7, 11], IV: [5, 9, 12], V: [7, 11, 14],
  V7: [7, 11, 14, 17], vi: [9, 12, 16], II7: [2, 6, 9, 12],   // II7 = "dominante da dominante", pede o V7
};

// Sequências de 8 compassos (uma por seção). As que terminam em V7 "pedem" a seção seguinte.
const PROGRESSOES = [
  ['I', 'I', 'IV', 'I', 'V7', 'V7', 'I', 'I'],
  ['I', 'vi', 'ii', 'V7', 'I', 'vi', 'ii', 'V7'],
  ['IV', 'IV', 'I', 'I', 'II7', 'II7', 'V7', 'V7'],
  ['vi', 'vi', 'ii', 'ii', 'V7', 'V7', 'I', 'I'],
  ['I', 'iii', 'IV', 'I', 'ii', 'V7', 'I', 'I'],
  ['I', 'V7', 'V7', 'I', 'IV', 'I', 'V7', 'I'],
];

const ESCALA_MAIOR = [0, 2, 4, 5, 7, 9, 11];
const TONS = [0, 5, 7, 2];   // Dó, Fá, Sol, Ré (somados à nota base)

// Ritmos de um compasso, em tempos (somam 3)
const RITMOS = [[1, 1, 1], [2, 1], [1, 2], [1, 1, 0.5, 0.5], [0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1], [1.5, 0.5, 1]];

const ANTECEDENCIA = 1.5;   // s de música agendados à frente (aguenta os timers lentos de aba em segundo plano)

const midiParaHz = m => 440 * 2 ** ((m - 69) / 12);
const sortear = lista => lista[Math.floor(Math.random() * lista.length)];

class ParkAudio {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.masterGain = null;
    this.efeitosGain = null;
    this.bufferMoeda = null;
    this.musicTimer = null;
    this.vozes = new Set();   // osciladores agendados que ainda não terminaram (para cortar no stop)
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.25; // Volume geral suave
    this.masterGain.connect(this.ctx.destination);

    this.efeitosGain = this.ctx.createGain();
    this.efeitosGain.gain.value = VOLUME_EFEITOS;
    this.efeitosGain.connect(this.ctx.destination);
    this.bufferMoeda = this.criarBufferMoeda();
  }

  // Cria uma única amostra curta; cada compra só precisa iniciar uma nova fonte sobre o buffer.
  criarBufferMoeda() {
    const duracao = 0.22, taxa = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.ceil(duracao * taxa), taxa);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < dados.length; i++) {
      const t = i / taxa, queda = Math.exp(-19 * t);
      dados[i] = queda * (
        0.5 * Math.sin(2 * Math.PI * 1318 * t) +
        0.3 * Math.sin(2 * Math.PI * 2240 * t) +
        0.2 * Math.sin(2 * Math.PI * 3270 * t)
      );
    }
    return buffer;
  }

  tocarMoeda() {
    if (!this.ctx) this.init();
    const tocar = () => {
      const fonte = this.ctx.createBufferSource();
      fonte.buffer = this.bufferMoeda;
      fonte.connect(this.efeitosGain);
      fonte.onended = () => fonte.disconnect();
      fonte.start();
    };

    if (this.ctx.state === 'suspended')
      this.ctx.resume().then(tocar).catch(erro => console.warn('Não foi possível reproduzir o som de moeda:', erro));
    else tocar();
  }

  toggle() {
    if (!this.ctx) this.init();

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.masterGain.gain.setTargetAtTime(0.25, this.ctx.currentTime, 0.2);

    this.startCrowdAmbience();
    this.startCarouselMusic();
  }

  stop() {
    this.isPlaying = false;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
    }
    if (this.crowdNode) {
      this.crowdNode.stop();
      this.crowdNode.disconnect();
      this.crowdNode = null;
    }
    clearTimeout(this.musicTimer);
    // Notas já agendadas para o próximo 1,5 s: corta depois do fade, para não tocarem ao religar
    const corte = this.ctx ? this.ctx.currentTime + 0.8 : 0;
    for (const v of this.vozes) { try { v.stop(corte); } catch { /* já parou */ } }
    this.vozes.clear();
  }

  // 1. Gera o som ambiente de multidão distante (Ruído Rosa + Filtro Passa-Banda)
  startCrowdAmbience() {
    const bufferSize = this.ctx.sampleRate * 4; // Loop de 4 segundos
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    // Algoritmo de Paul Kellet para Ruído Rosa (mais grave e natural que ruído branco)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.04;
      b6 = white * 0.115926;
    }

    this.crowdNode = this.ctx.createBufferSource();
    this.crowdNode.buffer = buffer;
    this.crowdNode.loop = true;

    // Filtra para a faixa de frequência da voz humana distante (300Hz - 900Hz)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 550;
    filter.Q.value = 0.8;

    const crowdGain = this.ctx.createGain();
    crowdGain.gain.value = 0.6;

    this.crowdNode.connect(filter);
    filter.connect(crowdGain);
    crowdGain.connect(this.masterGain);

    this.crowdNode.start();
  }

  // 2. Valsa de realejo composta na hora. Em vez de um setTimeout por nota (o navegador atrasa os timers,
  // principalmente com a aba em segundo plano, e o ritmo "manca"), as notas são agendadas no relógio do
  // próprio áudio (ctx.currentTime), que é exato. O timer só acorda de vez em quando para agendar
  // os compassos que faltam até ANTECEDENCIA segundos à frente.
  startCarouselMusic() {
    this.proximoCompasso = this.ctx.currentTime + 0.15;
    this.secao = null;
    const acordar = () => {
      if (!this.isPlaying) return;
      while (this.proximoCompasso < this.ctx.currentTime + ANTECEDENCIA) this.agendarCompasso();
      this.musicTimer = setTimeout(acordar, 250);
    };
    acordar();
  }

  // Sorteia uma seção nova: progressão (diferente da anterior), tom, andamento e se tem sininho
  novaSecao() {
    const anterior = this.secao;
    let prog;
    do { prog = sortear(PROGRESSOES); } while (anterior && prog === anterior.prog);
    const tom = !anterior || Math.random() < 0.35 ? sortear(TONS) : anterior.tom;   // às vezes muda de tom
    const ritmos = Array.from({ length: 8 }, () => sortear(RITMOS));   // um ritmo por compasso
    ritmos[4] = ritmos[0]; ritmos[5] = ritmos[1];                          // a frase "volta"
    ritmos[7] = Math.random() < 0.6 ? [3] : [2, 1];                        // fim de frase: nota longa
    this.secao = {
      prog, tom, ritmos, compasso: 0,
      tempo: 0.31 + Math.random() * 0.07,          // segundos por tempo (≈ 160 a 195 batidas por minuto)
      sininho: Math.random() < 0.35,
      descanso: Math.random() < 0.3 ? 3 : -1,      // às vezes a melodia descansa um compasso (só acompanhamento)
      ultima: anterior ? anterior.ultima : 67 + tom,   // a melodia continua de onde parou
    };
  }

  agendarCompasso() {
    if (!this.secao || this.secao.compasso >= 8) this.novaSecao();
    const s = this.secao, t0 = this.proximoCompasso, b = s.tempo;
    const base = 60 + s.tom;                                             // Dó central (ou o tom sorteado)
    const acorde = ACORDES[s.prog[s.compasso]].map(n => base + n);

    // Acompanhamento: baixo no 1º tempo ("um"), acorde curto nos tempos 2 e 3 ("pá-pá")
    this.tocarBaixo(midiParaHz(acorde[0] - 24), b * 0.9, t0);
    for (const tempo of [1, 2])
      for (const n of acorde.slice(0, 3)) this.tocarAcorde(midiParaHz(n - 12), b * 0.35, t0 + tempo * b);

    // Melodia
    if (s.compasso !== s.descanso) {
      const notasDoAcorde = new Set(acorde.map(n => ((n % 12) + 12) % 12));
      let t = t0;
      s.ritmos[s.compasso].forEach((dur, i) => {
        const nota = this.escolherNota(s, notasDoAcorde, i === 0 || dur >= 1);
        this.playCalliopeNote(midiParaHz(nota), dur * b, t);
        if (s.sininho && i === 0) this.tocarSino(midiParaHz(nota + 12), t);
        t += dur * b;
      });
    }
    s.compasso++;
    this.proximoCompasso = t0 + 3 * b;
  }

  // Próxima nota da melodia, perto da anterior (melodia "cantável" não pula muito).
  // forte = tempo importante: usa uma nota do acorde; fraco = anda um grau da escala (nota de passagem).
  escolherNota(s, notasDoAcorde, forte) {
    const min = 64 + s.tom - (s.tom > 4 ? 12 : 0), max = min + 19;     // faixa da melodia (pouco mais de uma oitava e meia)
    const pc = n => ((n - s.tom) % 12 + 12) % 12;
    const ant = s.ultima;
    let nota;
    if (forte) {
      // Entre as notas do acorde na faixa, sorteia uma das 3 mais próximas da anterior (às vezes repete)
      const opcoes = [];
      for (let n = min; n <= max; n++) if (notasDoAcorde.has(((n % 12) + 12) % 12)) opcoes.push(n);
      opcoes.sort((a, c) => Math.abs(a - ant) - Math.abs(c - ant));
      nota = sortear(opcoes.slice(0, 3));
    } else {
      // Um grau acima ou abaixo na escala; perto das bordas da faixa, volta para o meio
      const dir = ant > max - 3 ? -1 : ant < min + 3 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      nota = ant + dir;
      while (!ESCALA_MAIOR.includes(pc(nota))) nota += dir;
    }
    s.ultima = Math.max(min, Math.min(max, nota));
    return s.ultima;
  }

  // Agenda um oscilador e o guarda em "vozes" até terminar (para o stop poder cortá-lo)
  agendarVoz(osc, inicio, fim) {
    osc.start(inicio);
    osc.stop(fim);
    this.vozes.add(osc);
    osc.onended = () => this.vozes.delete(osc);
  }

  // Envelope simples: sobe em "ataque" segundos até "pico" e cai até quase zero no fim
  envelope(inicio, dur, pico, ataque = 0.02) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.linearRampToValueAtTime(pico, inicio + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    g.connect(this.masterGain);
    return g;
  }

  // Melodia: órgão de tubos (Calliope), onda triangular com vibrato
  playCalliopeNote(freq, duration, when = this.ctx.currentTime) {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, when);

    // LFO para dar o vibrato característico de órgãos a vapor antigos
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    vibrato.frequency.value = 5.5; // 5.5 Hz de oscilação
    vibratoGain.gain.value = 3.5;  // Intensidade da desafinação leve
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    // Envelope de volume (ataque suave de ar entrando no tubo)
    osc.connect(this.envelope(when, duration * 0.95, 0.11, 0.04));
    this.agendarVoz(osc, when, when + duration);
    this.agendarVoz(vibrato, when, when + duration);
  }

  // "Um": baixo grave e redondo
  tocarBaixo(freq, dur, when) {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(this.envelope(when, dur, 0.13, 0.01));
    this.agendarVoz(osc, when, when + dur);
  }

  // "Pá": acorde curto, onda quadrada abafada por um filtro passa-baixa (som de palheta de realejo)
  tocarAcorde(freq, dur, when) {
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 1400;
    osc.connect(filtro);
    filtro.connect(this.envelope(when, dur, 0.018, 0.005));
    this.agendarVoz(osc, when, when + dur);
  }

  // Sininho (glockenspiel): seno agudo com um harmônico "metálico" e queda rápida
  tocarSino(freq, when) {
    for (const [mult, vol] of [[1, 0.05], [2.76, 0.015]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      osc.connect(this.envelope(when, 0.9, vol, 0.003));
      this.agendarVoz(osc, when, when + 0.9);
    }
  }
}
