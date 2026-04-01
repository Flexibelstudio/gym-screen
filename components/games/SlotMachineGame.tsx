import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStudio } from '../../context/StudioContext';
import { ChevronLeftIcon, SettingsIcon, SlotMachineIcon } from '../icons';
import confetti from 'canvas-confetti';

interface SlotMachineGameProps {
    onBack: () => void;
}

type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'custom';

const PRESET_EXERCISES = {
    easy: [
        'Knäböj', 'Armhävningar mot vägg', 'Situps', 'Höga knän', 'Plankan', 
        'Utfall', 'Jumping jacks', 'Rygglyft', 'Båten', 'Sido-utfall', 
        'Tåhävningar', 'Höftlyft', 'Step-ups', 'Bear crawl'
    ],
    medium: [
        'Knäböj med hopp', 'Armhävningar', 'Fällkniven', 'Burpees', 'Mountain climbers', 
        'Utfallshopp', 'Dips', 'Russian twists', 'Skaters', 'Tuck jumps', 
        'Walkouts', 'Jägarvila', 'Thrusters (kroppsvikt)', 'Hollow hold'
    ],
    hard: [
        'Jumping lunges', 'Enbens-höftlyft', 'Broad jumps', 'Burpee broad jumps', 
        'Commandos (hög till låg planka)', 'Sido-utfall med hopp', 'Hollow rocks', 
        'Burpees med höga knän', 'Upphopp', 'Smala armhävningar'
    ]
};

const AMOUNTS = [
    '5 reps', '10 reps', '15 reps', '20 reps', 
    '30 sek', '45 sek', '60 sek', '90 sek'
];

const SPICES = [
    'Gör det blundande', 'Dubbla tempot', 'Håll en vikt', 
    'På ett ben', 'Långsamt ner', 'Utan paus', 
    'Med ett leende', 'Kör baklänges'
];

export const SlotMachineGame: React.FC<SlotMachineGameProps> = ({ onBack }) => {
    const { studioConfig } = useStudio();
    const [gameState, setGameState] = useState<'setup' | 'playing'>('setup');
    const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
    const [customExercises, setCustomExercises] = useState<string[]>(Array(6).fill(''));
    
    const [isSpinning, setIsSpinning] = useState(false);
    const [results, setResults] = useState<[string, string, string]>(['', '', '']);
    const [showResult, setShowResult] = useState(false);

    const activeExercises = difficulty === 'custom' 
        ? customExercises.filter(ex => ex.trim() !== '')
        : PRESET_EXERCISES[difficulty];

    const handleStart = () => {
        if (difficulty === 'custom' && activeExercises.length < 3) {
            alert('Vänligen fyll i minst 3 övningar.');
            return;
        }
        setGameState('playing');
        setShowResult(false);
        // Set initial random results to display before first spin
        setResults([
            activeExercises[0],
            AMOUNTS[0],
            SPICES[0]
        ]);
    };

    const spin = () => {
        if (isSpinning) return;
        setIsSpinning(true);
        setShowResult(false);

        const newResults: [string, string, string] = [
            activeExercises[Math.floor(Math.random() * activeExercises.length)],
            AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)],
            SPICES[Math.floor(Math.random() * SPICES.length)]
        ];

        // Set results immediately so the Reels know what to spin towards
        setResults(newResults);

        // The Reels component handles the animation duration (e.g., ~3s)
        setTimeout(() => {
            setIsSpinning(false);
            setShowResult(true);

            // Confetti if they get a tough combo (just random fun)
            if (Math.random() > 0.8) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ef4444', '#3b82f6', '#10b981']
                });
            }
        }, 3200);
    };

    if (gameState === 'setup') {
        return (
            <div className="w-full max-w-3xl mx-auto px-6 pb-12 pt-4 md:pt-8 animate-fade-in">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onBack} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <ChevronLeftIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    </button>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        Enarmad Bandit
                    </h2>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight flex items-center gap-2">
                        <SettingsIcon className="w-6 h-6 text-primary" />
                        Välj Nivå för Övningar
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
                            <h4 className="font-bold text-gray-900 dark:text-white uppercase text-sm mb-4">Dina övningar (minst 3):</h4>
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

    return (
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 pt-4 md:pt-8 animate-fade-in flex flex-col items-center justify-start min-h-[80vh]">
            <div className="flex items-center justify-between mb-8 z-10 w-full">
                <div>
                    <h2 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                        Enarmad Bandit
                    </h2>
                    <p className="text-xl text-gray-500 dark:text-gray-400 font-medium mt-2">
                        Dra i spaken för nästa utmaning!
                    </p>
                </div>
                <button
                    onClick={() => setGameState('setup')}
                    className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg"
                >
                    Inställningar
                </button>
            </div>

            {/* Slot Machine Container */}
            <div className="w-full max-w-4xl bg-gray-900 rounded-[3rem] p-4 md:p-8 shadow-2xl border-8 border-gray-800 relative mt-8 mb-12 z-10 mr-10 ml-2 md:mx-0">
                {/* Top decoration */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-red-500 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.5)]"></div>
                
                <div className="bg-gray-800 rounded-[2rem] p-4 md:p-6 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <Reel 
                            items={activeExercises} 
                            isSpinning={isSpinning} 
                            result={results[0]} 
                            delay={0} 
                            title="Övning" 
                            color="bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
                        />
                        <Reel 
                            items={AMOUNTS} 
                            isSpinning={isSpinning} 
                            result={results[1]} 
                            delay={0.5} 
                            title="Antal/Tid" 
                            color="bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-100"
                        />
                        <Reel 
                            items={SPICES} 
                            isSpinning={isSpinning} 
                            result={results[2]} 
                            delay={1} 
                            title="Krydda" 
                            color="bg-purple-50 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100"
                        />
                    </div>
                </div>

                {/* Lever */}
                <div className="absolute -right-8 md:-right-16 top-1/2 -translate-y-1/2 w-8 md:w-12 h-32 md:h-48 z-0">
                    <div className="w-3 md:w-4 h-full bg-gray-400 mx-auto rounded-full shadow-inner relative">
                        <motion.div 
                            className="absolute -top-4 md:-top-6 -left-3 md:-left-4 w-10 h-10 md:w-12 md:h-12 bg-red-500 rounded-full shadow-lg cursor-grab active:cursor-grabbing"
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 120 }}
                            dragElastic={0.1}
                            onDragEnd={(e, info) => {
                                if (info.offset.y > 50 && !isSpinning) {
                                    spin();
                                }
                            }}
                            animate={{ y: isSpinning ? 120 : 0 }}
                            transition={{ duration: 0.5, type: "spring" }}
                            onClick={() => {
                                if (!isSpinning) spin();
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Controls & Result */}
            <div className="flex flex-col items-center w-full relative z-10 min-h-[250px]">
                <AnimatePresence>
                    {showResult && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.9 }}
                            className="absolute top-0 mt-8 text-center bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 w-full max-w-2xl"
                        >
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-4">
                                Din utmaning:
                            </p>
                            <div className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white drop-shadow-sm leading-tight">
                                Gör <span className="text-green-500">{results[1]}</span> <span className="text-blue-500">{results[0]}</span>
                                <br/>
                                <span className="text-purple-500 text-2xl md:text-3xl mt-2 block">({results[2]})</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const Reel: React.FC<{ 
    items: string[], 
    isSpinning: boolean, 
    result: string, 
    delay: number,
    title: string,
    color: string
}> = ({ items, isSpinning, result, delay, title, color }) => {
    
    const [localItems, setLocalItems] = useState<string[]>([result || items[0]]);
    const [offset, setOffset] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isSpinning) {
            // Create a random list of 25 items + the final result (reduced from 40 for TV performance)
            const newList = Array.from({ length: 25 }, () => items[Math.floor(Math.random() * items.length)]);
            newList.push(result);
            
            setLocalItems(newList);
            setOffset(0);
            setIsAnimating(false); // Disable transition for the reset

            // Force reflow and start animation with a slightly longer delay 
            // to ensure TV browsers have painted the new DOM nodes
            timer = setTimeout(() => {
                setIsAnimating(true);
                // 64px is the height of each item (h-16)
                setOffset(-(newList.length - 1) * 64);
            }, 100); 

        } else {
            // Snap to single item when spinning is done
            setLocalItems([result || items[0]]);
            setOffset(0);
            setIsAnimating(false);
        }
        return () => clearTimeout(timer);
    }, [isSpinning, result, items]);

    return (
        <div className="flex flex-col items-center w-full">
            <h4 className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-3">{title}</h4>
            <div className="w-full h-40 md:h-48 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden relative shadow-inner border-4 border-gray-300 dark:border-gray-700">
                {/* Gradient overlays for 3D cylinder effect */}
                <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/20 to-transparent z-10 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent z-10 pointer-events-none"></div>
                
                {/* Center highlight */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-16 bg-white/10 dark:bg-white/5 z-10 pointer-events-none border-y border-white/20"></div>

                <div className="relative w-full h-full flex justify-center items-center">
                    <div 
                        className="absolute w-full flex flex-col"
                        style={{ 
                            top: '50%', 
                            marginTop: '-32px', // Center the first item (32px is half of 64px)
                            transform: `translate3d(0, ${offset}px, 0)`,
                            transitionProperty: 'transform',
                            transitionDuration: isAnimating ? `${2.5 + delay}s` : '0s',
                            transitionTimingFunction: 'cubic-bezier(0.15, 0.85, 0.35, 1)',
                            transitionDelay: isAnimating ? `${delay * 0.2}s` : '0s',
                            willChange: 'transform',
                            WebkitBackfaceVisibility: 'hidden',
                            backfaceVisibility: 'hidden',
                            WebkitPerspective: 1000,
                            perspective: 1000
                        }}
                    >
                        {localItems.map((item, idx) => (
                            <div key={idx} className={`h-16 shrink-0 flex items-center justify-center px-2 text-center font-black text-sm md:text-lg ${color} rounded-lg mx-2 my-0`}>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
