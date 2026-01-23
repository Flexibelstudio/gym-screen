
import React, { useState, useEffect, useMemo } from 'react';
import { AdminActivity } from '../../types';
import { listenToAdminActivities } from '../../services/firebaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { DumbbellIcon, UsersIcon, SparklesIcon, SettingsIcon, HistoryIcon, SearchIcon, ChevronDownIcon } from '../icons';

const ActivityIcon: React.FC<{ type: AdminActivity['type'], action: AdminActivity['action'] }> = ({ type, action }) => {
    if (action === 'DELETE') return <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl"><TrashIcon className="w-5 h-5" /></div>;
    
    switch (type) {
        case 'WORKOUT': return <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><DumbbellIcon className="w-5 h-5" /></div>;
        case 'MEMBER': return <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl"><UsersIcon className="w-5 h-5" /></div>;
        case 'BRAND': return <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl"><SparklesIcon className="w-5 h-5" /></div>;
        case 'SYSTEM': return <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl"><SettingsIcon className="w-5 h-5" /></div>;
        default: return <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl"><HistoryIcon className="w-5 h-5" /></div>;
    }
};

const TrashIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

export const ActivityLogContent: React.FC<{ organizationId: string }> = ({ organizationId }) => {
    const [activities, setActivities] = useState<AdminActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = listenToAdminActivities(organizationId, (data) => {
            setActivities(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [organizationId]);

    const filteredActivities = useMemo(() => {
        if (!searchTerm.trim()) return activities;
        const s = searchTerm.toLowerCase();
        return activities.filter(a => 
            a.userName.toLowerCase().includes(s) || 
            a.description.toLowerCase().includes(s)
        );
    }, [activities, searchTerm]);

    const formatActivityDate = (ts: number) => {
        const date = new Date(ts);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

        const time = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        if (isToday) return `Idag ${time}`;
        if (isYesterday) return `Igår ${time}`;
        return `${date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} ${time}`;
    };

    if (isLoading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center gap-4 animate-fade-in">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Hämtar historik...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div>
                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight uppercase">Aktivitetslogg</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                    Här ser du de senaste ändringarna som gjorts i adminpanelen.
                </p>
            </div>

            <div className="relative max-w-md">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                    type="text"
                    placeholder="Sök på person eller händelse..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary outline-none transition-all text-gray-900 dark:text-white"
                />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredActivities.length > 0 ? (
                        filteredActivities.map((activity, index) => (
                            <motion.div 
                                key={activity.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.02 }}
                                className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                            >
                                <div className="flex items-center gap-5 min-w-0">
                                    <ActivityIcon type={activity.type} action={activity.action} />
                                    <div className="min-w-0">
                                        <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                                            {activity.description}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-black uppercase text-primary tracking-widest">{activity.userName}</span>
                                            <span className="text-gray-300 dark:text-gray-600">•</span>
                                            <span className="text-xs text-gray-500 font-medium">{formatActivityDate(activity.timestamp)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex-shrink-0">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                                        {activity.type}
                                    </span>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="p-20 text-center text-gray-500 italic">
                            Inga aktiviteter hittades.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
