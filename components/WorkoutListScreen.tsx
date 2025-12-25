
import React, { useMemo } from 'react';
import { Workout } from '../types';
import { useWorkout } from '../context/WorkoutContext';

interface WorkoutListScreenProps {
    passkategori: string;
    onSelectWorkout: (workout: Workout) => void;
}

export const WorkoutListScreen: React.FC<WorkoutListScreenProps> = ({ passkategori, onSelectWorkout }) => {
    const { workouts } = useWorkout();
    const workoutsForCategory = useMemo(() => {
        return workouts.filter(w => w.isPublished && w.category === passkategori);
    }, [workouts, passkategori]);
    
    return (
        <div className="w-full max-w-5xl mx-auto text-center">
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-8">{passkategori}</h1>
            {workoutsForCategory.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workoutsForCategory.map(workout => (
                        <div key={workout.id} className="relative group">
                            <button
                                onClick={() => onSelectWorkout(workout)}
                                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold p-6 rounded-lg transition-colors duration-200 flex flex-col items-start justify-start text-xl shadow-lg text-left h-48"
                            >
                                <span className="text-2xl font-bold text-primary mb-2">{workout.title}</span>
                                <p className="text-sm font-normal text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">{workout.coachTips}</p>
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-xl">Det finns inga publicerade pass i denna passkategori ännu.</p>
            )}
        </div>
    );
};
