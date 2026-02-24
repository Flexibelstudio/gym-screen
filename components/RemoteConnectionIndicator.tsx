import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LightningIcon } from './icons';

interface RemoteConnectionIndicatorProps {
    onClick: () => void;
    isVisible: boolean;
}

export const RemoteConnectionIndicator: React.FC<RemoteConnectionIndicatorProps> = ({ onClick, isVisible }) => {
    // We also check localStorage directly to be robust against reloads, 
    // but the parent component should ideally control visibility based on state.
    // For now, we trust the parent's `isVisible` prop which should be derived from the same source of truth.

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    initial={{ y: 100, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 100, opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClick}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-gray-900/90 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-2xl border border-gray-700 flex items-center gap-3 group"
                >
                    <div className="relative">
                        <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
                        <span className="relative block w-3 h-3 rounded-full bg-green-500 border-2 border-gray-900"></span>
                    </div>
                    
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">Ansluten till skärm</span>
                        <span className="text-sm font-bold leading-none group-hover:text-primary transition-colors">Öppna fjärrkontroll</span>
                    </div>

                    <div className="bg-gray-800 p-1.5 rounded-full ml-1 group-hover:bg-primary group-hover:text-white transition-colors">
                        <LightningIcon className="w-4 h-4" />
                    </div>
                </motion.button>
            )}
        </AnimatePresence>
    );
};
