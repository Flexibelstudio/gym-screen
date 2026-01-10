
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
            const matchesSearch = w.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (w.coachTips && w.coachTips.toLowerCase().includes(searchTerm.toLowerCase()));
            return w.isPublished && matchesCategory && matchesSearch;
        });
    }, [workouts, passkategori, searchTerm]);
    
    return (
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 animate-fade-in">
            <div className="text-center mb-6">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
                    {passkategori || 'Välj Träningspass'}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {passkategori ? `Visar pass i ${passkategori}` : 'Hitta passet du vill utföra.'}
                </p>
            </div>

            {/* Sökfält */}
            <div className="relative max-w-xl mx-auto mb-8">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Sök på passets namn..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent shadow-inner transition-all"
                />
            </div>

            {filteredWorkouts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {filteredWorkouts.map(workout => (
                        <div
                            key={workout.id}
                            onClick={() => onSelectWorkout(workout, 'view')}
                            className={`group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer`}
                        >
                            <div className="p-6 flex-grow">
                                <div className="flex justify-between items-start mb-3">
                                    {!passkategori && workout.category && (
                                        <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/10">
                                            {workout.category}
                                        </span>
                                    )}
                                    {workout.logType === 'quick' && !isStudioMode && (
                                        <div className="flex items-center gap-1 text-[9px] font-black text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-100 dark:border-purple-800">
                                            <ClockIcon className="w-3 h-3" />
                                            <span>SNABBLOGG</span>
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-1 mb-2">
                                    {workout.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                    {workout.coachTips || "Inga specifika tips angivna."}
                                </p>
                            </div>

                            {/* Knappraden visas endast för medlemmar i appen, inte i Studiovyn */}
                            {!isStudioMode && (
                                <div className="px-6 pb-6 pt-2 flex flex-col sm:flex-row gap-3">
                                    {workout.showDetailsToMember !== false && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onSelectWorkout(workout, 'view'); }}
                                            className="flex-1 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                                        >
                                            Visa pass
                                        </button>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onSelectWorkout(workout, 'log'); }}
                                        className="flex-[1.5] px-4 py-3 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 transform active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        Logga pass
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <div className="text-4xl mb-3">🔍</div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Inga matchningar</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Prova ett annat sökord.</p>
                </div>
            )}
        </div>
    );
};
