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
                    {filteredWorkouts.map(workout => (
                        <button
                            key={workout.id}
                            onClick={() => onSelectWorkout(workout, 'view')}
                            className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col text-left p-8"
                        >
                            <div className="flex-grow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-wrap gap-2">
                                        {!passkategori && workout.category && (
                                            <span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/10">
                                                {workout.category}
                                            </span>
                                        )}
                                        {workout.logType === 'quick' && !isStudioMode && (
                                            <div className="flex items-center gap-1 text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300 px-3 py-1 rounded-lg border border-purple-100 dark:border-purple-800">
                                                <ClockIcon className="w-3.5 h-3.5" />
                                                <span>SNABBLOGG</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-primary dark:text-primary leading-tight mb-4 line-clamp-2">
                                    {workout.title}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-4">
                                    {workout.coachTips || "Välkommen till dagens pass. Fokusera på teknik och intensitet!"}
                                </p>
                            </div>

                            {!isStudioMode && (
                                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 px-4 py-3 rounded-2xl bg-primary text-white font-black text-center text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
                                        Logga pass
                                    </div>
                                </div>
                            )}
                            
                            {/* Decorative element */}
                            <div className="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <DumbbellIcon className="w-16 h-16" />
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white dark:bg-gray-900/50 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 shadow-inner">
                    <div className="text-6xl mb-4 opacity-20">🔍</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inga pass hittades</h3>
                    <p className="text-gray-500 dark:text-gray-400">Försök att söka på något annat eller byt kategori.</p>
                </div>
            )}
        </div>
    );
};