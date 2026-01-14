
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listenForStudioEvents } from '../services/firebaseService';
import { StudioEvent } from '../types';
import { useStudio } from '../context/StudioContext';
import { getAudioContext } from '../hooks/useWorkoutTimer';

const DISPLAY_DURATION = 5000; // 5 sekunder

const playBellSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.5);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2.5);
};

export const PBOverlay: React.FC = () => {
    const { selectedOrganization } = useStudio();
    const [currentEvent, setCurrentEvent] = useState<StudioEvent | null>(null);
    const [queue, setQueue] = useState<StudioEvent[]>([]);

    useEffect(() => {
        if (!selectedOrganization) return;

        const unsubscribe = listenForStudioEvents(selectedOrganization.id, (event) => {
            if (event.type === 'pb') {
                setQueue(prev => [...prev, event]);
            }
        });

        return () => unsubscribe();
    }, [selectedOrganization]);

    useEffect(() => {
        if (!currentEvent && queue.length > 0) {
            const next = queue[0];
            setQueue(prev => prev.slice(1));
            setCurrentEvent(next);
            playBellSound();
        }
    }, [queue, currentEvent]);

    useEffect(() => {
        if (currentEvent) {
            const timer = setTimeout(() => {
                setCurrentEvent(null);
            }, DISPLAY_DURATION);

            return () => clearTimeout(timer);
        }
    }, [currentEvent]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
                {currentEvent && (
                    <motion.div
                        key={currentEvent.id}
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.1, opacity: 0, y: -20 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 p-1 rounded-[2.5rem] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden"
                    >
                        <div className="bg-white/95 dark:bg-black/90 backdrop-blur-md rounded-[2.3rem] px-12 py-10 text-center flex flex-col items-center border border-white/20 dark:border-white/10 relative overflow-hidden">
                            {/* Subtil pulserande glöd */}
                            <div className="absolute inset-0 bg-yellow-500/5 dark:bg-yellow-500/10 animate-pulse rounded-[2.3rem]"></div>
                            
                            <motion.div 
                                animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="text-7xl mb-6 relative z-10"
                            >
                                🔔
                            </motion.div>
                            
                            <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2 relative z-10">
                                Nytt Rekord!
                            </h2>
                            
                            <div className="w-20 h-1.5 bg-yellow-500 rounded-full my-4 relative z-10 shadow-sm"></div>
                            
                            <p className="text-2xl md:text-3xl text-gray-600 dark:text-gray-200 font-medium relative z-10 leading-tight">
                                <span className="font-black text-yellow-600 dark:text-yellow-400">{currentEvent.data.userName}</span> satte nytt PB i
                            </p>
                            
                            <p className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mt-2 uppercase tracking-wide relative z-10">
                                {currentEvent.data.exerciseName}
                            </p>

                            {/* Visuell Progress Bar (Timer) */}
                            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-100 dark:bg-white/10 overflow-hidden">
                                <motion.div 
                                    initial={{ width: "100%" }}
                                    animate={{ width: "0%" }}
                                    transition={{ duration: DISPLAY_DURATION / 1000, ease: "linear" }}
                                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
