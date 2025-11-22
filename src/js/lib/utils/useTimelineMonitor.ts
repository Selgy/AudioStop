import { useState, useRef, useEffect } from 'react';
import CSInterface from '../cep/csinterface';
import { CONFIG } from './config';

interface PlayheadPosition {
  seconds: number;
  ticks: number;
  frameCount: number;
}

interface PositionError {
  error: string;
}

type PositionResult = PlayheadPosition | PositionError;

interface UseTimelineMonitorReturn {
  isPlaying: boolean;
  csInterface: any;
}

/**
 * Custom hook for monitoring Premiere Pro timeline playback
 */
export const useTimelineMonitor = (): UseTimelineMonitorReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const lastPosition = useRef<number | null>(null);
  const csInterfaceRef = useRef<any>(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    // Initialize CSInterface
    const csInterface = new CSInterface();
    csInterfaceRef.current = csInterface;
  }, []);

  useEffect(() => {
    const monitorTimeline = () => {
      if (!csInterfaceRef.current) {
        return;
      }

      // ExtendScript to get playhead position
      const script = `
        (function() {
            try {
                var sequence = app.project.activeSequence;
                if (sequence && typeof sequence.getPlayerPosition === 'function') {
                    var position = sequence.getPlayerPosition();
                    if (position) {
                        return JSON.stringify({
                            seconds: position.seconds,
                            ticks: position.ticks,
                            frameCount: position.frameCount
                        });
                    }
                }
                return JSON.stringify({ error: "No active sequence or position unavailable" });
            } catch (e) {
                return JSON.stringify({ error: e.toString() });
            }
        })();
      `;

      csInterfaceRef.current.evalScript(script, (result: string) => {
        let position: PositionResult;
        try {
          position = JSON.parse(result);
        } catch (e) {
          return;
        }
      
        if ('error' in position) {
          return;
        }

        const currentPosition = position.seconds;

        if (lastPosition.current !== null) {
          const isMoving = currentPosition > lastPosition.current;

          // Debounce: only change state if consistent for multiple frames
          if (isMoving !== isPlaying) {
            frameCountRef.current++;
            if (frameCountRef.current >= CONFIG.TIMELINE.DEBOUNCE_FRAMES) {
              setIsPlaying(isMoving);
              frameCountRef.current = 0;
            }
          } else {
            frameCountRef.current = 0;
          }
        }

        lastPosition.current = currentPosition;
      });
    };

    const intervalId = setInterval(monitorTimeline, CONFIG.TIMELINE.CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isPlaying]);

  return {
    isPlaying,
    csInterface: csInterfaceRef.current,
  };
};

