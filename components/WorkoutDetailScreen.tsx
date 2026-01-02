import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Workout, WorkoutBlock, TimerMode, TimerSettings, Exercise, Passkategori, StudioConfig, WorkoutResult, Organization, BankExercise } from '../types';
import { TimerSetupModal } from './TimerSetupModal';
import { StarIcon, PencilIcon, DumbbellIcon, ToggleSwitch, SparklesIcon, PencilIcon as DrawIcon } from './icons';
import { getWorkoutResults } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { AnimatePresence, motion } from 'framer-motion';
// NY IMPORT
import { WorkoutQRDisplay } from './WorkoutQRDisplay';

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

    // If the string contains only numbers, ranges (-), commas, or slashes, append 'reps'
    const isNumericLike = /^[\d\s\-\.,/]+$/.test(trimmed);

    if (isNumericLike) {
        return `${trimmed} reps`;
    }
    return trimmed;
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
  onVisualize: (workout: Workout) => void;
  // NY PROP
  hasActiveCarousel?: boolean; 
}

const WorkoutDetailScreen: React.FC<WorkoutDetailScreenProps> = ({ 
    workout, onStartBlock, onUpdateBlockSettings, onEditWorkout, 
    isCoachView, onTogglePublish, onToggleFavorite, onDuplicate, 
    onShowImage, isPresentationMode, studioConfig, onDelete,
    followMeShowImage, setFollowMeShowImage, onUpdateWorkout, onVisualize,
    hasActiveCarousel = false // Default
}) => {
  const { selectedOrganization } = useStudio();
  const [sessionWorkout, setSessionWorkout] = useState<Workout>(() => JSON.parse(JSON.stringify(workout)));
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [coachTipsVisible, setCoachTipsVisible] = useState(true);
  const [results, setResults] = useState<WorkoutResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  const personalBestName = useMemo(() => localStorage.getItem('hyrox-participant-name'), []);
  const isHyroxRace = useMemo(() => workout.id.startsWith('hyrox-full-race'), [workout.id]);

  useEffect(() => {
    setSessionWorkout(JSON.parse(JSON.stringify(workout)));
  }, [workout]);

  useEffect(() => {
    // Check for organization context and pass it to getWorkoutResults
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
        
        fetchResults(); // Initial fetch

        const intervalId = setInterval(fetchResults, 15000); // Poll every 15 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
    }
  }, [workout.id, isHyroxRace, resultsLoading, selectedOrganization]);

  const isMemberDraftView = useMemo(() => !workout.isPublished && !isCoachView, [workout.isPublished, isCoachView]);
  const effectiveCoachView = isCoachView;
  const canEditExercisesInline = effectiveCoachView || isMemberDraftView;
  
  const showSidebar = isCoachView;

  const handleDelete = () => {
      if (onDelete && window.confirm(`Är du säker på att du vill ta bort passet "${workout.title}"?`)) {
          onDelete(workout.id);
      }
  };

  const handleUpdateBlock = (updatedBlock: WorkoutBlock) => {
    setSessionWorkout(prevWorkout => {
      if (!prevWorkout) return null; // Should not happen given initial state
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
  
  const scrollToBlock = (blockId: string) => {
      const el = blockRefs.current[blockId];
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  };

  if (!sessionWorkout || !selectedOrganization) {
    return null; 
  }

  // Determine if workout logging is enabled for this studio/organization
  const isLoggingEnabled = studioConfig.enableWorkoutLogging || false;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-6 lg:px-8 pb-32 relative">
      
      {/* --- NYHET: QR Code Display for Logging --- */}
      <WorkoutQRDisplay 
          workoutId={workout.id}
          organizationId={selectedOrganization.id}
          isEnabled={isLoggingEnabled}
          hasActiveCarousel={hasActiveCarousel}
      />

      {/* --- HEADER SECTION --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">{sessionWorkout.title}</h1>
            {sessionWorkout.category && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium">
                    {sessionWorkout.category}
                </span>
            )}
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
            {!workout.isPublished && !isCoachView && (
                 <button 
                    onClick={() => onToggleFavorite(workout.id)}
                    className="p-3 rounded-xl transition-colors bg-gray-100 dark:bg-gray-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 border border-transparent hover:border-yellow-300"
                    aria-label={workout.isFavorite ? "Ta bort från favoriter" : "Lägg till som favorit"}
                    title={workout.isFavorite ? "Ta bort från favoriter" : "Spara som favorit"}
                >
                    <StarIcon filled={!!workout.isFavorite} className={`h-6 w-6 ${workout.isFavorite ? "text-yellow-400" : "text-gray-400"}`} />
                </button>
            )}

            {isMemberDraftView ? (
                <button 
                    onClick={() => onEditWorkout(workout)} 
                    className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-3 px-5 rounded-xl transition-colors"
                >
                  Redigera
                </button>
            ) : effectiveCoachView && (
                <>
                    <button 
                      onClick={() => onDuplicate(workout)} 
                      className="bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold py-3 px-5 rounded-xl transition-colors"
                    >
                      Kopiera
                    </button>
                    <button 
                      onClick={() => onEditWorkout(workout)} 
                      className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-3 px-5 rounded-xl transition-colors"
                    >
                      Redigera
                    </button>
                    {workout.isPublished ? (
                        <button 
                            onClick={() => onTogglePublish(workout.id, false)}
                            className="bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 font-semibold py-3 px-5 rounded-xl transition-colors"
                        >
                            Avpublicera
                        </button>
                    ) : (
                        <button 
                            onClick={() => onTogglePublish(workout.id, true)}
                            className="bg-primary hover:brightness-95 text-white font-semibold py-3 px-5 rounded-xl transition-colors shadow-md"
                        >
                            Publicera
                        </button>
                    )}
                </>
            )}
        </div>
      </div>

      {/* --- MAIN GRID LAYOUT --- */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* --- LEFT COLUMN: WORKOUT CONTENT (Blocks) --- */}
        <div className={`${showSidebar ? 'md:col-span-7 lg:col-span-8' : 'md:col-span-12'} space-y-8`}>
            
            {/* Coach Tips / Intro */}
            {sessionWorkout.coachTips && sessionWorkout.coachTips.trim() !== '' && (
                <div className="bg-white dark:bg-gray-800 border-l-4 border-orange-400 dark:border-orange-500 rounded-r-xl shadow-sm overflow-hidden">
                <div className="p-5">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-lg text-orange-800 dark:text-orange-200 flex items-center gap-2">
                            <span>📢</span> Tips från coachen
                        </h3>
                        <button
                            onClick={() => setCoachTipsVisible(!coachTipsVisible)}
                            className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                        >
                            {coachTipsVisible ? 'Dölj' : 'Visa'}
                        </button>
                    </div>
                    <AnimatePresence>
                        {coachTipsVisible && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }} 
                                animate={{ opacity: 1, height: 'auto' }} 
                                exit={{ opacity: 0, height: 0 }}
                                className="text-gray-700 dark:text-gray-300 leading-relaxed"
                            >
                                {sessionWorkout.coachTips}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                </div>
            )}
            
            {/* BLOCKS LIST */}
            <div className="space-y-8">
                {sessionWorkout.blocks.map((block, index) => (
                    <div key={block.id} ref={el => { blockRefs.current[block.id] = el }}>
                        <WorkoutBlockCard 
                            block={block} 
                            onStart={() => onStartBlock(block)} 
                            onEditSettings={() => setEditingBlockId(block.id)}
                            onUpdateBlock={handleUpdateBlock}
                            isCoachView={canEditExercisesInline}
                            organization={selectedOrganization}
                            organizationId={selectedOrganization?.id || ''}
                            followMeShowImage={followMeShowImage}
                            setFollowMeShowImage={setFollowMeShowImage}
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

        {/* --- RIGHT COLUMN: SIDEBAR (AI Coach & Nav) --- */}
        {showSidebar && (
            <div className="md:col-span-5 lg:col-span-4 space-y-6">
                <div className="sticky top-6 space-y-6 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    
                    {/* Quick Navigation */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Innehåll</h3>
                        <nav className="space-y-1">
                            {sessionWorkout.blocks.map((block, index) => (
                                <button 
                                    key={block.id}
                                    onClick={() => scrollToBlock(block.id)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group"
                                >
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs group-hover:bg-primary group-hover:text-white transition-colors">
                                        {index + 1}
                                    </span>
                                    <span className="truncate">{block.title}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* COMPLETE AI PANEL (Summary + Block Suggestions) - Only visible to coaches */}
                    <AiContextPanel workout={sessionWorkout} />

                    {/* Actions */}
                    {effectiveCoachView && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Verktyg</h3>
                            <div className="space-y-2">
                                {studioConfig.enableNotes && (
                                    <button 
                                        onClick={() => onVisualize(workout)}
                                        className="w-full text-left px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <DrawIcon className="w-4 h-4" />
                                        <span>Visa på Idé-tavlan</span>
                                    </button>
                                )}
                                <button onClick={() => handleDelete()} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                    Ta bort pass
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        )}

      </div>

      {/* Modals */}
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

// Component: Consolidated AI Panel
const AiContextPanel: React.FC<{ workout: Workout }> = ({ workout }) => {
    const hasSummary = !!workout.aiCoachSummary;
    const hasSuggestions = workout.blocks.some(b => 
        (b.aiMagicPenSuggestions && b.aiMagicPenSuggestions.length > 0) || b.aiCoachNotes
    );

    if (!hasSummary && !hasSuggestions) return null;

    return (
        <div className="space-y-6">
            {/* Global Summary */}
            {hasSummary && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-6 shadow-sm border border-purple-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-2 -mr-2 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-300">
                            <SparklesIcon className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white">AI-Coach Summering</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {workout.aiCoachSummary}
                    </p>
                </div>
            )}

            {/* Block Specific Suggestions */}
            {hasSuggestions && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-6 shadow-sm border border-yellow-100 dark:border-yellow-900/30">
                    <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200 uppercase tracking-wider mb-4">Tips för blocken</h3>
                    <div className="space-y-6">
                        {workout.blocks.map(block => {
                            const hasNotes = !!block.aiCoachNotes;
                            const hasMagic = block.aiMagicPenSuggestions && block.aiMagicPenSuggestions.length > 0;
                            
                            if (!hasNotes && !hasMagic) return null;

                            return (
                                <div key={block.id} className="space-y-2">
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm border-b border-yellow-200 dark:border-yellow-800 pb-1">
                                        {block.title}
                                    </h4>
                                    {hasNotes && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 italic">"{block.aiCoachNotes}"</p>
                                    )}
                                    {hasMagic && (
                                        <ul className="space-y-1.5 pt-1">
                                            {block.aiMagicPenSuggestions!.map((sugg, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                                                    <span className="text-yellow-500 mt-0.5">•</span>
                                                    <span>{sugg}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
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
    organization: Organization | null;
    organizationId: string;
    followMeShowImage: boolean;
    setFollowMeShowImage: (show: boolean) => void;
}
const WorkoutBlockCard: React.FC<WorkoutBlockCardProps> = ({ 
    block, onStart, onEditSettings, onUpdateBlock, isCoachView, 
    organization, organizationId, followMeShowImage, setFollowMeShowImage
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
                let laps: number;
                let showLaps = false;

                if (block.settings.specifiedLaps) {
                    laps = block.settings.specifiedLaps;
                    showLaps = true;
                } else {
                    const exercisesPerLap = block.exercises.length > 0 ? block.exercises.length : 1;
                    laps = Math.ceil(totalIntervals / exercisesPerLap);
                    showLaps = laps > 1 && exercisesPerLap > 1;
                }
                
                const lapText = showLaps ? ` (${laps} varv)` : '';
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-lg">
        {/* Card Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${getTagColor(block.tag)}`}>
                            {block.tag}
                        </span>
                        {block.followMe ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6a6 6 0 016 6v1H9M15 21a2 2 0 002-2v-1a2 2 0 00-2-2h-3a2 2 0 00-2 2v1a2 2 0 002 2h3zm4-12a2 2 0 002-2V7a2 2 0 00-2-2h-3a2 2 0 00-2 2v1a2 2 0 002 2h3z" />
                                </svg>
                                Följ mig
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Stationer
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{block.title}</h2>
                    {block.setupDescription && (
                        <div className="mt-3 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                            {block.setupDescription.split('\n').map((line, i) => (
                                <p key={i} className="mb-1 last:mb-0">{line}</p>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={onStart} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span>Starta</span>
                    </button>
                </div>
            </div>
        </div>
        
        {/* Settings Bar */}
        <div className="bg-gray-50 dark:bg-black/40 px-6 py-3 flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Inställningar: <span className="font-semibold text-gray-900 dark:text-white">{settingsText}</span></span>
          </div>
          <button onClick={onEditSettings} className="text-primary hover:text-primary/80 font-semibold text-xs uppercase tracking-wide transition-colors">
            Ändra tider
          </button>
        </div>

        {/* Exercises List */}
        <div className="bg-white dark:bg-gray-800 px-6 py-4">
          <div className="w-full flex justify-between items-center text-gray-500 dark:text-gray-400 mb-4">
            <button onClick={() => setExercisesVisible(!exercisesVisible)} className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-white font-medium text-sm transition-colors">
              <span className="transform transition-transform duration-200" style={{ rotate: exercisesVisible ? '0deg' : '-90deg' }}>▼</span>
              <span>{exercisesVisible ? 'Dölj övningar' : 'Visa övningar'}</span>
            </button>
            <span className="text-xs">{block.exercises.length} övningar</span>
          </div>

          <AnimatePresence initial={false}>
            {exercisesVisible && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 overflow-hidden"
                >
                {block.exercises.map((ex, i) => {
                    return (
                        <div key={ex.id} className="group flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                            <div className="flex-grow min-w-0 pt-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                                        {ex.reps && <span className="text-primary mr-1.5">{formatReps(ex.reps)}</span>}
                                        {ex.name}
                                    </h4>
                                </div>
                                {ex.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 group-hover:line-clamp-none transition-all">
                                        {ex.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
                </motion.div>
            )}
          </AnimatePresence>
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