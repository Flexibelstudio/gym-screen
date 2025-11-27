
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Note, Workout, StudioConfig, TimerMode, TimerStatus, WorkoutBlock, Exercise, TimerSettings } from '../types';
import { interpretHandwriting, parseWorkoutFromImage } from '../services/geminiService';
import { deleteImageByUrl } from '../services/firebaseService';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { ValueAdjuster, InformationCircleIcon, CloseIcon, ChevronUpIcon, ChevronDownIcon } from './icons';
import { Modal } from './ui/Modal';
import { WorkoutCompleteModal } from './WorkoutCompleteModal';

const BoilingCauldron: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`relative ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M15,85 C15,55 85,55 85,85 Q50,110 15,85 Z" fill="#262626" />
            <path d="M10,60 C10,50 90,50 90,60" stroke="#404040" strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M25,85 L20,95" stroke="#262626" strokeWidth="6" strokeLinecap="round" />
            <path d="M75,85 L80,95" stroke="#262626" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-4/5 h-1/4 overflow-hidden">
            {/* FIX: Cast style object to React.CSSProperties to allow for custom CSS properties. */}
            <div className="bubble" style={{'--i': 11, '--s': 2, left: '10%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 12, '--s': 2.5, left: '30%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 24, '--s': 1.5, left: '80%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 10, '--s': 3, left: '90%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 14, '--s': 2, left: '50%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 23, '--s': 1.5, left: '20%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 18, '--s': 2.5, left: '65%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 20, '--s': 3, left: '40%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 22, '--s': 1.5, left: '75%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 13, '--s': 2, left: '5%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 15, '--s': 2.5, left: '95%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 19, '--s': 1.5, left: '60%'} as React.CSSProperties}></div>
        </div>
        <style>{`
            .bubble {
                position: absolute;
                bottom: 0;
                width: calc(var(--s) * 4px);
                height: calc(var(--s) * 4px);
                background: #4ade80;
                border-radius: 50%;
                box-shadow: 0 0 2px #4ade80, 0 0 5px #4ade80, 0 0 8px #4ade80;
                animation: bubble-animate calc(15s / var(--i)) linear infinite;
            }
            @keyframes bubble-animate {
                0% { transform: translateY(0) scale(1); opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(-50px) scale(0); opacity: 0; }
            }
        `}</style>
    </div>
);

const AILoadingSpinner: React.FC = () => (
    <div className="relative w-6 h-6">
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
    </div>
);

// New modal component for the archive
interface NoteArchiveModalProps {
    notes: Note[];
    onClose: () => void;
    onDelete: (noteId: string) => void;
    onUpdate: (note: Note) => void;
    onLoad: (note: Note) => void;
}

const NoteArchiveModal: React.FC<NoteArchiveModalProps> = ({ notes, onClose, onDelete, onUpdate, onLoad }) => {
    const [interpretingId, setInterpretingId] = useState<string | null>(null);

    const handleCopy = (text: string) => {
        if (text) {
            navigator.clipboard.writeText(text);
        }
    };

    const handleInterpret = async (note: Note) => {
        setInterpretingId(note.id);
        try {
            const base64Image = note.imageUrl.split(',')[1];
            const text = await interpretHandwriting(base64Image);
            onUpdate({ ...note, text });
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade.');
        } finally {
            setInterpretingId(null);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Arkiverade Anteckningar" size="4xl">
            <div className="space-y-4">
                {notes.length === 0 ? (
                    <p className="text-gray-400 text-center mt-10">Arkivet är tomt.</p>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <img src={note.imageUrl} alt="Handskriven anteckning" className="w-full h-auto object-contain rounded-md bg-gray-900" />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-xs text-gray-500 mb-2">{new Date(note.timestamp).toLocaleString('sv-SE')}</p>
                                <pre className="flex-grow whitespace-pre-wrap font-sans bg-gray-900 p-3 rounded-md text-gray-200">{note.text || 'Otolkad anteckning...'}</pre>
                                <div className="flex gap-2 mt-3 flex-shrink-0 flex-wrap">
                                    <button onClick={() => onLoad(note)} className="bg-blue-600 hover:bg-blue-500 text-sm font-semibold py-2 px-3 rounded-md">Fortsätt rita</button>
                                    {note.text ? (
                                        <button onClick={() => handleCopy(note.text)} className="bg-gray-600 hover:bg-gray-500 text-sm font-semibold py-2 px-3 rounded-md">Kopiera text</button>
                                    ) : (
                                        <button onClick={() => handleInterpret(note)} disabled={interpretingId === note.id} className="bg-purple-600 hover:bg-purple-500 text-sm font-semibold py-2 px-3 rounded-md flex items-center gap-1">
                                            {interpretingId === note.id ? 'Tolkar...' : 'Tolka text'}
                                        </button>
                                    )}
                                    <button onClick={() => onDelete(note.id)} className="bg-red-600 hover:bg-red-500 text-sm font-semibold py-2 px-3 rounded-md">Ta bort</button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
};

interface IdeaBoardInfoModalProps {
    onClose: () => void;
}

const IdeaBoardInfoModal: React.FC<IdeaBoardInfoModalProps> = ({ onClose }) => (
    <Modal isOpen={true} onClose={onClose} title="Om Idé-tavlan" size="2xl">
        <div className="space-y-4 text-gray-900 dark:text-gray-100">
            <p>Idé-tavlan är din digitala whiteboard där du kan skapa, spara och utveckla idéer till pass, program och övningar.</p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">✏️ Rita och skriv fritt</h3>
            <p>Skissa upp passupplägg, anteckningar eller flöden direkt på ytan. Du kan rensa tavlan, ångra drag och byta mellan ljust och mörkt tema.</p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">💾 Spara & Arkivera</h3>
            <p>Spara en idé till ditt arkiv med “Spara & Arkivera”. Du kan sedan:</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Ladda upp gamla idéer för att fortsätta jobba på dem.</li>
                <li>Låta AI:n tolka din handstil till text.</li>
                <li>Kopiera eller ta bort anteckningar.</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">🤖 Den smarta AI-coachen</h3>
            <p>Klicka på “Skapa Pass” – AI:n analyserar dina anteckningar och skapar ett komplett träningspass. Du kan välja att öppna det i passbyggaren eller låta AI:n "renrita" det som en snygg cirkelstation direkt på tavlan.</p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">⏱️ Timer</h3>
            <p>Starta en Intervall-, AMRAP-, EMOM- eller Tabata-timer direkt från tavlan för att testa dina idéer i realtid.</p>
        </div>
    </Modal>
);

interface WorkoutActionChoiceModalProps {
    workout: Workout;
    onGoToBuilder: () => void;
    onDrawCircuit: () => void;
    onCancel: () => void;
}

const WorkoutActionChoiceModal: React.FC<WorkoutActionChoiceModalProps> = ({ workout, onGoToBuilder, onDrawCircuit, onCancel }) => (
    <Modal isOpen={true} onClose={onCancel} title="Välj åtgärd" size="md">
        <div className="space-y-6 text-center">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto text-4xl">
                💪
            </div>
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">"{workout.title}"</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Passet är laddat. Hur vill du fortsätta?
                </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
                <button 
                    onClick={onDrawCircuit} 
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all flex items-center justify-between group"
                >
                    <div className="text-left">
                        <span className="block text-lg">Rita upp som Cirkel</span>
                        <span className="text-sm text-white/80 font-normal">AI:n ritar en stationskarta på tavlan</span>
                    </div>
                    <span className="text-2xl group-hover:scale-110 transition-transform">✏️</span>
                </button>
                <button 
                    onClick={onGoToBuilder} 
                    className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-4 px-6 rounded-xl shadow-sm transition-all flex items-center justify-between group"
                >
                    <div className="text-left">
                        <span className="block text-lg">Öppna i Passbyggaren</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-normal">Redigera och kör med timer</span>
                    </div>
                    <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </button>
            </div>
            <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-sm font-medium">
                Stäng och stanna på tavlan
            </button>
        </div>
    </Modal>
);

interface BlockSelectionModalProps {
    workout: Workout;
    onSelect: (blockIndex: number) => void;
    onCancel: () => void;
}

const BlockSelectionModal: React.FC<BlockSelectionModalProps> = ({ workout, onSelect, onCancel }) => (
    <Modal isOpen={true} onClose={onCancel} title="Välj block att rita" size="md">
        <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300 text-center">
                Passet innehåller flera block. Vilket vill du rita upp på tavlan?
            </p>
            <div className="space-y-2">
                {workout.blocks.map((block, index) => (
                    <button
                        key={block.id || index}
                        onClick={() => onSelect(index)}
                        className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 p-4 rounded-lg text-left transition-colors flex justify-between items-center group"
                    >
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">{block.title || `Block ${index + 1}`}</h4>
                            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{block.tag}</span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {block.exercises.length} övningar
                        </div>
                    </button>
                ))}
            </div>
            <button onClick={onCancel} className="w-full mt-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-sm font-medium">
                Avbryt
            </button>
        </div>
    </Modal>
);

interface CircuitReorderModalProps {
    block: WorkoutBlock;
    onConfirm: (modifiedBlock: WorkoutBlock) => void;
    onCancel: () => void;
}

const CircuitReorderModal: React.FC<CircuitReorderModalProps> = ({ block, onConfirm, onCancel }) => {
    const [exercises, setExercises] = useState<Exercise[]>(block.exercises);

    const moveExercise = (index: number, direction: 'up' | 'down') => {
        setExercises(prev => {
            const newExercises = [...prev];
            if (direction === 'up' && index > 0) {
                [newExercises[index], newExercises[index - 1]] = [newExercises[index - 1], newExercises[index]];
            } else if (direction === 'down' && index < newExercises.length - 1) {
                [newExercises[index], newExercises[index + 1]] = [newExercises[index + 1], newExercises[index]];
            }
            return newExercises;
        });
    };

    const handleUpdateExercise = (index: number, field: 'name' | 'reps', value: string) => {
        setExercises(prev => {
            const newExercises = [...prev];
            newExercises[index] = { ...newExercises[index], [field]: value };
            return newExercises;
        });
    };

    const handleRemoveExercise = (index: number) => {
        setExercises(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddExercise = () => {
        const newExercise: Exercise = {
            id: `ex-circuit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: '',
            reps: '',
        };
        setExercises(prev => [...prev, newExercise]);
    };

    const handleConfirm = () => {
        // Filter out empty exercises before confirming
        const validExercises = exercises.filter(ex => ex.name.trim() !== '');
        onConfirm({ ...block, exercises: validExercises });
    };

    return (
        <Modal isOpen={true} onClose={onCancel} title="Redigera Cirkel" size="lg">
            <div className="flex flex-col h-full">
                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                    Ordna, lägg till eller ändra övningarna. Övning 1 hamnar "klockan 12" och resten följer medurs.
                </p>
                <div className="flex-grow overflow-y-auto space-y-2 max-h-[50vh] pr-2">
                    {exercises.map((ex, index) => (
                        <div key={ex.id} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex items-center gap-4 border border-gray-200 dark:border-gray-700">
                            <span className="font-bold text-gray-400 w-6 text-center flex-shrink-0">{index + 1}</span>
                            
                            <div className="flex flex-col gap-1 flex-shrink-0">
                                <button 
                                    onClick={() => moveExercise(index, 'up')} 
                                    disabled={index === 0}
                                    className="text-gray-500 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                    <ChevronUpIcon className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => moveExercise(index, 'down')} 
                                    disabled={index === exercises.length - 1}
                                    className="text-gray-500 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                    <ChevronDownIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-grow space-y-1">
                                <input 
                                    type="text" 
                                    value={ex.name} 
                                    onChange={(e) => handleUpdateExercise(index, 'name', e.target.value)}
                                    className="font-bold text-gray-900 dark:text-white bg-transparent w-full border-b border-transparent focus:border-primary focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
                                    placeholder="Övningsnamn"
                                />
                                <input 
                                    type="text" 
                                    value={ex.reps || ''} 
                                    onChange={(e) => handleUpdateExercise(index, 'reps', e.target.value)}
                                    className="text-sm text-gray-500 dark:text-gray-400 bg-transparent w-full border-b border-transparent focus:border-primary focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
                                    placeholder="Antal/Tid (valfritt)"
                                />
                            </div>

                            <button 
                                onClick={() => handleRemoveExercise(index)}
                                className="text-red-500 hover:text-red-700 p-2"
                                title="Ta bort"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
                
                <button 
                    onClick={handleAddExercise} 
                    className="w-full py-2 mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-semibold"
                >
                    + Lägg till station
                </button>

                <div className="mt-6 flex gap-4">
                    <button onClick={onCancel} className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-3 rounded-lg transition-colors">
                        Avbryt
                    </button>
                    <button onClick={handleConfirm} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors">
                        Rita upp cirkel
                    </button>
                </div>
            </div>
        </Modal>
    );
};


// Main NotesScreen component
interface NotesScreenProps {
    onWorkoutInterpreted: (workout: Workout) => void;
    studioConfig: StudioConfig;
    initialWorkoutToDraw?: Workout | null;
}

const ThemeToggleIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
         <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 12a9 9 0 110-18 9 9 0 010 18z" stroke="currentColor"/>
         <path d="M12 12a9 9 0 000 18V0a9 9 0 000 12z" fill="currentColor"/>
    </svg>
);

const NOTES_THEME_STORAGE_KEY = 'flexibel-notes-theme';

const getTimerStyle = (status: TimerStatus, mode: TimerMode): any => {
    switch (status) {
        case TimerStatus.Preparing: return { bg: 'bg-blue-500', pulseRgb: '59, 130, 246' };
        case TimerStatus.Running:
            switch (mode) {
                case TimerMode.Interval: return { bg: 'bg-orange-500', pulseRgb: '249, 115, 22' };
                case TimerMode.Tabata: return { bg: 'bg-red-500', pulseRgb: '239, 68, 68' };
                case TimerMode.AMRAP: return { bg: 'bg-pink-600', pulseRgb: '219, 39, 119' };
                case TimerMode.EMOM: return { bg: 'bg-purple-600', pulseRgb: '147, 51, 234' };
                case TimerMode.TimeCap: return { bg: 'bg-indigo-600', pulseRgb: '79, 70, 229' };
                case TimerMode.Stopwatch: return { bg: 'bg-green-600', pulseRgb: '22, 163, 74' };
                default: return { bg: 'bg-orange-500', pulseRgb: '249, 115, 22' };
            }
        case TimerStatus.Resting: return { bg: 'bg-teal-400', pulseRgb: '45, 212, 191' };
        case TimerStatus.Paused: return { bg: 'bg-gray-500', pulseRgb: '107, 114, 128' };
        case TimerStatus.Finished: return { bg: 'bg-teal-600', pulseRgb: '13, 148, 136' };
        default: return { bg: 'bg-gray-800', pulseRgb: '' };
    }
};

const getTimerHexColor = (status: TimerStatus, mode: TimerMode): string => {
    switch (status) {
        case TimerStatus.Preparing: return '#3b82f6'; // blue-500
        case TimerStatus.Running:
            switch (mode) {
                case TimerMode.Interval: return '#f97316'; // orange-500
                case TimerMode.Tabata: return '#ef4444'; // red-500
                case TimerMode.AMRAP: return '#db2777'; // pink-600
                case TimerMode.EMOM: return '#9333ea'; // purple-600
                case TimerMode.TimeCap: return '#4f46e5'; // indigo-600
                case TimerMode.Stopwatch: return '#16a34a'; // green-600
                default: return '#f97316';
            }
        case TimerStatus.Resting: return '#2dd4bf'; // teal-400
        case TimerStatus.Paused: return '#6b7280'; // gray-500
        case TimerStatus.Finished: return '#0d9488'; // teal-600
        default: return '#14b8a6'; // teal-500 (default primary)
    }
};

// --- Compact Timer ---
const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const CompactTimer: React.FC<{
    timer: ReturnType<typeof useWorkoutTimer>;
    block: WorkoutBlock;
    onClose: () => void;
    isClosing: boolean;
    onFinish: () => void;
}> = ({ timer, block, onClose, isClosing, onFinish }) => {
    const { status, currentTime, totalBlockDuration, totalTimeElapsed, completedWorkIntervals, totalWorkIntervals } = timer;
    const { settings } = block;

    const timerStyle = getTimerStyle(status, settings.mode);
    const hasFinishedRef = useRef(false);

    useEffect(() => {
        if (status === TimerStatus.Finished) {
            if (hasFinishedRef.current) return;

            // Trigger finish callback immediately
            onFinish();
            hasFinishedRef.current = true;

            // Close the timer component itself after a delay if needed, 
            // but normally the Modal will take over. 
            // We keep this for cleanup if modal isn't used for some reason.
            const timer = setTimeout(onClose, 2000);
            return () => clearTimeout(timer);
        } else {
            hasFinishedRef.current = false;
        }
    }, [status, onClose, onFinish]);
    
    const getProgress = () => totalBlockDuration === 0 ? 0 : (totalTimeElapsed / totalBlockDuration) * 100;
    
    const getTopText = () => {
        switch (status) {
            case TimerStatus.Preparing: return 'Gör dig redo';
            case TimerStatus.Running: return 'Arbete';
            case TimerStatus.Resting: return 'Vila';
            case TimerStatus.Paused: return 'Pausad';
            case TimerStatus.Finished: return 'Bra jobbat!';
            default: return 'Timer';
        }
    };

    // Determine what time to show
    const timeToDisplay = (status === TimerStatus.Preparing || settings.mode !== TimerMode.Stopwatch)
        ? currentTime
        : totalTimeElapsed;

    const pulseAnimationClass = useMemo(() => {
        // Only pulse when Running (Work) or Resting
        if (status !== TimerStatus.Running && status !== TimerStatus.Resting) return '';
        
        // Don't pulse for Stopwatch (counts up) or NoTimer
        if (settings.mode === TimerMode.Stopwatch || settings.mode === TimerMode.NoTimer) return '';

        if (currentTime <= 5) return 'animate-pulse-bg-intense';
        if (currentTime <= 10) return 'animate-pulse-bg-medium';
        if (currentTime <= 15) return 'animate-pulse-bg-light';
        return '';
    }, [status, currentTime, settings.mode]);

    return (
        <div
            className={`relative mx-auto w-full max-w-4xl rounded-2xl shadow-lg z-30 border border-white/10 transition-all duration-300 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'} ${timerStyle.bg}/90 backdrop-blur-md overflow-hidden ${pulseAnimationClass}`}
            style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
        >
            <div className="p-6 text-white text-center pb-6">
                <p className="text-2xl font-bold uppercase tracking-widest text-white/90 mb-2 drop-shadow-md">{getTopText()}</p>
                <p className="font-mono text-9xl font-black my-2 drop-shadow-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(timeToDisplay)}
                </p>
                <div className="">
                    <p className="text-xl text-white/90 font-medium">
                        {settings.rounds} omgångar × ({formatTime(settings.workTime)} / {formatTime(settings.restTime)})
                    </p>
                    <p className="text-lg font-bold mt-2 bg-black/20 inline-block px-4 py-1 rounded-full">
                        Omgång: {Math.min(completedWorkIntervals + 1, totalWorkIntervals)} / {totalWorkIntervals}
                    </p>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-3 bg-white/20">
                <div className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ width: `${getProgress()}%`, transition: 'width 0.5s linear' }}></div>
            </div>
        </div>
    );
};

// Word cloud animation component
const introWords = [
  // Existing ones, with added colors
  { text: "Idéer", className: "text-6xl text-yellow-300 font-logo" },
  { text: "Kreativitet", className: "text-4xl text-blue-400" },
  { text: "Skissa", className: "text-5xl text-green-400" },
  { text: "Träningspass", className: "text-3xl text-white/90 font-bold" },
  { text: "Struktur", className: "text-4xl text-purple-400" },
  { text: "Glädje", className: "text-5xl text-pink-400 font-logo" },
  { text: "Inspiration", className: "text-2xl text-white/80" },
  { text: "Planera", className: "text-3xl text-indigo-400" },
  { text: "Anteckna", className: "text-4xl text-white/80" },

  // New training-related words with colors
  { text: "Kettlebells", className: "text-4xl text-red-500" },
  { text: "EMOM", className: "text-4xl text-green-300 font-mono" },
  { text: "AMRAP", className: "text-3xl text-blue-300 font-mono" },
  { text: "Tabata", className: "text-5xl text-yellow-400 font-mono uppercase" },
  { text: "Time Cap", className: "text-3xl text-white/60 font-mono" },
  { text: "Stege", className: "text-4xl text-teal-400" },
  { text: "Pyramid", className: "text-4xl text-pink-300" },
  { text: "Flås", className: "text-6xl text-primary font-bold uppercase" },
  { text: "Puls", className: "text-5xl text-red-400" },
  { text: "Core", className: "text-4xl text-yellow-500 font-bold uppercase" },
  { text: "Flow", className: "text-6xl text-blue-500 font-logo" },
  { text: "Mobilitet", className: "text-3xl text-green-500" },
  { text: "Uthållighet", className: "text-4xl text-white/90" },
  { text: "Power", className: "text-5xl text-primary font-bold uppercase" },
  { text: "Laddning", className: "text-3xl text-indigo-300" },
  { text: "Kondition", className: "text-4xl text-white/90 font-bold" },
  { text: "Styrka", className: "text-5xl text-white/90 font-bold" },
  { text: "Lyfta", className: "text-6xl text-red-300" },
  { text: "Svettglädje", className: "text-4xl text-pink-500 font-logo" },
  { text: "WOD", className: "text-5xl text-yellow-200 font-mono uppercase" },
  
  // New idea-related words with colors
  { text: "Skapande", className: "text-4xl text-teal-300" },
  { text: "Vision", className: "text-5xl text-purple-400 font-logo" },
  { text: "Fantasi", className: "text-4xl text-blue-200" },
  { text: "Innovation", className: "text-3xl text-white/90" },
  { text: "Påhitt", className: "text-4xl text-green-200" },
  { text: "Formande", className: "text-3xl text-white/80" },
  { text: "Flöde", className: "text-6xl text-indigo-400 font-logo" },
  { text: "Brainstorm", className: "text-4xl text-white/90 font-bold" },
  { text: "Experiment", className: "text-3xl text-yellow-300" },
  { text: "Lekfullhet", className: "text-4xl text-pink-400 font-logo" },
  { text: "Kreativ puls", className: "text-3xl text-red-400" },
  { text: "Improvisation", className: "text-3xl text-white/80" },
  { text: "Nyskapande", className: "text-4xl text-blue-400" },
  { text: "Bygga", className: "text-5xl text-white/80 font-bold" },
  { text: "Förvandla", className: "text-4xl text-green-400" },
  { text: "Träningsflöde", className: "text-3xl text-teal-500" },
  { text: "Idéstyrka", className: "text-4xl text-primary font-bold" },
  { text: "Skaparsvett", className: "text-4xl text-pink-300 font-logo" },
  { text: "Energiworkout", className: "text-3xl text-yellow-500 font-bold" },

  // Equipment words with colors
  { text: "Hantlar", className: "text-4xl text-gray-400" },
  { text: "Skivstång", className: "text-4xl text-gray-300 font-bold" },
  { text: "Viktplattor", className: "text-3xl text-red-400" },
  { text: "TRX", className: "text-5xl text-yellow-500 font-mono" },
  { text: "Slamballs", className: "text-4xl text-orange-400" },
  { text: "Wall balls", className: "text-4xl text-red-500" },
  { text: "Roddmaskin", className: "text-3xl text-blue-400" },
  { text: "Airbike", className: "text-4xl text-white/90" },
  { text: "Skierg", className: "text-4xl text-blue-300" },
  { text: "Battlerope", className: "text-3xl text-green-400" },
  { text: "Stepbräda", className: "text-3xl text-purple-400" },
  { text: "Plyobox", className: "text-4xl text-indigo-400" },
  { text: "Chinupstång", className: "text-3xl text-gray-500" },
  { text: "Landmine", className: "text-4xl text-yellow-600" },
  { text: "Balansplatta", className: "text-3xl text-pink-400" },
  { text: "Hopprep", className: "text-4xl text-red-300" },
  { text: "Gummiband", className: "text-3xl text-yellow-400" },
  { text: "Miniband", className: "text-3xl text-green-300" },
  { text: "Träningsbänk", className: "text-3xl text-gray-400" },
  { text: "Löpband", className: "text-4xl text-blue-500" },
  { text: "Hyrox", className: "text-6xl text-red-500 font-bold uppercase" },
  { text: "CrossFit", className: "text-6xl text-blue-500 font-bold uppercase" },
];


const IntroAnimation = ({ onSkip }: { onSkip: () => void }) => {
    const randomizedWords = useMemo(() => {
        return introWords
            .sort(() => 0.5 - Math.random()) // Shuffle
            .slice(0, 12) // Take more words
            .map(word => ({
                ...word,
                style: {
                    top: `${10 + Math.random() * 80}%`,
                    left: `${10 + Math.random() * 80}%`,
                    transform: `rotate(${Math.random() * 40 - 20}deg)`,
                    animationDelay: `${Math.random() * 1.5}s`,
                },
            }));
    }, []);

    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center bg-gray-950/50 backdrop-blur-sm">
            <div className="relative w-full h-full flex-grow">
                {randomizedWords.map(({ text, className, style }) => (
                    <span
                        key={text}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 animate-word-cloud-fade-in opacity-0 ${className}`}
                        style={style}
                    >
                        {text}
                    </span>
                ))}
            </div>
            <button
                onClick={onSkip}
                className="flex-shrink-0 bg-black/30 text-white/80 hover:text-white backdrop-blur-sm py-2 px-5 rounded-full text-sm font-semibold transition-colors mt-4"
            >
                Hoppa över
            </button>
        </div>
    );
};

interface IdeaBoardTimerSetupModalProps {
    onStart: (block: WorkoutBlock) => void;
    onClose: () => void;
}

const IdeaBoardTimerSetupModal: React.FC<IdeaBoardTimerSetupModalProps> = ({ onStart, onClose }) => {
    const [mode, setMode] = useState<TimerMode>(TimerMode.Interval);
  
    // State for different timer modes
    const [rounds, setRounds] = useState(3);
    const [totalMinutes, setTotalMinutes] = useState(10);
    const [workMinutes, setWorkMinutes] = useState(0);
    const [workSeconds, setWorkSeconds] = useState(30);
    const [restMinutes, setRestMinutes] = useState(0);
    const [restSeconds, setRestSeconds] = useState(15);

    const isConfigurationValid = useCallback(() => {
        const totalWorkSeconds = workMinutes * 60 + workSeconds;
        switch(mode) {
          case TimerMode.Interval:
            return totalWorkSeconds > 0 && rounds > 0;
          case TimerMode.Tabata:
          case TimerMode.Stopwatch:
            return true;
          case TimerMode.AMRAP:
          case TimerMode.TimeCap:
            return totalMinutes > 0;
          case TimerMode.EMOM:
            return rounds > 0;
          default:
            return false;
        }
    }, [mode, workMinutes, workSeconds, rounds, totalMinutes]);

    // Reset settings when mode changes
    useEffect(() => {
        switch(mode) {
            case TimerMode.Interval: 
                setRounds(3); 
                setWorkMinutes(0); 
                setWorkSeconds(30); 
                setRestMinutes(0); 
                setRestSeconds(15); 
                break;
            case TimerMode.AMRAP: 
            case TimerMode.TimeCap: 
                setTotalMinutes(10);
                break;
            case TimerMode.EMOM: 
                setRounds(10);
                break;
            default: break;
        }
    }, [mode]);

    const handleStartTimer = () => {
        let settings: Partial<TimerSettings> & { mode: TimerMode, prepareTime: number } = { mode, prepareTime: 10 };
        let title: string = mode;
        let exercises: Exercise[] = [{ id: 'ex-dummy', name: mode }];

        switch (mode) {
            case TimerMode.Interval:
                settings = { ...settings, workTime: workMinutes * 60 + workSeconds, restTime: restMinutes * 60 + restSeconds, rounds: rounds, reps: rounds };
                title = mode;
                exercises = [{ id: 'ex-interval-work', name: 'Arbete' }];
                break;
            case TimerMode.Tabata:
                settings = { ...settings, workTime: 20, restTime: 10, rounds: 8, reps: 8 };
                title = mode;
                exercises = [{ id: 'ex-tabata-work', name: 'Arbete' }];
                break;
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                settings = { ...settings, workTime: totalMinutes * 60, restTime: 0, rounds: 1 };
                title = `${mode} ${totalMinutes} min`;
                break;
            case TimerMode.EMOM:
                settings = { ...settings, workTime: 60, restTime: 0, rounds: rounds };
                title = `EMOM ${rounds} min`;
                exercises = [{ id: 'ex-emom-work', name: 'Ny minut' }];
                break;
            case TimerMode.Stopwatch:
                settings = { ...settings, workTime: 3600, restTime: 0, rounds: 1 }; 
                title = `Stoppur`;
                exercises = [{ id: 'ex-dummy', name: 'Tid' }];
                break;
        }
        const blockToStart: WorkoutBlock = { 
            id: `freestanding-${Date.now()}`, 
            title, 
            tag: "Fristående", 
            setupDescription: `Användardefinierad timer: ${mode}`, 
            settings: settings as TimerSettings, 
            exercises,
            followMe: true,
        };
        onStart(blockToStart);
    };

    const renderSettings = () => {
        const animationClass = 'animate-fade-in';
        switch (mode) {
            case TimerMode.Interval:
                return (
                    <div className={`flex flex-col items-center gap-y-6 w-full ${animationClass}`}>
                        <ValueAdjuster label="ANTAL OMGÅNGAR" value={rounds} onchange={setRounds} />
                        <div className="flex flex-col items-center w-full">
                            <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Arbetstid</span>
                            <div className="flex items-end justify-center gap-2 sm:gap-4">
                                <ValueAdjuster label="MIN" value={workMinutes} onchange={setWorkMinutes} />
                                <ValueAdjuster label="SEK" value={workSeconds} onchange={setWorkSeconds} max={59} step={5} wrapAround={true} />
                            </div>
                        </div>
                        <div className="flex flex-col items-center w-full">
                            <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Vilotid</span>
                            <div className="flex items-end justify-center gap-2 sm:gap-4">
                                <ValueAdjuster label="MIN" value={restMinutes} onchange={setRestMinutes} />
                                <ValueAdjuster label="SEK" value={restSeconds} onchange={setRestSeconds} max={59} step={5} wrapAround={true} />
                            </div>
                        </div>
                    </div>
                );
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                 return <div className={animationClass}><ValueAdjuster label="TOTAL TID (MINUTER)" value={totalMinutes} onchange={setTotalMinutes} /></div>;
            case TimerMode.EMOM:
                 return <div className={animationClass}><ValueAdjuster label="TOTAL TID (MINUTER)" value={rounds} onchange={setRounds} /></div>;
            case TimerMode.Tabata:
                return (
                    <div className={`text-center text-gray-300 p-4 rounded-lg ${animationClass}`}>
                        <h4 className="font-bold text-white text-lg">Standard Tabata</h4>
                        <p className="mt-2">8 omgångar</p>
                        <p>20 sekunder arbete</p>
                        <p>10 sekunder vila</p>
                        <p className="text-sm text-gray-500 mt-4">(Dessa värden är fasta för Tabata)</p>
                    </div>
                );
            case TimerMode.Stopwatch:
                return (
                     <div className={`text-center text-gray-300 p-4 rounded-lg ${animationClass}`}>
                        <h4 className="font-bold text-white text-lg">Stoppur</h4>
                        <p className="mt-2">Timern kommer att räkna upp från 00:00 när du trycker start.</p>
                    </div>
                );
            default: return null;
        }
    };

    const footerContent = (
        <div className="flex gap-4">
             <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">
                Avbryt
            </button>
            <button onClick={handleStartTimer} disabled={!isConfigurationValid()} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed">
                Starta Timer
            </button>
        </div>
    );

    return (
        <Modal isOpen={true} onClose={onClose} title="Ställ in Timer" size="xl" footer={footerContent}>
             <div className="space-y-6">
                <section className="w-full">
                    <h3 className="text-lg font-bold text-gray-300 mb-3 text-center">1. Välj Timertyp</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.values(TimerMode).filter(m => m !== TimerMode.NoTimer).map(m => (
                            <button key={m} onClick={() => setMode(m)} className={`px-4 py-3 text-base font-semibold rounded-lg transition-colors ${ mode === m ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600' }`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </section>
                <section className="w-full">
                    <h3 className="text-lg font-bold text-gray-300 mb-3 text-center">2. Anpassa {mode}</h3>
                     <div className="bg-black/30 rounded-lg p-6 min-h-[200px] flex flex-col justify-center items-center">
                        {renderSettings()}
                    </div>
                     {mode !== TimerMode.Stopwatch && (
                        <p className="text-center text-xs text-gray-500 mt-2">Alla timers inkluderar 10s 'Gör dig redo'-tid.</p>
                    )}
                </section>
            </div>
        </Modal>
    );
};

// Helper to wrap text
function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// Helper to clean name
const cleanExerciseName = (name: string) => {
    return name.split('(')[0].trim();
};

export const NotesScreen: React.FC<NotesScreenProps> = ({ onWorkoutInterpreted, studioConfig, initialWorkoutToDraw }) => {
    const [savedNotes, setSavedNotes] = useState<Note[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isInterpretingWorkout, setIsInterpretingWorkout] = useState(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [history, setHistory] = useState<ImageData[]>([]);
    const [isArchiveVisible, setIsArchiveVisible] = useState(false);
    const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
    const [canvasTheme, setCanvasTheme] = useState<'dark' | 'light'>(() => {
        const savedTheme = localStorage.getItem(NOTES_THEME_STORAGE_KEY) as 'dark' | 'light' | null;
        return savedTheme || 'dark';
    });
    
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [animationState, setAnimationState] = useState<'intro' | 'exiting' | 'finished'>(initialWorkoutToDraw ? 'finished' : 'intro');
    
    const [interpretedWorkout, setInterpretedWorkout] = useState<Workout | null>(null);
    const [showBlockSelector, setShowBlockSelector] = useState(false);
    const [blockForCircuit, setBlockForCircuit] = useState<WorkoutBlock | null>(null);
    const [lastDrawnBlock, setLastDrawnBlock] = useState<WorkoutBlock | null>(null);

    const isDrawing = useRef(false);
    const points = useRef<{x: number, y: number}[]>([]);
    
    const [timerBlock, setTimerBlock] = useState<WorkoutBlock | null>(null);
    const timer = useWorkoutTimer(timerBlock);
    const [isTimerSetupVisible, setIsTimerSetupVisible] = useState(false);
    const [isTimerClosing, setIsTimerClosing] = useState(false);
    const [completionInfo, setCompletionInfo] = useState<{ workout: Workout, isFinal: boolean, blockTag?: string, finishTime?: number } | null>(null);

    const [controlsVisible, setControlsVisible] = useState(true);
    const hideTimeoutRef = useRef<number | null>(null);

    const isTimerActive = timer.status === TimerStatus.Running || timer.status === TimerStatus.Resting || timer.status === TimerStatus.Preparing;

    const handleInteraction = useCallback(() => {
        setControlsVisible(true);
        if (isTimerActive) {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = window.setTimeout(() => {
                setControlsVisible(false);
            }, 3000);
        }
    }, [isTimerActive]);

    useEffect(() => {
        if (isTimerActive) {
            handleInteraction();
        } else {
            setControlsVisible(true);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        }
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [isTimerActive, handleInteraction]);

    useEffect(() => {
        if (initialWorkoutToDraw) {
            setInterpretedWorkout(initialWorkoutToDraw);
        }
    }, [initialWorkoutToDraw]);

    useEffect(() => {
        try {
            const storedNotes = localStorage.getItem('flexibel-saved-notes');
            if (storedNotes) {
                setSavedNotes(JSON.parse(storedNotes));
            }
        } catch (e) { console.error("Failed to load notes", e); }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('flexibel-saved-notes', JSON.stringify(savedNotes));
        } catch (e) { console.error("Failed to save notes", e); }
    }, [savedNotes]);

    const handleSaveNoteAction = (note: Note) => setSavedNotes(prev => [note, ...prev]);
    const handleDeleteNoteAction = (noteId: string) => setSavedNotes(prev => prev.filter(note => note.id !== noteId));
    const handleUpdateNoteAction = (noteToUpdate: Note) => setSavedNotes(prev => prev.map(note => note.id === noteToUpdate.id ? noteToUpdate : note));

    const handleStartTimerSetup = useCallback((block: WorkoutBlock) => {
        setTimerBlock(block);
        setIsTimerSetupVisible(false);
    }, []);

    const handleCloseTimer = useCallback(() => {
        setIsTimerClosing(true);
        setTimeout(() => {
            timer.reset();
            setTimerBlock(null);
            setIsTimerClosing(false);
        }, 300);
    }, [timer]);

    const handleTimerFinish = useCallback(() => {
        if (timerBlock) {
            // Create a dummy workout to pass context to the modal
            const dummyWorkout: Workout = {
                id: `notes-workout-${Date.now()}`,
                title: timerBlock.title,
                blocks: [timerBlock],
                coachTips: '',
                category: 'Idé-tavlan',
                isPublished: false,
            };
            setCompletionInfo({ 
                workout: dummyWorkout, 
                isFinal: true, 
                blockTag: timerBlock.tag,
                finishTime: timer.totalTimeElapsed 
            });
        }
    }, [timerBlock, timer.totalTimeElapsed]);

    const handleCloseWorkoutCompleteModal = () => {
        setCompletionInfo(null);
    };

    const handleToggleTimer = useCallback(() => {
        if (timerBlock) {
            handleCloseTimer();
        } else {
            setIsTimerSetupVisible(true);
        }
    }, [timerBlock, handleCloseTimer]);

    useEffect(() => {
        if (timerBlock && timer.status === TimerStatus.Idle) {
            timer.start();
        }
    }, [timerBlock, timer.status, timer.start]);

    useEffect(() => {
        localStorage.setItem(NOTES_THEME_STORAGE_KEY, canvasTheme);
    }, [canvasTheme]);

    const skipAnimation = useCallback(() => setAnimationState('exiting'), []);

    useEffect(() => {
        if (animationState === 'intro') {
            const timer = setTimeout(skipAnimation, 5000);
            return () => clearTimeout(timer);
        }
        if (animationState === 'exiting') {
            const timer = setTimeout(() => setAnimationState('finished'), 500);
            return () => clearTimeout(timer);
        }
    }, [animationState, skipAnimation]);

    // --- CANVAS SETUP ---
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        
        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            const width = container.offsetWidth;
            const height = container.offsetHeight;

            if(width === 0 || height === 0) return;

            const newCanvasWidth = Math.round(width * dpr);
            const newCanvasHeight = Math.round(height * dpr);
            
            if (canvas.width !== newCanvasWidth || canvas.height !== newCanvasHeight) {
                canvas.width = newCanvasWidth;
                canvas.height = newCanvasHeight;
                
                // Redraw last block if canvas size changes
                if (lastDrawnBlock) {
                    // Use a timeout to ensure layout is stable and let the canvas re-init first
                    setTimeout(() => {
                         if (timerBlock) {
                             const color = getTimerHexColor(timer.status, timerBlock.settings.mode);
                             drawCircuitOnCanvas(lastDrawnBlock, color);
                         } else {
                             drawCircuitOnCanvas(lastDrawnBlock); 
                         }
                    }, 50);
                } else if (history.length > 0) {
                     // Restore freehand drawing
                     ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
                     ctx.fillRect(0, 0, canvas.width, canvas.height); 
                     ctx.putImageData(history[history.length - 1], 0, 0);
                } else {
                    // Clear
                    ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }
            
            ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
            ctx.strokeStyle = canvasTheme === 'dark' ? '#FFFFFF' : '#000000';
            ctx.lineWidth = 4 * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };
        
        setupCanvas();

        const resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(setupCanvas);
        });
        resizeObserver.observe(container);

        const getPointerPos = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
        };

        const startDrawing = (e: PointerEvent) => {
            if (animationState !== 'finished') return;
            e.preventDefault();
            isDrawing.current = true;
            points.current = [getPointerPos(e)];
        };

        const draw = (e: PointerEvent) => {
            if (!isDrawing.current || animationState !== 'finished') return;
            e.preventDefault();
            const pos = getPointerPos(e);
            points.current.push(pos);

            if (points.current.length < 3) return;

            const p1 = points.current[points.current.length - 3];
            const p2 = points.current[points.current.length - 2];
            const p3 = points.current[points.current.length - 1];

            const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
            
            ctx.beginPath();
            ctx.moveTo(mid1.x, mid1.y);
            ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
            ctx.stroke();
        };

        const stopDrawing = () => {
            if (!isDrawing.current || animationState !== 'finished') return;
            isDrawing.current = false;
            if (points.current.length < 1) { points.current = []; return; }

            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

            if (points.current.length === 1) {
                const p1 = points.current[0];
                ctx.fillStyle = ctx.strokeStyle;
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, ctx.lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (points.current.length === 2) {
                const p1 = points.current[0];
                const p2 = points.current[1];
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory(prev => [...prev, imageData]);
            points.current = [];
        };

        canvas.addEventListener('pointerdown', startDrawing);
        canvas.addEventListener('pointermove', draw);
        canvas.addEventListener('pointerup', stopDrawing);
        canvas.addEventListener('pointerleave', stopDrawing);

        return () => {
            resizeObserver.unobserve(container);
            canvas.removeEventListener('pointerdown', startDrawing);
            canvas.removeEventListener('pointermove', draw);
            canvas.removeEventListener('pointerup', stopDrawing);
            canvas.removeEventListener('pointerleave', stopDrawing);
        };
    }, [canvasTheme, animationState, lastDrawnBlock]); 

    const clearCanvas = () => { 
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
        setHistory([]);
        setActiveNoteId(null);
        setLastDrawnBlock(null);
    };
    
    const handleUndo = () => { 
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (newHistory.length > 0) {
            ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
        }
    };

    const handleSaveNote = () => {
        if (!canvasRef.current || history.length === 0) return;
        
        setSaveState('saving');
        setIsSavingNote(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const newImageUrl = dataUrl;

            if (activeNoteId) {
                const originalNote = savedNotes.find(n => n.id === activeNoteId);
                const updatedNote: Note = {
                    id: activeNoteId,
                    timestamp: Date.now(),
                    imageUrl: newImageUrl,
                    text: originalNote?.text || '', 
                };
                handleUpdateNoteAction(updatedNote);
            } else {
                const newNote: Note = {
                    id: `note-${Date.now()}`,
                    timestamp: Date.now(),
                    text: '',
                    imageUrl: newImageUrl,
                };
                handleSaveNoteAction(newNote);
            }

            clearCanvas();
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);

        } catch(e) {
            console.error("Failed to save note:", e);
            alert('Anteckningen kunde inte sparas.');
            setSaveState('idle');
        } finally {
            setIsSavingNote(false);
        }
    };
    
    const handleInterpretAsWorkout = async () => {
        if (!canvasRef.current || history.length === 0) return;
        setIsInterpretingWorkout(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const base64Image = dataUrl.split(',')[1];
            const workout = await parseWorkoutFromImage(base64Image);
            setInterpretedWorkout(workout);
        } catch(e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade vid tolkning av pass.');
        } finally {
            setIsInterpretingWorkout(false);
        }
    };

    const handleGoToBuilder = () => {
        if (interpretedWorkout) {
            onWorkoutInterpreted(interpretedWorkout);
            clearCanvas();
            setInterpretedWorkout(null);
        }
    };

    const drawCircuitOnCanvas = useCallback((block: WorkoutBlock, overrideColor?: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear and set background
        ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        setLastDrawnBlock(block);

        const exercises = block.exercises || [];
        if (exercises.length === 0) {
            setInterpretedWorkout(null);
            setShowBlockSelector(false);
            setBlockForCircuit(null);
            return;
        }

        const isTimerActive = !!timerBlock;
        const centerX = canvas.width / 2;
        
        const dpr = window.devicePixelRatio || 1;
        
        // Dynamic spacing based on Timer presence and screen density
        // Using CSS reference pixels * dpr ensures it looks right on all screens
        const timerHeightCSS = 300; // Approx height of the timer card
        const headerHeightCSS = 80; // Approx height of header/top area
        
        // When timer is active, we push the content down by the timer's height.
        // Otherwise, we push it down by the header height.
        const topMarginCSS = isTimerActive ? timerHeightCSS + 20 : headerHeightCSS + 40;
        const bottomMarginCSS = 100;
        const sidePaddingCSS = 40;

        const topMargin = topMarginCSS * dpr;
        const bottomMargin = bottomMarginCSS * dpr;
        const paddingX = sidePaddingCSS * dpr;
        
        const availableHeight = canvas.height - topMargin - bottomMargin;
        // Ensure we don't get negative radius or weird shapes if screen is very short
        const radiusY = Math.max(60 * dpr, availableHeight / 2);
        
        // The center is topMargin + radius
        const centerY = topMargin + radiusY;
        
        // Use distinct radii for oval shape
        const radiusX = Math.max(100 * dpr, (canvas.width / 2) - paddingX); 
        
        const textColor = canvasTheme === 'dark' ? '#FFFFFF' : '#000000';
        const accentColor = overrideColor || '#14b8a6'; 

        // --- Layer 1: Draw the continuous track (The Ellipse) ---
        ctx.beginPath();
        // Use ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle)
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.strokeStyle = canvasTheme === 'dark' ? '#374151' : '#e5e7eb'; // Gray
        ctx.lineWidth = 16 * dpr; 
        ctx.stroke();
        
        // --- Layer 2: Draw Title in Center ---
        ctx.fillStyle = textColor;
        ctx.font = `bold ${36 * dpr}px sans-serif`; 
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom"; 
        ctx.fillText(block.title || "Cirkelpass", centerX, centerY);
        
        ctx.font = `italic ${22 * dpr}px sans-serif`; 
        ctx.textBaseline = "top";
        ctx.fillText(`${exercises.length} stationer`, centerX, centerY + (10 * dpr));

        // --- Layer 3: Draw Stations & Text ---
        const count = exercises.length;
        const startAngle = -Math.PI / 2; // Start top

        exercises.forEach((ex, index) => {
            const angle = startAngle + (index * (2 * Math.PI) / count);
            
            // Position on the ellipse track
            const x = centerX + radiusX * Math.cos(angle);
            const y = centerY + radiusY * Math.sin(angle);

            // Draw Station Circle background (to hide the track line behind it)
            ctx.beginPath();
            ctx.arc(x, y, 34 * dpr, 0, 2 * Math.PI); 
            ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF'; 
            ctx.fill();

            // Draw Station Circle border/fill
            ctx.beginPath();
            ctx.arc(x, y, 30 * dpr, 0, 2 * Math.PI); 
            ctx.fillStyle = accentColor;
            ctx.fill();
            
            // Draw Number
            ctx.fillStyle = '#FFFFFF'; 
            ctx.font = `bold ${24 * dpr}px sans-serif`; 
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(index + 1), x, y);

            // Text positioning logic (pushing text outwards from the oval)
            // Determine if we are in the top or bottom half
            const isTopHalf = Math.sin(angle) < 0;
            const textOffset = 45 * dpr; // Distance from the dot center
            
            const textX = x; // Centered horizontally relative to the dot
            let textY = isTopHalf ? y - textOffset : y + textOffset;
            
            ctx.fillStyle = textColor;
            ctx.font = `bold ${20 * dpr}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = isTopHalf ? "bottom" : "top";

            // Max width for text wrapping
            const maxWidth = 300 * dpr; // Wider text area allowed
            const exerciseName = cleanExerciseName(ex.name);
            const nameLines = wrapText(ctx, exerciseName, maxWidth);
            const lineHeight = 26 * dpr; 

            // Draw Name
            if (isTopHalf) {
                // Draw upwards from textY
                // Reverse loop so the last line is closest to the dot
                [...nameLines].reverse().forEach((line, lineIndex) => {
                    ctx.fillText(line, textX, textY - (lineIndex * lineHeight));
                });
                
                // Draw Reps (above name)
                if (ex.reps) {
                     ctx.font = `${16 * dpr}px sans-serif`;
                     ctx.fillStyle = canvasTheme === 'dark' ? '#9ca3af' : '#6b7280';
                     const repsY = textY - (nameLines.length * lineHeight) - (5 * dpr);
                     ctx.fillText(ex.reps, textX, repsY);
                }
            } else {
                // Draw downwards from textY
                nameLines.forEach((line, lineIndex) => {
                    ctx.fillText(line, textX, textY + (lineIndex * lineHeight));
                });

                // Draw Reps (below name)
                if (ex.reps) {
                     ctx.font = `${16 * dpr}px sans-serif`;
                     ctx.fillStyle = canvasTheme === 'dark' ? '#9ca3af' : '#6b7280';
                     const repsY = textY + (nameLines.length * lineHeight) + (5 * dpr);
                     ctx.fillText(ex.reps, textX, repsY);
                }
            }
        });

        // Save to history
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([imageData]);
        
        setInterpretedWorkout(null);
        setShowBlockSelector(false);
        setBlockForCircuit(null);
    }, [canvasTheme, timerBlock]);

    // Sync timer color with circuit diagram
    useEffect(() => {
        if (lastDrawnBlock) {
             if (timerBlock) {
                 const color = getTimerHexColor(timer.status, timerBlock.settings.mode);
                 drawCircuitOnCanvas(lastDrawnBlock, color);
             } else {
                 drawCircuitOnCanvas(lastDrawnBlock); 
             }
        }
    }, [timer.status, timerBlock, lastDrawnBlock, drawCircuitOnCanvas]);


    const handleLoadNote = (note: Note) => { 
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        setIsArchiveVisible(false); 
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory([imageData]);
            setActiveNoteId(note.id);
        };
        img.src = note.imageUrl;
    };

    const getSaveButtonContent = () => {
        if (saveState === 'saving') return <><AILoadingSpinner /><span>Sparar...</span></>;
        if (saveState === 'saved') return <span>✔️ Sparad!</span>;
        return <span>💾 Spara & Arkivera</span>;
    };
    const getInterpretButtonContent = () => { 
        if (isInterpretingWorkout) {
            return <><AILoadingSpinner /><span>Tolkar...</span></>;
        }
        return <span>✍️ Skapa Pass</span>; 
    };

    const isInteractionDisabled = animationState !== 'finished' || isSavingNote || isInterpretingWorkout;

    const handleDrawCircuitRequest = () => {
        if (!interpretedWorkout) return;
        if (interpretedWorkout.blocks.length > 1) {
            setShowBlockSelector(true);
        } else {
            setBlockForCircuit(interpretedWorkout.blocks[0]);
        }
    };

    const handleSelectBlock = (index: number) => {
        if (interpretedWorkout) {
            setBlockForCircuit(interpretedWorkout.blocks[index]);
            setShowBlockSelector(false);
        }
    };

    const handleCircuitReorderConfirm = (modifiedBlock: WorkoutBlock) => {
        drawCircuitOnCanvas(modifiedBlock);
    };
    
    const handleAdjustCircuit = () => {
        if (lastDrawnBlock) {
            setBlockForCircuit(lastDrawnBlock);
        }
    };

    return (
        <div 
            className="w-full h-full flex-grow flex flex-col items-stretch justify-center p-4 gap-4 animate-fade-in relative overflow-hidden"
            onClick={handleInteraction}
            onMouseMove={handleInteraction}
            onTouchStart={handleInteraction}
        >
            <div className={`absolute top-6 right-6 z-20 flex items-center gap-2 transition-opacity duration-500 ${!controlsVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                 <button 
                    onClick={() => setCanvasTheme(prev => prev === 'dark' ? 'light' : 'dark')} 
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold p-2 rounded-lg transition-colors disabled:opacity-50"
                    title="Växla skärmfärg"
                    disabled={animationState !== 'finished'}
                >
                    <ThemeToggleIcon className="w-6 h-6" />
                </button>
                <button onClick={() => setIsArchiveVisible(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50" disabled={animationState !== 'finished'}>
                    Visa Arkiv ({savedNotes.length})
                </button>
                <button 
                    onClick={() => setIsInfoModalVisible(true)} 
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold p-2 rounded-lg transition-colors disabled:opacity-50"
                    title="Om Idé-tavlan"
                    disabled={animationState !== 'finished'}
                >
                    <InformationCircleIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Timer placed OVER canvas (Overlay) */}
            {timerBlock && (
                <div className="absolute top-4 left-0 right-0 z-30 flex justify-center transition-all duration-300 pointer-events-none px-4">
                     {/* Enable pointer events on the timer itself if needed, though CompactTimer is mostly display */}
                     <div className="w-full max-w-4xl pointer-events-auto">
                        <CompactTimer 
                            timer={timer} 
                            block={timerBlock} 
                            onClose={handleCloseTimer}
                            isClosing={isTimerClosing}
                            onFinish={handleTimerFinish}
                        />
                     </div>
                </div>
            )}

            <div className="flex-grow flex flex-col bg-gray-800 rounded-lg p-4 gap-4 border border-gray-700 relative overflow-hidden">
                <div ref={containerRef} className={`w-full flex-grow rounded-lg overflow-hidden relative transition-colors`} style={{ touchAction: 'none' }}>
                    {animationState !== 'finished' && (
                        <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${animationState === 'exiting' ? 'opacity-0' : 'opacity-100'}`}
                             style={{ pointerEvents: animationState === 'exiting' ? 'none' : 'auto' }}
                        >
                           <IntroAnimation onSkip={skipAnimation} />
                        </div>
                    )}
                    <canvas ref={canvasRef} className="w-full h-full" />
                </div>
                
                <div className={`flex-shrink-0 flex flex-wrap justify-center gap-4 transition-all duration-500 transform ${!controlsVisible ? 'translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                    <button onClick={handleUndo} disabled={history.length === 0 || isInteractionDisabled} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50">Ångra</button>
                    <button onClick={clearCanvas} disabled={isInteractionDisabled} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50">Rensa</button>
                    <button onClick={handleSaveNote} disabled={isInteractionDisabled || history.length === 0 || saveState !== 'idle'} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {getSaveButtonContent()}
                    </button>
                    <button onClick={handleInterpretAsWorkout} disabled={isInteractionDisabled || history.length === 0} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {getInterpretButtonContent()}
                    </button>
                    <button onClick={handleToggleTimer} disabled={isInteractionDisabled} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {timerBlock ? 'Stoppa Timer' : 'Timer'}
                    </button>
                    {lastDrawnBlock && !isInteractionDisabled && (
                        <button onClick={handleAdjustCircuit} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                            ✏️ Justera
                        </button>
                    )}
                </div>
            </div>

            {isInterpretingWorkout && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center animate-fade-in">
                    <BoilingCauldron className="w-48 h-48" />
                    <p className="text-5xl text-white mt-4 font-logo">Kokar ihop ditt pass</p>
                </div>
            )}

            {interpretedWorkout && !showBlockSelector && !blockForCircuit && (
                <WorkoutActionChoiceModal 
                    workout={interpretedWorkout}
                    onGoToBuilder={handleGoToBuilder}
                    onDrawCircuit={handleDrawCircuitRequest}
                    onCancel={() => setInterpretedWorkout(null)}
                />
            )}

            {interpretedWorkout && showBlockSelector && (
                <BlockSelectionModal
                    workout={interpretedWorkout}
                    onSelect={handleSelectBlock}
                    onCancel={() => setShowBlockSelector(false)}
                />
            )}

            {blockForCircuit && (
                <CircuitReorderModal 
                    block={blockForCircuit}
                    onConfirm={handleCircuitReorderConfirm}
                    onCancel={() => setBlockForCircuit(null)}
                />
            )}

            {isArchiveVisible && (
                <NoteArchiveModal
                    notes={savedNotes}
                    onClose={() => setIsArchiveVisible(false)}
                    onDelete={handleDeleteNoteAction}
                    onUpdate={handleUpdateNoteAction}
                    onLoad={handleLoadNote}
                />
            )}

            {isInfoModalVisible && (
                <IdeaBoardInfoModal onClose={() => setIsInfoModalVisible(false)} />
            )}

            {isTimerSetupVisible && (
                <IdeaBoardTimerSetupModal
                    onStart={handleStartTimerSetup}
                    onClose={() => setIsTimerSetupVisible(false)}
                />
            )}

            {completionInfo && (
                <WorkoutCompleteModal
                    isOpen={!!completionInfo}
                    onClose={handleCloseWorkoutCompleteModal}
                    workout={completionInfo.workout}
                    isFinalBlock={completionInfo.isFinal}
                    blockTag={completionInfo.blockTag}
                    finishTime={completionInfo.finishTime}
                    organizationId={studioConfig && "id" in studioConfig ? (studioConfig as any).id : undefined} 
                />
            )}
        </div>
    );
};
