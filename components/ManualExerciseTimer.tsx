import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playTimerSound } from '../hooks/useWorkoutTimer';
import { useStudio } from '../context/StudioContext';

interface ManualExerciseTimerProps {
    duration: number;
    onComplete?: () => void;
    className?: string;
}

export const ManualExerciseTimer: React.FC<ManualExerciseTimerProps> = ({ duration, onComplete, className = '' }) => {
    const { studioConfig } = useStudio();
    const [state, setState] = useState<'idle' | 'countdown' | 'running' | 'finished'>('idle');
    const [countdown, setCountdown] = useState(3);
    const [timeLeft, setTimeLeft] = useState(duration);

    // Reset when duration changes
    useEffect(() => {
        setState('idle');
        setCountdown(3);
        setTimeLeft(duration);
    }, [duration]);

    // Countdown logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (state === 'countdown') {
            interval = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        setState('running');
                        playTimerSound(studioConfig?.soundProfile || 'airhorn', 1); // Start sound
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [state, studioConfig?.soundProfile]);

    // Timer logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (state === 'running' && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        setState('finished');
                        playTimerSound(studioConfig?.soundProfile || 'airhorn', 1); // Finish sound
                        if (onComplete) onComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [state, timeLeft, onComplete, studioConfig?.soundProfile]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <AnimatePresence mode="wait">
                {state === 'idle' && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex flex-col items-center"
                    >
                        <div className="text-5xl md:text-6xl font-mono font-black tabular-nums text-white drop-shadow-md mb-4">
                            {formatTime(duration)}
                        </div>
                        <button
                            onClick={() => setState('countdown')}
                            className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full font-black text-xl uppercase tracking-widest shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                        >
                            <span>▶️</span> Starta
                        </button>
                    </motion.div>
                )}

                {state === 'countdown' && (
                    <motion.div
                        key="countdown"
                        initial={{ opacity: 0, scale: 1.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="text-7xl md:text-8xl font-black text-yellow-400 drop-shadow-lg"
                    >
                        {countdown}
                    </motion.div>
                )}

                {state === 'running' && (
                    <motion.div
                        key="running"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-6xl md:text-7xl font-mono font-black tabular-nums text-white drop-shadow-lg"
                    >
                        {formatTime(timeLeft)}
                    </motion.div>
                )}

                {state === 'finished' && (
                    <motion.div
                        key="finished"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-5xl md:text-6xl font-black text-green-400 drop-shadow-lg uppercase tracking-widest animate-pulse"
                    >
                        Klar!
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
