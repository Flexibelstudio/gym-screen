
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
