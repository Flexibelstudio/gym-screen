import { AdminActivity } from '../types';

const SENSITIVE_REGEX = /key|secret|token|kod|code|password|lösen|email|mail|telefon|phone|personnummer|ssn|stripe/i;

export const FIELD_LABELS: Record<string, string> = {
  enableTimer: 'Fristående Timer',
  enableOtherWorkouts: 'Övriga Pass',
  enableWorkoutGames: 'Träningslekar (Smart Play)',
  enableHyrox: 'Visa Event & Tävlingar',
  enableFitnessBenchmarks: 'Styrka & Kondition (jämförelser)',
  enableSummerChallenge: 'Sommarutmaning (Sommar-Sisu)',
  enableWorkoutLogging: 'Medlemsappen',
  commonActivities: 'Pass för egen loggning',
  enableNotes: 'AI Whiteboard',
  enableExerciseBank: 'Övningsbank',
  enableScreensaver: 'Skärmsläckare',
  screensaverTimeoutMinutes: 'Skärmsläckare (minuter)',
  soundProfile: 'Timerljud',
  seasonalTheme: 'Säsongstema (Dekorationer & effekter)',
  navigationControlPosition: 'Navigering (Knappar)',
  customCategories: 'Passkategorier',
  inviteCode: 'Inbjudningskod (Medlem)',
  coachCode: 'Inbjudningskod (Coach)',
  name: 'Organisationsnamn',
  subdomain: 'Subdomän',
  companyName: 'Företagsnamn',
  orgNumber: 'Organisationsnummer',
  address: 'Adress',
  postalCode: 'Postnummer',
  city: 'Ort',
  contactEmail: 'Kontakt-epost',
  contactPhone: 'Kontakttelefon',
};

function formatVal(val: any): string {
  if (val === undefined || val === null || val === '') return '–';
  if (typeof val === 'boolean') return val ? 'på' : 'av';
  return String(val);
}

function isValueAllowed(key: string, val: any): boolean {
  if (SENSITIVE_REGEX.test(key)) return false;
  if (typeof val === 'boolean' || typeof val === 'number') return true;
  if (typeof val === 'string') {
    return val.length < 60 && !SENSITIVE_REGEX.test(val);
  }
  return false;
}

export function buildChangeList(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
  fieldLabels: Record<string, string> = FIELD_LABELS
): AdminActivity['changes'] {
  const b = before || {};
  const a = after || {};

  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  const changes: NonNullable<AdminActivity['changes']> = [];

  for (const key of keys) {
    const valB = b[key];
    const valA = a[key];

    if (
      key === 'globalConfig' &&
      valB && typeof valB === 'object' && !Array.isArray(valB) &&
      valA && typeof valA === 'object' && !Array.isArray(valA)
    ) {
      const nestedChanges = buildChangeList(valB, valA, fieldLabels);
      if (nestedChanges) {
        changes.push(...nestedChanges);
      }
      continue;
    }

    if (JSON.stringify(valB) !== JSON.stringify(valA)) {
      const label = fieldLabels[key] || key;
      const bAllowed = valB === undefined || valB === null || isValueAllowed(key, valB);
      const aAllowed = valA === undefined || valA === null || isValueAllowed(key, valA);

      if (bAllowed && aAllowed) {
        changes.push({
          field: key,
          label,
          from: formatVal(valB),
          to: formatVal(valA),
          valueHidden: false
        });
      } else {
        changes.push({
          field: key,
          label,
          valueHidden: true
        });
      }
    }
  }

  return changes.length > 0 ? changes : undefined;
}
