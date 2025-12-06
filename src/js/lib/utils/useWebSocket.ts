import { useState, useRef, useCallback, useEffect } from 'react';
import { CONFIG, ConnectionStatus } from './config';
import { logger } from './logger';

interface UseWebSocketReturn {
  websocket: WebSocket | null;
  connectionStatus: ConnectionStatus;
  sendMessage: (message: string) => void;
  lastMessage: any;
}

/**
 * Custom hook for managing WebSocket connection with auto-reconnect
 */
export const useWebSocket = (): UseWebSocketReturn => {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isInitialConnectionRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const connectWebSocketRef = useRef<(() => void) | null>(null);

  const connectWebSocket = useCallback(() => {
    if (reconnectAttemptsRef.current > CONFIG.WEBSOCKET.MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnection attempts reached');
      setConnectionStatus('disconnected');
      return;
    }

    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      try {
        wsRef.current.close();
      } catch (e) {
        // Ignore errors when closing
      }
    }

    try {
      const ws = new WebSocket(`ws://${CONFIG.WEBSOCKET.HOST}:${CONFIG.WEBSOCKET.PORT}`);
      wsRef.current = ws;
      
      ws.onopen = () => {
        logger.info('Connected to audio server');
        setWebsocket(ws);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        isInitialConnectionRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Update lastMessage immediately to trigger useEffect
          setLastMessage(data);
          logger.info(`📨 Received message: ${data.type || 'unknown'}`, data);
          if (data.type === 'audio_apps_list') {
            logger.info(`✓ Received audio apps list: ${data.apps?.length || 0} apps, success: ${data.success !== false}`);
          } else if (data.type === 'config_data') {
            logger.info(`✓ Received config data: muting=${data.muting_enabled}, delay=${data.unmute_delay_seconds}s`);
          }
        } catch (e) {
          logger.warn('Received non-JSON message:', event.data);
        }
      };

      ws.onerror = (error) => {
        // Only log error if it's not the initial connection attempt
        // Initial connection failures are expected if server isn't ready yet
        if (!isInitialConnectionRef.current) {
          logger.error('WebSocket Error:', error);
        } else {
          logger.debug('WebSocket connection attempt (server may not be ready yet)');
        }
        setConnectionStatus('disconnected');
      };

      ws.onclose = (event) => {
        // Don't log disconnection if it's the initial connection and server wasn't ready
        if (!isInitialConnectionRef.current || event.code !== 1006) {
          logger.info('Disconnected from audio server');
        }
        setConnectionStatus('disconnected');
        setWebsocket(null);
        wsRef.current = null;
        
        // Auto-reconnect after delay
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          logger.info(`Reconnecting... (attempt ${reconnectAttemptsRef.current})`);
          setConnectionStatus('connecting');
          if (connectWebSocketRef.current) {
            connectWebSocketRef.current();
          }
        }, CONFIG.WEBSOCKET.RECONNECT_DELAY);
      };

      return ws;
    } catch (error) {
      logger.error('Failed to create WebSocket:', error);
      setConnectionStatus('disconnected');
      return null;
    }
  }, []);

  // Store the function in a ref so it can be called from callbacks
  connectWebSocketRef.current = connectWebSocket;

  useEffect(() => {
    // Add a small delay for initial connection to allow server to start
    const initialDelay = isInitialConnectionRef.current ? 2500 : 0;
    
    const timeoutId = setTimeout(() => {
      connectWebSocket();
    }, initialDelay);

    return () => {
      clearTimeout(timeoutId);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          // Ignore errors when closing
        }
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - we only want this to run once on mount

  const sendMessage = useCallback((message: string) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(message);
      logger.info(`Sent message: ${message}`);
    } else {
      logger.warn('WebSocket not ready, cannot send message:', message, 'State:', websocket?.readyState);
    }
  }, [websocket]);

  return {
    websocket,
    connectionStatus,
    sendMessage,
    lastMessage,
  };
};

