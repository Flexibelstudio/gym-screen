import React, { useEffect, useState, useRef, useMemo } from 'react';
import { celebrationMessages } from '../data/celebrationMessages';
import { Workout } from '../types';
import QRCode from 'qrcode';
import { transformWorkoutForQr } from './QRCodeModal';

interface WorkoutCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout;
  isFinalBlock: boolean;
  showQrButton: boolean;
}

const Confetti = React.memo(() => {
    const particles = useMemo(() => Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        style: {
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${8 + Math.random() * 7}s`,
            backgroundColor: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'][Math.floor(Math.random() * 7)],
            transform: `rotate(${Math.random() * 360}deg)`
        }
    })), []);

    return (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0" aria-hidden="true">
            {particles.map(p => (
                <div key={p.id} className="confetti-piece" style={p.style}></div>
            ))}
        </div>
    );
});


const Hearts = React.memo(() => {
    const particles = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
        id: i,
        style: {
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${10 + Math.random() * 5}s`,
            fontSize: `${16 + Math.random() * 16}px`
        }
    })), []);

    return (
        <div className="absolute bottom-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0" aria-hidden="true">
            {particles.map(p => (
                <div key={p.id} className="heart-piece" style={p.style}>♥</div>
            ))}
        </div>
    );
});


export const WorkoutCompleteModal: React.FC<WorkoutCompleteModalProps> = ({ isOpen, onClose, workout, isFinalBlock, showQrButton }) => {
  const [message, setMessage] = useState(celebrationMessages[0]);
  const [showQr, setShowQr] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && isFinalBlock) {
      const randomIndex = Math.floor(Math.random() * celebrationMessages.length);
      setMessage(celebrationMessages[randomIndex]);
    }
    // Reset QR view when modal opens
    setShowQr(false);
  }, [isOpen, isFinalBlock]);

  useEffect(() => {
    if (showQr && canvasRef.current && workout) {
      const qrData = transformWorkoutForQr(workout);
      QRCode.toCanvas(canvasRef.current, qrData, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      }, (error) => {
        if (error) console.error('QR Code Generation Error:', error);
      });
    }
  }, [showQr, workout]);

  if (!isOpen) return null;

  const finalBlockContent = (
    <>
      <Confetti />
      <Hearts />
      <div 
        className="relative bg-gradient-to-br from-primary to-teal-500 rounded-2xl p-8 w-full max-w-lg text-white text-center shadow-2xl border-4 border-yellow-300 animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}
      >
        <div className="text-6xl mb-4">🏆</div>
        
        <h2 id="workout-complete-title" className="text-5xl font-black tracking-wider uppercase drop-shadow-lg">{message.title}</h2>
        <p className="mt-2 text-xl text-white/90">{message.subtitle}</p>
        
        {showQrButton && (
          <div className="mt-8 bg-black/20 p-4 rounded-lg backdrop-blur-sm">
            {!showQr ? (
              <button 
                onClick={() => setShowQr(true)} 
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 text-xl rounded-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
              >
                <span>🎉</span> Logga passet <span>🎉</span>
              </button>
            ) : (
              <div className="animate-fade-in">
                 <h3 className="text-xl font-bold mb-2">Scanna för att logga!</h3>
                 <div className="bg-white p-2 rounded-lg inline-block">
                    <canvas ref={canvasRef} />
                 </div>
                 <button onClick={() => setShowQr(false)} className="text-xs mt-3 text-white/70 hover:text-white underline">Dölj QR-kod</button>
              </div>
            )}
          </div>
        )}
        <button 
            onClick={onClose} 
            className="mt-6 font-semibold text-white/70 hover:text-white transition-colors"
        >
          Stäng
        </button>
      </div>
    </>
  );

  const intermediateBlockContent = (
     <div 
        className="relative bg-teal-600 rounded-xl p-8 w-full max-w-md text-white text-center shadow-2xl border-2 border-teal-500/80 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="workout-complete-title" className="text-4xl font-black tracking-wider uppercase">Block Klart!</h2>
        <p className="mt-2 text-xl text-white/90">Snyggt jobbat, dags för nästa block!</p>
         <button 
            onClick={onClose} 
            className="mt-8 w-full bg-white/90 hover:bg-white text-teal-700 font-bold py-3 rounded-lg transition-colors"
        >
          Färdig med blocket
        </button>
      </div>
  );

  return (
    <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-complete-title"
    >
      {isFinalBlock ? finalBlockContent : intermediateBlockContent}
    </div>
  );
};