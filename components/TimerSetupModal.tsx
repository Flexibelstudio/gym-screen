
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { WorkoutBlock, TimerMode, TimerSettings } from '../types';
import { ValueAdjuster, ChevronDownIcon, ChevronUpIcon } from './icons';

interface TimerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: WorkoutBlock;
  onSave: (newSettings: Partial<WorkoutBlock['settings']>) => void;
}

type CountMode = 'laps' | 'rounds';

const secondsToMinSec = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
};

export const TimerSetupModal: React.FC<TimerSetupModalProps> = ({ isOpen, onClose, block, onSave }) => {
  // --- Initialize State Lazily from Props ---
  const [initialState] = useState(() => {
      const { mode, workTime, restTime, rounds, specifiedLaps, specifiedIntervalsPerLap, direction } = block.settings;
      const work = secondsToMinSec(workTime);
      const rest = secondsToMinSec(restTime);
      
      let iVarv = 1;
      let iIntervallerPerVarv = 1;
      let iTotalOmgångar = 1;
      let iCountMode: CountMode = 'laps';
      let iTotalMinutes = 10;

      if (mode === TimerMode.Interval || mode === TimerMode.Tabata) {
          if (specifiedLaps !== undefined && specifiedIntervalsPerLap !== undefined) {
               iCountMode = 'laps';
               iVarv = specifiedLaps;
               iIntervallerPerVarv = specifiedIntervalsPerLap;
          } else {
              const numExercises = block.exercises.length > 0 ? block.exercises.length : 1;
              if (rounds > 0 && rounds % numExercises === 0) {
                  iCountMode = 'laps';
                  iIntervallerPerVarv = numExercises;
                  iVarv = rounds / numExercises;
              } else {
                  iCountMode = 'rounds';
                  iTotalOmgångar = rounds > 0 ? rounds : 1;
              }
          }
      } else if (mode === TimerMode.EMOM) {
           iTotalMinutes = rounds;
      } else if (mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) {
           iTotalMinutes = Math.floor(workTime / 60);
      }

      return {
          mode, 
          workMinutes: work.minutes, 
          workSeconds: work.seconds, 
          restMinutes: rest.minutes, 
          restSeconds: rest.seconds,
          varv: iVarv,
          intervallerPerVarv: iIntervallerPerVarv,
          totalOmgångar: iTotalOmgångar,
          countMode: iCountMode,
          totalMinutes: iTotalMinutes,
          direction: direction || 'down'
      };
  });

  const [mode, setMode] = useState(initialState.mode);
  const [countMode, setCountMode] = useState<CountMode>(initialState.countMode);
  
  // States for Interval/Tabata - Laps mode
  const [varv, setVarv] = useState(initialState.varv);
  const [intervallerPerVarv, setIntervallerPerVarv] = useState(initialState.intervallerPerVarv);
  
  // State for Interval/Tabata - Rounds mode
  const [totalOmgångar, setTotalOmgångar] = useState(initialState.totalOmgångar);

  // States for EMOM/TimeCap/AMRAP
  const [totalMinutes, setTotalMinutes] = useState(initialState.totalMinutes);
  
  // States for work/rest time
  const [workMinutes, setWorkMinutes] = useState(initialState.workMinutes);
  const [workSeconds, setWorkSeconds] = useState(initialState.workSeconds);
  const [restMinutes, setRestMinutes] = useState(initialState.restMinutes);
  const [restSeconds, setRestSeconds] = useState(initialState.restSeconds);
  
  const [direction, setDirection] = useState<'up' | 'down'>(initialState.direction);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
      if (mode !== initialState.mode) return true;
      if (direction !== initialState.direction) return true;

      // Check specific fields based on mode
      switch (mode) {
          case TimerMode.Interval:
          case TimerMode.Tabata:
              if (countMode !== initialState.countMode) return true;
              if (countMode === 'laps') {
                  if (varv !== initialState.varv) return true;
                  if (intervallerPerVarv !== initialState.intervallerPerVarv) return true;
              } else {
                  if (totalOmgångar !== initialState.totalOmgångar) return true;
              }
              if (workMinutes !== initialState.workMinutes || workSeconds !== initialState.workSeconds) return true;
              if (restMinutes !== initialState.restMinutes || restSeconds !== initialState.restSeconds) return true;
              return false;

          case TimerMode.AMRAP:
          case TimerMode.TimeCap:
          case TimerMode.EMOM:
              return totalMinutes !== initialState.totalMinutes;
          
          case TimerMode.NoTimer:
              return false; 
              
          default:
              if (workMinutes !== initialState.workMinutes || workSeconds !== initialState.workSeconds) return true;
              return false;
      }
  }, [
      mode, countMode, varv, intervallerPerVarv, totalOmgångar, totalMinutes, 
      workMinutes, workSeconds, restMinutes, restSeconds, direction, initialState
  ]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          if (hasUnsavedChanges) {
              if (window.confirm("Du har osparade ändringar. Vill du verkligen stänga och förlora dina ändringar?")) {
                  onClose();
              }
          } else {
              onClose();
          }
      }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const newSettings: Partial<TimerSettings> = { mode, direction };

    switch(mode) {
      case TimerMode.Interval:
      case TimerMode.Tabata:
        if (countMode === 'laps') {
            newSettings.rounds = varv * intervallerPerVarv;
            newSettings.specifiedLaps = varv;
            newSettings.specifiedIntervalsPerLap = intervallerPerVarv;
        } else {
            newSettings.rounds = totalOmgångar;
            newSettings.specifiedLaps = undefined;
            newSettings.specifiedIntervalsPerLap = undefined;
        }
        newSettings.workTime = workMinutes * 60 + workSeconds;
        newSettings.restTime = restMinutes * 60 + restSeconds;
        break;
      case TimerMode.AMRAP:
      case TimerMode.TimeCap:
        newSettings.workTime = totalMinutes * 60;
        newSettings.restTime = 0;
        newSettings.rounds = 1;
        break;
      case TimerMode.EMOM:
        newSettings.rounds = totalMinutes;
        newSettings.workTime = 60;
        newSettings.restTime = 0;
        break;
      case TimerMode.NoTimer:
        newSettings.workTime = 0;
        newSettings.restTime = 0;
        newSettings.rounds = 1;
        break;
    }

    onSave(newSettings);
    onClose();
  };
  
  const handleModeChange = (newMode: TimerMode) => {
    setMode(newMode);
    if (newMode === TimerMode.Interval || newMode === TimerMode.Tabata) {
        setCountMode('laps');
        setVarv(3);
        setIntervallerPerVarv(block.exercises.length > 0 ? block.exercises.length : 1);
    } else if (newMode === TimerMode.AMRAP || newMode === TimerMode.TimeCap || newMode === TimerMode.EMOM) {
        setTotalMinutes(10);
    }
  }

  const renderDirectionToggle = () => {
      // Don't show for NoTimer or Stopwatch (Stopwatch is always up)
      if (mode === TimerMode.NoTimer || mode === TimerMode.Stopwatch) return null;
      
      return (
          <div className="flex justify-center mb-6">
              <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                  <button 
                      onClick={() => setDirection('down')} 
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${direction === 'down' ? 'bg-white dark:bg-black shadow-sm text-primary' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                      <ChevronDownIcon className="w-4 h-4" /> Räkna Ned
                  </button>
                  <button 
                      onClick={() => setDirection('up')} 
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${direction === 'up' ? 'bg-white dark:bg-black shadow-sm text-primary' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                      <ChevronUpIcon className="w-4 h-4" /> Räkna Upp
                  </button>
              </div>
          </div>
      );
  };

  const renderSettingsInputs = () => {
    const animationClass = 'animate-fade-in';
    switch(mode) {
        case TimerMode.Interval:
        case TimerMode.Tabata:
            return (
              <div className={`flex flex-col items-center gap-y-6 w-full ${animationClass}`}>
                  <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                      <button onClick={() => setCountMode('laps')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${countMode === 'laps' ? 'bg-white dark:bg-black shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Räkna Varv & Intervaller</button>
                      <button onClick={() => setCountMode('rounds')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${countMode === 'rounds' ? 'bg-white dark:bg-black shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Räkna Omgångar</button>
                  </div>
                  
                  {countMode === 'laps' ? (
                      <div className={`flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-4 ${animationClass}`}>
                          <ValueAdjuster label="ANTAL VARV" value={varv} onchange={setVarv} />
                          <ValueAdjuster label="INTERVALLER/VARV" value={intervallerPerVarv} onchange={setIntervallerPerVarv} />
                      </div>
                  ) : (
                      <div className={animationClass}>
                          <ValueAdjuster label="Totalt antal omgångar" value={totalOmgångar} onchange={setTotalOmgångar} />
                      </div>
                  )}

                  <div className="flex flex-col items-center w-full">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Arbetstid</span>
                      <div className="flex items-end justify-center gap-2 sm:gap-4">
                          <ValueAdjuster label="MIN" value={workMinutes} onchange={setWorkMinutes} />
                          <ValueAdjuster label="SEK" value={workSeconds} onchange={setWorkSeconds} max={59} step={5} wrapAround={true} />
                      </div>
                  </div>
                  <div className="flex flex-col items-center w-full">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Vilotid</span>
                      <div className="flex items-end justify-center gap-2 sm:gap-4">
                          <ValueAdjuster label="MIN" value={restMinutes} onchange={setRestMinutes} />
                          <ValueAdjuster label="SEK" value={restSeconds} onchange={setRestSeconds} max={59} step={5} wrapAround={true} />
                      </div>
                  </div>
              </div>
            );
        case TimerMode.AMRAP:
            return <div className={animationClass}><ValueAdjuster label="AMRAP (MINUTER)" value={totalMinutes} onchange={setTotalMinutes} /></div>;
        case TimerMode.TimeCap:
            return <div className={animationClass}><ValueAdjuster label="TIME CAP (MINUTER)" value={totalMinutes} onchange={setTotalMinutes} /></div>;
        case TimerMode.EMOM:
            return <div className={animationClass}><ValueAdjuster label="EMOM (MINUTER)" value={totalMinutes} onchange={setTotalMinutes} /></div>;
        case TimerMode.NoTimer:
             return (
                <div className={`text-center text-gray-600 dark:text-gray-300 p-4 rounded-lg ${animationClass}`}>
                    <h4 className="font-bold text-gray-800 dark:text-white text-lg">Ingen Timer</h4>
                    <p className="mt-2">Detta block kommer inte att ha någon klocka.</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">Enbart listan med övningar kommer att visas, för att utföras i egen takt.</p>
                </div>
            );
        default: return null;
    }
  }

  return createPortal(
    <div 
        className="fixed inset-0 grid place-items-center bg-black/60 z-[1000] p-4" 
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timer-setup-title"
    >
      <div 
        className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-lg text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[calc(100dvh-2rem)] overflow-y-auto z-[1001]" 
        onClick={e => e.stopPropagation()}
      >
        <h2 id="timer-setup-title" className="text-2xl font-bold mb-1">Anpassa tider för</h2>
        <h3 className="text-lg text-primary mb-6 font-semibold">{`"${block.title}"`}</h3>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Timertyp</label>
          <div className="flex flex-wrap gap-2">
            {Object.values(TimerMode).filter(m => m !== TimerMode.Stopwatch).map(m => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode === m ? 'bg-primary text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-black rounded-lg p-6 border border-gray-200 dark:border-gray-700 min-h-[350px] flex flex-col justify-center items-center">
            {renderDirectionToggle()}
            {renderSettingsInputs()}
        </div>

        <div className="mt-8 flex gap-4">
          <button onClick={handleSave} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors shadow-sm">Spara</button>
          <button onClick={() => { if (!hasUnsavedChanges || window.confirm("Avbryt och kasta ändringar?")) onClose(); }} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
