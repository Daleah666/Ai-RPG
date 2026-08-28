"use client";

import { useEffect, useRef } from "react";
import type { SubliminalProject } from "@/lib/types";
import { dbToGain, mulberry32 } from "@/lib/audio/math";
import { synthesizeVoice } from "@/lib/audio/voice";

export function useStudioAudio(project: SubliminalProject | null, playing: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!project || !playing) {
      void ctxRef.current?.suspend();
      return;
    }

    const started = async () => {
      const ctx = ctxRef.current ?? new AudioContext();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);

      const cfg = project.audio;
      const rand = mulberry32(project.theme.length * 97);
      const voice = synthesizeVoice(project.affirmations.join(" "), ctx.sampleRate, rand);
      const buffer = ctx.createBuffer(1, voice.length, ctx.sampleRate);
      buffer.getChannelData(0).set(voice);

      const makeVoice = (reverse: boolean, pan: number, rate: number, offset: number) => {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.playbackRate.value = rate;
        // reverse via playbackRate negative is not supported; copy reversed
        if (reverse) {
          const rev = ctx.createBuffer(1, voice.length, ctx.sampleRate);
          const data = rev.getChannelData(0);
          for (let i = 0; i < voice.length; i++) data[i] = voice[voice.length - 1 - i] ?? 0;
          src.buffer = rev;
        }
        const g = ctx.createGain();
        g.gain.value = dbToGain(cfg.affirmationGainDb) / Math.sqrt(Math.max(1, cfg.layers));
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        src.connect(g).connect(p).connect(master);
        src.start(0, offset);
        return src;
      };

      const nodes: AudioNode[] = [master];
      const sources: AudioBufferSourceNode[] = [];

      const layers = Math.max(1, Math.min(8, cfg.layers));
      for (let i = 0; i < layers; i++) {
        const pan = cfg.eightD ? (i % 2 === 0 ? -0.7 : 0.7) : 0;
        if (cfg.alsoForward || !cfg.reverse) {
          sources.push(makeVoice(false, pan, cfg.speed, (i * 0.37) % 4));
        }
        if (cfg.reverse) {
          sources.push(makeVoice(true, -pan, cfg.speed, (i * 0.51) % 4));
        }
      }

      // bed: filtered noise
      if (cfg.bed !== "silence") {
        const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = cfg.bed === "brown" || cfg.bed === "ocean" ? "lowpass" : "bandpass";
        filter.frequency.value =
          cfg.bed === "rain" ? 2400 : cfg.bed === "pad" ? 420 : cfg.bed === "forest" ? 1800 : 700;
        filter.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.value = cfg.bed === "pad" ? 0.08 : 0.22;
        src.connect(filter).connect(g).connect(master);
        src.start();
        sources.push(src);
        nodes.push(filter, g);
      }

      if (cfg.binaural.enabled) {
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.frequency.value = cfg.binaural.carrierHz;
        oscR.frequency.value = cfg.binaural.carrierHz + cfg.binaural.beatHz;
        const g = ctx.createGain();
        g.gain.value = 0.05;
        const merge = ctx.createChannelMerger(2);
        oscL.connect(g).connect(merge, 0, 0);
        oscR.connect(g).connect(merge, 0, 1);
        merge.connect(master);
        oscL.start();
        oscR.start();
        nodes.push(g, merge);
        const stopOsc = () => {
          oscL.stop();
          oscR.stop();
        };
        sources.push({ stop: stopOsc } as AudioBufferSourceNode);
      }

      if (cfg.isochronic.enabled) {
        const osc = ctx.createOscillator();
        osc.frequency.value = 180;
        const g = ctx.createGain();
        g.gain.value = 0.04;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = cfg.isochronic.hz;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.04;
        lfo.connect(lfoGain).connect(g.gain);
        osc.connect(g).connect(master);
        osc.start();
        lfo.start();
        nodes.push(g, lfoGain);
        sources.push({
          stop: () => {
            osc.stop();
            lfo.stop();
          },
        } as AudioBufferSourceNode);
      }

      if (cfg.silentCarrier.enabled) {
        const carrier = ctx.createOscillator();
        carrier.frequency.value = cfg.silentCarrier.hz;
        const am = ctx.createGain();
        am.gain.value = 0.03;
        const voiceSrc = ctx.createBufferSource();
        voiceSrc.buffer = buffer;
        voiceSrc.loop = true;
        const rect = ctx.createWaveShaper();
        rect.curve = new Float32Array([0, 0.2, 1]);
        const depth = ctx.createGain();
        depth.gain.value = cfg.silentCarrier.depth * 0.08;
        voiceSrc.connect(rect).connect(depth).connect(am.gain);
        carrier.connect(am).connect(master);
        carrier.start();
        voiceSrc.start();
        sources.push(voiceSrc);
        nodes.push(am, depth, rect);
        sources.push({ stop: () => carrier.stop() } as AudioBufferSourceNode);
      }

      return () => {
        sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            /* already stopped */
          }
        });
        nodes.forEach((n) => {
          try {
            n.disconnect();
          } catch {
            /* */
          }
        });
      };
    };

    let cleanup: (() => void) | undefined;
    void started().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [project, playing]);
}
