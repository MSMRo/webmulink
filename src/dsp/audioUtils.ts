/**
 * Audio Utilities: WAV Encoding/Decoding and Real-Time Playback
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
 * Decodes an uploaded audio file (WAV, MP3, etc.) into a normalized mono Float64Array.
 */
export async function decodeAudioFile(file: File | Blob): Promise<{ samples: Float64Array; sampleRate: number; duration: number }> {
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  // Convert to mono
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
      result[i] = 0; // zero-pad if target duration exceeds file length
    }
  }

  return result;
}

/**
 * Audio playback controller for simulated signal buffers.
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
    // volume: 0.0 to 1.0
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

    // Normalize or soft-clip if peak > 1.0 to prevent harsh distortion
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
        // ignore if already stopped
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

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples (16-bit signed integer)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1.0, 1.0]
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
