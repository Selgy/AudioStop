/**
 * Simple logging utility for AudioStop
 */

const LOG_PREFIX = '[AudioStop]';

export const logger = {
  info: (...args: any[]) => {
    console.log(LOG_PREFIX, ...args);
  },

  warn: (...args: any[]) => {
    console.warn(LOG_PREFIX, ...args);
  },

  error: (...args: any[]) => {
    console.error(LOG_PREFIX, ...args);
  },

  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(LOG_PREFIX, ...args);
    }
  },

  group: (label: string) => {
    console.group(`${LOG_PREFIX} ${label}`);
  },

  groupEnd: () => {
    console.groupEnd();
  },
};

// Log startup
logger.info('Initializing...');

