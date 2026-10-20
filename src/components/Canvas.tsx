import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BlockInstance, Connection, Port } from '../types';
import { BLOCK_DEFINITIONS } from '../engine/blocks';
import { renderSimulinkGlyph } from './LibraryBrowserModal';
import { ZoomIn, ZoomOut, Maximize2, Settings2, X, ExternalLink } from 'lucide-react';

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
  isClickMode?: boolean;
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
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Block dragging state
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Wire drawing state (supports both Drag-to-Connect and Click-to-Connect)
  const [activeWire, setActiveWire] = useState<DraggingPort | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [hoveredPortInfo, setHoveredPortInfo] = useState<{ blockId: string; portId: string; name: string } | null>(null);

  // Zoom with Mouse Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.4), 2.2);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const dx = mouseX - pan.x;
      const dy = mouseY - pan.y;
      setPan({
        x: mouseX - dx * (newZoom / zoom),
        y: mouseY - dy * (newZoom / zoom),
      });
      setZoom(newZoom);
    }
  };

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

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeWire && activeWire.isClickMode) {
      // Cancel active wire if clicking on background
      setActiveWire(null);
      return;
    }

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
      const newX = Math.round((worldPos.x - dragOffset.x) / 10) * 10;
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

    // If active wire was just started with a short click (not dragged), keep it in click-mode!
    if (activeWire && !activeWire.isClickMode) {
      const dist = Math.hypot(activeWire.currentX - activeWire.startX, activeWire.currentY - activeWire.startY);
      if (dist < 8) {
        // Switch to click-to-connect mode!
        setActiveWire((prev) => (prev ? { ...prev, isClickMode: true } : null));
      } else {
        // Drag ended without hitting a port
        setActiveWire(null);
      }
    }
  };

  const handleBlockMouseDown = (e: React.MouseEvent, block: BlockInstance) => {
    e.stopPropagation();
    if (activeWire && activeWire.isClickMode) return;

    onSelectBlock(block.id);
    setSelectedConnectionId(null);

    const worldPos = clientToWorld(e.clientX, e.clientY);
    setDraggingBlockId(block.id);
    setDragOffset({
      x: worldPos.x - block.x,
      y: worldPos.y - block.y,
    });
  };

  // Start wire from port (works on both mouse down and click)
  const handlePortMouseDown = (e: React.MouseEvent, block: BlockInstance, port: Port) => {
    e.stopPropagation();

    // If already in click-mode, try connecting to this port!
    if (activeWire && activeWire.isClickMode) {
      completeConnection(block, port);
      return;
    }

    const portPos = getPortPosition(block, port);
    setActiveWire({
      blockId: block.id,
      portId: port.id,
      portType: port.type,
      startX: portPos.x,
      startY: portPos.y,
      currentX: portPos.x,
      currentY: portPos.y,
      isClickMode: false,
    });
  };

  const completeConnection = (targetBlock: BlockInstance, targetPort: Port) => {
    if (!activeWire) return;

    // Check port compatibility (must connect output to input, and not within same block)
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

  const handlePortMouseUp = (e: React.MouseEvent, targetBlock: BlockInstance, targetPort: Port) => {
    e.stopPropagation();
    if (activeWire && !activeWire.isClickMode) {
      completeConnection(targetBlock, targetPort);
    }
  };

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

  const getBlockDimensions = (block: BlockInstance) => {
    const isSum = block.type === 'sum';
    const isGain = block.type === 'gain';
    const isScope = block.type === 'scope' || block.type === 'spectrum';

    if (isSum) return { width: 50, height: 50 };
    if (isGain) return { width: 55, height: 50 };
    if (isScope) return { width: 78, height: 66 }; // comfortable spacing for 4 channels
    return { width: block.width || 72, height: block.height || 56 };
  };

  const getPortPosition = (block: BlockInstance, port: Port) => {
    const { width, height } = getBlockDimensions(block);
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

  // Keyboard shortcut: Delete or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        if (activeWire) setActiveWire(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
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
  }, [selectedBlockId, selectedConnectionId, activeWire, onDeleteBlock, onDeleteConnection, onSelectBlock]);

  // Construct Orthogonal (Manhattan 90-degree) wire path string
  const getOrthogonalPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const dx = end.x - start.x;

    if (dx >= 24) {
      const midX = start.x + Math.round(dx / 2);
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    } else {
      const offsetRight = start.x + 20;
      const offsetLeft = end.x - 20;
      const midY = start.y < end.y ? Math.min(start.y, end.y) - 35 : Math.max(start.y, end.y) + 35;
      return `M ${start.x} ${start.y} L ${offsetRight} ${start.y} L ${offsetRight} ${midY} L ${offsetLeft} ${midY} L ${offsetLeft} ${end.y} L ${end.x} ${end.y}`;
    }
  };

  // Junction points for branching wires
  const junctions = React.useMemo(() => {
    const map = new Map<string, { x: number; y: number; count: number }>();
    connections.forEach((c) => {
      const fromBlock = blocks.find((b) => b.id === c.fromBlockId);
      if (!fromBlock) return;
      const fromPort = fromBlock.outputs.find((p) => p.id === c.fromPortId);
      if (!fromPort) return;
      const key = `${c.fromBlockId}:${c.fromPortId}`;
      const pos = getPortPosition(fromBlock, fromPort);

      if (!map.has(key)) {
        map.set(key, { x: pos.x + 15, y: pos.y, count: 1 });
      } else {
        const item = map.get(key)!;
        item.count += 1;
      }
    });
    return Array.from(map.values()).filter((j) => j.count > 1);
  }, [blocks, connections]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex-1 h-[calc(100vh-4.5rem)] bg-white overflow-hidden select-none ${
        activeWire ? 'cursor-crosshair' : 'cursor-default'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle, #cbd5e1 0.75px, transparent 0.75px)`,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Floating Interactive Guide Banner if wire is active */}
      {activeWire && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#0284c7] text-white px-3.5 py-1.5 rounded-full shadow-lg text-xs font-semibold flex items-center space-x-2 z-30 animate-bounce">
          <span>
            {activeWire.portType === 'output'
              ? 'Conectando señal: Haz clic o suelta en el puerto de entrada de destino'
              : 'Conectando señal: Haz clic o suelta en el puerto de salida de origen'}
          </span>
          <button
            onClick={() => setActiveWire(null)}
            className="bg-sky-800 hover:bg-sky-900 rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
            title="Cancelar"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Zoom Bar */}
      <div className="absolute bottom-4 right-4 bg-[#f8f9fa] border border-[#d0d0d0] rounded shadow-md p-1 flex items-center space-x-1 z-20">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.15, 2.2))}
          className="p-1 rounded text-slate-700 hover:bg-slate-200"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.85, 0.4))}
          className="p-1 rounded text-slate-700 hover:bg-slate-200"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 40, y: 40 });
          }}
          className="px-1.5 py-0.5 text-[11px] font-mono text-slate-700 hover:bg-slate-200"
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>

      {/* SVG Canvas for True Orthogonal Simulink Wires */}
      <svg
        className="absolute inset-0 pointer-events-none w-full h-full"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <marker
            id="simulink-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <polygon points="0,1 10,5 0,9" fill="black" />
          </marker>
          <marker
            id="simulink-arrow-selected"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <polygon points="0,1 10,5 0,9" fill="#0284c7" />
          </marker>
        </defs>

        {/* Existing Orthogonal Connections */}
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
          const pathD = getOrthogonalPath(start, end);

          return (
            <g key={conn.id} className="pointer-events-auto cursor-pointer">
              {/* Invisible wide path for easy clicking */}
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
              {/* Classic Simulink Solid Black Wire */}
              <path
                d={pathD}
                fill="none"
                stroke={isSelected ? '#0284c7' : '#000000'}
                strokeWidth={isSelected ? 2.2 : 1.4}
                markerEnd={isSelected ? 'url(#simulink-arrow-selected)' : 'url(#simulink-arrow)'}
                className="transition-colors hover:stroke-sky-600"
              />
            </g>
          );
        })}

        {/* Junction Dots (where lines branch) */}
        {junctions.map((j, idx) => (
          <circle key={idx} cx={j.x} cy={j.y} r={3} fill="black" />
        ))}

        {/* Live Active Wire when dragging or in click-mode */}
        {activeWire && (
          <path
            d={getOrthogonalPath(
              { x: activeWire.startX, y: activeWire.startY },
              { x: activeWire.currentX, y: activeWire.currentY }
            )}
            fill="none"
            stroke="#0284c7"
            strokeWidth={1.8}
            strokeDasharray="4,4"
          />
        )}
      </svg>

      {/* Blocks Layer (Identical to Screenshot 2) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {blocks.map((block) => {
          const isSelected = selectedBlockId === block.id;
          const isSum = block.type === 'sum';
          const { width, height } = getBlockDimensions(block);
          const isScope = block.type === 'scope' || block.type === 'spectrum' || block.type === 'audio_sink';

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
              className={`absolute pointer-events-auto cursor-move select-none group flex flex-col items-center justify-center ${
                isSum ? 'rounded-full' : 'rounded-[2px]'
              } bg-white border-[1.5px] ${
                isSelected
                  ? 'border-[#0284c7] ring-2 ring-sky-300 shadow-md'
                  : 'border-black shadow-[2px_2px_0px_rgba(0,0,0,0.18)]'
              }`}
            >
              {/* Internal Math Symbol / Simulink Glyph */}
              <div className="w-full h-full flex flex-col items-center justify-center p-1 pointer-events-none">
                {renderSimulinkGlyph(block.type)}
              </div>

              {/* Scope Quick Open button on hover */}
              {isScope && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenScopeModal(block);
                  }}
                  className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 bg-[#0284c7] hover:bg-sky-600 text-white rounded px-1.5 py-0.5 text-[9px] font-bold flex items-center space-x-1 shadow transition"
                  title="Abrir Pantalla"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  <span>Ver</span>
                </button>
              )}

              {/* Block Title Placed BELOW Block */}
              <div
                className="absolute top-full mt-1.5 w-36 -left-9 text-center text-[11px] font-sans text-black leading-tight pointer-events-none break-words"
              >
                {block.title || block.type}
              </div>

              {/* ================= INPUT PORTS (LEFT) ================= */}
              {block.inputs.map((port) => {
                const portPos = getPortPosition(block, port);
                const isTargetCandidate = activeWire && activeWire.portType === 'output' && activeWire.blockId !== block.id;
                const isHovered = hoveredPortInfo?.blockId === block.id && hoveredPortInfo?.portId === port.id;

                return (
                  <div
                    key={port.id}
                    onMouseDown={(e) => handlePortMouseDown(e, block, port)}
                    onMouseUp={(e) => handlePortMouseUp(e, block, port)}
                    onClick={(e) => {
                      if (activeWire && activeWire.isClickMode) {
                        e.stopPropagation();
                        completeConnection(block, port);
                      }
                    }}
                    onMouseEnter={() => setHoveredPortInfo({ blockId: block.id, portId: port.id, name: port.name })}
                    onMouseLeave={() => setHoveredPortInfo(null)}
                    style={{
                      top: `${portPos.y - block.y - 10}px`,
                      left: '-10px',
                    }}
                    className="absolute w-5 h-5 flex items-center justify-center cursor-crosshair z-20 group/port"
                    title={`Puerto de Entrada: ${port.name} (Haz clic o suelta aquí para conectar)`}
                  >
                    {/* Generous visible port marker with pulse animation when wire is dragged */}
                    <div
                      className={`w-2.5 h-2.5 rounded-[1px] transition-all ${
                        isTargetCandidate
                          ? 'bg-[#0284c7] ring-4 ring-sky-400 scale-125 animate-pulse'
                          : 'bg-black hover:bg-[#0284c7] hover:scale-150'
                      } ${isHovered && isTargetCandidate ? 'bg-emerald-500 ring-4 ring-emerald-300 scale-150' : ''}`}
                    />
                  </div>
                );
              })}

              {/* ================= OUTPUT PORTS (RIGHT) ================= */}
              {block.outputs.map((port) => {
                const portPos = getPortPosition(block, port);
                const isTargetCandidate = activeWire && activeWire.portType === 'input' && activeWire.blockId !== block.id;
                const isHovered = hoveredPortInfo?.blockId === block.id && hoveredPortInfo?.portId === port.id;

                return (
                  <div
                    key={port.id}
                    onMouseDown={(e) => handlePortMouseDown(e, block, port)}
                    onMouseUp={(e) => handlePortMouseUp(e, block, port)}
                    onClick={(e) => {
                      if (activeWire && activeWire.isClickMode) {
                        e.stopPropagation();
                        completeConnection(block, port);
                      }
                    }}
                    onMouseEnter={() => setHoveredPortInfo({ blockId: block.id, portId: port.id, name: port.name })}
                    onMouseLeave={() => setHoveredPortInfo(null)}
                    style={{
                      top: `${portPos.y - block.y - 10}px`,
                      right: '-10px',
                    }}
                    className="absolute w-5 h-5 flex items-center justify-center cursor-crosshair z-20 group/port"
                    title={`Puerto de Salida: ${port.name} (Haz clic o arrastra para sacar cable de unión)`}
                  >
                    {/* Generous visible port marker */}
                    <div
                      className={`w-2.5 h-2.5 rounded-[1px] transition-all ${
                        isTargetCandidate
                          ? 'bg-[#0284c7] ring-4 ring-sky-400 scale-125 animate-pulse'
                          : 'bg-black hover:bg-[#0284c7] hover:scale-150'
                      } ${isHovered && isTargetCandidate ? 'bg-emerald-500 ring-4 ring-emerald-300 scale-150' : ''}`}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
