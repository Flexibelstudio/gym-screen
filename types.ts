

export type UserRole = 'member' | 'coach' | 'organizationadmin' | 'systemowner';

export interface UserData {
  uid: string;
  email: string;
  role: 'coach' | 'organizationadmin' | 'systemowner';
  organizationId?: string; // Which organization they belong to
  adminRole?: 'superadmin' | 'admin'; // NEW: granular role for org admins
  termsAcceptedAt?: number; // Timestamp of when the admin ToS were accepted
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
  layout: 'text-only' | 'image-left' | 'image-right';
  imageUrl?: string; // base64 data URI
  animation: 'fade' | 'slide-left' | 'slide-right';
  durationSeconds: number;
  startDate?: string; // ISO string
  endDate?: string;   // ISO string
  visibleInStudios: string[]; // Array of studio IDs, or ['all']
}

export interface InfoCarousel {
  isEnabled: boolean;
  messages: InfoMessage[];
}

export interface DisplayPost {
  id:string;
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

export interface Organization {
  id:string;
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
}

export interface Studio {
    id: string;
    name: string;
    // This now holds only the settings that are DIFFERENT from the global config.
    // If a value is not present here, the app will use the value from the global config.
    configOverrides?: Partial<StudioConfig>;
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
  BreathingGuide,
  WorkoutList,
  Warmup,
  SavedWorkouts,
  StudioSelection,
  SuperAdmin, // This now represents the "Organization Admin"
  SystemOwner, // New page for top-level system administration
  CustomContent, // For displaying dynamic, user-created pages
  IdeaBoard, // New page for handwritten notes & ideas
  RepsOnly, // For timer-less blocks
  CustomPageEditor,
  DisplayWindow,
  DisplayWindowSelection,
  Hyrox,
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
}

export interface StudioConfig {
  enableBoost: boolean;
  enableBreathingGuide: boolean;
  enableWarmup: boolean;
  enableNotes?: boolean;
  enableScreensaver?: boolean;
  screensaverTimeoutMinutes?: number;
  enableExerciseBank?: boolean;
  enableHyrox?: boolean;
  customCategories: CustomCategoryWithPrompt[];
  checkInImageEnabled?: boolean;
  checkInImageUrl?: string; // Stored as base64 data URI
}


export interface Exercise {
  id: string;
  name:string;
  reps?: string;
  description?: string;
  imageUrl?: string;
  isFromBank?: boolean;
  isFromAI?: boolean;
}

export interface BankExercise {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
}

export interface SuggestedExercise extends BankExercise {
  sourceWorkoutTitle: string;
  organizationId: string;
}


export interface TimerSettings {
  mode: TimerMode;
  reps?: number;
  workTime: number; // in seconds
  restTime: number; // in seconds
  rounds: number;
  prepareTime: number; // in seconds
}

export interface WorkoutBlock {
  id:string;
  title: string;
  tag: string;
  setupDescription: string;
  settings: TimerSettings;
  exercises: Exercise[];
  followMe?: boolean;
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
  organizationId: string;
  participantName: string;
  finishTime: number; // in seconds
  completedAt: number; // timestamp
}
// FIX: Add Spotify type declarations to resolve compilation errors.
// These types are expected to be available globally from the Spotify Web Playback SDK script.
// FIX: Wrapped in `declare global` to make the namespace available across all modules.
declare global {
  namespace Spotify {
    interface PlayerInit {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }

    interface Entity {
      uri: string;
      name: string;
    }

    interface Album extends Entity {
      images: { url: string }[];
    }

    interface Artist extends Entity {}

    interface Track extends Entity {
      id: string | null;
      type: 'track' | 'episode' | 'ad';
      media_type: 'audio' | 'video';
      is_playable: boolean;
      album: Album;
      artists: Artist[];
    }

    interface PlaybackState {
      context: {
        uri: string | null;
        metadata: any | null;
      };
      disallows: {
        pausing?: boolean;
        peeking_next?: boolean;
        peeking_prev?: boolean;
        resuming?: boolean;
        seeking?: boolean;
        skipping_next?: boolean;
        skipping_prev?: boolean;
      };
      duration: number;
      paused: boolean;
      position: number;
      repeat_mode: 0 | 1 | 2;
      shuffle: boolean;
      track_window: {
        current_track: Track;
        previous_tracks: Track[];
        next_tracks: Track[];
      };
    }

    interface Player {
      new (options: PlayerInit): Player;
      connect(): Promise<boolean>;
      disconnect(): void;
      addListener(event: 'ready' | 'not_ready', cb: ({ device_id }: { device_id: string }) => void): void;
      addListener(event: 'player_state_changed', cb: (state: PlaybackState | null) => void): void;
      addListener(event: 'authentication_error', cb: ({ message }: { message: string }) => void): void;
      getCurrentState(): Promise<PlaybackState | null>;
      getVolume(): Promise<number>;
      setVolume(volume: number): Promise<void>;
      togglePlay(): Promise<void>;
      previousTrack(): Promise<void>;
      nextTrack(): Promise<void>;
    }

    interface Device {
        id: string | null;
        is_active: boolean;
        is_private_session: boolean;
        is_restricted: boolean;
        name: string;
        type: string;
        volume_percent: number | null;
    }
  }
}

export type SpotifyPlayerState = Spotify.PlaybackState;
export type SpotifyDevice = Spotify.Device;