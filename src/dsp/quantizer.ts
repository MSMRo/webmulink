/**
 * Mixed-Signal: Quantization, ADC, DAC, and Zero-Order Hold (ZOH)
 */

export interface QuantizerConfig {
  bits: number;        // e.g. 4, 8, 12, 16
  vRef: number;        // Peak reference voltage (e.g. 1.0 V)
  mode: 'mid-tread' | 'mid-riser' | 'floor';
  signed: boolean;     // signed [-Vref, +Vref] vs unipolar [0, Vref]
}

export interface QuantizationStats {
  stepSize: number;       // Delta
  numLevels: number;      // 2^bits
  sqnrDb: number;         // Theoretical or measured SQNR
  maxError: number;
  rmsError: number;
}

/**
 * Quantizes an input signal according to specified bit depth and voltage range.
 */
export function quantizeSignal(
  signal: Float64Array,
  config: QuantizerConfig
): { quantized: Float64Array; error: Float64Array; stats: QuantizationStats } {
  const N = signal.length;
  const quantized = new Float64Array(N);
  const error = new Float64Array(N);

  const bits = Math.max(1, Math.min(Math.round(config.bits), 24));
  const numLevels = Math.pow(2, bits);
  const vRef = Math.max(0.001, config.vRef);

  let stepSize: number;
  let minLevel: number;
  let maxLevel: number;

  if (config.signed) {
    stepSize = (2.0 * vRef) / numLevels;
    minLevel = -vRef;
    maxLevel = vRef - stepSize;
  } else {
    stepSize = vRef / numLevels;
    minLevel = 0;
    maxLevel = vRef - stepSize;
  }

  let sigPower = 0;
  let noisePower = 0;
  let maxErr = 0;

  for (let i = 0; i < N; i++) {
    const x = signal[i];
    // Clamp to input range
    const clamped = Math.max(minLevel, Math.min(x, config.signed ? vRef : vRef));

    let q = 0;
    if (config.mode === 'mid-tread') {
      // Zero is a level
      const code = Math.round(clamped / stepSize);
      q = code * stepSize;
    } else if (config.mode === 'mid-riser') {
      // Zero is between levels
      const code = Math.floor(clamped / stepSize) + 0.5;
      q = code * stepSize;
    } else {
      // Truncation / floor
      const code = Math.floor(clamped / stepSize);
      q = code * stepSize;
    }

    // Clamp output within quantization range
    if (config.signed) {
      q = Math.max(-vRef, Math.min(q, vRef));
    } else {
      q = Math.max(0, Math.min(q, vRef));
    }

    quantized[i] = q;
    const err = q - x;
    error[i] = err;

    sigPower += x * x;
    noisePower += err * err;
    const absErr = Math.abs(err);
    if (absErr > maxErr) maxErr = absErr;
  }

  const rmsError = Math.sqrt(noisePower / Math.max(1, N));
  const rmsSignal = Math.sqrt(sigPower / Math.max(1, N));
  let sqnrDb = 0;
  if (noisePower > 1e-12 && sigPower > 1e-12) {
    sqnrDb = 10 * Math.log10(sigPower / noisePower);
  } else {
    // Theoretical 6.02 * N + 1.76 dB
    sqnrDb = 6.02 * bits + 1.76;
  }

  return {
    quantized,
    error,
    stats: {
      stepSize,
      numLevels,
      sqnrDb,
      maxError: maxErr,
      rmsError,
    },
  };
}

/**
 * Applies a Zero-Order Hold (ZOH / Retenedor de orden cero).
 * Subsamples the signal at sample interval Ts = 1 / fHold and holds the value flat.
 */
export function applyZOH(
  signal: Float64Array,
  fs: number,
  fHold: number
): Float64Array {
  const N = signal.length;
  const out = new Float64Array(N);

  const safeFHold = Math.min(Math.max(fHold, 0.1), fs);
  const samplesPerHold = Math.max(1, Math.round(fs / safeFHold));

  let currentHeldValue = 0;
  for (let i = 0; i < N; i++) {
    if (i % samplesPerHold === 0) {
      currentHeldValue = signal[i];
    }
    out[i] = currentHeldValue;
  }

  return out;
}

/**
 * Digital-to-Analog Converter (DAC) Reconstruction
 * Converts discrete samples to continuous approximation using:
 * - 'zoh': Zero-Order Hold (staircase)
 * - 'foh': First-Order Hold (linear interpolation)
 * - 'sinc': Ideal low-pass reconstruction filter
 */
export function reconstructDAC(
  signal: Float64Array,
  fs: number,
  method: 'zoh' | 'foh' | 'smooth' = 'zoh',
  cutoffFreq?: number
): Float64Array {
  const N = signal.length;
  const out = new Float64Array(N);

  if (method === 'zoh') {
    out.set(signal);
    return out;
  }

  if (method === 'foh') {
    // Linear smoothing / triangular hold
    for (let i = 0; i < N; i++) {
      const prev = i > 0 ? signal[i - 1] : signal[0];
      const curr = signal[i];
      const next = i < N - 1 ? signal[i + 1] : curr;
      out[i] = 0.25 * prev + 0.5 * curr + 0.25 * next;
    }
    return out;
  }

  // Smooth / Analog lowpass reconstruction filter (simple 2-pole RC lowpass filter)
  const fc = cutoffFreq || fs * 0.2;
  const rc = 1 / (2 * Math.PI * fc);
  const dt = 1 / fs;
  const alpha = dt / (rc + dt);

  let y = signal[0] || 0;
  for (let i = 0; i < N; i++) {
    y = y + alpha * (signal[i] - y);
    out[i] = y;
  }

  return out;
}
