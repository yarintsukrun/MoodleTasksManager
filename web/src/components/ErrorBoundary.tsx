import { Component, type ReactNode } from 'react';

/** Catches render errors (e.g. from not-yet-implemented core functions) and shows a recoverable message. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: unknown }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="alert" role="alert">
        <h2>משהו השתבש בתצוגה הזו</h2>
        <p className="small" style={{ marginBlock: 'var(--space-2)' }}>
          {this.state.error.message}
        </p>
        <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
          נסה שוב
        </button>
      </div>
    );
  }
}
