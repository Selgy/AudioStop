import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { CONFIG } from '../../lib/utils/config';

interface AudioApp {
  name: string;
  exe: string;
  fullPath: string;
  pid: number;
  priority?: boolean;
  inactive?: boolean;
}

interface AppSelectorProps {
  selectedApps: string[];
  onSelectionChange: (apps: string[]) => void;
  sendMessage: (message: string) => void;
  connectionStatus: string;
  lastMessage: any;
}

export const AppSelector: React.FC<AppSelectorProps> = ({
  selectedApps,
  onSelectionChange,
  sendMessage,
  connectionStatus,
  lastMessage
}) => {
  const [audioApps, setAudioApps] = useState<AudioApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const responseReceivedRef = useRef<boolean>(false);
  const { COLORS } = CONFIG.UI;

  const loadAudioApps = useCallback(async () => {
    if (connectionStatus !== 'connected') {
      console.warn('[AppSelector] Cannot load apps: WebSocket not connected');
      return;
    }
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Reset response flag
    responseReceivedRef.current = false;
    
    setIsLoading(true);
    console.log('[AppSelector] Requesting audio apps list...');
    
    // Timeout safety: stop loading after 10 seconds if no response
    // Store timeout ID in a local variable to check in callback
    const timeoutId = setTimeout(() => {
      // Double-check the flag - if it's true, response was received
      if (responseReceivedRef.current) {
        console.log('[AppSelector] ✓ Timeout callback fired but response was already received - ignoring');
        timeoutRef.current = null;
        return;
      }
      
      // If flag is still false, check if lastMessage has the response (race condition protection)
      // This shouldn't happen, but it's a safety check
      console.warn('[AppSelector] ⚠ Timeout waiting for audio apps response (flag was false)');
      setIsLoading(false);
      
      // Clear the ref
      if (timeoutRef.current === timeoutId) {
        timeoutRef.current = null;
      }
    }, 10000);
    
    timeoutRef.current = timeoutId;
    
    try {
      // Request audio apps list via WebSocket
      sendMessage(JSON.stringify({ type: 'get_audio_apps' }));
    } catch (error) {
      console.error('[AppSelector] Failed to request audio apps:', error);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsLoading(false);
    }
  }, [connectionStatus, sendMessage]);

  // Handle incoming audio apps list from WebSocket
  // Use useLayoutEffect to clear timeout SYNCHRONOUSLY before render
  useLayoutEffect(() => {
    if (lastMessage && lastMessage.type === 'audio_apps_list') {
      // Mark that we received a response IMMEDIATELY
      responseReceivedRef.current = true;
      
      // Clear timeout IMMEDIATELY when we detect the response (synchronous)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        console.log('[AppSelector] ✓ Cleared timeout - response received');
      }
      
      setIsLoading(false);
    }
  }, [lastMessage]); // Depend on lastMessage itself, not just the type, to catch all updates

  // Separate effect to process the apps list
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'audio_apps_list') {
      // Mark response received FIRST, before any processing
      // This ensures the flag is set even if processing takes time
      responseReceivedRef.current = true;
      
      // Clear timeout immediately
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        console.log('[AppSelector] ✓ Cleared timeout - response received (in useEffect)');
      }
      
      setIsLoading(false);
      
      console.log('[AppSelector] ✓ Received audio apps list:', {
        success: lastMessage.success,
        appsCount: lastMessage.apps?.length || 0,
        apps: lastMessage.apps,
        error: lastMessage.error
      });
      
      // Handle error case
      if (lastMessage.success === false) {
        console.error('[AppSelector] Failed to get audio apps:', lastMessage.error);
        // Keep existing apps if available, but clear if we got an error
        if (lastMessage.error) {
          setAudioApps([]);
        }
        return;
      }
      
      // Get apps from response (success can be true or undefined)
      const detectedApps = lastMessage.apps || [];
      console.log('[AppSelector] Processing detected apps:', detectedApps.length);
      
      if (detectedApps.length === 0) {
        console.log('[AppSelector] No audio applications detected.');
      }
      
      // Map server's 'active' field to 'inactive' for UI compatibility
      const processedApps = detectedApps.map((app: any) => ({
        ...app,
        inactive: app.active === false  // Convert active to inactive
      }));
      
      // Add selected apps that are not currently detected
      const detectedExes = new Set(processedApps.map((app: AudioApp) => app.exe));
      const missingSelectedApps = selectedApps
        .filter(exe => !detectedExes.has(exe))
        .map(exe => ({
          name: exe,
          exe: exe,
          fullPath: '',
          pid: 0,
          priority: false,
          inactive: true // Mark as inactive
        }));
      
      // Combine: selected inactive apps first, then detected apps
      const allApps = [...missingSelectedApps, ...processedApps];
      console.log('[AppSelector] ✓ Setting audio apps:', allApps.length, 'total apps');
      console.log('[AppSelector] Apps details:', allApps.map(app => ({ name: app.name, exe: app.exe })));
      setAudioApps(allApps);
    }
  }, [lastMessage, selectedApps]);
  
  // Debug: log when audioApps changes
  useEffect(() => {
    console.log('[AppSelector] audioApps state changed:', audioApps.length, 'apps');
  }, [audioApps]);

  // Auto-load on mount and when connection is established
  useEffect(() => {
    if (connectionStatus === 'connected') {
      // Small delay to ensure WebSocket is fully ready
      const timer = setTimeout(() => {
        loadAudioApps();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, loadAudioApps]);

  const handleToggleApp = (appExe: string) => {
    const newSelection = selectedApps.includes(appExe)
      ? selectedApps.filter(app => app !== appExe)
      : [...selectedApps, appExe];
    
    onSelectionChange(newSelection);
  };

  return (
    <div style={{
      padding: '20px',
      background: COLORS.SURFACE,
      borderRadius: '16px',
      border: `1px solid ${COLORS.BORDER}`,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <label style={{ 
          fontSize: '12px', 
          color: COLORS.TEXT_SECONDARY, 
          fontWeight: '600', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px' 
        }}>
          🎯 APPLICATIONS TO MUTE
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={loadAudioApps}
            disabled={isLoading || connectionStatus !== 'connected'}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '600',
              color: COLORS.TEXT_PRIMARY,
              background: connectionStatus === 'connected' && !isLoading 
                ? COLORS.SURFACE_HOVER 
                : COLORS.BORDER,
              border: `1px solid ${COLORS.BORDER}`,
              borderRadius: '8px',
              cursor: connectionStatus === 'connected' && !isLoading ? 'pointer' : 'not-allowed',
              opacity: connectionStatus === 'connected' && !isLoading ? 1 : 0.5,
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              if (connectionStatus === 'connected' && !isLoading) {
                e.currentTarget.style.background = COLORS.ACCENT;
                e.currentTarget.style.borderColor = COLORS.ACCENT;
              }
            }}
            onMouseLeave={(e) => {
              if (connectionStatus === 'connected' && !isLoading) {
                e.currentTarget.style.background = COLORS.SURFACE_HOVER;
                e.currentTarget.style.borderColor = COLORS.BORDER;
              }
            }}
          >
            🔍 Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: COLORS.TEXT_MUTED,
          fontSize: '13px',
          fontStyle: 'italic'
        }}>
          🔄 Detecting applications...
        </div>
      ) : audioApps.length === 0 ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: COLORS.TEXT_MUTED,
          fontSize: '13px',
          fontStyle: 'italic',
          lineHeight: '1.6'
        }}>
          {connectionStatus === 'connected' ? (
            <>
              <div style={{ marginBottom: '8px' }}>
                No audio applications detected.
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                💡 <strong>Tip:</strong> Known audio applications are detected automatically. Click <strong>Refresh</strong> to scan again.
              </div>
            </>
          ) : (
            'Click "Refresh" to scan for audio applications'
          )}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '300px',
          overflowY: 'auto',
          padding: '8px 0'
        }}>
          {audioApps.map((app) => (
            <label
              key={app.exe}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: selectedApps.includes(app.exe) ? COLORS.SURFACE_HOVER : 'transparent',
                border: `1px solid ${selectedApps.includes(app.exe) ? COLORS.ACCENT : COLORS.BORDER}`,
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                opacity: app.inactive ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!selectedApps.includes(app.exe)) {
                  e.currentTarget.style.background = COLORS.SURFACE_HOVER;
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedApps.includes(app.exe)) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <input
                type="checkbox"
                checked={selectedApps.includes(app.exe)}
                onChange={() => handleToggleApp(app.exe)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: COLORS.ACCENT
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: COLORS.TEXT_PRIMARY,
                  marginBottom: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {app.name}
                  {app.inactive && (
                    <span style={{ 
                      fontSize: '10px',
                      color: COLORS.TEXT_MUTED,
                      fontStyle: 'italic',
                      fontWeight: '400'
                    }}>
                      (not running)
                    </span>
                  )}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: COLORS.TEXT_MUTED,
                  fontFamily: 'monospace'
                }}>
                  {app.exe}
                </div>
              </div>
              {selectedApps.includes(app.exe) && (
                <span style={{ 
                  fontSize: '16px',
                  color: COLORS.SUCCESS
                }}>
                  ✓
                </span>
              )}
            </label>
          ))}
        </div>
      )}

      <div style={{ 
        fontSize: '11px', 
        color: COLORS.TEXT_MUTED, 
        marginTop: '12px', 
        lineHeight: '1.4',
        paddingTop: '12px',
        borderTop: `1px solid ${COLORS.BORDER}`
      }}>
        💡 Known audio applications are detected automatically
      </div>
    </div>
  );
};

