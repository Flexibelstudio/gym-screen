import React from 'react';
import { Workout } from '../types';
import { StarIcon } from './icons';

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

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in pb-8">
            <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white">Övriga Pass</h1>
                <button
                    onClick={onCreateNewWorkout}
                    className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg shadow-md flex-shrink-0"
                >
                    Skapa Nytt Pass
                </button>
            </div>

            <div className="text-center p-4 mb-6 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    Pass markerade som favoriter (⭐) sparas permanent. Övriga utkast rensas automatiskt efter 24 timmar.
                </p>
            </div>
            {workouts.length > 0 ? (
                <div className="space-y-4">
                    {workouts.map(workout => (
                        <div key={workout.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-gray-200 dark:border-gray-700 hover:bg-gray-200/50 dark:hover:bg-gray-700/80 transition-colors">
                            <div className="text-left flex-grow">
                                <div className="flex items-center gap-2">
                                     {workout.isFavorite && <StarIcon filled={true} className="h-5 w-5 text-yellow-400 flex-shrink-0" />}
                                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{workout.title}</h2>
                                </div>
                                {workout.coachTips && (
                                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{workout.coachTips}</p>
                                )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                              <button
                                  onClick={() => onToggleFavorite(workout.id)}
                                  className="p-2 rounded-lg transition-colors bg-gray-200 dark:bg-gray-600 hover:bg-yellow-400/50 dark:hover:bg-yellow-400/20"
                                  aria-label={workout.isFavorite ? 'Ta bort från favoriter' : 'Lägg till som favorit'}
                                  title={workout.isFavorite ? 'Ta bort från favoriter' : 'Spara som favorit'}
                              >
                                  <StarIcon filled={!!workout.isFavorite} className={workout.isFavorite ? "text-yellow-400" : "text-gray-500"} />
                              </button>
                              <button
                                  onClick={() => onSelectWorkout(workout)}
                                  className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                  aria-label={`Visa passet ${workout.title}`}
                              >
                                  Visa
                              </button>
                               <button
                                  onClick={() => onEditWorkout(workout)}
                                  className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                  aria-label={`Redigera passet ${workout.title}`}
                              >
                                  Redigera
                              </button>
                              
                              {!isStudioMode && (
                                <button
                                  onClick={() => {
                                      if (window.confirm(`Är du säker på att du vill ta bort passet "${workout.title}"? Detta kan inte ångras.`)) {
                                          onDeleteWorkout(workout.id);
                                      }
                                  }}
                                  className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                  aria-label={`Ta bort passet ${workout.title}`}
                                >
                                  Ta bort
                                </button>
                              )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center p-12 bg-gray-100 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Du har inga sparade pass.</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Klicka på 'Skapa Nytt Pass' för att bygga ditt första pass.</p>
                </div>
            )}
        </div>
    );
};

export default SavedWorkoutsScreen;