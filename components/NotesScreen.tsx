
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Note, Workout, StudioConfig, TimerMode, TimerStatus, WorkoutBlock, Exercise, TimerSettings, TimerSoundProfile, SmartObject, SmartObjectType } from '../types';
import { interpretHandwriting, parseWorkoutFromImage, beautifyDrawing } from '../services/geminiService';
import { deleteImageByUrl, resolveAndCreateExercises, getOrganizationExerciseBank } from '../services/firebaseService';
import { useWorkoutTimer, getAudioContext } from '../hooks/useWorkoutTimer';
import { useStudio } from '../context/StudioContext';
import { PauseOverlay } from './timer/TimerModals';
import { ValueAdjuster, InformationCircleIcon, ChevronUpIcon, ChevronDownIcon, CloseIcon, PlusIcon, TrashIcon, PlayIcon } from './icons';
import { DraggableImage } from './ui/DraggableImage';
import { listenToCoachNotes } from '../services/firebaseService';

import { Modal } from './ui/Modal';
import { WorkoutCompleteModal } from './WorkoutCompleteModal';
import { motion, AnimatePresence } from 'framer-motion';
import rough from 'roughjs';
import { CoachNote } from '../types';

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
const ResizeHandle: React.FC<{ onResize: (dx: number, dy: number) => void, isArrow?: boolean }> = ({ onResize, isArrow }) => {
    return (
        <motion.div
            drag
            dragMomentum={false}
            onDrag={(e, info) => {
                e.stopPropagation();
                onResize(info.delta.x, info.delta.y);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`w-6 h-6 bg-white border-2 border-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-md ${isArrow ? 'cursor-move' : 'absolute -bottom-2 -right-2 cursor-se-resize'}`}
        />
    );
};

const ColorPicker: React.FC<{ currentColor: string, onColorSelect: (color: string) => void }> = ({ currentColor, onColorSelect }) => {
    return (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg p-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-auto">
            {['#FFFFFF', '#FACC15', '#3B82F6', '#4ADE80', '#EF4444'].map(c => (
                <button
                    key={c}
                    onClick={(e) => { e.stopPropagation(); onColorSelect(c); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`w-6 h-6 rounded-full border-2 ${currentColor === c ? 'border-gray-800' : 'border-gray-200'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
        </div>
    );
};

interface IdeaBoardInfoModalProps {
    onClose: () => void;
}

const RoughShape: React.FC<{ type: string, width: number, height: number, color: string, arrowStartX?: number, arrowStartY?: number, arrowEndX?: number, arrowEndY?: number }> = ({ type, width, height, color, arrowStartX, arrowStartY, arrowEndX, arrowEndY }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = svgRef.current;
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        const rs = rough.svg(svg);
        
        let node;
        if (type === 'rect') {
            node = rs.rectangle(2, 2, width - 4, height - 4, { stroke: color, strokeWidth: 4, roughness: 1.5 });
        } else if (type === 'circle') {
            node = rs.ellipse(width / 2, height / 2, width - 4, height - 4, { stroke: color, strokeWidth: 4, roughness: 1.5 });
        } else if (type === 'arrow') {
            const startX = arrowStartX ?? 2;
            const startY = arrowStartY ?? 2;
            const endX = arrowEndX ?? (width - 2);
            const endY = arrowEndY ?? (height - 2);
            node = rs.line(startX, startY, endX, endY, { stroke: color, strokeWidth: 4, roughness: 1.5 });
            svg.appendChild(node);
            
            const angle = Math.atan2(endY - startY, endX - startX);
            const headlen = 15;
            const head1 = rs.line(endX, endY, endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6), { stroke: color, strokeWidth: 4, roughness: 1.5 });
            const head2 = rs.line(endX, endY, endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6), { stroke: color, strokeWidth: 4, roughness: 1.5 });
            svg.appendChild(head1);
            svg.appendChild(head2);
            return;
        }
        
        if (node) {
            svg.appendChild(node);
        }
    }, [type, width, height, color, arrowStartX, arrowStartY, arrowEndX, arrowEndY]);

    return (
        <svg ref={svgRef} width={width} height={height} className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }} />
    );
};

const IdeaBoardInfoModal: React.FC<IdeaBoardInfoModalProps> = ({ onClose }) => (
    <Modal isOpen={true} onClose={onClose} title="Om AI Whiteboard" size="2xl">
        <div className="space-y-4 text-gray-900 dark:text-gray-100">
            <p>AI Whiteboard är din digitala whiteboard där du kan skapa, spara och utveckla idéer till pass, program och övningar.</p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">✏️ Rita och skriv fritt</h3>
            <p>Skissa upp passupplägg, anteckningar eller flöden direkt på ytan. Du kan rensa tavlan och ångra drag.</p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">🤖 Den smarta AI-coachen</h3>
            <p>Klicka på “Skapa Pass” – AI:n analyserar dina anteckningar och skapar ett komplett träningspass. Du kan välja att öppna det i passbyggaren eller låta AI:n "renrita" det som en snygg cirkelstation direkt på tavlan.</p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-2">📝 Anteckningar</h3>
            <p>Du kan hämta dina sparade Anteckningar direkt via menyn till höger. Kasta upp text eller bild på whiteboarden, rita vidare på skissen och låt AI:n skapa ett pass av resultatet.</p>
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
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
            <div className="relative w-full h-full flex-grow">
                {randomizedWords.map(({ text, className, style }) => (
                    <span key={text} className={`absolute -translate-x-1/2 -translate-y-1/2 animate-word-cloud-fade-in opacity-0 ${className}`} style={style as React.CSSProperties}>{text}</span>
                ))}
            </div>
            <button onClick={onSkip} className="pointer-events-auto flex-shrink-0 bg-black/30 text-white/80 hover:text-white backdrop-blur-sm py-2 px-5 rounded-full text-sm font-semibold transition-colors mt-4">Hoppa över</button>
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
    const [sequence, setSequence] = useState<any[]>([
        { type: 'work', duration: 30, title: 'Arbete' },
        { type: 'rest', duration: 15, title: 'Vila' }
    ]);

    const addSegment = () => {
        setSequence(prev => [...prev, { type: 'work', duration: 30, title: 'Arbete' }]);
    };

    const removeSegment = (index: number) => {
        setSequence(prev => prev.filter((_, i) => i !== index));
    };

    const updateSegment = (index: number, updates: any) => {
        setSequence(prev => {
            const next = [...prev];
            next[index] = { ...next[index], ...updates };
            return next;
        });
    };

    const moveSegment = (index: number, direction: 'up' | 'down') => {
        setSequence(prev => {
            const next = [...prev];
            if (direction === 'up' && index > 0) {
                [next[index], next[index - 1]] = [next[index - 1], next[index]];
            } else if (direction === 'down' && index < next.length - 1) {
                [next[index], next[index + 1]] = [next[index + 1], next[index]];
            }
            return next;
        });
    };

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
            case TimerMode.Custom:
                if (sequence.length === 0) {
                    setSequence([
                        { type: 'work', duration: 30, title: 'Arbete' },
                        { type: 'rest', duration: 15, title: 'Vila' }
                    ]);
                }
                setVarv(3);
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
            case TimerMode.Custom:
                settings.rounds = varv;
                settings.sequence = sequence;
                const seqTotal = sequence.reduce((acc, s) => acc + (s.duration || 0), 0);
                settings.workTime = seqTotal;
                settings.restTime = 0;
                title = 'Sekvens';
                exercises = [{ id: 'ex-custom', name: 'Sekvens', reps: '', description: '' }];
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
            case TimerMode.Custom:
                 return (
                     <div className={`w-full ${animationClass}`}>
                        <div className="flex justify-center mb-6">
                             <ValueAdjuster label="ANTAL VARV (LOOP)" value={varv} onchange={setVarv} />
                        </div>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar p-1">
                            {sequence.map((seg, i) => {
                                const minutes = Math.floor(seg.duration / 60);
                                const seconds = seg.duration % 60;
                                return (
                                    <div key={i} className={`flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all shadow-sm ${seg.type === 'work' ? 'bg-orange-900/10 border-orange-900/30' : 'bg-teal-900/10 border-teal-900/30'}`}>
                                        
                                        {/* Row 1: Controls & Step Info */}
                                        <div className="flex justify-between items-center w-full">
                                            <div className="flex gap-2">
                                                <button onClick={() => moveSegment(i, 'up')} disabled={i === 0} className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-20 hover:bg-white/10 rounded transition-colors"><ChevronUpIcon className="w-5 h-5" /></button>
                                                <button onClick={() => moveSegment(i, 'down')} disabled={i === sequence.length - 1} className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-20 hover:bg-white/10 rounded transition-colors"><ChevronDownIcon className="w-5 h-5" /></button>
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Steg {i + 1}</span>
                                            <button onClick={() => removeSegment(i)} className="text-red-400 hover:text-red-500 hover:bg-red-900/20 p-1.5 rounded-lg transition-colors" title="Ta bort steg">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                        
                                        {/* Row 2: Time Adjusters */}
                                        <div className="flex justify-center items-center gap-4 py-1">
                                            <ValueAdjuster 
                                                label="MIN" 
                                                value={minutes} 
                                                onchange={(val) => updateSegment(i, { duration: val * 60 + seconds })} 
                                            />
                                            <ValueAdjuster 
                                                label="SEK" 
                                                value={seconds} 
                                                onchange={(val) => updateSegment(i, { duration: minutes * 60 + val })}
                                                max={59}
                                                step={5}
                                                wrapAround={true}
                                            />
                                        </div>

                                        {/* Row 3: Type & Title */}
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => updateSegment(i, { type: seg.type === 'work' ? 'rest' : 'work' })}
                                                className={`flex-shrink-0 text-[10px] font-black uppercase px-3 py-2.5 rounded-xl w-24 text-center transition-all shadow-sm active:scale-95 ${seg.type === 'work' ? 'bg-orange-500 text-white' : 'bg-teal-500 text-white'}`}
                                            >
                                                {seg.type === 'work' ? 'Arbete' : 'Vila'}
                                            </button>
                                            <div className="flex-grow">
                                                <input 
                                                    type="text" 
                                                    value={seg.title || ''} 
                                                    onChange={e => updateSegment(i, { title: e.target.value })}
                                                    className="w-full bg-black border border-gray-700 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm placeholder-gray-400 text-white"
                                                    placeholder={seg.type === 'work' ? 'Titel (t.ex. Intervall)' : 'Titel (t.ex. Vila)'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <button 
                            onClick={addSegment} 
                            className="w-full mt-6 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-600 rounded-2xl text-gray-400 hover:text-primary hover:border-primary/50 hover:bg-gray-800 transition-all text-sm font-black uppercase tracking-widest"
                        >
                            <PlusIcon className="w-5 h-5" /> Lägg till steg
                        </button>
                     </div>
                 );
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
                        <button key={m} onClick={() => setMode(m)} className={`px-4 py-3 text-base font-semibold rounded-lg transition-colors ${ mode === m ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600' }`}>{m === TimerMode.Custom ? 'Sekvens' : m}</button>
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
    if (status === TimerStatus.Idle) return '#1e293b';
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
    const timeToDisplay = (block.settings.mode === TimerMode.Stopwatch && timer.status !== TimerStatus.Preparing) ? timer.totalTimeElapsed : timer.currentTime;
    const minutes = Math.floor(timeToDisplay / 60).toString().padStart(2, '0');
    const seconds = (timeToDisplay % 60).toString().padStart(2, '0');
    
    // Auto-hide pause button logic
    const [showControls, setShowControls] = useState(false);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleActivity = () => {
            setShowControls(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
        };

        window.addEventListener('pointerdown', handleActivity);
        window.addEventListener('keydown', handleActivity);

        return () => {
            window.removeEventListener('pointerdown', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (timer.status === TimerStatus.Finished) {
            onFinish();
        }
    }, [timer.status, onFinish]);

    const timerColor = getTimerHexColor(timer.status, block.settings.mode);
    const statusText = timer.status === TimerStatus.Idle ? 'Redo att starta' :
                       timer.status === TimerStatus.Preparing ? 'Gör dig redo' : 
                       (block.settings.mode === TimerMode.Custom && timer.currentSegment?.title) ? timer.currentSegment.title :
                       timer.status === TimerStatus.Resting ? 'Vila' : 'Arbete';

    const progressPercentage = timer.totalBlockDuration > 0 
        ? Math.min(100, Math.max(0, (timer.totalTimeElapsed / timer.totalBlockDuration) * 100))
        : 0;

    const currentIntervalInLap = (timer.completedWorkIntervals % timer.effectiveIntervalsPerLap) + 1;

    return (
        <>
            {createPortal(
                <AnimatePresence>
                    {timer.status === TimerStatus.Paused && (
                        <PauseOverlay 
                            onResume={timer.resume}
                            onRestart={() => { timer.reset(); setTimeout(() => timer.start(), 100); }}
                            onFinish={onClose}
                        />
                    )}
                </AnimatePresence>,
                document.body
            )}

            <div 
                className={`w-[95%] md:w-[90%] mx-auto mt-4 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center justify-center shadow-2xl transition-all duration-300 relative overflow-hidden ${isClosing ? 'opacity-0 -translate-y-10' : 'opacity-100 translate-y-0'}`}
                style={{ backgroundColor: timerColor, minHeight: '220px' }}
            >
                <div className="flex w-full items-center justify-center mb-2 relative">
                    <div className="px-5 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/20 shadow-sm">
                        <span className="font-black tracking-[0.2em] text-white uppercase text-base sm:text-lg">
                            {block.settings.mode.toUpperCase()}
                        </span>
                    </div>
                </div>
                
                {(block.settings.mode === TimerMode.Interval || block.settings.mode === TimerMode.Tabata || block.settings.mode === TimerMode.Custom) && (
                    <div className="absolute top-6 right-6 flex flex-col items-end gap-1 px-2 sm:px-4 pointer-events-none">
                        <div className="flex flex-col items-end">
                            <span className="block text-white/80 font-black text-[14px] sm:text-[16px] uppercase tracking-[0.4em] mb-1 drop-shadow-md">{block.settings.mode === TimerMode.Custom ? 'SEGMENT' : 'INTERVALL'}</span>
                            <div className="flex items-baseline justify-end gap-1">
                                <span className="font-black text-5xl sm:text-6xl text-white drop-shadow-lg leading-none">{currentIntervalInLap}</span>
                                <span className="text-2xl sm:text-3xl font-black text-white/80 drop-shadow-md">/ {timer.effectiveIntervalsPerLap}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-1 sm:mt-2">
                            <span className="text-white/80 font-black text-[13px] sm:text-[14px] uppercase tracking-[0.3em] drop-shadow-md">VARV</span>
                            <div className="flex items-baseline gap-1">
                                <span className="font-black text-3xl sm:text-4xl text-white drop-shadow-md leading-none">{Math.floor(timer.completedWorkIntervals / timer.effectiveIntervalsPerLap) + 1}</span>
                                <span className="text-base sm:text-lg font-black text-white/80 drop-shadow-md">/ {Math.ceil(timer.totalRounds / timer.effectiveIntervalsPerLap)}</span>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="flex flex-col items-center flex-grow justify-center mt-8 cursor-default select-none pointer-events-none">
                    <p className="text-white font-bold tracking-[0.3em] uppercase text-xl sm:text-2xl mb-1 drop-shadow-md opacity-90">
                        {statusText}
                    </p>
                    <div className="font-mono text-8xl sm:text-9xl md:text-[10rem] leading-none font-black text-white tabular-nums drop-shadow-2xl my-2">
                        {minutes}:{seconds}
                    </div>
                </div>

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
                
                {timer.status === TimerStatus.Idle && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-[2rem]">
                        <button 
                            onClick={(e) => { e.stopPropagation(); timer.start(); }}
                            className="bg-white text-black active:scale-110 transition-transform duration-200 rounded-full p-6 shadow-2xl border-4 border-white/50 group pointer-events-auto"
                        >
                            <PlayIcon className="w-16 h-16 ml-1 fill-current group-active:text-primary transition-colors" />
                        </button>
                    </div>
                )}
            </div>
            
            {createPortal(
                <AnimatePresence>
                    {timer.status !== TimerStatus.Paused && timer.status !== TimerStatus.Idle && showControls && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9998] pointer-events-none flex flex-col items-center justify-center p-8 text-center"
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); timer.pause(); }}
                                className="bg-white text-gray-900 font-black py-4 px-16 rounded-full shadow-2xl active:bg-gray-100 transition-transform active:scale-95 text-xl border-4 border-white/50 uppercase pointer-events-auto"
                            >
                                PAUSA
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

// --- Main Component ---

export const NotesScreen: React.FC<NotesScreenProps> = ({ onWorkoutInterpreted, studioConfig, initialWorkoutToDraw, onBack, remoteCommand }) => {
    const { selectedOrganization, selectedStudio } = useStudio();
    const [savedNotes, setSavedNotes] = useState<Note[]>([]);
    const [smartObjects, setSmartObjects] = useState<SmartObject[]>([]);
    
    const updateSmartObject = (id: string, updates: Partial<SmartObject>) => {
        setSmartObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
    };

    const removeSmartObject = (id: string) => {
        setSmartObjects(prev => prev.filter(obj => obj.id !== id));
    };

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isInterpretingWorkout, setIsInterpretingWorkout] = useState(false);
    const [isBeautifying, setIsBeautifying] = useState(false);
    const [isResolving, setIsResolving] = useState(false); // Ny state för att visa att vi matchar mot banken
    const [parseError, setParseError] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [history, setHistory] = useState<ImageData[]>([]);
    const [isArchiveVisible, setIsArchiveVisible] = useState(false);
    const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
    
    const [drawingColor, setDrawingColor] = useState<string>('#FFFFFF');
    const [isEraserActive, setIsEraserActive] = useState<boolean>(false);
    
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [animationState, setAnimationState] = useState<'intro' | 'exiting' | 'finished'>(initialWorkoutToDraw ? 'finished' : 'intro');
    
    const [interpretedWorkout, setInterpretedWorkout] = useState<Workout | null>(null);
    const [showBlockSelector, setShowBlockSelector] = useState(false);
    const [blockForCircuit, setBlockForCircuit] = useState<WorkoutBlock | null>(null);
    const [lastDrawnBlock, setLastDrawnBlock] = useState<WorkoutBlock | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

    // --- COACH NOTES ON IDEA BOARD ---
    const [coachNotes, setCoachNotes] = useState<CoachNote[]>([]);
    const [isCoachNotesModalOpen, setIsCoachNotesModalOpen] = useState(false);
    const [activeNotesTab, setActiveNotesTab] = useState<'coach' | 'idea'>('coach');
    const [activeCoachNote, setActiveCoachNote] = useState<CoachNote | null>(null);
    const [selectedCoachFilter, setSelectedCoachFilter] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedOrganization?.id) return;
        const unsubscribe = listenToCoachNotes(selectedOrganization.id, (notes) => {
            setCoachNotes(notes);
        });
        return () => unsubscribe();
    }, [selectedOrganization?.id]);

    const handleSelectCoachNote = (note: CoachNote) => {
        setIsCoachNotesModalOpen(false);
        if (note.imageUrl) {
            setActiveCoachNote(note);
        } else if (note.text) {
            // Put text on canvas as a smart object
            const newObj: SmartObject = {
                id: `smart-text-${Date.now()}`,
                type: 'text',
                x: 100,
                y: 100,
                width: 400,
                height: 200,
                text: note.title ? `${note.title}\n\n${note.text}` : note.text,
                color: '#FFFFFF',
                fontSize: 36
            };
            setSmartObjects(prev => [...prev, newObj]);
        }
    };

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
                setIsMenuOpen(false);
            }, 3000);
        }
    }, [isTimerActive]);

    const handlePointerDown = useCallback(() => {
        setIsMenuOpen(false);
        handleInteraction();
    }, [handleInteraction]);

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
                category: 'AI Whiteboard',
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
            if (animationState !== 'finished') setAnimationState('finished');
            e.preventDefault();
            isDrawing.current = true;
            points.current = [getPointerPos(e)];
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const dpr = window.devicePixelRatio || 1;
                ctx.globalCompositeOperation = 'source-over';
                if (isEraserActive) {
                    ctx.strokeStyle = '#030712'; // Match the canvas background color
                    ctx.lineWidth = 30 * dpr; // Make eraser thicker
                } else {
                    ctx.strokeStyle = drawingColor;
                    ctx.lineWidth = 4 * dpr; // Reset to normal size
                }
            }
        };

        const draw = (e: PointerEvent) => {
            if (!isDrawing.current) return;
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
            if (!isDrawing.current) return;
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
    }, [animationState, lastDrawnBlock, drawingColor, isEraserActive]); 

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
        setSmartObjects([]);
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

    const getCanvasDataUrlWithSmartObjects = (): string => {
        const canvas = canvasRef.current;
        if (!canvas) return '';
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas.toDataURL('image/png');

        // Save current canvas state
        const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const rc = rough.canvas(canvas);

        // Draw smart objects
        smartObjects.forEach(obj => {
            ctx.save();
            ctx.strokeStyle = obj.color;
            ctx.fillStyle = obj.color;
            ctx.lineWidth = 4;
            
            if (obj.type === 'rect') {
                rc.rectangle(obj.x, obj.y, obj.width, obj.height, { stroke: obj.color, strokeWidth: 4, roughness: 1.5 });
            } else if (obj.type === 'circle') {
                rc.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height, { stroke: obj.color, strokeWidth: 4, roughness: 1.5 });
            } else if (obj.type === 'arrow') {
                const startX = obj.x;
                const startY = obj.y;
                const endX = obj.endX ?? obj.x;
                const endY = obj.endY ?? obj.y;
                rc.line(startX, startY, endX, endY, { stroke: obj.color, strokeWidth: 4, roughness: 1.5 });
                
                // Draw arrow head
                const angle = Math.atan2(endY - startY, endX - startX);
                const headlen = 15;
                rc.line(endX, endY, endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6), { stroke: obj.color, strokeWidth: 4, roughness: 1.5 });
                rc.line(endX, endY, endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6), { stroke: obj.color, strokeWidth: 4, roughness: 1.5 });
            } else if (obj.type === 'text' && obj.text) {
                ctx.font = '36px Kalam, cursive';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const lines = obj.text.split('\n');
                const lineHeight = 40;
                const totalHeight = lines.length * lineHeight;
                const startY = obj.y + obj.height / 2 - totalHeight / 2 + lineHeight / 2;
                lines.forEach((line, index) => {
                    ctx.fillText(line, obj.x + obj.width / 2, startY + index * lineHeight);
                });
            }
            ctx.restore();
        });

        const dataUrl = canvas.toDataURL('image/png');

        // Restore original canvas state
        ctx.putImageData(originalImageData, 0, 0);

        return dataUrl;
    };

    const handleSaveNote = () => {
        if (!canvasRef.current || (history.length === 0 && smartObjects.length === 0)) return;
        setSaveState('saving');
        setIsSavingNote(true);
        try {
            const dataUrl = getCanvasDataUrlWithSmartObjects();
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
        if (!canvasRef.current || (history.length === 0 && smartObjects.length === 0 && !activeCoachNote?.imageUrl)) return;
        setIsInterpretingWorkout(true);
        try {
            let base64Image = '';
            if (activeCoachNote?.imageUrl) {
                if (activeCoachNote.imageUrl.startsWith('data:image')) {
                    base64Image = activeCoachNote.imageUrl.split(',')[1];
                } else {
                    const { fetchImageAsBase64 } = await import('../utils/imageFetch');
                    const dataUrl = await fetchImageAsBase64(activeCoachNote.imageUrl);
                    base64Image = dataUrl.split(',')[1];
                }
            } else {
                const dataUrl = getCanvasDataUrlWithSmartObjects();
                base64Image = dataUrl.split(',')[1];
            }
            
            let exerciseNames: string[] = [];
            if (selectedOrganization) {
                try {
                    const bank = await getOrganizationExerciseBank(selectedOrganization.id);
                    exerciseNames = bank.map(e => e.name);
                } catch (err) {
                    console.warn("Could not load exercise bank for AI context", err);
                }
            }
            
            const workout = await parseWorkoutFromImage(base64Image, undefined, true, exerciseNames);
            setInterpretedWorkout(workout);
        } catch(e) {
            const errMsg = e instanceof Error ? e.message : 'Ett okänt fel inträffade.';
            if (errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('denied access')) {
                setParseError("Det gick inte att generera passet just nu på grund av en åtkomstbegränsning till AI-motorn. Vänligen kontakta supporten om problemet kvarstår.");
            } else if (errMsg.includes('503') || errMsg.includes('overloaded')) {
                setParseError("AI-motorn är tillfälligt överbelastad. Vänligen vänta en minut och försök igen.");
            } else {
                setParseError("Kunde inte tyda whiteboarden. Vänligen försök igen med en tydligare bild. (Tekniskt fel: " + (errMsg.length > 50 ? errMsg.substring(0, 50) + "..." : errMsg) + ")");
            }
        } finally {
            setIsInterpretingWorkout(false);
        }
    };

    const handleBeautifyDrawing = async () => {
        if (!canvasRef.current || history.length === 0) return;
        setIsBeautifying(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const base64Image = dataUrl.split(',')[1];
            
            const objects = await beautifyDrawing(base64Image, canvasRef.current.width, canvasRef.current.height);
            
            if (objects && objects.length > 0) {
                // Skapa SmartObjects från AI-svaret
                const newSmartObjects: SmartObject[] = objects.map((obj, i) => ({
                    id: `smart-${Date.now()}-${i}`,
                    type: obj.type as SmartObjectType,
                    x: obj.x,
                    y: obj.y,
                    width: obj.width,
                    height: obj.height,
                    endX: obj.endX !== undefined ? obj.endX : (obj.type === 'arrow' ? obj.x + obj.width : undefined),
                    endY: obj.endY !== undefined ? obj.endY : (obj.type === 'arrow' ? obj.y + obj.height : undefined),
                    text: obj.text || '',
                    color: obj.color || '#FFFFFF'
                }));
                
                // Rensa handritade streck (behåll historik för ångra om man vill, men enklast är att rensa)
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#030712';
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                setHistory([]);
                
                // Lägg till de nya objekten
                setSmartObjects(prev => [...prev, ...newSmartObjects]);
            } else {
                alert('Kunde inte hitta några tydliga former eller text att snygga till.');
            }
        } catch(e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade vid tolkning.');
        } finally {
            setIsBeautifying(false);
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
            onPointerDown={handlePointerDown}
            onMouseMove={handleInteraction} 
            onTouchStart={handlePointerDown}
        >


            <button 
                onPointerDown={(e) => {
                    if (e.button === 0) {
                        e.preventDefault();
                        onBack();
                    }
                }}
                onClick={(e) => {
                    if (e.detail === 0) {
                        onBack();
                    }
                }}
                className={`absolute top-4 left-4 z-20 text-white font-bold p-3 rounded-lg hover:bg-gray-700/50 transition-all duration-500 flex items-center gap-2 drop-shadow-md ${!controlsVisible ? 'opacity-0 -translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}
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
                    <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-500 ${animationState === 'exiting' ? 'opacity-0' : 'opacity-100'}`}><IntroAnimation onSkip={skipAnimation} /></div>
                )}
                <canvas ref={canvasRef} className="w-full h-full block" />
                
                {/* Timer Zone Marker */}
                <div className="absolute top-[32%] left-0 right-0 pointer-events-none flex justify-between px-0 opacity-40 z-0">
                    <div className="flex items-center">
                        <div className="w-4 h-[2px] bg-gray-400 dark:bg-gray-500 rounded-r-full"></div>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-2 rotate-90 origin-left translate-y-6">Timer</span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mr-2 -rotate-90 origin-right translate-y-6">Timer</span>
                        <div className="w-4 h-[2px] bg-gray-400 dark:bg-gray-500 rounded-l-full"></div>
                    </div>
                </div>
                
                {/* Render Smart Objects */}
                {smartObjects.map(obj => {
                    const isArrow = obj.type === 'arrow';
                    const arrowX = isArrow ? Math.min(obj.x, obj.endX || obj.x) : obj.x;
                    const arrowY = isArrow ? Math.min(obj.y, obj.endY || obj.y) : obj.y;
                    const arrowWidth = isArrow ? Math.max(20, Math.abs((obj.endX || obj.x) - obj.x)) : obj.width;
                    const arrowHeight = isArrow ? Math.max(20, Math.abs((obj.endY || obj.y) - obj.y)) : obj.height;
                    
                    const arrowStartX = isArrow ? (obj.x < (obj.endX || obj.x) ? 2 : arrowWidth - 2) : undefined;
                    const arrowStartY = isArrow ? (obj.y < (obj.endY || obj.y) ? 2 : arrowHeight - 2) : undefined;
                    const arrowEndX = isArrow ? (obj.x < (obj.endX || obj.x) ? arrowWidth - 2 : 2) : undefined;
                    const arrowEndY = isArrow ? (obj.y < (obj.endY || obj.y) ? arrowHeight - 2 : 2) : undefined;

                    return (
                        <motion.div
                            key={obj.id}
                            drag
                            dragMomentum={false}
                            onDragEnd={(e, info) => updateSmartObject(obj.id, { 
                                x: obj.x + info.offset.x, 
                                y: obj.y + info.offset.y,
                                ...(isArrow ? { endX: (obj.endX || obj.x) + info.offset.x, endY: (obj.endY || obj.y) + info.offset.y } : {})
                            })}
                            initial={{ x: arrowX, y: arrowY }}
                            animate={{ x: arrowX, y: arrowY }}
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: arrowWidth,
                                height: arrowHeight,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 20,
                            }}
                            className="active:cursor-grabbing cursor-grab group"
                        >
                            <ColorPicker currentColor={obj.color} onColorSelect={(c) => updateSmartObject(obj.id, { color: c })} />
                            
                            {obj.type !== 'text' && (
                                <RoughShape type={obj.type} width={arrowWidth} height={arrowHeight} color={obj.color} arrowStartX={arrowStartX} arrowStartY={arrowStartY} arrowEndX={arrowEndX} arrowEndY={arrowEndY} />
                            )}
                            
                            {obj.type === 'text' ? (
                                <textarea
                                    value={obj.text || ''}
                                    onChange={(e) => updateSmartObject(obj.id, { text: e.target.value })}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    rows={Math.max(1, (obj.text || '').split('\n').length)}
                                    className="bg-transparent border-none outline-none text-center w-full resize-none overflow-hidden"
                                    style={{ color: obj.color, fontFamily: 'Kalam, cursive', fontSize: `${obj.fontSize || 36}px`, lineHeight: '1.2' }}
                                    placeholder="Skriv här..."
                                />
                            ) : obj.type !== 'arrow' ? (
                                <textarea
                                    value={obj.text || ''}
                                    onChange={(e) => updateSmartObject(obj.id, { text: e.target.value })}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    rows={Math.max(1, (obj.text || '').split('\n').length)}
                                    className="bg-transparent border-none outline-none text-center w-full relative z-10 resize-none overflow-hidden"
                                    style={{ color: obj.color, fontFamily: 'Kalam, cursive', fontSize: `${obj.fontSize || 28}px`, lineHeight: '1.2' }}
                                    placeholder=""
                                />
                            ) : null}
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeSmartObject(obj.id); }}
                                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-md"
                                title="Ta bort"
                            >
                                ✕
                            </button>

                            {isArrow ? (
                                <div style={{ position: 'absolute', left: arrowEndX, top: arrowEndY, transform: 'translate(-50%, -50%)', width: 24, height: 24 }}>
                                    <ResizeHandle onResize={(dx, dy) => {
                                        updateSmartObject(obj.id, {
                                            endX: (obj.endX || obj.x) + dx,
                                            endY: (obj.endY || obj.y) + dy
                                        });
                                    }} isArrow />
                                </div>
                            ) : (
                                <ResizeHandle onResize={(dx, dy) => {
                                    const newWidth = Math.max(50, obj.width + dx);
                                    const newHeight = Math.max(50, obj.height + dy);
                                    const heightRatio = newHeight / obj.height;
                                    const currentFontSize = obj.fontSize || (obj.type === 'text' ? 36 : 28);
                                    
                                    updateSmartObject(obj.id, { 
                                        width: newWidth, 
                                        height: newHeight,
                                        fontSize: currentFontSize * heightRatio
                                    });
                                }} />
                            )}
                        </motion.div>
                    );
                })}
            </div>
            
            {/* Right Side Control Panel */}
            <div 
                className={`absolute right-4 top-1/2 -translate-y-1/2 z-50 transition-all duration-500 pointer-events-auto ${!controlsVisible ? 'opacity-0 translate-x-10 pointer-events-none' : 'opacity-100 translate-x-0'}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseMove={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center gap-4 py-3">
                    {/* 1. Hamburger Menu */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)} 
                            className={`p-3 rounded-xl transition-colors ${isMenuOpen ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                            title="Meny"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                        
                        {isMenuOpen && (
                            <div className="absolute top-0 right-full mr-4 w-56 bg-gray-800/95 backdrop-blur-md shadow-2xl rounded-xl border border-gray-700 py-2 flex flex-col pointer-events-auto">
                                <button onClick={() => { setIsCoachNotesModalOpen(true); setIsMenuOpen(false); }} className="px-4 py-3 text-left text-white hover:bg-gray-700 font-semibold transition-colors rounded-t-xl">Anteckningar</button>
                                <button onClick={() => { handleSaveNote(); setIsMenuOpen(false); }} disabled={(history.length === 0 && smartObjects.length === 0) || saveState !== 'idle'} className="px-4 py-3 text-left text-white hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    {saveState === 'saving' ? 'Sparar...' : saveState === 'saved' ? 'Sparad!' : 'Spara & Arkivera'}
                                </button>
                                <button onClick={() => { handleBeautifyDrawing(); setIsMenuOpen(false); }} disabled={history.length === 0} className="px-4 py-3 text-left text-white hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isBeautifying ? 'Trollar...' : 'Snygga till'}
                                </button>
                                <button onClick={() => { handleInterpretAsWorkout(); setIsMenuOpen(false); }} disabled={(history.length === 0 && smartObjects.length === 0 && !activeCoachNote?.imageUrl)} className="px-4 py-3 text-left text-white hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                    {isInterpretingWorkout ? 'Tolkar...' : 'Skapa Pass'}
                                </button>
                                <button onClick={() => { handleToggleTimer(); setIsMenuOpen(false); }} className="px-4 py-3 text-left text-white hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    {timerBlock ? 'Stoppa Timer' : 'Timer'}
                                </button>
                                {lastDrawnBlock && (
                                    <button onClick={() => { setBlockForCircuit(lastDrawnBlock); setIsMenuOpen(false); }} className="px-4 py-3 text-left text-white hover:bg-gray-700 font-semibold transition-colors">Justera</button>
                                )}
                                <button onClick={() => { setIsInfoModalVisible(true); setIsMenuOpen(false); }} className="px-4 py-3 text-left text-white hover:bg-gray-700 font-semibold transition-colors border-t border-gray-700 mt-2 rounded-b-xl">Om AI Whiteboard</button>
                            </div>
                        )}
                    </div>

                    {/* 2. Undo & Clear & Eraser */}
                    <div className="flex flex-col gap-2">
                        <button onClick={handleUndo} disabled={history.length === 0} className="p-3 text-gray-300 hover:bg-gray-700 hover:text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Ångra">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                            </svg>
                        </button>
                        <button 
                            onClick={() => setIsEraserActive(!isEraserActive)} 
                            className={`p-3 rounded-xl transition-colors ${isEraserActive ? 'bg-primary/20 text-primary ring-2 ring-primary/50' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                            title="Suddgummi"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
  <path fillRule="evenodd" d="M2.515 10.674a1.875 1.875 0 0 0 0 2.652L8.89 19.7c.352.351.829.549 1.326.549H19.5a3 3 0 0 0 3-3V15a3 3 0 0 0-3-3h-1.66l-5.632-5.632a1.875 1.875 0 0 0-2.652 0l-6.041 6.041ZM17.84 15h1.66a1.5 1.5 0 0 1 1.5 1.5v2.25a1.5 1.5 0 0 1-1.5 1.5h-9.284l6.124-6.124ZM9.37 18.17l-5.63-5.631a.375.375 0 0 1 0-.53l5.63-5.631a.375.375 0 0 1 .531 0l5.631 5.631-6.162 6.162Z" clipRule="evenodd" />
</svg>
                        </button>
                        <button onClick={clearCanvas} className="p-3 text-gray-300 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors" title="Rensa">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                        </button>
                    </div>

                    {/* 3. Colors */}
                    <div className="flex flex-col gap-3 py-1 mt-2">
                        {effectiveColors.map(color => (
                            <button
                                key={color.hex}
                                onClick={() => {
                                    setDrawingColor(color.hex);
                                    setIsEraserActive(false);
                                }}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${drawingColor === color.hex ? 'border-white scale-125 shadow-md ring-2 ring-white/20' : 'border-transparent'}`}
                                style={{ backgroundColor: color.hex }}
                                title={color.label}
                                aria-label={`Välj färg ${color.label}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {isInterpretingWorkout && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center animate-fade-in"><BoilingCauldron className="w-48 h-48" /><p className="text-5xl text-white mt-4 font-logo">Kokar ihop ditt pass</p></div>
            )}
            
            {isBeautifying && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center animate-fade-in">
                    <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-5xl text-white mt-4 font-logo">Snyggar till...</p>
                </div>
            )}
            
            {/* RESOLVING OVERLAY (När vi matchar mot banken) */}
            {isResolving && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center animate-fade-in">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                    <p className="text-3xl font-bold text-white mb-2">Matchar övningar...</p>
                    <p className="text-gray-400">Kollar din övningsbank (skapar inget nytt).</p>
                </div>
            )}

            {/* ERROR MODAL */}
            {parseError && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4 text-center animate-fade-in">
                    <div className="bg-gray-800 p-8 rounded-2xl max-w-lg border border-gray-700 shadow-2xl relative">
                        <button onClick={() => setParseError(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                        <div className="text-orange-400 text-5xl mb-4">😅</div>
                        <h2 className="text-2xl font-bold text-white mb-4">Oj då, något gick snett!</h2>
                        <p className="text-gray-300 font-medium mb-6">{parseError}</p>
                        <button onClick={() => setParseError(null)} className="bg-primary px-6 py-3 rounded-xl font-bold text-white hover:bg-primary/90 w-full transition-colors">Okej, jag förstår</button>
                    </div>
                </div>
            )}

            {interpretedWorkout && !showBlockSelector && !blockForCircuit && <WorkoutActionChoiceModal workout={interpretedWorkout} onGoToBuilder={handleGoToBuilder} onDrawCircuit={() => { if (interpretedWorkout.blocks.length > 1) setShowBlockSelector(true); else setBlockForCircuit(interpretedWorkout.blocks[0]); }} onCancel={() => setInterpretedWorkout(null)} />}
            {interpretedWorkout && showBlockSelector && <BlockSelectionModal workout={interpretedWorkout} onSelect={(idx) => { setBlockForCircuit(interpretedWorkout.blocks[idx]); setShowBlockSelector(false); }} onCancel={() => setShowBlockSelector(false)} />}
            {blockForCircuit && <CircuitReorderModal block={blockForCircuit} onConfirm={drawCircuitOnCanvas} onCancel={() => setBlockForCircuit(null)} />}
            {isInfoModalVisible && <IdeaBoardInfoModal onClose={() => setIsInfoModalVisible(false)} />}
            {isTimerSetupVisible && <IdeaBoardTimerSetupModal onStart={handleStartTimerSetup} onClose={() => setIsTimerSetupVisible(false)} block={lastDrawnBlock || { exercises: [] } as any} />}
            {completionInfo && <WorkoutCompleteModal isOpen={!!completionInfo} onClose={() => { setCompletionInfo(null); handleCloseTimer(); }} workout={completionInfo.workout} isFinalBlock={completionInfo.isFinal} blockTag={completionInfo.blockTag} finishTime={completionInfo.finishTime} organizationId={selectedOrganization?.id || ''} />}

            {/* Draggable Active Image Note */}
            {activeCoachNote?.imageUrl && (
                <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
                    <DraggableImage 
                        src={activeCoachNote.imageUrl} 
                        alt={activeCoachNote.title} 
                        initialPosition={{ x: 100, y: 100 }}
                        onClose={() => setActiveCoachNote(null)}
                    />
                </div>
            )}

            {/* Combined Notes & Archive Modal */}
            <Modal isOpen={isCoachNotesModalOpen} onClose={() => setIsCoachNotesModalOpen(false)} title="Anteckningar" size="4xl">
                <div className="flex gap-4 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                    <button 
                        onClick={() => setActiveNotesTab('coach')}
                        className={`pb-2 px-4 font-bold text-sm sm:text-base transition-colors relative ${activeNotesTab === 'coach' ? 'text-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Anteckningar
                        {activeNotesTab === 'coach' && <div className="absolute bottom-[-9px] left-0 right-0 h-1 bg-primary rounded-t-full" />}
                    </button>
                    <button 
                        onClick={() => setActiveNotesTab('idea')}
                        className={`pb-2 px-4 font-bold text-sm sm:text-base transition-colors relative ${activeNotesTab === 'idea' ? 'text-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Arkiv ({savedNotes.length})
                        {activeNotesTab === 'idea' && <div className="absolute bottom-[-9px] left-0 right-0 h-1 bg-primary rounded-t-full" />}
                    </button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {activeNotesTab === 'coach' ? (
                        (() => {
                            const activeCoachNotes = coachNotes.filter(n => n.isFavorite || (Date.now() - n.createdAt) <= 14 * 24 * 60 * 60 * 1000);
                            
                            if (activeCoachNotes.length === 0) {
                                return <p className="text-gray-500 text-center py-12">Inga anteckningar hittades för denna studio.</p>;
                            }

                            const uniqueCoaches = Array.from(new Map(activeCoachNotes.map(n => [n.createdBy, { id: n.createdBy, name: n.creatorName, photo: n.creatorPhotoUrl }])).values());

                            if (!selectedCoachFilter) {
                                return (
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Välj vems anteckningar du vill se</h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
                                            {uniqueCoaches.map((coach: any) => {
                                                const coachNoteCount = activeCoachNotes.filter(n => n.createdBy === coach.id).length;
                                                return (
                                                    <button 
                                                        key={coach.id}
                                                        onClick={() => setSelectedCoachFilter(coach.id)}
                                                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center hover:border-primary transition-colors flex flex-col items-center gap-3 shadow-sm"
                                                    >
                                                        {coach.photo ? (
                                                            <img src={coach.photo} alt={coach.name} className="w-16 h-16 rounded-full object-cover" referrerPolicy="no-referrer" />
                                                        ) : (
                                                            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                                                                {coach.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1">{coach.name}</h4>
                                                            <p className="text-xs text-gray-500">{coachNoteCount} anteckning{coachNoteCount !== 1 ? 'ar' : ''}</p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }

                            const filteredNotes = activeCoachNotes.filter(n => n.createdBy === selectedCoachFilter);
                            const coachName = uniqueCoaches?.find((c: any) => c.id === selectedCoachFilter)?.name || 'Användaren';

                            return (
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <button 
                                            onClick={() => setSelectedCoachFilter(null)}
                                            className="p-1 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-bold transition-colors flex items-center gap-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                            Översikt
                                        </button>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white ml-2">{coachName}s anteckningar</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-2">
                                        {filteredNotes.map(note => (
                                            <button 
                                                key={note.id}
                                                onClick={() => {
                                                    handleSelectCoachNote(note);
                                                    setIsCoachNotesModalOpen(false);
                                                }}
                                                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-left hover:border-primary transition-colors flex flex-col group h-full shadow-sm"
                                            >
                                                <div className="flex items-center gap-3 mb-3 shrink-0">
                                                    {note.creatorPhotoUrl ? (
                                                        <img src={note.creatorPhotoUrl} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                                            {note.creatorName.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{note.creatorName}</p>
                                                        <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1">{note.title}</h4>
                                                    </div>
                                                </div>
                                                
                                                {note.imageUrl ? (
                                                    <div className="w-full h-32 bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden shrink-0">
                                                        <img src={note.imageUrl} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-full flex-grow bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-hidden">
                                                        <p className="text-xs text-gray-600 dark:text-gray-300 font-serif line-clamp-6">{note.text}</p>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()
                    ) : (
                        savedNotes.length === 0 ? (
                            <p className="text-gray-400 text-center py-12">Arkivet är tomt.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
                                {savedNotes.map(note => (
                                    <div key={note.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3">
                                        <div 
                                            className="w-full h-40 bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden shrink-0 relative group cursor-pointer"
                                            onClick={() => setFullscreenImage(note.imageUrl)}
                                            title="Klicka för att förstora"
                                        >
                                            <img src={note.imageUrl} alt="Handskriven anteckning" className="w-full h-full object-contain transition-transform group-hover:scale-[1.02]" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                                                <span className="text-white font-bold tracking-widest uppercase text-sm">Förstora bild</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col flex-grow">
                                            <p className="text-xs text-gray-500 mb-2">{new Date(note.timestamp).toLocaleString('sv-SE')}</p>
                                            {note.text && (
                                                <pre className="flex-grow whitespace-pre-wrap font-sans bg-gray-100 dark:bg-gray-900 p-3 rounded-lg text-gray-800 dark:text-gray-200 text-xs mb-3 custom-scrollbar overflow-y-auto max-h-24">
                                                    {note.text}
                                                </pre>
                                            )}
                                            <div className="flex gap-2 mt-auto flex-wrap">
                                                <button onClick={() => {
                                                    handleLoadNote(note);
                                                    setIsCoachNotesModalOpen(false);
                                                }} className="bg-primary/90 hover:bg-primary text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex-1">
                                                    Ladda till tavlan
                                                </button>
                                                {note.text ? (
                                                    <button onClick={() => {
                                                        if (note.text) navigator.clipboard.writeText(note.text);
                                                    }} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold py-2 px-3 rounded-lg transition-colors flex-1">
                                                        Kopiera text
                                                    </button>
                                                ) : null}
                                                <button onClick={() => handleDeleteNoteAction(note.id)} className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold py-2 px-3 rounded-lg transition-colors shrink-0">
                                                    Ta bort
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </Modal>

            {/* Fullscreen Image Preview */}
            {typeof window !== 'undefined' && createPortal(
                <AnimatePresence>
                    {fullscreenImage && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[999999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
                            onClick={() => setFullscreenImage(null)}
                        >
                            <button 
                                className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <img 
                                src={fullscreenImage} 
                                alt="Förstorad" 
                                className="max-w-full max-h-full object-contain"
                                onClick={(e) => e.stopPropagation()} 
                            />
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};
