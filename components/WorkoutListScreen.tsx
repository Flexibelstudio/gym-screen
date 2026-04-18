
import React, { useMemo, useState, useEffect } from 'react';
import { Workout } from '../types';
import { useWorkout } from '../context/WorkoutContext';
import { useStudio } from '../context/StudioContext';
import { SearchIcon, DumbbellIcon, ClockIcon, TrashIcon } from './icons';
import { useAuth } from '../context/AuthContext';
import { fetchCustomPrograms, deleteCustomProgram } from '../services/firebaseService';

interface WorkoutListScreenProps {
    passkategori?: string;
    onSelectWorkout: (workout: Workout, action?: 'view' | 'log') => void;
}

export const WorkoutListScreen: React.FC<WorkoutListScreenProps> = ({ passkategori, onSelectWorkout }) => {
    const { workouts } = useWorkout();
    const { isStudioMode, currentUser } = useAuth();
    const { studioConfig } = useStudio();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'alla' | 'mina'>('alla');
    const [customPrograms, setCustomPrograms] = useState<Workout[]>([]);
    const [programToDelete, setProgramToDelete] = useState<Workout | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const load = () => {
            if (currentUser?.uid) {
                fetchCustomPrograms(currentUser.uid).then(setCustomPrograms).catch(console.warn);
            }
        };
        
        load();
        
        window.addEventListener('customProgramsUpdated', load);
        return () => window.removeEventListener('customProgramsUpdated', load);
    }, [currentUser?.uid, activeTab]);

    const filteredWorkouts = useMemo(() => {
        const sourceWorkouts = (!passkategori && activeTab === 'mina') ? customPrograms : workouts;

        return sourceWorkouts.filter(w => {
            const matchesCategory = !passkategori || w.category === passkategori;
            const matchesSearch = (w.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (w.coachTips && (w.coachTips || '').toLowerCase().includes(searchTerm.toLowerCase()));
            
            // Kolla om kategorin är låst
            const categoryConfig = studioConfig.customCategories.find(c => c.name === w.category);
            const isCategoryLocked = categoryConfig?.isLocked === true;

            // Filtreringslogik baserat på läge (gäller ej egna program)
            if (activeTab !== 'mina') {
                if (isStudioMode) {
                    if (w.showInStudio === false) return false;
                } else {
                    if (w.showInApp === false) return false;
                    if (isCategoryLocked) return false;
                }
            }

            return w.isPublished && matchesCategory && matchesSearch;
        });
    }, [workouts, customPrograms, passkategori, searchTerm, isStudioMode, studioConfig, activeTab]);
    
    return (
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 animate-fade-in">
            {!passkategori && (
                <div className="text-center mb-6">
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                        Välj Träningspass
                    </h1>
                    <div className="h-1.5 w-24 bg-primary mx-auto rounded-full mb-8"></div>
                    
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <button
                            onClick={() => setActiveTab('alla')}
                            className={`px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-sm transition-all ${
                                activeTab === 'alla'
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            Studions Pass
                        </button>
                        <button
                            onClick={() => setActiveTab('mina')}
                            className={`px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-sm transition-all ${
                                activeTab === 'mina'
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            Mina Program ({customPrograms.length})
                        </button>
                    </div>
                </div>
            )}

            {/* Sökfält */}
            <div className="relative max-w-xl mx-auto mb-12">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <SearchIcon className="h-6 w-6 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Sök på passets namn..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-12 pr-4 py-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-xl transition-all text-lg"
                />
            </div>

            {filteredWorkouts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {filteredWorkouts.map(workout => {
                        const blocks = workout.blocks || [];
                        const isLoggable = blocks.some(b => 
                            (b.exercises || []).some(e => e.loggingEnabled === true)
                        );
                        
                        return (
                            <div
                                key={workout.id}
                                className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-150 overflow-hidden flex flex-col p-8"
                                style={{ touchAction: 'manipulation' }}
                            >
                                {/* 
                                    STUDIO MODE OVERLAY 
                                    Bytt från <button> till <div> för att undvika TV-webbläsarens vita standardbakgrund.
                                    Ligger på z-20 för att garanterat fånga klick, men är helt transparent.
                                */}
                                {isStudioMode && (
                                    <div 
                                        role="button"
                                        className="absolute inset-0 z-20 w-full h-full cursor-pointer bg-transparent border-none outline-none appearance-none"
                                        onClick={() => onSelectWorkout(workout, 'view')}
                                        aria-label={`Visa ${workout.title || 'Namnlöst pass'}`}
                                    />
                                )}

                                {/* CONTENT LAYER - z-10 för att ligga under klickytan men över bakgrunden */}
                                <div className="relative z-10 flex-grow flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex flex-wrap gap-2">
                                            {!passkategori && workout.category && (
                                                <span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/10">
                                                    {workout.category}
                                                </span>
                                            )}
                                            {workout.benchmarkId && (
                                                <span className="inline-block px-3 py-1 rounded-lg bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-[10px] font-black uppercase tracking-widest border border-yellow-200 dark:border-yellow-800">
                                                    BENCHMARK
                                                </span>
                                            )}
                                            {!isLoggable && (
                                                <div className="flex items-center gap-1 text-[10px] font-black text-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 px-3 py-1 rounded-lg border border-gray-100 dark:border-gray-700">
                                                    <span>ENDAST VISNING</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-start mb-4">
                                         <h3 className="text-2xl font-black text-primary dark:text-primary leading-tight min-h-[1.5em] pr-8">
                                             {workout.title || 'Namnlöst pass'}
                                         </h3>
                                    </div>
                                    
                                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium line-clamp-4 overflow-hidden whitespace-pre-wrap">
                                        {workout.coachTips || "Välkommen till dagens pass. Fokusera på teknik och intensitet!"}
                                    </p>
                                </div>
                                
                                {activeTab === 'mina' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProgramToDelete(workout);
                                        }}
                                        className="absolute top-6 right-6 p-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-full transition-colors z-40 cursor-pointer shadow-sm border border-gray-100 dark:border-gray-700 hover:scale-105 active:scale-95"
                                        aria-label="Radera pass"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}

                                {/* MOBILE ACTIONS - Endast synliga utanför studioläge */}
                                {!isStudioMode && (
                                    <div className="mt-8 flex gap-3 relative z-30">
                                        <button
                                            onClick={() => onSelectWorkout(workout, 'view')}
                                            className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 font-black text-center text-[10px] uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-95"
                                            style={{ touchAction: 'manipulation' }}
                                        >
                                            Visa pass
                                        </button>
                                        {isLoggable && (
                                            <button
                                                onClick={() => onSelectWorkout(workout, 'log')}
                                                className="flex-[1.5] px-4 py-3 rounded-2xl bg-primary text-white font-black text-center text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
                                                style={{ touchAction: 'manipulation' }}
                                            >
                                                Logga pass
                                            </button>
                                        )}
                                    </div>
                                )}
                                
                                {/* Dekorativ ikon bakom allt */}
                                <div className="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none z-0">
                                    <DumbbellIcon className="w-16 h-16" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-white dark:bg-gray-900/50 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 shadow-inner">
                    <div className="text-6xl mb-4 opacity-20">{searchTerm ? '🔍' : '📭'}</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {searchTerm ? 'Inga pass hittades' : 'Det finns inga pass publicerade i denna kategorin'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'Försök att söka på något annat.' : 'Vänligen välj en annan kategori.'}
                    </p>
                </div>
            )}
            
            {programToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-800">
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
                            <TrashIcon className="w-8 h-8 text-red-600 dark:text-red-500" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white text-center mb-2">Radera program?</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
                            Är du säker på att du vill radera <b>{programToDelete.title}</b>? Detta kan inte ångras.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setProgramToDelete(null)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition active:scale-95 disabled:opacity-50"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={async () => {
                                    if (!currentUser?.uid) return;
                                    setIsDeleting(true);
                                    try {
                                        await deleteCustomProgram(currentUser.uid, programToDelete.id);
                                        setProgramToDelete(null);
                                    } catch (e) {
                                        console.error('Failed to delete program', e);
                                    } finally {
                                        setIsDeleting(false);
                                    }
                                }}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-600/20 hover:brightness-110 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                {isDeleting ? 'Raderar...' : 'Radera'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
