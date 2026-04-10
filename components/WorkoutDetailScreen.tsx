import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Workout, WorkoutBlock, TimerMode, TimerSettings, Exercise, StudioConfig, WorkoutResult, WorkoutLog } from '../types';
import { TimerSetupModal } from './TimerSetupModal';
import { StarIcon, PencilIcon, DumbbellIcon, ToggleSwitch, SparklesIcon, CloseIcon, ClockIcon, UsersIcon, ChartBarIcon, TrophyIcon, EyeIcon } from './icons';
import { getWorkoutResults, getMemberLogs, updateStudioRemoteState } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { AnimatePresence, motion } from 'framer-motion';
import { WorkoutQRDisplay } from './WorkoutQRDisplay';
import { useAuth } from '../context/AuthContext';
import { useWorkout } from '../context/WorkoutContext';

// Helper to format time for results (00:00)
const formatResultTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Helper to get color based on workout tag
const getTagColor = (tag: string) => {
  switch (tag.toLowerCase()) {
    case 'styrka': return 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-200';
    case 'kondition': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';
    case 'rörlighet': return 'bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-200';
    case 'teknik': return 'bg-purple-100 text-purple-900 dark:bg-purple-900/50 dark:text-purple-200';
    case 'core': case 'bål': case 'core/bål': return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200';
    case 'balans': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200';
    case 'uppvärmning': return 'bg-orange-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

// Helper to format reps without automatically appending 'reps'
const formatReps = (reps: string | undefined): string => {
    if (!reps) return '';
    return reps.trim();
};

const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getSettingsText = (block: WorkoutBlock) => {
    if (!block.settings) return 'Inga inställningar';
    const { mode, workTime, restTime, rounds } = block.settings;
    switch(mode) {
        case TimerMode.Tabata:
            return `Tabata: ${rounds || 0} ronder (${formatTime(workTime || 0)} / ${formatTime(restTime || 0)})`;
        case TimerMode.Interval:
            const totalIntervals = rounds || 0;
            const laps = block.settings.specifiedLaps != null ? block.settings.specifiedLaps : null;
            const lapText = laps && laps > 1 ? ` (${laps} varv)` : '';
            return `Intervall: ${totalIntervals}x (${formatTime(workTime || 0)} / ${formatTime(restTime || 0)})${lapText}`;
        case TimerMode.AMRAP:
        case TimerMode.TimeCap:
            return `${mode}: ${formatTime(workTime || 0)} totalt`;
        case TimerMode.EMOM:
            return `EMOM: ${rounds || 0} min totalt`;
        case TimerMode.NoTimer:
            return 'Egen takt';
        default:
            return `${mode}: ${rounds || 0}x (${workTime || 0}s / ${restTime || 0}s)`;
    }
};

// --- COMPONENTS ---

export const WorkoutPresentationModal: React.FC<{ workout: Workout; onClose: () => void }> = ({ workout, onClose }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const timer = setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
            }
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-white dark:bg-gray-950 flex flex-col overflow-hidden"
        >
            <div className="flex justify-between items-center p-4 sm:p-6 lg:p-8 xl:p-12 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 xl:gap-8 flex-wrap min-w-0">
                    <h1 className="text-2xl sm:text-3xl lg:text-5xl xl:text-9xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight break-words">
                        {workout.title}
                    </h1>
                    <span className="text-[10px] sm:text-xs lg:text-sm xl:text-3xl font-bold bg-gray-200 dark:bg-gray-800 px-2.5 py-1 lg:px-4 lg:py-2 xl:px-8 xl:py-4 rounded-md text-gray-500 uppercase tracking-widest whitespace-nowrap">
                        Hela Passet
                    </span>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2.5 sm:p-3 lg:p-4 xl:p-6 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm active:scale-95 flex-shrink-0 ml-4"
                >
                    <CloseIcon className="w-6 h-6 lg:w-8 lg:h-8 xl:w-16 xl:h-16 text-gray-900 dark:text-white" />
                </button>
            </div>

            <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 sm:p-8 lg:p-12 xl:p-32 space-y-8 sm:space-y-12 lg:space-y-16 xl:space-y-32">
                <div className="max-w-4xl lg:max-w-6xl xl:max-w-screen-2xl mx-auto space-y-8 sm:space-y-12 lg:space-y-16 xl:space-y-32">
                    {workout.blocks?.map((block, bIndex) => {
                        if (!block) return null;
                        return (
                        <div key={block.id || `block-${bIndex}`} className="space-y-4 sm:space-y-5 lg:space-y-8 xl:space-y-16">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 lg:gap-6 xl:gap-12 border-b-2 border-gray-100 dark:border-gray-800 pb-3 lg:pb-6 xl:pb-12">
                                <div className="flex items-center gap-3 lg:gap-5 xl:gap-10 flex-wrap">
                                    <span className={`inline-flex items-center px-3 py-1 lg:px-4 lg:py-2 xl:px-8 xl:py-4 rounded-lg text-xs sm:text-sm lg:text-base xl:text-4xl font-black uppercase tracking-[0.1em] shadow-sm ${getTagColor(block.tag)}`}>
                                        {block.tag}
                                    </span>
                                    <h2 className="text-xl sm:text-2xl lg:text-4xl xl:text-8xl font-black text-gray-900 dark:text-white uppercase tracking-tight break-words">
                                        {block.title}
                                    </h2>
                                </div>
                                <div className="sm:ml-auto flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0 lg:gap-1 xl:gap-4">
                                    <span className="text-sm sm:text-base lg:text-xl xl:text-5xl font-mono font-bold text-gray-400">
                                        {block.settings.mode}
                                    </span>
                                    <span className="text-[10px] sm:text-xs lg:text-sm xl:text-3xl font-bold text-gray-500 uppercase tracking-widest break-words">
                                        {getSettingsText(block)}
                                    </span>
                                </div>
                            </div>

                            {block.setupDescription && (
                                <p className="text-sm sm:text-base lg:text-xl xl:text-5xl text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-3xl lg:max-w-4xl xl:max-w-7xl break-words">
                                    {block.setupDescription}
                                </p>
                            )}

                            <div className="flex flex-col">
                                {block.exercises?.map((ex, index) => {
                                    if (!ex) return null;
                                    const nextEx = block.exercises?.[index + 1];
                                    const prevEx = block.exercises?.[index - 1];
                                    const isGroupedWithNext = nextEx && ex.groupId && ex.groupId === nextEx.groupId;
                                    const isGroupedWithPrev = prevEx && ex.groupId && ex.groupId === prevEx.groupId;
                                    
                                    const roundedClass = isGroupedWithNext && !isGroupedWithPrev ? 'rounded-t-2xl rounded-b-sm' :
                                                         isGroupedWithPrev && !isGroupedWithNext ? 'rounded-b-2xl rounded-t-sm' :
                                                         isGroupedWithPrev && isGroupedWithNext ? 'rounded-sm' : 'rounded-2xl';
                                                         
                                    const borderClass = ex.groupColor ? `border border-r-gray-100 border-y-gray-100 dark:border-r-gray-800 dark:border-y-gray-800 border-l-[4px] xl:border-l-[12px] ${ex.groupColor.replace('bg-', 'border-l-')}` : 'border border-gray-100 dark:border-gray-800';
                                    const marginClass = isGroupedWithNext ? 'mb-1 xl:mb-3' : 'mb-3 lg:mb-4 xl:mb-10';

                                    return (
                                    <div key={ex.id || `ex-${index}`} className={`flex items-start gap-4 lg:gap-6 xl:gap-16 p-4 sm:p-5 lg:p-8 xl:p-16 ${roundedClass} bg-gray-50 dark:bg-gray-900 ${borderClass} ${marginClass}`}>
                                         <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-14 lg:h-14 xl:w-32 xl:h-32 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-sm sm:text-base lg:text-xl xl:text-5xl font-black text-gray-500">
                                            {index + 1}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4 lg:gap-6 xl:gap-12">
                                                <h3 className="text-lg sm:text-xl lg:text-3xl xl:text-7xl font-black text-gray-900 dark:text-white leading-tight break-words">
                                                    {ex.name || 'Okänd övning'}
                                                </h3>
                                                {ex.reps && (
                                                    <div className="bg-primary/10 text-primary px-3 py-1.5 lg:px-5 lg:py-2.5 xl:px-12 xl:py-6 rounded-lg whitespace-nowrap self-start sm:self-auto">
                                                        <span className="text-sm sm:text-base lg:text-2xl xl:text-6xl font-mono font-black">{formatReps(ex.reps)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {ex.description && (
                                                <p className="text-sm lg:text-lg xl:text-4xl text-gray-500 dark:text-gray-400 mt-1.5 lg:mt-3 xl:mt-8 leading-relaxed font-medium break-words">
                                                    {ex.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )})}
                                {block.exercises?.length === 0 && (
                                    <p className="text-sm lg:text-lg xl:text-2xl text-gray-400 italic pl-4 lg:pl-6 xl:pl-10">Inga övningar.</p>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            </div>
            
            <div className="p-6 lg:p-8 xl:p-16 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-center flex-shrink-0">
                 <button onClick={onClose} className="bg-black dark:bg-white text-white dark:text-black font-black text-xl lg:text-2xl xl:text-6xl py-4 px-12 lg:py-5 lg:px-16 xl:py-12 xl:px-32 rounded-full shadow-xl hover:scale-105 transition-transform uppercase tracking-widest">
                     Stäng visningsläge
                 </button>
            </div>
        </motion.div>
    );
};

const WorkoutBlockCard: React.FC<{
    block: WorkoutBlock;
    onStart: () => void;
    onEditSettings: () => void;
    onUpdateBlock: (block: WorkoutBlock) => void;
    isCoachView: boolean;
    organizationId: string;
}> = ({ block, onStart, onEditSettings, onUpdateBlock, isCoachView, organizationId }) => {
    
    const [exercisesVisible, setExercisesVisible] = useState(true);

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const settingsText = useMemo(() => {
        if (!block.settings) return 'Inga inställningar';
        const { mode, workTime, restTime, rounds } = block.settings;
        switch(mode) {
            case TimerMode.Tabata:
                return `Tabata: ${rounds || 0} ronder (${formatTime(workTime || 0)} / ${formatTime(restTime || 0)})`;
            case TimerMode.Interval:
                const totalIntervals = rounds || 0;
                const laps = block.settings.specifiedLaps != null ? block.settings.specifiedLaps : null;
                const lapText = laps && laps > 1 ? ` (${laps} varv)` : '';
                return `Intervall: ${totalIntervals}x (${formatTime(workTime || 0)} / ${formatTime(restTime || 0)})${lapText}`;
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                return `${mode}: ${formatTime(workTime || 0)} totalt`;
            case TimerMode.EMOM:
                return `EMOM: ${rounds || 0} min totalt`;
            case TimerMode.NoTimer:
                return 'Egen takt';
            default:
                return `${mode}: ${rounds || 0}x (${workTime || 0}s / ${restTime || 0}s)`;
        }
    }, [block.settings]);
  
    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden transition-all">
        <div className="p-5 sm:p-6 border-b border-gray-50 dark:border-gray-700/50">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-[0.1em] shadow-sm ${getTagColor(block.tag)}`}>
                            {block.tag}
                        </span>
                        {block.followMe && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-[0.1em] bg-indigo-50 text-indigo-600 border border-indigo-100">
                                <UsersIcon className="w-3.5 h-3.5" /> Följ mig
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight mb-2 break-words">{block.title}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium">
                        {block.setupDescription || "Arbeta dig igenom följande övningar..."}
                    </p>
                </div>
                
                <div className="flex-shrink-0 flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                    <button 
                        onClick={onStart} 
                        className="bg-primary hover:brightness-95 text-white font-black py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/30 transform active:scale-95 group w-full sm:w-auto"
                    >
                        <span className="text-lg uppercase tracking-tight">Starta</span>
                    </button>
                </div>
            </div>
        </div>
        
        <div className="bg-gray-50/50 dark:bg-black/20 px-5 py-3 flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.1em] text-[10px] flex-wrap">
            <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="break-words">Inställningar: {settingsText}</span>
          </div>
          {isCoachView && (
              <button onClick={onEditSettings} className="text-primary hover:underline font-black uppercase tracking-widest text-[10px] flex-shrink-0 ml-2">Anpassa klockan</button>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em]">{block.exercises?.length || 0} övningar</h4>
            <button onClick={() => setExercisesVisible(!exercisesVisible)} className="text-primary font-black uppercase tracking-widest text-[10px] hover:underline">
                {exercisesVisible ? 'Dölj övningar' : 'Visa övningar'}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {exercisesVisible && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col overflow-hidden">
                {block.exercises?.map((ex, index) => {
                    if (!ex) return null;
                    const nextEx = block.exercises?.[index + 1];
                    const prevEx = block.exercises?.[index - 1];
                    const isGroupedWithNext = nextEx && ex.groupId && ex.groupId === nextEx.groupId;
                    const isGroupedWithPrev = prevEx && ex.groupId && ex.groupId === prevEx.groupId;
                    
                    const roundedClass = isGroupedWithNext && !isGroupedWithPrev ? 'rounded-t-2xl rounded-b-sm' :
                                         isGroupedWithPrev && !isGroupedWithNext ? 'rounded-b-2xl rounded-t-sm' :
                                         isGroupedWithPrev && isGroupedWithNext ? 'rounded-sm' : 'rounded-2xl';
                                         
                    const borderClass = ex.groupColor ? `border border-r-gray-100 border-y-gray-100 dark:border-r-gray-800 dark:border-y-gray-800 border-l-[4px] ${ex.groupColor.replace('bg-', 'border-l-')}` : 'border border-gray-100 dark:border-gray-800';
                    const marginClass = isGroupedWithNext ? 'mb-1' : 'mb-3';

                    return (
                    <div key={ex.id || `ex-${index}`} className={`flex items-start gap-4 p-4 ${roundedClass} bg-gray-50 dark:bg-gray-900 ${borderClass} ${marginClass}`}>
                        <div className="flex-grow min-w-0">
                            <h4 className="text-lg font-black text-gray-900 dark:text-white leading-tight break-words">{ex.name || 'Okänd övning'}</h4>
                            {ex.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed font-medium break-words">{ex.description}</p>}
                        </div>
                        {ex.reps && (
                            <div className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 font-mono font-black text-primary text-sm flex-shrink-0 whitespace-nowrap">
                                {formatReps(ex.reps)}
                            </div>
                        )}
                    </div>
                )})}
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
};

const ResultsLeaderboard: React.FC<{
    results: WorkoutResult[];
    isLoading: boolean;
    personalBestName: string | null;
}> = ({ results, isLoading, personalBestName }) => {
    return (
        <div className="mt-8 bg-gray-50 dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700">
           <p className="text-gray-500">Topplista...</p>
        </div>
    );
};

// --- MAIN COMPONENT ---

interface WorkoutDetailScreenProps {
  workout: Workout;
  onStartBlock: (block: WorkoutBlock, workout: Workout) => void;
  onUpdateBlockSettings: (blockId: string, newSettings: Partial<WorkoutBlock['settings']>) => void;
  onEditWorkout: (workout: Workout, blockId?: string) => void;
  onAdjustWorkout?: (workout: Workout) => void;
  isCoachView: boolean;
  onTogglePublish: (workoutId: string, isPublished: boolean, silentPublish?: boolean) => void;
  onToggleFavorite: (workoutId: string) => void;
  onDuplicate: (workout: Workout) => void;
  onShowImage: (url: string) => void; 
  isPresentationMode: boolean;
  studioConfig: StudioConfig;
  onDelete?: (workoutId: string) => void;
  followMeShowImage: boolean;
  setFollowMeShowImage: (show: boolean) => void;
  onUpdateWorkout: (workout: Workout) => Promise<any> | void;
  onVisualize: (workout: Workout) => void;
  hasActiveCarousel?: boolean; 
  onLogWorkout?: (workoutId: string, orgId: string) => void;
  onClose?: () => void;
  onHeaderVisibilityChange?: (visible: boolean) => void;
}

const WorkoutDetailScreen: React.FC<WorkoutDetailScreenProps> = ({ 
    workout, onStartBlock, onUpdateBlockSettings, onEditWorkout, onAdjustWorkout,
    isCoachView, onTogglePublish, onToggleFavorite, onDuplicate, 
    onShowImage, isPresentationMode, studioConfig, onDelete,
    followMeShowImage, setFollowMeShowImage, onUpdateWorkout, onVisualize,
    hasActiveCarousel = false,
    onLogWorkout,
    onClose,
    onHeaderVisibilityChange
}) => {
  const { selectedOrganization, selectedStudio } = useStudio();
  const { isStudioMode, role, userData, currentUser } = useAuth();
  const { setActiveWorkout } = useWorkout();
  
  const [sessionWorkout, setSessionWorkout] = useState<Workout>(() => JSON.parse(JSON.stringify(workout)));
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [silentPublish, setSilentPublish] = useState(false);
  const [coachTipsVisible, setCoachTipsVisible] = useState(true);
  const [results, setResults] = useState<WorkoutResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [visualizingFullWorkout, setVisualizingFullWorkout] = useState(false); 
  
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const personalBestName = useMemo(() => localStorage.getItem('hyrox-participant-name'), []);
  const isHyroxRace = useMemo(() => workout.id.startsWith('hyrox-full-race') || workout.id.startsWith('custom-race'), [workout.id]);

  // Scroll to top on mount
  useEffect(() => {
      const timer = setTimeout(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      }, 10);
      return () => clearTimeout(timer);
  }, []);

  const isWorkoutLoggable = useMemo(() => {
      return workout.blocks?.some(b => b?.exercises?.some(e => e?.loggingEnabled === true)) || false;
  }, [workout]);

  useEffect(() => {
    setSessionWorkout(prev => {
      // Om passet är helt nytt, eller om innehållet faktiskt har ändrats från databasen
      // (App.tsx ser till att workout-propen bara ändras när JSON.stringify skiljer sig)
      // Vi vill dock inte skriva över om vi bara har lokala ändringar, men eftersom
      // App.tsx skickar in en ny workout när databasen uppdateras, måste vi ta in den.
      return JSON.parse(JSON.stringify(workout));
    });
  }, [workout]);

  useEffect(() => {
    if (isHyroxRace && selectedOrganization) {
        const fetchResults = () => {
            if (!resultsLoading) { 
                setResultsLoading(true);
                getWorkoutResults(workout.id, selectedOrganization.id)
                    .then(setResults)
                    .catch(console.error)
                    .finally(() => setResultsLoading(false));
            }
        };
        fetchResults();
        const intervalId = setInterval(fetchResults, 15000);
        return () => clearInterval(intervalId);
    }
  }, [workout.id, isHyroxRace, resultsLoading, selectedOrganization]);

  useEffect(() => {
      if (visualizingFullWorkout) {
          onHeaderVisibilityChange?.(false);
      } else {
          onHeaderVisibilityChange?.(true);
      }
      return () => onHeaderVisibilityChange?.(true);
  }, [visualizingFullWorkout, onHeaderVisibilityChange]);

  const handleDelete = () => {
      if (onDelete && window.confirm(`Är du säker på att du vill ta bort passet "${workout.title}"?`)) {
          onDelete(workout.id);
      }
  };

  const handleUpdateBlock = (updatedBlock: WorkoutBlock) => {
    setSessionWorkout(prevWorkout => {
      if (!prevWorkout) return null as any;
      return {
        ...prevWorkout,
        blocks: prevWorkout.blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b)
      };
    });
  };

  const handleUpdateSettings = (blockId: string, newSettings: Partial<TimerSettings> & { autoAdvance?: boolean; transitionTime?: number }) => {
      setSessionWorkout(prevWorkout => {
          if (!prevWorkout) return null as any;
          
          const newWorkout = JSON.parse(JSON.stringify(prevWorkout)) as Workout;
          
          const blockIndex = newWorkout.blocks.findIndex(b => b.id === blockId);
          if (blockIndex !== -1) {
              const { autoAdvance, transitionTime, ...settingsUpdates } = newSettings;
              
              if (autoAdvance !== undefined) newWorkout.blocks[blockIndex].autoAdvance = autoAdvance;
              if (transitionTime !== undefined) newWorkout.blocks[blockIndex].transitionTime = transitionTime;
              
              newWorkout.blocks[blockIndex].settings = { 
                  ...newWorkout.blocks[blockIndex].settings, 
                  ...settingsUpdates 
              };
          }
          
          return newWorkout;
      });
      
      setEditingBlockId(null);
  };
  
  if (!sessionWorkout || !selectedOrganization) {
    return null; 
  }

  const isLoggingEnabled = studioConfig.enableWorkoutLogging || false;
  const showSidebar = !isStudioMode; 
  const showQR = isLoggingEnabled && isWorkoutLoggable && !isPresentationMode;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-40 relative animate-fade-in">
      
      {showQR && (
        <WorkoutQRDisplay 
            workoutId={workout.id}
            organizationId={selectedOrganization.id}
            isEnabled={true}
            hasActiveCarousel={hasActiveCarousel}
        />
      )}

      {/* --- HEADER SECTION --- */}
      <div className="mb-8 text-center sm:text-left flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight tracking-tight break-words">
                    {sessionWorkout.title}
                </h1>
                
                {isCoachView && (
                    <button 
                        onClick={() => setVisualizingFullWorkout(true)}
                        className="p-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-300 shadow-sm flex-shrink-0"
                        title="Visa hela passet"
                    >
                        <EyeIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
            
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                {sessionWorkout.category && (
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-gray-200 dark:border-gray-700">
                        {sessionWorkout.category}
                    </span>
                )}
                {workout.benchmarkId && (
                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border border-yellow-200 dark:border-yellow-800">
                        BENCHMARK
                    </span>
                )}
            </div>
          </div>

          {isStudioMode && onAdjustWorkout && (
            <button 
                onClick={() => onAdjustWorkout(sessionWorkout)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-95 w-full sm:w-auto flex-shrink-0"
            >
                <PencilIcon className="w-5 h-5" />
                <span className="text-lg uppercase tracking-tight">Anpassa & Starta</span>
            </button>
          )}
      </div>

      {/* --- TIPS FRÅN COACHEN --- */}
      {typeof sessionWorkout.coachTips === 'string' && sessionWorkout.coachTips.trim().length > 0 && (
        <div className="bg-[#fff9f0] dark:bg-orange-900/10 border-l-[12px] border-orange-400 rounded-2xl p-8 mb-12 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-black text-orange-900 dark:text-orange-200 uppercase tracking-tight flex items-center gap-3">
                    <span className="text-3xl">📢</span> Tips från coachen
                </h3>
                {showSidebar && (
                    <button onClick={() => setCoachTipsVisible(!coachTipsVisible)} className="text-xs font-black uppercase text-gray-400 hover:text-orange-600">
                        {coachTipsVisible ? 'Dölj' : 'Visa'}
                    </button>
                )}
            </div>
            <AnimatePresence>
                {coachTipsVisible && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <p className="text-xl text-orange-900/80 dark:text-orange-100/80 leading-relaxed font-medium">
                            {sessionWorkout.coachTips}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      )}

      {/* --- MAIN GRID --- */}
      <div className={`grid grid-cols-1 ${showSidebar ? 'md:grid-cols-12' : ''} gap-10 items-start`}>
        
        <div className={`${showSidebar ? 'md:col-span-8' : 'w-full'} space-y-10`}>
            <div className="space-y-8">
                {sessionWorkout.blocks?.map((block, index) => {
                    if (!block) return null;
                    return (
                    <div key={block.id || `block-${index}`} ref={el => { blockRefs.current[block.id || `block-${index}`] = el }}>
                        <WorkoutBlockCard 
                            block={block} 
                            onStart={async () => {
                                setActiveWorkout(sessionWorkout);

                                if (selectedOrganization && selectedStudio) {
                                    updateStudioRemoteState(selectedOrganization.id, selectedStudio.id, {
                                        activeWorkoutId: sessionWorkout.id,
                                        activeBlockId: block.id,
                                        view: 'timer',
                                        status: 'preparing',
                                        // Vi skickar med hela den anpassade pass-datan i fjärr-statusen
                                        customWorkoutData: JSON.parse(JSON.stringify(sessionWorkout)),
                                        lastUpdate: Date.now()
                                    } as any);
                                }
                                
                                onStartBlock(block, sessionWorkout);
                            }} 
                            onEditSettings={() => setEditingBlockId(block.id)}
                            onUpdateBlock={handleUpdateBlock}
                            isCoachView={isCoachView}
                            organizationId={selectedOrganization?.id || ''}
                        />
                    </div>
                )})}
            </div>

            {isHyroxRace && (
                <ResultsLeaderboard 
                    results={results} 
                    isLoading={resultsLoading}
                    personalBestName={personalBestName} 
                />
            )}
        </div>

        {/* SIDEBAR - Kun för Admin */}
        {showSidebar && (
            <div className="md:col-span-4 space-y-6">
                <div className="sticky top-6 space-y-6 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2 text-left">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Administration</h3>
                        <div className="space-y-2">
                            <button onClick={() => onEditWorkout(workout)} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 hover:bg-primary/10 hover:text-primary transition-all font-bold">
                                <PencilIcon className="w-4 h-4" /> Redigera Pass
                            </button>
                            <button onClick={() => onTogglePublish(workout.id, !workout.isPublished, silentPublish)} className={`w-full flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all ${workout.isPublished ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                                {workout.isPublished ? 'Avpublicera' : 'Publicera'}
                            </button>
                            {!workout.isPublished && (
                                <label className="flex items-center gap-2 text-sm text-gray-500 mt-2 cursor-pointer px-2">
                                    <input 
                                        type="checkbox" 
                                        checked={silentPublish} 
                                        onChange={(e) => setSilentPublish(e.target.checked)}
                                        className="rounded text-primary focus:ring-primary"
                                    />
                                    Skicka ingen pushnotis
                                </label>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {editingBlockId && (
        <TimerSetupModal
          isOpen={!!editingBlockId}
          onClose={() => setEditingBlockId(null)}
          block={sessionWorkout.blocks.find(b => b.id === editingBlockId)!}
          onSave={(newSettings) => handleUpdateSettings(editingBlockId, newSettings)}
          isLastBlock={sessionWorkout.blocks[sessionWorkout.blocks.length - 1]?.id === editingBlockId}
        />
      )}
      
      <AnimatePresence>
          {visualizingFullWorkout && (
              <WorkoutPresentationModal
                  workout={sessionWorkout}
                  onClose={() => setVisualizingFullWorkout(false)}
              />
          )}
      </AnimatePresence>
    </div>
  );
};

export default WorkoutDetailScreen;