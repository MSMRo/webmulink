import React, { useState, useEffect, useCallback } from 'react';
import { BlockInstance, Connection, SimulationConfig, SimulationResult } from './types';
import { BLOCK_DEFINITIONS } from './engine/blocks';
import { runSimulation } from './engine/simulationEngine';
import { PRESETS } from './engine/presets';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { BlockParamsModal } from './components/BlockParamsModal';
import { ScopeModal } from './components/ScopeModal';
import { AudioPlayerModal } from './components/AudioPlayerModal';
import { HelpModal } from './components/HelpModal';

export const App: React.FC = () => {
  // Initial state with Preset 0 (FIR filter noise cancellation demo)
  const [config, setConfig] = useState<SimulationConfig>({ ...PRESETS[0].config });
  const [blocks, setBlocks] = useState<BlockInstance[]>([...PRESETS[0].blocks]);
  const [connections, setConnections] = useState<Connection[]>([...PRESETS[0].connections]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<BlockInstance | null>(null);
  const [activeScopeBlock, setActiveScopeBlock] = useState<BlockInstance | null>(null);
  const [activeAudioBlock, setActiveAudioBlock] = useState<BlockInstance | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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

      if (res.errors && res.errors.length > 0) {
        console.warn('Advertencias durante la simulación:', res.errors);
      }
    } catch (err) {
      console.error('Error al ejecutar la simulación:', err);
    } finally {
      setIsSimulating(false);
    }
  }, [blocks, connections, config]);

  // Run automatically on first mount
  useEffect(() => {
    handleRunSimulation();
  }, []);

  // Keyboard shortcut Ctrl+Enter to run
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

  // Add block to canvas
  const handleAddBlock = (type: string, x?: number, y?: number) => {
    const def = BLOCK_DEFINITIONS[type];
    if (!def) return;

    const newId = `${type}_${Date.now().toString(36)}`;
    const newBlock: BlockInstance = {
      id: newId,
      type,
      title: def.name,
      x: x !== undefined ? x : 350 + (blocks.length % 5) * 40,
      y: y !== undefined ? y : 150 + (blocks.length % 5) * 40,
      params: { ...def.defaultParams },
      inputs: [...def.inputs],
      outputs: [...def.outputs],
    };

    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newId);
  };

  // Update block position
  const handleUpdateBlockPosition = (id: string, x: number, y: number) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, x, y } : b)));
  };

  // Delete block and attached wires
  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setConnections((prev) => prev.filter((c) => c.fromBlockId !== id && c.toBlockId !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  // Add wire connection
  const handleAddConnection = (conn: Omit<Connection, 'id'>) => {
    const newConn: Connection = {
      ...conn,
      id: `wire_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setConnections((prev) => [...prev, newConn]);
  };

  // Delete wire connection
  const handleDeleteConnection = (id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  };

  // Save params from modal
  const handleSaveParams = (blockId: string, newTitle: string, newParams: Record<string, any>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, title: newTitle, params: newParams } : b))
    );
  };

  // Load a predefined DSP preset
  const handleSelectPreset = (index: number) => {
    const preset = PRESETS[index];
    if (!preset) return;
    setConfig({ ...preset.config });
    setBlocks([...preset.blocks]);
    setConnections([...preset.connections]);
    setSelectedBlockId(null);

    // Run automatically after loading preset
    setTimeout(() => {
      const res = runSimulation(preset.blocks, preset.connections, preset.config);
      setSimulationResult(res);
      setLastExecutionTime(res.executionTimeMs);
    }, 50);
  };

  // Reset simulation
  const handleReset = () => {
    setSimulationResult(null);
    setLastExecutionTime(undefined);
  };

  // Clear diagram
  const handleClear = () => {
    if (blocks.length === 0) return;
    if (window.confirm('¿Deseas vaciar todo el lienzo y borrar todos los bloques y conexiones?')) {
      setBlocks([]);
      setConnections([]);
      setSimulationResult(null);
      setSelectedBlockId(null);
    }
  };

  // Save model as JSON file
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
    a.download = `Webmulink_Model_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load model from JSON file
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

  // Open Scope or Audio Player modal depending on block type
  const handleOpenScopeModal = (block: BlockInstance) => {
    if (block.type === 'audio_sink') {
      setActiveAudioBlock(block);
    } else {
      setActiveScopeBlock(block);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Top Navigation Bar */}
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
        isSimulating={isSimulating}
        lastExecutionTime={lastExecutionTime}
      />

      {/* Main Workspace (Sidebar + Canvas) */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onAddBlock={(type) => handleAddBlock(type)} />

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

      {/* Modals */}
      {editingBlock && (
        <BlockParamsModal
          block={editingBlock}
          fs={config.fs}
          isOpen={true}
          onClose={() => setEditingBlock(null)}
          onSaveParams={handleSaveParams}
        />
      )}

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

      {activeAudioBlock && (
        <AudioPlayerModal
          block={activeAudioBlock}
          isOpen={true}
          onClose={() => setActiveAudioBlock(null)}
          connections={connections}
          simulationResult={simulationResult}
        />
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};
