
import { Workout, WorkoutBlock, Exercise, BankExercise } from '../types';

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

export const getSideLabel = (side?: 'V' | 'H' | 'V/H' | 'ALT' | null): string | null => {
    switch (side) {
        case 'V': return 'VÄNSTER';
        case 'H': return 'HÖGER';
        case 'V/H': return 'VÄNSTER/HÖGER';
        case 'ALT': return 'ALTERNERANDE';
        default: return null;
    }
};

// Helper to sanitize workout: unique instance ids, bank links via originalBankId, self-healing of old workouts
export const sanitizeWorkoutWithBank = (currentWorkout: Workout, currentBank: BankExercise[]): Workout => {
    const bankIds = new Set(currentBank.map(b => b.id));
    const seenInstanceIds = new Set<string>();
    let hasChanges = false;

    const newInstanceId = () => `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newBlocks = currentWorkout.blocks.map(block => {
        const newExercises = block.exercises.map(ex => {
            const next: Exercise = { ...ex };
            let changed = false;

            // 1. MIGRERING: gamla pass har bank-ID direkt i ex.id
            if (bankIds.has(next.id)) {
                next.originalBankId = next.originalBankId || next.id;
                next.id = newInstanceId();
                next.isFromBank = true;
                changed = true;
            }

            // 2. DUBBLETTSKYDD: varje rad måste ha unikt instans-ID
            if (seenInstanceIds.has(next.id)) {
                next.id = newInstanceId();
                changed = true;
            }
            seenInstanceIds.add(next.id);

            // 3. Validera bankkopplingen via originalBankId
            if (next.originalBankId && bankIds.has(next.originalBankId)) {
                if (!next.isFromBank) { next.isFromBank = true; changed = true; }
            } else {
                // Ingen giltig länk. Försök auto-matcha på namn.
                const match = currentBank.find(b => b.name.toLowerCase().trim() === next.name.toLowerCase().trim());
                if (match) {
                    next.originalBankId = match.id;
                    next.isFromBank = true;
                    next.loggingEnabled = next.loggingEnabled !== undefined ? next.loggingEnabled : false;
                    changed = true;
                } else if (next.isFromBank || next.originalBankId) {
                    // Död länk (borttagen ur banken) -> nedgradera till ad-hoc
                    next.originalBankId = null;
                    next.isFromBank = false;
                    next.loggingEnabled = false;
                    changed = true;
                }
            }

            if (changed) hasChanges = true;
            return next;
        });
        return { ...block, exercises: newExercises };
    });

    if (!hasChanges) return currentWorkout;
    return { ...currentWorkout, blocks: newBlocks };
};


