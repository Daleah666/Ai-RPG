import { floatTo16BitPcm } from "./math";

export function encodeWav(channels: Float32Array[], sampleRate: number): Buffer {
  const ch = channels.length;
  const length = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = ch * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(ch, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const pcm = channels.map(floatTo16BitPcm);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < ch; c++) {
      buffer.writeInt16LE(pcm[c][i] ?? 0, offset);
      offset += 2;
    }
  }
  return buffer;
}
