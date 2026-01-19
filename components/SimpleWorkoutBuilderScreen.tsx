
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise } from '../types';
import { ToggleSwitch, PencilIcon, ChartBarIcon, SparklesIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon } from './icons';
import { TimerSetupModal } from './TimerSetupModal';
import { getExerciseBank } from '../services/firebaseService';
import { interpretHandwriting, generateExerciseDescription } from '../services/geminiService';
import { useStudio } from '../context/StudioContext';
import { parseSettingsFromTitle } from '../hooks/useWorkoutTimer';
import { EditableField } from './workout-builder/EditableField';

// --- Helpers ---
const parseExerciseLine = (line: string): { reps: string; name: string } => {
    const trimmedLine = line.trim();
    const match = trimmedLine.match(/^(\d+)\s+(.*)/);
    if (match && match[2] && match[2].trim() !== '') {
        return { reps: match[1], name: match[2].trim() };
    }
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
    const historyRef = useRef(history);
    historyRef.current = history;
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
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3 * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };

        setupCanvas();

        const getPointerPos = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
        };

        const startDrawing = (e: PointerEvent) => {
            e.preventDefault();
            isDrawing.current = true;
            points.current = [getPointerPos(e)];
        };

        const draw = (e: PointerEvent) => {
            if (!isDrawing.current) return;
            e.preventDefault();
            const pos = getPointerPos(e);
            points.current.push(pos);
            if (points.current.length < 3) return;
            const p1 = points.current[points.current.length - 3];
            const p2 = points.current[points.current.length - 2];
            const p3 = points.current[points.current.length - 1];
            const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const mid2 = { x: (p2.y + p3.x) / 2, y: (p2.y + p3.y) / 2 };
            ctx.beginPath(); ctx.moveTo(mid1.x, mid1.y); ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y); ctx.stroke();
        };

        const stopDrawing = () => {
            if (!isDrawing.current) return;
            isDrawing.current = false;
            setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
            points.current = [];
        };

        canvas.addEventListener('pointerdown', startDrawing);
        canvas.addEventListener('pointermove', draw);
        canvas.addEventListener('pointerup', stopDrawing);
        canvas.addEventListener('pointerleave', stopDrawing);
        return () => {
            canvas.removeEventListener('pointerdown', startDrawing);
            canvas.removeEventListener('pointermove', draw);
            canvas.removeEventListener('pointerup', stopDrawing);
            canvas.removeEventListener('pointerleave', stopDrawing);
        };
    }, []);

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
    
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHistory([]);
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
  showDescriptionInTimer: false,
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
    const baseClasses = "w-full bg-transparent focus:outline-none disabled:bg-transparent";
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
        <div 
            ref={searchContainerRef} 
            className={`group p-3 rounded-lg flex items-start gap-3 transition-all border-l-4 ${
                exercise.loggingEnabled 
                ? 'bg-green-50 dark:bg-green-900/10 border-green-500' 
                : 'bg-gray-100 dark:bg-gray-700/50 border-transparent'
            }`}
        >
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
                        className={`${baseClasses.replace('w-full', '')} ${textClasses} w-24 font-semibold placeholder-gray-500`}
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
                        className={`${baseClasses} ${textClasses} font-semibold`}
                    />
                    
                    {/* LOGGNING PILL-BUTTON */}
                    <button 
                        onClick={() => onUpdate(exercise.id, { loggingEnabled: !exercise.loggingEnabled })}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border font-bold text-[10px] uppercase tracking-wider ${
                            exercise.loggingEnabled 
                            ? 'bg-green-500 border-green-600 text-white shadow-sm' 
                            : 'bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500'
                        }`}
                        title={exercise.loggingEnabled ? "Loggning aktiverad" : "Aktivera loggning för medlemmar"}
                    >
                        <ChartBarIcon className={`w-3.5 h-3.5 ${exercise.loggingEnabled ? 'text-white' : 'text-gray-400'}`} />
                        <span>{exercise.loggingEnabled ? 'Loggas' : 'Loggas ej'}</span>
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
                        className={`${baseClasses} text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-300 p-2 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary h-16 pr-10`}
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
    onUpdate: (updatedBlock: WorkoutBlock) => void;
    onRemove: () => void;
    onEditSettings: () => void;
    onOpenHandwriting: (cb: (text: string) => void) => void;
    exerciseBank: BankExercise[];
}
const BlockCard: React.FC<BlockCardProps> = ({ block, index, onUpdate, onRemove, onEditSettings, onOpenHandwriting, exerciseBank }) => {
    const handleFieldChange = (field: keyof WorkoutBlock, value: any) => {
        const updated = { ...block, [field]: value };
        if (field === 'title' && typeof value === 'string') {
            const settings = parseSettingsFromTitle(value);
            if (settings) updated.settings = { ...updated.settings, ...settings };
        }
        onUpdate(updated);
    };

    const handleToggleAllLogging = () => {
        const allEnabled = block.exercises.length > 0 && block.exercises.every(ex => ex.loggingEnabled);
        const updatedExercises = block.exercises.map(ex => ({
            ...ex,
            loggingEnabled: !allEnabled
        }));
        onUpdate({ ...block, exercises: updatedExercises });
    };

    const moveEx = (idx: number, dir: 'up' | 'down') => {
        const exs = [...block.exercises];
        if (dir === 'up' && idx > 0) [exs[idx], exs[idx-1]] = [exs[idx-1], exs[idx]];
        else if (dir === 'down' && idx < exs.length - 1) [exs[idx], exs[idx+1]] = [exs[idx+1], exs[idx]];
        onUpdate({ ...block, exercises: exs });
    };

    const settingsText = useMemo(() => {
        const { mode, workTime, restTime, rounds, specifiedLaps, specifiedIntervalsPerLap } = block.settings;
        if (mode === TimerMode.NoTimer) return "Ingen timer";
        
        const formatTime = (t: number) => {
            const m = Math.floor(t / 60);
            const s = t % 60;
            const mPart = m > 0 ? `${m}m` : '';
            const sPart = s > 0 ? `${s}s` : '';
            return `${mPart} ${sPart}`.trim() || '0s';
        }

        if (mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) return `${mode}: ${formatTime(workTime)}`;
        if (mode === TimerMode.EMOM) return `EMOM: ${rounds} min`;
        
        let displayString = `${mode}: ${rounds}x`;
        if (specifiedLaps && specifiedIntervalsPerLap) {
            displayString = `${mode}: ${specifiedLaps} varv x ${specifiedIntervalsPerLap} intervaller`;
        }
        return `${displayString} (${formatTime(workTime)} / ${formatTime(restTime)})`;
    }, [block.settings]);

    const allExercisesLogged = block.exercises.length > 0 && block.exercises.every(ex => ex.loggingEnabled);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-5">
            <div className="flex justify-between items-start">
                <div className="flex-grow">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Block {index}</label>
                    <input 
                        type="text" value={block.title} 
                        onChange={e => handleFieldChange('title', e.target.value)} 
                        placeholder="Blockets titel..." 
                        className="w-full bg-transparent text-2xl font-black text-gray-900 dark:text-white focus:outline-none placeholder-gray-200 dark:placeholder-gray-700" 
                    />
                </div>
                <button onClick={onRemove} className="text-red-500 p-2"><TrashIcon className="w-5 h-5" /></button>
            </div>

            <textarea 
                value={block.setupDescription || ''} 
                onChange={e => handleFieldChange('setupDescription', e.target.value)} 
                placeholder="Upplägg/Instruktioner för blocket..." 
                className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 text-sm focus:ring-1 focus:ring-primary outline-none" 
                rows={2}
            />

            <div className="flex flex-col gap-3">
                <ToggleSwitch 
                    label="Visa beskrivning i timern" 
                    checked={!!block.showDescriptionInTimer} 
                    onChange={v => handleFieldChange('showDescriptionInTimer', v)} 
                />
                <ToggleSwitch 
                    label="'Följ mig'-läge" 
                    checked={!!block.followMe} 
                    onChange={v => handleFieldChange('followMe', v)} 
                />
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl flex justify-between items-center border border-gray-100 dark:border-gray-800">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Timer: <span className="text-gray-900 dark:text-white">{block.settings.mode}</span></div>
                <button onClick={onEditSettings} className="text-primary font-black text-xs uppercase tracking-widest">Ändra</button>
            </div>

            <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center mb-1">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Övningar ({block.exercises.length})</h4>
                    {block.exercises.length > 0 && (
                        <button 
                            onClick={handleToggleAllLogging}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline px-2 py-1 rounded bg-primary/5 border border-primary/10"
                        >
                            {allExercisesLogged ? 'Avmarkera alla för loggning' : 'Logga alla i blocket'}
                        </button>
                    )}
                </div>
                {block.exercises.map((ex, i) => (
                    <ExerciseItem 
                        key={ex.id} exercise={ex} 
                        onUpdate={(id, vals) => onUpdate({ ...block, exercises: block.exercises.map(e => e.id === id ? { ...e, ...vals } : e) })} 
                        onRemove={id => onUpdate({ ...block, exercises: block.exercises.filter(e => e.id !== id) })} 
                        onOpenHandwriting={() => onOpenHandwriting(t => { const p = parseExerciseLine(t); onUpdate({ ...block, exercises: block.exercises.map(e => e.id === ex.id ? { ...e, name: p.name, reps: p.reps } : e) }) })} 
                        exerciseBank={exerciseBank} index={i} total={block.exercises.length} onMove={dir => moveEx(i, dir)} 
                    />
                ))}
                <button onClick={() => onUpdate({ ...block, exercises: [...block.exercises, createNewExercise()] })} className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2.5rem] text-gray-400 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">+ Lägg till övning</button>
            </div>
        </div>
    );
};

// --- Main Component ---
export const SimpleWorkoutBuilderScreen: React.FC<{ initialWorkout: Workout | null; onSave: (w: Workout) => void; onCancel: () => void }> = ({ initialWorkout, onSave, onCancel }) => {
    const { selectedOrganization } = useStudio();
    const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [handwritingCb, setHandwritingCb] = useState<((t: string) => void) | null>(null);
    const [exerciseBank, setExerciseBank] = useState<BankExercise[]>([]);

    useEffect(() => { getExerciseBank().then(setExerciseBank); }, []);

    const handleSave = () => {
        if (!workout.title.trim()) { alert("Passet måste ha ett namn."); return; }
        onSave({ ...workout, organizationId: selectedOrganization?.id || '' });
    };
    
    // Helper to add block
    const handleAddBlock = () => {
        setWorkout(prev => ({ ...prev, blocks: [...prev.blocks, createNewBlock(prev.blocks.length + 1)] }));
    };

    // Helper to update block
    const handleUpdateBlock = (updatedBlock: WorkoutBlock) => {
        setWorkout(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b)
        }));
    };

    // Helper to remove block
    const handleRemoveBlock = (blockId: string) => {
         setWorkout(prev => ({
            ...prev,
            blocks: prev.blocks.filter(b => b.id !== blockId)
         }));
    };

    // Helper to update settings
    const handleUpdateBlockSettings = (blockId: string, newSettings: Partial<TimerSettings>) => {
        const b = workout.blocks.find(x => x.id === blockId);
        if(b) setWorkout({ ...workout, blocks: workout.blocks.map(curr => curr.id === blockId ? { ...b, settings: { ...b.settings, ...newSettings } } : curr) });
        setEditingBlockId(null);
    };

    return (
        <div className="w-full h-full flex flex-col animate-fade-in bg-gray-50 dark:bg-black">
            <div className="flex-grow overflow-y-auto px-4 pb-24 pt-4 custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="bg-primary/10 p-6 rounded-[2.5rem] border border-primary/20">
                        <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1 block">Passinformation</label>
                        <input 
                            type="text" value={workout.title} 
                            onChange={e => setWorkout({ ...workout, title: e.target.value })} 
                            placeholder="Namnge ditt pass..." 
                            className="w-full bg-transparent text-3xl font-black text-gray-900 dark:text-white focus:outline-none placeholder-primary/20 mb-4" 
                        />
                        <textarea 
                            value={workout.coachTips || ''} 
                            onChange={e => setWorkout({ ...workout, coachTips: e.target.value })} 
                            placeholder="Allmänna tips (valfritt)..." 
                            className="w-full bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 text-sm focus:ring-1 focus:ring-primary outline-none" 
                            rows={2}
                        />
                    </div>

                    <div className="space-y-6">
                        {workout.blocks.map((block, i) => (
                            <BlockCard 
                                key={block.id} block={block} index={i+1} 
                                onUpdate={handleUpdateBlock} 
                                onRemove={() => handleRemoveBlock(block.id)} 
                                onEditSettings={() => setEditingBlockId(block.id)} 
                                onOpenHandwriting={setHandwritingCb} exerciseBank={exerciseBank} 
                            />
                        ))}
                    </div>

                    <button onClick={handleAddBlock} className="w-full py-5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-black rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-gray-700 uppercase tracking-widest text-sm hover:bg-gray-200 transition-colors">Lägg till block</button>
                </div>
            </div>

            <div className="fixed bottom-6 left-4 right-4 max-w-2xl mx-auto z-40 flex gap-3">
                <button onClick={onCancel} className="flex-1 bg-white dark:bg-gray-800 text-gray-500 py-4 rounded-2xl font-black border border-gray-200 dark:border-gray-700 shadow-xl uppercase tracking-widest text-xs">Avbryt</button>
                <button onClick={handleSave} className="flex-[2] bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/30 uppercase tracking-widest text-xs">Spara Pass</button>
            </div>

            {editingBlockId && (
                <TimerSetupModal 
                    isOpen={!!editingBlockId} onClose={() => setEditingBlockId(null)} 
                    block={workout.blocks.find(b => b.id === editingBlockId)!} 
                    onSave={s => handleUpdateBlockSettings(editingBlockId, s)} 
                />
            )}

            {handwritingCb && <HandwritingInputModal onClose={() => setHandwritingCb(null)} onComplete={t => { handwritingCb(t); setHandwritingCb(null); }} />}
        </div>
    );
};
