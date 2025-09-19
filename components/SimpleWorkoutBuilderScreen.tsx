import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings } from '../types';
import { ToggleSwitch, PencilIcon } from './icons';
import { TimerSetupModal } from './TimerSetupModal';
import { interpretHandwriting } from '../services/geminiService';


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
    const lastPos = useRef<{ x: number, y: number } | null>(null);

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
                        ctx.drawImage(tempCanvas, 0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
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
            lastPos.current = getPointerPos(e);
        };

        const draw = (e: PointerEvent) => {
            if (!isDrawing.current) return;
            e.preventDefault();
            const pos = getPointerPos(e);
            if (lastPos.current) {
                ctx.beginPath();
                ctx.moveTo(lastPos.current.x, lastPos.current.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                lastPos.current = pos;
            }
        };

        const stopDrawing = () => {
            if (!isDrawing.current) return;
            isDrawing.current = false;
            lastPos.current = null;

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if(canvas && ctx) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setHistory(prev => [...prev, imageData]);
            }
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
  },
  exercises: [],
});

const createNewExercise = (): Exercise => ({
  id: `ex-${Date.now()}`,
  name: '',
  reps: '',
  description: '',
  imageUrl: '',
});

const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round(width * (maxHeight / height));
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(img.src);
                return reject(new Error('Could not get canvas context'));
            }

            // Draw a white background, as JPEG doesn't support transparency
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            URL.revokeObjectURL(img.src);
            resolve(dataUrl);
        };
        img.onerror = (error) => {
            URL.revokeObjectURL(img.src);
            reject(error);
        };
    });
};

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

// --- Component Props ---
interface SimpleWorkoutBuilderScreenProps {
  initialWorkout: Workout | null;
  onSave: (workout: Workout) => void;
  onCancel: () => void;
}

// --- Main Component ---
export const SimpleWorkoutBuilderScreen: React.FC<SimpleWorkoutBuilderScreenProps> = ({ initialWorkout, onSave, onCancel }) => {
  const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [handwritingConfig, setHandwritingConfig] = useState<{ callback: (text: string) => void; multiLine: boolean } | null>(null);


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
                        <PencilIcon />
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
                        <PencilIcon />
                    </button>
                </div>
            </div>
        </div>
    )
}


interface BlockCardProps {
    block: WorkoutBlock;
    index: number;
    onUpdate: (blockId: string, updatedBlock: WorkoutBlock) => void;
    onRemove: (blockId: string) => void;
    onEditSettings: () => void;
    onOpenHandwriting: (config: { callback: (text: string) => void; multiLine: boolean }) => void;
}
const BlockCard: React.FC<BlockCardProps> = ({ block, index, onUpdate, onRemove, onEditSettings, onOpenHandwriting }) => {
    
    const handleFieldChange = (field: keyof WorkoutBlock, value: any) => {
        onUpdate(block.id, { ...block, [field]: value });
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

    const settingsText = useMemo(() => {
        const { mode, workTime, restTime, rounds } = block.settings;
        if (mode === TimerMode.Stopwatch) return "Stoppur (ingen fast tid)";
        if (mode === TimerMode.NoTimer) return "Ingen timer";
        const formatTime = (t: number) => {
            const m = Math.floor(t / 60);
            const s = t % 60;
            return `${m > 0 ? `${m}m` : ''} ${s > 0 ? `${s}s` : ''}`.trim();
        }
        if (mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) return `${mode}: ${formatTime(workTime)}`;
        if (mode === TimerMode.EMOM) return `EMOM: ${rounds} min`;
        return `Intervall: ${rounds}x (${formatTime(workTime)} / ${formatTime(restTime)})`;
    }, [block.settings]);

    return (
        <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-slate-700 space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-full">
                    <input 
                        value={block.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className="text-2xl font-bold text-gray-800 dark:text-white bg-white/50 dark:bg-slate-900/50 p-2 rounded-md border border-transparent focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none w-full transition"
                    />
                    <button onClick={() => onOpenHandwriting({ callback: (text) => handleFieldChange('title', text), multiLine: false })} className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors p-1" title="Skriv för hand">
                        <PencilIcon />
                    </button>
                </div>
                {index > 1 && (
                    <button onClick={() => onRemove(block.id)} className="text-red-600 hover:text-red-500 flex-shrink-0 ml-4 font-semibold">
                        Ta bort
                    </button>
                )}
            </div>

            <div className="relative">
                <textarea
                    value={block.setupDescription}
                    onChange={e => handleFieldChange('setupDescription', e.target.value)}
                    placeholder="Anteckningar för blocket..."
                    className="w-full bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-300 p-3 rounded-md border border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    rows={2}
                />
                <button onClick={() => onOpenHandwriting({ callback: (text) => handleFieldChange('setupDescription', text), multiLine: true })} className="absolute top-3 right-3 text-gray-400 hover:text-primary transition-colors p-1" title="Skriv för hand">
                    <PencilIcon />
                </button>
            </div>

            <div className="my-4">
                <ToggleSwitch
                    label="'Följ mig'-läge"
                    checked={!!block.followMe}
                    onChange={(isChecked) => handleFieldChange('followMe', isChecked)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-2">
                    <span className="font-bold">På:</span> Alla gör samma övning samtidigt. <span className="font-bold">Av:</span> För stationsbaserad cirkelträning.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tagg för blocket</label>
                <div className="flex flex-wrap gap-2">
                    {['Styrka', 'Kondition', 'Rörlighet', 'Teknik', 'Core/Bål', 'Balans', 'Uppvärmning'].map(tag => (
                        <button key={tag} onClick={() => handleFieldChange('tag', tag)} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${block.tag === tag ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'}`}>
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3 rounded-md flex justify-between items-center text-sm flex-wrap gap-2 border border-gray-200 dark:border-slate-700">
                <p className="text-gray-600 dark:text-gray-300">Inställningar: <span className="font-semibold text-gray-900 dark:text-white">{settingsText}</span></p>
                <button onClick={onEditSettings} className="text-primary hover:underline font-semibold">Anpassa tider</button>
            </div>
            
            <div className="space-y-2 pt-2">
                {block.exercises.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-2">Blocket är tomt. Klicka på '+ Lägg till övning'.</p>
                ) : (
                    block.exercises.map((ex, i) => (
                        <ExerciseItem 
                            key={ex.id} 
                            exercise={ex} 
                            onUpdate={updateExercise} 
                            onRemove={removeExercise}
                            onOpenHandwriting={() => onOpenHandwriting({ 
                                callback: (text) => {
                                    const parsed = parseExerciseLine(text);
                                    updateExercise(ex.id, { name: parsed.name, reps: parsed.reps });
                                }, 
                                multiLine: false 
                            })}
                        />
                    ))
                )}
            </div>

            <button onClick={addExercise} className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:border-gray-400 dark:hover:border-slate-500 transition-colors">
                <span>Lägg till övning</span>
            </button>
        </div>
    );
}

const ExerciseImageUploader: React.FC<{
  imageUrl: string | null;
  onImageChange: (url: string) => void;
}> = ({ imageUrl, onImageChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
        try {
            const resizedImage = await resizeImage(file, 800, 800, 0.8);
            onImageChange(resizedImage);
        } catch (error) {
            console.error("Image resizing failed:", error);
            alert("Bilden kunde inte förminskas. Försök med en annan bild eller en mindre bild.");
        }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onImageChange(e.target.value);
  }

  const handleRemoveImage = () => {
      onImageChange('');
  }
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
             handleFile(file);
             e.preventDefault();
             return;
          }
        }
      }
  }

  return (
    <div className="space-y-2 pt-2 border-t border-gray-300 dark:border-slate-700 mt-2">
        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">ÖVNINGSBILD</label>
      {imageUrl ? (
        <div className="relative group">
          <img src={imageUrl} alt="Förhandsvisning" className="w-full h-32 object-cover rounded-md" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={handleRemoveImage}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-full shadow-lg"
            >
              Ta bort bild
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
            <input
                type="text"
                onChange={handleUrlChange}
                onPaste={handlePaste}
                placeholder="Klistra in URL eller bild"
                className="w-full bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 focus:outline-none text-sm p-2 rounded-md border border-gray-300 dark:border-slate-600"

            />
            <div className="text-center text-gray-500 dark:text-gray-400 text-xs">ELLER</div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center p-4 h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-slate-600 hover:border-primary hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
                accept="image/*"
                className="hidden"
              />
              <div className="text-center text-gray-500 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <p className="font-semibold mt-1 text-sm">Dra och släpp en bild</p>
                <p className="text-xs">eller klicka för att välja fil</p>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};


interface ExerciseItemProps {
    exercise: Exercise;
    onUpdate: (id: string, updatedValues: Partial<Exercise>) => void;
    onRemove: (id: string) => void;
    onOpenHandwriting: () => void;
}
const ExerciseItem: React.FC<ExerciseItemProps> = ({ exercise, onUpdate, onRemove, onOpenHandwriting }) => {
    return (
        <div className="bg-gray-100 dark:bg-slate-900/50 rounded-lg flex items-center shadow-sm">
            <div className="w-28 flex-shrink-0 font-semibold text-gray-600 dark:text-gray-400 text-center p-4 bg-gray-200 dark:bg-slate-800 rounded-l-lg">
                Antal
            </div>
            <div className="flex-grow p-2 flex items-center gap-2">
                <input
                    type="text"
                    value={exercise.reps || ''}
                    onChange={e => onUpdate(exercise.id, { reps: e.target.value })}
                    placeholder="t.ex. 10"
                    className="w-24 bg-transparent text-gray-800 dark:text-white focus:outline-none placeholder-gray-500 font-semibold"
                />
                <input
                    type="text"
                    value={exercise.name}
                    onChange={e => onUpdate(exercise.id, { name: e.target.value })}
                    placeholder="Övningsnamn"
                    className="flex-grow bg-transparent text-gray-800 dark:text-white focus:outline-none font-semibold"
                />
            </div>
            <div className="p-3 flex items-center gap-2">
                 <button onClick={onOpenHandwriting} className="text-gray-500 hover:text-primary transition-colors p-1" title="Skriv för hand">
                    <PencilIcon className="w-5 h-5" />
                </button>
                <button onClick={() => onRemove(exercise.id)} className="text-gray-500 hover:text-red-600 transition-colors font-semibold text-sm">
                    Ta bort
                </button>
            </div>
        </div>
    );
};