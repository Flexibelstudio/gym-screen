import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, StudioConfig, UserRole, BankExercise } from '../types';
import { ToggleSwitch } from './icons';
import { TimerSetupModal } from './TimerSetupModal';
import { getExerciseBank, deleteImageByUrl } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { parseSettingsFromTitle } from '../hooks/useWorkoutTimer';
import { EditableField } from './workout-builder/EditableField';
import { ExerciseImageOverrideModal } from './workout-builder/ExerciseImageOverrideModal';
import { WorkoutStructurePanel } from './workout-builder/WorkoutStructurePanel';
import { ExerciseBankPanel, ExercisePreviewModal } from './workout-builder/ExerciseBankPanel';
import { AICoachSidebar } from './workout-builder/AICoachPanel';
import { EditableBlockCard } from './workout-builder/EditableBlockCard';
import { analyzeCurrentWorkout } from '../services/geminiService';

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
  const { selectedOrganization } = useStudio();
  const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(initialFocusedBlockId || null);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [exerciseBank, setExerciseBank] = useState<BankExercise[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(true);
  const [previewExercise, setPreviewExercise] = useState<BankExercise | null>(null);
  const [exerciseToEditImage, setExerciseToEditImage] = useState<Exercise | BankExercise | null>(null);

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

  const handleMoveExercise = (blockId: string, exerciseIndex: number, direction: 'up' | 'down') => {
    setWorkout(prev => {
        const newBlocks = [...prev.blocks];
        const blockIndex = newBlocks.findIndex(b => b.id === blockId);
        if (blockIndex === -1) return prev;

        const block = { ...newBlocks[blockIndex] };
        const newExercises = [...block.exercises];

        if (direction === 'up' && exerciseIndex > 0) {
            [newExercises[exerciseIndex], newExercises[exerciseIndex - 1]] = [newExercises[exerciseIndex - 1], newExercises[exerciseIndex]];
        } else if (direction === 'down' && exerciseIndex < newExercises.length - 1) {
            [newExercises[exerciseIndex], newExercises[exerciseIndex + 1]] = [newExercises[exerciseIndex + 1], newExercises[exerciseIndex]];
        }

        block.exercises = newExercises;
        newBlocks[blockIndex] = block;
        return { ...prev, blocks: newBlocks };
    });
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

  const handleAnalyzeWorkout = async () => {
      try {
          const analyzedWorkout = await analyzeCurrentWorkout(workout);
          setWorkout(prev => ({
              ...prev,
              aiCoachSummary: analyzedWorkout.aiCoachSummary,
              blocks: prev.blocks.map((block, index) => {
                  const analyzedBlock = analyzedWorkout.blocks[index];
                  if (!analyzedBlock) return block;
                  return {
                      ...block,
                      aiCoachNotes: analyzedBlock.aiCoachNotes,
                      aiMagicPenSuggestions: analyzedBlock.aiMagicPenSuggestions
                  }
              })
          }));
      } catch (error) {
          console.error("Failed to analyze workout:", error);
          alert("Kunde inte analysera passet. Försök igen senare.");
      }
  };

  return (
    <>
      <div className="w-full max-w-[1800px] mx-auto">
        <div className="flex flex-col xl:flex-row gap-6 items-start">
          
          {/* COLUMN 1: MAIN EDITOR (WORKBENCH) */}
          <div className="flex-grow min-w-0 w-full space-y-6">
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
                          onMoveExercise={(index, direction) => handleMoveExercise(block.id, index, direction)}
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
            <>
                {/* COLUMN 2: STRUCTURE & BANK */}
                <div className="w-full xl:w-80 flex-shrink-0 space-y-6 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide">
                    <WorkoutStructurePanel 
                        workout={workout}
                        onBlockClick={(id) => scrollToRef(`block-${id}`)}
                        onExerciseClick={(id) => scrollToRef(`exercise-${id}`)}
                        dragItemRef={dragItem}
                        dragOverItemRef={dragOverItem}
                        onSort={handleSort}
                        focusedBlockId={focusedBlockId}
                    />
                    
                    {studioConfig.enableExerciseBank && (
                        <ExerciseBankPanel 
                            bank={exerciseBank}
                            onAddExercise={handleAddExerciseFromBank}
                            onPreviewExercise={setPreviewExercise}
                            isLoading={isBankLoading}
                        />
                    )}
                </div>

                {/* COLUMN 3: AI COACH */}
                <div className="w-full xl:w-80 flex-shrink-0 space-y-6 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide">
                    <AICoachSidebar workout={workout} onAnalyze={handleAnalyzeWorkout} />
                </div>
            </>
          )}
        </div>
        <div className="mt-8 flex justify-end gap-4 pb-12">
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