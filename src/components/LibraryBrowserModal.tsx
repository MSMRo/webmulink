import React, { useState } from 'react';
import { X, Search, ChevronRight, ChevronDown, FolderOpen, FilePlus, HelpCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { BLOCK_DEFINITIONS } from '../engine/blocks';
import { BlockDefinition } from '../types';

interface LibraryBrowserModalProps {
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
      { id: 'continuous', name: 'Continuous' },
      { id: 'discrete', name: 'Discrete' },
      { id: 'logic_bit', name: 'Logic and Bit Operations' },
      { id: 'math_ops', name: 'Math Operations' },
      { id: 'discontinuities', name: 'Discontinuities' },
      { id: 'signal_routing', name: 'Signal Routing' },
      { id: 'sinks', name: 'Sinks' },
      { id: 'sources', name: 'Sources' },
      { id: 'ports_subsystems', name: 'Ports & Subsystems' },
    ],
  },
  {
    id: 'dsp_toolbox',
    name: 'DSP System Toolbox',
    subcategories: [
      { id: 'dsp_filtering', name: 'Filtering (FIR & IIR)' },
      { id: 'dsp_transforms', name: 'Transforms & Spectral (FFT)' },
      { id: 'dsp_audio', name: 'Audio & Speech (.WAV)' },
      { id: 'dsp_sources', name: 'Signal Sources' },
    ],
  },
  {
    id: 'mixed_signal',
    name: 'Mixed-Signal (ADC / DAC / ZOH)',
    subcategories: [
      { id: 'conversion', name: 'Data Converters (ADC & DAC)' },
      { id: 'sampling', name: 'Sample & Hold (ZOH)' },
    ],
  },
  {
    id: 'control_system',
    name: 'Control System Toolbox',
    subcategories: [
      { id: 'lti_models', name: 'LTI Continuous Models H(s)' },
      { id: 'feedback_loops', name: 'Feedback & Summing' },
    ],
  },
];

export const LibraryBrowserModal: React.FC<LibraryBrowserModalProps> = ({
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
    control_system: true,
  });

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Map subcategories to blocks
  const getBlocksForCategory = (subcatId: string): string[] => {
    switch (subcatId) {
      case 'commonly_used':
        return [
          'constant_source',
          'gain',
          'integrator',
          'sum',
          'product',
          'scope',
          'unit_delay',
          'sine_source',
          'square_source',
          'adc',
          'fir_filter',
          'iir_filter',
          'spectrum',
        ];
      case 'continuous':
        return ['integrator', 'derivative', 'continuous_tf'];
      case 'discrete':
        return ['unit_delay', 'discrete_tf', 'moving_average', 'fir_filter', 'iir_filter'];
      case 'math_ops':
        return ['gain', 'sum', 'product', 'math_func', 'derivative', 'integrator'];
      case 'sources':
        return ['sine_source', 'square_source', 'triangle_source', 'noise_source', 'step_source', 'impulse_source', 'constant_source', 'wav_source'];
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
      case 'lti_models':
        return ['continuous_tf', 'discrete_tf'];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      {/* Classic Windows / Simulink Window Shell */}
      <div className="w-full max-w-4xl h-[620px] bg-[#f0f0f0] border-2 border-[#707070] rounded shadow-2xl flex flex-col font-sans text-xs text-black overflow-hidden">
        {/* Title Bar (Classic Windows Aero/Luna style) */}
        <div className="h-7 bg-gradient-to-r from-[#e6e6e6] to-[#d6d6d6] border-b border-[#ababab] px-2 flex items-center justify-between text-black font-normal">
          <div className="flex items-center space-x-1.5 font-semibold text-[11px] text-slate-800">
            {/* Simulink Library icon */}
            <div className="w-4 h-4 bg-[#0284c7] rounded-xs flex items-center justify-center text-white font-bold text-[9px]">
              S
            </div>
            <span>Simulink Library Browser</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center hover:bg-rose-500 hover:text-white rounded-xs transition text-slate-700"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Search Bar */}
        <div className="h-9 bg-[#f7f7f7] border-b border-[#d0d0d0] px-3 flex items-center space-x-3">
          <div className="flex items-center space-x-1 text-slate-500">
            <button className="p-1 hover:bg-slate-200 rounded">
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:bg-slate-200 rounded">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Enter search term"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-6 bg-white border border-[#7f9db9] rounded-xs px-2 text-xs focus:outline-none focus:border-sky-600 text-black"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1.5" />
          </div>

          <div className="flex items-center space-x-1 text-slate-600">
            <button className="p-1 hover:bg-slate-200 rounded" title="Crear Nuevo Modelo">
              <FilePlus className="w-4 h-4 text-slate-700" />
            </button>
            <button className="p-1 hover:bg-slate-200 rounded" title="Abrir Modelo">
              <FolderOpen className="w-4 h-4 text-amber-600" />
            </button>
            <button className="p-1 hover:bg-slate-200 rounded" title="Ayuda">
              <HelpCircle className="w-4 h-4 text-sky-600" />
            </button>
          </div>
        </div>

        {/* Breadcrumb Path */}
        <div className="h-6 bg-[#f0f0f0] border-b border-[#e0e0e0] px-3 flex items-center text-[11px] font-semibold text-slate-700">
          <span>Simulink</span>
          <span className="mx-1 text-slate-400">/</span>
          <span className="text-sky-700 font-bold">
            {searchTerm ? `Resultados: "${searchTerm}"` : selectedSubcat.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Main Content (Left Tree + Right Grid) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Tree Pane */}
          <div className="w-64 bg-white border-r border-[#d0d0d0] overflow-y-auto p-1.5 text-xs text-slate-800">
            {TREE_DATA.map((node) => {
              const isExpanded = !!expandedNodes[node.id];

              return (
                <div key={node.id} className="mb-0.5">
                  <div
                    onClick={() => toggleNode(node.id)}
                    className="flex items-center space-x-1 px-1.5 py-1 hover:bg-[#e8f1fc] cursor-pointer rounded-xs"
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

                  {/* Subcategories */}
                  {isExpanded && node.subcategories && (
                    <div className="pl-4 space-y-0.5 border-l border-slate-200 ml-2.5 mt-0.5">
                      {node.subcategories.map((sub) => {
                        const isSelected = selectedSubcat === sub.id && !searchTerm;

                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              setSelectedSubcat(sub.id);
                              setSearchTerm('');
                            }}
                            className={`px-2 py-0.5 cursor-pointer rounded-xs text-[11px] truncate transition ${
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

          {/* Right: Simulink Block Icons Grid (Identical to Screenshot 1) */}
          <div className="flex-1 bg-white overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-6">
              {currentBlockKeys.map((key) => {
                const def = BLOCK_DEFINITIONS[key];
                if (!def) return null;

                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, key)}
                    onDoubleClick={() => {
                      onAddBlock(key);
                      onClose();
                    }}
                    className="flex flex-col items-center group cursor-grab active:cursor-grabbing hover:bg-sky-50 p-2 rounded border border-transparent hover:border-sky-300 transition select-none"
                    title={`Arrastra o doble-clic para añadir: ${def.description}`}
                  >
                    {/* True Simulink Iconic Visual Block */}
                    <div className="w-16 h-14 bg-white border-[1.5px] border-black rounded-[2px] flex items-center justify-center relative shadow-[1px_1px_0px_rgba(0,0,0,0.2)] group-hover:scale-105 transition-transform">
                      {/* Exact Simulink visual symbols */}
                      {renderSimulinkGlyph(key, def)}
                    </div>

                    {/* Block Name Printed BELOW block in clean text (Screenshot 1) */}
                    <span className="text-[11px] text-center text-slate-800 mt-1.5 font-medium leading-tight max-w-[90px] truncate">
                      {def.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {currentBlockKeys.length === 0 && (
              <div className="text-center text-slate-400 py-12 text-xs">
                No se encontraron bloques con el término "{searchTerm}".
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-6 bg-[#f0f0f0] border-t border-[#d0d0d0] px-3 flex items-center justify-between text-[11px] text-slate-600">
          <span>Arrastra cualquier bloque al lienzo blanco de simulación</span>
          <span className="font-mono text-slate-500">Total: {currentBlockKeys.length} bloques</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Renders the exact black-and-white Simulink vector glyphs seen in Screenshot 1
 */
export function renderSimulinkGlyph(key: string, def?: BlockDefinition) {
  switch (key) {
    case 'constant_source':
      return <span className="font-mono text-base font-bold text-black">1</span>;

    case 'gain':
      return (
        <svg viewBox="0 0 40 30" className="w-10 h-7">
          <polygon points="5,3 35,15 5,27" fill="white" stroke="black" strokeWidth="1.5" />
          <text x="14" y="18" fontSize="10" fontWeight="bold" fill="black" textAnchor="middle">
            K
          </text>
        </svg>
      );

    case 'integrator':
      return (
        <div className="flex flex-col items-center justify-center font-serif text-[12px] font-bold text-black leading-none">
          <span>1</span>
          <div className="w-4 h-[1px] bg-black my-0.5" />
          <span>s</span>
        </div>
      );

    case 'derivative':
      return <span className="font-serif text-[12px] font-bold text-black">du/dt</span>;

    case 'sum':
      return (
        <div className="w-10 h-10 rounded-full border-[1.5px] border-black bg-white flex items-center justify-center text-black font-bold text-xs relative">
          <span className="text-[11px]">+</span>
          <span className="text-[11px] -ml-0.5">-</span>
        </div>
      );

    case 'product':
      return <span className="font-sans text-xl font-bold text-black">×</span>;

    case 'unit_delay':
      return <span className="font-serif text-sm font-bold text-black">z⁻¹</span>;

    case 'scope':
      // The classic Simulink Scope: CRT Monitor with green wave
      return (
        <div className="w-11 h-9 bg-[#222222] border-[1.5px] border-black rounded-[2px] p-0.5 flex flex-col justify-between shadow-inner">
          <div className="w-full h-full bg-[#111111] rounded-[1px] flex items-center justify-center border border-[#333333] relative overflow-hidden">
            <svg viewBox="0 0 30 15" className="w-full h-full">
              <path d="M 2 8 Q 8 2, 15 8 T 28 8" fill="none" stroke="#22c55e" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      );

    case 'sine_source':
      return (
        <svg viewBox="0 0 32 20" className="w-8 h-5">
          <path d="M 2 10 Q 9 2, 16 10 T 30 10" fill="none" stroke="black" strokeWidth="1.8" />
        </svg>
      );

    case 'square_source':
      return (
        <svg viewBox="0 0 32 20" className="w-8 h-5">
          <path d="M 2 14 L 10 14 L 10 6 L 22 6 L 22 14 L 30 14" fill="none" stroke="black" strokeWidth="1.5" />
        </svg>
      );

    case 'triangle_source':
      return (
        <svg viewBox="0 0 32 20" className="w-8 h-5">
          <path d="M 2 15 L 16 5 L 30 15" fill="none" stroke="black" strokeWidth="1.5" />
        </svg>
      );

    case 'step_source':
      return (
        <svg viewBox="0 0 32 20" className="w-8 h-5">
          <path d="M 2 14 L 14 14 L 14 6 L 30 6" fill="none" stroke="black" strokeWidth="1.5" />
        </svg>
      );

    case 'impulse_source':
      return (
        <svg viewBox="0 0 32 20" className="w-8 h-5">
          <path d="M 2 14 L 16 14 L 16 4 L 16 14 L 30 14" fill="none" stroke="black" strokeWidth="1.5" />
          <polygon points="16,2 13,6 19,6" fill="black" />
        </svg>
      );

    case 'noise_source':
      return (
        <svg viewBox="0 0 32 20" className="w-8 h-5">
          <path d="M 2 10 L 6 4 L 10 15 L 14 7 L 18 13 L 22 5 L 26 12 L 30 10" fill="none" stroke="black" strokeWidth="1.3" />
        </svg>
      );

    case 'fir_filter':
      return (
        <div className="flex flex-col items-center">
          <span className="font-bold text-[11px] text-black">FIR</span>
          <span className="font-mono text-[9px] text-slate-600">[ b ]</span>
        </div>
      );

    case 'iir_filter':
      return (
        <div className="flex flex-col items-center">
          <span className="font-bold text-[11px] text-black">IIR</span>
          <span className="font-mono text-[8px] text-slate-600">[b, a]</span>
        </div>
      );

    case 'continuous_tf':
      return (
        <div className="flex flex-col items-center font-serif text-[11px] font-bold text-black leading-none">
          <span>num(s)</span>
          <div className="w-8 h-[1px] bg-black my-0.5" />
          <span>den(s)</span>
        </div>
      );

    case 'discrete_tf':
      return (
        <div className="flex flex-col items-center font-serif text-[11px] font-bold text-black leading-none">
          <span>B(z)</span>
          <div className="w-6 h-[1px] bg-black my-0.5" />
          <span>A(z)</span>
        </div>
      );

    case 'zoh':
      return (
        <div className="flex flex-col items-center justify-center">
          <svg viewBox="0 0 24 16" className="w-6 h-4 mb-0.5">
            <path d="M 2 14 L 8 14 L 8 8 L 16 8 L 16 2 L 22 2" fill="none" stroke="black" strokeWidth="1.4" />
          </svg>
          <span className="font-bold text-[9px] text-black">ZOH</span>
        </div>
      );

    case 'adc':
      return (
        <div className="flex flex-col items-center">
          <span className="font-bold text-[11px] text-amber-700">ADC</span>
          <span className="font-mono text-[8px] text-slate-600">N-bit</span>
        </div>
      );

    case 'dac':
      return (
        <div className="flex flex-col items-center">
          <span className="font-bold text-[11px] text-emerald-700">DAC</span>
          <span className="font-mono text-[8px] text-slate-600">Smooth</span>
        </div>
      );

    case 'spectrum':
      return (
        <div className="w-10 h-8 bg-[#1e293b] rounded-[1px] p-0.5 flex flex-col justify-end">
          <div className="flex items-end justify-between h-5 px-0.5">
            <div className="w-1 h-2 bg-sky-400" />
            <div className="w-1 h-4 bg-sky-400" />
            <div className="w-1 h-3 bg-sky-400" />
            <div className="w-1 h-5 bg-sky-400" />
            <div className="w-1 h-1 bg-sky-400" />
          </div>
        </div>
      );

    case 'audio_sink':
      return (
        <div className="flex flex-col items-center">
          <span className="text-base">🔊</span>
          <span className="text-[9px] font-bold text-black">Audio</span>
        </div>
      );

    case 'wav_source':
      return (
        <div className="flex flex-col items-center">
          <span className="text-base">♫</span>
          <span className="text-[9px] font-bold text-black">.WAV</span>
        </div>
      );

    case 'math_func':
      return <span className="font-serif text-[11px] font-bold text-black">f(u)</span>;

    default:
      return <span className="font-bold text-xs text-black">{key.slice(0, 4)}</span>;
  }
}
