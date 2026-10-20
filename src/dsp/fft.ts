/**
 * Fast Fourier Transform (FFT) and Spectral Analysis Module
 * Implements Cooley-Tukey Radix-2 FFT with multiple window functions.
 */

export type WindowType = 'rect' | 'hann' | 'hamming' | 'blackman' | 'flattop';

export interface FFTResult {
  frequencies: Float64Array; // Frequency bins in Hz [0 ... fs/2]
  magnitude: Float64Array;   // Linear magnitude
  magnitudeDb: Float64Array; // Magnitude in dB (20*log10)
  phase: Float64Array;       // Phase in radians [-pi, pi]
  peaks: { frequency: number; magnitudeDb: number }[];
  nyquist: number;
  fftSize: number;
}

/**
 * Applies a window function to the input signal to reduce spectral leakage.
 */
export function applyWindow(input: Float64Array, windowType: WindowType): Float64Array {
  const N = input.length;
  const out = new Float64Array(N);

  for (let i = 0; i < N; i++) {
    let w = 1.0;
    const a = (2.0 * Math.PI * i) / (N - 1);

    switch (windowType) {
      case 'hann':
        w = 0.5 * (1.0 - Math.cos(a));
        break;
      case 'hamming':
        w = 0.54 - 0.46 * Math.cos(a);
        break;
      case 'blackman':
        w = 0.42 - 0.5 * Math.cos(a) + 0.08 * Math.cos(2 * a);
        break;
      case 'flattop':
        w = 0.21557895 - 0.41663158 * Math.cos(a) + 0.277263158 * Math.cos(2 * a) - 0.083578947 * Math.cos(3 * a) + 0.006947368 * Math.cos(4 * a);
        break;
      case 'rect':
      default:
        w = 1.0;
        break;
    }
    out[i] = input[i] * w;
  }

  return out;
}

/**
 * Returns the next power of 2 greater than or equal to n.
 */
export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) {
    p <<= 1;
  }
  return p;
}

/**
 * Performs in-place Cooley-Tukey Radix-2 FFT.
 * real and imag arrays must have length equal to a power of 2.
 */
export function fftRadix2(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error('FFT length must be a power of 2');
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;

      const tempI = imag[i];
      imag[i] = imag[j];
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly updates
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2.0 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1.0;
      let wI = 0.0;
      for (let k = 0; k < halfLen; k++) {
        const pos1 = i + k;
        const pos2 = pos1 + halfLen;

        const uR = real[pos1];
        const uI = imag[pos1];

        const tR = wR * real[pos2] - wI * imag[pos2];
        const tI = wR * imag[pos2] + wI * real[pos2];

        real[pos1] = uR + tR;
        imag[pos1] = uI + tI;
        real[pos2] = uR - tR;
        imag[pos2] = uI - tI;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }
}

/**
 * Computes the one-sided magnitude and phase spectrum of a real discrete signal.
 */
export function computeSpectrum(
  signal: Float64Array,
  fs: number,
  requestedFftSize?: number,
  windowType: WindowType = 'hann'
): FFTResult {
  const signalLen = signal.length;
  if (signalLen === 0) {
    return {
      frequencies: new Float64Array(0),
      magnitude: new Float64Array(0),
      magnitudeDb: new Float64Array(0),
      phase: new Float64Array(0),
      peaks: [],
      nyquist: fs / 2,
      fftSize: 0,
    };
  }

  // Determine FFT size (power of 2, minimum 256, maximum 65536)
  let n = requestedFftSize ? nextPowerOf2(requestedFftSize) : nextPowerOf2(Math.min(signalLen, 8192));
  n = Math.max(256, Math.min(n, 65536));

  // Extract segment (last n samples or zero-pad)
  const segment = new Float64Array(n);
  const copyLen = Math.min(signalLen, n);
  const startOffset = Math.max(0, signalLen - n);

  for (let i = 0; i < copyLen; i++) {
    segment[i] = signal[startOffset + i];
  }

  // Apply Window
  const windowed = applyWindow(segment, windowType);

  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  real.set(windowed);

  // Compute FFT
  fftRadix2(real, imag);

  // One-sided spectrum up to Nyquist (N/2 + 1)
  const numBins = Math.floor(n / 2) + 1;
  const frequencies = new Float64Array(numBins);
  const magnitude = new Float64Array(numBins);
  const magnitudeDb = new Float64Array(numBins);
  const phase = new Float64Array(numBins);

  const df = fs / n;
  const normFactor = 2.0 / n; // Scale for one-sided peak amplitude

  for (let k = 0; k < numBins; k++) {
    frequencies[k] = k * df;
    const r = real[k];
    const im = imag[k];
    let mag = Math.sqrt(r * r + im * im) * normFactor;
    if (k === 0 || k === numBins - 1) {
      mag /= 2.0; // DC and Nyquist are not doubled
    }
    magnitude[k] = mag;

    // dB relative to 1.0 (0 dBFS)
    const magClamped = Math.max(mag, 1e-6); // -120 dB floor
    magnitudeDb[k] = 20.0 * Math.log10(magClamped);
    phase[k] = Math.atan2(im, r);
  }

  // Detect prominent peaks
  const peaks: { frequency: number; magnitudeDb: number }[] = [];
  const minDb = -80; // Only look above -80 dB
  for (let k = 1; k < numBins - 1; k++) {
    const val = magnitudeDb[k];
    if (val > minDb && val > magnitudeDb[k - 1] && val > magnitudeDb[k + 1]) {
      peaks.push({ frequency: frequencies[k], magnitudeDb: val });
    }
  }

  // Sort peaks descending by amplitude and take top 8
  peaks.sort((a, b) => b.magnitudeDb - a.magnitudeDb);
  const topPeaks = peaks.slice(0, 8).sort((a, b) => a.frequency - b.frequency);

  return {
    frequencies,
    magnitude,
    magnitudeDb,
    phase,
    peaks: topPeaks,
    nyquist: fs / 2,
    fftSize: n,
  };
}
