export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export enum LaneType {
  ADD = '+',
  SUB = '-',
  MUL = '×',
  DIV = '÷',
}

export interface Block {
  id: number;
  value: number;
  laneIndex: number; // 0 to 3
  y: number; // Percentage 0 to 100
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  text?: string;
}

export const LANE_CONFIG = [
  { type: LaneType.ADD, label: 'ADD', color: 'text-emerald-400', borderColor: 'border-emerald-500/50', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.4)]' },
  { type: LaneType.SUB, label: 'SUB', color: 'text-yellow-400', borderColor: 'border-yellow-500/50', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.4)]' },
  { type: LaneType.MUL, label: 'MUL', color: 'text-fuchsia-400', borderColor: 'border-fuchsia-500/50', glow: 'shadow-[0_0_15px_rgba(232,121,249,0.4)]' },
  { type: LaneType.DIV, label: 'DIV', color: 'text-cyan-400', borderColor: 'border-cyan-500/50', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.4)]' },
];

export const MAX_ENERGY = 100;
export const GAME_DURATION = 60; // Seconds
export const INITIAL_ENERGY = 10;
export const SPAWN_RATE_MS = 2000;