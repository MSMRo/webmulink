import { BlockInstance, Connection, SimulationConfig, SimulationResult } from '../types';
import { BLOCK_DEFINITIONS } from './blocks';
import { applyFIR, applyIIR, designFIR, designBiquad, bilinearTransform } from '../dsp/filterDesign';
import { quantizeSignal, applyZOH, reconstructDAC } from '../dsp/quantizer';
import { resampleSignal } from '../dsp/audioUtils';

/**
 * Parses comma or space separated numbers from user input string (e.g. "1, -0.5, 0.25")
 */
export function parseCoefficients(str: string | number[] | undefined, fallback: number[] = [1]): Float64Array {
  if (Array.isArray(str)) {
    return new Float64Array(str.length > 0 ? str : fallback);
  }
  if (!str || typeof str !== 'string') {
    return new Float64Array(fallback);
  }

  const parts = str
    .replace(/[\[\]]/g, '')
    .trim()
    .split(/[\s,]+/)
    .map((v) => parseFloat(v))
    .filter((v) => !isNaN(v));

  return parts.length > 0 ? new Float64Array(parts) : new Float64Array(fallback);
}

/**
 * Runs the simulation on the block diagram.
 */
export function runSimulation(
  blocks: BlockInstance[],
  connections: Connection[],
  config: SimulationConfig
): SimulationResult {
  const startTime = performance.now();
  const fs = Math.max(100, Math.min(config.fs, 96000));
  const duration = Math.max(0.01, Math.min(config.duration, 30.0));
  const sampleCount = Math.round(fs * duration);
  const timeStep = 1 / fs;

  // Time vector
  const time = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    time[i] = i * timeStep;
  }

  // Signal storage: key = `${blockId}:${portId}`
  const signalMap = new Map<string, Float64Array>();
  const logs: string[] = [];
  const errors: string[] = [];

  // Helper to get connected input signal
  function getInputSignal(blockId: string, portId: string): Float64Array {
    const conn = connections.find((c) => c.toBlockId === blockId && c.toPortId === portId);
    if (!conn) {
      // Unconnected input defaults to zero signal
      return new Float64Array(sampleCount);
    }
    const sigKey = `${conn.fromBlockId}:${conn.fromPortId}`;
    return signalMap.get(sigKey) || new Float64Array(sampleCount);
  }

  // Build dependency graph for topological sort
  // Note: Delay blocks (unit_delay) can break cycles if needed
  const blockMap = new Map<string, BlockInstance>();
  blocks.forEach((b) => blockMap.set(b.id, b));

  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  blocks.forEach((b) => {
    inDegree.set(b.id, 0);
    adjList.set(b.id, []);
  });

  connections.forEach((c) => {
    // If source or target block doesn't exist, ignore
    if (!blockMap.has(c.fromBlockId) || !blockMap.has(c.toBlockId)) return;

    // Unit delay breaks algebraic loop dependency
    const fromBlock = blockMap.get(c.fromBlockId);
    if (fromBlock && fromBlock.type === 'unit_delay') {
      // Treat as already resolvable or delayed
    } else {
      adjList.get(c.fromBlockId)!.push(c.toBlockId);
      inDegree.set(c.toBlockId, (inDegree.get(c.toBlockId) || 0) + 1);
    }
  });

  // Kahn's algorithm for topological sorting
  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    executionOrder.push(u);

    for (const v of adjList.get(u) || []) {
      const newDeg = (inDegree.get(v) || 1) - 1;
      inDegree.set(v, newDeg);
      if (newDeg === 0) {
        queue.push(v);
      }
    }
  }

  // If there are cycles (algebraic loops), append remaining blocks anyway
  if (executionOrder.length < blocks.length) {
    blocks.forEach((b) => {
      if (!executionOrder.includes(b.id)) {
        executionOrder.push(b.id);
      }
    });
    logs.push('Aviso: Se detectó bucle de retroalimentación cerrado (algebraic loop). Se evaluó usando aproximación directa.');
  }

  // Pre-initialize unit delays with initial condition
  blocks.forEach((b) => {
    if (b.type === 'unit_delay') {
      const out = new Float64Array(sampleCount);
      const initVal = parseFloat(b.params.initialCondition || 0) || 0;
      out.fill(initVal);
      signalMap.set(`${b.id}:out`, out);
    }
  });

  // Execute blocks in order
  for (const blockId of executionOrder) {
    const block = blockMap.get(blockId);
    if (!block) continue;

    try {
      evaluateBlock(block, getInputSignal, signalMap, time, fs, sampleCount);
    } catch (err: any) {
      errors.push(`Error en bloque "${block.title || block.type}": ${err?.message || err}`);
    }
  }

  const executionTimeMs = performance.now() - startTime;

  return {
    signals: signalMap,
    time,
    fs,
    duration,
    sampleCount,
    executionTimeMs,
    errors: errors.length > 0 ? errors : undefined,
    logs,
  };
}

/**
 * Evaluates an individual block's mathematical output buffers.
 */
function evaluateBlock(
  block: BlockInstance,
  getInputSignal: (blockId: string, portId: string) => Float64Array,
  signalMap: Map<string, Float64Array>,
  time: Float64Array,
  fs: number,
  sampleCount: number
) {
  const p = block.params;

  switch (block.type) {
    // ---------------- SOURCES ----------------
    case 'sine_source': {
      const out = new Float64Array(sampleCount);
      const freq = parseFloat(p.frequency ?? 50);
      const amp = parseFloat(p.amplitude ?? 1.0);
      const phaseRad = ((parseFloat(p.phase ?? 0)) * Math.PI) / 180;
      const offset = parseFloat(p.offset ?? 0);
      const twoPiF = 2 * Math.PI * freq;

      for (let i = 0; i < sampleCount; i++) {
        out[i] = amp * Math.sin(twoPiF * time[i] + phaseRad) + offset;
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'square_source': {
      const out = new Float64Array(sampleCount);
      const freq = parseFloat(p.frequency ?? 20);
      const amp = parseFloat(p.amplitude ?? 1.0);
      const duty = Math.min(Math.max(parseFloat(p.dutyCycle ?? 50) / 100, 0.01), 0.99);
      const offset = parseFloat(p.offset ?? 0);
      const period = 1 / Math.max(freq, 0.0001);

      for (let i = 0; i < sampleCount; i++) {
        const tInPeriod = time[i] % period;
        const val = tInPeriod < duty * period ? amp : -amp;
        out[i] = val + offset;
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'triangle_source': {
      const out = new Float64Array(sampleCount);
      const freq = parseFloat(p.frequency ?? 20);
      const amp = parseFloat(p.amplitude ?? 1.0);
      const offset = parseFloat(p.offset ?? 0);
      const period = 1 / Math.max(freq, 0.0001);
      const isSawtooth = p.type === 'sawtooth';

      for (let i = 0; i < sampleCount; i++) {
        const tNorm = (time[i] % period) / period; // 0 to 1
        let val = 0;
        if (isSawtooth) {
          // Sawtooth: -amp to +amp
          val = amp * (2 * tNorm - 1);
        } else {
          // Triangle: -amp to +amp
          val = tNorm < 0.5 ? amp * (4 * tNorm - 1) : amp * (3 - 4 * tNorm);
        }
        out[i] = val + offset;
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'noise_source': {
      const out = new Float64Array(sampleCount);
      const amp = parseFloat(p.amplitude ?? 0.5);
      const isGaussian = p.distribution !== 'uniform';

      for (let i = 0; i < sampleCount; i++) {
        if (isGaussian) {
          // Box-Muller transform for Gaussian noise
          const u1 = Math.max(Math.random(), 1e-10);
          const u2 = Math.random();
          const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          out[i] = z * amp;
        } else {
          // Uniform [-amp, amp]
          out[i] = (Math.random() * 2 - 1) * amp;
        }
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'step_source': {
      const out = new Float64Array(sampleCount);
      const stepTime = parseFloat(p.stepTime ?? 0.1);
      const initVal = parseFloat(p.initialValue ?? 0);
      const finalVal = parseFloat(p.finalValue ?? 1.0);

      for (let i = 0; i < sampleCount; i++) {
        out[i] = time[i] >= stepTime ? finalVal : initVal;
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'impulse_source': {
      const out = new Float64Array(sampleCount);
      const impulseTime = parseFloat(p.impulseTime ?? 0.05);
      const amp = parseFloat(p.amplitude ?? 1.0);
      const dt = 1 / fs;
      const targetIndex = Math.round(impulseTime / dt);

      if (targetIndex >= 0 && targetIndex < sampleCount) {
        out[targetIndex] = amp;
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'constant_source': {
      const out = new Float64Array(sampleCount);
      const val = parseFloat(p.value ?? 1.0);
      out.fill(val);
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'wav_source': {
      let out = new Float64Array(sampleCount);
      const audioData: Float64Array | null = p.audioData;
      const srcFs = parseFloat(p.sampleRate ?? 44100);
      const gain = parseFloat(p.gain ?? 1.0);

      if (audioData && audioData.length > 0) {
        // Resample audio to match simulation sampling frequency
        const resampled = resampleSignal(audioData, srcFs, fs);
        const len = Math.min(resampled.length, sampleCount);
        for (let i = 0; i < len; i++) {
          out[i] = resampled[i] * gain;
        }
        if (p.loop && len < sampleCount) {
          for (let i = len; i < sampleCount; i++) {
            out[i] = resampled[i % len] * gain;
          }
        }
      } else {
        // Fallback default audio chirp / tone so block works out-of-the-box before upload
        for (let i = 0; i < sampleCount; i++) {
          out[i] = 0.5 * Math.sin(2 * Math.PI * 440 * time[i]);
        }
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    // ---------------- MATH OPERATIONS ----------------
    case 'gain': {
      const u = getInputSignal(block.id, 'in');
      const k = parseFloat(p.gain ?? 1.0);
      const out = new Float64Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        out[i] = u[i] * k;
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'sum': {
      const u1 = getInputSignal(block.id, 'in1');
      const u2 = getInputSignal(block.id, 'in2');
      const signs = (p.signs || '++').padEnd(2, '+');
      const s1 = signs[0] === '-' ? -1 : 1;
      const s2 = signs[1] === '-' ? -1 : 1;

      const out = new Float64Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        out[i] = s1 * u1[i] + s2 * u2[i];
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'product': {
      const u1 = getInputSignal(block.id, 'in1');
      const u2 = getInputSignal(block.id, 'in2');
      const out = new Float64Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        out[i] = u1[i] * u2[i];
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'math_func': {
      const u = getInputSignal(block.id, 'in');
      const out = new Float64Array(sampleCount);
      const func = p.func || 'abs';

      for (let i = 0; i < sampleCount; i++) {
        const val = u[i];
        switch (func) {
          case 'abs':
            out[i] = Math.abs(val);
            break;
          case 'exp':
            out[i] = Math.exp(Math.min(val, 50));
            break;
          case 'log':
            out[i] = Math.log(Math.max(val, 1e-12));
            break;
          case 'sqrt':
            out[i] = Math.sqrt(Math.max(val, 0));
            break;
          case 'square':
            out[i] = val * val;
            break;
          case 'sin':
            out[i] = Math.sin(val);
            break;
          case 'cos':
            out[i] = Math.cos(val);
            break;
          default:
            out[i] = val;
        }
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'derivative': {
      const u = getInputSignal(block.id, 'in');
      const dt = 1 / fs;
      const out = new Float64Array(sampleCount);

      if (sampleCount > 1) {
        out[0] = (u[1] - u[0]) / dt;
        for (let i = 1; i < sampleCount; i++) {
          out[i] = (u[i] - u[i - 1]) / dt;
        }
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'integrator': {
      const u = getInputSignal(block.id, 'in');
      const dt = 1 / fs;
      const initVal = parseFloat(p.initialCondition ?? 0);
      const out = new Float64Array(sampleCount);

      let accum = initVal;
      out[0] = accum;
      for (let i = 1; i < sampleCount; i++) {
        // Trapezoidal integration
        accum += 0.5 * (u[i] + u[i - 1]) * dt;
        out[i] = accum;
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    // ---------------- DSP & FILTERS ----------------
    case 'fir_filter': {
      const x = getInputSignal(block.id, 'in');
      let b: Float64Array;

      if (p.designMode === 'designer') {
        const f1 = parseFloat(p.cutoffFreq ?? 200);
        const f2 = parseFloat(p.cutoffFreq2 ?? 800);
        const order = parseInt(p.order ?? 32, 10);
        const win = p.window || 'hamming';
        b = designFIR(p.filterType || 'lowpass', order, f1, f2, fs, win);
      } else {
        b = parseCoefficients(p.coefficients, [0.1, 0.2, 0.4, 0.2, 0.1]);
      }

      const y = applyFIR(x, b);
      signalMap.set(`${block.id}:out`, y);
      break;
    }

    case 'iir_filter': {
      const x = getInputSignal(block.id, 'in');
      let b: Float64Array;
      let a: Float64Array;

      if (p.designMode === 'designer') {
        const fc = parseFloat(p.cutoffFreq ?? 250);
        const q = parseFloat(p.qFactor ?? 0.7071);
        const coeffs = designBiquad(p.filterType || 'lowpass', fc, fs, q);
        b = coeffs.b;
        a = coeffs.a;
      } else {
        b = parseCoefficients(p.bCoeffs, [0.067, 0.135, 0.067]);
        a = parseCoefficients(p.aCoeffs, [1.0, -1.14, 0.41]);
      }

      const y = applyIIR(x, b, a);
      signalMap.set(`${block.id}:out`, y);
      break;
    }

    case 'discrete_tf': {
      const x = getInputSignal(block.id, 'in');
      const b = parseCoefficients(p.numStr, [0.2, 0.2]);
      const a = parseCoefficients(p.denStr, [1.0, -0.6]);
      const y = applyIIR(x, b, a);
      signalMap.set(`${block.id}:out`, y);
      break;
    }

    case 'continuous_tf': {
      const u = getInputSignal(block.id, 'in');
      const numS = Array.from(parseCoefficients(p.numStr, [10000]));
      const denS = Array.from(parseCoefficients(p.denStr, [1, 60, 10000]));

      // Convert H(s) to H(z) via Bilinear / Tustin transform
      const discrete = bilinearTransform(numS, denS, fs);
      const y = applyIIR(u, discrete.b, discrete.a);
      signalMap.set(`${block.id}:out`, y);
      break;
    }

    case 'unit_delay': {
      const x = getInputSignal(block.id, 'in');
      const k = Math.max(1, parseInt(p.samples ?? 1, 10));
      const initVal = parseFloat(p.initialCondition ?? 0);
      const out = new Float64Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        out[i] = i >= k ? x[i - k] : initVal;
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'moving_average': {
      const x = getInputSignal(block.id, 'in');
      const w = Math.max(1, parseInt(p.windowSize ?? 5, 10));
      const out = new Float64Array(sampleCount);

      let runningSum = 0;
      for (let i = 0; i < sampleCount; i++) {
        runningSum += x[i];
        if (i >= w) {
          runningSum -= x[i - w];
          out[i] = runningSum / w;
        } else {
          out[i] = runningSum / (i + 1);
        }
      }
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    // ---------------- MIXED SIGNAL ----------------
    case 'zoh': {
      const x = getInputSignal(block.id, 'in');
      const fHold = parseFloat(p.holdFrequency ?? 200);
      const out = applyZOH(x, fs, fHold);
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    case 'adc': {
      const x = getInputSignal(block.id, 'in');
      const bits = parseInt(p.bits ?? 4, 10);
      const vRef = parseFloat(p.vRef ?? 1.0);
      const mode = p.mode || 'mid-tread';
      const signed = p.signed !== false;

      const res = quantizeSignal(x, { bits, vRef, mode, signed });
      signalMap.set(`${block.id}:out`, res.quantized);
      signalMap.set(`${block.id}:err`, res.error);
      break;
    }

    case 'dac': {
      const dIn = getInputSignal(block.id, 'in');
      const method = p.method || 'smooth';
      const cutoff = parseFloat(p.smoothingCutoff ?? 300);
      const out = reconstructDAC(dIn, fs, method, cutoff);
      signalMap.set(`${block.id}:out`, out);
      break;
    }

    // ---------------- SINKS ----------------
    case 'scope':
    case 'spectrum':
    case 'audio_sink':
    case 'xy_graph':
    case 'display':
      // Sinks don't produce outputs, but consume inputs stored in signalMap
      break;

    default:
      console.warn(`Tipo de bloque no reconocido: ${block.type}`);
  }
}
