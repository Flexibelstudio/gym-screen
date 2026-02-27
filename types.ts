
export type UserRole = 'member' | 'coach' | 'organizationadmin' | 'systemowner';

export interface AdminActivity {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  type: 'WORKOUT' | 'MEMBER' | 'BRAND' | 'SYSTEM';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH' | 'UNPUBLISH';
  description: string;
  timestamp: number;
}

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
  RemoteControl, // NYTT: Fjärrkontrollssida
}

export enum TimerMode {
  Interval = 'Interval',
  Tabata = 'Tabata',
  AMRAP = 'AMRAP',
  EMOM = 'EMOM',
  TimeCap = 'TimeCap',
  Stopwatch = 'Stopwatch',
  Custom = 'Custom', // NYTT: Sekvens/Custom timer
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

export interface TimerSegment {
    type: 'work' | 'rest';
    duration: number; // seconds
    title?: string;
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
  sequence?: TimerSegment[]; // NYTT: Lista för Custom Mode
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
  originalBankId?: string; // NYTT: Referens till Master ID för historik
}

export interface WorkoutBlock {
  id: string;
  title: string;
  tag: string;
  setupDescription?: string;
  showDescriptionInTimer?: boolean;
  showExerciseDescriptions?: boolean; // NYTT: Toggle för att visa övningsbeskrivningar i timern
  followMe: boolean;
  settings: TimerSettings;
  exercises: Exercise[];
  aiCoachNotes?: string;
  aiMagicPenSuggestions?: string[];
  autoAdvance?: boolean;     // NEW: Automatically start next block
  transitionTime?: number;   // NEW: Rest time between blocks in seconds
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
  organizationId: string; 
  showDetailsToMember?: boolean;
  logType?: WorkoutLogType;
  isMemberDraft?: boolean;
  participants?: string[]; 
  startGroups?: StartGroup[]; 
  startIntervalMinutes?: number; 
  aiCoachSummary?: string;
  benchmarkId?: string; // NYTT: Koppling till ett Benchmark
}

export type Passkategori = string;

export interface CustomCategoryWithPrompt {
  id: string;
  name: string;
  prompt: string;
  icon?: string;
}

// NYTT: Definition av ett Benchmark
export interface BenchmarkDefinition {
    id: string;
    title: string;
    type: 'time' | 'reps' | 'weight';
}

export type ThemeOption = 'none' | 'auto' | 'winter' | 'christmas' | 'newyear' | 'valentines' | 'easter' | 'midsummer' | 'summer' | 'halloween';

export type TimerSoundProfile = 'airhorn' | 'digital' | 'boxing' | 'gong';

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
  soundProfile?: TimerSoundProfile; 
  navigationControlPosition?: 'top' | 'bottom'; // NYTT: Position för navigationsknappar
  aiSettings?: {
      tone?: string;
      instructions?: string;
  };
}

// NYTT: Tillstånd för fjärrstyrning
export interface RemoteSessionState {
    activeWorkoutId: string | null;
    view: 'idle' | 'preview' | 'timer' | 'menu'; // idle=logo, preview=workout detail, timer=running block, menu=other pages
    activeBlockId: string | null;
    lastUpdate: number; // Timestamp to force updates
    controllerName?: string; // Name of coach controlling
    command?: 'start' | 'pause' | 'resume' | 'reset' | 'finish'; // NEW: Command channel
    commandTimestamp?: number; // To deduplicate commands
    status?: TimerStatus; // NEW: Track current timer status (Running, Paused, etc.)
    viewerSettings?: {
        textScale: number;
        repsScale: number;
    };
}

export interface Studio {
  id: string;
  name: string;
  createdAt?: number;
  configOverrides?: Partial<StudioConfig>;
  remoteState?: RemoteSessionState; // NYTT: Fält för fjärrstyrning
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
  visibleInStudios: string[]; 
  startDate?: string; 
  endDate?: string; 
}

export interface InfoCarousel {
  isEnabled: boolean;
  messages: InfoMessage[];
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
  faviconUrl?: string;
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
  // NYTT: Lista över organisationens benchmarks
  benchmarkDefinitions?: BenchmarkDefinition[];
  companyDetails?: CompanyDetails;
  inviteCode?: string;
  lastActiveAt?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number; 
  discountPercentage?: number;
  lastBilledMonth?: string; 
  lastBilledDate?: number;
}

export interface StartGroup {
  id: string;
  name: string;
  participants: string;
  startTime?: number; 
}

// Unified PB record for both Diploma and Studio Events
export interface PBRecord {
    exerciseName: string; // Synced with firebaseService
    diff: number;
    weight?: number; // Optional current weight
}

export interface WorkoutDiploma {
  title: string;
  subtitle: string;     // REQUIRED
  achievement: string;  // REQUIRED
  footer: string;       // REQUIRED
  imagePrompt: string;
  imageUrl?: string;
  newPBs?: PBRecord[];
  
  // Legacy fields (optional if you still have old diplomas)
  message?: string; 
  comparison?: string; 
}

export interface BankExercise {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  imageUrl?: string;
  organizationId?: string; // NYTT: Om den tillhör en specifik org (custom)
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
    id: string; 
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
    id: string; 
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
    weight: number | null; 
    reps: string | null; 
    sets: number;
    setDetails?: ExerciseSetDetail[];
    distance?: number | null;
    kcal?: number | null;
    blockId?: string;
    coachAdvice?: string; // NYTT: Sparar AI-rådet direkt på övningen
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
    memberName?: string;
    memberPhotoUrl?: string;
    newPBs?: PBRecord[]; 
    benchmarkId?: string; // NYTT: För att enkelt gruppera benchmarks
    benchmarkValue?: number; // NYTT: Resultatet (tid i sekunder, antal reps, eller vikt)
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

export interface StudioEvent {
    id: string;
    type: 'pb' | 'pb_batch';
    organizationId: string;
    timestamp: number;
    data: {
        userName: string;
        userPhotoUrl?: string | null;
        // Updated to support multiple records (or single via array)
        records?: PBRecord[]; 
        
        // Legacy support
        exerciseName?: string;
        weight?: number;
        isNewRecord?: boolean;
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
export type DisplayPost = {
  id: string;
  internalTitle: string;
  headline?: string;
  body?: string;
  layout: 'text-only' | 'image-fullscreen' | 'video-fullscreen' | 'image-left';
  imageUrl?: string;
  videoUrl?: string;
  durationSeconds: number;
  visibleInStudios: string[]; // 'all' or specific studio IDs
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  disableOverlay?: boolean;
}
