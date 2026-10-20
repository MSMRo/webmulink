export type BlockCategory = 
  | 'sources'
  | 'math'
  | 'dsp'
  | 'mixed_signal'
  | 'continuous'
  | 'sinks';

export interface Port {
  id: string;
  name: string;
  type: 'input' | 'output';
  index: number;
}

export interface BlockDefinition {
  type: string;
  name: string;
  category: BlockCategory;
  description: string;
  defaultParams: Record<string, any>;
  inputs: Port[];
  outputs: Port[];
  symbol?: string;
  iconName?: string;
  color?: string;
}

export interface BlockInstance {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  params: Record<string, any>;
  inputs: Port[];
  outputs: Port[];
}

export interface Connection {
  id: string;
  fromBlockId: string;
  fromPortId: string;
  toBlockId: string;
  toPortId: string;
  label?: string;
}

export interface SimulationConfig {
  fs: number; // Sampling frequency in Hz (e.g. 10000, 44100)
  duration: number; // Duration in seconds (e.g. 1.0)
  timeStep: number; // 1 / fs
}

export interface SimulationResult {
  signals: Map<string, Float64Array>; // key: `${blockId}:${portId}`
  time: Float64Array;
  fs: number;
  duration: number;
  sampleCount: number;
  executionTimeMs: number;
  errors?: string[];
  logs?: string[];
}

export interface PresetModel {
  name: string;
  description: string;
  config: SimulationConfig;
  blocks: BlockInstance[];
  connections: Connection[];
}
