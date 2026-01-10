import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SmartSkärm Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
          <div className="bg-gray-800 p-8 rounded-2xl border border-red-500/30 shadow-2xl max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Ett fel uppstod</h1>
            <p className="text-gray-400 mb-6 text-sm">
              Appen kunde inte startas korrekt. Detta beror oftast på saknade inställningar (API-nycklar).
            </p>
            <div className="bg-black/30 p-3 rounded mb-6 text-left overflow-auto max-h-32">
                <code className="text-xs text-red-400">{this.state.error?.message}</code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-500 hover:bg-teal-400 text-white font-bold py-3 px-8 rounded-xl transition-all w-full"
            >
              Ladda om sidan
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}