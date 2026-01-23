
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WorkoutBlock, Exercise, BankExercise, TimerMode } from '../../types';
import { EditableField } from './EditableField';
import { ToggleSwitch, ChevronUpIcon, ChevronDownIcon, ChartBarIcon, PencilIcon, TrashIcon, SparklesIcon } from '../icons';
import { generateExerciseDescription } from '../../services/geminiService';
import { parseSettingsFromTitle } from '../../hooks/useWorkoutTimer';
import { motion, AnimatePresence } from 'framer-motion';

interface ExerciseItemProps {
    exercise: Exercise;
    onUpdate: (id: string, updatedValues: Partial<Exercise>) => void;
    onRemove: (id: string) => void;
    exerciseBank: BankExercise[];
    index: number;
    total: number;
    onMove: (direction: 'up' | 'down') => void;
}

const ExerciseItem: React.FC<ExerciseItemProps> = ({ exercise, onUpdate, onRemove, exerciseBank, index, total, onMove }) => {
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

    // Smart filtering and sorting
    const searchResults = useMemo(() => {
        if (searchQuery.length < 2 || !isSearchVisible) return [];
        
        const query = searchQuery.toLowerCase();
        return exerciseBank
            .filter(ex => ex.name.toLowerCase().includes(query))
            .sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                
                // 1. Exact match first
                if (aName === query) return -1;
                if (bName === query) return 1;
                
                // 2. Starts with query first
                const aStarts = aName.startsWith(query);
                const bStarts = bName.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // 3. Alphabetical for the rest
                return aName.localeCompare(bName, 'sv');
            })
            .slice(0, 15); // Limit to top 15 matches
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
        onUpdate(exercise.id, { name: newName });
    };

    const handleSelectExercise = (bankExercise: BankExercise) => {
        onUpdate(exercise.id, {
            name: bankExercise.name,
            description: bankExercise.description,
            imageUrl: bankExercise.imageUrl,
            reps: exercise.reps, 
            isFromBank: true,
        });
        setIsSearchVisible(false);
        setSearchQuery('');
    };

    const handleToggleLogging = () => {
        if (window.navigator.vibrate) window.navigator.vibrate(5);
        onUpdate(exercise.id, { loggingEnabled: !exercise.loggingEnabled });
    };
    
    return (
        <div 
            ref={searchContainerRef} 
            className={`group p-3 rounded-lg flex items-start gap-3 transition-all border-l-4 relative ${
                isSearchVisible ? 'z-[100]' : 'z-0'
            } ${
                exercise.loggingEnabled 
                ? 'bg-green-50 dark:bg-green-900/10 border-green-500' 
                : 'bg-gray-100 dark:bg-gray-700/50 border-transparent'
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
                <div className="flex items-center gap-2 relative">
                    <input
                        type="text"
                        value={exercise.reps || ''}
                        onChange={e => onUpdate(exercise.id, { reps: e.target.value })}
                        placeholder="Antal"
                        className={`appearance-none !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-semibold placeholder-gray-400 dark:placeholder-gray-500 w-24`}
                    />
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            value={exercise.name}
                            onChange={handleNameChange}
                            onFocus={() => {
                                setIsSearchVisible(true);
                                setSearchQuery(exercise.name);
                            }}
                            placeholder="Sök eller skriv övningsnamn"
                            className={`appearance-none w-full !bg-white dark:!bg-gray-700 !text-gray-900 dark:!text-white border border-gray-300 dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-semibold placeholder-gray-400 dark:placeholder-gray-500`}
                        />
                        {isSearchVisible && searchResults.length > 0 && (
                            <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-2xl z-[1000] max-h-80 overflow-y-auto ring-1 ring-black/5">
                                {searchResults.map(result => (
                                    <li key={result.id}>
                                        <button
                                            onClick={() => handleSelectExercise(result)}
                                            className="w-full text-left px-4 py-3 hover:bg-primary/20 text-gray-900 dark:text-white transition-colors font-bold border-b border-gray-50 dark:border-gray-700 last:border-0"
                                        >
                                            {result.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    <button 
                        onClick={handleToggleLogging}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border font-bold text-[10px] uppercase tracking-wider transform active:scale-95 ${
                            exercise.loggingEnabled 
                            ? 'bg-green-500 border-green-600 text-white shadow-sm' 
                            : 'bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500'
                        }`}
                        title={exercise.loggingEnabled ? "Loggning aktiverad" : "Aktivera loggning för medlemmar"}
                    >
                        <ChartBarIcon className={`w-3.5 h-3.5 ${exercise.loggingEnabled ? 'text-white' : 'text-gray-400'}`} />
                        <span>{exercise.loggingEnabled ? 'Loggas' : 'Loggas ej'}</span>
                    </button>

                    <button onClick={() => onRemove(exercise.id)} className="flex-shrink-0 text-red-500 hover:text-red-400 transition-colors text-sm font-medium p-1">
                        <TrashIcon className="w-5 h-5" />
                    </button>
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
}

export const EditableBlockCard: React.FC<EditableBlockCardProps> = ({ 
    block, index, totalBlocks, onUpdate, onRemove, onEditSettings, 
    isDraggable, workoutTitle, workoutBlocksCount, editorRefs, exerciseBank, 
    organizationId, onMoveExercise, onMoveBlock 
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
        const allEnabled = block.exercises.length > 0 && block.exercises.every(ex => ex.loggingEnabled);
        const updatedExercises = block.exercises.map(ex => ({
            ...ex,
            loggingEnabled: !allEnabled
        }));
        onUpdate({ ...block, exercises: updatedExercises });
    };

    const createNewExercise = (): Exercise => ({
        id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: '',
        reps: '',
        description: '',
        imageUrl: '',
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

    const allExercisesLogged = block.exercises.length > 0 && block.exercises.every(ex => ex.loggingEnabled);
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
                                        onClick={() => handleFieldChange('transitionTime', (block.transitionTime || 0) + 5)}
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

            <div className="bg-gray-100 dark:bg-black p-3 my-4 rounded-md flex justify-between items-center text-sm">
                <p className="text-gray-600 dark:text-gray-300">
                    Inställningar: <span className="font-semibold text-gray-900 dark:text-white">{settingsText}</span>
                </p>
                <button onClick={onEditSettings} className="text-primary hover:underline font-semibold">Anpassa</button>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Välj blockets primära tagg</label>
                <div className="flex flex-wrap gap-2">
                    {['Styrka', 'Kondition', 'Rörlighet', 'Teknik', 'Core/Bål', 'Balans', 'Uppvärmning'].map(tag => (
                        <button
                            key={tag}
                            onClick={() => handleFieldChange('tag', tag)}
                            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                                block.tag === tag
                                ? 'bg-primary text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex justify-between items-center mb-3">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="flex justify-between items-center text-left text-lg font-bold text-gray-900 dark:text-white group">
                        <span>Övningar ({block.exercises.length})</span>
                        <motion.span 
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            className="ml-2 inline-block"
                        >▶</motion.span>
                    </button>
                    {isExpanded && block.exercises.length > 0 && (
                        <button 
                            onClick={handleToggleAllLogging}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline px-2 py-1 rounded bg-primary/5 border border-primary/10 transition-colors"
                        >
                            {allExercisesLogged ? 'Avmarkera alla' : 'Logga alla'}
                        </button>
                    )}
                </div>

                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3 overflow-hidden"
                        >
                            {block.exercises.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 py-2">Blocket är tomt. Klicka på '+ Lägg till övning'.</p>
                            ) : (
                                block.exercises.map((ex, i) => (
                                    <ExerciseItem 
                                        key={ex.id} 
                                        exercise={ex} 
                                        onUpdate={updateExercise} 
                                        onRemove={() => removeExercise(ex.id)}
                                        exerciseBank={exerciseBank}
                                        index={i}
                                        total={block.exercises.length}
                                        onMove={(direction) => onMoveExercise(i, direction)}
                                    />
                                ))
                            )}
                            <button onClick={addExercise} className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                <span>Lägg till övning</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
