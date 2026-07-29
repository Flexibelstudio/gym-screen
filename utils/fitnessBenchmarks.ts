import {
  LEVEL_NAMES,
  ROWING_LEVEL_NAMES,
  STRENGTH_RATIO_STANDARDS,
  STRENGTH_AGE_FACTORS,
  LIFT_ALIASES,
  ROWING_2000M_STANDARDS,
} from '../data/fitnessStandards';

export function getAgeFromBirthDate(birthDate: string | undefined | null, ref: Date = new Date()): number | null {
  if (!birthDate || typeof birthDate !== 'string') return null;
  const parts = birthDate.trim().split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  let age = ref.getFullYear() - year;
  const m = (ref.getMonth() + 1) - month;
  if (m < 0 || (m === 0 && ref.getDate() < day)) {
    age--;
  }
  if (age < 0) return null;
  return age;
}

export function getStrengthAgeFactor(age: number): number {
  if (isNaN(age)) return 1.0;
  const clampedAge = Math.max(15, Math.min(90, age));

  if (clampedAge <= STRENGTH_AGE_FACTORS[0][0]) {
    return STRENGTH_AGE_FACTORS[0][1];
  }
  const lastIdx = STRENGTH_AGE_FACTORS.length - 1;
  if (clampedAge >= STRENGTH_AGE_FACTORS[lastIdx][0]) {
    return STRENGTH_AGE_FACTORS[lastIdx][1];
  }

  for (let i = 0; i < STRENGTH_AGE_FACTORS.length - 1; i++) {
    const [age1, f1] = STRENGTH_AGE_FACTORS[i];
    const [age2, f2] = STRENGTH_AGE_FACTORS[i + 1];
    if (clampedAge >= age1 && clampedAge <= age2) {
      if (age1 === age2) return f1;
      return f1 + ((clampedAge - age1) * (f2 - f1)) / (age2 - age1);
    }
  }
  return 1.0;
}

export interface StrengthAssessment {
  level: number; // 0 to 5
  levelName: string;
  thresholdsKg: number[];
  nextLevelKg: number | null;
  averageKg: number;
}

export function getStrengthAssessment(
  lift: 'squat' | 'bench' | 'deadlift' | 'press' | 'clean' | 'frontsquat' | string,
  gender: string | undefined | null,
  age: number | undefined | null,
  bodyWeightKg: number | undefined | null,
  oneRM: number | undefined | null
): StrengthAssessment | null {
  if (gender !== 'male' && gender !== 'female') return null;
  if (age === undefined || age === null || isNaN(age) || age <= 0) return null;
  if (bodyWeightKg === undefined || bodyWeightKg === null || isNaN(bodyWeightKg) || bodyWeightKg <= 0) return null;
  if (oneRM === undefined || oneRM === null || isNaN(oneRM) || oneRM <= 0) return null;

  const standards = STRENGTH_RATIO_STANDARDS[lift];
  if (!standards) return null;

  const ratios = standards[gender as 'male' | 'female'];
  if (!ratios) return null;

  const ageFactor = getStrengthAgeFactor(age);
  const thresholdsKg = ratios.map((r) => Math.round(r * bodyWeightKg * ageFactor * 2) / 2);

  let level = 0;
  for (let i = 0; i < thresholdsKg.length; i++) {
    if (oneRM >= thresholdsKg[i]) {
      level = i + 1;
    }
  }

  const levelName = LEVEL_NAMES[level] || LEVEL_NAMES[0];
  const nextLevelKg = level === 5 ? null : thresholdsKg[level];
  const averageKg = thresholdsKg[2]; // Level 3 "Stark" (50th percentile)

  return {
    level,
    levelName,
    thresholdsKg,
    nextLevelKg,
    averageKg,
  };
}

export function parseRowingTime(t: string | undefined | null): number {
  if (!t || typeof t !== 'string') return 0;
  const trimmed = t.trim();
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const min = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    if (isNaN(min) || isNaN(sec)) return 0;
    return min * 60 + sec;
  }
  const secOnly = parseFloat(trimmed);
  return isNaN(secOnly) ? 0 : secOnly;
}

export function formatRowingTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00.0';
  const roundedSec = Math.round(seconds * 10) / 10;
  const minutes = Math.floor(roundedSec / 60);
  const remSec = roundedSec - minutes * 60;
  const secStr = remSec.toFixed(1).padStart(4, '0');
  return `${minutes}:${secStr}`;
}

export interface RowingAssessment {
  level: number; // 0 to 5
  levelName: string;
  thresholdsSec: number[];
  nextLevelSec: number | null;
  averageSec: number;
}

export function getRowingAssessment(
  gender: string | undefined | null,
  age: number | undefined | null,
  timeSeconds: number | undefined | null
): RowingAssessment | null {
  if (gender !== 'male' && gender !== 'female') return null;
  if (age === undefined || age === null || isNaN(age) || age <= 0) return null;
  if (timeSeconds === undefined || timeSeconds === null || isNaN(timeSeconds) || timeSeconds <= 0) return null;

  const genderTable = ROWING_2000M_STANDARDS[gender as 'male' | 'female'];
  if (!genderTable) return null;

  const ageKeys = Object.keys(genderTable)
    .map(Number)
    .sort((a, b) => a - b);
  const clampedAge = Math.max(15, Math.min(90, age));

  let rawThresholdsSec: number[] = [];

  if (clampedAge <= ageKeys[0]) {
    rawThresholdsSec = genderTable[ageKeys[0]].map(parseRowingTime);
  } else if (clampedAge >= ageKeys[ageKeys.length - 1]) {
    rawThresholdsSec = genderTable[ageKeys[ageKeys.length - 1]].map(parseRowingTime);
  } else {
    for (let i = 0; i < ageKeys.length - 1; i++) {
      const a1 = ageKeys[i];
      const a2 = ageKeys[i + 1];
      if (clampedAge >= a1 && clampedAge <= a2) {
        const times1 = genderTable[a1].map(parseRowingTime);
        const times2 = genderTable[a2].map(parseRowingTime);
        rawThresholdsSec = times1.map((t1, idx) => {
          const t2 = times2[idx];
          return t1 + ((clampedAge - a1) * (t2 - t1)) / (a2 - a1);
        });
        break;
      }
    }
  }

  const thresholdsSec = rawThresholdsSec.map((s) => Math.round(s * 10) / 10);

  // Rowing: lower time is better
  let level = 0;
  for (let i = 0; i < thresholdsSec.length; i++) {
    if (timeSeconds <= thresholdsSec[i]) {
      level = i + 1;
    }
  }

  const levelName = ROWING_LEVEL_NAMES[level] || ROWING_LEVEL_NAMES[0];
  const nextLevelSec = level === 5 ? null : thresholdsSec[level];
  const averageSec = thresholdsSec[2]; // Level 3 "Stark"

  return {
    level,
    levelName,
    thresholdsSec,
    nextLevelSec,
    averageSec,
  };
}

export function findLift1RM(
  personalBests: Record<string, any> | Array<any> | undefined | null,
  lift: 'squat' | 'bench' | 'deadlift' | 'press' | 'clean' | 'frontsquat' | string
): number | null {
  if (!personalBests) return null;

  const aliases = LIFT_ALIASES[lift];
  if (!aliases || !Array.isArray(aliases)) return null;

  let max1RM: number | null = null;

  if (Array.isArray(personalBests)) {
    for (const item of personalBests) {
      if (!item || !item.exerciseName) continue;
      const nameClean = String(item.exerciseName).toLowerCase().trim();
      if (aliases.includes(nameClean)) {
        const val =
          typeof item.calculated1RM === 'number' && item.calculated1RM > 0
            ? item.calculated1RM
            : typeof item.weight === 'number' && item.weight > 0
            ? item.weight
            : null;
        if (val !== null) {
          if (max1RM === null || val > max1RM) {
            max1RM = val;
          }
        }
      }
    }
  } else if (typeof personalBests === 'object') {
    for (const alias of aliases) {
      const aliasClean = alias.toLowerCase().trim();
      let pb = personalBests[aliasClean] || personalBests[alias];

      if (!pb) {
        for (const key of Object.keys(personalBests)) {
          if (key.toLowerCase().trim() === aliasClean) {
            pb = personalBests[key];
            break;
          }
        }
      }

      if (pb) {
        const val =
          typeof pb.calculated1RM === 'number' && pb.calculated1RM > 0
            ? pb.calculated1RM
            : typeof pb.weight === 'number' && pb.weight > 0
            ? pb.weight
            : null;
        if (val !== null) {
          if (max1RM === null || val > max1RM) {
            max1RM = val;
          }
        }
      }
    }
  }

  return max1RM;
}
