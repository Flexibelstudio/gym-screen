
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutBlock, TimerStatus, TimerMode, Exercise, StartGroup, Organization, HyroxRace, Workout } from '../types';
import { useWorkoutTimer, playBeep, getAudioContext } from '../hooks/useWorkoutTimer';
import { useRaceLogic } from '../hooks/useRaceLogic';
import { useWorkout } from '../context/WorkoutContext';
import { saveRace, updateOrganizationActivity } from '../services/firebaseService';
import { Confetti } from './WorkoutCompleteModal';
import { EditResultModal, RaceResetConfirmationModal, RaceBackToPrepConfirmationModal, RaceFinishAnimation, PauseOverlay } from './timer/TimerModals';
import { ParticipantFinishList } from './timer/ParticipantFinishList';
import { DumbbellIcon } from './icons';

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

const HyroxListView: React.FC<{ 
    exercises: Exercise[], 
    timerStyle: TimerStyle,
    isExpanded: boolean
}> = ({ exercises, timerStyle, isExpanded }) => {
    return (
        <div className="w-full max-w-6xl h-full flex flex-col gap-1 overflow-hidden">
            {exercises.map((ex, index) => (
                <div 
                    key={ex.id} 
                    className={`flex-1 min-h-0 bg-white dark:bg-gray-900 rounded-lg flex flex-col justify-center border-l-[6px] shadow-sm transition-all px-4 ${isExpanded ? 'py-1' : 'py-0.5'}`}
                    style={{ borderLeftColor: `rgb(${timerStyle.pulseRgb})`, height: isExpanded ? '4.2vh' : '3.7vh' }}
                >
                    <div className="flex justify-between items-center w-full gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-bold text-sm w-4">{index + 1}</span>
                            <h4 className={`font-black text-gray-900 dark:text-white leading-none tracking-tight truncate ${isExpanded ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'}`}>
                                {ex.name}
                            </h4>
                        </div>
                        {ex.reps && (
                            <span className={`font-mono font-bold text-primary whitespace-nowrap flex-shrink-0 ${isExpanded ? 'text-lg md:text-xl' : 'text-base md:text-lg'}`}>
                                {formatReps(ex.reps)}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
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
        <div className={`w-full max-w-6xl h-full flex flex-col ${gap} overflow-y-auto pb-4`}>
            {exercises.map((ex) => (
                <div 
                    key={ex.id} 
                    className={`flex-1 min-h-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl ${padding} flex flex-col justify-center border-l-[10px] shadow-lg transition-all relative group`}
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

interface BigRoundIndicatorProps {
    currentRound: number;
    totalRounds: number;
    mode: TimerMode;
    currentInterval?: number;
    intervalsPerRound?: number;
    specifiedLaps?: number;
}

const BigRoundIndicator: React.FC<BigRoundIndicatorProps> = ({ currentRound, totalRounds, mode, currentInterval, intervalsPerRound, specifiedLaps }) => {
    const isRelevantMode = [TimerMode.Interval, TimerMode.Tabata, TimerMode.EMOM].includes(mode);
    if (!isRelevantMode) return null;

    if (mode === TimerMode.EMOM) {
         return (
            <div className="mt-6 flex flex-col items-center z-20">
                <div className="bg-black/20 backdrop-blur-md rounded-2xl px-8 py-4 border border-white/10 shadow-xl">
                    <span className="block text-white/70 font-bold text-xl uppercase tracking-[0.3em] mb-1 text-center">MINUT</span>
                    <div className="flex items-baseline justify-center gap-2">
                        <motion.span key={currentRound} initial={{ opacity: 0, y: 20, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="font-black text-8xl text-white drop-shadow-lg leading-none">
                            {currentRound}
                        </motion.span>
                        <span className="text-3xl font-bold text-white/60">/ {totalRounds}</span>
                    </div>
                </div>
            </div>
         );
    }

    if (specifiedLaps !== undefined && currentInterval !== undefined && intervalsPerRound !== undefined) {
        if (specifiedLaps === 1) {
             return (
                <div className="mt-6 flex flex-col items-center z-20">
                    <div className="bg-black/20 backdrop-blur-md rounded-2xl px-8 py-4 border border-white/10 shadow-xl">
                        <span className="block text-white/70 font-bold text-xl uppercase tracking-[0.3em] mb-1 text-center">INTERVALL</span>
                        <div className="flex items-baseline justify-center gap-2">
                            <motion.span key={currentInterval} initial={{ opacity: 0, y: 20, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="font-black text-8xl text-white drop-shadow-lg leading-none">
                                {currentInterval}
                            </motion.span>
                            <span className="text-3xl font-bold text-white/60">/ {intervalsPerRound}</span>
                        </div>
                    </div>
                </div>
            );
        } else {
             return (
                <div className="mt-6 flex flex-col items-center gap-4 z-20">
                    <div className="bg-black/20 backdrop-blur-md rounded-2xl px-10 py-4 border border-white/10 shadow-xl">
                        <span className="block text-white/70 font-bold text-xl uppercase tracking-[0.3em] mb-1 text-center">VARV</span>
                        <div className="flex items-baseline justify-center gap-2">
                            <motion.span key={currentRound} initial={{ opacity: 0, y: 20, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="font-black text-8xl text-white drop-shadow-lg leading-none">
                                {currentRound}
                            </motion.span>
                            <span className="text-3xl font-bold text-white/60">/ {totalRounds}</span>
                        </div>
                    </div>
                    <div className="bg-black/20 backdrop-blur-md rounded-xl px-6 py-2 border border-white/10 shadow-lg">
                         <span className="text-white/80 font-bold text-lg tracking-wider flex items-center gap-2">
                            INTERVALL <span className="text-2xl text-white">{currentInterval}</span> <span className="text-white/60">/ {intervalsPerRound}</span>
                        </span>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="mt-6 flex flex-col items-center z-20">
            <div className="bg-black/20 backdrop-blur-md rounded-2xl px-8 py-4 border border-white/10 shadow-xl">
                <span className="block text-white/70 font-bold text-xl uppercase tracking-[0.3em] mb-1 text-center">RUNDA</span>
                <div className="flex items-baseline justify-center gap-2">
                    <motion.span key={currentRound} initial={{ opacity: 0, y: 20, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="font-black text-8xl text-white drop-shadow-lg leading-none">
                        {currentRound}
                    </motion.span>
                    <span className="text-3xl font-bold text-white/60">/ {totalRounds}</span>
                </div>
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
    if (status === TimerStatus.Finished && !isHyroxRace && block.settings.mode !== TimerMode.Stopwatch) {
        if (hasCalledFinishRef.current) return;
        const timerId = setTimeout(() => { onFinish({ isNatural: true, time: totalTimeElapsed }); hasCalledFinishRef.current = true; }, 500);
        return () => clearTimeout(timerId);
    } else if (status !== TimerStatus.Finished) { hasCalledFinishRef.current = false; }
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
      if (isHyroxRace && groupForCountdownDisplay && timeForCountdownDisplay > 0 && timeForCountdownDisplay <= 3) playBeep(880, 150, 'triangle');
  }, [isHyroxRace, timeForCountdownDisplay, groupForCountdownDisplay, status]);

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
            if (organization) { const savedRace = await saveRace(raceData, organization.id); setTimeout(() => { onFinish({ isNatural: true, raceId: savedRace.id }); }, 5000); }
            else { setTimeout(() => { onFinish({ isNatural: true }); }, 5000); }
        } catch (error) { console.error("Failed to save race results:", error); }
    }, [isHyroxRace, activeWorkout, finishedParticipants, block.exercises, startGroups, organization, onFinish, speak]);

  useRaceLogic(startGroups.flatMap(g => g.participants.split('\n').map(p => p.trim()).filter(Boolean)).map(p => ({ isFinished: !!finishedParticipants[p] })), handleRaceComplete);

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
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) restartHideTimer();
    else { setControlsVisible(true); onHeaderVisibilityChange(true); setIsBackButtonHidden(false); if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); }
  }, [status, restartHideTimer, onHeaderVisibilityChange, setIsBackButtonHidden]);

  const handleInteraction = () => { setControlsVisible(true); onHeaderVisibilityChange(true); setIsBackButtonHidden(false); restartHideTimer(); };

  const timerStyle = getTimerStyle(status, block.settings.mode, isHyroxRace);
  const progress = totalBlockDuration > 0 ? (totalTimeElapsed / totalBlockDuration) * 100 : 0;

  const pulseAnimationClass = useMemo(() => {
      if (status !== TimerStatus.Running) return '';
      const isLastInterval = completedWorkIntervals + 1 >= totalWorkIntervals;
      if (!isLastInterval) return '';
      if (currentTime <= 5) return 'animate-pulse-bg-intense';
      if (currentTime <= 10) return 'animate-pulse-bg-medium';
      if (currentTime <= 15) return 'animate-pulse-bg-light';
      return '';
  }, [status, currentTime, completedWorkIntervals, totalWorkIntervals]);

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

  // Handle Counting UP or DOWN
  const timeToDisplay = useMemo(() => {
      if (status === TimerStatus.Preparing) return currentTime;
      if (isHyroxRace || block.settings.mode === TimerMode.Stopwatch) return totalTimeElapsed;
      
      // Default to "Time Remaining" (count down)
      if (!block.settings.direction || block.settings.direction === 'down') {
          return currentTime;
      }
      
      // Handle "Count Up" within interval
      return currentPhaseDuration - currentTime;

  }, [status, currentTime, isHyroxRace, block.settings.mode, block.settings.direction, currentPhaseDuration, totalTimeElapsed]);

  const minutesStr = Math.floor(timeToDisplay / 60).toString().padStart(2, '0');
  const secondsStr = (timeToDisplay % 60).toString().padStart(2, '0');

  // --- RENDERING LOGIC ---
  const currentIntervalInLap = (completedWorkIntervals % effectiveIntervalsPerLap) + 1;

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
        {status === TimerStatus.Paused && (
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
      </AnimatePresence>

      <div 
          className={`absolute flex flex-col items-center transition-all duration-500 z-10 
              ${showFullScreenColor 
                  ? `top-[12%] h-[50%] left-0 justify-center right-0` 
                  : `justify-center top-4 h-[42%] left-4 right-4 sm:left-6 sm:right-6 rounded-[2.5rem] shadow-2xl ${timerStyle.bg} ${pulseAnimationClass}`
              }`}
          style={!showFullScreenColor ? { '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties : undefined}
      >
        <div className="mb-4 px-8 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 shadow-lg z-20">
            <span className={`font-black tracking-[0.2em] text-white uppercase drop-shadow-md text-xl md:text-2xl`}>{modeLabel}</span>
        </div>

        {(activeWorkout?.title || block.title).toLowerCase() !== block.settings.mode.toLowerCase() && (
            <h1 className={`font-bold text-white/80 tracking-tight text-center leading-none mb-2 drop-shadow-lg max-w-[90%] z-20 text-2xl md:text-4xl`}>
                {activeWorkout?.title || block.title}
            </h1>
        )}

        <div className="mb-2 text-center z-20 w-full">
            <h2 className={`font-black text-white tracking-widest uppercase drop-shadow-xl animate-pulse w-full text-center text-5xl sm:text-7xl`}>{statusLabel}</h2>
        </div>

        <div className="z-20 relative flex flex-col items-center w-full text-white">
            <div className="flex items-center justify-center w-full gap-2">
                 <span className="font-mono font-black leading-none tracking-tighter tabular-nums drop-shadow-2xl select-none text-[7rem] sm:text-[9rem] md:text-[11rem]">
                    {minutesStr}:{secondsStr}
                 </span>
            </div>
            {block.settings.mode !== TimerMode.Stopwatch && totalBlockDuration > 0 && (
                <div className="w-[70%] max-w-3xl h-4 bg-white/20 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all duration-1000 ease-linear" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>

        {status !== TimerStatus.Idle && (
            <>
                {(block.settings.mode === TimerMode.Interval || block.settings.mode === TimerMode.Tabata || block.settings.mode === TimerMode.EMOM) ? (
                    <BigRoundIndicator currentRound={currentRound} totalRounds={totalRounds} mode={block.settings.mode} currentInterval={currentIntervalInLap} intervalsPerRound={effectiveIntervalsPerLap} specifiedLaps={block.settings.specifiedLaps} />
                ) : (
                    <div className="mt-6 text-center z-20 text-white">
                        <p className={`font-bold drop-shadow-md text-white/90 text-xl sm:text-3xl`}><span>{block.title}</span></p>
                    </div>
                )}
            </>
        )}
      </div>

      {/* Standard Bottom Content */}
      <div className={`absolute bottom-0 left-0 right-0 flex flex-col items-center justify-start px-4 z-0 ${showFullScreenColor ? 'top-[62%]' : 'top-[43%]'} ${isHyroxRace ? 'right-[30%]' : ''}`}>
          <div className="w-full flex justify-center items-start h-full pt-4"> 
              {isHyroxRace ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <HyroxListView exercises={block.exercises} timerStyle={timerStyle} isExpanded={true} />
                  </div>
              ) : block.followMe ? (
                  <FollowMeView exercise={currentExercise} nextExercise={nextExercise} timerStyle={timerStyle} status={status} />
              ) : (
                  !isFreestanding && (
                      <div className="w-full flex flex-col items-center gap-6 max-w-7xl h-full">
                          <StandardListView exercises={block.exercises} timerStyle={timerStyle} />
                      </div>
                  )
              )}
          </div>
      </div>

      {/* Hyrox Side Panel */}
      {isHyroxRace && (
          <div className="absolute top-0 right-0 bottom-0 w-[30%] min-w-[350px] border-l-4 border-white/10 bg-gray-900/95 backdrop-blur-md flex flex-col z-40">
              <ParticipantFinishList participants={startedParticipants} finishData={finishedParticipants} onFinish={handleParticipantFinish} onEdit={handleEditParticipant} isSaving={(name) => savingParticipant === name} />
          </div>
      )}

      {/* Bottom Controls Bar */}
      <div className={`fixed z-50 transition-all duration-500 flex gap-6 left-1/2 -translate-x-1/2 ${showFullScreenColor ? 'top-[62%]' : 'top-[46%]'} ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'} ${isHyroxRace ? 'left-[35%]' : ''}`}>
            {status === TimerStatus.Idle || status === TimerStatus.Finished ? (
                <>
                    <button onClick={() => onFinish({ isNatural: false })} className="bg-gray-600/80 text-white font-bold py-4 px-10 rounded-full shadow-xl hover:bg-gray-500 transition-colors text-xl backdrop-blur-md border-2 border-white/20">TILLBAKA</button>
                    <button onClick={start} className="bg-white text-black font-black py-4 px-16 rounded-full shadow-2xl hover:scale-105 transition-transform text-xl border-4 border-white/50">STARTA</button>
                </>
            ) : status === TimerStatus.Paused ? (
                // Paused view has its own Overlay now, but we keep buttons for extra safety/accessibility if overlay is closed
                <button onClick={resume} className="bg-green-500 text-white font-bold py-4 px-10 rounded-full shadow-xl hover:bg-green-400 transition-colors text-xl border-2 border-green-400">FORTSÄTT</button>
            ) : (
                <button onClick={pause} className="bg-white text-gray-900 font-black py-4 px-16 rounded-full shadow-2xl hover:bg-gray-100 transition-transform hover:scale-105 text-xl border-4 border-white/50">PAUSA</button>
            )}
            {isHyroxRace && status !== TimerStatus.Running && <button onClick={() => setShowBackToPrepConfirmation(true)} className="bg-gray-800/80 text-white font-bold py-4 px-8 rounded-full shadow-xl border-2 border-gray-600 hover:bg-gray-700 transition-colors text-lg">⚙️ Grupper</button>}
      </div>
    </div>
  );
};
