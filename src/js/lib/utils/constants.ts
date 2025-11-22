/**
 * Application constants
 */

export const CONSTANTS = {
  // WebSocket
  WS_RECONNECT_ATTEMPTS: 10,
  WS_RECONNECT_DELAY_MS: 3000,
  WS_PORT: 3350,

  // Timeline monitoring
  TIMELINE_CHECK_INTERVAL_MS: 100,
  TIMELINE_DEBOUNCE_FRAMES: 2,

  // Audio control
  DEFAULT_UNMUTE_DELAY_S: 3.0,
  FADE_STEPS: 20,
  FADE_DURATION_MS: 400,

  // UI
  ANIMATION_DURATION_MS: 200,

  // Default processes to mute
  DEFAULT_MUTED_PROCESSES: [
    'chrome.exe',
    'firefox.exe',
    'msedge.exe',
    'brave.exe',
    'opera.exe',
    'Spotify.exe',
    'Discord.exe',
  ],
} as const;

export const MESSAGES = {
  // WebSocket messages
  WS_MUTE: 'mute',
  WS_UNMUTE: 'unmute',
  WS_SHUTDOWN: 'shutdown',

  // User messages
  CONNECTING: 'Connecting to server...',
  CONNECTED: 'Connected',
  DISCONNECTED: 'Server disconnected',
  MUTED: 'Apps muted',
  UNMUTING: 'Unmuting apps...',
} as const;

