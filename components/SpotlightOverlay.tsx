
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listenForCheckIns } from '../services/firebaseService';
import { CheckInEvent } from '../types';
import { useStudio } from '../context/StudioContext';
import { FireIcon } from './icons';

export const SpotlightOverlay: React.FC = () => {
    const { selectedOrganization } = useStudio();
    const [currentCheckIn, setCurrentCheckIn] = useState<CheckInEvent | null>(null);
    const [queue, setQueue] = useState<CheckInEvent[]>([]);

    useEffect(() => {
        if (!selectedOrganization) return;

        // Listen for new check-ins
        const unsubscribe = listenForCheckIns(selectedOrganization.id, (event) => {
            setQueue(prev => [...prev, event]);
        });

        return () => unsubscribe();
    }, [selectedOrganization]);

    useEffect(() => {
        // Process queue
        if (!currentCheckIn && queue.length > 0) {
            const nextEvent = queue[0];
            setCurrentCheckIn(nextEvent);
            setQueue(prev => prev.slice(1));

            // Auto-dismiss after 5 seconds
            const timer = setTimeout(() => {
                setCurrentCheckIn(null);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [currentCheckIn, queue]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[9000] flex flex-col justify-end items-end p-8">
            <AnimatePresence>
                {currentCheckIn && (
                    <motion.div
                        key={currentCheckIn.id}
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl border-l-8 border-primary overflow-hidden flex items-center p-4 max-w-sm w-full"
                    >
                        <div className="flex-shrink-0 mr-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-teal-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                {currentCheckIn.firstName[0].toUpperCase()}
                            </div>
                        </div>
                        <div className="flex-grow min-w-0">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                                Välkommen in!
                            </p>
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white truncate">
                                {currentCheckIn.firstName}
                            </h3>
                            {currentCheckIn.streak && currentCheckIn.streak > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                    <FireIcon className="w-4 h-4 text-orange-500 animate-pulse" />
                                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                                        {currentCheckIn.streak} dagars streak!
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
