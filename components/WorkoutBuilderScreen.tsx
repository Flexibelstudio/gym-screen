
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, WorkoutCategory, StudioConfig } from '../types';
import { ToggleSwitch } from './icons';
import { TimerSetupModal } from './TimerSetupModal';

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
  followMe: true,
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

interface WorkoutBuilderScreenProps {
  initialWorkout: Workout | null;
  onSave: (workout: Workout) => void;
  onCancel: () => void;
  focusedBlockId?: string | null;
  studioConfig: StudioConfig;
}

export const WorkoutBuilderScreen: React.FC<WorkoutBuilderScreenProps> = ({ initialWorkout, onSave, onCancel, focusedBlockId, studioConfig }) => {
  const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Drag & Drop state
  const dragItem = useRef<{ type: 'block' | 'exercise', blockId?: string, index: number } | null>(null);
  const dragOverItem = useRef<{ type: 'block' | 'exercise', blockId?: string, index: number } | null>(null);
  
  useEffect(() => {
    // Deep copy for a reliable snapshot
    const snapshot = JSON.stringify(initialWorkout || createNewWorkout());
    setInitialSnapshot(snapshot);
    setWorkout(JSON.parse(snapshot));
  }, [initialWorkout]);

  const isDirty = useMemo(() => JSON.stringify(workout) !== initialSnapshot, [workout, initialSnapshot]);

  useUnsavedChanges(isDirty);
  
  const isSingleBlockMode = useMemo(() => !!focusedBlockId, [focusedBlockId]);
  
  const blocksToDisplay = useMemo(() => {
    if (!workout) return [];
    if (isSingleBlockMode) {
      return workout.blocks.filter(b => b.id === focusedBlockId);
    }
    return workout.blocks;
  }, [workout, isSingleBlockMode, focusedBlockId]);


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
    // Exercises are now permanently removed from the state during editing, so no need to filter here.
    onSave(workout);
  };
  
  const handleUpdateWorkoutDetail = (field: keyof Workout, value: any) => {
    setWorkout(prev => ({ ...prev, [field]: value }));
  };

  const handleAddBlock = () => {
    setWorkout(prev => ({ ...prev, blocks: [...prev.blocks, createNewBlock()] }));
  };

  const handleRemoveBlock = (blockId: string) => {
    if (window.confirm('Är du säker på att du vill ta bort detta block?')) {
      setWorkout(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== blockId) }));
    }
  };

  const handleUpdateBlock = (blockId: string, updatedBlock: WorkoutBlock) => {
    setWorkout(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === blockId ? updatedBlock : b)
    }));
  };
  
  const handleSort = () => {
      if (!dragItem.current || !dragOverItem.current || dragItem.current.type !== dragOverItem.current.type) {
          return;
      }
      // Block sorting
      if (dragItem.current.type === 'block') {
          setWorkout(prev => {
              const newBlocks = [...prev.blocks];
              const [draggedItem] = newBlocks.splice(dragItem.current!.index, 1);
              newBlocks.splice(dragOverItem.current!.index, 0, draggedItem);
              return { ...prev, blocks: newBlocks };
          });
      }
      // Exercise sorting
      else if (dragItem.current.type === 'exercise' && dragItem.current.blockId === dragOverItem.current.blockId) {
          const blockId = dragItem.current.blockId;
          setWorkout(prev => ({
              ...prev,
              blocks: prev.blocks.map(b => {
                  if (b.id !== blockId) return b;
                  const newExercises = [...b.exercises];
                  const [draggedItem] = newExercises.splice(dragItem.current!.index, 1);
                  newExercises.splice(dragOverItem.current!.index, 0, draggedItem);
                  return { ...b, exercises: newExercises };
              })
          }));
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

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-24">
      {!isSingleBlockMode && (
        <div className="bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-700">
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
            
            <div className="pt-4 border-t border-gray-700 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Kategori</label>
                    <div className="flex flex-wrap gap-2">
                        {studioConfig.customCategories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => handleUpdateWorkoutDetail('category', cat.name)}
                                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${workout.category === cat.name ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                <ToggleSwitch
                    label="Publicera på startsidan"
                    checked={!!workout.isPublished}
                    onChange={(isChecked) => handleUpdateWorkoutDetail('isPublished', isChecked)}
                />
                 <p className="text-xs text-gray-500 mt-1 pl-2">
                    Om passet publiceras blir det synligt för medlemmar under vald kategori på hemskärmen.
                </p>
            </div>
        </div>
      )}
      
      <div className="space-y-6">
        {blocksToDisplay.map((block) => {
            const blockIndex = workout.blocks.findIndex(b => b.id === block.id);
            return (
              <EditableBlockCard 
                key={block.id}
                block={block}
                index={blockIndex}
                onUpdate={updatedBlock => handleUpdateBlock(block.id, updatedBlock)}
                onRemove={() => handleRemoveBlock(block.id)}
                onEditSettings={() => setEditingBlockId(block.id)}
                dragItemRef={dragItem}
                dragOverItemRef={dragOverItem}
                onSort={handleSort}
                isDraggable={!isSingleBlockMode}
                workoutTitle={workout.title}
              />
            )
        })}
      </div>

      {!isSingleBlockMode && (
        <button onClick={handleAddBlock} className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:bg-gray-800 transition">
            <span>Lägg till Block</span>
        </button>
      )}


      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 border-t border-gray-700 z-10">
        <div className="max-w-5xl mx-auto flex justify-end gap-4">
          <button onClick={handleCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors">Avbryt</button>
          <button onClick={handleSave} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors" disabled={!isDirty}>
            Spara
          </button>
        </div>
      </div>
      
      {editingBlockId && (
        <TimerSetupModal
            isOpen={!!editingBlockId}
            onClose={() => setEditingBlockId(null)}
            block={workout.blocks.find(b => b.id === editingBlockId)!}
            onSave={(newSettings) => handleUpdateBlockSettings(editingBlockId, newSettings)}
        />
      )}
    </div>
  );
};


interface EditableBlockCardProps {
    block: WorkoutBlock;
    index: number;
    onUpdate: (block: WorkoutBlock) => void;
    onRemove: () => void;
    onEditSettings: () => void;
    dragItemRef: React.MutableRefObject<any>;
    dragOverItemRef: React.MutableRefObject<any>;
    onSort: () => void;
    isDraggable: boolean;
    workoutTitle: string;
}
const EditableBlockCard: React.FC<EditableBlockCardProps> = ({ block, index, onUpdate, onRemove, onEditSettings, dragItemRef, dragOverItemRef, onSort, isDraggable, workoutTitle }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleFieldChange = (field: keyof WorkoutBlock, value: any) => {
        onUpdate({ ...block, [field]: value });
    };

    const handleExerciseChange = (exId: string, updatedExercise: Partial<Exercise>) => {
        onUpdate({
            ...block,
            exercises: block.exercises.map(ex => ex.id === exId ? { ...ex, ...updatedExercise } : ex)
        });
    };

    const handleRemoveExercise = (exId: string) => {
        onUpdate({
            ...block,
            exercises: block.exercises.filter(ex => ex.id !== exId)
        });
    };
    
    const handleAddExercise = () => {
      onUpdate({ ...block, exercises: [...block.exercises, createNewExercise()] });
    };
    
    const isFirstBlock = index === 0;
    const isTitleRedundant = isFirstBlock && block.title === workoutTitle;
    
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
            className={`bg-gray-800 rounded-lg p-6 shadow-md border transition-all ${isDraggingOver ? 'ring-2 ring-primary border-primary' : 'border-gray-700'}`}
            draggable={isDraggable}
            onDragStart={isDraggable ? () => (dragItemRef.current = { type: 'block', index }) : undefined}
            onDragEnter={isDraggable ? () => {
                if(dragItemRef.current?.type === 'block') {
                    dragOverItemRef.current = { type: 'block', index };
                    setIsDraggingOver(true);
                }
            } : undefined}
            onDragLeave={isDraggable ? () => setIsDraggingOver(false) : undefined}
            onDrop={isDraggable ? () => setIsDraggingOver(false) : undefined}
            onDragEnd={isDraggable ? onSort : undefined}
            onDragOver={isDraggable ? (e) => e.preventDefault() : undefined}
        >
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4 flex-grow min-h-[44px]">
                {isDraggable && (
                  <div className="text-gray-400 hover:text-gray-200 cursor-grab py-2" title="Dra för att flytta blocket">
                      ...
                  </div>
                )}
                {!isTitleRedundant && (
                    <EditableField 
                        label="Blockets Titel" 
                        value={block.title} 
                        onChange={val => handleFieldChange('title', val)}
                        isTitle
                    />
                )}
              </div>
              <button onClick={onRemove} className="text-red-500 hover:text-red-400 ml-4 flex-shrink-0 font-semibold">Ta bort</button>
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

          <div className="bg-black p-3 my-4 rounded-md flex justify-between items-center text-sm">
            <p className="text-gray-300">
              Inställningar: <span className="font-semibold text-white">{settingsText}</span>
            </p>
            <button onClick={onEditSettings} className="text-primary hover:underline font-semibold">Anpassa</button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">Välj blockets primära tagg</label>
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
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    >
                    {tag}
                    </button>
                );
                })}
            </div>
          </div>


          <div className="border-t border-gray-700 pt-4">
              <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-white mb-2">
                  <span>Övningar ({block.exercises.length})</span>
                  <span>{isExpanded ? 'Dölj' : 'Visa'}</span>
              </button>
              {isExpanded && (
                  <div className="space-y-3">
                      {block.exercises.map((ex, exIndex) => (
                          <EditableExerciseItem 
                              key={ex.id}
                              exercise={ex}
                              index={exIndex}
                              onChange={updatedEx => handleExerciseChange(ex.id, updatedEx)}
                              onRemove={() => handleRemoveExercise(ex.id)}
                              dragItemRef={dragItemRef}
                              dragOverItemRef={dragOverItemRef}
                              onSort={onSort}
                              blockId={block.id}
                          />
                      ))}
                       <button onClick={handleAddExercise} className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-2 border-2 border-dashed border-gray-600 rounded-lg text-sm text-gray-400 hover:bg-gray-700 transition">
                          <span>Lägg till Övning</span>
                      </button>
                  </div>
              )}
          </div>
        </div>
    );
};


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
    <div className="space-y-2 pt-2 border-t border-gray-600">
        <label className="text-xs text-gray-400 font-medium">ÖVNINGSBILD</label>
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
                className="w-full bg-gray-700 text-white text-sm p-2 rounded-md border border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <div className="text-center text-gray-500 text-xs">ELLER</div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center p-4 h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/20' : 'border-gray-600 hover:border-primary hover:bg-gray-700/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
                accept="image/*"
                className="hidden"
              />
              <div className="text-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <p className="font-semibold mt-1 text-sm">Dra och släpp en bild</p>
                <p className="text-xs">eller klicka för att välja fil</p>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};


interface EditableExerciseItemProps {
    exercise: Exercise;
    index: number;
    blockId: string;
    onChange: (updatedExercise: Partial<Exercise>) => void;
    onRemove: () => void;
    dragItemRef: React.MutableRefObject<any>;
    dragOverItemRef: React.MutableRefObject<any>;
    onSort: () => void;
}

const EditableExerciseItem: React.FC<EditableExerciseItemProps> = ({ exercise, index, blockId, onChange, onRemove, dragItemRef, dragOverItemRef, onSort }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const baseClasses = "w-full bg-transparent focus:outline-none disabled:bg-transparent";
    const textClasses = "text-white";

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        dragItemRef.current = { type: 'exercise', index, blockId };
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (dragItemRef.current?.type === 'exercise' && dragItemRef.current?.blockId === blockId) {
            dragOverItemRef.current = { type: 'exercise', index, blockId };
            setIsDraggingOver(true);
        }
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onSort();
    };

    return (
        <div 
          className={`group p-3 rounded-lg flex items-start gap-2 transition-all ${isDraggingOver ? 'bg-primary/20' : 'bg-gray-700/50'}`}
          draggable
          onDragStart={handleDragStart}
          onDragEnter={handleDragEnter}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={() => setIsDraggingOver(false)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            <div className="text-gray-400 hover:text-gray-200 cursor-grab pt-1 px-2" title="Dra för att flytta övningen">
                ...
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
                        onChange={e => onChange({ name: e.target.value })}
                        placeholder="Övningsnamn"
                        className={`${baseClasses} ${textClasses} font-semibold`}
                    />
                    <button onClick={onRemove} className="flex-shrink-0 text-red-500 hover:text-red-400 transition-colors text-sm font-medium" title="Ta bort övning">ta bort</button>
                </div>
                <textarea
                  value={exercise.description || ''}
                  onChange={e => onChange({ description: e.target.value })}
                  placeholder="Beskrivning (frivilligt)"
                  className={`${baseClasses} ${textClasses} text-sm bg-gray-700 p-2 rounded-md border border-gray-600 focus:ring-1 focus:ring-primary h-16`}
                  rows={2}
                />
                 <ExerciseImageUploader
                    imageUrl={exercise.imageUrl || null}
                    onImageChange={url => onChange({ imageUrl: url })}
                />
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
    const textStyle = isTitle ? "text-3xl font-bold text-white" : "text-base text-gray-300";
    const wrapperClasses = isTitle ? "" : "bg-gray-700 p-3 rounded-lg border border-gray-600 focus-within:ring-2 focus-within:ring-primary";
    
    const InputComponent = isTextarea ? 'textarea' : 'input';

    return (
        <div className={wrapperClasses}>
            <label className="text-sm font-medium text-gray-400 hidden">{label}</label>
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