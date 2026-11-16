/* ============================================================
   ParkAudio.js — som de fundo SINTETIZADO (Web Audio API): multidão distante + órgão de carrossel.
   Script clássico (sem "export"): o projeto não usa módulos ES, então a classe fica no escopo
   global compartilhado e o musica.js (carregado depois) a usa com "new ParkAudio()".
   ============================================================ */
class ParkAudio {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.masterGain = null;
    this.musicTimer = null;
    this.noteIndex = 0;

    // Melodia estilo valsa de carrossel (Notas em Hz e duração em segundos)
    // Compasso 3/4 clássico de parque de diversões
    this.melody = [
      // Compasso 1 (Dó Maior)
      { freq: 523.25, dur: 0.35 }, // C5
      { freq: 392.00, dur: 0.35 }, // G4
      { freq: 329.63, dur: 0.35 }, // E4
      // Compasso 2 (Fá Maior)
      { freq: 587.33, dur: 0.35 }, // D5
      { freq: 440.00, dur: 0.35 }, // A4
      { freq: 349.23, dur: 0.35 }, // F4
      // Compasso 3 (Sol Maior)
      { freq: 493.88, dur: 0.35 }, // B4
      { freq: 392.00, dur: 0.35 }, // G4
      { freq: 293.66, dur: 0.35 }, // D4
      // Compasso 4 (Resolução em Dó)
      { freq: 523.25, dur: 0.70 }, // C5
      { freq: 0,      dur: 0.35 }, // Pausa
    ];
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.25; // Volume geral suave
    this.masterGain.connect(this.ctx.destination);
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

  // 2. Toca a música de órgão de carrossel (Calliope) em loop
  startCarouselMusic() {
    const playNextNote = () => {
      if (!this.isPlaying) return;

      const note = this.melody[this.noteIndex];
      if (note.freq > 0) {
        this.playCalliopeNote(note.freq, note.dur);
      }

      this.noteIndex = (this.noteIndex + 1) % this.melody.length;
      this.musicTimer = setTimeout(playNextNote, note.dur * 1000);
    };

    playNextNote();
  }

  playCalliopeNote(freq, duration) {
    const now = this.ctx.currentTime;

    // Oscilador principal (onda triangular soa como flauta/tubo de órgão)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    // LFO para dar o vibrato característico de órgãos a vapor antigos
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    vibrato.frequency.value = 5.5; // 5.5 Hz de oscilação
    vibratoGain.gain.value = 3.5;  // Intensidade da desafinação leve
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    // Envelope de volume (ataque suave de ar entrando no tubo)
    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0.001, now);
    noteGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(noteGain);
    noteGain.connect(this.masterGain);

    osc.start(now);
    vibrato.start(now);
    osc.stop(now + duration);
    vibrato.stop(now + duration);
  }
}