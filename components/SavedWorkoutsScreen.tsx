import React from 'react';
import { Workout } from '../types';

interface SavedWorkoutsScreenProps {
    workouts: Workout[];
    onSelectWorkout: (workout: Workout) => void;
}

const SavedWorkoutsScreen: React.FC<SavedWorkoutsScreenProps> = ({ workouts, onSelectWorkout }) => {

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in pb-8">
            {workouts.length > 0 ? (
                <div className="space-y-4">
                    {workouts.map(workout => (
                        <div key={workout.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-gray-200 dark:border-gray-700 hover:bg-gray-200/50 dark:hover:bg-gray-700/80 transition-colors">
                            <div className="text-left flex-grow">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">{workout.title}</h2>
                                {workout.coachTips && (
                                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{workout.coachTips}</p>
                                )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                              <button
                                  onClick={() => onSelectWorkout(workout)}
                                  className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                  aria-label={`Visa passet ${workout.title}`}
                              >
                                  Visa
                              </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center p-12 bg-gray-100 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Du har inga sparade utkast ännu.</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Skapa ett nytt pass eller kopiera ett existerande för att se det här.</p>
                </div>
            )}
        </div>
    );
};

export default SavedWorkoutsScreen;
