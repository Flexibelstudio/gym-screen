
export type UserRole = 'member' | 'coach' | 'organizationadmin' | 'systemowner';

export interface ExerciseOverride {
  imageUrl?: string;
}

export interface PersonalBest {
  id: string; // Usually standardized exercise name
  exerciseName: string;
  weight: number;
  date: number; // Timestamp
}

export interface InvoiceAdjustmentItem {
  description: string;
  amount: number;
}

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
  SuperAdmin, 
  SystemOwner, 
  CustomContent, 
  IdeaBoard, 
  RepsOnly, 
  CustomPageEditor,
  Hyrox,
  HyroxRaceList,
  HyroxRaceDetail,
  MemberDetail,
  AdminAnalytics,
  MemberProfile,
  MemberRegistry,
  MobileLog,
  MyStrength, 
}

export enum TimerMode {
  Interval = 'Interval',
  Tabata = 'Tabata',
  AMRAP = 'AMRAP',
  EMOM = 'EMOM',
  TimeCap = 'TimeCap',
  Stopwatch = 'Stopwatch',
  NoTimer = 'NoTimer'
}

export enum TimerStatus {
  Idle = 'Idle',
  Preparing = 'Preparing',
  Running = 'Running',
  Resting = 'Resting',
  Paused = 'Paused',
  Finished = 'Finished'
}

export interface TimerSettings {
  mode: TimerMode;
  workTime: number; // seconds
  restTime: number; // seconds
  rounds: number;
  prepareTime: number; // seconds
  specifiedLaps?: number;
  specifiedIntervalsPerLap?: number;
  direction?: 'up' | 'down';
}

export interface Exercise {
  id: string;
  name: string;
  reps?: string;
  description?: string;
  imageUrl?: string;
  isFromBank?: boolean;
  isFromAI?: boolean;
  loggingEnabled?: boolean;
}

export interface WorkoutBlock {
  id: string;
  title: string;
  tag: string;
  setupDescription?: string;
  followMe: boolean;
  settings: TimerSettings;
  exercises: Exercise[];
  aiCoachNotes?: string;
  aiMagicPenSuggestions?: string[];
}

export type WorkoutLogType = 'detailed' | 'quick';

export interface Workout {
  id: string;
  title: string;
  coachTips?: string;
  blocks: WorkoutBlock[];
  category: string;
  isPublished: boolean;
  isFavorite?: boolean;
  createdAt: number;
  organizationId: string; // Made required based on usage context often assuming it
  showDetailsToMember?: boolean;
  logType?: WorkoutLogType;
  isMemberDraft?: boolean;
  participants?: string[]; // For races
  startGroups?: StartGroup[]; // For races
  startIntervalMinutes?: number; // For races
  aiCoachSummary?: string;
}

export type Passkategori = string;

export interface CustomCategoryWithPrompt {
  id: string;
  name: string;
  prompt: string;
  icon?: string;
}

export type ThemeOption = 'none' | 'auto' | 'winter' | 'christmas' | 'newyear' | 'valentines' | 'easter' | 'midsummer' | 'summer' | 'halloween';

export interface StudioConfig {
  enableScreensaver?: boolean;
  screensaverTimeoutMinutes?: number;
  enableExerciseBank?: boolean;
  customCategories: CustomCategoryWithPrompt[];
  enableHyrox?: boolean;
  enableNotes?: boolean;
  enableWorkoutLogging?: boolean;
  checkInImageEnabled?: boolean;
  checkInImageUrl?: string;
  seasonalTheme?: ThemeOption;
  aiSettings?: {
      tone?: string;
      instructions?: string;
  };
}

export interface Studio {
  id: string;
  name: string;
  createdAt?: number;
  configOverrides?: Partial<StudioConfig>;
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
        email?: string;
        name?: string;
        emailContact?: string;
        phone?: string;
    };
}

export interface CustomPageTab {
    id: string;
    title: string;
    content: string;
}

export interface CustomPage {
  id: string;
  title: string;
  tabs: CustomPageTab[];
}

export interface InfoMessage {
  id: string;
  internalTitle: string;
  headline?: string;
  body?: string;
  layout: 'text-only' | 'image-left' | 'image-right';
  imageUrl?: string;
  animation: 'fade' | 'slide-left' | 'slide-right';
  durationSeconds: number;
  visibleInStudios: string[]; // 'all' or studio IDs
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
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
    imageUrl?: string;
    videoUrl?: string;
    disableOverlay?: boolean;
    durationSeconds: number;
    startDate?: string;
    endDate?: string;
    visibleInStudios: string[];
}

export interface DisplayWindow {
    id: string;
    name: string;
    isEnabled: boolean;
    posts: DisplayPost[];
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'archived';
  logoUrlLight?: string;
  logoUrlDark?: string;
  primaryColor?: string;
  passwords: {
    coach: string;
  };
  globalConfig: StudioConfig;
  studios: Studio[];
  customPages?: CustomPage[];
  infoCarousel?: InfoCarousel;
  displayWindows?: DisplayWindow[];
  exerciseOverrides?: Record<string, ExerciseOverride>;
  companyDetails?: CompanyDetails;
  inviteCode?: string;
  lastActiveAt?: number;
  // Billing
  discountType?: 'percentage' | 'fixed';
  discountValue?: number; // legacy?
  discountPercentage?: number;
  lastBilledMonth?: string; // "YYYY-MM"
  lastBilledDate?: number;
}

export interface StartGroup {
  id: string;
  name: string;
  participants: string;
  startTime?: number; // timestamp or relative
}

export interface WorkoutDiploma {
  title: string;
  subtitle?: string;
  message?: string; // legacy
  achievement?: string;
  comparison?: string; // legacy
  footer?: string;
  imagePrompt: string;
  imageUrl?: string;
  newPBs?: { name: string; diff: number }[];
}

export interface BankExercise {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  imageUrl?: string;
}

export interface SuggestedExercise {
    id: string;
    name: string;
    description: string;
    tags: string[];
    sourceWorkoutTitle?: string;
    imageUrl?: string;
}

export interface UserData {
  uid: string;
  email?: string;
  role: UserRole;
  adminRole?: 'superadmin' | 'admin';
  organizationId?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  termsAcceptedAt?: number;
  age?: number;
  gender?: string;
  goals?: MemberGoals;
}

export interface SmartGoalDetail {
    specific: string;
    measurable: string;
    achievable: string;
    relevant: string;
    timeBound: string;
}

export interface MemberGoals {
    hasSpecificGoals: boolean;
    selectedGoals: string[];
    targetDate?: string;
    startDate?: string;
    smartCriteria?: SmartGoalDetail;
}

export interface Member extends UserData {
    status: 'active' | 'inactive';
    createdAt: number;
    endDate?: string | null;
    isTrainingMember?: boolean;
    id: string; // Alias for uid often used in lists
}

export interface WorkoutResult {
  id: string;
  workoutId: string;
  workoutTitle: string;
  organizationId: string;
  participantName: string;
  finishTime: number;
  completedAt: number;
}

export interface SmartScreenPricing {
    firstScreenPrice: number;
    additionalScreenPrice: number;
    workoutLoggingPricePerMember?: number;
}

export interface InvoiceDetails {
    regularItems: { description: string; quantity: number; price: number; total: number }[];
    adjustmentItems: InvoiceAdjustmentItem[];
    subtotal: number;
    discountAmount: number;
    discountDescription: string;
    totalAmount: number;
    billingPeriod: string;
    adjustmentPeriod: string;
    billingMonthForAction: string;
}

export interface ThemeDateRange {
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    useWeekNumber?: boolean;
    weekNumber?: number;
}

export interface SeasonalThemeSetting {
    id: string; // 'christmas', 'halloween' etc
    name: string;
    isEnabled: boolean;
    ranges: ThemeDateRange[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export interface WorkoutQRPayload {
    oid: string;
    wid: string;
    ts: number;
}

export interface ExerciseSetDetail {
    weight: number | null;
    reps: string | null;
}

export interface ExerciseResult {
    exerciseId: string;
    exerciseName: string;
    weight: number | null; // Max weight summary
    reps: string | null; // Summary reps
    sets: number;
    setDetails?: ExerciseSetDetail[];
    distance?: number | null;
    kcal?: number | null;
    blockId?: string;
}

export type MemberFeeling = 'good' | 'neutral' | 'bad';

export interface WorkoutLog {
    id: string;
    memberId: string;
    organizationId: string;
    workoutId: string;
    workoutTitle: string;
    date: number;
    source: 'qr_scan' | 'manual';
    rpe: number | null;
    feeling: MemberFeeling | null;
    tags: string[];
    comment: string;
    exerciseResults?: ExerciseResult[];
    activityType?: 'gym_workout' | 'custom_activity';
    durationMinutes?: number;
    totalDistance?: number;
    totalCalories?: number;
    diploma?: WorkoutDiploma;
    // Snapshot fields for community feed efficiency
    memberName?: string;
    memberPhotoUrl?: string;
}

export interface CheckInEvent {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    timestamp: number;
    organizationId: string;
    streak: number;
}

// New type for PB Events
export interface StudioEvent {
    id: string;
    type: 'pb';
    organizationId: string;
    timestamp: number;
    data: {
        userName: string;
        exerciseName: string;
        isNewRecord: boolean;
    };
}

export interface HyroxRaceResult {
    participant: string;
    time: number;
    groupId: string;
}

export interface HyroxRace {
    id: string;
    organizationId: string;
    raceName: string;
    createdAt: number;
    exercises: string[];
    startGroups: StartGroup[];
    results: HyroxRaceResult[];
}

export interface Note {
    id: string;
    timestamp: number;
    imageUrl: string;
    text: string;
}

export interface MenuItem {
    title: string;
    subTitle?: string;
    action: () => void;
}

export type RepRange = string;
