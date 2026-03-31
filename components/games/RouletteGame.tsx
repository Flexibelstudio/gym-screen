import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useStudio } from '../../context/StudioContext';
import { playTimerSound, playTada } from '../../hooks/useWorkoutTimer';
import { MOCK_EXERCISE_BANK } from '../../data/mockData';
import { JokerEvent, getRandomJoker } from '../../data/jokers';

interface RouletteGameProps {
    onBack: () => void;
}

type Difficulty = 'easy' | 'medium' | 'hard';
type WheelType = 'legs' | 'upper' | 'cardio' | 'core' | 'custom';

interface WheelConfig {
    id: WheelType;
    name: string;
    emoji: string;
    slices: Record<Difficulty, string[]>;
}

const PRESET_WHEELS: WheelConfig[] = [
    {
        id: 'legs',
        name: 'Ben & Rumpa',
        emoji: '🦵',
        slices: {
            easy: ['10 Knäböj', '10 Utfall', '15 Höftlyft', '10 Vadpress', '10 Sek Jägarvila', '10 Sido-utfall'],
            medium: ['15 Knäböj', '20 Utfall', '20 Höftlyft', '15 Upphopp', '30 Sek Jägarvila', '15 Sido-utfall'],
            hard: ['20 Upphopp', '30 Utfallshopp', '20 Enbens-höftlyft', '20 Pistol Squats', '60 Sek Jägarvila', '20 Skridskohopp']
        }
    },
    {
        id: 'upper',
        name: 'Överkropp',
        emoji: '💪',
        slices: {
            easy: ['5 Armhävningar på knä', '10 Dips mot stol', '15 Sek Planka', '10 Rygglyft', '10 Armcirklar', '5 Smala armhävningar på knä'],
            medium: ['10 Armhävningar', '15 Dips', '30 Sek Planka', '15 Rygglyft', '10 Burpees', '10 Smala armhävningar'],
            hard: ['20 Armhävningar', '20 Dips', '60 Sek Planka', '20 Rygglyft', '15 Burpees', '15 Smala armhävningar']
        }
    },
    {
        id: 'cardio',
        name: 'Kondition',
        emoji: '🫀',
        slices: {
            easy: ['20 Jumping Jacks', '15 Höga knän', '10 Burpees (utan armhävning)', '20 Snabba fötter', '15 Skridskohopp', '10 Mountain Climbers'],
            medium: ['40 Jumping Jacks', '30 Höga knän', '15 Burpees', '40 Snabba fötter', '30 Skridskohopp', '30 Mountain Climbers'],
            hard: ['60 Jumping Jacks', '50 Höga knän', '25 Burpees', '60 Snabba fötter', '50 Skridskohopp', '50 Mountain Climbers']
        }
    },
    {
        id: 'core',
        name: 'Bål & Mage',
        emoji: '🍫',
        slices: {
            easy: ['10 Sit-ups', '15 Sek Planka', '10 Cykelcrunches', '10 Båten', '10 Ryska twist', '10 Benlyft'],
            medium: ['20 Sit-ups', '45 Sek Planka', '20 Cykelcrunches', '30 Sek Båten', '20 Ryska twist', '15 Benlyft'],
            hard: ['40 Sit-ups', '90 Sek Planka', '40 Cykelcrunches', '60 Sek Båten', '40 Ryska twist', '25 Benlyft']
        }
    }
];

const COLORS = [
    '#ef4444', // red
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // yellow
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
];

export const RouletteGame: React.FC<RouletteGameProps> = ({ onBack }) => {
    const { studioConfig } = useStudio();
    const [gameState, setGameState] = useState<'setup' | 'playing'>('setup');
    const [selectedWheel, setSelectedWheel] = useState<WheelType>('legs');
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    
    const [customSlices, setCustomSlices] = useState<string[]>(['', '', '', '', '', '']);
    const [focusedSliceIndex, setFocusedSliceIndex] = useState<number | null>(null);

    const [goalType, setGoalType] = useState<'free' | 'time' | 'spins'>('free');
    const [goalValue, setGoalValue] = useState<number>(10); // 10 minutes or 10 spins
    const [spinsCount, setSpinsCount] = useState<number>(0);

    const [jokerCount, setJokerCount] = useState<number>(2);
    const [jokerType, setJokerType] = useState<'reward' | 'challenge' | 'mixed'>('mixed');
    const [activeJokerEvent, setActiveJokerEvent] = useState<JokerEvent | null>(null);
    const [jokerTimeLeft, setJokerTimeLeft] = useState<number | null>(null);
    
    // Timer state
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [hasStartedTimer, setHasStartedTimer] = useState(false);
    const [showTimerControls, setShowTimerControls] = useState(false);

    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState<string | null>(null);
    const [resultIndex, setResultIndex] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        if (showTimerControls) {
            const timer = setTimeout(() => setShowTimerControls(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showTimerControls]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        setIsTimerRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, timeLeft]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (jokerTimeLeft !== null && jokerTimeLeft > 0) {
            interval = setInterval(() => {
                setJokerTimeLeft(prev => {
                    if (prev && prev <= 1) {
                        playTimerSound(studioConfig?.soundProfile || 'airhorn', 1);
                        return 0;
                    }
                    return prev ? prev - 1 : 0;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [jokerTimeLeft, studioConfig?.soundProfile]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isGoalReached = (() => {
        if (goalType === 'spins') return spinsCount >= goalValue;
        if (goalType === 'time') return hasStartedTimer && timeLeft === 0;
        return false;
    })();

    const handleFinishGame = () => {
        setGameState('setup');
        setSpinsCount(0);
        setIsTimerRunning(false);
        setHasStartedTimer(false);
    };

    const getActiveSlices = () => {
        let baseSlices: string[] = [];
        if (selectedWheel === 'custom') {
            baseSlices = customSlices.filter(s => s.trim() !== '');
        } else {
            const wheel = PRESET_WHEELS.find(w => w.id === selectedWheel);
            baseSlices = wheel ? wheel.slices[difficulty] : [];
        }

        if (baseSlices.length === 0) return [];

        const slices = [...baseSlices];
        if (jokerCount > 0) {
            const step = Math.max(1, Math.floor(slices.length / jokerCount));
            for (let i = 0; i < jokerCount; i++) {
                slices.splice(i * step + i, 0, 'JOKER 🃏');
            }
        }
        return slices;
    };

    const handleSpin = () => {
        if (isSpinning || isGoalReached) return;
        
        const slices = getActiveSlices();
        if (slices.length === 0) return;

        if (goalType === 'time' && (!hasStartedTimer || !isTimerRunning)) {
            setIsTimerRunning(true);
            setHasStartedTimer(true);
        }

        setIsSpinning(true);
        setShowResult(false);
        setResult(null);
        setResultIndex(null);

        // Play a sound when starting
        playTimerSound(studioConfig?.soundProfile || 'airhorn', 1);

        // Calculate random rotation
        const spins = 8 + Math.floor(Math.random() * 6); // 8 to 13 full spins
        const randomDegree = Math.floor(Math.random() * 360);
        const totalRotation = rotation + (spins * 360) + randomDegree;
        
        setRotation(totalRotation);

        // Determine winning slice
        const sliceAngle = 360 / slices.length;
        // The pointer is at the top (0 degrees or 360 degrees).
        // We need to calculate which slice ends up at the top after rotation.
        // The wheel rotates clockwise.
        const normalizedRotation = totalRotation % 360;
        // The slice at the top is the one that was at (360 - normalizedRotation) before spinning.
        // Slice 0 starts at 0 to sliceAngle.
        // Slice 1 starts at sliceAngle to 2*sliceAngle.
        // So the angle pointing up is (360 - normalizedRotation) % 360
        const pointerAngle = (360 - normalizedRotation) % 360;
        const winningIndex = Math.floor(pointerAngle / sliceAngle);
        
        setTimeout(() => {
            setIsSpinning(false);
            const winningSlice = slices[winningIndex];
            setResult(winningSlice);
            setResultIndex(winningIndex);
            
            if (winningSlice === 'JOKER 🃏') {
                const event = getRandomJoker(jokerType);
                setActiveJokerEvent(event);
                if (event.duration) {
                    setJokerTimeLeft(event.duration);
                } else {
                    setJokerTimeLeft(null);
                }
                
                // Celebrate Joker
                playTada();
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#a855f7', '#ec4899', '#eab308'],
                    zIndex: 100
                });
            } else {
                setActiveJokerEvent(null);
                setJokerTimeLeft(null);
                playTimerSound(studioConfig?.soundProfile || 'airhorn', 3);
            }

            setShowResult(true);
            setSpinsCount(prev => prev + 1);
        }, 8000); // 8 seconds spin duration
    };

    const startGame = () => {
        const slices = getActiveSlices();
        if (slices.length < 2) {
            alert('Du måste ha minst 2 alternativ i hjulet!');
            return;
        }
        setGameState('playing');
        setRotation(0);
        setResult(null);
        setResultIndex(null);
        setShowResult(false);
        setSpinsCount(0);
        setActiveJokerEvent(null);
        setJokerTimeLeft(null);
        
        if (goalType === 'time') {
            setTimeLeft(goalValue * 60);
            setIsTimerRunning(false);
            setHasStartedTimer(false);
        }
    };

    const updateCustomSlice = (index: number, value: string) => {
        const newSlices = [...customSlices];
        newSlices[index] = value;
        setCustomSlices(newSlices);
    };

    const addCustomSlice = () => {
        if (customSlices.length < 12) {
            setCustomSlices([...customSlices, '']);
        }
    };

    const removeCustomSlice = (index: number) => {
        if (customSlices.length > 2) {
            const newSlices = [...customSlices];
            newSlices.splice(index, 1);
            setCustomSlices(newSlices);
        }
    };

    if (gameState === 'setup') {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 pb-12 animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
                <div className="text-center mb-10 w-full">
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-2 tracking-tight uppercase">
                        Svett-hjulet
                    </h1>
                    <div className="h-1.5 w-24 bg-primary mx-auto rounded-full mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Inställningar
                    </p>
                </div>

                <div className="max-w-3xl mx-auto w-full space-y-8 bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-800">
                    
                    {/* Wheel Selection */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">Välj Hjul</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {PRESET_WHEELS.map(wheel => (
                                <button
                                    key={wheel.id}
                                    onClick={() => setSelectedWheel(wheel.id)}
                                    className={`py-4 px-2 rounded-xl font-bold uppercase tracking-wider transition-all border-2 flex flex-col items-center gap-2 ${
                                        selectedWheel === wheel.id 
                                            ? 'border-primary bg-primary/10 text-primary' 
                                            : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'
                                    }`}
                                >
                                    <span className="text-3xl">{wheel.emoji}</span>
                                    <span className="text-sm">{wheel.name}</span>
                                </button>
                            ))}
                            <button
                                onClick={() => setSelectedWheel('custom')}
                                className={`py-4 px-2 rounded-xl font-bold uppercase tracking-wider transition-all border-2 flex flex-col items-center gap-2 ${
                                    selectedWheel === 'custom' 
                                        ? 'border-primary bg-primary/10 text-primary' 
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'
                                }`}
                            >
                                <span className="text-3xl">✏️</span>
                                <span className="text-sm">Eget Hjul</span>
                            </button>
                        </div>
                    </div>

                    {/* Difficulty (only for preset wheels) */}
                    {selectedWheel !== 'custom' && (
                        <div className="animate-fade-in">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">Svårighetsgrad</h3>
                            <div className="grid grid-cols-3 gap-4">
                                {(['easy', 'medium', 'hard'] as const).map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setDifficulty(level)}
                                        className={`py-4 rounded-xl font-bold uppercase tracking-wider transition-all border-2 ${
                                            difficulty === level 
                                                ? 'border-primary bg-primary/10 text-primary' 
                                                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'
                                        }`}
                                    >
                                        {level === 'easy' ? 'Lätt' : level === 'medium' ? 'Medel' : 'Tuff'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Wheel Editor */}
                    {selectedWheel === 'custom' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Dina alternativ</h3>
                                {customSlices.length < 12 && (
                                    <button 
                                        onClick={addCustomSlice}
                                        className="text-sm font-bold text-primary hover:text-primary/80 uppercase tracking-wider"
                                    >
                                        + Lägg till fält
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {customSlices.map((slice, index) => (
                                    <div key={index} className="relative flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl border border-gray-100 dark:border-gray-800">
                                        <div 
                                            className="w-6 h-6 rounded-full flex-shrink-0" 
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={slice}
                                                onChange={(e) => updateCustomSlice(index, e.target.value)}
                                                onFocus={() => setFocusedSliceIndex(index)}
                                                onBlur={() => setTimeout(() => setFocusedSliceIndex(null), 200)}
                                                placeholder={`Alternativ ${index + 1}`}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                            />
                                            {focusedSliceIndex === index && slice.length > 0 && (
                                                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {MOCK_EXERCISE_BANK
                                                        .filter(ex => ex.name.toLowerCase().includes(slice.toLowerCase()))
                                                        .slice(0, 5)
                                                        .map(ex => (
                                                            <button
                                                                key={ex.id}
                                                                className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                                                onClick={() => {
                                                                    updateCustomSlice(index, ex.name);
                                                                    setFocusedSliceIndex(null);
                                                                }}
                                                            >
                                                                <span className="font-bold block">{ex.name}</span>
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                        {customSlices.length > 2 && (
                                            <button 
                                                onClick={() => removeCustomSlice(index)}
                                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Jokers */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">Jokrar</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Antal Jokrar i hjulet: {jokerCount}</label>
                                <input 
                                    type="range" 
                                    min="0" max="4" 
                                    value={jokerCount} 
                                    onChange={(e) => setJokerCount(parseInt(e.target.value))}
                                    className="w-full accent-primary"
                                />
                            </div>
                            {jokerCount > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setJokerType('reward')} className={`py-2 rounded-lg font-bold text-sm uppercase border-2 ${jokerType === 'reward' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'}`}>Belöning</button>
                                    <button onClick={() => setJokerType('challenge')} className={`py-2 rounded-lg font-bold text-sm uppercase border-2 ${jokerType === 'challenge' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'}`}>Utmaning</button>
                                    <button onClick={() => setJokerType('mixed')} className={`py-2 rounded-lg font-bold text-sm uppercase border-2 ${jokerType === 'mixed' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'}`}>Blandat</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Goal Type */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">Mål</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={() => setGoalType('free')}
                                className={`py-4 rounded-xl font-bold uppercase tracking-wider transition-all border-2 ${
                                    goalType === 'free' 
                                        ? 'border-primary bg-primary/10 text-primary' 
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'
                                }`}
                            >
                                Fritt
                            </button>
                            <button
                                onClick={() => setGoalType('time')}
                                className={`py-4 rounded-xl font-bold uppercase tracking-wider transition-all border-2 ${
                                    goalType === 'time' 
                                        ? 'border-primary bg-primary/10 text-primary' 
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'
                                }`}
                            >
                                På tid
                            </button>
                            <button
                                onClick={() => setGoalType('spins')}
                                className={`py-4 rounded-xl font-bold uppercase tracking-wider transition-all border-2 ${
                                    goalType === 'spins' 
                                        ? 'border-primary bg-primary/10 text-primary' 
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'
                                }`}
                            >
                                Antal snurr
                            </button>
                        </div>
                    </div>

                    {/* Goal Value Input */}
                    {goalType !== 'free' && (
                        <div className="animate-fade-in">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">
                                {goalType === 'time' ? 'Tid (minuter)' : 'Antal snurr'}
                            </h3>
                            <input
                                type="number"
                                min="1"
                                value={goalValue}
                                onChange={(e) => setGoalValue(parseInt(e.target.value) || 1)}
                                className="w-full p-4 text-2xl font-bold text-center rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary focus:ring-0 outline-none"
                            />
                        </div>
                    )}

                    <button
                        onClick={startGame}
                        className="w-full py-5 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-xl uppercase tracking-widest shadow-lg transition-transform active:scale-95 mt-8"
                    >
                        Börja Snurra
                    </button>
                </div>
            </div>
        );
    }

    const activeSlices = getActiveSlices();
    const sliceAngle = 360 / activeSlices.length;

    return (
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 pt-4 md:pt-8 animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
            <div className="flex items-center justify-between mb-6 z-10 w-full">
                <div>
                    <h2 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                        Svett-hjulet
                    </h2>
                    <div className="flex items-center gap-4 mt-2">
                        <p className="text-xl text-gray-500 dark:text-gray-400 font-medium">
                            {selectedWheel === 'custom' ? 'Eget Hjul' : PRESET_WHEELS.find(w => w.id === selectedWheel)?.name}
                        </p>
                        {goalType === 'spins' && (
                            <div className="px-4 py-1.5 bg-primary/10 text-primary rounded-lg font-bold text-xl">
                                {spinsCount} / {goalValue}
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setGameState('setup')}
                    className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg"
                >
                    Inställningar
                </button>
            </div>

            {goalType === 'time' && (
                <div className="flex flex-col items-center justify-center mb-4 z-10">
                    <div 
                        className="flex flex-col items-center justify-center relative group cursor-pointer"
                        onClick={() => setShowTimerControls(true)}
                    >
                        <div className="font-mono font-black leading-none tracking-tighter tabular-nums drop-shadow-xl select-none text-[6rem] sm:text-[8rem] md:text-[10rem] text-primary relative z-10">
                            {formatTime(timeLeft)}
                        </div>
                        <div className={`flex gap-4 mt-8 relative z-10 transition-opacity duration-300 ${!hasStartedTimer ? 'opacity-0 pointer-events-none' : isTimerRunning ? (showTimerControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100') : 'opacity-100'}`}>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsTimerRunning(!isTimerRunning);
                                    setShowTimerControls(false);
                                }}
                                className={`px-10 py-4 text-white rounded-2xl font-black text-xl uppercase tracking-widest shadow-lg transition-transform active:scale-95 ${isTimerRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`}
                            >
                                {isTimerRunning ? 'Pausa' : 'Fortsätt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative flex flex-col items-center justify-center w-full max-w-4xl mx-auto mt-8 md:mt-16">
                {/* Pointer */}
                <div className="absolute -top-8 z-20 w-16 h-24 flex flex-col items-center pointer-events-none">
                    <div className="w-10 h-10 bg-gray-900 dark:bg-white rounded-full shadow-lg z-10"></div>
                    <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[32px] border-t-gray-900 dark:border-t-white -mt-2 drop-shadow-lg"></div>
                </div>

                {/* Wheel Container */}
                <div 
                    className={`relative w-full aspect-square max-w-[800px] p-4 ${!isSpinning && !isGoalReached ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform' : ''}`}
                    onClick={() => {
                        if (!isSpinning && !isGoalReached) {
                            handleSpin();
                        }
                    }}
                >
                    <div className="absolute inset-0 rounded-full bg-white dark:bg-gray-800 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.2)] border-8 border-white dark:border-gray-800"></div>
                    
                    <motion.div 
                        className="relative w-full h-full rounded-full overflow-hidden"
                        animate={{ rotate: rotation }}
                        transition={{ duration: 8, ease: [0.2, 0.8, 0.2, 1] }} // Custom ease-out for realistic spin
                    >
                        {/* SVG Wheel */}
                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            {activeSlices.map((slice, index) => {
                                const startAngle = index * sliceAngle;
                                const endAngle = startAngle + sliceAngle;
                                
                                // Convert angles to SVG coordinates
                                const startX = 50 + 50 * Math.cos((startAngle * Math.PI) / 180);
                                const startY = 50 + 50 * Math.sin((startAngle * Math.PI) / 180);
                                const endX = 50 + 50 * Math.cos((endAngle * Math.PI) / 180);
                                const endY = 50 + 50 * Math.sin((endAngle * Math.PI) / 180);
                                
                                const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                                
                                // Path for the slice
                                const pathData = [
                                    `M 50 50`,
                                    `L ${startX} ${startY}`,
                                    `A 50 50 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                                    `Z`
                                ].join(' ');

                                return (
                                    <g key={index}>
                                        <path 
                                            d={pathData} 
                                            fill={slice === 'JOKER 🃏' ? '#1f2937' : COLORS[index % COLORS.length]} 
                                            stroke="rgba(255,255,255,0.2)"
                                            strokeWidth="0.5"
                                        />
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Text labels (HTML overlaid on SVG) */}
                        <div className="absolute inset-0 w-full h-full">
                            {activeSlices.map((slice, index) => {
                                const angle = (index * sliceAngle) + (sliceAngle / 2);
                                return (
                                    <div 
                                        key={index}
                                        className="absolute top-1/2 left-1/2 w-1/2 h-8 -mt-4 origin-left flex items-center pl-8 pr-4"
                                        style={{ transform: `rotate(${angle - 90}deg)` }}
                                    >
                                        <span className="text-white font-bold text-base md:text-xl truncate drop-shadow-md w-full text-right pr-2">
                                            {slice}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Center dot */}
                        <div className="absolute top-1/2 left-1/2 w-16 h-16 -mt-8 -ml-8 bg-white dark:bg-gray-900 rounded-full shadow-inner border-4 border-gray-100 dark:border-gray-800 z-10"></div>
                    </motion.div>
                </div>

                {/* Controls & Result */}
                <div className="mt-12 md:mt-16 flex flex-col items-center w-full min-h-[200px]">
                    {!isSpinning && !isGoalReached && !showResult && (
                        <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest animate-pulse">
                            Klicka på hjulet för att snurra!
                        </p>
                    )}

                    <AnimatePresence>
                        {showResult && result && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                                className="px-8 py-8 rounded-3xl shadow-2xl text-center w-full max-w-3xl mx-auto mb-6 mt-12"
                                style={{ 
                                    backgroundColor: result === 'JOKER 🃏' ? '#1f2937' : (resultIndex !== null ? COLORS[resultIndex % COLORS.length] : undefined),
                                    color: '#ffffff'
                                }}
                            >
                                {result === 'JOKER 🃏' ? (
                                    <div className="flex flex-col items-center">
                                        <span className="text-5xl mb-2 animate-bounce">🃏</span>
                                        <p className={`font-bold uppercase tracking-wider text-sm mb-2 ${activeJokerEvent?.type === 'reward' ? 'text-green-400' : 'text-red-400'}`}>
                                            {activeJokerEvent?.type === 'reward' ? 'Belöning!' : 'Utmaning!'}
                                        </p>
                                        <p className="text-3xl md:text-4xl font-black drop-shadow-md mb-2">{activeJokerEvent?.title}</p>
                                        <p className="text-lg opacity-90 mb-4">{activeJokerEvent?.description}</p>
                                        {jokerTimeLeft !== null && (
                                            <div className={`text-5xl font-mono font-black tabular-nums ${jokerTimeLeft === 0 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                                {formatTime(jokerTimeLeft)}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <p className="font-bold uppercase tracking-wider text-sm mb-2 opacity-90">Din utmaning</p>
                                        <p className="text-4xl md:text-5xl lg:text-6xl font-black drop-shadow-md">{result}</p>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isGoalReached && !isSpinning && (
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={handleFinishGame}
                            className="px-12 py-5 rounded-2xl font-black text-2xl uppercase tracking-widest shadow-xl transition-all bg-green-500 hover:bg-green-600 text-white hover:-translate-y-1 active:scale-95"
                        >
                            Klar!
                        </motion.button>
                    )}
                </div>
            </div>
        </div>
    );
};
