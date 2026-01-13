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
            <div className="h-full bg-white/5 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center text-white/30 text-sm font-bold uppercase tracking-widest border border-white/10">
                Laddar rekord...
            </div>
        );
    }

    const itemHeight = 72;
    const viewportHeight = itemHeight * 5;

    return (
        <div 
            onClick={!isExpanded ? onExpand : undefined}
            className={`
                bg-white/10 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/10 flex flex-col relative overflow-hidden shadow-2xl transition-all
                ${!isExpanded ? 'h-full cursor-pointer hover:bg-white/15 active:scale-[0.99]' : 'h-full'}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-2xl text-yellow-400 border border-yellow-500/10 shadow-inner">
                        <TrophyIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">Veckans Rekord</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] bg-white/5 px-2 py-1 rounded-lg border border-white/5">Hof</span>
                    {!isExpanded && <span className="text-[10px] font-black text-primary uppercase">Visa alla</span>}
                </div>
            </div>

            {/* List */}
            <div 
                className={`flex-grow overflow-y-auto pr-1 space-y-2 relative z-10 custom-scrollbar scroll-smooth`}
                style={{ height: !isExpanded ? `${viewportHeight}px` : 'auto', maxHeight: isExpanded ? '70vh' : undefined }}
            >
                <AnimatePresence initial={false}>
                    {events.length > 0 ? (
                        events.map((event, index) => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-black/30 hover:bg-black/40 transition-colors rounded-2xl flex items-center gap-4 border border-white/5 group px-4"
                                style={{ height: `${itemHeight - 8}px` }}
                            >
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0">
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
                            <p className="text-white text-[10px] font-bold uppercase tracking-widest">Inga rekord satta än</p>
                            <p className="text-white/60 text-[10px] mt-1 italic">Bli den första den här veckan!</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
            
            {!isExpanded && <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-20"></div>}
        </div>
    );
};
