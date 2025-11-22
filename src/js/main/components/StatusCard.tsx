import React, { CSSProperties } from 'react';
import { CONFIG } from '../../lib/utils/config';

interface StatusCardProps {
  title: string;
  children: React.ReactNode;
  style?: CSSProperties;
}

export const StatusCard: React.FC<StatusCardProps> = ({ title, children, style }) => {
  const { COLORS } = CONFIG.UI;

  return (
    <div style={{
      padding: '12px',
      backgroundColor: COLORS.SURFACE,
      borderRadius: '6px',
      border: `1px solid ${COLORS.BORDER}`,
      ...style
    }}>
      <div style={{ 
        fontSize: '12px', 
        color: COLORS.TEXT_SECONDARY,
        marginBottom: '6px',
        fontWeight: '500'
      }}>
        {title}
      </div>
      <div style={{ fontSize: '13px' }}>
        {children}
      </div>
    </div>
  );
};

