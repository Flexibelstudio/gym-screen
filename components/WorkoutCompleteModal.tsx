
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${8 + Math.random() * 7}s`,
            backgroundColor: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'][Math.floor(Math.random() * 7)],
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

export const WorkoutCompleteModal: React.FC<WorkoutCompleteModalProps> = ({ isOpen, onClose, workout, isFinalBlock, blockTag, finishTime, organizationId, isRegistration = false }) => {
  const [message, setMessage] = useState(celebrationMessages[0]);
  const [participantName, setParticipantName] = useState(() => localStorage.getItem(LOCAL_STORAGE_NAME_KEY) || '');
  const [isSaving, setIsSaving] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);
  const [lastSavedName, setLastSavedName] = useState('');

  useEffect(() => {
    if (isOpen) {
      if(isFinalBlock) {
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
  
  const isHyroxRace = workout?.id?.startsWith('hyrox-full-race') && isFinalBlock && finishTime !== undefined;
  const isRegistrationView = isHyroxRace || isRegistration;
  const isWarmup = blockTag === 'Uppvärmning';

  const handleSaveResult = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!participantName.trim() || !organizationId || finishTime === undefined || !workout) return;
      
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

  const hyroxResultContent = (
    <div 
        className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-md text-gray-900 dark:text-white text-center shadow-2xl border-4 border-primary/30 animate-zoom-fade-in z-[11001]"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-6xl mb-6">🏆</div>
        
        <h2 id="workout-complete-title" className="text-4xl font-black tracking-tight uppercase mb-4 leading-tight">
            {isRegistration ? 'Registrera Tid' : 'Loppet Klart!'}
        </h2>
        
        <div className="bg-gray-50 dark:bg-black/40 rounded-3xl p-6 mb-8 border border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-2">Officiell Tid</p>
            <p className="font-mono text-7xl font-black text-primary drop-shadow-sm">{formatTime(finishTime || 0)}</p>
        </div>
        
        {!resultSaved ? (
            <form onSubmit={handleSaveResult} className="space-y-4">
                <div className="relative">
                    <input
                        type="text"
                        value={participantName}
                        onChange={(e) => setParticipantName(e.target.value)}
                        placeholder="Ditt namn..."
                        className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all font-black text-xl placeholder-gray-300 dark:placeholder-gray-600"
                        required
                        disabled={isSaving}
                        autoFocus
                    />
                </div>
                 <button 
                    type="submit"
                    disabled={isSaving || !participantName.trim()}
                    className="w-full bg-primary hover:brightness-110 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-primary/20 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-lg uppercase tracking-widest active:scale-95"
                >
                  {isSaving ? 'Sparar...' : 'Spara på topplistan'}
                </button>
            </form>
        ) : (
            <div className="py-6 text-center animate-fade-in">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl text-green-600">✓</span>
                </div>
                <p className="text-2xl font-black text-green-600 dark:text-green-400 uppercase tracking-tight">Snyggt {lastSavedName}!</p>
                <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">Ditt resultat är sparat.</p>
            </div>
        )}
        
        <button 
            onClick={onClose} 
            className="mt-8 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Stäng fönstret
        </button>
      </div>
  );

  let contentToRender;
  if (isFinalBlock) {
      contentToRender = (
        <div 
          className="relative bg-gradient-to-br from-primary to-teal-600 rounded-[3rem] p-10 w-full max-w-xl text-white text-center shadow-2xl border-4 border-white/20 animate-fade-in z-[11001]"
          onClick={e => e.stopPropagation()}
        >
          <div className="text-7xl mb-6 animate-bounce">🏆</div>
          <h2 id="workout-complete-title" className="text-6xl font-black tracking-wider uppercase drop-shadow-lg mb-4">{message.title}</h2>
          <p className="text-2xl text-white/95 font-semibold leading-relaxed">{message.subtitle}</p>
          <button onClick={onClose} className="mt-10 bg-white text-primary hover:bg-gray-100 font-extrabold py-4 px-10 rounded-full text-xl shadow-lg transition-all transform hover:scale-105 uppercase tracking-widest">Klar</button>
        </div>
      );
  } else if (isWarmup) {
      contentToRender = (
        <div className="relative bg-gradient-to-br from-orange-500 to-red-500 rounded-[2.5rem] p-8 w-full max-w-md text-white text-center shadow-2xl animate-fade-in z-[11001]" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-4">🔥</div>
          <h2 className="text-4xl font-black tracking-tight uppercase mb-2">Redo!</h2>
          <p className="text-xl text-orange-100 font-medium">Uppvärmningen klar. Nu kör vi!</p>
          <button onClick={onClose} className="mt-8 w-full bg-white text-orange-700 hover:bg-blue-50 font-black py-4 rounded-2xl text-lg shadow-md transition-colors uppercase tracking-widest">Starta passet</button>
        </div>
      );
  } else {
      contentToRender = (
        <div className="relative bg-gradient-to-br from-blue-600 to-cyan-600 rounded-[2.5rem] p-8 w-full max-w-md text-white text-center shadow-2xl animate-fade-in z-[11001]" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-4">👍</div>
          <h2 className="text-4xl font-black tracking-tight uppercase mb-2">Snyggt!</h2>
          <p className="text-xl text-blue-100 font-medium">Blocket avklarat. Hämta andan!</p>
          <button onClick={onClose} className="mt-8 w-full bg-white text-blue-700 hover:bg-blue-50 font-black py-4 rounded-2xl text-lg shadow-md transition-colors uppercase tracking-widest">Nästa Block</button>
        </div>
      );
  }
 
  return (
    <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-complete-title"
    >
      <Confetti />
      <Hearts />
      {isRegistrationView ? hyroxResultContent : contentToRender}
    </div>
  );
};
