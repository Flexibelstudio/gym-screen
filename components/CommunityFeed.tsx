import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutLog } from '../types';
import { listenToCommunityLogs } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { DumbbellIcon, FireIcon, HeartIcon } from './icons';

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
            setLogs(newLogs);
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
            <div className="h-full flex items-center justify-center text-white/50 text-sm italic bg-white/5 rounded-3xl border border-white/5 shadow-inner">
                Laddar flödet...
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 h-full flex flex-col items-center justify-center text-center shadow-xl">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                    <DumbbellIcon className="w-8 h-8 text-white/50" />
                </div>
                <p className="text-white/80 font-medium">Gymmet är tyst...</p>
                <p className="text-white/50 text-sm mt-1">Bli först med att logga ett pass!</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 h-full flex flex-col relative overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-xl text-green-400 shadow-inner border border-green-500/10">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">Gymflödet</h3>
                </div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Live Feed</span>
            </div>

            {/* Feed List */}
            <div className="flex-grow overflow-y-auto pr-2 space-y-3 scrollbar-hide relative z-10">
                <AnimatePresence initial={false}>
                    {logs.map((log, index) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -20, height: 0 }}
                            animate={{ opacity: 1, x: 0, height: 'auto' }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            className="bg-black/40 hover:bg-black/60 transition-colors rounded-xl p-3 flex items-center gap-4 border border-white/5 group shadow-lg"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0 overflow-hidden border border-white/10">
                                {log.memberPhotoUrl ? <img src={log.memberPhotoUrl} alt="" className="w-full h-full object-cover" /> : <span>{log.memberName ? log.memberName[0].toUpperCase() : '?'}</span>}
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <p className="text-white font-bold text-sm truncate mr-2">{log.memberName || 'Anonym'}</p>
                                    <span className="text-[10px] text-white/40 font-mono flex-shrink-0">{getRelativeTime(log.date)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-white/70 text-xs truncate max-w-[80%] group-hover:text-primary transition-colors">{log.workoutTitle}</p>
                                    {log.feeling && <span className="text-sm transform group-hover:scale-125 transition-transform">{getFeelingIcon(log.feeling)}</span>}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-20"></div>
        </div>
    );
};