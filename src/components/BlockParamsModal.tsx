import React, { useState, useEffect, useRef } from 'react';
import { BlockInstance } from '../types';
import { BLOCK_DEFINITIONS } from '../engine/blocks';
import { X, Play, Square, Upload, Check, Info } from 'lucide-react';
import { decodeAudioFile } from '../dsp/audioUtils';
import { designFIR, designBiquad, computeFrequencyResponse } from '../dsp/filterDesign';
import { parseCoefficients } from '../engine/simulationEngine';

interface BlockParamsModalProps {
  block: BlockInstance;
  fs: number;
  isOpen: boolean;
  onClose: () => void;
  onSaveParams: (blockId: string, title: string, params: Record<string, any>) => void;
}

export const BlockParamsModal: React.FC<BlockParamsModalProps> = ({
  block,
  fs,
  isOpen,
  onClose,
  onSaveParams,
}) => {
  const def = BLOCK_DEFINITIONS[block.type];
  const [title, setTitle] = useState(block.title || def?.name || '');
  const [params, setParams] = useState<Record<string, any>>({ ...block.params });

  // For WAV preview playback
  const [isPlayingWav, setIsPlayingWav] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Canvas ref for filter frequency response preview
  const freqCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setTitle(block.title || def?.name || '');
    setParams({ ...block.params });
  }, [block, def]);

  // Clean up audio on close
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const handleChange = (key: string, value: any) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSaveParams(block.id, title, params);
    onClose();
  };

  // Draw Live Filter Frequency Response curve
  useEffect(() => {
    if (!isOpen || (block.type !== 'fir_filter' && block.type !== 'iir_filter')) return;
    const canvas = freqCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bCoeffs: Float64Array;
    let aCoeffs: Float64Array = new Float64Array([1.0]);

    if (block.type === 'fir_filter') {
      if (params.designMode === 'designer') {
        const f1 = parseFloat(params.cutoffFreq ?? 200);
        const f2 = parseFloat(params.cutoffFreq2 ?? 800);
        const order = parseInt(params.order ?? 32, 10);
        bCoeffs = designFIR(params.filterType || 'lowpass', order, f1, f2, fs, params.window || 'hamming');
      } else {
        bCoeffs = parseCoefficients(params.coefficients, [0.1, 0.2, 0.4, 0.2, 0.1]);
      }
    } else {
      // IIR
      if (params.designMode === 'designer') {
        const fc = parseFloat(params.cutoffFreq ?? 250);
        const q = parseFloat(params.qFactor ?? 0.7071);
        const bq = designBiquad(params.filterType || 'lowpass', fc, fs, q);
        bCoeffs = bq.b;
        aCoeffs = bq.a;
      } else {
        bCoeffs = parseCoefficients(params.bCoeffs, [0.067, 0.135, 0.067]);
        aCoeffs = parseCoefficients(params.aCoeffs, [1.0, -1.14, 0.41]);
      }
    }

    const { freqs, magDb } = computeFrequencyResponse(bCoeffs, aCoeffs, fs, 256);

    // Draw Response
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let db = 0; db >= -80; db -= 20) {
      const y = h * (db / -80);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`${db}dB`, 4, y - 2);
    }

    // Magnitude Curve
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < freqs.length; i++) {
      const x = (i / (freqs.length - 1)) * w;
      const dbClamped = Math.max(-80, Math.min(20, magDb[i]));
      const y = h * (dbClamped / -80);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Legend
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px monospace';
    ctx.fillText(`0 Hz`, 4, h - 4);
    ctx.fillText(`Nyquist (${(fs / 2).toFixed(0)} Hz)`, w - 120, h - 4);
  }, [isOpen, block.type, params, fs]);

  // Audio WAV file upload
  const handleWavUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const decoded = await decodeAudioFile(file);
      handleChange('fileName', file.name);
      handleChange('audioData', decoded.samples);
      handleChange('sampleRate', decoded.sampleRate);
      handleChange('duration', decoded.duration);
    } catch (err: any) {
      alert(`Error al decodificar audio: ${err?.message || err}`);
    }
  };

  const handlePlayWav = () => {
    if (isPlayingWav) {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {}
      }
      setIsPlayingWav(false);
      return;
    }

    const audioData: Float64Array | null = params.audioData;
    if (!audioData || audioData.length === 0) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;

    const buffer = ctx.createBuffer(1, audioData.length, params.sampleRate || 44100);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < audioData.length; i++) {
      channelData[i] = audioData[i];
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => setIsPlayingWav(false);
    source.start();
    audioSourceRef.current = source;
    setIsPlayingWav(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center justify-between text-white border-b border-slate-800"
          style={{ backgroundColor: def?.color || '#0284c7' }}
        >
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm">{def?.name}</span>
            <span className="text-xs bg-black/30 px-2 py-0.5 rounded font-mono">
              {block.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/20 text-white/90 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-300">
          {/* Block Title */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Nombre de la instancia del bloque:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-sky-500 font-medium"
            />
          </div>

          <div className="border-t border-slate-800 pt-3 space-y-4">
            {/* ================= SINE / WAVE GENERATORS ================= */}
            {block.type === 'sine_source' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Frecuencia (Hz):</label>
                    <input
                      type="number"
                      step="any"
                      value={params.frequency ?? 50}
                      onChange={(e) => handleChange('frequency', parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Amplitud Pico (V):</label>
                    <input
                      type="number"
                      step="any"
                      value={params.amplitude ?? 1.0}
                      onChange={(e) => handleChange('amplitude', parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Fase (° grados):</label>
                    <input
                      type="number"
                      step="any"
                      value={params.phase ?? 0}
                      onChange={(e) => handleChange('phase', parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Offset DC (V):</label>
                    <input
                      type="number"
                      step="any"
                      value={params.offset ?? 0}
                      onChange={(e) => handleChange('offset', parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-500"
                    />
                  </div>
                </div>
              </>
            )}

            {block.type === 'square_source' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Frecuencia (Hz):</label>
                  <input
                    type="number"
                    value={params.frequency ?? 20}
                    onChange={(e) => handleChange('frequency', parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ciclo de Trabajo (%):</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={params.dutyCycle ?? 50}
                    onChange={(e) => handleChange('dutyCycle', parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* ================= WAV AUDIO SOURCE ================= */}
            {block.type === 'wav_source' && (
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Archivo de Audio Local</span>
                  <label className="cursor-pointer flex items-center space-x-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium transition text-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Seleccionar .WAV / .MP3</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleWavUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {params.fileName ? (
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-700 space-y-1">
                    <div className="text-emerald-400 font-medium truncate flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>{params.fileName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex space-x-3">
                      <span>Fs: {params.sampleRate} Hz</span>
                      <span>Duración: {(params.duration || 0).toFixed(2)} s</span>
                    </div>
                    <div className="pt-2 flex items-center space-x-2">
                      <button
                        onClick={handlePlayWav}
                        className="flex items-center space-x-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition"
                      >
                        {isPlayingWav ? (
                          <>
                            <Square className="w-3 h-3 text-rose-400" />
                            <span>Detener</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 text-emerald-400 fill-current" />
                            <span>Escuchar Original</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic p-2 border border-dashed border-slate-800 rounded text-center">
                    No se ha cargado archivo. Por defecto se emitirá un tono senoidal de 440 Hz.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 mb-1">Ganancia de entrada:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.gain ?? 1.0}
                      onChange={(e) => handleChange('gain', parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-4">
                    <input
                      type="checkbox"
                      id="loopCheck"
                      checked={!!params.loop}
                      onChange={(e) => handleChange('loop', e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-sky-600 focus:ring-0"
                    />
                    <label htmlFor="loopCheck" className="text-slate-300">
                      Repetir en bucle (Loop)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ================= FIR FILTER ================= */}
            {block.type === 'fir_filter' && (
              <div className="space-y-3">
                <div className="flex rounded-md bg-slate-950 p-1 border border-slate-800">
                  <button
                    onClick={() => handleChange('designMode', 'designer')}
                    className={`flex-1 py-1 rounded text-xs font-medium transition ${
                      params.designMode === 'designer'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Diseñador Automático
                  </button>
                  <button
                    onClick={() => handleChange('designMode', 'manual')}
                    className={`flex-1 py-1 rounded text-xs font-medium transition ${
                      params.designMode === 'manual'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Coeficientes b Manuales
                  </button>
                </div>

                {params.designMode === 'designer' ? (
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div>
                      <label className="block text-slate-400 mb-1">Tipo de Filtro:</label>
                      <select
                        value={params.filterType || 'lowpass'}
                        onChange={(e) => handleChange('filterType', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                      >
                        <option value="lowpass">Pasa-Bajos (Lowpass)</option>
                        <option value="highpass">Pasa-Altos (Highpass)</option>
                        <option value="bandpass">Pasa-Banda (Bandpass)</option>
                        <option value="bandstop">Rechaza-Banda (Bandstop)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Frecuencia Corte fc (Hz):</label>
                      <input
                        type="number"
                        value={params.cutoffFreq ?? 200}
                        onChange={(e) => handleChange('cutoffFreq', parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono"
                      />
                    </div>
                    {(params.filterType === 'bandpass' || params.filterType === 'bandstop') && (
                      <div>
                        <label className="block text-slate-400 mb-1">Corte Superior fc2 (Hz):</label>
                        <input
                          type="number"
                          value={params.cutoffFreq2 ?? 800}
                          onChange={(e) => handleChange('cutoffFreq2', parseFloat(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-slate-400 mb-1">Orden N (Taps = N+1):</label>
                      <input
                        type="number"
                        min="2"
                        max="128"
                        step="2"
                        value={params.order ?? 32}
                        onChange={(e) => handleChange('order', parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Ventana:</label>
                      <select
                        value={params.window || 'hamming'}
                        onChange={(e) => handleChange('window', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                      >
                        <option value="hamming">Hamming</option>
                        <option value="hann">Hann (Hanning)</option>
                        <option value="blackman">Blackman</option>
                        <option value="rect">Rectangular</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Vector de coeficientes b [b0, b1, ... bm]:
                    </label>
                    <textarea
                      rows={3}
                      value={Array.isArray(params.coefficients) ? params.coefficients.join(', ') : params.coefficients}
                      onChange={(e) => handleChange('coefficients', e.target.value)}
                      placeholder="ej: 0.1, 0.2, 0.4, 0.2, 0.1"
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:border-purple-500"
                    />
                  </div>
                )}

                {/* Live Bode / Magnitude Response */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                    <span>Respuesta en Frecuencia |H(e^jω)| (dB)</span>
                    <span className="font-mono text-purple-400 text-[10px]">Fs = {fs} Hz</span>
                  </div>
                  <canvas
                    ref={freqCanvasRef}
                    width={480}
                    height={110}
                    className="w-full h-28 rounded border border-slate-800 bg-slate-950"
                  />
                </div>
              </div>
            )}

            {/* ================= IIR FILTER ================= */}
            {block.type === 'iir_filter' && (
              <div className="space-y-3">
                <div className="flex rounded-md bg-slate-950 p-1 border border-slate-800">
                  <button
                    onClick={() => handleChange('designMode', 'designer')}
                    className={`flex-1 py-1 rounded text-xs font-medium transition ${
                      params.designMode === 'designer'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Diseñador Biquad
                  </button>
                  <button
                    onClick={() => handleChange('designMode', 'manual')}
                    className={`flex-1 py-1 rounded text-xs font-medium transition ${
                      params.designMode === 'manual'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Coeficientes b y a Manuales
                  </button>
                </div>

                {params.designMode === 'designer' ? (
                  <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div>
                      <label className="block text-slate-400 mb-1">Tipo:</label>
                      <select
                        value={params.filterType || 'lowpass'}
                        onChange={(e) => handleChange('filterType', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                      >
                        <option value="lowpass">Pasa-Bajos</option>
                        <option value="highpass">Pasa-Altos</option>
                        <option value="bandpass">Pasa-Banda</option>
                        <option value="notch">Notch / Ranura</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Corte fc (Hz):</label>
                      <input
                        type="number"
                        value={params.cutoffFreq ?? 250}
                        onChange={(e) => handleChange('cutoffFreq', parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Factor Q:</label>
                      <input
                        type="number"
                        step="0.05"
                        value={params.qFactor ?? 0.7071}
                        onChange={(e) => handleChange('qFactor', parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Numerador b [b0, b1, ...]:</label>
                      <input
                        type="text"
                        value={Array.isArray(params.bCoeffs) ? params.bCoeffs.join(', ') : params.bCoeffs}
                        onChange={(e) => handleChange('bCoeffs', e.target.value)}
                        placeholder="0.067, 0.135, 0.067"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Denominador a [a0, a1, ...]:</label>
                      <input
                        type="text"
                        value={Array.isArray(params.aCoeffs) ? params.aCoeffs.join(', ') : params.aCoeffs}
                        onChange={(e) => handleChange('aCoeffs', e.target.value)}
                        placeholder="1.0, -1.14, 0.41"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Magnitude response canvas */}
                <canvas
                  ref={freqCanvasRef}
                  width={480}
                  height={110}
                  className="w-full h-28 rounded border border-slate-800 bg-slate-950"
                />
              </div>
            )}

            {/* ================= CONTINUOUS TRANSFER FUNCTION H(s) ================= */}
            {block.type === 'continuous_tf' && (
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div className="text-[11px] text-pink-400 font-semibold flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Discretización automática mediante Transformada Bilineal (Tustin)</span>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Numerador B(s) = bm·sᵐ + ... + b0:
                  </label>
                  <input
                    type="text"
                    value={params.numStr ?? '2500'}
                    onChange={(e) => handleChange('numStr', e.target.value)}
                    placeholder="ej: 2500 o 2, 10"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Denominador A(s) = an·sⁿ + ... + a0:
                  </label>
                  <input
                    type="text"
                    value={params.denStr ?? '1, 20, 2500'}
                    onChange={(e) => handleChange('denStr', e.target.value)}
                    placeholder="ej: 1, 20, 2500"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-300">
                  H(s) = ({params.numStr}) / ({params.denStr})
                </div>
              </div>
            )}

            {/* ================= DISCRETE TRANSFER FUNCTION H(z) ================= */}
            {block.type === 'discrete_tf' && (
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Numerador B(z) = b0 + b1·z⁻¹ + ... :
                  </label>
                  <input
                    type="text"
                    value={params.numStr ?? '0.2, 0.2'}
                    onChange={(e) => handleChange('numStr', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Denominador A(z) = a0 + a1·z⁻¹ + ... :
                  </label>
                  <input
                    type="text"
                    value={params.denStr ?? '1.0, -0.6'}
                    onChange={(e) => handleChange('denStr', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* ================= ADC & QUANTIZER ================= */}
            {block.type === 'adc' && (
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Resolución en Bits (N):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={params.bits ?? 4}
                      onChange={(e) => handleChange('bits', parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Voltaje de Referencia (±Vref):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.vRef ?? 1.0}
                      onChange={(e) => handleChange('vRef', parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Tipo de Cuantizador:</label>
                    <select
                      value={params.mode || 'mid-tread'}
                      onChange={(e) => handleChange('mode', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                    >
                      <option value="mid-tread">Mid-Tread (Nivel cero centrado)</option>
                      <option value="mid-riser">Mid-Riser (Umbral cero centrado)</option>
                      <option value="floor">Truncamiento / Piso</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2 pt-5">
                    <input
                      type="checkbox"
                      id="signedCheck"
                      checked={params.signed !== false}
                      onChange={(e) => handleChange('signed', e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500"
                    />
                    <label htmlFor="signedCheck" className="text-slate-300">
                      Bipolar [-Vref, +Vref]
                    </label>
                  </div>
                </div>

                {/* Analytical calculation badge */}
                <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] font-mono text-amber-200 flex justify-between">
                  <span>
                    Niveles: {Math.pow(2, params.bits ?? 4)} | Paso Δ:{' '}
                    {(
                      ((2 * (params.vRef ?? 1.0)) / Math.pow(2, params.bits ?? 4)) *
                      1000
                    ).toFixed(2)}{' '}
                    mV
                  </span>
                  <span>
                    SQNR Teórico: {(6.02 * (params.bits ?? 4) + 1.76).toFixed(1)} dB
                  </span>
                </div>
              </div>
            )}

            {/* ================= ZOH (RETENEDOR DE ORDEN CERO) ================= */}
            {block.type === 'zoh' && (
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Frecuencia de Retención / Submuestreo F_hold (Hz):
                  </label>
                  <input
                    type="number"
                    value={params.holdFrequency ?? 200}
                    onChange={(e) => handleChange('holdFrequency', parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div className="text-[11px] text-amber-300 bg-amber-950/30 p-2 rounded border border-amber-800/40 font-mono">
                  Periodo de muestreo: Ts = {(1 / (params.holdFrequency || 200) * 1000).toFixed(2)} ms.
                  {(params.holdFrequency || 200) > fs && ' (¡Atención: F_hold supera la Fs de simulación!)'}
                </div>
              </div>
            )}

            {/* ================= DAC (DIGITAL TO ANALOG CONVERTER) ================= */}
            {block.type === 'dac' && (
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1">Método de Reconstrucción:</label>
                  <select
                    value={params.method || 'smooth'}
                    onChange={(e) => handleChange('method', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                  >
                    <option value="zoh">Escalón ZOH (Muestras directas)</option>
                    <option value="foh">Interpolación Lineal FOH</option>
                    <option value="smooth">Filtro Analógico Pasa-Bajos (Anti-Imaging)</option>
                  </select>
                </div>
                {params.method === 'smooth' && (
                  <div>
                    <label className="block text-slate-400 mb-1">Corte del Filtro Reconstructor (Hz):</label>
                    <input
                      type="number"
                      value={params.smoothingCutoff ?? 300}
                      onChange={(e) => handleChange('smoothingCutoff', parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ================= GAIN ================= */}
            {block.type === 'gain' && (
              <div>
                <label className="block text-slate-400 mb-1">Factor de Ganancia (K):</label>
                <input
                  type="number"
                  step="any"
                  value={params.gain ?? 2.0}
                  onChange={(e) => handleChange('gain', parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                />
              </div>
            )}

            {/* ================= SUM ================= */}
            {block.type === 'sum' && (
              <div>
                <label className="block text-slate-400 mb-1">Signos de las entradas (+ o -):</label>
                <input
                  type="text"
                  maxLength={3}
                  value={params.signs ?? '++'}
                  onChange={(e) => handleChange('signs', e.target.value)}
                  placeholder="ej: ++ o +-"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                />
              </div>
            )}

            {/* ================= INTEGRATOR ================= */}
            {block.type === 'integrator' && (
              <div>
                <label className="block text-slate-400 mb-1">Condición Inicial y(0):</label>
                <input
                  type="number"
                  step="any"
                  value={params.initialCondition ?? 0.0}
                  onChange={(e) => handleChange('initialCondition', parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                />
              </div>
            )}

            {/* ================= UNIT DELAY ================= */}
            {block.type === 'unit_delay' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Retardo en muestras (k):</label>
                  <input
                    type="number"
                    min="1"
                    value={params.samples ?? 1}
                    onChange={(e) => handleChange('samples', parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Condición inicial:</label>
                  <input
                    type="number"
                    value={params.initialCondition ?? 0.0}
                    onChange={(e) => handleChange('initialCondition', parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end space-x-2.5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white transition shadow-sm"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
