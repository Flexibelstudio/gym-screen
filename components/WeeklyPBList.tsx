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
            setEvents(newEvents);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [selectedOrganization]);

    const formatEventTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const today = new Date();
        const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
        
        if (isToday) {
            return `Idag ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
        }
        
        const days = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
        return `${days[date.getDay()]} ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
    };

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Hämtar rekord...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-black rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-800 relative overflow-hidden h-full flex flex-col transition-colors duration-500">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="p-2.5 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-xl text-yellow-600 dark:text-yellow-400 shadow-inner border border-yellow-500/20">
                    <TrophyIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Veckans Rekord</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Hall of Fame</p>
                </div>
            </div>

            {/* List */}
            <div className="flex-grow overflow-y-auto pr-2 space-y-3 scrollbar-hide relative z-10">
                <AnimatePresence initial={false}>
                    {events.length > 0 ? (
                        events.map((event, index) => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl p-3 flex items-center gap-3 border border-gray-100 dark:border-gray-700/50 group transition-all"
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0">
                                    {event.data.userName[0].toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-grow">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-gray-900 dark:text-white font-bold truncate text-sm">
                                            {event.data.userName}
                                        </p>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap ml-2">
                                            {formatEventTime(event.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-yellow-600 dark:text-yellow-500/90 text-xs font-bold uppercase tracking-wide truncate flex items-center gap-1 mt-0.5">
                                        <span className="text-gray-500 dark:text-gray-400 text-[9px] bg-gray-200 dark:bg-gray-900 px-1.5 rounded font-black">PB</span> {event.data.exerciseName}
                                    </p>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-8">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                <DumbbellIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest">Inga rekord satta än</p>
                            <p className="text-gray-400 dark:text-gray-600 text-[10px] mt-1 italic">Bli den första den här veckan!</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Decorative Background Glow - Only in dark mode */}
            <div className="absolute top-0 right-0 w-64 h-64 hidden dark:block bg-yellow-500/5 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20"></div>
        </div>
    );
};