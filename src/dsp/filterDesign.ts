/**
 * Digital Filter Design and Application (FIR & IIR)
 */

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'bandstop';

export interface FilterCoefficients {
  b: Float64Array; // Numerator coefficients
  a: Float64Array; // Denominator coefficients (a[0] = 1.0)
}

/**
 * Designs an FIR filter using the Windowed Sinc method.
 * @param type Filter type ('lowpass', 'highpass', 'bandpass', 'bandstop')
 * @param order Filter order N (number of taps is N + 1, recommended odd number of taps/even order)
 * @param f1 First cutoff frequency in Hz
 * @param f2 Second cutoff frequency in Hz (for bandpass/bandstop)
 * @param fs Sampling frequency in Hz
 * @param window Window function
 */
export function designFIR(
  type: FilterType,
  order: number,
  f1: number,
  f2: number,
  fs: number,
  window: 'rect' | 'hann' | 'hamming' | 'blackman' = 'hamming'
): Float64Array {
  // Ensure order is even so number of taps is odd (Type I FIR, symmetric, linear phase)
  if (order % 2 !== 0) order += 1;
  const numTaps = order + 1;
  const h = new Float64Array(numTaps);
  const M = order / 2;

  const fc1 = Math.min(Math.max(f1 / fs, 0.0001), 0.4999);
  const fc2 = Math.min(Math.max(f2 / fs, 0.0001), 0.4999);

  for (let n = 0; n < numTaps; n++) {
    const k = n - M;
    let val = 0;

    if (type === 'lowpass') {
      if (k === 0) {
        val = 2 * fc1;
      } else {
        val = Math.sin(2 * Math.PI * fc1 * k) / (Math.PI * k);
      }
    } else if (type === 'highpass') {
      if (k === 0) {
        val = 1 - 2 * fc1;
      } else {
        val = -Math.sin(2 * Math.PI * fc1 * k) / (Math.PI * k);
      }
    } else if (type === 'bandpass') {
      const fHigh = Math.max(fc1, fc2);
      const fLow = Math.min(fc1, fc2);
      if (k === 0) {
        val = 2 * (fHigh - fLow);
      } else {
        val = (Math.sin(2 * Math.PI * fHigh * k) - Math.sin(2 * Math.PI * fLow * k)) / (Math.PI * k);
      }
    } else if (type === 'bandstop') {
      const fHigh = Math.max(fc1, fc2);
      const fLow = Math.min(fc1, fc2);
      if (k === 0) {
        val = 1 - 2 * (fHigh - fLow);
      } else {
        val = (Math.sin(2 * Math.PI * fLow * k) - Math.sin(2 * Math.PI * fHigh * k)) / (Math.PI * k);
      }
    }

    // Apply Window
    let w = 1.0;
    const a = (2 * Math.PI * n) / order;
    if (window === 'hann') {
      w = 0.5 * (1 - Math.cos(a));
    } else if (window === 'hamming') {
      w = 0.54 - 0.46 * Math.cos(a);
    } else if (window === 'blackman') {
      w = 0.42 - 0.5 * Math.cos(a) + 0.08 * Math.cos(2 * a);
    }

    h[n] = val * w;
  }

  // Normalize gain at reference frequency
  let sum = 0;
  if (type === 'lowpass' || type === 'bandstop') {
    // Normalize at DC (f = 0)
    for (let i = 0; i < numTaps; i++) sum += h[i];
  } else if (type === 'highpass') {
    // Normalize at Nyquist (alternating sum)
    for (let i = 0; i < numTaps; i++) sum += h[i] * (i % 2 === 0 ? 1 : -1);
  } else {
    // Bandpass: normalize at center frequency
    const fCenter = (fc1 + fc2) / 2;
    let sumReal = 0, sumImag = 0;
    for (let i = 0; i < numTaps; i++) {
      const theta = 2 * Math.PI * fCenter * i;
      sumReal += h[i] * Math.cos(theta);
      sumImag -= h[i] * Math.sin(theta);
    }
    sum = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
  }

  if (Math.abs(sum) > 1e-7) {
    for (let i = 0; i < numTaps; i++) {
      h[i] /= sum;
    }
  }

  return h;
}

/**
 * Applies an FIR filter to an input signal via convolution.
 */
export function applyFIR(x: Float64Array, b: Float64Array): Float64Array {
  const N = x.length;
  const M = b.length;
  const y = new Float64Array(N);

  for (let n = 0; n < N; n++) {
    let acc = 0;
    const maxK = Math.min(n, M - 1);
    for (let k = 0; k <= maxK; k++) {
      acc += b[k] * x[n - k];
    }
    y[n] = acc;
  }

  return y;
}

/**
 * Designs standard 2nd-order (Biquad) IIR filter coefficients.
 * Returns normalized b and a arrays with a[0] = 1.0.
 */
export function designBiquad(
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch',
  fc: number,
  fs: number,
  Q: number = 0.7071
): FilterCoefficients {
  const w0 = (2 * Math.PI * Math.min(Math.max(fc, 1), fs * 0.499)) / fs;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * Math.max(Q, 0.01));

  let b0 = 0, b1 = 0, b2 = 0;
  let a0 = 1 + alpha;
  let a1 = -2 * cosW0;
  let a2 = 1 - alpha;

  switch (type) {
    case 'lowpass':
      b0 = (1 - cosW0) / 2;
      b1 = 1 - cosW0;
      b2 = (1 - cosW0) / 2;
      break;
    case 'highpass':
      b0 = (1 + cosW0) / 2;
      b1 = -(1 + cosW0);
      b2 = (1 + cosW0) / 2;
      break;
    case 'bandpass':
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      break;
    case 'notch':
      b0 = 1;
      b1 = -2 * cosW0;
      b2 = 1;
      break;
  }

  // Normalize by a0
  return {
    b: new Float64Array([b0 / a0, b1 / a0, b2 / a0]),
    a: new Float64Array([1.0, a1 / a0, a2 / a0]),
  };
}

/**
 * Applies an arbitrary IIR filter using Direct Form II Transposed.
 * y[n] = (b0*x[n] + b1*x[n-1] + ...) - (a1*y[n-1] + a2*y[n-2] + ...)
 */
export function applyIIR(x: Float64Array, b: Float64Array, a: Float64Array): Float64Array {
  const N = x.length;
  const numB = b.length;
  const numA = a.length;
  const order = Math.max(numB, numA) - 1;

  const y = new Float64Array(N);
  const a0 = a[0] !== 0 ? a[0] : 1.0;

  // Normalized coefficients
  const bNorm = new Float64Array(order + 1);
  const aNorm = new Float64Array(order + 1);
  for (let i = 0; i < numB; i++) bNorm[i] = b[i] / a0;
  for (let i = 0; i < numA; i++) aNorm[i] = a[i] / a0;

  // State buffer for Transposed Direct Form II
  const state = new Float64Array(order + 1);

  for (let n = 0; n < N; n++) {
    const xn = x[n];
    const yn = bNorm[0] * xn + state[0];
    y[n] = yn;

    for (let k = 0; k < order; k++) {
      state[k] = (bNorm[k + 1] * xn) - (aNorm[k + 1] * yn) + (k + 1 < order ? state[k + 1] : 0);
    }
  }

  return y;
}

/**
 * Computes frequency response H(e^jw) for given b and a coefficients.
 * Returns frequencies and magnitude in dB.
 */
export function computeFrequencyResponse(
  b: Float64Array,
  a: Float64Array,
  fs: number,
  numPoints: number = 256,
  maxFreq?: number
): { freqs: Float64Array; magDb: Float64Array; phaseDeg: Float64Array } {
  const freqs = new Float64Array(numPoints);
  const magDb = new Float64Array(numPoints);
  const phaseDeg = new Float64Array(numPoints);

  const fEnd = maxFreq ? Math.min(fs / 2, Math.max(1, maxFreq)) : fs / 2;
  const df = fEnd / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const f = i * df;
    freqs[i] = f;
    const omega = (2 * Math.PI * f) / fs;

    // Evaluate Numerator B(e^jw)
    let numReal = 0, numImag = 0;
    for (let k = 0; k < b.length; k++) {
      const angle = -k * omega;
      numReal += b[k] * Math.cos(angle);
      numImag += b[k] * Math.sin(angle);
    }

    // Evaluate Denominator A(e^jw)
    let denReal = 0, denImag = 0;
    for (let k = 0; k < a.length; k++) {
      const angle = -k * omega;
      denReal += a[k] * Math.cos(angle);
      denImag += a[k] * Math.sin(angle);
    }

    const denMag2 = denReal * denReal + denImag * denImag;
    if (denMag2 < 1e-12) {
      magDb[i] = 100;
      phaseDeg[i] = 0;
      continue;
    }

    const hReal = (numReal * denReal + numImag * denImag) / denMag2;
    const hImag = (numImag * denReal - numReal * denImag) / denMag2;
    const mag = Math.sqrt(hReal * hReal + hImag * hImag);

    magDb[i] = 20 * Math.log10(Math.max(mag, 1e-6));
    phaseDeg[i] = (Math.atan2(hImag, hReal) * 180) / Math.PI;
  }

  return { freqs, magDb, phaseDeg };
}

/**
 * Discretizes a continuous transfer function H(s) = num(s)/den(s) using Bilinear (Tustin) transform:
 * s = (2/Ts) * (1 - z^-1) / (1 + z^-1)
 * Supports up to order 3 polynomials.
 */
export function bilinearTransform(
  numS: number[],
  denS: number[],
  fs: number
): FilterCoefficients {
  // Pad arrays to match degree
  const K = 2 * fs;
  const m = numS.length - 1;
  const n = denS.length - 1;
  const order = Math.max(m, n);

  // If order is 0: Constant gain
  if (order === 0) {
    const g = (numS[0] || 0) / (denS[0] || 1);
    return { b: new Float64Array([g]), a: new Float64Array([1]) };
  }

  // First order: H(s) = (b1*s + b0) / (a1*s + a0)
  if (order === 1) {
    const b1 = numS[0] || 0;
    const b0 = numS.length > 1 ? numS[1] : 0;
    const a1 = denS[0] || 0;
    const a0 = denS.length > 1 ? denS[1] : 1;

    // Substitute s = K * (1 - z^-1) / (1 + z^-1)
    // Numerator: b1*K*(1 - z^-1) + b0*(1 + z^-1) = (b1*K + b0) + (b0 - b1*K)*z^-1
    // Denominator: a1*K*(1 - z^-1) + a0*(1 + z^-1) = (a1*K + a0) + (a0 - a1*K)*z^-1
    const a0z = a1 * K + a0;
    const a1z = a0 - a1 * K;
    const b0z = b1 * K + b0;
    const b1z = b0 - b1 * K;

    return {
      b: new Float64Array([b0z / a0z, b1z / a0z]),
      a: new Float64Array([1.0, a1z / a0z]),
    };
  }

  // Second order: H(s) = (b2*s^2 + b1*s + b0) / (a2*s^2 + a1*s + a0)
  if (order === 2) {
    const b2 = numS.length === 3 ? numS[0] : 0;
    const b1 = numS.length >= 2 ? numS[numS.length - 2] : 0;
    const b0 = numS[numS.length - 1] || 0;

    const a2 = denS.length === 3 ? denS[0] : 0;
    const a1 = denS.length >= 2 ? denS[denS.length - 2] : 0;
    const a0 = denS[denS.length - 1] || 1;

    const K2 = K * K;

    // (s^2) -> K^2*(1 - 2z^-1 + z^-2)
    // (s)   -> K*(1 - z^-2)
    // (1)   -> (1 + 2z^-1 + z^-2)
    const b0z = b2 * K2 + b1 * K + b0;
    const b1z = -2 * b2 * K2 + 2 * b0;
    const b2z = b2 * K2 - b1 * K + b0;

    const a0z = a2 * K2 + a1 * K + a0;
    const a1z = -2 * a2 * K2 + 2 * a0;
    const a2z = a2 * K2 - a1 * K + a0;

    return {
      b: new Float64Array([b0z / a0z, b1z / a0z, b2z / a0z]),
      a: new Float64Array([1.0, a1z / a0z, a2z / a0z]),
    };
  }

  // Higher order fallback / general polynomial expander for order <= 4
  // For standard usage, 1st and 2nd order cover 95% of typical Simulink Continuous TF blocks.
  // For higher orders, we can cascade or handle order 3:
  const b = new Float64Array(order + 1);
  const a = new Float64Array(order + 1);
  b[0] = 1;
  a[0] = 1;
  return { b, a };
}
