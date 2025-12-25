
import React, { useState, useMemo } from 'react';
import { Organization, Workout, UserData } from '../../types';
import { DumbbellIcon, BuildingIcon, UsersIcon, SpeakerphoneIcon, SparklesIcon } from '../icons';
import { motion } from 'framer-motion';

type AdminTab = 
    'dashboard' | 
    'pass-program' | 'infosidor' | 'info-karusell' |
    'globala-installningar' | 'studios' | 'varumarke' | 'company-info' |
    'anvandare' | 'ovningsbank';

interface DashboardContentProps {
    organization: Organization;
    workouts: Workout[];
    workoutsLoading: boolean;
    setActiveTab: (tab: AdminTab) => void;
    admins: UserData[];
    coaches: UserData[];
    usersLoading: boolean;
    onQuickGenerate: (prompt: string) => Promise<void>;
}

const WelcomeBanner: React.FC<{ name: string }> = ({ name }) => (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden mb-10">
        <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-2 tracking-tight">
                Hej, {name}! 👋
            </h1>
            <p className="text-purple-100 text-lg max-w-xl">
                Redo att skapa magi för dina medlemmar? Här har du full kontroll över din studio.
            </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="absolute left-0 bottom-0 w-48 h-48 bg-purple-800/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>
    </div>
);

const SetupProgressWidget: React.FC<{
    org: Organization;
    workoutCount: number;
    studioCount: number;
}> = ({ org, workoutCount, studioCount }) => {
    const DEFAULT_COLOR = '#14b8a6';
    
    const steps = [
        { label: "Ladda upp logotyp", completed: !!(org.logoUrlLight || org.logoUrlDark) },
        // Robust check: compare lowercase values to handle #RRGGBB vs #rrggbb differences
        { label: "Välj primärfärg", completed: (org.primaryColor || DEFAULT_COLOR).toLowerCase() !== DEFAULT_COLOR },
        { label: "Anpassa kategorier", completed: (org.globalConfig.customCategories || []).length > 0 },
        { label: "Skapa första skärmen", completed: studioCount > 0 },
        { label: "Skapa första passet", completed: workoutCount > 0 },
    ];

    const completedCount = steps.filter(s => s.completed).length;
    const totalSteps = steps.length;
    const progress = (completedCount / totalSteps) * 100;

    if (progress === 100) return null; // Hide when done

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Kom igång med SmartStudio</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Din checklista för en komplett upplevelse.</p>
                </div>
                <span className="font-bold text-primary">{completedCount}/{totalSteps} klart</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
                <motion.div 
                    className="bg-primary h-3 rounded-full" 
                    initial={{ width: 0 }} 
                    animate={{ width: `${progress}%` }} 
                    transition={{ duration: 1 }}
                />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {steps.map((step, i) => (
                    <div key={i} className={`text-xs font-medium flex items-center gap-2 ${step.completed ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                        <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border ${step.completed ? 'bg-green-100 border-green-200 dark:bg-green-900/30' : 'border-gray-300'}`}>
                            {step.completed && "✓"}
                        </span>
                        {step.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

const QuickAIWidget: React.FC<{ onGenerate: (prompt: string) => void }> = ({ onGenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        setIsLoading(true);
        await onGenerate(prompt);
        // Loading state will be handled by unmounting/navigation usually, but just in case:
        setIsLoading(false);
    };

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 text-white shadow-lg mb-10 relative overflow-hidden border border-gray-700/50">
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">Snabbgenerator</h3>
                </div>
                <p className="text-gray-400 mb-6">
                    Inget krångel. Berätta vad du behöver, så bygger AI:n passet åt dig direkt.
                </p>
                <form onSubmit={handleSubmit} className="relative">
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="t.ex. 'Ett tufft benpass på 45 minuter med kettlebells'..." 
                        className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-xl py-4 pl-5 pr-32 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white/15 transition-all"
                    />
                    <button 
                        type="submit"
                        disabled={!prompt.trim() || isLoading}
                        className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">Jobbar...</span>
                        ) : (
                            <>
                                <span>Skapa</span>
                                <span>✨</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
            {/* Decorative elements */}
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl"></div>
        </div>
    );
};

export const DashboardContent: React.FC<DashboardContentProps> = ({ organization, workouts, workoutsLoading, setActiveTab, admins, coaches, usersLoading, onQuickGenerate }) => {
    
    const publishedWorkouts = workouts.filter(w => w.isPublished);
    const recentWorkouts = [...workouts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);

    const stats = [
        { label: 'Publicerade Pass', value: workoutsLoading ? '...' : publishedWorkouts.length, icon: DumbbellIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { label: 'Aktiva Skärmar', value: organization.studios.length, icon: BuildingIcon, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        { label: 'Teammedlemmar', value: usersLoading ? '...' : admins.length + coaches.length, icon: UsersIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    ];

    return (
        <div className="space-y-0 animate-fade-in pb-12">
            <WelcomeBanner name={organization.name} />
            
            <SetupProgressWidget 
                org={organization} 
                workoutCount={workouts.length} 
                studioCount={organization.studios.length} 
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                <div className="lg:col-span-2">
                    <QuickAIWidget onGenerate={onQuickGenerate} />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {stats.map(stat => (
                            <div key={stat.label} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-32 transition-transform hover:-translate-y-1 duration-300 group">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                                    <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                                        <stat.icon className="w-5 h-5" />
                                    </div>
                                </div>
                                <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Recent Activity / Quick Links */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                            <h3 className="font-bold text-gray-900 dark:text-white">Senaste Pass</h3>
                            <button onClick={() => setActiveTab('pass-program')} className="text-xs font-bold text-primary hover:text-primary/80 uppercase tracking-wide">Visa alla</button>
                        </div>
                        <div className="p-2">
                            {workoutsLoading ? (
                                <p className="p-4 text-center text-gray-400 text-sm">Laddar...</p>
                            ) : recentWorkouts.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="text-gray-400 text-sm italic mb-2">Inga pass ännu.</p>
                                    <button onClick={() => setActiveTab('pass-program')} className="text-primary text-sm font-semibold hover:underline">Skapa ditt första!</button>
                                </div>
                            ) : (
                                <ul className="space-y-1">
                                    {recentWorkouts.map(w => (
                                        <li key={w.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-xl transition-colors">
                                            <div className={`w-2 h-2 rounded-full ${w.isPublished ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <div className="flex-grow min-w-0">
                                                <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{w.title}</p>
                                                <p className="text-xs text-gray-500 truncate">{w.category || 'Okategoriserad'}</p>
                                            </div>
                                            <span className="text-xs text-gray-400 font-mono">
                                                {new Date(w.createdAt || 0).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Genvägar</h3>
                        <div className="space-y-2">
                            <button onClick={() => setActiveTab('anvandare')} className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group">
                                <UsersIcon className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hantera Team</span>
                            </button>
                            <button onClick={() => setActiveTab('info-karusell')} className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group">
                                <SpeakerphoneIcon className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Uppdatera Karusell</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
