
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise } from '../types';
import { ToggleSwitch, PencilIcon, ChartBarIcon, SparklesIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon } from './icons';
import { TimerSetupModal } from './TimerSetupModal';
import { getExerciseBank } from '../services/firebaseService';
import { interpretHandwriting, generateExerciseDescription } from '../services/geminiService';
import { useStudio } from '../context/StudioContext';
import { parseSettingsFromTitle } from '../hooks/useWorkoutTimer';

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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">{title}</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                    <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors">Ja, ta bort</button>
                </div>
            </div>
        </div>
    );
};

// --- Sub-components ---

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
const ExerciseItem: React.FC<ExerciseItemProps> = ({ exercise, onUpdate, onRemove, onOpenHandwriting, exerciseBank, index, total, onMove }) => {
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
            reps: exercise.reps,
            isFromBank: true,
        });
        setIsSearchVisible(false);
        setSearchQuery('');
    };
    
    // Tvingade färger och solid bakgrund för Flip-skärmen
    const inputBaseClasses = "appearance-none !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-semibold placeholder-gray-400 dark:placeholder-gray-500";
    
    return (
        <div 
            ref={searchContainerRef} 
            className={`group p-3 rounded-2xl flex items-start gap-3 transition-all border-l-4 ${
                exercise.loggingEnabled 
                ? 'bg-green-50 dark:bg-green-900/10 border-green-500' 
                : 'bg-gray-100 dark:bg-gray-700/50 border-transparent'
            }`}
        >
            <div className="flex flex-col gap-1 items-center justify-center self-center mr-1">
                <button 
                    disabled={index === 0} 
                    onClick={() => onMove('up')} 
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 transition-colors"
                >
                    <ChevronUpIcon className="w-5 h-5" />
                </button>
                <button 
                    disabled={index === total - 1} 
                    onClick={() => onMove('down')} 
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 transition-colors"
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
                        className={`${inputBaseClasses} w-24`}
                    />
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            value={exercise.name}
                            onChange={handleNameChange}
                            onFocus={() => {
                                setIsSearchVisible(true);
                                setSearchQuery(exercise.name);
                            }}
                            placeholder="Sök eller skriv övning..."
                            className={`${inputBaseClasses} w-full`}
                        />
                        {isSearchVisible && searchResults.length > 0 && (
                            <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto">
                                {searchResults.map(result => (
                                    <li key={result.id}>
                                        <button
                                            onClick={() => handleSelectExercise(result)}
                                            className="w-full text-left px-4 py-3 hover:bg-primary/20 text-gray-900 dark:text-white transition-colors font-bold"
                                        >
                                            {result.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => onUpdate(exercise.id, { loggingEnabled: !exercise.loggingEnabled })}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all border font-black text-[10px] uppercase tracking-wider ${
                            exercise.loggingEnabled 
                            ? 'bg-green-500 border-green-600 text-white shadow-lg' 
                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                        }`}
                    >
                        <ChartBarIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">{exercise.loggingEnabled ? 'Loggas' : 'Loggas ej'}</span>
                    </button>

                    <button onClick={onOpenHandwriting} className="text-gray-400 hover:text-primary p-2" title="Skriv för hand">
                        <PencilIcon className="w-5 h-5" />
                    </button>

                    <button onClick={() => onRemove(exercise.id)} className="text-red-500 p-2" title="Ta bort">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="relative">
                    <textarea
                        value={exercise.description || ''}
                        onChange={e => onUpdate(exercise.id, { description: e.target.value })}
                        placeholder="Instruktioner..."
                        className={`${inputBaseClasses} w-full h-20 resize-none font-medium text-sm`}
                        rows={2}
                    />
                    <button
                        onClick={handleGenerateDescription}
                        disabled={isGeneratingDesc}
                        className="absolute top-2 right-2 text-gray-400 hover:text-purple-500 transition-colors"
                        title="AI-beskrivning"
                    >
                        {isGeneratingDesc ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <SparklesIcon className="w-5 h-5" />}
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

    const moveEx = (idx: number, dir: 'up' | 'down') => {
        const exs = [...block.exercises];
        if (dir === 'up' && idx > 0) [exs[idx], exs[idx-1]] = [exs[idx-1], exs[idx]];
        else if (dir === 'down' && idx < exs.length - 1) [exs[idx], exs[idx+1]] = [exs[idx+1], exs[idx]];
        onUpdate({ ...block, exercises: exs });
    };

    const inputBaseClasses = "appearance-none !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white border border-gray-200 dark:border-gray-700 rounded-2xl p-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-black placeholder-gray-300 dark:placeholder-gray-600 shadow-inner";

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-gray-800 space-y-6">
            <div className="flex justify-between items-start">
                <div className="flex-grow max-w-2xl">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block ml-1">Block {index}</label>
                    <input 
                        type="text" value={block.title} 
                        onChange={e => handleFieldChange('title', e.target.value)} 
                        placeholder="Blockets titel..." 
                        className={`${inputBaseClasses} w-full text-2xl tracking-tight`} 
                    />
                </div>
                <button onClick={onRemove} className="text-red-500 p-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                    <TrashIcon className="w-6 h-6" />
                </button>
            </div>

            <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block ml-1">Instruktioner</label>
                <textarea 
                    value={block.setupDescription || ''} 
                    onChange={e => handleFieldChange('setupDescription', e.target.value)} 
                    placeholder="T.ex. AMRAP 10 minuter, fokus på tempo..." 
                    className={`${inputBaseClasses} w-full text-base font-bold h-24 resize-none`} 
                    rows={2}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <ToggleSwitch 
                        label="Visa beskrivning i timern" 
                        checked={!!block.showDescriptionInTimer} 
                        onChange={v => handleFieldChange('showDescriptionInTimer', v)} 
                    />
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <ToggleSwitch 
                        label="'Följ mig'-läge" 
                        checked={!!block.followMe} 
                        onChange={v => handleFieldChange('followMe', v)} 
                    />
                </div>
            </div>

            <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-3xl flex justify-between items-center border border-primary/20">
                <div>
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1">Vald Timer</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{block.settings.mode}</p>
                </div>
                <button onClick={onEditSettings} className="bg-primary text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all">Anpassa klockan</button>
            </div>

            <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center px-1">
                    <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Övningar ({block.exercises.length})</h4>
                    <button 
                        onClick={() => {
                            const allLog = block.exercises.every(ex => ex.loggingEnabled);
                            onUpdate({ ...block, exercises: block.exercises.map(ex => ({ ...ex, loggingEnabled: !allLog })) });
                        }}
                        className="text-[10px] font-black uppercase text-primary hover:underline"
                    >
                        Logga alla i blocket
                    </button>
                </div>
                {block.exercises.map((ex, i) => (
                    <ExerciseItem 
                        key={ex.id} exercise={ex} 
                        onUpdate={(id, vals) => onUpdate({ ...block, exercises: block.exercises.map(e => e.id === id ? { ...e, ...vals } : e) })} 
                        onRemove={id => onUpdate({ ...block, exercises: block.exercises.filter(e => e.id !== id) })} 
                        onOpenHandwriting={() => onOpenHandwriting(t => { const p = parseExerciseLine(t); onUpdate({ ...block, exercises: block.exercises.map(e => e.id === ex.id ? { ...e, name: p.name, reps: p.reps } : e) }) })} 
                        exerciseBank={exerciseBank} index={i} total={block.exercises.length} onMove={dir => moveEx(i, dir)} organizationId=""
                    />
                ))}
                <button 
                    onClick={() => onUpdate({ ...block, exercises: [...block.exercises, createNewExercise()] })} 
                    className="w-full py-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2rem] text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                    <span className="text-xl">+</span> Lägg till övning
                </button>
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
    
    const handleAddBlock = () => {
        setWorkout(prev => ({ ...prev, blocks: [...prev.blocks, createNewBlock(prev.blocks.length + 1)] }));
    };

    const handleUpdateBlock = (updatedBlock: WorkoutBlock) => {
        setWorkout(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b)
        }));
    };

    const handleRemoveBlock = (blockId: string) => {
         setWorkout(prev => ({
            ...prev,
            blocks: prev.blocks.filter(b => b.id !== blockId)
         }));
    };

    const handleUpdateBlockSettings = (blockId: string, updates: Partial<TimerSettings> & { autoAdvance?: boolean; transitionTime?: number }) => {
        setWorkout(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => {
                if (b.id !== blockId) return b;
                const { autoAdvance, transitionTime, ...settingsUpdates } = updates;
                return {
                    ...b,
                    autoAdvance: autoAdvance !== undefined ? autoAdvance : b.autoAdvance,
                    transitionTime: transitionTime !== undefined ? transitionTime : b.transitionTime,
                    settings: { ...b.settings, ...settingsUpdates }
                };
            })
        }));
        setEditingBlockId(null);
    };

    const inputBaseClasses = "appearance-none !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white border border-gray-200 dark:border-gray-700 rounded-[2rem] p-6 focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all font-black placeholder-gray-300 dark:placeholder-gray-600 shadow-xl";

    return (
        <div className="w-full h-full flex flex-col animate-fade-in bg-gray-50 dark:bg-black">
            <div className="flex-grow overflow-y-auto px-4 pb-40 pt-6 custom-scrollbar scroll-smooth">
                <div className="max-w-2xl mx-auto space-y-10">
                    
                    {/* Header Card */}
                    <div className="bg-primary/10 p-8 rounded-[3rem] border border-primary/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <SparklesIcon className="w-32 h-32" />
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 block ml-2">Passets Namn</label>
                                <input 
                                    type="text" value={workout.title} 
                                    onChange={e => setWorkout({ ...workout, title: e.target.value })} 
                                    placeholder="Mitt grymma pass..." 
                                    className={`${inputBaseClasses} w-full text-4xl tracking-tight !bg-white dark:!bg-gray-900`} 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 block ml-2">Tips till deltagare</label>
                                <textarea 
                                    value={workout.coachTips || ''} 
                                    onChange={e => setWorkout({ ...workout, coachTips: e.target.value })} 
                                    placeholder="T.ex. utrustning som behövs eller fokusområden..." 
                                    className={`${inputBaseClasses} w-full text-lg h-32 resize-none !bg-white dark:!bg-gray-900`} 
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-10">
                        {workout.blocks.map((block, i) => (
                            <BlockCard 
                                key={block.id} block={block} index={i+1} 
                                onUpdate={handleUpdateBlock} 
                                onRemove={() => handleRemoveBlock(block.id)} 
                                onEditSettings={() => setEditingBlockId(block.id)} 
                                onOpenHandwriting={(cb) => setHandwritingCb(() => cb)} 
                                exerciseBank={exerciseBank} 
                                organizationId=""
                            />
                        ))}
                    </div>

                    <button 
                        onClick={handleAddBlock} 
                        className="w-full py-8 bg-white dark:bg-gray-900 text-gray-400 hover:text-primary hover:border-primary/50 font-black rounded-[3rem] border-4 border-dashed border-gray-200 dark:border-gray-800 uppercase tracking-[0.2em] text-sm shadow-sm transition-all transform active:scale-95"
                    >
                        + Lägg till block
                    </button>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 z-[200] bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 p-6">
                <div className="max-w-2xl mx-auto flex gap-4">
                    <button onClick={onCancel} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all">Avbryt</button>
                    <button onClick={handleSave} className="flex-[2] bg-primary text-white py-5 rounded-[2rem] font-black shadow-2xl shadow-primary/30 uppercase tracking-widest text-lg transform hover:-translate-y-1 active:scale-95 transition-all">Spara Pass 🚀</button>
                </div>
            </div>

            {editingBlockId && (
                <TimerSetupModal 
                    isOpen={!!editingBlockId} onClose={() => setEditingBlockId(null)} 
                    block={workout.blocks.find(b => b.id === editingBlockId)!} 
                    onSave={s => handleUpdateBlockSettings(editingBlockId, s)} 
                />
            )}

            {handwritingCb && (
                <HandwritingInputModal 
                    onClose={() => setHandwritingCb(null)} 
                    onComplete={t => { handwritingCb(t); setHandwritingCb(null); }} 
                />
            )}
        </div>
    );
};
