
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listenForStudioEvents } from '../services/firebaseService';
import { StudioEvent } from '../types';
import { useStudio } from '../context/StudioContext';
import { getAudioContext } from '../hooks/useWorkoutTimer';

// Simple sound synthesis for a "Bell" like sound
const playBellSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Bell-like: High frequency sine wave with long decay
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.5);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2.5);
    
    // Add a second harmonic for richness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, ctx.currentTime); // A6
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 1.5);
};

export const PBOverlay: React.FC = () => {
    const { selectedOrganization } = useStudio();
    const [currentEvent, setCurrentEvent] = useState<StudioEvent | null>(null);
    const [queue, setQueue] = useState<StudioEvent[]>([]);

    useEffect(() => {
        if (!selectedOrganization) return;

        // Listen for new PB events
        const unsubscribe = listenForStudioEvents(selectedOrganization.id, (event) => {
            if (event.type === 'pb') {
                setQueue(prev => [...prev, event]);
            }
        });

        return () => unsubscribe();
    }, [selectedOrganization]);

    useEffect(() => {
        // Process queue
        if (!currentEvent && queue.length > 0) {
            const nextEvent = queue[0];
            
            // Only process events that are reasonably new (handled in service, but double check doesn't hurt)
            // and avoid duplicates if logic runs twice
            setCurrentEvent(nextEvent);
            setQueue(prev => prev.slice(1));
            
            // Play Sound
            playBellSound();

            // Auto-dismiss after 6 seconds
            const timer = setTimeout(() => {
                setCurrentEvent(null);
            }, 6000);

            return () => clearTimeout(timer);
        }
    }, [currentEvent, queue]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex flex-col items-center justify-center">
            <AnimatePresence>
                {currentEvent && (
                    <motion.div
                        key={currentEvent.id}
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.2, opacity: 0, y: -50 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 p-1 rounded-[2.5rem] shadow-2xl overflow-hidden"
                    >
                        <div className="bg-black/90 backdrop-blur-md rounded-[2.3rem] px-12 py-10 text-center flex flex-col items-center border border-white/10 relative overflow-hidden">
                            {/* Confetti / Glow effects */}
                            <div className="absolute inset-0 bg-yellow-500/20 animate-pulse rounded-[2.3rem]"></div>
                            
                            <motion.div 
                                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="text-7xl mb-6 relative z-10"
                            >
                                🔔
                            </motion.div>
                            
                            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-2 relative z-10 drop-shadow-lg">
                                Nytt Rekord!
                            </h2>
                            
                            <div className="w-20 h-1.5 bg-yellow-500 rounded-full my-4 relative z-10"></div>
                            
                            <p className="text-2xl md:text-3xl text-gray-200 font-medium relative z-10">
                                <span className="font-black text-yellow-400">{currentEvent.data.userName}</span> satte nytt PB i
                            </p>
                            
                            <p className="text-3xl md:text-4xl font-black text-white mt-2 uppercase tracking-wide relative z-10">
                                {currentEvent.data.exerciseName}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
