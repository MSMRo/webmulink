import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, X, Layers, ArrowLeft } from 'lucide-react';
import { BLOCK_DEFINITIONS } from '../engine/blocks';
import { renderSimulinkGlyph } from './LibraryBrowserModal';

interface LibraryBrowserSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBlock: (type: string) => void;
}

interface TreeCategory {
  id: string;
  name: string;
  subcategories?: { id: string; name: string }[];
}

const TREE_DATA: TreeCategory[] = [
  {
    id: 'simulink',
    name: 'Simulink',
    subcategories: [
      { id: 'commonly_used', name: 'Commonly Used Blocks' },
      { id: 'continuous', name: 'Continuous (1/s, H(s))' },
      { id: 'discrete', name: 'Discrete (z⁻¹, H(z))' },
      { id: 'math_ops', name: 'Math Operations' },
      { id: 'sources', name: 'Sources (WAV, Sine, Step)' },
      { id: 'sinks', name: 'Sinks (Scope, FFT, Audio)' },
    ],
  },
  {
    id: 'dsp_toolbox',
    name: 'DSP System Toolbox',
    subcategories: [
      { id: 'dsp_filtering', name: 'Filtering (FIR & IIR)' },
      { id: 'dsp_transforms', name: 'Transforms (FFT Spectrum)' },
      { id: 'dsp_audio', name: 'Audio & ECG Signals (.WAV)' },
    ],
  },
  {
    id: 'mixed_signal',
    name: 'Mixed-Signal Toolbox',
    subcategories: [
      { id: 'conversion', name: 'Data Converters (ADC & DAC)' },
      { id: 'sampling', name: 'Sample & Hold (ZOH)' },
    ],
  },
];

export const LibraryBrowserSidebar: React.FC<LibraryBrowserSidebarProps> = ({
  isOpen,
  onClose,
  onAddBlock,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubcat, setSelectedSubcat] = useState<string>('commonly_used');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    simulink: true,
    dsp_toolbox: true,
    mixed_signal: true,
  });

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getBlocksForCategory = (subcatId: string): string[] => {
    switch (subcatId) {
      case 'commonly_used':
        return [
          'wav_source',
          'scope',
          'gain',
          'sum',
          'integrator',
          'constant_source',
          'fir_filter',
          'iir_filter',
          'adc',
          'zoh',
          'sine_source',
          'spectrum',
        ];
      case 'continuous':
        return ['integrator', 'derivative', 'continuous_tf'];
      case 'discrete':
        return ['unit_delay', 'discrete_tf', 'moving_average', 'fir_filter', 'iir_filter'];
      case 'math_ops':
        return ['gain', 'sum', 'product', 'math_func', 'derivative', 'integrator'];
      case 'sources':
        return ['wav_source', 'sine_source', 'square_source', 'triangle_source', 'noise_source', 'step_source', 'impulse_source', 'constant_source'];
      case 'sinks':
        return ['scope', 'spectrum', 'audio_sink', 'xy_graph', 'display'];
      case 'dsp_filtering':
        return ['fir_filter', 'iir_filter', 'discrete_tf', 'moving_average'];
      case 'dsp_transforms':
        return ['spectrum'];
      case 'dsp_audio':
        return ['wav_source', 'audio_sink'];
      case 'conversion':
      case 'sampling':
      case 'mixed_signal':
        return ['zoh', 'adc', 'dac'];
      default:
        return Object.keys(BLOCK_DEFINITIONS);
    }
  };

  const currentBlockKeys = searchTerm.trim()
    ? Object.keys(BLOCK_DEFINITIONS).filter((k) => {
        const def = BLOCK_DEFINITIONS[k];
        return (
          def.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          def.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          def.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
    : getBlocksForCategory(selectedSubcat);

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/webmulink-block-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 h-[calc(100vh-4.5rem)] bg-[#f7f7f7] border-r-2 border-[#b0b0b0] flex flex-col font-sans text-xs text-black select-none z-10 shrink-0 shadow-md">
      {/* Title bar of the Library Browser Sidepane (Matching Screenshot: "Model Browser") */}
      <div className="h-7 bg-gradient-to-r from-[#e6e6e6] to-[#d6d6d6] border-b border-[#ababab] px-2.5 flex items-center justify-between text-slate-800 font-semibold text-[11px]">
        <div className="flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5 text-sky-700" />
          <span>Library Browser</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-300 text-slate-600 transition"
          title="Ocultar Library Browser"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-[#d8d8d8] bg-white">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar bloque (FIR, WAV, ADC)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-6 bg-white border border-[#7f9db9] rounded-xs pl-2 pr-6 text-xs text-black focus:outline-none focus:border-sky-600"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1.5" />
        </div>
      </div>

      {/* Top Half: Tree Category View */}
      <div className="h-44 bg-white border-b border-[#d8d8d8] overflow-y-auto p-1.5 text-xs text-slate-800 custom-scrollbar">
        {TREE_DATA.map((node) => {
          const isExpanded = !!expandedNodes[node.id];

          return (
            <div key={node.id} className="mb-0.5">
              <div
                onClick={() => toggleNode(node.id)}
                className="flex items-center space-x-1 px-1 py-0.5 hover:bg-[#e8f1fc] cursor-pointer rounded-xs"
              >
                {node.subcategories ? (
                  isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  )
                ) : (
                  <span className="w-3.5" />
                )}
                <span className="font-semibold text-[11px] text-slate-800 truncate">
                  {node.name}
                </span>
              </div>

              {isExpanded && node.subcategories && (
                <div className="pl-3.5 space-y-0.5 border-l border-slate-200 ml-2.5 mt-0.5">
                  {node.subcategories.map((sub) => {
                    const isSelected = selectedSubcat === sub.id && !searchTerm;

                    return (
                      <div
                        key={sub.id}
                        onClick={() => {
                          setSelectedSubcat(sub.id);
                          setSearchTerm('');
                        }}
                        className={`px-1.5 py-0.5 cursor-pointer rounded-xs text-[11px] truncate transition ${
                          isSelected
                            ? 'bg-[#cce8ff] text-[#000000] font-semibold border border-[#99d1ff]'
                            : 'hover:bg-[#f0f4f9] text-slate-700'
                        }`}
                      >
                        {sub.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Half: Block Icons Grid */}
      <div className="flex-1 bg-[#ffffff] overflow-y-auto p-3 custom-scrollbar">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          {searchTerm ? `Resultados (${currentBlockKeys.length})` : selectedSubcat.replace('_', ' ').toUpperCase()}
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {currentBlockKeys.map((key) => {
            const def = BLOCK_DEFINITIONS[key];
            if (!def) return null;

            return (
              <div
                key={key}
                draggable
                onDragStart={(e) => handleDragStart(e, key)}
                onClick={() => onAddBlock(key)}
                className="flex flex-col items-center group cursor-grab active:cursor-grabbing hover:bg-sky-50 p-2 rounded border border-slate-200 hover:border-sky-400 transition bg-white shadow-xs"
                title={`Arrastra al lienzo o haz clic para agregar: ${def.description}`}
              >
                {/* Simulink Iconic Visual Block */}
                <div className="w-14 h-12 bg-white border-[1.5px] border-black rounded-[2px] flex items-center justify-center relative shadow-[1px_1px_0px_rgba(0,0,0,0.18)] group-hover:scale-105 transition-transform">
                  {renderSimulinkGlyph(key, def)}
                </div>

                {/* Block Name Printed BELOW block in clean text */}
                <span className="text-[10px] text-center text-slate-800 mt-1.5 font-medium leading-tight max-w-[90px] truncate">
                  {def.name}
                </span>
              </div>
            );
          })}
        </div>

        {currentBlockKeys.length === 0 && (
          <div className="text-center text-slate-400 py-8 text-xs">
            No se encontraron bloques.
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="h-6 bg-[#f0f0f0] border-t border-[#d8d8d8] px-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>Arrastra bloques al lienzo</span>
        <span className="font-mono">{currentBlockKeys.length}</span>
      </div>
    </aside>
  );
};
