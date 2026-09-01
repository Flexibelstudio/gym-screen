
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { StudioProvider } from './context/StudioContext';
import { AuthProvider } from './context/AuthContext';
import { WorkoutProvider } from './context/WorkoutContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { MotionConfig } from 'framer-motion';
import { ConfirmProvider } from './components/ConfirmContext';
import { startAppUpdateWatcher } from './utils/appUpdate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

startAppUpdateWatcher();

// Gamla skärmar hoppar över glidande övergångar — allt visas direkt i stället.
// Det är övergångarna som gör att varje tillbaka-klick känns trögt där.
let enkelGrafik = false;
try { enkelGrafik = localStorage.getItem('smartstudio-reservinloggning') === '1'; } catch { /* då inte */ }

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion={enkelGrafik ? 'always' : 'user'}>
      <AuthProvider>
        <StudioProvider>
          <WorkoutProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </WorkoutProvider>
        </StudioProvider>
      </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  </React.StrictMode>
);
