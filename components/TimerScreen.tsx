
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutBlock, TimerStatus, TimerMode, Exercise, StartGroup, Organization, HyroxRace, Workout } from '../types';
import { useWorkoutTimer, playShortBeep, getAudioContext, calculateBlockDuration } from '../hooks/useWorkoutTimer';
import { useWorkout } from '../context/WorkoutContext';
import { saveRace, updateOrganizationActivity } from '../services/firebaseService';
import { Confetti } from './WorkoutCompleteModal';
import { EditResultModal, RaceResetConfirmationModal, RaceBackToPrepConfirmationModal, RaceFinishAnimation, PauseOverlay } from './timer/TimerModals';
import { ParticipantFinishList } from './timer/ParticipantFinishList';
import { DumbbellIcon, InformationCircleIcon, LightningIcon, SparklesIcon, ChevronRightIcon } from './icons';

// --- Constants ---
const HYROX_RIGHT_PANEL_WIDTH = '450px';

// --- Helper Components & Interfaces ---

interface TimerStyle {
  bg: string;
  text: string;
  pulseRgb: string;
  border: string;
  badge: string;
}

const getTimerStyle = (status: TimerStatus, mode: TimerMode, isHyrox: boolean): TimerStyle => {
  if (isHyrox) {
      return { bg: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 animate-pulse-hyrox-bg', text: 'text-white', pulseRgb: '255, 255, 255', border: 'border-white', badge: 'bg-white text-indigo-600' };
  }

  switch (status) {
    case TimerStatus.Preparing:
      return { bg: 'bg-blue-500', text: 'text-white', pulseRgb: '59, 130, 246', border: 'border-blue-300', badge: 'bg-blue-600' };
    case TimerStatus.Running:
      switch (mode) {
        case TimerMode.Interval: return { bg: 'bg-orange-500', text: 'text-white', pulseRgb: '249, 115, 22', border: 'border-orange-300', badge: 'bg-orange-600' };
        case TimerMode.Tabata: return { bg: 'bg-red-500', text: 'text-white', pulseRgb: '239, 68, 68', border: 'border-red-300', badge: 'bg-red-600' };
        case TimerMode.AMRAP: return { bg: 'bg-pink-600', text: 'text-white', pulseRgb: '219, 39, 119', border: 'border-pink-300', badge: 'bg-pink-700' };
        case TimerMode.EMOM: return { bg: 'bg-purple-600', text: 'text-white', pulseRgb: '147, 51, 234', border: 'border-purple-300', badge: 'bg-purple-700' };
        case TimerMode.TimeCap: return { bg: 'bg-indigo-600', text: 'text-white', pulseRgb: '79, 70, 229', border: 'border-indigo-300', badge: 'bg-indigo-700' };
        case TimerMode.Stopwatch: return { bg: 'bg-green-600', text: 'text-white', pulseRgb: '22, 163, 74', border: 'border-green-300', badge: 'bg-green-700' };
        default: return { bg: 'bg-orange-500', text: 'text-white', pulseRgb: '249, 115, 22', border: 'border-orange-300', badge: 'bg-orange-600' };
      }
    case TimerStatus.Resting:
      return { bg: 'bg-teal-400', text: 'text-white', pulseRgb: '45, 212, 191', border: 'border-teal-200', badge: 'bg-teal-600' };
    case TimerStatus.Paused:
      return { bg: 'bg-gray-500', text: 'text-white', pulseRgb: '107, 114, 128', border: 'border-gray-400', badge: 'bg-gray-600' };
    case TimerStatus.Finished:
      return { bg: 'bg-teal-600', text: 'text-white', pulseRgb: '13, 148, 136', border: 'border-teal-400', badge: 'bg-teal-800' };
    case TimerStatus.Idle:
    default:
      return { bg: 'bg-gray-900', text: 'text-white', pulseRgb: '0, 0, 0', border: 'border-gray-700', badge: 'bg-gray-800' };
  }
};

const formatReps = (reps: string | undefined): string => {
    if (!reps) return '';
    const trimmed = reps.trim();
    if (!trimmed) return '';
    const isNumericLike = /^[\d\s\-\.,/]+$/.test(trimmed);
    if (isNumericLike) return `${trimmed} reps`;
    return trimmed;
};

const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// --- Visualization Components ---

const ComingUpBanner: React.FC<{ block: WorkoutBlock; transitionTime?: number; nextBlockTitle: string }> = ({ block, transitionTime, nextBlockTitle }) => {
    const hasTransition = transitionTime && transitionTime > 0;
    return (
        <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-6"
        >
            <div className="bg-black/80 backdrop-blur-2xl rounded-[2.5rem] p-6 border-2 border-white/20 shadow-2xl flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                        <SparklesIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-0.5">NÄSTA</span>
                        <h4 className="text-xl font-black uppercase truncate max-w-[250px]">
                            {hasTransition ? `VILA (${transitionTime}s)` : nextBlockTitle}
                        </h4>
                    </div>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-0.5">FÖLJT AV</span>
                    <p className="text-sm font-black text-primary uppercase truncate max-w-[150px]">{hasTransition ? nextBlockTitle : 'KLART'}</p>
                </div>
            </div>
        </motion.div>
    );
};

const NextStartIndicator: React.FC<{
    groupName: string;
    timeLeft: number;
    groupsLeft: number;
}> = ({ groupName, timeLeft, groupsLeft }) => {
    const minutes = Math.floor(Math.max(0, timeLeft) / 60);
    const seconds = Math.max(0, timeLeft) % 60;
    const isUrgent = timeLeft <= 30;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, height: 0 }}
            className="w-full max-w-4xl mx-auto mb-8 relative"
        >
            <div className={`bg-white/90 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-6 border-2 shadow-xl dark:shadow-2xl flex items-center justify-between transition-colors duration-500 ${isUrgent ? 'border-orange-500 shadow-orange-500/20' : 'border-gray-200 dark:border-white/10'}`}>
                <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner ${isUrgent ? 'bg-orange-500 text-white animate-pulse' : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/40'}`}>
                        <LightningIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <span className="block text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-[0.3em] mb-1">NÄSTA START</span>
                        <h4 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight truncate max-w-[250px] sm:max-w-md">
                            {groupName}
                        </h4>
                    </div>
                </div>

                <div className="text-right">
                    <span className="block text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-[0.3em] mb-1">STARTAR OM</span>
                    <div className={`font-mono text-5xl font-black tabular-nums leading-none ${isUrgent ? 'text-orange-500' : 'text-gray-900 dark:text-white'}`}>
                        {minutes}:{seconds.toString().padStart(2, '0')}
                    </div>
                </div>
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-white/60 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-300 dark:border-white/10 shadow-lg">
                {groupsLeft} {groupsLeft === 1 ? 'grupp' : 'grupper'} kvar i kön
            </div>
        </motion.div>
    );
};

const FollowMeView: React.FC<{ 
    exercise: Exercise | null, 
    nextExercise: Exercise | null, 
    timerStyle: TimerStyle, 
    status: TimerStatus
}> = ({ exercise, nextExercise, timerStyle, status }) => {
    const isResting = status === TimerStatus.Resting;
    const isPreparing = status === TimerStatus.Preparing;
    const displayExercise = exercise;
    const label = (isResting || isPreparing) ? "NÄSTA ÖVNING" : "AKTUELL ÖVNING";

    if (!displayExercise) return null;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={displayExercise.id}
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`w-full max-w-5xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border-l-[20px] ${isResting ? 'border-teal-400' : timerStyle.border.replace('border-', 'border-')}`}
                style={{ borderColor: isResting ? undefined : `rgb(${timerStyle.pulseRgb})` }}
            >
                <div className="p-10 md:p-14 flex flex-col items-center text-center">
                    <span className="block text-xl md:text-2xl font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-4">
                        {label}
                    </span>
                    <h3 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white leading-tight mb-6 tracking-tight">
                        {displayExercise.name}
                    </h3>
                    {displayExercise.reps && (
                        <p className="text-4xl md:text-6xl font-black text-primary mb-6">{formatReps(displayExercise.reps)}</p>
                    )}
                    {displayExercise.description && (
                        <p className="text-gray-600 dark:text-gray-300 text-2xl md:text-3xl leading-relaxed max-w-4xl font-medium">
                            {displayExercise.description}
                        </p>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

const StandardListView: React.FC<{ 
    exercises: Exercise[], 
    timerStyle: TimerStyle 
}> = ({ exercises, timerStyle }) => {
    const count = exercises.length;
    let titleSize = 'text-3xl';
    let repsSize = 'text-xl';
    let padding = 'px-6 py-4';
    let gap = 'gap-3';
    let showDesc = true;

    if (count <= 4) {
        titleSize = 'text-4xl md:text-5xl';
        repsSize = 'text-2xl md:text-3xl';
        padding = 'px-8 py-6';
        gap = 'gap-5';
    } else if (count <= 7) {
        titleSize = 'text-3xl md:text-4xl';
        repsSize = 'text-xl md:text-2xl';
        gap = 'gap-4';
    } else {
        titleSize = 'text-2xl md:text-3xl';
        repsSize = 'text-lg md:text-xl';
        showDesc = false; 
    }

    return (
        <div className={`w-full max-w-6xl flex-1 flex flex-col ${gap} overflow-y-auto pb-4 custom-scrollbar`}>
            {exercises.map((ex) => (
                <div 
                    key={ex.id} 
                    className={`flex-1 min-h-[100px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl ${padding} flex flex-col justify-center border-l-[10px] shadow-lg transition-all relative group`}
                    style={{ borderLeftColor: `rgb(${timerStyle.pulseRgb})` }}
                >
                    <div className="flex justify-between items-center w-full gap-6">
                        <h4 className={`font-black text-gray-900 dark:text-white leading-none tracking-tight ${titleSize}`}>
                            {ex.name}
                        </h4>
                        {ex.reps && (
                            <span className={`font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg whitespace-nowrap shadow-sm flex-shrink-0 border border-gray-200 dark:border-gray-700 ${repsSize}`}>
                                {formatReps(ex.reps)}
                            </span>
                        )}
                    </div>
                    {showDesc && ex.description && (
                        <p className="text-gray-600 dark:text-gray-400 mt-2 line-clamp-1 text-lg md:text-xl font-medium">
                            {ex.description}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
};

interface BigIndicatorProps {
    currentRound: number;
    totalRounds: number;
    mode: TimerMode;
    currentInterval?: number;
    totalIntervalsInLap?: number;
}

const BigRoundIndicator: React.FC<BigIndicatorProps> = ({ currentRound, totalRounds, mode, currentInterval, totalIntervalsInLap }) => {
    // Visa endast för Interval, Tabata och EMOM
    if (mode !== TimerMode.Interval && mode !== TimerMode.Tabata && mode !== TimerMode.EMOM) return null;

    // Dölj specifika "Intervall X av Y" boxen för EMOM, då ronderna räcker där
    const showInterval = currentInterval !== undefined && totalIntervalsInLap !== undefined && mode !== TimerMode.EMOM;

    return (
        <div className="flex flex-col items-end gap-3 animate-fade-in">
            {showInterval && (
                <div className="bg-black/40 backdrop-blur-xl rounded-[2.5rem] px-10 py-6 shadow-2xl flex flex-col items-center min-w-[200px]">
                    <span className="block text-white/40 font-black text-xs sm:text-sm uppercase tracking-[0.4em] mb-2">INTERVALL</span>
                    <div className="flex items-baseline justify-center gap-1">
                        <motion.span 
                            key={`interval-${currentInterval}`} 
                            initial={{ opacity: 0, scale: 0.8 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            className="font-black text-6xl sm:text-7xl text-white drop-shadow-2xl leading-none"
                        >
                            {currentInterval}
                        </motion.span>
                        <span className="text-2xl sm:text-3xl font-black text-white/40">/ {totalIntervalsInLap}</span>
                    </div>
                </div>
            )}

            <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-xl rounded-full px-6 py-3 shadow-xl flex items-center justify-center gap-3 min-w-[140px]"
            >
                <span className="text-white/40 font-black text-[10px] uppercase tracking-[0.3em]">
                    {mode === TimerMode.EMOM ? 'MINUT' : 'VARV'}
                </span>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">{currentRound}</span>
                    <span className="text-sm font-bold text-white/40">/ {totalRounds}</span>
                </div>
            </motion.div>
        </div>
    );
};


interface TimerScreenProps {
    block: WorkoutBlock;
    onFinish: (finishData: { isNatural?: boolean; time?: number, raceId?: string }) => void;
    onHeaderVisibilityChange: (isVisible: boolean) => void;
    onShowImage: (url: string) => void; 
    setCompletionInfo: React.Dispatch<React.SetStateAction<{ workout: Workout; isFinal: boolean; blockTag?: string; finishTime?: number; } | null>>;
    setIsRegisteringHyroxTime: React.Dispatch<React.SetStateAction<boolean>>;
    setIsBackButtonHidden: React.Dispatch<React.SetStateAction<boolean>>;
    followMeShowImage: boolean;
    organization: Organization | null;
    onBackToGroups: () => void;
    isAutoTransition?: boolean;
}

interface FinishData { time: number; placement: number | null; }

export const TimerScreen: React.FC<TimerScreenProps> = ({ 
    block, onFinish, onHeaderVisibilityChange, onShowImage,
    setCompletionInfo, setIsRegisteringHyroxTime,
    setIsBackButtonHidden, followMeShowImage, organization, onBackToGroups,
    isAutoTransition = false
}) => {
  const { activeWorkout, setActiveWorkout } = useWorkout();
  const { 
    status, currentTime, currentPhaseDuration, currentRound, currentExercise, nextExercise,
    start, pause, resume, reset, 
    totalRounds, totalExercises, currentExerciseIndex,
    isLastExerciseInRound,
    totalBlockDuration, totalTimeElapsed,
    completedWorkIntervals, totalWorkIntervals,
    effectiveIntervalsPerLap
  } = useWorkoutTimer(block);
  
  const [controlsVisible, setControlsVisible] = React.useState(false);
  const hideTimeoutRef = React.useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  // --- TRANSITION LOGIC ---
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTimeLeft, setTransitionTimeLeft] = useState(0);
  const transitionIntervalRef = useRef<number | null>(null);

  const nextBlock = useMemo(() => {
    if (!activeWorkout || !block.autoAdvance) return null;
    const index = activeWorkout.blocks.findIndex(b => b.id === block.id);
    if (index === -1 || index >= activeWorkout.blocks.length - 1) return null;
    return activeWorkout.blocks[index + 1];
  }, [activeWorkout, block]);

  // Calculate current chain stats
  const chainInfo = useMemo(() => {
      if (!activeWorkout) return null;
      const index = activeWorkout.blocks.findIndex(b => b.id === block.id);
      if (index === -1) return null;

      // Find start of chain
      let startIdx = index;
      while (startIdx > 0 && activeWorkout.blocks[startIdx-1].autoAdvance) {
          startIdx--;
      }

      // Find end of chain
      let endIdx = index;
      while (endIdx < activeWorkout.blocks.length - 1 && activeWorkout.blocks[endIdx].autoAdvance) {
          endIdx++;
      }

      const chain = activeWorkout.blocks.slice(startIdx, endIdx + 1);
      
      let totalDuration = 0;
      let elapsedTimeBeforeCurrent = 0;
      
      chain.forEach((b, i) => {
          const bDur = calculateBlockDuration(b.settings, b.exercises.length);
          totalDuration += bDur;
          
          if (i < index - startIdx) {
              elapsedTimeBeforeCurrent += bDur;
          }

          // Add transition times except for the last one in chain
          if (i < chain.length - 1) {
              const transTime = activeWorkout.blocks[startIdx + i].transitionTime || 0;
              totalDuration += transTime;
              if (i < index - startIdx) {
                  elapsedTimeBeforeCurrent += transTime;
              }
          }
      });

      return {
          totalDuration,
          elapsedTimeBeforeCurrent,
          totalChainTime: totalDuration,
          currentBlockInChain: index - startIdx + 1,
          totalBlocksInChain: chain.length
      };
  }, [activeWorkout, block]);

  const totalChainElapsed = useMemo(() => {
      if (!chainInfo) return 0;
      return chainInfo.elapsedTimeBeforeCurrent + totalTimeElapsed;
  }, [chainInfo, totalTimeElapsed]);

  const handleStartNextBlock = useCallback(() => {
      if (transitionIntervalRef.current) clearInterval(transitionIntervalRef.current);
      setIsTransitioning(false);
      
      if (nextBlock) {
          // Tell the parent to switch block and start without prep
          onFinish({ isNatural: true, time: totalTimeElapsed }); 
      }
  }, [nextBlock, totalTimeElapsed, onFinish]);

  useEffect(() => {
      if (status === TimerStatus.Finished && nextBlock && block.autoAdvance) {
          const waitTime = block.transitionTime || 0;
          if (waitTime === 0) {
              handleStartNextBlock();
          } else {
              setIsTransitioning(true);
              setTransitionTimeLeft(waitTime);
              transitionIntervalRef.current = window.setInterval(() => {
                  setTransitionTimeLeft(prev => {
                      if (prev <= 1) {
                          handleStartNextBlock();
                          return 0;
                      }
                      return prev - 1;
                  });
              }, 1000);
          }
      }
      return () => { if (transitionIntervalRef.current) clearInterval(transitionIntervalRef.current); };
  }, [status, nextBlock, block.autoAdvance, block.transitionTime, handleStartNextBlock]);

  // --- PRE-START LOGIC ---
  const lastBlockIdRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);
  
  useEffect(() => {
    // Reset flag if block ID changes (essential for auto-advance)
    if (lastBlockIdRef.current !== block.id) {
        hasStartedRef.current = false;
        lastBlockIdRef.current = block.id;
    }

    if (!hasStartedRef.current && (status === TimerStatus.Idle || status === TimerStatus.Finished)) {
        if (organization) updateOrganizationActivity(organization.id);
        
        // Skip prep ONLY if we are in an auto-transition chain
        start({ skipPrep: isAutoTransition });
        
        hasStartedRef.current = true;
        onHeaderVisibilityChange(false);
        setIsBackButtonHidden(true);
    }
  }, [start, status, onHeaderVisibilityChange, setIsBackButtonHidden, organization, activeWorkout, block.id, isAutoTransition]);

  const [finishedParticipants, setFinishedParticipants] = useState<Record<string, FinishData>>({});
  const [savingParticipant, setSavingParticipant] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [participantToEdit, setParticipantToEdit] = useState<string | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showBackToPrepConfirmation, setShowBackToPrepConfirmation] = useState(false);
  const [showFinishAnimation, setShowFinishAnimation] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [isSavingRace, setIsSavingRace] = useState(false);
  const [finalRaceId, setFinalRaceId] = useState<string | null>(null);
  
  const [isClockFrozen, setIsClockFrozen] = useState(false);
  const [frozenTime, setFrozenTime] = useState(0);

  const isHyroxRace = useMemo(() => activeWorkout?.id.startsWith('hyrox-full-race') || activeWorkout?.id.startsWith('custom-race'), [activeWorkout]);
  const isFreestanding = block.tag === 'Fristående';
  const showFullScreenColor = isFreestanding;

  const [startGroups, setStartGroups] = useState<StartGroup[]>([]);
  const startIntervalSeconds = useMemo(() => (activeWorkout?.startIntervalMinutes ?? 2) * 60, [activeWorkout]);

  const nextGroupToStartIndex = useMemo(() => startGroups.findIndex(g => g.startTime === undefined), [startGroups]);
  const nextGroupToStart = useMemo(() => (nextGroupToStartIndex !== -1 ? startGroups[nextGroupToStartIndex] : null), [startGroups, nextGroupToStartIndex]);
  const remainingGroupsCount = useMemo(() => startGroups.filter(g => g.startTime === undefined).length, [startGroups]);

  const groupForCountdownDisplay = useMemo(() => {
    if (!isHyroxRace) return null;
    if (status === TimerStatus.Preparing) return startGroups.length > 0 ? startGroups[0] : null;
    return nextGroupToStart;
  }, [isHyroxRace, status, startGroups, nextGroupToStart]);

  const timeForCountdownDisplay = useMemo(() => {
      if (!groupForCountdownDisplay) return 0;
      if (status === TimerStatus.Preparing) return currentTime;
      const groupIndex = startGroups.findIndex(g => g.id === groupForCountdownDisplay.id);
      if (groupIndex === -1) return 0;
      return (groupIndex * startIntervalSeconds) - totalTimeElapsed;
  }, [status, currentTime, groupForCountdownDisplay, startGroups, startIntervalSeconds, totalTimeElapsed]);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = wakeLock;
        wakeLock.addEventListener('release', () => { wakeLockRef.current = null; });
      } catch (err: any) { console.error(`${err.name}, ${err.message}`); }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting) requestWakeLock();
    else releaseWakeLock();
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible' && (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting)) requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => { document.removeEventListener('visibilitychange', handleVisibilityChange); releaseWakeLock(); };
  }, [status, requestWakeLock, releaseWakeLock]);

  const stopAllAudio = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    stopAllAudio();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sv-SE'; 
    utterance.rate = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const swedishVoice = voices.find(v => v.lang === 'sv-SE' || v.lang === 'sv_SE');
    if (swedishVoice) utterance.voice = swedishVoice;
    window.speechSynthesis.speak(utterance);
  }, [stopAllAudio]);

  useEffect(() => {
    if (!isHyroxRace || !groupForCountdownDisplay || (status !== TimerStatus.Running && status !== TimerStatus.Preparing)) return;
    const timeLeft = timeForCountdownDisplay;
    if (timeLeft === 60) speak(`${groupForCountdownDisplay.name} startar om en minut`);
    else if (timeLeft === 30) speak("30 sekunder till start");
    else if (timeLeft === 10) speak("10 sekunder");
    else if (timeLeft <= 5 && timeLeft > 0) speak(String(timeLeft)); 
    else if (timeLeft === 0) speak(`Kör ${groupForCountdownDisplay.name}!`); 
  }, [timeForCountdownDisplay, groupForCountdownDisplay, speak, isHyroxRace, status]);

  const hasCalledFinishRef = useRef(false);
  useEffect(() => {
    if (status === TimerStatus.Finished && !isHyroxRace && block.settings.mode !== TimerMode.Stopwatch && !block.autoAdvance) {
        if (hasCalledFinishRef.current) return;
        const timerId = setTimeout(() => { onFinish({ isNatural: true, time: totalTimeElapsed }); hasCalledFinishRef.current = true; }, 500);
        return () => clearTimeout(timerId);
    } else if (status !== TimerStatus.Finished) { hasCalledFinishRef.current = false; }
  }, [status, isHyroxRace, block.settings.mode, block.autoAdvance, onFinish, totalTimeElapsed]);

  const handleConfirmReset = () => {
    setShowResetConfirmation(false);
    stopAllAudio();
    setFinishedParticipants({});
    setIsClockFrozen(false);
    setFrozenTime(0);
    if (activeWorkout?.startGroups && activeWorkout.startGroups.length > 0) {
        setStartGroups(activeWorkout.startGroups.map(g => ({ ...g, startTime: undefined })));
    } else if (activeWorkout) {
        setStartGroups([{ id: `group-${Date.now()}`, name: 'Startgrupp 1', participants: (activeWorkout?.participants || []).join('\n'), startTime: undefined }]);
    } else {
        setStartGroups([]);
    }
    start();
  };

  useEffect(() => { return () => stopAllAudio(); }, [stopAllAudio]);

  useEffect(() => {
    if (isHyroxRace) {
        if (activeWorkout?.startGroups && activeWorkout.startGroups.length > 0) {
            setStartGroups(activeWorkout.startGroups.map((g, index) => ({ ...g, startTime: index === 0 ? 0 : undefined })));
        } else if (activeWorkout) { 
            setStartGroups([{ id: `group-${Date.now()}`, name: 'Startgrupp 1', participants: (activeWorkout.participants || []).join('\n'), startTime: 0 }]);
        } else { setStartGroups([]); }
    } else { setStartGroups([]); }
  }, [isHyroxRace, activeWorkout]);

  useEffect(() => {
      if (!isHyroxRace || (status !== TimerStatus.Running && status !== TimerStatus.Preparing)) return;
      const groupsToStart = startGroups.filter((group, index) => { const expectedStartTime = index * startIntervalSeconds; return group.startTime === undefined && totalTimeElapsed >= expectedStartTime; });
      if (groupsToStart.length > 0) {
          setStartGroups(prevGroups => {
              const newGroups = [...prevGroups];
              groupsToStart.forEach(groupToStart => {
                  const index = newGroups.findIndex(g => g.id === groupToStart.id);
                  if (index !== -1) { newGroups[index] = { ...newGroups[index], startTime: index * startIntervalSeconds }; }
              });
              return newGroups;
          });
      }
  }, [isHyroxRace, totalTimeElapsed, startGroups, status, startIntervalSeconds]);

  useEffect(() => {
      if (status === TimerStatus.Preparing) return;
      if (isHyroxRace && groupForCountdownDisplay && timeForCountdownDisplay > 0 && timeForCountdownDisplay <= 3) playShortBeep();
  }, [isHyroxRace, timeForCountdownDisplay, groupForCountdownDisplay, status]);

  const startedParticipants = useMemo(() => startGroups.filter(g => g.startTime !== undefined).flatMap(g => g.participants.split('\n').map(p => p.trim()).filter(Boolean)), [startGroups]);
  const totalParticipantsCount = startedParticipants.length;
  const finishedParticipantsCount = Object.keys(finishedParticipants).length;
  const allFinished = totalParticipantsCount > 0 && finishedParticipantsCount === totalParticipantsCount;

  useEffect(() => {
      if (isHyroxRace && allFinished && !isClockFrozen && status === TimerStatus.Running) {
          setFrozenTime(totalTimeElapsed);
          setIsClockFrozen(true);
      }
  }, [allFinished, isHyroxRace, isClockFrozen, totalTimeElapsed, status]);

    const handleRaceComplete = useCallback(async () => {
        if (!isHyroxRace || !activeWorkout || !organization) { 
            if (!organization) console.error("Hyrox save failed: Missing organizationId");
            return; 
        }
        
        setIsSavingRace(true);
        const sortedFinishers = Object.entries(finishedParticipants).sort(([, a], [, b]) => (a as FinishData).time - (b as FinishData).time);
        const winner = sortedFinishers.length > 0 ? sortedFinishers[0][0] : null;
        setWinnerName(winner);
        
        const raceResults = sortedFinishers.map(([participant, name], index) => {
            const group = startGroups.find(g => g.participants.includes(participant));
            return { participant, time: (finishedParticipants[participant] as FinishData).time, groupId: group?.id || 'unknown' };
        });

        try {
            const raceData: Omit<HyroxRace, 'id' | 'createdAt' | 'organizationId'> = {
                raceName: activeWorkout.title,
                exercises: block.exercises.map(e => `${e.reps || ''} ${e.name}`.trim()),
                startGroups: startGroups.map(g => ({ id: g.id, name: g.name, participants: g.participants.split('\n').map(p => p.trim()).filter(Boolean) })),
                results: raceResults
            };
            
            const savedRace = await saveRace(raceData, organization.id);
            if (savedRace && savedRace.id) {
                setFinalRaceId(savedRace.id);
                setShowFinishAnimation(true);
                if (winner) speak(`Och vinnaren är ${winner}! Bra jobbat alla!`);
            } else {
                throw new Error("Missing raceId from server response");
            }
        } catch (error) {
            console.error("Failed to save race:", error);
            alert("Kunde inte spara loppet. Kontrollera din anslutning.");
        } finally {
            setIsSavingRace(false);
        }
    }, [isHyroxRace, activeWorkout, finishedParticipants, block.exercises, startGroups, organization, speak]);

  const handleParticipantFinish = (participantName: string) => {
      if (savingParticipant) return;
      setSavingParticipant(participantName);
      const group = startGroups.find(g => g.participants.includes(participantName));
      if (group && group.startTime !== undefined) {
          const netTime = Math.max(0, totalTimeElapsed - group.startTime);
          setFinishedParticipants(prev => ({ ...prev, [participantName]: { time: netTime, placement: Object.keys(prev).length + 1 } }));
          setShowConfetti(true);
          speak(`Målgång ${participantName}!`);
          setTimeout(() => setShowConfetti(false), 3000);
      }
      setSavingParticipant(null);
  };

  const handleEditParticipant = (participantName: string) => { setParticipantToEdit(participantName); };
  const handleUpdateResult = (newTime: number) => { if (!participantToEdit) return; setFinishedParticipants(prev => ({ ...prev, [participantToEdit]: { ...prev[participantToEdit], time: newTime } })); setParticipantToEdit(null); };
  const handleAddPenalty = () => { if (!participantToEdit) return; setFinishedParticipants(prev => ({ ...prev, [participantToEdit]: { ...prev[participantToEdit], time: prev[participantToEdit].time + 60 } })); setParticipantToEdit(null); };
  const handleRemoveResult = () => {
        if (!participantToEdit) return;
        setFinishedParticipants(prev => {
            const newPrev = { ...prev };
            delete newPrev[participantToEdit];
            const sortedRemaining = Object.entries(newPrev).sort(([, a], [, b]) => (a as FinishData).time - (b as FinishData).time);
            const reindexedParticipants: Record<string, FinishData> = {};
            sortedRemaining.forEach(([name, data], index) => { reindexedParticipants[name] = { ...(data as FinishData), placement: index + 1 }; });
            return reindexedParticipants;
        });
        setParticipantToEdit(null);
    };

  const restartHideTimer = React.useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
        hideTimeoutRef.current = window.setTimeout(() => { setControlsVisible(false); onHeaderVisibilityChange(false); setIsBackButtonHidden(true); }, 3000); 
    }
  }, [status, onHeaderVisibilityChange, setIsBackButtonHidden]);

  useEffect(() => {
    if (controlsVisible) restartHideTimer();
    return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
  }, [controlsVisible, restartHideTimer]);

  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting) restartHideTimer();
    else { setControlsVisible(true); onHeaderVisibilityChange(true); setIsBackButtonHidden(false); if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); }
  }, [status, restartHideTimer, onHeaderVisibilityChange, setIsBackButtonHidden]);

  const handleInteraction = () => { setControlsVisible(true); onHeaderVisibilityChange(true); setIsBackButtonHidden(false); restartHideTimer(); };

  const timerStyle = getTimerStyle(status, block.settings.mode, isHyroxRace);
  
  const safeTotalDuration = totalBlockDuration || 1;
  const progress = Math.min(100, (totalTimeElapsed / safeTotalDuration) * 100);

  const modeLabel = useMemo(() => {
      if (isHyroxRace) return "RACE";
      const { mode } = block.settings;
      switch(mode) {
          case TimerMode.Interval: return "INTERVALLER";
          case TimerMode.Tabata: return "TABATA";
          case TimerMode.AMRAP: return "AMRAP";
          case TimerMode.EMOM: return "EMOM";
          case TimerMode.TimeCap: return "TIME CAP";
          case TimerMode.Stopwatch: return "STOPPUR";
          case TimerMode.NoTimer: return "INGEN TIMER";
          default: return (mode as string).toUpperCase();
      }
  }, [block.settings.mode, isHyroxRace]);

  const statusLabel = useMemo(() => {
      if (isHyroxRace) {
          switch (status) {
              case TimerStatus.Preparing: return "GÖR ER REDO";
              case TimerStatus.Running: return "PÅGÅR"; 
              case TimerStatus.Resting: return "VILA"; 
              case TimerStatus.Paused: return "PAUSAD";
              case TimerStatus.Finished: return "MÅLGÅNG";
              default: return "REDO";
          }
      }
      switch (status) {
          case TimerStatus.Preparing: return "GÖR DIG REDO";
          case TimerStatus.Running: return "ARBETE";
          case TimerStatus.Resting: return "VILA";
          case TimerStatus.Paused: return "PAUSAD";
          case TimerStatus.Finished: return "KLAR";
          default: return "REDO";
      }
  }, [status, isHyroxRace]);

  const timeToDisplay = useMemo(() => {
      if (status === TimerStatus.Preparing) return currentTime;
      if (isHyroxRace && isClockFrozen) return frozenTime;
      if (isHyroxRace || block.settings.mode === TimerMode.Stopwatch) return totalTimeElapsed;
      if (!block.settings.direction || block.settings.direction === 'down') {
          return currentTime;
      }
      return currentPhaseDuration - currentTime;
  }, [status, currentTime, isHyroxRace, block.settings.mode, block.settings.direction, currentPhaseDuration, totalTimeElapsed, isClockFrozen, frozenTime]);

  const minutesStr = Math.floor(timeToDisplay / 60).toString().padStart(2, '0');
  const secondsStr = (timeToDisplay % 60).toString().padStart(2, '0');

  const currentIntervalInLap = (completedWorkIntervals % effectiveIntervalsPerLap) + 1;

  // Render Transition View
  if (isTransitioning) {
      return (
          <div className="fixed inset-0 bg-gradient-to-br from-purple-800 to-indigo-950 flex flex-col items-center justify-center p-8 text-white z-[200]">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-12 max-w-4xl"
              >
                  <div className="space-y-4">
                      <span className="inline-block px-8 py-2 rounded-full bg-white/10 border border-white/20 text-2xl font-black uppercase tracking-[0.3em] mb-4">VILA</span>
                      <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight opacity-70">Gör er redo för</h2>
                      <h1 className="text-5xl md:text-8xl font-black text-primary uppercase tracking-tighter drop-shadow-2xl">
                          {nextBlock?.title}
                      </h1>
                  </div>

                  <div className="relative flex flex-col items-center">
                       <div className="font-mono text-[12rem] md:text-[18rem] font-black leading-none tabular-nums animate-pulse drop-shadow-2xl">
                          {formatSeconds(transitionTimeLeft)}
                       </div>
                  </div>

                  <div className="flex flex-col items-center gap-8">
                       <button 
                          onClick={handleStartNextBlock}
                          className="bg-white text-indigo-900 font-black py-6 px-16 rounded-[2.5rem] text-3xl shadow-[0_20px_50px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest border-b-8 border-gray-300"
                       >
                          Starta Nu
                       </button>
                       <button onClick={() => onFinish({ isNatural: false })} className="text-white/40 font-bold uppercase tracking-widest hover:text-white transition-colors">Avbryta passet</button>
                  </div>
              </motion.div>
          </div>
      );
  }

  return (
    <div 
        className={`fixed inset-0 w-full h-full overflow-hidden transition-colors duration-500 ${showFullScreenColor ? `${timerStyle.bg}` : 'bg-gray-100 dark:bg-black'}`}
        style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
        onClick={handleInteraction}
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
    >
      {showConfetti && <Confetti />}
      {showFinishAnimation && (
          <RaceFinishAnimation 
            winnerName={winnerName} 
            onDismiss={() => {
                setShowFinishAnimation(false);
                if (finalRaceId) onFinish({ isNatural: true, raceId: finalRaceId });
            }} 
          />
      )}
      
      <AnimatePresence>
        {status === TimerStatus.Paused && !showFinishAnimation && (
            <PauseOverlay 
                onResume={resume}
                onRestart={handleConfirmReset}
                onFinish={() => onFinish({ isNatural: false })}
            />
        )}
        
        {participantToEdit && (
            <EditResultModal 
                participantName={participantToEdit}
                currentTime={finishedParticipants[participantToEdit]?.time || 0}
                onSave={handleUpdateResult}
                onAddPenalty={handleAddPenalty}
                onUndo={handleRemoveResult}
                onCancel={() => setParticipantToEdit(null)}
            />
        )}
        {showResetConfirmation && <RaceResetConfirmationModal onConfirm={handleConfirmReset} onCancel={() => setShowResetConfirmation(false)} onExit={() => onFinish({ isNatural: false })} />}
        {showBackToPrepConfirmation && <RaceBackToPrepConfirmationModal onConfirm={onBackToGroups} onCancel={() => setShowBackToPrepConfirmation(false)} />}
        
        {/* Next Block Banner */}
        {block.autoAdvance && nextBlock && status === TimerStatus.Running && currentTime <= 30 && (
            <ComingUpBanner block={block} transitionTime={block.transitionTime} nextBlockTitle={nextBlock.title} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status !== TimerStatus.Idle && status !== TimerStatus.Paused && !showFinishAnimation && (
            <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute top-16 z-[100]"
                style={{ right: isHyroxRace ? `calc(${HYROX_RIGHT_PANEL_WIDTH} + 2.5rem)` : '2.5rem' }}
            >
                <BigRoundIndicator 
                    currentRound={currentRound} 
                    totalRounds={totalRounds} 
                    mode={block.settings.mode} 
                    currentInterval={currentIntervalInLap}
                    totalIntervalsInLap={effectiveIntervalsPerLap}
                />
            </motion.div>
        )}
      </AnimatePresence>

      <div 
          className={`absolute flex flex-col items-center transition-all duration-500 z-10 left-0 
              ${isHyroxRace ? `right-[${HYROX_RIGHT_PANEL_WIDTH}] pr-10` : 'right-0'} 
              ${showFullScreenColor 
                  ? `top-[12%] min-h-[50%] justify-center` 
                  : `pt-10 pb-10 top-4 min-h-[22%] mx-4 sm:mx-6 rounded-[2.5rem] shadow-2xl ${timerStyle.bg}`
              }`}
          style={!showFullScreenColor ? { '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties : undefined}
      >
        <div className="mb-4 px-8 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 shadow-lg z-20">
            <span className={`font-black tracking-[0.2em] text-white uppercase drop-shadow-md text-xl md:text-2xl`}>{modeLabel}</span>
        </div>

        <div className="text-center z-20 w-full px-10 mb-2">
            <h2 className={`font-black text-white tracking-widest uppercase drop-shadow-xl animate-pulse w-full text-center text-5xl sm:text-7xl`}>{statusLabel}</h2>
        </div>

        <div className="z-20 relative flex flex-col items-center w-full text-white">
            <div className="flex items-center justify-center w-full gap-2">
                 <span className="font-mono font-black leading-none tracking-tighter tabular-nums drop-shadow-2xl select-none text-[8rem] sm:text-[10rem] md:text-[12rem]">
                    {minutesStr}:{secondsStr}
                 </span>
            </div>
            
            {/* Total Chain Progress */}
            {chainInfo && (
                <div className="w-[80%] max-w-4xl mt-6">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Del {chainInfo.currentBlockInChain} av {chainInfo.totalBlocksInChain}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Totaltid: {formatSeconds(totalChainElapsed)} / {formatSeconds(chainInfo.totalChainTime)}</span>
                    </div>
                    <div className="h-5 bg-black/20 rounded-full overflow-hidden border border-white/10 p-1">
                        <div 
                            className="h-full bg-white rounded-full transition-[width] duration-1000 ease-linear shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
                            style={{ width: `${(totalChainElapsed / chainInfo.totalChainTime) * 100}%` }} 
                        />
                    </div>
                </div>
            )}
        </div>

        <div className="text-center z-20 w-full px-10 mt-2">
            <h1 className="font-black text-white/90 uppercase tracking-tighter text-2xl sm:text-3xl md:text-4xl drop-shadow-lg truncate py-2">{block.title}</h1>
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 flex flex-col items-center justify-start px-4 z-0 pt-8
          ${showFullScreenColor ? 'top-[65%]' : 'top-[31%]'} 
          ${isHyroxRace ? `right-[${HYROX_RIGHT_PANEL_WIDTH}] pr-10` : 'right-0'}`}>
          
          <div className="w-full max-w-7xl flex flex-col items-center gap-8 h-full">
              <AnimatePresence>
                  {isHyroxRace && groupForCountdownDisplay && (
                      <NextStartIndicator 
                          groupName={groupForCountdownDisplay.name}
                          timeLeft={timeForCountdownDisplay}
                          groupsLeft={remainingGroupsCount}
                      />
                  )}
              </AnimatePresence>

              {block.showDescriptionInTimer && block.setupDescription && (
                  <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-8 py-6 bg-white/95 dark:bg-gray-900 border-2 border-primary/20 dark:border-white/10 w-full max-w-5xl flex items-center gap-6 shadow-2xl z-10 rounded-[2.5rem]"
                  >
                      <div className="bg-primary/10 p-3 rounded-2xl">
                        <InformationCircleIcon className="w-8 h-8 text-primary shrink-0" />
                      </div>
                      <p className="text-gray-900 dark:text-white text-2xl md:text-3xl font-black leading-tight">
                          {block.setupDescription}
                      </p>
                  </motion.div>
              )}

              <div className="w-full flex justify-center items-start flex-grow"> 
                  {block.followMe ? (
                      <FollowMeView exercise={currentExercise} nextExercise={nextExercise} timerStyle={timerStyle} status={status} />
                  ) : (
                      !isFreestanding && (
                          <StandardListView exercises={block.exercises} timerStyle={timerStyle} />
                      )
                  )}
              </div>
          </div>
      </div>

      {isHyroxRace && (
          <div 
              className="absolute top-0 right-0 bottom-0 border-l-4 border-gray-200 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md flex flex-col z-40 shadow-2xl"
              style={{ width: HYROX_RIGHT_PANEL_WIDTH }}
          >
              <ParticipantFinishList 
                participants={startedParticipants} 
                finishData={finishedParticipants} 
                onFinish={handleParticipantFinish} 
                onEdit={handleEditParticipant} 
                isSaving={(name) => savingParticipant === name} 
              />
              
              <div className="p-6 mt-auto bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-white/10">
                 <button 
                    onClick={handleRaceComplete}
                    disabled={isSavingRace || startedParticipants.length === 0}
                    className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-tight disabled:opacity-50 ${isClockFrozen ? 'bg-green-600 hover:bg-green-500 shadow-green-500/20 text-white' : 'bg-primary hover:brightness-110 shadow-primary/20 text-white'}`}
                 >
                    {isSavingRace ? (
                        <>
                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Sparar...</span>
                        </>
                    ) : (
                        <>
                            <span>{isClockFrozen ? 'Slutför & Spara lopp' : 'Avsluta lopp i förtid'}</span>
                        </>
                    )}
                 </button>
              </div>
          </div>
      )}

      <div className={`fixed z-50 transition-all duration-500 flex gap-6 left-1/2 -translate-x-1/2 ${showFullScreenColor ? 'top-[65%]' : 'top-[31%]'} ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'} ${isHyroxRace ? 'ml-[-225px]' : ''}`}>
            {status === TimerStatus.Idle || status === TimerStatus.Finished ? (
                <>
                    <button onClick={() => onFinish({ isNatural: false })} className="bg-gray-600/80 text-white font-bold py-4 px-10 rounded-full shadow-xl hover:bg-gray-500 transition-colors text-xl backdrop-blur-md border-2 border-white/20">TILLBAKA</button>
                    <button onClick={() => start()} className="bg-white text-black font-black py-4 px-16 rounded-full shadow-2xl hover:scale-105 transition-transform text-xl border-4 border-white/50">STARTA</button>
                </>
            ) : status === TimerStatus.Paused ? (
                <button onClick={resume} className="bg-green-500 text-white font-bold py-4 px-10 rounded-full shadow-xl border-2 border-green-400">FORTSÄTT</button>
            ) : (
                <button onClick={pause} className="bg-white text-gray-900 font-black py-4 px-16 rounded-full shadow-2xl hover:bg-gray-100 transition-transform hover:scale-105 text-xl border-4 border-white/50">PAUSA</button>
            )}
            {isHyroxRace && status !== TimerStatus.Running && <button onClick={() => setShowBackToPrepConfirmation(true)} className="bg-gray-800/80 text-white font-bold py-4 px-8 rounded-full shadow-xl border-2 border-gray-600 hover:bg-gray-700 transition-colors text-lg">⚙️ Grupper</button>}
      </div>

      {/* --- IDÉ-TAVLAN KOMPAKT TIMER LOGIK --- */}
      {/* (Vi använder inte CompactTimer här men behåller referens för konsekvens) */}
    </div>
  );
};
