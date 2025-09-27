

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Workout, WorkoutBlock, Exercise, TimerSettings, TimerMode } from '../types';
import { generateWorkout } from '../services/geminiService';
import { TimerSetupModal } from './TimerSetupModal';

const WARMUP_PROMPT = `
Du är en expertcoach på Flexibel Hälsostudio. Ditt uppdrag är att skapa en dynamisk och varierad helkroppsuppvärmning. Passen ska vara mellan 3 och 5 minuter långa totalt, och utan vila mellan övningarna.

**Exempel på övningar att använda (välj fritt och variera):**
- Armcirklar (framåt & bakåt)
- Benpendlingar (framåt/bakåt & sida till sida)
- Höga knän / Skipping
- Hälar till rumpan
- Djupa knäböj (utan vikt)
- Utfall med bålrotation
- Walkouts (gå ut till planka och tillbaka)
- Katt & Ko (från stående eller på alla fyra)
- Höftöppnare (Gate openers)
- Jumping Jacks (krysshopp)
- Inchworm
- World's Greatest Stretch
- Sidosteg med armar över huvudet

**JSON Output Regler:**
*   **Struktur:** Alltid ett JSON-objekt med en \`blocks\`-lista som innehåller EXAKT ETT block. Ge också en övergripande \`title\` på rot-objektet (t.ex. 'Dynamisk uppvärmning').
*   **Block:** Ge blocket en \`title\` (t.ex. "Rörlighet & Puls"), en \`setupDescription\` som förklarar upplägget, sätt \`tag\` till "Uppvärmning" och \`followMe\` till \`true\`.
*   **Övningar:** Fyll \`exercises\`-arrayen. Antalet övningar måste stämma med det upplägg du valt.

**Timerinställningar & Variation (MYCKET VIKTIGT):**
*   **Mode:** Använd ALLTID \`"Intervall"\` som \`settings.mode\`.
*   **Vila:** Sätt ALLTID \`restTime\` till 0.
*   **'rounds'-fältet:** För \`"Intervall"\`-läget representerar fältet \`rounds\` det **TOTALA ANTALET ARBETSINTERVALLER**. Det är INTE antalet varv (laps). Du måste räkna ut detta.
*   **VARIATION:** Skapa variation genom att välja OLIKA upplägg varje gång. Här är några exempel på strukturer som du kan använda och anpassa för att landa på 3-5 minuter. **Välj ett nytt upplägg varje gång du genererar ett pass!**
    *   **Struktur 1 (Klassisk cirkel):** 10 övningar, 30s arbete/övning, 1 varv. Sätt \`rounds\` till 10 (10 övningar * 1 varv).
    *   **Struktur 2 (Kort & intensiv):** 6 övningar, 30s arbete/övning, 1 varv. Sätt \`rounds\` till 6 (6 övningar * 1 varv).
    *   **Struktur 3 (Två varv):** 5 övningar, 30s arbete/övning, 2 varv. Sätt \`rounds\` till 10 (5 övningar * 2 varv).
    *   **Struktur 4 (Längre intervaller):** 5 övningar, 45s arbete/övning, 1 varv. Sätt \`rounds\` till 5 (5 övningar * 1 varv).
    *   **Struktur 5 (Stege):** 4 övningar, 20s arbete/övning, 3 varv. Sätt \`rounds\` till 12 (4 övningar * 3 varv).
*   **Konsistens:** Se till att värdet i \`settings.rounds\` exakt matchar det totala antalet intervaller du vill köra, och att antalet övningar i \`exercises\`-listan är korrekt för strukturen.
`;

const createNewExercise = (): Exercise => ({
  id: `ex-${Date.now()}`,
  name: '',
  reps: '',
  description: '',
  imageUrl: '',
});

interface WarmupScreenProps {
  onStartWorkout: (workout: Workout, block: WorkoutBlock) => void;
}

export const WarmupScreen: React.FC<WarmupScreenProps> = ({ onStartWorkout }) => {
  const [warmup, setWarmup] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  
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
      handleUpdateBlock({
        ...warmupBlock,
        exercises: [...warmupBlock.exercises, newExercise],
      });
    }
  };

  const handleUpdateExercise = (exId: string, updatedValues: Partial<Exercise>) => {
    if(warmupBlock) {
        const updatedExercises = warmupBlock.exercises.map(ex => (ex.id === exId ? { ...ex, ...updatedValues } : ex));
        handleUpdateBlock({ ...warmupBlock, exercises: updatedExercises });
    }
  };

  const handleRemoveExercise = (exId: string) => {
    if (warmupBlock) {
      const updatedExercises = warmupBlock.exercises.filter(ex => ex.id !== exId);
      handleUpdateBlock({
        ...warmupBlock,
        exercises: updatedExercises,
      });
    }
  };
  
  const calculateTotalTime = (block: WorkoutBlock | null) => {
    if (!block) return 0;
    const { settings } = block;

    switch (settings.mode) {
        case TimerMode.Interval:
        case TimerMode.Tabata:
            const totalWorkIntervals = settings.rounds;
            if (totalWorkIntervals === 0) return 0;
            const totalWork = totalWorkIntervals * settings.workTime;
            const totalRestIntervals = totalWorkIntervals > 1 ? totalWorkIntervals - 1 : 0;
            const totalRestTime = Math.max(0, totalRestIntervals * settings.restTime);
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
    if (exercises.length === 0) return "Inga övningar";

    const time = formatTime(calculateTotalTime(warmupBlock));
    const laps = exercises.length > 0 ? Math.ceil(settings.rounds / exercises.length) : settings.rounds;
    const desc = `${laps} varv, ${exercises.length} övningar`;
    return `${time} • ${desc}`;
  }, [warmupBlock]);

    const handleEditSettings = () => {
        setEditingBlockId(warmupBlock?.id || null);
    };

    if (isLoading) {
        return (
            <div className="w-full max-w-2xl mx-auto text-center flex flex-col items-center justify-center gap-4 animate-fade-in">
                <div className="relative w-16 h-16 text-primary">
                    <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
                    <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
                    <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
                </div>
                <p className="text-xl text-gray-800 dark:text-white font-semibold">Genererar en dynamisk uppvärmning...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-2xl mx-auto text-center animate-fade-in">
                <h2 className="text-2xl font-bold text-red-500">Ett fel inträffade</h2>
                <p className="text-gray-400 mt-2 mb-6">{error}</p>
                <button onClick={generateNewWarmup} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                    Försök igen
                </button>
            </div>
        );
    }

    if (!warmupBlock || !warmup) {
        return (
            <div className="w-full max-w-2xl mx-auto text-center animate-fade-in">
                <h2 className="text-2xl font-bold text-red-500">Kunde inte skapa uppvärmning</h2>
                <p className="text-gray-400 mt-2 mb-6">Något gick fel och inget pass kunde skapas.</p>
                <button onClick={generateNewWarmup} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                    Försök igen
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto animate-fade-in space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 shadow-md border border-gray-700">
                 <div className="flex justify-between items-start mb-2">
                    <h2 className="text-3xl font-bold text-primary">{warmupBlock.title}</h2>
                    <button onClick={handleEditSettings} className="text-primary hover:underline font-semibold text-sm">Anpassa tider</button>
                </div>
                <p className="text-gray-400 mb-4">{settingsText}</p>
                <p className="text-gray-300">{warmupBlock.setupDescription}</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 shadow-md border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">Övningar</h3>
                <div className="space-y-2">
                    {warmupBlock.exercises.map(ex => (
                       <div key={ex.id} className="flex items-center gap-2 bg-gray-900/50 p-2 rounded-md ring-1 ring-gray-700">
                           <input
                               type="text"
                               value={ex.name}
                               onChange={e => handleUpdateExercise(ex.id, { name: e.target.value })}
                               placeholder="Övningsnamn"
                               className="flex-grow bg-transparent text-gray-200 focus:outline-none placeholder-gray-500"
                           />
                           <button onClick={() => handleRemoveExercise(ex.id)} className="text-gray-500 hover:text-red-500 transition-colors font-semibold text-sm flex-shrink-0">
                               Ta bort
                           </button>
                       </div>
                    ))}
                    <button onClick={handleAddExercise} className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-2 border-2 border-dashed border-gray-600 rounded-lg text-sm text-gray-400 hover:bg-gray-700 transition">
                       <span>Lägg till Övning</span>
                   </button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={() => onStartWorkout(warmup, warmupBlock)}
                    className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-4 px-6 rounded-lg transition-colors text-xl shadow-lg"
                >
                    Starta Uppvärmning
                </button>
                <button
                    onClick={generateNewWarmup}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-4 px-6 rounded-lg transition-colors text-xl"
                >
                    Generera Ny
                </button>
            </div>
            {editingBlockId && (
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