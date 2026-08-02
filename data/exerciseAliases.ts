// Canonical exercise alias map
// Maps canonical exercise name (lowercase, trimmed) to list of alias variants (lowercase, trimmed)

/**
 * MEDVETET UTELÄMNADE ÖVNINGAR MED PARENTES:
 * - 'dips (på bänk/låda)' — parentesen är en precisering, inte en översättning. Bänkdips och vanliga dips är olika övningar.
 * - 'thruster (med skivstång)' — precisering (kan även köras med hantlar).
 * - 'triceps extensions (overhead)' — precisering (olika varianter).
 * - 'stöt (push jerk/split jerk)' — parentesen listar två olika varianter.
 * - 'landmine rotation (twist)' — osäkert, låg volym.
 * - 'flexibel hälsostudio (offline)' — inte en övning.
 *
 * KVARSTÅENDE MEDVETET BESLUT:
 * 'knäböj' mappas till 'knäböj (back squat)' trots att 'knäböj (air squat)' också finns.
 * Motivering: den som skriver kortformen "Knäböj" avser i praktiken skivstångsknäböj, och air squat
 * körs utan vikt så en felaktig hopslagning skulle ändå inte påverka viktbaserade personbästa.
 * Air squat ska fortsatt ALDRIG ingå i någon aliasgrupp.
 */

export const EXERCISE_ALIASES: Record<string, string[]> = {
    'knäböj': ['knäböj', 'knäböj (back squat)'],
    'bänkpress': ['bänkpress', 'bänkpress (bench press)'],
    'marklyft': ['marklyft', 'marklyft (deadlift)'],
    'armhävningar': ['armhävningar', 'armhävningar (push-ups)'],
    'utfall': ['utfall', 'utfall (lunges)'],
    'planka': ['planka', 'planka (plank)'],
    'höga knän': ['höga knän', 'höga knän (high knees)'],
    'upphopp': ['upphopp', 'upphopp (jump squats)'],
    'benlyft': ['benlyft', 'benlyft (leg raises)'],
    'utfallshopp': ['utfallshopp', 'utfallshopp (jumping lunges)'],
    'turkish get-up': ['turkish get-up', 'turkish get-up (tgu)'],
    'enarmsrodd': ['enarmsrodd', 'enarmsrodd (single arm row)'],
    'frontböj': ['frontböj', 'frontböj (front squat)'],
    'militärpress': ['militärpress', 'militärpress (strict press)'],
    'ryck': ['ryck', 'ryck (snatch)'],
    'frivändning': ['frivändning', 'frivändning (power clean)'],
    'skivstångsrodd': ['skivstångsrodd', 'skivstångsrodd (bent-over row)'],
    'rumänska marklyft': ['rumänska marklyft', 'rumänska marklyft (rdl)'],
    'hantelpress': ['hantelpress', 'hantelpress (dumbbell bench press)'],
    'hantelflyes': ['hantelflyes', 'hantelflyes (dumbbell flys)'],
    'hantelrodd': ['hantelrodd', 'hantelrodd (dumbbell row)'],
    'axelpress': ['axelpress', 'axelpress (shoulder press)'],
    'sidolyft': ['sidolyft', 'sidolyft (lateral raises)'],
    'gående utfall': ['gående utfall', 'gående utfall (walking lunges)'],
    'rodd': ['rodd', 'rodd (rowing)'],
    'medicinbollskast': ['medicinbollskast', 'medicinbollskast (slams)'],
    'wall sit': ['wall sit', 'wall sit (jägarvila)', 'jägarvila']
};

export const EXERCISE_DISPLAY_NAMES: Record<string, string> = {
  'knäböj': 'Knäböj',
  'bänkpress': 'Bänkpress',
  'marklyft': 'Marklyft',
  'armhävningar': 'Armhävningar',
  'utfall': 'Utfall',
  'planka': 'Planka',
  'höga knän': 'Höga Knän',
  'upphopp': 'Upphopp',
  'benlyft': 'Benlyft',
  'utfallshopp': 'Utfallshopp',
  'turkish get-up': 'Turkish Get-up',
  'enarmsrodd': 'Enarmsrodd',
  'frontböj': 'Frontböj',
  'militärpress': 'Militärpress',
  'ryck': 'Ryck',
  'frivändning': 'Frivändning',
  'skivstångsrodd': 'Skivstångsrodd',
  'rumänska marklyft': 'Rumänska Marklyft',
  'hantelpress': 'Hantelpress',
  'hantelflyes': 'Hantelflyes',
  'hantelrodd': 'Hantelrodd',
  'axelpress': 'Axelpress',
  'sidolyft': 'Sidolyft',
  'gående utfall': 'Gående Utfall',
  'rodd': 'Rodd',
  'medicinbollskast': 'Medicinbollskast',
  'wall sit': 'Wall Sit',
};

// Reverse map for O(1) canonical lookup
const aliasToCanonicalMap: Record<string, string> = {};

for (const [canonical, aliases] of Object.entries(EXERCISE_ALIASES)) {
    for (const alias of aliases) {
        aliasToCanonicalMap[alias.toLowerCase().trim().replace(/\s+/g, ' ')] = canonical;
    }
}

/**
 * Normalizes an exercise name to its canonical form if an alias exists.
 * Lowercase, trimmed, collapsed whitespace. Returns original cleaned string if no alias found.
 */
export function canonicalizeExerciseName(name: string): string {
    if (!name) return '';
    const cleaned = name.toLowerCase().trim().replace(/\s+/g, ' ');
    return aliasToCanonicalMap[cleaned] || cleaned;
}
