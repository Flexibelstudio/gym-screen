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

export const CommunityFeed: React.FC = () => {
    const { selectedOrganization } = useStudio();
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!selectedOrganization) return;
        setIsLoading(true);
        const unsubscribe = listenToCommunityLogs(selectedOrganization.id, (newLogs) => {
            setLogs(newLogs.slice(0, 15)); 
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
            <div className="h-full bg-white/5 backdrop-blur-md rounded-[2rem] flex items-center justify-center text-white/30 text-xs font-bold uppercase tracking-widest border border-white/10">
                Laddar gymlödet...
            </div>
        );
    }

    return (
        <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-5 border border-white/10 h-full flex flex-col relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">Gymlödet</h3>
                </div>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] bg-white/5 px-2 py-1 rounded-lg border border-white/5">Live</span>
            </div>

            <div className="flex-grow overflow-y-auto pr-1 space-y-2 custom-scrollbar relative z-10 scrollbar-hide">
                <AnimatePresence initial={false}>
                    {logs.length > 0 ? (
                        logs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-black/30 hover:bg-black/40 transition-colors rounded-xl p-2.5 flex items-center gap-3 border border-white/5 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-xs shadow-lg flex-shrink-0 overflow-hidden border border-white/10">
                                    {log.memberPhotoUrl ? (
                                        <img src={log.memberPhotoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{log.memberName ? log.memberName[0].toUpperCase() : '?'}</span>
                                    )}
                                </div>

                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-white font-bold text-xs truncate mr-2">
                                            {log.memberName || 'Anonym'}
                                        </p>
                                        <span className="text-[8px] text-white/30 font-bold uppercase whitespace-nowrap">
                                            {getRelativeTime(log.date)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-white/60 text-[10px] truncate max-w-[85%] font-medium">
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
                            <DumbbellIcon className="w-6 h-6 text-white mb-2" />
                            <p className="text-white text-[10px] font-bold uppercase tracking-widest">Väntar på aktivitet...</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-20"></div>
        </div>
    );
};
