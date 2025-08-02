import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Workout, WorkoutBlock, TimerMode, TimerSettings, Exercise, Passkategori, StudioConfig } from '../types';
import { TimerSetupModal } from './TimerSetupModal';
import { QrCodeIcon, StarIcon } from './icons';

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

// --- Helper and new component for inline editing ---
const createNewExercise = (): Exercise => ({
  id: `ex-temp-${Date.now()}`,
  name: '',
  reps: '',
  description: '',
  imageUrl: '',
});

const ExerciseImageUploader: React.FC<{
  imageUrl: string | null;
  onImageChange: (url: string) => void;
}> = ({ imageUrl, onImageChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          onImageChange(e.target.result);
        }
      };
      reader.readAsDataURL(file);
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
    <div className="space-y-2 pt-2 mt-2 border-t border-gray-300 dark:border-gray-700">
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
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white p-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="text-center text-gray-500 text-xs">ELLER</div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center p-4 h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-gray-400 dark:border-gray-600 hover:border-primary hover:bg-gray-200 dark:hover:bg-gray-800'
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

interface EditableExerciseRowProps {
  exercise: Exercise;
  onUpdate: (exercise: Exercise) => void;
  onRemove: () => void;
}

const EditableExerciseRow: React.FC<EditableExerciseRowProps> = ({ exercise, onUpdate, onRemove }) => {
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
            <ExerciseImageUploader
              imageUrl={exercise.imageUrl || null}
              onImageChange={(url) => onUpdate({ ...exercise, imageUrl: url })}
            />
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
  onShowQrCode: (workout: Workout) => void;
  isPresentationMode: boolean;
  studioConfig: StudioConfig;
  onDelete?: (workoutId: string) => void;
}

const WorkoutDetailScreen: React.FC<WorkoutDetailScreenProps> = ({ workout, onStartBlock, onUpdateBlockSettings, onEditWorkout, isCoachView, onTogglePublish, onToggleFavorite, onDuplicate, onShowImage, onShowQrCode, isPresentationMode, studioConfig, onDelete }) => {
  const [sessionWorkout, setSessionWorkout] = useState<Workout>(() => JSON.parse(JSON.stringify(workout)));
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [coachTipsVisible, setCoachTipsVisible] = useState(true);

  useEffect(() => {
    setSessionWorkout(JSON.parse(JSON.stringify(workout)));
  }, [workout]);

  const isQrLoggingEnabled = useMemo(() => {
    if (workout.category === 'Boost') {
      return !!studioConfig.enableBoostQrLogging;
    }
    // "Eget pass" defaults to category 'Ej kategoriserad' and should be loggable
    if (workout.category === 'Ej kategoriserad') {
      return true;
    }
    const categoryConfig = studioConfig.customCategories.find(c => c.name === workout.category);
    return categoryConfig?.enableQrLogging ?? false;
  }, [workout.category, studioConfig]);


  const isMemberBoostView = useMemo(() => workout.category === 'Boost' && !isCoachView, [workout.category, isCoachView]);
  const effectiveCoachView = isCoachView; // A member is not a coach, even for boost workouts.
  const canEditExercisesInline = effectiveCoachView || isMemberBoostView;

  const showQrButton = isQrLoggingEnabled;

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

  if (!sessionWorkout) {
    return null; 
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white">{sessionWorkout.title}</h1>
        
        <div className="flex items-center gap-2 flex-wrap">
            {!workout.isPublished && (
                 <button 
                    onClick={() => onToggleFavorite(workout.id)}
                    className="p-2 rounded-lg transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-yellow-400/50 dark:hover:bg-yellow-400/20"
                    aria-label={workout.isFavorite ? "Ta bort från favoriter" : "Lägg till som favorit"}
                    title={workout.isFavorite ? "Ta bort från favoriter" : "Spara som favorit"}
                >
                    <StarIcon filled={!!workout.isFavorite} className={`h-7 w-7 ${workout.isFavorite ? "text-yellow-400" : "text-gray-500"}`} />
                </button>
            )}

            {isMemberBoostView ? (
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
          />
        ))}
      </div>

      {showQrButton && (
          <button
              onClick={() => onShowQrCode(workout)}
              className="fixed bottom-8 right-8 bg-primary hover:brightness-110 text-white rounded-full h-16 w-16 flex items-center justify-center shadow-lg transition-transform hover:scale-105 z-20"
              aria-label="Visa QR-kod för loggning"
              title="Visa QR-kod för loggning"
          >
              <QrCodeIcon className="h-8 w-8" />
          </button>
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
}
const WorkoutBlockCard: React.FC<WorkoutBlockCardProps> = ({ block, onStart, onEditSettings, onUpdateBlock, isCoachView, onShowImage }) => {
    const [exercisesVisible, setExercisesVisible] = useState(true);
    const [isEditingExercises, setIsEditingExercises] = useState(false);

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
                const totalIntervals = rounds * block.exercises.length;
                return `Intervall: ${totalIntervals}x (${formatTime(workTime)} arbete / ${formatTime(restTime)} vila) ${prepText}`;
            
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

    const handleUpdateExercise = (exId: string, updatedExercise: Exercise) => {
        onUpdateBlock({
            ...block,
            exercises: block.exercises.map(ex => (ex.id === exId ? updatedExercise : ex)),
        });
    };

    const handleRemoveExercise = (exId: string) => {
        onUpdateBlock({
            ...block,
            exercises: block.exercises.filter(ex => ex.id !== exId),
        });
    };

    const handleAddExercise = () => {
        onUpdateBlock({
            ...block,
            exercises: [...block.exercises, createNewExercise()],
        });
    };
  
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
          <button onClick={onStart} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors text-lg whitespace-nowrap shadow-sm">
            <span>Starta Block</span>
          </button>
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
             <div className="flex items-center gap-4">
                {isCoachView && (
                    <button 
                        onClick={() => setIsEditingExercises(!isEditingExercises)} 
                        className={`${isEditingExercises ? 'bg-primary hover:brightness-95 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white'} font-semibold py-1 px-3 rounded-md text-sm transition-colors`}
                    >
                        {isEditingExercises ? 'Klar' : 'Redigera Övningar'}
                    </button>
                )}
            </div>
          </div>

          {exercisesVisible && !isEditingExercises && (
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 pt-2">
              {block.exercises.map(ex => (
                <div key={ex.id} className="py-1.5">
                   <div className="flex items-center justify-between">
                        <p className="text-gray-800 dark:text-gray-200 text-base flex-grow">
                            {ex.reps && <span className="font-bold text-black dark:text-white">{ex.reps}&nbsp;</span>}
                            {ex.name}
                        </p>
                        {ex.imageUrl && (
                            <button
                                onClick={() => onShowImage(ex.imageUrl!)}
                                className="text-primary hover:brightness-125 transition flex-shrink-0 ml-2"
                                aria-label="Visa övningsbild"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </button>
                        )}
                    </div>
                  {ex.description && ex.description.trim() !== '' && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 pl-2">{ex.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {exercisesVisible && isEditingExercises && (
            <div className="animate-fade-in space-y-2 pt-2">
                {block.exercises.map(ex => (
                    <EditableExerciseRow 
                        key={ex.id}
                        exercise={ex}
                        onUpdate={(updatedEx) => handleUpdateExercise(ex.id, updatedEx)}
                        onRemove={() => handleRemoveExercise(ex.id)}
                    />
                ))}
                <button
                    onClick={handleAddExercise}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                    Lägg till övning
                </button>
            </div>
          )}
        </div>
      </div>
    );
};

export default WorkoutDetailScreen;