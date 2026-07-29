// Nivåer (percentiler bland tränande): 1 Nybörjare (5%), 2 Motionär (20%), 3 Stark (50%), 4 Mycket stark (80%), 5 Elit (95%). Under nivå 1 = nivå 0 ("På väg").
export const LEVEL_NAMES = ['På väg', 'Nybörjare', 'Motionär', 'Stark', 'Mycket stark', 'Elit'];
export const ROWING_LEVEL_NAMES = ['På väg', 'Nybörjare', 'Motionär', 'Vältränad', 'Mycket vältränad', 'Elit'];

// Trösklar som andel av kroppsvikt (1RM / kroppsvikt), ordning [nivå1..nivå5]. Källa: Strength Level community standards.
export const STRENGTH_RATIO_STANDARDS: Record<string, { male: number[]; female: number[] }> = {
  squat:    { male: [0.75, 1.25, 1.75, 2.25, 2.75], female: [0.50, 0.75, 1.25, 1.75, 2.25] },
  bench:    { male: [0.50, 1.00, 1.25, 1.50, 2.00], female: [0.30, 0.50, 0.75, 1.10, 1.45] },
  deadlift: { male: [1.00, 1.50, 2.00, 2.50, 3.00], female: [0.50, 1.00, 1.25, 1.75, 2.50] },
  press:    { male: [0.35, 0.55, 0.80, 1.05, 1.35], female: [0.20, 0.35, 0.50, 0.70, 0.95] },
};

// Åldersfaktor (multipliceras på trösklarna). Samma för alla lyft och kön. Linjär interpolation mellan stegen; klampa ålder till [15, 90].
export const STRENGTH_AGE_FACTORS: [number, number][] = [
  [15, 0.85], [20, 0.97], [25, 1.00], [30, 1.00], [35, 1.00], [40, 1.00],
  [45, 0.95], [50, 0.89], [55, 0.82], [60, 0.75], [65, 0.67], [70, 0.61],
  [75, 0.55], [80, 0.49], [85, 0.44], [90, 0.39],
];

import { EXERCISE_ALIASES } from './exerciseAliases';

// Vilka PB-namn (lowercase, trimmade) som räknas per lyft. OBS: "knäböj (air squat)" får ALDRIG matchas.
export const LIFT_ALIASES: Record<string, string[]> = {
  squat:    EXERCISE_ALIASES['knäböj'] || ['knäböj', 'knäböj (back squat)'],
  bench:    EXERCISE_ALIASES['bänkpress'] || ['bänkpress', 'bänkpress (bench press)'],
  deadlift: EXERCISE_ALIASES['marklyft'] || ['marklyft', 'marklyft (deadlift)'],
  press:    [...(EXERCISE_ALIASES['axelpress'] || ['axelpress', 'axelpress (shoulder press)']),
             ...(EXERCISE_ALIASES['militärpress'] || ['militärpress', 'militärpress (strict press)'])],
};

// 2000 m rodd, sluttider "mm:ss.s", ordning [nivå1..nivå5]. Källa: Rowing Level standards. Linjär interpolation (i sekunder) mellan åldersstegen; klampa till [15, 90].
export const ROWING_2000M_STANDARDS: Record<string, Record<number, string[]>> = {
  male: {
    15: ['08:48.6','08:14.4','07:40.9','07:09.7','06:41.9'],
    20: ['08:17.6','07:45.4','07:13.9','06:44.5','06:18.3'],
    25: ['08:10.6','07:38.8','07:07.8','06:38.8','06:13.0'],
    30: ['08:06.9','07:35.4','07:04.6','06:35.9','06:10.2'],
    35: ['08:13.6','07:41.6','07:10.4','06:41.3','06:15.3'],
    40: ['08:23.7','07:51.1','07:19.2','06:49.5','06:23.0'],
    45: ['08:33.8','08:00.5','07:28.0','06:57.7','06:30.7'],
    50: ['08:43.9','08:10.0','07:36.8','07:05.9','06:38.3'],
    55: ['08:59.6','08:24.7','07:50.6','07:18.7','06:50.3'],
    60: ['09:11.4','08:35.7','08:00.8','07:28.2','06:59.2'],
    65: ['09:29.9','08:53.0','08:17.0','07:43.3','07:13.3'],
    70: ['09:56.8','09:18.2','08:40.4','08:05.2','07:33.8'],
    75: ['10:15.9','09:36.1','08:57.1','08:20.7','07:48.3'],
    80: ['10:46.8','10:05.0','09:24.0','08:45.8','08:11.8'],
    85: ['11:26.8','10:42.4','09:58.9','09:18.3','08:42.2'],
    90: ['12:36.6','11:47.6','10:59.7','10:15.1','09:35.3'],
  },
  female: {
    15: ['11:04.0','10:06.6','09:11.7','08:21.7','07:38.3'],
    20: ['10:16.3','09:22.9','08:32.0','07:45.6','07:05.3'],
    25: ['10:08.2','09:15.5','08:25.3','07:39.5','06:59.7'],
    30: ['10:14.2','09:21.0','08:30.2','07:44.0','07:03.9'],
    35: ['10:31.4','09:36.7','08:44.5','07:57.1','07:15.8'],
    40: ['10:51.4','09:55.0','09:01.2','08:12.2','07:29.6'],
    45: ['10:58.5','10:01.5','09:07.1','08:17.6','07:34.5'],
    50: ['11:05.6','10:08.0','09:13.0','08:22.9','07:39.4'],
    55: ['11:26.4','10:27.0','09:30.2','08:38.6','07:53.7'],
    60: ['11:50.2','10:48.7','09:50.0','08:56.6','08:10.2'],
    65: ['12:14.9','11:11.3','10:10.5','09:15.3','08:27.2'],
    70: ['12:47.3','11:40.9','10:37.4','09:39.7','08:49.6'],
    75: ['13:10.8','12:02.3','10:56.9','09:57.5','09:05.8'],
    80: ['14:01.8','12:48.9','11:39.4','10:36.1','09:41.0'],
    85: ['15:16.6','13:57.2','12:41.4','11:32.5','10:32.6'],
    90: ['17:48.7','16:16.2','14:47.8','13:27.5','12:17.6'],
  },
};
