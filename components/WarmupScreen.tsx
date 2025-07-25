

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerSettings, TimerMode } from '../types';
import { generateWorkout } from '../services/geminiService';
import { TimerSetupModal } from './TimerSetupModal';

const WARMUP_PROMPT = `
Du är en expertcoach på Flexibel Hälsostudio. Ditt uppdrag är att skapa en dynamisk helkroppsuppvärmning med fokus på att öka blodflöde, rörlighet och aktivering av stora muskelgrupper inför ett träningspass. Passen ska vara cirka 5 minuter långa totalt, utan vila mellan övningarna.

**Exempel på övningar att använda (välj passande från denna lista):**
1. Armcirklar framåt
2. Armcirklar bakåt
3. Benpendlingar framåt/bakåt
4. Benpendlingar åt sidan
5. Höga knän på stället
6. Hälar till rumpan
7. Torso-rotationer (stående)
8. Katt & Ko (stående eller på alla fyra)
9. Dynamiska knäböj
10. Walkouts till plankposition
11. Knälyft med bålrotation
12. Lunges med armtwist
13. Höftcirklar (stående)
14. Jumping Jacks
15. Sidosteg med klapp ovanför huvud
16. Dynamiska höftöppnare (stående eller i gångläge)
17. Skipping (lätta studs med aktiva armar)
18. Tå-touch + overhead reach (stå, nudda tårna, sträck upp armarna)
19. Diagonala höga knän (höger knä mot vänster hand, växelvis)
20. Squat to reach (knäböj med armar upp i toppläget för helkroppsaktivering)

**JSON Output Regler:**
*   **Struktur:** Skapa ett JSON-objekt med en lista \`blocks\` som innehåller exakt ett block. Sätt en övergripande \`title\` på rot-objektet, som kan vara namnet på uppvärmningen.
*   **Blocktitel:** Ge blocket en passande \`title\`, t.ex. "Dynamisk Helkroppsuppvärmning".
*   **Beskrivning:** I blockets \`setupDescription\`, tydliggör upplägget (antal övningar, arbetstid, vila, antal omgångar).
*   **Tag & Format:** Sätt blockets \`tag\` till "Uppvärmning" och \`followMe\` till \`true\`.
*   **Övningar:** Fyll blockets \`exercises\`-array med en lista av enkla, dynamiska övningar utan redskap. Antalet övningar måste matcha det upplägg du valt.

**Timerinställningar (VIKTIGT):**
*   **Mode:** Sätt blockets \`settings.mode\` till "Intervall".
*   **Välj ett av följande upplägg (UTAN VILA):** Basera dina \`settings\` och antalet övningar på ett av dessa alternativ för att nå ca 5 minuter. Du kan justera antalet övningar, arbetstid och antal varv för att nå rätt längd.
    *   **Alternativ 1:** 10 övningar × 30 sek arbete, 0 sek vila, 1 omgång.
    *   **Alternativ 2:** 5 övningar × 30 sek arbete, 0 sek vila, 2 omgångar.
    *   **Alternativ 3:** 6 övningar × 40 sek arbete, 0 sek vila, 1 omgång (detta blir 4 min, du kan lägga till en extra övning på 60s för att nå 5 min).
*   **Konsistens:** Säkerställ att värdena du anger i \`settings\` (workTime, restTime, rounds) och antalet övningar i \`exercises\`-listan exakt matchar det upplägg du valt. Sätt ALLTID \`restTime\` till 0.
`;

const createNewExercise = (): Exercise => ({
  id: `ex-${Date.now()}`,
  name: '',
  reps: '',
  description: '',
});

interface WarmupScreenProps {
  onStartBlock: (block: WorkoutBlock) => void;
}

export const WarmupScreen: React.FC<WarmupScreenProps> = ({ onStartBlock }) => {
  const [warmup, setWarmup] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);

  const warmupBlock = useMemo(() => warmup?.blocks?.[0] || null, [warmup]);

  const generateNewWarmup = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const generatedWorkout = await generateWorkout(WARMUP_PROMPT);
      if (generatedWorkout.blocks.length > 0) {
        setWarmup(generatedWorkout);
      } else {
        throw new Error("AI:n lyckades inte generera ett uppvärmningspass. Försök igen.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ett okänt fel uppstod.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    generateNewWarmup();
  }, [generateNewWarmup]);

  const handleUpdateBlock = (updatedBlock: WorkoutBlock) => {
    if (warmup) {
      setWarmup({ ...warmup, blocks: [updatedBlock] });
    }
  };

  const handleUpdateSettings = (newSettings: Partial<TimerSettings>) => {
    if (warmupBlock) {
      handleUpdateBlock({ ...warmupBlock, settings: { ...warmupBlock.settings, ...newSettings } });
    }
    setEditingBlockId(null);
  };
  
  const handleAddExercise = () => {
    if (warmupBlock) {
      const newExercise = createNewExercise();
      handleUpdateBlock({ ...warmupBlock, exercises: [...warmupBlock.exercises, newExercise] });
      setActiveExerciseId(newExercise.id);
    }
  };

  const handleUpdateExercise = (exId: string, updatedValues: Partial<Exercise>) => {
    if(warmupBlock) {
        const updatedExercises = warmupBlock.exercises.map(ex => (ex.id === exId ? { ...ex, ...updatedValues } : ex));
        handleUpdateBlock({ ...warmupBlock, exercises: updatedExercises });
    }
  };

  const handleRemoveExercise = (exId: string) => {
    if(warmupBlock) {
        const updatedExercises = warmupBlock.exercises.filter(ex => ex.id !== exId);
        handleUpdateBlock({ ...warmupBlock, exercises: updatedExercises });
    }
  };
  
  const calculateTotalTime = (block: WorkoutBlock | null) => {
    if (!block) return 0;
    const { settings, exercises } = block;
    if (exercises.length === 0) return 0;
    const totalExercises = exercises.length;

    switch (settings.mode) {
        case TimerMode.Interval:
        case TimerMode.Tabata:
            const totalWork = settings.rounds * totalExercises * settings.workTime;
            const totalRests = settings.rounds * totalExercises - 1;
            const totalRestTime = Math.max(0, totalRests * settings.restTime);
            return totalWork + totalRestTime;
        case TimerMode.AMRAP:
        case TimerMode.TimeCap:
            return settings.workTime;
        case TimerMode.EMOM:
            return settings.rounds * 60;
        default:
            return 0;
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    if (minutes > 0 && seconds > 0) return `${minutes} min ${seconds} sek`;
    if (minutes > 0) return `${minutes} min`;
    return `${seconds} sek`;
  }
  
  const settingsText = useMemo(() => {
    if (!warmupBlock) return "";
    const { settings, exercises } = warmupBlock;
    const { mode, workTime, restTime, rounds, prepareTime } = settings;
    
    if (mode === TimerMode.Interval || mode === TimerMode.Tabata) {
        const roundLabel = 'varv'; // "varv" works for both singular and plural in Swedish.
        const exerciseLabel = exercises.length === 1 ? 'övning' : 'övningar';
        return `${rounds} ${roundLabel}, ${exercises.length} ${exerciseLabel}, ${workTime} sek arbete, ${restTime} sek vila, ${prepareTime}s redo.`;
    }
    return `Specialupplägg, ${exercises.length} övningar`;
  }, [warmupBlock]);

  const renderContent = () => {
    if (isLoading) {
        return <div className="flex flex-col items-center justify-center text-center p-10">
            <div className="relative w-16 h-16 text-orange-500">
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
            </div>
            <p className="text-xl text-gray-300 mt-4">AI:n skapar en uppvärmning...</p>
        </div>;
    }

    if (error) {
        return <div className="text-center p-10 bg-red-900/50 rounded-lg border border-red-600">
            <p className="text-xl text-red-300">Något gick fel</p>
            <p className="text-gray-300 mt-2 mb-4">{error}</p>
            <button onClick={generateNewWarmup} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg">
                Försök igen
            </button>
        </div>;
    }

    if (!warmupBlock) {
        return <div className="text-center p-10"><p className="text-gray-400">Ingen uppvärmning kunde laddas.</p></div>;
    }

    return (
        <div className="bg-stone-900 rounded-xl p-6 shadow-lg border border-orange-500/50">
            <h2 className="text-2xl font-bold text-white">{warmupBlock.title}</h2>
            <p className="text-gray-300 mt-2">{warmupBlock.setupDescription}</p>

            <hr className="border-gray-700 my-4" />

            <div>
                <h3 className="text-lg font-semibold text-orange-400">Lätt uppmjukning</h3>
                <p className="text-gray-400 text-sm">Utför varje övning mjukt och kontrollerat.</p>
            </div>

            <div className="bg-stone-800 p-3 my-4 rounded-md flex justify-between items-center text-sm flex-wrap gap-2">
                <p className="text-gray-300">Aktuella inställningar: <span className="font-semibold text-white">{settingsText}</span></p>
                <button onClick={() => setEditingBlockId(warmupBlock.id)} className="text-orange-400 hover:underline font-semibold">Anpassa tider</button>
            </div>
            
            <button onClick={handleAddExercise} className="flex items-center gap-2 text-orange-400 hover:text-orange-300 font-semibold text-sm py-2">
                <span>Lägg till övning</span>
            </button>

            <div className="space-y-2 mt-2">
                {warmupBlock.exercises.map(ex => (
                    <ExerciseItem 
                        key={ex.id} 
                        exercise={ex}
                        onUpdate={handleUpdateExercise}
                        onRemove={handleRemoveExercise}
                        isActive={activeExerciseId === ex.id}
                        onSelect={() => setActiveExerciseId(prevId => prevId === ex.id ? null : ex.id)}
                    />
                ))}
            </div>
        </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-24 animate-fade-in">
        {renderContent()}

        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 border-t border-gray-700 z-10">
            <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
                <button 
                    onClick={generateNewWarmup}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-white font-semibold py-3 px-5 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors disabled:opacity-50"
                >
                    <span>Nytt förslag</span>
                </button>
                <button 
                    onClick={() => warmupBlock && onStartBlock(warmupBlock)}
                    disabled={isLoading || !warmupBlock || warmupBlock.exercises.length === 0}
                    className="flex items-center gap-2 text-white font-bold py-3 px-8 rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors text-lg shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <span>Starta Uppvärmning</span>
                </button>
            </div>
        </div>

        {editingBlockId && warmupBlock && (
            <TimerSetupModal
                isOpen={!!editingBlockId}
                onClose={() => setEditingBlockId(null)}
                block={warmupBlock}
                onSave={handleUpdateSettings}
            />
        )}
    </div>
  );
};

// --- Sub-component for exercises ---
interface ExerciseItemProps {
    exercise: Exercise;
    onUpdate: (id: string, updatedValues: Partial<Exercise>) => void;
    onRemove: (id: string) => void;
    isActive: boolean;
    onSelect: () => void;
}
const ExerciseItem: React.FC<ExerciseItemProps> = ({ exercise, onUpdate, onRemove, isActive, onSelect }) => {
    const [isEditing, setIsEditing] = useState(exercise.name === '');

    const handleRemoveClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove(exercise.id);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 bg-stone-700 p-3 rounded-lg ring-2 ring-orange-500">
                <input
                    type="text"
                    value={exercise.name}
                    onChange={e => onUpdate(exercise.id, { name: e.target.value })}
                    placeholder="Övningsnamn"
                    className="flex-grow bg-transparent text-white focus:outline-none font-semibold"
                    autoFocus
                    onBlur={() => {if(exercise.name) setIsEditing(false)}}
                    onKeyDown={(e) => {if(e.key === 'Enter') setIsEditing(false)}}
                />
                <button onClick={() => {if(exercise.name) setIsEditing(false)}} className="text-sm font-semibold text-orange-400 hover:text-orange-300">
                    Klar
                </button>
                <button onClick={() => onRemove(exercise.id)} className="text-gray-500 hover:text-red-500 transition-colors font-semibold text-sm">
                    Ta bort
                </button>
            </div>
        );
    }
    
    // The color in the image is a dark red/brown. I'll use `bg-red-900`.
    const containerClasses = `p-3 rounded-lg transition-colors cursor-pointer ${isActive ? 'bg-red-900' : 'bg-orange-900/70 hover:bg-orange-800/80'}`;
    
    return (
        <div className={containerClasses} onClick={onSelect}>
            <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{exercise.name}</span>
            </div>
            {isActive && (
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-red-800 animate-fade-in">
                    <button onClick={handleEditClick} className="text-red-300 hover:text-white text-sm font-semibold">
                        Redigera
                    </button>
                    <button onClick={handleRemoveClick} className="text-red-300 hover:text-white text-sm font-semibold">
                        Ta bort
                    </button>
                </div>
            )}
        </div>
    );
};