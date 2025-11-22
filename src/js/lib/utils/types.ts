/**
 * Type definitions for AudioStop
 */

// WebSocket message types
export type WSMessage = 'mute' | 'unmute' | 'shutdown';

// Timeline state
export interface TimelineState {
  isPlaying: boolean;
  currentPosition: number | null;
  lastUpdate: number;
}

// Server configuration
export interface ServerConfig {
  host: string;
  port: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
}

// Application state
export interface AppState {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  timelineState: TimelineState;
  lastMuteAction: string;
  error: Error | null;
}

// CEP ExtendScript result types
export interface PlayheadPosition {
  seconds: number;
  ticks: number;
  frameCount: number;
}

export interface ExtendScriptError {
  error: string;
  fileName?: string;
  line?: number;
}

export type ExtendScriptResult<T> = T | ExtendScriptError;

// Utility types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event types
export interface TimelineEvent {
  type: 'play' | 'pause' | 'stop';
  timestamp: number;
  position: number;
}

export interface ConnectionEvent {
  type: 'open' | 'close' | 'error';
  timestamp: number;
  message?: string;
}

