
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WorkoutBlock, Exercise, BankExercise, TimerMode } from '../../types';
import { ToggleSwitch, SparklesIcon, ChevronUpIcon, ChevronDownIcon, ChartBarIcon } from '../icons';
import { generateExerciseDescription } from '../../services/geminiService';
import { parseSettingsFromTitle } from '../../hooks/useWorkoutTimer';
import { EditableField } from './EditableField';

const createNewExercise = (): Exercise => ({
  id: `ex-${Date.now()}`,
  name: 'Ny Övning',
  reps: '',
  description: '',
});

interface EditableExerciseItemProps {
    exercise: Exercise;
    onChange: (updatedExercise: Partial<Exercise>) => void;
    onRemove: () => void;
    exerciseBank: BankExercise[];
    organizationId: string;
    index: number;
    total: number;
    onMove: (direction: 'up' | 'down') => void;
}

const EditableExerciseItem: React.FC<EditableExerciseItemProps> = ({ exercise, onChange, onRemove, exerciseBank, organizationId, index, total, onMove }) => {
    const baseClasses = "w-full bg-transparent focus:outline-none disabled:bg-transparent";
    const textClasses = "text-gray-900 dark:text-white";
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<BankExercise[]>([]);
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
            onChange({ description });
        } catch (error) {
            alert("Kunde inte generera en beskrivning. Försök igen.");
            console.error(error);
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    useEffect(() => {
        if (searchQuery.length > 1 && isSearchVisible) {
            const filtered = exerciseBank.filter(ex =>
                ex.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setSearchResults(filtered);
        } else {
            setSearchResults([]);
        }
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
        onChange({ name: newName });
    };

    const handleSelectExercise = (bankExercise: BankExercise) => {
        onChange({
            id: bankExercise.id, // Update ID to match bank
            name: bankExercise.name,
            description: bankExercise.description || '',
            isFromBank: true,
        });
        setIsSearchVisible(false);
        setSearchQuery('');
    };


    return (
        <div 
          ref={searchContainerRef}
          className="group p-3 rounded-lg flex items-start gap-3 transition-all bg-gray-100 dark:bg-gray-700/50 relative"
        >
            <div className="flex flex-col gap-1 items-center justify-center self-center mr-2">
                <button 
                    disabled={index === 0} 
                    onClick={() => onMove('up')} 
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Flytta upp"
                >
                    <ChevronUpIcon className="w-5 h-5" />
                </button>
                <button 
                    disabled={index === total - 1} 
                    onClick={() => onMove('down')} 
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Flytta ner"
                >
                    <ChevronDownIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-grow space-y-2">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={exercise.reps || ''}
                        onChange={e => onChange({ reps: e.target.value })}
                        placeholder="Antal"
                        className={`${baseClasses.replace('w-full', '')} ${textClasses} w-24 font-semibold placeholder-gray-500`}
                    />
                    <input
                        type="text"
                        value={exercise.name}
                        onChange={handleNameChange}
                        onFocus={() => {
                            setIsSearchVisible(true);
                            setSearchQuery(exercise.name);
                        }}
                        placeholder="Sök eller skriv övningsnamn"
                        className={`${baseClasses} ${textClasses} font-semibold`}
                    />
                    
                    {/* LOGGNING TOGGLE */}
                    <button 
                        onClick={() => onChange({ loggingEnabled: !exercise.loggingEnabled })}
                        className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
                            exercise.loggingEnabled 
                            ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' 
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                        title={exercise.loggingEnabled ? "Loggning aktiverad" : "Aktivera loggning för medlemmar"}
                    >
                        <ChartBarIcon className="w-5 h-5" />
                    </button>

                    <button onClick={onRemove} className="flex-shrink-0 text-red-500 hover:text-red-400 transition-colors text-sm font-medium" title="Ta bort övning">ta bort</button>
                </div>

                {isSearchVisible && searchResults.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                        {searchResults.map(result => (
                            <li key={result.id}>
                                <button
                                    onClick={() => handleSelectExercise(result)}
                                    className="w-full text-left px-4 py-2 hover:bg-primary/20 text-gray-900 dark:text-white"
                                >
                                    {result.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                
                <div className="relative">
                    <textarea
                      value={exercise.description || ''}
                      onChange={e => onChange({ description: e.target.value })}
                      placeholder="Beskrivning (klicka på ✨ för AI-förslag)"
                      className={`${baseClasses} text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-300 p-2 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary h-16 pr-10`}
                      rows={2}
                    />
                    <button
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDesc}
                      className="absolute top-2 right-2 text-gray-400 hover:text-purple-500 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                      title="Generera beskrivning med AI"
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
    onUpdate: (block: WorkoutBlock) => void;
    onRemove: () => void;
    onEditSettings: () => void;
    isDraggable: boolean;
    workoutTitle: string;
    workoutBlocksCount: number;
    editorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    exerciseBank: BankExercise[];
    organizationId: string;
    onMoveExercise: (exerciseIndex: number, direction: 'up' | 'down') => void;
    onMoveBlock?: (direction: 'up' | 'down') => void;
    index?: number;
    totalBlocks?: number;
}

export const EditableBlockCard: React.FC<EditableBlockCardProps> = ({ block, onUpdate, onRemove, onEditSettings, isDraggable, workoutTitle, workoutBlocksCount, editorRefs, exerciseBank, organizationId, onMoveExercise, onMoveBlock, index = 0, totalBlocks = 1 }) => {
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

    const handleExerciseChange = (exId: string, updatedExercise: Partial<Exercise>) => {
        onUpdate({
            ...block,
            exercises: block.exercises.map(ex => ex.id === exId ? { ...ex, ...updatedExercise } : ex)
        });
    };

    const handleAddExercise = () => {
      const newEx = createNewExercise();
      const newExercises = [...block.exercises, newEx];
      onUpdate({ ...block, exercises: newExercises });
      setTimeout(() => { 
          editorRefs.current[`exercise-${newEx.id}`]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    };

    const handleRemoveExercise = (exId: string) => {
      onUpdate({
        ...block,
        exercises: block.exercises.filter(ex => ex.id !== exId),
      });
    };
    
    const isTitleRedundant = block.title === workoutTitle && workoutBlocksCount === 1;
    
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

        // Interval & Tabata Logic
        let displayString = `${mode}: ${rounds}x`;
        if (specifiedLaps && specifiedIntervalsPerLap) {
            displayString = `${mode}: ${specifiedLaps} varv x ${specifiedIntervalsPerLap} intervaller`;
        }

        return `${displayString} (${formatTime(workTime)} / ${formatTime(restTime)})`;
    }, [block.settings]);


    return (
        <div 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border-2 border-gray-200 dark:border-gray-700"
        >
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4 flex-grow min-h-[44px]">
                {/* Move Controls */}
                {isDraggable && onMoveBlock && (
                    <div className="flex flex-col gap-1 mr-2">
                        <button 
                            disabled={index === 0}
                            onClick={() => onMoveBlock('up')}
                            className="text-gray-400 hover:text-gray-800 dark:hover:text-white disabled:opacity-20 transition-colors"
                        >
                            <ChevronUpIcon className="w-5 h-5" />
                        </button>
                        <button 
                            disabled={index === totalBlocks - 1}
                            onClick={() => onMoveBlock('down')}
                            className="text-gray-400 hover:text-gray-800 dark:hover:text-white disabled:opacity-20 transition-colors"
                        >
                            <ChevronDownIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {!isTitleRedundant && (
                    <EditableField 
                        label="Blockets Titel" 
                        value={block.title} 
                        onChange={val => handleFieldChange('title', val)}
                        isTitle
                    />
                )}
              </div>
              {isDraggable && <button onClick={onRemove} className="text-red-500 hover:text-red-400 ml-4 flex-shrink-0 font-semibold">Ta bort</button>}
          </div>
          <EditableField
              label="Uppläggsbeskrivning"
              value={block.setupDescription}
              onChange={val => handleFieldChange('setupDescription', val)}
              isTextarea
          />
          
          <div className="my-4">
            <ToggleSwitch
                label="'Följ mig'-läge"
                checked={!!block.followMe}
                onChange={(isChecked) => handleFieldChange('followMe', isChecked)}
            />
            <p className="text-xs text-gray-500 mt-1 pl-2">
                <span className="font-bold">På:</span> Alla gör samma övning samtidigt. <span className="font-bold">Av:</span> För stationsbaserad cirkelträning.
            </p>
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
                {['Styrka', 'Kondition', 'Rörlighet', 'Teknik', 'Core/Bål', 'Balans', 'Uppvärmning'].map(tag => {
                const isSelected = block.tag === tag;
                return (
                    <button
                    key={tag}
                    onClick={() => handleFieldChange('tag', tag)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                        isSelected
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                    >
                    {tag}
                    </button>
                );
                })}
            </div>
          </div>
        
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  <span>Övningar ({block.exercises.length})</span>
                  <span>{isExpanded ? 'Dölj' : 'Visa'}</span>
              </button>
              {isExpanded && (
                  <div className="space-y-3">
                      {block.exercises.map((ex, index) => (
                          <div key={ex.id} ref={el => { editorRefs.current[`exercise-${ex.id}`] = el; }}>
                            <EditableExerciseItem 
                                exercise={ex}
                                onChange={updatedEx => handleExerciseChange(ex.id, updatedEx)}
                                onRemove={() => handleRemoveExercise(ex.id)}
                                exerciseBank={exerciseBank}
                                organizationId={organizationId}
                                index={index}
                                total={block.exercises.length}
                                onMove={(direction) => onMoveExercise(index, direction)}
                            />
                          </div>
                      ))}
                       <button onClick={handleAddExercise} className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                          <span>Lägg till Övning</span>
                      </button>
                  </div>
              )}
          </div>
        </div>
    );
};
