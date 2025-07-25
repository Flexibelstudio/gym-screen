import React, { useEffect, useState } from 'react';
import { celebrationMessages } from '../data/celebrationMessages';

interface WorkoutCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Confetti = () => {
    const particles = Array.from({ length: 150 });
    return (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0" aria-hidden="true">
            {particles.map((_, i) => {
                const style: React.CSSProperties = {
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                    animationDuration: `${2 + Math.random() * 3}s`,
                    backgroundColor: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'][Math.floor(Math.random() * 7)],
                    transform: `rotate(${Math.random() * 360}deg)`
                };
                return <div key={i} className="confetti-piece" style={style}></div>;
            })}
        </div>
    );
};

const Hearts = () => {
    const particles = Array.from({ length: 30 });
    return (
        <div className="absolute bottom-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0" aria-hidden="true">
            {particles.map((_, i) => {
                const style: React.CSSProperties = {
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                    animationDuration: `${3 + Math.random() * 4}s`,
                    fontSize: `${16 + Math.random() * 16}px`
                };
                return <div key={i} className="heart-piece" style={style}>♥</div>;
            })}
        </div>
    );
};

export const WorkoutCompleteModal: React.FC<WorkoutCompleteModalProps> = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState(celebrationMessages[0]);

  useEffect(() => {
    if (isOpen) {
      const randomIndex = Math.floor(Math.random() * celebrationMessages.length);
      setMessage(celebrationMessages[randomIndex]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-complete-title"
    >
      <Confetti />
      <Hearts />
      <div 
        className="relative bg-primary rounded-xl p-8 w-full max-w-md text-white text-center shadow-2xl border-2 border-primary/80 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <button 
            onClick={onClose} 
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors font-semibold"
            aria-label="Stäng"
        >
          Stäng
        </button>
        
        <h2 id="workout-complete-title" className="text-4xl font-black tracking-wider uppercase">{message.title}</h2>
        <p className="mt-2 text-xl text-white/90">{message.subtitle}</p>
      </div>
    </div>
  );
};