import React, { useState, useEffect, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="glass-card p-8 rounded-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-serif text-church-secondary mb-4">Ops! Algo deu errado.</h2>
          <p className="text-stone-600 mb-6">
            Ocorreu um erro inesperado. Por favor, tente recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-church-primary text-white px-6 py-2 rounded-full hover:opacity-90 transition-opacity"
          >
            Recarregar
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-6 text-left text-xs bg-stone-100 p-4 rounded overflow-auto max-h-40">
              {error?.message}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
