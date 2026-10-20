import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BlockInstance, Connection, SimulationResult } from '../types';
import { computeSpectrum, WindowType } from '../dsp/fft';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Eye, EyeOff, Radio } from 'lucide-react';

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

  // Time scope zoom & pan
  const [timeZoom, setTimeZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState(0); // 0 to 1

  // Spectrum options
  const [scaleMode, setScaleMode] = useState<'db' | 'linear'>('db');
  const [windowType, setWindowType] = useState<WindowType>('hann');
  const [fftSize, setFftSize] = useState<number>(2048);

  // Active channel visibility
  const [visibleChannels, setVisibleChannels] = useState<boolean[]>([true, true, true, true]);

  // Mouse cursor readout
  const [hoverData, setHoverData] = useState<{
    xVal: number;
    channelValues: { name: string; val: number; color: string }[];
  } | null>(null);

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
      let min = Infinity, max = -Infinity, sum = 0, sumSq = 0;
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
      const estFreq = (zeroCrossings / 2) / duration;

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

  // Draw Canvas plot
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

    const padding = { left: 55, right: 25, top: 25, bottom: 35 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    if (!simulationResult || channelData.every((c) => !c.signal)) {
      // Empty placeholder
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
      const fs = simulationResult.fs;
      const nyquist = fs / 2;

      // Vertical Frequency Grid Lines
      const numFreqDivs = 8;
      for (let i = 0; i <= numFreqDivs; i++) {
        const x = padding.left + (i / numFreqDivs) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotH);
        ctx.stroke();

        const freqVal = (i / numFreqDivs) * nyquist;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(freqVal >= 1000 ? `${(freqVal / 1000).toFixed(1)}k` : `${freqVal.toFixed(0)}`, x, h - 15);
      }
      ctx.fillText('Frecuencia (Hz)', padding.left + plotW / 2, h - 3);

      // Horizontal Magnitude Grid Lines
      const isDb = scaleMode === 'db';
      const minMag = isDb ? -100 : 0;
      const maxMag = isDb ? 10 : 2.0;

      const numMagDivs = 6;
      for (let i = 0; i <= numMagDivs; i++) {
        const y = padding.top + (i / numMagDivs) * plotH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotW, y);
        ctx.stroke();

        const magVal = maxMag - (i / numMagDivs) * (maxMag - minMag);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(isDb ? `${magVal.toFixed(0)} dB` : `${magVal.toFixed(1)} V`, padding.left - 6, y + 3);
      }

      // Draw Spectrum Traces
      spectra.forEach((spec, chIdx) => {
        if (!spec || !visibleChannels[chIdx]) return;
        const color = channelData[chIdx].color;
        const mags = isDb ? spec.magnitudeDb : spec.magnitude;
        const numBins = spec.frequencies.length;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < numBins; i++) {
          const f = spec.frequencies[i];
          const m = mags[i];
          const x = padding.left + (f / nyquist) * plotW;
          const yNorm = (m - minMag) / (maxMag - minMag);
          const y = padding.top + plotH * (1 - Math.max(0, Math.min(1, yNorm)));

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw Peak Markers
        ctx.fillStyle = color;
        spec.peaks.slice(0, 3).forEach((peak) => {
          const x = padding.left + (peak.frequency / nyquist) * plotW;
          const yNorm = (peak.magnitudeDb - minMag) / (maxMag - minMag);
          const y = padding.top + plotH * (1 - Math.max(0, Math.min(1, yNorm)));

          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`${peak.frequency.toFixed(0)}Hz`, x, y - 8);
          ctx.fillStyle = color;
        });
      });
    } else {
      // ================= TIME OSCILLOSCOPE DRAW =================
      const time = simulationResult.time;
      const totalDuration = simulationResult.duration;
      const windowDuration = totalDuration / timeZoom;
      const startT = panOffset * (totalDuration - windowDuration);
      const endT = startT + windowDuration;

      // Find global Y min & max for auto-scale
      let yMin = parseFloat(block.params.yMin ?? -2.0);
      let yMax = parseFloat(block.params.yMax ?? 2.0);

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
        ctx.fillText(tVal >= 1 ? `${tVal.toFixed(2)}s` : `${(tVal * 1000).toFixed(1)}ms`, x, h - 15);
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

        const vVal = yMax - (i / numVoltDivs) * (yMax - yMin);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${vVal.toFixed(1)} V`, padding.left - 6, y + 3);
      }

      // Draw zero axis line
      if (yMin < 0 && yMax > 0) {
        const zeroY = padding.top + plotH * (1 - (0 - yMin) / (yMax - yMin));
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(padding.left + plotW, zeroY);
        ctx.stroke();
      }

      // Draw Signal Waveforms
      channelData.forEach((ch, chIdx) => {
        if (!ch.signal || !visibleChannels[chIdx]) return;
        const signal = ch.signal;
        const color = ch.color;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let started = false;
        const step = Math.max(1, Math.floor(signal.length / (plotW * 2)));

        for (let i = 0; i < signal.length; i += step) {
          const t = time[i];
          if (t < startT || t > endT) continue;

          const x = padding.left + ((t - startT) / windowDuration) * plotW;
          const yNorm = (signal[i] - yMin) / (yMax - yMin);
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
    block.params,
  ]);

  // Export Canvas to PNG Image
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${block.title || 'grafico'}_webmulink.png`;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-lg bg-sky-950 text-sky-400 border border-sky-800/80">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">
                {block.title || (isSpectrum ? 'Analizador de Espectro (FFT)' : 'Osciloscopio')}
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                {isSpectrum ? 'Dominio de la Frecuencia |X(f)|' : 'Dominio del Tiempo x(t)'} • Fs ={' '}
                {simulationResult?.fs || 0} Hz
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportPNG}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Descargar imagen PNG"
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

        {/* Toolbar Controls */}
        <div className="px-5 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
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
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: ch.color }}
                />
                <span>{ch.name}</span>
                {visibleChannels[idx] ? (
                  <Eye className="w-3 h-3 text-slate-400" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>

          {/* Mode controls */}
          {isSpectrum ? (
            <div className="flex items-center space-x-3 text-xs text-slate-300">
              {/* dB vs Linear */}
              <div className="flex rounded bg-slate-900 border border-slate-800 p-0.5">
                <button
                  onClick={() => setScaleMode('db')}
                  className={`px-2.5 py-0.5 rounded font-mono ${
                    scaleMode === 'db' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  dB (Log)
                </button>
                <button
                  onClick={() => setScaleMode('linear')}
                  className={`px-2.5 py-0.5 rounded font-mono ${
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
          ) : (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Zoom T:</span>
              <button
                onClick={() => setTimeZoom((z) => Math.min(z * 1.5, 20))}
                className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                title="Acercar tiempo"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTimeZoom((z) => Math.max(z / 1.5, 1))}
                className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                title="Alejar tiempo"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setTimeZoom(1.0);
                  setPanOffset(0);
                }}
                className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                title="Restablecer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {timeZoom > 1 && (
                <div className="flex items-center space-x-1.5 ml-2">
                  <span className="text-slate-400">Pan:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={panOffset}
                    onChange={(e) => setPanOffset(parseFloat(e.target.value))}
                    className="w-24 accent-sky-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Canvas Display */}
        <div className="p-4 bg-slate-950 flex justify-center">
          <canvas
            ref={canvasRef}
            width={840}
            height={360}
            className="w-full max-w-4xl h-80 rounded-lg shadow-inner border border-slate-800 cursor-crosshair"
          />
        </div>

        {/* Measurements & Metrics Table */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 text-xs overflow-x-auto">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            {isSpectrum ? 'Picos Espectrales Detectados' : 'Mediciones del Osciloscopio'}
          </div>

          {isSpectrum ? (
            <div className="grid grid-cols-2 gap-4">
              {spectra.map((spec, idx) => {
                if (!spec || !visibleChannels[idx]) return null;
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1"
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
                          <span
                            key={pIdx}
                            className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700"
                          >
                            f{pIdx + 1}: <strong className="text-white">{p.frequency.toFixed(1)} Hz</strong> ({p.magnitudeDb.toFixed(1)} dB)
                          </span>
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
