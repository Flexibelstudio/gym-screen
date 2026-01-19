
import React, { useState, useMemo, useEffect } from 'react';
import { Organization, Workout, UserData } from '../../types';
import { DumbbellIcon, BuildingIcon, UsersIcon, SpeakerphoneIcon, SparklesIcon, CopyIcon, PencilIcon, TrashIcon, ShuffleIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon } from '../icons';
import { motion } from 'framer-motion';
import { AIGeneratorScreen } from '../AIGeneratorScreen';
import { WorkoutBuilderScreen } from '../WorkoutBuilderScreen';

type AdminTab = 
    'dashboard' | 
    'pass-program' | 'infosidor' | 'info-karusell' |
    'globala-installningar' | 'studios' | 'varumarke' | 'company-info' |
    'medlemmar' | 'ovningsbank';

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
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Kom igång med SmartSkärm</h3>
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
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl"></div>
        </div>
    );
};

const DashboardContent: React.FC<DashboardContentProps> = ({ organization, workouts, workoutsLoading, setActiveTab, admins, coaches, usersLoading, onQuickGenerate }) => {
    
    // Filtrera bort medlems-utkast (justeringar) från admin-översikten
    const officialWorkouts = useMemo(() => workouts.filter(w => !w.isMemberDraft), [workouts]);
    const publishedWorkouts = useMemo(() => officialWorkouts.filter(w => w.isPublished), [officialWorkouts]);
    const recentWorkouts = useMemo(() => [...officialWorkouts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5), [officialWorkouts]);

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
                workoutCount={officialWorkouts.length} 
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
                                            <div className="flex-grow min-0">
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
                            <button onClick={() => setActiveTab('medlemmar')} className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group">
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

const PassProgramModule: React.FC<{ 
    onNavigate: (mode: 'create' | 'generate' | 'parse' | 'manage') => void;
}> = ({ onNavigate }) => {
    return (
        <div className="space-y-8 py-4">
            <div className="text-center max-w-2xl mx-auto mb-10">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Pass & Program</h2>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Skapa, hantera och publicera träningspass. Använd AI för att snabbt generera nya pass eller tolka dina anteckningar.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <button onClick={() => onNavigate('create')} className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <DumbbellIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Skapa nytt pass</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Bygg ett pass från grunden med vår passbyggare.</p>
                </button>

                <button onClick={() => onNavigate('generate')} className="group bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 p-8 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-900/30 hover:border-purple-300 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Skapa med AI</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Låt AI:n generera ett komplett pass baserat på dina önskemål.</p>
                </button>

                <button onClick={() => onNavigate('parse')} className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <p className="font-bold text-xl">Aa</p>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Tolka från text</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Klistra in anteckningar och låt systemet strukturera upp det.</p>
                </button>

                <button onClick={() => onNavigate('manage')} className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Hantera pass</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Redigera, kopiera, publicera och ta bort dina befintliga pass.</p>
                </button>
            </div>
        </div>
    );
};

const ManageWorkoutsView: React.FC<{
    workouts: Workout[];
    onEdit: (workout: Workout) => void;
    onDelete: (id: string) => void;
    onDuplicate: (workout: Workout) => void;
    onTogglePublish: (id: string, isPublished: boolean) => void;
    onBack: () => void;
}> = ({ workouts, onEdit, onDelete, onDuplicate, onTogglePublish, onBack }) => {
    
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: 'title' | 'category' | 'createdAt' | 'isPublished', direction: 'asc' | 'desc' | 'none' }>({
        key: 'createdAt',
        direction: 'none'
    });
    
    const ITEMS_PER_PAGE = 50;

    // Filter only official workouts (not member drafts)
    const officialWorkouts = useMemo(() => {
        return workouts.filter(w => !w.isMemberDraft);
    }, [workouts]);

    // Handle Sort Toggle
    const handleSort = (key: typeof sortConfig.key) => {
        setSortConfig(prev => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            if (prev.direction === 'desc') return { key, direction: 'none' };
            return { key, direction: 'asc' };
        });
    };

    // Filter and Sort based on Search, Sort and Date
    const filteredWorkouts = useMemo(() => {
        let result = officialWorkouts.filter(w => {
            const searchLower = searchTerm.toLowerCase();
            return (
                w.title.toLowerCase().includes(searchLower) ||
                (w.category || '').toLowerCase().includes(searchLower)
            );
        });

        // Apply Sorting
        if (sortConfig.direction !== 'none') {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === undefined || bValue === undefined) return 0;

                // Secondary sort by date (newest first) for stability
                const secondarySort = (b.createdAt || 0) - (a.createdAt || 0);

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return secondarySort;
            });
        } else {
            // Default sort: Newest first
            result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        return result;
    }, [officialWorkouts, searchTerm, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredWorkouts.length / ITEMS_PER_PAGE);
    const paginatedWorkouts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredWorkouts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredWorkouts, currentPage]);

    // Reset to page 1 when search or sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortConfig]);

    const SortIcon = ({ column }: { column: typeof sortConfig.key }) => {
        if (sortConfig.key !== column || sortConfig.direction === 'none') {
            return <div className="flex flex-col ml-1 opacity-20"><ChevronUpIcon className="w-2.5 h-2.5 mb-[-2px]" /><ChevronDownIcon className="w-2.5 h-2.5 mt-[-2px]" /></div>;
        }
        return sortConfig.direction === 'asc' 
            ? <ChevronUpIcon className="w-3 h-3 ml-1 text-primary" /> 
            : <ChevronDownIcon className="w-3 h-3 ml-1 text-primary" />;
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
                    >
                        <span className="text-lg font-bold">←</span>
                    </button>
                    <div>
                        <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white">Hantera Pass</h3>
                        <p className="text-gray-500 dark:text-gray-400">Totalt {officialWorkouts.length} pass i biblioteket</p>
                    </div>
                </div>

                <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Sök pass..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th onClick={() => handleSort('title')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Titel <SortIcon column="title" /></div>
                                </th>
                                <th onClick={() => handleSort('category')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Kategori <SortIcon column="category" /></div>
                                </th>
                                <th onClick={() => handleSort('createdAt')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Skapad <SortIcon column="createdAt" /></div>
                                </th>
                                <th onClick={() => handleSort('isPublished')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Status <SortIcon column="isPublished" /></div>
                                </th>
                                <th className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] text-right">Åtgärder</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {paginatedWorkouts.length > 0 ? (
                                paginatedWorkouts.map((workout) => (
                                    <tr 
                                        key={workout.id} 
                                        className="group hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                                    >
                                        <td className="p-5">
                                            <p className="font-bold text-gray-900 dark:text-white text-base truncate max-w-xs">{workout.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{workout.coachTips}</p>
                                        </td>
                                        <td className="p-5">
                                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                                {workout.category || 'Okategoriserad'}
                                            </span>
                                        </td>
                                        <td className="p-5 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                            {new Date(workout.createdAt || 0).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="p-5">
                                            <button 
                                                onClick={() => onTogglePublish(workout.id, !workout.isPublished)}
                                                className={`text-xs font-bold px-2 py-1 rounded transition-colors uppercase tracking-wider ${
                                                    workout.isPublished 
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200' 
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                                                }`}
                                            >
                                                {workout.isPublished ? 'Publicerad' : 'Utkast'}
                                            </button>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => onEdit(workout)} 
                                                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" 
                                                    title="Redigera"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => onDuplicate(workout)}
                                                    className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                    title="Kopiera pass"
                                                >
                                                    <CopyIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm(`Vill du ta bort passet "${workout.title}"?`)) onDelete(workout.id);
                                                    }} 
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" 
                                                    title="Ta bort"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400 italic">
                                        Inga pass hittades.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                            Föregående
                        </button>
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                            Sida {currentPage} av {totalPages}
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Nästa
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const PassProgramContent: React.FC<DashboardContentProps & {
    subView: 'hub' | 'ai' | 'builder' | 'manage';
    setSubView: (view: 'hub' | 'ai' | 'builder' | 'manage') => void;
    workoutToEdit: Workout | null;
    setWorkoutToEdit: (w: Workout | null) => void;
    isNewDraft: boolean;
    setIsNewDraft: (b: boolean) => void;
    aiGeneratorInitialTab: 'generate' | 'parse' | 'manage';
    setAiGeneratorInitialTab: (tab: 'generate' | 'parse' | 'manage') => void;
    onReturnToHub: () => void;
    autoExpandCategory: string | null;
    setAutoExpandCategory: (category: string | null) => void;
    onSaveWorkout: (workout: Workout) => Promise<Workout>;
    onDeleteWorkout: (id: string) => Promise<void>;
    onTogglePublish: (id: string, isPublished: boolean) => void;
    onDuplicateWorkout: (workout: Workout) => void;
}> = ({
    subView, setSubView, workoutToEdit, setWorkoutToEdit, isNewDraft, setIsNewDraft,
    aiGeneratorInitialTab, setAiGeneratorInitialTab, onReturnToHub,
    onSaveWorkout, workouts, workoutsLoading, onDeleteWorkout, onTogglePublish,
    organization, autoExpandCategory, setAutoExpandCategory, onDuplicateWorkout
}) => {

    const handleNavigate = async (mode: 'create' | 'generate' | 'parse' | 'manage') => {
        if (mode === 'create') {
            setWorkoutToEdit(null);
            setIsNewDraft(true);
            setSubView('builder');
        } else if (mode === 'manage') {
            setSubView('manage');
        } else {
            setAiGeneratorInitialTab(mode === 'parse' ? 'parse' : 'generate');
            setSubView('ai');
        }
    };

    const handleWorkoutGenerated = (workout: Workout) => {
        setWorkoutToEdit(workout);
        setIsNewDraft(true);
        setSubView('builder');
    };

    const handleEditWorkout = (workout: Workout) => {
        setWorkoutToEdit(workout);
        setIsNewDraft(false);
        setSubView('builder');
    };

    const handleSaveAndReturn = async (workout: Workout) => {
        const saved = await onSaveWorkout(workout);
        const category = saved.category || 'Ej kategoriserad';
        setAutoExpandCategory(category);
        setAiGeneratorInitialTab('manage');
        setSubView('manage'); 
    };

    if (subView === 'ai') {
        return (
            <div className="animate-fade-in">
                <button onClick={onReturnToHub} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-primary transition-colors font-medium">
                    <span>&larr;</span> Tillbaka till meny
                </button>
                <AIGeneratorScreen
                    onWorkoutGenerated={handleWorkoutGenerated}
                    onEditWorkout={handleEditWorkout}
                    onDeleteWorkout={onDeleteWorkout}
                    onTogglePublish={onTogglePublish}
                    onCreateNewWorkout={() => handleNavigate('create')}
                    initialMode={aiGeneratorInitialTab}
                    studioConfig={organization.globalConfig}
                    setCustomBackHandler={() => {}}
                    workouts={workouts.filter(w => !w.isMemberDraft)}
                    workoutsLoading={workoutsLoading}
                    initialExpandedCategory={autoExpandCategory}
                />
            </div>
        );
    }

    if (subView === 'builder') {
        return (
            <div className="animate-fade-in w-full">
                <WorkoutBuilderScreen
                    initialWorkout={workoutToEdit}
                    onSave={handleSaveAndReturn}
                    onCancel={() => setSubView('manage')}
                    studioConfig={organization.globalConfig}
                    sessionRole="organizationadmin"
                    isNewDraft={isNewDraft}
                />
            </div>
        );
    }

    if (subView === 'manage') {
        return (
            <ManageWorkoutsView 
                workouts={workouts}
                onEdit={handleEditWorkout}
                onDelete={onDeleteWorkout}
                onDuplicate={onDuplicateWorkout}
                onTogglePublish={onTogglePublish}
                onBack={onReturnToHub}
            />
        );
    }

    return (
        <div className="animate-fade-in">
            <PassProgramModule 
                onNavigate={handleNavigate} 
            />
        </div>
    );
};

export { DashboardContent, PassProgramContent, ManageWorkoutsView, SetupProgressWidget, QuickAIWidget };
