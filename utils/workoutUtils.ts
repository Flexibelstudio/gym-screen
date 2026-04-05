
import { Workout, WorkoutBlock, Exercise } from '../types';

/**
 * Skapar en djup kopia av ett träningspass och förbereder det som ett nytt utkast
 * med nya unika ID:n för alla block och övningar.
 */
export const deepCopyAndPrepareAsNew = (workoutToCopy: Workout): Workout => {
    // 1. Skapa en djup kopia
    const newWorkout: Workout = JSON.parse(JSON.stringify(workoutToCopy));
    
    // 2. Nollställ/Uppdatera metadata
    newWorkout.id = `workout-${Date.now()}`;
    newWorkout.title = workoutToCopy.title ? `Kopia av ${workoutToCopy.title}` : 'Ny Kopia';
    newWorkout.isPublished = false;
    newWorkout.isFavorite = false;
    newWorkout.createdAt = Date.now();
    
    // 3. Behåll organisationstillhörighet om den finns
    newWorkout.organizationId = workoutToCopy.organizationId || '';
    
    // 4. Rensa bort sessionsspecifik data
    delete (newWorkout as any).participants; 

    // 5. Säkerställ att blocks är en array och regenerera ID:n
    const sourceBlocks = workoutToCopy.blocks || [];
    newWorkout.blocks = sourceBlocks.map((block: WorkoutBlock, bIndex: number) => {
        const newBlock = { ...block };
        newBlock.id = `block-${Date.now()}-${bIndex}`;
        
        // Säkerställ att exercises är en array
        const sourceExercises = block.exercises || [];
        newBlock.exercises = sourceExercises.map((ex: Exercise, eIndex: number) => ({
            ...ex,
            id: `ex-${Date.now()}-${bIndex}-${eIndex}`
        }));
        
        return newBlock;
    });

    return newWorkout;
};

/**
 * Calculates 1RM using the Epley formula.
 * Returns null if reps > 10 (as it becomes inaccurate) or if inputs are invalid.
 */
export const calculate1RM = (weight: number | string, reps: number | string): number | null => {
    const w = typeof weight === 'string' ? parseFloat(weight) : weight;
    const r = typeof reps === 'string' ? parseFloat(reps) : reps;
    
    if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0 && r <= 10) {
        if (r === 1) return Math.round(w);
        const oneRm = w * (1 + r / 30);
        return Math.round(oneRm);
    }
    return null;
};
