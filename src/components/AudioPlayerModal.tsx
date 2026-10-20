import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BlockInstance, Connection, SimulationResult } from '../types';
import { AudioSignalPlayer, exportToWavBlob } from '../dsp/audioUtils';
import {
  X,
  Play,
  Square,
  Volume2,
  Download,
  Repeat,
  Music,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
} from 'lucide-react';

interface AudioPlayerModalProps {
  block: BlockInstance;
  isOpen: boolean;
  onClose: () => void;
  connections: Connection[];
  simulationResult: SimulationResult | null;
}

export const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({
  block,
  isOpen,
  onClose,
  connections,
  simulationResult,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<AudioSignalPlayer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);

  // Zoom & Pan state for audio waveform
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState(0); // 0 to 1

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);

  useEffect(() => {
    playerRef.current = new AudioSignalPlayer();
    return () => {
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current = null;
      }
    };
  }, []);

  // Find input signal connected to 'in' port
  const audioSignal = useMemo(() => {
    if (!simulationResult) return null;
    const conn = connections.find((c) => c.toBlockId === block.id && c.toPortId === 'in');
    if (!conn) return null;
    const key = `${conn.fromBlockId}:${conn.fromPortId}`;
    return simulationResult.signals.get(key) || null;
  }, [block, connections, simulationResult]);

  const fs = simulationResult?.fs || 44100;
  const totalDuration = audioSignal ? audioSignal.length / fs : 1.0;
  const durMs = totalDuration * 1000;
  const windowDuration = totalDuration / zoom;
  const startT = panOffset * Math.max(0, totalDuration - windowDuration);
  const endT = startT + windowDuration;

  // Waveform presets
  const timePresets = useMemo(() => {
    const list = [{ label: 'Todo (1x)', zoom: 1.0, pan: 0 }];
    if (durMs >= 100) list.push({ label: '50 ms', zoom: Math.min(40, durMs / 50), pan: 0 });
    if (durMs >= 200) list.push({ label: '100 ms', zoom: Math.min(40, durMs / 100), pan: 0 });
    if (durMs >= 500) list.push({ label: '250 ms', zoom: Math.min(40, durMs / 250), pan: 0 });
    if (durMs >= 1000) list.push({ label: '500 ms', zoom: Math.min(40, durMs / 500), pan: 0 });
    if (durMs >= 2000) list.push({ label: '1.0 s', zoom: Math.min(40, durMs / 1000), pan: 0 });
    return list;
  }, [durMs]);

  // Mouse handlers for drag box zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioSignal) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    setIsDragging(true);
    setDragStart(x);
    setDragCurrent(x);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    setDragCurrent(x);
  };

  const handleMouseUp = () => {
    if (!isDragging || dragStart === null || dragCurrent === null || !canvasRef.current) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
    const w = canvasRef.current.width;
    const x1 = Math.min(dragStart, dragCurrent);
    const x2 = Math.max(dragStart, dragCurrent);

    if (x2 - x1 > 8) {
      const t1 = startT + (x1 / w) * windowDuration;
      const t2 = startT + (x2 / w) * windowDuration;
      const newDur = Math.max(0.005, t2 - t1);
      const newZoom = Math.min(50, totalDuration / newDur);
      setZoom(newZoom);
      const maxOffsetT = Math.max(0, totalDuration - newDur);
      if (maxOffsetT > 0) {
        setPanOffset(Math.max(0, Math.min(1, t1 / maxOffsetT)));
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  // Draw Audio Waveform
  useEffect(() => {
    if (!isOpen || !audioSignal) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Centerline
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Waveform envelope
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const N = audioSignal.length;
    const startIdx = Math.max(0, Math.floor((startT / totalDuration) * N));
    const endIdx = Math.min(N, Math.ceil((endT / totalDuration) * N));
    const visibleCount = Math.max(1, endIdx - startIdx);
    const step = Math.max(1, Math.floor(visibleCount / w));

    for (let x = 0; x < w; x++) {
      const idx = startIdx + Math.floor(x * (visibleCount / w));
      let minVal = 0,
        maxVal = 0;
      for (let k = 0; k < step && idx + k < N; k++) {
        const val = audioSignal[idx + k];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }

      const y1 = h / 2 - minVal * (h / 2.2);
      const y2 = h / 2 - maxVal * (h / 2.2);

      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();

    // Drag selection marquee
    if (isDragging && dragStart !== null && dragCurrent !== null) {
      const x1 = Math.min(dragStart, dragCurrent);
      const x2 = Math.max(dragStart, dragCurrent);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(x1, 0, x2 - x1, h);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x1, 0, x2 - x1, h);
      ctx.setLineDash([]);
    }
  }, [isOpen, audioSignal, zoom, panOffset, startT, endT, totalDuration, isDragging, dragStart, dragCurrent]);

  const handleTogglePlay = () => {
    if (!playerRef.current || !audioSignal || !simulationResult) return;

    if (isPlaying) {
      playerRef.current.stop();
      setIsPlaying(false);
    } else {
      playerRef.current.playBuffer(audioSignal, simulationResult.fs, loop, () => {
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const handleDownloadWav = () => {
    if (!audioSignal || !simulationResult) return;
    const blob = exportToWavBlob(audioSignal, simulationResult.fs);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audio_Webmulink_${simulationResult.fs}Hz.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-sky-950 text-sky-400 border border-sky-800/80">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">{block.title || 'Reproductor de Audio'}</h2>
              <span className="text-[10px] text-slate-400 font-mono">
                Web Audio API Output • Fs = {fs} Hz • Duración: {totalDuration.toFixed(2)}s
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (playerRef.current) playerRef.current.stop();
              setIsPlaying(false);
              onClose();
            }}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Waveform Canvas & Zoom Area Toolbar */}
        <div className="p-5 bg-slate-950 flex flex-col">
          {/* Zoom Toolbar */}
          <div className="flex items-center justify-between mb-2 text-xs">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 text-[11px] font-semibold flex items-center space-x-1">
                <ZoomIn className="w-3 h-3 text-sky-400" />
                <span>Zoom Área:</span>
              </span>
              <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                {timePresets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setZoom(preset.zoom);
                      setPanOffset(preset.pan);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                      Math.abs(zoom - preset.zoom) < 0.1
                        ? 'bg-sky-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setZoom((z) => Math.min(z * 1.5, 50))}
                className="p-1 rounded bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                title="Acercar forma de onda"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z / 1.5, 1))}
                className="p-1 rounded bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                title="Alejar forma de onda"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              {zoom > 1.05 && (
                <button
                  onClick={() => {
                    setZoom(1.0);
                    setPanOffset(0);
                  }}
                  className="p-1 rounded bg-slate-900 text-amber-400 hover:bg-slate-800 border border-slate-800"
                  title="Restablecer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={480}
            height={130}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={() => {
              setZoom(1.0);
              setPanOffset(0);
            }}
            className="w-full h-32 rounded-lg border border-slate-800 bg-slate-950 shadow-inner cursor-crosshair"
          />

          {/* Pan slider when zoomed in */}
          {zoom > 1.05 && (
            <div className="flex items-center space-x-2 mt-2 px-1">
              <span className="text-[10px] text-slate-400 font-mono">Pan:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={panOffset}
                onChange={(e) => setPanOffset(parseFloat(e.target.value))}
                className="w-full accent-sky-500 h-1"
              />
              <span className="text-[10px] text-sky-400 font-mono whitespace-nowrap">
                {(startT * 1000).toFixed(0)} - {(endT * 1000).toFixed(0)} ms
              </span>
            </div>
          )}

          {!audioSignal && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              No hay señal conectada a este bloque de salida.
            </p>
          )}
        </div>

        {/* Audio Controls */}
        <div className="px-5 py-4 bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            {/* Play/Stop Button */}
            <button
              onClick={handleTogglePlay}
              disabled={!audioSignal}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg font-bold text-xs transition shadow-md disabled:opacity-40 ${
                isPlaying
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
              }`}
            >
              {isPlaying ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>Detener Audio</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Reproducir Señal</span>
                </>
              )}
            </button>

            {/* Loop Toggle */}
            <button
              onClick={() => setLoop(!loop)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                loop
                  ? 'bg-sky-950 text-sky-300 border-sky-700 font-bold'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Bucle</span>
            </button>

            {/* Export Audio WAV */}
            <button
              onClick={handleDownloadWav}
              disabled={!audioSignal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition disabled:opacity-40"
              title="Descargar señal procesada como archivo WAV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar .WAV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
