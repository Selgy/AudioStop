import React from 'react';
import { CONFIG, ConnectionStatus } from '../../lib/utils/config';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ status }) => {
  const { COLORS } = CONFIG.UI;

  const statusConfig = {
    connected: { color: COLORS.SUCCESS, text: 'Connected', icon: '●' },
    connecting: { color: COLORS.WARNING, text: 'Connecting', icon: '◐' },
    disconnected: { color: COLORS.ERROR, text: 'Offline', icon: '○' }
  };

  const { color, text, icon } = statusConfig[status];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 14px',
      background: COLORS.SURFACE,
      borderRadius: '10px',
      border: `1px solid ${COLORS.BORDER}`,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)'
    }}>
      <span style={{
        fontSize: '12px',
        color: color,
        animation: status === 'connecting' ? 'pulse 1.5s ease-in-out infinite' : 'none',
        filter: status === 'connected' ? 'drop-shadow(0 0 4px currentColor)' : 'none'
      }}>
        {icon}
      </span>
      <span style={{ fontSize: '12px', color: COLORS.TEXT_SECONDARY, fontWeight: '600' }}>
        {text}
      </span>
    </div>
  );
};

