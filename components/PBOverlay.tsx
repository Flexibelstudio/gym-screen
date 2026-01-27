import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { getAudioContext } from '../hooks/useWorkoutTimer';
import { listenForStudioEvents } from '../services/firebaseService';
import { StudioEvent } from '../types';
import { Confetti } from './WorkoutCompleteModal';

const DISPLAY_DURATION = 8000; 

const playBellSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    // Bell frequencies (inharmonic overtones create the metallic feel)
    // A mix of fundamental and multiple harmonics for a rich, gym-bell sound
    const frequencies = [350, 710, 1100, 1550, 2100];
    const duration = 4.0;

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // Lower frequencies use Sine for body, higher use Triangle for metallic bite
        osc.type = i < 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        
        // Initial hit volume - give the fundamental (lowest) more weight for "thump"
        const initialGainValue = i === 0 ? 0.4 : 0.12; 
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(initialGainValue, now + 0.01);
        
        // Exponential decay for that long, natural bell ring
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + duration);
    });
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
        <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
                {currentEvent && (
                    <>
                        <Confetti />
                        <motion.div
                            key={currentEvent.id}
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -50 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-2 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] w-full max-w-xl"
                        >
                            <div className="bg-white dark:bg-gray-900 rounded-[3.2rem] p-8 flex flex-col items-center border border-white/20 relative overflow-hidden min-h-[500px]">
                                
                                <div className="absolute inset-0 bg-yellow-500/5 animate-pulse rounded-[3rem]"></div>
                                
                                <div className="text-6xl sm:text-7xl mb-6 relative z-10">🔔</div>
                                
                                <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 relative z-10 leading-none text-center">
                                    {currentEvent.data.records && currentEvent.data.records.length > 1 ? 'PBREGN! 🌧️' : 'NYTT PB! 🏆'}
                                </h2>
                                
                                <div className="relative z-10 mb-8 flex flex-col items-center shrink-0">
                                    <div className="w-20 h-20 rounded-[2rem] bg-gray-100 dark:bg-gray-800 overflow-hidden mb-3 border-4 border-yellow-400 shadow-lg">
                                        {currentEvent.data.userPhotoUrl ? (
                                            <img src={currentEvent.data.userPhotoUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-3xl font-black text-gray-300">
                                                {currentEvent.data.userName[0]}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-2xl text-gray-600 dark:text-gray-300 font-medium text-center">
                                        Grymt jobbat <span className="font-black text-yellow-600 dark:text-yellow-400">{currentEvent.data.userName}</span>!
                                    </p>
                                </div>

                                <div className="w-full space-y-3 relative z-10 max-h-[35vh] overflow-y-auto px-2 pb-4 custom-scrollbar">
                                    {currentEvent.data.records?.map((record, i) => (
                                        <motion.div 
                                            key={i}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.4 + (i * 0.15) }}
                                            className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-3xl p-4 flex justify-between items-center shadow-sm"
                                        >
                                            <div className="text-left min-w-0 flex-grow pr-4">
                                                <p className="text-gray-400 dark:text-gray-500 font-black uppercase text-[10px] tracking-widest mb-0.5">Övning</p>
                                                <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                                                    {record.exerciseName}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-gray-400 dark:text-gray-500 font-black uppercase text-[10px] tracking-widest mb-0.5">Vikt</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-black text-primary">{record.weight}</span>
                                                    <span className="text-xs font-bold text-gray-500">kg</span>
                                                    {record.diff > 0 && (
                                                        <span className="ml-2 text-[11px] font-black text-green-600 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                                                            +{record.diff}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-100 dark:bg-white/5">
                                    <motion.div 
                                        initial={{ width: "100%" }}
                                        animate={{ width: "0%" }}
                                        transition={{ duration: DISPLAY_DURATION / 1000, ease: "linear" }}
                                        className="h-full bg-gradient-to-r from-yellow-400 to-red-500"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};