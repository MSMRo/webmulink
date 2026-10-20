/**
 * Audio Utilities: WAV Encoding/Decoding (with support for scientific sample rates like 1000 Hz, 360 Hz, 250 Hz)
 * and Real-Time Playback
 */

let globalAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!globalAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }
  return globalAudioCtx;
}

/**
 * Direct PCM WAV parser that decodes any sampling rate (including 1000 Hz, 360 Hz, 250 Hz).
 * Browser's native AudioContext.decodeAudioData rejects sample rates under 3000 Hz with DOMException;
 * this parser runs in pure JavaScript and handles 8-bit, 16-bit, 24-bit, 32-bit integer and 32-bit float WAVs.
 */
export function parseWavArrayBuffer(arrayBuffer: ArrayBuffer): { samples: Float64Array; sampleRate: number; duration: number } {
  const view = new DataView(arrayBuffer);

  // Check RIFF and WAVE header
  if (view.byteLength < 44) {
    throw new Error('Archivo demasiado pequeño para ser un archivo WAV válido.');
  }

  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));

  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('El archivo no tiene cabecera RIFF/WAVE válida.');
  }

  let offset = 12;
  let audioFormat = 1; // 1 = PCM, 3 = IEEE float
  let numChannels = 1;
  let sampleRate = 1000;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = Math.min(chunkSize, view.byteLength - dataOffset);
      break;
    }
    offset += 8 + chunkSize;
  }

  if (dataOffset === 0 || dataSize <= 0) {
    throw new Error('No se encontró el bloque de datos (data chunk) en el archivo WAV.');
  }

  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
  const numSamples = Math.floor(dataSize / (bytesPerSample * numChannels));
  const samples = new Float64Array(numSamples);

  let p = dataOffset;
  for (let i = 0; i < numSamples; i++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) {
      let val = 0;
      if (bitsPerSample === 16) {
        val = view.getInt16(p, true) / 32768.0;
        p += 2;
      } else if (bitsPerSample === 8) {
        val = (view.getUint8(p) - 128) / 128.0;
        p += 1;
      } else if (bitsPerSample === 24) {
        // 24-bit signed little-endian
        const b0 = view.getUint8(p);
        const b1 = view.getUint8(p + 1);
        const b2 = view.getInt8(p + 2); // sign-extended
        val = ((b2 << 16) | (b1 << 8) | b0) / 8388608.0;
        p += 3;
      } else if (bitsPerSample === 32 && audioFormat === 3) {
        // 32-bit float
        val = view.getFloat32(p, true);
        p += 4;
      } else if (bitsPerSample === 32) {
        // 32-bit integer
        val = view.getInt32(p, true) / 2147483648.0;
        p += 4;
      } else {
        // Fallback 16-bit
        val = view.getInt16(p, true) / 32768.0;
        p += 2;
      }
      sum += val;
    }
    samples[i] = sum / numChannels;
  }

  const duration = numSamples / Math.max(1, sampleRate);
  return { samples, sampleRate, duration };
}

/**
 * Decodes an uploaded audio or biomedical signal file (WAV, MP3, etc.)
 * Tries direct PCM WAV parsing first (to support 1000 Hz, 360 Hz, etc.), and falls back to Web Audio API.
 */
export async function decodeAudioFile(file: File | Blob): Promise<{ samples: Float64Array; sampleRate: number; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();

  // Try pure TypeScript WAV parsing first (guarantees support for low sample rates like 1000 Hz)
  try {
    return parseWavArrayBuffer(arrayBuffer);
  } catch (wavErr) {
    // If it's not a standard PCM WAV (e.g. MP3, OGG, compressed), fall back to browser decodeAudioData
    try {
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

      const numChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const monoSamples = new Float64Array(length);

      for (let c = 0; c < numChannels; c++) {
        const channelData = audioBuffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
          monoSamples[i] += channelData[i] / numChannels;
        }
      }

      return {
        samples: monoSamples,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
      };
    } catch (browserErr: any) {
      throw new Error(`Error al leer archivo de audio/señal: ${wavErr instanceof Error ? wavErr.message : browserErr?.message || browserErr}`);
    }
  }
}

/**
 * Resamples an input buffer from sourceFs to targetFs using linear interpolation.
 */
export function resampleSignal(
  samples: Float64Array,
  sourceFs: number,
  targetFs: number,
  targetDuration?: number
): Float64Array {
  if (sourceFs === targetFs && !targetDuration) {
    return samples;
  }

  const ratio = sourceFs / targetFs;
  const numTargetSamples = targetDuration ? Math.floor(targetDuration * targetFs) : Math.floor(samples.length / ratio);
  const result = new Float64Array(numTargetSamples);

  for (let i = 0; i < numTargetSamples; i++) {
    const srcIndex = i * ratio;
    const idx0 = Math.floor(srcIndex);
    const idx1 = Math.min(idx0 + 1, samples.length - 1);
    const frac = srcIndex - idx0;

    if (idx0 < samples.length) {
      result[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
    } else {
      result[i] = 0;
    }
  }

  return result;
}

/**
 * Audio playback controller for simulated signal buffers.
 * Automatically upsamples low-rate signals (e.g. 1000 Hz) to the browser's audio sample rate (e.g. 44100 Hz).
 */
export class AudioSignalPlayer {
  private ctx: AudioContext;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private isPlaying: boolean = false;

  constructor() {
    this.ctx = getAudioContext();
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
  }

  public setVolume(volume: number) {
    this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(volume, 1)), this.ctx.currentTime);
  }

  public playBuffer(samples: Float64Array, fs: number, loop: boolean = false, onEnded?: () => void): void {
    this.stop();

    if (samples.length === 0) return;

    // Resample if fs does not match browser context sampleRate
    const ctxFs = this.ctx.sampleRate;
    const resampled = resampleSignal(samples, fs, ctxFs);

    const audioBuffer = this.ctx.createBuffer(1, resampled.length, ctxFs);
    const channelData = audioBuffer.getChannelData(0);

    let peak = 0;
    for (let i = 0; i < resampled.length; i++) {
      const absVal = Math.abs(resampled[i]);
      if (absVal > peak) peak = absVal;
    }

    const scale = peak > 1.0 ? 0.95 / peak : 1.0;
    for (let i = 0; i < resampled.length; i++) {
      channelData[i] = resampled[i] * scale;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = loop;
    source.connect(this.gainNode);

    source.onended = () => {
      this.isPlaying = false;
      if (onEnded) onEnded();
    };

    source.start(0);
    this.currentSource = source;
    this.isPlaying = true;
  }

  public stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // ignore
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

/**
 * Creates a downloadable WAV Blob from a Float64Array signal.
 */
export function exportToWavBlob(samples: Float64Array, fs: number): Blob {
  const numChannels = 1;
  const sampleRate = fs;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
