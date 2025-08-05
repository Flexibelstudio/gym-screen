import React, { useEffect, useState, useMemo } from 'react';
import { celebrationMessages } from '../data/celebrationMessages';
import { Workout } from '../types';

interface WorkoutCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout;
  isFinalBlock: boolean;
  blockTag?: string;
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


export const WorkoutCompleteModal: React.FC<WorkoutCompleteModalProps> = ({ isOpen, onClose, workout, isFinalBlock, blockTag }) => {
  const [message, setMessage] = useState(celebrationMessages[0]);

  useEffect(() => {
    if (isOpen && isFinalBlock) {
      const randomIndex = Math.floor(Math.random() * celebrationMessages.length);
      setMessage(celebrationMessages[randomIndex]);
    }
  }, [isOpen, isFinalBlock]);

  if (!isOpen) return null;

  const isWarmup = blockTag === 'Uppvärmning';

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

  const warmupContent = (
    <div 
       className="relative bg-teal-600 rounded-xl p-8 w-full max-w-md text-white text-center shadow-2xl border-2 border-teal-500/80 animate-fade-in"
       onClick={e => e.stopPropagation()}
     >
       <h2 id="workout-complete-title" className="text-4xl font-black tracking-wider uppercase">Uppvärmning klar!</h2>
       <p className="mt-2 text-xl text-white/90">Hoppas du är redo för passet!</p>
        <button 
           onClick={onClose} 
           className="mt-8 w-full bg-white/90 hover:bg-white text-teal-700 font-bold py-3 rounded-lg transition-colors"
       >
         Färdig med uppvärmningen
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
      {isWarmup ? warmupContent : isFinalBlock ? finalBlockContent : intermediateBlockContent}
    </div>
  );
};