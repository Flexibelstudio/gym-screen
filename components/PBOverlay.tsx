import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listenForStudioEvents } from '../services/firebaseService';
import { StudioEvent } from '../types';
import { useStudio } from '../context/StudioContext';
import { getAudioContext } from '../hooks/useWorkoutTimer';

const DISPLAY_DURATION = 8000; 

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
            if (event.type === 'pb' || event.type === 'pb_batch') {
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
        <div className="fixed inset-0 pointer-events-none z-[9999] flex flex-col items-center justify-center p-6 sm:p-12">
            <AnimatePresence mode="wait">
                {currentEvent && (
                    <motion.div
                        key={currentEvent.id}
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.1, opacity: 0, y: -20 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 p-1.5 rounded-[3.5rem] shadow-[0_40px_120px_-15px_rgba(0,0,0,0.5)] overflow-hidden w-[90vw] max-w-2xl"
                    >
                        <div className="bg-white/95 dark:bg-black/90 backdrop-blur-xl rounded-[3.3rem] px-6 py-10 sm:px-10 sm:py-12 text-center flex flex-col items-center border border-white/20 dark:border-white/10 relative overflow-hidden">
                            <div className="absolute inset-0 bg-yellow-500/5 dark:bg-yellow-500/10 animate-pulse rounded-[3rem]"></div>
                            
                            <motion.div 
                                animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="text-7xl sm:text-8xl mb-4 sm:mb-6 relative z-10"
                            >
                                🔔
                            </motion.div>
                            
                            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 sm:mb-6 relative z-10 leading-none drop-shadow-sm">
                                {currentEvent.data.records && currentEvent.data.records.length > 1 ? 'REKORDREGN! 🌧️' : 'NYTT REKORD! 🏆'}
                            </h2>
                            
                            <div className="relative z-10 mb-6 sm:mb-8 flex flex-col items-center">
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] sm:rounded-[2.5rem] bg-gray-100 dark:bg-gray-800 overflow-hidden mb-3 sm:mb-4 border-4 border-yellow-400 shadow-xl">
                                    {currentEvent.data.userPhotoUrl ? (
                                        <img src={currentEvent.data.userPhotoUrl} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-400">
                                            {currentEvent.data.userName[0]}
                                        </div>
                                    )}
                                </div>
                                <p className="text-2xl sm:text-3xl md:text-4xl text-gray-600 dark:text-gray-200 font-medium leading-tight">
                                    Grymt jobbat <span className="font-black text-yellow-600 dark:text-yellow-400">{currentEvent.data.userName}</span>!
                                </p>
                            </div>

                            {/* Rekordlista - Loopar ALLA rekord i data.records */}
                            <div className="w-full space-y-3 sm:space-y-4 relative z-10 max-h-[40vh] overflow-y-auto px-2 custom-scrollbar pb-4">
                                {currentEvent.data.records?.map((record, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, x: -50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 + (i * 0.2) }}
                                        className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-[2rem] p-4 sm:p-5 flex justify-between items-center group shadow-md"
                                    >
                                        <div className="text-left min-w-0 flex-grow">
                                            <p className="text-gray-400 dark:text-gray-500 font-black uppercase text-[10px] tracking-widest mb-0.5">Övning</p>
                                            <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white group-hover:text-yellow-500 transition-colors tracking-tight truncate">
                                                {record.exerciseName}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0 ml-4">
                                            <p className="text-gray-400 dark:text-gray-500 font-black uppercase text-[10px] tracking-widest mb-0.5">Nytt PB</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl sm:text-4xl font-black text-primary">{record.weight}</span>
                                                <span className="text-xs font-bold text-gray-500">kg</span>
                                                {record.diff > 0 && (
                                                    <span className="ml-1 sm:ml-2 text-[10px] font-black text-green-500 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                                                        +{record.diff}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 h-2.5 bg-gray-100 dark:bg-white/10 overflow-hidden">
                                <motion.div 
                                    initial={{ width: "100%" }}
                                    animate={{ width: "0%" }}
                                    transition={{ duration: DISPLAY_DURATION / 1000, ease: "linear" }}
                                    className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};