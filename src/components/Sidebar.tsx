import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Plus, Radio, Cpu, Sliders, Layers, BarChart2 } from 'lucide-react';
import { BLOCK_DEFINITIONS } from '../engine/blocks';
import { BlockCategory, BlockDefinition } from '../types';

interface SidebarProps {
  onAddBlock: (type: string) => void;
}

interface CategoryInfo {
  id: BlockCategory;
  name: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryInfo[] = [
  { id: 'sources', name: 'Fuentes de Señal', icon: <Radio className="w-4 h-4 text-sky-400" /> },
  { id: 'math', name: 'Operaciones Matemáticas', icon: <Sliders className="w-4 h-4 text-emerald-400" /> },
  { id: 'dsp', name: 'DSP y Filtros Digitales', icon: <Cpu className="w-4 h-4 text-purple-400" /> },
  { id: 'mixed_signal', name: 'Muestreo, ADC y DAC', icon: <Layers className="w-4 h-4 text-amber-400" /> },
  { id: 'continuous', name: 'Sistemas Continuos LTI', icon: <Layers className="w-4 h-4 text-pink-400" /> },
  { id: 'sinks', name: 'Salidas y Visualización', icon: <BarChart2 className="w-4 h-4 text-cyan-400" /> },
];

export const Sidebar: React.FC<SidebarProps> = ({ onAddBlock }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    sources: true,
    math: true,
    dsp: true,
    mixed_signal: true,
    continuous: true,
    sinks: true,
  });

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const allBlocks = Object.values(BLOCK_DEFINITIONS);

  const filteredBlocks = searchTerm.trim()
    ? allBlocks.filter(
        (b) =>
          b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.symbol?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : null;

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/webmulink-block-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside className="w-72 bg-slate-900/95 border-r border-slate-800 flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Buscar bloque (FIR, ADC, sin)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Block List / Accordion */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 custom-scrollbar">
        {filteredBlocks ? (
          /* Search Results */
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1">
              Resultados ({filteredBlocks.length})
            </div>
            {filteredBlocks.map((block) => (
              <BlockItem
                key={block.type}
                block={block}
                onAdd={() => onAddBlock(block.type)}
                onDragStart={(e) => handleDragStart(e, block.type)}
              />
            ))}
          </div>
        ) : (
          /* Categorized Accordion */
          CATEGORIES.map((cat) => {
            const catBlocks = allBlocks.filter((b) => b.category === cat.id);
            const isExpanded = !!expandedCategories[cat.id];

            return (
              <div key={cat.id} className="rounded-lg bg-slate-950/40 border border-slate-800/60 overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between px-2.5 py-2 text-left hover:bg-slate-850/50 transition"
                >
                  <div className="flex items-center space-x-2">
                    {cat.icon}
                    <span className="text-xs font-semibold text-slate-200">
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({catBlocks.length})
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-1.5 pb-2 pt-0.5 space-y-1">
                    {catBlocks.map((block) => (
                      <BlockItem
                        key={block.type}
                        block={block}
                        onAdd={() => onAddBlock(block.type)}
                        onDragStart={(e) => handleDragStart(e, block.type)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between bg-slate-950/60">
        <span>Arrastra al lienzo o pulsa (+)</span>
        <span className="font-mono text-[10px] text-sky-400">v1.0.0</span>
      </div>
    </aside>
  );
};

interface BlockItemProps {
  block: BlockDefinition;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const BlockItem: React.FC<BlockItemProps> = ({ block, onAdd, onDragStart }) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onAdd}
      className="group flex items-center justify-between p-2 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800/80 hover:border-sky-700/60 transition cursor-grab active:cursor-grabbing select-none"
      title={block.description}
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        {/* Symbol badge */}
        <div
          className="w-7 h-7 rounded flex items-center justify-center font-mono text-xs font-bold text-white shrink-0 shadow-sm"
          style={{ backgroundColor: block.color || '#3b82f6' }}
        >
          {block.symbol?.slice(0, 3) || '■'}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
            {block.name}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {block.description}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sky-900/60 text-sky-400 transition shrink-0 ml-1"
        title="Agregar al lienzo"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
