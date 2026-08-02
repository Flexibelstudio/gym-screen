export interface TrainingProfile {
  repMin: number; repMax: number;
  targetPctMin: number; targetPctMax: number;
  targetPct?: number;       // det faktiskt gällande värdet (resolvat av getBlockProfile)
  rirTarget: number;        // eftersträvad reps i reserv
  restSeconds: number;      // vila mellan set
  hasWeightMath: boolean;   // styr om reps/%/RIR visas alls
}

export const TRAINING_PROFILES: Record<string, TrainingProfile> = {
  'STYRKA':      { repMin: 3,  repMax: 5,  targetPctMin: 85, targetPctMax: 90, rirTarget: 2, restSeconds: 240, hasWeightMath: true },
  'HYPERTROFI':  { repMin: 8,  repMax: 12, targetPctMin: 65, targetPctMax: 75, rirTarget: 1, restSeconds: 90,  hasWeightMath: true },
  'KONDITION':   { repMin: 15, repMax: 20, targetPctMin: 50, targetPctMax: 60, rirTarget: 2, restSeconds: 45,  hasWeightMath: true },
  'CORE/BÅL':    { repMin: 10, repMax: 20, targetPctMin: 0,  targetPctMax: 0,  rirTarget: 2, restSeconds: 45,  hasWeightMath: false },
  'BALANS':      { repMin: 8,  repMax: 15, targetPctMin: 0,  targetPctMax: 0,  rirTarget: 3, restSeconds: 45,  hasWeightMath: false },
  'TEKNIK':      { repMin: 3,  repMax: 8,  targetPctMin: 0,  targetPctMax: 0,  rirTarget: 4, restSeconds: 60,  hasWeightMath: false },
  'RÖRLIGHET':   { repMin: 0,  repMax: 0,  targetPctMin: 0,  targetPctMax: 0,  rirTarget: 0, restSeconds: 30,  hasWeightMath: false },
  'UPPVÄRMNING': { repMin: 0,  repMax: 0,  targetPctMin: 0,  targetPctMax: 0,  rirTarget: 0, restSeconds: 30,  hasWeightMath: false },
  'NEDVARVNING': { repMin: 0,  repMax: 0,  targetPctMin: 0,  targetPctMax: 0,  rirTarget: 0, restSeconds: 0,   hasWeightMath: false },
  'FINISHER':    { repMin: 10, repMax: 20, targetPctMin: 50, targetPctMax: 60, rirTarget: 0, restSeconds: 30,  hasWeightMath: true },
};
