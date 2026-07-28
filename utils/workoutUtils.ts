
import { Workout, WorkoutBlock, Exercise, BankExercise } from '../types';
export { canonicalizeExerciseName } from '../data/exerciseAliases';

/**
 * Checks if a new exercise name conflicts with an existing exercise in the bank.
 * Compares case-insensitively, trimmed, and also against names without trailing parentheses
 * (e.g., "Bänkpress" matches "Bänkpress (Bench Press)").
 */
export function findDuplicateBankExercise<T extends { id: string; name: string }>(
    inputName: string,
    bank: T[]
): T | undefined {
    const rawInput = inputName.toLowerCase().trim();
    if (!rawInput) return undefined;
    const baseInput = rawInput.replace(/\s*\([^)]*\)$/, '').trim();

    return bank.find(ex => {
        const rawEx = ex.name.toLowerCase().trim();
        const baseEx = rawEx.replace(/\s*\([^)]*\)$/, '').trim();

        // Exact match
        if (rawInput === rawEx) return true;
        // Input matches exercise name without trailing parenthesis
        if (rawInput === baseEx) return true;
        // Exercise name matches input name without trailing parenthesis
        if (baseInput === rawEx) return true;
        // Both names without trailing parenthesis match
        if (baseInput && baseEx && baseInput === baseEx) return true;

        return false;
    });
}

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

export function isWorkoutMilestone(total: number): boolean {
  if (total <= 0) return false;
  if ([1, 5, 10, 25, 50, 75].includes(total)) return true;
  if (total <= 500) return total % 50 === 0;      // 100, 150, 200 ... 500
  if (total <= 1000) return total % 100 === 0;    // 600, 700 ... 1000
  return total % 250 === 0;                        // 1250, 1500 ...
}

export const getYearWeek = (date: Date) => {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo < 10 ? '0' + weekNo : weekNo}`;
};

export function isWorkoutVisibleNow(w: Workout, now: number = Date.now()): boolean {
    if (!w.isPublished) return false;
    if (w.publishAt && w.publishAt > now) return false;
    if (w.expiresAt && w.expiresAt <= now) return false;
    return true;
}

export function getWorkoutStatusInfo(w: Workout, now: number = Date.now()): { label: string; styleClass: string } {
    if (!w.isPublished) {
        return {
            label: 'Utkast',
            styleClass: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        };
    }
    if (w.publishAt && w.publishAt > now) {
        const dateStr = new Date(w.publishAt).toLocaleDateString('sv-SE');
        return {
            label: `Publiceras ${dateStr}`,
            styleClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        };
    }
    if (w.expiresAt && w.expiresAt <= now) {
        return {
            label: 'Visas inte längre',
            styleClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        };
    }
    return {
        label: 'Publicerad',
        styleClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    };
}


