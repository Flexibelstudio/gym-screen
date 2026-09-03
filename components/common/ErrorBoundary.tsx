import React, { Component, ErrorInfo, ReactNode } from 'react';
import { arModulfel, laddaOmForNyVersion } from '../../utils/modulfel';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  nyVersion: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    nyVersion: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, nyVersion: arModulfel(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SmartStudio Error:", error, errorInfo);
    // En ny version har lagts ut medan sidan var oppen: de gamla delfilerna
    // finns inte kvar pa servern, och forsta klicket som behover en av dem
    // faller. Det ar inget verkligt fel — ladda om sjalv, en gang, sa hamtar
    // webblasaren den nya versionen. Anvandaren ser en rad, inte en felsida.
    if (arModulfel(error)) {
      laddaOmForNyVersion();
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.nyVersion) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
            <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl max-w-md">
              <div className="text-5xl mb-4">✨</div>
              <h1 className="text-2xl font-bold text-white mb-2">Ny version</h1>
              <p className="text-gray-400 mb-6 text-sm">
                En nyare version av appen finns. Sidan laddas om automatiskt…
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-teal-500 hover:bg-teal-400 text-white font-bold py-3 px-8 rounded-xl transition-all w-full"
              >
                Ladda om nu
              </button>
            </div>
          </div>
        );
      }

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
