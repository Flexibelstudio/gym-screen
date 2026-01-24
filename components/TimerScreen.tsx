
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutBlock, TimerStatus, TimerMode, Exercise, StartGroup, Organization, HyroxRace, Workout } from '../types';
import { useWorkoutTimer, playShortBeep, getAudioContext, calculateBlockDuration } from '../hooks/useWorkoutTimer';
import { useWorkout } from '../context/WorkoutContext';
import { saveRace, updateOrganizationActivity } from '../services/firebaseService';
import { Confetti } from './WorkoutCompleteModal';
import { EditResultModal, RaceResetConfirmationModal, RaceBackToPrepConfirmationModal, RaceFinishAnimation, PauseOverlay } from './timer/TimerModals';
import { ParticipantFinishList } from './timer/ParticipantFinishList';
import { DumbbellIcon, InformationCircleIcon, LightningIcon, SparklesIcon, ChevronRightIcon, ClockIcon } from './icons';

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

const NextBlockPreview: React.FC<{ block: WorkoutBlock }> = ({ block }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="h-full flex flex-col bg-black/30 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl"
        >
            <div className="p-6 bg-white/5 border-b border-white/5">
                <span className="inline-block px-3 py-1 rounded-lg bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-2">NÄSTA DEL</span>
                <h4 className="text-2xl font-black text-white uppercase tracking-tight line-clamp-1">{block.title}</h4>
                <div className="flex items-center gap-2 mt-2 text-white/50 text-xs font-bold uppercase tracking-wider">
                    <ClockIcon className="w-3.5 h-3.5" />
                    <span>{block.settings.mode}</span>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto p-6 custom-scrollbar space-y-3">
                {block.exercises.map((ex, i) => (
                    <div key={ex.id} className="flex justify-between items-start gap-3 border-b border-white/5 pb-2 last:border-0">
                        <p className="text-sm font-bold text-white/80 leading-tight truncate">{ex.name}</p>
                        {ex.reps && <span className="text-[10px] font-black text-primary whitespace-nowrap">{ex.reps}</span>}
                    </div>
                ))}
                {block.exercises.length === 0 && <p className="text-white/30 italic text-sm">Inga övningar angivna.</p>}
            </div>
        </motion.div>
    );
};

const SegmentedRoadmap: React.FC<{ 
    chain: WorkoutBlock[]; 
    currentBlockId: string; 
    totalChainElapsed: number;
    totalChainTime: number;
    timerStyle: TimerStyle;
}> = ({ chain, currentBlockId, totalChainElapsed, totalChainTime, timerStyle }) => {
    let accumulatedTime = 0;
    
    return (
        <div className="w-full flex items-end gap-1.5 h-10 px-2">
            {chain.map((b, i) => {
                const bDur = calculateBlockDuration(b.settings, b.exercises.length);
                const transTime = (i < chain.length - 1) ? (b.transitionTime || 0) : 0;
                const segmentTotal = bDur + transTime;
                const widthPercent = (segmentTotal / totalChainTime) * 100;
                const isActive = b.id === currentBlockId;
                
                // Calculate progress within this specific segment
                const segmentStart = accumulatedTime;
                const segmentEnd = accumulatedTime + segmentTotal;
                let segmentProgress = 0;
                if (totalChainElapsed > segmentEnd) segmentProgress = 100;
                else if (totalChainElapsed > segmentStart) segmentProgress = ((totalChainElapsed - segmentStart) / segmentTotal) * 100;
                
                accumulatedTime += segmentTotal;

                return (
                    <div 
                        key={b.id} 
                        style={{ width: `${widthPercent}%` }} 
                        className="flex flex-col gap-1.5 group"
                    >
                        <span className={`text-[8px] font-black uppercase tracking-widest truncate transition-opacity duration-500 ${isActive ? 'text-white opacity-100' : 'text-white/30 opacity-0 group-hover:opacity-100'}`}>
                            {b.title}
                        </span>
                        <div className={`h-2.5 rounded-full overflow-hidden bg-white/10 border border-white/5 relative`}>
                            <motion.div 
                                className={`absolute inset-0 transition-colors duration-500 ${isActive ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-white/40'}`}
                                style={{ width: `${segmentProgress}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
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
                className={`w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border-l-[20px] ${isResting ? 'border-teal-400' : timerStyle.border.replace('border-', 'border-')}`}
                style={{ borderColor: isResting ? undefined : `rgb(${timerStyle.pulseRgb})` }}
            >
                <div className="p-8 md:p-12 flex flex-col items-center text-center">
                    <span className="block text-lg md:text-xl font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-2">
                        {label}
                    </span>
                    <h3 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white leading-tight mb-4 tracking-tight">
                        {displayExercise.name}
                    </h3>
                    {displayExercise.reps && (
                        <p className="text-3xl md:text-5xl font-black text-primary mb-4">{formatReps(displayExercise.reps)}</p>
                    )}
                    {displayExercise.description && (
                        <p className="text-gray-600 dark:text-gray-300 text-xl md:text-2xl leading-relaxed max-w-4xl font-medium line-clamp-3">
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
    let titleSize = 'text-2xl';
    let repsSize = 'text-lg';
    let padding = 'px-5 py-3';
    let gap = 'gap-2';

    if (count <= 4) {
        titleSize = 'text-3xl md:text-4xl';
        repsSize = 'text-xl md:text-2xl';
        padding = 'px-7 py-5';
        gap = 'gap-4';
    } else if (count <= 7) {
        titleSize = 'text-2xl md:text-3xl';
        repsSize = 'text-lg md:text-xl';
        gap = 'gap-3';
    }

    return (
        <div className={`w-full flex-1 flex flex-col ${gap} overflow-y-auto pb-4 custom-scrollbar`}>
            {exercises.map((ex) => (
                <div 
                    key={ex.id} 
                    className={`flex-1 min-h-[80px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl ${padding} flex flex-col justify-center border-l-[8px] shadow-lg transition-all relative group`}
                    style={{ borderLeftColor: `rgb(${timerStyle.pulseRgb})` }}
                >
                    <div className="flex justify-between items-center w-full gap-6">
                        <h4 className={`font-black text-gray-900 dark:text-white leading-none tracking-tight ${titleSize}`}>
                            {ex.name}
                        </h4>
                        {ex.reps && (
                            <span className={`font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm flex-shrink-0 border border-gray-200 dark:border-gray-700 ${repsSize}`}>
                                {formatReps(ex.reps)}
                            </span>
                        )}
                    </div>
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
    if (mode !== TimerMode.Interval && mode !== TimerMode.Tabata && mode !== TimerMode.EMOM) return null;

    const showInterval = currentInterval !== undefined && totalIntervalsInLap !== undefined && mode !== TimerMode.EMOM;

    return (
        <div className="flex flex-col items-end gap-3 animate-fade-in">
            {showInterval && (
                <div className="bg-black/40 backdrop-blur-xl rounded-[2.5rem] px-8 py-5 shadow-2xl flex flex-col items-center min-w-[180px]">
                    <span className="block text-white/40 font-black text-[10px] uppercase tracking-[0.4em] mb-2">INTERVALL</span>
                    <div className="flex items-baseline justify-center gap-1">
                        <motion.span 
                            key={`interval-${currentInterval}`} 
                            initial={{ opacity: 0, scale: 0.8 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            className="font-black text-5xl text-white drop-shadow-2xl leading-none"
                        >
                            {currentInterval}
                        </motion.span>
                        <span className="text-xl font-black text-white/40">/ {totalIntervalsInLap}</span>
                    </div>
                </div>
            )}

            <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-xl rounded-full px-5 py-2.5 shadow-xl flex items-center justify-center gap-3 min-w-[130px]"
            >
                <span className="text-white/40 font-black text-[9px] uppercase tracking-[0.3em]">
                    {mode === TimerMode.EMOM ? 'MINUT' : 'VARV'}
                </span>
                <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white">{currentRound}</span>
                    <span className="text-xs font-bold text-white/40">/ {totalRounds}</span>
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

  // Calculate current chain blocks
  const workoutChain = useMemo(() => {
      if (!activeWorkout) return [block];
      const index = activeWorkout.blocks.findIndex(b => b.id === block.id);
      if (index === -1) return [block];

      let startIdx = index;
      while (startIdx > 0 && activeWorkout.blocks[startIdx-1].autoAdvance) startIdx--;
      let endIdx = index;
      while (endIdx < activeWorkout.blocks.length - 1 && activeWorkout.blocks[endIdx].autoAdvance) endIdx++;

      return activeWorkout.blocks.slice(startIdx, endIdx + 1);
  }, [activeWorkout, block]);

  const chainInfo = useMemo(() => {
      let totalDuration = 0;
      let elapsedTimeBeforeCurrent = 0;
      const currentIdxInChain = workoutChain.findIndex(b => b.id === block.id);
      
      workoutChain.forEach((b, i) => {
          const bDur = calculateBlockDuration(b.settings, b.exercises.length);
          const transTime = (i < workoutChain.length - 1) ? (b.transitionTime || 0) : 0;
          
          totalDuration += bDur + transTime;
          
          if (i < currentIdxInChain) {
              elapsedTimeBeforeCurrent += bDur + transTime;
          }
      });

      return {
          totalDuration,
          elapsedTimeBeforeCurrent,
          currentBlockInChain: currentIdxInChain + 1,
          totalBlocksInChain: workoutChain.length
      };
  }, [workoutChain, block.id]);

  const totalChainElapsed = useMemo(() => {
      return chainInfo.elapsedTimeBeforeCurrent + totalTimeElapsed;
  }, [chainInfo, totalTimeElapsed]);

  const handleStartNextBlock = useCallback(() => {
      if (transitionIntervalRef.current) clearInterval(transitionIntervalRef.current);
      setIsTransitioning(false);
      if (nextBlock) onFinish({ isNatural: true, time: totalTimeElapsed }); 
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
    if (lastBlockIdRef.current !== block.id) {
        hasStartedRef.current = false;
        lastBlockIdRef.current = block.id;
    }
    if (!hasStartedRef.current && (status === TimerStatus.Idle || status === TimerStatus.Finished)) {
        if (organization) updateOrganizationActivity(organization.id);
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

  const nextGroupToStart = useMemo(() => startGroups.find(g => g.startTime === undefined), [startGroups]);
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

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sv-SE'; 
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!isHyroxRace || !groupForCountdownDisplay || (status !== TimerStatus.Running && status !== TimerStatus.Preparing)) return;
    const timeLeft = timeForCountdownDisplay;
    if (timeLeft === 60) speak(`${groupForCountdownDisplay.name} startar om en minut`);
    else if (timeLeft === 30) speak("30 sekunder till start");
    else if (timeLeft === 10) speak("10 sekunder");
    else if (timeLeft <= 5 && timeLeft > 0) speak(String(timeLeft)); 
    else if (timeLeft === 0) speak(`Kör ${groupForCountdownDisplay.name}!`); 
  }, [timeForCountdownDisplay, groupForCountdownDisplay, speak, isHyroxRace, status]);

  const handleConfirmReset = () => {
    setShowResetConfirmation(false);
    window.speechSynthesis.cancel();
    setFinishedParticipants({});
    setIsClockFrozen(false);
    setFrozenTime(0);
    start();
  };

  useEffect(() => {
    if (isHyroxRace) {
        if (activeWorkout?.startGroups && activeWorkout.startGroups.length > 0) {
            setStartGroups(activeWorkout.startGroups.map((g, index) => ({ ...g, startTime: index === 0 ? 0 : undefined })));
        } else if (activeWorkout) { 
            setStartGroups([{ id: `group-${Date.now()}`, name: 'Startgrupp 1', participants: (activeWorkout.participants || []).join('\n'), startTime: 0 }]);
        }
    }
  }, [isHyroxRace, activeWorkout]);

  useEffect(() => {
      if (!isHyroxRace || (status !== TimerStatus.Running && status !== TimerStatus.Preparing)) return;
      const groupsToStart = startGroups.filter((group, index) => { const expectedStartTime = index * startIntervalSeconds; return group.startTime === undefined && totalTimeElapsed >= expectedStartTime; });
      if (groupsToStart.length > 0) {
          setStartGroups(prevGroups => {
              const newGroups = [...prevGroups];
              groupsToStart.forEach(groupToStart => {
                  const index = newGroups.findIndex(g => g.id === groupToStart.id);
                  if (index !== -1) newGroups[index] = { ...newGroups[index], startTime: index * startIntervalSeconds };
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
        if (!isHyroxRace || !activeWorkout || !organization) return; 
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
            }
        } catch (error) {
            console.error("Failed to save race:", error);
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
  
  const modeLabel = useMemo(() => {
      if (isHyroxRace) return "RACE";
      switch(block.settings.mode) {
          case TimerMode.Interval: return "INTERVALLER";
          case TimerMode.Tabata: return "TABATA";
          case TimerMode.AMRAP: return "AMRAP";
          case TimerMode.EMOM: return "EMOM";
          case TimerMode.TimeCap: return "TIME CAP";
          case TimerMode.Stopwatch: return "STOPPUR";
          default: return (block.settings.mode as string).toUpperCase();
      }
  }, [block.settings.mode, isHyroxRace]);

  const statusLabel = useMemo(() => {
      if (isTransitioning) return "NÄSTA DEL OM...";
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
  }, [status, isHyroxRace, isTransitioning]);

  const timeToDisplay = useMemo(() => {
      if (isTransitioning) return transitionTimeLeft;
      if (status === TimerStatus.Preparing) return currentTime;
      if (isHyroxRace && isClockFrozen) return frozenTime;
      if (isHyroxRace || block.settings.mode === TimerMode.Stopwatch) return totalTimeElapsed;
      if (!block.settings.direction || block.settings.direction === 'down') return currentTime;
      return currentPhaseDuration - currentTime;
  }, [status, currentTime, isHyroxRace, block.settings.mode, block.settings.direction, currentPhaseDuration, totalTimeElapsed, isClockFrozen, frozenTime, isTransitioning, transitionTimeLeft]);

  const minutesStr = Math.floor(timeToDisplay / 60).toString().padStart(2, '0');
  const secondsStr = (timeToDisplay % 60).toString().padStart(2, '0');

  const currentIntervalInLap = (completedWorkIntervals % effectiveIntervalsPerLap) + 1;

  const showSplitView = !!nextBlock && block.autoAdvance;

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
            <PauseOverlay onResume={resume} onRestart={handleConfirmReset} onFinish={() => onFinish({ isNatural: false })} />
        )}
        
        {participantToEdit && (
            <EditResultModal 
                participantName={participantToEdit}
                currentTime={finishedParticipants[participantToEdit]?.time || 0}
                onSave={(t) => { setFinishedParticipants(p => ({...p, [participantToEdit]: {...p[participantToEdit], time: t}})); setParticipantToEdit(null); }}
                onAddPenalty={() => { setFinishedParticipants(p => ({...p, [participantToEdit]: {...p[participantToEdit], time: p[participantToEdit].time + 60}})); setParticipantToEdit(null); }}
                onUndo={() => { setFinishedParticipants(p => { const n = {...p}; delete n[participantToEdit]; return n; }); setParticipantToEdit(null); }}
                onCancel={() => setParticipantToEdit(null)}
            />
        )}
        {showResetConfirmation && <RaceResetConfirmationModal onConfirm={handleConfirmReset} onCancel={() => setShowResetConfirmation(false)} onExit={() => onFinish({ isNatural: false })} />}
        {showBackToPrepConfirmation && <RaceBackToPrepConfirmationModal onConfirm={onBackToGroups} onCancel={() => setShowBackToPrepConfirmation(false)} />}
      </AnimatePresence>

      {/* ROADMAP / PROGRESS CHAIN (Visible at bottom) */}
      <div className="absolute bottom-6 left-0 right-0 z-50">
        <div className={`mx-auto transition-all duration-500 ${isHyroxRace ? `pr-[${HYROX_RIGHT_PANEL_WIDTH}]` : 'max-w-7xl'}`}>
            <SegmentedRoadmap 
                chain={workoutChain} 
                currentBlockId={block.id} 
                totalChainElapsed={totalChainElapsed} 
                totalChainTime={chainInfo.totalDuration}
                timerStyle={timerStyle}
            />
        </div>
      </div>

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
                  : `pt-8 pb-8 top-4 min-h-[20%] mx-4 sm:mx-6 rounded-[2.5rem] shadow-2xl ${timerStyle.bg}`
              }`}
          style={!showFullScreenColor ? { '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties : undefined}
      >
        <div className="mb-4 px-6 py-1.5 rounded-full bg-black/30 backdrop-blur-xl border border-white/20 shadow-lg z-20">
            <span className={`font-black tracking-[0.2em] text-white uppercase drop-shadow-md text-lg md:text-xl`}>{modeLabel}</span>
        </div>

        <div className="text-center z-20 w-full px-10 mb-1">
            <h2 className={`font-black text-white tracking-widest uppercase drop-shadow-xl animate-pulse w-full text-center text-4xl sm:text-6xl`}>{statusLabel}</h2>
        </div>

        <div className="z-20 relative flex flex-col items-center w-full text-white">
            <div className="flex items-center justify-center w-full gap-2">
                 <span className="font-mono font-black leading-none tracking-tighter tabular-nums drop-shadow-2xl select-none text-[9rem] sm:text-[11rem] md:text-[13rem]">
                    {minutesStr}:{secondsStr}
                 </span>
            </div>
        </div>

        <div className="text-center z-20 w-full px-10 mt-1">
            <h1 className="font-black text-white/90 uppercase tracking-tighter text-xl sm:text-2xl md:text-3xl drop-shadow-lg truncate py-2">{block.title}</h1>
        </div>
      </div>

      {/* CONTENT AREA (Under Clock) */}
      <div className={`absolute bottom-20 left-0 flex flex-col items-center justify-start px-4 z-0 pt-8
          ${showFullScreenColor ? 'top-[65%]' : 'top-[31%]'} 
          ${isHyroxRace ? `right-[${HYROX_RIGHT_PANEL_WIDTH}] pr-10` : 'right-0'}`}>
          
          <div className="w-full max-w-[1400px] flex gap-8 h-full">
              {/* CURRENT BLOCK VIEW (65% width if nextBlock exists) */}
              <div className={`flex flex-col gap-6 transition-all duration-500 ${showSplitView ? 'w-2/3' : 'w-full mx-auto max-w-5xl'}`}>
                  <AnimatePresence>
                      {isHyroxRace && groupForCountdownDisplay && (
                          <NextStartIndicator groupName={groupForCountdownDisplay.name} timeLeft={timeForCountdownDisplay} groupsLeft={remainingGroupsCount} />
                      )}
                  </AnimatePresence>

                  {block.showDescriptionInTimer && block.setupDescription && !isTransitioning && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 py-4 bg-white/95 dark:bg-gray-900 border-2 border-primary/20 dark:border-white/10 w-full flex items-center gap-4 shadow-xl rounded-[2rem]">
                          <div className="bg-primary/10 p-2.5 rounded-xl"><InformationCircleIcon className="w-6 h-6 text-primary shrink-0" /></div>
                          <p className="text-gray-900 dark:text-white text-xl md:text-2xl font-black leading-tight">{block.setupDescription}</p>
                      </motion.div>
                  )}

                  <div className="w-full flex justify-center items-start flex-grow"> 
                      {block.followMe ? (
                          <FollowMeView exercise={currentExercise} nextExercise={nextExercise} timerStyle={timerStyle} status={status} />
                      ) : (
                          !isFreestanding && <StandardListView exercises={block.exercises} timerStyle={timerStyle} />
                      )}
                  </div>
              </div>

              {/* NEXT BLOCK PREVIEW (35% width) */}
              {showSplitView && (
                  <div className="w-1/3 pb-4">
                      <NextBlockPreview block={nextBlock!} />
                  </div>
              )}
          </div>
      </div>

      {isHyroxRace && (
          <div className="absolute top-0 right-0 bottom-0 border-l-4 border-gray-200 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md flex flex-col z-40 shadow-2xl" style={{ width: HYROX_RIGHT_PANEL_WIDTH }}>
              <ParticipantFinishList participants={startedParticipants} finishData={finishedParticipants} onFinish={handleParticipantFinish} onEdit={setParticipantToEdit} isSaving={(name) => savingParticipant === name} />
              <div className="p-6 mt-auto bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-white/10">
                 <button onClick={handleRaceComplete} disabled={isSavingRace || startedParticipants.length === 0} className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-tight disabled:opacity-50 ${isClockFrozen ? 'bg-green-600 hover:bg-green-500 shadow-green-500/20 text-white' : 'bg-primary hover:brightness-110 shadow-primary/20 text-white'}`}>
                    {isSavingRace ? <><div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div><span>Sparar...</span></> : <span>{isClockFrozen ? 'Slutför & Spara lopp' : 'Avsluta lopp i förtid'}</span>}
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
      </div>
    </div>
  );
};
