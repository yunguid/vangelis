import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-card tier-support">
            <div className="error-boundary-header">
              <h1>Audio Engine Error</h1>
              <span className="error-badge">Error Detected</span>
            </div>
            
            <div className="error-boundary-content">
              <p className="error-message">
                The synthesizer encountered an unexpected error. This might be due to browser compatibility or a temporary issue.
              </p>
              
              {this.state.error && (
                <details className="error-details">
                  <summary>Technical Details</summary>
                  <pre className="error-stack">
                    <code>
                      {this.state.error.toString()}
                      {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </code>
                  </pre>
                </details>
              )}
            </div>

            <div className="error-boundary-actions">
              <button 
                className="button-primary" 
                onClick={this.handleReload}
              >
                Reload Application
              </button>
              <button 
                className="button-link" 
                onClick={this.handleReset}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


