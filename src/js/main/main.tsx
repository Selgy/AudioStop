// main.tsx
import React, { useEffect, useState, useRef } from "react";
import CSInterface from "../lib/cep/csinterface"; // Adjust the path as necessary

interface PlayheadPosition {
  seconds: number;
  ticks: number;
  frameCount: number;
}

interface PositionError {
  error: string;
}

type PositionResult = PlayheadPosition | PositionError;

const Main: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const lastPosition = useRef<number | null>(null);
  const csInterfaceRef = useRef<any>(null);

  useEffect(() => {
    // Initialize CSInterface
    const csInterface = new CSInterface();
    csInterfaceRef.current = csInterface;

    const ws = new WebSocket('ws://localhost:3350');
    ws.onopen = () => {
      console.log('Connected to Rust server');
      setWebsocket(ws);
    };
    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };
    ws.onclose = () => {
      console.log('Disconnected from Rust server');
    };

    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    const monitorTimeline = () => {
      if (!csInterfaceRef.current) {
        console.error("CSInterface not initialized.");
        return;
      }

      // Define the ExtendScript code as a string
      const script = `
        function getPlayheadPosition() {
            try {
                var sequence = app.project.activeSequence;
                if (sequence) {
                    if (typeof sequence.getPlayerPosition === 'function') {
                        var position = sequence.getPlayerPosition();
                        if (position) {
                            var res = {
                                seconds: position.seconds,
                                ticks: position.ticks,
                                frameCount: position.frameCount
                            };
                            return JSON.stringify(res);
                        } else {
                            return JSON.stringify({ error: "Position is undefined" });
                        }
                    } else {
                        return JSON.stringify({ error: "getPlayerPosition() method not found on sequence." });
                    }
                } else {
                    return JSON.stringify({ error: "No active sequence found." });
                }
            } catch (e) {
                var errorObj = {
                    error: e.toString(),
                    fileName: e.fileName ? new File(e.fileName).fsName : "unknown",
                    line: e.line || 0
                };
                return JSON.stringify(errorObj);
            }
        }
        getPlayheadPosition();
      `;

      csInterfaceRef.current.evalScript(script, (result: string) => {
        console.log("Raw result:", result);

        let position: PositionResult;
        if (typeof result === 'string') {
          try {
            position = JSON.parse(result);
          } catch (e) {
            console.error("Failed to parse result as JSON:", e);
            return;
          }
        } else if (typeof result === 'object' && result !== null) {
          position = result as PositionResult;
        } else {
          console.error("Unexpected result type from getPlayheadPosition:", typeof result);
          return;
        }
      
        if ('error' in position) {
          console.log("Error getting playhead position:", position.error);
          return;
        }

        const currentPosition = position.seconds;
        console.log("Current position:", currentPosition);

        if (lastPosition.current !== null) {
          const isMoving = currentPosition > lastPosition.current;
          console.log("Is moving:", isMoving);

          if (isMoving !== isPlaying) {
            setIsPlaying(isMoving);
            if (websocket && websocket.readyState === WebSocket.OPEN) {
              const message = isMoving ? 'mute' : 'unmute';
              console.log("Sending message:", message);
              websocket.send(message);
            } else {
              console.log("WebSocket not ready");
            }
          }
        }

        lastPosition.current = currentPosition;
      });
    };

    const intervalId = setInterval(monitorTimeline, 100); // Every 100ms

    return () => clearInterval(intervalId);
  }, [isPlaying, websocket]);

  return null;
};

export default Main;
