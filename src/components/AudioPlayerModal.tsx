import React, { useState, useEffect, useRef } from 'react';
import { BlockInstance, Connection, SimulationResult } from '../types';
import { AudioSignalPlayer, exportToWavBlob } from '../dsp/audioUtils';
import { X, Play, Square, Volume2, Download, Repeat, Music } from 'lucide-react';

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
  const [volume, setVolume] = useState(0.8);
  const [loop, setLoop] = useState(false);

  // Get the player instance
  useEffect(() => {
    playerRef.current = new AudioSignalPlayer();
    return () => {
      if (playerRef.current) {
        playerRef.current.stop();
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  // Extract connected audio signal
  const audioSignal = React.useMemo(() => {
    if (!simulationResult) return null;
    const conn = connections.find((c) => c.toBlockId === block.id && c.toPortId === 'in');
    if (!conn) return null;
    const key = `${conn.fromBlockId}:${conn.fromPortId}`;
    return simulationResult.signals.get(key) || null;
  }, [block, connections, simulationResult]);

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
    const step = Math.max(1, Math.floor(N / w));

    for (let x = 0; x < w; x++) {
      const idx = Math.floor(x * (N / w));
      let minVal = 0, maxVal = 0;
      for (let k = 0; k < step && idx + k < N; k++) {
        const val = audioSignal[idx + k];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }

      const y1 = (h / 2) - minVal * (h / 2.2);
      const y2 = (h / 2) - maxVal * (h / 2.2);

      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }, [isOpen, audioSignal]);

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
                Web Audio API Output • Fs = {simulationResult?.fs || 44100} Hz
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

        {/* Waveform Canvas */}
        <div className="p-5 bg-slate-950 flex flex-col items-center">
          <canvas
            ref={canvasRef}
            width={480}
            height={130}
            className="w-full h-32 rounded-lg border border-slate-800 bg-slate-950 shadow-inner"
          />

          {!audioSignal && (
            <p className="text-xs text-slate-500 mt-2">
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
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded border text-xs font-medium transition ${
                loop
                  ? 'bg-sky-950 border-sky-600 text-sky-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Bucle</span>
            </button>

            {/* Download WAV button */}
            <button
              onClick={handleDownloadWav}
              disabled={!audioSignal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-40"
              title="Descargar archivo WAV 16-bit PCM"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guardar .WAV</span>
            </button>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center space-x-3 text-xs text-slate-300">
            <Volume2 className="w-4 h-4 text-slate-400" />
            <span className="w-16">Volumen:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 accent-sky-500"
            />
            <span className="font-mono text-slate-400 w-10 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
