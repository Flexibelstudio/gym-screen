import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToggleSwitch } from './icons';
import { getAudioContext, playBeep } from '../hooks/useWorkoutTimer';

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

interface BreathingRhythm {
  name: string;
  description: string;
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
}

const presets: Record<string, BreathingRhythm> = {
  standard: { name: 'Standard (4-4-6-2)', description: 'En balanserad och vanlig rytm för allmän användning och för att lugna nervsystemet.', inhale: 4, holdIn: 4, exhale: 6, holdOut: 2 },
  calm: { name: 'Lugnande (4-7-8)', description: 'En klassisk rytm, framtagen av Dr. Andrew Weil, som är designad för djup avslappning, minskad stress och för att främja sömn.', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  box: { name: 'Boxandning (4-4-4-4)', description: 'En jämn och balanserande rytm som ofta används av militärer och idrottare för att öka fokus, minska stress och reglera andningen under press.', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  energize: { name: 'Energigivande (6-2-4-0)', description: 'En mer aktiv och intensiv rytm som syftar till att öka energi och vakenhet.', inhale: 6, holdIn: 2, exhale: 4, holdOut: 0 },
};

enum TimerState { Idle, Preparing, Running, Paused }

interface BreathingGuideScreenProps {
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
  theme: string;
  toggleTheme: () => void;
}

export const BreathingGuideScreen: React.FC<BreathingGuideScreenProps> = ({ isSettingsOpen, onCloseSettings, onOpenSettings, onBack, theme, toggleTheme }) => {
  const [settings, setSettings] = useState<BreathingRhythm>(presets.standard);
  const [timerState, setTimerState] = useState<TimerState>(TimerState.Idle);
  const [currentPhase, setCurrentPhase] = useState<Phase>('inhale');
  const [timeInPhase, setTimeInPhase] = useState(0);
  const [totalTime, setTotalTime] = useState(5 * 60); // 5 minutes default
  const [timeRemaining, setTimeRemaining] = useState(totalTime);
  const [useSound, setUseSound] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);

  const intervalRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const phaseOrder: Phase[] = ['inhale', 'hold-in', 'exhale', 'hold-out'];
  const phaseDurations: Record<Phase, number> = {
    inhale: settings.inhale,
    'hold-in': settings.holdIn,
    exhale: settings.exhale,
    'hold-out': settings.holdOut,
  };
  
  const handleReset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerState(TimerState.Idle);
    setTimeRemaining(totalTime);
    setTimeInPhase(0);
    setCurrentPhase('inhale');
  }, [totalTime]);

  // Auto-hide controls logic
  const restartHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (timerState === TimerState.Running || timerState === TimerState.Preparing) {
        hideTimeoutRef.current = window.setTimeout(() => {
            setControlsVisible(false);
        }, 3000);
    }
  }, [timerState]);

  useEffect(() => {
    if (controlsVisible) {
        restartHideTimer();
    }
    return () => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [controlsVisible, restartHideTimer]);

  useEffect(() => {
    if (timerState === TimerState.Running || timerState === TimerState.Preparing) {
        restartHideTimer();
    } else {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        setControlsVisible(true);
    }
  }, [timerState, restartHideTimer]);

  useEffect(() => {
    handleReset();
  }, [settings, totalTime, handleReset]);

  useEffect(() => {
    // This is the main timer tick
    if (timerState !== TimerState.Running && timerState !== TimerState.Preparing) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setTimeInPhase(prev => prev - 1);
      // Only count down total time during the actual breathing exercise, not preparation
      if (totalTime > 0 && timerState === TimerState.Running) {
        setTimeRemaining(prev => prev - 1);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState, totalTime]);

  useEffect(() => {
    // This effect handles all phase transitions when a timer reaches zero,
    // and also plays countdown beeps.
    if (timeInPhase > 0) {
      // Countdown beeps for preparing phase
      if (timerState === TimerState.Preparing && useSound && timeInPhase <= 3) {
          playBeep(440, 150, 'triangle');
      }
      return;
    }

    // When countdown ends...
    if (timerState === TimerState.Preparing) {
      if (useSound) playBeep(600, 200, 'sine'); // Start beep
      setTimerState(TimerState.Running);
      setCurrentPhase('inhale');
      setTimeInPhase(settings.inhale);
      return;
    }

    // When a breathing phase ends...
    if (timerState === TimerState.Running) {
      if (useSound) playBeep(currentPhase === 'inhale' || currentPhase === 'exhale' ? 600 : 440, 100, 'triangle');
      
      let nextPhaseIndex = (phaseOrder.indexOf(currentPhase) + 1) % phaseOrder.length;
      while (phaseDurations[phaseOrder[nextPhaseIndex]] === 0) {
        nextPhaseIndex = (nextPhaseIndex + 1) % phaseOrder.length;
      }
      const nextPhase = phaseOrder[nextPhaseIndex];
      setCurrentPhase(nextPhase);
      setTimeInPhase(phaseDurations[nextPhase]);
    }
  }, [timeInPhase, timerState, currentPhase, phaseOrder, phaseDurations, useSound, settings.inhale]);


  useEffect(() => {
     if (timerState === TimerState.Running && totalTime > 0 && timeRemaining <= 0) {
        if (useSound) playBeep(880, 500, 'sine');
        handleReset();
    }
  }, [timeRemaining, timerState, totalTime, useSound, handleReset]);

  const onButtonPress = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  const handleStart = () => {
    getAudioContext()?.resume(); // Ensure audio is ready
    setTimerState(TimerState.Preparing);
    setTimeInPhase(10); // 10 second countdown
    setTimeRemaining(totalTime);
  };
  const handlePause = () => setTimerState(TimerState.Paused);
  const handleResume = () => setTimerState(TimerState.Running);

  const phaseText: Record<Phase, string> = {
    inhale: 'Andas In',
    'hold-in': 'Håll Andan',
    exhale: 'Andas Ut',
    'hold-out': 'Paus',
  };
  
  const getCircleClass = () => {
    if (timerState === TimerState.Idle) {
      return 'bg-slate-700 scale-[.6]';
    }
    if (timerState === TimerState.Preparing) {
        return 'bg-blue-500 scale-[.6]';
    }

    let scaleClass = '';
    let colorClass = '';
    switch (currentPhase) {
        case 'inhale':
            scaleClass = 'scale-100';
            colorClass = 'bg-blue-600';
            break;
        case 'hold-in':
            scaleClass = 'scale-100';
            colorClass = 'bg-sky-500';
            break;
        case 'exhale':
            scaleClass = 'scale-[.6]';
            colorClass = 'bg-teal-600';
            break;
        case 'hold-out':
            scaleClass = 'scale-[.6]';
            colorClass = 'bg-slate-600';
            break;
    }
    return `${colorClass} ${scaleClass}`;
  };
  
  const getTransitionDurationStyle = () => {
    if (timerState !== TimerState.Running) {
      return { transitionDuration: '500ms' };
    }
    switch (currentPhase) {
      case 'inhale':
        return { transitionDuration: `${settings.inhale * 1000}ms` };
      case 'exhale':
        return { transitionDuration: `${settings.exhale * 1000}ms` };
      default:
        return { transitionDuration: '200ms' }; // Fast transition for hold phases
    }
  };

  const buttonClass = "font-bold py-4 rounded-lg flex-1 flex items-center justify-center gap-2 transition-colors text-xl shadow-lg";

  return (
    <div 
        className="fixed inset-0 bg-white dark:bg-black z-20 flex flex-col items-center justify-center"
        onClick={() => setControlsVisible(true)}
    >
      <header className={`absolute top-0 left-0 right-0 p-4 sm:p-6 lg:p-8 w-full max-w-5xl mx-auto flex justify-between items-center z-30 transition-all duration-300 ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}>
        <button onClick={onButtonPress(onBack)} className="text-primary hover:brightness-95 transition-colors text-lg font-semibold">
            <span>Tillbaka</span>
        </button>
        <div className="flex items-center gap-4">
            <button onClick={onButtonPress(onOpenSettings)} className="text-gray-500 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors text-lg font-semibold">
                Inställningar
            </button>
            <button onClick={onButtonPress(toggleTheme)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Toggle theme">
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
        </div>
      </header>

      <div className="flex-grow flex flex-col items-center justify-center w-full">
        <div 
          className={`relative w-72 h-72 sm:w-[22rem] sm:h-[22rem] md:w-[26rem] md:h-[26rem] rounded-full transition-all ease-in-out flex items-center justify-center ${getCircleClass()}`}
          style={getTransitionDurationStyle()}
        >
          <div className="z-10 text-center select-none text-white flex flex-col items-center justify-center w-full h-full p-6">
            <p className="text-3xl font-semibold uppercase tracking-widest text-white/80 transition-opacity duration-500">
              {timerState === TimerState.Idle ? 'Tryck Start' : (timerState === TimerState.Preparing ? 'Gör dig redo' : phaseText[currentPhase])}
            </p>
            {timerState !== TimerState.Idle && (
              <p className="text-8xl font-black font-mono mt-2" style={{fontVariantNumeric: 'tabular-nums'}}>
                {timeInPhase > 0 ? timeInPhase : 0}
              </p>
            )}
          </div>
        </div>
      </div>
      
      <div className={`w-full max-w-sm flex items-center justify-center gap-4 p-4 transition-all duration-300 ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
        {timerState === TimerState.Idle && (
          <>
            <button onClick={onButtonPress(handleStart)} className={`${buttonClass} bg-primary hover:brightness-95 text-white`}>
                Starta Pacer
            </button>
            <button onClick={onButtonPress(handleReset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500 text-white`}>
                Återställ
            </button>
          </>
        )}
        {timerState === TimerState.Running && (
            <>
                <button onClick={onButtonPress(handlePause)} className={`${buttonClass} bg-primary hover:brightness-95 text-white`}>
                    Pausa Pacer
                </button>
                <button onClick={onButtonPress(handleReset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500 text-white`}>
                    Återställ
                </button>
            </>
        )}
        {timerState === TimerState.Paused && (
            <>
                <button onClick={onButtonPress(handleResume)} className={`${buttonClass} bg-primary hover:brightness-95 text-white`}>
                    Fortsätt
                </button>
                <button onClick={onButtonPress(handleReset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500 text-white`}>
                    Återställ
                </button>
            </>
        )}
      </div>

      {isSettingsOpen && (
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={onCloseSettings} 
          settings={settings}
          setSettings={setSettings}
          totalTime={totalTime}
          setTotalTime={setTotalTime}
          useSound={useSound}
          setUseSound={setUseSound}
        />
      )}
    </div>
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BreathingRhythm;
  setSettings: (settings: BreathingRhythm) => void;
  totalTime: number;
  setTotalTime: (time: number) => void;
  useSound: boolean;
  setUseSound: (use: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, setSettings, totalTime, setTotalTime, useSound, setUseSound }) => {
    if (!isOpen) return null;

    const [isCustom, setIsCustom] = useState(!Object.values(presets).some(p => JSON.stringify(p) === JSON.stringify(settings)));
    const [localSettings, setLocalSettings] = useState(settings);

    const handlePresetChange = (presetName: string) => {
        setIsCustom(false);
        setLocalSettings(presets[presetName]);
    };

    const handleCustomChange = (field: keyof Omit<BreathingRhythm, 'name' | 'description'>, value: string) => {
        setIsCustom(true);
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 0) return;
        setLocalSettings(prev => ({...prev, name: 'Anpassad', description: 'Din egen unika andningsrytm.', [field]: numValue }));
    };

    const handleSave = () => {
        setSettings(localSettings);
        onClose();
    };

    const ValueInput: React.FC<{label: string, id: keyof Omit<BreathingRhythm, 'name'| 'description'>, value: number}> = ({label, id, value}) => (
        <div className="flex flex-col items-center">
            <label htmlFor={id} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
            <input id={id} type="number" value={value} onChange={e => handleCustomChange(id, e.target.value)} className="w-20 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary text-center" />
        </div>
    );
  
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-lg text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold mb-6">Inställningar för Andning</h2>
            <button onClick={onClose} className="font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Stäng</button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Förinställda Rytmer</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(presets).map(key => (
                  <button key={key} onClick={() => handlePresetChange(key)} className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors text-left ${!isCustom && localSettings.name === presets[key].name ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                    {presets[key].name}
                  </button>
                ))}
              </div>
              {localSettings.description && (
                <div className="mt-4 bg-white dark:bg-black p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300">{localSettings.description}</p>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Anpassad Rytm (sekunder)</label>
              <div className="flex justify-around bg-white dark:bg-black p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <ValueInput label="Andas In" id="inhale" value={localSettings.inhale} />
                <ValueInput label="Håll" id="holdIn" value={localSettings.holdIn} />
                <ValueInput label="Andas Ut" id="exhale" value={localSettings.exhale} />
                <ValueInput label="Paus" id="holdOut" value={localSettings.holdOut} />
              </div>
            </div>
            
            <div>
              <label htmlFor="total-time" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Längd (minuter)</label>
              <input id="total-time" type="number" value={totalTime === 0 ? 0 : totalTime/60} onChange={e => setTotalTime((parseInt(e.target.value, 10) || 0) * 60)} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary" />
               <p className="text-xs text-gray-500 mt-1">Sätt till 0 för att köra på obestämd tid.</p>
            </div>

            <ToggleSwitch
              label="Ljudsignaler vid fasbyte"
              checked={useSound}
              onChange={setUseSound}
            />

          </div>
          <div className="mt-8">
            <button onClick={handleSave} className="w-full bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors shadow-sm">Spara & Stäng</button>
          </div>
        </div>
      </div>
    );
};