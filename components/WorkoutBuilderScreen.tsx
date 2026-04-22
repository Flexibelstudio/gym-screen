
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, StudioConfig, UserRole, BankExercise, Organization, BenchmarkDefinition } from '../types';
import { TimerSetupModal } from './TimerSetupModal';
import { getExerciseBank, getOrganizationExerciseBank, deleteImageByUrl, saveAdminActivity, updateOrganizationBenchmarks, deleteExerciseFromBank } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';
import { parseSettingsFromTitle } from '../hooks/useWorkoutTimer';
import { EditableField } from './workout-builder/EditableField';
import { ExerciseBankPanel, ExercisePreviewModal } from './workout-builder/ExerciseBankPanel';
import { createPortal } from 'react-dom';
import { AICoachSidebar } from './workout-builder/AICoachPanel';
import { EditableBlockCard } from './workout-builder/EditableBlockCard';
import { analyzeCurrentWorkout } from '../services/geminiService';
import { ToggleSwitch, DumbbellIcon, SparklesIcon, TrophyIcon, CheckIcon, ChevronLeftIcon } from './icons';
import { Toast } from './ui/ToastNotification';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  CollisionDetection
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const createNewWorkout = (): Workout => ({
  id: `workout-${Date.now()}`,
  title: 'Nytt Träningspass',
  coachTips: '',
  blocks: [],
  category: 'Ej kategoriserad',
  isPublished: false,
  showDetailsToMember: true,
  createdAt: Date.now(),
  organizationId: '' // Placeholder
});

let lastPointerY = 0;

const customCollisionDetection: CollisionDetection = (args) => {
  if (args.pointerCoordinates) {
    lastPointerY = args.pointerCoordinates.y;
  }

  // First, check if the pointer is within any droppable containers
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    const intersectingIds = pointerCollisions.map(c => c.id);
    let intersectingContainers = args.droppableContainers.filter(c => intersectingIds.includes(c.id));
    
    // If we are over both a block and an exercise, prefer the exercise
    const hasExercise = intersectingContainers.some(c => c.id.toString().startsWith('exercise-'));
    if (hasExercise) {
      intersectingContainers = intersectingContainers.filter(c => c.id.toString().startsWith('exercise-'));
      return closestCenter({
        ...args,
        droppableContainers: intersectingContainers
      });
    }

    // If we are ONLY over a block (e.g., in the gap between exercises)
    const blockContainer = intersectingContainers.find(c => c.id.toString().startsWith('block-'));
    if (blockContainer) {
      const blockId = blockContainer.data.current?.blockId;
      if (blockId) {
        // Find all exercises in this block
        const exercisesInBlock = args.droppableContainers.filter(c => 
          c.id.toString().startsWith('exercise-') && 
          c.data.current?.blockId === blockId
        );
        
        if (exercisesInBlock.length > 0) {
          if (args.pointerCoordinates) {
            const pointerY = args.pointerCoordinates.y;
            let closest = exercisesInBlock[0];
            let minDistance = Infinity;
            
            for (const container of exercisesInBlock) {
              const rect = container.rect.current;
              if (rect) {
                const centerY = rect.top + rect.height / 2;
                const distance = Math.abs(centerY - pointerY);
                if (distance < minDistance) {
                  minDistance = distance;
                  closest = container;
                }
              }
            }
            
            return [{ id: closest.id, data: closest.data }] as any;
          }

          // Fallback if no pointer coordinates
          const closestExercise = closestCenter({
            ...args,
            droppableContainers: exercisesInBlock
          });
          
          if (closestExercise.length > 0) {
            return closestExercise;
          }
        }
      }
      
      // If no exercises in block, or closestCenter failed, return the block
      return [
        {
          id: blockContainer.id,
          data: blockContainer.data,
        }
      ] as any;
    }

    return closestCenter({
      ...args,
      droppableContainers: intersectingContainers
    });
  }

  // If the pointer is not over any droppable, return no collisions
  return [];
};

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

// Helper to sanitize workout (remove deleted bank links)
const sanitizeWorkoutWithBank = (currentWorkout: Workout, currentBank: BankExercise[]): Workout => {
    const bankIds = new Set(currentBank.map(b => b.id));
    let hasChanges = false;
    
    const newBlocks = currentWorkout.blocks.map(block => {
        const newExercises = block.exercises.map(ex => {
            if (ex.isFromBank && !bankIds.has(ex.id)) {
                hasChanges = true;
                // Downgrade to Ad-hoc: Generate new ID to break links to deleted bank items
                return { 
                    ...ex, 
                    id: `ex-orphaned-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    isFromBank: false, 
                    loggingEnabled: false 
                };
            }
            return ex;
        });
        
        return { ...block, exercises: newExercises };
    });

    if (!hasChanges) return currentWorkout;
    return { ...currentWorkout, blocks: newBlocks };
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
  isAdminView?: boolean;
  setCustomBackHandler?: (handler: (() => void) | null) => void;
}

export const WorkoutBuilderScreen: React.FC<WorkoutBuilderScreenProps> = ({ initialWorkout, onSave, onCancel, focusedBlockId: initialFocusedBlockId, studioConfig, sessionRole, isNewDraft = false, organization, isAdminView = false, setCustomBackHandler }) => {
  const { selectedOrganization } = useStudio();
  const { userData } = useAuth();
  const [workout, setWorkout] = useState<Workout>(() => initialWorkout ? JSON.parse(JSON.stringify(initialWorkout)) : createNewWorkout());
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [exerciseBank, setExerciseBank] = useState<BankExercise[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(true);
  const [previewExercise, setPreviewExercise] = useState<BankExercise | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'bank' | 'ai'>('ai');
  
  // Dnd-kit state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any>(null);

  // Scroll to top on mount
  useEffect(() => {
      const timer = setTimeout(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
          const adminContainer = document.getElementById('admin-scroll-container');
          if (adminContainer) {
              adminContainer.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
          }
      }, 10);
      return () => clearTimeout(timer);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before dragging starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveData(active.data.current);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // If dragging an exercise between blocks
    if (activeData?.type === 'exercise' && overData?.type === 'exercise') {
      const activeBlockId = workout.blocks.find(b => b.exercises.some(e => `exercise-${e.id}` === activeId))?.id;
      const overBlockId = workout.blocks.find(b => b.exercises.some(e => `exercise-${e.id}` === overId))?.id;

      if (activeBlockId && overBlockId && activeBlockId !== overBlockId) {
        setWorkout(prev => {
          const activeBlockIndex = prev.blocks.findIndex(b => b.id === activeBlockId);
          const overBlockIndex = prev.blocks.findIndex(b => b.id === overBlockId);
          
          const activeBlock = prev.blocks[activeBlockIndex];
          const overBlock = prev.blocks[overBlockIndex];

          const activeExerciseIndex = activeBlock.exercises.findIndex(e => `exercise-${e.id}` === activeId);
          const overExerciseIndex = overBlock.exercises.findIndex(e => `exercise-${e.id}` === overId);

          const activeExercise = activeBlock.exercises[activeExerciseIndex];

          const newBlocks = [...prev.blocks];
          
          // Remove from active block
          newBlocks[activeBlockIndex] = {
            ...activeBlock,
            exercises: activeBlock.exercises.filter((_, i) => i !== activeExerciseIndex)
          };

          // Add to over block
          const newOverExercises = [...overBlock.exercises];
          newOverExercises.splice(overExerciseIndex, 0, activeExercise);
          newBlocks[overBlockIndex] = {
            ...overBlock,
            exercises: newOverExercises
          };

          return { ...prev, blocks: newBlocks };
        });
      }
    }

    // If dragging an exercise over a block
    if (activeData?.type === 'exercise' && overData?.type === 'block') {
      const activeBlockId = workout.blocks.find(b => b.exercises.some(e => `exercise-${e.id}` === activeId))?.id;
      const overBlockId = overData.blockId;

      if (activeBlockId && overBlockId && activeBlockId !== overBlockId) {
        setWorkout(prev => {
            const activeBlockIndex = prev.blocks.findIndex(b => b.id === activeBlockId);
            const overBlockIndex = prev.blocks.findIndex(b => b.id === overBlockId);
            
            const activeBlock = prev.blocks[activeBlockIndex];
            const activeExerciseIndex = activeBlock.exercises.findIndex(e => `exercise-${e.id}` === activeId);
            const activeExercise = activeBlock.exercises[activeExerciseIndex];

            const newBlocks = [...prev.blocks];
            
            // Remove from active block
            newBlocks[activeBlockIndex] = {
              ...activeBlock,
              exercises: activeBlock.exercises.filter((_, i) => i !== activeExerciseIndex)
            };

            // Add to over block at the end
            newBlocks[overBlockIndex] = {
              ...prev.blocks[overBlockIndex],
              exercises: [...prev.blocks[overBlockIndex].exercises, activeExercise]
            };

            return { ...prev, blocks: newBlocks };
        });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveData(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle dropping new exercise from bank or AI chat
    if ((activeData?.type === 'bank-exercise' || activeData?.type === 'ai-suggestion') && overData) {
        const targetBlockId = overData.type === 'block' ? overData.blockId : workout.blocks.find(b => b.exercises.some(e => `exercise-${e.id}` === overId))?.id;
        
        if (targetBlockId) {
            const newExercise: Exercise = {
                id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: activeData.exercise.name,
                description: activeData.exercise.description || '',
                reps: '',
                isFromBank: activeData.exercise.isFromBank,
                loggingEnabled: activeData.exercise.loggingEnabled,
                imageUrl: activeData.exercise.imageUrl
            };

            setWorkout(prev => {
                const newBlocks = prev.blocks.map(block => {
                    if (block.id === targetBlockId) {
                        const newExercises = [...block.exercises];
                        if (overData.type === 'exercise') {
                            const overIndex = block.exercises.findIndex(e => `exercise-${e.id}` === overId);
                            
                            let insertIndex = overIndex;
                            const overRect = over.rect;
                            
                            if (overRect) {
                                const overCenterY = overRect.top + overRect.height / 2;
                                if (lastPointerY > overCenterY) {
                                    insertIndex = overIndex + 1;
                                }
                            }
                            
                            newExercises.splice(insertIndex, 0, newExercise);
                        } else {
                            newExercises.push(newExercise);
                        }
                        return { ...block, exercises: newExercises };
                    }
                    return block;
                });
                return { ...prev, blocks: newBlocks };
            });
        }
        return;
    }

    // Handle reordering or moving exercises between blocks
    if (activeData?.type === 'exercise' && activeId !== overId) {
        const sourceBlockId = workout.blocks.find(b => b.exercises.some(e => `exercise-${e.id}` === activeId))?.id;
        const targetBlockId = overData?.type === 'block' ? overData.blockId : workout.blocks.find(b => b.exercises.some(e => `exercise-${e.id}` === overId))?.id;
        
        if (sourceBlockId && targetBlockId) {
            setWorkout(prev => {
                const newBlocks = [...prev.blocks];
                const sourceBlockIndex = newBlocks.findIndex(b => b.id === sourceBlockId);
                const targetBlockIndex = newBlocks.findIndex(b => b.id === targetBlockId);
                
                if (sourceBlockIndex === -1 || targetBlockIndex === -1) return prev;
                
                const sourceBlock = { ...newBlocks[sourceBlockIndex], exercises: [...newBlocks[sourceBlockIndex].exercises] };
                const targetBlock = sourceBlockId === targetBlockId ? sourceBlock : { ...newBlocks[targetBlockIndex], exercises: [...newBlocks[targetBlockIndex].exercises] };
                
                const oldIndex = sourceBlock.exercises.findIndex(e => `exercise-${e.id}` === activeId);
                const [draggedExercise] = sourceBlock.exercises.splice(oldIndex, 1);
                
                let insertIndex = targetBlock.exercises.length;
                
                if (overData?.type === 'exercise') {
                    const overIndex = targetBlock.exercises.findIndex(e => `exercise-${e.id}` === overId);
                    insertIndex = overIndex;
                    
                    const overRect = over.rect;
                    
                    if (overRect) {
                        const overCenterY = overRect.top + overRect.height / 2;
                        
                        if (lastPointerY > overCenterY) {
                            insertIndex = overIndex + 1;
                        }
                    }
                }
                
                // If moving within the same block, adjust insertIndex because we removed the item at oldIndex
                if (sourceBlockId === targetBlockId && oldIndex < insertIndex) {
                    insertIndex -= 1;
                }
                
                targetBlock.exercises.splice(insertIndex, 0, draggedExercise);
                
                newBlocks[sourceBlockIndex] = sourceBlock;
                if (sourceBlockId !== targetBlockId) {
                    newBlocks[targetBlockIndex] = targetBlock;
                }
                
                return { ...prev, blocks: newBlocks };
            });
        }
    }
  };

  // Toast state
  const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

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
            
            // CLEANUP: Using shared logic
            setWorkout(prev => sanitizeWorkoutWithBank(prev, bank));

        } catch (error) {
            console.error("Failed to fetch exercise bank:", error);
        } finally {
            setIsBankLoading(false);
        }
    };
    fetchBank();
  }, [selectedOrganization]);

  const handleDeleteExerciseFromBank = useCallback(async (exercise: BankExercise) => {
      try {
          await deleteExerciseFromBank(exercise.id);
          // 1. Update bank state instantly
          const newBank = exerciseBank.filter(ex => ex.id !== exercise.id);
          setExerciseBank(newBank);
          
          // 2. Run cleanup on current workout instantly
          setWorkout(prev => sanitizeWorkoutWithBank(prev, newBank));
          
      } catch (error) {
          console.error("Failed to delete exercise:", error);
          alert("Kunde inte ta bort övningen.");
      }
  }, [exerciseBank]);

  const handleExerciseSavedToBank = useCallback((newExercise: BankExercise) => {
      setExerciseBank(prev => {
          // Check if already exists to avoid duplicates
          if (prev.some(ex => ex.id === newExercise.id)) return prev;
          return [...prev, newExercise].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
      });
  }, []);

  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

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


  const handleCancelRef = useRef(() => {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      if (setCustomBackHandler) setCustomBackHandler(null);
      onCancel();
    }
  });

  useEffect(() => {
    handleCancelRef.current = () => {
      if (isDirty) {
        setShowUnsavedWarning(true);
      } else {
        if (setCustomBackHandler) setCustomBackHandler(null);
        onCancel();
      }
    };
  }, [isDirty, onCancel, setCustomBackHandler]);

  const handleCancel = () => {
    handleCancelRef.current();
  };

  useEffect(() => {
    if (setCustomBackHandler) {
      setCustomBackHandler(() => handleCancelRef.current());
    }
    return () => {
      if (setCustomBackHandler) {
        setCustomBackHandler(null);
      }
    };
  }, [setCustomBackHandler]);

  const handleSave = async () => {
    if (!isDirty && !isNewDraft) {
      if (setCustomBackHandler) setCustomBackHandler(null);
      onCancel();
      return;
    }

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
    if (setCustomBackHandler) setCustomBackHandler(null);
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
        loggingEnabled: false // Default false för bankövningar
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

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Toast isVisible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
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
                  
                  {isAdminView && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                          <label className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1 block flex items-center gap-2">
                              <SparklesIcon className="w-4 h-4" /> AI Progressionsregel
                          </label>
                          <p className="text-sm text-purple-800/70 dark:text-purple-300/70 mb-3">
                              Skriv en instruktion till AI:n om hur passet ska utvecklas nästa gång. T.ex: "Öka vikten med 2.5kg på knäböjen", eller "Om man når 10 reps ska man höja".
                          </p>
                          <textarea
                              value={workout.aiProgressionPrompt || ''}
                              onChange={e => handleUpdateWorkoutDetail('aiProgressionPrompt', e.target.value)}
                              placeholder="Din instruktion till AI:n..."
                              className="w-full bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-md p-3 text-base text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                              rows={3}
                          />
                      </div>
                  )}
                  
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
                                    label="Visa på skärm" 
                                    checked={workout.showInStudio !== false} 
                                    onChange={(val) => handleUpdateWorkoutDetail('showInStudio', val)} 
                                />
                                <ToggleSwitch 
                                    label="Visa i medlemsapp" 
                                    checked={
                                        (studioConfig.customCategories.find(c => c.name === workout.category)?.isLocked) 
                                        ? false 
                                        : workout.showInApp !== false
                                    } 
                                    onChange={(val) => handleUpdateWorkoutDetail('showInApp', val)} 
                                    disabled={studioConfig.customCategories.find(c => c.name === workout.category)?.isLocked}
                                    description={studioConfig.customCategories.find(c => c.name === workout.category)?.isLocked ? "Låsta kategorier visas inte i appen." : undefined}
                                />
                                <ToggleSwitch 
                                    label="Använd Pre-game & Dagsform" 
                                    checked={workout.usePreGame !== false} 
                                    onChange={(val) => handleUpdateWorkoutDetail('usePreGame', val)} 
                                    description="Låter medlemmen svara på dagsform och få en peppande strategi innan passet startar. Om avstängd kommer medlemmen direkt in till passets loggningslista."
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
                          onExerciseSavedToBank={handleExerciseSavedToBank}
                          enableWorkoutLogging={studioConfig.enableWorkoutLogging}
                          onShowToast={(msg) => setToast({ message: msg, visible: true })}
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
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeSidebarTab === 'ai' ? 'bg-purple-100 dark:bg-purple-900/40 shadow-sm text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <SparklesIcon className="w-4 h-4" />
                        AI-Coach
                    </button>
                </div>

                <div className="flex-grow overflow-hidden flex flex-col rounded-xl">
                    {activeSidebarTab === 'bank' && studioConfig.enableExerciseBank && (
                        <ExerciseBankPanel 
                            bank={exerciseBank}
                            onPreviewExercise={setPreviewExercise}
                            onDeleteExercise={handleDeleteExerciseFromBank}
                            isLoading={isBankLoading}
                        />
                    )}
                    {activeSidebarTab === 'ai' && (
                        <AICoachSidebar 
                            workout={workout} 
                            onUpdateWorkout={setWorkout}
                            availableExercises={exerciseBank.map(e => e.name)}
                        />
                    )}
                </div>
            </div>
          )}
        </div>
        
        <div className="mt-8 flex justify-end gap-4 pb-12 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-white font-bold py-3 px-8 rounded-xl transition-colors">Avbryt</button>
            <button onClick={handleSave} className="bg-primary hover:brightness-110 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg">
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

      <DragOverlay zIndex={9999} dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeId && activeData?.type === 'exercise' ? (
          <div className="group p-3 rounded-lg flex items-start gap-3 transition-all border-l-4 relative z-[1000] bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 shadow-2xl opacity-90 m-0 box-border">
            <div className="flex flex-col gap-1 items-center justify-center self-center mr-2 cursor-grabbing text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="12" r="1" />
                    <circle cx="9" cy="5" r="1" />
                    <circle cx="9" cy="19" r="1" />
                    <circle cx="15" cy="12" r="1" />
                    <circle cx="15" cy="5" r="1" />
                    <circle cx="15" cy="19" r="1" />
                </svg>
            </div>
            <div className="flex-grow space-y-2">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <input type="text" value={activeData.exercise.reps || ''} readOnly placeholder="Antal" className="appearance-none !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 font-semibold w-20 sm:w-24" />
                    <div className="relative flex-grow min-w-[150px]">
                        <input type="text" value={activeData.exercise.name} readOnly placeholder="Sök eller skriv övningsnamn" className="appearance-none w-full !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 font-semibold pr-8" />
                    </div>
                </div>
                <div className="relative">
                    <textarea value={activeData.exercise.description || ''} readOnly placeholder="Beskrivning eller instruktioner" className="w-full !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm resize-none min-h-[60px]" />
                </div>
            </div>
          </div>
        ) : activeId && activeData?.type === 'bank-exercise' ? (
          <div className="bg-white dark:bg-gray-900/70 rounded-md p-2 flex items-center gap-3 relative group cursor-grabbing opacity-90 shadow-2xl border border-primary/50 m-0 box-border">
              <div className="flex-grow min-w-0 flex items-center gap-3">
                  <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{activeData.exercise.name}</p>
                          {(activeData.exercise.organizationId || activeData.exercise.id?.startsWith('custom_')) && (
                              <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 uppercase tracking-wide">
                                  Egen
                              </span>
                          )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activeData.exercise.description}</p>
                  </div>
              </div>
          </div>
        ) : activeId && activeData?.type === 'ai-suggestion' ? (
          <div className="w-full text-left bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-2 flex items-center justify-between cursor-grabbing opacity-90 shadow-2xl m-0 box-border">
              <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{activeData.exercise.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{activeData.exercise.description}</p>
              </div>
          </div>
        ) : null}
      </DragOverlay>

      {showUnsavedWarning && createPortal(
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Osparade ändringar</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                      Du har gjort ändringar i passet som inte är sparade. Är du säker på att du vill lämna utan att spara?
                  </p>
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setShowUnsavedWarning(false)}
                          className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                      >
                          Avbryt
                      </button>
                      <button 
                          onClick={() => {
                              setShowUnsavedWarning(false);
                              if (setCustomBackHandler) setCustomBackHandler(null);
                              setTimeout(() => onCancel(), 0);
                          }}
                          className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                      >
                          Lämna utan att spara
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </DndContext>
  );
};
