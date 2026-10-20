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

  // Wire drawing state
  const [activeWire, setActiveWire] = useState<DraggingPort | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

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
    setActiveWire(null);
  };

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

  const handlePortMouseUp = (e: React.MouseEvent, targetBlock: BlockInstance, targetPort: Port) => {
    e.stopPropagation();
    if (!activeWire) return;

    if (activeWire.blockId !== targetBlock.id && activeWire.portType !== targetPort.type) {
      const from = activeWire.portType === 'output' ? activeWire : { blockId: targetBlock.id, portId: targetPort.id };
      const to = activeWire.portType === 'input' ? activeWire : { blockId: targetBlock.id, portId: targetPort.id };

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

  const getPortPosition = (block: BlockInstance, port: Port) => {
    const isSum = block.type === 'sum';
    const isGain = block.type === 'gain';
    const width = isSum ? 50 : isGain ? 55 : (block.width || 70);
    const height = isSum ? 50 : isGain ? 50 : (block.height || 54);
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

  // Keyboard shortcut: Delete
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

  // Construct Orthogonal (Manhattan 90-degree) wire path string
  const getOrthogonalPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const dx = end.x - start.x;

    if (dx >= 30) {
      // Standard forward right-angle routing
      const midX = start.x + Math.round(dx / 2);
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    } else {
      // Backward / feedback routing around
      const offsetRight = start.x + 20;
      const offsetLeft = end.x - 20;
      const midY = start.y < end.y ? Math.min(start.y, end.y) - 40 : Math.max(start.y, end.y) + 40;
      return `M ${start.x} ${start.y} L ${offsetRight} ${start.y} L ${offsetRight} ${midY} L ${offsetLeft} ${midY} L ${offsetLeft} ${end.y} L ${end.x} ${end.y}`;
    }
  };

  // Identify junction branching points (where multiple wires leave the same output port)
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
      className="relative flex-1 h-[calc(100vh-4.5rem)] bg-white overflow-hidden cursor-crosshair select-none"
      style={{
        backgroundImage: `radial-gradient(circle, #cbd5e1 0.75px, transparent 0.75px)`,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
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
          {/* Classic solid black arrowhead pointing into ports (Screenshot 2) */}
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
                strokeWidth={isSelected ? 2.0 : 1.3}
                markerEnd={isSelected ? 'url(#simulink-arrow-selected)' : 'url(#simulink-arrow)'}
                className="transition-colors"
              />
              {/* Signal wire label if present */}
              {conn.label && (
                <text
                  x={(start.x + end.x) / 2}
                  y={(start.y + end.y) / 2 - 4}
                  fill="#000000"
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight="normal"
                  textAnchor="middle"
                >
                  {conn.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Junction Dots (Screenshot 2: Filled circle where lines branch) */}
        {junctions.map((j, idx) => (
          <circle key={idx} cx={j.x} cy={j.y} r={3} fill="black" />
        ))}

        {/* Live Active Wire when dragging */}
        {activeWire && (
          <path
            d={getOrthogonalPath(
              { x: activeWire.startX, y: activeWire.startY },
              { x: activeWire.currentX, y: activeWire.currentY }
            )}
            fill="none"
            stroke="#0284c7"
            strokeWidth={1.5}
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
          const isGain = block.type === 'gain';
          const width = isSum ? 50 : isGain ? 55 : (block.width || 70);
          const height = isSum ? 50 : isGain ? 50 : (block.height || 54);
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

              {/* Block Title Placed BELOW Block (Screenshot 2: e.g. "Set Point", "Heater Blower") */}
              <div
                className="absolute top-full mt-1 w-32 -left-8 text-center text-[11px] font-sans text-black leading-tight pointer-events-none break-words"
              >
                {block.title || block.type}
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
                      top: `${portPos.y - block.y - 4}px`,
                      left: '-5px',
                    }}
                    className={`absolute w-2.5 h-2.5 bg-black rounded-[1px] hover:scale-150 transition-transform cursor-pointer z-10 ${
                      isHovered ? 'ring-2 ring-sky-500 scale-125' : ''
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
                      top: `${portPos.y - block.y - 4}px`,
                      right: '-5px',
                    }}
                    className="absolute w-2.5 h-2.5 bg-black rounded-[1px] hover:scale-150 transition-transform cursor-pointer z-10 hover:bg-sky-600"
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
