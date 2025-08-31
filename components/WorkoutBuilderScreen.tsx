

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, Passkategori, StudioConfig, UserRole } from '../types';
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
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">Passets Struktur</h3>
                <div className="space-y-2">
                    {workout.blocks.map((block, blockIndex) => {
                        const isCollapsed = collapsedBlocks[block.id];
                        return (
                            <div 
                                key={block.id}
                                className={`bg-gray-900/70 rounded-md p-2 transition-all border ${focusedBlockId === block.id ? 'border-primary' : 'border-transparent'}`}
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
                                    <span className="text-gray-500 hover:text-white">☰</span>
                                    <div className="flex-grow" onClick={() => onBlockClick(block.id)}>
                                        <p className="font-semibold text-white truncate">{block.title || 'Namnlöst block'}</p>
                                        <p className="text-xs text-gray-400">{block.exercises.length} övning(ar)</p>
                                    </div>
                                    <button onClick={() => toggleCollapse(block.id)} className="p-1 text-gray-400 hover:text-white">
                                        {isCollapsed ? '▼' : '▲'}
                                    </button>
                                </div>
                                {!isCollapsed && (
                                    <div className="pl-6 pt-2 space-y-1">
                                        {block.exercises.map((ex, exIndex) => (
                                            <div 
                                                key={ex.id} 
                                                className="flex items-center gap-2 text-sm p-1 rounded hover:bg-gray-700 cursor-grab"
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
                                                <span className="text-gray-500 hover:text-white">☰</span>
                                                <p className="text-gray-300 flex-grow truncate" onClick={() => onExerciseClick(ex.id)}>{ex.name || 'Namnlös övning'}</p>
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
  const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(initialFocusedBlockId || null);

  const dragItem = useRef<{ type: 'block' | 'exercise', blockId?: string, index: number } | null>(null);
  const dragOverItem = useRef<{ type: 'block' | 'exercise', blockId?: string, index: number } | null>(null);
  
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const snapshot = JSON.stringify(initialWorkout || createNewWorkout());
    setInitialSnapshot(snapshot);
    setWorkout(JSON.parse(snapshot));
    setFocusedBlockId(initialFocusedBlockId || null);
  }, [initialWorkout, initialFocusedBlockId]);

  const isDirty = useMemo(() => {
    // If it's flagged as a new draft (from AI or duplicate), it's always considered "dirty" and saveable.
    if (isNewDraft && initialWorkout) {
        return true;
    }
    // Otherwise, compare the current state to the initial snapshot.
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
      if (!dragItem.current || !dragOverItem.current) return;

      const { type: dragType, index: dragIndex, blockId: dragBlockId } = dragItem.current;
      const { type: dropType, index: dropIndex, blockId: dropBlockId } = dragOverItem.current;

      // --- Reordering Blocks ---
      if (dragType === 'block' && dropType === 'block' && dragIndex !== dropIndex) {
          setWorkout(prev => {
              const newBlocks = [...prev.blocks];
              const [draggedItem] = newBlocks.splice(dragIndex, 1);
              newBlocks.splice(dropIndex, 0, draggedItem);
              return { ...prev, blocks: newBlocks };
          });
      }

      // --- Reordering Exercises ---
      if (dragType === 'exercise' && dropType === 'exercise' && dragBlockId && dropBlockId) {
          setWorkout(prev => {
              const newBlocks = JSON.parse(JSON.stringify(prev.blocks)); // Deep copy for mutation
              const sourceBlock = newBlocks.find((b: WorkoutBlock) => b.id === dragBlockId);
              const destBlock = newBlocks.find((b: WorkoutBlock) => b.id === dropBlockId);

              if (!sourceBlock || !destBlock) return prev;
              
              const [draggedItem] = sourceBlock.exercises.splice(dragIndex, 1);
              if (!draggedItem) return prev;

              if (sourceBlock.id === destBlock.id) {
                // Same block reorder
                destBlock.exercises.splice(dropIndex, 0, draggedItem);
              } else {
                // Move to different block
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
      const [type, id] = refId.split('-');
      if (type === 'block') {
          setFocusedBlockId(id);
      }
  };


  return (
    <>
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-24">
        {/* --- Left Pane: Main Editor --- */}
        <div className="lg:col-span-2 space-y-6">
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
                
                {sessionRole !== 'member' && (
                  <div className="pt-4 border-t border-gray-700 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">Passkategori</label>
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
                  </div>
                )}
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
                        isDraggable={!isSingleBlockMode}
                        workoutTitle={workout.title}
                        workoutBlocksCount={workout.blocks.length}
                        editorRefs={editorRefs}
                      />
                  </div>
                )
            })}
          </div>

          {!isSingleBlockMode && (
            <button onClick={handleAddBlock} className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:bg-gray-800 transition">
                <span>Lägg till Block</span>
            </button>
          )}
        </div>

        {/* --- Right Pane: Workout Structure --- */}
        {!isSingleBlockMode && (
           <div className="lg:col-span-1">
               <WorkoutStructurePanel 
                  workout={workout}
                  onBlockClick={(id) => scrollToRef(`block-${id}`)}
                  onExerciseClick={(id) => scrollToRef(`exercise-${id}`)}
                  dragItemRef={dragItem}
                  dragOverItemRef={dragOverItem}
                  onSort={handleSort}
                  focusedBlockId={focusedBlockId}
               />
           </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 border-t border-gray-700 z-10">
        <div className="max-w-7xl mx-auto flex justify-end gap-4">
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
    </>
  );
};


interface EditableBlockCardProps {
    block: WorkoutBlock;
    onUpdate: (block: WorkoutBlock) => void;
    onRemove: () => void;
    onEditSettings: () => void;
    isDraggable: boolean;
    workoutTitle: string;
    workoutBlocksCount: number;
    editorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}
const EditableBlockCard: React.FC<EditableBlockCardProps> = ({ block, onUpdate, onRemove, onEditSettings, isDraggable, workoutTitle, workoutBlocksCount, editorRefs }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleFieldChange = (field: keyof WorkoutBlock, value: any) => {
        onUpdate({ ...block, [field]: value });
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
      let newSettings = block.settings;
      if (block.settings.mode === TimerMode.Interval || block.settings.mode === TimerMode.Tabata) {
        newSettings = { ...block.settings, rounds: block.settings.rounds + 1 };
      }
      onUpdate({ ...block, exercises: newExercises, settings: newSettings });
      setTimeout(() => { // Scroll to new exercise after render
          editorRefs.current[`exercise-${newEx.id}`]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    };

    const handleRemoveExercise = (exId: string) => {
      const originalLength = block.exercises.length;
      const updatedExercises = block.exercises.filter(ex => ex.id !== exId);
      let newSettings = block.settings;
      if (updatedExercises.length < originalLength && (block.settings.mode === TimerMode.Interval || block.settings.mode === TimerMode.Tabata)) {
        newSettings = { ...block.settings, rounds: Math.max(0, block.settings.rounds - 1) };
      }
      onUpdate({
        ...block,
        exercises: updatedExercises,
        settings: newSettings
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
            className="bg-gray-800 rounded-lg p-6 shadow-md border border-gray-700"
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
                      {block.exercises.map((ex) => (
                          <div key={ex.id} ref={el => { editorRefs.current[`exercise-${ex.id}`] = el; }}>
                            <EditableExerciseItem 
                                exercise={ex}
                                onChange={updatedEx => handleExerciseChange(ex.id, updatedEx)}
                                onRemove={() => handleRemoveExercise(ex.id)}
                            />
                          </div>
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
    <div className="space-y-2">
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
    onChange: (updatedExercise: Partial<Exercise>) => void;
    onRemove: () => void;
}

const EditableExerciseItem: React.FC<EditableExerciseItemProps> = ({ exercise, onChange, onRemove }) => {
    const baseClasses = "w-full bg-transparent focus:outline-none disabled:bg-transparent";
    const textClasses = "text-white";
    const [imageUploaderVisible, setImageUploaderVisible] = useState(false);

    return (
        <div 
          className="group p-3 rounded-lg flex items-start gap-2 transition-all bg-gray-700/50"
        >
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
                 
                <div className="pt-2 border-t border-gray-600">
                    {imageUploaderVisible ? (
                        <div className="animate-fade-in">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-gray-400 font-medium">ÖVNINGSBILD</label>
                                <button onClick={() => setImageUploaderVisible(false)} className="text-xs font-semibold text-gray-400 hover:text-white">
                                    Dölj
                                </button>
                            </div>
                            <ExerciseImageUploader
                                imageUrl={exercise.imageUrl || null}
                                onImageChange={url => onChange({ imageUrl: url })}
                            />
                        </div>
                    ) : (
                        <button onClick={() => setImageUploaderVisible(true)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                            <span>{exercise.imageUrl ? 'Visa/ändra bild' : 'Lägg till bild'}</span>
                        </button>
                    )}
                </div>
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