import React, { useEffect, useState, useMemo } from 'react';
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
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-50" aria-hidden="true">
            {particles.map(p => (
                <div key={p.id} className="confetti-piece" style={p.style}></div>
            ))}
        </div>
    );
});


const Hearts = React.memo(() => {
    const particles = useMemo(() => Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        style: {
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${6 + Math.random() * 4}s`,
            fontSize: `${20 + Math.random() * 20}px`
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
      // Reset state when modal opens
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

  const handleSaveResult = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!participantName.trim() || !organizationId || finishTime === undefined) return;
      
      setIsSaving(true);
      const nameToSave = participantName.trim();
      try {
          const result: WorkoutResult = {
              id: `result-${Date.now()}`,
              workoutId: workout.id,
              organizationId: organizationId,
              participantName: nameToSave,
              finishTime: finishTime,
              completedAt: Date.now(),
          };
          await saveWorkoutResult(result);
          localStorage.setItem(LOCAL_STORAGE_NAME_KEY, nameToSave);
          
          setLastSavedName(nameToSave);
          setResultSaved(true);
          setParticipantName(''); // Clear input for next person

          // After a delay, reset the form to its initial state, ready for the next participant.
          setTimeout(() => {
            setResultSaved(false);
            setLastSavedName('');
            setIsSaving(false); // Re-enable the form
          }, 3000); // Display success message for 3 seconds

      } catch (error) {
          console.error("Failed to save workout result:", error);
          alert("Kunde inte spara resultatet.");
          setIsSaving(false); // Reset on error
      }
  };

  const hyroxResultContent = (
    <div 
        className="relative bg-gradient-to-br from-purple-700 to-indigo-800 rounded-2xl p-8 w-full max-w-md text-white text-center shadow-2xl border-4 border-yellow-400 animate-zoom-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <Confetti />
        <div className="text-6xl mb-4">🏆</div>
        
        <h2 id="workout-complete-title" className="text-4xl font-black tracking-wider uppercase drop-shadow-lg">{isRegistration ? 'Registrera din tid' : 'Loppet Klart!'}</h2>
        <p className="mt-4 text-xl text-white/90">Din tid blev:</p>
        <p className="font-mono text-7xl font-black my-4">{formatTime(finishTime || 0)}</p>
        
        {!resultSaved ? (
            <form onSubmit={handleSaveResult} className="mt-6 space-y-4">
                <input
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Skriv in ditt namn för topplistan"
                    className="w-full bg-black/30 text-white text-center p-3 rounded-md border-2 border-cyan-400/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 focus:outline-none transition font-semibold text-lg"
                    required
                    disabled={isSaving}
                    autoFocus
                />
                 <button 
                    type="submit"
                    disabled={isSaving || !participantName.trim()}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-gray-800 disabled:text-gray-500 text-lg"
                >
                  {isSaving ? 'Sparar...' : 'Spara resultat'}
                </button>
            </form>
        ) : (
            <div className="mt-6 text-center animate-fade-in">
                <p className="text-2xl font-bold text-green-400">Resultat sparat!</p>
                <p className="text-lg">Bra kämpat, {lastSavedName}!</p>
            </div>
        )}
        
        <button 
            onClick={onClose} 
            className="mt-6 font-semibold text-white/70 hover:text-white transition-colors"
        >
          Stäng
        </button>
      </div>
  );

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
 
  // Render registration view separately without an overlay
  if (isRegistrationView) {
    return (
      <div
        className="fixed top-0 right-0 h-full flex items-center p-8 z-50 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-complete-title"
      >
        <div className="pointer-events-auto">
          {hyroxResultContent}
        </div>
      </div>
    );
  }

  // Render other views with the standard overlay
  let contentToRender;
  if (isWarmup) {
      contentToRender = warmupContent;
  } else if (isFinalBlock) {
      contentToRender = finalBlockContent;
  } else {
      contentToRender = intermediateBlockContent;
  }
 
  return (
    <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-complete-title"
    >
      {contentToRender}
    </div>
  );
};