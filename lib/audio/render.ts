import type { AudioConfig, SubliminalProject } from "../types";
import { dbToGain, mulberry32 } from "./math";
import { encodeWav } from "./wav";
import { synthesizeVoice } from "./voice";

export type RenderOptions = {
  sampleRate?: number;
  durationSec?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function reverseBuffer(input: Float32Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[input.length - 1 - i] ?? 0;
  return out;
}

function resampleLinear(input: Float32Array, speed: number): Float32Array {
  if (speed === 1) return input;
  const outLen = Math.max(1, Math.floor(input.length / speed));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * speed;
    const i0 = Math.floor(src);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = src - i0;
    out[i] = (input[i0] ?? 0) * (1 - frac) + (input[i1] ?? 0) * frac;
  }
  return out;
}

function loopInto(target: Float32Array, source: Float32Array, gain: number, offset = 0) {
  if (!source.length) return;
  for (let i = 0; i < target.length; i++) {
    const s = source[(i + offset) % source.length] ?? 0;
    target[i] += s * gain;
  }
}

function makeBed(
  kind: AudioConfig["bed"],
  length: number,
  sampleRate: number,
  rand: () => number,
): { l: Float32Array; r: Float32Array } {
  const l = new Float32Array(length);
  const r = new Float32Array(length);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    brown = 0;
  for (let i = 0; i < length; i++) {
    const white = rand() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.052691;
    const pink = b0 + b1 + b2 + white * 0.1848;
    brown = clamp(brown + white * 0.02, -1, 1);
    const t = i / sampleRate;
    let sample = 0;
    if (kind === "white") sample = white * 0.12;
    else if (kind === "pink") sample = pink * 0.08;
    else if (kind === "brown") sample = brown * 0.22;
    else if (kind === "rain") {
      const drop = rand() > 0.9992 ? (rand() * 2 - 1) * 0.5 : 0;
      sample = pink * 0.07 + drop;
    } else if (kind === "ocean") {
      const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.07 * t);
      sample = pink * 0.05 * swell + Math.sin(2 * Math.PI * 0.11 * t) * 0.02;
    } else if (kind === "forest") {
      const chirp = Math.sin(2 * Math.PI * (1800 + 400 * Math.sin(t * 3)) * t);
      const bird = rand() > 0.9997 ? chirp * 0.08 : 0;
      sample = pink * 0.04 + bird;
    } else if (kind === "pad") {
      sample =
        0.05 * Math.sin(2 * Math.PI * 110 * t) +
        0.04 * Math.sin(2 * Math.PI * 165.2 * t) +
        0.03 * Math.sin(2 * Math.PI * 220.4 * t);
    } else sample = 0;
    l[i] = sample;
    r[i] = sample * (0.92 + rand() * 0.08);
  }
  return { l, r };
}

export function renderProjectWav(project: SubliminalProject, options: RenderOptions = {}): Buffer {
  const sampleRate = options.sampleRate ?? 22050;
  const durationSec = Math.min(options.durationSec ?? project.durationSec, 8 * 60);
  const length = Math.floor(durationSec * sampleRate);
  const rand = mulberry32(hash(project.theme));
  const cfg = project.audio;

  const { l, r } = makeBed(cfg.bed, length, sampleRate, rand);
  const voice = resampleLinear(
    synthesizeVoice(project.affirmations.join(" "), sampleRate, rand),
    cfg.speed,
  );
  const reversed = cfg.reverse ? reverseBuffer(voice) : voice;
  const gain = dbToGain(cfg.affirmationGainDb) * (cfg.whisper ? 0.7 : 1);

  const layers = Math.max(1, Math.min(12, cfg.layers));
  for (let layer = 0; layer < layers; layer++) {
    const offset = Math.floor((layer / layers) * voice.length);
    const layerGain = gain / Math.sqrt(layers);
    if (cfg.alsoForward || !cfg.reverse) {
      loopInto(l, voice, layerGain * 0.85, offset);
      loopInto(r, voice, layerGain * 0.85, offset + 64);
    }
    if (cfg.reverse) {
      loopInto(l, reversed, layerGain * 0.7, offset + 128);
      loopInto(r, reversed, layerGain * 0.9, offset);
    }
  }

  if (cfg.binaural.enabled) {
    const f = cfg.binaural.carrierHz;
    const beat = cfg.binaural.beatHz;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      l[i] += 0.07 * Math.sin(2 * Math.PI * f * t);
      r[i] += 0.07 * Math.sin(2 * Math.PI * (f + beat) * t);
    }
  }

  if (cfg.isochronic.enabled) {
    const hz = cfg.isochronic.hz;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const gate = Math.sin(2 * Math.PI * hz * t) > 0 ? 1 : 0;
      const tone = 0.05 * Math.sin(2 * Math.PI * 180 * t) * gate;
      l[i] += tone;
      r[i] += tone;
    }
  }

  if (cfg.silentCarrier.enabled) {
    const carrier = cfg.silentCarrier.hz;
    const depth = cfg.silentCarrier.depth;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.abs(voice[i % voice.length] ?? 0);
      const am = (1 + depth * env * 4) * 0.04 * Math.sin(2 * Math.PI * carrier * t);
      l[i] += am;
      r[i] += am;
    }
  }

  if (cfg.eightD) {
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const pan = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.07 * t);
      const mid = (l[i] + r[i]) * 0.5;
      const voiceish = (voice[i % voice.length] ?? 0) * gain;
      l[i] = l[i] * 0.85 + mid * 0.1 + voiceish * (1 - pan);
      r[i] = r[i] * 0.85 + mid * 0.1 + voiceish * pan;
    }
  }

  normalizeStereo(l, r, 0.89);
  return encodeWav([l, r], sampleRate);
}

function normalizeStereo(l: Float32Array, r: Float32Array, peak: number) {
  let max = 0.0001;
  for (let i = 0; i < l.length; i++) {
    max = Math.max(max, Math.abs(l[i] ?? 0), Math.abs(r[i] ?? 0));
  }
  const g = peak / max;
  for (let i = 0; i < l.length; i++) {
    l[i] *= g;
    r[i] *= g;
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
