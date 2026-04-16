import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="glass-card p-8 rounded-[2rem] max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
              ⚠️
            </div>
            <h2 className="text-2xl font-serif text-church-secondary mb-4 italic">Ops! Algo deu errado.</h2>
            <p className="text-stone-600 mb-8">
              Ocorreu um erro inesperado na aplicação. Por favor, tente recarregar a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-church-primary text-white py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
            >
              Recarregar Aplicativo
            </button>
            
            {this.state.error && (
              <div className="mt-8 text-left">
                <p className="text-[10px] text-stone-400 uppercase font-bold mb-2 tracking-widest">Detalhes do Erro:</p>
                <pre className="text-[10px] bg-stone-100 p-4 rounded-xl overflow-auto max-h-40 text-red-800 font-mono border border-red-100">
                  {this.state.error.message}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
