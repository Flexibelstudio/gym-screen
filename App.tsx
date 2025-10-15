import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, TimerStatus, TimerSettings, Passkategori, Studio, MenuItem, StudioConfig, Organization, CustomPage, CustomCategoryWithPrompt, UserRole, UserData, InfoCarousel, InfoMessage, DisplayWindow, Note, StartGroup, HyroxRace } from './types';
import { motion, AnimatePresence } from 'framer-motion';

import { useStudio } from './context/StudioContext';
import { useAuth } from './context/AuthContext';
import { useWorkoutTimer, playBeep } from './hooks/useWorkoutTimer';
import { useRaceLogic } from './hooks/useRaceLogic';
import { TimerSetupModal } from './components/TimerSetupModal';

import { FreestandingTimerScreen } from './components/FreestandingTimerScreen';
import { generateWorkout, parseWorkoutFromText } from './services/geminiService';
import { getWorkoutsForOrganization, saveWorkout, deleteWorkout, createOrganization, updateGlobalConfig, updateStudioConfig, createStudio, updateOrganization, updateOrganizationPasswords, updateOrganizationLogos, updateOrganizationPrimaryColor, updateOrganizationCustomPages, isOffline, updateStudio, deleteStudio, deleteOrganization, updateOrganizationInfoCarousel, updateOrganizationDisplayWindows, deleteImageByUrl, saveRace } from './services/firebaseService';
import { WorkoutBuilderScreen } from './components/WorkoutBuilderScreen';
import { SimpleWorkoutBuilderScreen } from './components/SimpleWorkoutBuilderScreen';
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
import { NotesScreen } from './components/NotesScreen';
import { HyroxScreen } from './components/HyroxScreen';
import { TermsOfServiceModal } from './components/TermsOfServiceModal';
import { SupportChat } from './components/SupportChat';
import { HyroxRaceListScreen } from './components/HyroxRaceListScreen';
import { HyroxRaceDetailScreen } from './components/HyroxRaceDetailScreen';

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

            // Update sizes for all elements if not already set.
            physicsElements.forEach(el => {
                if ((el.size.w === 0 || el.size.h === 0) && el.ref.current) {
                    const elRect = el.ref.current.getBoundingClientRect();
                    el.size.w = (elRect.width / containerRect.width) * 100;
                    el.size.h = (elRect.height / containerRect.height) * 100;
                }
            });
            
            // Handle wall collisions for each element. This updates their velocities.
            physicsElements.forEach(el => {
                const nextX = el.pos.x + el.vel.vx;
                const nextY = el.pos.y + el.vel.vy;

                if (nextX <= 0 || nextX >= 100 - el.size.w) {
                    el.vel.vx *= -1;
                }
                if (nextY <= 0 || nextY >= 100 - el.size.h) {
                    el.vel.vy *= -1;
                }
            });
            
            // Handle inter-element collisions using the (potentially updated) velocities.
            if (physicsElements.length > 1) {
                const [el1, el2] = physicsElements;
                
                // Predict next positions to check for overlap
                const nextPos1 = { x: el1.pos.x + el1.vel.vx, y: el1.pos.y + el1.vel.vy };
                const nextPos2 = { x: el2.pos.x + el2.vel.vx, y: el2.pos.y + el2.vel.vy };

                // AABB collision detection
                if (
                    nextPos1.x < nextPos2.x + el2.size.w &&
                    nextPos1.x + el1.size.w > nextPos2.x &&
                    nextPos1.y < nextPos2.y + el2.size.h &&
                    nextPos1.y + el1.size.h > nextPos2.y
                ) {
                    // On collision, swap velocities. A simple model for elastic collision of equal masses.
                    const tempVel = el1.vel;
                    el1.vel = el2.vel;
                    el2.vel = tempVel;
                }
            }
            
            // Finally, update positions for all elements based on their final velocities for this tick.
            physicsElements.forEach(el => {
                el.pos.x += el.vel.vx;
                el.pos.y += el.vel.vy;

                // Safety clamp to ensure elements don't get stuck outside bounds.
                el.pos.x = Math.max(0, Math.min(el.pos.x, 100 - el.size.w));
                el.pos.y = Math.max(0, Math.min(el.pos.y, 100 - el.size.h));
            });
            
            // Update React state to trigger the CSS transition.
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
const RepsOnlyScreen: React.FC<{ block: WorkoutBlock; onFinish: () => void; onShowImage: (url: string) => void; organization: Organization | null; workout: Workout | null; }> = ({ block, onFinish, onShowImage, organization, workout }) => {
    
    const formatExerciseName = (ex: Exercise | null) => {
      if (!ex) return null;
      const repsTrimmed = ex.reps?.trim();
      return repsTrimmed ? `${repsTrimmed} ${ex.name}` : ex.name;
    };
    
    const getExerciseImageUrl = (ex: Exercise | null, org: Organization | null): string | undefined => {
        if (!ex) return undefined;
        if (org?.exerciseOverrides && org.exerciseOverrides[ex.id]) {
            return org.exerciseOverrides[ex.id].imageUrl;
        }
        return ex.imageUrl;
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
                            {block.exercises.map((ex) => {
                                const imageUrl = getExerciseImageUrl(ex, organization);
                                return (
                                <div key={ex.id} className="p-4 rounded-lg bg-gray-200 dark:bg-slate-900 text-gray-800 dark:text-gray-200">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-grow">
                                            <p className="text-3xl font-bold">{formatExerciseName(ex)}</p>
                                            {ex.description && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ex.description}</p>
                                            )}
                                        </div>
                                        {!workout?.hideExerciseImages && imageUrl && (
                                            <button 
                                                onClick={() => onShowImage(imageUrl)} 
                                                className="flex-shrink-0 ml-4 group"
                                                aria-label="Visa övningsbild"
                                            >
                                                <img src={imageUrl} alt={ex.name} className="w-16 h-16 object-cover rounded-md transition-transform group-hover:scale-105 shadow-sm"/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )})}
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
    <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
    >
        <motion.div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
        >
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
        </motion.div>
    </motion.div>
);

const RaceResetConfirmationModal: React.FC<{
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ onConfirm, onCancel }) => (
    <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
    >
        <motion.div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
        >
            <h2 className="text-2xl font-bold mb-4">Starta om loppet?</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
                Detta nollställer timer, startgrupper och alla tider.
            </p>
            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors">
                    Ja, starta om
                </button>
            </div>
        </motion.div>
    </motion.div>
);

const RaceBackToPrepConfirmationModal: React.FC<{
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ onConfirm, onCancel }) => (
    <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
    >
        <motion.div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
        >
            <h2 className="text-2xl font-bold mb-4">Tillbaka till startgrupper?</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
                Timern kommer att stoppas och alla registrerade tider nollställs. Du kommer tillbaka till vyn för att justera startgrupper.
            </p>
            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors">
                    Ja, fortsätt
                </button>
            </div>
        </motion.div>
    </motion.div>
);

const RaceFinishAnimation: React.FC<{ winnerName?: string | null, onDismiss: () => void }> = ({ winnerName, onDismiss }) => (
    <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1001] p-4 animate-fade-in"
        onClick={onDismiss}
    >
        <Confetti />
        <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-9xl animate-zoom-fade-in" style={{ animationDelay: '200ms' }}>🏆</div>
            <h2 
                className="text-7xl font-black tracking-wider uppercase text-yellow-400 drop-shadow-lg animate-zoom-fade-in"
                style={{ animationDelay: '400ms' }}
            >
                Loppet är slut!
            </h2>
            <p 
                className="text-3xl text-white/90 mt-4 animate-zoom-fade-in"
                style={{ animationDelay: '600ms' }}
            >
                Fantastiskt jobbat allihopa!
            </p>
            {winnerName && (
                <p className="mt-6 text-2xl font-semibold text-yellow-300 animate-zoom-fade-in" style={{ animationDelay: '800ms' }}>
                    🥇 Vinnare: {winnerName}
                </p>
            )}
            <button
                onClick={onDismiss}
                className="mt-12 bg-white/20 text-white/80 hover:bg-white/30 hover:text-white font-semibold py-3 px-8 rounded-full transition-colors text-lg"
            >
                Stäng
            </button>
        </div>
    </div>
);

interface TimerScreenProps {
    block: WorkoutBlock;
    onFinish: (finishData: { isNatural?: boolean; time?: number, raceId?: string }) => void;
    onHeaderVisibilityChange: (isVisible: boolean) => void;
    onShowImage: (url: string) => void;
    activeWorkout: Workout | null;
    setCompletionInfo: React.Dispatch<React.SetStateAction<{ workout: Workout; isFinal: boolean; blockTag?: string; finishTime?: number; } | null>>;
    setIsRegisteringHyroxTime: React.Dispatch<React.SetStateAction<boolean>>;
    organizationId?: string;
    setIsBackButtonHidden: React.Dispatch<React.SetStateAction<boolean>>;
    followMeShowImage: boolean;
    organization: Organization | null;
    onBackToGroups: () => void;
}

// TimerScreen Component
const TimerScreen: React.FC<TimerScreenProps> = ({ 
    block, onFinish, onHeaderVisibilityChange, onShowImage,
    activeWorkout, setCompletionInfo, setIsRegisteringHyroxTime, organizationId,
    setIsBackButtonHidden, followMeShowImage, organization, onBackToGroups
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

  interface FinishData { time: number; placement: number | null; }
  const [finishedParticipants, setFinishedParticipants] = useState<Record<string, FinishData>>({});
  const [savingParticipant, setSavingParticipant] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [participantToUndo, setParticipantToUndo] = useState<string | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showBackToPrepConfirmation, setShowBackToPrepConfirmation] = useState(false);
  const [showFinishAnimation, setShowFinishAnimation] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  
  const isHyroxRace = useMemo(() => activeWorkout?.id.startsWith('hyrox-full-race') || activeWorkout?.id.startsWith('custom-race'), [activeWorkout]);
  const [startGroups, setStartGroups] = useState<StartGroup[]>([]);
  const startIntervalSeconds = useMemo(() => (activeWorkout?.startIntervalMinutes ?? 2) * 60, [activeWorkout]);
  const [stationsVisible, setStationsVisible] = useState(false);

  const nextGroupToStartIndex = useMemo(() => startGroups.findIndex(g => g.startTime === undefined), [startGroups]);
  const nextGroupToStart = useMemo(() => (nextGroupToStartIndex !== -1 ? startGroups[nextGroupToStartIndex] : null), [startGroups, nextGroupToStartIndex]);

  const groupForCountdownDisplay = useMemo(() => {
    if (!isHyroxRace) return null;
    if (status === TimerStatus.Preparing) {
        return startGroups.length > 0 ? startGroups[0] : null;
    }
    return nextGroupToStart;
  }, [isHyroxRace, status, startGroups, nextGroupToStart]);

  const timeForCountdownDisplay = useMemo(() => {
      if (!groupForCountdownDisplay) return 0;
      if (status === TimerStatus.Preparing) {
          return currentTime;
      }
      const groupIndex = startGroups.findIndex(g => g.id === groupForCountdownDisplay.id);
      if (groupIndex === -1) return 0;
      return (groupIndex * startIntervalSeconds) - totalTimeElapsed;
  }, [status, currentTime, groupForCountdownDisplay, startGroups, startIntervalSeconds, totalTimeElapsed]);

  const handleConfirmReset = () => {
    setShowResetConfirmation(false);
    
    // Reset Hyrox state
    setFinishedParticipants({});
    
    // Re-initialize start groups state.
    if (activeWorkout?.startGroups && activeWorkout.startGroups.length > 0) {
        // Reset ALL start times to undefined. The group starter useEffect will handle the rest.
        setStartGroups(activeWorkout.startGroups.map(g => ({ ...g, startTime: undefined })));
    } else if (activeWorkout) { // Fallback for workouts without defined groups
        setStartGroups([
            {
                id: `group-${Date.now()}`,
                name: 'Startgrupp 1',
                participants: (activeWorkout?.participants || []).join('\n'),
                startTime: undefined
            }
        ]);
    } else {
        setStartGroups([]);
    }
    
    // This will reset timer state and start the 'Preparing' countdown.
    start();
  };

  useEffect(() => {
    if (isHyroxRace) {
        if (activeWorkout?.startGroups && activeWorkout.startGroups.length > 0) {
            // ALWAYS derive state from props. This ensures that if the activeWorkout prop updates,
            // the startGroups state is correctly synchronized.
            setStartGroups(activeWorkout.startGroups.map((g, index) => ({ 
                ...g, 
                // Only set start time for the first group initially. The starter effect will handle the rest.
                startTime: index === 0 ? 0 : undefined 
            })));
        } else if (activeWorkout) { // Fallback for a hyrox workout without pre-defined groups
            setStartGroups([
                {
                    id: `group-${Date.now()}`,
                    name: 'Startgrupp 1',
                    participants: (activeWorkout.participants || []).join('\n'),
                    startTime: 0, 
                }
            ]);
        } else {
             // If there's no active workout, there should be no groups.
             setStartGroups([]);
        }
    } else {
        // Not a hyrox race, clear any previous groups.
        setStartGroups([]);
    }
  }, [isHyroxRace, activeWorkout]);

  // Effect to automatically start subsequent groups every 2 minutes for HYROX races.
  useEffect(() => {
      if (!isHyroxRace || (status !== TimerStatus.Running && status !== TimerStatus.Preparing)) return;

      const groupsToStart = startGroups.filter((group, index) => {
          const expectedStartTime = index * startIntervalSeconds; // 2 minutes per group
          return group.startTime === undefined && totalTimeElapsed >= expectedStartTime;
      });

      if (groupsToStart.length > 0) {
          setStartGroups(prevGroups => {
              const newGroups = [...prevGroups];
              groupsToStart.forEach(groupToStart => {
                  const index = newGroups.findIndex(g => g.id === groupToStart.id);
                  if (index !== -1) {
                      const expectedStartTime = index * startIntervalSeconds;
                      newGroups[index] = { ...newGroups[index], startTime: expectedStartTime };
                  }
              });
              return newGroups;
          });
      }
  }, [isHyroxRace, totalTimeElapsed, startGroups, status, startIntervalSeconds]);

  // Effect for countdown beeps
  React.useEffect(() => {
      // Don't beep during the initial 10s prepare time, useWorkoutTimer handles that.
      if (status === TimerStatus.Preparing) return;
      
      if (isHyroxRace && groupForCountdownDisplay && timeForCountdownDisplay > 0 && timeForCountdownDisplay <= 3) {
          playBeep(880, 150, 'triangle');
      }
  }, [isHyroxRace, timeForCountdownDisplay, groupForCountdownDisplay, status]);


  const handleUpdateGroup = (groupId: string, field: 'name' | 'participants', value: string) => {
      setStartGroups(prev => prev.map(g => g.id === groupId ? { ...g, [field]: value } : g));
  };

  const handleAddGroup = () => {
      setStartGroups(prev => [
          ...prev,
          { id: `group-${Date.now()}`, name: `Startgrupp ${prev.length + 1}`, participants: '' }
      ]);
  };

  const allParticipants = useMemo(() => 
    startGroups.flatMap(g => g.participants.split('\n').map(p => p.trim()).filter(Boolean)),
    [startGroups]
  );
  
    const handleRaceComplete = useCallback(async () => {
        if (!isHyroxRace || !activeWorkout || !organizationId) return;

        // Construct Race object
        const raceToSave: Omit<HyroxRace, 'id' | 'createdAt' | 'organizationId'> = {
            raceName: activeWorkout.title,
            exercises: activeWorkout.blocks[0].exercises.map(e => e.reps ? `${e.reps} ${e.name}` : e.name),
            startGroups: startGroups.map(sg => ({
                id: sg.id,
                name: sg.name,
                participants: sg.participants.split('\n').map(p => p.trim()).filter(Boolean)
            })),
            results: Object.entries(finishedParticipants).map(([name, data]) => {
                // FIX: Add type assertion for 'data' as Object.entries can return `unknown` for values.
                const typedData = data as FinishData;
                const group = startGroups.find(g => g.participants.split('\n').map(p => p.trim()).includes(name));
                return {
                    participant: name,
                    time: typedData.time,
                    groupId: group?.id || '',
                };
            })
        };

        try {
            const savedRace = await saveRace(raceToSave, organizationId);
            onFinish({ raceId: savedRace.id }); // Pass up the new ID
        } catch (error) {
            console.error("Failed to save race:", error);
            // Fallback to just going back if save fails
            onFinish({ isNatural: false });
        }
    }, [isHyroxRace, activeWorkout, organizationId, startGroups, finishedParticipants, onFinish]);

    const participantsForHook = useMemo(() => {
        if (!isHyroxRace) return [];
        return allParticipants.map(name => ({ isFinished: !!finishedParticipants[name] }));
    }, [isHyroxRace, allParticipants, finishedParticipants]);

    const onRaceFinish = useCallback(() => {
        const sortedFinishers = Object.entries(finishedParticipants).sort(
            (a: [string, FinishData], b: [string, FinishData]) => a[1].time - b[1].time
        );
        if (sortedFinishers.length > 0) {
            setWinnerName(sortedFinishers[0][0]);
        }
        playBeep(880, 500, 'sine');
        setShowFinishAnimation(true);
    }, [finishedParticipants]);

    useRaceLogic(
        participantsForHook,
        onRaceFinish
    );

  const startedParticipants = useMemo(() =>
    startGroups
        .filter(g => g.startTime !== undefined)
        .flatMap(g => g.participants.split('\n').map(p => p.trim()).filter(Boolean)),
    [startGroups]
  );

  const hasParticipants = allParticipants.length > 0;
  const hasStartedParticipants = startedParticipants.length > 0;
  
  const useHyroxStyle = isHyroxRace;
  
  const getExerciseImageUrl = (ex: Exercise | null, org: Organization | null): string | undefined => {
      if (!ex) return undefined;
      if (org?.exerciseOverrides && org.exerciseOverrides[ex.id]) {
          return org.exerciseOverrides[ex.id].imageUrl;
      }
      return ex.imageUrl;
  };

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
    if (!isHyroxRace) {
        start();
    }
  }, [start, isHyroxRace]);

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
    if (activeWorkout?.id.startsWith('hyrox-full-race') || activeWorkout?.id.startsWith('custom-race')) {
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

  const recalculatePlacements = (currentFinishers: Record<string, FinishData>): Record<string, FinishData> => {
    const sortedFinishers = Object.entries(currentFinishers)
        .filter((entry: [string, FinishData]) => entry[1].time !== undefined && entry[1].time !== null)
        .sort((a: [string, FinishData], b: [string, FinishData]) => a[1].time - b[1].time);

    const updatedWithPlacements = { ...currentFinishers };
    
    sortedFinishers.forEach(([name], index) => {
        updatedWithPlacements[name] = { ...updatedWithPlacements[name], placement: index + 1 };
    });

    return updatedWithPlacements;
  };

  const handleParticipantFinish = (name: string) => {
    if (savingParticipant) return;

    const hasAnyGroupStarted = startGroups.some(g => g.startTime !== undefined);
    if (!hasAnyGroupStarted) {
        alert("Starta en grupp innan du kan registrera en målgång.");
        return;
    }

    setSavingParticipant(name); // Used as a temporary lock

    // Find the participant's group to get their specific start time offset.
    const participantGroup = startGroups.find(g => 
        g.participants.split('\n').map(p => p.trim()).includes(name)
    );

    const groupStartOffset = participantGroup?.startTime ?? 0;
    
    // Calculate the adjusted finish time based on the group's start offset.
    const finishTime = totalTimeElapsed - groupStartOffset;
    
    setFinishedParticipants(prev => {
        const newFinishers = {
            ...prev,
            [name]: { time: finishTime, placement: null }
        };
        return recalculatePlacements(newFinishers);
    });

    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
    
    setTimeout(() => {
      setSavingParticipant(null);
    }, 300);
  };

  const handleUndoParticipantFinish = () => {
      if (!participantToUndo || (savingParticipant && savingParticipant !== participantToUndo)) return;

      setSavingParticipant(participantToUndo);

      setFinishedParticipants(prev => {
          const updatedFinishers = { ...prev };
          delete updatedFinishers[participantToUndo];
          return recalculatePlacements(updatedFinishers);
      });
      
      setSavingParticipant(null);
      setParticipantToUndo(null);
  };

  const timeToDisplay = (block.settings.mode === TimerMode.Stopwatch && status !== TimerStatus.Preparing) ? totalTimeElapsed : currentTime;
  const timerStyle = getTimerStyle(status, block.settings.mode);
  
  const getProgress = () => totalBlockDuration === 0 ? 0 : (totalTimeElapsed / totalBlockDuration) * 100;

  const { outerAnimationClass, innerAnimationClass } = useMemo(() => {
    // Pulse animation is now calculated independently of HYROX style.
    // The decision to apply it is made in the JSX, which is cleaner.
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
  }, [status, totalBlockDuration, totalTimeElapsed]);


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
          case TimerMode.Stopwatch: return block.title || 'Stoppur';
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
  const isLapBased = totalExercises > 1 && totalWorkIntervals > 0 && totalWorkIntervals % totalExercises === 0;
  const countdownText = timeForCountdownDisplay > 0 ? `Startar om ${formatTime(timeForCountdownDisplay)}` : 'Startar nu...';

  interface ParticipantFinishListProps {
    participants: string[];
    finishData: Record<string, FinishData>;
    onFinish: (name: string) => void;
    onUndo: (name: string) => void;
    isSaving: (name: string) => boolean;
  }
  const ParticipantFinishList: React.FC<ParticipantFinishListProps> = ({ participants, finishData, onFinish, onUndo, isSaving }) => {
      const sortedParticipants = useMemo(() => {
          const unfinished = participants.filter(p => !finishData[p]);
          const finished = participants
              .filter(p => finishData[p])
              .sort((a, b) => (finishData[a].placement || Infinity) - (finishData[b].placement || Infinity));
          return [...finished, ...unfinished];
      }, [participants, finishData]);
  
      return (
          <div className="flex flex-col p-4 flex-grow min-h-0">
              <h3 className="text-3xl font-bold text-white mb-4 flex-shrink-0">Resultat</h3>
              <div className="flex-grow overflow-y-auto space-y-2">
                  {sortedParticipants.map(name => {
                      const finishedInfo = finishData[name];
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
                              <span className={`font-semibold ${isFinished ? 'text-gray-400' : 'text-white'}`}>
                                {finishedInfo?.placement && <span className="font-bold mr-2">{finishedInfo.placement}.</span>}
                                <span className={isFinished ? 'line-through' : ''}>{name}</span>
                              </span>
                              {isFinished ? (
                                  <span className="font-mono text-lg font-bold text-green-400">{formatTime(finishedInfo.time)}</span>
                              ) : (
                                  <button
                                      onClick={(e) => { e.stopPropagation(); onFinish(name); }}
                                      disabled={isSaving(name)}
                                      className="text-white text-xs font-bold py-1 px-4 rounded-full transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-green-600 disabled:cursor-wait"
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
        className={`w-full h-full flex-grow flex transition-colors duration-500 relative ${useHyroxStyle ? 'bg-gradient-to-br from-purple-700 via-blue-600 to-cyan-500' : `dark:bg-black ${outerAnimationClass}`}`}
        onClick={handleScreenInteraction}
        style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
    >
        {isHyroxRace && status === TimerStatus.Idle && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <motion.button
                    onClick={start}
                    className="bg-primary hover:brightness-110 text-white font-black text-4xl py-6 px-12 rounded-2xl shadow-2xl tracking-wider uppercase"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                    Starta Loppet
                </motion.button>
            </div>
        )}
        {showFinishAnimation && <RaceFinishAnimation winnerName={winnerName} onDismiss={handleRaceComplete} />}
        {showConfetti && <Confetti />}
      <div 
        className={`flex-grow flex flex-col transition-opacity duration-500 ${showFinishAnimation ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
      >
        <div 
          className={`w-full flex flex-col items-center justify-center p-6 md:p-8 transition-all duration-500 ${isFreestanding ? 'flex-grow' : 'mt-4 max-w-5xl mx-auto flex-shrink-0 rounded-2xl min-h-[200px] md:min-h-[250px] lg:min-h-[300px]'} ${useHyroxStyle ? 'bg-black/20 shadow-xl' : `${timerStyle.bg} ${innerAnimationClass}`}`}
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
                    <p className="text-xl lg:text-2xl">
                        {totalWorkIntervals} omgångar &times; ({formatTime(block.settings.workTime)} / {formatTime(block.settings.restTime)})
                    </p>
                    <div className="text-2xl lg:text-3xl flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-1">
                      {isLapBased ? (
                        <>
                          <p>
                              Varv: {currentRound} / {totalRounds}
                          </p>
                          <p>
                              Övning: {currentExerciseIndex + 1} / {totalExercises}
                          </p>
                        </>
                      ) : (
                         <p>
                            Omgång: {Math.min(completedWorkIntervals + 1, totalWorkIntervals)} / {totalWorkIntervals}
                        </p>
                      )}
                    </div>
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
                 {isHyroxRace && (
                    <button onClick={onButtonPress(() => setShowBackToPrepConfirmation(true))} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
                        Tillbaka till startgrupper
                    </button>
                 )}
                <button onClick={onButtonPress(isHyroxRace ? () => setShowResetConfirmation(true) : reset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
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
                {isHyroxRace && (
                    <button onClick={onButtonPress(() => setShowBackToPrepConfirmation(true))} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
                        Tillbaka till startgrupper
                    </button>
                )}
                <button onClick={onButtonPress(isHyroxRace ? () => setShowResetConfirmation(true) : reset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
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

        {!isFreestanding && !useHyroxStyle && (
          <div className={`w-full bg-transparent flex-grow overflow-y-auto mt-6`}>
            <div className={`w-full max-w-5xl mx-auto p-4 transition-all duration-500 ${shouldShowHighlightCard ? 'opacity-20 blur-sm' : 'opacity-100'}`}>
              {block.followMe ? (
                <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
                  <div className="space-y-2 mt-4">
                    {block.exercises.map((ex) => {
                        const imageUrl = getExerciseImageUrl(ex, organization);
                        return (
                        <div key={ex.id} className="p-4 rounded-lg bg-gray-200 dark:bg-slate-900">
                          <div className="flex justify-between items-center">
                            <div className="flex-grow">
                                <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{formatExerciseName(ex)}</p>
                                {ex.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ex.description}</p>
                                )}
                            </div>
                            {!activeWorkout?.hideExerciseImages && imageUrl && (
                              <button onClick={() => onShowImage(imageUrl)} className="flex-shrink-0 ml-4 group" aria-label="Visa övningsbild">
                                <img src={imageUrl} alt={ex.name} className="w-16 h-16 object-cover rounded-md transition-transform group-hover:scale-105 shadow-sm"/>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    )}
                  </div>
                </div>
              ) : (
                <>
                {block.exercises?.map((ex, idx) => (
                  <div
                    key={ex.id || idx}
                    className="relative bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm pl-4 pr-4 py-4 mb-3 text-left border-l-4"
                    style={{
                      borderColor: timerStyle.pulseRgb ? `rgb(${timerStyle.pulseRgb})` : '#0aa5a1',
                    }}
                  >
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {[
                        ex.reps && `${ex.reps}`,
                        ex.name,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                
                    {ex.description && (
                      <p className="text-base text-gray-600 dark:text-gray-400 leading-snug mt-1">
                        {ex.description}
                      </p>
                    )}
                  </div>
                ))}
                </>
              )}
            </div>
          </div>
        )}

        {!isFreestanding && useHyroxStyle && (
            <div className="w-full flex-grow flex flex-col mt-2">
                {/* Next Group Display */}
                <div className="flex-grow flex items-center justify-center p-4">
                    {groupForCountdownDisplay ? (
                        <div key={groupForCountdownDisplay.id} className="text-center text-white animate-fade-in">
                            <p className="text-2xl lg:text-3xl font-semibold uppercase tracking-wider text-white/80">{groupForCountdownDisplay.name}</p>
                            <div className="my-4 text-4xl lg:text-5xl font-mono bg-black/30 rounded-lg px-4 py-2 inline-block">
                                {countdownText}
                            </div>
                            <div className="max-w-md mx-auto space-y-1">
                                {groupForCountdownDisplay.participants.split('\n').filter(p => p.trim()).map((p, i) => (
                                    <p key={i} className="text-2xl lg:text-3xl font-bold">{p.trim()}</p>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-white animate-fade-in">
                            <h3 className="text-4xl lg:text-5xl font-bold">Alla grupper har startat!</h3>
                            <p className="text-lg text-white/80 mt-2">Fokusera på loppet!</p>
                        </div>
                    )}
                </div>

                {/* Stations List (collapsible) */}
                <div className="w-full max-w-5xl mx-auto p-4 flex-shrink-0">
                    <div className="text-center mb-2">
                        <button onClick={() => setStationsVisible(v => !v)} className="bg-black/30 text-white/80 hover:text-white backdrop-blur-sm py-2 px-5 rounded-full text-sm font-semibold transition-colors">
                            {stationsVisible ? 'Dölj Stationer' : 'Visa Stationer'}
                        </button>
                    </div>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${stationsVisible ? 'max-h-[50vh]' : 'max-h-0'}`}>
                        <div className="bg-black/20 rounded-lg p-2 space-y-1 mt-2 overflow-y-auto">
                            {block.exercises.map((ex, index) => (
                                <div key={ex.id} className="p-3 border-b border-white/10 last:border-b-0 flex items-center gap-4">
                                    <span className="font-mono text-cyan-300 text-xl w-8 text-center">{String(index + 1).padStart(2, '0')}</span>
                                    <p className="text-lg font-semibold text-white">
                                        {ex.reps && <span className="font-bold mr-2">{ex.reps}</span>}
                                        {ex.name}
                                    </p>
                                </div>
                            ))}
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
                                <div className={`flex-1 text-left ${!activeWorkout?.hideExerciseImages && followMeShowImage && getExerciseImageUrl(highlightedExercise, organization) ? 'md:w-1/2' : 'w-full'}`}>
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
                                {!activeWorkout?.hideExerciseImages && followMeShowImage && getExerciseImageUrl(highlightedExercise, organization) && (
                                    <div className="w-full md:w-1/2 flex-shrink-0">
                                        <img 
                                            src={getExerciseImageUrl(highlightedExercise, organization)} 
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

      <AnimatePresence>
        {participantToUndo && (
            <UndoConfirmationModal
                participantName={participantToUndo}
                onConfirm={handleUndoParticipantFinish}
                onCancel={() => setParticipantToUndo(null)}
                isSaving={!!savingParticipant && savingParticipant === participantToUndo}
            />
        )}
        {showResetConfirmation && (
            <RaceResetConfirmationModal
                onConfirm={handleConfirmReset}
                onCancel={() => setShowResetConfirmation(false)}
            />
        )}
        {showBackToPrepConfirmation && (
            <RaceBackToPrepConfirmationModal
                onConfirm={() => {
                    reset();
                    onBackToGroups();
                    setShowBackToPrepConfirmation(false);
                }}
                onCancel={() => setShowBackToPrepConfirmation(false)}
            />
        )}
      </AnimatePresence>


      {isHyroxRace && (
        <div className={`w-80 lg:w-96 flex-shrink-0 bg-[#0b1b2b] border-l-2 border-[#0aa5a1] flex flex-col transition-opacity duration-500 ${showFinishAnimation ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            {hasStartedParticipants && (
              <ParticipantFinishList
                  participants={startedParticipants}
                  finishData={finishedParticipants}
                  onFinish={handleParticipantFinish}
                  onUndo={(name) => setParticipantToUndo(name)}
                  isSaving={(name) => savingParticipant === name}
              />
            )}
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
      // Anonymous user (a a studio screen) needs to be configured.
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
  const [racePrepState, setRacePrepState] = useState<{ groups: StartGroup[]; interval: number } | null>(null);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null);

  const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
  const [isEditingNewDraft, setIsEditingNewDraft] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [customPageToEdit, setCustomPageToEdit] = useState<CustomPage | null>(null);
  const [studioToEditConfig, setStudioToEditConfig] = useState<Studio | null>(null);
  
  const [completionInfo, setCompletionInfo] = useState<{ workout: Workout, isFinal: boolean, blockTag?: string, finishTime?: number } | null>(null);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);
  const [isRegisteringHyroxTime, setIsRegisteringHyroxTime] = useState(false);

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
  
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [isBackButtonHidden, setIsBackButtonHidden] = useState(false);
  const [followMeShowImage, setFollowMeShowImage] = useState(true);
  const inactivityTimerRef = useRef<number | null>(null);

    const pagesThatPreventScreensaver: Page[] = [
        Page.Timer,
        Page.RepsOnly,
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
            
            // Cleanup draft workouts that aren't favorited and are older than a day.
            const workoutsToDelete = workouts.filter(w => 
                !w.isPublished && 
                !w.isFavorite && 
                w.createdAt &&
                (now - w.createdAt > ONE_DAY)
            );
            
            if (workoutsToDelete.length > 0) {
                console.log(`Cleaning up ${workoutsToDelete.length} old, non-favorite draft workouts.`);
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
        if (startFirstBlock && savedWorkout.blocks.length > 0) {
            handleStartBlock(savedWorkout.blocks[0], savedWorkout);
        } else {
            setActiveWorkout(savedWorkout);
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
  
  const handleStartBlock = (block: WorkoutBlock, workoutContext?: Workout) => {
    // If a new workout context is passed (e.g., from Hyrox or a freestanding timer),
    // it's crucial that this new context is what the Timer screen uses.
    // By setting activeWorkout here, we rely on React's state batching to make the
    // updated `activeWorkout` available in the same render cycle as the navigation.
    // This resolves a potential race condition where the Timer screen might otherwise
    // render with a stale `activeWorkout`.
    if (workoutContext) {
      setActiveWorkout(workoutContext);
    }
    
    setActiveBlock(block);
    
    if (block.settings.mode === TimerMode.NoTimer) {
        navigateTo(Page.RepsOnly);
    } else {
        navigateTo(Page.Timer);
    }
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
    handleStartBlock(block, tempWorkout);
  };

  const handleSelectWorkout = (workout: Workout) => {
    setActiveWorkout(workout);
    if ((workout.id.startsWith('hyrox-full-race') || workout.id.startsWith('custom-race')) && workout.blocks.length > 0) {
      handleStartBlock(workout.blocks[0], workout);
    } else {
      navigateTo(Page.WorkoutDetail);
    }
  };

  const handleStartRace = (workout: Workout) => {
    if (workout.blocks.length > 0) {
      handleStartBlock(workout.blocks[0], workout);
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
  
  const handleTimerFinish = useCallback((finishData: { isNatural?: boolean; time?: number, raceId?: string } = {}) => {
    const { isNatural = false, time, raceId } = finishData;

    if (raceId) {
        setActiveRaceId(raceId);
        navigateReplace(Page.HyroxRaceDetail);
        return;
    }
    
    if (completionInfo) return; // Prevent re-triggering if modal is already open

    // HIGHEST PRIORITY: A manual click on "Avsluta Block" (`isNatural: false`) should always navigate back.
    // This now works for both regular blocks and HYROX simulations.
    if (!isNatural) {
      handleBack();
      return;
    }

    // If the timer finishes NATURALLY (`isNatural: true`):
    // For a HYROX race, the timer runs indefinitely as a stopwatch, so a natural finish shouldn't do anything.
    if (activeWorkout?.id.startsWith('hyrox-full-race') || activeWorkout?.id.startsWith('custom-race')) {
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
    const isFinalBlock = completionInfo?.isFinal;
    setCompletionInfo(null);
    
    if (isWarmup && isFinalBlock) {
      // For a warmup that is also the FINAL block, navigate back to the appropriate home screen.
      const homePage = (role === 'systemowner' || role === 'organizationadmin') && !isImpersonating 
          ? (role === 'systemowner' ? Page.SystemOwner : Page.SuperAdmin) 
          : Page.Home;
      setHistory([homePage]);
    } else {
      // Standard behavior for all other blocks, including non-final warmups.
      handleBack();
    }
  };

  const handleReturnToGroupPrep = () => {
    if (activeWorkout && (activeWorkout.id.startsWith('hyrox-full-race') || activeWorkout.id.startsWith('custom-race'))) {
        setRacePrepState({
            groups: activeWorkout.startGroups || [],
            interval: activeWorkout.startIntervalMinutes || 2,
        });
        handleBack();
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

  const handleSelectRace = (raceId: string) => {
    setActiveRaceId(raceId);
    navigateTo(Page.HyroxRaceDetail);
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
            onShowBoostModal={() => {}} 
            onCoachAccessRequest={handleCoachAccessRequest} 
            studioConfig={studioConfig} 
            organizationLogoUrlLight={selectedOrganization?.logoUrlLight}
            organizationLogoUrlDark={selectedOrganization?.logoUrlDark}
            theme={theme}
        />;
      case Page.WorkoutDetail:
        return activeWorkout && <WorkoutDetailScreen 
            workout={activeWorkout} 
            onStartBlock={(block) => handleStartBlock(block, activeWorkout)} 
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
            followMeShowImage={followMeShowImage}
            setFollowMeShowImage={setFollowMeShowImage}
            onUpdateWorkout={persistWorkoutStateAndDb}
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
            followMeShowImage={followMeShowImage}
            organization={selectedOrganization}
            onBackToGroups={handleReturnToGroupPrep}
        />;
      case Page.RepsOnly:
        return activeBlock && <RepsOnlyScreen block={activeBlock} onFinish={() => handleTimerFinish({ isNatural: false })} onShowImage={handleShowImage} organization={selectedOrganization} workout={activeWorkout} />;
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
            isStudioMode={isStudioMode}
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
                   onSelectWorkout={handleStartRace}
                   studioConfig={studioConfig}
                   racePrepState={racePrepState}
                   onPrepComplete={() => setRacePrepState(null)}
               />;
      case Page.HyroxRaceList:
        return <HyroxRaceListScreen onSelectRace={handleSelectRace} />;
      case Page.HyroxRaceDetail:
        return activeRaceId && <HyroxRaceDetailScreen raceId={activeRaceId} />;
      default:
        return <HomeScreen 
            navigateTo={navigateTo} 
            onSelectWorkout={handleSelectWorkout} 
            onSelectPasskategori={handleSelectPasskategori} 
            savedWorkouts={workouts} 
            onCreateNewWorkout={handleCreateNewWorkout} 
            onShowBoostModal={() => {}} 
            onCoachAccessRequest={handleCoachAccessRequest} 
            studioConfig={studioConfig} 
            organizationLogoUrlLight={selectedOrganization?.logoUrlLight}
            organizationLogoUrlDark={selectedOrganization?.logoUrlDark}
            theme={theme}
        />;
    }
  };

  const isFullScreenPage = page === Page.Timer || page === Page.RepsOnly || page === Page.DisplayWindow || page === Page.DisplayWindowSelection;
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
       {!isStudioMode && <SupportChat />}
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
      case Page.StudioSelection: return "Välj Studio";
      case Page.SuperAdmin: return "";
      case Page.SystemOwner: return "Systemägare";
      case Page.RepsOnly: return "Övningar";
      case Page.CustomPageEditor: return "";
      case Page.IdeaBoard: return "Idé-tavlan";
      case Page.Hyrox: return "HYROX Träning";
      case Page.HyroxRaceList: return "Tidigare Lopp";
      case Page.HyroxRaceDetail: return "Resultat";
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