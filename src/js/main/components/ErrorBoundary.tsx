import React from 'react';
import { CONFIG } from '../../lib/utils/config';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { COLORS } = CONFIG.UI;

      return (
        <div style={{
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: COLORS.TEXT_PRIMARY,
          backgroundColor: COLORS.BACKGROUND,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <div style={{
            fontSize: '48px',
            color: COLORS.ERROR
          }}>
            ⚠️
          </div>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600'
          }}>
            Something went wrong
          </h2>
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: COLORS.TEXT_SECONDARY,
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            An error occurred while loading the panel. Please reload Premiere Pro or check the console for details.
          </p>
          {this.state.error && (
            <div style={{
              padding: '12px',
              backgroundColor: COLORS.SURFACE,
              borderRadius: '6px',
              border: `1px solid ${COLORS.BORDER}`,
              fontSize: '11px',
              fontFamily: 'monospace',
              color: COLORS.ERROR,
              maxWidth: '400px',
              overflow: 'auto'
            }}>
              {this.state.error.message}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

