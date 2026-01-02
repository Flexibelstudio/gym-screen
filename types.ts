// --- BEFINTLIGA TYPER (BEHÅLLNA FRÅN GAMLA VERSIONEN) ---

export interface InvoiceAdjustmentItem {
  description: string;
  amount: number;
}

export interface InvoiceDetails {
  regularItems: { description: string; quantity: number; price: number; total: number; }[];
  adjustmentItems: InvoiceAdjustmentItem[];
  subtotal: number;
  discountAmount: number;
  discountDescription: string;
  totalAmount: number;
  billingPeriod: string; // "November 2024"
  adjustmentPeriod: string; // "Oktober 2024"
  billingMonthForAction: string; // "2024-11"
}

export interface ExerciseOverride {
  imageUrl?: string;
}

export type UserRole = 'member' | 'coach' | 'organizationadmin' | 'systemowner';

// UPPDATERAD: Lagt till nya fält för profil (firstName, goals etc) samt 'member' i role
export interface UserData {
  uid: string;
  email: string;
  role: 'member' | 'coach' | 'organizationadmin' | 'systemowner'; 
  organizationId?: string; // Which organization they belong to
  adminRole?: 'superadmin' | 'admin'; // granular role for org admins
  termsAcceptedAt?: number; // Timestamp of when the admin ToS were accepted
  
  // -- NYA FÄLT FÖR MEDLEMME --
  goals?: MemberGoals;
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  photoUrl?: string;
}

export interface CustomPageTab {
  id: string;
  title: string;
  content: string; // Markdown content
}

export interface CustomPage {
  id: string;
  title: string; // This is the main title for the group of tabs
  tabs: CustomPageTab[];
}

export interface InfoMessage {
  id: string;
  internalTitle: string;
  headline: string;
  body: string;
  layout: 'text-only' | 'image-left' | 'image-right' | 'image-fullscreen' | 'video-fullscreen';
  imageUrl?: string; // base64 data URI
  videoUrl?: string; // e.g., URL to an MP4 file
  animation: 'fade' | 'slide-left' | 'slide-right';
  durationSeconds: number;
  startDate?: string; // ISO string
  endDate?: string;   // ISO string
  visibleInStudios: string[]; // Array of studio IDs, or ['all']
  disableOverlay?: boolean;
}

export interface InfoCarousel {
  isEnabled: boolean;
  messages: InfoMessage[];
}

export interface DisplayPost {
  id: string;
  internalTitle: string;
  layout: 'text-only' | 'image-fullscreen' | 'video-fullscreen' | 'image-left';
  headline?: string;
  body?: string;
  imageUrl?: string; // base64 data URI
  videoUrl?: string; // e.g., URL to an MP4 file
  durationSeconds: number;
  visibleInStudios: string[]; // Array of studio IDs, or ['all']
  startDate?: string; // ISO string
  endDate?: string;   // ISO string
  disableOverlay?: boolean;
  posts?: DisplayPost[]; // For nested structures if needed
}

export interface DisplayWindow {
  id: string;
  name: string;
  isEnabled: boolean;
  posts: DisplayPost[];
}

export interface CompanyDetails {
  legalName?: string;
  orgNumber?: string;
  billingAddress?: {
    street?: string;
    zip?: string;
    city?: string;
  };
  billingContact?: {
    email?: string; // Faktureringsmail
    name?: string;  // Kontaktperson namn
    emailContact?: string; // Kontaktperson e-post
    phone?: string; // Kontaktperson telefon
  };
}

// UPPDATERAD: Lagt till workoutLoggingPricePerMember
export interface SmartScreenPricing {
  firstScreenPrice: number;
  additionalScreenPrice: number;
  workoutLoggingPricePerMember?: number;
}

export interface ThemeDateRange {
  startMonth: number; // 1-12
  startDay: number;   // 1-31
  endMonth: number;   // 1-12
  endDay: number;     // 1-31
  useWeekNumber?: boolean;
  weekNumber?: number;
}

export interface SeasonalThemeSetting {
  id: ThemeOption;
  name: string;
  isEnabled: boolean;
  ranges: ThemeDateRange[];
}

export interface SystemSettings {
  pricing: SmartScreenPricing;
  seasonalThemes: SeasonalThemeSetting[];
}

// UPPDATERAD: Lagt till inviteCode
export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  logoUrlLight?: string;
  logoUrlDark?: string;
  primaryColor?: string; // Hex color code, e.g., '#FF5733'
  passwords: {
    coach: string;
    // superadmin password is now obsolete, replaced by user accounts
  };
  studios: Studio[];
  globalConfig: StudioConfig;
  customPages?: CustomPage[];
  infoCarousel?: InfoCarousel;
  displayWindows?: DisplayWindow[];
  companyDetails?: CompanyDetails;
  discountPercentage?: number; // Kept for backwards compatibility
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  exerciseOverrides?: Record<string, ExerciseOverride>;
  lastBilledMonth?: string; // Format "YYYY-MM", e.g. "2024-10"
  lastBilledDate?: number; // Timestamp
  lastActiveAt?: number; // Timestamp of last significant activity
  
  // -- NYTT FÄLT --
  inviteCode?: string;
}

export interface Studio {
    id: string;
    name: string;
    createdAt?: number; // Timestamp of creation for billing purposes
    // This now holds only the settings that are DIFFERENT from the global config.
    configOverrides?: Partial<StudioConfig>;
}

// UPPDATERAD: Lagt till nya Member-sidor på slutet
export enum Page {
  Home,
  WorkoutDetail,
  Timer,
  Coach,
  AIGenerator,
  FreestandingTimer,
  WorkoutBuilder,
  SimpleWorkoutBuilder,
  WorkoutList,
  SavedWorkouts,
  StudioSelection,
  SuperAdmin, // This now represents the "Organization Admin"
  SystemOwner, // New page for top-level system administration
  CustomContent, // For displaying dynamic, user-created pages
  IdeaBoard, // New page for handwritten notes & ideas
  RepsOnly, // For timer-less blocks
  CustomPageEditor,
  Hyrox,
  HyroxRaceList,
  HyroxRaceDetail,
  
  // -- NYA SIDOR --
  MemberDetail,
  AdminAnalytics,
  MemberProfile,
  MemberRegistry,
  MobileLog, // Added for deep link simulation
}

export enum TimerMode {
  Interval = 'Intervall',
  Tabata = 'TABATA',
  AMRAP = 'AMRAP',
  EMOM = 'EMOM',
  TimeCap = 'Time Cap',
  Stopwatch = 'Stoppur',
  NoTimer = 'Ingen Timer',
}

// WorkoutCategory is now Passkategori and a string to allow for admin-defined custom categories.
export type Passkategori = string;

export interface CustomCategoryWithPrompt {
  id: string;
  name: string;
  prompt: string;
  icon?: string; // Icon key, e.g., 'dumbbell', 'heart', 'yoga'
}

export type ThemeOption = 'none' | 'auto' | 'winter' | 'christmas' | 'newyear' | 'valentines' | 'easter' | 'midsummer' | 'summer' | 'halloween';

// UPPDATERAD: Lagt till enableWorkoutLogging och aiSettings
export interface StudioConfig {
  enableBreathingGuide?: boolean;
  enableNotes?: boolean;
  enableScreensaver?: boolean;
  screensaverTimeoutMinutes?: number;
  enableExerciseBank?: boolean;
  enableHyrox?: boolean;
  customCategories: CustomCategoryWithPrompt[];
  checkInImageEnabled?: boolean;
  checkInImageUrl?: string; // Stored as base64 data URI
  enableWarmup: boolean;
  seasonalTheme?: ThemeOption;
  
  // -- NYA INSTÄLLNINGAR --
  enableWorkoutLogging?: boolean;
  aiSettings?: {
    instructions?: string;
    tone?: string;
  };
}

export interface Exercise {
  id: string; // Will now be a unique instance ID
  bankId?: string; // Will store the original ID from the bank, if applicable
  name: string;
  reps?: string;
  description?: string;
  isFromBank?: boolean;
  isFromAI?: boolean;
  imageUrl?: string;
}

export interface BankExercise {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  imageUrl?: string;
}

export interface SuggestedExercise extends BankExercise {
  organizationId: string;
  sourceWorkoutTitle: string;
}

export interface TimerSettings {
  mode: TimerMode;
  reps?: number;
  workTime: number; // in seconds
  restTime: number; // in seconds
  rounds: number;
  prepareTime: number; // in seconds
  // New fields to explicitly store user's intent for laps setup
  specifiedLaps?: number;
  specifiedIntervalsPerLap?: number;
}

export interface WorkoutBlock {
  id: string;
  title: string;
  tag: string;
  setupDescription: string;
  settings: TimerSettings;
  exercises: Exercise[];
  followMe?: boolean;
  aiCoachNotes?: string;
  aiMagicPenSuggestions?: string[];
}

export interface StartGroup {
  id: string;
  name: string;
  participants: string; // Text field content, one name per line
  startTime?: number;
}

export interface Workout {
  id: string;
  title: string;
  coachTips: string;
  blocks: WorkoutBlock[];
  category?: Passkategori;
  isPublished?: boolean;
  organizationId?: string; // Which organization it belongs to
  isFavorite?: boolean;
  createdAt?: number;
  participants?: string[];
  hideExerciseImages?: boolean; // Kept for backward compatibility but effectively unused
  startGroups?: StartGroup[];
  startIntervalMinutes?: number;
  raceId?: string;
  aiCoachSummary?: string;
  isMemberDraft?: boolean;
}

export enum TimerStatus {
  Idle,
  Preparing,
  Running,
  Resting,
  Paused,
  Finished
}

export interface MenuItem {
  title: string;
  action: () => void;
  subTitle?: string;
  disabled?: boolean;
  colorClass?: string;
}

export interface Note {
  id: string;
  timestamp: number;
  text: string;
  imageUrl: string; // base64 data URI
}

export interface WorkoutResult {
  id: string;
  workoutId: string;
  workoutTitle: string;
  organizationId: string;
  participantName: string;
  startGroupName?: string;
  finishTime: number; // in seconds
  completedAt: number; // timestamp
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// New types for HYROX race results
export interface RaceResultItem {
  participant: string;
  time: number; // in seconds
  groupId: string;
}

export interface RaceStartGroup {
  id: string;
  name: string;
  participants: string[];
}

export interface Participant {
  id: string;
  name: string;
  startGroup: string;
  startTime?: number;
  finishTime?: number;
  isFinished?: boolean;
}

export interface Race {
  id: string;
  name: string;
  date: string;
  participants: Participant[];
}

export interface HyroxRace {
  id: string; // This is the raceId
  organizationId: string;
  raceName: string;
  createdAt: number; // Timestamp
  exercises: string[];
  startGroups: RaceStartGroup[];
  results: RaceResultItem[];
}

// --- HÄR BÖRJAR DE NYA TYPES SOM BEHÖVS FÖR MEDLEMSREGISTRET ---

// Hjälptyper för om nya komponenter importerar dem direkt
export interface Address {
    street: string;
    zip: string;
    city: string;
}

export interface ContactPerson {
    name: string;
    email: string;
    emailContact: string;
    phone: string;
}

export interface MemberGoals {
    hasSpecificGoals: boolean;
    selectedGoals: string[];
    targetDate?: string; // ISO Date string YYYY-MM-DD
}

export interface Member {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: 'active' | 'inactive';
    organizationId: string;
    createdAt: number;
    role: 'member';
    endDate?: string | null;
    goals?: MemberGoals;
}

export interface CheckInEvent {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    timestamp: number;
    organizationId: string;
    streak?: number;
}

export type MemberFeeling = 'top' | 'good' | 'ok' | 'heavy' | 'injured';
export type RepRange = '1-5' | '6-10' | '11-15' | '16+';

export interface ExerciseResult {
  exerciseId: string;
  blockId: string;
  exerciseName: string;
  weight?: number;
  reps?: RepRange; // Made optional
  distance?: number; // New: For cardio
  kcal?: number; // New: For cardio
}

export interface WorkoutLog {
  id: string;
  memberId: string;
  organizationId: string;
  workoutId: string;
  workoutTitle: string;
  date: number;
  source: 'qr_scan' | 'manual';
  rpe?: number;
  feeling?: MemberFeeling;
  tags?: string[];
  comment?: string;
  exerciseResults: ExerciseResult[];
}

export interface WorkoutQRPayload {
  oid: string;
  wid: string;
  ts: number;
}

export interface SubmitWorkoutLogRequest {
  organizationId: string;
  workoutId: string;
  workoutTitle: string;
  source: 'qr_scan' | 'manual';
  rpe?: number;
  feeling?: MemberFeeling;
  tags?: string[];
  comment?: string;
  exerciseResults: ExerciseResult[];
}

export interface SubmitWorkoutLogResponse {
    success: boolean;
    logId: string;
    message: string;
}