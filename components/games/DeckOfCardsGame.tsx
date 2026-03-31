import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStudio } from '../../context/StudioContext';
import { playTimerSound } from '../../hooks/useWorkoutTimer';
import { WorkoutCompleteModal } from '../WorkoutCompleteModal';

interface DeckOfCardsGameProps {
    onBack: () => void;
}

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card {
    suit: Suit;
    value: CardValue;
    numericValue: number;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES: CardValue[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const getNumericValue = (val: CardValue): number => {
    if (val === 'J') return 11;
    if (val === 'Q') return 12;
    if (val === 'K') return 13;
    if (val === 'A') return 14;
    return parseInt(val);
};

const createDeck = (): Card[] => {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value, numericValue: getNumericValue(value) });
        }
    }
    return deck;
};

const shuffleDeck = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

const getSuitSymbol = (suit: Suit) => {
    switch (suit) {
        case 'hearts': return '♥';
        case 'diamonds': return '♦';
        case 'clubs': return '♣';
        case 'spades': return '♠';
    }
};

const getSuitColor = (suit: Suit) => {
    switch (suit) {
        case 'hearts':
        case 'diamonds':
            return 'text-red-600 dark:text-red-500';
        case 'clubs':
        case 'spades':
            return 'text-black dark:text-white';
    }
};

export const DeckOfCardsGame: React.FC<DeckOfCardsGameProps> = ({ onBack }) => {
    const { studioConfig } = useStudio();
    const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished'>('setup');
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [goalType, setGoalType] = useState<'deck' | 'time' | 'rounds'>('deck');
    const [goalValue, setGoalValue] = useState<number>(10); // 10 minutes or 10 rounds
    
    const [deck, setDeck] = useState<Card[]>([]);
    const [currentCard, setCurrentCard] = useState<Card | null>(null);
    const [drawnCards, setDrawnCards] = useState<Card[]>([]);
    const [isFlipping, setIsFlipping] = useState(false);
    
    // Timer state
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [timeElapsed, setTimeElapsed] = useState<number>(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [hasStartedTimer, setHasStartedTimer] = useState(false);

    const isGoalReached = 
        (goalType === 'deck' && deck.length === 0 && drawnCards.length > 0) ||
        (goalType === 'rounds' && drawnCards.length >= goalValue) ||
        (goalType === 'time' && timeLeft === 0 && hasStartedTimer);

    useEffect(() => {
        if (isGoalReached && isTimerRunning) {
            setIsTimerRunning(false);
        }
    }, [isGoalReached, isTimerRunning]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning) {
            interval = setInterval(() => {
                if (goalType === 'time') {
                    setTimeLeft(prev => {
                        if (prev <= 1) {
                            setIsTimerRunning(false);
                            return 0;
                        }
                        return prev - 1;
                    });
                } else {
                    setTimeElapsed(prev => prev + 1);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, goalType]);

    const getExerciseForSuit = (suit: Suit) => {
        if (difficulty === 'easy') {
            switch (suit) {
                case 'hearts': return 'Jumping Jacks';
                case 'diamonds': return 'Knäböj';
                case 'clubs': return 'Sit-ups';
                case 'spades': return 'Utfall';
            }
        } else if (difficulty === 'hard') {
            switch (suit) {
                case 'hearts': return 'Burpees';
                case 'diamonds': return 'Pistol Squats';
                case 'clubs': return 'V-ups';
                case 'spades': return 'Hoppande Utfall';
            }
        } else {
            // Medium
            switch (suit) {
                case 'hearts': return 'Burpees';
                case 'diamonds': return 'Armhävningar';
                case 'clubs': return 'Sit-ups';
                case 'spades': return 'Knäböj';
            }
        }
    };

    const startGame = () => {
        setDeck(shuffleDeck(createDeck()));
        setCurrentCard(null);
        setDrawnCards([]);
        setHasStartedTimer(true);
        setIsTimerRunning(true);
        setTimeElapsed(0);
        
        if (goalType === 'time') {
            setTimeLeft(goalValue * 60);
        }
        
        setGameState('playing');
    };

    const handleFinishGame = () => {
        setGameState('finished');
        setIsTimerRunning(false);
        playTimerSound(studioConfig?.soundProfile || 'airhorn', 3);
    };

    const drawCard = () => {
        if (deck.length === 0 || isFlipping || isGoalReached) return;
        
        setIsFlipping(true);
        const newDeck = [...deck];
        const card = newDeck.pop()!;
        
        setTimeout(() => {
            setCurrentCard(card);
            setDrawnCards(prev => [card, ...prev]);
            setDeck(newDeck);
            setIsFlipping(false);
        }, 300); // Wait for flip animation
    };

    const resetGame = () => {
        setIsTimerRunning(false);
        setHasStartedTimer(false);
        setTimeLeft(0);
        setTimeElapsed(0);
        setGameState('setup');
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (gameState === 'setup') {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 pb-12 animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
                <div className="text-center mb-10 w-full">
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-2 tracking-tight uppercase">
                        Kortleken
                    </h1>
                    <div className="h-1.5 w-24 bg-primary mx-auto rounded-full mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Inställningar
                    </p>
                </div>

                <div className="max-w-3xl mx-auto w-full space-y-8 bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-800">
                    
                    {/* Difficulty */}
                    <div>
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

                    {/* Goal Type */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">Mål</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={() => setGoalType('deck')}
                                className={`py-4 rounded-xl font-bold uppercase tracking-wider transition-all border-2 ${
                                    goalType === 'deck' 
                                        ? 'border-primary bg-primary/10 text-primary' 
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'
                                }`}
                            >
                                Hela leken
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
                                onClick={() => setGoalType('rounds')}
                                className={`py-4 rounded-xl font-bold uppercase tracking-wider transition-all border-2 ${
                                    goalType === 'rounds' 
                                        ? 'border-primary bg-primary/10 text-primary' 
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary/50'
                                }`}
                            >
                                Antal kort
                            </button>
                        </div>
                    </div>

                    {/* Goal Value Input */}
                    {goalType !== 'deck' && (
                        <div className="animate-fade-in">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">
                                {goalType === 'time' ? 'Tid (minuter)' : 'Antal kort'}
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
                        className="w-full py-5 bg-primary text-white rounded-xl font-black text-xl uppercase tracking-widest shadow-lg hover:bg-primary/90 transition-all active:scale-95 mt-8"
                    >
                        Starta Spelet
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-50 dark:bg-black z-50 flex flex-col overflow-hidden animate-fade-in">
            {/* TOP SECTION (Timer Box) */}
            <div 
                className={`relative w-full rounded-b-[2rem] sm:rounded-b-[3rem] shadow-xl overflow-hidden transition-colors duration-500 flex flex-col items-center justify-center pt-12 pb-8 bg-orange-600 ${!isGoalReached && goalType === 'time' ? 'cursor-pointer' : ''}`} 
                onClick={() => { if (!isGoalReached && goalType === 'time') setIsTimerRunning(!isTimerRunning); }}
            >
                {/* Top left label */}
                <div className="absolute top-4 left-4 sm:top-6 sm:left-6 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 shadow-sm z-20">
                    <span className="font-bold tracking-widest text-white/90 uppercase drop-shadow-sm text-[10px] sm:text-xs">TRÄNINGSLEK</span>
                </div>
                
                {/* Top right label */}
                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 shadow-sm z-20">
                    <span className="font-bold tracking-widest text-white/90 uppercase drop-shadow-sm text-[10px] sm:text-xs">
                        KORT {drawnCards.length}{goalType !== 'time' ? `/${goalType === 'deck' ? 52 : goalValue}` : ''}
                    </span>
                </div>

                {/* Status Label */}
                <div className="text-center z-20 w-full px-10 mb-1 mt-4">
                    <h2 className={`font-black text-white tracking-widest uppercase drop-shadow-xl w-full text-center text-2xl sm:text-3xl lg:text-4xl ${!isTimerRunning && hasStartedTimer && !isGoalReached && goalType === 'time' ? 'animate-pulse' : ''}`}>
                        {isGoalReached ? 'KLAR' : (!isTimerRunning && hasStartedTimer && goalType === 'time' ? 'PAUSAD' : 'KORTLEKEN')}
                    </h2>
                </div>

                {/* Timer */}
                {goalType === 'time' && (
                    <div className={`z-20 relative flex flex-col items-center w-full text-white transition-opacity duration-300 ${!isTimerRunning && hasStartedTimer && !isGoalReached ? 'opacity-50' : 'opacity-100'}`}>
                        <span className="font-mono font-black leading-none tracking-tighter tabular-nums drop-shadow-2xl select-none text-[6rem] sm:text-[8rem] md:text-[10rem]">
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                )}

                {/* Bottom text */}
                <div className="text-center z-20 w-full px-10 mt-2 mb-2">
                    <h1 className={`font-black text-white/90 uppercase tracking-tighter drop-shadow-lg ${goalType === 'time' ? 'text-xl sm:text-2xl md:text-3xl' : 'text-4xl sm:text-5xl md:text-6xl mt-4'}`}>
                        {deck.length} KORT KVAR
                    </h1>
                </div>
                
                {/* Close button */}
                <button 
                    onClick={(e) => { e.stopPropagation(); resetGame(); }}
                    className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 px-4 py-2 bg-black/20 hover:bg-black/30 text-white rounded-xl backdrop-blur-md border border-white/10 font-bold text-sm transition-colors z-30"
                >
                    Avsluta
                </button>
            </div>

            {/* BOTTOM SECTION (Game Area) */}
            <div className="flex-1 w-full bg-gray-50 dark:bg-black flex flex-col items-center justify-start p-4 sm:p-8 overflow-y-auto relative z-0">
                <div className="w-full max-w-5xl mx-auto flex flex-col items-center h-full">
                    
                    {/* Deck and Card Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 w-full justify-items-center items-center mt-4">
                        
                        {/* Deck / Draw Button */}
                        <div className="flex flex-col items-center w-full">
                            <button 
                                onClick={() => {
                                    if (isGoalReached) {
                                        handleFinishGame();
                                    } else {
                                        drawCard();
                                        if (!hasStartedTimer) {
                                            setIsTimerRunning(true);
                                            setHasStartedTimer(true);
                                        }
                                    }
                                }}
                                disabled={!isGoalReached && (deck.length === 0 || isFlipping)}
                                className={`relative w-48 h-72 sm:w-64 sm:h-96 rounded-2xl sm:rounded-3xl shadow-2xl border-4 border-white dark:border-gray-800 transition-transform ${(!isGoalReached && deck.length === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-2 active:scale-95 cursor-pointer'}`}
                                style={{
                                    background: isGoalReached ? '#10b981' : 'repeating-linear-gradient(45deg, #ef4444, #ef4444 15px, #b91c1c 15px, #b91c1c 30px)'
                                }}
                            >
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl sm:rounded-2xl">
                                    <span className="text-white font-black text-2xl sm:text-3xl uppercase tracking-widest drop-shadow-md text-center px-4">
                                        {isGoalReached ? 'Klar!' : 'Dra Kort'}
                                    </span>
                                </div>
                            </button>
                        </div>

                        {/* Current Card Display */}
                        <div className="flex flex-col items-center w-full">
                            <AnimatePresence mode="wait">
                                {currentCard ? (
                                    <motion.div
                                        key={`${currentCard.suit}-${currentCard.value}`}
                                        initial={{ rotateY: 90, scale: 0.8, opacity: 0 }}
                                        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                                        exit={{ rotateY: -90, scale: 0.8, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="w-48 h-72 sm:w-64 sm:h-96 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden"
                                    >
                                        <div className={`text-4xl sm:text-5xl font-black ${getSuitColor(currentCard.suit)}`}>
                                            {currentCard.value}
                                            <div className="text-2xl sm:text-3xl mt-1">{getSuitSymbol(currentCard.suit)}</div>
                                        </div>
                                        
                                        <div className={`absolute inset-0 flex items-center justify-center text-[6rem] sm:text-[8rem] ${getSuitColor(currentCard.suit)}`}>
                                            {getSuitSymbol(currentCard.suit)}
                                        </div>
                                        
                                        <div className={`text-4xl sm:text-5xl font-black self-end rotate-180 ${getSuitColor(currentCard.suit)}`}>
                                            {currentCard.value}
                                            <div className="text-2xl sm:text-3xl mt-1">{getSuitSymbol(currentCard.suit)}</div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="w-48 h-72 sm:w-64 sm:h-96 border-4 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl sm:rounded-3xl flex items-center justify-center">
                                        <span className="text-gray-400 dark:text-gray-600 font-bold text-xl sm:text-2xl uppercase tracking-widest text-center px-4">
                                            Inget kort
                                        </span>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Exercise Instruction */}
                    <div className="mt-8 flex items-center justify-center w-full min-h-[8rem]">
                        <AnimatePresence mode="wait">
                            {currentCard && (
                                <motion.div 
                                    key={`instruction-${currentCard.suit}-${currentCard.value}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="text-center w-full"
                                >
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-5xl sm:text-7xl font-black text-gray-900 dark:text-white uppercase tracking-tighter drop-shadow-sm leading-none">
                                            {currentCard.numericValue}
                                        </span>
                                        <span className="text-2xl sm:text-4xl font-black text-orange-600 uppercase tracking-tight mt-2 text-center break-words max-w-full px-4">
                                            {getExerciseForSuit(currentCard.suit)}
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Legend / Settings (Bottom) */}
                    <div className="w-full max-w-4xl mx-auto mt-auto pt-8 pb-4 border-t border-gray-200 dark:border-gray-800 z-10">
                        <div className="flex flex-wrap justify-center gap-6 md:gap-12">
                            {SUITS.map(suit => (
                                <div key={suit} className="flex items-center gap-3">
                                    <span className={`text-3xl ${getSuitColor(suit)}`}>{getSuitSymbol(suit)}</span>
                                    <span className="text-xl font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                                        = {getExerciseForSuit(suit)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {gameState === 'finished' && (
                <WorkoutCompleteModal
                    isOpen={true}
                    onClose={resetGame}
                    workout={{ id: 'game', title: 'Kortleken' } as any}
                    isFinalBlock={true}
                />
            )}
        </div>
    );
};
