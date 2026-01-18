
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutLog } from '../types';
import { listenToCommunityLogs } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { DumbbellIcon } from './icons';

const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diffInSeconds = Math.floor((now - timestamp) / 1000);
    if (diffInSeconds < 60) return 'Nu';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min sen`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h sen`;
    return 'Igår'; 
};

const getFeelingIcon = (feeling: string | null) => {
    switch(feeling) {
        case 'good': return '🔥';
        case 'neutral': return '🙂';
        case 'bad': return '🤕';
        default: return null;
    }
};

interface CommunityFeedProps {
    onExpand?: () => void;
    isExpanded?: boolean;
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({ onExpand, isExpanded = false }) => {
    const { selectedOrganization } = useStudio();
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!selectedOrganization) return;
        setIsLoading(true);
        const unsubscribe = listenToCommunityLogs(selectedOrganization.id, (newLogs) => {
            setLogs(newLogs.slice(0, 50)); 
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [selectedOrganization]);

    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    if (isLoading) {
        return (
            <div className="h-full bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center text-gray-400 dark:text-white/30 text-xs font-bold uppercase tracking-widest border border-gray-200 dark:border-white/10">
                Laddar gymflödet...
            </div>
        );
    }

    const itemHeight = 72; 
    const viewportHeight = itemHeight * 4; 

    return (
        <div 
            onClick={!isExpanded ? onExpand : undefined}
            className={`
                bg-white/20 dark:bg-white/10 backdrop-blur-md rounded-[2.5rem] p-6 border border-gray-200 dark:border-white/10 flex flex-col relative overflow-hidden shadow-2xl transition-all
                ${!isExpanded ? 'h-full cursor-pointer hover:bg-white/30 dark:hover:bg-white/15 active:scale-[0.99]' : 'h-full'}
            `}
        >
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Gymflödet</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-500 dark:text-white/40 uppercase tracking-[0.2em] bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/5">Live</span>
                    {!isExpanded && <span className="text-[10px] font-black text-primary uppercase">Visa mer</span>}
                </div>
            </div>

            <div 
                className={`flex-grow overflow-y-auto pr-1 space-y-2 relative z-10 custom-scrollbar scroll-smooth`}
                style={{ height: !isExpanded ? `${viewportHeight}px` : 'auto', maxHeight: isExpanded ? '70vh' : undefined }}
            >
                <AnimatePresence initial={false} mode="popLayout">
                    {logs.length > 0 ? (
                        logs.map((log) => (
                            <motion.div
                                layout
                                key={log.id}
                                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ 
                                    type: "spring", 
                                    stiffness: 400, 
                                    damping: 30,
                                    opacity: { duration: 0.2 }
                                }}
                                className="bg-white/40 dark:bg-black/30 hover:bg-white/50 dark:hover:bg-black/40 transition-colors rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-white/5 group px-4"
                                style={{ height: `${itemHeight - 8}px` }}
                            >
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm shadow-lg flex-shrink-0 overflow-hidden border border-white/10">
                                    {log.memberPhotoUrl ? (
                                        <img src={log.memberPhotoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{log.memberName ? log.memberName[0].toUpperCase() : '?'}</span>
                                    )}
                                </div>

                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-gray-900 dark:text-white font-bold text-sm truncate mr-2">
                                            {log.memberName || 'Anonym'}
                                        </p>
                                        <span className="text-[9px] text-gray-500 dark:text-white/30 font-bold uppercase whitespace-nowrap">
                                            {getRelativeTime(log.date)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-gray-600 dark:text-white/60 text-[10px] truncate max-w-[85%] font-medium">
                                            {log.workoutTitle}
                                        </p>
                                        {log.feeling && (
                                            <span className="text-xs">{getFeelingIcon(log.feeling)}</span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                            <DumbbellIcon className="w-8 h-8 text-gray-400 dark:text-white mb-2" />
                            <p className="text-gray-500 dark:text-white text-[10px] font-bold uppercase tracking-widest">Väntar på aktivitet...</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
