// Sons synthétisés en Web Audio (coup de pioche, tintement de gemme) : aucun fichier, désactivables.

let ctx: AudioContext | null = null;
let enabled = localStorage.getItem("rockfilon.sound") !== "off";

export const isSoundOn = () => enabled;
export function setSound(on: boolean) {
  enabled = on;
  localStorage.setItem("rockfilon.sound", on ? "on" : "off");
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, endFreq = freq) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  o.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + start + dur);
  g.gain.setValueAtTime(gain, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur);
}

function noise(dur: number, gain: number) {
  const c = ctx!;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(c.destination);
  src.start();
}

export function play(kind: "pick" | "gem" | "beryl" | "miss") {
  if (!enabled) return;
  ctx ??= new AudioContext();
  if (kind === "pick" || kind === "gem" || kind === "beryl") {
    noise(0.12, 0.25); // le choc sur la roche
    tone(140, 0, 0.12, "square", 0.08, 60);
  }
  if (kind === "gem") [1568, 2093].forEach((f, i) => tone(f, 0.08 + i * 0.07, 0.25, "sine", 0.06));
  if (kind === "beryl") [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.1 + i * 0.08, 0.5, "triangle", 0.07));
  if (kind === "miss") {
    noise(0.08, 0.15);
    tone(220, 0, 0.18, "triangle", 0.1, 90); // la pioche rebondit
  }
}
