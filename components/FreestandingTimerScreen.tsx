
import React, { useState, useEffect, useCallback } from 'react';
import { WorkoutBlock, TimerMode, TimerSettings, Exercise } from '../types';
import { ValueAdjuster, ChevronDownIcon, ChevronUpIcon, SparklesIcon, TrashIcon } from './icons';
import { useStudio } from '../context/StudioContext';

interface FreestandingTimerScreenProps {
    onStart: (block: WorkoutBlock) => void;
    onCancel: () => void;
}

type CountMode = 'laps' | 'rounds';

export const FreestandingTimerScreen: React.FC<FreestandingTimerScreenProps> = ({ onStart, onCancel }) => {
    const { studioConfig, selectedOrganization } = useStudio();
    const orgId = selectedOrganization?.id || 'global';

    const [mode, setMode] = useState<TimerMode>(TimerMode.Interval);
  
    // State for different timer modes
    const [countMode, setCountMode] = useState<CountMode>('rounds');
    
    // Interval specific states
    const [rounds, setRounds] = useState(10); // Total rounds (Simple mode)
    const [laps, setLaps] = useState(3); // Varv
    const [intervalsPerLap, setIntervalsPerLap] = useState(4); // Stationer per varv

    const [totalMinutes, setTotalMinutes] = useState(10);
    const [workMinutes, setWorkMinutes] = useState(0);
    const [workSeconds, setWorkSeconds] = useState(30);
    const [restMinutes, setRestMinutes] = useState(0);
    const [restSeconds, setRestSeconds] = useState(15);
    
    // New state for direction
    const [direction, setDirection] = useState<'up' | 'down'>('down');

    // --- Saved Timer Templates ---
    interface SavedTimerTemplate {
        id: string;
        name: string;
        mode: TimerMode;
        direction: 'up' | 'down';
        countMode: CountMode;
        rounds: number;
        laps: number;
        intervalsPerLap: number;
        totalMinutes: number;
        workMinutes: number;
        workSeconds: number;
        restMinutes: number;
        restSeconds: number;
    }

    const [savedTemplates, setSavedTemplates] = useState<SavedTimerTemplate[]>([]);
    const [newTemplateName, setNewTemplateName] = useState('');

    // Load templates for this organization
    useEffect(() => {
        const key = `stored_freestanding_templates_${orgId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                setSavedTemplates(JSON.parse(stored));
            } catch (e) {
                console.error(e);
            }
        } else {
            // Default freestanding templates matching popular timers
            const defaults: SavedTimerTemplate[] = [
                {
                    id: 'freestand-tabata',
                    name: 'Klassisk Tabata',
                    mode: TimerMode.Tabata,
                    direction: 'down',
                    countMode: 'rounds',
                    rounds: 8,
                    laps: 1,
                    intervalsPerLap: 8,
                    totalMinutes: 4,
                    workMinutes: 0,
                    workSeconds: 20,
                    restMinutes: 0,
                    restSeconds: 10
                },
                {
                    id: 'freestand-emom10',
                    name: 'EMOM 10 Min',
                    mode: TimerMode.EMOM,
                    direction: 'down',
                    countMode: 'rounds',
                    rounds: 10,
                    laps: 1,
                    intervalsPerLap: 1,
                    totalMinutes: 10,
                    workMinutes: 1,
                    workSeconds: 0,
                    restMinutes: 0,
                    restSeconds: 0
                }
            ];
            setSavedTemplates(defaults);
            localStorage.setItem(key, JSON.stringify(defaults));
        }
    }, [orgId]);

    const handleSaveTemplate = () => {
        if (!newTemplateName.trim()) {
            alert("Skriv ett namn för din mall.");
            return;
        }
        const newTemplate: SavedTimerTemplate = {
            id: Date.now().toString(),
            name: newTemplateName.trim(),
            mode,
            direction,
            countMode,
            rounds,
            laps,
            intervalsPerLap,
            totalMinutes,
            workMinutes,
            workSeconds,
            restMinutes,
            restSeconds
        };

        const updated = [...savedTemplates, newTemplate];
        setSavedTemplates(updated);
        localStorage.setItem(`stored_freestanding_templates_${orgId}`, JSON.stringify(updated));
        setNewTemplateName('');
    };

    const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = savedTemplates.filter(t => t.id !== id);
        setSavedTemplates(updated);
        localStorage.setItem(`stored_freestanding_templates_${orgId}`, JSON.stringify(updated));
    };

    const handleLoadTemplate = (t: SavedTimerTemplate) => {
        setMode(t.mode);
        setDirection(t.direction || 'down');
        setCountMode(t.countMode || 'rounds');
        setRounds(t.rounds);
        setLaps(t.laps);
        setIntervalsPerLap(t.intervalsPerLap);
        setTotalMinutes(t.totalMinutes);
        setWorkMinutes(t.workMinutes);
        setWorkSeconds(t.workSeconds);
        setRestMinutes(t.restMinutes);
        setRestSeconds(t.restSeconds);
    };

    const getTemplateDescription = (t: SavedTimerTemplate) => {
        switch (t.mode) {
            case TimerMode.Interval:
                if (t.countMode === 'laps') {
                    return `Int: ${t.laps} varv x ${t.intervalsPerLap} int (${t.workMinutes}m ${t.workSeconds}s / ${t.restMinutes}m ${t.restSeconds}s)`;
                } else {
                    return `Int: ${t.rounds} omg (${t.workMinutes}m ${t.workSeconds}s / ${t.restMinutes}m ${t.restSeconds}s)`;
                }
            case TimerMode.Tabata:
                return 'Tabata: 8x (20s / 10s)';
            case TimerMode.AMRAP:
                return `AMRAP: ${t.totalMinutes} min`;
            case TimerMode.EMOM:
                return `EMOM: ${t.rounds} min`;
            case TimerMode.TimeCap:
                return `TimeCap: ${t.totalMinutes} min`;
            case TimerMode.Stopwatch:
                return 'Stoppur';
            default:
                return '';
        }
    };

    // Load saved settings on mount
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('freestandingTimerSettings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                if (parsed.mode) setMode(parsed.mode);
                if (parsed.countMode) setCountMode(parsed.countMode);
                if (parsed.rounds !== undefined) setRounds(parsed.rounds);
                if (parsed.laps !== undefined) setLaps(parsed.laps);
                if (parsed.intervalsPerLap !== undefined) setIntervalsPerLap(parsed.intervalsPerLap);
                if (parsed.totalMinutes !== undefined) setTotalMinutes(parsed.totalMinutes);
                if (parsed.workMinutes !== undefined) setWorkMinutes(parsed.workMinutes);
                if (parsed.workSeconds !== undefined) setWorkSeconds(parsed.workSeconds);
                if (parsed.restMinutes !== undefined) setRestMinutes(parsed.restMinutes);
                if (parsed.restSeconds !== undefined) setRestSeconds(parsed.restSeconds);
                if (parsed.direction) setDirection(parsed.direction);
            }
        } catch (e) {
            console.error("Could not load saved timer settings", e);
        }
    }, []);

    // Save settings whenever they change
    useEffect(() => {
        const settingsToSave = {
            mode, countMode, rounds, laps, intervalsPerLap, 
            totalMinutes, workMinutes, workSeconds, restMinutes, restSeconds, direction
        };
        localStorage.setItem('freestandingTimerSettings', JSON.stringify(settingsToSave));
    }, [mode, countMode, rounds, laps, intervalsPerLap, totalMinutes, workMinutes, workSeconds, restMinutes, restSeconds, direction]);

    // Prevent ghost clicks from modals closing by adding a small mount delay
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 500);
        return () => clearTimeout(timer);
    }, []);

    const isConfigurationValid = useCallback(() => {
        const totalWorkSeconds = workMinutes * 60 + workSeconds;
        switch(mode) {
          case TimerMode.Interval:
            if (countMode === 'laps') {
                return totalWorkSeconds > 0 && laps > 0 && intervalsPerLap > 0;
            }
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
    }, [mode, workMinutes, workSeconds, rounds, totalMinutes, countMode, laps, intervalsPerLap]);

    // Reset settings when mode changes manually (only if not loading from storage)
    const handleModeChange = (newMode: TimerMode) => {
        setMode(newMode);
        setDirection('down');

        switch(newMode) {
            case TimerMode.Interval: 
                setCountMode('rounds');
                setLaps(3);
                setIntervalsPerLap(4);
                setRounds(10);
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
    };

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
                let calculatedRounds = rounds;
                if (countMode === 'laps') {
                    calculatedRounds = laps * intervalsPerLap;
                    settings.specifiedLaps = laps;
                    settings.specifiedIntervalsPerLap = intervalsPerLap;
                }
                
                settings = { 
                    ...settings, 
                    workTime: workMinutes * 60 + workSeconds, 
                    restTime: restMinutes * 60 + restSeconds, 
                    rounds: calculatedRounds 
                };
                
                if (countMode === 'laps') {
                    title = `${laps} varv x ${intervalsPerLap} intervaller`;
                } else {
                    title = `${calculatedRounds} intervaller`;
                }
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
                    <div className={`flex flex-col items-center gap-y-6 w-full ${animationClass}`}>
                        {/* Toggle Laps vs Rounds */}
                        <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                            <button onClick={() => setCountMode('laps')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${countMode === 'laps' ? 'bg-white dark:bg-black shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Varv & Intervaller</button>
                            <button onClick={() => setCountMode('rounds')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${countMode === 'rounds' ? 'bg-white dark:bg-black shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Omgångar</button>
                        </div>

                        {countMode === 'laps' ? (
                            <div className="flex gap-6 animate-fade-in">
                                <ValueAdjuster label="ANTAL VARV" value={laps} onchange={setLaps} />
                                <ValueAdjuster label="INTERVALLER/VARV" value={intervalsPerLap} onchange={setIntervalsPerLap} />
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <ValueAdjuster label="ANTAL OMGÅNGAR" value={rounds} onchange={setRounds} />
                            </div>
                        )}

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
        <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-8 animate-fade-in relative">
            
            {/* Section 1: Timer Type */}
            <section className="w-full">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Välj Timertyp</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.values(TimerMode).filter(m => m !== TimerMode.NoTimer && m !== TimerMode.Custom).map(m => (
                        <button 
                        key={m} 
                        onClick={() => handleModeChange(m)} 
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

            {/* Sparade mallar */}
            <section className="w-full bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <SparklesIcon className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sparade timermallar</h3>
                </div>

                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Namnge denna inställning (t.ex. AMRAP 12min)"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="flex-grow bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
                    />
                    <button
                        type="button"
                        onClick={handleSaveTemplate}
                        className="bg-primary hover:brightness-95 text-white font-bold text-sm px-5 rounded-lg uppercase tracking-wider transition-all shadow-md shrink-0 active:scale-95"
                    >
                        Spara klocka
                    </button>
                </div>

                {savedTemplates.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-4">
                        Inga sparade klockor för denna organisation ännu.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                        {savedTemplates.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => handleLoadTemplate(t)}
                                className={`group flex justify-between items-center bg-gray-50 dark:bg-black/45 p-3 rounded-lg border cursor-pointer transition-all shadow-sm ${
                                    mode === t.mode && 
                                    direction === t.direction && 
                                    countMode === t.countMode && 
                                    rounds === t.rounds && 
                                    laps === t.laps && 
                                    intervalsPerLap === t.intervalsPerLap && 
                                    totalMinutes === t.totalMinutes && 
                                    workMinutes === t.workMinutes && 
                                    workSeconds === t.workSeconds && 
                                    restMinutes === t.restMinutes && 
                                    restSeconds === t.restSeconds
                                        ? 'border-primary ring-1 ring-primary/30' 
                                        : 'border-gray-250 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900'
                                }`}
                            >
                                <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{t.name}</span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider truncate">{getTemplateDescription(t)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => handleDeleteTemplate(t.id, e)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
                                    title="Ta bort mall"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Section 3: Start Button */}
            <section className="w-full pt-4">
                    <button 
                    onClick={handleStartTimer} 
                    disabled={!isConfigurationValid() || !isReady}
                    className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 text-xl lg:text-2xl rounded-lg flex items-center justify-center gap-3 transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:text-gray-400 dark:disabled:text-gray-400 disabled:cursor-not-allowed shadow-lg"
                    >
                    <span>Starta Timer</span>
                </button>
            </section>
        </div>
    );
}
