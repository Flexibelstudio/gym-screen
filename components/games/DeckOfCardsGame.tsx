import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStudio } from '../../context/StudioContext';
import { playTimerSound } from '../../hooks/useWorkoutTimer';

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
    return suit === 'hearts' || suit === 'diamonds' ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white';
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
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [hasStartedTimer, setHasStartedTimer] = useState(false);

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
        setHasStartedTimer(false);
        setIsTimerRunning(false);
        
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

    const isGoalReached = 
        (goalType === 'deck' && deck.length === 0) ||
        (goalType === 'rounds' && drawnCards.length >= goalValue) ||
        (goalType === 'time' && timeLeft === 0 && hasStartedTimer);

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
        setGameState('setup');
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (gameState === 'setup') {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 p-6 sm:p-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                            Kortleken - Inställningar
                        </h2>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Tillbaka
                    </button>
                </div>

                <div className="max-w-3xl mx-auto w-full space-y-8 bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-800">
                    
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

    if (gameState === 'finished') {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 p-6 sm:p-10 items-center justify-center">
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-gray-800 text-center max-w-2xl w-full"
                >
                    <div className="text-8xl mb-6">🎉</div>
                    <h2 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white tracking-tight uppercase mb-4">
                        Bra jobbat!
                    </h2>
                    <p className="text-2xl text-gray-500 dark:text-gray-400 mb-12 font-medium">
                        Du klarade {drawnCards.length} kort.
                    </p>
                    
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={resetGame}
                            className="px-8 py-5 bg-primary text-white rounded-xl shadow-lg font-bold text-xl uppercase tracking-wider hover:bg-primary/90 transition-colors"
                        >
                            Spela igen
                        </button>
                        <button
                            onClick={onBack}
                            className="px-8 py-5 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-sm font-bold text-xl uppercase tracking-wider hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                        >
                            Avsluta
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 p-6 sm:p-10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 z-10">
                <div>
                    <h2 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                        Kortleken
                    </h2>
                    <div className="flex items-center gap-4 mt-2">
                        <p className="text-xl text-gray-500 dark:text-gray-400 font-medium">
                            {deck.length} kort kvar
                        </p>
                        {goalType === 'rounds' && (
                            <div className="px-4 py-1.5 bg-primary/10 text-primary rounded-lg font-bold text-xl">
                                {drawnCards.length} / {goalValue}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={resetGame}
                        className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg"
                    >
                        Börja om
                    </button>
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-primary text-white rounded-xl shadow-sm font-bold hover:bg-primary/90 transition-colors text-lg"
                    >
                        Tillbaka
                    </button>
                </div>
            </div>

            {goalType === 'time' && (
                <div className="flex flex-col items-center justify-center mb-4 z-10">
                    <div className="text-8xl md:text-[10rem] font-black font-mono text-gray-900 dark:text-white tracking-tighter drop-shadow-sm leading-none">
                        {formatTime(timeLeft)}
                    </div>
                    <div className="flex gap-4 mt-6">
                        {!hasStartedTimer || !isTimerRunning ? (
                            <button 
                                onClick={() => {
                                    setIsTimerRunning(true);
                                    setHasStartedTimer(true);
                                }}
                                className="px-12 py-4 bg-green-500 hover:bg-green-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-lg transition-transform active:scale-95"
                            >
                                {hasStartedTimer ? 'Fortsätt' : 'Starta Timer'}
                            </button>
                        ) : (
                            <button 
                                onClick={() => setIsTimerRunning(false)}
                                className="px-12 py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-lg transition-transform active:scale-95"
                            >
                                Pausa
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-grow flex flex-col items-center justify-center z-10 mt-4">
                <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 w-full max-w-6xl">
                    
                    {/* Deck / Draw Button */}
                    <div className="flex flex-col items-center">
                        {isGoalReached ? (
                            <button 
                                onClick={handleFinishGame}
                                className="relative w-72 h-[28rem] rounded-3xl shadow-2xl border-4 border-green-500 bg-green-500 hover:bg-green-600 transition-transform hover:-translate-y-2 active:scale-95 cursor-pointer flex items-center justify-center"
                            >
                                <span className="text-white font-black text-5xl uppercase tracking-widest drop-shadow-md">
                                    Klar!
                                </span>
                            </button>
                        ) : (
                            <button 
                                onClick={drawCard}
                                disabled={deck.length === 0 || isFlipping || (goalType === 'time' && (!hasStartedTimer || !isTimerRunning))}
                                className={`relative w-72 h-[28rem] rounded-3xl shadow-2xl border-4 border-white dark:border-gray-800 transition-transform ${deck.length === 0 || (goalType === 'time' && (!hasStartedTimer || !isTimerRunning)) ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-2 active:scale-95 cursor-pointer'}`}
                                style={{
                                    background: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 15px, #b91c1c 15px, #b91c1c 30px)'
                                }}
                            >
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                                    <span className="text-white font-black text-4xl uppercase tracking-widest drop-shadow-md text-center px-4">
                                        {goalType === 'time' && (!hasStartedTimer || !isTimerRunning) ? 'Starta timer' : 'Dra Kort'}
                                    </span>
                                </div>
                            </button>
                        )}
                    </div>

                    {/* Current Card Display */}
                    <div className="flex flex-col items-center min-w-[350px]">
                        <AnimatePresence mode="wait">
                            {currentCard ? (
                                <motion.div
                                    key={`${currentCard.suit}-${currentCard.value}`}
                                    initial={{ rotateY: 90, scale: 0.8, opacity: 0 }}
                                    animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                                    exit={{ rotateY: -90, scale: 0.8, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="w-72 h-[28rem] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between p-8 relative overflow-hidden"
                                >
                                    <div className={`text-6xl font-black ${getSuitColor(currentCard.suit)}`}>
                                        {currentCard.value}
                                        <div className="text-4xl mt-2">{getSuitSymbol(currentCard.suit)}</div>
                                    </div>
                                    
                                    <div className={`absolute inset-0 flex items-center justify-center text-[10rem] opacity-10 ${getSuitColor(currentCard.suit)}`}>
                                        {getSuitSymbol(currentCard.suit)}
                                    </div>
                                    
                                    <div className={`text-6xl font-black self-end rotate-180 ${getSuitColor(currentCard.suit)}`}>
                                        {currentCard.value}
                                        <div className="text-4xl mt-2">{getSuitSymbol(currentCard.suit)}</div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="w-72 h-[28rem] border-4 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl flex items-center justify-center">
                                    <span className="text-gray-400 dark:text-gray-600 font-bold text-2xl uppercase tracking-widest text-center px-4">
                                        Inget kort draget
                                    </span>
                                </div>
                            )}
                        </AnimatePresence>
                        
                        {/* Exercise Instruction */}
                        <div className="h-32 mt-8 flex items-center justify-center">
                            <AnimatePresence mode="wait">
                                {currentCard && (
                                    <motion.div 
                                        key={`instruction-${currentCard.suit}-${currentCard.value}`}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="text-center"
                                    >
                                        <div className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white uppercase tracking-tighter drop-shadow-sm">
                                            {currentCard.numericValue} <span className="text-primary">{getExerciseForSuit(currentCard.suit)}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Legend / Settings (Bottom) */}
            <div className="mt-auto pt-8 border-t border-gray-200 dark:border-gray-800 z-10">
                <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                    {SUITS.map(suit => (
                        <div key={suit} className="flex items-center gap-4">
                            <span className={`text-4xl ${getSuitColor(suit)}`}>{getSuitSymbol(suit)}</span>
                            <span className="text-2xl font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                                = {getExerciseForSuit(suit)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
