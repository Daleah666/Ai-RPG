/** Tiny formant-ish voice so reverse / silent / speed layers have a real buffer. */
export function synthesizeVoice(
  text: string,
  sampleRate: number,
  rand: () => number,
): Float32Array {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: number[] = [];
  const pushSilence = (sec: number) => {
    const n = Math.floor(sec * sampleRate);
    for (let i = 0; i < n; i++) out.push(0);
  };

  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const ch = word.charCodeAt(i);
      const voiced = "aeiouy".includes(word[i] ?? "");
      const dur = (voiced ? 0.07 : 0.04) + rand() * 0.02;
      const f0 = 110 + (ch % 18) * 3;
      const f1 = 280 + (ch % 12) * 40;
      const f2 = 840 + (ch % 20) * 55;
      const n = Math.floor(dur * sampleRate);
      for (let s = 0; s < n; s++) {
        const t = s / sampleRate;
        const env = Math.sin((s / n) * Math.PI);
        const buzz = Math.sign(Math.sin(2 * Math.PI * f0 * t));
        const form =
          0.45 * Math.sin(2 * Math.PI * f1 * t) + 0.25 * Math.sin(2 * Math.PI * f2 * t);
        const noise = voiced ? 0 : (rand() * 2 - 1) * 0.22;
        out.push((buzz * 0.18 + form + noise) * env * 0.45);
      }
    }
    pushSilence(0.06 + rand() * 0.04);
  }
  pushSilence(0.25);
  return Float32Array.from(out);
}
