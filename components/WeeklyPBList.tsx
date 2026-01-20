
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudioEvent } from '../types';
import { listenToWeeklyPBs } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { TrophyIcon, DumbbellIcon } from './icons';

interface WeeklyPBListProps {
    onExpand?: () => void;
    isExpanded?: boolean;
}

export const WeeklyPBList: React.FC<WeeklyPBListProps> = ({ onExpand, isExpanded = false }) => {
    const { selectedOrganization } = useStudio();
    const [events, setEvents] = useState<StudioEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!selectedOrganization) return;
        setIsLoading(true);
        const unsubscribe = listenToWeeklyPBs(selectedOrganization.id, (newEvents) => {
            setEvents(newEvents.slice(0, 50)); 
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
            <div className="h-full bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center text-gray-400 dark:text-white/30 text-sm font-bold uppercase tracking-widest border border-gray-200 dark:border-white/10">
                Laddar PB´s...
            </div>
        );
    }

    const itemHeight = 72;
    const viewportHeight = itemHeight * 4;

    return (
        <div 
            onClick={!isExpanded ? onExpand : undefined}
            className={`
                rounded-[2.5rem] p-6 border flex flex-col relative overflow-hidden shadow-2xl transition-all
                ${!isExpanded 
                    ? 'h-full cursor-pointer bg-white/20 dark:bg-white/10 backdrop-blur-md border-gray-200 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/15 active:scale-[0.99]' 
                    : 'h-full bg-transparent border-transparent'}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-2xl text-yellow-600 dark:text-yellow-400 border border-yellow-500/10 shadow-inner">
                        <TrophyIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Personbästa</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-500 dark:text-white/40 uppercase tracking-[0.2em] bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/5">Hof</span>
                    {!isExpanded && <span className="text-[10px] font-black text-primary uppercase">Visa mer</span>}
                </div>
            </div>

            {/* List */}
            <div 
                className={`flex-grow overflow-y-auto pr-1 space-y-2 relative z-10 custom-scrollbar scroll-smooth`}
                style={{ height: !isExpanded ? `${viewportHeight}px` : 'auto', maxHeight: isExpanded ? '70vh' : undefined }}
            >
                <AnimatePresence initial={false}>
                    {events.length > 0 ? (
                        events.map((event, index) => {
                            const isBatch = event.type === 'pb_batch' || (event.data.records && event.data.records.length > 1);
                            const recordCount = event.data.records?.length || 1;
                            const mainRecord = event.data.records?.[0] || { exerciseName: event.data.exerciseName, weight: 0 };

                            return (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-white/5 group px-4 shadow-sm"
                                    style={{ height: `${itemHeight - 8}px` }}
                                >
                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0 overflow-hidden border border-yellow-400/50">
                                        {event.data.userPhotoUrl ? (
                                            <img src={event.data.userPhotoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span>{event.data.userName[0].toUpperCase()}</span>
                                        )}
                                    </div>
                                    
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <p className="text-gray-900 dark:text-white font-bold text-sm truncate mr-2">
                                                {event.data.userName}
                                            </p>
                                            <span className="text-[9px] text-gray-500 dark:text-white/30 font-bold uppercase whitespace-nowrap">
                                                {formatEventTime(event.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-yellow-600 dark:text-yellow-500 text-[10px] font-black uppercase tracking-[0.1em] truncate flex items-center gap-1">
                                            🔥 {isBatch ? `${recordCount} NYA PB!` : `PB I ${mainRecord.exerciseName.toUpperCase()}`}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                            <DumbbellIcon className="w-8 h-8 text-gray-400 dark:text-white mb-2" />
                            <p className="text-gray-500 dark:text-white text-[10px] font-bold uppercase tracking-widest">Inga PB satta än</p>
                            <p className="text-gray-400 dark:text-white/60 text-[10px] mt-1 italic">Bli den första den här veckan!</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
