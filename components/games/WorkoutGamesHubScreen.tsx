import React, { useState } from 'react';
import { Page } from '../../types';
import { motion } from 'framer-motion';
import { SparklesIcon, DumbbellIcon } from '../icons';
import { DeckOfCardsGame } from './DeckOfCardsGame';

interface WorkoutGamesHubScreenProps {
    onBack: () => void;
}

export const WorkoutGamesHubScreen: React.FC<WorkoutGamesHubScreenProps> = ({ onBack }) => {
    const [activeGame, setActiveGame] = useState<'hub' | 'deckOfCards'>('hub');

    if (activeGame === 'deckOfCards') {
        return <DeckOfCardsGame onBack={() => setActiveGame('hub')} />;
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 p-6 sm:p-10">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                        Träningslekar
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Smart Play - Gör träningen till en lek
                    </p>
                </div>
                <button
                    onClick={onBack}
                    className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    Tillbaka
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Deck of Cards Game Card */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveGame('deckOfCards')}
                    className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-gray-800 text-left flex flex-col h-full relative overflow-hidden group"
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

                {/* Coming Soon: Roulette */}
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-[2rem] p-8 border border-gray-200 dark:border-gray-700 text-left flex flex-col h-full relative overflow-hidden opacity-70">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <span className="text-3xl">🎡</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-tight">
                        Svett-hjulet
                    </h3>
                    <p className="text-gray-400 dark:text-gray-500 mb-6 flex-grow">
                        Snurra hjulet för att få din nästa utmaning. Kommer snart!
                    </p>
                    <div className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-xs font-bold uppercase tracking-wider w-fit">
                        Kommer snart
                    </div>
                </div>

                {/* Coming Soon: Dice */}
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-[2rem] p-8 border border-gray-200 dark:border-gray-700 text-left flex flex-col h-full relative overflow-hidden opacity-70">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <span className="text-3xl">🎲</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-tight">
                        Tärningarna
                    </h3>
                    <p className="text-gray-400 dark:text-gray-500 mb-6 flex-grow">
                        Slå tärningarna för övning och repetitioner. Kommer snart!
                    </p>
                    <div className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-xs font-bold uppercase tracking-wider w-fit">
                        Kommer snart
                    </div>
                </div>
            </div>
        </div>
    );
};
