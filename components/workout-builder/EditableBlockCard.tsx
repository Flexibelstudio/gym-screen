
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WorkoutBlock, Exercise, BankExercise, TimerMode } from '../../types';
import { EditableField } from './EditableField';
import { ToggleSwitch, ChevronUpIcon, ChevronDownIcon, ChartBarIcon, PencilIcon, TrashIcon, SparklesIcon, BuildingIcon, PlusIcon } from '../icons';
import { generateExerciseDescription } from '../../services/geminiService';
import { parseSettingsFromTitle } from '../../hooks/useWorkoutTimer';
import { motion, AnimatePresence } from 'framer-motion';
import { saveExerciseToBank } from '../../services/firebaseService';

interface ExerciseItemProps {
    exercise: Exercise;
    onUpdate: (id: string, updatedValues: Partial<Exercise>) => void;
    onRemove: (id: string) => void;
    exerciseBank: BankExercise[];
    index: number;
    total: number;
    onMove: (direction: 'up' | 'down') => void;
    organizationId: string;
    onExerciseSavedToBank?: (exercise: BankExercise) => void;
}

const ExerciseItem: React.FC<ExerciseItemProps> = ({ exercise, onUpdate, onRemove, exerciseBank, index, total, onMove, organizationId, onExerciseSavedToBank }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    const handleGenerateDescription = async () => {
        if (!exercise.name.trim()) {
            alert("Skriv ett namn på övningen först för att kunna generera en beskrivning.");
            return;
        }
        setIsGeneratingDesc(true);
        try {
            const description = await generateExerciseDescription(exercise.name);
            onUpdate(exercise.id, { description });
        } catch (error) {
            alert("Kunde inte generera en beskrivning. Försök igen.");
            console.error(error);
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    // Smartare sökning och sortering
    const searchResults = useMemo(() => {
        if (searchQuery.length < 2 || !isSearchVisible) return [];
        
        const query = searchQuery.toLowerCase();
        return exerciseBank
            .filter(ex => ex.name.toLowerCase().includes(query))
            .sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                
                // 1. Exakt träff först
                if (aName === query) return -1;
                if (bName === query) return 1;
                
                // 2. Börjar med sökordet först
                const aStarts = aName.startsWith(query);
                const bStarts = bName.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // 3. Alfabetiskt för resten
                return aName.localeCompare(bName, 'sv');
            })
            .slice(0, 15); // Visa max 15 för prestanda
    }, [searchQuery, exerciseBank, isSearchVisible]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchVisible(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setSearchQuery(newName);
        // När man skriver manuellt blir det en Ad-hoc övning (isFromBank = false)
        // Vi sätter också loggingEnabled till false som default för ad-hoc
        onUpdate(exercise.id, { name: newName, isFromBank: false, loggingEnabled: false });
    };

    const handleSelectExercise = (bankExercise: BankExercise) => {
        onUpdate(exercise.id, {
            id: bankExercise.id, // Koppla ID
            name: bankExercise.name,
            description: bankExercise.description,
            imageUrl: bankExercise.imageUrl,
            reps: exercise.reps, 
            isFromBank: true,
            loggingEnabled: true // Default true för bank-övningar
        });
        setIsSearchVisible(false);
        setSearchQuery('');
    };

    const handleToggleLogging = () => {
        if (window.navigator.vibrate) window.navigator.vibrate(5);
        onUpdate(exercise.id, { loggingEnabled: !exercise.loggingEnabled });
    };

    const handleSaveToBank = async () => {
        if (!organizationId) {
            alert("Ingen organisation vald. Kan inte spara lokalt.");
            return;
        }
        if (!exercise.name.trim()) return;

        // 1. Skapa unikt ID för custom exercise
        const newId = `custom_${organizationId}_${Date.now()}`;
        
        const newBankExercise: BankExercise = {
            id: newId,
            name: exercise.name,
            description: exercise.description || '',
            tags: [],
            imageUrl: exercise.imageUrl,
            organizationId: organizationId // Viktigt för att den ska sparas i custom_exercises
        };

        try {
            // 2. Spara till Firestore först
            await saveExerciseToBank(newBankExercise);

            // 3. VIKTIGT: Uppdatera listan i sidomenyn INNAN vi uppdaterar själva övningen
            // Detta förhindrar att komponenten avmonteras (pga ID-byte) innan callbacken hinner köras.
            if (onExerciseSavedToBank) {
                onExerciseSavedToBank(newBankExercise);
            }

            // 4. Uppdatera UI för själva övningskortet (detta byter ID och orsakar re-render/unmount av denna komponent)
            onUpdate(exercise.id, { 
                id: newId, 
                isFromBank: true, 
                loggingEnabled: true // Aktivera loggning direkt
            });

        } catch (e) {
            console.error("Failed to save custom exercise", e);
            alert("Kunde inte spara övningen till banken.");
        }
    };

    // STRICT CHECK: Only trust the flag. ID pattern check removed to allow "unlinking".
    const isBanked = !!exercise.isFromBank;
    
    return (
        <div 
            ref={searchContainerRef} 
            className={`group p-3 rounded-lg flex items-start gap-3 transition-all border-l-4 relative ${
                isSearchVisible ? 'z-[1000]' : 'z-0'
            } ${
                isBanked
                ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-400' 
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600'
            }`}
        >
            <div className="flex flex-col gap-1 items-center justify-center self-center mr-2">
                <button 
                    disabled={index === 0} 
                    onClick={() => onMove('up')} 
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronUpIcon className="w-5 h-5" />
                </button>
                <button 
                    disabled={index === total - 1} 
                    onClick={() => onMove('down')} 
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronDownIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-grow space-y-2">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <input
                        type="text"
                        value={exercise.reps || ''}
                        onChange={e => onUpdate(exercise.id, { reps: e.target.value })}
                        placeholder="Antal"
                        className={`appearance-none !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-semibold placeholder-gray-400 dark:placeholder-gray-500 w-20 sm:w-24`}
                    />
                    <div className="relative flex-grow min-w-[150px]">
                        <input
                            type="text"
                            value={exercise.name}
                            onChange={handleNameChange}
                            onFocus={() => {
                                setIsSearchVisible(true);
                                setSearchQuery(exercise.name);
                            }}
                            placeholder="Sök eller skriv övningsnamn"
                            className={`appearance-none w-full !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-semibold placeholder-gray-400 dark:placeholder-gray-500 pr-8`}
                        />
                         {/* Visual Indicator inside input */}
                         <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            {isBanked ? (
                                <BuildingIcon className="w-4 h-4 text-blue-500" />
                            ) : (
                                <span className="text-xs grayscale opacity-50">📝</span>
                            )}
                        </div>

                        {isSearchVisible && searchResults.length > 0 && (
                            <ul className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] z-[2000] max-h-80 overflow-y-auto ring-1 ring-black/5 p-1 animate-fade-in">
                                {searchResults.map(result => (
                                    <li key={result.id}>
                                        <button
                                            onClick={() => handleSelectExercise(result)}
                                            className="w-full text-left px-4 py-3 hover:bg-primary/10 text-gray-900 dark:text-white transition-colors font-bold rounded-xl border-b border-gray-50 dark:border-gray-700/50 last:border-0 flex justify-between items-center"
                                        >
                                            <span>{result.name}</span>
                                            <BuildingIcon className="w-3 h-3 text-blue-400" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-auto sm:ml-0">
                        {/* Status Badge & Save Button */}
                        <div className="flex items-center gap-1">
                            {isBanked ? (
                                <div 
                                    className="px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider select-none bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                                    title="Kopplad till övningsbanken (Statistik sparas)"
                                >
                                    Bank
                                </div>
                            ) : (
                                <>
                                    <div 
                                        className="px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider select-none bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                        title="Fristående text (Ingen statistik sparas)"
                                    >
                                        Ad-hoc
                                    </div>
                                    <button
                                        onClick={handleSaveToBank}
                                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors text-[9px] font-black uppercase tracking-wider"
                                        title="Spara som lokal övning för att kunna logga"
                                    >
                                        <PlusIcon className="w-3 h-3" />
                                        <span className="hidden sm:inline">Spara</span>
                                    </button>
                                </>
                            )}
                        </div>

                        <button 
                            onClick={handleToggleLogging}
                            disabled={!isBanked}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border font-bold text-[10px] uppercase tracking-wider transform active:scale-95 ${
                                exercise.loggingEnabled 
                                ? 'bg-green-500 border-green-600 text-white shadow-sm' 
                                : isBanked 
                                    ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 hover:border-gray-400'
                                    : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 cursor-not-allowed'
                            }`}
                            title={!isBanked ? "Spara övningen i banken för att aktivera loggning" : (exercise.loggingEnabled ? "Loggning aktiverad" : "Aktivera loggning")}
                        >
                            <ChartBarIcon className={`w-3.5 h-3.5 ${exercise.loggingEnabled ? 'text-white' : 'text-current'}`} />
                        </button>

                        <button onClick={() => onRemove(exercise.id)} className="text-red-500 hover:text-red-400 transition-colors text-sm font-medium p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div className="relative">
                    <textarea
                      value={exercise.description || ''}
                      onChange={e => onUpdate(exercise.id, { description: e.target.value })}
                      placeholder="Beskrivning (klicka på ✨ för AI-förslag)"
                      className={`appearance-none !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-semibold placeholder-gray-400 dark:placeholder-gray-500 w-full text-sm h-16 pr-10`}
                      rows={2}
                    />
                    <button
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDesc}
                      className="absolute top-2 right-2 text-gray-400 hover:text-purple-500 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGeneratingDesc ? <div className="w-5 h-5 border-2 border-purple-500/50 border-t-purple-500 rounded-full animate-spin"></div> : <SparklesIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface EditableBlockCardProps {
    block: WorkoutBlock;
    index: number;
    totalBlocks: number;
    onUpdate: (updatedBlock: WorkoutBlock) => void;
    onRemove: () => void;
    onEditSettings: () => void;
    isDraggable: boolean;
    workoutTitle: string;
    workoutBlocksCount: number;
    editorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    exerciseBank: BankExercise[];
    organizationId: string;
    onMoveExercise: (index: number, direction: 'up' | 'down') => void;
    onMoveBlock: (direction: 'up' | 'down') => void;
    onExerciseSavedToBank?: (exercise: BankExercise) => void;
}

export const EditableBlockCard: React.FC<EditableBlockCardProps> = ({ 
    block, index, totalBlocks, onUpdate, onRemove, onEditSettings, 
    isDraggable, workoutTitle, workoutBlocksCount, editorRefs, exerciseBank, 
    organizationId, onMoveExercise, onMoveBlock, onExerciseSavedToBank 
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    const handleFieldChange = (field: keyof WorkoutBlock, value: any) => {
        const updatedBlock = { ...block, [field]: value };
        if (field === 'title' && typeof value === 'string') {
            const settingsFromTitle = parseSettingsFromTitle(value);
            if (settingsFromTitle) {
                updatedBlock.settings = { ...updatedBlock.settings, ...settingsFromTitle };
            }
        }
        onUpdate(updatedBlock);
    };

    const handleToggleAllLogging = () => {
        if (window.navigator.vibrate) window.navigator.vibrate(15);
        // Strict check: Only count exercises where isFromBank is true
        const bankedExercises = block.exercises.filter(ex => !!ex.isFromBank);
        
        if (bankedExercises.length === 0) {
            alert("Inga övningar i detta block är kopplade till banken. Koppla dem först för att aktivera loggning.");
            return;
        }

        const allEnabled = bankedExercises.every(ex => ex.loggingEnabled);
        const updatedExercises = block.exercises.map(ex => {
            if (!!ex.isFromBank) {
                return { ...ex, loggingEnabled: !allEnabled };
            }
            return ex;
        });
        onUpdate({ ...block, exercises: updatedExercises });
    };

    const createNewExercise = (): Exercise => ({
        id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: '',
        reps: '',
        description: '',
        imageUrl: '',
        isFromBank: false, // Default ad-hoc
        loggingEnabled: false
    });

    const addExercise = () => {
        const newExercises = [...block.exercises, createNewExercise()];
        onUpdate({ ...block, exercises: newExercises });
    };

    const updateExercise = (exId: string, updatedValues: Partial<Exercise>) => {
        const updatedExercises = block.exercises.map(ex => (ex.id === exId ? { ...ex, ...updatedValues } : ex));
        onUpdate({ ...block, exercises: updatedExercises });
    };

    const removeExercise = (exId: string) => {
        const updatedExercises = block.exercises.filter(ex => ex.id !== exId);
        onUpdate({ ...block, exercises: updatedExercises });
    };

    const settingsText = useMemo(() => {
        const { mode, workTime, restTime, rounds, specifiedLaps, specifiedIntervalsPerLap } = block.settings;
        if (mode === TimerMode.NoTimer) return "Ingen timer";
        if (mode === TimerMode.Stopwatch) return "Stoppur";
        
        const formatTime = (t: number) => {
            const m = Math.floor(t / 60);
            const s = t % 60;
            const mPart = m > 0 ? `${m}m` : '';
            const sPart = s > 0 ? `${s}s` : '';
            return `${mPart} ${sPart}`.trim() || '0s';
        }

        if (mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) return `${mode}: ${formatTime(workTime)}`;
        if (mode === TimerMode.EMOM) return `EMOM: ${rounds} min`;

        let displayString = `${mode}: ${rounds}x`;
        if (specifiedLaps && specifiedIntervalsPerLap) {
            displayString = `${mode}: ${specifiedLaps} varv x ${specifiedIntervalsPerLap} intervaller`;
        }

        return `${displayString} (${formatTime(workTime)} / ${formatTime(restTime)})`;
    }, [block.settings]);

    // Strict check for bank exercises count using isFromBank flag only
    const bankExercisesCount = block.exercises.filter(ex => !!ex.isFromBank).length;
    const allBankedLogged = bankExercisesCount > 0 && block.exercises
        .filter(ex => !!ex.isFromBank)
        .every(ex => ex.loggingEnabled);
        
    const isLastBlock = index === totalBlocks - 1;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border-2 border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 flex-grow min-h-[44px]">
                    <div className="flex flex-col gap-1 mr-2">
                        <button disabled={index === 0} onClick={() => onMoveBlock('up')} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed">
                            <ChevronUpIcon className="w-5 h-5" />
                        </button>
                        <button disabled={index === totalBlocks - 1} onClick={() => onMoveBlock('down')} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed">
                            <ChevronDownIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <EditableField 
                        label="Blockets Titel" 
                        value={block.title} 
                        onChange={val => handleFieldChange('title', val)}
                        isTitle
                    />
                </div>
                <button onClick={onRemove} className="text-red-500 hover:text-red-400 ml-4 flex-shrink-0 font-semibold p-2">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>

            <EditableField
                label="Uppläggsbeskrivning"
                value={block.setupDescription || ''}
                onChange={val => handleFieldChange('setupDescription', val)}
                isTextarea
            />
            
            <div className="my-4 flex flex-col gap-3">
                <ToggleSwitch
                    label="Visa beskrivning i timern"
                    checked={!!block.showDescriptionInTimer}
                    onChange={(isChecked) => handleFieldChange('showDescriptionInTimer', isChecked)}
                />
                 <ToggleSwitch
                    label="Visa övningsbeskrivningar i timer"
                    checked={block.showExerciseDescriptions !== false} // Default true
                    onChange={(isChecked) => handleFieldChange('showExerciseDescriptions', isChecked)}
                />
                <ToggleSwitch
                    label="'Följ mig'-läge"
                    checked={!!block.followMe}
                    onChange={(isChecked) => handleFieldChange('followMe', isChecked)}
                />
                
                {!isLastBlock && (
                    <div className="flex flex-col gap-3 p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/50">
                        <ToggleSwitch
                            label="Automatisk start av nästa block"
                            checked={!!block.autoAdvance}
                            onChange={(isChecked) => handleFieldChange('autoAdvance', isChecked)}
                        />
                        {block.autoAdvance && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="flex items-center gap-4 pl-2 pt-2 border-t border-purple-100 dark:border-purple-800/50"
                            >
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Vila</span>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleFieldChange('transitionTime', Math.max(0, (block.transitionTime || 0) - 5))}
                                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 active:scale-95 transition-all"
                                    >
                                        -
                                    </button>
                                    <div className="min-w-[40px] text-center font-mono font-black text-purple-600 dark:text-purple-400">
                                        {block.transitionTime || 0}s
                                    </div>
                                    <button 
                                        onClick={async () => handleFieldChange('transitionTime', (block.transitionTime || 0) + 5)}
                                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 active:scale-95 transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-3xl flex justify-between items-center border border-primary/20">
                <div>
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1">Vald Timer</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{block.settings.mode}</p>
                </div>
                <button onClick={onEditSettings} className="bg-primary text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all">Anpassa klockan</button>
            </div>

            <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center px-1">
                    <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Övningar ({block.exercises.length})</h4>
                    <button 
                        onClick={() => {
                            const allLog = block.exercises.every(ex => ex.loggingEnabled);
                            onUpdate({ ...block, exercises: block.exercises.map(ex => ({ ...ex, loggingEnabled: !allLog })) });
                        }}
                        className="text-[10px] font-black uppercase text-primary hover:underline"
                    >
                        Logga alla i blocket
                    </button>
                </div>
                {block.exercises.map((ex, i) => (
                    <ExerciseItem 
                        key={ex.id} 
                        exercise={ex} 
                        onUpdate={updateExercise} 
                        onRemove={() => removeExercise(ex.id)}
                        exerciseBank={exerciseBank}
                        index={i}
                        total={block.exercises.length}
                        onMove={(direction) => onMoveExercise(i, direction)}
                        organizationId={organizationId}
                        onExerciseSavedToBank={onExerciseSavedToBank}
                    />
                ))}
                <button 
                    onClick={() => onUpdate({ ...block, exercises: [...block.exercises, createNewExercise()] })} 
                    className="w-full py-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2rem] text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                    <span className="text-xl">+</span> Lägg till övning
                </button>
            </div>
        </div>
    );
};
