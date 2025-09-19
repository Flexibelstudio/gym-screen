import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WorkoutBlock, TimerMode, TimerSettings } from '../types';
import { ValueAdjuster } from './icons';

interface TimerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: WorkoutBlock;
  onSave: (newSettings: Partial<WorkoutBlock['settings']>) => void;
}

const secondsToMinSec = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
};

export const TimerSetupModal: React.FC<TimerSetupModalProps> = ({ isOpen, onClose, block, onSave }) => {
  const [mode, setMode] = useState(block.settings.mode);
  const [laps, setLaps] = useState(block.settings.rounds); // This now represents laps for Interval/Tabata
  const [workMinutes, setWorkMinutes] = useState(0);
  const [workSeconds, setWorkSeconds] = useState(0);
  const [restMinutes, setRestMinutes] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [totalTimeInMinutes, setTotalTimeInMinutes] = useState(0);

  useEffect(() => {
    if (block) {
        setMode(block.settings.mode);
        
        const work = secondsToMinSec(block.settings.workTime);
        setWorkMinutes(work.minutes);
        setWorkSeconds(work.seconds);

        const rest = secondsToMinSec(block.settings.restTime);
        setRestMinutes(rest.minutes);
        setRestSeconds(rest.seconds);
        
        if (block.settings.mode === TimerMode.Interval || block.settings.mode === TimerMode.Tabata) {
            const exercisesPerLap = block.exercises.length > 0 ? block.exercises.length : 1;
            setLaps(Math.ceil(block.settings.rounds / exercisesPerLap));
        } else {
             setLaps(block.settings.rounds); // For EMOM this is total minutes/rounds
        }

        if (block.settings.mode === TimerMode.AMRAP || block.settings.mode === TimerMode.TimeCap) {
          setTotalTimeInMinutes(Math.floor(block.settings.workTime / 60));
        } else {
          setTotalTimeInMinutes(15); // Default value
        }
    }
  }, [block]);

  // Effect to handle body scrolling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const newSettings: Partial<TimerSettings> = { mode };

    switch(mode) {
      case TimerMode.Interval:
      case TimerMode.Tabata:
        const exercisesPerLap = block.exercises.length > 0 ? block.exercises.length : 1;
        newSettings.rounds = laps * exercisesPerLap; // Calculate total intervals
        newSettings.workTime = workMinutes * 60 + workSeconds;
        newSettings.restTime = restMinutes * 60 + restSeconds;
        break;
      case TimerMode.AMRAP:
      case TimerMode.TimeCap:
        newSettings.workTime = totalTimeInMinutes * 60;
        newSettings.restTime = 0;
        newSettings.rounds = 1;
        break;
      case TimerMode.EMOM:
        newSettings.rounds = laps; // For EMOM, this input is total minutes/rounds
        newSettings.workTime = 60; // EMOM is always 60s per round.
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
  }

  const renderSettingsInputs = () => {
    const animationClass = 'animate-fade-in';
    switch(mode) {
        case TimerMode.Interval:
        case TimerMode.Tabata:
            return (
              <div className={`flex flex-col items-center gap-y-8 w-full ${animationClass}`}>
                  <ValueAdjuster label="ANTAL VARV" value={laps} onchange={setLaps} />
                  <div className="flex flex-col items-center w-full">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Arbetstid</span>
                      <div className="flex items-end justify-center gap-2 sm:gap-4">
                          <ValueAdjuster label="MIN" value={workMinutes} onchange={setWorkMinutes} />
                          <ValueAdjuster 
                              label="SEK" 
                              value={workSeconds} 
                              onchange={setWorkSeconds}
                              max={59}
                              step={5}
                              wrapAround={true}
                          />
                      </div>
                  </div>
                  <div className="flex flex-col items-center w-full">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Vilotid</span>
                      <div className="flex items-end justify-center gap-2 sm:gap-4">
                          <ValueAdjuster label="MIN" value={restMinutes} onchange={setRestMinutes} />
                          <ValueAdjuster
                              label="SEK"
                              value={restSeconds}
                              onchange={setRestSeconds}
                              max={59}
                              step={5}
                              wrapAround={true}
                          />
                      </div>
                  </div>
              </div>
            );
        case TimerMode.AMRAP:
        case TimerMode.TimeCap:
            return <div className={animationClass}><ValueAdjuster label="TOTAL TID (MINUTER)" value={totalTimeInMinutes} onchange={setTotalTimeInMinutes} /></div>;
        case TimerMode.EMOM:
            return <div className={animationClass}><ValueAdjuster label="TOTAL TID (MINUTER)" value={laps} onchange={setLaps} /></div>;
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
        onClick={onClose}
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
            {renderSettingsInputs()}
        </div>

        <div className="mt-8 flex gap-4">
          <button onClick={handleSave} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors shadow-sm">Spara</button>
          <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
