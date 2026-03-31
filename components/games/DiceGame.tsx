import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStudio } from '../../context/StudioContext';
import { BankExercise } from '../../types';
import { ChevronLeftIcon, DicesIcon, SettingsIcon } from '../icons';
import confetti from 'canvas-confetti';

interface DiceGameProps {
    onBack: () => void;
}

type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'custom';

const PRESET_EXERCISES = {
    easy: ['Knäböj', 'Armhävningar mot vägg', 'Situps', 'Höga knän', 'Plankan', 'Utfall'],
    medium: ['Knäböj med hopp', 'Armhävningar', 'Fällkniven', 'Burpees', 'Mountain climbers', 'Utfallshopp'],
    hard: ['Pistol squats', 'Handstand pushups', 'V-ups', 'Navy seal burpees', 'Spiderman pushups', 'Jumping lunges']
};

export const DiceGame: React.FC<DiceGameProps> = ({ onBack }) => {
    const { studioConfig } = useStudio();
    const [gameState, setGameState] = useState<'setup' | 'playing'>('setup');
    const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
    const [customExercises, setCustomExercises] = useState<string[]>(Array(6).fill(''));
    
    const [isRolling, setIsRolling] = useState(false);
    const [diceValues, setDiceValues] = useState<[number, number, number]>([1, 1, 1]); // [num1, num2, exercise]
    const [showResult, setShowResult] = useState(false);

    // 3D Rotation states
    const [rotations, setRotations] = useState([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
    ]);

    const activeExercises = difficulty === 'custom' 
        ? customExercises 
        : PRESET_EXERCISES[difficulty];

    const handleStart = () => {
        if (difficulty === 'custom' && customExercises.some(ex => !ex.trim())) {
            alert('Vänligen fyll i alla 6 övningar.');
            return;
        }
        setGameState('playing');
        setShowResult(false);
    };

    const rollDice = () => {
        if (isRolling) return;
        setIsRolling(true);
        setShowResult(false);

        // Calculate new values
        const newValues: [number, number, number] = [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1
        ];

        // Calculate rotations to show the correct face
        // Face 1: 0, 0
        // Face 2: 0, -90
        // Face 3: 0, -180
        // Face 4: 0, 90
        // Face 5: -90, 0
        // Face 6: 90, 0
        const getTargetRotation = (value: number, currentRot: {x: number, y: number}) => {
            let baseX = 0;
            let baseY = 0;

            switch(value) {
                case 1: break;
                case 2: baseY = -90; break;
                case 3: baseY = -180; break;
                case 4: baseY = 90; break;
                case 5: baseX = -90; break;
                case 6: baseX = 90; break;
            }

            const spinsX = Math.floor(Math.random() * 3) + 2; // 2-4 extra spins
            const spinsY = Math.floor(Math.random() * 3) + 2;
            
            let targetX = baseX;
            // Ensure we spin forward by at least the random number of spins
            while (targetX <= currentRot.x) {
                targetX += 360;
            }
            targetX += spinsX * 360;

            let targetY = baseY;
            while (targetY <= currentRot.y) {
                targetY += 360;
            }
            targetY += spinsY * 360;

            return { x: targetX, y: targetY };
        };

        const newRotations = [
            getTargetRotation(newValues[0], rotations[0]),
            getTargetRotation(newValues[1], rotations[1]),
            getTargetRotation(newValues[2], rotations[2])
        ];

        setRotations(newRotations);

        setTimeout(() => {
            setDiceValues(newValues);
            setIsRolling(false);
            setShowResult(true);

            // Jackpot effect (e.g. 6 * 6)
            if (newValues[0] === 6 && newValues[1] === 6) {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#facc15', '#fbbf24', '#f59e0b']
                });
            }
        }, 2000); // Match CSS transition duration
    };

    if (gameState === 'setup') {
        return (
            <div className="w-full max-w-3xl mx-auto px-6 pb-12 pt-4 md:pt-8 animate-fade-in">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <ChevronLeftIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    </button>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        Tärningarna
                    </h2>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight flex items-center gap-2">
                        <SettingsIcon className="w-6 h-6 text-primary" />
                        Välj Nivå
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {(['easy', 'medium', 'hard', 'custom'] as DifficultyLevel[]).map((lvl) => (
                            <button
                                key={lvl}
                                onClick={() => setDifficulty(lvl)}
                                className={`p-4 rounded-2xl border-2 font-bold uppercase tracking-wider text-sm transition-all ${
                                    difficulty === lvl
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-primary/50'
                                }`}
                            >
                                {lvl === 'easy' ? 'Lätt' : lvl === 'medium' ? 'Mellan' : lvl === 'hard' ? 'Tuff' : 'Egen'}
                            </button>
                        ))}
                    </div>

                    {difficulty === 'custom' ? (
                        <div className="space-y-4 mb-8">
                            <h4 className="font-bold text-gray-900 dark:text-white uppercase text-sm mb-4">Dina 6 övningar:</h4>
                            {customExercises.map((ex, idx) => (
                                <div key={idx} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500">
                                        {idx + 1}
                                    </div>
                                    <input
                                        type="text"
                                        value={ex}
                                        onChange={(e) => {
                                            const newEx = [...customExercises];
                                            newEx[idx] = e.target.value;
                                            setCustomExercises(newEx);
                                        }}
                                        placeholder={`Övning ${idx + 1}`}
                                        className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:border-primary focus:ring-0 outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <h4 className="font-bold text-gray-900 dark:text-white uppercase text-sm mb-4">Övningar i denna nivå:</h4>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {PRESET_EXERCISES[difficulty].map((ex, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                                        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                                            {idx + 1}
                                        </span>
                                        {ex}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <button
                        onClick={handleStart}
                        className="w-full py-5 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-xl uppercase tracking-widest shadow-lg transition-transform active:scale-95"
                    >
                        Starta Spelet
                    </button>
                </div>
            </div>
        );
    }

    const reps = diceValues[0] * diceValues[1];
    const exercise = activeExercises[diceValues[2] - 1];

    return (
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 pt-4 md:pt-8 animate-fade-in flex flex-col items-center justify-start min-h-[80vh]">
            <div className="flex items-center justify-between mb-8 z-10 w-full">
                <div>
                    <h2 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                        Tärningarna
                    </h2>
                    <p className="text-xl text-gray-500 dark:text-gray-400 font-medium mt-2">
                        Slå tärningarna för att multiplicera reps!
                    </p>
                </div>
                <button
                    onClick={() => setGameState('setup')}
                    className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg"
                >
                    Inställningar
                </button>
            </div>

            {/* Legend */}
            <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-12 flex flex-wrap gap-4 justify-center">
                {activeExercises.map((ex, idx) => (
                    <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${diceValues[2] === idx + 1 && showResult ? 'bg-primary text-white font-bold scale-110 shadow-md' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300'} transition-all duration-300`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${diceValues[2] === idx + 1 && showResult ? 'bg-white text-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
                            {idx + 1}
                        </span>
                        <span className="text-sm">{ex}</span>
                    </div>
                ))}
            </div>

            {/* 3D Dice Container */}
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 mb-16">
                <Die rotation={rotations[0]} isRolling={isRolling} color="white" onClick={rollDice} />
                <div className="flex items-center justify-center text-4xl font-black text-gray-400">×</div>
                <Die rotation={rotations[1]} isRolling={isRolling} color="white" onClick={rollDice} />
                <div className="flex items-center justify-center text-4xl font-black text-gray-400">=</div>
                <Die rotation={rotations[2]} isRolling={isRolling} color="primary" onClick={rollDice} />
            </div>

            {/* Controls & Result */}
            <div className="flex flex-col items-center w-full min-h-[200px]">
                <AnimatePresence>
                    {showResult && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.9 }}
                            className="mt-4 text-center"
                        >
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-2">
                                Din utmaning:
                            </p>
                            <div className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white drop-shadow-sm">
                                <span className="text-primary">{reps}</span> {exercise}
                            </div>
                            <p className="text-xl text-gray-500 mt-4 font-medium">
                                ({diceValues[0]} × {diceValues[1]} repetitioner)
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* CSS for 3D Dice */}
            <style dangerouslySetInnerHTML={{__html: `
                .die-scene {
                    width: 120px;
                    height: 120px;
                    perspective: 1000px;
                    position: relative;
                    cursor: pointer;
                }
                @media (min-width: 768px) {
                    .die-scene {
                        width: 160px;
                        height: 160px;
                    }
                }
                .die-tilt {
                    width: 100%;
                    height: 100%;
                    transform-style: preserve-3d;
                    transition: transform 0.3s ease;
                    transform: scale(1) rotateX(-15deg) rotateY(15deg);
                }
                .die-scene:hover .die-tilt {
                    transform: scale(1.05) rotateX(-15deg) rotateY(15deg);
                }
                .die-scene.is-rolling .die-tilt {
                    transform: scale(1.1) rotateX(-15deg) rotateY(15deg);
                }
                .die-cube {
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    transform-style: preserve-3d;
                    transition: transform 2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .die-face {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 20px;
                    border: 2px solid rgba(0,0,0,0.1);
                    display: grid;
                    padding: 20%;
                    box-shadow: inset 0 0 15px rgba(0,0,0,0.1);
                    backface-visibility: hidden;
                }
                .die-face-white {
                    background: white;
                }
                .die-face-primary {
                    background: #22c55e;
                    border-color: rgba(0,0,0,0.2);
                }
                .dot {
                    display: block;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1f2937;
                    box-shadow: inset 0 3px 0 rgba(0,0,0,0.2);
                }
                .die-face-primary .dot {
                    background: white;
                    box-shadow: inset 0 3px 0 rgba(0,0,0,0.1);
                }
                
                /* Face positioning */
                .face-1 { transform: rotateY(0deg) translateZ(60px); }
                .face-2 { transform: rotateY(90deg) translateZ(60px); }
                .face-3 { transform: rotateY(180deg) translateZ(60px); }
                .face-4 { transform: rotateY(-90deg) translateZ(60px); }
                .face-5 { transform: rotateX(90deg) translateZ(60px); }
                .face-6 { transform: rotateX(-90deg) translateZ(60px); }
                
                @media (min-width: 768px) {
                    .face-1 { transform: rotateY(0deg) translateZ(80px); }
                    .face-2 { transform: rotateY(90deg) translateZ(80px); }
                    .face-3 { transform: rotateY(180deg) translateZ(80px); }
                    .face-4 { transform: rotateY(-90deg) translateZ(80px); }
                    .face-5 { transform: rotateX(90deg) translateZ(80px); }
                    .face-6 { transform: rotateX(-90deg) translateZ(80px); }
                    .dot { width: 24px; height: 24px; }
                }

                /* Dot layouts */
                .face-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; place-items: center; }
                .face-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
                .face-2 .dot:nth-child(1) { align-self: start; justify-self: end; }
                .face-2 .dot:nth-child(2) { align-self: end; justify-self: start; }
                
                .face-3 { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; }
                .face-3 .dot:nth-child(1) { align-self: start; justify-self: end; grid-area: 1 / 3; }
                .face-3 .dot:nth-child(2) { align-self: center; justify-self: center; grid-area: 2 / 2; }
                .face-3 .dot:nth-child(3) { align-self: end; justify-self: start; grid-area: 3 / 1; }
                
                .face-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; place-content: space-between; }
                .face-4 .dot { align-self: center; justify-self: center; }
                
                .face-5 { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; }
                .face-5 .dot:nth-child(1) { grid-area: 1 / 1; }
                .face-5 .dot:nth-child(2) { grid-area: 1 / 3; }
                .face-5 .dot:nth-child(3) { grid-area: 2 / 2; align-self: center; justify-self: center; }
                .face-5 .dot:nth-child(4) { grid-area: 3 / 1; }
                .face-5 .dot:nth-child(5) { grid-area: 3 / 3; }
                
                .face-6 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; place-content: space-between; }
                .face-6 .dot { align-self: center; justify-self: center; }
            `}} />
        </div>
    );
};

const Die: React.FC<{ rotation: {x: number, y: number}, isRolling: boolean, color: 'white' | 'primary', onClick?: () => void }> = ({ rotation, isRolling, color, onClick }) => {
    return (
        <div className={`die-scene ${isRolling ? 'is-rolling' : ''}`} onClick={onClick}>
            <div className="die-tilt">
                <div 
                    className="die-cube"
                    style={{ 
                        transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                        transitionDuration: isRolling ? '2s' : '0.3s'
                    }}
                >
                    <div className={`die-face face-1 die-face-${color}`}><span className="dot"></span></div>
                    <div className={`die-face face-2 die-face-${color}`}><span className="dot"></span><span className="dot"></span></div>
                    <div className={`die-face face-3 die-face-${color}`}><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
                    <div className={`die-face face-4 die-face-${color}`}><span className="dot"></span><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
                    <div className={`die-face face-5 die-face-${color}`}><span className="dot"></span><span className="dot"></span><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
                    <div className={`die-face face-6 die-face-${color}`}><span className="dot"></span><span className="dot"></span><span className="dot"></span><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
                </div>
            </div>
        </div>
    );
};
