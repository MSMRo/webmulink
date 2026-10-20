import { BlockDefinition } from '../types';

export const BLOCK_DEFINITIONS: Record<string, BlockDefinition> = {
  // ================= SOURCES =================
  sine_source: {
    type: 'sine_source',
    name: 'Generador Senoidal',
    category: 'sources',
    description: 'Genera una señal senoidal continua/discreta x(t) = A·sin(2πft + φ) + Offset',
    symbol: 'sin(ωt)',
    color: '#0284c7',
    inputs: [],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      frequency: 50, // Hz
      amplitude: 1.0,
      phase: 0, // degrees
      offset: 0,
    },
  },
  square_source: {
    type: 'square_source',
    name: 'Onda Cuadrada',
    category: 'sources',
    description: 'Genera una onda cuadrada periódica con ciclo de trabajo configurable',
    symbol: '⎍',
    color: '#0284c7',
    inputs: [],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      frequency: 20, // Hz
      amplitude: 1.0,
      dutyCycle: 50, // %
      offset: 0,
    },
  },
  triangle_source: {
    type: 'triangle_source',
    name: 'Onda Triangular / Rampa',
    category: 'sources',
    description: 'Genera una onda triangular o diente de sierra periódica',
    symbol: '▲',
    color: '#0284c7',
    inputs: [],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      frequency: 20, // Hz
      amplitude: 1.0,
      type: 'triangle', // 'triangle' | 'sawtooth'
      offset: 0,
    },
  },
  noise_source: {
    type: 'noise_source',
    name: 'Ruido Blanco Gaussiano',
    category: 'sources',
    description: 'Genera ruido aleatorio con distribución normal (Gaussiana) o uniforme',
    symbol: '〰',
    color: '#0284c7',
    inputs: [],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      amplitude: 0.5,
      distribution: 'gaussian', // 'gaussian' | 'uniform'
      seed: 42,
    },
  },
  step_source: {
    type: 'step_source',
    name: 'Escalón Unitario u(t)',
    category: 'sources',
    description: 'Genera un cambio de escalón en el instante de tiempo t = Step Time',
    symbol: '⌐',
    color: '#0284c7',
    inputs: [],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      stepTime: 0.1, // seconds
      initialValue: 0.0,
      finalValue: 1.0,
    },
  },
  impulse_source: {
    type: 'impulse_source',
    name: 'Impulso δ(t)',
    category: 'sources',
    description: 'Genera un impulso de Dirac / Kronecker en t = Impulse Time',
    symbol: '↑',
    color: '#0284c7',
    inputs: [],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      impulseTime: 0.05, // seconds
      amplitude: 1.0,
    },
  },
  constant_source: {
    type: 'constant_source',
    name: 'Constante',
    category: 'sources',
    description: 'Genera un valor constante continuo en el tiempo',
    symbol: 'K',
    color: '#0284c7',
    inputs: [],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      value: 1.0,
    },
  },
  wav_source: {
    type: 'wav_source',
    name: 'Fuente Archivo WAV',
    category: 'sources',
    description: 'Carga un archivo de audio WAV/MP3 real y alimenta su señal al sistema',
    symbol: '♫ .WAV',
    color: '#0284c7',
    inputs: [],
    outputs: [{ id: 'out', name: 'audio', type: 'output', index: 0 }],
    defaultParams: {
      fileName: '',
      audioData: null, // Float64Array
      sampleRate: 44100,
      gain: 1.0,
      loop: false,
    },
  },

  // ================= MATH & OPERATIONS =================
  gain: {
    type: 'gain',
    name: 'Ganancia (K)',
    category: 'math',
    description: 'Multiplica la señal de entrada por un factor escalar K: y(t) = K·u(t)',
    symbol: '▷ K',
    color: '#10b981',
    inputs: [{ id: 'in', name: 'u', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      gain: 2.0,
    },
  },
  sum: {
    type: 'sum',
    name: 'Sumador / Restador',
    category: 'math',
    description: 'Suma o resta señales de entrada según los signos configurados (+ o -)',
    symbol: 'Σ',
    color: '#10b981',
    inputs: [
      { id: 'in1', name: 'u1', type: 'input', index: 0 },
      { id: 'in2', name: 'u2', type: 'input', index: 1 },
    ],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      signs: '++', // '++' or '+-' or '+++' or '+--'
    },
  },
  product: {
    type: 'product',
    name: 'Multiplicador',
    category: 'math',
    description: 'Multiplica punto a punto dos señales de entrada: y(t) = u1(t) · u2(t)',
    symbol: '✕',
    color: '#10b981',
    inputs: [
      { id: 'in1', name: 'u1', type: 'input', index: 0 },
      { id: 'in2', name: 'u2', type: 'input', index: 1 },
    ],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {},
  },
  math_func: {
    type: 'math_func',
    name: 'Función Matemática',
    category: 'math',
    description: 'Aplica una función matemática (Abs, Exp, Log, Sqrt, Sin, Cos, Pow)',
    symbol: 'f(u)',
    color: '#10b981',
    inputs: [{ id: 'in', name: 'u', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      func: 'abs', // 'abs' | 'exp' | 'log' | 'sqrt' | 'square' | 'sin' | 'cos'
    },
  },
  derivative: {
    type: 'derivative',
    name: 'Derivada du/dt',
    category: 'math',
    description: 'Calcula la derivada numérica temporal de la señal de entrada: du/dt',
    symbol: 'd/dt',
    color: '#10b981',
    inputs: [{ id: 'in', name: 'u', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'du/dt', type: 'output', index: 0 }],
    defaultParams: {},
  },
  integrator: {
    type: 'integrator',
    name: 'Integrador ∫',
    category: 'math',
    description: 'Calcula la integral numérica temporal con condición inicial: y(t) = ∫u dt + y0',
    symbol: '1/s ∫',
    color: '#10b981',
    inputs: [{ id: 'in', name: 'u', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      initialCondition: 0.0,
    },
  },

  // ================= DSP & FILTERS =================
  fir_filter: {
    type: 'fir_filter',
    name: 'Filtro FIR',
    category: 'dsp',
    description: 'Filtro de Respuesta al Impulso Finita con coeficientes b directos o diseñador',
    symbol: 'FIR [b]',
    color: '#8b5cf6',
    inputs: [{ id: 'in', name: 'x', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      designMode: 'manual', // 'manual' | 'designer'
      // Manual coefficients: e.g. [0.1, 0.2, 0.4, 0.2, 0.1]
      coefficients: [0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05],
      // Designer mode params:
      filterType: 'lowpass', // 'lowpass' | 'highpass' | 'bandpass' | 'bandstop'
      cutoffFreq: 200, // Hz
      cutoffFreq2: 800, // Hz (for bandpass/bandstop)
      order: 32,
      window: 'hamming', // 'rect' | 'hann' | 'hamming' | 'blackman'
    },
  },
  iir_filter: {
    type: 'iir_filter',
    name: 'Filtro IIR',
    category: 'dsp',
    description: 'Filtro de Respuesta al Impulso Infinita con coeficientes b y a (o Biquad/Butterworth)',
    symbol: 'IIR [b,a]',
    color: '#8b5cf6',
    inputs: [{ id: 'in', name: 'x', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y', type: 'output', index: 0 }],
    defaultParams: {
      designMode: 'designer', // 'manual' | 'designer'
      // Manual:
      bCoeffs: [0.067455, 0.134911, 0.067455],
      aCoeffs: [1.0, -1.14298, 0.412802],
      // Designer:
      filterType: 'lowpass', // 'lowpass' | 'highpass' | 'bandpass' | 'notch'
      cutoffFreq: 250, // Hz
      qFactor: 0.7071, // Butterworth Q
    },
  },
  discrete_tf: {
    type: 'discrete_tf',
    name: 'Función de Transferencia H(z)',
    category: 'dsp',
    description: 'Sistema discreto LTI H(z) = (b0 + b1·z⁻¹ + ...) / (a0 + a1·z⁻¹ + ...)',
    symbol: 'H(z)',
    color: '#8b5cf6',
    inputs: [{ id: 'in', name: 'x[n]', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y[n]', type: 'output', index: 0 }],
    defaultParams: {
      numStr: '0.2, 0.2', // b0 + b1 z^-1
      denStr: '1.0, -0.6', // a0 + a1 z^-1
    },
  },
  unit_delay: {
    type: 'unit_delay',
    name: 'Retardo Unitario (z⁻¹)',
    category: 'dsp',
    description: 'Retarda la señal en 1 o k muestras discretas: y[n] = x[n - k]',
    symbol: 'z⁻¹',
    color: '#8b5cf6',
    inputs: [{ id: 'in', name: 'x[n]', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y[n]', type: 'output', index: 0 }],
    defaultParams: {
      samples: 1, // integer delay
      initialCondition: 0.0,
    },
  },
  moving_average: {
    type: 'moving_average',
    name: 'Media Móvil (Moving Avg)',
    category: 'dsp',
    description: 'Filtro suavizador de promedio móvil de N puntos: y[n] = (1/N)·Σ x[n-k]',
    symbol: 'MA(N)',
    color: '#8b5cf6',
    inputs: [{ id: 'in', name: 'x[n]', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y[n]', type: 'output', index: 0 }],
    defaultParams: {
      windowSize: 5,
    },
  },

  // ================= MIXED-SIGNAL (ADC, DAC, ZOH) =================
  zoh: {
    type: 'zoh',
    name: 'Retenedor de Orden Cero (ZOH)',
    category: 'mixed_signal',
    description: 'Muestrea la señal continua a frecuencia Fs_hold y mantiene el valor constante',
    symbol: 'ZOH',
    color: '#f59e0b',
    inputs: [{ id: 'in', name: 'x(t)', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'x_zoh', type: 'output', index: 0 }],
    defaultParams: {
      holdFrequency: 200, // Hz (Muestreo a menor tasa para ver escalones y aliasing)
    },
  },
  adc: {
    type: 'adc',
    name: 'Convertidor A/D (ADC & Cuantizador)',
    category: 'mixed_signal',
    description: 'Cuantiza en N bits con rango ±Vref. Produce señal digitalizada y error de cuantización',
    symbol: 'ADC (N-bit)',
    color: '#f59e0b',
    inputs: [{ id: 'in', name: 'x(t)', type: 'input', index: 0 }],
    outputs: [
      { id: 'out', name: 'D_out', type: 'output', index: 0 },
      { id: 'err', name: 'e[n]', type: 'output', index: 1 },
    ],
    defaultParams: {
      bits: 4, // 2 to 24 bits
      vRef: 1.0, // ± 1.0 V
      mode: 'mid-tread', // 'mid-tread' | 'mid-riser' | 'floor'
      signed: true,
    },
  },
  dac: {
    type: 'dac',
    name: 'Convertidor D/A (DAC & Reconstructor)',
    category: 'mixed_signal',
    description: 'Reconstruye señal analógica continua a partir de muestras digitales (ZOH / FOH / Filtro)',
    symbol: 'DAC',
    color: '#f59e0b',
    inputs: [{ id: 'in', name: 'D_in', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'x_rec(t)', type: 'output', index: 0 }],
    defaultParams: {
      method: 'smooth', // 'zoh' | 'foh' | 'smooth'
      smoothingCutoff: 300, // Hz
    },
  },

  // ================= CONTINUOUS SYSTEMS =================
  continuous_tf: {
    type: 'continuous_tf',
    name: 'Función de Transferencia H(s)',
    category: 'continuous',
    description: 'Sistema LTI Continuo H(s) = (bm·sᵐ + ... + b0) / (an·sⁿ + ... + a0) vía Tustin',
    symbol: 'H(s)',
    color: '#ec4899',
    inputs: [{ id: 'in', name: 'u(t)', type: 'input', index: 0 }],
    outputs: [{ id: 'out', name: 'y(t)', type: 'output', index: 0 }],
    defaultParams: {
      // Example 2nd-order underdamped: wn^2 / (s^2 + 2*zeta*wn*s + wn^2)
      // wn = 100 rad/s -> wn^2 = 10000; 2*0.3*100 = 60
      numStr: '10000',
      denStr: '1, 60, 10000',
    },
  },

  // ================= SINKS & VISUALIZERS =================
  scope: {
    type: 'scope',
    name: 'Osciloscopio (Dominio Tiempo)',
    category: 'sinks',
    description: 'Visualiza la evolución temporal de hasta 4 señales con zoom, cursores y métricas',
    symbol: '📊 Scope (t)',
    color: '#06b6d4',
    inputs: [
      { id: 'ch1', name: 'CH 1', type: 'input', index: 0 },
      { id: 'ch2', name: 'CH 2', type: 'input', index: 1 },
      { id: 'ch3', name: 'CH 3', type: 'input', index: 2 },
      { id: 'ch4', name: 'CH 4', type: 'input', index: 3 },
    ],
    outputs: [],
    defaultParams: {
      title: 'Osciloscopio',
      timeScale: 'auto',
      yMin: -2.0,
      yMax: 2.0,
      showGrid: true,
    },
  },
  spectrum: {
    type: 'spectrum',
    name: 'Analizador de Espectro (FFT)',
    category: 'sinks',
    description: 'Calcula el espectro en frecuencia |X(f)| (dB y lineal) mediante FFT de alta resolución',
    symbol: '📈 FFT (f)',
    color: '#06b6d4',
    inputs: [
      { id: 'in1', name: 'CH 1', type: 'input', index: 0 },
      { id: 'in2', name: 'CH 2', type: 'input', index: 1 },
    ],
    outputs: [],
    defaultParams: {
      title: 'Analizador de Espectro',
      scale: 'db', // 'db' | 'linear'
      window: 'hann', // 'rect' | 'hann' | 'hamming' | 'blackman'
      fftSize: 2048,
      freqScale: 'linear', // 'linear' | 'log'
      maxFreq: 0, // 0 = Nyquist (fs/2)
    },
  },
  audio_sink: {
    type: 'audio_sink',
    name: 'Reproductor de Audio (Parlantes)',
    category: 'sinks',
    description: 'Permite escuchar la señal de salida directamente a través del audio del navegador',
    symbol: '🔊 Audio Out',
    color: '#06b6d4',
    inputs: [{ id: 'in', name: 'audio', type: 'input', index: 0 }],
    outputs: [],
    defaultParams: {
      volume: 0.8,
      loop: false,
    },
  },
  xy_graph: {
    type: 'xy_graph',
    name: 'Gráfico X-Y (Lissajous)',
    category: 'sinks',
    description: 'Grafica la señal Y en función de la señal X en el plano de fase',
    symbol: '☍ Lissajous',
    color: '#06b6d4',
    inputs: [
      { id: 'x', name: 'X(t)', type: 'input', index: 0 },
      { id: 'y', name: 'Y(t)', type: 'input', index: 1 },
    ],
    outputs: [],
    defaultParams: {},
  },
  display: {
    type: 'display',
    name: 'Display Numérico',
    category: 'sinks',
    description: 'Muestra valores numéricos instantáneos, valor medio, RMS y pico',
    symbol: '[ 0.00 ]',
    color: '#06b6d4',
    inputs: [{ id: 'in', name: 'u', type: 'input', index: 0 }],
    outputs: [],
    defaultParams: {
      metric: 'rms', // 'instant' | 'rms' | 'peak' | 'mean'
    },
  },
};
