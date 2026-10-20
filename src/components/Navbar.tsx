import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  Upload,
  Printer,
  Scissors,
  Copy,
  Clipboard,
  Undo2,
  Redo2,
  Layers,
  Settings,
  HelpCircle,
  FilePlus,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
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
  onOpenLibraryBrowser: () => void;
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
  onOpenLibraryBrowser,
  isSimulating,
  lastExecutionTime,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const toggleMenu = (menu: string) => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  const closeMenu = () => setActiveMenu(null);

  return (
    <header className="bg-[#f0f0f0] border-b border-[#ababab] select-none text-xs text-black font-sans z-30">
      {/* Window Title Bar (Screenshot 2: "thermo" window style) */}
      <div className="h-6 bg-gradient-to-r from-[#0055ea] to-[#3a80f6] text-white px-2 flex items-center justify-between text-[11px] font-bold shadow-xs">
        <div className="flex items-center space-x-2">
          {/* Simulink Model Icon */}
          <div className="w-3.5 h-3.5 bg-white text-[#0055ea] rounded-xs flex items-center justify-center font-bold text-[9px] shadow-xs">
            S
          </div>
          <span>webmulink - DSP & Simulink Model</span>
        </div>
        <div className="text-[10px] text-sky-100 font-normal">
          {lastExecutionTime !== undefined ? `Tiempo de simulación: ${lastExecutionTime.toFixed(1)} ms` : 'Listo'}
        </div>
      </div>

      {/* Classic Simulink Menu Bar: File, Edit, View, Simulation, Format, Tools, Help */}
      <div className="h-6 bg-[#f0f0f0] border-b border-[#d8d8d8] px-2 flex items-center space-x-1 text-slate-800 text-[11px] relative">
        {/* File Menu */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('file')}
            className={`px-2 py-0.5 rounded-xs hover:bg-[#d8e6f8] hover:text-black ${
              activeMenu === 'file' ? 'bg-[#cce8ff]' : ''
            }`}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-44 bg-white border border-[#999999] shadow-lg py-1 z-50 text-[11px]"
              onMouseLeave={closeMenu}
            >
              <button onClick={() => { onClear(); closeMenu(); }} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white">
                New Model
              </button>
              <button onClick={() => { onLoad(); closeMenu(); }} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white">
                Open Model...
              </button>
              <button onClick={() => { onSave(); closeMenu(); }} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white">
                Save (JSON)
              </button>
              <div className="h-px bg-slate-200 my-1" />
              <button onClick={() => { window.print(); closeMenu(); }} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white">
                Print...
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('edit')}
            className={`px-2 py-0.5 rounded-xs hover:bg-[#d8e6f8] hover:text-black ${
              activeMenu === 'edit' ? 'bg-[#cce8ff]' : ''
            }`}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-40 bg-white border border-[#999999] shadow-lg py-1 z-50 text-[11px]"
              onMouseLeave={closeMenu}
            >
              <button onClick={closeMenu} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white">Undo</button>
              <button onClick={closeMenu} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white">Redo</button>
              <div className="h-px bg-slate-200 my-1" />
              <button onClick={() => { onClear(); closeMenu(); }} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white text-rose-600">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('view')}
            className={`px-2 py-0.5 rounded-xs hover:bg-[#d8e6f8] hover:text-black ${
              activeMenu === 'view' ? 'bg-[#cce8ff]' : ''
            }`}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-48 bg-white border border-[#999999] shadow-lg py-1 z-50 text-[11px]"
              onMouseLeave={closeMenu}
            >
              <button
                onClick={() => { onOpenLibraryBrowser(); closeMenu(); }}
                className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white font-semibold"
              >
                Library Browser
              </button>
            </div>
          )}
        </div>

        {/* Simulation Menu */}
        <div className="relative">
          <button
            onClick={() => toggleMenu('sim')}
            className={`px-2 py-0.5 rounded-xs hover:bg-[#d8e6f8] hover:text-black ${
              activeMenu === 'sim' ? 'bg-[#cce8ff]' : ''
            }`}
          >
            Simulation
          </button>
          {activeMenu === 'sim' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-52 bg-white border border-[#999999] shadow-lg py-1 z-50 text-[11px]"
              onMouseLeave={closeMenu}
            >
              <button onClick={() => { onRun(); closeMenu(); }} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white font-bold">
                Start (Run)
              </button>
              <button onClick={() => { onReset(); closeMenu(); }} className="w-full text-left px-3 py-1 hover:bg-[#0078d7] hover:text-white">
                Stop / Reset
              </button>
            </div>
          )}
        </div>

        {/* Format Menu */}
        <button className="px-2 py-0.5 rounded-xs hover:bg-[#d8e6f8] hover:text-black">Format</button>

        {/* Tools Menu */}
        <button className="px-2 py-0.5 rounded-xs hover:bg-[#d8e6f8] hover:text-black">Tools</button>

        {/* Help Menu */}
        <button
          onClick={onOpenHelp}
          className="px-2 py-0.5 rounded-xs hover:bg-[#d8e6f8] hover:text-black"
        >
          Help
        </button>
      </div>

      {/* Classic Simulink Toolbar (Screenshot 2) */}
      <div className="h-8 bg-[#f5f5f5] px-2 flex items-center space-x-1.5 border-t border-[#ffffff] border-b border-[#cccccc]">
        {/* New, Open, Save, Print */}
        <button onClick={onClear} className="p-1 hover:bg-slate-200 rounded text-slate-700" title="Nuevo Modelo">
          <FilePlus className="w-3.5 h-3.5" />
        </button>
        <button onClick={onLoad} className="p-1 hover:bg-slate-200 rounded text-amber-600" title="Abrir Modelo">
          <FolderOpen className="w-3.5 h-3.5" />
        </button>
        <button onClick={onSave} className="p-1 hover:bg-slate-200 rounded text-sky-700" title="Guardar Modelo">
          <Download className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => window.print()} className="p-1 hover:bg-slate-200 rounded text-slate-700" title="Imprimir">
          <Printer className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Cut, Copy, Paste, Undo, Redo */}
        <button className="p-1 hover:bg-slate-200 rounded text-slate-600">
          <Scissors className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 hover:bg-slate-200 rounded text-slate-600">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 hover:bg-slate-200 rounded text-slate-600">
          <Clipboard className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 hover:bg-slate-200 rounded text-slate-600">
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 hover:bg-slate-200 rounded text-slate-600">
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* SIMULATION CONTROLS: Run (Play), Pause, Stop */}
        <button
          onClick={onRun}
          disabled={isSimulating}
          className="p-1 rounded bg-[#e8f5e9] hover:bg-[#c8e6c9] border border-[#a5d6a7] text-emerald-700 font-bold flex items-center space-x-1 shadow-2xs"
          title="Iniciar Simulación (Start/Run)"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
        <button
          onClick={onReset}
          className="p-1 hover:bg-slate-200 rounded text-slate-700"
          title="Detener / Reiniciar"
        >
          <Square className="w-3.5 h-3.5 fill-current text-slate-600" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Solver Mode Dropdown (Screenshot 2: "Normal") */}
        <div className="flex items-center space-x-1">
          <select className="h-5 bg-white border border-[#a0a0a0] rounded-xs px-1 text-[11px] font-sans text-slate-900 focus:outline-none">
            <option value="Normal">Normal</option>
            <option value="Accelerator">Accelerator</option>
            <option value="Rapid">Rapid Accelerator</option>
          </select>
        </div>

        {/* Sampling Frequency Fs */}
        <div className="flex items-center space-x-1 text-[11px] text-slate-700 pl-1">
          <span className="font-mono text-[10px]">Fs:</span>
          <select
            value={config.fs}
            onChange={(e) =>
              onConfigChange({
                ...config,
                fs: parseInt(e.target.value, 10),
                timeStep: 1 / parseInt(e.target.value, 10),
              })
            }
            className="h-5 bg-white border border-[#a0a0a0] rounded-xs px-1 text-[11px] font-mono text-slate-900"
          >
            <option value="1000">1000 Hz</option>
            <option value="4000">4000 Hz</option>
            <option value="8000">8000 Hz</option>
            <option value="16000">16000 Hz</option>
            <option value="22050">22050 Hz</option>
            <option value="44100">44100 Hz</option>
          </select>
        </div>

        {/* Stop Time Input (Screenshot 2: "10.0") */}
        <div className="flex items-center space-x-1 text-[11px] text-slate-700 pl-1">
          <span className="text-[10px]">Stop:</span>
          <input
            type="number"
            step="0.1"
            value={config.duration}
            onChange={(e) =>
              onConfigChange({ ...config, duration: parseFloat(e.target.value) || 0.1 })
            }
            className="w-12 h-5 bg-white border border-[#a0a0a0] rounded-xs px-1 text-[11px] font-mono text-slate-900"
          />
          <span>s</span>
        </div>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* SIMULINK LIBRARY BROWSER BUTTON (Screenshot 1) */}
        <button
          onClick={onOpenLibraryBrowser}
          className="flex items-center space-x-1 px-2 py-0.5 bg-[#fef9c3] hover:bg-[#fef08a] border border-[#facc15] rounded-xs text-amber-900 font-semibold shadow-2xs transition"
          title="Abrir Simulink Library Browser"
        >
          <Layers className="w-3.5 h-3.5 text-amber-700" />
          <span className="text-[11px]">Library Browser</span>
        </button>

        {/* DSP Presets Selector */}
        <div className="relative group ml-auto">
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-xs bg-[#e2e8f0] hover:bg-[#cbd5e1] text-slate-800 text-[11px] font-medium cursor-pointer border border-[#cbd5e1]">
            <Sparkles className="w-3 h-3 text-sky-600" />
            <span>Ejemplos DSP</span>
          </div>
          <div className="absolute right-0 top-full mt-0.5 w-60 bg-white border border-[#999999] rounded-xs shadow-xl py-1 hidden group-hover:block z-50">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPreset(idx)}
                className="w-full text-left px-3 py-1.5 text-[11px] text-slate-800 hover:bg-[#0078d7] hover:text-white flex flex-col"
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-[9px] text-slate-500 group-hover:text-sky-100 line-clamp-1">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Help button */}
        <button
          onClick={onOpenHelp}
          className="p-1 hover:bg-slate-200 rounded text-slate-700"
          title="Ayuda y Documentación"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
