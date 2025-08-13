import React from 'react';
import { Workout } from '../types';

interface PublishedWorkoutsScreenProps {
    workouts: Workout[];
    onDelete: (workoutId: string) => void;
}

export const PublishedWorkoutsScreen: React.FC<PublishedWorkoutsScreenProps> = ({ workouts, onDelete }) => {

    const handleDelete = (workoutId: string, workoutTitle: string) => {
        if (window.confirm(`Är du säker på att du vill ta bort passet "${workoutTitle}" permanent? Detta kan inte ångras.`)) {
            onDelete(workoutId);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in pb-8">
            <p className="text-center text-gray-400 mb-8 max-w-2xl mx-auto">
                Här listas alla pass som är synliga för medlemmar på hemskärmen. Att ta bort ett pass här raderar det permanent från systemet.
            </p>

            {workouts.length > 0 ? (
                <div className="space-y-4">
                    {workouts.map(workout => (
                        <div key={workout.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center border border-gray-700 hover:bg-gray-700/50 transition-colors">
                            <div>
                                <h2 className="text-xl font-bold text-white">{workout.title}</h2>
                                <p className="text-sm text-gray-400">
                                    Kategori: <span className="font-semibold text-primary">{workout.category || 'Ej kategoriserad'}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => handleDelete(workout.id, workout.title)}
                                className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex-shrink-0"
                                aria-label={`Ta bort passet ${workout.title}`}
                            >
                                Ta bort
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center p-12 bg-gray-800 rounded-lg border border-dashed border-gray-700">
                    <p className="text-gray-400 text-lg">Det finns inga publicerade pass att visa.</p>
                </div>
            )}
        </div>
    );
};