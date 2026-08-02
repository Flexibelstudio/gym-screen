import { WorkoutLog } from '../types';
import { calculate1RM } from './workoutUtils';
import { getStrengthScore, getRowingScore, matchesLift, formatRowingTime } from './fitnessBenchmarks';

export interface ScorePoint {
    date: string;
    timestamp: number;
    score: number;
    label?: string;
}

const formatDay = (ms: number): string =>
    new Date(ms).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });

/**
 * Bästa 1RM ur ett enskilt övningsresultat. Set med fler än tio repetitioner
 * hoppas över eftersom Epley blir opålitlig där.
 */
const bestOneRmFromResult = (ex: any): number => {
    let best = 0;
    const sets = ex?.setDetails || [];

    if (sets.length > 0) {
        sets.forEach((s: any) => {
            const w = parseFloat(s.weight);
            const r = parseFloat(s.reps);
            if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0 && r <= 10) {
                const oneRm = calculate1RM(w, r);
                if (oneRm && oneRm > best) best = oneRm;
            }
        });
    } else {
        const w = parseFloat(ex?.weight);
        const r = parseFloat(ex?.reps);
        if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0 && r <= 10) {
            const oneRm = calculate1RM(w, r);
            if (oneRm && oneRm > best) best = oneRm;
        }
    }

    return best;
};

/**
 * Tidsserie för styrkepoängen. En punkt per pass där något av de tre lyften
 * förbättrades, från och med den dag alla tre finns loggade.
 */
export function buildStrengthScoreHistory(
    logs: WorkoutLog[] | undefined | null,
    gender: string | undefined | null,
    age: number | null | undefined,
    bodyWeightKg: number | null | undefined
): ScorePoint[] {
    if (!gender || age === null || age === undefined || bodyWeightKg === null || bodyWeightKg === undefined) return [];

    const sortedLogs = [...(logs || [])].sort((a, b) => a.date - b.date);
    const best: Record<string, number> = {};
    const points: ScorePoint[] = [];

    sortedLogs.forEach(log => {
        if (!log.exerciseResults) return;
        let changed = false;

        log.exerciseResults.forEach((ex: any) => {
            (['squat', 'bench', 'deadlift'] as const).forEach(lift => {
                if (!matchesLift(ex.exerciseName, lift)) return;
                const oneRm = bestOneRmFromResult(ex);
                if (oneRm > (best[lift] || 0)) {
                    best[lift] = oneRm;
                    changed = true;
                }
            });
        });

        if (!changed) return;
        if (!best.squat || !best.bench || !best.deadlift) return;

        const result = getStrengthScore(
            { squat: best.squat, bench: best.bench, deadlift: best.deadlift },
            gender, age, bodyWeightKg
        );
        if (!result) return;

        points.push({ date: formatDay(log.date), timestamp: log.date, score: result.score });
    });

    return points;
}

/**
 * Tidsserie för konditionspoängen. En punkt per genomfört helt 2000-metersprov.
 */
export function buildRowingScoreHistory(
    logs: WorkoutLog[] | undefined | null,
    gender: string | undefined | null,
    age: number | null | undefined
): ScorePoint[] {
    if ((gender !== 'male' && gender !== 'female') || age === null || age === undefined) return [];

    return (logs || [])
        .filter((l: any) =>
            l.benchmarkId === 'platform_row_2000m' &&
            typeof l.benchmarkValue === 'number' &&
            l.benchmarkValue > 0 &&
            (l.benchmarkDistance ?? 2000) === 2000
        )
        .sort((a, b) => a.date - b.date)
        .map((l: any) => {
            const score = getRowingScore(gender, age, l.benchmarkValue);
            if (score === null) return null;
            return {
                date: formatDay(l.date),
                timestamp: l.date,
                score,
                label: formatRowingTime(l.benchmarkValue)
            };
        })
        .filter(Boolean) as ScorePoint[];
}

/**
 * Antal dagar sedan senaste loggade pass. null om inget pass finns.
 */
export function getDaysSinceLastLog(logs: WorkoutLog[] | undefined | null): number | null {
    const dates = (logs || []).map(l => l.date).filter(d => typeof d === 'number' && d > 0);
    if (dates.length === 0) return null;
    const latest = Math.max(...dates);
    return Math.floor((Date.now() - latest) / (24 * 60 * 60 * 1000));
}

/**
 * Genomsnittligt antal pass per vecka över de senaste veckorna.
 */
export function getSessionsPerWeek(logs: WorkoutLog[] | undefined | null, weeks: number = 8): number {
    if (weeks <= 0) return 0;
    const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;
    const count = (logs || []).filter(l => (l.date || 0) >= cutoff).length;
    return Math.round((count / weeks) * 10) / 10;
}
