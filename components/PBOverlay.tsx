
import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useState, useRef } from 'react';
import { useStudio } from '../context/StudioContext';
import { getAudioContext } from '../hooks/useWorkoutTimer';
import { listenForStudioEvents } from '../services/firebaseService';
import { StudioEvent, TimerStatus } from '../types';
import { Confetti } from './WorkoutCompleteModal';

const DISPLAY_DURATION = 5000; 
// TTL (Time To Live) för events om man t.ex. tappar nätet och återansluter. 
// Vi visar inte events som är äldre än 10 minuter i en "live"-kö.
const EVENT_TTL = 10 * 60 * 1000; 

const playBellSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Funktion för att generera själva ljudvågorna
    const generateSound = () => {
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

    // Om ljudmotorn sover (vanligt i webbläsare innan interaktion), väck den först
    if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
            generateSound();
        }).catch(err => console.error("Kunde inte starta ljudet:", err));
    } else {
        generateSound();
    }
};

export const PBOverlay: React.FC = () => {
    const { selectedOrganization, selectedStudio } = useStudio();
    
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

    // VIKTIGT: Vi sparar tidpunkten då komponenten laddades.
    // Vi ignorerar alla events som har en tidsstämpel ÄLDRE än denna tidpunkt.
    // Detta förhindrar att senaste eventet visas igen om man laddar om sidan (refresh).
    const mountTime = useRef(Date.now());

    // För att hålla koll på föregående status
    const prevStatusRef = useRef<TimerStatus | undefined>(undefined);

    // State för att hålla koll på om vi har väntat 5 sekunder i Grattis-vyn
    const [isGrattisReady, setIsGrattisReady] = useState(false);

    // Hantera 5 sekunders fördröjning innan PB-regnet börjar
    useEffect(() => {
        const timerStatus = selectedStudio?.remoteState?.status;
        if (timerStatus === TimerStatus.Finished) {
            const timer = setTimeout(() => {
                setIsGrattisReady(true);
            }, 5000);
            return () => clearTimeout(timer);
        } else {
            setIsGrattisReady(false);
        }
    }, [selectedStudio?.remoteState?.status]);

    // 1. LYSSNA PÅ DATABASEN
    useEffect(() => {
        if (!selectedOrganization) return;

        const unsubscribe = listenForStudioEvents(selectedOrganization.id, (event) => {
            const now = Date.now();

            // 1. Historik-spärr: Skedde detta innan vi öppnade sidan? Ignorera.
            // (Vi lägger på 1 sekunds marginal för säkerhets skull)
            if (event.timestamp < (mountTime.current - 1000)) {
                return;
            }

            // 2. TTL-spärr: Är eventet för gammalt (t.ex. vid återanslutning efter lång tid)?
            if (now - event.timestamp > EVENT_TTL) {
                return;
            }

            // 3. Dubblett-spärr
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
            const timerStatus = selectedStudio?.remoteState?.status;
            const isTimerFinished = timerStatus === TimerStatus.Finished;

            // Om vi precis lämnade Grattis-vyn (t.ex. coachen stängde passet) -> Rensa kön och dölj
            if (prevStatusRef.current === TimerStatus.Finished && !isTimerFinished) {
                if (currentEvent) {
                    setCurrentEvent(null);
                    isLocked.current = false;
                }
                queueRef.current = []; // Töm kön
            }
            
            // Uppdatera föregående status
            prevStatusRef.current = timerStatus;

            // Om skärmen INTE är i Grattis-vyn, eller om vi inte väntat 5 sekunder än, gör inget mer (pausa kön)
            if (!isTimerFinished || !isGrattisReady) {
                return;
            }

            // Rensa gamla events från kön (äldre än 10 minuter)
            const now = Date.now();
            queueRef.current = queueRef.current.filter(event => (now - event.timestamp) <= EVENT_TTL);

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
                const timerId = setTimeout(() => {
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
                
                // We don't need to return a cleanup function here because this is inside processQueue,
                // but we need to make sure we don't accidentally run multiple timeouts if processQueue is called again.
                // The isLocked.current = true prevents processQueue from running again while this timeout is active.
            } else {
                isLocked.current = false;
            }
        };

        processQueue();
    }, [processTrigger, selectedStudio?.remoteState?.status, isGrattisReady]); // Körs när vi får signal om nytt event, när ett event är klart, när timer-status ändras, eller när 5 sekunder har gått

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
                {currentEvent && (
                    <motion.div
                        key={currentEvent.id} // Viktigt: Unikt key tvingar React att rendera om helt
                        initial={{ opacity: 0, y: 100, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -50, scale: 0.9 }}
                        transition={{ duration: 0.5, ease: "backOut" }}
                        className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-2 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] w-full max-w-xl relative"
                    >
                        <Confetti />
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
                )}
            </AnimatePresence>
        </div>
    );
};
