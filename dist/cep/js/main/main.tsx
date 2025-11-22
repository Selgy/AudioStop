// main.tsx
import React, { useState, useEffect } from "react";
import { CONFIG } from "../lib/utils/config";
import { VERSION } from "../lib/utils/version";
import { useWebSocket } from "../lib/utils/useWebSocket";
import { StatusCard } from "./components/StatusCard";
import { ConnectionIndicator } from "./components/ConnectionIndicator";
import { AppSelector } from "./components/AppSelector";

const Main: React.FC = () => {
  const { connectionStatus, sendMessage, lastMessage } = useWebSocket();
  const [mutingEnabled, setMutingEnabled] = useState(true);
  const [unmuteDelay, setUnmuteDelay] = useState(1.0);
  const [selectedApps, setSelectedApps] = useState<string[]>(['chrome.exe', 'firefox.exe', 'Spotify.exe']);

  // Function to send config update to server
  const updateServerConfig = (config: any) => {
    if (connectionStatus === 'connected') {
      sendMessage(JSON.stringify({
        type: 'update_config',
        ...config
      }));
    }
  };

  // Handle app selection changes
  const handleAppSelectionChange = (apps: string[]) => {
    setSelectedApps(apps);
    updateServerConfig({ target_processes: apps });
  };

  const { COLORS } = CONFIG.UI;

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Roboto, Arial, sans-serif',
      color: COLORS.TEXT_PRIMARY,
      background: COLORS.BACKGROUND,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '16px',
        borderBottom: `1px solid ${COLORS.BORDER}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${COLORS.ACCENT} 0%, ${COLORS.ACCENT_HOVER} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: '0 4px 12px rgba(78, 82, 255, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            🔇
          </div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>
            AudioStop
          </h2>
        </div>
        <ConnectionIndicator status={connectionStatus} />
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        flex: 1,
        overflow: 'auto'
      }}>
        {/* Enable/Disable Toggle */}
        <div style={{
          padding: '20px',
          background: COLORS.SURFACE,
          borderRadius: '16px',
          border: `1px solid ${COLORS.BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
              Auto Muting
            </div>
            <div style={{ fontSize: '13px', color: COLORS.TEXT_SECONDARY }}>
              {mutingEnabled ? '✓ Enabled' : '○ Disabled'}
            </div>
          </div>
          <button
            onClick={() => {
              const newValue = !mutingEnabled;
              setMutingEnabled(newValue);
              updateServerConfig({ muting_enabled: newValue });
            }}
            style={{
              width: '56px',
              height: '30px',
              borderRadius: '15px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              position: 'relative',
              background: mutingEnabled 
                ? `linear-gradient(135deg, ${COLORS.ACCENT} 0%, ${COLORS.ACCENT_HOVER} 100%)`
                : 'rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease',
              padding: 0,
              boxShadow: mutingEnabled ? '0 4px 12px rgba(78, 82, 255, 0.4)' : 'none',
              flexShrink: 0
            }}
          >
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '13px',
              backgroundColor: 'white',
              position: 'absolute',
              top: '1px',
              left: mutingEnabled ? '27px' : '2px',
              transition: 'left 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }} />
          </button>
        </div>

        {/* Info */}
        <div style={{
          padding: '16px',
          background: COLORS.SURFACE,
          borderRadius: '16px',
          border: `1px solid ${COLORS.BORDER}`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '12px', color: COLORS.TEXT_SECONDARY, marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ℹ️ INFO
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.6', color: COLORS.TEXT_SECONDARY }}>
            Timeline monitoring is active in the background. Apps will be muted automatically when you play.
          </div>
        </div>

        {/* Unmute Delay */}
        <div style={{
          padding: '20px',
          background: COLORS.SURFACE,
          borderRadius: '16px',
          border: `1px solid ${COLORS.BORDER}`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <label style={{ fontSize: '12px', color: COLORS.TEXT_SECONDARY, display: 'block', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⏱️ UNMUTE DELAY
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="text"
              inputMode="decimal"
              value={unmuteDelay}
              onChange={(e) => {
                const val = e.target.value;
                // Allow typing numbers and decimal point
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  const numVal = parseFloat(val);
                  if (val === '' || (!isNaN(numVal) && numVal >= 0 && numVal <= 10)) {
                    setUnmuteDelay(val === '' ? 0 : numVal);
                  }
                }
              }}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) {
                  updateServerConfig({ unmute_delay_seconds: val });
                }
                e.target.style.borderColor = COLORS.BORDER;
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }}
              placeholder="1.0"
              style={{
                flex: 1,
                padding: '12px 16px',
                background: COLORS.SURFACE,
                border: `1px solid ${COLORS.BORDER}`,
                borderRadius: '12px',
                color: COLORS.TEXT_PRIMARY,
                fontSize: '15px',
                fontWeight: '600',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                textAlign: 'center'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = COLORS.ACCENT;
                e.target.style.boxShadow = '0 4px 20px rgba(78, 82, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }}
            />
            <span style={{ fontSize: '15px', color: COLORS.TEXT_SECONDARY, fontWeight: '600', flexShrink: 0 }}>sec</span>
          </div>
        </div>

        {/* Target Apps */}
        <AppSelector
          selectedApps={selectedApps}
          onSelectionChange={handleAppSelectionChange}
          sendMessage={sendMessage}
          connectionStatus={connectionStatus}
          lastMessage={lastMessage}
        />
      </div>

      {/* Footer */}
      <div style={{
        paddingTop: '16px',
        borderTop: `1px solid ${COLORS.BORDER}`,
        fontSize: '11px',
        color: COLORS.TEXT_MUTED,
        textAlign: 'center',
        fontWeight: '500'
      }}>
        AudioStop v{VERSION.full} • Made with 💜
      </div>
    </div>
  );
};

export default Main;
