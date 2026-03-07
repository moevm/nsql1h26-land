import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--c-bg)' }}>
        <div className="text-center max-w-md">
          <h1
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--c-red)' }}
          >
            Что-то пошло не так
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--c-text-muted)' }}>
            {this.state.message || 'Неизвестная ошибка'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              globalThis.location.href = '/';
            }}
            className="btn-primary"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }
}
