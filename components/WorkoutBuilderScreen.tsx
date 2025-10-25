import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, Passkategori, StudioConfig, UserRole, BankExercise, Organization } from '../types';
import { ToggleSwitch, DumbbellIcon, PencilIcon } from './icons';
import { TimerSetupModal } from './TimerSetupModal';
import { getExerciseBank, uploadImage, deleteImageByUrl, updateExerciseImageOverride } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { parseSettingsFromTitle } from '../hooks/useWorkoutTimer';

const createNewWorkout = (): Workout => ({
  id: `workout-${Date.now()}`,
  title: 'Nytt Träningspass',
  coachTips: '',
  blocks: [],
  category: 'Ej kategoriserad',
  isPublished: false,
});

const createNewBlock = (): WorkoutBlock => ({
  id: `block-${Date.now()}`,
  title: 'Nytt Block',
  tag: 'Styrka',
  setupDescription: '',
  followMe: false,
  settings: {
    mode: TimerMode.Interval,
    workTime: 30,
    restTime: 15,
    rounds: 3,
    prepareTime: 10,
  },
  exercises: [],
});

const createNewExercise = (): Exercise => ({
  id: `ex-${Date.now()}`,
  name: 'Ny Övning',
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

interface ExerciseImageOverrideModalProps {
    isOpen: boolean;
    onClose: () => void;
    exercise: Exercise | BankExercise | null;
    organization: Organization;
}

const ExerciseImageOverrideModal: React.FC<ExerciseImageOverrideModalProps> = ({ isOpen, onClose, exercise, organization }) => {
    const { selectOrganization } = useStudio();
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    if (!isOpen || !exercise) return null;

    const getExerciseImageUrl = (ex: Exercise | BankExercise, org: Organization): string | undefined => {
        if (org.exerciseOverrides && org.exerciseOverrides[ex.id]) {
            return org.exerciseOverrides[ex.id].imageUrl;
        }
        return ex.imageUrl;
    };
    
    const currentImageUrl = getExerciseImageUrl(exercise, organization);
    const isOverridden = organization.exerciseOverrides?.[exercise.id] !== undefined;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            if (isOverridden && organization.exerciseOverrides?.[exercise.id]?.imageUrl) {
                await deleteImageByUrl(organization.exerciseOverrides[exercise.id].imageUrl);
            }
            
            const resizedBase64 = await resizeImage(file, 800, 800, 0.8);
            const path = `organizations/${organization.id}/exercise_images/${exercise.id}-${Date.now()}.jpg`;
            const downloadURL = await uploadImage(path, resizedBase64);

            const updatedOrg = await updateExerciseImageOverride(organization.id, exercise.id, downloadURL);
            selectOrganization(updatedOrg); 
            onClose();

        } catch (error) {
            console.error("Image override failed:", error);
            alert("Bilden kunde inte laddas upp. Försök igen.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleReset = async () => {
        if (!isOverridden) return;

        setIsProcessing(true);
        try {
            const overrideUrl = organization.exerciseOverrides?.[exercise.id]?.imageUrl;
            if (overrideUrl) {
                await deleteImageByUrl(overrideUrl);
            }
            const updatedOrg = await updateExerciseImageOverride(organization.id, exercise.id, null);
            selectOrganization(updatedOrg);
            onClose();
        } catch (error) {
            console.error("Failed to reset image:", error);
            alert("Kunde inte återställa bilden.");
        } finally {
            setIsProcessing(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1002] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">Anpassa bild för "{exercise.name}"</h2>
                <div className="my-4 relative w-full aspect-square bg-gray-200 dark:bg-black rounded-lg overflow-hidden">
                    {isProcessing && (
                         <div className="absolute inset-0 bg-gray-900/80 z-10 flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                            <p className="text-sm font-semibold text-gray-300">Bearbetar...</p>
                        </div>
                    )}
                    {currentImageUrl ? (
                        <img src={currentImageUrl} alt={exercise.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                           <DumbbellIcon className="w-16 h-16 text-gray-400 dark:text-gray-600"/>
                        </div>
                    )}
                </div>
                
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                
                <div className="space-y-3">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">Ladda upp ny bild</button>
                    {isOverridden && (
                        <button onClick={handleReset} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">Återställ till standardbild</button>
                    )}
                    <button onClick={onClose} disabled={isProcessing} className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Helper to check for unsaved changes
const useUnsavedChanges = (isDirty: boolean) => {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);
};

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

interface WorkoutStructurePanelProps {
    workout: Workout;
    onBlockClick: (blockId: string) => void;
    onExerciseClick: (exerciseId: string) => void;
    dragItemRef: React.MutableRefObject<any>;
    dragOverItemRef: React.MutableRefObject<any>;
    onSort: () => void;
    focusedBlockId: string | null;
}

const WorkoutStructurePanel: React.FC<WorkoutStructurePanelProps> = ({ workout, onBlockClick, onExerciseClick, dragItemRef, dragOverItemRef, onSort, focusedBlockId }) => {
    const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});

    const toggleCollapse = (blockId: string) => {
        setCollapsedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
    };

    return (
        <div className="sticky top-8">
            <div className="bg-slate-100 dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Passets Struktur</h3>
                <div className="space-y-2">
                    {workout.blocks.map((block, blockIndex) => {
                        const isCollapsed = collapsedBlocks[block.id];
                        return (
                            <div 
                                key={block.id}
                                className={`bg-white dark:bg-gray-900/70 rounded-md p-2 transition-all border ${focusedBlockId === block.id ? 'border-primary' : 'border-transparent'}`}
                                onDragEnter={() => {
                                    if(dragItemRef.current?.type === 'exercise' && dragItemRef.current.blockId !== block.id) {
                                      // If dragging an exercise over a new block, target the end of that block's exercise list
                                      dragOverItemRef.current = { type: 'exercise', index: block.exercises.length, blockId: block.id };
                                    }
                                }}
                            >
                                <div 
                                    className="flex items-center gap-2 cursor-grab"
                                    draggable
                                    onDragStart={() => dragItemRef.current = { type: 'block', index: blockIndex }}
                                    onDragEnter={() => dragOverItemRef.current = { type: 'block', index: blockIndex }}
                                    onDragEnd={onSort}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <span className="text-gray-500 hover:text-gray-900 dark:hover:text-white">☰</span>
                                    <div className="flex-grow" onClick={() => onBlockClick(block.id)}>
                                        <p className="font-semibold text-gray-900 dark:text-white truncate">{block.title || 'Namnlöst block'}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{block.exercises.length} övning(ar)</p>
                                    </div>
                                    <button onClick={() => toggleCollapse(block.id)} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                        {isCollapsed ? '▼' : '▲'}
                                    </button>
                                </div>
                                {!isCollapsed && (
                                    <div className="pl-6 pt-2 space-y-1">
                                        {block.exercises.map((ex, exIndex) => (
                                            <div 
                                                key={ex.id} 
                                                className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-200 dark:hover:bg-gray-700 cursor-grab"
                                                draggable
                                                onDragStart={(e) => {
                                                    e.stopPropagation();
                                                    dragItemRef.current = { type: 'exercise', index: exIndex, blockId: block.id };
                                                }}
                                                onDragEnter={(e) => {
                                                    e.stopPropagation();
                                                    dragOverItemRef.current = { type: 'exercise', index: exIndex, blockId: block.id };
                                                }}
                                                onDragEnd={(e) => { e.stopPropagation(); onSort(); }}
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            >
                                                <span className="text-gray-500 hover:text-gray-900 dark:hover:text-white">☰</span>
                                                <p className="text-gray-700 dark:text-gray-300 flex-grow truncate" onClick={() => onExerciseClick(ex.id)}>{ex.name || 'Namnlös övning'}</p>
                                            </div>
                                        ))}
                                        {block.exercises.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Inga övningar</p>}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

interface ExerciseBankPanelProps {
    bank: BankExercise[];
    onAddExercise: (exercise: BankExercise) => void;
    onPreviewExercise: (exercise: BankExercise) => void;
    isLoading: boolean;
}

const ExerciseBankPanel: React.FC<ExerciseBankPanelProps> = ({ bank, onAddExercise, onPreviewExercise, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const { selectedOrganization } = useStudio();

    const getExerciseImageUrl = useCallback((ex: Exercise | BankExercise, org: Organization | null): string | undefined => {
        if (org?.exerciseOverrides && org.exerciseOverrides[ex.id]) {
            return org.exerciseOverrides[ex.id].imageUrl;
        }
        return ex.imageUrl;
    }, []);

    const filteredBank = useMemo(() => {
        if (!searchTerm) return bank;
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return bank.filter(ex => 
            ex.name.toLowerCase().includes(lowerCaseSearchTerm) ||
            (ex.description && ex.description.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (ex.tags && ex.tags.some(tag => tag.toLowerCase().includes(lowerCaseSearchTerm)))
        );
    }, [bank, searchTerm]);

    return (
        <div className="bg-slate-100 dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700 flex flex-col max-h-[60vh]">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex-shrink-0">Övningsbank</h3>
            <div className="mb-4 flex-shrink-0">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Sök övning, muskelgrupp..."
                    className="w-full bg-white dark:bg-black p-2 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none"
                />
            </div>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                {isLoading ? (
                    <p className="text-center text-gray-500">Laddar banken...</p>
                ) : (
                    filteredBank.map(ex => {
                        const imageUrl = getExerciseImageUrl(ex, selectedOrganization);
                        return (
                            <div key={ex.id} className="bg-white dark:bg-gray-900/70 rounded-md p-2 flex items-center gap-3">
                                <div 
                                    className="flex-grow min-w-0 flex items-center gap-3 cursor-pointer"
                                    onClick={() => onPreviewExercise(ex)}
                                    role="button"
                                    aria-label={`Förhandsgranska ${ex.name}`}
                                >
                                    {imageUrl ? (
                                        <img src={imageUrl} alt={ex.name} className="w-16 h-16 object-cover rounded flex-shrink-0 bg-gray-700"/>
                                    ) : (
                                        <div className="w-16 h-16 rounded flex-shrink-0 bg-gray-700 flex items-center justify-center">
                                            <DumbbellIcon className="w-8 h-8 text-gray-500" />
                                        </div>
                                    )}
                                    <div className="flex-grow min-w-0">
                                        <p className="font-semibold text-gray-900 dark:text-white truncate">{ex.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ex.description}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onAddExercise(ex)} 
                                    className="bg-primary/20 hover:bg-primary/40 text-primary font-bold w-10 h-10 flex items-center justify-center rounded-full transition-colors flex-shrink-0"
                                    title={`Lägg till ${ex.name}`}
                                    aria-label={`Lägg till ${ex.name} i passet`}
                                >
                                    <span className="text-2xl">+</span>
                                </button>
                            </div>
                        )
                    })
                )}
                 {filteredBank.length === 0 && !isLoading && <p className="text-center text-gray-500 py-4">Inga övningar matchade sökningen.</p>}
            </div>
        </div>
    );
};

const ExercisePreviewModal: React.FC<{
    exercise: BankExercise | null;
    onClose: () => void;
    onAdd: (exercise: BankExercise) => void;
    onEditOrgImage: (exercise: BankExercise) => void;
}> = ({ exercise, onClose, onAdd, onEditOrgImage }) => {
    const { selectedOrganization } = useStudio();
    
    const getExerciseImageUrl = useCallback((ex: Exercise | BankExercise, org: Organization | null): string | undefined => {
        if (org?.exerciseOverrides && org.exerciseOverrides[ex.id]) {
            return org.exerciseOverrides[ex.id].imageUrl;
        }
        return ex.imageUrl;
    }, []);

    if (!exercise) return null;
    
    const imageUrl = getExerciseImageUrl(exercise, selectedOrganization);

    const handleAdd = () => {
        onAdd(exercise);
        onClose();
    };

    const handleEdit = () => {
        onEditOrgImage(exercise);
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1001] p-4 animate-fade-in" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-preview-title"
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-lg text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex-shrink-0 flex justify-between items-start mb-4">
                     <h3 id="exercise-preview-title" className="text-2xl font-bold text-primary">{exercise.name}</h3>
                     <button onClick={onClose} className="font-bold text-2xl leading-none text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" aria-label="Stäng">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {imageUrl ? (
                        <img src={imageUrl} alt={exercise.name} className="w-full h-64 object-cover rounded-lg bg-gray-700"/>
                    ) : (
                        <div className="w-full h-64 rounded-lg bg-gray-700 flex items-center justify-center">
                            <DumbbellIcon className="w-24 h-24 text-gray-500" />
                        </div>
                    )}
                    <p className="text-base text-gray-700 dark:text-gray-300">{exercise.description}</p>
                    {exercise.tags && exercise.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {exercise.tags.map(tag => (
                                <span key={tag} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-full">{tag}</span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="mt-6 flex-shrink-0 flex gap-4">
                    <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Stäng</button>
                    <button onClick={handleEdit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors">Anpassa bild</button>
                    <button onClick={handleAdd} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors">Lägg till i passet</button>
                </div>
            </div>
        </div>
    );
};

const AICoachPanel: React.FC<{
    workout: Workout;
    onShowAllSuggestions: () => void;
}> = ({ workout, onShowAllSuggestions }) => {
    const hasSummary = !!workout.aiCoachSummary;
    const hasSuggestions = workout.blocks?.some(b => b.aiMagicPenSuggestions && b.aiMagicPenSuggestions.length > 0);

    if (!hasSummary && !hasSuggestions) {
        return null; // Don't render if there's no feedback at all
    }

    return (
        <div className="sticky top-8">
            <div className="bg-slate-100 dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">💡 AI-Coach Summering</h3>
                {hasSummary && <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{workout.aiCoachSummary}</p>}
                {hasSuggestions && (
                    <button onClick={onShowAllSuggestions} className="w-full text-center bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-900/80 text-purple-800 dark:text-purple-200 font-semibold py-2 px-4 rounded-lg transition-colors">
                        ✨ Visa alla magipenna-förslag
                    </button>
                )}
            </div>
        </div>
    );
};

const AiSuggestionsSidePanel: React.FC<{
    workout: Workout;
    onClose: () => void;
}> = ({ workout, onClose }) => (
    <div className="sticky top-8 animate-fade-in">
        <div className="bg-yellow-50 dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-yellow-900 dark:text-yellow-200">✨ AI Coach Förslag</h3>
                <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white font-bold text-2xl">&times;</button>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {workout.blocks.map(block => (
                    (block.aiMagicPenSuggestions && block.aiMagicPenSuggestions.length > 0) && (
                        <div key={block.id}>
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 border-b border-yellow-200 dark:border-yellow-600 pb-1 mb-2">{block.title}</h4>
                            <ul className="space-y-1">
                                {block.aiMagicPenSuggestions.map((sugg, i) => (
                                    <li key={i} className="text-sm text-yellow-900 dark:text-yellow-100 flex items-start gap-2">
                                        <span className="opacity-80">💡</span>
                                        <span>{sugg}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )
                ))}
                {workout.aiCoachSummary && (
                    <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 border-b border-yellow-200 dark:border-yellow-600 pb-1 mb-2">AI-Coach Summering</h4>
                        <p className="text-sm text-yellow-900 dark:text-yellow-100">{workout.aiCoachSummary}</p>
                    </div>
                )}
            </div>
        </div>
    </div>
);

interface WorkoutBuilderScreenProps {
  initialWorkout: Workout | null;
  onSave: (workout: Workout) => void;
  onCancel: () => void;
  focusedBlockId?: string | null;
  studioConfig: StudioConfig;
  sessionRole: UserRole;
  isNewDraft?: boolean;
}

export const WorkoutBuilderScreen: React.FC<WorkoutBuilderScreenProps> = ({ initialWorkout, onSave, onCancel, focusedBlockId: initialFocusedBlockId, studioConfig, sessionRole, isNewDraft = false }) => {
  const { selectedOrganization, selectOrganization: refreshOrganization } = useStudio();
  const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(initialFocusedBlockId || null);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [exerciseBank, setExerciseBank] = useState<BankExercise[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(true);
  const [previewExercise, setPreviewExercise] = useState<BankExercise | null>(null);
  const [exerciseToEditImage, setExerciseToEditImage] = useState<Exercise | BankExercise | null>(null);
  const [isSuggestionsPanelVisible, setIsSuggestionsPanelVisible] = useState(false);

  const dragItem = useRef<{ type: 'block' | 'exercise', blockId?: string, index: number } | null>(null);
  const dragOverItem = useRef<{ type: 'block' | 'exercise', blockId?: string, index: number } | null>(null);
  
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const snapshot = JSON.stringify(initialWorkout || createNewWorkout());
    setInitialSnapshot(snapshot);
    setWorkout(JSON.parse(snapshot));
    setFocusedBlockId(initialFocusedBlockId || null);
  }, [initialWorkout, initialFocusedBlockId]);

  useEffect(() => {
    const fetchBank = async () => {
        setIsBankLoading(true);
        try {
            const bank = await getExerciseBank();
            setExerciseBank(bank);
        } catch (error) {
            console.error("Failed to fetch exercise bank:", error);
        } finally {
            setIsBankLoading(false);
        }
    };
    fetchBank();
  }, []);

  const isDirty = useMemo(() => {
    if (isNewDraft && initialWorkout) {
        return true;
    }
    return JSON.stringify(workout) !== initialSnapshot;
  }, [workout, initialSnapshot, isNewDraft, initialWorkout]);

  useUnsavedChanges(isDirty);
  
  const isSingleBlockMode = useMemo(() => !!initialFocusedBlockId, [initialFocusedBlockId]);
  
  const blocksToDisplay = useMemo(() => {
    if (!workout) return [];
    if (isSingleBlockMode) {
      return workout.blocks.filter(b => b.id === initialFocusedBlockId);
    }
    return workout.blocks;
  }, [workout, isSingleBlockMode, initialFocusedBlockId]);


  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('Du har osparade ändringar. Är du säker på att du vill lämna?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const handleSave = () => {
    onSave(workout);
  };
  
  const handleUpdateWorkoutDetail = (field: keyof Workout, value: any) => {
    setWorkout(prev => ({ ...prev, [field]: value }));
  };

  const handleAddBlock = () => {
    const newBlock = createNewBlock();
    setWorkout(prev => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
    setTimeout(() => { // Scroll to new block after render
        editorRefs.current[newBlock.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleRemoveBlock = (blockId: string) => {
    setBlockToDelete(blockId);
  };
  
  const confirmRemoveBlock = () => {
    if (!blockToDelete) return;

    const block = workout.blocks.find(b => b.id === blockToDelete);
    if (block) {
        const urlsToDelete = block.exercises.map(ex => ex.imageUrl).filter(Boolean) as string[];
        if (urlsToDelete.length > 0) {
            Promise.all(urlsToDelete.map(url => deleteImageByUrl(url)));
        }
    }
    
    setWorkout(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== blockToDelete) }));
    setBlockToDelete(null);
  };

  const handleUpdateBlock = (blockId: string, updatedBlock: WorkoutBlock) => {
    setWorkout(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === blockId ? updatedBlock : b)
    }));
  };
  
  const handleSort = () => {
      if (!dragItem.current || !dragOverItem.current) return;

      const { type: dragType, index: dragIndex, blockId: dragBlockId } = dragItem.current;
      const { type: dropType, index: dropIndex, blockId: dropBlockId } = dragOverItem.current;

      if (dragType === 'block' && dropType === 'block' && dragIndex !== dropIndex) {
          setWorkout(prev => {
              const newBlocks = [...prev.blocks];
              const [draggedItem] = newBlocks.splice(dragIndex, 1);
              newBlocks.splice(dropIndex, 0, draggedItem);
              return { ...prev, blocks: newBlocks };
          });
      }

      if (dragType === 'exercise' && dropType === 'exercise' && dragBlockId && dropBlockId) {
          setWorkout(prev => {
              const newBlocks = JSON.parse(JSON.stringify(prev.blocks)); // Deep copy for mutation
              const sourceBlock = newBlocks.find((b: WorkoutBlock) => b.id === dragBlockId);
              const destBlock = newBlocks.find((b: WorkoutBlock) => b.id === dropBlockId);

              if (!sourceBlock || !destBlock) return prev;
              
              const [draggedItem] = sourceBlock.exercises.splice(dragIndex, 1);
              if (!draggedItem) return prev;

              if (sourceBlock.id === destBlock.id) {
                destBlock.exercises.splice(dropIndex, 0, draggedItem);
              } else {
                destBlock.exercises.splice(dropIndex, 0, draggedItem);
              }

              return { ...prev, blocks: newBlocks };
          });
      }
      dragItem.current = null;
      dragOverItem.current = null;
  };


  const handleUpdateBlockSettings = (blockId: string, newSettings: Partial<TimerSettings>) => {
    setWorkout(prev => ({
        ...prev,
        blocks: prev.blocks.map(b =>
            b.id === blockId ? { ...b, settings: { ...b.settings, ...newSettings } } : b
        )
    }));
    setEditingBlockId(null);
  };
  
  const scrollToRef = (refId: string) => {
      editorRefs.current[refId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedBlockId(refId.replace('block-', '').replace('exercise-', ''));
  };

  const handleAddExerciseFromBank = (bankExercise: BankExercise) => {
    const targetBlockId = focusedBlockId || (workout.blocks.length > 0 ? workout.blocks[workout.blocks.length - 1].id : null);
    if (!targetBlockId) {
        alert("Skapa ett block först för att lägga till en övning.");
        return;
    }

    const newExercise: Exercise = {
        id: bankExercise.id, // Use bank ID to link to overrides
        name: bankExercise.name,
        description: bankExercise.description || '',
        imageUrl: bankExercise.imageUrl || '',
        reps: '', 
        isFromBank: true,
    };

    setWorkout(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => 
            b.id === targetBlockId 
            ? { ...b, exercises: [...b.exercises, newExercise] }
            : b
        )
    }));
    
    setTimeout(() => {
        editorRefs.current[`exercise-${newExercise.id}`]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  return (
    <>
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-2/3 space-y-6">
            {!isSingleBlockMode && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-200 dark:border-gray-700">
                  <EditableField 
                      label="Passets Titel"
                      value={workout.title}
                      onChange={val => handleUpdateWorkoutDetail('title', val)}
                      isTitle
                  />
                  <EditableField 
                      label="Tips från Coachen"
                      value={workout.coachTips}
                      onChange={val => handleUpdateWorkoutDetail('coachTips', val)}
                      isTextarea
                  />
                  
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                      <ToggleSwitch
                          label="Dölj alla övningsbilder för detta pass"
                          checked={!!workout.hideExerciseImages}
                          onChange={val => handleUpdateWorkoutDetail('hideExerciseImages', val)}
                      />
                      {sessionRole !== 'member' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Passkategori</label>
                            <div className="flex flex-wrap gap-2">
                                {studioConfig.customCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleUpdateWorkoutDetail('category', cat.name)}
                                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${workout.category === cat.name ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                      )}
                  </div>
              </div>
            )}
            
            <div className="space-y-6">
              {blocksToDisplay.map((block) => {
                  return (
                    <div key={block.id} ref={el => { editorRefs.current[`block-${block.id}`] = el; }}>
                        <EditableBlockCard 
                          block={block}
                          onUpdate={updatedBlock => handleUpdateBlock(block.id, updatedBlock)}
                          onRemove={() => handleRemoveBlock(block.id)}
                          onEditSettings={() => setEditingBlockId(block.id)}
                          onEditExerciseImage={setExerciseToEditImage}
                          isDraggable={!isSingleBlockMode}
                          workoutTitle={workout.title}
                          workoutBlocksCount={workout.blocks.length}
                          editorRefs={editorRefs}
                          exerciseBank={exerciseBank}
                          organizationId={selectedOrganization?.id || ''}
                        />
                    </div>
                  )
              })}
            </div>

            {!isSingleBlockMode && (
              <button onClick={handleAddBlock} className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <span>Lägg till Block</span>
              </button>
            )}
          </div>

          {!isSingleBlockMode && (
            <div className="w-full lg:w-1/3 space-y-6">
                <WorkoutStructurePanel 
                    workout={workout}
                    onBlockClick={(id) => scrollToRef(`block-${id}`)}
                    onExerciseClick={(id) => scrollToRef(`exercise-${id}`)}
                    dragItemRef={dragItem}
                    dragOverItemRef={dragOverItem}
                    onSort={handleSort}
                    focusedBlockId={focusedBlockId}
                />
                {isSuggestionsPanelVisible ? (
                    <AiSuggestionsSidePanel workout={workout} onClose={() => setIsSuggestionsPanelVisible(false)} />
                ) : (
                    <AICoachPanel workout={workout} onShowAllSuggestions={() => setIsSuggestionsPanelVisible(true)} />
                )}
                 {studioConfig.enableExerciseBank && (
                    <ExerciseBankPanel 
                        bank={exerciseBank}
                        onAddExercise={handleAddExerciseFromBank}
                        onPreviewExercise={setPreviewExercise}
                        isLoading={isBankLoading}
                    />
                 )}
            </div>
          )}
        </div>
        <div className="mt-8 flex justify-end gap-4">
            <button onClick={handleCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors">Avbryt</button>
            <button onClick={handleSave} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors" disabled={!isDirty}>
              Spara
            </button>
          </div>
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

      {previewExercise && (
        <ExercisePreviewModal
            exercise={previewExercise}
            onClose={() => setPreviewExercise(null)}
            onAdd={handleAddExerciseFromBank}
            onEditOrgImage={(exercise) => {
                setPreviewExercise(null);
                setExerciseToEditImage(exercise);
            }}
        />
       )}

       {selectedOrganization && (
            <ExerciseImageOverrideModal
                isOpen={!!exerciseToEditImage}
                onClose={() => setExerciseToEditImage(null)}
                exercise={exerciseToEditImage}
                organization={selectedOrganization}
            />
        )}
    </>
  );
};


interface EditableBlockCardProps {
    block: WorkoutBlock;
    onUpdate: (block: WorkoutBlock) => void;
    onRemove: () => void;
    onEditSettings: () => void;
    onEditExerciseImage: (exercise: Exercise) => void;
    isDraggable: boolean;
    workoutTitle: string;
    workoutBlocksCount: number;
    editorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    exerciseBank: BankExercise[];
    organizationId: string;
}
const EditableBlockCard: React.FC<EditableBlockCardProps> = ({ block, onUpdate, onRemove, onEditSettings, onEditExerciseImage, isDraggable, workoutTitle, workoutBlocksCount, editorRefs, exerciseBank, organizationId }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleFieldChange = (field: keyof WorkoutBlock, value: any) => {
        const updatedBlock = { ...block, [field]: value };
        
        if (field === 'title' && typeof value === 'string') {
            const settingsFromTitle = parseSettingsFromTitle(value);
            if (settingsFromTitle) {
                updatedBlock.settings = { ...updatedBlock.settings, ...settingsFromTitle };
            }
        }

        onUpdate(updatedBlock);
    };

    const handleExerciseChange = (exId: string, updatedExercise: Partial<Exercise>) => {
        onUpdate({
            ...block,
            exercises: block.exercises.map(ex => ex.id === exId ? { ...ex, ...updatedExercise } : ex)
        });
    };

    const handleAddExercise = () => {
      const newEx = createNewExercise();
      const newExercises = [...block.exercises, newEx];
      onUpdate({ ...block, exercises: newExercises });
      setTimeout(() => { 
          editorRefs.current[`exercise-${newEx.id}`]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    };

    const handleRemoveExercise = (exId: string) => {
      const exerciseToRemove = block.exercises.find(ex => ex.id === exId);
      if (exerciseToRemove?.imageUrl) {
          deleteImageByUrl(exerciseToRemove.imageUrl);
      }
      onUpdate({
        ...block,
        exercises: block.exercises.filter(ex => ex.id !== exId),
      });
    };
    
    const isTitleRedundant = block.title === workoutTitle && workoutBlocksCount === 1;
    
    const settingsText = useMemo(() => {
        const { mode, workTime, restTime, rounds } = block.settings;
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
        return `${mode}: ${rounds}x (${formatTime(workTime)} / ${formatTime(restTime)})`;
    }, [block.settings]);


    return (
        <div 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border-2 border-gray-200 dark:border-gray-700"
        >
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4 flex-grow min-h-[44px]">
                {!isTitleRedundant && (
                    <EditableField 
                        label="Blockets Titel" 
                        value={block.title} 
                        onChange={val => handleFieldChange('title', val)}
                        isTitle
                    />
                )}
              </div>
              {isDraggable && <button onClick={onRemove} className="text-red-500 hover:text-red-400 ml-4 flex-shrink-0 font-semibold">Ta bort</button>}
          </div>
          <EditableField
              label="Uppläggsbeskrivning"
              value={block.setupDescription}
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
                {['Styrka', 'Kondition', 'Rörlighet', 'Teknik', 'Core/Bål', 'Balans', 'Uppvärmning'].map(tag => {
                const isSelected = block.tag === tag;
                return (
                    <button
                    key={tag}
                    onClick={() => handleFieldChange('tag', tag)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                        isSelected
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                    >
                    {tag}
                    </button>
                );
                })}
            </div>
          </div>
        
          {block.aiCoachNotes && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
              <div className="flex items-start gap-2">
                <span className="text-xl mt-0.5">✨</span>
                <div className="flex-grow">
                  <p className="text-sm italic text-yellow-800 dark:text-yellow-200">{block.aiCoachNotes}</p>
                </div>
              </div>
            </div>
          )}


          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  <span>Övningar ({block.exercises.length})</span>
                  <span>{isExpanded ? 'Dölj' : 'Visa'}</span>
              </button>
              {isExpanded && (
                  <div className="space-y-3">
                      {block.exercises.map((ex) => (
                          <div key={ex.id} ref={el => { editorRefs.current[`exercise-${ex.id}`] = el; }}>
                            <EditableExerciseItem 
                                exercise={ex}
                                onChange={updatedEx => handleExerciseChange(ex.id, updatedEx)}
                                onRemove={() => handleRemoveExercise(ex.id)}
                                onEditOrgImage={() => onEditExerciseImage(ex)}
                                exerciseBank={exerciseBank}
                                organizationId={organizationId}
                            />
                          </div>
                      ))}
                       <button onClick={handleAddExercise} className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                          <span>Lägg till Övning</span>
                      </button>
                  </div>
              )}
          </div>
        </div>
    );
};


interface EditableExerciseItemProps {
    exercise: Exercise;
    onChange: (updatedExercise: Partial<Exercise>) => void;
    onRemove: () => void;
    onEditOrgImage: () => void;
    exerciseBank: BankExercise[];
    organizationId: string;
}

const EditableExerciseItem: React.FC<EditableExerciseItemProps> = ({ exercise, onChange, onRemove, onEditOrgImage, exerciseBank, organizationId }) => {
    const { selectedOrganization } = useStudio();
    const baseClasses = "w-full bg-transparent focus:outline-none disabled:bg-transparent";
    const textClasses = "text-gray-900 dark:text-white";
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<BankExercise[]>([]);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    const getExerciseImageUrl = useCallback((ex: Exercise | BankExercise, org: Organization | null): string | undefined => {
        if (org?.exerciseOverrides && org.exerciseOverrides[ex.id]) {
            return org.exerciseOverrides[ex.id].imageUrl;
        }
        return ex.imageUrl;
    }, []);

    const displayImageUrl = getExerciseImageUrl(exercise, selectedOrganization);

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
        onChange({ name: newName });
    };

    const handleSelectExercise = (bankExercise: BankExercise) => {
        onChange({
            id: bankExercise.id, // Update ID to match bank
            name: bankExercise.name,
            description: bankExercise.description || '',
            imageUrl: bankExercise.imageUrl || '',
            isFromBank: true,
        });
        setIsSearchVisible(false);
        setSearchQuery('');
    };


    return (
        <div 
          ref={searchContainerRef}
          className="group p-3 rounded-lg flex items-start gap-3 transition-all bg-gray-100 dark:bg-gray-700/50 relative"
        >
            <div className="relative flex-shrink-0 group/image">
                <div className="w-20 h-20 rounded-md bg-gray-200 dark:bg-gray-900 flex items-center justify-center">
                    {displayImageUrl ? (
                        <img src={displayImageUrl} alt={exercise.name} className="w-full h-full object-cover rounded-md" />
                    ) : (
                        <DumbbellIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    )}
                </div>
                 {exercise.isFromBank && (
                    <button 
                        onClick={onEditOrgImage}
                        className="absolute inset-0 bg-black/60 rounded-md flex items-center justify-center text-white opacity-0 group-hover/image:opacity-100 transition-opacity"
                        aria-label="Anpassa bild"
                        title="Anpassa bild"
                    >
                        <PencilIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
            <div className="flex-grow space-y-2">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={exercise.reps || ''}
                        onChange={e => onChange({ reps: e.target.value })}
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
                    <button onClick={onRemove} className="flex-shrink-0 text-red-500 hover:text-red-400 transition-colors text-sm font-medium" title="Ta bort övning">ta bort</button>
                </div>

                {isSearchVisible && searchResults.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                        {searchResults.map(result => (
                            <li key={result.id}>
                                <button
                                    onClick={() => handleSelectExercise(result)}
                                    className="w-full text-left px-4 py-2 hover:bg-primary/20 text-gray-900 dark:text-white"
                                >
                                    {result.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                
                <textarea
                  value={exercise.description || ''}
                  onChange={e => onChange({ description: e.target.value })}
                  placeholder="Beskrivning (frivilligt)"
                  className={`${baseClasses} text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-300 p-2 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary h-16`}
                  rows={2}
                />
                 
                {exercise.isFromBank && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                        <button onClick={onEditOrgImage} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                            <PencilIcon className="w-4 h-4" />
                            <span>Anpassa bild</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const EditableField: React.FC<{
    value: string;
    onChange: (value: string) => void;
    label: string;
    isTextarea?: boolean;
    isTitle?: boolean;
}> = ({ value, onChange, label, isTextarea, isTitle }) => {
    const commonClasses = "w-full bg-transparent focus:outline-none p-0";
    const textStyle = isTitle ? "text-3xl font-bold text-gray-900 dark:text-white" : "text-base text-gray-800 dark:text-gray-300";
    const wrapperClasses = isTitle ? "" : "bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-primary";
    
    const InputComponent = isTextarea ? 'textarea' : 'input';

    return (
        <div className={wrapperClasses}>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400 hidden">{label}</label>
            <InputComponent
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={label}
                className={`${commonClasses} ${textStyle}`}
                rows={isTextarea ? 3 : undefined}
            />
        </div>
    )
};