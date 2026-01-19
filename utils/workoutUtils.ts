
import { Workout, WorkoutBlock, Exercise } from '../types';

/**
 * Skapar en djup kopia av ett träningspass och förbereder det som ett nytt utkast
 * med nya unika ID:n för alla block och övningar.
 */
export const deepCopyAndPrepareAsNew = (workoutToCopy: Workout): Workout => {
    const newWorkout = JSON.parse(JSON.stringify(workoutToCopy));
    newWorkout.id = `workout-${Date.now()}`;
    newWorkout.title = `KOPIA - ${workoutToCopy.title}`;
    newWorkout.isPublished = false;
    newWorkout.isFavorite = false;
    newWorkout.createdAt = Date.now();
    delete newWorkout.participants; 

    newWorkout.blocks = newWorkout.blocks.map((block: WorkoutBlock, bIndex: number) => {
        block.id = `block-${Date.now()}-${bIndex}`;
        block.exercises = block.exercises.map((ex: Exercise, eIndex: number) => {
            ex.id = `ex-${Date.now()}-${bIndex}-${eIndex}`;
            return ex;
        });
        return block;
    });
    return newWorkout;
};
