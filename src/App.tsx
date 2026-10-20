import React, { useState, useEffect, useCallback } from 'react';
import { BlockInstance, Connection, SimulationConfig, SimulationResult } from './types';
import { BLOCK_DEFINITIONS } from './engine/blocks';
import { runSimulation } from './engine/simulationEngine';
import { PRESETS } from './engine/presets';

import { Navbar } from './components/Navbar';
import { Canvas } from './components/Canvas';
import { BlockParamsModal } from './components/BlockParamsModal';
import { ScopeModal } from './components/ScopeModal';
import { AudioPlayerModal } from './components/AudioPlayerModal';
import { HelpModal } from './components/HelpModal';
import { LibraryBrowserModal } from './components/LibraryBrowserModal';

export const App: React.FC = () => {
  // Preset 0 as initial state
  const [config, setConfig] = useState<SimulationConfig>({ ...PRESETS[0].config });
  const [blocks, setBlocks] = useState<BlockInstance[]>([...PRESETS[0].blocks]);
  const [connections, setConnections] = useState<Connection[]>([...PRESETS[0].connections]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<BlockInstance | null>(null);
  const [activeScopeBlock, setActiveScopeBlock] = useState<BlockInstance | null>(null);
  const [activeAudioBlock, setActiveAudioBlock] = useState<BlockInstance | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLibraryBrowserOpen, setIsLibraryBrowserOpen] = useState(false);

  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastExecutionTime, setLastExecutionTime] = useState<number | undefined>(undefined);

  // Execute simulation
  const handleRunSimulation = useCallback(() => {
    setIsSimulating(true);
    try {
      const res = runSimulation(blocks, connections, config);
      setSimulationResult(res);
      setLastExecutionTime(res.executionTimeMs);
    } catch (err) {
      console.error('Error al ejecutar la simulación:', err);
    } finally {
      setIsSimulating(false);
    }
  }, [blocks, connections, config]);

  // Initial simulation run on load
  useEffect(() => {
    handleRunSimulation();
  }, []);

  // Shortcut Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunSimulation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunSimulation]);

  // Add block
  const handleAddBlock = (type: string, x?: number, y?: number) => {
    const def = BLOCK_DEFINITIONS[type];
    if (!def) return;

    const newId = `${type}_${Date.now().toString(36)}`;
    const newBlock: BlockInstance = {
      id: newId,
      type,
      title: def.name,
      x: x !== undefined ? x : 300 + (blocks.length % 6) * 40,
      y: y !== undefined ? y : 150 + (blocks.length % 6) * 30,
      params: { ...def.defaultParams },
      inputs: [...def.inputs],
      outputs: [...def.outputs],
    };

    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newId);
  };

  const handleUpdateBlockPosition = (id: string, x: number, y: number) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, x, y } : b)));
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setConnections((prev) => prev.filter((c) => c.fromBlockId !== id && c.toBlockId !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const handleAddConnection = (conn: Omit<Connection, 'id'>) => {
    const newConn: Connection = {
      ...conn,
      id: `wire_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setConnections((prev) => [...prev, newConn]);
  };

  const handleDeleteConnection = (id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveParams = (blockId: string, newTitle: string, newParams: Record<string, any>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, title: newTitle, params: newParams } : b))
    );
  };

  const handleSelectPreset = (index: number) => {
    const preset = PRESETS[index];
    if (!preset) return;
    setConfig({ ...preset.config });
    setBlocks([...preset.blocks]);
    setConnections([...preset.connections]);
    setSelectedBlockId(null);

    setTimeout(() => {
      const res = runSimulation(preset.blocks, preset.connections, preset.config);
      setSimulationResult(res);
      setLastExecutionTime(res.executionTimeMs);
    }, 50);
  };

  const handleReset = () => {
    setSimulationResult(null);
    setLastExecutionTime(undefined);
  };

  const handleClear = () => {
    if (blocks.length === 0) return;
    if (window.confirm('¿Deseas vaciar todo el lienzo y borrar todos los bloques y conexiones?')) {
      setBlocks([]);
      setConnections([]);
      setSimulationResult(null);
      setSelectedBlockId(null);
    }
  };

  const handleSaveModel = () => {
    const modelData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      config,
      blocks,
      connections,
    };
    const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Simulink_Model_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadModel = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.blocks && data.connections) {
            if (data.config) setConfig(data.config);
            setBlocks(data.blocks);
            setConnections(data.connections);
            setSelectedBlockId(null);
            setTimeout(() => {
              handleRunSimulation();
            }, 50);
          } else {
            alert('Formato de archivo de modelo no válido.');
          }
        } catch (err) {
          alert('Error al leer el archivo JSON.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleOpenScopeModal = (block: BlockInstance) => {
    if (block.type === 'audio_sink') {
      setActiveAudioBlock(block);
    } else {
      setActiveScopeBlock(block);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white font-sans text-slate-900 select-none">
      {/* MATLAB Simulink Classic Top Navigation & Toolbar (Screenshot 2) */}
      <Navbar
        config={config}
        onConfigChange={setConfig}
        onRun={handleRunSimulation}
        onReset={handleReset}
        onClear={handleClear}
        onSave={handleSaveModel}
        onLoad={handleLoadModel}
        onSelectPreset={handleSelectPreset}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenLibraryBrowser={() => setIsLibraryBrowserOpen(true)}
        isSimulating={isSimulating}
        lastExecutionTime={lastExecutionTime}
      />

      {/* Main Canvas Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <Canvas
          blocks={blocks}
          connections={connections}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          onUpdateBlockPosition={handleUpdateBlockPosition}
          onDeleteBlock={handleDeleteBlock}
          onAddConnection={handleAddConnection}
          onDeleteConnection={handleDeleteConnection}
          onOpenBlockModal={(block) => setEditingBlock(block)}
          onOpenScopeModal={handleOpenScopeModal}
          onDropBlock={(type, x, y) => handleAddBlock(type, x, y)}
        />
      </div>

      {/* Classic Simulink Status Bar (Screenshot 2: Ready | 100% | ode45) */}
      <footer className="h-6 bg-[#f0f0f0] border-t border-[#c0c0c0] px-3 flex items-center justify-between text-[11px] font-sans text-slate-700">
        <div className="w-32 flex items-center space-x-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isSimulating ? 'bg-amber-500 animate-ping' : 'bg-emerald-600'
            }`}
          />
          <span className="font-semibold text-slate-800">
            {isSimulating ? 'Running...' : 'Ready'}
          </span>
        </div>

        {/* Center: Progress Bar */}
        <div className="flex items-center space-x-2">
          <div className="w-48 h-3 bg-[#e0e0e0] border border-[#a0a0a0] rounded-xs p-0.5">
            <div className="w-full h-full bg-[#0055ea]" />
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-800">100%</span>
        </div>

        {/* Right: Solver status */}
        <div className="w-32 text-right font-mono text-[11px] text-slate-800">
          ode45 / Dormand-Prince
        </div>
      </footer>

      {/* Simulink Library Browser (Screenshot 1) */}
      <LibraryBrowserModal
        isOpen={isLibraryBrowserOpen}
        onClose={() => setIsLibraryBrowserOpen(false)}
        onAddBlock={(type) => handleAddBlock(type)}
      />

      {/* Block Parameter Modal */}
      {editingBlock && (
        <BlockParamsModal
          block={editingBlock}
          fs={config.fs}
          isOpen={true}
          onClose={() => setEditingBlock(null)}
          onSaveParams={handleSaveParams}
        />
      )}

      {/* Time & Frequency Scopes */}
      {activeScopeBlock && (
        <ScopeModal
          block={activeScopeBlock}
          isOpen={true}
          onClose={() => setActiveScopeBlock(null)}
          connections={connections}
          blocks={blocks}
          simulationResult={simulationResult}
        />
      )}

      {/* Audio Player Modal */}
      {activeAudioBlock && (
        <AudioPlayerModal
          block={activeAudioBlock}
          isOpen={true}
          onClose={() => setActiveAudioBlock(null)}
          connections={connections}
          simulationResult={simulationResult}
        />
      )}

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};
