// Sounds, made in the page with Web Audio (no files): the round's countdown and start, a powerup
// appearing and taken, a crash, a round won, the game won. Off until the page has been touched
// (browsers allow sound only after that), and a switch in the settings.

let ctx: AudioContext | null = null;
let on = true;

export function setSound(enabled: boolean) {
  on = enabled;
}

/** Call from a click or key press: browsers start audio only then. */
export function unlockAudio() {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start: number, dur: number, vol = 0.12) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1400;
  src.buffer = buf;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

export const sfx = {
  tick() { if (on) tone(660, 0, 0.08, 'square', 0.04); },
  go() { if (on) tone(990, 0, 0.18, 'square', 0.05); },
  spawn() { if (on) tone(1200, 0, 0.07, 'sine', 0.035); },
  pick(mine: boolean) { if (on) tone(mine ? 520 : 380, 0, 0.16, 'triangle', mine ? 0.08 : 0.04, 2); },
  crash(mine: boolean) { if (on) { noise(0, mine ? 0.45 : 0.25, mine ? 0.2 : 0.08); if (mine) tone(160, 0, 0.35, 'sawtooth', 0.05, 0.4); } },
  round(won: boolean) { if (on) [523, 659, won ? 784 : 587].forEach((f, i) => tone(f, i * 0.09, 0.16, 'triangle', 0.06)); },
  match(won: boolean) { if (on) (won ? [523, 659, 784, 1047] : [392, 349, 330]).forEach((f, i) => tone(f, i * 0.13, 0.26, 'triangle', 0.07)); },
};
