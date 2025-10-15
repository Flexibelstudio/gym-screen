import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Workout, WorkoutBlock, TimerMode, TimerSettings, Exercise, Passkategori, StudioConfig, WorkoutResult, Organization, BankExercise } from '../types';
import { TimerSetupModal } from './TimerSetupModal';
import { StarIcon, PencilIcon, DumbbellIcon, ToggleSwitch } from './icons';
import { getWorkoutResults, uploadImage, deleteImageByUrl, updateExerciseImageOverride } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';

// Helper to get color based on workout tag
const getTagColor = (tag: string) => {
  switch (tag.toLowerCase()) {
    case 'styrka': return 'bg-red-200 text-red-800';
    case 'kondition': return 'bg-blue-100 text-blue-800';
    case 'rörlighet': return 'bg-teal-100 text-teal-900';
    case 'teknik': return 'bg-purple-100 text-purple-900';
    case 'core': case 'bål': case 'core/bål': return 'bg-yellow-200 text-yellow-800';
    case 'balans': return 'bg-pink-100 text-pink-800';
    case 'uppvärmning': return 'bg-orange-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

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


// --- Helper and new component for inline editing ---
const createNewExercise = (): Exercise => ({
  id: `ex-temp-${Date.now()}`,
  name: '',
  reps: '',
  description: '',
  imageUrl: '',
});

interface EditableExerciseRowProps {
  exercise: Exercise;
  onUpdate: (exercise: Exercise) => void;
  onRemove: () => void;
  organizationId: string;
}

const EditableExerciseRow: React.FC<EditableExerciseRowProps> = ({ exercise, onUpdate, onRemove, organizationId }) => {
    const isNew = exercise.name === '';
    return (
        <div className="flex flex-col gap-2 bg-gray-200 dark:bg-gray-900 p-2 rounded-md ring-1 ring-gray-300 dark:ring-gray-700">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={exercise.reps || ''}
                    onChange={e => onUpdate({ ...exercise, reps: e.target.value })}
                    placeholder="Antal"
                    className="w-24 bg-transparent text-gray-800 dark:text-white focus:outline-none placeholder-gray-500"
                />
                <input
                    type="text"
                    value={exercise.name}
                    onChange={e => onUpdate({ ...exercise, name: e.target.value })}
                    placeholder="Övningsnamn"
                    className="flex-grow bg-transparent text-gray-800 dark:text-white focus:outline-none"
                    autoFocus={isNew}
                />
                <button onClick={onRemove} className="text-gray-500 hover:text-red-600 dark:hover:text-red-500 transition-colors font-semibold text-sm flex-shrink-0">
                    Ta bort
                </button>
            </div>
        </div>
    );
};


// WorkoutDetailScreen Component
interface WorkoutDetailScreenProps {
  workout: Workout;
  onStartBlock: (block: WorkoutBlock) => void;
  onUpdateBlockSettings: (blockId: string, newSettings: Partial<WorkoutBlock['settings']>) => void;
  onEditWorkout: (workout: Workout, blockId?: string) => void;
  isCoachView: boolean;
  onTogglePublish: (workoutId: string, isPublished: boolean) => void;
  onToggleFavorite: (workoutId: string) => void;
  onDuplicate: (workout: Workout) => void;
  onShowImage: (url: string) => void;
  isPresentationMode: boolean;
  studioConfig: StudioConfig;
  onDelete?: (workoutId: string) => void;
  followMeShowImage: boolean;
  setFollowMeShowImage: (show: boolean) => void;
  onUpdateWorkout: (workout: Workout) => void;
}

const WorkoutDetailScreen: React.FC<WorkoutDetailScreenProps> = ({ 
    workout, onStartBlock, onUpdateBlockSettings, onEditWorkout, 
    isCoachView, onTogglePublish, onToggleFavorite, onDuplicate, 
    onShowImage, isPresentationMode, studioConfig, onDelete,
    followMeShowImage, setFollowMeShowImage, onUpdateWorkout
}) => {
  const { selectedOrganization } = useStudio();
  const [sessionWorkout, setSessionWorkout] = useState<Workout>(() => JSON.parse(JSON.stringify(workout)));
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [coachTipsVisible, setCoachTipsVisible] = useState(true);
  const [results, setResults] = useState<WorkoutResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [exerciseToEditImage, setExerciseToEditImage] = useState<Exercise | BankExercise | null>(null);
  
  const personalBestName = useMemo(() => localStorage.getItem('hyrox-participant-name'), []);
  const isHyroxRace = useMemo(() => workout.id.startsWith('hyrox-full-race'), [workout.id]);

  useEffect(() => {
    setSessionWorkout(JSON.parse(JSON.stringify(workout)));
  }, [workout]);

  useEffect(() => {
    if (isHyroxRace) {
        const fetchResults = () => {
            if (!resultsLoading) { // Prevent overlapping fetches
                setResultsLoading(true);
                getWorkoutResults(workout.id)
                    .then(setResults)
                    .catch(console.error)
                    .finally(() => setResultsLoading(false));
            }
        };
        
        fetchResults(); // Initial fetch

        const intervalId = setInterval(fetchResults, 15000); // Poll every 15 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
    }
  }, [workout.id, isHyroxRace, resultsLoading]);

  const isMemberDraftView = useMemo(() => !workout.isPublished && !isCoachView, [workout.isPublished, isCoachView]);
  const effectiveCoachView = isCoachView;
  const canEditExercisesInline = effectiveCoachView || isMemberDraftView;

  const handleDelete = () => {
      if (onDelete && window.confirm(`Är du säker på att du vill ta bort passet "${workout.title}"?`)) {
          onDelete(workout.id);
      }
  };

  const handleUpdateBlock = (updatedBlock: WorkoutBlock) => {
    setSessionWorkout(prevWorkout => {
      if (!prevWorkout) return null;
      return {
        ...prevWorkout,
        blocks: prevWorkout.blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b)
      };
    });
  };

  const handleUpdateSettings = (blockId: string, newSettings: Partial<TimerSettings>) => {
      onUpdateBlockSettings(blockId, newSettings);
      const blockToUpdate = sessionWorkout.blocks.find(b => b.id === blockId);
      if (blockToUpdate) {
          const updatedBlock = {
              ...blockToUpdate,
              settings: { ...blockToUpdate.settings, ...newSettings }
          };
          handleUpdateBlock(updatedBlock);
      }
      setEditingBlockId(null);
  };
  
  const handleToggleHideImages = (checked: boolean) => {
    const updatedWorkout = { ...sessionWorkout, hideExerciseImages: checked };
    setSessionWorkout(updatedWorkout);
    onUpdateWorkout(updatedWorkout);
  };

  if (!sessionWorkout || !selectedOrganization) {
    return null; 
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white">{sessionWorkout.title}</h1>
        
        <div className="flex items-center gap-2 flex-wrap">
            {!workout.isPublished && !isCoachView && (
                 <button 
                    onClick={() => onToggleFavorite(workout.id)}
                    className="p-2 rounded-lg transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-yellow-400/50 dark:hover:bg-yellow-400/20"
                    aria-label={workout.isFavorite ? "Ta bort från favoriter" : "Lägg till som favorit"}
                    title={workout.isFavorite ? "Ta bort från favoriter" : "Spara som favorit"}
                >
                    <StarIcon filled={!!workout.isFavorite} className={`h-7 w-7 ${workout.isFavorite ? "text-yellow-400" : "text-gray-500"}`} />
                </button>
            )}

            {isMemberDraftView ? (
                <button 
                    onClick={() => onEditWorkout(workout)} 
                    className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Redigera
                </button>
            ) : effectiveCoachView && (
                <>
                    <button 
                      onClick={() => onDuplicate(workout)} 
                      className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      Kopiera & Redigera
                    </button>
                    <button 
                      onClick={() => onEditWorkout(workout)} 
                      className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      Redigera
                    </button>
                    {workout.isPublished ? (
                        <button 
                            onClick={() => onTogglePublish(workout.id, false)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                            Avpublicera
                        </button>
                    ) : (
                        <button 
                            onClick={() => onTogglePublish(workout.id, true)}
                            className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                            Publicera
                        </button>
                    )}
                </>
            )}
        </div>
      </div>

      {sessionWorkout.coachTips && sessionWorkout.coachTips.trim() !== '' && (
        <div className="bg-orange-100 dark:bg-orange-900/40 border-l-4 border-orange-400 dark:border-orange-500 rounded-r-lg mb-8 text-orange-800 dark:text-orange-200">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Tips från coachen:</h3>
              <button
                onClick={() => setCoachTipsVisible(!coachTipsVisible)}
                className="text-sm font-semibold hover:text-black dark:hover:text-white"
              >
                {coachTipsVisible ? 'Dölj' : 'Visa'}
              </button>
            </div>
            {coachTipsVisible && (
              <p className="text-base mt-2 animate-fade-in">{sessionWorkout.coachTips}</p>
            )}
          </div>
        </div>
      )}
      
      {isCoachView && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
              <ToggleSwitch
                  label="Dölj alla övningsbilder för detta pass"
                  checked={!!sessionWorkout.hideExerciseImages}
                  onChange={handleToggleHideImages}
              />
          </div>
      )}

      <div className="space-y-6">
        {sessionWorkout.blocks.map(block => (
          <WorkoutBlockCard 
            key={block.id} 
            block={block} 
            onStart={() => onStartBlock(block)} 
            onEditSettings={() => setEditingBlockId(block.id)}
            onUpdateBlock={handleUpdateBlock}
            isCoachView={canEditExercisesInline}
            onShowImage={onShowImage}
            onEditExerciseImage={setExerciseToEditImage}
            organization={selectedOrganization}
            organizationId={selectedOrganization?.id || ''}
            followMeShowImage={followMeShowImage}
            setFollowMeShowImage={setFollowMeShowImage}
            hideImages={!!sessionWorkout.hideExerciseImages}
          />
        ))}
      </div>

      {isHyroxRace && (
        <ResultsLeaderboard 
            results={results} 
            isLoading={resultsLoading}
            personalBestName={personalBestName} 
        />
      )}

      {editingBlockId && (
        <TimerSetupModal
          isOpen={!!editingBlockId}
          onClose={() => setEditingBlockId(null)}
          block={sessionWorkout.blocks.find(b => b.id === editingBlockId)!}
          onSave={(newSettings) => {
            handleUpdateSettings(editingBlockId, newSettings);
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
    </div>
  );
};


// WorkoutBlockCard Component
interface WorkoutBlockCardProps {
    block: WorkoutBlock;
    onStart: () => void;
    onEditSettings: () => void;
    onUpdateBlock: (block: WorkoutBlock) => void;
    isCoachView: boolean;
    onShowImage: (url: string) => void;
    onEditExerciseImage: (exercise: Exercise) => void;
    organization: Organization | null;
    organizationId: string;
    followMeShowImage: boolean;
    setFollowMeShowImage: (show: boolean) => void;
    hideImages?: boolean;
}
const WorkoutBlockCard: React.FC<WorkoutBlockCardProps> = ({ 
    block, onStart, onEditSettings, onUpdateBlock, isCoachView, 
    onShowImage, onEditExerciseImage, organization, organizationId, followMeShowImage, setFollowMeShowImage, hideImages
}) => {
    const [exercisesVisible, setExercisesVisible] = useState(true);

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const settingsText = useMemo(() => {
        const { mode, workTime, restTime, rounds, prepareTime } = block.settings;
        const prepText = `(+${prepareTime}s redo)`;

        switch(mode) {
            case TimerMode.Interval:
            case TimerMode.Tabata:
                const totalIntervals = rounds;
                const exercisesPerLap = block.exercises.length > 0 ? block.exercises.length : 1;
                const laps = Math.ceil(totalIntervals / exercisesPerLap);
                const lapText = laps > 1 && exercisesPerLap > 1 ? ` (${laps} varv)` : '';
                return `Intervall: ${totalIntervals}x (${formatTime(workTime)} arbete / ${formatTime(restTime)} vila)${lapText} ${prepText}`;
            
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                return `${mode}: ${formatTime(workTime)} totalt ${prepText}`;

            case TimerMode.EMOM:
                return `EMOM: ${rounds} min totalt (${workTime}s/min) ${prepText}`;
            
            case TimerMode.NoTimer:
                return 'Ingen timer. Utför i egen takt.';
            
            default:
                return `${mode}: ${rounds}x (${workTime}s / ${restTime}s)`;
        }
    }, [block.settings, block.exercises.length]);
  
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`inline-block ${getTagColor(block.tag)} text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider`}>
                {block.tag}
              </span>
            </div>
            <h2 className="text-3xl font-bold text-primary">{block.title}</h2>
            <div className="text-gray-500 dark:text-gray-400 mt-2 text-sm space-y-1">
                {(block.setupDescription || '').split('\n').map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="text-primary">►</span>
                        <span>{line}</span>
                    </div>
                ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {block.followMe && (
                <button 
                    onClick={() => setFollowMeShowImage(!followMeShowImage)}
                    className={`p-2 rounded-lg transition-colors ${followMeShowImage ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-200 dark:bg-gray-700'}`}
                    title={followMeShowImage ? 'Dölj bilder i Följ mig-läge' : 'Visa bilder i Följ mig-läge'}
                >
                    {followMeShowImage ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5" />
                        </svg>
                    )}
                </button>
            )}
            <button onClick={onStart} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors text-lg whitespace-nowrap shadow-sm">
                <span>Starta Block</span>
            </button>
          </div>
        </div>
        
        <div className="bg-gray-100 dark:bg-black p-3 rounded-md flex justify-between items-center text-sm mb-4 flex-wrap gap-2">
          <p className="text-gray-600 dark:text-gray-300">
            Aktuella inställningar: <span className="font-semibold text-gray-800 dark:text-white">{settingsText}</span>
          </p>
          <button onClick={onEditSettings} className="text-primary hover:underline font-semibold">Anpassa tider</button>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="w-full flex justify-between items-center text-gray-600 dark:text-gray-400 mb-3">
            <button onClick={() => setExercisesVisible(!exercisesVisible)} className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-white font-semibold">
              <span>{exercisesVisible ? 'Dölj övningar' : 'Visa övningar'}</span>
            </button>
          </div>

          {exercisesVisible && (
            <div className="space-y-2 pt-2">
              {block.exercises.map(ex => {
                const imageUrl = organization?.exerciseOverrides?.[ex.id]?.imageUrl || ex.imageUrl;
                return (
                    <div key={ex.id} className="py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
                       <div className="flex items-center justify-between">
                            <div className="flex-grow">
                                 <p className="text-gray-800 dark:text-gray-200 text-base">
                                    {ex.reps && ex.reps.trim() && (
                                        <span className="font-bold text-black dark:text-white">{ex.reps.trim()}&nbsp;</span>
                                    )}
                                    {ex.name}
                                </p>
                                {ex.description && ex.description.trim() !== '' && (
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 pl-2">{ex.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {!hideImages && imageUrl && (
                                    <button
                                        onClick={() => onShowImage(imageUrl)}
                                        className="flex-shrink-0 group"
                                        aria-label="Visa övningsbild"
                                    >
                                        <img src={imageUrl} alt={ex.name} className="w-16 h-16 object-cover rounded-md transition-transform group-hover:scale-105 shadow-sm"/>
                                    </button>
                                )}
                                {isCoachView && ex.isFromBank && (
                                  <button onClick={() => onEditExerciseImage(ex)} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-1 px-3 rounded-lg transition-colors text-sm whitespace-nowrap" title="Anpassa bild för organisationen">
                                    Anpassa bild
                                  </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
};

const formatResultTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

interface ResultsLeaderboardProps {
    results: WorkoutResult[];
    isLoading: boolean;
    personalBestName: string | null;
}

const ResultsLeaderboard: React.FC<ResultsLeaderboardProps> = ({ results, isLoading, personalBestName }) => {
    const personalBestResult = useMemo(() => {
        if (!personalBestName) return null;
        const userResults = results.filter(r => r.participantName === personalBestName);
        return userResults.sort((a, b) => a.finishTime - b.finishTime)[0] || null;
    }, [results, personalBestName]);

    return (
        <div className="mt-10 bg-gray-50 dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-3xl font-bold text-primary mb-4">Topplista</h3>
            
            {personalBestResult && (
                <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-400 dark:border-yellow-500 rounded-r-lg">
                    <p className="font-bold text-yellow-800 dark:text-yellow-200">
                        Ditt Personbästa: {formatResultTime(personalBestResult.finishTime)}
                    </p>
                </div>
            )}
            
            {isLoading && results.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-300">Laddar resultat...</p>
            ) : results.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-300">Inga resultat registrerade ännu.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-300 dark:border-gray-600">
                                <th className="p-2 w-16 text-sm font-semibold text-gray-500 dark:text-gray-400">#</th>
                                <th className="p-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Namn</th>
                                <th className="p-2 text-right text-sm font-semibold text-gray-500 dark:text-gray-400">Tid</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((result, index) => (
                                <tr key={result.id} className={`border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${result.participantName === personalBestName ? 'bg-primary/10' : ''}`}>
                                    <td className="p-2 font-bold text-gray-800 dark:text-white">{index + 1}</td>
                                    <td className="p-2 text-gray-800 dark:text-white">{result.participantName}</td>
                                    <td className="p-2 text-right font-mono text-gray-800 dark:text-white">{formatResultTime(result.finishTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};


export default WorkoutDetailScreen;