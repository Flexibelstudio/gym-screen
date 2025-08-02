export type UserRole = 'member' | 'coach' | 'organizationadmin' | 'systemowner';

export interface UserData {
  uid: string;
  email: string;
  role: 'organizationadmin' | 'systemowner';
  organizationId?: string; // Which organization they belong to
  adminRole?: 'superadmin' | 'admin'; // NEW: granular role for org admins
}


export interface CustomPage {
  id: string;
  title: string;
  content: string; // Will store content as Markdown
}

export interface Organization {
  id:string;
  name: string;
  subdomain: string;
  logoUrl?: string;
  primaryColor?: string; // Hex color code, e.g., '#FF5733'
  passwords: {
    coach: string;
    // superadmin password is now obsolete, replaced by user accounts
  };
  studios: Studio[];
  globalConfig: StudioConfig;
  customPages?: CustomPage[];
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
  AdminConfig,
  SuperAdmin, // This now represents the "Organization Admin"
  SystemOwner, // New page for top-level system administration
  CustomContent, // For displaying dynamic, user-created pages
  RepsOnly, // For timer-less blocks
  StartProgram, // High-fidelity Start Program screen
  Checklist, // High-fidelity Checklist screen
  BasicNutrition, // High-fidelity Basic Nutrition screen
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
  enableQrLogging?: boolean;
}

export interface StudioConfig {
  enableBoost: boolean;
  enableBreathingGuide: boolean;
  enableWarmup: boolean;
  customCategories: CustomCategoryWithPrompt[];
  enableBoostQrLogging?: boolean;
}


export interface Exercise {
  id: string;
  name:string;
  reps?: string;
  description?: string;
  imageUrl?: string;
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
}

export enum TimerStatus {
  Idle,
  Preparing,
  Running,
  Resting,
  Paused,
  Finished
}

// Types for Start Program
export interface ProgramSection {
  title: string;
  icon?: 'check' | 'log';
  points: string[];
}

export interface ProgramExercise {
  name: string;
  details: string;
  notes: string[];
}

export interface ProgramFinisher {
  title: string;
  details?: string;
  points: string[];
}

export interface MenuItem {
  title: string;
  action: () => void;
  subTitle?: string;
  disabled?: boolean;
  colorClass?: string;
}

export interface StartProgramSession {
    id: string;
    title: string;
    shortTitle: string;
    content: {
        sections: ProgramSection[];
        training: {
            title: string;
            description?: string;
            exercises: ProgramExercise[];
        };
        finisher?: ProgramFinisher;
    };
}

// --- Spotify Player Types ---
export type SpotifyPlayerState = Spotify.PlaybackState;
export type SpotifyDevice = Spotify.Device;

// This is to make the Spotify Web Playback SDK types available globally
declare global {
    interface Window {
        onSpotifyWebPlaybackSDKReady: () => void;
        Spotify: typeof Spotify;
    }

    namespace Spotify {
        interface PlayerInit {
            name: string;
            getOAuthToken: (cb: (token: string) => void) => void;
            volume?: number;
        }

        class Player {
            constructor(options: PlayerInit);
            connect(): Promise<boolean>;
            disconnect(): void;
            getCurrentState(): Promise<PlaybackState | null>;
            getVolume(): Promise<number>;
            nextTrack(): Promise<void>;
            previousTrack(): Promise<void>;
            pause(): Promise<void>;
            resume(): Promise<void>;
            seek(position_ms: number): Promise<void>;
            setVolume(volume: number): Promise<void>;
            togglePlay(): Promise<void>;
            addListener(event: 'ready' | 'not_ready', cb: (s: { device_id: string }) => void): void;
            addListener(event: 'player_state_changed', cb: (s: PlaybackState) => void): void;
            addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb: (e: Error) => void): void;
            removeListener(event: 'ready' | 'not_ready' | 'player_state_changed' | 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error'): void;
        }

        interface PlaybackState {
            context: {
                uri: string;
                metadata: any;
            };
            disallows: {
                resuming: boolean;
                skipping_prev: boolean;
            };
            duration: number;
            paused: boolean;
            position: number;
            repeat_mode: number;
            shuffle: boolean;
            track_window: {
                current_track: Track;
                previous_tracks: Track[];
                next_tracks: Track[];
            };
        }

        interface Track {
            uri: string;
            id: string | null;
            type: 'track' | 'episode' | 'ad';
            media_type: 'audio' | 'video';
            name: string;
            is_playable: boolean;
            album: Album;
            artists: Artist[];
        }

        interface Album {
            uri: string;
            name: string;
            images: Image[];
        }

        interface Artist {
            uri: string;
            name: string;
        }

        interface Image {
            url: string;
            height: number | null;
            width: number | null;
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