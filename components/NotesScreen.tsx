
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Note, Workout, StudioConfig, TimerMode, TimerStatus, WorkoutBlock, Exercise, TimerSettings, TimerSoundProfile } from '../types';
import { interpretHandwriting, parseWorkoutFromImage } from '../services/geminiService';
import { deleteImageByUrl, resolveAndCreateExercises } from '../services/firebaseService';
import { useWorkoutTimer, getAudioContext } from '../hooks/useWorkoutTimer';
import { useStudio } from '../context/StudioContext';
import { ValueAdjuster, InformationCircleIcon, ChevronUpIcon, ChevronDownIcon, CloseIcon } from './icons';
import { Modal } from './ui/Modal';
import { WorkoutCompleteModal } from './WorkoutCompleteModal';
import { motion } from 'framer-motion';

interface NotesScreenProps {
    onWorkoutInterpreted: (w: Workout) => void;
    studioConfig: StudioConfig;
    initialWorkoutToDraw: Workout | null;
    onBack: () => void;
    remoteCommand?: { type: string, timestamp: number } | null;
}

const BoilingCauldron: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`relative ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M15,85 C15,55 85,55 85,85 Q50,110 15,85 Z" fill="#262626" />
            <path d="M10,60 C10,50 90,50 90,60" stroke="#404040" strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M25,85 L20,95" stroke="#262626" strokeWidth="6" strokeLinecap="round" />
            <path d="M75,85 L80,95" stroke="#262626" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-4/5 h-1/4 overflow-hidden">
            <div className="bubble" style={{'--i': 11, '--s': 2, left: '10%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 12, '--s': 2.5, left: '30%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 24, '--s': 1.5, left: '80%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 10, '--s': 3, left: '90%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 14, '--s': 2, left: '50%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 23, '--s': 1.5, left: '20%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 18, '--s': 2.5, left: '65%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 20, '--s': 3, left: '40%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 22, '--s': 1.5, left: '75%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 13, '--s': 2, left: '5%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 15, '--s': 2.5, left: '95%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 19, '--s': 1.5, left: '60%'} as React.CSSProperties}></div>
        </div>
        <style>{`
            .bubble {
                position: absolute;
                bottom: 0;
                width: calc(var(--s) * 4px);
                height: calc(var(--s) * 4px);
                background: #4ade80;
                border-radius: 50%;
                box-shadow: 0 0 2px #4ade80, 0 0 5px #4ade80, 0 0 8px #4ade80;
                animation: bubble-animate calc(15s / var(--i)) linear infinite;
            }
            @keyframes bubble-animate {
                0% { transform: translateY(0) scale(1); opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(-50px) scale(0); opacity: 0; }
            }
        `}</style>
    </div>
);

// New modal component for the archive
interface NoteArchiveModalProps {
    notes: Note[];
    onClose: () => void;
    onDelete: (noteId: string) => void;
    onUpdate: (note: Note) => void;
    onLoad: (note: Note) => void;
}

const NoteArchiveModal: React.FC<NoteArchiveModalProps> = ({ notes, onClose, onDelete, onUpdate, onLoad }) => {
    const [interpretingId, setInterpretingId] = useState<string | null>(null);

    const handleCopy = (text: string) => {
        if (text) {
            navigator.clipboard.writeText(text);
        }
    };

    const handleInterpret = async (note: Note) => {
        setInterpretingId(note.id);
        try {
            const base64Image = note.imageUrl.split(',')[1];
            const text = await interpretHandwriting(base64Image);
            onUpdate({ ...note, text });
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade.');
        } finally {
            setInterpretingId(null);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Arkiverade Anteckningar" size="4xl">
            <div className="space-y-4">
                {notes.length === 0 ? (
                    <p className="text-gray-400 text-center mt-10">Arkivet är tomt.</p>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <img src={note.imageUrl} alt="Handskriven anteckning" className="w-full h-auto object-contain rounded-md bg-gray-900" />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-xs text-gray-500 mb-2">{new Date(note.timestamp).toLocaleString('sv-SE')}</p>
                                <pre className="flex-grow whitespace-pre-wrap font-sans bg-gray-900 p-3 rounded-md text-gray-200">{note.text || 'Otolkad anteckning...'}</pre>
                                <div className="flex gap-2 mt-3 flex-shrink-0 flex-wrap">
                                    <button onClick={() => onLoad(note)} className="bg-blue-600 hover:bg-blue-50 text-sm font-semibold py-2 px-3 rounded-md">Fortsätt rita</button>
                                    {note.text ? (
                                        <button onClick={() => handleCopy(note.text)} className="bg-gray-600 hover:bg-gray-50 text-sm font-semibold py-2 px-3 rounded-md">Kopiera text</button>
                                    ) : (
                                        <button onClick={() => handleInterpret(note)} disabled={interpretingId === note.id} className="bg-purple-600 hover:bg-purple-50 text-sm font-semibold py-2 px-3 rounded-md flex items-center gap-1">
                                            {interpretingId === note.id ? 'Tolkar...' : 'Tolka text'}
                                        </button>
                                    )}
                                    <button onClick={() => onDelete(note.id)} className="bg-red-600 hover:bg-red-50 text-sm font-semibold py-2 px-3 rounded-md">Ta bort</button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
};

interface IdeaBoardInfoModalProps {
    onClose: () => void;
}

const IdeaBoardInfoModal: React.FC<IdeaBoardInfoModalProps> = ({ onClose }) => (
    <Modal isOpen={true} onClose={onClose} title="Om Idé-tavlan" size="2xl">
        <div className="space-y-4 text-gray-900 dark:text-gray-100">
            <p>Idé-tavlan är din digitala whiteboard där du kan skapa, spara och utveckla idéer till pass, program och övningar.</p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">✏️ Rita och skriv fritt</h3>
            <p>Skissa upp passupplägg, anteckningar eller flöden direkt på ytan. Du kan rensa tavlan och ångra drag.</p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">🤖 Den smarta AI-coachen</h3>
            <p>Klicka på “Skapa Pass” – AI:n analyserar dina anteckningar och skapar ett komplett träningspass. Du kan välja att öppna det i passbyggaren eller låta AI:n "renrita" det som en snygg cirkelstation direkt på tavlan.</p>
        </div>
    </Modal>
);

interface WorkoutActionChoiceModalProps {
    workout: Workout;
    onGoToBuilder: () => void;
    onDrawCircuit: () => void;
    onCancel: () => void;
}

const WorkoutActionChoiceModal: React.FC<WorkoutActionChoiceModalProps> = ({ workout, onGoToBuilder, onDrawCircuit, onCancel }) => (
    <Modal isOpen={true} onClose={onCancel} title="Välj åtgärd" size="md">
        <div className="space-y-6 text-center">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto text-4xl">💪</div>
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">"{workout.title}"</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Passet är laddat. Hur vill du fortsätta?</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
                <button onClick={onDrawCircuit} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all flex items-center justify-between group">
                    <div className="text-left">
                        <span className="block text-lg">Rita upp på tavlan</span>
                        <span className="text-sm text-white/80 font-normal">AI:n ritar en stationskarta</span>
                    </div>
                    <span className="text-2xl group-hover:scale-110 transition-transform">✏️</span>
                </button>
                <button onClick={onGoToBuilder} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-4 px-6 rounded-xl shadow-sm transition-all flex items-center justify-between group">
                    <div className="text-left">
                        <span className="block text-lg">Öppna i Passbyggaren</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-normal">Redigera och kör med timer</span>
                    </div>
                    <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </button>
            </div>
        </div>
    </Modal>
);

interface BlockSelectionModalProps {
    workout: Workout;
    onSelect: (blockIndex: number) => void;
    onCancel: () => void;
}

const BlockSelectionModal: React.FC<BlockSelectionModalProps> = ({ workout, onSelect, onCancel }) => (
    <Modal isOpen={true} onClose={onCancel} title="Välj block att rita" size="md">
        <div className="space-y-2">
            {workout.blocks.map((block, index) => (
                <button key={block.id || index} onClick={() => onSelect(index)} className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 p-4 rounded-lg text-left transition-colors flex justify-between items-center group">
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">{block.title || `Block ${index + 1}`}</h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{block.tag}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{block.exercises.length} övningar</div>
                </button>
            ))}
        </div>
    </Modal>
);

interface CircuitReorderModalProps {
    block: WorkoutBlock;
    onConfirm: (modifiedBlock: WorkoutBlock) => void;
    onCancel: () => void;
}

const CircuitReorderModal: React.FC<CircuitReorderModalProps> = ({ block, onConfirm, onCancel }) => {
    const [exercises, setExercises] = useState<Exercise[]>(block.exercises);

    const moveExercise = (index: number, direction: 'up' | 'down') => {
        setExercises(prev => {
            const newExercises = [...prev];
            if (direction === 'up' && index > 0) [newExercises[index], newExercises[index - 1]] = [newExercises[index - 1], newExercises[index]];
            else if (direction === 'down' && index < newExercises.length - 1) [newExercises[index], newExercises[index + 1]] = [newExercises[index + 1], newExercises[index]];
            return newExercises;
        });
    };

    const handleUpdateExercise = (index: number, field: 'name' | 'reps', value: string) => {
        setExercises(prev => {
            const newExercises = [...prev];
            newExercises[index] = { ...newExercises[index], [field]: value };
            return newExercises;
        });
    };

    const handleRemoveExercise = (index: number) => setExercises(prev => prev.filter((_, i) => i !== index));
    const handleAddExercise = () => setExercises(prev => [...prev, { id: `ex-circuit-${Date.now()}-${Math.random()}`, name: '', reps: '' }]);

    return (
        <Modal isOpen={true} onClose={onCancel} title="Redigera Cirkel" size="lg">
            <div className="flex flex-col h-full">
                <div className="flex-grow overflow-y-auto space-y-2 max-h-[50vh] pr-2">
                    {exercises.map((ex, index) => (
                        <div key={ex.id} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex items-center gap-4 border border-gray-200 dark:border-gray-700">
                            <span className="font-bold text-gray-400 w-6 text-center">{index + 1}</span>
                            <div className="flex flex-col gap-1">
                                <button onClick={() => moveExercise(index, 'up')} disabled={index === 0} className="text-gray-500 hover:text-primary disabled:opacity-20"><ChevronUpIcon className="w-5 h-5" /></button>
                                <button onClick={() => moveExercise(index, 'down')} disabled={index === exercises.length - 1} className="text-gray-500 hover:text-primary disabled:opacity-20"><ChevronDownIcon className="w-5 h-5" /></button>
                            </div>
                            <div className="flex-grow">
                                <input type="text" value={ex.name} onChange={(e) => handleUpdateExercise(index, 'name', e.target.value)} className="font-bold text-gray-900 dark:text-white bg-transparent w-full border-b border-transparent focus:border-primary focus:outline-none" placeholder="Övningsnamn" />
                                <input type="text" value={ex.reps || ''} onChange={(e) => handleUpdateExercise(index, 'reps', e.target.value)} className="text-sm text-gray-500 dark:text-gray-400 bg-transparent w-full border-b border-transparent focus:border-primary focus:outline-none" placeholder="Antal (valfritt)" />
                            </div>
                            <button onClick={() => handleRemoveExercise(index)} className="text-red-500 hover:text-red-700 p-2"><CloseIcon className="w-5 h-5" /></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddExercise} className="w-full py-2 mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"> + Lägg till station </button>
                <div className="mt-6 flex gap-4">
                    <button onClick={onCancel} className="flex-1 bg-gray-200 dark:bg-gray-700 font-bold py-3 rounded-lg">Avbryt</button>
                    <button onClick={() => onConfirm({ ...block, exercises: exercises.filter(ex => ex.name.trim() !== '') })} className="flex-1 bg-primary text-white font-bold py-3 rounded-lg">Rita upp cirkel</button>
                </div>
            </div>
        </Modal>
    );
};

const introWords = [
    { text: "Idéer", className: "text-6xl text-yellow-300 font-logo" },
    { text: "Kreativitet", className: "text-4xl text-blue-400" },
    { text: "Skissa", className: "text-5xl text-green-400" },
    { text: "Träningspass", className: "text-3xl text-white/90 font-bold" },
    { text: "Struktur", className: "text-4xl text-purple-400" },
    { text: "Glädje", className: "text-5xl text-pink-400 font-logo" },
    { text: "Inspiration", className: "text-2xl text-white/80" },
    { text: "Planera", className: "text-3xl text-indigo-400" },
    { text: "Anteckna", className: "text-4xl text-white/80" },
    { text: "Kettlebells", className: "text-4xl text-red-500" },
    { text: "EMOM", className: "text-4xl text-green-300 font-mono" },
    { text: "AMRAP", className: "text-3xl text-blue-300 font-mono" },
    { text: "Tabata", className: "text-5xl text-yellow-400 font-mono uppercase" },
    { text: "Time Cap", className: "text-3xl text-white/60 font-mono" },
    { text: "Flås", className: "text-6xl text-primary font-bold uppercase" },
];

const IntroAnimation = ({ onSkip }: { onSkip: () => void }) => {
    const randomizedWords = useMemo(() => introWords.sort(() => 0.5 - Math.random()).slice(0, 12).map(word => ({
        ...word,
        style: {
            top: `${10 + Math.random() * 80}%`,
            left: `${10 + Math.random() * 80}%`,
            transform: `rotate(${Math.random() * 40 - 20}deg)`,
            animationDelay: `${Math.random() * 1.5}s`,
        },
    })), []);

    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center bg-gray-950/50 backdrop-blur-sm">
            <div className="relative w-full h-full flex-grow">
                {randomizedWords.map(({ text, className, style }) => (
                    <span key={text} className={`absolute -translate-x-1/2 -translate-y-1/2 animate-word-cloud-fade-in opacity-0 ${className}`} style={style as React.CSSProperties}>{text}</span>
                ))}
            </div>
            <button onClick={onSkip} className="flex-shrink-0 bg-black/30 text-white/80 hover:text-white backdrop-blur-sm py-2 px-5 rounded-full text-sm font-semibold transition-colors mt-4">Hoppa över</button>
        </div>
    );
};

interface IdeaBoardTimerSetupModalProps {
    onStart: (block: WorkoutBlock) => void;
    onClose: () => void;
    block: WorkoutBlock;
}

const IdeaBoardTimerSetupModal: React.FC<IdeaBoardTimerSetupModalProps> = ({ onStart, onClose, block: initialBlock }) => {
    const [mode, setMode] = useState<TimerMode>(TimerMode.Interval);
    const [countMode, setCountMode] = useState<'laps' | 'rounds'>('laps');
    const [varv, setVarv] = useState(3);
    const [intervallerPerVarv, setIntervallerPerVarv] = useState(initialBlock.exercises.length || 8);
    const [totalOmgångar, setTotalOmgångar] = useState(10);
    const [totalMinutes, setTotalMinutes] = useState(10);
    const [workMinutes, setWorkMinutes] = useState(0);
    const [workSeconds, setWorkSeconds] = useState(30);
    const [restMinutes, setRestMinutes] = useState(0);
    const [restSeconds, setRestSeconds] = useState(15);
    const [direction, setDirection] = useState<'up' | 'down'>('down');

    useEffect(() => {
        switch(mode) {
            case TimerMode.Interval: setMode(TimerMode.Interval); break;
            case TimerMode.AMRAP: case TimerMode.TimeCap: case TimerMode.EMOM: setTotalMinutes(10); break;
            case TimerMode.Tabata:
                // Förinställda värden för Tabata vid byte till läget, men används ej i renderSettings
                setWorkSeconds(20);
                setRestSeconds(10);
                setTotalOmgångar(8);
                break;
            default: break;
        }
    }, [mode]);

    const handleStartTimer = () => {
        let settings: any = { mode, prepareTime: 10, direction };
        let title = mode;
        let exercises: Exercise[] = [{ id: 'ex-dummy', name: mode, reps: '', description: '' }];

        switch (mode) {
            case TimerMode.Interval:
                if (countMode === 'laps') {
                    settings.rounds = varv * intervallerPerVarv;
                    settings.specifiedLaps = varv;
                    settings.specifiedIntervalsPerLap = intervallerPerVarv;
                } else {
                    settings.rounds = totalOmgångar;
                }
                settings.workTime = workMinutes * 60 + workSeconds;
                settings.restTime = restMinutes * 60 + restSeconds;
                exercises = [{ id: 'ex-interval', name: 'Arbete', reps: '', description: '' }];
                break;
            case TimerMode.Tabata:
                settings.rounds = 8;
                settings.workTime = 20;
                settings.restTime = 10;
                // Standard Tabata är traditionellt nedräkning, men vi respekterar användarens val
                settings.direction = direction; 
                exercises = [{ id: 'ex-tabata', name: 'Arbete', reps: '', description: '' }];
                break;
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                settings = { ...settings, workTime: totalMinutes * 60, restTime: 0, rounds: 1 };
                title = `${mode} ${totalMinutes} min`;
                break;
            case TimerMode.EMOM:
                settings = { ...settings, workTime: 60, restTime: 0, rounds: totalMinutes };
                title = `EMOM ${totalMinutes} min`;
                exercises = [{ id: 'ex-emom', name: 'Intervall', reps: '', description: '' }];
                break;
            case TimerMode.Stopwatch:
                settings = { ...settings, workTime: 3600, restTime: 0, rounds: 1 };
                break;
        }

        onStart({ id: `timer-${Date.now()}`, title, tag: "Fristående", setupDescription: mode, settings, exercises, followMe: true });
    };

    const renderSettings = () => {
        const animationClass = 'animate-fade-in';
        switch (mode) {
            case TimerMode.Interval:
                return (
                    <div className={`flex flex-col items-center gap-y-6 w-full ${animationClass}`}>
                        <div className="flex bg-gray-700 p-1 rounded-lg">
                            <button onClick={() => setCountMode('laps')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${countMode === 'laps' ? 'bg-white text-black shadow-sm' : 'text-gray-300'}`}>Varv & Intervaller</button>
                            <button onClick={() => setCountMode('rounds')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${countMode === 'rounds' ? 'bg-white text-black shadow-sm' : 'text-gray-300'}`}>Omgångar</button>
                        </div>
                        
                        {countMode === 'laps' ? (
                            <div className="flex gap-6">
                                <ValueAdjuster label="VARV" value={varv} onchange={setVarv} />
                                <ValueAdjuster label="STATIONER" value={intervallerPerVarv} onchange={setIntervallerPerVarv} />
                            </div>
                        ) : (
                            <ValueAdjuster label="TOTALA OMGÅNGAR" value={totalOmgångar} onchange={setTotalOmgångar} />
                        )}

                        <div className="flex flex-col items-center w-full">
                            <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Arbetstid</span>
                            <div className="flex gap-4">
                                <ValueAdjuster label="MIN" value={workMinutes} onchange={setWorkMinutes} />
                                <ValueAdjuster label="SEK" value={workSeconds} onchange={setWorkSeconds} max={59} step={5} wrapAround />
                            </div>
                        </div>
                        <div className="flex flex-col items-center w-full">
                            <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Vilotid</span>
                            <div className="flex gap-4">
                                <ValueAdjuster label="MIN" value={restMinutes} onchange={setRestMinutes} />
                                <ValueAdjuster label="SEK" value={restSeconds} onchange={setRestSeconds} max={59} step={5} wrapAround />
                            </div>
                        </div>
                    </div>
                );
            case TimerMode.Tabata:
                return (
                    <div className={`text-center text-gray-300 p-4 rounded-lg ${animationClass}`}>
                        <h4 className="font-bold text-white text-lg">Standard Tabata</h4>
                        <p className="mt-2">8 ronder</p>
                        <p>20 sekunder arbete</p>
                        <p>10 sekunder vila</p>
                        <p className="text-sm text-gray-500 mt-4">(Dessa värden är fasta för Tabata)</p>
                    </div>
                );
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                 return <div className={animationClass}><ValueAdjuster label="TID (MINUTER)" value={totalMinutes} onchange={setTotalMinutes} /></div>;
            case TimerMode.EMOM:
                 return <div className={animationClass}><ValueAdjuster label="TOTAL TID (MINUTER)" value={totalMinutes} onchange={setTotalMinutes} /></div>;
            case TimerMode.Stopwatch:
                return (
                     <div className={`text-center text-gray-300 p-4 ${animationClass}`}>
                        <h4 className="font-bold text-white text-lg">Stoppur</h4>
                        <p className="mt-2">Räknar uppåt från 00:00.</p>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Ställ in Timer" size="xl">
            <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.values(TimerMode).filter(m => m !== TimerMode.NoTimer).map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`px-4 py-3 text-base font-semibold rounded-lg transition-colors ${ mode === m ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600' }`}>{m}</button>
                    ))}
                </div>
                
                <div className="bg-black/30 rounded-lg p-6 min-h-[200px] flex flex-col justify-center items-center">
                     {mode !== TimerMode.Stopwatch && (
                        <div className="flex justify-center mb-6 w-full">
                            <div className="flex bg-gray-700 p-1 rounded-lg">
                                <button 
                                    onClick={() => setDirection('down')} 
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${direction === 'down' ? 'bg-white text-primary shadow-sm' : 'text-gray-300'}`}
                                >
                                    <ChevronDownIcon className="w-4 h-4" /> Räkna Ned
                                </button>
                                <button 
                                    onClick={() => setDirection('up')} 
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${direction === 'up' ? 'bg-white text-primary shadow-sm' : 'text-gray-300'}`}
                                >
                                    <ChevronUpIcon className="w-4 h-4" /> Räkna Upp
                                </button>
                            </div>
                        </div>
                    )}
                    {renderSettings()}
                </div>
                <button onClick={handleStartTimer} className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:brightness-110 transition-colors uppercase tracking-widest">Starta Timer</button>
            </div>
        </Modal>
    );
};

const cleanExerciseName = (name: string) => name.split('(')[0].trim();

// NYTT: Funktion för att filtrera bort tidsangivelser från reps-strängen
const filterTimeFromReps = (reps: string): string => {
    if (!reps) return '';
    const lower = reps.toLowerCase();
    // Om strängen innehåller "sek" eller "min", filtrera bort den
    if (lower.includes('sek') || lower.includes('min') || lower.includes('minut')) {
        return '';
    }
    return reps;
};

const getTimerHexColor = (status: TimerStatus, mode: TimerMode | string) => {
    if (status === TimerStatus.Resting) return '#2dd4bf';
    if (status === TimerStatus.Preparing) return '#3b82f6';
    if (status === TimerStatus.Paused) return '#6b7280';
    switch (mode) {
        case TimerMode.Tabata: return '#ef4444';
        case TimerMode.AMRAP: return '#db2777';
        default: return '#f97316'; // Deep orange for other working modes
    }
};

const CompactTimer: React.FC<{ 
    timer: any, 
    block: WorkoutBlock, 
    onClose: () => void, 
    isClosing: boolean,
    onFinish: () => void 
}> = ({ timer, block, onClose, isClosing, onFinish }) => {
    const minutes = Math.floor(timer.currentTime / 60).toString().padStart(2, '0');
    const seconds = (timer.currentTime % 60).toString().padStart(2, '0');
    
    useEffect(() => {
        if (timer.status === TimerStatus.Finished) {
            onFinish();
        }
    }, [timer.status, onFinish]);

    const timerColor = getTimerHexColor(timer.status, block.settings.mode);
    const statusText = timer.status === TimerStatus.Resting ? 'Vila' : 
                      timer.status === TimerStatus.Preparing ? 'Gör dig redo' : 'Arbete';

    const progressPercentage = timer.totalBlockDuration > 0 
        ? Math.min(100, Math.max(0, (timer.totalTimeElapsed / timer.totalBlockDuration) * 100))
        : 0;

    const currentIntervalInLap = (timer.completedWorkIntervals % timer.effectiveIntervalsPerLap) + 1;

    return (
        <div 
            className={`w-[95%] md:w-[90%] mx-auto mt-4 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center justify-center shadow-2xl transition-all duration-300 relative ${isClosing ? 'opacity-0 -translate-y-10' : 'opacity-100 translate-y-0'}`}
            style={{ backgroundColor: timerColor, minHeight: '220px' }}
        >
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-white/50 hover:text-white pointer-events-auto transition-colors"
            >
                <CloseIcon className="w-8 h-8" />
            </button>
            
            <div className="flex w-full items-center justify-center mb-2 relative">
                <div className="px-4 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/20 shadow-sm">
                    <span className="font-black tracking-[0.2em] text-white uppercase text-xs sm:text-sm">
                        {block.settings.mode.toUpperCase()}
                    </span>
                </div>
            </div>
            
            <div className="flex flex-col items-center flex-grow justify-center">
                <p className="text-white font-bold tracking-[0.3em] uppercase text-sm sm:text-base mb-1 drop-shadow-md opacity-90">
                    {statusText}
                </p>
                <div className="font-mono text-7xl sm:text-8xl md:text-9xl leading-none font-black text-white tabular-nums drop-shadow-2xl my-2">
                    {minutes}:{seconds}
                </div>
            </div>

            {(block.settings.mode === TimerMode.Interval || block.settings.mode === TimerMode.Tabata) && (
                <div className="flex items-center gap-4 mt-2">
                    <div className="bg-black/20 backdrop-blur-md rounded-xl py-2 px-6 flex flex-col items-center justify-center border border-white/10 shadow-lg">
                        <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">VARV</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-white leading-none">{timer.currentRound}</span>
                            <span className="text-sm font-bold text-white/60">/ {timer.totalRounds}</span>
                        </div>
                    </div>
                    
                    <div className="bg-black/20 backdrop-blur-md rounded-xl px-5 py-2 flex items-center border border-white/10 h-full shadow-lg">
                        <div className="flex flex-col items-center">
                             <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">INTERVALL</span>
                             <span className="text-xl font-bold text-white leading-none mt-0.5">{currentIntervalInLap} / {timer.effectiveIntervalsPerLap}</span>
                        </div>
                    </div>
                </div>
            )}

            {timer.totalBlockDuration > 0 && (
                <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden backdrop-blur-md border border-white/20 shadow-inner mt-6">
                    <motion.div 
                        className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] relative"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 1, ease: "linear" }}
                    />
                </div>
            )}
            
            <button 
                onClick={timer.status === TimerStatus.Paused ? timer.resume : timer.pause}
                className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all active:scale-95 shadow-xl border border-white/20 pointer-events-auto backdrop-blur-sm"
            >
                {timer.status === TimerStatus.Paused ? (
                    <svg className="w-8 h-8 fill-current" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.333-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"/></svg>
                ) : (
                    <svg className="w-8 h-8 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                )}
            </button>
        </div>
    );
};

// --- Main Component ---

export const NotesScreen: React.FC<NotesScreenProps> = ({ onWorkoutInterpreted, studioConfig, initialWorkoutToDraw, onBack, remoteCommand }) => {
    const { selectedOrganization, selectedStudio } = useStudio();
    const [savedNotes, setSavedNotes] = useState<Note[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isInterpretingWorkout, setIsInterpretingWorkout] = useState(false);
    const [isResolving, setIsResolving] = useState(false); // Ny state för att visa att vi matchar mot banken
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [history, setHistory] = useState<ImageData[]>([]);
    const [isArchiveVisible, setIsArchiveVisible] = useState(false);
    const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
    
    const [drawingColor, setDrawingColor] = useState<string>('#FFFFFF');
    
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [animationState, setAnimationState] = useState<'intro' | 'exiting' | 'finished'>(initialWorkoutToDraw ? 'finished' : 'intro');
    
    const [interpretedWorkout, setInterpretedWorkout] = useState<Workout | null>(null);
    const [showBlockSelector, setShowBlockSelector] = useState(false);
    const [blockForCircuit, setBlockForCircuit] = useState<WorkoutBlock | null>(null);
    const [lastDrawnBlock, setLastDrawnBlock] = useState<WorkoutBlock | null>(null);

    const isDrawing = useRef(false);
    const points = useRef<{x: number, y: number}[]>([]);
    
    const [timerBlock, setTimerBlock] = useState<WorkoutBlock | null>(null);

    // --- REMOTE DRAWING LISTENER ---
    const lastProcessedStrokeRef = useRef<number>(0);

    useEffect(() => {
        if (!selectedStudio?.remoteState?.latestStroke) return;
        
        const stroke = selectedStudio.remoteState.latestStroke;
        if (stroke.timestamp <= lastProcessedStrokeRef.current) return;
        
        lastProcessedStrokeRef.current = stroke.timestamp;
        
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        if (stroke.isClear) {
            ctx.fillStyle = '#030712';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setHistory([]); 
            return;
        }
        
        if (stroke.points && stroke.points.length > 0) {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = 4 * (window.devicePixelRatio || 1);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            const p0 = stroke.points[0];
            ctx.moveTo(p0.x * canvas.width, p0.y * canvas.height);
            
            for (let i = 1; i < stroke.points.length; i++) {
                const p = stroke.points[i];
                ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
            }
            ctx.stroke();
            
            // Update history so undo/save works
            setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
        }
    }, [selectedStudio?.remoteState?.latestStroke]);
    
    // UPDATED: Pass sound profile to timer
    const timer = useWorkoutTimer(timerBlock, studioConfig.soundProfile || 'airhorn');
    
    const [isTimerSetupVisible, setIsTimerSetupVisible] = useState(false);
    const [isTimerClosing, setIsTimerClosing] = useState(false);
    const [completionInfo, setCompletionInfo] = useState<{ workout: Workout, isFinal: boolean, blockTag?: string, finishTime?: number } | null>(null);

    const isTimerActive = timer.status === TimerStatus.Running || timer.status === TimerStatus.Resting || timer.status === TimerStatus.Preparing;

    const [controlsVisible, setControlsVisible] = useState(true);
    const hideTimeoutRef = useRef<number | null>(null);

    const COLORS = [
        { hex: '#FFFFFF', label: 'Vit' },
        { hex: '#FACC15', label: 'Gul' },
        { hex: '#3B82F6', label: 'Blå' },
        { hex: '#4ADE80', label: 'Grön' },
        { hex: '#EF4444', label: 'Röd' }
    ];

    const effectiveColors = COLORS;

    const handleInteraction = useCallback(() => {
        setControlsVisible(true);
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        
        if (isTimerActive) {
            hideTimeoutRef.current = window.setTimeout(() => {
                setControlsVisible(false);
            }, 3000);
        }
    }, [isTimerActive]);

    useEffect(() => {
        if (isTimerActive) {
            handleInteraction();
        } else {
            setControlsVisible(true);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        }
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [isTimerActive, handleInteraction]);

    useEffect(() => {
        if (initialWorkoutToDraw) {
            setInterpretedWorkout(initialWorkoutToDraw);
        }
    }, [initialWorkoutToDraw]);

    useEffect(() => {
        try {
            const storedNotes = localStorage.getItem('flexibel-saved-notes');
            if (storedNotes) {
                setSavedNotes(JSON.parse(storedNotes));
            }
        } catch (e) { console.error("Failed to load notes", e); }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('flexibel-saved-notes', JSON.stringify(savedNotes));
        } catch (e) { console.error("Failed to save notes", e); }
    }, [savedNotes]);

    const handleSaveNoteAction = (note: Note) => setSavedNotes(prev => [note, ...prev]);
    const handleDeleteNoteAction = (noteId: string) => setSavedNotes(prev => prev.filter(note => note.id !== noteId));
    const handleUpdateNoteAction = (noteToUpdate: Note) => setSavedNotes(prev => prev.map(note => note.id === noteToUpdate.id ? noteToUpdate : note));

    const handleStartTimerSetup = useCallback((block: WorkoutBlock) => {
        setTimerBlock(block);
        setIsTimerSetupVisible(false);
    }, []);

    const handleCloseTimer = useCallback(() => {
        setIsTimerClosing(true);
        setTimeout(() => {
            timer.reset();
            setTimerBlock(null);
            setIsTimerClosing(false);
        }, 300);
    }, [timer]);

    const handleTimerFinish = useCallback(() => {
        if (timerBlock) {
            const dummyWorkout: Workout = {
                id: `notes-workout-${Date.now()}`,
                title: timerBlock.title,
                blocks: [timerBlock],
                coachTips: '',
                category: 'Idé-tavlan',
                isPublished: false,
                createdAt: Date.now(),
                organizationId: '',
            };
            setCompletionInfo({ 
                workout: dummyWorkout, 
                isFinal: true, 
                blockTag: timerBlock.tag,
                finishTime: timer.totalTimeElapsed 
            });
        }
    }, [timerBlock, timer.totalTimeElapsed]);

    const handleToggleTimer = useCallback(() => {
        if (timerBlock) {
            handleCloseTimer();
        } else {
            setIsTimerSetupVisible(true);
        }
    }, [timerBlock, handleCloseTimer]);

    useEffect(() => {
        if (timerBlock && timer.status === TimerStatus.Idle) {
            timer.start();
        }
    }, [timerBlock, timer.status, timer.start]);

    const skipAnimation = useCallback(() => setAnimationState('exiting'), []);

    useEffect(() => {
        if (animationState === 'intro') {
            const timer = setTimeout(skipAnimation, 5000);
            return () => clearTimeout(timer);
        }
        if (animationState === 'exiting') {
            const timer = setTimeout(() => setAnimationState('finished'), 500);
            return () => clearTimeout(timer);
        }
    }, [animationState, skipAnimation]);

    // --- CANVAS SETUP ---
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        
        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            const width = container.offsetWidth;
            const height = container.offsetHeight;

            if(width === 0 || height === 0) return;

            const newCanvasWidth = Math.round(width * dpr);
            const newCanvasHeight = Math.round(height * dpr);
            
            if (canvas.width !== newCanvasWidth || canvas.height !== newCanvasHeight) {
                canvas.width = newCanvasWidth;
                canvas.height = newCanvasHeight;
                
                if (lastDrawnBlock) {
                    setTimeout(() => {
                         const color = timerBlock ? getTimerHexColor(timer.status, timerBlock.settings.mode) : undefined;
                         drawCircuitOnCanvas(lastDrawnBlock, color);
                    }, 50);
                } else if (history.length > 0) {
                     ctx.fillStyle = '#030712';
                     ctx.fillRect(0, 0, canvas.width, canvas.height); 
                     ctx.putImageData(history[history.length - 1], 0, 0);
                } else {
                    ctx.fillStyle = '#030712';
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }
            
            ctx.fillStyle = '#030712';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 4 * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };
        
        setupCanvas();

        const resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(setupCanvas);
        });
        resizeObserver.observe(container);

        const getPointerPos = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
        };

        const startDrawing = (e: PointerEvent) => {
            if (animationState !== 'finished') return;
            e.preventDefault();
            isDrawing.current = true;
            points.current = [getPointerPos(e)];
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = drawingColor;
            }
        };

        const draw = (e: PointerEvent) => {
            if (!isDrawing.current || animationState !== 'finished') return;
            e.preventDefault();
            const pos = getPointerPos(e);
            points.current.push(pos);

            if (points.current.length < 3) return;

            const p1 = points.current[points.current.length - 3];
            const p2 = points.current[points.current.length - 2];
            const p3 = points.current[points.current.length - 1];

            const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
            
            ctx.beginPath();
            ctx.moveTo(mid1.x, mid1.y);
            ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
            ctx.stroke();
        };

        const stopDrawing = () => {
            if (!isDrawing.current || animationState !== 'finished') return;
            isDrawing.current = false;
            if (points.current.length < 1) { points.current = []; return; }

            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

            if (points.current.length === 1) {
                const p1 = points.current[0];
                ctx.fillStyle = ctx.strokeStyle;
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, ctx.lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (points.current.length === 2) {
                const p1 = points.current[0];
                const p2 = points.current[1];
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory(prev => [...prev, imageData]);
            points.current = [];
        };

        canvas.addEventListener('pointerdown', startDrawing);
        canvas.addEventListener('pointermove', draw);
        canvas.addEventListener('pointerup', stopDrawing);
        canvas.addEventListener('pointerleave', stopDrawing);

        return () => {
            resizeObserver.unobserve(container);
            canvas.removeEventListener('pointerdown', startDrawing);
            canvas.removeEventListener('pointermove', draw);
            canvas.removeEventListener('pointerup', stopDrawing);
            canvas.removeEventListener('pointerleave', stopDrawing);
        };
    }, [animationState, lastDrawnBlock, drawingColor]); 

    const clearCanvas = () => { 
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#030712';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
        setHistory([]);
        setActiveNoteId(null);
        setLastDrawnBlock(null);
    };
    
    const handleUndo = () => { 
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        ctx.fillStyle = '#030712';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (newHistory.length > 0) {
            ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
        }
    };

    const handleSaveNote = () => {
        if (!canvasRef.current || history.length === 0) return;
        setSaveState('saving');
        setIsSavingNote(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            if (activeNoteId) {
                const originalNote = savedNotes.find(n => n.id === activeNoteId);
                const updatedNote: Note = {
                    id: activeNoteId,
                    timestamp: Date.now(),
                    imageUrl: dataUrl,
                    text: originalNote?.text || '', 
                };
                handleUpdateNoteAction(updatedNote);
            } else {
                const newNote: Note = {
                    id: `note-${Date.now()}`,
                    timestamp: Date.now(),
                    text: '',
                    imageUrl: dataUrl,
                };
                handleSaveNoteAction(newNote);
            }
            clearCanvas();
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);
        } catch(e) {
            console.error("Failed to save note:", e);
            alert('Anteckningen kunde inte sparas.');
            setSaveState('idle');
        } finally {
            setIsSavingNote(false);
        }
    };

    const lastProcessedCommandRef = useRef<number>(0);

    useEffect(() => {
        if (remoteCommand && remoteCommand.timestamp > lastProcessedCommandRef.current) {
            lastProcessedCommandRef.current = remoteCommand.timestamp;
            if (remoteCommand.type === 'undo_note') {
                handleUndo();
            } else if (remoteCommand.type === 'save_note') {
                handleSaveNote();
            }
        }
    }, [remoteCommand]);
    
    const handleInterpretAsWorkout = async () => {
        if (!canvasRef.current || history.length === 0) return;
        setIsInterpretingWorkout(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const base64Image = dataUrl.split(',')[1];
            const workout = await parseWorkoutFromImage(base64Image);
            setInterpretedWorkout(workout);
        } catch(e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade.');
        } finally {
            setIsInterpretingWorkout(false);
        }
    };

    const handleGoToBuilder = async () => {
        if (interpretedWorkout && selectedOrganization) {
            setIsResolving(true);
            try {
                // VIKTIGT: createMissing = false för anteckningar/skisser.
                // Vi matchar mot banken, men skapar inte nya övningar om de inte finns.
                const resolved = await resolveAndCreateExercises(selectedOrganization.id, interpretedWorkout, false);
                onWorkoutInterpreted(resolved);
                clearCanvas();
                setInterpretedWorkout(null);
            } catch (e) {
                console.error("Resolve error:", e);
                // Fallback till otolkad om det kraschar (bör inte hända)
                onWorkoutInterpreted(interpretedWorkout);
                clearCanvas();
                setInterpretedWorkout(null);
            } finally {
                setIsResolving(false);
            }
        }
    };

    const drawCircuitOnCanvas = useCallback((block: WorkoutBlock, overrideColor?: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;

        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setLastDrawnBlock(block);

        const exercises = block.exercises || [];
        if (exercises.length === 0) {
            setInterpretedWorkout(null);
            setShowBlockSelector(false);
            setBlockForCircuit(null);
            return;
        }

        const isTimerActive = !!timerBlock;
        // VIKTIGT: Återställ marginalerna mot kanterna för att få största möjliga rityta inuti.
        const sidePadding = canvas.width * 0.12; 
        const timerSafeZone = isTimerActive ? canvas.height * 0.32 : canvas.height * 0.10; 
        const bottomPadding = canvas.height * 0.15; 

        const availableHeight = canvas.height - timerSafeZone - bottomPadding;
        const availableWidth = canvas.width - (sidePadding * 2);

        const w = availableWidth;
        const h = availableHeight;
        const x = sidePadding;
        const y = timerSafeZone;
        const radius = 60 * dpr; 

        const textColor = '#FFFFFF';
        const accentColor = overrideColor || '#14b8a6'; 

        // RITA BANAN
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 15 * dpr; 
        ctx.stroke();
        
        const count = exercises.length;
        const perimeter = 2 * (w + h);
        const step = perimeter / count;

        const getPointOnRect = (dist: number) => {
            let d = dist % perimeter;
            if (d < w) return { x: x + d, y: y, side: 'top' };
            d -= w;
            if (d < h) return { x: x + w, y: y + d, side: 'right' };
            d -= h;
            if (d < w) return { x: x + w - d, y: y + h, side: 'bottom' };
            d -= w;
            return { x: x, y: y + h - d, side: 'left' };
        };

        const splitTextIntoLines = (text: string): string[] => {
            // Tillåt lite längre rader nu när banan är bredare
            if (text.length <= 16) return [text];
            const words = text.split(' ');
            if (words.length === 1) return [text.substring(0, 16), text.substring(16)];
            const lines: string[] = [];
            let currentLine = words[0];
            for (let i = 1; i < words.length; i++) {
                if ((currentLine + " " + words[i]).length < 18) {
                    currentLine += " " + words[i];
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            lines.push(currentLine);
            return lines;
        };

        exercises.forEach((ex, index) => {
            const dist = index * step;
            const pos = getPointOnRect(dist);
            
            // Station-cirkel
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 38 * dpr, 0, 2 * Math.PI); 
            ctx.fillStyle = '#030712'; 
            ctx.fill();

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 32 * dpr, 0, 2 * Math.PI); 
            ctx.fillStyle = accentColor;
            ctx.fill();
            
            ctx.fillStyle = '#FFFFFF'; 
            ctx.font = `bold ${28 * dpr}px sans-serif`; 
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(index + 1), pos.x, pos.y);

            // TEXTPLACERING - RITA INÅT MOT MITTEN
            const textOffset = 75 * dpr;
            let textX = pos.x;
            let textY = pos.y;
            let align: CanvasTextAlign = 'center';
            let baseline: CanvasTextBaseline = 'middle';

            if (pos.side === 'top') {
                textY += textOffset;
                baseline = 'top';
            } else if (pos.side === 'right') {
                textX -= textOffset;
                align = 'right';
            } else if (pos.side === 'bottom') {
                textY -= textOffset;
                baseline = 'bottom';
            } else if (pos.side === 'left') {
                textX += textOffset;
                align = 'left';
            }

            const name = cleanExerciseName(ex.name);
            const lines = splitTextIntoLines(name);
            
            // FILTRERA BORT TID FRÅN REPS
            const repsRaw = filterTimeFromReps(ex.reps || '');
            const repsStr = repsRaw.toLowerCase().includes('ej angivet') || repsRaw.trim() === '' ? '' : `(${repsRaw})`;
            
            let fontSize = 34 * dpr; 
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = textColor;
            ctx.textAlign = align;
            ctx.textBaseline = baseline;
            
            const lineHeight = fontSize * 1.1;
            const totalTextHeight = lines.length * lineHeight;
            
            lines.forEach((line, i) => {
                let yPos = textY;
                if (pos.side === 'top') {
                    yPos = textY + (i * lineHeight);
                } else if (pos.side === 'bottom') {
                    yPos = textY - ((lines.length - 1 - i) * lineHeight);
                    if (repsStr) yPos -= lineHeight;
                } else {
                    yPos = textY - (totalTextHeight/2) + (i * lineHeight) + (lineHeight/2);
                }
                ctx.fillText(line, textX, yPos);
            });
            
            if (repsStr) {
                ctx.font = `bold ${fontSize * 0.8}px sans-serif`;
                ctx.fillStyle = accentColor;
                let repsY = textY;
                if (pos.side === 'top') {
                    repsY = textY + (lines.length * lineHeight);
                } else if (pos.side === 'bottom') {
                    repsY = textY;
                } else {
                    repsY = textY + (totalTextHeight/2) + (lineHeight/2);
                }
                ctx.fillText(repsStr, textX, repsY);
            }
        });

        setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
        setInterpretedWorkout(null);
        setShowBlockSelector(false);
        setBlockForCircuit(null);
    }, [timerBlock]);

    useEffect(() => {
        if (lastDrawnBlock) {
             const color = timerBlock ? getTimerHexColor(timer.status, timerBlock.settings.mode) : undefined;
             drawCircuitOnCanvas(lastDrawnBlock, color);
        }
    }, [timer.status, timerBlock, lastDrawnBlock, drawCircuitOnCanvas]);

    const handleLoadNote = (note: Note) => { 
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        setIsArchiveVisible(false); 
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.fillStyle = '#030712';
            ctx.fillRect(0, 0, canvas.width, canvas.height); 
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
            setActiveNoteId(note.id);
        };
        img.src = note.imageUrl;
    };

    return (
        <div 
            className="absolute inset-0 w-full h-full flex flex-col overflow-hidden bg-gray-800"
            onClick={handleInteraction} 
            onMouseMove={handleInteraction} 
            onTouchStart={handleInteraction}
        >
            <div className={`absolute top-4 right-4 z-20 flex items-center gap-2 transition-all duration-500 ${!controlsVisible ? 'opacity-0 -translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                <button onClick={() => setIsArchiveVisible(true)} className="bg-gray-600/80 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors backdrop-blur-sm shadow-md" disabled={animationState !== 'finished'}>Arkiv ({savedNotes.length})</button>
                <button onClick={() => setIsInfoModalVisible(true)} className="bg-gray-600/80 hover:bg-gray-500 text-white font-bold p-2 rounded-lg transition-colors backdrop-blur-sm shadow-md" title="Om Idé-tavlan" disabled={animationState !== 'finished'}><InformationCircleIcon className="w-6 h-6" /></button>
            </div>

            <button 
                onClick={onBack}
                className={`absolute top-4 left-4 z-20 bg-gray-600/80 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-all duration-500 backdrop-blur-sm shadow-md flex items-center gap-2 ${!controlsVisible ? 'opacity-0 -translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Tillbaka</span>
            </button>

            {timerBlock && (
                <div className="absolute top-0 left-0 right-0 z-30 transition-all duration-300 pointer-events-none flex justify-center">
                     <div className="w-full pointer-events-auto">
                        <CompactTimer 
                            timer={timer} 
                            block={timerBlock} 
                            onClose={handleCloseTimer}
                            isClosing={isTimerClosing}
                            onFinish={handleTimerFinish}
                        />
                     </div>
                </div>
            )}
            
            <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 bg-gray-800 transition-colors" style={{ touchAction: 'none' }}>
                {animationState !== 'finished' && (
                    <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${animationState === 'exiting' ? 'opacity-0' : 'opacity-100'}`} style={{ pointerEvents: animationState === 'exiting' ? 'none' : 'auto' }}><IntroAnimation onSkip={skipAnimation} /></div>
                )}
                <canvas ref={canvasRef} className="w-full h-full block" />
            </div>
            
            <div className={`absolute bottom-0 left-0 right-0 z-20 p-6 flex flex-col gap-4 items-center transition-all duration-500 ${!controlsVisible ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'} pointer-events-none`}>
                <div className="flex justify-center gap-3 pointer-events-auto bg-black/20 backdrop-blur-sm p-2 rounded-full">
                    {effectiveColors.map(color => (
                        <button
                            key={color.hex}
                            onClick={() => setDrawingColor(color.hex)}
                            className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 shadow-md ${drawingColor === color.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                            style={{ backgroundColor: color.hex }}
                            title={color.label}
                            aria-label={`Välj färg ${color.label}`}
                        />
                    ))}
                </div>

                <div className="flex flex-wrap justify-center gap-4 pointer-events-auto">
                    <button onClick={handleUndo} disabled={history.length === 0 || animationState !== 'finished'} className="bg-gray-600/90 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors backdrop-blur-sm shadow-lg">Ångra</button>
                    <button onClick={clearCanvas} disabled={animationState !== 'finished'} className="bg-gray-600/90 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg backdrop-blur-sm shadow-lg">Rensa</button>
                    <button onClick={handleSaveNote} disabled={history.length === 0 || saveState !== 'idle' || animationState !== 'finished'} className="bg-primary/90 hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 backdrop-blur-sm shadow-lg">{saveState === 'saving' ? 'Sparar...' : saveState === 'saved' ? '✔️ Sparad!' : '💾 Spara & Arkivera'}</button>
                    <button onClick={handleInterpretAsWorkout} disabled={history.length === 0 || animationState !== 'finished'} className="bg-purple-600/90 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 backdrop-blur-sm shadow-lg">{isInterpretingWorkout ? 'Tolkar...' : '✍️ Skapa Pass'}</button>
                    <button onClick={handleToggleTimer} disabled={animationState !== 'finished'} className="bg-blue-600/90 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 backdrop-blur-sm shadow-lg">{timerBlock ? 'Stoppa Timer' : 'Timer'}</button>
                    {lastDrawnBlock && animationState === 'finished' && (
                        <button onClick={() => setBlockForCircuit(lastDrawnBlock)} className="bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 backdrop-blur-sm shadow-lg">✏️ Justera</button>
                    )}
                </div>
            </div>

            {isInterpretingWorkout && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center animate-fade-in"><BoilingCauldron className="w-48 h-48" /><p className="text-5xl text-white mt-4 font-logo">Kokar ihop ditt pass</p></div>
            )}
            
            {/* RESOLVING OVERLAY (När vi matchar mot banken) */}
            {isResolving && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center animate-fade-in">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                    <p className="text-3xl font-bold text-white mb-2">Matchar övningar...</p>
                    <p className="text-gray-400">Kollar din övningsbank (skapar inget nytt).</p>
                </div>
            )}

            {interpretedWorkout && !showBlockSelector && !blockForCircuit && <WorkoutActionChoiceModal workout={interpretedWorkout} onGoToBuilder={handleGoToBuilder} onDrawCircuit={() => { if (interpretedWorkout.blocks.length > 1) setShowBlockSelector(true); else setBlockForCircuit(interpretedWorkout.blocks[0]); }} onCancel={() => setInterpretedWorkout(null)} />}
            {interpretedWorkout && showBlockSelector && <BlockSelectionModal workout={interpretedWorkout} onSelect={(idx) => { setBlockForCircuit(interpretedWorkout.blocks[idx]); setShowBlockSelector(false); }} onCancel={() => setShowBlockSelector(false)} />}
            {blockForCircuit && <CircuitReorderModal block={blockForCircuit} onConfirm={drawCircuitOnCanvas} onCancel={() => setBlockForCircuit(null)} />}
            {isArchiveVisible && <NoteArchiveModal notes={savedNotes} onClose={() => setIsArchiveVisible(false)} onDelete={handleDeleteNoteAction} onUpdate={handleUpdateNoteAction} onLoad={handleLoadNote} />}
            {isInfoModalVisible && <IdeaBoardInfoModal onClose={() => setIsInfoModalVisible(false)} />}
            {isTimerSetupVisible && <IdeaBoardTimerSetupModal onStart={handleStartTimerSetup} onClose={() => setIsTimerSetupVisible(false)} block={lastDrawnBlock || { exercises: [] } as any} />}
            {completionInfo && <WorkoutCompleteModal isOpen={!!completionInfo} onClose={() => setCompletionInfo(null)} workout={completionInfo.workout} isFinalBlock={completionInfo.isFinal} blockTag={completionInfo.blockTag} finishTime={completionInfo.finishTime} organizationId={selectedOrganization?.id || ''} />}
        </div>
    );
};
