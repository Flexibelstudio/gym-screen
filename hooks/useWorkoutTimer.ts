
import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkoutBlock, TimerStatus, Exercise, TimerSettings, TimerMode } from '../types';

// --- Audio Generation ---
// Use a single AudioContext instance to avoid creating multiple.
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

// Generic function to play a beep sound.
export const playBeep = (frequency = 440, duration = 100, type: OscillatorType = 'sine') => {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Browsers may suspend the AudioContext, it must be resumed by a user action.
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

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

// Specific sounds for different events.
const playShortBeep = () => playBeep(880, 150, 'triangle');
const playLongBeep = () => playBeep(523, 400, 'sine');
// --- End Audio Generation ---

export const parseSettingsFromTitle = (title: string): Partial<TimerSettings> | null => {
    const lowerTitle = title.toLowerCase().trim();

    // Regex for AMRAP/Time Cap with minutes: e.g., "AMRAP 15 min", "Time Cap 20", "12 min AMRAP"
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

    // Regex for EMOM with minutes: e.g., "EMOM 10", "EMOM for 12 minutes"
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
    
    // Regex for Tabata
    if (lowerTitle.includes('tabata')) {
        return {
            mode: TimerMode.Tabata,
            workTime: 20,
            restTime: 10,
            rounds: 8, // Standard Tabata
        };
    }

    // Regex for Intervals: e.g., "30/15", "40s on 20s off"
    const intervalMatch = lowerTitle.match(/(\d+)\s*\/\s*(\d+)/);
    if (intervalMatch) {
        const work = parseInt(intervalMatch[1], 10);
        const rest = parseInt(intervalMatch[2], 10);
        if (!isNaN(work) && !isNaN(rest)) {
            // If it's something like 20/10, it's likely Tabata
            if (work === 20 && rest === 10) {
                 return {
                    mode: TimerMode.Tabata,
                    workTime: 20,
                    restTime: 10,
                    rounds: 8, // Default to 8 rounds for Tabata timing
                };
            }
            return {
                mode: TimerMode.Interval,
                workTime: work,
                restTime: rest,
                // We can't know rounds from title, so we don't change it.
            };
        }
    }
    
    return null;
};


// Helper function to calculate the total active duration of a workout block
const calculateTotalDuration = (settings: TimerSettings, totalExercises: number): number => {
    if (!settings) return 0;

    switch(settings.mode) {
        case TimerMode.Interval:
        case TimerMode.Tabata:
            // 'rounds' is now the total number of work intervals.
            const totalWorkIntervals = settings.rounds;
            if (totalWorkIntervals === 0) return 0;
            
            const totalWork = totalWorkIntervals * settings.workTime;
            // There is one less rest period than work intervals
            const totalRestIntervals = totalWorkIntervals > 1 ? totalWorkIntervals - 1 : 0;
            const totalRestTime = Math.max(0, totalRestIntervals * settings.restTime);
            return totalWork + totalRestTime;

        case TimerMode.AMRAP:
        case TimerMode.TimeCap:
            // Total time is simply the workTime duration
            return settings.workTime;

        case TimerMode.EMOM:
            // Total time is the number of rounds (minutes) * 60s
            return settings.rounds * 60;
        
        case TimerMode.Stopwatch:
             // Stopwatch is often implemented as a long count-up timer (e.g., AMRAP for 1 hour)
             // The total duration is defined by its underlying workTime setting.
            return settings.workTime;
            
        default:
            return 0;
    }
}


export const useWorkoutTimer = (block: WorkoutBlock | null) => {
  const [status, setStatus] = useState<TimerStatus>(TimerStatus.Idle);
  // currentTime is "Time Remaining" in the current phase
  const [currentTime, setCurrentTime] = useState(0);
  
  // Track the total duration of the current phase (for calculating count up)
  const [currentPhaseDuration, setCurrentPhaseDuration] = useState(0);
  
  // Refactored State: A single source of truth for interval progress.
  // This counts the number of *completed* work intervals.
  const [completedWorkIntervals, setCompletedWorkIntervals] = useState(0);

  // New state for overall block progress
  const [totalBlockDuration, setTotalBlockDuration] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);

  const intervalRef = useRef<number | null>(null);

  // --- Derived State (calculated from the single source of truth) ---
  const totalExercises = block?.exercises.length ?? 0;
  
  let totalWorkIntervals: number;
  let totalRounds: number; // This is number of laps or total minutes for EMOM

  const settingsRounds = block?.settings.rounds ?? 0;

  if (block?.settings.mode === TimerMode.EMOM) {
      // For EMOM, 'rounds' are minutes, which are the work intervals.
      totalRounds = settingsRounds;
      totalWorkIntervals = settingsRounds;
  } else {
      // For Interval/Tabata, 'rounds' now means TOTAL work intervals.
      totalWorkIntervals = settingsRounds;
      // 'totalRounds' (laps) is derived from total intervals and exercises per lap.
      if (block?.settings.specifiedIntervalsPerLap) {
          // If we have explicit intervals per lap settings, rely on that for total rounds calculation
          totalRounds = Math.ceil(settingsRounds / block.settings.specifiedIntervalsPerLap);
      } else {
          totalRounds = totalExercises > 0 ? Math.ceil(settingsRounds / totalExercises) : settingsRounds;
      }
  }

  // Determine the effective interval count per lap for display calculation
  const effectiveIntervalsPerLap = block?.settings.specifiedIntervalsPerLap || (totalExercises > 0 ? totalExercises : 1);

  // The current round (1-based)
  const currentRound = Math.floor(completedWorkIntervals / effectiveIntervalsPerLap) + 1;
  
  // The current exercise index (0-based) - cycle through available exercises
  const currentExerciseIndex = totalExercises > 0 ? completedWorkIntervals % totalExercises : 0;
  
  const currentExercise: Exercise | null = block && totalExercises > 0 ? block.exercises[currentExerciseIndex] : null;
  const nextExercise: Exercise | null = block && totalExercises > 0 ? block.exercises[(completedWorkIntervals + 1) % totalExercises] : null;
  const isLastExerciseInRound = (completedWorkIntervals + 1) % effectiveIntervalsPerLap === 0;
  // --- End Derived State ---

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  
  const startNextInterval = useCallback(() => {
    if (!block) return;

    // Transition from Preparing to the first Work interval
    if (status === TimerStatus.Preparing) {
        setStatus(TimerStatus.Running);
        setCurrentTime(block.settings.workTime);
        setCurrentPhaseDuration(block.settings.workTime);
        return;
    }
  
    // Transition from a finished Work interval to Rest or the next Work
    if (status === TimerStatus.Running) {
      if (block.settings.restTime > 0) {
        setStatus(TimerStatus.Resting);
        setCurrentTime(block.settings.restTime);
        setCurrentPhaseDuration(block.settings.restTime);
      } else {
        setStatus(TimerStatus.Running);
        setCurrentTime(block.settings.workTime);
        setCurrentPhaseDuration(block.settings.workTime);
      }
    } 
    // Transition from a finished Rest interval to the next Work
    else if (status === TimerStatus.Resting) {
      setStatus(TimerStatus.Running);
      setCurrentTime(block.settings.workTime);
      setCurrentPhaseDuration(block.settings.workTime);
    }
    
  }, [block, status]);


  // This effect handles the countdown.
  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
      intervalRef.current = window.setInterval(() => {
        if (status === TimerStatus.Running || status === TimerStatus.Resting) {
          setTotalTimeElapsed(prevTime => Math.min(prevTime + 1, totalBlockDuration));
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
  }, [status, totalBlockDuration]);

  // This effect handles the logic for when a phase ends (currentTime hits 0).
  useEffect(() => {
    if (currentTime > 0) return; // Only act when timer is at zero.
    if (status === TimerStatus.Idle || status === TimerStatus.Finished || status === TimerStatus.Paused) return;

    // Timer is at 0, check for workout completion or transition to the next state.
    if (block) {
      const { mode } = block.settings;

      // AMRAP/TimeCap finishes when its main timer runs out.
      if ((mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) && status === TimerStatus.Running) {
        playLongBeep();
        setStatus(TimerStatus.Finished);
        if (totalBlockDuration > 0) setTotalTimeElapsed(totalBlockDuration);
        return;
      }

      // For interval types, we check if all work intervals are done.
      if (status === TimerStatus.Running) {
        const newCompletedCount = completedWorkIntervals + 1;
        if (newCompletedCount >= totalWorkIntervals) {
          setCompletedWorkIntervals(newCompletedCount); // Final update
          playLongBeep();
          setStatus(TimerStatus.Finished);
          if (totalBlockDuration > 0) setTotalTimeElapsed(totalBlockDuration);
          return;
        }
        setCompletedWorkIntervals(newCompletedCount);
      }
    }

    // If not completed, transition to the next phase.
    playLongBeep();
    startNextInterval();

  }, [currentTime]);

  const start = useCallback(() => {
    if (!block) return;
    
    getAudioContext();

    setTotalBlockDuration(calculateTotalDuration(block.settings, block.exercises.length));
    setTotalTimeElapsed(0);

    setCompletedWorkIntervals(0);
    setStatus(TimerStatus.Preparing);
    const prepTime = block.settings.prepareTime || 10;
    setCurrentTime(prepTime);
    setCurrentPhaseDuration(prepTime);
  }, [block]);

  const pause = () => {
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
      setStatus(TimerStatus.Paused);
    }
  };

  const resume = () => {
    if (status === TimerStatus.Paused) {
       const ctx = getAudioContext();
       if (ctx?.state === 'suspended') {
           ctx.resume();
       }
       // Note: This simplification resumes to 'Running' state, even if paused during 'Rest'.
       // For this app's purpose, this is an acceptable simplification.
       setStatus(TimerStatus.Running);
    }
  };
  
  const reset = useCallback(() => {
    stopTimer();
    setStatus(TimerStatus.Idle);
    setCurrentTime(0);
    setCurrentPhaseDuration(0);
    setCompletedWorkIntervals(0);
    setTotalTimeElapsed(0);
  }, [stopTimer]);

  return { 
    status, 
    currentTime, 
    currentPhaseDuration,
    currentRound, 
    currentExercise, 
    nextExercise,
    currentExerciseIndex,
    isLastExerciseInRound,
    start, 
    pause, 
    resume, 
    reset,
    totalRounds: totalRounds,
    totalExercises: block?.exercises.length ?? 0,
    totalBlockDuration,
    totalTimeElapsed,
    completedWorkIntervals,
    totalWorkIntervals,
    effectiveIntervalsPerLap
  };
};
