
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
import { DumbbellIcon, InformationCircleIcon } from './icons';

// --- Constants ---
const HYROX_RIGHT_PANEL_WIDTH = '350px';

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

const StandardListView: React.FC<{ 
    exercises: Exercise[], 
    timerStyle: TimerStyle,
    isHyrox?: boolean
}> = ({ exercises, timerStyle, isHyrox }) => {
    const count = exercises.length;
    let titleSize = 'text-2xl md:text-3xl';
    let repsSize = 'text-lg md:text-xl';
    let padding = 'px-5 py-2';
    let gap = 'gap-2';
    let showDesc = count <= 10;

    // För HYROX vill vi att alla kort ska dela på ytan
    const itemClass = isHyrox 
        ? "flex-1 min-h-0" // Tvingar alla att vara lika stora och dela på höjden
        : "min-h-[80px]";

    return (
        <div className={`w-full max-w-6xl h-full flex flex-col ${gap} pb-4 overflow-hidden`}>
            {exercises.map((ex) => (
                <div 
                    key={ex.id} 
                    className={`${itemClass} bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl ${padding} flex flex-col justify-center border-l-[8px] shadow-sm transition-all relative group`}
                    style={{ borderLeftColor: `rgb(${timerStyle.pulseRgb})` }}
                >
                    <div className="flex justify-between items-center w-full gap-4">
                        <h4 className={`font-black text-gray-900 dark:text-white leading-tight tracking-tight ${titleSize} truncate`}>
                            {ex.name}
                        </h4>
                        {ex.reps && (
                            <span className={`font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg whitespace-nowrap shadow-sm flex-shrink-0 border border-gray-200 dark:border-gray-700 ${repsSize}`}>
                                {formatReps(ex.reps)}
                            </span>
                        )}
                    </div>
                    {showDesc && ex.description && (
                        <p className="text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 text-sm md:text-base font-medium">
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
    if (mode === TimerMode.Stopwatch || mode === TimerMode.NoTimer) return null;

    const showInterval = currentInterval !== undefined && totalIntervalsInLap !== undefined;

    return (
        <div className="flex flex-col items-end gap-3 animate-fade-in">
            {showInterval && (
                <div className="bg-black/30 backdrop-blur-xl rounded-[2.5rem] px-10 py-6 border border-white/10 shadow-2xl flex flex-col items-center min-w-[200px]">
                    <span className="block text-white/60 font-black text-xs sm:text-sm uppercase tracking-[0.4em] mb-2">INTERVALL</span>
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
                className="bg-black/30 backdrop-blur-xl rounded-full px-6 py-3 border border-white/10 shadow-xl flex items-center justify-center gap-3 min-w-[140px]"
            >
                <span className="text-white/60 font-black text-[10px] uppercase tracking-[0.3em]">
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
  const [finalRaceId, setFinalRaceId] = useState<string | null>(null);
  
  const isHyroxRace = useMemo(() => activeWorkout?.id.startsWith('hyrox-full-race') || activeWorkout?.id.startsWith('custom-race'), [activeWorkout]);
  const isFreestanding = block.tag === 'Fristående';
  const showFullScreenColor = isFreestanding;

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
        
        // Pausa klockan omedelbart så att slutresultatet fryses
        pause();

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
                setFinalRaceId(savedRace.id);
            }
        } catch (error) { console.error("Failed to save race results:", error); }
    }, [isHyroxRace, activeWorkout, finishedParticipants, block.exercises, startGroups, organization, onFinish, speak, pause]);

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
      if (isHyroxRace || block.settings.mode === TimerMode.Stopwatch) return totalTimeElapsed;
      if (!block.settings.direction || block.settings.direction === 'down') {
          return currentTime;
      }
      return currentPhaseDuration - currentTime;
  }, [status, currentTime, isHyroxRace, block.settings.mode, block.settings.direction, currentPhaseDuration, totalTimeElapsed]);

  const minutesStr = Math.floor(timeToDisplay / 60).toString().padStart(2, '0');
  const secondsStr = (timeToDisplay % 60).toString().padStart(2, '0');

  const currentIntervalInLap = (completedWorkIntervals % effectiveIntervalsPerLap) + 1;

  const handleDismissFinishAnimation = () => {
    setShowFinishAnimation(false);
    if (finalRaceId) {
        onFinish({ isNatural: true, raceId: finalRaceId });
    } else {
        onFinish({ isNatural: true });
    }
  };

  return (
    <div 
        className={`fixed inset-0 w-full h-full overflow-hidden transition-colors duration-500 ${showFullScreenColor ? `${timerStyle.bg}` : 'bg-gray-100 dark:bg-black'}`}
        style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
        onClick={handleInteraction}
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
    >
      {showConfetti && <Confetti />}
      {showFinishAnimation && <RaceFinishAnimation winnerName={winnerName} onDismiss={handleDismissFinishAnimation} />}
      
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
      </AnimatePresence>

      <AnimatePresence>
        {status !== TimerStatus.Idle && status !== TimerStatus.Paused && !showFinishAnimation && (
            <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute top-10 z-[100]"
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

      {/* VÄNSTERSIDA - TIMER & LISTA */}
      <div 
        className={`absolute left-0 top-0 bottom-0 flex flex-col transition-all duration-500 z-10 
            ${isHyroxRace ? `right-[${HYROX_RIGHT_PANEL_WIDTH}] pr-6` : 'right-0'}`}
      >
        {/* TIMER-KORTET */}
        <div 
            className={`flex flex-col items-center justify-center transition-all duration-500 
                ${showFullScreenColor 
                    ? `mt-[12%] h-[40%]` 
                    : `mt-2 mx-4 sm:mx-6 rounded-[2.5rem] shadow-2xl ${timerStyle.bg} h-[25%] shrink-0`
                }`}
            style={!showFullScreenColor ? { '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties : undefined}
        >
            <div className="mb-2 px-8 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 shadow-lg z-20">
                <span className={`font-black tracking-[0.2em] text-white uppercase drop-shadow-md text-lg md:text-xl`}>{modeLabel}</span>
            </div>

            <div className="text-center z-20 w-full px-10 mb-1">
                <h2 className={`font-black text-white tracking-widest uppercase drop-shadow-xl animate-pulse w-full text-center text-4xl sm:text-5xl`}>{statusLabel}</h2>
            </div>

            <div className="z-20 relative flex flex-col items-center w-full text-white">
                <div className="flex items-center justify-center w-full gap-2">
                     <span className="font-mono font-black leading-none tracking-tighter tabular-nums drop-shadow-2xl select-none text-[6rem] sm:text-[8rem] md:text-[9rem]">
                        {minutesStr}:{secondsStr}
                     </span>
                </div>
                
                {block.settings.mode !== TimerMode.Stopwatch && (
                    <div className="w-[80%] max-w-2xl h-4 bg-black/20 rounded-full mt-4 overflow-hidden border border-white/10 p-1">
                        <div 
                            className="h-full bg-white rounded-full transition-[width] duration-1000 ease-linear" 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                )}
            </div>

            <div className="text-center z-20 w-full px-10 mt-1">
                <h1 className="font-black text-white/90 uppercase tracking-tighter text-xl sm:text-2xl md:text-3xl drop-shadow-lg truncate">{block.title}</h1>
            </div>
        </div>

        {/* ÖVNINGSLISTA */}
        <div className="flex-grow overflow-hidden flex flex-col items-center justify-start px-4 pt-4">
            {block.showDescriptionInTimer && block.setupDescription && !showFullScreenColor && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 px-6 py-3 bg-white/95 dark:bg-gray-900 border-2 border-primary/20 dark:border-white/10 max-w-5xl flex items-center gap-4 shadow-xl z-10 rounded-[2rem]"
                >
                    <InformationCircleIcon className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-gray-900 dark:text-white text-lg md:text-xl font-black leading-tight">
                        {block.setupDescription}
                    </p>
                </motion.div>
            )}

            <div className="w-full flex justify-center items-stretch flex-grow pb-4"> 
                {block.followMe ? (
                    <FollowMeView exercise={currentExercise} nextExercise={nextExercise} timerStyle={timerStyle} status={status} />
                ) : (
                    !isFreestanding && (
                        <StandardListView exercises={block.exercises} timerStyle={timerStyle} isHyrox={isHyroxRace} />
                    )
                )}
            </div>
        </div>
      </div>

      {isHyroxRace && (
          <div 
              className="absolute top-0 right-0 bottom-0 border-l-4 border-white/10 bg-gray-900/95 backdrop-blur-md flex flex-col z-40 shadow-2xl"
              style={{ width: HYROX_RIGHT_PANEL_WIDTH }}
          >
              <ParticipantFinishList participants={startedParticipants} finishData={finishedParticipants} onFinish={handleParticipantFinish} onEdit={handleEditParticipant} isSaving={(name) => savingParticipant === name} />
          </div>
      )}

      <div className={`fixed z-50 transition-all duration-500 flex gap-6 left-1/2 -translate-x-1/2 bottom-8 ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'} ${isHyroxRace ? 'ml-[-175px]' : ''}`}>
            {status === TimerStatus.Idle || status === TimerStatus.Finished ? (
                <>
                    <button onClick={() => onFinish({ isNatural: false })} className="bg-gray-600/80 text-white font-bold py-4 px-10 rounded-full shadow-xl hover:bg-gray-500 transition-colors text-xl backdrop-blur-md border-2 border-white/20">TILLBAKA</button>
                    <button onClick={start} className="bg-white text-black font-black py-4 px-16 rounded-full shadow-2xl hover:scale-105 transition-transform text-xl border-4 border-white/50">STARTA</button>
                </>
            ) : status === TimerStatus.Paused ? (
                <button onClick={resume} className="bg-green-500 text-white font-bold py-4 px-10 rounded-full shadow-xl hover:bg-green-400 transition-colors text-xl border-2 border-green-400">FORTSÄTT</button>
            ) : (
                <button onClick={pause} className="bg-white text-gray-900 font-black py-4 px-16 rounded-full shadow-2xl hover:bg-gray-100 transition-transform hover:scale-105 text-xl border-4 border-white/50">PAUSA</button>
            )}
            {isHyroxRace && status !== TimerStatus.Running && <button onClick={() => setShowBackToPrepConfirmation(true)} className="bg-gray-800/80 text-white font-bold py-4 px-8 rounded-full shadow-xl border-2 border-gray-600 hover:bg-gray-700 transition-colors text-lg">⚙️ Grupper</button>}
      </div>
    </div>
  );
};
