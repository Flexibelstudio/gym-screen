import { MemberFeeling } from '../../../types';

export interface BlockGroup {
  blockId: string;
  blockTitle: string;
  exercises: {
      result: LocalExerciseResult;
      originalIndex: number;
  }[];
}

export interface LocalSetDetail {
    weight: string;
    reps: string;
    time?: string;
    distance?: string;
    kcal?: string;
    completed: boolean;
    rir?: number | null;
}

export interface LastPerformanceRecord {
    weight?: number | null;
    reps?: string | number | null;
    time?: string | number | null;
    distance?: string | number | null;
    kcal?: string | number | null;
    rir?: number | null;
    note?: string;
    trackingFields?: string[];
    sets?: { weight: number; reps: string; rir: number | null }[];
}

export interface LocalExerciseResult {
  exerciseId: string;
  exerciseName: string;
  setDetails: LocalSetDetail[];
  isBodyweight?: boolean;
  blockId: string;
  blockTitle: string;
  coachAdvice?: string;
  note?: string;
  trackingFields?: ('time' | 'distance' | 'kcal' | 'reps' | 'weight')[];
  groupId?: string;
  groupColor?: string;
  originalBankId?: string | null;
}

export interface LogData {
  rpe: number | null;
  feeling: MemberFeeling | null;
  tags: string[];
  comment: string;
  imageUrl?: string;
}

export interface WorkoutData {
  id: string;
  title: string;
  coachTips?: string;
  benchmarkId?: string;
  aiProgressionPrompt?: string;
  usePreGame?: boolean;
  blocks: {
      id: string;
      title: string;
      tag: string;
      exercises: { id: string; name: string; exerciseName?: string; loggingEnabled?: boolean }[];
      settings: { rounds: number; mode: string };
  }[];
}
