import { useState, useRef, useCallback, useEffect } from 'react';
import { CONFIG, ConnectionStatus } from './config';
import { logger } from './logger';

interface UseWebSocketReturn {
  websocket: WebSocket | null;
  connectionStatus: ConnectionStatus;
  sendMessage: (message: string) => void;
}

/**
 * Custom hook for managing WebSocket connection with auto-reconnect
 */
export const useWebSocket = (): UseWebSocketReturn => {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connectWebSocket = useCallback(() => {
    if (reconnectAttemptsRef.current > CONFIG.WEBSOCKET.MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnection attempts reached');
      setConnectionStatus('disconnected');
      return;
    }

    try {
      const ws = new WebSocket(`ws://${CONFIG.WEBSOCKET.HOST}:${CONFIG.WEBSOCKET.PORT}`);
      
      ws.onopen = () => {
        logger.info('Connected to audio server');
        setWebsocket(ws);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onerror = (error) => {
        logger.error('WebSocket Error:', error);
        setConnectionStatus('disconnected');
      };

      ws.onclose = () => {
        logger.info('Disconnected from audio server');
        setConnectionStatus('disconnected');
        setWebsocket(null);
        
        // Auto-reconnect after delay
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          logger.info(`Reconnecting... (attempt ${reconnectAttemptsRef.current})`);
          setConnectionStatus('connecting');
          connectWebSocket();
        }, CONFIG.WEBSOCKET.RECONNECT_DELAY);
      };

      return ws;
    } catch (error) {
      logger.error('Failed to create WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    const ws = connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  const sendMessage = useCallback((message: string) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(message);
      logger.debug(`Sent: ${message}`);
    } else {
      logger.warn('WebSocket not ready, cannot send message:', message);
    }
  }, [websocket]);

  return {
    websocket,
    connectionStatus,
    sendMessage,
  };
};

