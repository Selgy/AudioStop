/**
 * Version information for AudioStop
 */

export const VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  get full() {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
  buildDate: new Date().toISOString().split('T')[0],
} as const;

export const PLUGIN_INFO = {
  name: 'AudioStop',
  author: 'Your Name',
  description: 'Automatically mute applications when Premiere Pro timeline plays',
  homepage: 'https://github.com/yourusername/audiostop',
} as const;

