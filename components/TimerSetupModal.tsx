
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { WorkoutBlock, TimerMode, TimerSegment } from '../types';
import { ValueAdjuster, ChevronDownIcon, ChevronUpIcon, ToggleSwitch, SparklesIcon, TrashIcon, PlusIcon } from './icons';

interface TimerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: WorkoutBlock;
  onSave: (newSettings: Partial<WorkoutBlock['settings']> & { autoAdvance?: boolean; transitionTime?: number }) => void;
  isLastBlock?: boolean;
}

type CountMode = 'laps' | 'rounds';

const secondsToMinSec = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
};

export const TimerSetupModal: React.FC<TimerSetupModalProps> = ({ isOpen, onClose, block, onSave, isLastBlock = false }) => {
  // --- Initialize State Lazily from Props ---
  const [initialState] = useState(() => {
      const { mode, workTime, restTime, rounds, specifiedLaps, specifiedIntervalsPerLap, direction, sequence } = block.settings;
      const work = secondsToMinSec(workTime);
      const rest = secondsToMinSec(restTime);
      
      let iVarv = 1;
      let iIntervallerPerVarv = 1;
      let iTotalOmgångar = 1;
      let iCountMode: CountMode = 'laps';
      let iTotalMinutes = 10;

      if (mode === TimerMode.Interval) {
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
      } else if (mode === TimerMode.Custom) {
           iVarv = rounds || 1; // Reuse 'varv' variable for custom sequence loops
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
          direction: direction || 'down',
          autoAdvance: block.autoAdvance || false,
          transitionTime: block.transitionTime || 0,
          sequence: sequence || []
      };
  });

  const [mode, setMode] = useState(initialState.mode);
  const [countMode, setCountMode] = useState<CountMode>(initialState.countMode);
  
  // States for Interval - Laps mode (Also used for Custom Sequence Loops)
  const [varv, setVarv] = useState(initialState.varv);
  const [intervallerPerVarv, setIntervallerPerVarv] = useState(initialState.intervallerPerVarv);
  
  // State for Interval - Rounds mode
  const [totalOmgångar, setTotalOmgångar] = useState(initialState.totalOmgångar);

  // States for EMOM/TimeCap/AMRAP
  const [totalMinutes, setTotalMinutes] = useState(initialState.totalMinutes);
  
  // States for work/rest time
  const [workMinutes, setWorkMinutes] = useState(initialState.workMinutes);
  const [workSeconds, setWorkSeconds] = useState(initialState.workSeconds);
  const [restMinutes, setRestMinutes] = useState(initialState.restMinutes);
  const [restSeconds, setRestSeconds] = useState(initialState.restSeconds);
  
  const [direction, setDirection] = useState<'up' | 'down'>(initialState.direction);
  const [autoAdvance, setAutoAdvance] = useState(initialState.autoAdvance);
  const [transitionTime, setTransitionTime] = useState(initialState.transitionTime);

  // State for Custom Sequence
  const [sequence, setSequence] = useState<TimerSegment[]>(initialState.sequence);

  const hasUnsavedChanges = useMemo(() => {
      if (mode !== initialState.mode) return true;
      if (direction !== initialState.direction) return true;
      if (autoAdvance !== initialState.autoAdvance) return true;
      if (transitionTime !== initialState.transitionTime) return true;

      switch (mode) {
          case TimerMode.Custom:
              if (varv !== initialState.varv) return true;
              if (JSON.stringify(sequence) !== JSON.stringify(initialState.sequence)) return true;
              return false;
          case TimerMode.Interval:
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
          
          case TimerMode.Tabata:
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
      workMinutes, workSeconds, restMinutes, restSeconds, direction, autoAdvance, transitionTime, initialState, sequence
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
    const newSettings: any = { mode, direction };

    switch(mode) {
      case TimerMode.Custom:
        newSettings.rounds = varv; // In Custom, rounds = laps of the sequence
        newSettings.sequence = sequence;
        // Basic fallback time for overview (e.g. sum of 1 lap)
        const seqTotal = sequence.reduce((acc, s) => acc + (s.duration || 0), 0);
        newSettings.workTime = seqTotal; 
        newSettings.restTime = 0;
        break;
      case TimerMode.Interval:
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
      case TimerMode.Tabata:
        // Fixed standard settings for Tabata
        newSettings.rounds = 8;
        newSettings.workTime = 20;
        newSettings.restTime = 10;
        newSettings.specifiedLaps = undefined;
        newSettings.specifiedIntervalsPerLap = undefined;
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

    onSave({ 
        ...newSettings, 
        autoAdvance: isLastBlock ? false : autoAdvance, 
        transitionTime 
    });
    onClose();
  };
  
  const handleModeChange = (newMode: TimerMode) => {
    setMode(newMode);
    if (newMode === TimerMode.Interval) {
        setCountMode('laps');
        setVarv(3);
        setIntervallerPerVarv(block.exercises.length > 0 ? block.exercises.length : 1);
    } else if (newMode === TimerMode.AMRAP || newMode === TimerMode.TimeCap || newMode === TimerMode.EMOM) {
        setTotalMinutes(10);
    } else if (newMode === TimerMode.Custom) {
        if (sequence.length === 0) {
            setSequence([
                { type: 'work', duration: 30, title: 'Arbete' },
                { type: 'rest', duration: 15, title: 'Vila' }
            ]);
        }
        setVarv(3); // Default loop count
    }
  }

  // --- CUSTOM SEQUENCE HANDLERS ---
  const addSegment = () => {
      setSequence(prev => [...prev, { type: 'work', duration: 30, title: 'Arbete' }]);
  };

  const removeSegment = (index: number) => {
      setSequence(prev => prev.filter((_, i) => i !== index));
  };

  const updateSegment = (index: number, updates: Partial<TimerSegment>) => {
      setSequence(prev => {
          const next = [...prev];
          next[index] = { ...next[index], ...updates };
          return next;
      });
  };

  const renderDirectionToggle = () => {
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
        case TimerMode.Custom:
             return (
                 <div className={`w-full ${animationClass}`}>
                    <div className="flex justify-center mb-6">
                         <ValueAdjuster label="ANTAL VARV (LOOP)" value={varv} onchange={setVarv} />
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {sequence.map((seg, i) => {
                            const { minutes, seconds } = secondsToMinSec(seg.duration);
                            return (
                                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${seg.type === 'work' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30' : 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-900/30'}`}>
                                    <div className="flex flex-col gap-1 items-center">
                                        <button 
                                            onClick={() => updateSegment(i, { type: seg.type === 'work' ? 'rest' : 'work' })}
                                            className={`text-[10px] font-black uppercase px-2 py-1 rounded w-16 text-center transition-colors ${seg.type === 'work' ? 'bg-orange-500 text-white' : 'bg-teal-500 text-white'}`}
                                        >
                                            {seg.type === 'work' ? 'Arbete' : 'Vila'}
                                        </button>
                                        <span className="text-xs font-mono text-gray-400">{i + 1}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                        <input 
                                            type="number" 
                                            value={minutes} 
                                            onChange={e => updateSegment(i, { duration: (parseInt(e.target.value) || 0) * 60 + seconds })}
                                            className="w-10 text-center bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded p-1 text-sm font-bold" 
                                            placeholder="m"
                                        />
                                        <span>:</span>
                                        <input 
                                            type="number" 
                                            value={seconds} 
                                            onChange={e => updateSegment(i, { duration: minutes * 60 + (parseInt(e.target.value) || 0) })}
                                            className="w-10 text-center bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded p-1 text-sm font-bold"
                                            placeholder="s"
                                        />
                                    </div>

                                    <input 
                                        type="text" 
                                        value={seg.title || ''} 
                                        onChange={e => updateSegment(i, { title: e.target.value })}
                                        className="flex-grow bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded p-2 text-sm font-medium"
                                        placeholder={seg.type === 'work' ? 'Titel (t.ex. Löpning)' : 'Titel (t.ex. Vila)'}
                                    />

                                    <button onClick={() => removeSegment(i)} className="text-red-400 hover:text-red-600 p-1">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    
                    <button 
                        onClick={addSegment} 
                        className="w-full mt-4 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-bold"
                    >
                        <PlusIcon className="w-4 h-4" /> Lägg till steg
                    </button>
                 </div>
             );

        case TimerMode.Interval:
            return (
              <div className={`flex flex-col items-center gap-y-6 w-full ${animationClass}`}>
                  <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                      <button onClick={() => setCountMode('laps')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${countMode === 'laps' ? 'bg-white dark:bg-black shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Varv & Intervaller</button>
                      <button onClick={() => setCountMode('rounds')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${countMode === 'rounds' ? 'bg-white dark:bg-black shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Omgångar</button>
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
        case TimerMode.Tabata:
            return (
                <div className={`text-center text-gray-600 dark:text-gray-300 p-4 rounded-lg ${animationClass}`}>
                    <h4 className="font-bold text-gray-800 dark:text-white text-lg">Standard Tabata</h4>
                    <p className="mt-2">8 ronder</p>
                    <p>20 sekunder arbete</p>
                    <p>10 sekunder vila</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">(Dessa värden är fasta för Tabata)</p>
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
        <h2 id="timer-setup-title" className="text-2xl font-bold mb-1">Anpassa klocka</h2>
        <h3 className="text-lg text-primary mb-6 font-semibold">{`"${block.title}"`}</h3>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Timertyp</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleModeChange(TimerMode.Interval)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode === TimerMode.Interval ? 'bg-primary text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
            >
              Interval
            </button>
            <button
              onClick={() => handleModeChange(TimerMode.Tabata)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode === TimerMode.Tabata ? 'bg-primary text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
            >
              Tabata
            </button>
            <button
              onClick={() => handleModeChange(TimerMode.AMRAP)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode === TimerMode.AMRAP ? 'bg-primary text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
            >
              AMRAP
            </button>
            <button
              onClick={() => handleModeChange(TimerMode.EMOM)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode === TimerMode.EMOM ? 'bg-primary text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
            >
              EMOM
            </button>
            <button
              onClick={() => handleModeChange(TimerMode.TimeCap)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode === TimerMode.TimeCap ? 'bg-primary text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
            >
              TimeCap
            </button>
            <button
              onClick={() => handleModeChange(TimerMode.Custom)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode === TimerMode.Custom ? 'bg-primary text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
            >
              Sekvens
            </button>
            <button
              onClick={() => handleModeChange(TimerMode.NoTimer)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode === TimerMode.NoTimer ? 'bg-primary text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
            >
              Ingen Timer
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-black rounded-lg p-6 border border-gray-200 dark:border-gray-700 min-h-[350px] flex flex-col justify-center items-center">
            {renderDirectionToggle()}
            {renderSettingsInputs()}
        </div>

        {/* --- AUTO ADVANCE SETTINGS --- */}
        {!isLastBlock && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                 <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/50">
                     <div className="flex items-center gap-3">
                         <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                         <span className="font-bold text-gray-900 dark:text-white">Automatisk övergång</span>
                     </div>
                     <ToggleSwitch 
                        label="" 
                        checked={autoAdvance} 
                        onChange={setAutoAdvance} 
                     />
                 </div>
                 
                 {autoAdvance && (
                     <div className="animate-fade-in p-4 bg-white dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-gray-700">
                         <ValueAdjuster 
                            label="Vila inför nästa del (sekunder)" 
                            value={transitionTime} 
                            onchange={setTransitionTime} 
                            step={5}
                         />
                         <p className="text-[10px] text-gray-500 mt-2 text-center uppercase tracking-widest font-bold italic">
                            Nästa block startar automatiskt efter denna tid.
                         </p>
                     </div>
                 )}
            </div>
        )}

        <div className="mt-8 flex gap-4">
          <button onClick={handleSave} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors shadow-sm">Spara</button>
          <button onClick={() => { if (!hasUnsavedChanges || window.confirm("Avbryt och kasta ändringar?")) onClose(); }} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
