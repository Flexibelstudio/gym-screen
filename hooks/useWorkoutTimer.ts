

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


// Helper function to calculate the total active duration of a workout block
const calculateTotalDuration = (settings: TimerSettings, totalExercises: number): number => {
    if (!settings || totalExercises === 0) return 0;

    switch(settings.mode) {
        case TimerMode.Interval:
        case TimerMode.Tabata:
            // Total work time
            const totalWork = settings.rounds * totalExercises * settings.workTime;
            // Total rest time is for all rests *except* the final one
            const totalRests = settings.rounds * totalExercises - 1;
            const totalRestTime = Math.max(0, totalRests * settings.restTime);
            return totalWork + totalRestTime;

        case TimerMode.AMRAP:
        case TimerMode.TimeCap:
            // Total time is simply the workTime duration
            return settings.workTime;

        case TimerMode.EMOM:
            // Total time is the number of rounds (minutes) * workTime (typically 60s)
            return settings.rounds * settings.workTime;
        
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
  const [currentTime, setCurrentTime] = useState(0);
  
  // Refactored State: A single source of truth for interval progress.
  // This counts the number of *completed* work intervals.
  const [completedWorkIntervals, setCompletedWorkIntervals] = useState(0);

  // New state for overall block progress
  const [totalBlockDuration, setTotalBlockDuration] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);

  const intervalRef = useRef<number | null>(null);

  // --- Derived State (calculated from the single source of truth) ---
  const totalExercises = block?.exercises.length ?? 0;
  const totalRounds = block?.settings.rounds ?? 0;
  const totalWorkIntervals = totalExercises * totalRounds;

  // The current round (1-based)
  const currentRound = totalExercises > 0 ? Math.floor(completedWorkIntervals / totalExercises) + 1 : 1;
  // The current exercise index (0-based)
  const currentExerciseIndex = totalExercises > 0 ? completedWorkIntervals % totalExercises : 0;
  
  const currentExercise: Exercise | null = block && totalExercises > 0 ? block.exercises[currentExerciseIndex] : null;
  const nextExercise: Exercise | null = block && totalExercises > 0 ? block.exercises[(completedWorkIntervals + 1) % totalExercises] : null;
  const isLastExerciseInRound = totalExercises > 0 ? currentExerciseIndex === totalExercises - 1 : false;
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
        return;
    }
  
    // Transition from a finished Work interval to Rest or the next Work
    if (status === TimerStatus.Running) {
      if (block.settings.restTime > 0) {
        setStatus(TimerStatus.Resting);
        setCurrentTime(block.settings.restTime);
      } else {
        setStatus(TimerStatus.Running);
        setCurrentTime(block.settings.workTime);
      }
    } 
    // Transition from a finished Rest interval to the next Work
    else if (status === TimerStatus.Resting) {
      setStatus(TimerStatus.Running);
      setCurrentTime(block.settings.workTime);
    }
    
  }, [block, status]);


  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
      intervalRef.current = window.setInterval(() => {
        
        if (status === TimerStatus.Running || status === TimerStatus.Resting) {
            setTotalTimeElapsed(prevTime => Math.min(prevTime + 1, totalBlockDuration));
        }

        setCurrentTime(prevTime => {
          if (prevTime <= 1) {
            // Check for finish condition when timer hits zero
            if (block) {
                const { mode } = block.settings;
                
                // For AMRAP/TimeCap, hitting zero is the end, but only if the main timer is running.
                if ((mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) && status === TimerStatus.Running) {
                    playLongBeep();
                    setStatus(TimerStatus.Finished);
                    if (totalBlockDuration > 0) setTotalTimeElapsed(totalBlockDuration);
                    return 0; // Finish
                }

                // For interval types, we may need to update progress
                if (status === TimerStatus.Running) {
                    const newCompletedCount = completedWorkIntervals + 1;
                    // Check if the last work period just finished.
                    if (newCompletedCount >= totalWorkIntervals) {
                        setCompletedWorkIntervals(newCompletedCount); // Final update
                        playLongBeep();
                        setStatus(TimerStatus.Finished);
                        if (totalBlockDuration > 0) setTotalTimeElapsed(totalBlockDuration);
                        return 0; // Finish
                    }
                    // If not finished, increment completed count before proceeding
                    setCompletedWorkIntervals(newCompletedCount);
                }
            }
            
            // If not finished, play sound and proceed to next interval
            playLongBeep();
            startNextInterval();
            return 0; // Time is reset by startNextInterval
          }

          const newTime = prevTime - 1;

          // Play countdown beeps for the last 3 seconds
          if ((status === TimerStatus.Preparing || status === TimerStatus.Resting) && newTime <= 3 && newTime >= 1) {
              playShortBeep();
          }

          return newTime;
        });
      }, 1000);
    } else {
      stopTimer();
    }

    return () => stopTimer();
  }, [status, startNextInterval, stopTimer, totalBlockDuration, block, completedWorkIntervals, totalWorkIntervals]);

  const start = useCallback(() => {
    if (!block) return;
    
    getAudioContext();

    setTotalBlockDuration(calculateTotalDuration(block.settings, block.exercises.length));
    setTotalTimeElapsed(0);

    setCompletedWorkIntervals(0);
    setStatus(TimerStatus.Preparing);
    setCurrentTime(block.settings.prepareTime || 10);
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
    setCompletedWorkIntervals(0);
    setTotalTimeElapsed(0);
  }, [stopTimer]);

  return { 
    status, 
    currentTime, 
    currentRound, 
    currentExercise, 
    nextExercise,
    currentExerciseIndex,
    isLastExerciseInRound,
    start, 
    pause, 
    resume, 
    reset,
    totalRounds: block?.settings.rounds ?? 0,
    totalExercises: block?.exercises.length ?? 0,
    totalBlockDuration,
    totalTimeElapsed
  };
};
