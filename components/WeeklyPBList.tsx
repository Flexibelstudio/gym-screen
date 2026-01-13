import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudioEvent } from '../types';
import { listenToWeeklyPBs } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { TrophyIcon, DumbbellIcon } from './icons';

export const WeeklyPBList: React.FC = () => {
    const { selectedOrganization } = useStudio();
    const [events, setEvents] = useState<StudioEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!selectedOrganization) return;
        setIsLoading(true);
        const unsubscribe = listenToWeeklyPBs(selectedOrganization.id, (newEvents) => {
            setEvents(newEvents.slice(0, 10)); // Topp 10 för scrollning
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [selectedOrganization]);

    const formatEventTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) return `Idag ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
        return date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    if (isLoading) {
        return (
            <div className="h-full bg-white/5 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center text-white/30 text-sm font-bold uppercase tracking-widest border border-white/10">
                Laddar rekord...
            </div>
        );
    }

    return (
        <div className="bg-white/10 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/10 h-full flex flex-col relative overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-xl text-yellow-400 border border-yellow-500/10 shadow-inner">
                        <TrophyIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">Veckans Rekord</h3>
                </div>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] bg-white/5 px-2 py-1 rounded-lg border border-white/5">Hall of Fame</span>
            </div>

            {/* List */}
            <div className="flex-grow overflow-y-auto pr-1 space-y-2.5 custom-scrollbar relative z-10 scrollbar-hide">
                <AnimatePresence initial={false}>
                    {events.length > 0 ? (
                        events.map((event, index) => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-black/30 hover:bg-black/40 transition-colors rounded-2xl p-3 flex items-center gap-4 border border-white/5 group"
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0">
                                    {event.data.userName[0].toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-grow">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <p className="text-white font-bold text-sm truncate mr-2">
                                            {event.data.userName}
                                        </p>
                                        <span className="text-[9px] text-white/30 font-bold uppercase whitespace-nowrap">
                                            {formatEventTime(event.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.1em] truncate flex items-center gap-1">
                                        🔥 NYTT PB I {event.data.exerciseName}
                                    </p>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                            <DumbbellIcon className="w-8 h-8 text-white mb-2" />
                            <p className="text-white text-xs font-bold uppercase tracking-widest">Inga rekord satta än</p>
                            <p className="text-white/60 text-[10px] mt-1 italic">Bli den första den här veckan!</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-20"></div>
        </div>
    );
};
