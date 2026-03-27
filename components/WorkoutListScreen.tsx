
import React, { useMemo, useState } from 'react';
import { Workout } from '../types';
import { useWorkout } from '../context/WorkoutContext';
import { SearchIcon, DumbbellIcon, ClockIcon } from './icons';
import { useAuth } from '../context/AuthContext';

interface WorkoutListScreenProps {
    passkategori?: string;
    onSelectWorkout: (workout: Workout, action?: 'view' | 'log') => void;
}

export const WorkoutListScreen: React.FC<WorkoutListScreenProps> = ({ passkategori, onSelectWorkout }) => {
    const { workouts } = useWorkout();
    const { isStudioMode } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredWorkouts = useMemo(() => {
        return workouts.filter(w => {
            const matchesCategory = !passkategori || w.category === passkategori;
            const matchesSearch = (w.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (w.coachTips && (w.coachTips || '').toLowerCase().includes(searchTerm.toLowerCase()));
            return w.isPublished && matchesCategory && matchesSearch;
        });
    }, [workouts, passkategori, searchTerm]);
    
    return (
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 animate-fade-in">
            <div className="text-center mb-10">
                <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                    {passkategori || 'Välj Träningspass'}
                </h1>
                <div className="h-1.5 w-24 bg-primary mx-auto rounded-full mb-4"></div>
            </div>

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
                                    
                                    <h3 className="text-2xl font-black text-primary dark:text-primary leading-tight mb-4 min-h-[1.5em]">
                                        {workout.title || 'Namnlöst pass'}
                                    </h3>
                                    
                                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium line-clamp-4 overflow-hidden">
                                        {workout.coachTips || "Välkommen till dagens pass. Fokusera på teknik och intensitet!"}
                                    </p>
                                </div>

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
        </div>
    );
};
