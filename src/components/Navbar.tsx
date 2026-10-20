import React from 'react';
import { Play, RotateCcw, Download, Upload, Trash2, HelpCircle, Sparkles, Activity } from 'lucide-react';
import { SimulationConfig } from '../types';
import { PRESETS } from '../engine/presets';

interface NavbarProps {
  config: SimulationConfig;
  onConfigChange: (config: SimulationConfig) => void;
  onRun: () => void;
  onReset: () => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  onSelectPreset: (index: number) => void;
  onOpenHelp: () => void;
  isSimulating: boolean;
  lastExecutionTime?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  onConfigChange,
  onRun,
  onReset,
  onClear,
  onSave,
  onLoad,
  onSelectPreset,
  onOpenHelp,
  isSimulating,
  lastExecutionTime,
}) => {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-30 select-none">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-md shadow-sky-950">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg tracking-tight text-white font-sans">
              Webmulink
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-sky-950 text-sky-400 border border-sky-800/60">
              DSP & Sistemas
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-none">
            Simulador Web de Señales y Sistemas LTI
          </p>
        </div>
      </div>

      {/* Center: Simulation Controls & Configuration */}
      <div className="flex items-center space-x-3 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800 shadow-inner">
        {/* Run Button */}
        <button
          onClick={onRun}
          disabled={isSimulating}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs transition shadow-sm shadow-emerald-950 disabled:opacity-50"
          title="Ejecutar Simulación (Ctrl + Enter o F5)"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isSimulating ? 'Simulando...' : 'Ejecutar'}</span>
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          title="Reiniciar datos de simulación"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800" />

        {/* Sampling Frequency Fs */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
          <span className="text-slate-400 font-mono text-[11px]">Fs:</span>
          <select
            value={config.fs}
            onChange={(e) =>
              onConfigChange({ ...config, fs: parseInt(e.target.value, 10), timeStep: 1 / parseInt(e.target.value, 10) })
            }
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-sky-300 font-mono focus:outline-none focus:border-sky-500"
          >
            <option value="1000">1 kHz (Control)</option>
            <option value="4000">4 kHz (Baja Frec)</option>
            <option value="8000">8 kHz (Telefonía)</option>
            <option value="16000">16 kHz (Voz)</option>
            <option value="22050">22.05 kHz (Audio 0.5x)</option>
            <option value="44100">44.1 kHz (CD Audio)</option>
          </select>
        </div>

        {/* Duration */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
          <span className="text-slate-400 font-mono text-[11px]">T:</span>
          <select
            value={config.duration}
            onChange={(e) =>
              onConfigChange({ ...config, duration: parseFloat(e.target.value) })
            }
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
          >
            <option value="0.05">0.05 s (50 ms)</option>
            <option value="0.1">0.1 s (100 ms)</option>
            <option value="0.2">0.2 s (200 ms)</option>
            <option value="0.5">0.5 s (500 ms)</option>
            <option value="1.0">1.0 s</option>
            <option value="2.0">2.0 s</option>
            <option value="5.0">5.0 s</option>
          </select>
        </div>

        {/* Execution time indicator */}
        {lastExecutionTime !== undefined && (
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 hidden sm:inline">
            ⚡ {lastExecutionTime.toFixed(1)} ms
          </span>
        )}
      </div>

      {/* Right: Presets, Import/Export, Docs */}
      <div className="flex items-center space-x-2">
        {/* Presets Dropdown */}
        <div className="relative group">
          <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer border border-slate-700 transition">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Ejemplos DSP</span>
          </div>
          <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 tracking-wider">
              Modelos Predefinidos
            </div>
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPreset(idx)}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-sky-950/60 hover:text-sky-300 transition flex flex-col space-y-0.5 border-b border-slate-800/40 last:border-none"
              >
                <span className="font-semibold">{preset.name}</span>
                <span className="text-[10px] text-slate-400 line-clamp-1">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Save Model JSON */}
        <button
          onClick={onSave}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Guardar Modelo (JSON)"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Load Model JSON */}
        <button
          onClick={onLoad}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Cargar Modelo (JSON)"
        >
          <Upload className="w-4 h-4" />
        </button>

        {/* Clear Canvas */}
        <button
          onClick={onClear}
          className="p-1.5 rounded text-slate-300 hover:text-rose-400 hover:bg-slate-800 transition"
          title="Limpiar Diagrama"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800" />

        {/* Help */}
        <button
          onClick={onOpenHelp}
          className="flex items-center space-x-1 p-1.5 rounded text-slate-300 hover:text-sky-300 hover:bg-slate-800 transition"
          title="Ayuda y Documentación"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
