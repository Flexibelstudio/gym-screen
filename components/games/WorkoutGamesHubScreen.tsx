import React, { useState, useEffect } from 'react';
import { Page } from '../../types';
import { motion } from 'framer-motion';
import { SparklesIcon, DumbbellIcon } from '../icons';
import { DeckOfCardsGame } from './DeckOfCardsGame';
import { RouletteGame } from './RouletteGame';
import { DiceGame } from './DiceGame';
import { SlotMachineGame } from './SlotMachineGame';

interface WorkoutGamesHubScreenProps {
    onBack: () => void;
    setCustomBackHandler?: (handler: (() => void) | null) => void;
}

export const WorkoutGamesHubScreen: React.FC<WorkoutGamesHubScreenProps> = ({ onBack, setCustomBackHandler }) => {
    const [activeGame, setActiveGame] = useState<'hub' | 'deckOfCards' | 'roulette' | 'dice' | 'slotMachine'>('hub');

    useEffect(() => {
        if ((activeGame !== 'hub') && setCustomBackHandler) {
            setCustomBackHandler(() => setActiveGame('hub'));
        } else if (setCustomBackHandler) {
            setCustomBackHandler(null);
        }
        return () => {
            if (setCustomBackHandler) setCustomBackHandler(null);
        };
    }, [activeGame, setCustomBackHandler]);

    if (activeGame === 'deckOfCards') {
        return <DeckOfCardsGame onBack={() => setActiveGame('hub')} />;
    }

    if (activeGame === 'roulette') {
        return <RouletteGame onBack={() => setActiveGame('hub')} />;
    }

    if (activeGame === 'dice') {
        return <DiceGame onBack={() => setActiveGame('hub')} />;
    }

    if (activeGame === 'slotMachine') {
        return <SlotMachineGame onBack={() => setActiveGame('hub')} />;
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 animate-fade-in">
            <div className="text-center mb-10">
                <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                    Träningslekar
                </h1>
                <div className="h-1.5 w-24 bg-primary mx-auto rounded-full mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                    Smart Play - Gör träningen till en lek
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Deck of Cards Game Card */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveGame('deckOfCards')}
                    className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 text-left flex flex-col h-full relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-red-500/20"></div>
                    
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <span className="text-3xl">🃏</span>
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                        Kortleken
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 flex-grow">
                        Dra kort och låt slumpen avgöra ditt öde. Varje färg är en övning, valören är antalet repetitioner.
                    </p>
                    
                    <div className="flex items-center text-red-600 dark:text-red-400 font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform">
                        Spela nu <span className="ml-2">→</span>
                    </div>
                </motion.button>

                {/* Roulette Game Card */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveGame('roulette')}
                    className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 text-left flex flex-col h-full relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-blue-500/20"></div>
                    
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <span className="text-3xl">🎡</span>
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                        Svett-hjulet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 flex-grow">
                        Snurra hjulet för att få din nästa utmaning. Välj bland färdiga hjul eller skapa ditt eget.
                    </p>
                    
                    <div className="flex items-center text-blue-600 dark:text-blue-400 font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform">
                        Spela nu <span className="ml-2">→</span>
                    </div>
                </motion.button>

                {/* Dice Game Card */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveGame('dice')}
                    className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 text-left flex flex-col h-full relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-green-500/20"></div>
                    
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <span className="text-3xl">🎲</span>
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                        Tärningarna
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 flex-grow">
                        Slå 3D-tärningarna för att multiplicera fram antalet repetitioner och slumpa övning.
                    </p>
                    
                    <div className="flex items-center text-green-600 dark:text-green-400 font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform">
                        Spela nu <span className="ml-2">→</span>
                    </div>
                </motion.button>

                {/* Slot Machine Game Card */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveGame('slotMachine')}
                    className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 text-left flex flex-col h-full relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-purple-500/20"></div>
                    
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <span className="text-3xl">🎰</span>
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                        Enarmad Bandit
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 flex-grow">
                        Dra i spaken! Tre hjul avgör övning, antal och en extra krydda för utmaningen.
                    </p>
                    
                    <div className="flex items-center text-purple-600 dark:text-purple-400 font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform">
                        Spela nu <span className="ml-2">→</span>
                    </div>
                </motion.button>
            </div>
        </div>
    );
};
