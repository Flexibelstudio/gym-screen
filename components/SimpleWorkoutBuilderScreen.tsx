import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise } from '../types';
import { ToggleSwitch, PencilIcon, ChartBarIcon, SparklesIcon, ChevronUpIcon, ChevronDownIcon, CloseIcon } from './icons';
import { TimerSetupModal } from './TimerSetupModal';
import { getExerciseBank, uploadImage } from '../services/firebaseService';
import { interpretHandwriting, generateExerciseDescription } from '../services/geminiService';
import { useStudio } from '../context/StudioContext';
import { parseSettingsFromTitle } from '../hooks/useWorkoutTimer';
import { resizeImage } from '../utils/imageUtils';
import { EditableField } from './workout-builder/EditableField';
import { Modal } from './ui/Modal';

const parseExerciseLine = (line: string): { reps: string; name: string } => {
    const trimmedLine = line.trim();
    // Matches a number at the start of the string, followed by some text.
    const match = trimmedLine.match(/^(\d+)\s+(.*)/);

    if (match && match[2] && match[2].trim() !== '') {
        return {
            reps: match[1],      // The number part, e.g., "10"
            name: match[2].trim() // The rest of the string, e.g., "Situps"
        };
    }
    
    // If no number is found at the start, or no text follows the number,
    // treat the whole line as the name.
    return { reps: '', name: trimmedLine };
};


// --- Handwriting Modal ---
interface HandwritingInputModalProps {
    onClose: () => void;
    onComplete: (text: string) => void;
}

const HandwritingInputModal: React.FC<HandwritingInputModalProps> = ({ onClose, onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    
    // Use a ref to pass the latest history to the resize observer callback without re-triggering the effect.
    const historyRef = useRef(history);
    historyRef.current = history;
    
    // Refs to manage drawing state without causing re-renders
    const isDrawing = useRef(false);
    const points = useRef<{x: number, y: number}[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect(); 
            if(rect.width === 0 || rect.height === 0) return;

            // Set the actual pixel size of the canvas to match its display size
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            
            // Re-apply drawing styles as they are reset when canvas size changes
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3 * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };

        const resizeObserver = new ResizeObserver(() => {
            // Defer resize handling to the next animation frame to avoid resize loop errors.
            window.requestAnimationFrame(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                setupCanvas();
                // Restore the last state from history after resize, using the ref for the latest value.
                const currentHistory = historyRef.current;
                if (currentHistory.length > 0) {
                     const lastImageData = currentHistory[currentHistory.length - 1];
                     const tempCanvas = document.createElement('canvas');
                     const tempCtx = tempCanvas.getContext('2d');
                     if (tempCtx) {
                        tempCanvas.width = lastImageData.width;
                        tempCanvas.height = lastImageData.height;
                        tempCtx.putImageData(lastImageData, 0, 0);
                        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
                     }
                }
            });
        });
        resizeObserver.observe(canvas);

        const getPointerPos = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return { 
                x: (e.clientX - rect.left) * scaleX, 
                y: (e.clientY - rect.top) * scaleY 
            };
        };

        const startDrawing = (e: PointerEvent) => {
            e.preventDefault();
            isDrawing.current = true;
            const pos = getPointerPos(e);
            points.current = [pos];
        };

        const draw = (e: PointerEvent) => {
            if (!isDrawing.current) return;
            e.preventDefault();
            const pos = getPointerPos(e);
            points.current.push(pos);

            if (points.current.length < 3) return;

            // Draw a quadratic curve segment between midpoints
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
            if (!isDrawing.current) return;
            isDrawing.current = false;
            
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx || points.current.length < 1) {
                points.current = [];
                return;
            }

            // Handle dots and short lines that didn't trigger curve drawing
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
            resizeObserver.unobserve(canvas);
            canvas.removeEventListener('pointerdown', startDrawing);
            canvas.removeEventListener('pointermove', draw);
            canvas.removeEventListener('pointerup', stopDrawing);
            canvas.removeEventListener('pointerleave', stopDrawing);
        };
    }, []); // Empty dependency array is correct as we use a ref to access latest history.

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHistory([]);
    };
    
    const handleUndo = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (newHistory.length > 0) {
            ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
        }
    };

    const handleInterpret = async () => {
        if (!canvasRef.current) return;
        setIsLoading(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const base64Image = dataUrl.split(',')[1];
            const text = await interpretHandwriting(base64Image);
            onComplete(text);
        } catch(e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-2xl text-white shadow-2xl border border-gray-700 flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Skriv med fingret</h2>
                <div className="w-full aspect-[2/1] bg-gray-900 rounded-lg overflow-hidden" style={{ touchAction: 'none' }}>
                    <canvas ref={canvasRef} className="w-full h-full" />
                </div>
                {isLoading && (
                     <div className="absolute inset-0 bg-gray-800/70 flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold">Tolkar handstil...</p>
                    </div>
                )}
                <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-4">
                    <button onClick={handleUndo} disabled={history.length === 0} className="bg-gray-600 hover:bg-gray-500 font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Ångra</button>
                    <button onClick={clearCanvas} className="bg-gray-600 hover:bg-gray-500 font-bold py-3 rounded-lg">Rensa</button>
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 font-bold py-3 rounded-lg">Avbryt</button>
                    <button onClick={handleInterpret} className="bg-primary hover:brightness-95 font-bold py-3 rounded-lg">Tolka</button>
                </div>
            </div>
        </div>
    );
};


// --- Helper functions to create new items ---
const createNewWorkout = (): Workout => ({
  id: `workout-${Date.now()}`,
  title: '',
  coachTips: '',
  blocks: [createNewBlock(1)],
  category: 'Ej kategoriserad',
  isPublished: false,
  isMemberDraft: true,
  createdAt: Date.now(),
  organizationId: '',
});

const createNewBlock = (index: number): WorkoutBlock => ({
  id: `block-${Date.now()}`,
  title: `Block ${index}`,
  tag: 'Styrka',
  setupDescription: '',
  followMe: false,
  settings: {
    mode: TimerMode.NoTimer,
    workTime: 0,
    restTime: 0,
    rounds: 1,
    prepareTime: 10,
    direction: 'down'
  },
  exercises: [],
});

const createNewExercise = (): Exercise => ({
  id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: '',
  reps: '',
  description: '',
  imageUrl: '',
});

const ConfirmationModal: React.FC<{
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
}> = ({ onConfirm, onCancel, title, message }) => {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-white shadow-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">{title}</h2>
                <p className="text-gray-300 mb-6">{message}</p>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                    <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors">Ja, ta bort</button>
                </div>
            </div>
        </div>
    );
};

// --- Sub-components ---

const WorkoutInfoCard: React.FC<{ 
    workout: Workout, 
    onChange: (field: keyof Workout, value: any) => void,
    onOpenHandwriting: (field: 'title' | 'coachTips', multiLine: boolean) => void 
}> = ({ workout, onChange, onOpenHandwriting }) => {
    return (
        <div className="bg-purple-100 dark:bg-purple-900/80 p-6 rounded-lg space-y-4 shadow-lg border border-purple-200 dark:border-purple-800">
             <h2 className="text-2xl font-bold text-purple-900 dark:text-white mb-2">
                Passinformation
             </h2>
             
             <div>
                <label htmlFor="workout-title" className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">Passets Namn</label>
                <div className="relative">
                    <input
                        id="workout-title"
                        type="text"
                        value={workout.title}
                        onChange={e => onChange('title', e.target.value)}
                        placeholder="T.ex. 'Mitt grymma benpass'"
                        className="w-full bg-white dark:bg-purple-900 text-purple-800 dark:text-white p-3 rounded-md border border-purple-300 dark:border-purple-700 focus:ring-2 focus:ring-purple-500 focus:outline-none transition font-semibold"
                    />
                    <button onClick={() => onOpenHandwriting('title', false)} className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors p-1" title="Skriv för hand">
                        <PencilIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
             
             <div>
                <label htmlFor="workout-notes" className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">Anteckningar (valfritt)</label>
                <div className="relative">
                    <textarea
                        id="workout-notes"
                        value={workout.coachTips}
                        onChange={e => onChange('coachTips', e.target.value)}
                        placeholder="T.ex. fokusområden, utrustning som behövs..."
                        className="w-full bg-white dark:bg-purple-900 text-purple-800 dark:text-gray-300 p-3 rounded-md border border-purple-300 dark:border-purple-700 focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                        rows={2}
                    />
                     <button onClick={() => onOpenHandwriting('coachTips', true)} className="absolute top-3 right-3 text-gray-400 hover:text-primary transition-colors p-1" title="Skriv för hand">
                        <PencilIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}

interface ExerciseItemProps {
    exercise: Exercise;
    onUpdate: (id: string, updatedValues: Partial<Exercise>) => void;
    onRemove: (id: string) => void;
    onOpenHandwriting: () => void;
    exerciseBank: BankExercise[];
    organizationId: string;
    index: number;
    total: number;
    onMove: (direction: 'up' | 'down') => void;
}
const ExerciseItem: React.FC<ExerciseItemProps> = ({ exercise, onUpdate, onRemove, onOpenHandwriting, exerciseBank, organizationId, index, total, onMove }) => {
    const textClasses = "text-gray-900 dark:text-white";
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<BankExercise[]>([]);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    const handleGenerateDescription = async () => {
        if (!exercise.name.trim()) {
            alert("Skriv ett namn på övningen först för att kunna generera en beskrivning.");
            return;
        }
        setIsGeneratingDesc(true);
        try {
            const description = await generateExerciseDescription(exercise.name);
            onUpdate(exercise.id, { description });
        } catch (error) {
            alert("Kunde inte generera en beskrivning. Försök igen.");
            console.error(error);
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    useEffect(() => {
        if (searchQuery.length > 1 && isSearchVisible) {
            const filtered = exerciseBank.filter(ex =>
                ex.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setSearchResults(filtered);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, exerciseBank, isSearchVisible]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchVisible(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setSearchQuery(newName);
        onUpdate(exercise.id, { name: newName });
    };

    const handleSelectExercise = (bankExercise: BankExercise) => {
        onUpdate(exercise.id, {
            name: bankExercise.name,
            description: bankExercise.description,
            imageUrl: bankExercise.imageUrl,
            // Keep reps, don't overwrite from bank
            reps: exercise.reps,
            isFromBank: true,
        });
        setIsSearchVisible(false);
        setSearchQuery('');
    };
    
    return (
        <div ref={searchContainerRef} className="group p-3 rounded-lg flex items-start gap-3 transition-all bg-gray-100 dark:bg-gray-700/50 relative">
            <div className="flex flex-col gap-1 items-center justify-center self-center mr-2">
                <button 
                    disabled={index === 0} 
                    onClick={() => onMove('up')} 
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Flytta upp"
                >
                    <ChevronUpIcon className="w-5 h-5" />
                </button>
                <button 
                    disabled={index === total - 1} 
                    onClick={() => onMove('down')} 
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Flytta ner"
                >
                    <ChevronDownIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-grow space-y-2">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={exercise.reps || ''}
                        onChange={e => onUpdate(exercise.id, { reps: e.target.value })}
                        placeholder="Antal"
                        className={`bg-white dark:bg-gray-600 rounded p-1 ${textClasses} w-24 font-bold text-center placeholder-gray-500 focus:ring-1 focus:ring-primary outline-none`}
                    />
                    <input
                        type="text"
                        value={exercise.name}
                        onChange={handleNameChange}
                        onFocus={() => {
                            setIsSearchVisible(true);
                            setSearchQuery(exercise.name);
                        }}
                        placeholder="Sök eller skriv övningsnamn"
                        className={`flex-grow bg-transparent focus:outline-none ${textClasses} font-semibold`}
                    />
                    
                    {/* LOGGNING TOGGLE */}
                    <button 
                        onClick={() => onUpdate(exercise.id, { loggingEnabled: !exercise.loggingEnabled })}
                        className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
                            exercise.loggingEnabled 
                            ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' 
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                        title={exercise.loggingEnabled ? "Loggning aktiverad" : "Aktivera loggning för medlemmar"}
                    >
                        <ChartBarIcon className="w-5 h-5" />
                    </button>

                    <button onClick={onOpenHandwriting} className="text-gray-500 hover:text-primary transition-colors p-1" title="Skriv för hand">
                        <PencilIcon className="w-5 h-5" />
                    </button>

                    <button onClick={() => onRemove(exercise.id)} className="flex-shrink-0 text-red-500 hover:text-red-400 transition-colors text-sm font-medium" title="Ta bort övning">ta bort</button>
                </div>

                {isSearchVisible && searchResults.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                        {searchResults.map(result => (
                            <li key={result.id}>
                                <button
                                    onClick={() => handleSelectExercise(result)}
                                    className="w-full text-left px-4 py-2 hover:bg-primary/20 text-gray-800 dark:text-white transition-colors"
                                >
                                    {result.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                
                <div className="relative">
                    <textarea
                      value={exercise.description || ''}
                      onChange={e => onUpdate(exercise.id, { description: e.target.value })}
                      placeholder="Beskrivning (klicka på ✨ för AI-förslag)"
                      className={`w-full text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-300 p-2 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary h-16 pr-10 outline-none`}
                      rows={2}
                    />
                    <button
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDesc}
                      className="absolute top-2 right-2 text-gray-400 hover:text-purple-500 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                      title="Generera beskrivning med AI"
                    >
                      {isGeneratingDesc ? <div className="w-5 h-5 border-2 border-purple-500/50 border-t-purple-500 rounded-full animate-spin"></div> : <SparklesIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface BlockCardProps {
    block: WorkoutBlock;
    index: number;
    onUpdate: (blockId: string, updatedBlock: WorkoutBlock) => void;
    onRemove: (blockId: string) => void;
    onEditSettings: () => void;
    onOpenHandwriting: (config: { callback: (text: string) => void; multiLine: boolean }) => void;
    exerciseBank: BankExercise[];
    organizationId: string;
}
const BlockCard: React.FC<BlockCardProps> = ({ block, index, onUpdate, onRemove, onEditSettings, onOpenHandwriting, exerciseBank, organizationId }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    const handleFieldChange = (field: keyof WorkoutBlock, value: any) => {
        const updatedBlock = { ...block, [field]: value };
        if (field === 'title' && typeof value === 'string') {
            const settingsFromTitle = parseSettingsFromTitle(value);
            if (settingsFromTitle) {
                updatedBlock.settings = { ...updatedBlock.settings, ...settingsFromTitle };
            }
        }
        onUpdate(block.id, updatedBlock);
    };

    const addExercise = () => {
        const newExercises = [...block.exercises, createNewExercise()];
        onUpdate(block.id, { ...block, exercises: newExercises });
    };

    const updateExercise = (exId: string, updatedValues: Partial<Exercise>) => {
        const updatedExercises = block.exercises.map(ex => (ex.id === exId ? { ...ex, ...updatedValues } : ex));
        onUpdate(block.id, { ...block, exercises: updatedExercises });
    };

    const removeExercise = (exId: string) => {
        const updatedExercises = block.exercises.filter(ex => ex.id !== exId);
        onUpdate(block.id, { ...block, exercises: updatedExercises });
    };

    const moveExercise = (exerciseIndex: number, direction: 'up' | 'down') => {
        const newExercises = [...block.exercises];
        if (direction === 'up' && exerciseIndex > 0) {
            [newExercises[exerciseIndex], newExercises[exerciseIndex - 1]] = [newExercises[exerciseIndex - 1], newExercises[exerciseIndex]];
        } else if (direction === 'down' && exerciseIndex < newExercises.length - 1) {
            [newExercises[exerciseIndex], newExercises[exerciseIndex + 1]] = [newExercises[exerciseIndex + 1], newExercises[exerciseIndex]];
        }
        onUpdate(block.id, { ...block, exercises: newExercises });
    };

    const settingsText = useMemo(() => {
        const { mode, workTime, restTime, rounds, specifiedLaps, specifiedIntervalsPerLap } = block.settings;
        if (mode === TimerMode.NoTimer) return "Ingen timer";
        if (mode === TimerMode.Stopwatch) return "Stoppur";
        
        const formatTime = (t: number) => {
            const m = Math.floor(t / 60);
            const s = t % 60;
            const mPart = m > 0 ? `${m}m` : '';
            const sPart = s > 0 ? `${s}s` : '';
            return `${mPart} ${sPart}`.trim() || '0s';
        }

        if (mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) return `${mode}: ${formatTime(workTime)}`;
        if (mode === TimerMode.EMOM) return `EMOM: ${rounds} min`;

        // Interval & Tabata Logic
        let displayString = `${mode}: ${rounds}x`;
        if (specifiedLaps && specifiedIntervalsPerLap) {
            displayString = `${mode}: ${specifiedLaps} varv x ${specifiedIntervalsPerLap} intervaller`;
        }

        return `${displayString} (${formatTime(workTime)} / ${formatTime(restTime)})`;
    }, [block.settings]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border-2 border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4 flex-grow min-h-[44px]">
                    <EditableField 
                        label="Blockets Titel" 
                        value={block.title} 
                        onChange={val => handleFieldChange('title', val)}
                        isTitle
                    />
                </div>
                {index > 1 && (
                    <button onClick={() => onRemove(block.id)} className="text-red-500 hover:text-red-400 ml-4 flex-shrink-0 font-semibold">Ta bort</button>
                )}
            </div>

            <EditableField
                label="Uppläggsbeskrivning"
                value={block.setupDescription || ''}
                onChange={val => handleFieldChange('setupDescription', val)}
                isTextarea
            />
            
            <div className="my-4">
                <ToggleSwitch
                    label="'Följ mig'-läge"
                    checked={!!block.followMe}
                    onChange={(isChecked) => handleFieldChange('followMe', isChecked)}
                />
                <p className="text-xs text-gray-500 mt-1 pl-2">
                    <span className="font-bold">På:</span> Alla gör samma övning samtidigt. <span className="font-bold">Av:</span> För stationsbaserad cirkelträning.
                </p>
            </div>

            <div className="bg-gray-100 dark:bg-black p-3 my-4 rounded-md flex justify-between items-center text-sm">
                <p className="text-gray-600 dark:text-gray-300">
                    Inställningar: <span className="font-semibold text-gray-900 dark:text-white">{settingsText}</span>
                </p>
                <button onClick={onEditSettings} className="text-primary hover:underline font-semibold">Anpassa</button>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Välj blockets primära tagg</label>
                <div className="flex flex-wrap gap-2">
                    {['Styrka', 'Kondition', 'Rörlighet', 'Teknik', 'Core/Bål', 'Balans', 'Uppvärmning'].map(tag => (
                        <button
                            key={tag}
                            onClick={() => handleFieldChange('tag', tag)}
                            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                                block.tag === tag
                                ? 'bg-primary text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    <span>Övningar ({block.exercises.length})</span>
                    <span>{isExpanded ? 'Dölj' : 'Visa'}</span>
                </button>
                {isExpanded && (
                    <div className="space-y-3">
                        {block.exercises.length === 0 ? (
                            <p className="text-center text-sm text-gray-500 py-2">Blocket är tomt. Klicka på '+ Lägg till övning'.</p>
                        ) : (
                            block.exercises.map((ex, i) => (
                                <ExerciseItem 
                                    key={ex.id} 
                                    exercise={ex} 
                                    onUpdate={updateExercise} 
                                    onRemove={() => removeExercise(ex.id)}
                                    onOpenHandwriting={() => onOpenHandwriting({ 
                                        callback: (text) => {
                                            const parsed = parseExerciseLine(text);
                                            updateExercise(ex.id, { name: parsed.name, reps: parsed.reps });
                                        }, 
                                        multiLine: false 
                                    })}
                                    exerciseBank={exerciseBank}
                                    organizationId={organizationId}
                                    index={i}
                                    total={block.exercises.length}
                                    onMove={(direction) => moveExercise(i, direction)}
                                />
                            ))
                        )}
                        <button onClick={addExercise} className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                            <span>Lägg till övning</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Component Props ---
interface SimpleWorkoutBuilderScreenProps {
  initialWorkout: Workout | null;
  onSave: (workout: Workout) => void;
  onCancel: () => void;
}

// --- Main Component ---
export const SimpleWorkoutBuilderScreen: React.FC<SimpleWorkoutBuilderScreenProps> = ({ initialWorkout, onSave, onCancel }) => {
  const { selectedOrganization } = useStudio();
  const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [handwritingConfig, setHandwritingConfig] = useState<{ callback: (text: string) => void; multiLine: boolean } | null>(null);
  const [exerciseBank, setExerciseBank] = useState<BankExercise[]>([]);

  useEffect(() => {
    const fetchBank = async () => {
        try {
            const bank = await getExerciseBank();
            setExerciseBank(bank);
        } catch (error) {
            console.error("Failed to fetch exercise bank:", error);
        }
    };
    fetchBank();
  }, []);

  useEffect(() => {
    setWorkout(initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  }, [initialWorkout]);

  const isSavable = useMemo(() => {
    return workout.title.trim() !== '' && workout.blocks.length > 0 && workout.blocks.some(b => b.exercises.length > 0 && b.exercises.some(ex => ex.name.trim() !== ''));
  }, [workout]);

  const handleWorkoutChange = (field: keyof Workout, value: any) => {
    setWorkout(prev => ({ ...prev, [field]: value }));
  };

  const handleAddBlock = () => {
    setWorkout(prev => {
        const newBlock = createNewBlock(prev.blocks.length + 1);
        return { ...prev, blocks: [...prev.blocks, newBlock] };
    });
  };

  const handleRemoveBlock = (blockId: string) => {
    setBlockToDelete(blockId);
  };
  
  const confirmRemoveBlock = () => {
    if (!blockToDelete) return;
    setWorkout(prev => ({
        ...prev,
        blocks: prev.blocks.filter(b => b.id !== blockToDelete)
    }));
    setBlockToDelete(null);
  };
  
  const handleUpdateBlock = (blockId: string, updatedBlock: WorkoutBlock) => {
    setWorkout(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => (b.id === blockId ? updatedBlock : b)),
    }));
  };

  const handleUpdateBlockSettings = (blockId: string, newSettings: Partial<TimerSettings>) => {
    const block = workout.blocks.find(b => b.id === blockId);
    if(block) {
        handleUpdateBlock(blockId, {...block, settings: { ...block.settings, ...newSettings }});
    }
    setEditingBlockId(null);
  };
  
  const handleHandwritingComplete = (text: string) => {
    if (handwritingConfig) {
        const processedText = handwritingConfig.multiLine ? text : text.split('\n').join(' ');
        handwritingConfig.callback(processedText);
    }
    setHandwritingConfig(null);
  };
  
  const handleSave = () => {
      if(isSavable) {
        onSave(workout);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
        <WorkoutInfoCard 
            workout={workout} 
            onChange={handleWorkoutChange}
            onOpenHandwriting={(field, multiLine) => {
                 setHandwritingConfig({
                    callback: (text) => handleWorkoutChange(field, text),
                    multiLine,
                });
            }}
        />

        {workout.blocks.map((block, index) => (
            <BlockCard
                key={block.id}
                block={block}
                index={index + 1}
                onUpdate={handleUpdateBlock}
                onRemove={handleRemoveBlock}
                onEditSettings={() => setEditingBlockId(block.id)}
                onOpenHandwriting={(config) => setHandwritingConfig(config)}
                exerciseBank={exerciseBank}
                organizationId={selectedOrganization?.id || ''}
            />
        ))}

        <button onClick={handleAddBlock} className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-lg text-white font-bold bg-purple-500 hover:bg-purple-600 transition-colors shadow-lg">
            <span className="text-lg">Lägg till nytt block</span>
        </button>

        {!isSavable && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 px-4">
                För att spara eller starta passet behöver det ha ett namn och innehålla minst ett block med minst en ifylld övning.
            </p>
        )}
        
        <div className="pt-6 flex items-center justify-end gap-4">
           <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                Avbryt
           </button>
           <button onClick={handleSave} disabled={!isSavable} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed">
                Spara Pass
           </button>
        </div>
        
        {!!blockToDelete && (
            <ConfirmationModal
                onConfirm={confirmRemoveBlock}
                onCancel={() => setBlockToDelete(null)}
                title="Ta bort block"
                message="Är du säker på att du vill ta bort detta block? Detta kan inte ångras."
            />
        )}

        {editingBlockId && (
            <TimerSetupModal
                isOpen={!!editingBlockId}
                onClose={() => setEditingBlockId(null)}
                block={workout.blocks.find(b => b.id === editingBlockId)!}
                onSave={(newSettings) => handleUpdateBlockSettings(editingBlockId, newSettings)}
            />
        )}
        
        {handwritingConfig && (
            <HandwritingInputModal
                onClose={() => setHandwritingConfig(null)}
                onComplete={handleHandwritingComplete}
            />
        )}
    </div>
  );
};