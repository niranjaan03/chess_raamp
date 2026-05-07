import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('React error boundary caught:', error, info);
  }

  handleReload() {
    if (typeof window !== 'undefined') window.location.reload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const fallback = this.props.fallback;
    if (typeof fallback === 'function') return fallback(error, this.handleReload);
    if (fallback) return fallback;

    return (
      <div role="alert" style={{
        padding: '24px',
        margin: '24px auto',
        maxWidth: '720px',
        background: '#121417',
        border: '1px solid #3a2222',
        borderRadius: '12px',
        color: '#f3f5f7',
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '18px' }}>Something went wrong.</h2>
        <p style={{ margin: '0 0 12px', color: '#a8b3c2' }}>
          This part of the app hit an exception. Try reloading; if the problem persists,
          report it via the Feedback option.
        </p>
        <pre style={{
          margin: '0 0 16px',
          padding: '12px',
          background: '#0c1016',
          border: '1px solid #2a2f37',
          borderRadius: '8px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '12px',
          color: '#e5b574'
        }}>
          {String(error && (error.stack || error.message || error))}
        </pre>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            border: 0,
            borderRadius: '999px',
            padding: '10px 18px',
            background: '#7dcf82',
            color: '#061108',
            fontWeight: 700,
            cursor: 'pointer'
          }}>
          Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
