
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StudioProvider } from './context/StudioContext';
import { AuthProvider } from './context/AuthContext';
import { WorkoutProvider } from './context/WorkoutContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <StudioProvider>
          <WorkoutProvider>
            <App />
          </WorkoutProvider>
        </StudioProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
