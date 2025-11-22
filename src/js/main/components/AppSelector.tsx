import React, { useState, useEffect } from 'react';
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
  const { COLORS } = CONFIG.UI;

  const loadAudioApps = async () => {
    setIsLoading(true);
    
    try {
      // Use Node.js to execute the Python script
      const { spawn } = require('child_process');
      const path = require('path');
      const os = require('os');
      
      // Get extension root path
      let extensionRoot = '';
      if (typeof window !== 'undefined' && (window as any).__adobe_cep__) {
        extensionRoot = (window as any).__adobe_cep__.getSystemPath('extension');
      }
      
      let decodedPath = '';
      if (os.platform() === 'win32') {
        decodedPath = decodeURIComponent(extensionRoot.replace(/^file:[/\\]*/, ''));
      } else if (os.platform() === 'darwin') {
        decodedPath = '/' + decodeURIComponent(extensionRoot.replace(/^file:\/\//, ''));
      }
      
      // Path to Python script
      const scriptPath = path.join(decodedPath, 'list_audio_apps.py');
      
      // Execute Python script
      const pythonProcess = spawn('python', [scriptPath], {
        cwd: path.dirname(scriptPath),
        windowsHide: true
      });
      
      let output = '';
      
      pythonProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: Buffer) => {
        console.error('[AppSelector] Python error:', data.toString());
      });
      
      pythonProcess.on('close', (code: number) => {
        setIsLoading(false);
        
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            if (result.success) {
              const detectedApps = result.apps || [];
              
              // Add selected apps that are not currently detected
              const detectedExes = new Set(detectedApps.map((app: AudioApp) => app.exe));
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
              const allApps = [...missingSelectedApps, ...detectedApps];
              setAudioApps(allApps);
            } else {
              console.error('[AppSelector] Error from Python:', result.error);
            }
          } catch (e) {
            console.error('[AppSelector] Failed to parse Python output:', e);
          }
        } else {
          console.error('[AppSelector] Python script failed with code:', code);
        }
      });
    } catch (error) {
      console.error('[AppSelector] Failed to load audio apps:', error);
      setIsLoading(false);
    }
  };

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
        <button
          onClick={loadAudioApps}
          disabled={isLoading || connectionStatus !== 'connected'}
          style={{
            padding: '6px 12px',
            background: isLoading ? COLORS.SURFACE_HOVER : `linear-gradient(135deg, ${COLORS.ACCENT} 0%, ${COLORS.ACCENT_HOVER} 100%)`,
            border: `1px solid ${COLORS.BORDER}`,
            borderRadius: '8px',
            color: COLORS.TEXT_PRIMARY,
            fontSize: '11px',
            fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? '🔄 Loading...' : '🔍 Detect Apps'}
        </button>
      </div>

      {audioApps.length === 0 ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: COLORS.TEXT_MUTED,
          fontSize: '13px',
          fontStyle: 'italic'
        }}>
          Click "Detect Apps" to scan for applications playing audio
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
                  {app.priority && !app.inactive && (
                    <span style={{ 
                      fontSize: '12px'
                    }}>
                      ⭐
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
        💡 Play audio in an app, then click "Detect Apps" to find it
      </div>
    </div>
  );
};

