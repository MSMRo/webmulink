import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BlockInstance, Connection, Port } from '../types';
import { BLOCK_DEFINITIONS } from '../engine/blocks';
import { ZoomIn, ZoomOut, Maximize2, X, Settings2, ExternalLink } from 'lucide-react';

interface CanvasProps {
  blocks: BlockInstance[];
  connections: Connection[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlockPosition: (id: string, x: number, y: number) => void;
  onDeleteBlock: (id: string) => void;
  onAddConnection: (conn: Omit<Connection, 'id'>) => void;
  onDeleteConnection: (id: string) => void;
  onOpenBlockModal: (block: BlockInstance) => void;
  onOpenScopeModal: (block: BlockInstance) => void;
  onDropBlock: (type: string, x: number, y: number) => void;
}

interface DraggingPort {
  blockId: string;
  portId: string;
  portType: 'input' | 'output';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const Canvas: React.FC<CanvasProps> = ({
  blocks,
  connections,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlockPosition,
  onDeleteBlock,
  onAddConnection,
  onDeleteConnection,
  onOpenBlockModal,
  onOpenScopeModal,
  onDropBlock,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform state: pan & zoom
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Block dragging state
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Wire drawing state
  const [activeWire, setActiveWire] = useState<DraggingPort | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Handle Zoom with Mouse Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.35), 2.2);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Adjust pan to zoom towards mouse position
      const dx = mouseX - pan.x;
      const dy = mouseY - pan.y;
      setPan({
        x: mouseX - dx * (newZoom / zoom),
        y: mouseY - dy * (newZoom / zoom),
      });
      setZoom(newZoom);
    }
  };

  // Convert client coordinates to canvas world coordinates
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Background Mouse Down for Panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.target === containerRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onSelectBlock(null);
      setSelectedConnectionId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingBlockId) {
      const worldPos = clientToWorld(e.clientX, e.clientY);
      const newX = Math.round((worldPos.x - dragOffset.x) / 10) * 10; // Snap to 10px grid
      const newY = Math.round((worldPos.y - dragOffset.y) / 10) * 10;
      onUpdateBlockPosition(draggingBlockId, newX, newY);
      return;
    }

    if (activeWire) {
      const worldPos = clientToWorld(e.clientX, e.clientY);
      setActiveWire((prev) => (prev ? { ...prev, currentX: worldPos.x, currentY: worldPos.y } : null));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingBlockId(null);
    setActiveWire(null);
  };

  // Start dragging a block
  const handleBlockMouseDown = (e: React.MouseEvent, block: BlockInstance) => {
    e.stopPropagation();
    onSelectBlock(block.id);
    setSelectedConnectionId(null);

    const worldPos = clientToWorld(e.clientX, e.clientY);
    setDraggingBlockId(block.id);
    setDragOffset({
      x: worldPos.x - block.x,
      y: worldPos.y - block.y,
    });
  };

  // Start drawing a wire from a port
  const handlePortMouseDown = (e: React.MouseEvent, block: BlockInstance, port: Port) => {
    e.stopPropagation();
    const portPos = getPortPosition(block, port);
    setActiveWire({
      blockId: block.id,
      portId: port.id,
      portType: port.type,
      startX: portPos.x,
      startY: portPos.y,
      currentX: portPos.x,
      currentY: portPos.y,
    });
  };

  // Complete wire connection on target port
  const handlePortMouseUp = (e: React.MouseEvent, targetBlock: BlockInstance, targetPort: Port) => {
    e.stopPropagation();
    if (!activeWire) return;

    // Check compatibility: cannot connect output to output or input to input
    if (activeWire.blockId !== targetBlock.id && activeWire.portType !== targetPort.type) {
      const from = activeWire.portType === 'output' ? activeWire : { blockId: targetBlock.id, portId: targetPort.id };
      const to = activeWire.portType === 'input' ? activeWire : { blockId: targetBlock.id, portId: targetPort.id };

      // Avoid duplicate connections to same input port
      const existing = connections.find((c) => c.toBlockId === to.blockId && c.toPortId === to.portId);
      if (existing) {
        onDeleteConnection(existing.id);
      }

      onAddConnection({
        fromBlockId: from.blockId,
        fromPortId: from.portId,
        toBlockId: to.blockId,
        toPortId: to.portId,
      });
    }

    setActiveWire(null);
  };

  // Drag and Drop from Sidebar
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData('application/webmulink-block-type');
    if (blockType) {
      const worldPos = clientToWorld(e.clientX, e.clientY);
      onDropBlock(blockType, Math.round(worldPos.x / 10) * 10, Math.round(worldPos.y / 10) * 10);
    }
  };

  // Helper to calculate exact port coordinates in canvas space
  const getPortPosition = (block: BlockInstance, port: Port) => {
    const width = block.width || 140;
    const height = block.height || 85;
    const isInput = port.type === 'input';

    const portsList = isInput ? block.inputs : block.outputs;
    const count = portsList.length;
    const spacing = height / (count + 1);
    const yOffset = spacing * (port.index + 1);

    return {
      x: isInput ? block.x : block.x + width,
      y: block.y + yOffset,
    };
  };

  // Keyboard shortcuts (Delete selected block or wire)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBlockId) {
          onDeleteBlock(selectedBlockId);
          onSelectBlock(null);
        } else if (selectedConnectionId) {
          onDeleteConnection(selectedConnectionId);
          setSelectedConnectionId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, selectedConnectionId, onDeleteBlock, onDeleteConnection, onSelectBlock]);

  // Center & Reset View
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 50, y: 50 });
  };

  const handleFitToScreen = () => {
    if (blocks.length === 0) {
      handleResetZoom();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    blocks.forEach((b) => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + (b.width || 140));
      maxY = Math.max(maxY, b.y + (b.height || 85));
    });

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 80;
      const graphWidth = maxX - minX + padding * 2;
      const graphHeight = maxY - minY + padding * 2;
      const newZoom = Math.min(rect.width / graphWidth, rect.height / graphHeight, 1.2);

      setZoom(newZoom);
      setPan({
        x: (rect.width - (maxX + minX) * newZoom) / 2,
        y: (rect.height - (maxY + minY) * newZoom) / 2,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex-1 h-[calc(100vh-3.5rem)] bg-slate-950 overflow-hidden cursor-crosshair select-none"
      style={{
        backgroundImage: `radial-gradient(circle, #334155 1px, transparent 1px)`,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Zoom / Viewport controls */}
      <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-slate-800 rounded-lg shadow-xl p-1 flex items-center space-x-1 z-20 backdrop-blur-sm">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.15, 2.2))}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Acercar (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.85, 0.35))}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Alejar (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetZoom}
          className="px-2 py-1 rounded text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Restablecer zoom al 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleFitToScreen}
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Centrar diagrama completo"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* SVG Canvas for Wires / Connections */}
      <svg
        className="absolute inset-0 pointer-events-none w-full h-full"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <marker
            id="wire-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284c7" />
          </marker>
          <marker
            id="wire-arrow-active"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* Existing Connections */}
        {connections.map((conn) => {
          const fromBlock = blocks.find((b) => b.id === conn.fromBlockId);
          const toBlock = blocks.find((b) => b.id === conn.toBlockId);
          if (!fromBlock || !toBlock) return null;

          const fromPort = fromBlock.outputs.find((p) => p.id === conn.fromPortId);
          const toPort = toBlock.inputs.find((p) => p.id === conn.toPortId);
          if (!fromPort || !toPort) return null;

          const start = getPortPosition(fromBlock, fromPort);
          const end = getPortPosition(toBlock, toPort);

          const isSelected = selectedConnectionId === conn.id;
          const dx = Math.max(Math.abs(end.x - start.x) * 0.5, 40);
          const pathD = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;

          return (
            <g key={conn.id} className="pointer-events-auto cursor-pointer">
              {/* Invisible thicker hit-box path for easy clicking */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedConnectionId(conn.id);
                  onSelectBlock(null);
                }}
              />
              {/* Visible connection wire */}
              <path
                d={pathD}
                fill="none"
                stroke={isSelected ? '#38bdf8' : '#0284c7'}
                strokeWidth={isSelected ? 3 : 2}
                strokeDasharray={isSelected ? '4,4' : undefined}
                markerEnd={isSelected ? 'url(#wire-arrow-active)' : 'url(#wire-arrow)'}
                className="transition-colors hover:stroke-sky-300"
              />
              {/* Port connection dots */}
              <circle cx={start.x} cy={start.y} r={3} fill="#0284c7" />
              <circle cx={end.x} cy={end.y} r={3} fill="#10b981" />
            </g>
          );
        })}

        {/* In-progress Active Wire */}
        {activeWire && (
          <path
            d={`M ${activeWire.startX} ${activeWire.startY} C ${activeWire.startX + 50} ${activeWire.startY}, ${
              activeWire.currentX - 50
            } ${activeWire.currentY}, ${activeWire.currentX} ${activeWire.currentY}`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2.5}
            strokeDasharray="5,5"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Blocks Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {blocks.map((block) => {
          const def = BLOCK_DEFINITIONS[block.type];
          const isSelected = selectedBlockId === block.id;
          const width = block.width || 140;
          const height = block.height || 85;
          const isScopeOrSink = ['scope', 'spectrum', 'audio_sink'].includes(block.type);

          return (
            <div
              key={block.id}
              onMouseDown={(e) => handleBlockMouseDown(e, block)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onOpenBlockModal(block);
              }}
              style={{
                transform: `translate(${block.x}px, ${block.y}px)`,
                width: `${width}px`,
                height: `${height}px`,
              }}
              className={`absolute pointer-events-auto rounded-lg bg-slate-900 border transition-shadow shadow-md select-none group cursor-move ${
                isSelected
                  ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-950/80 shadow-lg'
                  : 'border-slate-700/80 hover:border-slate-500'
              }`}
            >
              {/* Block Header */}
              <div
                className="h-6 px-2 rounded-t-lg flex items-center justify-between text-[11px] font-semibold text-white truncate"
                style={{ backgroundColor: def?.color || '#0284c7' }}
              >
                <span className="truncate">{block.title || def?.name}</span>
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenBlockModal(block);
                    }}
                    className="p-0.5 rounded hover:bg-black/20 text-white/90"
                    title="Parámetros del bloque"
                  >
                    <Settings2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBlock(block.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/20 text-white/90"
                    title="Eliminar bloque"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Block Body / Math representation */}
              <div className="flex-1 h-[calc(100%-1.5rem)] flex flex-col items-center justify-center p-1 text-center relative">
                {/* Symbolic visual badge */}
                <span className="font-mono text-sm font-bold text-slate-200 tracking-wider">
                  {getBlockFormulaPreview(block)}
                </span>
                <span className="text-[9px] text-slate-400 truncate max-w-[120px] mt-0.5">
                  {getBlockParamSummary(block)}
                </span>

                {/* Sinks "Open View" quick button */}
                {isScopeOrSink && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenScopeModal(block);
                    }}
                    className="mt-1 flex items-center space-x-1 px-1.5 py-0.5 rounded bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-800/80 text-[10px] font-medium transition"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>Ver Gráfico</span>
                  </button>
                )}
              </div>

              {/* Input Ports (Left) */}
              {block.inputs.map((port) => {
                const portPos = getPortPosition(block, port);
                const isHovered =
                  activeWire && activeWire.portType === 'output' && activeWire.blockId !== block.id;

                return (
                  <div
                    key={port.id}
                    onMouseDown={(e) => handlePortMouseDown(e, block, port)}
                    onMouseUp={(e) => handlePortMouseUp(e, block, port)}
                    style={{
                      top: `${portPos.y - block.y - 6}px`,
                      left: '-6px',
                    }}
                    className={`absolute w-3 h-3 rounded-full border-2 border-slate-950 bg-emerald-500 hover:scale-125 transition-transform cursor-pointer z-10 ${
                      isHovered ? 'ring-2 ring-emerald-400 animate-ping' : ''
                    }`}
                    title={`Entrada: ${port.name}`}
                  />
                );
              })}

              {/* Output Ports (Right) */}
              {block.outputs.map((port) => {
                const portPos = getPortPosition(block, port);

                return (
                  <div
                    key={port.id}
                    onMouseDown={(e) => handlePortMouseDown(e, block, port)}
                    onMouseUp={(e) => handlePortMouseUp(e, block, port)}
                    style={{
                      top: `${portPos.y - block.y - 6}px`,
                      right: '-6px',
                    }}
                    className="absolute w-3 h-3 rounded-full border-2 border-slate-950 bg-sky-500 hover:scale-125 transition-transform cursor-pointer z-10 hover:bg-sky-400"
                    title={`Salida: ${port.name}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Returns a brief mathematical formula preview string for block center.
 */
function getBlockFormulaPreview(block: BlockInstance): string {
  const p = block.params;
  switch (block.type) {
    case 'sine_source':
      return `~ sin(${p.frequency ?? 50}Hz)`;
    case 'square_source':
      return `⎍ ${p.frequency ?? 20}Hz`;
    case 'triangle_source':
      return `▲ ${p.frequency ?? 20}Hz`;
    case 'noise_source':
      return `〰 Ruido`;
    case 'step_source':
      return `⌐ u(t-${p.stepTime ?? 0.1})`;
    case 'impulse_source':
      return `↑ δ(t)`;
    case 'constant_source':
      return `K = ${p.value ?? 1}`;
    case 'wav_source':
      return `♫ .WAV`;
    case 'gain':
      return `▷ K = ${p.gain ?? 1}`;
    case 'sum':
      return `Σ (${p.signs || '++'})`;
    case 'product':
      return `✕ Product`;
    case 'math_func':
      return `${p.func || 'abs'}(u)`;
    case 'derivative':
      return `d/dt`;
    case 'integrator':
      return `1/s ∫`;
    case 'fir_filter':
      return p.designMode === 'designer' ? `FIR (${p.cutoffFreq ?? 200}Hz)` : `FIR [b]`;
    case 'iir_filter':
      return p.designMode === 'designer' ? `IIR (${p.cutoffFreq ?? 250}Hz)` : `IIR [b,a]`;
    case 'continuous_tf':
      return `H(s)`;
    case 'discrete_tf':
      return `H(z)`;
    case 'unit_delay':
      return p.samples > 1 ? `z⁻${p.samples}` : `z⁻¹`;
    case 'moving_average':
      return `MA(${p.windowSize ?? 5})`;
    case 'zoh':
      return `ZOH (${p.holdFrequency ?? 200}Hz)`;
    case 'adc':
      return `ADC (${p.bits ?? 4}-bit)`;
    case 'dac':
      return `DAC`;
    case 'scope':
      return `📊 Scope`;
    case 'spectrum':
      return `📈 FFT`;
    case 'audio_sink':
      return `🔊 Parlantes`;
    default:
      return block.type;
  }
}

function getBlockParamSummary(block: BlockInstance): string {
  const p = block.params;
  switch (block.type) {
    case 'sine_source':
      return `A = ${p.amplitude ?? 1.0}V`;
    case 'adc':
      return `±${p.vRef ?? 1.0}V, ${p.mode || 'mid-tread'}`;
    case 'fir_filter':
      return p.designMode === 'designer' ? `${p.filterType}, N=${p.order ?? 32}` : `${(p.coefficients || []).length} taps`;
    case 'continuous_tf':
      return `num=[${p.numStr}], den=[${p.denStr}]`;
    case 'discrete_tf':
      return `num=[${p.numStr}], den=[${p.denStr}]`;
    default:
      return '';
  }
}
