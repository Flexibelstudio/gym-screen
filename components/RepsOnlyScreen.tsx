
import React from 'react';
import { WorkoutBlock, Exercise, Organization } from '../types';
import { useWorkout } from '../context/WorkoutContext';

interface RepsOnlyScreenProps {
    block: WorkoutBlock;
    onFinish: () => void;
    onShowImage: (url: string) => void; // Kept prop for compatibility
    organization: Organization | null;
}

// Helper to ensure units are displayed
const formatReps = (reps: string | undefined): string => {
    if (!reps) return '';
    const trimmed = reps.trim();
    if (!trimmed) return '';

    // If the string contains only numbers, ranges (-), commas, or slashes, append 'reps'
    const isNumericLike = /^[\d\s\-\.,/]+$/.test(trimmed);

    if (isNumericLike) {
        return `${trimmed} reps`;
    }
    return trimmed;
};

export const RepsOnlyScreen: React.FC<RepsOnlyScreenProps> = ({ block, onFinish, onShowImage, organization }) => {
    const { activeWorkout } = useWorkout();

    const formatExerciseName = (ex: Exercise | null) => {
      if (!ex) return null;
      const formattedReps = formatReps(ex.reps);
      return formattedReps ? `${formattedReps} ${ex.name}` : ex.name;
    };
    
    return (
        <div className="w-full h-full flex-grow flex flex-col dark:bg-black">
            <div className="w-full max-w-5xl mx-auto flex-shrink-0 flex flex-col items-center justify-center p-6 md:p-8 rounded-2xl bg-gray-700">
                <h1 className="text-4xl md:text-6xl lg:text-7xl text-white uppercase tracking-widest">{block.title}</h1>
                <p className="text-xl text-gray-300 mt-2">Utför övningarna i din egen takt.</p>
            </div>
            
            <div className="w-full bg-transparent flex-grow overflow-y-auto mt-6">
                <div className="w-full max-w-5xl mx-auto p-4">
                    <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
                        <div className="space-y-2 mt-4">
                            {block.exercises.map((ex) => {
                                return (
                                <div key={ex.id} className="p-4 rounded-lg bg-gray-200 dark:bg-slate-900 text-gray-800 dark:text-gray-200">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-grow">
                                            <p className="text-4xl md:text-6xl font-black leading-tight">{formatExerciseName(ex)}</p>
                                            {ex.description && (
                                                <p className="text-xl text-gray-600 dark:text-gray-400 mt-2">{ex.description}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full flex-shrink-0 py-4">
                <div className="w-full max-w-5xl mx-auto flex items-center justify-center">
                    <button onClick={onFinish} className="font-semibold py-3 px-8 rounded-lg flex items-center justify-center gap-2 text-md transition-colors text-white shadow-md bg-primary hover:brightness-95">
                        Klar med blocket
                    </button>
                </div>
            </div>
        </div>
    );
};
