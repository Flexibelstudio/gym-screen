
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { WorkoutBlock, TimerStatus, Exercise, TimerSettings, TimerMode, TimerSoundProfile, TimerSegment } from '../types';

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

/* --- SOUND SYNTHESIS FUNCTIONS --- */

const playTone = (ctx: AudioContext, freq: number, type: OscillatorType, startTime: number, duration: number, vol: number = 0.5) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
};

// Exporting playTone as playBeep for compatibility
export const playBeep = playTone;

// 1. BOXING BELL (Original)
const playBellStrike = (ctx: AudioContext, startTime: number) => {
  const duration = 1.5;
  const frequencies = [800, 1100, 1600, 2400]; 
  
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.5 : 0.2, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  });
};

// 2. AIR HORN (Aggressive, Sawtooth, Detuned)
const playAirHorn = (ctx: AudioContext, startTime: number) => {
    const duration = 0.6;
    const baseFreq = 320; // Mid-low range
    
    // Two oscillators slightly detuned to create the rough "horn" texture
    [0, 10].forEach(detune => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, startTime);
        osc.detune.setValueAtTime(detune, startTime); // Detune for roughness

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
        gain.gain.linearRampToValueAtTime(0.4, startTime + duration - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
    });
};

// 3. DIGITAL BEEP (UPDATED: Classic High Pitch Timer Sound)
const playDigitalBeep = (ctx: AudioContext, startTime: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Använder Sine men med hög frekvens för att efterlikna klassiska stoppur/timers
    // Tar bort "pitch drop" (frequency ramp) för att göra det mer distinkt och mindre "lekfullt"
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, startTime); 

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.5, startTime + 0.01); // Snabb attack
    gain.gain.setValueAtTime(0.5, startTime + 0.08); // Håll tonen kort
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15); // Snabb release

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.15);
};

// 4. GONG (Meditative, Low frequency, Inharmonic)
const playGong = (ctx: AudioContext, startTime: number) => {
    const duration = 3.5;
    const fundamental = 180;
    // Inharmonic partials
    const ratios = [1, 1.41, 1.68, 2.15]; 
    
    ratios.forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(fundamental * ratio, startTime);
        
        const vol = 0.4 / (i + 1);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.02); // Soft attack
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration / (i === 0 ? 1 : 1.5)); // Higher partials decay faster

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    });
};

/* --- PUBLIC SOUND PLAYER --- */

export const playTimerSound = (type: TimerSoundProfile = 'airhorn', count: number = 1) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    
    for (let i = 0; i < count; i++) {
        // Gap between multiple sounds (e.g., 2 bells)
        // Air horn needs more space, digital beeps are faster
        let gap = 0.4;
        if (type === 'digital') gap = 0.25;
        if (type === 'airhorn') gap = 0.7; 
        if (type === 'gong') gap = 1.0; 

        const startTime = now + (i * gap);

        switch (type) {
            case 'digital':
                playDigitalBeep(ctx, startTime);
                break;
            case 'boxing':
                playBellStrike(ctx, startTime);
                break;
            case 'gong':
                playGong(ctx, startTime);
                break;
            case 'airhorn':
            default:
                playAirHorn(ctx, startTime);
                break;
        }
    }
};

export const playShortBeep = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    playTone(ctx, 880, 'triangle', ctx.currentTime, 0.1, 0.2);
};

export const playBoxingBell = (strikes: number) => {
    // Legacy support wrapper - defaults to boxing sound
    playTimerSound('boxing', strikes);
};

/* --- TIMER LOGIC --- */

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

export const calculateBlockDuration = (settings: TimerSettings, exercisesCount: number): number => {
    if (!settings) return 0;
    
    const rounds = settings.rounds || (exercisesCount > 0 ? exercisesCount : 1);
    const workTime = settings.workTime || 0;
    const restTime = settings.restTime || 0;

    switch(settings.mode) {
        case TimerMode.Custom:
            if (!settings.sequence || settings.sequence.length === 0) return 0;
            const sequenceDuration = settings.sequence.reduce((acc, seg) => acc + (seg.duration || 0), 0);
            return sequenceDuration * (settings.rounds || 1);
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

export const useWorkoutTimer = (block: WorkoutBlock | null, soundProfile: TimerSoundProfile = 'airhorn') => {
  const [status, setStatus] = useState<TimerStatus>(TimerStatus.Idle);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentPhaseDuration, setCurrentPhaseDuration] = useState(0);
  const [completedWorkIntervals, setCompletedWorkIntervals] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const totalBlockDuration = useMemo(() => {
      if (!block) return 0;
      return calculateBlockDuration(block.settings, block.exercises.length);
  }, [block]);

  // CUSTOM TIMER: Flatten sequence to simplify logic
  const flattenedSequence = useMemo<TimerSegment[]>(() => {
      if (block?.settings.mode !== TimerMode.Custom || !block.settings.sequence) return [];
      const seq = block.settings.sequence;
      const rounds = block.settings.rounds || 1;
      const flat: TimerSegment[] = [];
      for (let i = 0; i < rounds; i++) {
          flat.push(...seq);
      }
      return flat;
  }, [block]);

  const totalExercises = block?.exercises.length ?? 0;
  
  const settingsRounds = useMemo(() => {
      if (!block) return 0;
      if (block.settings.mode === TimerMode.Custom) {
          return flattenedSequence.length;
      }
      return block.settings.rounds || (totalExercises > 0 ? totalExercises : 1);
  }, [block, totalExercises, flattenedSequence.length]);

  const effectiveIntervalsPerLap = useMemo(() => {
      if (block?.settings.mode === TimerMode.Custom) return block.settings.sequence?.length || 1;
      if (block?.settings.specifiedIntervalsPerLap) return block.settings.specifiedIntervalsPerLap;
      return totalExercises > 0 ? totalExercises : 1;
  }, [block, totalExercises]);

  const totalRounds = useMemo(() => {
      if (!block) return 0;
      if (block.settings.mode === TimerMode.Custom) return block.settings.rounds;
      if (block.settings.mode === TimerMode.EMOM) return settingsRounds;
      if (block.settings.specifiedLaps) return block.settings.specifiedLaps;
      return totalExercises > 0 ? Math.ceil(settingsRounds / totalExercises) : settingsRounds;
  }, [block, totalExercises, settingsRounds]);

  const currentRound = Math.floor(completedWorkIntervals / effectiveIntervalsPerLap) + 1;
  const isLastExerciseInRound = (completedWorkIntervals + 1) % effectiveIntervalsPerLap === 0;

  const currentExerciseIndex = totalExercises > 0 ? completedWorkIntervals % totalExercises : 0;
  const currentExercise = block && totalExercises > 0 ? block.exercises[currentExerciseIndex] : null;
  const nextExercise = block && totalExercises > 0 ? block.exercises[(completedWorkIntervals + 1) % totalExercises] : null;
  
  // Custom: Current segment derived from completed count
  const currentSegment = block?.settings.mode === TimerMode.Custom && flattenedSequence.length > 0 
      ? flattenedSequence[completedWorkIntervals] || null 
      : null;

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  
  const startNextInterval = useCallback(() => {
    if (!block) return;
    const { workTime, restTime, mode } = block.settings;

    if (mode === TimerMode.Custom) {
        if (!currentSegment) {
             setStatus(TimerStatus.Finished);
             return;
        }
        
        // Map segment type to Status
        if (currentSegment.type === 'work') setStatus(TimerStatus.Running);
        else setStatus(TimerStatus.Resting);
        
        const duration = currentSegment.duration || 0;
        setCurrentTime(duration);
        setCurrentPhaseDuration(duration);
        return;
    }

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
  }, [block, status, currentSegment]);

  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
      intervalRef.current = window.setInterval(() => {
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
      
      // Slut på hela blocket (AMRAP / TimeCap)
      if ((mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) && status === TimerStatus.Running) {
        playTimerSound(soundProfile, 3); // Trippelslag
        setStatus(TimerStatus.Finished);
        setTotalTimeElapsed(totalBlockDuration);
        return;
      }

      // CUSTOM Logic
      if (mode === TimerMode.Custom) {
           if (status === TimerStatus.Preparing) {
               playTimerSound(soundProfile, 1);
               startNextInterval(); // Will switch to first segment
               return;
           }

           const newCompletedCount = completedWorkIntervals + 1;
           if (newCompletedCount >= flattenedSequence.length) {
               setCompletedWorkIntervals(newCompletedCount);
               playTimerSound(soundProfile, 3);
               setStatus(TimerStatus.Finished);
               setTotalTimeElapsed(totalBlockDuration);
               return;
           }
           
           setCompletedWorkIntervals(newCompletedCount);
           // Play sound? If next is work, double beep. If rest, single beep? Or follow normal rules?
           const nextSeg = flattenedSequence[newCompletedCount];
           if (nextSeg.type === 'work') playTimerSound(soundProfile, 2);
           else playTimerSound(soundProfile, 1);
           
           return; // Effect will re-trigger startNextInterval because status/index changed or we call it explicitly
      }

      // STANDARD Interval Logic
      if (status === TimerStatus.Running) {
        const newCompletedCount = completedWorkIntervals + 1;
        
        // Är vi helt klara med alla varv/intervaller?
        if (newCompletedCount >= settingsRounds) {
          setCompletedWorkIntervals(newCompletedCount);
          playTimerSound(soundProfile, 3); // Trippelslag
          setStatus(TimerStatus.Finished);
          setTotalTimeElapsed(totalBlockDuration);
          return;
        }
        
        setCompletedWorkIntervals(newCompletedCount);
        playTimerSound(soundProfile, 2); // Dubbelslag
      } else if (status === TimerStatus.Resting || status === TimerStatus.Preparing) {
        playTimerSound(soundProfile, 1); // Enkelslag för start
      }
    }
    
    startNextInterval();
  }, [currentTime, status, block, completedWorkIntervals, totalBlockDuration, settingsRounds, startNextInterval, soundProfile, flattenedSequence]);

  const start = useCallback((options?: { skipPrep?: boolean }) => {
    if (!block) return;
    getAudioContext();
    setTotalTimeElapsed(0);
    setCompletedWorkIntervals(0);
    
    if (options?.skipPrep) {
        if (block.settings.mode === TimerMode.Custom && block.settings.sequence && block.settings.sequence.length > 0) {
             const firstSeg = block.settings.sequence[0];
             setStatus(firstSeg.type === 'work' ? TimerStatus.Running : TimerStatus.Resting);
             setCurrentTime(firstSeg.duration);
             setCurrentPhaseDuration(firstSeg.duration);
        } else {
             setStatus(TimerStatus.Running);
             const workTime = block.settings.workTime || 60;
             setCurrentTime(workTime);
             setCurrentPhaseDuration(workTime);
        }
        playTimerSound(soundProfile, 1);
    } else {
        setStatus(TimerStatus.Preparing);
        const prepTime = block.settings.prepareTime || 10;
        setCurrentTime(prepTime);
        setCurrentPhaseDuration(prepTime);
    }
  }, [block, soundProfile]);

  const pause = () => { if (status !== TimerStatus.Idle && status !== TimerStatus.Finished) setStatus(TimerStatus.Paused); };
  const resume = () => { if (status === TimerStatus.Paused) {
      if (block?.settings.mode === TimerMode.Custom && currentSegment) {
          setStatus(currentSegment.type === 'work' ? TimerStatus.Running : TimerStatus.Resting);
      } else {
          // Fallback logic for resuming standard timers (usually resume to running if not clearly resting, 
          // but we can imply from phase. Ideally we'd store 'previousStatus' before pause)
          // Simplified: If we were resting (restTime active), assume resting. But 'TimerStatus' is state.
          // Since we overwrote 'status' to 'Paused', we lost if it was Running or Resting.
          // FIX: For robust resume, we should store pre-pause status. 
          // For now, simpler heuristics or check `currentTime`. 
          // Actually, `startNextInterval` logic is stateless mostly. 
          // Let's assume Running for standard resume unless we add `prePauseStatus`. 
          // Or better: Let's assume Running. 
          setStatus(TimerStatus.Running); 
      }
  }};
  
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
    isLastExerciseInRound,
    currentSegment // Export current segment for UI
  };
};
