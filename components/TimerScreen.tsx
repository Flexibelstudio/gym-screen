
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutBlock, TimerStatus, TimerMode, Exercise, StartGroup, Organization, HyroxRace, Workout } from '../types';
import { useWorkoutTimer, playBeep, getAudioContext } from '../hooks/useWorkoutTimer';
import { useRaceLogic } from '../hooks/useRaceLogic';
import { useWorkout } from '../context/WorkoutContext';
import { saveRace, updateOrganizationActivity } from '../services/firebaseService';
import { Confetti } from './WorkoutCompleteModal';
import { EditResultModal, RaceResetConfirmationModal, RaceBackToPrepConfirmationModal, RaceFinishAnimation } from './timer/TimerModals';
import { ParticipantFinishList } from './timer/ParticipantFinishList';
import { DumbbellIcon } from './icons';

// --- Helper Components & Interfaces ---

interface TimerStyle {
  bg: string;
  text: string; // Text color class
  pulseRgb: string; // RGB values for CSS variable
  border: string; // Border color class
  badge: string; // Badge/Circle bg color class
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
        case TimerMode.Interval:
          return { bg: 'bg-orange-500', text: 'text-white', pulseRgb: '249, 115, 22', border: 'border-orange-300', badge: 'bg-orange-600' };
        case TimerMode.Tabata:
          return { bg: 'bg-red-500', text: 'text-white', pulseRgb: '239, 68, 68', border: 'border-red-300', badge: 'bg-red-600' };
        case TimerMode.AMRAP:
          return { bg: 'bg-pink-600', text: 'text-white', pulseRgb: '219, 39, 119', border: 'border-pink-300', badge: 'bg-pink-700' };
        case TimerMode.EMOM:
          return { bg: 'bg-purple-600', text: 'text-white', pulseRgb: '147, 51, 234', border: 'border-purple-300', badge: 'bg-purple-700' };
        case TimerMode.TimeCap:
          return { bg: 'bg-indigo-600', text: 'text-white', pulseRgb: '79, 70, 229', border: 'border-indigo-300', badge: 'bg-indigo-700' };
        case TimerMode.Stopwatch:
          return { bg: 'bg-green-600', text: 'text-white', pulseRgb: '22, 163, 74', border: 'border-green-300', badge: 'bg-green-700' };
        default:
          return { bg: 'bg-orange-500', text: 'text-white', pulseRgb: '249, 115, 22', border: 'border-orange-300', badge: 'bg-orange-600' };
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

// --- Visualization Components ---

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
    timerStyle: TimerStyle,
    isHyroxRace?: boolean,
    isCompressing?: boolean
}> = ({ exercises, timerStyle, isHyroxRace, isCompressing }) => {
    const count = exercises.length;
    
    // Scale fonts for high-density Hyrox view
    let titleSize = isHyroxRace ? (isCompressing ? 'text-xl' : 'text-2xl') : 'text-3xl';
    let repsSize = isHyroxRace ? (isCompressing ? 'text-lg' : 'text-xl') : 'text-xl';
    let padding = isHyroxRace ? (isCompressing ? 'px-4 py-1' : 'px-5 py-2') : 'px-6 py-4';
    let gap = isHyroxRace ? 'gap-1' : 'gap-3';
    let showDesc = !isHyroxRace; 

    // Regular scaling for non-Hyrox
    if (!isHyroxRace) {
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
            showDesc = false;
        }
    }

    return (
        <div className={`w-full max-w-6xl h-full flex flex-col ${gap} ${isHyroxRace ? 'overflow-hidden' : 'overflow-y-auto pb-4'}`}>
            {exercises.map((ex, index) => (
                <div 
                    key={ex.id} 
                    className={`flex-1 min-h-0 bg-white dark:bg-gray-900 rounded-lg ${padding} flex flex-col justify-center border-l-[8px] shadow-sm transition-all relative group`}
                    style={{ borderLeftColor: `rgb(${timerStyle.pulseRgb})` }}
                >
                    <div className="flex justify-between items-center w-full gap-4">
                        <div className="flex items-center gap-3">
                            {isHyroxRace && (
                                <span className="text-gray-400 font-bold text-sm w-4">{index + 1}</span>
                            )}
                            <h4 className={`font-black text-gray-900 dark:text-white leading-none tracking-tight truncate ${titleSize}`}>
                                {ex.name}
                            </h4>
                        </div>
                        {ex.reps && (
                            <span className={`font-mono font-bold text-primary whitespace-nowrap flex-shrink-0 ${repsSize}`}>
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

const CircuitView: React.FC<{ 
    exercises: Exercise[], 
    timerStyle: TimerStyle 
}> = ({ exercises, timerStyle }) => {
    return (
        <div className="w-full max-w-[1600px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[45vh] overflow-y-auto pr-2 scrollbar-hide">
            {exercises.map((ex, index) => (
                <div 
                    key={ex.id} 
                    className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg flex items-center gap-5 border border-transparent"
                >
                    <div 
                        className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-3xl flex-shrink-0 shadow-lg"
                        style={{ backgroundColor: `rgb(${timerStyle.pulseRgb})` }}
                    >
                        {index + 1}
                    </div>
                    <div className="flex-grow min-w-0">
                        <h4 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white leading-tight truncate">
                            {ex.name}
                        </h4>
                        {ex.reps ? (
                            <p className="text-xl font-bold text-gray-600 dark:text-gray-300 mt-1">{formatReps(ex.reps)}</p>
                        ) : (
                            <p className="text-base text-gray-500 dark:text-gray-400 mt-1 truncate">Station {index + 1}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

interface BigRoundIndicatorProps {
    currentRound: number;
    totalRounds: number;
    mode: TimerMode;
    currentInterval?: number;
    intervalsPerRound?: number;
    specifiedLaps?: number;
}

const BigRoundIndicator: React.FC<BigRoundIndicatorProps> = ({ 
    currentRound, totalRounds, mode, currentInterval, intervalsPerRound, specifiedLaps 
}) => {
    const isRelevantMode = [TimerMode.Interval, TimerMode.Tabata, TimerMode.EMOM].includes(mode);
    if (!isRelevantMode) return null;

    if (mode === TimerMode.EMOM) {
         return (
            <div className="mt-4 flex flex-col items-center z-20">
                <div className="bg-black/20 backdrop-blur-md rounded-2xl px-6 py-2 border border-white/10 shadow-xl">
                    <div className="flex items-baseline justify-center gap-2">
                        <span className="text-white/70 font-bold text-sm uppercase tracking-[0.2em]">MINUT</span>
                        <motion.span 
                            key={currentRound}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="font-black text-4xl text-white leading-none"
                        >
                            {currentRound}
                        </motion.span>
                        <span className="text-lg font-bold text-white/60">/ {totalRounds}</span>
                    </div>
                </div>
            </div>
         );
    }

    if (specifiedLaps !== undefined && currentInterval !== undefined && intervalsPerRound !== undefined) {
        return (
            <div className="mt-4 flex items-center gap-3 z-20">
                <div className="bg-black/20 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 shadow-xl flex items-baseline gap-2">
                    <span className="text-white/70 font-bold text-xs uppercase tracking-widest">VARV</span>
                    <span className="font-black text-2xl text-white">{currentRound} / {totalRounds}</span>
                </div>
                <div className="bg-black/20 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 shadow-xl flex items-baseline gap-2">
                    <span className="text-white/70 font-bold text-xs uppercase tracking-widest">INT</span>
                    <span className="font-black text-2xl text-white">{currentInterval} / {intervalsPerRound}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 flex flex-col items-center z-20">
            <div className="bg-black/20 backdrop-blur-md rounded-xl px-6 py-2 border border-white/10 shadow-xl flex items-baseline gap-2">
                <span className="text-white/70 font-bold text-xs uppercase tracking-widest">RUNDA</span>
                <span className="font-black text-3xl text-white">{currentRound} / {totalRounds}</span>
            </div>
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
}

interface FinishData { time: number; placement: number | null; }

export const TimerScreen: React.FC<TimerScreenProps> = ({ 
    block, onFinish, onHeaderVisibilityChange, onShowImage,
    setCompletionInfo, setIsRegisteringHyroxTime,
    setIsBackButtonHidden, followMeShowImage, organization, onBackToGroups
}) => {
  const { activeWorkout } = useWorkout();
  const { 
    status, currentTime, currentRound, currentExercise, nextExercise,
    start, pause, resume, reset, 
    totalRounds, totalExercises, currentExerciseIndex,
    isLastExerciseInRound,
    totalBlockDuration, totalTimeElapsed,
    completedWorkIntervals, totalWorkIntervals
  } = useWorkoutTimer(block);
  
  const [controlsVisible, setControlsVisible] = React.useState(false);
  const hideTimeoutRef = React.useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!hasStartedRef.current && status === TimerStatus.Idle) {
        if (organization) updateOrganizationActivity(organization.id);
        start();
        hasStartedRef.current = true;
        onHeaderVisibilityChange(false);
        setIsBackButtonHidden(true);
    }
  }, [start, status, onHeaderVisibilityChange, setIsBackButtonHidden, organization]);

  const [viewMode, setViewMode] = useState<'standard' | 'circuit'>('standard');
  const [finishedParticipants, setFinishedParticipants] = useState<Record<string, FinishData>>({});
  const [savingParticipant, setSavingParticipant] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [participantToEdit, setParticipantToEdit] = useState<string | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showBackToPrepConfirmation, setShowBackToPrepConfirmation] = useState(false);
  const [showFinishAnimation, setShowFinishAnimation] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  
  const isHyroxRace = useMemo(() => activeWorkout?.id.startsWith('hyrox-full-race') || activeWorkout?.id.startsWith('custom-race'), [activeWorkout]);
  const isFreestanding = block.tag === 'Fristående';
  const showFullScreenColor = isFreestanding || isHyroxRace;

  const [startGroups, setStartGroups] = useState<StartGroup[]>([]);
  const startIntervalSeconds = useMemo(() => (activeWorkout?.startIntervalMinutes ?? 2) * 60, [activeWorkout]);

  const nextGroupToStartIndex = useMemo(() => startGroups.findIndex(g => g.startTime === undefined), [startGroups]);
  const nextGroupToStart = useMemo(() => (nextGroupToStartIndex !== -1 ? startGroups[nextGroupToStartIndex] : null), [startGroups, nextGroupToStartIndex]);

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
    if (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting) {
        requestWakeLock();
    } else {
        releaseWakeLock();
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting)) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [status, requestWakeLock, releaseWakeLock]);

  const stopAllAudio = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

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
    if (status === TimerStatus.Finished && !isHyroxRace && block.settings.mode !== TimerMode.Stopwatch) {
        if (hasCalledFinishRef.current) return;
        const timerId = setTimeout(() => {
            onFinish({ isNatural: true, time: totalTimeElapsed });
            hasCalledFinishRef.current = true;
        }, 500);
        return () => clearTimeout(timerId);
    } else if (status !== TimerStatus.Finished) {
        hasCalledFinishRef.current = false;
    }
  }, [status, isHyroxRace, block.settings.mode, onFinish, totalTimeElapsed]);

  const handleConfirmReset = () => {
    setShowResetConfirmation(false);
    stopAllAudio();
    setFinishedParticipants({});
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
        } else {
             setStartGroups([]);
        }
    } else {
        setStartGroups([]);
    }
  }, [isHyroxRace, activeWorkout]);

  useEffect(() => {
      if (!isHyroxRace || (status !== TimerStatus.Running && status !== TimerStatus.Preparing)) return;
      const groupsToStart = startGroups.filter((group, index) => {
          const expectedStartTime = index * startIntervalSeconds;
          return group.startTime === undefined && totalTimeElapsed >= expectedStartTime;
      });
      if (groupsToStart.length > 0) {
          setStartGroups(prevGroups => {
              const newGroups = [...prevGroups];
              groupsToStart.forEach(groupToStart => {
                  const index = newGroups.findIndex(g => g.id === groupToStart.id);
                  if (index !== -1) {
                      const expectedStartTime = index * startIntervalSeconds;
                      newGroups[index] = { ...newGroups[index], startTime: expectedStartTime };
                  }
              });
              return newGroups;
          });
      }
  }, [isHyroxRace, totalTimeElapsed, startGroups, status, startIntervalSeconds]);

  useEffect(() => {
      if (status === TimerStatus.Preparing) return;
      if (isHyroxRace && groupForCountdownDisplay && timeForCountdownDisplay > 0 && timeForCountdownDisplay <= 3) playBeep(880, 150, 'triangle');
  }, [isHyroxRace, timeForCountdownDisplay, groupForCountdownDisplay, status]);

  const allParticipants = useMemo(() => startGroups.flatMap(g => g.participants.split('\n').map(p => p.trim()).filter(Boolean)), [startGroups]);
  const startedParticipants = useMemo(() => startGroups.filter(g => g.startTime !== undefined).flatMap(g => g.participants.split('\n').map(p => p.trim()).filter(Boolean)), [startGroups]);
  
  const handleRaceComplete = useCallback(async () => {
        if (!isHyroxRace || !activeWorkout) { onFinish({ isNatural: true }); return; }
        const sortedFinishers = Object.entries(finishedParticipants).sort(([, a], [, b]) => (a as FinishData).time - (b as FinishData).time);
        const winner = sortedFinishers.length > 0 ? sortedFinishers[0][0] : null;
        setWinnerName(winner);
        setShowFinishAnimation(true);
        if (winner) speak(`Och vinnaren är ${winner}! Bra jobbat alla!`);
        const raceResults = sortedFinishers.map(([participant, data]) => {
            const group = startGroups.find(g => g.participants.includes(participant));
            return { participant, time: (data as FinishData).time, groupId: group?.id || 'unknown' };
        });
        try {
            const raceData: Omit<HyroxRace, 'id' | 'createdAt' | 'organizationId'> = {
                raceName: activeWorkout.title,
                exercises: block.exercises.map(e => `${e.reps || ''} ${e.name}`.trim()),
                startGroups: startGroups.map(g => ({ id: g.id, name: g.name, participants: g.participants.split('\n').map(p => p.trim()).filter(Boolean) })),
                results: raceResults
            };
            if (organization) {
               const savedRace = await saveRace(raceData, organization.id);
               setTimeout(() => { onFinish({ isNatural: true, raceId: savedRace.id }); }, 5000);
            } else {
               setTimeout(() => { onFinish({ isNatural: true }); }, 5000);
            }
        } catch (error) { console.error("Failed to save race results:", error); alert("Kunde inte spara loppet. Försök igen."); }
    }, [isHyroxRace, activeWorkout, finishedParticipants, block.exercises, startGroups, organization, onFinish, speak]);

  useRaceLogic(allParticipants.map(p => ({ isFinished: !!finishedParticipants[p] })), handleRaceComplete);

  const handleParticipantFinish = (participantName: string) => {
      if (savingParticipant) return;
      setSavingParticipant(participantName);
      const group = startGroups.find(g => g.participants.includes(participantName));
      if (group && group.startTime !== undefined) {
          const netTime = Math.max(0, totalTimeElapsed - group.startTime);
          setFinishedParticipants(prev => {
              const newParticipants = { ...prev };
              const currentFinishedCount = Object.keys(prev).length;
              newParticipants[participantName] = { time: netTime, placement: currentFinishedCount + 1 };
              return newParticipants;
          });
          setShowConfetti(true);
          speak(`Målgång ${participantName}!`);
          setTimeout(() => setShowConfetti(false), 3000);
      }
      setSavingParticipant(null);
  };

  const handleEditParticipant = (participantName: string) => { setParticipantToEdit(participantName); };
  const handleUpdateResult = (newTime: number) => {
        if (!participantToEdit) return;
        setFinishedParticipants(prev => ({ ...prev, [participantToEdit]: { ...prev[participantToEdit], time: newTime } }));
        setParticipantToEdit(null);
    };
    const handleAddPenalty = () => {
        if (!participantToEdit) return;
        setFinishedParticipants(prev => ({ ...prev, [participantToEdit]: { ...prev[participantToEdit], time: prev[participantToEdit].time + 60 } }));
        setParticipantToEdit(null); 
    };
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
        hideTimeoutRef.current = window.setTimeout(() => {
            setControlsVisible(false);
            onHeaderVisibilityChange(false);
            setIsBackButtonHidden(true);
        }, 3000); 
    }
  }, [status, onHeaderVisibilityChange, setIsBackButtonHidden]);

  useEffect(() => {
    if (controlsVisible) restartHideTimer();
    return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
  }, [controlsVisible, restartHideTimer]);

  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
        restartHideTimer();
    } else {
        setControlsVisible(true);
        onHeaderVisibilityChange(true);
        setIsBackButtonHidden(false);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    }
  }, [status, restartHideTimer, onHeaderVisibilityChange, setIsBackButtonHidden]);

  const handleInteraction = () => {
      setControlsVisible(true);
      onHeaderVisibilityChange(true);
      setIsBackButtonHidden(false);
      restartHideTimer();
  };

  const timerStyle = getTimerStyle(status, block.settings.mode, isHyroxRace);
  const progress = totalBlockDuration > 0 ? (totalTimeElapsed / totalBlockDuration) * 100 : 0;

  const modeLabel = useMemo(() => {
      if (isHyroxRace) return "TÄVLING";
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
              case TimerStatus.Preparing: return "STARTAR STRAX";
              case TimerStatus.Running: return "RACE"; 
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

  const timeToDisplay = (status !== TimerStatus.Preparing && (isHyroxRace || block.settings.mode === TimerMode.Stopwatch)) 
      ? totalTimeElapsed 
      : currentTime;
      
  const minutesStr = Math.floor(timeToDisplay / 60).toString().padStart(2, '0');
  const secondsStr = (timeToDisplay % 60).toString().padStart(2, '0');

  const participantsInNextGroup = useMemo(() => {
      if (!groupForCountdownDisplay) return [];
      return groupForCountdownDisplay.participants.split('\n').map(p => p.trim()).filter(Boolean);
  }, [groupForCountdownDisplay]);

  const effectiveIntervalsPerLap = block.settings.specifiedIntervalsPerLap || (block.exercises.length > 0 ? block.exercises.length : 1);
  const currentIntervalInLap = (completedWorkIntervals % effectiveIntervalsPerLap) + 1;

  // Determining compression
  const isCompressing = !!groupForCountdownDisplay && (status === TimerStatus.Running || status === TimerStatus.Preparing);

  const pulseAnimationClass = useMemo(() => {
      if (status !== TimerStatus.Running || isHyroxRace) return '';
      const isLastInterval = completedWorkIntervals + 1 >= totalWorkIntervals;
      if (!isLastInterval) return '';
      if (currentTime <= 5) return 'animate-pulse-bg-intense';
      if (currentTime <= 10) return 'animate-pulse-bg-medium';
      if (currentTime <= 15) return 'animate-pulse-bg-light';
      return '';
  }, [status, currentTime, completedWorkIntervals, totalWorkIntervals, isHyroxRace]);

  return (
    <div 
        className={`fixed inset-0 w-full h-full overflow-hidden transition-colors duration-500 ${showFullScreenColor ? `${timerStyle.bg} ${pulseAnimationClass}` : 'bg-gray-100 dark:bg-black'}`}
        style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
        onClick={handleInteraction}
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
    >
      {showConfetti && <Confetti />}
      {showFinishAnimation && <RaceFinishAnimation winnerName={winnerName} onDismiss={() => setShowFinishAnimation(false)} />}

      <AnimatePresence>
        {participantToEdit && <EditResultModal participantName={participantToEdit} currentTime={finishedParticipants[participantToEdit]?.time || 0} onSave={handleUpdateResult} onAddPenalty={handleAddPenalty} onUndo={handleRemoveResult} onCancel={() => setParticipantToEdit(null)} />}
        {showResetConfirmation && <RaceResetConfirmationModal onConfirm={handleConfirmReset} onCancel={() => setShowResetConfirmation(false)} onExit={() => onFinish({ isNatural: false })} />}
        {showBackToPrepConfirmation && <RaceBackToPrepConfirmationModal onConfirm={onBackToGroups} onCancel={() => setShowBackToPrepConfirmation(false)} />}
      </AnimatePresence>

      {/* TOP SECTION: TIMER */}
      <div 
          className={`absolute left-0 flex flex-col items-center justify-center transition-all duration-500 z-10 
              ${isHyroxRace 
                ? 'right-[30%] top-0 h-[40%] px-6' 
                : showFullScreenColor 
                    ? `top-[12%] h-[50%] right-0` 
                    : `justify-center top-4 h-[42%] left-4 right-4 sm:left-6 sm:right-6 rounded-[2.5rem] shadow-2xl ${timerStyle.bg} ${pulseAnimationClass}`
              }`}
          style={(!showFullScreenColor && !isHyroxRace) ? { '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties : undefined}
      >
        <div className={`${isHyroxRace ? 'mb-2 px-6 py-1 rounded-full' : 'mb-4 px-8 py-2 rounded-full'} bg-black/40 backdrop-blur-xl border border-white/20 shadow-lg z-20`}>
            <span className={`font-black tracking-[0.2em] text-white uppercase ${isHyroxRace ? 'text-lg' : 'text-xl md:text-2xl'}`}>{modeLabel}</span>
        </div>

        {((activeWorkout?.title || block.title).toLowerCase() !== block.settings.mode.toLowerCase()) && (
            <h1 className={`font-bold text-white/80 tracking-tight text-center leading-none mb-1 drop-shadow-lg max-w-[90%] z-20 ${isHyroxRace ? 'text-xl' : 'text-2xl md:text-4xl'}`}>
                {activeWorkout?.title || block.title}
            </h1>
        )}

        <div className="text-center z-20 w-full mb-1">
            <h2 className={`font-black text-white tracking-widest uppercase drop-shadow-xl animate-pulse w-full text-center ${isHyroxRace ? 'text-4xl' : 'text-5xl sm:text-7xl'}`}>{statusLabel}</h2>
        </div>

        <div className="z-20 relative flex flex-col items-center w-full text-white">
            <div className="flex items-center justify-center w-full gap-2">
                 <span className={`font-mono font-black leading-none tracking-tighter tabular-nums drop-shadow-2xl select-none ${isHyroxRace ? 'text-[7rem]' : 'text-[7rem] sm:text-[9rem] md:text-[11rem]'}`}>
                    {minutesStr}:{secondsStr}
                 </span>
            </div>
            {!isHyroxRace && block.settings.mode !== TimerMode.Stopwatch && totalBlockDuration > 0 && (
                <div className="w-[70%] max-w-3xl h-4 bg-white/20 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all duration-1000 ease-linear" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>

        {!isHyroxRace && status !== TimerStatus.Idle && (
            <BigRoundIndicator currentRound={currentRound} totalRounds={totalRounds} mode={block.settings.mode} currentInterval={currentIntervalInLap} intervalsPerRound={effectiveIntervalsPerLap} specifiedLaps={block.settings.specifiedLaps} />
        )}
      </div>

      {/* MID SECTION: COUNTDOWN BANNER (Overlay for Hyrox) */}
      {isHyroxRace && groupForCountdownDisplay && (status === TimerStatus.Running || status === TimerStatus.Preparing) && (
           <div className="absolute top-[35%] left-0 right-[30%] z-30 flex justify-center px-6 pointer-events-none">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-black/80 backdrop-blur-xl rounded-2xl px-10 py-5 border-4 border-white/30 shadow-2xl flex flex-col items-center w-full max-w-4xl"
              >
                  <span className="text-white/90 text-2xl uppercase tracking-wider font-black mb-1">{groupForCountdownDisplay.name}</span>
                  <div className="flex items-center gap-6">
                    <span className="text-white/80 text-lg font-bold uppercase tracking-widest">STARTAR OM</span>
                    <span className={`font-mono text-6xl font-black leading-none ${timeForCountdownDisplay <= 10 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                        {timeForCountdownDisplay > 0 ? `${Math.floor(timeForCountdownDisplay / 60).toString().padStart(2, '0')}:${(timeForCountdownDisplay % 60).toString().padStart(2, '0')}` : 'NU!'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-4 w-full pt-3 border-t border-white/10">
                      {participantsInNextGroup.map((p, i) => (
                          <span key={i} className="text-xl font-bold text-white/90 drop-shadow-md">{p}</span>
                      ))}
                  </div>
              </motion.div>
          </div>
        )}

      {/* BOTTOM SECTION: EXERCISES */}
      <div className={`absolute bottom-0 left-0 flex flex-col items-center justify-start px-4 z-0 
          ${isHyroxRace ? 'right-[30%] top-[40%] h-[60%] py-4' : (showFullScreenColor ? 'top-[62%]' : 'top-[43%]') + ' right-0'}`}
      >
          <div className="w-full flex justify-center items-start h-full"> 
              {block.followMe ? (
                  <FollowMeView exercise={currentExercise} nextExercise={nextExercise} timerStyle={timerStyle} status={status} />
              ) : (
                  !isFreestanding && (
                      <StandardListView 
                        exercises={block.exercises} 
                        timerStyle={timerStyle} 
                        isHyroxRace={isHyroxRace} 
                        isCompressing={isCompressing} 
                      />
                  )
              )}
          </div>
      </div>

      {/* RIGHT SECTION: PARTICIPANTS (30% width) */}
      {isHyroxRace && (
          <div className="flex-shrink-0 border-l-4 border-white/10 bg-gray-900/95 backdrop-blur-md flex flex-col z-40 absolute top-0 right-0 bottom-0 w-[30%] min-w-[350px]">
              <ParticipantFinishList
                  participants={startedParticipants}
                  finishData={finishedParticipants}
                  onFinish={handleParticipantFinish}
                  onEdit={handleEditParticipant}
                  isSaving={(name) => savingParticipant === name}
              />
          </div>
      )}

      {/* CONTROLS */}
      <div className={`fixed z-50 transition-all duration-500 flex gap-4 ${isHyroxRace ? 'left-[35%]' : 'left-1/2'} -translate-x-1/2 
          ${isHyroxRace ? 'bottom-8' : (showFullScreenColor ? 'top-[62%]' : 'top-[46%]')} 
          ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            {status === TimerStatus.Idle || status === TimerStatus.Finished ? (
                <>
                    <button onClick={() => onFinish({ isNatural: false })} className="bg-gray-600/90 text-white font-bold py-3 px-8 rounded-full shadow-xl hover:bg-gray-500 transition-colors text-lg backdrop-blur-md">TILLBAKA</button>
                    <button onClick={start} className="bg-white text-black font-black py-3 px-12 rounded-full shadow-2xl hover:scale-105 transition-transform text-lg">STARTA</button>
                </>
            ) : status === TimerStatus.Paused ? (
                <>
                    <button onClick={resume} className="bg-green-500 text-white font-bold py-3 px-8 rounded-full shadow-xl hover:bg-green-400 transition-colors text-lg">FORTSÄTT</button>
                    <button onClick={isHyroxRace ? () => setShowResetConfirmation(true) : reset} className="bg-gray-700 text-white font-bold py-3 px-8 rounded-full shadow-xl hover:bg-gray-600 transition-colors text-lg">AVSLUTA</button>
                </>
            ) : (
                <button onClick={pause} className="bg-white/90 text-gray-900 font-black py-3 px-12 rounded-full shadow-2xl hover:bg-gray-100 transition-transform hover:scale-105 text-lg">PAUSA</button>
            )}
            {isHyroxRace && status !== TimerStatus.Running && (
                 <button onClick={() => setShowBackToPrepConfirmation(true)} className="bg-gray-800/80 text-white font-bold py-3 px-6 rounded-full shadow-xl border border-gray-600 hover:bg-gray-700 transition-colors text-md">⚙️ Grupper</button>
            )}
      </div>
    </div>
  );
};
