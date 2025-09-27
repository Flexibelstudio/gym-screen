import React, { useState } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, StudioConfig } from '../types';
import { generateHyroxWod } from '../services/geminiService';

interface HyroxScreenProps {
    navigateTo: (page: Page) => void;
    onSelectWorkout: (workout: Workout) => void;
    onSaveWorkout: (workout: Workout) => Promise<Workout>;
    studioConfig: StudioConfig;
}

interface ParticipantEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (participants: string[]) => void;
}

const ParticipantEntryModal: React.FC<ParticipantEntryModalProps> = ({ isOpen, onClose, onStart }) => {
    const [names, setNames] = useState('');

    if (!isOpen) return null;

    const handleStartWithParticipants = () => {
        const participants = names.split('\n').map(n => n.trim()).filter(Boolean);
        onStart(participants);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-lg text-white shadow-2xl border border-gray-700 animate-fade-in" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">Registrera Deltagare (valfritt)</h2>
                <p className="text-gray-300 mb-6">
                    Ange ett namn per rad. Dessa visas under loppet för att enkelt registrera målgångstider för varje deltagare. Om du lämnar fältet tomt, används den vanliga tidtagningsfunktionen för en person.
                </p>
                <textarea
                    value={names}
                    onChange={(e) => setNames(e.target.value)}
                    placeholder="Ada Lovelace&#10;Grace Hopper&#10;Margaret Hamilton"
                    rows={6}
                    className="w-full bg-black text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
                />
                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                    <button onClick={() => onStart([])} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Starta tidtagning (1 pers)</button>
                    <button onClick={handleStartWithParticipants} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors">Starta Lopp</button>
                </div>
            </div>
        </div>
    );
};

// Generates a workout with a single block for a full "For Time" race simulation
const createHyroxFullRaceWorkout = (): Workout => {
    const now = Date.now();
    const stations = [
        { name: 'SkiErg', reps: '1000m' },
        { name: 'Sled Push', reps: '50m' },
        { name: 'Sled Pull', reps: '50m' },
        { name: 'Burpee Broad Jumps', reps: '80m' },
        { name: 'Row', reps: '1000m' },
        { name: 'Farmers Carry', reps: '200m' },
        { name: 'Sandbag Lunges', reps: '100m' },
        { name: 'Wall Balls', reps: '100' },
    ];
    
    const raceStages: Exercise[] = [];
    for (let i = 0; i < 8; i++) {
        raceStages.push({ id: `ex-run-${i}-${now}`, name: 'Löpning', reps: '1000m' });
        raceStages.push({ id: `ex-station-${i}-${now}`, name: stations[i].name, reps: stations[i].reps });
    }

    const singleBlock: WorkoutBlock = {
        id: `block-hyrox-race-${now}`,
        title: 'Hela Loppet (Stoppur)',
        tag: 'Kondition',
        setupDescription: 'Utför alla 8 löpningar och 8 stationer i ordning och i din egen takt. Klockan räknar uppåt tills du är klar.',
        followMe: false,
        settings: {
            mode: TimerMode.Stopwatch,
            workTime: 180 * 60, // 3-hour max time
            restTime: 0,
            rounds: 1,
            prepareTime: 10,
        },
        exercises: raceStages,
    };

    const workout: Workout = {
        id: `hyrox-full-race-${now}`,
        title: 'HYROX Hela Loppet (Stoppur)',
        coachTips: 'Detta är en simulering av ett fullt HYROX-lopp. Klockan räknar uppåt. Klicka på "Jag är klar!" för att registrera din tid. Fokusera på ett jämnt tempo och effektiva övergångar (roxzone). Lycka till!',
        blocks: [singleBlock],
        category: 'HYROX',
        isPublished: false,
    };

    return workout;
};

// Generates a workout with 16 separate blocks for practicing each station
const createHyroxPracticeWorkout = (): Workout => {
    const exercises: { name: string, reps: string }[] = [
        { name: 'SkiErg', reps: '1000m' },
        { name: 'Sled Push', reps: '50m' },
        { name: 'Sled Pull', reps: '50m' },
        { name: 'Burpee Broad Jumps', reps: '80m' },
        { name: 'Row', reps: '1000m' },
        { name: 'Farmers Carry', reps: '200m' },
        { name: 'Sandbag Lunges', reps: '100m' },
        { name: 'Wall Balls', reps: '100' },
    ];

    const blocks: WorkoutBlock[] = [];
    
    for (let i = 0; i < 8; i++) {
        const now = Date.now();
        // 1. Add the run block
        blocks.push({
            id: `block-run-${i}-${now}`,
            title: `Löpning ${i + 1}/8`,
            tag: 'Kondition',
            setupDescription: '1000 meter löpning.',
            followMe: false,
            settings: {
                mode: TimerMode.TimeCap,
                workTime: 10 * 60, // 10 minute time cap for the 1km run
                restTime: 0,
                rounds: 1,
                prepareTime: 5,
            },
            exercises: [{ id: `ex-run-${i}-${now}`, name: 'Löpning', reps: '1000m' }],
        });

        // 2. Add the exercise block
        const ex = exercises[i];
        blocks.push({
            id: `block-ex-${i}-${now}`,
            title: `Station ${i + 1}: ${ex.name}`,
            tag: 'Styrka',
            setupDescription: `Utför ${ex.reps} av ${ex.name}.`,
            followMe: false,
            settings: {
                mode: TimerMode.NoTimer,
                workTime: 0,
                restTime: 0,
                rounds: 1,
                prepareTime: 0,
            },
            exercises: [{ id: `ex-station-${i}-${now}`, name: ex.name, reps: ex.reps }],
        });
    }

    const workout: Workout = {
        id: `hyrox-practice-race-${Date.now()}`,
        title: 'HYROX Öva på Stationer',
        coachTips: 'Detta är en uppdelad version av ett HYROX-lopp för att kunna öva på varje del separat. Varje löpning och station är ett eget block.',
        blocks: blocks,
        category: 'HYROX',
        isPublished: false,
    };

    return workout;
};

export const HyroxScreen: React.FC<HyroxScreenProps> = ({ navigateTo, onSelectWorkout, onSaveWorkout, studioConfig }) => {
    const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSimulateFullRaceClick = () => {
        setIsParticipantModalOpen(true);
    };

    const startFullRace = (participants: string[]) => {
        const raceWorkout = createHyroxFullRaceWorkout();
        if (participants.length > 0) {
            raceWorkout.participants = participants;
        }
        onSelectWorkout(raceWorkout);
        setIsParticipantModalOpen(false);
    };
    
    const handlePracticeStations = () => {
        const practiceWorkout = createHyroxPracticeWorkout();
        onSelectWorkout(practiceWorkout);
    };

    const handleGenerateWod = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // FIX: Removed equipmentList from generateHyroxWod call as the function takes no arguments.
            const generatedWorkout = await generateHyroxWod();
            const hyroxWod: Workout = {
                ...generatedWorkout,
                id: `hyrox-wod-${Date.now()}`,
                category: 'HYROX',
                isPublished: false,
                createdAt: Date.now(),
                isFavorite: false,
            };

            const savedWorkout = await onSaveWorkout(hyroxWod);
            onSelectWorkout(savedWorkout);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ett okänt fel inträffade.';
            setError(`Kunde inte skapa ett HYROX-pass: ${errorMessage}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto text-center animate-fade-in">
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
                Välj om du vill simulera ett fullt lopp för att testa din uthållighet, öva på specifika stationer, eller generera ett anpassat träningspass.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                    onClick={handleSimulateFullRaceClick}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-6 rounded-xl transition-colors duration-200 flex flex-col items-center justify-center shadow-lg border border-gray-700 h-64"
                >
                    <h3 className="text-2xl font-extrabold text-primary">Simulera Hela Loppet</h3>
                    <p className="text-base font-normal text-gray-400 mt-2">Kör hela loppet "For Time" i ett enda svep.</p>
                </button>
                 <button
                    onClick={handlePracticeStations}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-6 rounded-xl transition-colors duration-200 flex flex-col items-center justify-center shadow-lg border border-gray-700 h-64"
                >
                    <h3 className="text-2xl font-extrabold text-primary">Öva på Stationer</h3>
                    <p className="text-base font-normal text-gray-400 mt-2">Träna på varje löpning och station som separata block.</p>
                </button>
                <button
                    onClick={handleGenerateWod}
                    disabled={isLoading}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-6 rounded-xl transition-colors duration-200 flex flex-col items-center justify-center shadow-lg border border-gray-700 h-64"
                >
                    <h3 className="text-2xl font-extrabold text-primary">Dagens HYROX WOD</h3>
                    <p className="text-base font-normal text-gray-400 mt-2">Ett AI-genererat träningspass.</p>
                </button>
            </div>
            {error && <p className="text-red-400 mt-6 text-center">{error}</p>}

            {isLoading && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 flex-col gap-4">
                    <div className="relative w-16 h-16 text-primary">
                        <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
                        <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
                        <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
                    </div>
                    <p className="text-xl text-white font-semibold">Bygger ditt HYROX-pass...</p>
                </div>
            )}
            {isParticipantModalOpen && (
                <ParticipantEntryModal
                    isOpen={isParticipantModalOpen}
                    onClose={() => setIsParticipantModalOpen(false)}
                    onStart={startFullRace}
                />
            )}
        </div>
    );
};
