import { Component, type ReactNode } from 'react';
import { Button } from './ui';

interface Props {
  readonly children: ReactNode;
  readonly fullScreen?: boolean;
  readonly title?: string;
  readonly onReset?: () => void;
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

  componentDidCatch(error: Error): void {
    // Keep local logging lightweight until centralized monitoring is wired in.
    console.error('UI boundary captured an error', error);
  }

  private resetBoundary = () => {
    this.setState({ hasError: false, message: '' });

    if (this.props.onReset) {
      this.props.onReset();
      return;
    }

    if (this.props.fullScreen !== false) {
      globalThis.location.href = '/';
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const fullScreen = this.props.fullScreen !== false;
    const containerClassName = fullScreen
      ? 'min-h-screen flex items-center justify-center px-6'
      : 'w-full min-h-[22rem] flex items-center justify-center px-4 py-8';
    const title = this.props.title ?? 'Что-то пошло не так';

    return (
      <div className={containerClassName} style={{ background: 'var(--c-bg)' }} role="alert">
        <div className="text-center max-w-md">
          <h1
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--c-red)' }}
          >
            {title}
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--c-text-muted)' }}>
            {this.state.message || 'Неизвестная ошибка'}
          </p>
          <Button onClick={this.resetBoundary}>
            {fullScreen ? 'На главную' : 'Повторить'}
          </Button>
        </div>
      </div>
    );
  }
}
