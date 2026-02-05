
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, StudioConfig, UserRole, BankExercise, WorkoutLogType, Organization, BenchmarkDefinition } from '../types';
import { TimerSetupModal } from './TimerSetupModal';
import { getExerciseBank, getOrganizationExerciseBank, deleteImageByUrl, saveAdminActivity, updateOrganizationBenchmarks } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';
import { parseSettingsFromTitle } from '../hooks/useWorkoutTimer';
import { EditableField } from './workout-builder/EditableField';
import { ExerciseBankPanel, ExercisePreviewModal } from './workout-builder/ExerciseBankPanel';
import { AICoachSidebar } from './workout-builder/AICoachPanel';
import { EditableBlockCard } from './workout-builder/EditableBlockCard';
import { analyzeCurrentWorkout } from '../services/geminiService';
import { ToggleSwitch, DumbbellIcon, SparklesIcon, TrophyIcon, CheckIcon } from './icons';

const createNewWorkout = (): Workout => ({
  id: `workout-${Date.now()}`,
  title: 'Nytt Träningspass',
  coachTips: '',
  blocks: [],
  category: 'Ej kategoriserad',
  isPublished: false,
  showDetailsToMember: true,
  logType: 'detailed',
  createdAt: Date.now(),
  organizationId: '' // Placeholder
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
    direction: 'down'
  },
  exercises: [],
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
                    <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-50 text-white font-bold py-3 rounded-lg transition-colors">Ja, ta bort</button>
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
  organization?: Organization; // Needed for benchmarks
}

export const WorkoutBuilderScreen: React.FC<WorkoutBuilderScreenProps> = ({ initialWorkout, onSave, onCancel, focusedBlockId: initialFocusedBlockId, studioConfig, sessionRole, isNewDraft = false, organization }) => {
  const { selectedOrganization } = useStudio();
  const { userData } = useAuth();
  const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [exerciseBank, setExerciseBank] = useState<BankExercise[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(true);
  const [previewExercise, setPreviewExercise] = useState<BankExercise | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'bank' | 'ai'>('bank');

  // Benchmark logic
  const org = organization || selectedOrganization;
  const existingBenchmarks = org?.benchmarkDefinitions || [];
  const [isBenchmark, setIsBenchmark] = useState(!!initialWorkout?.benchmarkId);
  const [matchedBenchmark, setMatchedBenchmark] = useState<BenchmarkDefinition | null>(null);
  const [newBenchmarkType, setNewBenchmarkType] = useState<'time' | 'reps' | 'weight'>('time');

  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const snapshot = JSON.stringify(initialWorkout || createNewWorkout());
    setInitialSnapshot(snapshot);
    setWorkout(JSON.parse(snapshot));
    setIsBenchmark(!!(initialWorkout?.benchmarkId));
  }, [initialWorkout]);
  
  // Smart Benchmark Matching & Sync
  useEffect(() => {
      if (!isBenchmark) {
          setMatchedBenchmark(null);
          return;
      }

      // Check if workout title matches an existing benchmark name
      const match = existingBenchmarks.find(b => b.title.trim().toLowerCase() === workout.title.trim().toLowerCase());
      if (match) {
          setMatchedBenchmark(match);
          // Synka dropdown med existerande typ
          setNewBenchmarkType(match.type);
      } else {
          setMatchedBenchmark(null);
      }
  }, [workout.title, isBenchmark, existingBenchmarks]);

  useEffect(() => {
    const fetchBank = async () => {
        if (!selectedOrganization) return;
        setIsBankLoading(true);
        try {
            const bank = await getOrganizationExerciseBank(selectedOrganization.id);
            setExerciseBank(bank);
        } catch (error) {
            console.error("Failed to fetch exercise bank:", error);
        } finally {
            setIsBankLoading(false);
        }
    };
    fetchBank();
  }, [selectedOrganization]);

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

  const handleSave = async () => {
    const finalWorkout = { ...workout };

    if (isBenchmark) {
        if (matchedBenchmark) {
            // Koppla till befintligt
            finalWorkout.benchmarkId = matchedBenchmark.id;
            
            // Uppdatera typen om användaren ändrat den i dropdownen
            if (matchedBenchmark.type !== newBenchmarkType && org) {
                const updatedDefinitions = existingBenchmarks.map(b => 
                    b.id === matchedBenchmark.id 
                    ? { ...b, type: newBenchmarkType } 
                    : b
                );
                await updateOrganizationBenchmarks(org.id, updatedDefinitions);
            }

        } else if (org) {
            // Skapa nytt benchmark
            const newDefinition: BenchmarkDefinition = {
                id: `bm_${Date.now()}`,
                title: finalWorkout.title,
                type: newBenchmarkType
            };
            
            // Uppdatera organisationens lista
            const updatedDefinitions = [...existingBenchmarks, newDefinition];
            await updateOrganizationBenchmarks(org.id, updatedDefinitions);
            
            // Koppla workout till nya IDt
            finalWorkout.benchmarkId = newDefinition.id;
        }
    } else {
        // Om användaren avmarkerat benchmark
        finalWorkout.benchmarkId = undefined;
    }

    // LOG ACTIVITY
    if (selectedOrganization && userData) {
        saveAdminActivity({
            organizationId: selectedOrganization.id,
            userId: userData.uid,
            userName: userData.firstName || 'Coach',
            type: 'WORKOUT',
            action: initialWorkout ? 'UPDATE' : 'CREATE',
            description: `${initialWorkout ? 'Uppdaterade' : 'Skapade'} passet "${finalWorkout.title}"`,
            timestamp: Date.now()
        });
    }
    onSave(finalWorkout);
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
  
  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    setWorkout(prev => {
        const newBlocks = [...prev.blocks];
        const index = newBlocks.findIndex(b => b.id === blockId);
        if (index === -1) return prev;
        
        if (direction === 'up' && index > 0) {
            [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
        } else if (direction === 'down' && index < newBlocks.length - 1) {
            [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
        }
        
        return { ...prev, blocks: newBlocks };
    });
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
  
  const handleAddExerciseFromBank = (bankExercise: BankExercise) => {
    const targetBlock = isSingleBlockMode 
        ? workout.blocks.find(b => b.id === initialFocusedBlockId)
        : workout.blocks[workout.blocks.length - 1];

    if (!targetBlock) {
        alert("Skapa ett block först för att lägga till en övning.");
        return;
    }

    const newExercise: Exercise = {
        id: bankExercise.id,
        name: bankExercise.name,
        description: bankExercise.description || '',
        imageUrl: bankExercise.imageUrl || '',
        reps: '', 
        isFromBank: true,
    };

    setWorkout(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => 
            b.id === targetBlock.id
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
          setActiveSidebarTab('ai'); // Switch tab to show results
      } catch (error) {
          console.error("Failed to analyze workout:", error);
          alert("Kunde inte analysera passet. Försök igen senare.");
      }
  };

  return (
    <>
      <div className="w-full max-w-[1800px] mx-auto">
        <div className="flex flex-col xl:flex-row gap-6 items-start">
          
          {/* COLUMN 1: MAIN EDITOR (70%) */}
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
                  
                  {sessionRole !== 'member' && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Inställningar för medlemmar</h4>
                            <div className="space-y-3">
                                <ToggleSwitch 
                                    label="Visa övningsdetaljer" 
                                    checked={workout.showDetailsToMember !== false} 
                                    onChange={val => handleUpdateWorkoutDetail('showDetailsToMember', val)}
                                />
                                
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ToggleSwitch 
                                            label="Detta är ett Benchmark" 
                                            checked={isBenchmark} 
                                            onChange={setIsBenchmark} 
                                        />
                                        <TrophyIcon className={`w-4 h-4 ${isBenchmark ? 'text-yellow-500' : 'text-gray-400'}`} />
                                    </div>
                                    
                                    {isBenchmark && (
                                        <div className="ml-0 pl-4 border-l-2 border-primary/20 animate-fade-in mt-3">
                                            <div className="flex flex-col gap-3">
                                                {matchedBenchmark ? (
                                                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                                                        <CheckIcon className="w-4 h-4" />
                                                        <span>Kopplat till <strong>{matchedBenchmark.title}</strong></span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500">Nytt benchmark skapas: <strong>{workout.title}</strong></p>
                                                )}
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Mätvärde:</span>
                                                    <select 
                                                        value={newBenchmarkType}
                                                        onChange={(e) => setNewBenchmarkType(e.target.value as any)}
                                                        className="bg-gray-100 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                                                    >
                                                        <option value="time">Tid</option>
                                                        <option value="reps">Varv</option>
                                                        <option value="weight">Vikt</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                  )}
              </div>
            )}
            
            <div className="space-y-6">
              {blocksToDisplay.map((block, index) => {
                  return (
                    <div key={block.id} ref={el => { editorRefs.current[`block-${block.id}`] = el; }}>
                        <EditableBlockCard 
                          block={block}
                          index={index}
                          totalBlocks={workout.blocks.length}
                          onUpdate={updatedBlock => handleUpdateBlock(block.id, updatedBlock)}
                          onRemove={() => handleRemoveBlock(block.id)}
                          onEditSettings={() => setEditingBlockId(block.id)}
                          isDraggable={!isSingleBlockMode}
                          workoutTitle={workout.title}
                          workoutBlocksCount={workout.blocks.length}
                          editorRefs={editorRefs}
                          exerciseBank={exerciseBank}
                          organizationId={selectedOrganization?.id || ''}
                          onMoveExercise={(idx, direction) => handleMoveExercise(block.id, idx, direction)}
                          onMoveBlock={(direction) => handleMoveBlock(block.id, direction)}
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
            <div className="w-full xl:w-96 flex-shrink-0 flex flex-col gap-4 sticky top-8 h-[calc(100vh-4rem)]">
                {/* Tab Switcher */}
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <button 
                        onClick={() => setActiveSidebarTab('bank')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeSidebarTab === 'bank' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <DumbbellIcon className="w-4 h-4" />
                        Övningsbank
                    </button>
                    <button 
                        onClick={() => setActiveSidebarTab('ai')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeSidebarTab === 'ai' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <SparklesIcon className="w-4 h-4" />
                        AI-Coach
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto scrollbar-hide rounded-xl">
                    {activeSidebarTab === 'bank' && studioConfig.enableExerciseBank && (
                        <ExerciseBankPanel 
                            bank={exerciseBank}
                            onAddExercise={handleAddExerciseFromBank}
                            onPreviewExercise={setPreviewExercise}
                            isLoading={isBankLoading}
                        />
                    )}
                    {activeSidebarTab === 'ai' && (
                        <AICoachSidebar workout={workout} onAnalyze={handleAnalyzeWorkout} />
                    )}
                </div>
            </div>
          )}
        </div>
        
        <div className="mt-8 flex justify-end gap-4 pb-12 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-white font-bold py-3 px-8 rounded-xl transition-colors">Avbryt</button>
            <button onClick={handleSave} className="bg-primary hover:brightness-110 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg" disabled={!isDirty}>
              Spara Pass
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
            isLastBlock={workout.blocks[workout.blocks.length - 1]?.id === editingBlockId}
        />
      )}

      {previewExercise && (
        <ExercisePreviewModal
            exercise={previewExercise}
            onClose={() => setPreviewExercise(null)}
            onAdd={handleAddExerciseFromBank}
        />
       )}
    </>
  );
};
