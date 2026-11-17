import fs from 'node:fs';
import path from 'node:path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'tmp_media_uploads');

export function ensureUploadDir(): string {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

export function saveUploadedMediaBase64(
  filenameSafe: string,
  base64Data: string
): { filePath: string; byteLength: number } {
  const dir = ensureUploadDir();
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buffer = Buffer.from(cleanBase64, 'base64');
  const fullPath = path.join(dir, filenameSafe);
  fs.writeFileSync(fullPath, buffer);
  return { filePath: fullPath, byteLength: buffer.length };
}

export function getUploadedMediaPath(filenameSafe: string): string | null {
  const dir = ensureUploadDir();
  const safeName = path.basename(filenameSafe);
  const fullPath = path.join(dir, safeName);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

/**
 * Generates a high-quality, valid 16-bit stereo PCM WAV buffer in memory
 * with harmonic studio chords tailored to the track ID so every seeded
 * audio/video item streams genuine playable audio with HTTP 206 Range support.
 */
export function generateStudioAudioWav(seedId: number, durationSec = 18): Buffer {
  const sampleRate = 22050;
  const numChannels = 2;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Musical progressions per seedId (warm Afro-soul / synth pad chords)
  const roots = [130.81, 146.83, 164.81, 174.61, 196.0, 220.0];
  const root = roots[seedId % roots.length];
  const chordRatios = [
    [1, 1.25, 1.5, 1.875],
    [1.125, 1.333, 1.667, 2.0],
    [0.89, 1.125, 1.333, 1.667],
    [0.75, 1.0, 1.25, 1.5],
  ];

  const bpm = 96 + (seedId % 4) * 8;
  const beatDur = 60 / bpm;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const barIndex = Math.floor(t / (beatDur * 4)) % chordRatios.length;
    const chord = chordRatios[barIndex];

    // Soft rhythmic pulse
    const beatPhase = (t % beatDur) / beatDur;
    const kickEnv = Math.exp(-beatPhase * 12) * 0.25;
    const kickFreq = 55 + 90 * Math.exp(-beatPhase * 22);
    const kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv;

    // Warm harmonic pad
    let padL = 0;
    let padR = 0;
    for (let c = 0; c < chord.length; c++) {
      const freq = root * chord[c] * (c === 0 ? 1 : 2);
      const detune = (c % 2 === 0 ? 0.4 : -0.4);
      const lfo = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.25 * t + c);
      padL += Math.sin(2 * Math.PI * (freq + detune) * t) * lfo * 0.1;
      padR += Math.sin(2 * Math.PI * (freq - detune) * t) * lfo * 0.1;
    }

    // Gentle fade in/out
    const fade = Math.min(1, t / 0.4) * Math.min(1, (durationSec - t) / 0.6);
    const sampleL = Math.max(-0.95, Math.min(0.95, (padL + kick) * fade));
    const sampleR = Math.max(-0.95, Math.min(0.95, (padR + kick) * fade));

    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.floor(sampleL * 32767), offset);
    buffer.writeInt16LE(Math.floor(sampleR * 32767), offset + 2);
  }

  return buffer;
}
