import React, { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center">
          <div className="bg-gray-800 p-8 rounded-2xl border border-red-500/50 shadow-2xl max-w-md">
            <h1 className="text-3xl font-bold text-red-500 mb-4">Ojsan!</h1>
            <p className="text-gray-300 mb-6">
              Något gick fel i systemet. Oroa dig inte, det är bara att ladda om.
            </p>
            <pre className="text-xs text-gray-500 bg-black/30 p-2 rounded mb-6 overflow-auto max-h-32 text-left">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary hover:brightness-110 text-white font-bold py-3 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg w-full"
            >
              Ladda om sidan
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}