
import React, { useState, useEffect, useCallback } from 'react';
import { WorkoutBlock, TimerMode, TimerSettings, Exercise } from '../types';
import { ValueAdjuster, ChevronDownIcon, ChevronUpIcon } from './icons';
import { useStudio } from '../context/StudioContext';

interface FreestandingTimerScreenProps {
    onStart: (block: WorkoutBlock) => void;
}

export const FreestandingTimerScreen: React.FC<FreestandingTimerScreenProps> = ({ onStart }) => {
    const { studioConfig } = useStudio();
    const [mode, setMode] = useState<TimerMode>(TimerMode.Interval);
  
    // State for different timer modes
    const [rounds, setRounds] = useState(3);
    const [totalMinutes, setTotalMinutes] = useState(10);
    const [workMinutes, setWorkMinutes] = useState(0);
    const [workSeconds, setWorkSeconds] = useState(30);
    const [restMinutes, setRestMinutes] = useState(0);
    const [restSeconds, setRestSeconds] = useState(15);
    
    // New state for direction
    const [direction, setDirection] = useState<'up' | 'down'>('down');

    const isConfigurationValid = useCallback(() => {
        const totalWorkSeconds = workMinutes * 60 + workSeconds;
        switch(mode) {
          case TimerMode.Interval:
            return totalWorkSeconds > 0 && rounds > 0;
          case TimerMode.Tabata:
          case TimerMode.Stopwatch:
            return true;
          case TimerMode.AMRAP:
          case TimerMode.TimeCap:
            return totalMinutes > 0;
          case TimerMode.EMOM:
            return rounds > 0;
          default:
            return false;
        }
    }, [mode, workMinutes, workSeconds, rounds, totalMinutes]);

    // Reset settings when mode changes
    useEffect(() => {
        // Reset direction to down by default when switching modes, unless it's stopwatch
        setDirection('down');

        switch(mode) {
            case TimerMode.Interval: 
                setRounds(3); 
                setWorkMinutes(0); 
                setWorkSeconds(30); 
                setRestMinutes(0); 
                setRestSeconds(15); 
                break;
            case TimerMode.AMRAP: 
            case TimerMode.TimeCap: 
                setTotalMinutes(10);
                break;
            case TimerMode.EMOM: 
                setRounds(10);
                break;
            default: break;
        }
    }, [mode]);

    const handleStartTimer = () => {
        let settings: Partial<TimerSettings> & { mode: TimerMode, prepareTime: number } = { 
            mode, 
            prepareTime: 10,
            direction // Pass the direction state
        };
        let title: string = mode;
        let exercises: Exercise[] = [{ id: 'ex-dummy', name: mode }];

        switch (mode) {
            case TimerMode.Interval:
                settings = { ...settings, workTime: workMinutes * 60 + workSeconds, restTime: restMinutes * 60 + restSeconds, rounds: rounds };
                title = mode;
                exercises = [{ id: 'ex-interval-work', name: 'Arbete' }];
                break;
            case TimerMode.Tabata:
                settings = { ...settings, workTime: 20, restTime: 10, rounds: 8 };
                title = mode;
                exercises = [{ id: 'ex-tabata-work', name: 'Arbete' }];
                break;
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                settings = { ...settings, workTime: totalMinutes * 60, restTime: 0, rounds: 1 };
                title = `${mode} ${totalMinutes} min`;
                break;
            case TimerMode.EMOM:
                settings = { ...settings, workTime: 60, restTime: 0, rounds: rounds };
                title = `EMOM ${rounds} min`;
                exercises = [{ id: 'ex-emom-work', name: 'Ny minut' }];
                break;
            case TimerMode.Stopwatch:
                settings = { ...settings, workTime: 3600, restTime: 0, rounds: 1 }; 
                title = `Stoppur`;
                exercises = [{ id: 'ex-dummy', name: 'Tid' }];
                break;
        }
        const blockToStart: WorkoutBlock = { 
            id: `freestanding-${Date.now()}`, 
            title, 
            tag: "Fristående", 
            setupDescription: `Användardefinierad timer: ${mode}`, 
            settings: settings as TimerSettings, 
            exercises,
            followMe: false, // Freestanding is always "follow me" style
        };
        onStart(blockToStart);
    };

    const renderDirectionToggle = () => {
        // Don't show for NoTimer or Stopwatch (Stopwatch is always up)
        if (mode === TimerMode.NoTimer || mode === TimerMode.Stopwatch) return null;
        
        return (
            <div className="flex justify-center mb-6 w-full">
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

    const renderSettings = () => {
        const animationClass = 'animate-fade-in';
        switch (mode) {
            case TimerMode.Interval:
                return (
                    <div className={`flex flex-col items-center gap-y-8 w-full ${animationClass}`}>
                        <ValueAdjuster label="ANTAL OMGÅNGAR" value={rounds} onchange={setRounds} />
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
                 return <div className={animationClass}><ValueAdjuster label="TOTAL TID (MINUTER)" value={totalMinutes} onchange={setTotalMinutes} /></div>;
            case TimerMode.EMOM:
                 return <div className={animationClass}><ValueAdjuster label="TOTAL TID (MINUTER)" value={rounds} onchange={setRounds} /></div>;
            case TimerMode.Tabata:
                return (
                    <div className={`text-center text-gray-600 dark:text-gray-300 p-4 rounded-lg ${animationClass}`}>
                        <h4 className="font-bold text-gray-800 dark:text-white text-lg">Standard Tabata</h4>
                        <p className="mt-2">8 omgångar</p>
                        <p>20 sekunder arbete</p>
                        <p>10 sekunder vila</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">(Dessa värden är fasta för Tabata)</p>
                    </div>
                );
            case TimerMode.Stopwatch:
                return (
                     <div className={`text-center text-gray-600 dark:text-gray-300 p-4 rounded-lg ${animationClass}`}>
                        <h4 className="font-bold text-gray-800 dark:text-white text-lg">Stoppur</h4>
                        <p className="mt-2">Timern kommer att räkna upp från 00:00 när du trycker start.</p>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-8 animate-fade-in">
            {/* Section 1: Timer Type */}
            <section className="w-full">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Välj Timertyp</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.values(TimerMode).filter(m => m !== TimerMode.NoTimer).map(m => (
                        <button 
                        key={m} 
                        onClick={() => setMode(m)} 
                        className={`px-6 py-4 text-lg font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black ${
                            mode === m 
                            ? 'bg-primary text-white' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                        >
                        {m}
                        </button>
                    ))}
                </div>
            </section>

            {/* Section 2: Settings */}
            <section className="w-full">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. Anpassa {mode}</h2>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 min-h-[350px] flex flex-col justify-center items-center">
                    {renderDirectionToggle()}
                    {renderSettings()}
                </div>
                {mode !== TimerMode.Stopwatch && (
                    <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">Alla timers inkluderar 10s 'Gör dig redo'-tid.</p>
                )}
            </section>

            {/* Section 3: Start Button */}
            <section className="w-full pt-4">
                    <button 
                    onClick={handleStartTimer} 
                    disabled={!isConfigurationValid()}
                    className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 text-xl lg:text-2xl rounded-lg flex items-center justify-center gap-3 transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:text-gray-400 dark:disabled:text-gray-400 disabled:cursor-not-allowed shadow-lg"
                    >
                    <span>Starta Timer</span>
                </button>
            </section>
        </div>
    );
}
