import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Workout, WorkoutBlock, TimerMode, TimerSettings, Exercise, Passkategori, StudioConfig, WorkoutResult, Organization, BankExercise } from '../types';
import { TimerSetupModal } from './TimerSetupModal';
import { StarIcon, PencilIcon, DumbbellIcon, ToggleSwitch, SparklesIcon, PencilIcon as DrawIcon, CloseIcon, ClockIcon, UsersIcon } from './icons';
import { getWorkoutResults } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { AnimatePresence, motion } from 'framer-motion';
import { WorkoutQRDisplay } from './WorkoutQRDisplay';
import { useAuth } from '../context/AuthContext';

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

// Helper to ensure units are displayed
const formatReps = (reps: string | undefined): string => {
    if (!reps) return '';
    const trimmed = reps.trim();
    if (!trimmed) return '';
    const isNumericLike = /^[\d\s\-\.,/]+$/.test(trimmed);
    if (isNumericLike) return `${trimmed} reps`;
    return trimmed;
};

// --- NEW COMPONENT: BLOCK PRESENTATION MODAL ---
const BlockPresentationModal: React.FC<{ block: WorkoutBlock; onClose: () => void }> = ({ block, onClose }) => {
    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-white dark:bg-gray-950 flex flex-col overflow-hidden"
        >
            {/* Header */}
            <div className="flex justify-between items-start p-8 md:p-12 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="max-w-4xl">
                    <div className="flex items-center gap-4 mb-4">
                         <span className={`inline-flex items-center px-4 py-2 rounded-xl text-lg font-black uppercase tracking-[0.1em] shadow-sm ${getTagColor(block.tag)}`}>
                            {block.tag}
                        </span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                        {block.title}
                    </h1>
                    {block.setupDescription && (
                        <p className="text-2xl md:text-3xl text-gray-500 dark:text-gray-400 mt-6 font-medium leading-relaxed max-w-5xl">
                            {block.setupDescription}
                        </p>
                    )}
                </div>
                <button 
                    onClick={onClose}
                    className="p-4 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-lg active:scale-95"
                >
                    <CloseIcon className="w-10 h-10 text-gray-900 dark:text-white" />
                </button>
            </div>

            {/* Content - Giant List */}
            <div className="flex-grow overflow-y-auto p-8 md:p-12">
                <div className="max-w-7xl mx-auto space-y-6">
                    {block.exercises.map((ex, index) => (
                        <div key={ex.id} className="flex items-start gap-8 p-8 rounded-[2rem] bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800">
                             <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-2xl md:text-3xl font-black text-gray-500">
                                {index + 1}
                            </div>
                            <div className="flex-grow">
                                <div className="flex justify-between items-start gap-8">
                                    <h3 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white leading-tight">
                                        {ex.name}
                                    </h3>
                                    {ex.reps && (
                                        <div className="bg-primary/10 text-primary px-6 py-3 rounded-2xl whitespace-nowrap">
                                            <span className="text-3xl md:text-5xl font-mono font-black">{formatReps(ex.reps)}</span>
                                        </div>
                                    )}
                                </div>
                                {ex.description && (
                                    <p className="text-2xl md:text-3xl text-gray-500 dark:text-gray-400 mt-4 leading-relaxed font-medium">
                                        {ex.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                    {block.exercises.length === 0 && (
                        <p className="text-center text-3xl text-gray-400 py-20 italic">Inga övningar i detta block.</p>
                    )}
                </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                 <button onClick={onClose} className="bg-black dark:bg-white text-white dark:text-black font-black text-xl py-4 px-12 rounded-full shadow-xl hover:scale-105 transition-transform uppercase tracking-widest">
                     Stäng visningsläge
                 </button>
            </div>
        </motion.div>
    );
};

// --- MEMBER VIEW COMPONENTS ---

const MemberExerciseRow: React.FC<{ exercise: Exercise }> = ({ exercise }) => (
    <div className="flex items-start py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <div className="w-20 sm:w-24 flex-shrink-0 pt-0.5">
            <span className="font-bold text-primary text-sm sm:text-base">{formatReps(exercise.reps) || '-'}</span>
        </div>
        <div className="flex-grow min-w-0">
            <p className="font-bold text-gray-900 dark:text-white text-base sm:text-lg leading-tight">{exercise.name}</p>
            {exercise.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 leading-relaxed">{exercise.description}</p>
            )}
        </div>
    </div>
);

const MemberBlockView: React.FC<{ block: WorkoutBlock }> = ({ block }) => (
    <div className="mb-8 last:mb-0">
        <div className="flex items-center gap-3 mb-4">
            <span className={`h-8 w-1 rounded-full ${getTagColor(block.tag).split(' ')[0]}`}></span>
            <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{block.title}</h3>
                {block.setupDescription && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{block.setupDescription}</p>
                )}
            </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
            {block.exercises.length > 0 ? (
                <div className="space-y-1">
                    {block.exercises.map(ex => (
                        <MemberExerciseRow key={ex.id} exercise={ex} />
                    ))}
                </div>
            ) : (
                <p className="text-gray-400 italic text-sm">Inga övningar i detta block.</p>
            )}
        </div>
    </div>
);

const MemberWorkoutView: React.FC<{ 
    workout: Workout, 
    onClose?: () => void, 
    onLog?: () => void,
    onAdjust?: () => void
}> = ({ workout, onClose, onLog, onAdjust }) => {
    return (
        <div className="pb-32 animate-fade-in">
            {/* Header Info */}
            <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-2">
                    {workout.title}
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-3">
                    {workout.category && (
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            {workout.category}
                        </span>
                    )}
                    <span className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">
                        {workout.blocks.length} delar
                    </span>
                </div>
            </div>

            {/* Coach Tips */}
            {workout.coachTips && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-6 rounded-2xl border border-yellow-100 dark:border-yellow-900/30 mb-10">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200 uppercase tracking-widest text-xs mb-2 flex items-center gap-2">
                        <span>💡</span> Coach Tips
                    </h3>
                    <p className="text-yellow-900 dark:text-yellow-100 text-base leading-relaxed font-medium">
                        {workout.coachTips}
                    </p>
                </div>
            )}

            {/* Blocks */}
            <div className="space-y-2">
                {workout.blocks.map(block => (
                    <MemberBlockView key={block.id} block={block} />
                ))}
            </div>

            {/* Floating Action Buttons */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-50 flex gap-3">
                {onClose && (
                    <button 
                    onClick={onClose}
                    className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-black py-4 rounded-[2rem] shadow-2xl transition-all transform active:scale-95 text-xs uppercase tracking-widest border border-gray-200 dark:border-gray-700"
                    >
                        Stäng
                    </button>
                )}
                {onAdjust && (
                    <button 
                    onClick={onAdjust}
                    className="flex-[1.5] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-black py-4 rounded-[2rem] shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-widest border border-indigo-200 dark:border-indigo-800"
                    >
                        <PencilIcon className="w-4 h-4" />
                        <span>Anpassa</span>
                    </button>
                )}
                {onLog && (
                    <button 
                    onClick={onLog}
                    className="flex-[2] bg-primary hover:brightness-110 text-white font-black py-4 rounded-[2rem] shadow-xl shadow-primary/40 transition-all transform active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                        <ChartBarIcon className="w-4 h-4" />
                        <span>Logga</span>
                    </button>
                )}
            </div>
        </div>
    );
};

// --- COACH VIEW SUB-COMPONENTS ---

const WorkoutBlockCard: React.FC<{
    block: WorkoutBlock;
    onStart: () => void;
    onVisualize: () => void;
    onEditSettings: () => void;
    onUpdateBlock: (block: WorkoutBlock) => void;
    isCoachView: boolean;
    organizationId: string;
}> = ({ block, onStart, onVisualize, onEditSettings, onUpdateBlock, isCoachView, organizationId }) => {
    const [exercisesVisible, setExercisesVisible] = useState(true);

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const settingsText = useMemo(() => {
        const { mode, workTime, restTime, rounds } = block.settings;
        switch(mode) {
            case TimerMode.Interval:
            case TimerMode.Tabata:
                const totalIntervals = rounds;
                const exercisesPerLap = block.exercises.length > 0 ? block.exercises.length : 1;
                const laps = block.settings.specifiedLaps || Math.ceil(totalIntervals / exercisesPerLap);
                const lapText = laps > 1 ? ` (${laps} varv)` : '';
                return `Intervall: ${totalIntervals}x (${formatTime(workTime)} / ${formatTime(restTime)})${lapText}`;
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                return `${mode}: ${formatTime(workTime)} totalt`;
            case TimerMode.EMOM:
                return `EMOM: ${rounds} min totalt`;
            case TimerMode.NoTimer:
                return 'Egen takt';
            default:
                return `${mode}: ${rounds}x (${workTime}s / ${restTime}s)`;
        }
    }, [block.settings, block.exercises.length]);
  
    return (
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all">
        <div className="p-8 sm:p-10 border-b border-gray-50 dark:border-gray-700/50">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6">
                <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-4">
                        <span className={`inline-flex items-center px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${getTagColor(block.tag)}`}>
                            {block.tag}
                        </span>
                        {block.followMe && (
                            <span className="inline-flex items-center gap-1 px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] bg-indigo-50 text-indigo-600 border border-indigo-100">
                                <UsersIcon className="w-3.5 h-3.5" /> Följ mig
                            </span>
                        )}
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none mb-4">{block.title}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed font-medium">
                        {block.setupDescription || "Arbeta dig igenom följande övningar..."}
                    </p>
                </div>
                
                <div className="flex-shrink-0 flex gap-3">
                    <button 
                        onClick={onVisualize}
                        className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-gray-200 dark:border-gray-600"
                        title="Visa i helskärm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="hidden sm:inline">Visa</span>
                    </button>
                    <button 
                        onClick={onStart} 
                        className="bg-primary hover:brightness-95 text-white font-black py-5 px-10 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/30 transform active:scale-95 group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 transition-transform group-hover:scale-110" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xl uppercase tracking-tight">Starta</span>
                    </button>
                </div>
            </div>
        </div>
        
        <div className="bg-gray-50/50 dark:bg-black/20 px-8 py-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.15em] text-[11px]">
            <ClockIcon className="h-4 w-4" />
            <span>Inställningar: {settingsText}</span>
          </div>
          {isCoachView && (
              <button onClick={onEditSettings} className="text-primary hover:underline font-black uppercase tracking-widest text-[10px]">Ändra tider</button>
          )}
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{block.exercises.length} övningar</h4>
            <button onClick={() => setExercisesVisible(!exercisesVisible)} className="text-primary font-black uppercase tracking-widest text-[11px] hover:underline">
                {exercisesVisible ? 'Dölj övningar' : 'Visa övningar'}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {exercisesVisible && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                {block.exercises.map((ex) => (
                    <div key={ex.id} className="flex items-start gap-6 p-6 rounded-3xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 transition-all hover:border-primary/20">
                        <div className="flex-grow min-w-0">
                            <h4 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                                {ex.name}
                            </h4>
                            {ex.description && <p className="text-lg text-gray-500 dark:text-gray-400 mt-2 leading-relaxed font-medium">{ex.description}</p>}
                        </div>
                        {ex.reps && (
                            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 font-mono font-black text-primary text-xl flex-shrink-0">
                                {formatReps(ex.reps)}
                            </div>
                        )}
                    </div>
                ))}
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
    const personalBestResult = useMemo(() => {
        if (!personalBestName) return null;
        const userResults = results.filter(r => r.participantName === personalBestName);
        return userResults.sort((a, b) => a.finishTime - b.finishTime)[0] || null;
    }, [results, personalBestName]);

    return (
        <div className="mt-8 bg-gray-50 dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-6">Topplista</h3>
            {personalBestResult && (
                <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-2xl">
                    <p className="font-bold text-primary text-sm">Ditt personbästa: {formatResultTime(personalBestResult.finishTime)}</p>
                </div>
            )}
            {isLoading && results.length === 0 ? (
                <p className="text-gray-500 text-sm">Laddar resultat...</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700"><th className="pb-3 text-[10px] font-black uppercase text-gray-400">#</th><th className="pb-3 text-[10px] font-black uppercase text-gray-400">Namn</th><th className="pb-3 text-right text-[10px] font-black uppercase text-gray-400">Tid</th></tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => (
                                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0"><td className="py-4 font-black text-sm">{i + 1}</td><td className="py-4 font-bold text-gray-800 dark:text-white text-sm">{r.participantName}</td><td className="py-4 text-right font-mono font-bold text-sm">{formatResultTime(r.finishTime)}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---

interface WorkoutDetailScreenProps {
  workout: Workout;
  onStartBlock: (block: WorkoutBlock) => void;
  onUpdateBlockSettings: (blockId: string, newSettings: Partial<WorkoutBlock['settings']>) => void;
  onEditWorkout: (workout: Workout, blockId?: string) => void;
  onAdjustWorkout?: (workout: Workout) => void;
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
  onVisualize: (workout: Workout) => void;
  hasActiveCarousel?: boolean; 
  onLogWorkout?: (workoutId: string, orgId: string) => void;
  onClose?: () => void;
}

const WorkoutDetailScreen: React.FC<WorkoutDetailScreenProps> = ({ 
    workout, onStartBlock, onUpdateBlockSettings, onEditWorkout, onAdjustWorkout,
    isCoachView, onTogglePublish, onToggleFavorite, onDuplicate, 
    onShowImage, isPresentationMode, studioConfig, onDelete,
    followMeShowImage, setFollowMeShowImage, onUpdateWorkout, onVisualize,
    hasActiveCarousel = false,
    onLogWorkout,
    onClose
}) => {
  const { selectedOrganization, selectedStudio } = useStudio();
  const { isStudioMode, role } = useAuth();
  const [sessionWorkout, setSessionWorkout] = useState<Workout>(() => JSON.parse(JSON.stringify(workout)));
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [coachTipsVisible, setCoachTipsVisible] = useState(true);
  const [results, setResults] = useState<WorkoutResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [visualizingBlock, setVisualizingBlock] = useState<WorkoutBlock | null>(null);
  
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  const personalBestName = useMemo(() => localStorage.getItem('hyrox-participant-name'), []);
  const isHyroxRace = useMemo(() => workout.id.startsWith('hyrox-full-race') || workout.id.startsWith('custom-race'), [workout.id]);

  useEffect(() => {
    setSessionWorkout(JSON.parse(JSON.stringify(workout)));
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
  
  if (!sessionWorkout || !selectedOrganization) {
    return null; 
  }

  // --- MEMBER VIEW SWITCH ---
  const showCoachView = isStudioMode || isCoachView;

  if (!showCoachView) {
      return (
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
              <MemberWorkoutView 
                  workout={sessionWorkout} 
                  onClose={onClose} 
                  onLog={onLogWorkout ? () => onLogWorkout(workout.id, selectedOrganization.id) : undefined}
                  onAdjust={onAdjustWorkout ? () => onAdjustWorkout(workout) : undefined}
              />
          </div>
      );
  }

  // --- COACH / ADMIN VIEW (Below) ---

  const isLoggingEnabled = studioConfig.enableWorkoutLogging || false;
  const showSidebar = !isStudioMode; 
  const showQR = isLoggingEnabled && !!selectedStudio && !isPresentationMode;

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
      <div className="mb-10 text-center sm:text-left flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-gray-900 dark:text-white leading-tight mb-2 tracking-tight">
                {sessionWorkout.title}
            </h1>
            <div className="flex items-center justify-center sm:justify-start gap-3">
                {sessionWorkout.category && (
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-gray-200 dark:border-gray-700">
                        {sessionWorkout.category}
                    </span>
                )}
            </div>
          </div>

          {/* Button for Studio Mode (Members/Coaches in-gym) */}
          {isStudioMode && onAdjustWorkout && (
            <button 
                onClick={() => onAdjustWorkout(workout)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all transform active:scale-95"
            >
                <PencilIcon className="w-6 h-6" />
                <span className="text-xl uppercase tracking-tight">Anpassa & Starta</span>
            </button>
          )}
      </div>

      {/* --- TIPS FRÅN COACHEN --- */}
      {sessionWorkout.coachTips && (
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
            {/* BLOCKS LIST */}
            <div className="space-y-8">
                {sessionWorkout.blocks.map((block) => (
                    <div key={block.id} ref={el => { blockRefs.current[block.id] = el }}>
                        <WorkoutBlockCard 
                            block={block} 
                            onStart={() => onStartBlock(block)} 
                            onVisualize={() => setVisualizingBlock(block)}
                            onEditSettings={() => setEditingBlockId(block.id)}
                            onUpdateBlock={handleUpdateBlock}
                            isCoachView={true}
                            organizationId={selectedOrganization?.id || ''}
                        />
                    </div>
                ))}
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
                                <PencilIcon className="w-5 h-5" /> Redigera Pass
                            </button>
                            {onAdjustWorkout && (
                                <button onClick={() => onAdjustWorkout(workout)} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all font-bold">
                                    <PencilIcon className="w-5 h-5" /> Anpassa & Kör
                                </button>
                            )}
                            <button onClick={() => onDuplicate(workout)} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 hover:bg-primary/10 hover:text-primary transition-all font-bold">
                                <StarIcon className="w-5 h-5" /> Kopiera Pass
                            </button>
                            <button onClick={() => onTogglePublish(workout.id, !workout.isPublished)} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${workout.isPublished ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {workout.isPublished ? 'Avpublicera' : 'Publicera'}
                            </button>
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
        />
      )}
      
      <AnimatePresence>
          {visualizingBlock && (
              <BlockPresentationModal 
                  block={visualizingBlock} 
                  onClose={() => setVisualizingBlock(null)} 
              />
          )}
      </AnimatePresence>
    </div>
  );
};

export default WorkoutDetailScreen;