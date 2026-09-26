export type Sfx = 'ping' | 'key' | 'enter' | 'back' | 'warp' | 'warpOut' | 'chirp' | 'star' | 'power';

export interface AudioState {
  readonly muted: boolean;
  readonly started: boolean;
  readonly ambient: boolean;
}

interface Ambient {
  readonly out: GainNode;
  readonly crackle: GainNode;
  readonly chordA: GainNode;
  readonly chordB: GainNode;
  showingA: boolean;
}

const STORAGE_KEY = 'ruslan-postoiuk:sound';
const PENTATONIC = [392, 440, 493.88, 587.33, 659.25];
const WHOLE_TONE = [392, 440, 493.88, 554.37, 622.25, 698.46, 783.99, 880, 987.77];
const MUSIC_BOX = [392, 440, 493.88, 587.33, 659.25, 783.99, 880, 987.77];
const GMAJ9 = [196, 293.66, 369.99, 440, 493.88];
const LYDIAN_A = [246.94, 293.66, 369.99, 440];
const LYDIAN_B = [220, 277.18, 329.63, 493.88];
const AMBIENT_LEVEL = 0.3;
const CRACKLE_LEVEL = 0.022;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this visit only.
  }
}

function glide(param: AudioParam, value: number, at: number, timeConstant: number): void {
  const current = param.value;
  param.cancelScheduledValues(at);
  param.setValueAtTime(current, at);
  param.setTargetAtTime(value, at, timeConstant);
}

function pickFrom<T>(list: readonly T[], index: number): T {
  return list[Math.max(0, Math.min(list.length - 1, index))] as T;
}

export class CosmicAudio {
  private ac: AudioContext | null = null;
  private bus: GainNode | null = null;
  private dry: GainNode | null = null;
  private verb: ConvolverNode | null = null;
  private readonly noise = new Map<number, AudioBuffer>();
  private ambient: Ambient | null = null;
  private chordTimer = 0;
  private suspendTimer = 0;
  private walk = 4;
  private current: AudioState;

  constructor(private readonly onChange: (state: AudioState) => void) {
    this.current = { muted: readMuted(), started: false, ambient: false };
    document.addEventListener('visibilitychange', () => this.handleVisibility());
    window.addEventListener('blur', () => this.fadeAmbient(false, 0.6));
    window.addEventListener('focus', () => {
      if (!this.current.muted && this.ambient && !document.hidden) this.fadeAmbient(true, 1.4);
    });
    onChange(this.current);
  }

  get state(): AudioState {
    return this.current;
  }

  toggle(): void {
    const muted = !this.current.muted;
    writeMuted(muted);
    this.update({ muted });
    if (muted) {
      this.fadeAmbient(false, 0.3, true);
      return;
    }
    this.play('power');
    this.fadeAmbient(true, 1.4);
  }

  play(name: Sfx, pan = 0, level?: number): void {
    if (this.current.muted) return;
    const ac = this.ensure();
    if (!ac) return;
    if (!this.current.started) this.update({ started: true });
    if (!this.ambient) this.startAmbient();
    try {
      this.voice(name, ac.currentTime + 0.01, Math.max(-1, Math.min(1, pan)), level);
    } catch {
      // A voice that fails to schedule must never break the page.
    }
  }

  private update(patch: Partial<AudioState>): void {
    this.current = { ...this.current, ...patch };
    this.onChange(this.current);
  }

  private ensure(): AudioContext | null {
    if (!this.ac) {
      const Ctor = audioContextCtor();
      if (!Ctor) return null;
      try {
        this.ac = this.buildGraph(new Ctor());
      } catch {
        return null;
      }
    }
    if (this.ac.state === 'suspended') void this.ac.resume().catch(() => undefined);
    return this.ac;
  }

  // Voices → bus → dry + 4 s reverb + tape echo → soft saturation → gentle low-pass: warm, never harsh.
  private buildGraph(ac: AudioContext): AudioContext {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;
    const shaper = ac.createWaveShaper();
    shaper.curve = this.saturation(1.2);
    shaper.oversample = '2x';
    const warmth = ac.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 6200;
    warmth.Q.value = 0.4;
    const master = ac.createGain();
    master.gain.value = 0.62;
    comp.connect(shaper);
    shaper.connect(warmth);
    warmth.connect(master);
    master.connect(ac.destination);

    const dry = ac.createGain();
    dry.gain.value = 0.8;
    dry.connect(comp);
    const verb = ac.createConvolver();
    verb.buffer = this.impulse(ac, 4.2, 2.8);
    const wet = ac.createGain();
    wet.gain.value = 0.55;
    verb.connect(wet);
    wet.connect(comp);
    const delay = ac.createDelay(1.5);
    delay.delayTime.value = 0.38;
    const feedback = ac.createGain();
    feedback.gain.value = 0.34;
    const damp = ac.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1900;
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    const echo = ac.createGain();
    echo.gain.value = 0.42;
    damp.connect(echo);
    echo.connect(comp);
    echo.connect(verb);

    const bus = ac.createGain();
    bus.connect(dry);
    bus.connect(verb);
    bus.connect(delay);
    this.bus = bus;
    this.dry = dry;
    this.verb = verb;
    return ac;
  }

  private saturation(drive: number): Float32Array<ArrayBuffer> {
    const n = 1024;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    const norm = Math.tanh(drive);
    for (let i = 0; i < n; i++) curve[i] = Math.tanh(drive * ((i / (n - 1)) * 2 - 1)) / norm;
    return curve;
  }

  private impulse(ac: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ac.sampleRate * duration));
    const buffer = ac.createBuffer(2, length, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
    return buffer;
  }

  private noiseBuffer(ac: AudioContext, duration: number): AudioBuffer {
    const cached = this.noise.get(duration);
    if (cached) return cached;
    const length = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noise.set(duration, buffer);
    return buffer;
  }

  private crackleBuffer(ac: AudioContext): AudioBuffer {
    const length = Math.floor(ac.sampleRate * 3.7);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.015;
      if (Math.random() < 0.00004) {
        const amp = 0.25 + Math.random() * 0.75;
        const width = 1 + Math.floor(Math.random() * 3);
        for (let j = 0; j < width && i + j < length; j++) data[i + j] = (Math.random() * 2 - 1) * amp;
      }
    }
    return buffer;
  }

  private output(ac: AudioContext, pan: number): AudioNode {
    const bus = this.bus as GainNode;
    if (typeof ac.createStereoPanner !== 'function') return bus;
    const panner = ac.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(bus);
    return panner;
  }

  private tone(ac: AudioContext, type: OscillatorType, from: number, to: number, glideTime: number, peak: number, attack: number, decay: number, pan: number, t: number): void {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + Math.max(0.01, glideTime));
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(gain);
    gain.connect(this.output(ac, pan));
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  private sweep(ac: AudioContext, rising: boolean, pan: number, t: number): void {
    const src = ac.createBufferSource();
    src.buffer = this.noiseBuffer(ac, 1.2);
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 5;
    band.frequency.setValueAtTime(rising ? 180 : 1900, t);
    band.frequency.exponentialRampToValueAtTime(rising ? 1900 : 170, t + 0.55);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(band);
    band.connect(gain);
    gain.connect(this.output(ac, pan));
    src.start(t);
    src.stop(t + 0.85);
  }

  private thump(ac: AudioContext, pan: number, t: number): void {
    const src = ac.createBufferSource();
    src.buffer = this.noiseBuffer(ac, 1.2);
    const lowpass = ac.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.output(ac, pan));
    src.start(t, Math.random() * 0.9);
    src.stop(t + 0.06);
  }

  private voice(name: Sfx, t: number, pan: number, level?: number): void {
    const ac = this.ac;
    if (!ac) return;
    switch (name) {
      case 'ping': {
        const f = pickFrom(PENTATONIC, Math.floor(Math.random() * PENTATONIC.length));
        this.tone(ac, 'sine', f * 1.12, f, 0.05, 0.14, 0.008, 1.5, pan, t);
        this.tone(ac, 'sine', f * 2, f * 2, 0, 0.016, 0.006, 0.6, pan, t);
        this.tone(ac, 'sine', f / 2, f / 2, 0, 0.045, 0.012, 1, pan, t);
        this.thump(ac, pan, t);
        break;
      }
      case 'key': {
        // A random walk over the whole-tone scale: typing turns into a slow, strange melody.
        this.walk = Math.max(0, Math.min(WHOLE_TONE.length - 1, this.walk + pickFrom([-2, -1, 1, 2], Math.floor(Math.random() * 4))));
        const f = pickFrom(WHOLE_TONE, this.walk);
        this.tone(ac, 'sine', f, f, 0, 0.065, 0.004, 0.95, pan, t);
        this.tone(ac, 'sine', f * 1.0023, f * 1.0023, 0, 0.028, 0.004, 0.8, -pan, t);
        this.tone(ac, 'sine', f * 3, f * 3, 0, 0.007, 0.003, 0.22, pan, t);
        break;
      }
      case 'enter':
        GMAJ9.forEach((f, i) => this.tone(ac, 'sine', f, f, 0, 0.045, 0.02, 2.4, (i - 2) * 0.3, t + i * 0.065));
        break;
      case 'back':
        this.tone(ac, 'sine', 520, 300, 0.14, 0.05, 0.005, 0.4, pan, t);
        break;
      case 'warp':
      case 'warpOut': {
        const rising = name === 'warp';
        this.sweep(ac, rising, pan, t);
        this.tone(ac, 'sine', rising ? 110 : 55, rising ? 48 : 110, 0.6, 0.12, 0.03, 0.7, pan, t);
        this.tone(ac, 'sine', rising ? 587.33 : 440, rising ? 587.33 : 440, 0, 0.018, 0.2, 1.2, pan, t + 0.15);
        break;
      }
      case 'chirp':
        this.tone(ac, 'sine', 587.33, 659.25, 0.06, 0.05, 0.006, 0.35, pan, t);
        this.tone(ac, 'sine', 783.99, 880, 0.05, 0.04, 0.006, 0.45, pan, t + 0.085);
        break;
      case 'star': {
        const f = pickFrom(MUSIC_BOX, Math.round((level ?? 0.5) * (MUSIC_BOX.length - 1)));
        this.tone(ac, 'sine', f, f, 0, 0.085, 0.004, 1.5, pan, t);
        this.tone(ac, 'sine', f * 2, f * 2, 0, 0.014, 0.004, 0.6, pan, t);
        this.tone(ac, 'sine', f * 3, f * 3, 0, 0.005, 0.003, 0.3, pan, t);
        break;
      }
      case 'power':
        this.tone(ac, 'sine', 196, 392, 0.7, 0.07, 0.05, 1.6, -0.2, t);
        this.tone(ac, 'sine', 293.66, 587.33, 0.7, 0.045, 0.05, 1.6, 0.2, t + 0.06);
        break;
    }
  }

  // The bed under everything: a G drone, a pad drifting between Gmaj9 and a Lydian colour, solar wind, faint vinyl.
  private startAmbient(): void {
    const ac = this.ac;
    const dry = this.dry;
    const verb = this.verb;
    if (!ac || !dry || !verb || this.ambient) return;
    const out = ac.createGain();
    out.gain.value = 0;
    out.connect(dry);
    out.connect(verb);

    const droneFilter = ac.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 520;
    droneFilter.Q.value = 0.5;
    const drone = ac.createGain();
    drone.gain.value = 0.035;
    droneFilter.connect(drone);
    drone.connect(out);
    for (const f of [98, 146.83]) {
      for (const cents of [-4, 4]) {
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.detune.value = cents;
        osc.connect(droneFilter);
        osc.start();
      }
    }
    this.lfo(ac, 0.06, 0.016, drone.gain);

    const padFilter = ac.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 760;
    padFilter.Q.value = 0.6;
    padFilter.connect(out);
    this.lfo(ac, 0.035, 280, padFilter.frequency);
    const chord = (notes: readonly number[], level: number) => {
      const gain = ac.createGain();
      gain.gain.value = level;
      gain.connect(padFilter);
      for (const f of notes) {
        for (const cents of [-7, 7]) {
          const osc = ac.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = f;
          osc.detune.value = cents;
          const v = ac.createGain();
          v.gain.value = 0.011;
          osc.connect(v);
          v.connect(gain);
          osc.start();
        }
      }
      return gain;
    };
    const chordA = chord(LYDIAN_A, 1);
    const chordB = chord(LYDIAN_B, 0.12);

    const wind = ac.createBufferSource();
    wind.buffer = this.noiseBuffer(ac, 4);
    wind.loop = true;
    const windFilter = ac.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 520;
    windFilter.Q.value = 0.9;
    const windGain = ac.createGain();
    windGain.gain.value = 0.022;
    this.lfo(ac, 0.023, 240, windFilter.frequency);
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(out);
    wind.start();

    const crackle = ac.createGain();
    crackle.gain.value = 0;
    crackle.connect(dry);
    const vinyl = ac.createBufferSource();
    vinyl.buffer = this.crackleBuffer(ac);
    vinyl.loop = true;
    const highpass = ac.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 700;
    vinyl.connect(highpass);
    highpass.connect(crackle);
    vinyl.start();

    this.ambient = { out, crackle, chordA, chordB, showingA: true };
    window.clearInterval(this.chordTimer);
    this.chordTimer = window.setInterval(() => this.swapChord(), 17000);
    this.fadeAmbient(true, 2.4);
  }

  private lfo(ac: AudioContext, frequency: number, depth: number, target: AudioParam): void {
    const osc = ac.createOscillator();
    osc.frequency.value = frequency;
    const amount = ac.createGain();
    amount.gain.value = depth;
    osc.connect(amount);
    amount.connect(target);
    osc.start();
  }

  private swapChord(): void {
    const ac = this.ac;
    const amb = this.ambient;
    if (!ac || !amb) return;
    amb.showingA = !amb.showingA;
    amb.chordA.gain.setTargetAtTime(amb.showingA ? 1 : 0.12, ac.currentTime, 3.2);
    amb.chordB.gain.setTargetAtTime(amb.showingA ? 0.12 : 1, ac.currentTime, 3.2);
  }

  private fadeAmbient(on: boolean, timeConstant: number, suspendAfter = false): void {
    const ac = this.ac;
    const amb = this.ambient;
    if (ac && amb) {
      glide(amb.out.gain, on ? AMBIENT_LEVEL : 0, ac.currentTime, timeConstant);
      glide(amb.crackle.gain, on ? CRACKLE_LEVEL : 0, ac.currentTime, timeConstant);
    }
    const ambient = on && !!amb;
    if (ambient !== this.current.ambient) this.update({ ambient });
    window.clearTimeout(this.suspendTimer);
    if (suspendAfter && ac) {
      this.suspendTimer = window.setTimeout(() => {
        if (this.current.muted || document.hidden) void ac.suspend().catch(() => undefined);
      }, timeConstant * 5000);
    }
  }

  private handleVisibility(): void {
    const ac = this.ac;
    if (!ac) return;
    if (document.hidden) {
      this.fadeAmbient(false, 0.3, true);
    } else if (!this.current.muted) {
      if (ac.state === 'suspended') void ac.resume().catch(() => undefined);
      this.fadeAmbient(true, 1.5);
    }
  }
}
