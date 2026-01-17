import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { WorkoutBlock, TimerStatus, Exercise, TimerSettings, TimerMode } from '../types';

// --- Audio Generation ---
let audioContext: AudioContext | null = null;

export const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch(e) {
        console.error("Web Audio API is not supported in this browser.");
    }
  }
  return audioContext;
};

export const playBeep = (frequency = 440, duration = 100, type: OscillatorType = 'sine') => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.01);

  oscillator.start(ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration / 1000);
  oscillator.stop(ctx.currentTime + duration / 1000);
};

const playShortBeep = () => playBeep(880, 150, 'triangle');
const playLongBeep = () => playBeep(523, 400, 'sine');

export const parseSettingsFromTitle = (title: string): Partial<TimerSettings> | null => {
    const lowerTitle = title.toLowerCase().trim();
    const amrapMatch = lowerTitle.match(/(?:(\d+)\s*min\s*)?(amrap|time cap)(?:\s*(\d+))?/);
    if (amrapMatch) {
        const minutesStr = amrapMatch[1] || amrapMatch[3];
        if (minutesStr) {
            const minutes = parseInt(minutesStr, 10);
            if (!isNaN(minutes)) {
                return {
                    mode: amrapMatch[2].trim() === 'amrap' ? TimerMode.AMRAP : TimerMode.TimeCap,
                    workTime: minutes * 60,
                    restTime: 0,
                    rounds: 1,
                };
            }
        }
    }
    const emomMatch = lowerTitle.match(/emom\s*(\d+)/);
    if (emomMatch) {
        const minutes = parseInt(emomMatch[1], 10);
        if (!isNaN(minutes)) {
            return {
                mode: TimerMode.EMOM,
                workTime: 60,
                restTime: 0,
                rounds: minutes,
            };
        }
    }
    if (lowerTitle.includes('tabata')) {
        return { mode: TimerMode.Tabata, workTime: 20, restTime: 10, rounds: 8 };
    }
    const intervalMatch = lowerTitle.match(/(\d+)\s*\/\s*(\d+)/);
    if (intervalMatch) {
        const work = parseInt(intervalMatch[1], 10);
        const rest = parseInt(intervalMatch[2], 10);
        if (!isNaN(work) && !isNaN(rest)) {
            if (work === 20 && rest === 10) return { mode: TimerMode.Tabata, workTime: 20, restTime: 10, rounds: 8 };
            return { mode: TimerMode.Interval, workTime: work, restTime: rest };
        }
    }
    return null;
};

/**
 * Beräknar total tid för ett block.
 * Fallback-logik ser till att vi inte får NaN om rounds saknas i sparade pass.
 */
const calculateTotalDuration = (settings: TimerSettings, exercisesCount: number): number => {
    if (!settings) return 0;
    
    // Säkerställ giltiga värden även om passet laddas från gammalt database-format
    const rounds = settings.rounds || (exercisesCount > 0 ? exercisesCount : 1);
    const workTime = settings.workTime || 0;
    const restTime = settings.restTime || 0;

    switch(settings.mode) {
        case TimerMode.Interval:
        case TimerMode.Tabata:
            const totalWork = rounds * workTime;
            const totalRest = rounds > 1 ? (rounds - 1) * restTime : 0;
            return totalWork + totalRest;
        case TimerMode.AMRAP:
        case TimerMode.TimeCap:
        case TimerMode.Stopwatch:
            return workTime;
        case TimerMode.EMOM:
            return rounds * 60;
        default:
            return 0;
    }
}

export const useWorkoutTimer = (block: WorkoutBlock | null) => {
  const [status, setStatus] = useState<TimerStatus>(TimerStatus.Idle);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentPhaseDuration, setCurrentPhaseDuration] = useState(0);
  const [completedWorkIntervals, setCompletedWorkIntervals] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const totalBlockDuration = useMemo(() => {
      if (!block) return 0;
      return calculateTotalDuration(block.settings, block.exercises.length);
  }, [block]);

  // Avancerad varv-beräkning (Återställd komplexitet)
  const totalExercises = block?.exercises.length ?? 0;
  const settingsRounds = useMemo(() => {
      if (!block) return 0;
      return block.settings.rounds || (totalExercises > 0 ? totalExercises : 1);
  }, [block, totalExercises]);

  const effectiveIntervalsPerLap = useMemo(() => {
      if (block?.settings.specifiedIntervalsPerLap) return block.settings.specifiedIntervalsPerLap;
      return totalExercises > 0 ? totalExercises : 1;
  }, [block, totalExercises]);

  const totalRounds = useMemo(() => {
      if (!block) return 0;
      if (block.settings.mode === TimerMode.EMOM) return settingsRounds;
      if (block.settings.specifiedLaps) return block.settings.specifiedLaps;
      return totalExercises > 0 ? Math.ceil(settingsRounds / totalExercises) : settingsRounds;
  }, [block, totalExercises, settingsRounds]);

  const currentRound = Math.floor(completedWorkIntervals / effectiveIntervalsPerLap) + 1;
  const isLastExerciseInRound = (completedWorkIntervals + 1) % effectiveIntervalsPerLap === 0;

  const currentExerciseIndex = totalExercises > 0 ? completedWorkIntervals % totalExercises : 0;
  const currentExercise = block && totalExercises > 0 ? block.exercises[currentExerciseIndex] : null;
  const nextExercise = block && totalExercises > 0 ? block.exercises[(completedWorkIntervals + 1) % totalExercises] : null;

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  
  const startNextInterval = useCallback(() => {
    if (!block) return;
    const { workTime, restTime } = block.settings;

    if (status === TimerStatus.Preparing) {
        setStatus(TimerStatus.Running);
        setCurrentTime(workTime);
        setCurrentPhaseDuration(workTime);
    } else if (status === TimerStatus.Running) {
      if (restTime > 0) {
        setStatus(TimerStatus.Resting);
        setCurrentTime(restTime);
        setCurrentPhaseDuration(restTime);
      } else {
        setStatus(TimerStatus.Running);
        setCurrentTime(workTime);
        setCurrentPhaseDuration(workTime);
      }
    } else if (status === TimerStatus.Resting) {
      setStatus(TimerStatus.Running);
      setCurrentTime(workTime);
      setCurrentPhaseDuration(workTime);
    }
  }, [block, status]);

  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
      intervalRef.current = window.setInterval(() => {
        
        // Uppdatera tidslinjen
        if (status === TimerStatus.Running || status === TimerStatus.Resting) {
            setTotalTimeElapsed(prev => {
                const next = prev + 1;
                return next > totalBlockDuration ? totalBlockDuration : next;
            });
        }

        setCurrentTime(prevTime => {
          const newTime = prevTime - 1;
          if ((status === TimerStatus.Preparing || status === TimerStatus.Resting) && newTime <= 3 && newTime >= 1) {
            playShortBeep();
          }
          return Math.max(0, newTime);
        });
      }, 1000);
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [status, stopTimer, totalBlockDuration]);

  useEffect(() => {
    if (currentTime > 0) return;
    if (status === TimerStatus.Idle || status === TimerStatus.Finished || status === TimerStatus.Paused) return;

    if (block) {
      const { mode } = block.settings;
      if ((mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) && status === TimerStatus.Running) {
        playLongBeep();
        setStatus(TimerStatus.Finished);
        setTotalTimeElapsed(totalBlockDuration);
        return;
      }
      if (status === TimerStatus.Running) {
        const newCompletedCount = completedWorkIntervals + 1;
        if (newCompletedCount >= settingsRounds) {
          setCompletedWorkIntervals(newCompletedCount);
          playLongBeep();
          setStatus(TimerStatus.Finished);
          setTotalTimeElapsed(totalBlockDuration);
          return;
        }
        setCompletedWorkIntervals(newCompletedCount);
      }
    }
    playLongBeep();
    startNextInterval();
  }, [currentTime, status, block, completedWorkIntervals, totalBlockDuration, settingsRounds, startNextInterval]);

  const start = useCallback(() => {
    if (!block) return;
    getAudioContext();
    setTotalTimeElapsed(0);
    setCompletedWorkIntervals(0);
    setStatus(TimerStatus.Preparing);
    const prepTime = block.settings.prepareTime || 10;
    setCurrentTime(prepTime);
    setCurrentPhaseDuration(prepTime);
  }, [block]);

  const pause = () => { if (status !== TimerStatus.Idle && status !== TimerStatus.Finished) setStatus(TimerStatus.Paused); };
  const resume = () => { if (status === TimerStatus.Paused) setStatus(TimerStatus.Running); };
  
  const reset = useCallback(() => {
    stopTimer();
    setStatus(TimerStatus.Idle);
    setCurrentTime(0);
    setCurrentPhaseDuration(0);
    setCompletedWorkIntervals(0);
    setTotalTimeElapsed(0);
  }, [stopTimer]);

  return { 
    status, currentTime, currentPhaseDuration, currentRound, currentExercise, nextExercise,
    currentExerciseIndex, start, pause, resume, reset,
    totalRounds, totalExercises, totalBlockDuration, totalTimeElapsed,
    completedWorkIntervals, totalWorkIntervals: settingsRounds, effectiveIntervalsPerLap,
    isLastExerciseInRound
  };
};
