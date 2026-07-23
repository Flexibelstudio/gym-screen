import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { celebrationMessages } from '../data/celebrationMessages';
import { Workout, WorkoutResult } from '../types';
import { saveWorkoutResult } from '../services/firebaseService';

interface WorkoutCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout;
  isFinalBlock: boolean;
  blockTag?: string;
  finishTime?: number;
  organizationId?: string;
  isRegistration?: boolean;
}

export const Confetti = React.memo(() => {
    const particles = useMemo(() => Array.from({ length: 80 }).map((_, i) => ({
        id: i,
        style: {
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
            backgroundColor: ['#10b981', '#059669', '#34d399', '#f59e0b', '#fbbf24', '#6366f1', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 8)],
            transform: `rotate(${Math.random() * 360}deg)`
        }
    })), []);

    return createPortal(
        <div className="fixed inset-0 pointer-events-none z-[11000] overflow-hidden" aria-hidden="true">
            {particles.map(p => (
                <div key={p.id} className="confetti-piece" style={p.style}></div>
            ))}
        </div>,
        document.body
    );
});

export const Hearts = React.memo(() => {
    const heartParticles = useMemo(() => Array.from({ length: 25 }).map((_, i) => ({
        id: i,
        style: {
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 6}s`,
            animationDuration: `${6 + Math.random() * 5}s`,
            fontSize: `${20 + Math.random() * 30}px`,
            transform: `rotate(${Math.random() * 20 - 10}deg)`
        }
    })), []);

    return createPortal(
        <div className="fixed inset-0 pointer-events-none z-[10999] overflow-hidden" aria-hidden="true">
            {heartParticles.map(p => (
                <div key={p.id} className="heart-piece" style={p.style}>♥</div>
            ))}
        </div>,
        document.body
    );
});

const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const LOCAL_STORAGE_NAME_KEY = 'hyrox-participant-name';

export const WorkoutCompleteModal: React.FC<WorkoutCompleteModalProps> = ({
  isOpen,
  onClose,
  workout,
  isFinalBlock,
  blockTag,
  finishTime,
  organizationId,
  isRegistration = false
}) => {
  const [message, setMessage] = useState(celebrationMessages[0]);
  const [participantName, setParticipantName] = useState(() => localStorage.getItem(LOCAL_STORAGE_NAME_KEY) || '');
  const [isSaving, setIsSaving] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);
  const [lastSavedName, setLastSavedName] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (isFinalBlock) {
        const randomIndex = Math.floor(Math.random() * celebrationMessages.length);
        setMessage(celebrationMessages[randomIndex]);
      }
      setParticipantName(localStorage.getItem(LOCAL_STORAGE_NAME_KEY) || '');
      setIsSaving(false);
      setResultSaved(false);
      setLastSavedName('');
    }
  }, [isOpen, isFinalBlock]);

  if (!isOpen) return null;

  const isHyroxRace = workout.id.startsWith('hyrox-full-race') && isFinalBlock && finishTime !== undefined;
  const isRegistrationView = isHyroxRace || isRegistration;
  const isWarmup = blockTag === 'Uppvärmning';
  const showCelebrationEffects = isFinalBlock || isRegistrationView;

  const handleSaveResult = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!participantName.trim() || !organizationId || finishTime === undefined) return;
      
      setIsSaving(true);
      const nameToSave = participantName.trim();
      try {
          const result: WorkoutResult = {
              id: `result-${Date.now()}`,
              workoutId: workout.id,
              workoutTitle: workout.title,
              organizationId: organizationId,
              participantName: nameToSave,
              finishTime: finishTime,
              completedAt: Date.now(),
          };
          await saveWorkoutResult(result);
          localStorage.setItem(LOCAL_STORAGE_NAME_KEY, nameToSave);
          
          setLastSavedName(nameToSave);
          setResultSaved(true);
          setParticipantName('');

          setTimeout(() => {
            setResultSaved(false);
            setLastSavedName('');
            setIsSaving(false);
          }, 3000);

      } catch (error) {
          console.error("Failed to save workout result:", error);
          alert("Kunde inte spara resultatet.");
          setIsSaving(false);
      }
  };

  const handleClose = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
  };

  const renderModalContent = () => {
    if (isRegistrationView) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.12 }}
          className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-lg text-gray-900 dark:text-white text-center shadow-2xl border-2 border-primary/30 z-[11001]"
          onClick={e => e.stopPropagation()}
        >
          <div className="text-6xl mb-4 drop-shadow">🏆</div>
          
          <h2 id="workout-complete-title" className="text-3xl sm:text-4xl font-black tracking-tight uppercase mb-4 text-gray-900 dark:text-white">
              {isRegistration ? 'Registrera Tid' : 'Loppet Klart!'}
          </h2>
          
          <div className="bg-gray-50 dark:bg-gray-950/80 rounded-3xl p-6 mb-8 border border-gray-200 dark:border-gray-800">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-400 mb-1">Officiell Tid</p>
              <p className="font-mono text-6xl sm:text-7xl font-black text-primary drop-shadow-sm">{formatTime(finishTime || 0)}</p>
          </div>
          
          {!resultSaved ? (
              <form onSubmit={handleSaveResult} className="space-y-4">
                  <div className="relative">
                      <input
                          type="text"
                          value={participantName}
                          onChange={(e) => setParticipantName(e.target.value)}
                          placeholder="Ditt namn..."
                          className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center p-4 sm:p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all font-black text-xl placeholder-gray-400 dark:placeholder-gray-500"
                          required
                          disabled={isSaving}
                          autoFocus
                      />
                  </div>
                   <button 
                      type="submit"
                      disabled={isSaving || !participantName.trim()}
                      className="w-full bg-primary hover:brightness-110 text-white font-black py-4 sm:py-5 rounded-2xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 text-lg uppercase tracking-wider cursor-pointer active:scale-98"
                  >
                    {isSaving ? 'Sparar...' : 'Spara på topplistan'}
                  </button>
              </form>
          ) : (
              <div className="py-6 text-center animate-fade-in">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl text-green-600 dark:text-green-400 font-bold">✓</span>
                  </div>
                  <p className="text-2xl font-black text-green-600 dark:text-green-400 uppercase tracking-tight">Snyggt {lastSavedName}!</p>
                  <p className="text-gray-500 dark:text-gray-400 font-medium mt-1 text-sm">Ditt resultat är sparat.</p>
              </div>
          )}
          
          <button 
              onClick={handleClose} 
              className="mt-6 w-full text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 dark:hover:text-white py-2 transition-colors cursor-pointer"
          >
            Stäng fönstret
          </button>
        </motion.div>
      );
    }

    if (isFinalBlock) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.12 }}
          className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-12 w-full max-w-lg text-gray-900 dark:text-white text-center shadow-2xl border-2 border-amber-500/30 overflow-hidden z-[11001]"
          onClick={e => e.stopPropagation()}
        >
          {/* Subtle warm ambient background glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="text-6xl sm:text-7xl mb-4 animate-bounce">🏆</div>
            <h2 id="workout-complete-title" className="text-3xl sm:text-5xl font-black tracking-tight uppercase mb-3 text-gray-900 dark:text-white drop-shadow-sm">
              {message.title}
            </h2>
            <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 font-semibold leading-relaxed mb-6 max-w-md mx-auto">
              {message.subtitle}
            </p>

            {finishTime !== undefined && finishTime > 0 && (
              <div className="bg-gray-50 dark:bg-gray-950/80 rounded-2xl p-4 mb-8 border border-gray-200 dark:border-gray-800 inline-block px-8 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-0.5">Total Tid</p>
                <p className="font-mono text-4xl sm:text-5xl font-black text-primary">{formatTime(finishTime)}</p>
              </div>
            )}

            <button 
              onClick={handleClose} 
              className="w-full bg-primary hover:brightness-110 text-white font-black py-5 px-8 rounded-2xl text-xl shadow-xl shadow-primary/25 transition-all transform hover:scale-[1.02] active:scale-98 uppercase tracking-wider cursor-pointer"
            >
              Klar
            </button>
          </div>
        </motion.div>
      );
    }

    if (isWarmup) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.12 }}
          className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-md text-gray-900 dark:text-white text-center shadow-2xl border-2 border-orange-500/30 z-[11001]" 
          onClick={e => e.stopPropagation()}
        >
          <div className="text-5xl mb-3">🔥</div>
          <h2 id="workout-complete-title" className="text-3xl sm:text-4xl font-black tracking-tight uppercase mb-2 text-gray-900 dark:text-white">
            Redo!
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 font-medium mb-8">
            Uppvärmningen klar. Nu kör vi!
          </p>
          <button 
            onClick={handleClose} 
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 sm:py-5 rounded-2xl text-lg shadow-lg shadow-orange-500/20 transition-all uppercase tracking-wider cursor-pointer active:scale-98"
          >
            Starta passet
          </button>
        </motion.div>
      );
    }

    // Default: Block complete (non-final block)
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.12 }}
        className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-md text-gray-900 dark:text-white text-center shadow-2xl border-2 border-primary/20 z-[11001]" 
        onClick={e => e.stopPropagation()}
      >
        {blockTag && (
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-primary/10 text-primary mb-3">
            {blockTag}
          </span>
        )}
        <div className="text-5xl mb-3">⚡</div>
        <h2 id="workout-complete-title" className="text-3xl sm:text-4xl font-black tracking-tight uppercase mb-2 text-gray-900 dark:text-white">
          Snyggt!
        </h2>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 font-medium mb-8">
          Blocket avklarat. Hämta andan!
        </p>
        <button 
          onClick={handleClose} 
          className="w-full bg-primary hover:brightness-110 text-white font-black py-4 sm:py-5 rounded-2xl text-lg shadow-lg shadow-primary/20 transition-all uppercase tracking-wider cursor-pointer active:scale-98"
        >
          Nästa Block
        </button>
      </motion.div>
    );
  };

  return (
    <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none" 
        onClick={(e) => {
            if (e.target === e.currentTarget) {
                handleClose(e);
            }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-complete-title"
    >
      {showCelebrationEffects && (
        <>
          <Confetti />
          <Hearts />
        </>
      )}
      {renderModalContent()}
    </div>
  );
};
