
import { Workout, WorkoutBlock, Exercise, BankExercise } from '../types';
import { canonicalizeExerciseName } from '../data/exerciseAliases';
import { TrainingProfile, TRAINING_PROFILES } from '../data/trainingProfiles';
export { canonicalizeExerciseName, TRAINING_PROFILES };
export type { TrainingProfile };

/**
 * Returns default logging state for a bank-linked exercise based on block tag.
 * Returns true for STYRKA, HYPERTROFI, KONDITION, FINISHER, false for all other tags or missing tag.
 */
export function getDefaultLoggingForBlockTag(tag?: string): boolean {
  if (!tag) return false;
  let tagKey = tag.trim().toUpperCase();
  if (tagKey === 'CORE' || tagKey === 'BÅL') {
    tagKey = 'CORE/BÅL';
  }
  const LOGGING_ENABLED_TAGS = ['STYRKA', 'HYPERTROFI', 'KONDITION', 'FINISHER'];
  return LOGGING_ENABLED_TAGS.includes(tagKey);
}

/**
 * Returns the training profile for a given workout block, merging base profile defaults with profileOverrides.
 * Returns null if block.useTrainingProfile is not true.
 * Falls back to 'RÖRLIGHET' profile if the tag is missing or not found in TRAINING_PROFILES.
 */
export function getBlockProfile(block: WorkoutBlock): TrainingProfile | null {
  if (block.useTrainingProfile !== true) {
    return null;
  }
  let tagKey = (block.tag || 'RÖRLIGHET').trim().toUpperCase();
  if (tagKey === 'CORE' || tagKey === 'BÅL') {
    tagKey = 'CORE/BÅL';
  }
  const baseProfile = TRAINING_PROFILES[tagKey] || TRAINING_PROFILES['RÖRLIGHET'];
  const overrides = block.profileOverrides || {};

  let resolvedTargetPct = 0;
  if (baseProfile.hasWeightMath && !(baseProfile.targetPctMin === 0 && baseProfile.targetPctMax === 0)) {
    if (overrides.targetPct !== undefined) {
      resolvedTargetPct = overrides.targetPct;
    } else {
      resolvedTargetPct = Math.round(((baseProfile.targetPctMin + baseProfile.targetPctMax) / 2) / 5) * 5;
    }
  }

  return {
    ...baseProfile,
    ...(overrides.repMin !== undefined ? { repMin: overrides.repMin } : {}),
    ...(overrides.repMax !== undefined ? { repMax: overrides.repMax } : {}),
    ...(overrides.rirTarget !== undefined ? { rirTarget: overrides.rirTarget } : {}),
    ...(overrides.restSeconds !== undefined ? { restSeconds: overrides.restSeconds } : {}),
    ...(overrides.targetPct !== undefined ? { targetPctMin: overrides.targetPct, targetPctMax: overrides.targetPct } : {}),
    targetPct: resolvedTargetPct,
  };
}

export function getBlockPlanParts(
    profile: TrainingProfile | null | undefined,
    includeIntensity: boolean = true
): string[] {
    if (!profile) return [];
    const parts: string[] = [];
    if (profile.repMin > 0 && profile.repMax > 0) {
        parts.push(profile.repMin === profile.repMax
            ? `Reps ${profile.repMin}`
            : `Reps ${profile.repMin}–${profile.repMax}`);
    }
    if (includeIntensity && profile.hasWeightMath !== false && profile.targetPct !== undefined && profile.targetPct > 0) {
        parts.push(`${profile.targetPct} % av 1RM`);
    }
    if (profile.rirTarget !== undefined && profile.rirTarget !== null) {
        parts.push(profile.rirTarget > 0
            ? `${profile.rirTarget} reps i reserv`
            : 'till failure');
    }
    if (profile.restSeconds > 0) {
        parts.push(`vila ${formatRestSeconds(profile.restSeconds)}`);
    }
    if (parts.length < 2) return [];
    return parts;
}

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

    // Exakt träff går alltid först, i hela banken. Annars kan en basnamnsträff
    // tidigare i listan vinna över den exakta: banken sorteras på namn, så
    // "Knäböj (Air Squat)" testas före "Knäböj (Back Squat)" och deras basnamn är
    // båda "knäböj". Air Squat och Back Squat är olika övningar.
    const exact = bank.find(ex => ex.name.toLowerCase().trim() === rawInput);
    if (exact) return exact;

    return bank.find(ex => {
        const rawEx = ex.name.toLowerCase().trim();
        const baseEx = rawEx.replace(/\s*\([^)]*\)$/, '').trim();

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
 * Calculates 1RM using the Epley formula, taking optional Reps In Reserve (RIR) into account.
 * Returns null if inputs are invalid, if reps > 10 without RIR, or if reps > 12 with RIR.
 */
export function getSetScore(weight: number, reps: number, oneRm: number): number {
    return oneRm > 0 ? oneRm * 10000 : (weight > 0 ? weight * 100 + reps : reps);
}

export const calculate1RM = (weight: number | string, reps: number | string, rir?: number | null): number | null => {
    const w = typeof weight === 'string' ? parseFloat(weight) : weight;
    const r = typeof reps === 'string' ? parseFloat(reps) : reps;
    if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) return null;

    const hasRir = rir !== undefined && rir !== null && !isNaN(Number(rir));
    const reserve = hasRir ? Math.max(0, Number(rir)) : 0;

    // Utan RIR: oförändrad spärr vid fler än 10 reps
    if (!hasRir && r > 10) return null;
    // Med RIR: tillåt upp till 12 loggade reps
    if (hasRir && r > 12) return null;

    // Epley blir opålitlig över 12 effektiva reps
    const effective = Math.min(12, r + reserve);
    if (effective === 1) return Math.round(w);
    return Math.round(w * (1 + effective / 30));
};

export function getRepsForPercentage(pct: number): number {
  if (!pct || pct <= 0) return 0;
  if (pct >= 100) return 1;
  return Math.max(1, Math.min(30, Math.round((100 / pct - 1) * 30)));
}

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

/**
 * Tilldelade pass (PT) hör till EN medlem. De ska aldrig visas på skärmen i lokalen
 * och aldrig i någon annan medlems app. Passet är fortfarande publicerat — det är
 * tilldelningen, inte publiceringen, som styr vem som ser det.
 */
export function isWorkoutVisibleForMember(w: Workout, memberUid?: string | null): boolean {
    // PT-kategorin räknas som personlig även innan någon tilldelats — ett
    // otilldelat PT-pass ska inte ligga öppet i gymmets utbud under tiden.
    if (w.category === PT_CATEGORY && !w.assignedToUid) return false;
    if (!w.assignedToUid) return true;
    return !!memberUid && w.assignedToUid === memberUid;
}

/**
 * Ett pass går att logga om minst en övning har loggning påslagen. Saknas det
 * helt kan medlemmen inte logga något — och då är en tom loggsiffra inte ett
 * tecken på att ingen tränat passet, utan på att det inte går.
 */
export function isWorkoutLoggable(w: Workout): boolean {
    return (w.blocks || []).some(b => (b.exercises || []).some(e => e.loggingEnabled === true));
}

/** Skärmen visar aldrig tilldelade pass, oavsett vem som är inloggad. */
export function isWorkoutVisibleOnScreen(w: Workout): boolean {
    return !w.assignedToUid && w.category !== PT_CATEGORY;
}

export function getMemberLocationIds(user?: { locationId?: string; locationIds?: string[] } | null): string[] {
    if (!user) return [];
    const set = new Set<string>();
    if (user.locationId && user.locationId.trim()) set.add(user.locationId.trim());
    if (user.locationIds && Array.isArray(user.locationIds)) {
        user.locationIds.forEach(id => {
            if (id && id.trim()) set.add(id.trim());
        });
    }
    return Array.from(set);
}

export function isWorkoutVisibleForLocations(w: Workout, memberLocationIds: string[], now: number = Date.now(), memberUid?: string | null): boolean {
    if (!isWorkoutVisibleNow(w, now)) return false;
    if (!isWorkoutVisibleForMember(w, memberUid)) return false;
    if (!w.locationIds || w.locationIds.length === 0) return true;
    if (!memberLocationIds || memberLocationIds.length === 0) return false;
    return w.locationIds.some(id => memberLocationIds.includes(id));
}

/**
 * Reserverad kategori för pass som skapas i den förenklade passbyggaren, alltså via
 * AI-whiteboarden och anteckningarna. Den finns inte i gymmets customCategories och
 * ska inte läggas dit — Övriga pass har en egen ingång på startsidan och en egen
 * skärm. Den ska aldrig markeras som isLocked, eftersom det betyder dold i appen.
 */
export const OTHER_CATEGORY = 'Övriga pass';

/**
 * Reserverad kategori för pass som byggs åt en enskild medlem (PT). Precis som
 * Övriga pass finns den INTE i gymmets customCategories. Pass i den här kategorin
 * visas aldrig på skärmen och aldrig i gymmets vanliga passlistor — de når bara
 * den medlem passet tilldelats. Byter man till en riktig kategori beter sig
 * passet som vilket pass som helst igen.
 */
export const PT_CATEGORY = 'PT-pass';

export function getWorkoutVisibilityIssues(
    w: Workout,
    customCategories?: { name: string; isLocked?: boolean }[],
    assumePublished?: boolean
): { issues: string[]; hidden: boolean } {
    const issues: string[] = [];
    if (!w.isPublished && !assumePublished) return { issues, hidden: false };

    const cat = (w.category || '').trim();
    if (!cat || cat === 'Ej kategoriserad' || cat === 'AI Genererat') {
        issues.push('Ingen passkategori vald. Passet syns inte på startsidan i appen. Medlemmen hittar det bara genom att öppna en kategori och sedan välja filtret Alla.');
    } else if (cat === PT_CATEGORY) {
        if (!w.assignedToUid) {
            issues.push('PT-passet är inte tilldelat någon medlem än — ingen kan se det.');
        }
    } else if (cat !== OTHER_CATEGORY && customCategories && customCategories.length > 0) {
        const cfg = customCategories.find(c => c.name === cat);
        if (!cfg) {
            issues.push(`Kategorin "${cat}" finns inte bland gymmets kategorier.`);
        } else if (cfg.isLocked) {
            issues.push(`Kategorin "${cat}" är låst och kräver lösenord i appen.`);
        }
    }

    const appOff = w.showInApp === false;
    const studioOff = w.showInStudio === false;
    if (appOff && studioOff) {
        issues.push('Avstängt både i medlemsappen och på skärmen.');
    } else if (appOff) {
        issues.push('Visas inte i medlemsappen.');
    } else if (studioOff) {
        issues.push('Visas inte på skärmen.');
    }

    return { issues, hidden: appOff && studioOff };
}

export function getWorkoutStatusInfo(
    w: Workout,
    now: number = Date.now(),
    customCategories?: { name: string; isLocked?: boolean }[]
): { label: string; styleClass: string } {
    if (!w.isPublished) {
        if (w.publishAt && w.publishAt > now) {
            const dateStr = new Date(w.publishAt).toLocaleDateString('sv-SE');
            return {
                label: `Utkast · ${dateStr}`,
                styleClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            };
        }
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
    const vis = getWorkoutVisibilityIssues(w, customCategories);
    if (vis.hidden) {
        return {
            label: 'Publicerad · dold',
            styleClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        };
    }
    return {
        label: 'Publicerad',
        styleClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    };
}

export function getTargetWeightForExercise(params: {
  exerciseName: string;
  personalBests: Record<string, any>;
  history: Record<string, any>;
  userId?: string;
  mode: 'normal' | 'fatigued';
  prescribedPct?: number | null;
  sessionPct?: number | null;
}): {
  base: number | null;
  scaled: number | null;
  targetPct: number | null;
  source: 'targetPct' | 'history' | 'none';
  pctSource: 'coach' | 'session' | 'none';
  current1RM: number | null;
} {
  const { exerciseName, personalBests, history, mode, prescribedPct, sessionPct } = params;
  const canon = canonicalizeExerciseName(exerciseName);

  let pb: any = null;
  for (const key of Object.keys(personalBests || {})) {
    if (canonicalizeExerciseName(key) === canon) {
      const cand = personalBests[key];
      if (!pb || (cand?.calculated1RM || 0) > (pb?.calculated1RM || 0)) pb = cand;
    }
  }

  let lastPerf: any = null;
  for (const key of Object.keys(history || {})) {
    if (canonicalizeExerciseName(key) === canon) { lastPerf = history[key]; break; }
  }

  let current1RM: number | undefined = undefined;
  if (pb) {
    if (pb.calculated1RM !== undefined && pb.calculated1RM > 0) current1RM = Math.round(pb.calculated1RM);
    else if (pb.weight > 0) current1RM = calculate1RM(pb.weight, pb.reps || 1) || undefined;
  } else if (lastPerf) {
    const w = parseFloat(lastPerf.weight as any) || 0;
    const r = parseFloat(lastPerf.reps as any) || 0;
    if (w > 0 && r > 0 && r <= 10) current1RM = calculate1RM(w, r) || undefined;
  }

  let targetPct: number | null = null;
  let pctSource: 'coach' | 'session' | 'none' = 'none';

  if (sessionPct !== undefined && sessionPct !== null && sessionPct > 0) {
    targetPct = sessionPct;
    pctSource = 'session';
  } else if (prescribedPct !== undefined && prescribedPct !== null && prescribedPct > 0) {
    targetPct = prescribedPct;
    pctSource = 'coach';
  }

  let base: number | null = null;
  let source: 'targetPct' | 'history' | 'none' = 'none';

  if (current1RM && current1RM > 0 && targetPct && targetPct > 0) {
    base = Math.round(current1RM * (targetPct / 100) * 2) / 2;
    source = 'targetPct';
  } else {
    pctSource = 'none';
    const lastWeight = parseFloat(lastPerf?.weight as any) || 0;
    if (lastWeight > 0) { base = lastWeight; source = 'history'; }
  }

  if (base === null) return { base: null, scaled: null, targetPct, source: 'none', pctSource: 'none', current1RM: current1RM ?? null };
  // Samma rutnät som base, alltså närmaste halvkilo. Ett 2,5-rutnät förvanskar
  // nedskalningen vid låga vikter: bas 21 kg skulle ge 20 i stället för 18,9.
  const scaled = mode === 'fatigued' ? Math.round(base * 0.9 * 2) / 2 : base;
  return { base, scaled, targetPct, source, pctSource, current1RM: current1RM ?? null };
}

export function getRestGuidelineForPercentage(pct: number): string {
  if (!pct || pct <= 0) return '';
  if (pct >= 85) return '3–5 min';
  if (pct >= 75) return '2–3 min';
  if (pct >= 65) return '1,5–2 min';
  return '1–1,5 min';
}

export function getRestSecondsForPercentage(pct: number): number {
  if (!pct || pct <= 0) return 0;
  if (pct >= 85) return 240;
  if (pct >= 75) return 150;
  if (pct >= 65) return 105;
  return 75;
}

export function formatRestSeconds(sec: number): string {
  if (!sec || sec <= 0) return '';
  if (sec % 60 === 0) return `${sec / 60} min`;
  if (sec >= 90) return `${Math.round(sec / 60 * 10) / 10} min`.replace('.', ',');
  return `${sec} s`;
}


