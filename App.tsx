import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
// FIX: Imported the 'EquipmentItem' type to resolve module not found error.
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, TimerStatus, TimerSettings, Passkategori, Studio, MenuItem, StudioConfig, Organization, CustomPage, CustomCategoryWithPrompt, UserRole, UserData, InfoCarousel, InfoMessage, DisplayWindow, Note, WorkoutResult } from './types';

import { useStudio } from './context/StudioContext';
import { useAuth } from './context/AuthContext';
import { useWorkoutTimer } from './hooks/useWorkoutTimer';
import { TimerSetupModal } from './components/TimerSetupModal';
import { BoostModal } from './components/BoostModal';
import { FreestandingTimerScreen } from './components/FreestandingTimerScreen';
import { generateWorkout, parseWorkoutFromText } from './services/geminiService';
import { getWorkoutsForOrganization, saveWorkout, deleteWorkout, createOrganization, updateGlobalConfig, updateStudioConfig, createStudio, updateOrganization, updateOrganizationPasswords, updateOrganizationLogos, updateOrganizationPrimaryColor, updateOrganizationCustomPages, isOffline, updateStudio, deleteStudio, deleteOrganization, updateOrganizationInfoCarousel, updateOrganizationDisplayWindows, addExerciseSuggestion, saveWorkoutResult, deleteWorkoutResult, deleteImageByUrl } from './services/firebaseService';
import { WorkoutBuilderScreen } from './components/WorkoutBuilderScreen';
import { SimpleWorkoutBuilderScreen } from './components/SimpleWorkoutBuilderScreen';
import { BreathingGuideScreen } from './components/BreathingGuideScreen';
import { WarmupScreen } from './components/WarmupScreen';
import { WorkoutCompleteModal, Confetti } from './components/WorkoutCompleteModal';
import WorkoutDetailScreen from './components/WorkoutDetailScreen';
import SavedWorkoutsScreen from './components/SavedWorkoutsScreen';
import { PasswordModal } from './components/PasswordModal';
import { ReAuthModal } from './components/ReAuthModal';
import { AIGeneratorScreen } from './components/AIGeneratorScreen';
import { CoachScreen } from './components/CoachScreen';
import { StudioSelectionScreen } from './components/StudioSelectionScreen';
import { StudioConfigModal } from './components/AdminConfigScreen';
import { SuperAdminScreen } from './components/SuperAdminScreen';
import { SystemOwnerScreen } from './components/SystemOwnerScreen';
import { HomeScreen } from './components/HomeScreen';
import { CustomContentScreen } from './components/CustomContentScreen';
import { LoginScreen } from './components/LoginScreen';
import { DeveloperToolbar } from './components/DeveloperToolbar';
import { CustomPageEditorScreen } from './components/CustomPageEditorScreen';
import { InfoCarouselBanner } from './components/InfoCarouselBanner';
import { DisplayWindowScreen } from './components/DisplayWindowScreen';
import { DisplayWindowSelectionScreen } from './components/DisplayWindowSelectionScreen';
// FIX: Corrected import to resolve 'NotesScreen' not found error. This was likely caused by other compilation errors.
import { NotesScreen } from './components/NotesScreen';
import { HyroxScreen } from './components/HyroxScreen';
import { TermsOfServiceModal } from './components/TermsOfServiceModal';
import { SupportChat } from './components/SupportChat';

// --- Screensaver Component & Logic ---

const formatTimeForScreensaver = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

const useBouncingPhysics = (containerRef: React.RefObject<HTMLElement>, elementRefs: React.RefObject<HTMLDivElement>[]) => {
    const [positions, setPositions] = useState(() => elementRefs.map(() => ({ x: 50, y: 50 })));
    
    // Increased velocity for faster movement across the 2-second interval.
    const elementsRef = useRef(elementRefs.map((ref) => ({
        ref: ref,
        pos: { x: 20 + Math.random() * 60, y: 20 + Math.random() * 60 },
        vel: { vx: (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 15), vy: (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 15) },
        size: { w: 0, h: 0 }
    })));

    useEffect(() => {
        // Set initial positions right away so they appear before the first interval runs.
        setPositions(elementsRef.current.map(el => el.pos));
    }, []);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (!containerRef.current) return;
            
            const containerRect = containerRef.current.getBoundingClientRect();
            if (containerRect.width === 0 || containerRect.height === 0) return;

            const physicsElements = elementsRef.current;

            // First, update sizes for all elements.
            physicsElements.forEach(el => {
                if (el.ref.current) {
                    const elRect = el.ref.current.getBoundingClientRect();
                    el.size.w = (elRect.width / containerRect.width) * 100;
                    el.size.h = (elRect.height / containerRect.height) * 100;
                }
            });
            
            // Second, handle inter-element collision by predicting the next step.
            if (physicsElements.length > 1) {
                const [el1, el2] = physicsElements;
                
                // Predict next positions to check for overlap
                const nextPos1 = { x: el1.pos.x + el1.vel.vx, y: el1.pos.y + el1.vel.vy };
                const nextPos2 = { x: el2.pos.x + el2.vel.vx, y: el2.pos.y + el2.vel.vy };

                // Check for collision at the predicted positions
                if (
                    nextPos1.x < nextPos2.x + el2.size.w &&
                    nextPos1.x + el1.size.w > nextPos2.x &&
                    nextPos1.y < nextPos2.y + el2.size.h &&
                    nextPos1.y + el1.size.h > nextPos2.y
                ) {
                    // On collision, swap velocities *before* calculating the final target position for this cycle.
                    const tempVel = el1.vel;
                    el1.vel = el2.vel;
                    el2.vel = tempVel;
                }
            }
            
            // Third, calculate final target positions for each element using potentially updated velocities and handle wall collisions.
            physicsElements.forEach(el => {
                let nextX = el.pos.x + el.vel.vx;
                let nextY = el.pos.y + el.vel.vy;
                
                // Wall collision detection and response
                if (nextX <= 0 || nextX >= 100 - el.size.w) {
                    el.vel.vx *= -1; // Reverse velocity
                    nextX = el.pos.x + el.vel.vx; // Recalculate nextX with the new velocity for this interval's target
                }
                if (nextY <= 0 || nextY >= 100 - el.size.h) {
                    el.vel.vy *= -1; // Reverse velocity
                    nextY = el.pos.y + el.vel.vy; // Recalculate nextY with the new velocity
                }
                
                // Update the element's target position, clamping to be safe.
                el.pos.x = Math.max(0.1, Math.min(nextX, 99.9 - el.size.w));
                el.pos.y = Math.max(0.1, Math.min(nextY, 99.9 - el.size.h));
            });
            
            // Finally, update the state to trigger the CSS transition to the new target positions.
            setPositions(physicsElements.map(el => ({ x: el.pos.x, y: el.pos.y })));
            
        }, 2000); // Interval duration
        
        return () => clearInterval(intervalId);
    }, [containerRef, elementRefs]);

    return positions;
};

interface ScreensaverProps {
    logoUrl?: string | null;
}

const Screensaver: React.FC<ScreensaverProps> = ({ logoUrl }) => {
    const [time, setTime] = useState(formatTimeForScreensaver(new Date()));
    const containerRef = useRef<HTMLDivElement>(null);
    const clockRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);
    
    const elementRefs = useMemo(() => [clockRef, logoRef], []);
    const [clockPosition, logoPosition] = useBouncingPhysics(containerRef, elementRefs);

    useEffect(() => {
        const timerId = setInterval(() => {
            setTime(formatTimeForScreensaver(new Date()));
        }, 1000);
        return () => clearInterval(timerId);
    }, []);

    const transitionStyle: React.CSSProperties = {
        transition: 'top 2s linear, left 2s linear',
        willChange: 'top, left'
    };

    return (
        <div ref={containerRef} className="fixed inset-0 bg-black z-[1000] cursor-none animate-fade-in">
            {clockPosition && <div 
                ref={clockRef} 
                className="absolute text-white font-mono text-9xl font-bold" 
                style={{ 
                    top: `${clockPosition.y}%`, 
                    left: `${clockPosition.x}%`,
                    ...transitionStyle
                }}
            >
                {time}
            </div>}
            {logoUrl && logoPosition && (
                 <div 
                    ref={logoRef} 
                    className="absolute w-80 h-80"
                    style={{ 
                        top: `${logoPosition.y}%`, 
                        left: `${logoPosition.x}%`,
                        ...transitionStyle
                    }}
                >
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
            )}
        </div>
    );
};

// --- Timer Style Utility ---
interface TimerStyle {
  bg: string;
  border: string;
  text: string;
  pulseRgb: string;
  activeHighlight: {
    ring: string;
    bg: string;
    text: string;
  };
}

const getTimerStyle = (status: TimerStatus, mode: TimerMode): TimerStyle => {
  switch (status) {
    case TimerStatus.Preparing:
      return { 
        bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-white', pulseRgb: '59, 130, 246', 
        activeHighlight: { ring: 'ring-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' } 
      };
    case TimerStatus.Running:
      switch (mode) {
        case TimerMode.Interval:
          return { 
            bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-white', pulseRgb: '249, 115, 22', 
            activeHighlight: { ring: 'ring-orange-500', bg: 'bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' } 
          };
        case TimerMode.Tabata:
          return { 
            bg: 'bg-red-500', border: 'border-red-500', text: 'text-white', pulseRgb: '239, 68, 68',
            activeHighlight: { ring: 'ring-red-500', bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400' } 
          };
        case TimerMode.AMRAP:
          return { 
            bg: 'bg-pink-600', border: 'border-pink-600', text: 'text-white', pulseRgb: '219, 39, 119',
            activeHighlight: { ring: 'ring-pink-600', bg: 'bg-pink-600/20', text: 'text-pink-700 dark:text-pink-500' } 
          };
        case TimerMode.EMOM:
          return { 
            bg: 'bg-purple-600', border: 'border-purple-600', text: 'text-white', pulseRgb: '147, 51, 234',
            activeHighlight: { ring: 'ring-purple-600', bg: 'bg-purple-600/20', text: 'text-purple-700 dark:text-purple-500' } 
          };
        case TimerMode.TimeCap:
          return { 
            bg: 'bg-indigo-600', border: 'border-indigo-600', text: 'text-white', pulseRgb: '79, 70, 229',
            activeHighlight: { ring: 'ring-indigo-600', bg: 'bg-indigo-600/20', text: 'text-indigo-700 dark:text-indigo-500' } 
          };
        case TimerMode.Stopwatch:
          return { 
            bg: 'bg-green-600', border: 'border-green-600', text: 'text-white', pulseRgb: '22, 163, 74',
            activeHighlight: { ring: 'ring-green-600', bg: 'bg-green-600/20', text: 'text-green-700 dark:text-green-500' } 
          };
        default:
          return { 
            bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-white', pulseRgb: '249, 115, 22',
            activeHighlight: { ring: 'ring-orange-500', bg: 'bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' } 
          };
      }
    case TimerStatus.Resting:
      return { 
        bg: 'bg-teal-400', border: 'border-teal-400', text: 'text-white', pulseRgb: '45, 212, 191',
        activeHighlight: { ring: 'ring-teal-400', bg: 'bg-teal-400/20', text: 'text-teal-500 dark:text-teal-300' } 
      };
    case TimerStatus.Paused:
      return { 
        bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-white', pulseRgb: '107, 114, 128',
        activeHighlight: { ring: 'ring-gray-500', bg: 'bg-gray-500/20', text: 'text-gray-600 dark:text-gray-400' } 
      };
    case TimerStatus.Finished:
      return { 
        bg: 'bg-teal-600', border: 'border-teal-600', text: 'text-white', pulseRgb: '13, 148, 136',
        activeHighlight: { ring: 'ring-teal-600', bg: 'bg-teal-600/20', text: 'text-teal-700 dark:text-teal-500' } 
      };
    case TimerStatus.Idle:
    default:
      return { 
        bg: 'bg-gray-800', border: 'border-gray-800', text: 'text-white', pulseRgb: '', 
        activeHighlight: { ring: '', bg: '', text: '' } 
      };
  }
};


// --- Digital Clock Component ---
const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

const DigitalClock: React.FC = () => {
    const [time, setTime] = useState(formatTime(new Date()));
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timerId = setInterval(() => {
            setTime(formatTime(new Date()));
        }, 1000); // Update every second to ensure minute changes are reflected promptly

        return () => {
            clearInterval(timerId);
        };
    }, []);
    
    return (
        <div 
            className="font-mono text-3xl font-bold cursor-pointer transition-all duration-300 flex items-center justify-center text-black dark:text-white"
            onClick={() => setIsVisible(!isVisible)}
            title={isVisible ? "Dölj klockan" : "Visa klockan"}
            style={{ 
                minWidth: '95px', 
                minHeight: '62px',
             }} // Stable size to prevent layout shifts
        >
            {isVisible ? (
                <span>{time}</span>
            ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )}
        </div>
    );
};

// FIX: Moved screen components before App component to ensure they are defined before use.
// WorkoutListScreen Component
interface WorkoutListScreenProps {
    passkategori: string;
    workouts: Workout[];
    onSelectWorkout: (workout: Workout) => void;
}

const WorkoutListScreen: React.FC<WorkoutListScreenProps> = ({ passkategori, workouts, onSelectWorkout }) => {
    return (
        <div className="w-full max-w-5xl mx-auto text-center">
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-8">{passkategori}</h1>
            {workouts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workouts.map(workout => (
                        <div key={workout.id} className="relative group">
                            <button
                                onClick={() => onSelectWorkout(workout)}
                                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold p-6 rounded-lg transition-colors duration-200 flex flex-col items-start justify-start text-xl shadow-lg text-left h-48"
                            >
                                <span className="text-2xl font-bold text-primary mb-2">{workout.title}</span>
                                <p className="text-sm font-normal text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">{workout.coachTips}</p>
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-xl">Det finns inga publicerade pass i denna passkategori ännu.</p>
            )}
        </div>
    );
}

// Screen for timer-less blocks
const RepsOnlyScreen: React.FC<{ block: WorkoutBlock; onFinish: () => void; onShowImage: (url: string) => void; }> = ({ block, onFinish, onShowImage }) => {
    
    const formatExerciseName = (ex: Exercise | null) => {
      if (!ex) return null;
      const repsTrimmed = ex.reps?.trim();
      return repsTrimmed ? `${repsTrimmed} ${ex.name}` : ex.name;
    };

    return (
        <div className="w-full h-full flex-grow flex flex-col dark:bg-black">
            <div className="w-full max-w-5xl mx-auto flex-shrink-0 flex flex-col items-center justify-center p-6 md:p-8 rounded-2xl bg-gray-700">
                <h1 className="text-4xl md:text-6xl lg:text-7xl text-white uppercase tracking-widest">{block.title}</h1>
                <p className="text-xl text-gray-300 mt-2">Utför övningarna i din egen takt.</p>
            </div>
            
            <div className="w-full bg-transparent flex-grow overflow-y-auto mt-6">
                <div className="w-full max-w-5xl mx-auto p-4">
                    <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
                        <div className="space-y-2 mt-4">
                            {block.exercises.map((ex) => (
                                <div key={ex.id} className="p-4 rounded-lg bg-gray-200 dark:bg-slate-900 text-gray-800 dark:text-gray-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-3xl font-bold">{formatExerciseName(ex)}</p>
                                        {ex.imageUrl && (
                                            <button 
                                                onClick={() => onShowImage(ex.imageUrl!)} 
                                                className="text-current opacity-80 hover:opacity-100 transition"
                                                aria-label="Visa övningsbild"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    {ex.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ex.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full flex-shrink-0 py-4">
                <div className="w-full max-w-5xl mx-auto flex items-center justify-center">
                    <button onClick={onFinish} className="font-semibold py-3 px-8 rounded-lg flex items-center justify-center gap-2 text-md transition-colors text-white shadow-md bg-primary hover:brightness-95">
                        Klar med blocket
                    </button>
                </div>
            </div>
        </div>
    );
};

const UndoConfirmationModal: React.FC<{
    participantName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ participantName, onConfirm, onCancel, isSaving }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onCancel}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">Ångra målgång</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
                Är du säker på att du vill ångra målgången för <span className="font-bold">{participantName}</span>? Tiden kommer att tas bort.
            </p>
            <div className="flex gap-4">
                <button onClick={onCancel} disabled={isSaving} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                <button onClick={onConfirm} disabled={isSaving} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors">
                    {isSaving ? 'Ångrar...' : 'Ja, ångra'}
                </button>
            </div>
        </div>
    </div>
);

// FIX: Define a props interface for TimerScreen to properly type its props.
interface TimerScreenProps {
    block: WorkoutBlock;
    onFinish: (finishData: { isNatural?: boolean; time?: number }) => void;
    onHeaderVisibilityChange: (isVisible: boolean) => void;
    onShowImage: (url: string) => void;
    activeWorkout: Workout | null;
    setCompletionInfo: React.Dispatch<React.SetStateAction<{ workout: Workout; isFinal: boolean; blockTag?: string; finishTime?: number; } | null>>;
    setIsRegisteringHyroxTime: React.Dispatch<React.SetStateAction<boolean>>;
    organizationId?: string;
    setIsBackButtonHidden: React.Dispatch<React.SetStateAction<boolean>>;
}

// TimerScreen Component
const TimerScreen: React.FC<TimerScreenProps> = ({ 
    block, onFinish, onHeaderVisibilityChange, onShowImage,
    activeWorkout, setCompletionInfo, setIsRegisteringHyroxTime, organizationId,
    setIsBackButtonHidden
}) => {
  const { 
    status, currentTime, currentRound, currentExercise,
    start, pause, resume, reset, 
    totalRounds, totalExercises, currentExerciseIndex,
    isLastExerciseInRound,
    totalBlockDuration, totalTimeElapsed,
    completedWorkIntervals, totalWorkIntervals
  } = useWorkoutTimer(block);
  
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const hideTimeoutRef = React.useRef<number | null>(null);

  const [highlightedExercise, setHighlightedExercise] = React.useState<Exercise | null>(currentExercise);
  const [animationState, setAnimationState] = React.useState<'in' | 'out'>('in');

  const [finishedParticipants, setFinishedParticipants] = useState<Record<string, { time: number; resultId: string }>>({});
  const [savingParticipant, setSavingParticipant] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [participantToUndo, setParticipantToUndo] = useState<string | null>(null);

  const isHyroxRace = useMemo(() => activeWorkout?.id.startsWith('hyrox-full-race'), [activeWorkout]);
  // FIX: The original logic `status === TimerStatus.Running || isHyroxRace` caused non-HYROX timers to adopt HYROX styling and disabled their pulse animations.
  // Basing this on `isHyroxRace` alone fixes the styling and resolves the downstream type error in the `useMemo` for animation classes.
  const useHyroxStyle = isHyroxRace;
  const hasParticipants = useMemo(() => !!(activeWorkout?.participants && activeWorkout.participants.length > 0), [activeWorkout]);

  useEffect(() => {
    if (isHyroxRace) {
      setIsBackButtonHidden(true);
    }
    // Cleanup function to reset the state when the component unmounts
    return () => {
      setIsBackButtonHidden(false);
    };
  }, [isHyroxRace, setIsBackButtonHidden]);

  React.useEffect(() => {
    start();
  }, [start]);

  const isFreestanding = block.tag === 'Fristående';
  
  React.useEffect(() => {
    if (status === TimerStatus.Finished) {
      onFinish({ isNatural: true, time: totalTimeElapsed });
    }
  }, [status, onFinish, totalTimeElapsed]);

  React.useEffect(() => {
    // Check if the exercise ID has actually changed.
    if (highlightedExercise?.id !== currentExercise?.id) {
        setAnimationState('out');
        const timer = setTimeout(() => {
            setHighlightedExercise(currentExercise);
            setAnimationState('in');
        }, 500); // Duration of the 'out' animation
        return () => clearTimeout(timer);
    }
  }, [currentExercise, highlightedExercise]);

  const restartHideTimer = React.useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
        hideTimeoutRef.current = window.setTimeout(() => {
            setControlsVisible(false);
        }, 3000);
    }
  }, [status]);

  React.useEffect(() => {
    onHeaderVisibilityChange(controlsVisible);
  }, [controlsVisible, onHeaderVisibilityChange]);

  React.useEffect(() => {
    return () => onHeaderVisibilityChange(true);
  }, [onHeaderVisibilityChange]);

  React.useEffect(() => {
    if (controlsVisible) {
        restartHideTimer();
    }
    return () => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [controlsVisible, restartHideTimer]);

  React.useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
        restartHideTimer();
    } else {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        setControlsVisible(true);
    }
  }, [status, restartHideTimer]);

  const handleScreenInteraction = () => {
      if (!controlsVisible) {
          setControlsVisible(true);
      }
      restartHideTimer();
  };
  
  const onButtonPress = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    if (!controlsVisible) {
        setControlsVisible(true);
    }
    restartHideTimer();
  };

  const handleEarlyFinish = onButtonPress(() => {
    // FIX: Use props passed down from MainContent to access the required state variables.
    if (activeWorkout?.id.startsWith('hyrox-full-race')) {
        setCompletionInfo({ workout: activeWorkout, isFinal: true, blockTag: block?.tag, finishTime: totalTimeElapsed });
        setIsRegisteringHyroxTime(true);
    } else {
        pause();
        onFinish({ isNatural: true, time: totalTimeElapsed });
    }
  });

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleParticipantFinish = async (name: string) => {
    if (savingParticipant) return; // Prevent double clicks
    setSavingParticipant(name);
    try {
        const finishTime = totalTimeElapsed;
        if (activeWorkout && organizationId) {
            const resultId = `result-${activeWorkout.id}-${name.replace(/\s/g, '_')}-${Date.now()}`;
            const result: WorkoutResult = {
                id: resultId,
                workoutId: activeWorkout.id,
                organizationId,
                participantName: name,
                finishTime: finishTime,
                completedAt: Date.now(),
            };
            await saveWorkoutResult(result);
            setFinishedParticipants(prev => ({...prev, [name]: { time: finishTime, resultId: resultId }}));
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000); // Confetti lasts 4 seconds
        }
    } catch (e) {
        console.error("Failed to save result", e);
        alert(`Kunde inte spara resultat för ${name}.`);
    } finally {
        setSavingParticipant(null);
    }
};

const handleUndoParticipantFinish = async () => {
    if (!participantToUndo) return;
    const name = participantToUndo;

    const finishedInfo = finishedParticipants[name];
    if (!finishedInfo || (savingParticipant && savingParticipant !== name)) return;

    setSavingParticipant(name);

    // Optimistically update UI
    const updatedFinishedParticipants = { ...finishedParticipants };
    delete updatedFinishedParticipants[name];
    setFinishedParticipants(updatedFinishedParticipants);

    try {
        await deleteWorkoutResult(finishedInfo.resultId);
    } catch (e) {
        console.error("Failed to delete result", e);
        // Revert UI change on error
        setFinishedParticipants(prev => ({ ...prev, [name]: finishedInfo }));
        alert(`Kunde inte ångra målgång för ${name}.`);
    } finally {
        setSavingParticipant(null);
        setParticipantToUndo(null); // Close modal
    }
};

  const timeToDisplay = (block.settings.mode === TimerMode.Stopwatch && status !== TimerStatus.Preparing) ? totalTimeElapsed : currentTime;
  const timerStyle = getTimerStyle(status, block.settings.mode);
  
  const getProgress = () => totalBlockDuration === 0 ? 0 : (totalTimeElapsed / totalBlockDuration) * 100;

  const { outerAnimationClass, innerAnimationClass } = useMemo(() => {
    if (useHyroxStyle) {
        return { outerAnimationClass: '', innerAnimationClass: '' };
    }
    // FIX: Explicitly cast operands to Number to ensure they are treated as numbers, resolving the type error.
    const totalTimeRemaining = Number(totalBlockDuration) - Number(totalTimeElapsed);

    if (status !== TimerStatus.Running || totalTimeRemaining > 15) {
      return { outerAnimationClass: '', innerAnimationClass: '' };
    }

    let outerAnimClass = '';
    let innerAnimClass = '';
    if (totalTimeRemaining <= 5) {
      outerAnimClass = 'animate-pulse-bg-intense';
      innerAnimClass = 'animate-pulse-inset-intense';
    } else if (totalTimeRemaining <= 10) {
      outerAnimClass = 'animate-pulse-bg-medium';
      innerAnimClass = 'animate-pulse-inset-medium';
    } else {
      outerAnimClass = 'animate-pulse-bg-light';
      innerAnimClass = 'animate-pulse-inset-light';
    }
    
    return { outerAnimationClass: outerAnimClass, innerAnimationClass: innerAnimClass };
  }, [status, totalBlockDuration, totalTimeElapsed, useHyroxStyle]);


  const getTopText = () => {
    switch (status) {
      case TimerStatus.Idle: return "Starta Block";
      case TimerStatus.Preparing: return `Gör dig redo`;
      case TimerStatus.Running:
        switch (block.settings.mode) {
          case TimerMode.Interval: return 'Arbete';
          case TimerMode.Tabata: return 'TABATA';
          case TimerMode.EMOM: return `EMOM ${totalRounds}`;
          case TimerMode.TimeCap: return `Time Cap ${Math.floor(block.settings.workTime / 60)} min`;
          case TimerMode.AMRAP: return `AMRAP ${Math.floor(block.settings.workTime / 60)} min`;
          case TimerMode.Stopwatch: return isHyroxRace ? 'HYROX Race' : 'Stoppur';
          default: return 'Arbete';
        }
      case TimerStatus.Resting: return 'Vila';
      case TimerStatus.Paused: return 'Pausad';
      case TimerStatus.Finished: return 'Bra jobbat!';
      default: return '';
    }
  };
  
  const formatExerciseName = (ex: Exercise | null) => {
    if (!ex) return null;
    const repsTrimmed = ex.reps?.trim();
    return repsTrimmed ? `${repsTrimmed} ${ex.name}` : ex.name;
  };
  
  const buttonClass = "font-semibold py-3 px-5 rounded-lg flex items-center justify-center gap-2 text-md transition-colors text-white shadow-md";

  const roundCounterLabel = block.settings.mode === TimerMode.EMOM ? 'Minut' : 'Varv';
  const shouldShowHighlightCard = !isFreestanding && block.followMe === true && currentExercise && (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing);
  const hyroxGradientClass = 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-[length:200%_200%] animate-pulse-hyrox-bg';


  const ParticipantFinishList: React.FC<{
    participants: string[];
    finishedTimes: Record<string, { time: number; resultId: string }>;
    onFinish: (name: string) => void;
    onUndo: (name: string) => void;
    isSaving: (name: string) => boolean;
  }> = ({ participants, finishedTimes, onFinish, onUndo, isSaving }) => {
      const sortedParticipants = useMemo(() => {
          const unfinished = participants.filter(p => finishedTimes[p] === undefined);
          const finished = participants.filter(p => finishedTimes[p] !== undefined)
              .sort((a, b) => finishedTimes[a].time - finishedTimes[b].time);
          return [...unfinished, ...finished];
      }, [participants, finishedTimes]);
  
      return (
          <div className="bg-gray-900 h-full flex flex-col p-4">
              <h3 className="text-2xl font-bold text-white mb-4 flex-shrink-0">Deltagare</h3>
              <div className="flex-grow overflow-y-auto space-y-2">
                  {sortedParticipants.map(name => {
                      const finishedInfo = finishedTimes[name];
                      const isFinished = !!finishedInfo;
                      return (
                          <div
                              key={name}
                              onClick={() => {
                                if (isFinished) {
                                  onUndo(name);
                                }
                              }}
                              className={`p-3 rounded-lg flex justify-between items-center transition-colors ${
                                  isFinished
                                  ? 'bg-green-900/50 border border-green-600 cursor-pointer hover:bg-green-900/80'
                                  : 'bg-gray-800'
                              }`}
                          >
                              <span className={`font-semibold ${isFinished ? 'text-gray-400 line-through' : 'text-white'}`}>{name}</span>
                              {isFinished ? (
                                  <span className="font-mono text-lg font-bold text-green-400">{formatTime(finishedInfo.time)}</span>
                              ) : (
                                  <button
                                      onClick={(e) => { e.stopPropagation(); onFinish(name); }}
                                      disabled={isSaving(name)}
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-1 px-3 rounded-md disabled:bg-gray-500"
                                  >
                                      {isSaving(name) ? 'Sparar...' : 'I Mål!'}
                                  </button>
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };


  return (
    <div 
        className={`w-full h-full flex-grow flex dark:bg-black transition-colors duration-500 relative ${useHyroxStyle ? '' : outerAnimationClass}`}
        onClick={handleScreenInteraction}
    >
        {showConfetti && <Confetti />}
      <div 
        className="flex-grow flex flex-col"
        style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
      >
        <div 
          className={`w-full flex flex-col items-center justify-center p-6 md:p-8 transition-all duration-500 ${useHyroxStyle ? hyroxGradientClass : timerStyle.bg} ${useHyroxStyle ? '' : innerAnimationClass} ${isFreestanding ? 'flex-grow' : 'mt-4 max-w-5xl mx-auto flex-shrink-0 rounded-2xl min-h-[200px] md:min-h-[250px] lg:min-h-[300px]'}`}
          style={{textShadow: useHyroxStyle ? '2px 2px 8px rgba(0,0,0,0.3)' : 'none'}}
        >
          <p className="text-4xl md:text-6xl lg:text-7xl text-white/80 uppercase tracking-widest mb-4">{getTopText()}</p>
          
          <p className="font-mono text-7xl sm:text-9xl md:text-[10rem] lg:text-[11rem] leading-none font-black text-white" style={{fontVariantNumeric: 'tabular-nums'}}>
            {formatTime(timeToDisplay)}
          </p>

          <div className="w-full max-w-lg my-6">
              <div className="h-2 bg-white/20 rounded-full">
                  <div className="h-2 bg-white rounded-full" style={{ width: `${getProgress()}%`, transition: 'width 0.5s ease-out' }}></div>
              </div>
          </div>

          <div className="text-center text-white/90 space-y-2">
              {(block.settings.mode === TimerMode.Interval || block.settings.mode === TimerMode.Tabata) &&
                status !== TimerStatus.Idle && status !== TimerStatus.Finished && (
                  <>
                    {totalExercises > 1 ? (
                      <p className="text-xl lg:text-2xl">
                        {totalRounds} varv &times; {totalExercises} övn. ({formatTime(block.settings.workTime)} / {formatTime(block.settings.restTime)})
                      </p>
                    ) : (
                      <p className="text-xl lg:text-2xl">
                        {totalWorkIntervals} &times; ({formatTime(block.settings.workTime)} / {formatTime(block.settings.restTime)})
                      </p>
                    )}
                    {totalExercises > 1 ? (
                      <p className="text-2xl lg:text-3xl">
                        <span className="mr-6">{roundCounterLabel}: {currentRound} / {totalRounds}</span>
                        <span>Övning: {currentExerciseIndex + 1} / {totalExercises}</span>
                      </p>
                    ) : (
                      <p className="text-2xl lg:text-3xl">
                        Omgång: {Math.min(completedWorkIntervals + 1, totalWorkIntervals)} / {totalWorkIntervals}
                      </p>
                    )}
                  </>
                )}
              {(block.settings.mode === TimerMode.EMOM && status !== TimerStatus.Idle && status !== TimerStatus.Finished) && (
                <p className="text-2xl lg:text-3xl">
                  {totalRounds > 1 && <span className={totalExercises > 1 ? "mr-6" : ""}>{roundCounterLabel}: {currentRound} / {totalRounds}</span>}
                  {totalExercises > 1 && <span>Övning: {currentExerciseIndex + 1} / {totalExercises}</span>}
                </p>
              )}
          </div>
        </div>

        <div className={`w-full flex-shrink-0 py-4 transition-all duration-300 ${controlsVisible ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 py-0 overflow-hidden'}`}>
          <div className="w-full max-w-5xl mx-auto flex items-center justify-center gap-3">
            {status === TimerStatus.Idle && (
              <div className="flex items-center justify-center gap-3 w-full">
                <button onClick={onButtonPress(start)} className={`${buttonClass} bg-primary hover:brightness-95 flex-1`}>
                  Starta
                </button>
                <button onClick={onButtonPress(() => onFinish({ isNatural: false }))} className={`${buttonClass} bg-gray-600 hover:bg-gray-500 flex-1`}>
                  Avbryt
                </button>
              </div>
            )}
            {status === TimerStatus.Paused && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={onButtonPress(resume)} className={`${buttonClass} bg-primary hover:brightness-95`}>
                  Fortsätt
                </button>
                <button onClick={onButtonPress(reset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
                  Återställ
                </button>
                <button onClick={onButtonPress(() => onFinish({ isNatural: false }))} className={`${buttonClass} bg-red-600 hover:bg-red-500`}>
                  Avsluta Block
                </button>
              </div>
            )}
            {(status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={onButtonPress(pause)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
                  Pausa
                </button>
                <button onClick={onButtonPress(reset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
                  Återställ
                </button>
                <button onClick={onButtonPress(() => onFinish({ isNatural: false }))} className={`${buttonClass} bg-red-600 hover:bg-red-500`}>
                  Avsluta Block
                </button>
              </div>
            )}
          </div>
        </div>
        
        {isHyroxRace && !hasParticipants && (status === TimerStatus.Running || status === TimerStatus.Paused) && activeWorkout && (
            <WorkoutCompleteModal
              isOpen={true}
              onClose={() => { /* Does nothing as it is persistent */ }}
              workout={activeWorkout}
              isFinalBlock={true}
              finishTime={totalTimeElapsed}
              organizationId={organizationId}
              isRegistration={true}
            />
        )}

        {!isFreestanding && (
          <div className={`w-full bg-transparent flex-grow overflow-y-auto mt-6`}>
            <div className={`w-full max-w-5xl mx-auto p-4 transition-all duration-500 ${shouldShowHighlightCard ? 'opacity-20 blur-sm' : 'opacity-100'}`}>
              <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
                <div className="space-y-2 mt-4">
                  {block.exercises.map((ex) => (
                      <div key={ex.id} className="p-4 rounded-lg bg-gray-200 dark:bg-slate-900">
                        <div className="flex justify-between items-center">
                          <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{formatExerciseName(ex)}</p>
                          {ex.imageUrl && (
                            <button onClick={() => onShowImage(ex.imageUrl!)} className="text-current opacity-80 hover:opacity-100 transition" aria-label="Visa övningsbild">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {ex.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ex.description}</p>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {shouldShowHighlightCard && (
            <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8 pointer-events-none">
                {/* Wider card, using responsive width and padding */}
                <div 
                    className={`w-full max-w-sm md:max-w-xl lg:max-w-4xl p-4 sm:p-6 lg:p-8 rounded-2xl shadow-2xl border-4 border-white/20 backdrop-blur-sm ${timerStyle.bg} animate-zoom-fade-in`}
                    style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.3)', overflow: 'hidden' }}
                >
                  <div className={animationState === 'in' ? 'animate-slide-in-from-left' : 'animate-slide-out-to-right'}>
                      {highlightedExercise && (
                          <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 lg:gap-8 text-white">
                                {/* Left Column: Text Info, text is left-aligned now */}
                                <div className={`flex-1 text-left ${highlightedExercise.imageUrl ? 'md:w-1/2' : 'w-full'}`}>
                                    <h3 className="text-lg md:text-xl uppercase tracking-widest text-white/80 font-semibold mb-2 sm:mb-4">
                                        {status === TimerStatus.Running ? 'Aktuell Övning' : 'Nästa Övning'}
                                    </h3>
                                    {highlightedExercise.reps && highlightedExercise.reps.trim() && (
                                        <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white/90 leading-tight mb-2 capitalize">
                                            {highlightedExercise.reps}
                                        </p>
                                    )}
                                    <div className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                                        {highlightedExercise.name}
                                    </div>
                                    {highlightedExercise.description && (
                                        <p className="text-base sm:text-lg lg:text-xl mt-4 text-white/90">{highlightedExercise.description}</p>
                                    )}
                                </div>

                                {/* Right Column: Image */}
                                {highlightedExercise.imageUrl && (
                                    <div className="w-full md:w-1/2 flex-shrink-0">
                                        <img 
                                            src={highlightedExercise.imageUrl} 
                                            alt={highlightedExercise.name} 
                                            className="w-full aspect-square object-cover rounded-xl shadow-lg"
                                        />
                                    </div>
                                )}
                          </div>
                      )}
                  </div>
                </div>
            </div>
        )}
      </div>

      {participantToUndo && (
        <UndoConfirmationModal
            participantName={participantToUndo}
            onConfirm={handleUndoParticipantFinish}
            onCancel={() => setParticipantToUndo(null)}
            isSaving={!!savingParticipant && savingParticipant === participantToUndo}
        />
      )}

      {isHyroxRace && hasParticipants && activeWorkout?.participants && (
        <div className="w-80 lg:w-96 flex-shrink-0 border-l border-gray-700">
            <ParticipantFinishList
                participants={activeWorkout.participants}
                finishedTimes={finishedParticipants}
                onFinish={handleParticipantFinish}
                onUndo={(name) => setParticipantToUndo(name)}
                isSaving={(name) => savingParticipant === name}
            />
        </div>
      )}
    </div>
  );
};

// --- Main App Router ---
export default function App() {
  const { authLoading, currentUser, role, isStudioMode } = useAuth();
  const { studioLoading, selectedStudio, selectOrganization, allOrganizations, selectedOrganization } = useStudio();
  
  useEffect(() => {
    // When a non-studio user logs in, ensure an organization is selected.
    // Default to the first one if none is selected.
    if (!isStudioMode && !studioLoading && allOrganizations.length > 0 && !selectedOrganization) {
        selectOrganization(allOrganizations[0]);
    }
  }, [isStudioMode, studioLoading, allOrganizations, selectOrganization, selectedOrganization]);

  if (authLoading || studioLoading) {
    return <div className="bg-black text-white min-h-screen flex items-center justify-center">Laddar...</div>;
  }
  
  if (!currentUser) {
    return <LoginScreen />;
  }

  if (isStudioMode && !selectedStudio) {
      // Anonymous user (a studio screen) needs to be configured.
      return (
        <div className="bg-black text-white min-h-screen">
          <StudioSelectionScreen onStudioSelected={() => { /* Reload handled by context */ }} />
        </div>
      );
  }

  return <MainContent />;
}


// Image Preview Modal Component
const ImagePreviewModal: React.FC<{ imageUrl: string | null; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] p-2 bg-gray-900 rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <img src={imageUrl} alt="Exercise" className="max-w-full max-h-[85vh] object-contain rounded-md" />
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl shadow-lg border-2 border-black"
          aria-label="Stäng bildvisning"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

const deepCopyAndPrepareAsNew = (workoutToCopy: Workout): Workout => {
    const newWorkout = JSON.parse(JSON.stringify(workoutToCopy));
    
    newWorkout.id = `workout-${Date.now()}`;
    newWorkout.title = `KOPIA - ${workoutToCopy.title}`;
    newWorkout.isPublished = false; // Always a draft
    newWorkout.isFavorite = false;
    newWorkout.createdAt = Date.now();
    delete newWorkout.participants; // Do not copy participants

    newWorkout.blocks = newWorkout.blocks.map((block: WorkoutBlock, bIndex: number) => {
        block.id = `block-${Date.now()}-${bIndex}`;
        block.exercises = block.exercises.map((ex: Exercise, eIndex: number) => {
            ex.id = `ex-${Date.now()}-${bIndex}-${eIndex}`;
            return ex;
        });
        return block;
    });

    return newWorkout;
};

const THEME_STORAGE_KEY = 'flexibel-screen-theme';

const MainContent: React.FC = () => {
  const { 
    selectedStudio, selectStudio, allStudios, setAllStudios,
    selectedOrganization, selectOrganization, allOrganizations, setAllOrganizations,
    studioConfig
  } = useStudio();
  const { role, userData, isStudioMode, signOut, isImpersonating, startImpersonation, stopImpersonation, showTerms, acceptTerms } = useAuth();
  
  // Local temporary role state for coach access
  const [sessionRole, setSessionRole] = useState<UserRole>(role);

  const [history, setHistory] = useState<Page[]>([Page.Home]);
  const page = history[history.length - 1];
  const [customBackHandler, setCustomBackHandler] = useState<(() => void) | null>(null);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeBlock, setActiveBlock] = useState<WorkoutBlock | null>(null);
  const [activePasskategori, setActivePasskategori] = useState<string | null>(null);
  const [activeCustomPage, setActiveCustomPage] = useState<CustomPage | null>(null);
  const [activeDisplayWindow, setActiveDisplayWindow] = useState<DisplayWindow | null>(null);

  const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
  const [isEditingNewDraft, setIsEditingNewDraft] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [customPageToEdit, setCustomPageToEdit] = useState<CustomPage | null>(null);
  const [studioToEditConfig, setStudioToEditConfig] = useState<Studio | null>(null);
  
  const [isBoostModalOpen, setBoostModalOpen] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ workout: Workout, isFinal: boolean, blockTag?: string, finishTime?: number } | null>(null);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);
  const [isRegisteringHyroxTime, setIsRegisteringHyroxTime] = useState(false);

  const [aiGeneratorPrompt, setAiGeneratorPrompt] = useState<string>('');
  const [isPromptFromBoost, setIsPromptFromBoost] = useState(false);
  const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage' | 'create'>('create');
  
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    // If no saved theme, respect user's OS preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    // Default to dark
    return 'dark';
  });
  const [isTimerHeaderVisible, setIsTimerHeaderVisible] = useState(true);
  const [isGeneratingBoost, setIsGeneratingBoost] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isBreathingSettingsOpen, setIsBreathingSettingsOpen] = useState(false);
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [isBackButtonHidden, setIsBackButtonHidden] = useState(false);
  const inactivityTimerRef = useRef<number | null>(null);

    const pagesThatPreventScreensaver: Page[] = [
        Page.Timer,
        Page.RepsOnly,
        Page.BreathingGuide,
        Page.DisplayWindow,
    ];

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }

        if (studioConfig.enableScreensaver && !pagesThatPreventScreensaver.includes(page)) {
            const timeoutMinutes = studioConfig.screensaverTimeoutMinutes || 15;
            inactivityTimerRef.current = window.setTimeout(() => {
                setIsScreensaverActive(true);
            }, timeoutMinutes * 60 * 1000);
        }
    }, [studioConfig.enableScreensaver, studioConfig.screensaverTimeoutMinutes, page]);

    const handleUserActivity = useCallback(() => {
        if (isScreensaverActive) {
            setIsScreensaverActive(false);
        }
        resetInactivityTimer();
    }, [isScreensaverActive, resetInactivityTimer]);

    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
            }
        };
    }, [resetInactivityTimer, page]);

    useEffect(() => {
        const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
        events.forEach(event => window.addEventListener(event, handleUserActivity));
        return () => {
            events.forEach(event => window.removeEventListener(event, handleUserActivity));
        };
    }, [handleUserActivity]);

  // Load notes from localStorage on mount
  useEffect(() => {
    try {
        const storedNotes = localStorage.getItem('flexibel-saved-notes');
        if (storedNotes) {
            setSavedNotes(JSON.parse(storedNotes));
        }
    } catch (e) {
        console.error("Failed to load notes from localStorage", e);
    }
  }, []);

  // Save notes to localStorage on change
  useEffect(() => {
    try {
        localStorage.setItem('flexibel-saved-notes', JSON.stringify(savedNotes));
    } catch (e) {
        console.error("Failed to save notes to localStorage", e);
    }
  }, [savedNotes]);

  const handleSaveNote = (note: Note) => {
    setSavedNotes(prev => [note, ...prev]); // Add new note to the beginning
  };

  const handleDeleteNote = (noteId: string) => {
      const noteToDelete = savedNotes.find(note => note.id === noteId);
      if (noteToDelete?.imageUrl) {
          deleteImageByUrl(noteToDelete.imageUrl);
      }
      setSavedNotes(prev => prev.filter(note => note.id !== noteId));
  };
  
  const handleUpdateNote = (noteToUpdate: Note) => {
    setSavedNotes(prev => prev.map(note => note.id === noteToUpdate.id ? noteToUpdate : note));
  };


  const isPresentationContext = useMemo(() => {
    // The presentation flow is Home -> (List) -> Detail.
    // We check if the WorkoutDetail page was reached from one of these pages.
    if (page === Page.WorkoutDetail) {
        if (history.length < 2) return false; // Can't be presentation if there's no history
        const previousPage = history[history.length - 2];
        return [Page.Home, Page.WorkoutList].includes(previousPage);
    }
    // For other pages, this context is not relevant.
    return false;
  }, [page, history]);

  const isQrCodeVisible = isStudioMode && page === Page.Home && studioConfig.checkInImageEnabled && studioConfig.checkInImageUrl;

  const activeInfoMessages = useMemo((): InfoMessage[] => {
    const infoCarousel = selectedOrganization?.infoCarousel;
    if (!infoCarousel?.isEnabled || !selectedStudio || !infoCarousel.messages) {
        return [];
    }
    const now = new Date();
    // Filter messages that are currently active
    return infoCarousel.messages.filter(msg => {
        const isStudioMatch = msg.visibleInStudios.includes('all') || msg.visibleInStudios.includes(selectedStudio.id);
        if (!isStudioMatch) return false;

        const hasStartDate = msg.startDate && msg.startDate.length > 0;
        const hasEndDate = msg.endDate && msg.endDate.length > 0;

        if (hasStartDate && new Date(msg.startDate!) > now) return false; // Not yet active
        if (hasEndDate && new Date(msg.endDate!) < now) return false; // Expired

        return true;
    }).sort((a, b) => a.internalTitle.localeCompare(b.internalTitle)); // Stable sort order
  }, [selectedOrganization, selectedStudio]);

  const isInfoBannerVisible = page === Page.Home && activeInfoMessages.length > 0;

  // Set the main page based on role when the component loads
  useEffect(() => {
    if (isImpersonating) return; // Don't change page if we are impersonating
    if (role === 'systemowner') {
        setHistory([Page.SystemOwner]);
    } else if (role === 'organizationadmin') {
        setHistory([Page.SuperAdmin]);
    } else {
        setHistory([Page.Home]);
    }
  }, [role, isImpersonating]);
  
  // Update session role if the main role changes (e.g. dev toolbar)
  useEffect(() => {
    setSessionRole(role);
  }, [role]);

  // Fetch workouts when organization changes
  useEffect(() => {
    if (selectedOrganization) {
        const fetchWorkouts = async () => {
            setWorkoutsLoading(true);
            try {
                const fetchedWorkouts = await getWorkoutsForOrganization(selectedOrganization.id);
                setWorkouts(fetchedWorkouts);
            } catch (error) {
                console.error("Error fetching workouts:", error);
                setWorkouts([]); // reset on error
            } finally {
                setWorkoutsLoading(false);
            }
        };
        fetchWorkouts();
    } else {
        setWorkouts([]);
        setWorkoutsLoading(false);
    }
}, [selectedOrganization]);

// Automatic cleanup of old, non-favorited workouts
useEffect(() => {
    if (workouts.length > 0 && selectedOrganization) {
        const cleanupWorkouts = async () => {
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            
            // Cleanup member-created Boost workouts that aren't favorited and are older than a day.
            // Admin-created drafts are now permanent until manually deleted.
            const workoutsToDelete = workouts.filter(w => 
                w.category === 'Boost' && // Only target member-created Boosts
                !w.isPublished && 
                !w.isFavorite && 
                w.createdAt &&
                (now - w.createdAt > ONE_DAY)
            );
            
            if (workoutsToDelete.length > 0) {
                console.log(`Cleaning up ${workoutsToDelete.length} old, non-favorite member-created Boost workouts.`);
                const deletePromises = workoutsToDelete.map(w => deleteWorkout(w.id));
                try {
                    await Promise.all(deletePromises);
                    // If successful, update state in one go.
                    const deletedIds = new Set(workoutsToDelete.map(w => w.id));
                    setWorkouts(prev => prev.filter(w => !deletedIds.has(w.id)));
                } catch (error) {
                    console.error("Failed to cleanup old workouts:", error);
                    // It will try again on next load
                }
            }
        };
        // Run cleanup with a small delay to not interfere with initial render
        const timer = setTimeout(cleanupWorkouts, 5000);
        return () => clearTimeout(timer);
    }
}, [workouts.length, selectedOrganization]); // Reruns if number of workouts changes


  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };
  
  const handleShowImage = (url: string) => {
    setPreviewImageUrl(url);
  };

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);
  
  useEffect(() => {
    const root = document.documentElement;
    const primaryColor = selectedOrganization?.primaryColor;
    if (primaryColor) {
      root.style.setProperty('--color-primary', primaryColor);
    } else {
      root.style.removeProperty('--color-primary');
    }
  }, [selectedOrganization]);


  const navigateTo = (page: Page) => {
    setHistory(prev => [...prev, page]);
  };
  
  const navigateReplace = (page: Page) => {
    setHistory(prev => {
        const newHistory = prev.slice(0, -1);
        newHistory.push(page);
        return newHistory;
    });
  };

  const handleCreateNewWorkout = () => {
    setWorkoutToEdit(null);
    setFocusedBlockId(null);
    if (sessionRole === 'member') {
        navigateTo(Page.SimpleWorkoutBuilder);
    } else {
        navigateTo(Page.WorkoutBuilder);
    }
  };

  const handleEditWorkout = (workout: Workout, blockId?: string) => {
    setWorkoutToEdit(workout);
    setFocusedBlockId(blockId || null);
    setIsEditingNewDraft(false);
    if (sessionRole === 'member') {
      navigateTo(Page.SimpleWorkoutBuilder);
    } else {
      navigateTo(Page.WorkoutBuilder);
    }
  };

  // Centralized function for saving a workout, updating state, and saving to DB
  const persistWorkoutStateAndDb = async (workout: Workout): Promise<Workout> => {
    if (!selectedOrganization) {
        alert("Kan inte spara pass: ingen organisation är vald.");
        return workout; // Return original on failure to prevent downstream errors
    }
    
    const isNew = !workouts.some(w => w.id === workout.id);
    const workoutToSave: Workout = { 
        ...workout, 
        organizationId: selectedOrganization.id,
        createdAt: workout.createdAt || Date.now(),
        isFavorite: workout.isFavorite || false,
    };
  
    const originalWorkouts = [...workouts];
    
    const newWorkouts = isNew
        ? [workoutToSave, ...originalWorkouts]
        : originalWorkouts.map(w => (w.id === workoutToSave.id ? workoutToSave : w));
    
    setWorkouts(newWorkouts);
  
    if (activeWorkout?.id === workoutToSave.id) {
        setActiveWorkout(workoutToSave);
    }
  
    try {
      await saveWorkout(workoutToSave);

      return workoutToSave; // Return the saved workout on success
    } catch (error) {
      console.error("Kunde inte spara passet:", error);
      alert("Ett fel uppstod när passet skulle sparas. Försök igen.");
      // Revert state on error
      setWorkouts(originalWorkouts);
      if(activeWorkout?.id === workoutToSave.id) {
        setActiveWorkout(originalWorkouts.find(w => w.id === workoutToSave.id) || null);
      }
      return workout; // Return original workout
    }
  };
  
  const handleSaveWorkout = async (workout: Workout, startFirstBlock?: boolean) => {
    const savedWorkout = await persistWorkoutStateAndDb(workout);
    // Continue with navigation logic only if save was successful (IDs match)
    if (savedWorkout.id === workout.id) {
        setActiveWorkout(savedWorkout);
        if (startFirstBlock && savedWorkout.blocks.length > 0) {
            handleStartBlock(savedWorkout.blocks[0]);
        } else {
            const isCoachOrAdmin = sessionRole !== 'member';
            const currentPage = history[history.length - 1];
            const cameFromBuilder = currentPage === Page.WorkoutBuilder || currentPage === Page.SimpleWorkoutBuilder;

            if (isCoachOrAdmin && cameFromBuilder) {
                // For admins/coaches, go to the "Hantera Pass" view after saving.
                setAiGeneratorInitialTab('manage');
                navigateReplace(Page.AIGenerator);
            } else {
                // For members, go to the detail screen.
                navigateReplace(Page.WorkoutDetail);
            }
        }
    }
  };
  
  const handleTogglePublishStatus = async (workoutId: string, isPublished: boolean) => {
    const workoutToToggle = workouts.find(w => w.id === workoutId);
    if (workoutToToggle) {
        const updatedWorkout = { ...workoutToToggle, isPublished };
        await persistWorkoutStateAndDb(updatedWorkout);
    }
  };

  const handleToggleFavoriteStatus = async (workoutId: string) => {
    const workoutToToggle = workouts.find(w => w.id === workoutId);
    if (workoutToToggle) {
        const updatedWorkout = { ...workoutToToggle, isFavorite: !workoutToToggle.isFavorite };
        await persistWorkoutStateAndDb(updatedWorkout);
    }
  };

  const handleBack = useCallback(() => {
    if (customBackHandler) {
      customBackHandler();
      return;
    }
    if (history.length <= 1) return;

    const currentPage = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    if (currentPage === Page.Coach) {
      // If going back from coach screen, reset role to member if original role was member
      if(role === 'member') {
        setSessionRole('member');
      }
    }
    
    // if going back to home, and original role is admin/owner, go to their main page instead
    if (newHistory[newHistory.length - 1] === Page.Home && (role === 'systemowner' || role === 'organizationadmin') && !isImpersonating) {
      if (role === 'systemowner') setHistory([Page.SystemOwner]);
      else setHistory([Page.SuperAdmin]);
      return;
    }

    setHistory(newHistory);
  }, [history, role, isImpersonating, customBackHandler]);
  
  const handleDeleteWorkout = async (workoutId: string) => {
    if (!selectedOrganization) {
        alert("Kan inte radera pass: ingen organisation är vald.");
        return;
    }
    const originalWorkouts = workouts;
    setWorkouts(prevWorkouts => prevWorkouts.filter(w => w.id !== workoutId));
    try {
        await deleteWorkout(workoutId);
        // If the deleted workout was the one being viewed, navigate back.
        if (activeWorkout?.id === workoutId && page === Page.WorkoutDetail) {
          handleBack();
        }
    } catch (error) {
        console.error("Kunde inte ta bort passet:", error);
        alert("Ett fel uppstod när passet skulle tas bort. Försök igen.");
        setWorkouts(originalWorkouts); // Revert on error
    }
  };
  
  const handleStartBlock = (block: WorkoutBlock) => {
    setActiveBlock(block);
    if (block.settings.mode === TimerMode.NoTimer) {
        navigateTo(Page.RepsOnly);
    } else {
        navigateTo(Page.Timer);
    }
  };

  const handleStartWarmup = (workout: Workout, block: WorkoutBlock) => {
    setActiveWorkout(workout);
    setActiveBlock(block);
    navigateTo(Page.Timer);
  };

  const handleStartFreestandingTimer = (block: WorkoutBlock) => {
    if (!selectedOrganization) {
        alert("Kan inte starta timer: ingen organisation är vald.");
        return;
    }
    const tempWorkout: Workout = {
        id: `freestanding-workout-${Date.now()}`,
        title: block.title,
        coachTips: '',
        blocks: [block],
        category: 'Ej kategoriserad',
        isPublished: false,
        organizationId: selectedOrganization.id
    };
    setActiveWorkout(tempWorkout);
    handleStartBlock(block);
  };

  const handleSelectWorkout = (workout: Workout) => {
    setActiveWorkout(workout);
    navigateTo(Page.WorkoutDetail);
  }
  
  const getBoostPrompt = (difficulty: 'enkel' | 'avancerad', dateString?: string) => {
    if (difficulty === 'enkel') {
        return `Skapa en "Enkel WOD".

**Regler:**
*   **Variation:** Skapa ett unikt pass varje gång. Undvik att upprepa samma övningar eller struktur för ofta.
*   Total träningstid: 20–30 minuter.
*   Passet **MÅSTE** struktureras i ett eller flera block inuti "blocks"-arrayen i JSON-svaret.
*   Varje block **MÅSTE** ha en timer (AMRAP, EMOM, Time Cap, Intervall, TABATA). Använd **INTE** "Ingen Timer".
*   Fokusera på tillgängliga övningar som kan skalas för olika nivåer.
*   Passet ska vara roligt, utmanande och ge en helkroppskänsla.
*   **Titel**: Sätt workout-titeln till något passande i stil med "Dagens Enkla WOD" eller liknande.
*   **Coach Tips**: Ge ett kort, peppande tips till deltagarna.`;
    }
    return `Du är en expert CrossFit-coach. Skapa en "Avancerad WOD" för Flexibel Hälsostudio.

**Regler:**
1.  **Välj en av två vägar (slumpmässigt):**
    *   **Alternativ A: Benchmark WOD:** Välj en välkänd, namngiven CrossFit "Benchmark" WOD. 
        *   **Exempel:** "Fran", "Cindy", "Helen", "Diane", "Elizabeth", "Grace", "Isabel", "Jackie", "Karen", "Nancy", "Angie", "Barbara", "Mary".
        *   **VIKTIGT OM VARIATION:** Variera ditt val kraftigt. Välj **INTE** samma Benchmark WOD flera gånger i rad. Prioritera mindre vanliga WODs framför de allra mest kända som "Fran".
        *   **Titel:** Titeln på passet (\`title\`) MÅSTE vara det officiella namnet på WOD:en.
    *   **Alternativ B: Ny WOD:** Skapa ett nytt, kreativt och utmanande CrossFit-inspirerat pass. Passet kan innehålla en styrkedel följt av en metcon, eller vara en längre "chipper". **Titeln på passet (\`title\`) MÅSTE vara ett passande, kreativt namn följt av dagens datum: "${dateString}".**

2.  **Måltid:** Sikta på en total tid på 20-30 minuter. För längre benchmark-pass, inkludera skalningsalternativ i "coachTips" för att passa inom tidsramen.

3.  **Struktur:** Passet MÅSTE följa JSON-schemat. Det ska bestå av ett eller flera block. Varje block måste ha en timer (AMRAP, For Time via Time Cap, EMOM, Intervall, TABATA). Använd INTE "Ingen Timer".

4.  **Coach Tips:** Ge alltid ett kort, peppande och tekniskt tips till deltagarna i \`coachTips\`. För benchmark-pass, nämn gärna vad som är ett bra resultat eller vad man ska fokusera på.

5.  **Känsla:** Känslan ska vara en klassisk, rolig och svettig WOD med CrossFit-känsla.`;
  }

  const handleSelectBoostDifficulty = async (difficulty: 'enkel' | 'avancerad') => {
    if (!selectedOrganization) {
        alert("Kan inte skapa pass: ingen organisation är vald.");
        return;
    }

    const dateForPrompt = new Date();
    const formattedDateForPrompt = `${dateForPrompt.getFullYear()}-${String(dateForPrompt.getMonth() + 1).padStart(2, '0')}-${String(dateForPrompt.getDate()).padStart(2, '0')}`;
    const prompt = getBoostPrompt(difficulty, formattedDateForPrompt);
    
    setBoostModalOpen(false);
    setIsGeneratingBoost(true);
    
    try {
      const generatedWorkout = await generateWorkout(prompt);

      const boostWorkout: Workout = {
          ...generatedWorkout,
          id: `boost-${Date.now()}`,
          category: 'Boost',
          isPublished: false,
          organizationId: selectedOrganization.id,
          createdAt: Date.now(),
          isFavorite: false,
      };

      // Auto-save the workout
      setWorkouts(prev => [boostWorkout, ...prev].sort((a,b) => a.title.localeCompare(b.title))); // Optimistic update
      await saveWorkout(boostWorkout); // Persist

      setActiveWorkout(boostWorkout);
      navigateTo(Page.WorkoutDetail);

    } catch (err) {
      console.error("Failed to generate Boost WOD:", err);
      alert(`Kunde inte skapa ett Boost-pass: ${err instanceof Error ? err.message : 'Ett okänt fel inträffade.'}`);
    } finally {
      setIsGeneratingBoost(false);
    }
  };

  const handleDuplicateWorkout = (workoutToCopy: Workout) => {
    const newDraft = deepCopyAndPrepareAsNew(workoutToCopy);
    setWorkoutToEdit(newDraft);
    setIsEditingNewDraft(true);
    navigateTo(Page.WorkoutBuilder);
  };

  const handleSelectPasskategori = (passkategori: Passkategori) => {
    const publishedWorkouts = workouts.filter(w => w.isPublished && w.category === passkategori);
    if (publishedWorkouts.length === 1) {
        handleSelectWorkout(publishedWorkouts[0]);
    } else {
        setActivePasskategori(passkategori);
        navigateTo(Page.WorkoutList);
    }
  };
  
  const handleCoachAccessRequest = () => {
    if (sessionRole === 'member') {
        setIsPasswordModalOpen(true);
    } else {
        navigateTo(Page.Coach);
    }
  };
  
  const handleSelectCustomPage = (page: CustomPage) => {
    setActiveCustomPage(page);
    navigateTo(Page.CustomContent);
  };

  
  const handleUpdateBlockSettings = (blockId: string, newSettings: Partial<TimerSettings>) => {
    if (!activeWorkout || !selectedOrganization) return;

    const updatedWorkout: Workout = { 
      ...activeWorkout, 
      blocks: activeWorkout.blocks.map(b => 
        b.id === blockId ? { ...b, settings: { ...b.settings, ...newSettings } } : b
      )
    };
    
    // Optimistically update UI
    setActiveWorkout(updatedWorkout);

    if (sessionRole !== 'member') {
      // Use the centralized function to handle DB save and state updates.
      // This will ensure createdAt is handled correctly.
      persistWorkoutStateAndDb(updatedWorkout).catch(e => {
          console.error("Failed to save updated block settings:", e);
      });
    }
  };
  
  const handleGeneratedWorkout = (newWorkout: Workout) => {
    setWorkoutToEdit(newWorkout);
    setFocusedBlockId(null);
    setIsEditingNewDraft(true);
    navigateTo(Page.WorkoutBuilder);
  }
  
  const handleWorkoutInterpretedFromNote = (workout: Workout) => {
    setWorkoutToEdit(workout);
    setIsEditingNewDraft(true);
    navigateTo(Page.SimpleWorkoutBuilder);
  };
  
  const handleTimerFinish = useCallback((finishData: { isNatural?: boolean; time?: number } = {}) => {
    const { isNatural = false, time } = finishData;

    if (completionInfo) return; // Prevent re-triggering if modal is already open

    // HIGHEST PRIORITY: A manual click on "Avsluta Block" (`isNatural: false`) should always navigate back.
    // This now works for both regular blocks and HYROX simulations.
    if (!isNatural) {
      handleBack();
      return;
    }

    // If the timer finishes NATURALLY (`isNatural: true`):
    // For a HYROX race, the timer runs indefinitely as a stopwatch, so a natural finish shouldn't do anything.
    if (activeWorkout?.id.startsWith('hyrox-full-race')) {
        return;
    }
    
    // For all other workout types, a natural finish shows the completion modal.
    if (activeWorkout && activeBlock) {
        const blockIndex = activeWorkout.blocks.findIndex(b => b.id === activeBlock.id);
        const isLastBlock = blockIndex === activeWorkout.blocks.length - 1;
        setCompletionInfo({ workout: activeWorkout, isFinal: isLastBlock, blockTag: activeBlock.tag, finishTime: time });
    } else if (activeWorkout) {
        // Fallback for freestanding timers or other edge cases
        setCompletionInfo({ workout: activeWorkout, isFinal: true, blockTag: activeWorkout.blocks[0]?.tag, finishTime: time });
    }
  }, [completionInfo, handleBack, activeWorkout, activeBlock]);

  const handleCloseWorkoutCompleteModal = () => {
    const isWarmup = completionInfo?.blockTag === 'Uppvärmning';
    setCompletionInfo(null);
    
    if (isWarmup) {
      // For a warmup, navigate back to the appropriate home screen.
      const homePage = (role === 'systemowner' || role === 'organizationadmin') && !isImpersonating 
          ? (role === 'systemowner' ? Page.SystemOwner : Page.SuperAdmin) 
          : Page.Home;
      setHistory([homePage]);
    } else {
      handleBack(); // Standard behavior for workout blocks
    }
  };

  const handleSaveStudioConfig = async (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>) => {
    try {
      const updatedStudio = await updateStudioConfig(organizationId, studioId, newConfigOverrides);
      selectStudio(updatedStudio); 
      setAllStudios(prev => prev.map(s => s.id === studioId ? updatedStudio : s));
      setStudioToEditConfig(null); // Close modal on success
    } catch (error) {
      console.error("Failed to save studio config:", error);
      alert("Kunde inte spara konfigurationen.");
    }
  };

  const handleEditStudioConfig = (studio: Studio) => {
      setStudioToEditConfig(studio);
  };

  const handleSaveGlobalConfig = async (organizationId: string, newConfig: StudioConfig) => {
      try {
          await updateGlobalConfig(organizationId, newConfig);
          const updatedOrg = { ...selectedOrganization!, globalConfig: newConfig };
          selectOrganization(updatedOrg);
          setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
      } catch (error) {
           console.error("Failed to save global config:", error);
           alert("Kunde inte spara global konfiguration.");
      }
  };

  const handleCreateStudio = async (organizationId: string, name: string) => {
      try {
          const newStudio = await createStudio(organizationId, name);
          const newOrgs = allOrganizations.map(o => {
              if (o.id === organizationId) {
                  return { ...o, studios: [...o.studios, newStudio] };
              }
              return o;
          });
          setAllOrganizations(newOrgs);
          const updatedOrg = newOrgs.find(o => o.id === organizationId);
          if (updatedOrg) {
              selectOrganization(updatedOrg);
          }
      } catch (error) {
          console.error("Failed to create studio:", error);
          alert("Kunde inte skapa studio.");
      }
  };

    const handleUpdateStudio = async (organizationId: string, studioId: string, name: string) => {
        try {
            await updateStudio(organizationId, studioId, name);
            const newOrgs = allOrganizations.map(o => {
                if (o.id === organizationId) {
                    const newStudios = o.studios.map(s => s.id === studioId ? { ...s, name } : s);
                    return { ...o, studios: newStudios };
                }
                return o;
            });
            setAllOrganizations(newOrgs);
            const updatedOrg = newOrgs.find(o => o.id === organizationId);
            if (updatedOrg) {
                selectOrganization(updatedOrg);
            }
        } catch (error) {
            console.error("Failed to update studio:", error);
            alert("Kunde inte uppdatera studion.");
        }
    };

    const handleDeleteStudio = async (organizationId: string, studioId: string) => {
        try {
            await deleteStudio(organizationId, studioId);
            const newOrgs = allOrganizations.map(o => {
                if (o.id === organizationId) {
                    const newStudios = o.studios.filter(s => s.id !== studioId);
                    return { ...o, studios: newStudios };
                }
                return o;
            });
            setAllOrganizations(newOrgs);
            const updatedOrg = newOrgs.find(o => o.id === organizationId);
            if (updatedOrg) {
                selectOrganization(updatedOrg);
            }
        } catch (error) {
            console.error("Failed to delete studio:", error);
            alert("Kunde inte ta bort studion.");
        }
    };

  const handleCreateOrganization = async (name: string, subdomain: string) => {
    try {
        const newOrg = await createOrganization(name, subdomain);
        setAllOrganizations(prev => [...prev, newOrg]);
    } catch (error) {
        console.error("Failed to create organization:", error);
        alert(`Kunde inte skapa organisation: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };
  
  const handleUpdateOrganization = async (organizationId: string, name: string, subdomain: string) => {
    try {
        const updatedOrg = await updateOrganization(organizationId, name, subdomain);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization:", error);
        alert(`Kunde inte uppdatera organisation: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
        throw error;
    }
  };

  const handleDeleteOrganization = async (organizationId: string) => {
    try {
        await deleteOrganization(organizationId);
        setAllOrganizations(prev => prev.filter(o => o.id !== organizationId));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(null);
            setHistory([Page.SystemOwner]);
        }
    } catch (error) {
        console.error("Failed to delete organization:", error);
        alert(`Kunde inte ta bort organisation: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };
  
  const handleUpdateOrganizationPasswords = async (organizationId: string, passwords: Organization['passwords']) => {
    try {
        const updatedOrg = await updateOrganizationPasswords(organizationId, passwords);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization passwords:", error);
        alert(`Kunde inte uppdatera lösenord: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };

  const handleUpdateOrganizationLogos = async (organizationId: string, logos: { light: string; dark: string }) => {
    try {
        const updatedOrg = await updateOrganizationLogos(organizationId, logos);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization logos:", error);
        alert(`Kunde inte uppdatera logotyper: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };

  const handleUpdateOrganizationPrimaryColor = async (organizationId: string, color: string) => {
    try {
        const updatedOrg = await updateOrganizationPrimaryColor(organizationId, color);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization primary color:", error);
        alert(`Kunde inte uppdatera primärfärg: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };

  const handleUpdateOrganizationCustomPages = async (organizationId: string, customPages: CustomPage[]) => {
    try {
        const updatedOrg = await updateOrganizationCustomPages(organizationId, customPages);
        setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update custom pages:", error);
        alert(`Kunde inte uppdatera infosidor: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };

    const handleUpdateOrganizationInfoCarousel = async (organizationId: string, infoCarousel: InfoCarousel) => {
        try {
            const updatedOrg = await updateOrganizationInfoCarousel(organizationId, infoCarousel);
            setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
            if (selectedOrganization?.id === organizationId) {
                selectOrganization(updatedOrg);
            }
        } catch (error) {
            console.error("Failed to update info carousel:", error);
            // Re-throw the error so the calling component can handle UI state
            throw error;
        }
    };
    
    const handleUpdateOrganizationDisplayWindows = async (organizationId: string, displayWindows: DisplayWindow[]) => {
        try {
            const updatedOrg = await updateOrganizationDisplayWindows(organizationId, displayWindows);
            setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
            if (selectedOrganization?.id === organizationId) {
                selectOrganization(updatedOrg);
            }
        } catch (error) {
            console.error("Failed to update display config:", error);
            throw error;
        }
    };
  
    const handleEditCustomPage = (page: CustomPage | null) => {
        setCustomPageToEdit(page);
        navigateTo(Page.CustomPageEditor);
    };

    const handleSaveCustomPage = async (pageData: CustomPage) => {
        if (!selectedOrganization) return;

        const isNew = !selectedOrganization.customPages?.some(p => p.id === pageData.id);
        const updatedPages = isNew
            ? [...(selectedOrganization.customPages || []), pageData]
            : (selectedOrganization.customPages || []).map(p => p.id === pageData.id ? pageData : p);
        
        await handleUpdateOrganizationCustomPages(selectedOrganization.id, updatedPages);
        handleBack();
    };
    
    const handleDeleteCustomPage = async (pageId: string) => {
        if (!selectedOrganization) return;
        if (window.confirm("Är du säker på att du vill ta bort denna infosida?")) {
            const updatedPages = (selectedOrganization.customPages || []).filter(p => p.id !== pageId);
            await handleUpdateOrganizationCustomPages(selectedOrganization.id, updatedPages);
        }
    };


  const handleSelectOrganization = (organization: Organization) => {
      selectOrganization(organization);
      navigateTo(Page.SuperAdmin);
  };

  const handleSwitchToStudioView = (studio: Studio) => {
    selectStudio(studio);
    startImpersonation({ role: 'member', isStudioMode: true });
    setHistory([Page.Home]);
  };

  const handleReturnToAdmin = () => {
    setIsReAuthModalOpen(true);
  };
  
  const handleSelectDisplayWindow = (window: DisplayWindow) => {
      setActiveDisplayWindow(window);
      navigateTo(Page.DisplayWindow);
  };

  const renderPage = () => {
    switch (page) {
      case Page.Home:
        return <HomeScreen 
            navigateTo={navigateTo} 
            onSelectWorkout={handleSelectWorkout} 
            onSelectPasskategori={handleSelectPasskategori} 
            savedWorkouts={workouts} 
            onCreateNewWorkout={handleCreateNewWorkout} 
            onShowBoostModal={() => setBoostModalOpen(true)} 
            onCoachAccessRequest={handleCoachAccessRequest} 
            studioConfig={studioConfig} 
            organizationLogoUrlLight={selectedOrganization?.logoUrlLight}
            organizationLogoUrlDark={selectedOrganization?.logoUrlDark}
            theme={theme}
        />;
      case Page.WorkoutDetail:
        return activeWorkout && <WorkoutDetailScreen 
            workout={activeWorkout} 
            onStartBlock={handleStartBlock} 
            onUpdateBlockSettings={handleUpdateBlockSettings} 
            onEditWorkout={handleEditWorkout} 
            isCoachView={sessionRole !== 'member'}
            onTogglePublish={handleTogglePublishStatus}
            onToggleFavorite={handleToggleFavoriteStatus}
            onDuplicate={handleDuplicateWorkout}
            onShowImage={handleShowImage}
            isPresentationMode={isPresentationContext}
            studioConfig={studioConfig}
            onDelete={handleDeleteWorkout}
        />;
      case Page.Timer:
        return activeBlock && <TimerScreen 
            key={activeBlock.id} 
            block={activeBlock} 
            onFinish={handleTimerFinish} 
            onHeaderVisibilityChange={setIsTimerHeaderVisible} 
            onShowImage={handleShowImage} 
            activeWorkout={activeWorkout}
            setCompletionInfo={setCompletionInfo}
            setIsRegisteringHyroxTime={setIsRegisteringHyroxTime}
            organizationId={selectedOrganization?.id}
            setIsBackButtonHidden={setIsBackButtonHidden}
        />;
      case Page.RepsOnly:
        return activeBlock && <RepsOnlyScreen block={activeBlock} onFinish={() => handleTimerFinish({ isNatural: false })} onShowImage={handleShowImage} />;
      case Page.Coach:
        return <CoachScreen 
                  role={sessionRole} 
                  navigateTo={navigateTo} 
                  onSelectCustomPage={handleSelectCustomPage}
                  isImpersonating={isImpersonating}
                  onReturnToAdmin={handleReturnToAdmin} 
               />;
      case Page.AIGenerator:
        return <AIGeneratorScreen 
                  onWorkoutGenerated={handleGeneratedWorkout} 
                  initialPrompt={aiGeneratorPrompt} 
                  isFromBoost={isPromptFromBoost} 
                  workouts={workouts}
                  onEditWorkout={handleEditWorkout}
                  onDeleteWorkout={handleDeleteWorkout}
                  onTogglePublish={handleTogglePublishStatus}
                  onCreateNewWorkout={handleCreateNewWorkout}
                  initialMode={aiGeneratorInitialTab}
                  studioConfig={studioConfig}
                  workoutsLoading={workoutsLoading}
                  setCustomBackHandler={setCustomBackHandler}
               />;
      case Page.FreestandingTimer:
        return <FreestandingTimerScreen onStart={handleStartFreestandingTimer} />;
      case Page.WorkoutBuilder:
        return <WorkoutBuilderScreen 
                  initialWorkout={workoutToEdit} 
                  onSave={handleSaveWorkout} 
                  onCancel={handleBack} 
                  focusedBlockId={focusedBlockId} 
                  studioConfig={studioConfig}
                  sessionRole={sessionRole}
                  isNewDraft={isEditingNewDraft}
                />;
      case Page.SimpleWorkoutBuilder:
        return <SimpleWorkoutBuilderScreen 
                  initialWorkout={workoutToEdit}
                  onSave={handleSaveWorkout} 
                  onCancel={handleBack} 
               />;
      case Page.BreathingGuide:
        return <BreathingGuideScreen 
                    onBack={handleBack} 
                    theme={theme} 
                    toggleTheme={toggleTheme}
                    isSettingsOpen={isBreathingSettingsOpen}
                    onOpenSettings={() => setIsBreathingSettingsOpen(true)}
                    onCloseSettings={() => setIsBreathingSettingsOpen(false)}
                />;
      case Page.Warmup:
        return <WarmupScreen onStartWorkout={handleStartWarmup} />;
      case Page.WorkoutList:
        return activePasskategori && <WorkoutListScreen 
            passkategori={activePasskategori} 
            workouts={workouts.filter(w => w.isPublished && w.category === activePasskategori)}
            onSelectWorkout={handleSelectWorkout}
        />;
      case Page.SavedWorkouts:
        return <SavedWorkoutsScreen 
            workouts={workouts.filter(w => !w.isPublished)} 
            onSelectWorkout={handleSelectWorkout} 
            onEditWorkout={handleEditWorkout}
            onDeleteWorkout={handleDeleteWorkout}
            onToggleFavorite={handleToggleFavoriteStatus}
            onCreateNewWorkout={handleCreateNewWorkout}
            />;
      case Page.StudioSelection:
        return <StudioSelectionScreen onStudioSelected={handleBack} />;
      case Page.SuperAdmin:
        return selectedOrganization && <SuperAdminScreen 
                  organization={selectedOrganization}
                  adminRole={userData?.adminRole || 'admin'}
                  userRole={role}
                  theme={theme}
                  onSaveGlobalConfig={handleSaveGlobalConfig}
                  onEditStudioConfig={handleEditStudioConfig}
                  onCreateStudio={handleCreateStudio}
                  onUpdateStudio={handleUpdateStudio}
                  onDeleteStudio={handleDeleteStudio}
                  onUpdatePasswords={handleUpdateOrganizationPasswords}
                  onUpdateLogos={handleUpdateOrganizationLogos}
                  onUpdatePrimaryColor={handleUpdateOrganizationPrimaryColor}
                  onUpdateOrganization={handleUpdateOrganization}
                  onUpdateCustomPages={handleUpdateOrganizationCustomPages}
                  onSwitchToStudioView={handleSwitchToStudioView}
                  onEditCustomPage={handleEditCustomPage}
                  onDeleteCustomPage={handleDeleteCustomPage}
                  onUpdateInfoCarousel={handleUpdateOrganizationInfoCarousel}
                  onUpdateDisplayWindows={handleUpdateOrganizationDisplayWindows}
                  workouts={workouts}
                  workoutsLoading={workoutsLoading}
                  onSaveWorkout={persistWorkoutStateAndDb}
                  onDeleteWorkout={handleDeleteWorkout}
                  onTogglePublish={handleTogglePublishStatus}
              />;
      case Page.SystemOwner:
        return <SystemOwnerScreen 
                  allOrganizations={allOrganizations}
                  onSelectOrganization={handleSelectOrganization}
                  onCreateOrganization={handleCreateOrganization}
                  onDeleteOrganization={handleDeleteOrganization}
               />;
      case Page.CustomContent:
        return activeCustomPage && <CustomContentScreen page={activeCustomPage} />;
      case Page.CustomPageEditor:
        return <CustomPageEditorScreen
                  onSave={handleSaveCustomPage}
                  onCancel={handleBack}
                  pageToEdit={customPageToEdit}
               />
      case Page.DisplayWindow:
        return <DisplayWindowScreen window={activeDisplayWindow} onBack={handleBack} />;
      case Page.DisplayWindowSelection:
        return <DisplayWindowSelectionScreen onSelectWindow={handleSelectDisplayWindow} />;
      case Page.IdeaBoard:
        return <NotesScreen 
            savedNotes={savedNotes} 
            onSaveNote={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            onUpdateNote={handleUpdateNote}
            onWorkoutInterpreted={handleWorkoutInterpretedFromNote}
            studioConfig={studioConfig}
        />;
      case Page.Hyrox:
        return <HyroxScreen 
                   navigateTo={navigateTo}
                   onSelectWorkout={handleSelectWorkout}
                   onSaveWorkout={persistWorkoutStateAndDb}
                   studioConfig={studioConfig}
               />;
      default:
        return <HomeScreen 
            navigateTo={navigateTo} 
            onSelectWorkout={handleSelectWorkout} 
            onSelectPasskategori={handleSelectPasskategori} 
            savedWorkouts={workouts} 
            onCreateNewWorkout={handleCreateNewWorkout} 
            onShowBoostModal={() => setBoostModalOpen(true)} 
            onCoachAccessRequest={handleCoachAccessRequest} 
            studioConfig={studioConfig} 
            organizationLogoUrlLight={selectedOrganization?.logoUrlLight}
            organizationLogoUrlDark={selectedOrganization?.logoUrlDark}
            theme={theme}
        />;
    }
  };

  const isFullScreenPage = page === Page.Timer || page === Page.RepsOnly || page === Page.BreathingGuide || page === Page.DisplayWindow || page === Page.DisplayWindowSelection;
  const paddingClass = isFullScreenPage ? '' : 'p-4 sm:p-6 lg:p-8';

  const infoBannerHeight = 256; // h-64 in Tailwind

  const mainPaddingBottom = useMemo(() => {
    return isInfoBannerVisible ? infoBannerHeight : 0;
  }, [isInfoBannerVisible]);

  const qrCodeTranslateY = useMemo(() => {
    return isInfoBannerVisible ? infoBannerHeight : 0;
  }, [isInfoBannerVisible]);
  
  const showClock = isStudioMode && (page === Page.Home || page === Page.WorkoutDetail);
  const primaryColor = selectedOrganization?.primaryColor || '#14b8a6';
  
  const handleCloseRegistration = () => {
    setIsRegisteringHyroxTime(false);
    setCompletionInfo(null);
  };

  return (
    <div className={`bg-white dark:bg-black text-gray-800 dark:text-gray-200 min-h-screen font-sans flex flex-col ${paddingClass}`}>
       {isOffline && <DeveloperToolbar />}
       {(page === Page.Timer || !isFullScreenPage) && <Header 
        page={page} 
        onBack={handleBack} 
        theme={theme}
        toggleTheme={toggleTheme}
        isVisible={page === Page.Timer ? isTimerHeaderVisible : true}
        activeCustomPageTitle={page === Page.CustomContent ? activeCustomPage?.title : undefined}
        onSignOut={isStudioMode ? undefined : signOut}
        role={role}
        historyLength={history.length}
        showClock={showClock}
        hideBackButton={isBackButtonHidden}
      />}
      <main 
        className={`flex-grow flex flex-col items-center ${page === Page.Home ? 'justify-start' : 'justify-center'}`}
        style={{ paddingBottom: `${mainPaddingBottom}px`}}
      >
        {renderPage()}
      </main>
      {isBoostModalOpen && (
        <BoostModal
          isOpen={isBoostModalOpen}
          onClose={() => setBoostModalOpen(false)}
          onSelectDifficulty={handleSelectBoostDifficulty}
        />
      )}
      {completionInfo && (
          <WorkoutCompleteModal
              isOpen={!!completionInfo}
              onClose={isRegisteringHyroxTime ? handleCloseRegistration : handleCloseWorkoutCompleteModal}
              workout={completionInfo.workout}
              isFinalBlock={completionInfo.isFinal}
              blockTag={completionInfo.blockTag}
              finishTime={completionInfo.finishTime}
              organizationId={selectedOrganization?.id}
              isRegistration={isRegisteringHyroxTime}
          />
      )}
      {isGeneratingBoost && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 flex-col gap-4" role="dialog" aria-modal="true" aria-labelledby="generating-boost-title">
            <div className="relative w-16 h-16 text-primary">
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
            </div>
            <p id="generating-boost-title" className="text-xl text-white font-semibold">Genererar din Dagens Boost...</p>
        </div>
      )}
      {isPasswordModalOpen && (
        <PasswordModal
          coachPassword={selectedOrganization?.passwords.coach}
          onClose={() => setIsPasswordModalOpen(false)}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setSessionRole('coach');
            if (selectedStudio) {
                navigateTo(Page.Coach);
            } else {
                navigateTo(Page.StudioSelection);
            }
          }}
        />
      )}
      {isReAuthModalOpen && (
        <ReAuthModal
            onClose={() => setIsReAuthModalOpen(false)}
            onSuccess={() => {
                setIsReAuthModalOpen(false);
                stopImpersonation();
            }}
        />
      )}
       {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />}
       
       {isInfoBannerVisible && <InfoCarouselBanner messages={activeInfoMessages} className="bottom-0" />}

       {isQrCodeVisible && (
          <div 
            className={`fixed bottom-4 right-4 z-10 transition-transform duration-300 ease-in-out`}
            style={{ transform: `translateY(-${qrCodeTranslateY}px)`}}
          >
              <img
                src={studioConfig.checkInImageUrl}
                alt="QR-kod för incheckning"
                className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-lg"
              />
          </div>
      )}
       {studioToEditConfig && selectedOrganization && (
        <StudioConfigModal
            isOpen={!!studioToEditConfig}
            onClose={() => setStudioToEditConfig(null)}
            studio={studioToEditConfig}
            organization={selectedOrganization}
            onSave={handleSaveStudioConfig}
        />
       )}
        {isScreensaverActive && (
            <Screensaver 
                logoUrl={selectedOrganization?.logoUrlDark || selectedOrganization?.logoUrlLight}
            />
        )}
       {showTerms && <TermsOfServiceModal onAccept={acceptTerms} />}
       {!isFullScreenPage && <Footer />}
       <SupportChat />
    </div>
  );
}

// Header Component
interface HeaderProps {
    page: Page;
    onBack: () => void;
    theme: string;
    toggleTheme: () => void;
    isVisible?: boolean;
    activeCustomPageTitle?: string;
    onSignOut?: () => void;
    role?: UserRole;
    historyLength: number;
    showClock?: boolean;
    hideBackButton?: boolean;
}

const Header: React.FC<HeaderProps> = ({ page, onBack, theme, toggleTheme, isVisible = true, activeCustomPageTitle, onSignOut, role, historyLength, showClock, hideBackButton = false }) => {
  const themeToggleButton = (
    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Växla tema">
      {theme === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );

  const canGoBack = historyLength > 1;

  if (page === Page.Home) {
      return (
        <header className="w-full max-w-5xl mx-auto flex justify-end items-center pb-8 gap-4">
           {showClock && <DigitalClock />}
           {themeToggleButton}
        </header>
      );
  }

  const getTitle = () => {
    switch(page) {
      case Page.CustomContent: return activeCustomPageTitle || 'Information';
      case Page.AIGenerator: return "Pass & Program";
      case Page.FreestandingTimer: return "Timer";
      case Page.WorkoutBuilder: return "Passbyggaren";
      case Page.SimpleWorkoutBuilder: return "Skapa Nytt Pass";
      case Page.WorkoutList: return "Välj Pass";
      case Page.SavedWorkouts: return "Övriga Pass";
      case Page.Warmup: return "Uppvärmning";
      case Page.StudioSelection: return "Välj Studio";
      case Page.SuperAdmin: return "";
      case Page.SystemOwner: return "Systemägare";
      case Page.RepsOnly: return "Övningar";
      case Page.CustomPageEditor: return "";
      case Page.IdeaBoard: return "Idé-tavlan";
      case Page.Hyrox: return "HYROX Träning";
      default: return "";
    }
  }

  return (
    <header className={`w-full max-w-5xl mx-auto flex items-center transition-all duration-300 ease-in-out ${isVisible ? 'pb-8 opacity-100 max-h-40' : 'pb-0 opacity-0 max-h-0 pointer-events-none overflow-hidden'}`}>
      <div className="flex-1">
        {canGoBack && !hideBackButton && (
            <button onClick={onBack} className="text-primary hover:brightness-95 transition-colors text-lg font-semibold">
                <span>Tillbaka</span>
            </button>
        )}
      </div>
      <div className="flex-1 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getTitle()}</h1>
      </div>
      <div className="flex-1 flex justify-end items-center gap-4">
         {showClock && <DigitalClock />}
         {themeToggleButton}
         {onSignOut && (
            <button onClick={onSignOut} className="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors text-lg font-semibold">
                Logga ut
            </button>
         )}
      </div>
    </header>
  );
};


// Footer Component
const Footer: React.FC = () => (
  <footer className="w-full text-center text-gray-500 dark:text-gray-500 text-xs pt-8">
    <p>© 2025 SmartStudio. Alla rättigheter förbehållna.</p>
  </footer>
);