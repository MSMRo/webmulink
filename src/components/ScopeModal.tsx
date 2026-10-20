import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BlockInstance, Connection, SimulationResult } from '../types';
import { computeSpectrum, WindowType } from '../dsp/fft';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Eye,
  EyeOff,
  Radio,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Crosshair,
  Sparkles,
} from 'lucide-react';

interface ScopeModalProps {
  block: BlockInstance;
  isOpen: boolean;
  onClose: () => void;
  connections: Connection[];
  blocks: BlockInstance[];
  simulationResult: SimulationResult | null;
}

const CHANNEL_COLORS = ['#facc15', '#38bdf8', '#e879f9', '#4ade80'];

export const ScopeModal: React.FC<ScopeModalProps> = ({
  block,
  isOpen,
  onClose,
  connections,
  blocks,
  simulationResult,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isSpectrum = block.type === 'spectrum';

  // Sampling and duration
  const fs = simulationResult?.fs || 1000;
  const nyquist = fs / 2;
  const totalDuration = simulationResult?.duration || 1.0;

  // ================= FFT Spectrum Zoom State =================
  const [freqRange, setFreqRange] = useState<{ min: number; max: number } | null>(null);
  const [magRange, setMagRange] = useState<{ min: number; max: number } | null>(null);
  const [showCustomFreqInputs, setShowCustomFreqInputs] = useState(false);
  const [customFMin, setCustomFMin] = useState<string>('0');
  const [customFMax, setCustomFMax] = useState<string>('100');

  // Spectrum computation options
  const [scaleMode, setScaleMode] = useState<'db' | 'linear'>('db');
  const [windowType, setWindowType] = useState<WindowType>('hann');
  const [fftSize, setFftSize] = useState<number>(2048);

  // ================= Time Scope Zoom & Pan State =================
  const [timeZoom, setTimeZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState(0); // 0 to 1
  const [yRange, setYRange] = useState<{ min: number; max: number } | null>(null);

  // Active channel visibility
  const [visibleChannels, setVisibleChannels] = useState<boolean[]>([true, true, true, true]);

  // ================= Interactive Mouse Selection & Cursor =================
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number; xVal: number; yVal: number } | null>(null);

  // Frequency range effective bounds
  const activeFMin = freqRange ? Math.max(0, freqRange.min) : 0;
  const activeFMax = freqRange ? Math.min(nyquist, freqRange.max) : nyquist;
  const freqSpan = Math.max(0.1, activeFMax - activeFMin);

  // Magnitude range effective bounds
  const isDb = scaleMode === 'db';
  const defaultMinMag = isDb ? -100 : 0;
  const defaultMaxMag = isDb ? 10 : 2.0;
  const activeMinMag = magRange ? magRange.min : defaultMinMag;
  const activeMaxMag = magRange ? magRange.max : defaultMaxMag;
  const magSpan = Math.max(0.1, activeMaxMag - activeMinMag);

  // Time window effective bounds
  const windowDuration = totalDuration / timeZoom;
  const startT = panOffset * Math.max(0, totalDuration - windowDuration);
  const endT = startT + windowDuration;

  // Voltage range effective bounds
  const defaultYMin = parseFloat(block.params.yMin ?? -2.0);
  const defaultYMax = parseFloat(block.params.yMax ?? 2.0);
  const activeYMin = yRange ? yRange.min : defaultYMin;
  const activeYMax = yRange ? yRange.max : defaultYMax;
  const ySpan = Math.max(0.001, activeYMax - activeYMin);

  // Sync custom inputs with active range
  useEffect(() => {
    setCustomFMin(activeFMin.toFixed(0));
    setCustomFMax(activeFMax.toFixed(0));
  }, [activeFMin, activeFMax]);

  // Resolve input signals connected to this block's input ports
  const channelData = useMemo(() => {
    if (!simulationResult) return [];

    const ports = block.inputs;
    return ports.map((port, idx) => {
      const conn = connections.find((c) => c.toBlockId === block.id && c.toPortId === port.id);
      let signal: Float64Array | null = null;
      let label = port.name;

      if (conn) {
        const fromBlock = blocks.find((b) => b.id === conn.fromBlockId);
        const sigKey = `${conn.fromBlockId}:${conn.fromPortId}`;
        signal = simulationResult.signals.get(sigKey) || null;
        if (fromBlock) {
          label = `${port.name}: ${fromBlock.title || fromBlock.type}`;
        }
      }

      return {
        portId: port.id,
        name: label,
        color: CHANNEL_COLORS[idx % CHANNEL_COLORS.length],
        signal,
      };
    });
  }, [block, connections, blocks, simulationResult]);

  // Compute signal statistics for table
  const signalMetrics = useMemo(() => {
    return channelData.map((ch) => {
      if (!ch.signal || ch.signal.length === 0) return null;
      const s = ch.signal;
      let min = Infinity,
        max = -Infinity,
        sum = 0,
        sumSq = 0;
      for (let i = 0; i < s.length; i++) {
        const v = s[i];
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        sumSq += v * v;
      }
      const mean = sum / s.length;
      const rms = Math.sqrt(sumSq / s.length);
      const vpp = max - min;

      // Estimate frequency via zero crossings
      let zeroCrossings = 0;
      for (let i = 1; i < s.length; i++) {
        if ((s[i] >= mean && s[i - 1] < mean) || (s[i] < mean && s[i - 1] >= mean)) {
          zeroCrossings++;
        }
      }
      const duration = simulationResult?.duration || 1;
      const estFreq = zeroCrossings / 2 / duration;

      return { min, max, mean, rms, vpp, estFreq };
    });
  }, [channelData, simulationResult]);

  // Compute FFT spectra if spectrum analyzer
  const spectra = useMemo(() => {
    if (!isSpectrum || !simulationResult) return [];
    return channelData.map((ch) => {
      if (!ch.signal || ch.signal.length === 0) return null;
      return computeSpectrum(ch.signal, simulationResult.fs, fftSize, windowType);
    });
  }, [isSpectrum, channelData, simulationResult, fftSize, windowType]);

  // Generate adaptive frequency range presets
  const freqPresets = useMemo(() => {
    if (nyquist <= 100) {
      return [
        { label: 'Todo', min: 0, max: nyquist },
        { label: '0 - 10 Hz', min: 0, max: 10 },
        { label: '0 - 25 Hz', min: 0, max: 25 },
        { label: '0 - 50 Hz', min: 0, max: 50 },
      ];
    } else if (nyquist <= 500) {
      return [
        { label: `Todo (${nyquist} Hz)`, min: 0, max: nyquist },
        { label: '0 - 25 Hz', min: 0, max: 25 },
        { label: '0 - 50 Hz', min: 0, max: 50 },
        { label: '0 - 100 Hz', min: 0, max: 100 },
        { label: '0 - 250 Hz', min: 0, max: 250 },
      ];
    } else if (nyquist <= 2000) {
      return [
        { label: `Todo (${nyquist} Hz)`, min: 0, max: nyquist },
        { label: '0 - 50 Hz', min: 0, max: 50 },
        { label: '0 - 100 Hz', min: 0, max: 100 },
        { label: '0 - 250 Hz', min: 0, max: 250 },
        { label: '0 - 500 Hz', min: 0, max: 500 },
        { label: '0 - 1000 Hz', min: 0, max: 1000 },
      ];
    } else {
      return [
        { label: `Todo (${(nyquist / 1000).toFixed(1)}k)`, min: 0, max: nyquist },
        { label: '0 - 200 Hz', min: 0, max: 200 },
        { label: '0 - 1 kHz', min: 0, max: 1000 },
        { label: '0 - 4 kHz', min: 0, max: 4000 },
        { label: '0 - 10 kHz', min: 0, max: 10000 },
      ];
    }
  }, [nyquist]);

  // Generate adaptive time range presets
  const timePresets = useMemo(() => {
    const durMs = totalDuration * 1000;
    const presets = [{ label: 'Todo (1x)', zoom: 1.0, pan: 0 }];
    if (durMs >= 100) presets.push({ label: '50 ms', zoom: Math.min(50, durMs / 50), pan: 0 });
    if (durMs >= 200) presets.push({ label: '100 ms', zoom: Math.min(50, durMs / 100), pan: 0 });
    if (durMs >= 500) presets.push({ label: '250 ms', zoom: Math.min(50, durMs / 250), pan: 0 });
    if (durMs >= 1000) presets.push({ label: '500 ms', zoom: Math.min(50, durMs / 500), pan: 0 });
    if (durMs >= 2000) presets.push({ label: '1.0 s', zoom: Math.min(50, durMs / 1000), pan: 0 });
    return presets;
  }, [totalDuration]);

  // Coordinate helper: Canvas CSS space to internal buffer coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return { x, y };
  };

  // Zoom to a specific detected peak harmonic
  const handleZoomToPeak = (peakFreq: number) => {
    const span = Math.max(10, Math.min(60, nyquist * 0.15));
    const min = Math.max(0, peakFreq - span / 2);
    const max = Math.min(nyquist, min + span);
    setFreqRange({
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
    });
  };

  // Step zoom in frequency
  const handleFreqZoomIn = () => {
    const center = (activeFMin + activeFMax) / 2;
    const newSpan = freqSpan / 1.5;
    if (newSpan < 1) return;
    const min = Math.max(0, center - newSpan / 2);
    const max = Math.min(nyquist, min + newSpan);
    setFreqRange({ min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 });
  };

  // Step zoom out frequency
  const handleFreqZoomOut = () => {
    const center = (activeFMin + activeFMax) / 2;
    const newSpan = freqSpan * 1.5;
    const min = Math.max(0, center - newSpan / 2);
    const max = Math.min(nyquist, min + newSpan);
    if (min === 0 && max >= nyquist) {
      setFreqRange(null);
    } else {
      setFreqRange({ min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 });
    }
  };

  // Pan frequency left
  const handleFreqPanLeft = () => {
    const shift = freqSpan * 0.25;
    const min = Math.max(0, activeFMin - shift);
    const max = min + freqSpan;
    setFreqRange({ min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 });
  };

  // Pan frequency right
  const handleFreqPanRight = () => {
    const shift = freqSpan * 0.25;
    const max = Math.min(nyquist, activeFMax + shift);
    const min = Math.max(0, max - freqSpan);
    setFreqRange({ min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 });
  };

  // Apply custom numerical range
  const handleApplyCustomRange = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const minVal = parseFloat(customFMin);
    const maxVal = parseFloat(customFMax);
    if (isNaN(minVal) || isNaN(maxVal) || maxVal <= minVal) return;
    setFreqRange({
      min: Math.max(0, Math.min(nyquist - 1, minVal)),
      max: Math.min(nyquist, Math.max(minVal + 1, maxVal)),
    });
  };

  // Auto-fit Magnitude (dB or V)
  const handleAutoFitMag = () => {
    let minM = Infinity;
    let maxM = -Infinity;
    spectra.forEach((spec, chIdx) => {
      if (!spec || !visibleChannels[chIdx]) return;
      const mags = isDb ? spec.magnitudeDb : spec.magnitude;
      for (let i = 0; i < spec.frequencies.length; i++) {
        const f = spec.frequencies[i];
        if (f >= activeFMin && f <= activeFMax) {
          const m = mags[i];
          if (m < minM) minM = m;
          if (m > maxM) maxM = m;
        }
      }
    });

    if (minM !== Infinity && maxM !== -Infinity) {
      if (isDb) {
        setMagRange({
          min: Math.floor(Math.max(-130, minM - 6)),
          max: Math.ceil(maxM + 6),
        });
      } else {
        setMagRange({
          min: 0,
          max: Math.max(0.1, Math.ceil(maxM * 1.15 * 10) / 10),
        });
      }
    }
  };

  // Auto-fit Voltage (Oscilloscope)
  const handleAutoFitVoltage = () => {
    let minV = Infinity;
    let maxV = -Infinity;
    const time = simulationResult?.time;
    if (!time) return;

    channelData.forEach((ch, chIdx) => {
      if (!ch.signal || !visibleChannels[chIdx]) return;
      for (let i = 0; i < ch.signal.length; i++) {
        const t = time[i];
        if (t >= startT && t <= endT) {
          const v = ch.signal[i];
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
    });

    if (minV !== Infinity && maxV !== -Infinity) {
      const pad = Math.max(0.1, (maxV - minV) * 0.1);
      setYRange({
        min: Math.floor((minV - pad) * 10) / 10,
        max: Math.ceil((maxV + pad) * 10) / 10,
      });
    }
  };

  // Reset all zoom states
  const handleResetZoom = () => {
    setFreqRange(null);
    setMagRange(null);
    setTimeZoom(1.0);
    setPanOffset(0);
    setYRange(null);
  };

  // ================= MOUSE DRAG & SELECTION HANDLERS =================
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const padding = { left: 60, right: 25, top: 25, bottom: 35 };
    const plotW = canvasRef.current!.width - padding.left - padding.right;
    const plotH = canvasRef.current!.height - padding.top - padding.bottom;

    if (
      coords.x >= padding.left &&
      coords.x <= padding.left + plotW &&
      coords.y >= padding.top &&
      coords.y <= padding.top + plotH
    ) {
      setIsDragging(true);
      setDragStart(coords);
      setDragCurrent(coords);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const padding = { left: 60, right: 25, top: 25, bottom: 35 };
    const plotW = canvasRef.current!.width - padding.left - padding.right;
    const plotH = canvasRef.current!.height - padding.top - padding.bottom;

    if (isDragging) {
      setDragCurrent(coords);
    }

    if (
      coords.x >= padding.left &&
      coords.x <= padding.left + plotW &&
      coords.y >= padding.top &&
      coords.y <= padding.top + plotH
    ) {
      if (isSpectrum) {
        const fVal = activeFMin + ((coords.x - padding.left) / plotW) * freqSpan;
        const mVal = activeMaxMag - ((coords.y - padding.top) / plotH) * magSpan;
        setHoverPos({ x: coords.x, y: coords.y, xVal: fVal, yVal: mVal });
      } else {
        const tVal = startT + ((coords.x - padding.left) / plotW) * windowDuration;
        const vVal = activeYMax - ((coords.y - padding.top) / plotH) * ySpan;
        setHoverPos({ x: coords.x, y: coords.y, xVal: tVal, yVal: vVal });
      }
    } else {
      setHoverPos(null);
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const padding = { left: 60, right: 25, top: 25, bottom: 35 };
    const plotW = canvasRef.current!.width - padding.left - padding.right;
    const plotH = canvasRef.current!.height - padding.top - padding.bottom;

    const x1 = Math.max(padding.left, Math.min(dragStart.x, dragCurrent.x));
    const x2 = Math.min(padding.left + plotW, Math.max(dragStart.x, dragCurrent.x));
    const y1 = Math.max(padding.top, Math.min(dragStart.y, dragCurrent.y));
    const y2 = Math.min(padding.top + plotH, Math.max(dragStart.y, dragCurrent.y));

    const deltaX = x2 - x1;
    const deltaY = y2 - y1;

    if (deltaX > 8) {
      if (isSpectrum) {
        const f1 = activeFMin + ((x1 - padding.left) / plotW) * freqSpan;
        const f2 = activeFMin + ((x2 - padding.left) / plotW) * freqSpan;
        if (f2 - f1 >= 0.5) {
          setFreqRange({
            min: Math.max(0, Math.round(f1 * 10) / 10),
            max: Math.min(nyquist, Math.round(f2 * 10) / 10),
          });
        }
        if (deltaY > 20) {
          const mHigh = activeMaxMag - ((y1 - padding.top) / plotH) * magSpan;
          const mLow = activeMaxMag - ((y2 - padding.top) / plotH) * magSpan;
          if (mHigh - mLow >= 3) {
            setMagRange({ min: Math.round(mLow), max: Math.round(mHigh) });
          }
        }
      } else {
        const t1 = startT + ((x1 - padding.left) / plotW) * windowDuration;
        const t2 = startT + ((x2 - padding.left) / plotW) * windowDuration;
        const newDuration = Math.max(1 / fs, t2 - t1);
        const newZoom = Math.min(50, totalDuration / newDuration);
        setTimeZoom(newZoom);
        const maxOffsetT = Math.max(0, totalDuration - newDuration);
        if (maxOffsetT > 0) {
          setPanOffset(Math.max(0, Math.min(1, t1 / maxOffsetT)));
        }
        if (deltaY > 20) {
          const vHigh = activeYMax - ((y1 - padding.top) / plotH) * ySpan;
          const vLow = activeYMax - ((y2 - padding.top) / plotH) * ySpan;
          if (vHigh - vLow >= 0.01) {
            setYRange({ min: Math.round(vLow * 100) / 100, max: Math.round(vHigh * 100) / 100 });
          }
        }
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const handleCanvasDoubleClick = () => {
    handleResetZoom();
  };

  // ================= CANVAS DRAWING EFFECT =================
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark sleek oscilloscope display background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const padding = { left: 60, right: 25, top: 25, bottom: 35 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    if (!simulationResult || channelData.every((c) => !c.signal)) {
      ctx.fillStyle = '#475569';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No hay señales conectadas o la simulación no ha sido ejecutada.', w / 2, h / 2);
      ctx.fillText('Conecta un bloque generador o pulsa "Ejecutar"', w / 2, h / 2 + 20);
      return;
    }

    // Grid styling
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    if (isSpectrum) {
      // ================= SPECTRUM ANALYZER DRAW =================
      const numFreqDivs = 8;
      for (let i = 0; i <= numFreqDivs; i++) {
        const x = padding.left + (i / numFreqDivs) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotH);
        ctx.stroke();

        const freqVal = activeFMin + (i / numFreqDivs) * freqSpan;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        let label = '';
        if (freqSpan < 10) {
          label = `${freqVal.toFixed(2)}`;
        } else if (freqVal >= 1000) {
          label = `${(freqVal / 1000).toFixed(1)}k`;
        } else {
          label = `${freqVal.toFixed(0)}`;
        }
        ctx.fillText(label, x, h - 15);
      }
      ctx.fillText('Frecuencia (Hz)', padding.left + plotW / 2, h - 3);

      // Horizontal Magnitude Grid Lines
      const numMagDivs = 6;
      for (let i = 0; i <= numMagDivs; i++) {
        const y = padding.top + (i / numMagDivs) * plotH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotW, y);
        ctx.stroke();

        const magVal = activeMaxMag - (i / numMagDivs) * magSpan;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(isDb ? `${magVal.toFixed(0)} dB` : `${magVal.toFixed(2)} V`, padding.left - 6, y + 3);
      }

      // Draw Spectrum Traces inside clipped region
      ctx.save();
      ctx.beginPath();
      ctx.rect(padding.left, padding.top, plotW, plotH);
      ctx.clip();

      spectra.forEach((spec, chIdx) => {
        if (!spec || !visibleChannels[chIdx]) return;
        const color = channelData[chIdx].color;
        const mags = isDb ? spec.magnitudeDb : spec.magnitude;
        const numBins = spec.frequencies.length;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let started = false;
        for (let i = 0; i < numBins; i++) {
          const f = spec.frequencies[i];
          if (f < activeFMin - (freqSpan * 0.05) || f > activeFMax + (freqSpan * 0.05)) continue;

          const m = mags[i];
          const x = padding.left + ((f - activeFMin) / freqSpan) * plotW;
          const yNorm = (m - activeMinMag) / magSpan;
          const y = padding.top + plotH * (1 - Math.max(0, Math.min(1, yNorm)));

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Draw Peak Markers with anti-collision badges
        spec.peaks.forEach((peak) => {
          if (peak.frequency < activeFMin || peak.frequency > activeFMax) return;
          const x = padding.left + ((peak.frequency - activeFMin) / freqSpan) * plotW;
          const yNorm = (peak.magnitudeDb - activeMinMag) / magSpan;
          const y = padding.top + plotH * (1 - Math.max(0, Math.min(1, yNorm)));

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();

          // Pill badge for frequency label
          const peakText = `${peak.frequency.toFixed(1)}Hz`;
          ctx.font = 'bold 9px monospace';
          const textW = ctx.measureText(peakText).width;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(x - textW / 2 - 3, y - 18, textW + 6, 12);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(x - textW / 2 - 3, y - 18, textW + 6, 12);

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(peakText, x, y - 9);
        });
      });

      ctx.restore();
    } else {
      // ================= TIME OSCILLOSCOPE DRAW =================
      const time = simulationResult.time;

      // Horizontal Time Grid Lines
      const numTimeDivs = 10;
      for (let i = 0; i <= numTimeDivs; i++) {
        const x = padding.left + (i / numTimeDivs) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotH);
        ctx.stroke();

        const tVal = startT + (i / numTimeDivs) * windowDuration;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          tVal >= 1 ? `${tVal.toFixed(2)}s` : `${(tVal * 1000).toFixed(1)}ms`,
          x,
          h - 15
        );
      }
      ctx.fillText('Tiempo (t)', padding.left + plotW / 2, h - 3);

      // Vertical Voltage Grid Lines
      const numVoltDivs = 8;
      for (let i = 0; i <= numVoltDivs; i++) {
        const y = padding.top + (i / numVoltDivs) * plotH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotW, y);
        ctx.stroke();

        const vVal = activeYMax - (i / numVoltDivs) * ySpan;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${vVal.toFixed(2)} V`, padding.left - 6, y + 3);
      }

      // Draw zero axis line
      if (activeYMin < 0 && activeYMax > 0) {
        const zeroY = padding.top + plotH * (1 - (0 - activeYMin) / ySpan);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(padding.left + plotW, zeroY);
        ctx.stroke();
      }

      // Draw Signal Waveforms inside clipped area
      ctx.save();
      ctx.beginPath();
      ctx.rect(padding.left, padding.top, plotW, plotH);
      ctx.clip();

      channelData.forEach((ch, chIdx) => {
        if (!ch.signal || !visibleChannels[chIdx]) return;
        const signal = ch.signal;
        const color = ch.color;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let started = false;
        const step = Math.max(1, Math.floor(signal.length / (plotW * 4)));

        for (let i = 0; i < signal.length; i += step) {
          const t = time[i];
          if (t < startT - 0.001 || t > endT + 0.001) continue;

          const x = padding.left + ((t - startT) / windowDuration) * plotW;
          const yNorm = (signal[i] - activeYMin) / ySpan;
          const y = padding.top + plotH * (1 - Math.max(0, Math.min(1, yNorm)));

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      ctx.restore();
    }

    // ================= CROSSHAIRS ON HOVER =================
    if (hoverPos && !isDragging) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical crosshair
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, padding.top);
      ctx.lineTo(hoverPos.x, padding.top + plotH);
      ctx.stroke();

      // Horizontal crosshair
      ctx.beginPath();
      ctx.moveTo(padding.left, hoverPos.y);
      ctx.lineTo(padding.left + plotW, hoverPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floating cursor readout HUD
      const cursorText = isSpectrum
        ? `f: ${hoverPos.xVal.toFixed(1)} Hz | Mag: ${hoverPos.yVal.toFixed(1)} ${isDb ? 'dB' : 'V'}`
        : `t: ${(hoverPos.xVal * 1000).toFixed(2)} ms | V: ${hoverPos.yVal.toFixed(2)} V`;

      ctx.font = 'bold 10px monospace';
      const textW = ctx.measureText(cursorText).width;
      const hudX = padding.left + plotW - textW - 14;
      const hudY = padding.top + 18;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(hudX, hudY - 12, textW + 10, 16);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.strokeRect(hudX, hudY - 12, textW + 10, 16);

      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText(cursorText, hudX + 5, hudY);
      ctx.restore();
    }

    // ================= MARQUEE / SELECTION BOX DRAW =================
    if (isDragging && dragStart && dragCurrent) {
      const x1 = Math.min(dragStart.x, dragCurrent.x);
      const x2 = Math.max(dragStart.x, dragCurrent.x);
      const y1 = Math.min(dragStart.y, dragCurrent.y);
      const y2 = Math.max(dragStart.y, dragCurrent.y);

      const boxX = Math.max(padding.left, x1);
      const boxY = Math.max(padding.top, y1);
      const boxW = Math.min(padding.left + plotW, x2) - boxX;
      const boxH = Math.min(padding.top + plotH, y2) - boxY;

      if (boxW > 2 && boxH > 2) {
        ctx.save();
        // Translucent fill
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // Dashed border
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.setLineDash([]);

        // Floating selection label
        let rangeLabel = '';
        if (isSpectrum) {
          const f1 = activeFMin + ((boxX - padding.left) / plotW) * freqSpan;
          const f2 = activeFMin + ((boxX + boxW - padding.left) / plotW) * freqSpan;
          rangeLabel = `Zoom: ${f1.toFixed(1)} Hz → ${f2.toFixed(1)} Hz (Δf: ${(f2 - f1).toFixed(1)} Hz)`;
        } else {
          const t1 = startT + ((boxX - padding.left) / plotW) * windowDuration;
          const t2 = startT + ((boxX + boxW - padding.left) / plotW) * windowDuration;
          rangeLabel = `Zoom: ${(t1 * 1000).toFixed(1)} ms → ${(t2 * 1000).toFixed(1)} ms (Δt: ${((t2 - t1) * 1000).toFixed(1)} ms)`;
        }

        ctx.font = 'bold 10px monospace';
        const labelW = ctx.measureText(rangeLabel).width;
        const badgeX = Math.max(padding.left, Math.min(padding.left + plotW - labelW - 12, boxX));
        const badgeY = Math.max(padding.top + 16, boxY - 6);

        ctx.fillStyle = '#0284c7';
        ctx.fillRect(badgeX, badgeY - 12, labelW + 10, 16);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(badgeX, badgeY - 12, labelW + 10, 16);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(rangeLabel, badgeX + 5, badgeY);
        ctx.restore();
      }
    }
  }, [
    isOpen,
    isSpectrum,
    simulationResult,
    channelData,
    spectra,
    timeZoom,
    panOffset,
    scaleMode,
    visibleChannels,
    activeFMin,
    activeFMax,
    freqSpan,
    activeMinMag,
    activeMaxMag,
    magSpan,
    startT,
    endT,
    windowDuration,
    activeYMin,
    activeYMax,
    ySpan,
    isDragging,
    dragStart,
    dragCurrent,
    hoverPos,
  ]);

  // Export Canvas to PNG Image
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${block.title || (isSpectrum ? 'espectro_fft' : 'osciloscopio')}_webmulink.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const toggleChannel = (idx: number) => {
    setVisibleChannels((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const isZoomed = isSpectrum
    ? freqRange !== null || magRange !== null
    : timeZoom > 1.0 || yRange !== null || panOffset > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-lg bg-sky-950 text-sky-400 border border-sky-800/80">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-sm text-white">
                  {block.title || (isSpectrum ? 'Analizador de Espectro (FFT)' : 'Osciloscopio')}
                </h2>
                {isZoomed && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    ZOOM ACTIVO
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {isSpectrum
                  ? `Dominio Frecuencia |X(f)| • Fs = ${fs} Hz • Visualizando: ${activeFMin.toFixed(1)} a ${activeFMax.toFixed(1)} Hz`
                  : `Dominio Tiempo x(t) • Fs = ${fs} Hz • Ventana: ${(startT * 1000).toFixed(1)} a ${(endT * 1000).toFixed(1)} ms`}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportPNG}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Descargar captura en PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar PNG</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar Row 1: Channels & Signal Modes */}
        <div className="px-5 py-2 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Channel Selector Chips */}
          <div className="flex items-center space-x-2">
            {channelData.map((ch, idx) => (
              <button
                key={ch.portId}
                onClick={() => toggleChannel(idx)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition ${
                  visibleChannels[idx]
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60'
                }`}
                style={{
                  borderColor: visibleChannels[idx] ? ch.color : undefined,
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                <span>{ch.name}</span>
                {visibleChannels[idx] ? (
                  <Eye className="w-3 h-3 text-slate-400" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>

          {/* Mode controls for Spectrum */}
          {isSpectrum && (
            <div className="flex items-center space-x-3 text-xs text-slate-300">
              {/* dB vs Linear */}
              <div className="flex rounded bg-slate-900 border border-slate-800 p-0.5">
                <button
                  onClick={() => {
                    setScaleMode('db');
                    setMagRange(null);
                  }}
                  className={`px-2 py-0.5 rounded font-mono ${
                    scaleMode === 'db' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  dB (Log)
                </button>
                <button
                  onClick={() => {
                    setScaleMode('linear');
                    setMagRange(null);
                  }}
                  className={`px-2 py-0.5 rounded font-mono ${
                    scaleMode === 'linear' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  Lineal (V)
                </button>
              </div>

              {/* Window */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Ventana:</span>
                <select
                  value={windowType}
                  onChange={(e) => setWindowType(e.target.value as WindowType)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sky-400 text-xs"
                >
                  <option value="hann">Hann</option>
                  <option value="hamming">Hamming</option>
                  <option value="blackman">Blackman</option>
                  <option value="rect">Rectangular</option>
                </select>
              </div>

              {/* FFT Size */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Puntos:</span>
                <select
                  value={fftSize}
                  onChange={(e) => setFftSize(parseInt(e.target.value, 10))}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sky-400 text-xs font-mono"
                >
                  <option value="1024">1024</option>
                  <option value="2048">2048</option>
                  <option value="4096">4096</option>
                  <option value="8192">8192</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar Row 2: DEDICATED ZOOM TO ESTABLISHED AREA BUTTONS */}
        <div className="px-5 py-2 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {isSpectrum ? (
            /* FFT Area Zoom Buttons */
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-slate-400 font-semibold flex items-center space-x-1 mr-1">
                <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                <span>Zoom Área:</span>
              </span>

              {/* Preset Frequency Area Buttons */}
              <div className="flex items-center space-x-1 bg-slate-900/90 p-0.5 rounded border border-slate-800">
                {freqPresets.map((preset, pIdx) => {
                  const isActive =
                    (preset.min === 0 &&
                      preset.max === nyquist &&
                      freqRange === null) ||
                    (freqRange !== null &&
                      Math.abs(activeFMin - preset.min) < 1 &&
                      Math.abs(activeFMax - preset.max) < 1);
                  return (
                    <button
                      key={pIdx}
                      onClick={() => {
                        if (preset.min === 0 && preset.max === nyquist) {
                          setFreqRange(null);
                        } else {
                          setFreqRange({ min: preset.min, max: preset.max });
                        }
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                        isActive
                          ? 'bg-sky-600 text-white font-bold shadow'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title={`Zoom directo al rango ${preset.min} - ${preset.max} Hz`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Step Zoom & Pan Buttons */}
              <div className="flex items-center space-x-1 ml-1 bg-slate-900/90 p-0.5 rounded border border-slate-800">
                <button
                  onClick={handleFreqZoomIn}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Acercar frecuencia (Zoom +)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleFreqZoomOut}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Alejar frecuencia (Zoom -)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleFreqPanLeft}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Desplazar a la izquierda"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleFreqPanRight}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Desplazar a la derecha"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Auto-Fit Y Magnitude */}
              <button
                onClick={handleAutoFitMag}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                title="Ajustar escala vertical automáticamente a los picos visibles"
              >
                <Maximize2 className="w-3 h-3 text-emerald-400" />
                <span>Auto Y</span>
              </button>

              {/* Reset Zoom */}
              {isZoomed && (
                <button
                  onClick={handleResetZoom}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 transition"
                  title="Restablecer vista a rango completo (0 a Fs/2)"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer</span>
                </button>
              )}

              {/* Custom manual inputs toggle */}
              <button
                onClick={() => setShowCustomFreqInputs(!showCustomFreqInputs)}
                className={`flex items-center space-x-1 px-2 py-1 rounded border transition ${
                  showCustomFreqInputs
                    ? 'bg-sky-950 text-sky-400 border-sky-800'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Introducir rango numérico personalizado"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Manual</span>
              </button>

              {showCustomFreqInputs && (
                <form onSubmit={handleApplyCustomRange} className="flex items-center space-x-1.5 ml-1">
                  <span className="text-slate-500 font-mono text-[11px]">De:</span>
                  <input
                    type="number"
                    value={customFMin}
                    onChange={(e) => setCustomFMin(e.target.value)}
                    className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-sky-400 font-mono"
                  />
                  <span className="text-slate-500 font-mono text-[11px]">a:</span>
                  <input
                    type="number"
                    value={customFMax}
                    onChange={(e) => setCustomFMax(e.target.value)}
                    className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-sky-400 font-mono"
                  />
                  <span className="text-slate-500 font-mono text-[11px]">Hz</span>
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs"
                  >
                    OK
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Time Scope Area Zoom Buttons */
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-slate-400 font-semibold flex items-center space-x-1 mr-1">
                <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                <span>Zoom Tiempo:</span>
              </span>

              {/* Preset Time Area Buttons */}
              <div className="flex items-center space-x-1 bg-slate-900/90 p-0.5 rounded border border-slate-800">
                {timePresets.map((preset, pIdx) => {
                  const isActive =
                    Math.abs(timeZoom - preset.zoom) < 0.1 &&
                    Math.abs(panOffset - preset.pan) < 0.05;
                  return (
                    <button
                      key={pIdx}
                      onClick={() => {
                        setTimeZoom(preset.zoom);
                        setPanOffset(preset.pan);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                        isActive
                          ? 'bg-sky-600 text-white font-bold shadow'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title={`Visualizar ventana de ${preset.label}`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Step Zoom */}
              <div className="flex items-center space-x-1 ml-1 bg-slate-900/90 p-0.5 rounded border border-slate-800">
                <button
                  onClick={() => setTimeZoom((z) => Math.min(z * 1.5, 40))}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Acercar tiempo (Zoom +)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTimeZoom((z) => Math.max(z / 1.5, 1))}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Alejar tiempo (Zoom -)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Pan Slider when zoomed */}
              {timeZoom > 1.05 && (
                <div className="flex items-center space-x-1.5 ml-2">
                  <span className="text-slate-400 text-xs">Pan:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.005"
                    value={panOffset}
                    onChange={(e) => setPanOffset(parseFloat(e.target.value))}
                    className="w-24 accent-sky-500"
                  />
                </div>
              )}

              {/* Auto-Fit Voltage */}
              <button
                onClick={handleAutoFitVoltage}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                title="Ajustar límites de voltaje automáticamente a las ondas visibles"
              >
                <Maximize2 className="w-3 h-3 text-emerald-400" />
                <span>Auto Y</span>
              </button>

              {/* Reset Zoom */}
              {isZoomed && (
                <button
                  onClick={handleResetZoom}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 transition"
                  title="Restablecer osciloscopio a escala completa"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Helper Tip */}
          <div className="hidden sm:flex items-center space-x-1.5 text-[11px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/60 font-mono">
            <Crosshair className="w-3 h-3 text-sky-400" />
            <span>Arrastra para zoom a un área • Doble clic: restablecer</span>
          </div>
        </div>

        {/* Canvas Display with Interactive Drag-To-Zoom and Hover */}
        <div className="p-4 bg-slate-950 flex justify-center relative">
          <canvas
            ref={canvasRef}
            width={840}
            height={360}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => {
              if (isDragging) {
                setIsDragging(false);
                setDragStart(null);
                setDragCurrent(null);
              }
              setHoverPos(null);
            }}
            onDoubleClick={handleCanvasDoubleClick}
            className="w-full max-w-4xl h-80 rounded-lg shadow-inner border border-slate-800 cursor-crosshair"
          />
        </div>

        {/* Measurements & Metrics Table */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 text-xs overflow-x-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isSpectrum ? 'Picos Espectrales Detectados' : 'Mediciones del Osciloscopio'}
            </span>
            {isSpectrum && (
              <span className="text-[10px] text-slate-500 font-mono">
                Haz clic en cualquier pico para hacer zoom directo a su frecuencia
              </span>
            )}
          </div>

          {isSpectrum ? (
            <div className="grid grid-cols-2 gap-4">
              {spectra.map((spec, idx) => {
                if (!spec || !visibleChannels[idx]) return null;
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div
                      className="font-bold flex items-center space-x-1.5"
                      style={{ color: channelData[idx].color }}
                    >
                      <span>{channelData[idx].name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                      {spec.peaks.length > 0 ? (
                        spec.peaks.map((p, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleZoomToPeak(p.frequency)}
                            className="flex items-center space-x-1 bg-slate-900 hover:bg-sky-950/80 px-2.5 py-1 rounded border border-slate-700 hover:border-sky-500 transition group text-left"
                            title={`Hacer zoom directo al armónico de ${p.frequency.toFixed(1)} Hz`}
                          >
                            <span className="text-slate-400 group-hover:text-sky-300">
                              f{pIdx + 1}:
                            </span>
                            <strong className="text-white group-hover:text-sky-200">
                              {p.frequency.toFixed(1)} Hz
                            </strong>
                            <span className="text-slate-500 group-hover:text-slate-400 text-[10px]">
                              ({p.magnitudeDb.toFixed(1)} dB)
                            </span>
                            <Sparkles className="w-2.5 h-2.5 text-sky-400 opacity-0 group-hover:opacity-100 transition" />
                          </button>
                        ))
                      ) : (
                        <span className="text-slate-500">Sin picos destacados</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="pb-1.5">Canal</th>
                  <th className="pb-1.5">Vpp (Pico a Pico)</th>
                  <th className="pb-1.5">Vmax</th>
                  <th className="pb-1.5">Vmin</th>
                  <th className="pb-1.5">Vrms</th>
                  <th className="pb-1.5">Frec. Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {channelData.map((ch, idx) => {
                  const m = signalMetrics[idx];
                  if (!m || !visibleChannels[idx]) return null;
                  return (
                    <tr key={ch.portId} className="text-slate-300">
                      <td className="py-1 font-bold" style={{ color: ch.color }}>
                        {ch.name}
                      </td>
                      <td className="py-1">{m.vpp.toFixed(3)} V</td>
                      <td className="py-1 text-emerald-400">+{m.max.toFixed(3)} V</td>
                      <td className="py-1 text-rose-400">{m.min.toFixed(3)} V</td>
                      <td className="py-1">{m.rms.toFixed(3)} V</td>
                      <td className="py-1 text-sky-400">
                        {m.estFreq > 0 ? `${m.estFreq.toFixed(1)} Hz` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
