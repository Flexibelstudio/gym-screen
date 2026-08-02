
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutLog, StudioEvent } from '../types';
import { listenToCommunityLogs, listenToCommunityLogsByLocations, listenToFeedEvents } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { DumbbellIcon } from './icons';

const getRelativeTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return `Idag ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
};

const getFeelingIcon = (feeling: string | null) => {
    switch(feeling) {
        case 'good': return '🔥';
        case 'neutral': return '🙂';
        case 'bad': return '🤕';
        default: return '';
    }
};

interface CommunityFeedProps {
    onExpand?: () => void;
    isExpanded?: boolean;
}

type FeedItem = 
  | { itemType: 'log'; id: string; date: number; log: WorkoutLog }
  | { itemType: 'milestone'; id: string; date: number; event: StudioEvent }
  | { itemType: 'test'; id: string; date: number; event: StudioEvent }
  | { itemType: 'anniversary'; id: string; date: number; event: StudioEvent }
  | { itemType: 'streak'; id: string; date: number; event: StudioEvent };

export const CommunityFeed: React.FC<CommunityFeedProps> = ({ onExpand, isExpanded = false }) => {
    const { selectedOrganization, selectedStudio } = useStudio();
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]);

    useEffect(() => {
        if (!selectedOrganization) return;
        import('../services/firebaseService').then(({ getMembers }) => {
            getMembers(selectedOrganization.id).then(setMembers).catch(console.error);
        });
    }, [selectedOrganization]);

    useEffect(() => {
        if (!selectedOrganization) return;
        setIsLoading(true);

        const resolvedLocationId = selectedStudio?.locationId ?? null;
        const numLocations = selectedOrganization?.locations?.length ?? 0;
        const shouldFilter = !!resolvedLocationId && numLocations >= 2;

        let latestLocationLogs: WorkoutLog[] = [];
        let latestOrgLogs: WorkoutLog[] = [];
        let latestFeedEvents: StudioEvent[] = [];

        const updateCombined = () => {
            const filteredOrgLogs = latestOrgLogs.filter(log => {
                if (!shouldFilter) return true;
                let logLocation = log.locationId;
                
                if (!logLocation || logLocation === '' || logLocation === 'undefined') {
                    const member = members.find(m => m.uid === log.memberId || m.id === log.memberId);
                    logLocation = member?.locationId;
                }

                return logLocation === resolvedLocationId;
            });

            const filteredEvents = latestFeedEvents.filter(event => {
                if (!shouldFilter) return true;
                const eventLoc = event.locationId;
                return eventLoc === resolvedLocationId;
            });

            const map = new Map<string, FeedItem>();

            filteredOrgLogs.forEach(log => {
                if (log.id) map.set(`log_${log.id}`, { itemType: 'log', id: log.id, date: log.date || 0, log });
            });
            latestLocationLogs.forEach(log => {
                if (log.id) map.set(`log_${log.id}`, { itemType: 'log', id: log.id, date: log.date || 0, log });
            });

            filteredEvents.forEach(event => {
                if (event.id) {
                    if (event.type === 'test') {
                        map.set(`test_${event.id}`, { itemType: 'test', id: event.id, date: event.timestamp || 0, event });
                    } else if (event.type === 'anniversary') {
                        map.set(`anniversary_${event.id}`, { itemType: 'anniversary', id: event.id, date: event.timestamp || 0, event });
                    } else if (event.type === 'streak') {
                        map.set(`streak_${event.id}`, { itemType: 'streak', id: event.id, date: event.timestamp || 0, event });
                    } else {
                        map.set(`milestone_${event.id}`, { itemType: 'milestone', id: event.id, date: event.timestamp || 0, event });
                    }
                }
            });

            const combined = Array.from(map.values());
            combined.sort((a, b) => b.date - a.date);

            setFeedItems(combined.slice(0, 20));
            setIsLoading(false);
        };

        const unsubFeedEvents = listenToFeedEvents(selectedOrganization.id, (fEvents) => {
            latestFeedEvents = fEvents;
            updateCombined();
        });

        if (resolvedLocationId) {
            const unsubLocation = listenToCommunityLogsByLocations(selectedOrganization.id, [resolvedLocationId], (locLogs) => {
                latestLocationLogs = locLogs;
                updateCombined();
            });

            const unsubOrg = listenToCommunityLogs(selectedOrganization.id, (orgLogs) => {
                latestOrgLogs = orgLogs;
                updateCombined();
            });

            return () => {
                unsubLocation();
                unsubOrg();
                unsubFeedEvents();
            };
        } else {
            const unsubOrg = listenToCommunityLogs(selectedOrganization.id, (newLogs) => {
                latestOrgLogs = newLogs;
                updateCombined();
            });
            return () => {
                unsubOrg();
                unsubFeedEvents();
            };
        }
    }, [selectedOrganization, selectedStudio?.locationId, members]);

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

    return (
        <div 
            onClick={!isExpanded ? onExpand : undefined}
            className={`
                rounded-[2.5rem] p-6 border flex flex-col relative overflow-hidden transition-all
                ${!isExpanded 
                    ? 'h-full cursor-pointer bg-white/20 dark:bg-white/10 backdrop-blur-md border-gray-200 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/15 active:scale-[0.99] shadow-2xl' 
                    : 'h-full bg-transparent border-transparent'}
            `}
        >
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)] motion-reduce:animate-none"></div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-[1.2] pt-[0.1em]">Gymflödet</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none"></div>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">Live</span>
                    </div>
                    {!isExpanded && <span className="text-[10px] font-black text-primary uppercase">Visa mer</span>}
                </div>
            </div>

            <div 
                className={`flex-grow overflow-y-auto pr-1 space-y-2 relative z-10 custom-scrollbar scroll-smooth`}
                style={{ height: !isExpanded ? 'var(--feed-viewport-height, 288px)' : 'auto', maxHeight: isExpanded ? '70vh' : undefined }}
            >
                <AnimatePresence initial={false} mode="popLayout">
                    {feedItems.length > 0 ? (
                        feedItems.map((item) => {
                            if (item.itemType === 'milestone') {
                                const event = item.event;
                                const userName = event.data.userName || 'En medlem';
                                const milestoneVal = event.data.milestone;

                                return (
                                    <motion.div
                                        layout
                                        key={`milestone_${event.id}`}
                                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ 
                                            type: "spring", 
                                            stiffness: 400, 
                                            damping: 30,
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors duration-150 rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-white/10 group px-4 shadow-sm"
                                        style={{ height: 'var(--feed-item-height, 64px)' }}
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm shadow-lg flex-shrink-0 overflow-hidden border border-white/10">
                                            {event.data.userPhotoUrl ? (
                                                <img src={event.data.userPhotoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{userName ? userName[0].toUpperCase() : '?'}</span>
                                            )}
                                        </div>

                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <div className="flex items-center gap-1.5 truncate mr-2 min-w-0">
                                                    <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                                                        {userName}
                                                    </p>
                                                    <span className="shrink-0 bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                                                        Milstolpe ⭐
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-gray-500 dark:text-white/40 font-bold uppercase whitespace-nowrap shrink-0 tabular-nums">
                                                    {getRelativeTime(event.timestamp)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <p className="text-gray-600 dark:text-white/60 text-[10px] truncate max-w-[95%] font-medium">
                                                    {milestoneVal === 1 
                                                        ? `🎉 ${userName} loggade sitt första pass!`
                                                        : `💪 ${userName} har loggat ${milestoneVal} pass`}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }

                            if (item.itemType === 'test') {
                                const event = item.event;
                                const userName = event.data.userName || 'En medlem';
                                const benchmarkId = event.data.benchmarkId;
                                let testTitle = 'Benchmark';

                                if (benchmarkId === 'platform_row_2000m') {
                                    const dist = event.data.benchmarkDistance ?? 2000;
                                    testTitle = dist === 2000 ? '2000 m rodd' : `${dist} m rodd`;
                                } else if (benchmarkId && selectedOrganization?.benchmarkDefinitions) {
                                    const def = selectedOrganization.benchmarkDefinitions.find((b: any) => b.id === benchmarkId);
                                    if (def?.title) {
                                        testTitle = def.title;
                                    } else if (event.data.benchmarkTitle) {
                                        testTitle = event.data.benchmarkTitle;
                                    }
                                } else if (event.data.benchmarkTitle) {
                                    testTitle = event.data.benchmarkTitle;
                                }

                                const testIcon = benchmarkId === 'platform_row_2000m' ? '🚣' : '⏱️';

                                return (
                                    <motion.div
                                        layout
                                        key={`test_${event.id}`}
                                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ 
                                            type: "spring", 
                                            stiffness: 400, 
                                            damping: 30,
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors duration-150 rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-white/10 group px-4 shadow-sm"
                                        style={{ height: 'var(--feed-item-height, 64px)' }}
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm shadow-lg flex-shrink-0 overflow-hidden border border-white/10">
                                            {event.data.userPhotoUrl ? (
                                                <img src={event.data.userPhotoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{userName ? userName[0].toUpperCase() : '?'}</span>
                                            )}
                                        </div>

                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <div className="flex items-center gap-1.5 truncate mr-2 min-w-0">
                                                    <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                                                        {userName}
                                                    </p>
                                                    <span className="shrink-0 bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                                                        Test {testIcon}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-gray-500 dark:text-white/40 font-bold uppercase whitespace-nowrap shrink-0 tabular-nums">
                                                    {getRelativeTime(event.timestamp)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col justify-center mt-0.5">
                                                <p className="text-gray-600 dark:text-white/60 text-[10px] truncate max-w-[95%] font-medium">
                                                    {testIcon} {userName} gjorde {testTitle}
                                                </p>
                                                {event.data.improvedBySec !== undefined && event.data.improvedBySec > 0 && (
                                                    <p className="text-emerald-600 dark:text-emerald-400 text-[9px] font-bold truncate max-w-[95%]">
                                                        Förbättrade sin tid med {event.data.improvedBySec} sekunder
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }

                            if (item.itemType === 'anniversary') {
                                const event = item.event;
                                const userName = event.data.userName || 'En medlem';
                                const years = event.data.years || 1;
                                const text = years === 1 
                                    ? `🎂 Ett år sedan ${userName} loggade sitt första pass` 
                                    : `🎂 ${years} år sedan ${userName} loggade sitt första pass`;

                                return (
                                    <motion.div
                                        layout
                                        key={`anniversary_${event.id}`}
                                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ 
                                            type: "spring", 
                                            stiffness: 400, 
                                            damping: 30,
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors duration-150 rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-white/10 group px-4 shadow-sm"
                                        style={{ height: 'var(--feed-item-height, 64px)' }}
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm shadow-lg flex-shrink-0 overflow-hidden border border-white/10">
                                            {event.data.userPhotoUrl ? (
                                                <img src={event.data.userPhotoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{userName ? userName[0].toUpperCase() : '?'}</span>
                                            )}
                                        </div>

                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <div className="flex items-center gap-1.5 truncate mr-2 min-w-0">
                                                    <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                                                        {userName}
                                                    </p>
                                                    <span className="shrink-0 bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                                                        Årsdag 🎂
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-gray-500 dark:text-white/40 font-bold uppercase whitespace-nowrap shrink-0 tabular-nums">
                                                    {getRelativeTime(event.timestamp)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col justify-center mt-0.5">
                                                <p className="text-gray-600 dark:text-white/60 text-[10px] truncate max-w-[95%] font-medium">
                                                    {text}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }

                            if (item.itemType === 'streak') {
                                const event = item.event;
                                const userName = event.data.userName || 'En medlem';
                                const streakWeeks = event.data.streakWeeks || 0;

                                return (
                                    <motion.div
                                        layout
                                        key={`streak_${event.id}`}
                                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ 
                                            type: "spring", 
                                            stiffness: 400, 
                                            damping: 30,
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors duration-150 rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-white/10 group px-4 shadow-sm"
                                        style={{ height: 'var(--feed-item-height, 64px)' }}
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm shadow-lg flex-shrink-0 overflow-hidden border border-white/10">
                                            {event.data.userPhotoUrl ? (
                                                <img src={event.data.userPhotoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{userName ? userName[0].toUpperCase() : '?'}</span>
                                            )}
                                        </div>

                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <div className="flex items-center gap-1.5 truncate mr-2 min-w-0">
                                                    <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                                                        {userName}
                                                    </p>
                                                    <span className="shrink-0 bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                                                        Svit 🔥
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-gray-500 dark:text-white/40 font-bold uppercase whitespace-nowrap shrink-0 tabular-nums">
                                                    {getRelativeTime(event.timestamp)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col justify-center mt-0.5">
                                                <p className="text-gray-600 dark:text-white/60 text-[10px] truncate max-w-[95%] font-medium">
                                                    🔥 {userName} har tränat {streakWeeks} veckor i rad
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }

                            const log = item.log;
                            return (
                                <motion.div
                                    layout
                                    key={`log_${log.id}`}
                                    initial={{ opacity: 0, scale: 0.9, y: -20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ 
                                        type: "spring", 
                                        stiffness: 400, 
                                        damping: 30,
                                        opacity: { duration: 0.2 }
                                    }}
                                    className="bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors duration-150 rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-white/10 group px-4 shadow-sm"
                                    style={{ height: 'var(--feed-item-height, 64px)' }}
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
                                            <div className="flex items-center gap-1.5 truncate mr-2 min-w-0">
                                                <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                                                    {log.memberName || 'Anonym'}
                                                </p>
                                                {log.reachedSummerGoal && (
                                                    <span className="shrink-0 bg-record/15 text-record border border-record/30 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider animate-bounce motion-reduce:animate-none [animation-duration:2.5s]">
                                                        Målet nått! ☀️
                                                    </span>
                                                )}
                                                {log.overDeliveredSummerGoal && (
                                                    <span className="shrink-0 bg-work/15 text-work border border-work/30 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider animate-pulse motion-reduce:animate-none">
                                                        Överlevererat! 🔥
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[9px] text-gray-500 dark:text-white/40 font-bold uppercase whitespace-nowrap shrink-0 tabular-nums">
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
                            );
                        })
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
