
import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useState, useRef } from 'react';
import { useStudio } from '../context/StudioContext';
import { getAudioContext } from '../hooks/useWorkoutTimer';
import { listenForStudioEvents } from '../services/firebaseService';
import { StudioEvent } from '../types';
import { Confetti } from './WorkoutCompleteModal';

const DISPLAY_DURATION = 8000; 
// VIKTIGT: Vi sänker TTL drastiskt. Om eventet är äldre än 60 sekunder när vi tar emot det
// (t.ex. vid omladdning av sidan), så visar vi det inte. Det är "old news".
const EVENT_TTL = 60 * 1000; 

const playBellSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const frequencies = [350, 710, 1100, 1550, 2100];
    const duration = 4.0;

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i < 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        const initialGainValue = i === 0 ? 0.4 : 0.12; 
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(initialGainValue, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    });
};

export const PBOverlay: React.FC = () => {
    const { selectedOrganization } = useStudio();
    
    // State för den som visas just nu
    const [currentEvent, setCurrentEvent] = useState<StudioEvent | null>(null);
    
    // Kö-system (Ref för att undvika onödiga om-renderingar vid snabba inkommande events)
    const queueRef = useRef<StudioEvent[]>([]);
    // Trigger för att tvinga React att processa kön
    const [processTrigger, setProcessTrigger] = useState(0);
    
    // För att förhindra dubbletter
    const processedIds = useRef<Set<string>>(new Set());
    
    // För att låsa kön medan en animation pågår
    const isLocked = useRef(false);

    // 1. LYSSNA PÅ DATABASEN
    useEffect(() => {
        if (!selectedOrganization) return;

        const unsubscribe = listenForStudioEvents(selectedOrganization.id, (event) => {
            // Filtrera bort gamla events (t.ex. vid omladdning)
            if (Date.now() - event.timestamp > EVENT_TTL) {
                return;
            }

            // Filtrera bort dubbletter
            if (processedIds.current.has(event.id)) {
                return;
            }

            // Lägg till i loggboken och kön
            processedIds.current.add(event.id);
            
            if (event.type === 'pb' || event.type === 'pb_batch') {
                queueRef.current.push(event);
                // Trigga processorn
                setProcessTrigger(prev => prev + 1);
            }
        });

        return () => unsubscribe();
    }, [selectedOrganization]);

    // 2. PROCESSA KÖN
    useEffect(() => {
        const processQueue = () => {
            // Om vi redan visar något eller kön är tom, gör inget
            if (isLocked.current || queueRef.current.length === 0) {
                return;
            }

            // Lås processorn
            isLocked.current = true;

            // Hämta nästa event (FIFO)
            const nextEvent = queueRef.current.shift();
            
            if (nextEvent) {
                setCurrentEvent(nextEvent);
                playBellSound();

                // Vänta visningstiden + lite extra för exit-animation
                setTimeout(() => {
                    setCurrentEvent(null);
                    
                    // Vänta på att exit-animationen ska bli klar innan vi låser upp för nästa
                    setTimeout(() => {
                        isLocked.current = false;
                        // Trigga en ny koll om det finns fler i kön
                        if (queueRef.current.length > 0) {
                            setProcessTrigger(prev => prev + 1);
                        }
                    }, 600); // 0.6s exit animation buffer
                    
                }, DISPLAY_DURATION);
            } else {
                isLocked.current = false;
            }
        };

        processQueue();
    }, [processTrigger]); // Körs när vi får signal om nytt event eller när ett event är klart

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
                {currentEvent && (
                    <>
                        <Confetti />
                        <motion.div
                            key={currentEvent.id} // Viktigt: Unikt key tvingar React att rendera om helt
                            initial={{ opacity: 0, y: 100, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -50, scale: 0.9 }}
                            transition={{ duration: 0.5, ease: "backOut" }}
                            className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-2 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] w-full max-w-xl"
                        >
                            <div className="bg-white dark:bg-gray-900 rounded-[3.2rem] p-8 flex flex-col items-center border border-white/20 relative overflow-hidden min-h-[500px]">
                                
                                <div className="absolute inset-0 bg-yellow-500/5 animate-pulse rounded-[3rem]"></div>
                                
                                <div className="text-6xl sm:text-7xl mb-6 relative z-10 animate-bounce">🔔</div>
                                
                                <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 relative z-10 leading-none text-center">
                                    {currentEvent.data.records && currentEvent.data.records.length > 1 ? 'PBREGN! 🌧️' : 'NYTT PB! 🏆'}
                                </h2>
                                
                                <div className="relative z-10 mb-8 flex flex-col items-center shrink-0">
                                    <div className="w-24 h-24 rounded-[2rem] bg-gray-100 dark:bg-gray-800 overflow-hidden mb-4 border-4 border-yellow-400 shadow-xl">
                                        {currentEvent.data.userPhotoUrl ? (
                                            <img src={currentEvent.data.userPhotoUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-300 uppercase">
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

                                <div className="absolute bottom-0 left-0 right-0 h-3 bg-gray-100 dark:bg-white/5">
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
