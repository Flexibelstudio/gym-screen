
import React from 'react';
import { Workout } from '../types';
import { StarIcon, PencilIcon, InformationCircleIcon, ClockIcon, PlayIcon, TrashIcon } from './icons';

interface SavedWorkoutsScreenProps {
    workouts: Workout[];
    onSelectWorkout: (workout: Workout) => void;
    onEditWorkout: (workout: Workout) => void;
    onDeleteWorkout: (workoutId: string) => void;
    onToggleFavorite: (workoutId: string) => void;
    onCreateNewWorkout: () => void;
    isStudioMode: boolean;
}

const SavedWorkoutsScreen: React.FC<SavedWorkoutsScreenProps> = ({ workouts, onSelectWorkout, onEditWorkout, onDeleteWorkout, onToggleFavorite, onCreateNewWorkout, isStudioMode }) => {

    const getTimeLeft = (createdAt: number) => {
        const now = Date.now();
        const diff = (createdAt + 24 * 60 * 60 * 1000) - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        return hours > 0 ? `${hours}h` : '<1h';
    };

    return (
        <div className="w-full max-w-6xl mx-auto animate-fade-in pb-12 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight">Övriga Pass</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Dina sparade utkast, justeringar och favoriter.</p>
                </div>
            </div>

            <div className="flex items-start gap-4 p-6 mb-10 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100 dark:border-yellow-800/50 shadow-sm">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-800/40 rounded-full text-yellow-600 dark:text-yellow-400 flex-shrink-0">
                    <InformationCircleIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-1">Rensning av utkast</h3>
                    <p className="text-yellow-700 dark:text-yellow-300 text-sm leading-relaxed">
                        Här sparas dina utkast i 24 timmar. Klicka på stjärnan (<StarIcon filled className="w-3 h-3 inline" />) för att spara ett pass permanent.
                    </p>
                </div>
            </div>

            {workouts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workouts.map(workout => (
                        <div 
                            key={workout.id} 
                            className="group bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-300 flex flex-col h-full"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start gap-4 mb-4">
                                <div className="min-w-0">
                                    {!workout.isFavorite && !workout.isPublished && (
                                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md mb-2 animate-pulse">
                                            <ClockIcon className="w-3 h-3" /> Raderas om {getTimeLeft(workout.createdAt)}
                                        </span>
                                    )}
                                    {workout.isMemberDraft && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md mb-2">
                                            <PencilIcon className="w-3 h-3" /> Justering
                                        </span>
                                    )}
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                        {workout.title}
                                    </h2>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(workout.id); }}
                                    className={`p-2 rounded-full transition-all ${workout.isFavorite ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500" : "bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-yellow-500"}`}
                                    aria-label={workout.isFavorite ? 'Ta bort från favoriter' : 'Lägg till som favorit'}
                                >
                                    <StarIcon filled={!!workout.isFavorite} className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-grow mb-6">
                                {workout.coachTips ? (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                                        {workout.coachTips}
                                    </p>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Inga anteckningar.</p>
                                )}
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                        {workout.blocks.length} block
                                    </span>
                                    {workout.category && (
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300">
                                            {workout.category}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="pt-4 mt-auto border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
                                <button
                                    onClick={() => onSelectWorkout(workout)}
                                    className="flex-grow bg-primary/10 hover:bg-primary hover:text-white text-primary font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <PlayIcon className="w-4 h-4" />
                                    <span>Starta</span>
                                </button>
                                
                                <button
                                    onClick={() => onEditWorkout(workout)}
                                    className="p-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                                    title="Redigera"
                                >
                                    <PencilIcon className="w-5 h-5" />
                                </button>

                                {!isStudioMode && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Är du säker på att du vill ta bort passet "${workout.title}"? Detta kan inte ångras.`)) {
                                                onDeleteWorkout(workout.id);
                                            }
                                        }}
                                        className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors"
                                        title="Ta bort"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 mb-4">
                        <StarIcon className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inga sparade pass</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md text-center text-sm">
                        Justeringar du gör i passbyggaren hamnar här. Markera dem som favoriter för att spara dem permanent.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SavedWorkoutsScreen;
