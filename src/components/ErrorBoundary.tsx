import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Error de Interfaz]', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-screen" className="min-h-screen bg-[#0a0c10] text-gray-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#131720] border border-red-500/30 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <div>
                <h1 className="text-lg font-bold tracking-wide uppercase">Fallo en la Interfaz</h1>
                <p className="text-xs text-gray-400">Error inesperado en la aplicación de carrera</p>
              </div>
            </div>

            <div className="bg-[#0a0c10] p-3 rounded-lg border border-gray-800 text-xs font-mono text-red-300 break-words">
              {this.state.error?.message || 'Error no especificado'}
            </div>

            <div className="pt-2">
              <button
                id="btn-error-reload"
                onClick={this.handleReload}
                className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reiniciar Pantalla</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
