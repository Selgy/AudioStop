/**
 * Configuration constants for AudioStop
 */

export const CONFIG = {
  // WebSocket configuration
  WEBSOCKET: {
    HOST: 'localhost',
    PORT: 3350,
    RECONNECT_DELAY: 3000,
    MAX_RECONNECT_ATTEMPTS: 10,
  },

  // Timeline monitoring
  TIMELINE: {
    CHECK_INTERVAL: 100, // ms
    DEBOUNCE_FRAMES: 2,
  },

  // UI Configuration
  UI: {
    COLORS: {
      BACKGROUND: 'linear-gradient(135deg, #1e2057 0%, #2e2f77 100%)',
      SURFACE: 'linear-gradient(135deg, #2e2f77 0%, #1e2057 100%)',
      SURFACE_HOVER: 'linear-gradient(135deg, #3e3f87 0%, #2e3067 100%)',
      BORDER: 'rgba(255, 255, 255, 0.1)',
      TEXT_PRIMARY: '#ffffff',
      TEXT_SECONDARY: 'rgba(255, 255, 255, 0.7)',
      TEXT_MUTED: 'rgba(255, 255, 255, 0.5)',
      ACCENT: '#4e52ff',
      ACCENT_HOVER: '#6366f1',
      SUCCESS: '#10b981',
      WARNING: '#f59e0b',
      ERROR: '#ef4444',
    },
  },
} as const;

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

