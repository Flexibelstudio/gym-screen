




















import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, TimerStatus, TimerSettings, Passkategori, Studio, MenuItem, StudioConfig, Organization, CustomPage, CustomCategoryWithPrompt, UserRole, UserData } from './types';

import { useStudio } from './context/StudioContext';
import { useAuth } from './context/AuthContext';
import { useWorkoutTimer } from './hooks/useWorkoutTimer';
import { TimerSetupModal } from './components/TimerSetupModal';
import { BoostModal } from './components/BoostModal';
import { FreestandingTimerScreen } from './components/FreestandingTimerScreen';
import { generateWorkout, parseWorkoutFromText } from './services/geminiService';
import { getWorkoutsForOrganization, saveWorkout, deleteWorkout, createOrganization, updateGlobalConfig, updateStudioConfig, createStudio, updateOrganization, updateOrganizationPasswords, updateOrganizationLogo, updateOrganizationPrimaryColor, updateOrganizationCustomPages, isOffline, updateStudio, deleteStudio, deleteOrganization } from './services/firebaseService';
import { WorkoutBuilderScreen } from './components/WorkoutBuilderScreen';
import { SimpleWorkoutBuilderScreen } from './components/SimpleWorkoutBuilderScreen';
import { BreathingGuideScreen } from './components/BreathingGuideScreen';
import { WarmupScreen } from './components/WarmupScreen';
import { WorkoutCompleteModal } from './components/WorkoutCompleteModal';
import WorkoutDetailScreen from './components/WorkoutDetailScreen';
import SavedWorkoutsScreen from './components/SavedWorkoutsScreen';
import { PasswordModal } from './components/PasswordModal';
import { AIGeneratorScreen } from './components/AIGeneratorScreen';
import { CoachScreen } from './components/CoachScreen';
import { StudioSelectionScreen } from './components/StudioSelectionScreen';
import { AdminConfigScreen } from './components/AdminConfigScreen';
import { SuperAdminScreen } from './components/SuperAdminScreen';
import { SystemOwnerScreen } from './components/SystemOwnerScreen';
import { useSpotifyPlayer } from './hooks/useSpotifyPlayer';
import { MusicPlayerBar } from './components/MusicPlayerBar';
import { HomeScreen } from './components/HomeScreen';
import { CustomContentScreen } from './components/CustomContentScreen';
import { StartProgramScreen } from './components/StartProgramScreen';
import { ChecklistScreen } from './components/ChecklistScreen';
import { BasicNutritionScreen } from './components/BasicNutritionScreen';
import { LoginScreen } from './components/LoginScreen';
import { DeveloperToolbar } from './components/DeveloperToolbar';
import { QRCodeModal } from './components/QRCodeModal';
import { QrCodeIcon } from './components/icons';

// --- Timer Style Utility ---
interface TimerStyle {
  bg: string;
  border: string;
  text: string;
  pulseRgb: string;
}

const getTimerStyle = (status: TimerStatus, mode: TimerMode): TimerStyle => {
  switch (status) {
    case TimerStatus.Preparing:
      return { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-white', pulseRgb: '59, 130, 246' };
    case TimerStatus.Running:
      switch (mode) {
        case TimerMode.Interval:
          return { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-white', pulseRgb: '249, 115, 22' };
        case TimerMode.Tabata:
          return { bg: 'bg-red-500', border: 'border-red-500', text: 'text-white', pulseRgb: '239, 68, 68' };
        case TimerMode.AMRAP:
          return { bg: 'bg-pink-600', border: 'border-pink-600', text: 'text-white', pulseRgb: '219, 39, 119' };
        case TimerMode.EMOM:
          return { bg: 'bg-purple-600', border: 'border-purple-600', text: 'text-white', pulseRgb: '147, 51, 234' };
        case TimerMode.TimeCap:
          return { bg: 'bg-indigo-600', border: 'border-indigo-600', text: 'text-white', pulseRgb: '79, 70, 229' };
        default:
          return { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-white', pulseRgb: '249, 115, 22' };
      }
    case TimerStatus.Resting:
      return { bg: 'bg-teal-400', border: 'border-teal-400', text: 'text-white', pulseRgb: '45, 212, 191' };
    case TimerStatus.Paused:
      return { bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-white', pulseRgb: '107, 114, 128' };
    case TimerStatus.Finished:
      return { bg: 'bg-teal-600', border: 'border-teal-600', text: 'text-white', pulseRgb: '13, 148, 136' };
    case TimerStatus.Idle:
    default:
      return { bg: 'bg-gray-800', border: 'border-gray-800', text: 'text-white', pulseRgb: '' };
  }
};


// --- Main App Router ---
export default function App() {
  const { authLoading, currentUser, role, isStudioMode } = useAuth();
  const { studioLoading, selectedStudio, selectOrganization, allOrganizations, selectedOrganization } = useStudio();
  
  useEffect(() => {
    // When a non-studio user logs in, ensure an organization is selected.
    // Default to the first one if none is selected.
    if (!isStudioMode && !studioLoading && allOrganizations.length > 0 && !selectedOrganization) {
        selectOrganization(allOrganizations[0]);
    }
  }, [isStudioMode, studioLoading, allOrganizations, selectOrganization, selectedOrganization]);

  if (authLoading || studioLoading) {
    return <div className="bg-black text-white min-h-screen flex items-center justify-center">Laddar...</div>;
  }
  
  if (!currentUser) {
    return <LoginScreen />;
  }

  if (isStudioMode && !selectedStudio) {
      // Anonymous user (a studio screen) needs to be configured.
      return (
        <div className="bg-black text-white min-h-screen">
          <StudioSelectionScreen onStudioSelected={() => { /* Reload handled by context */ }} />
        </div>
      );
  }

  return <MainContent />;
}


// Image Preview Modal Component
const ImagePreviewModal: React.FC<{ imageUrl: string | null; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] p-2 bg-gray-900 rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <img src={imageUrl} alt="Exercise" className="max-w-full max-h-[85vh] object-contain rounded-md" />
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl shadow-lg border-2 border-black"
          aria-label="Stäng bildvisning"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

// Simplified prompts for AI-generated Boost WODs
const enkelWodPrompt = `Skapa en "Enkel WOD".

**Regler:**
*   Total träningstid: 20–30 minuter.
*   Passet **MÅSTE** struktureras i ett eller flera block inuti "blocks"-arrayen i JSON-svaret.
*   Varje block **MÅSTE** ha en timer (AMRAP, EMOM, Time Cap, Intervall, TABATA). Använd **INTE** "Ingen Timer".
*   Passet får **INTE** innehålla: Skivstång, Snatch, Turkish get-up, Muscle-ups, Handstand pushups eller andra avancerade gymnastiska/akrobatiska övningar.
*   Fokusera på tillgängliga övningar som kan skalas för olika nivåer.
*   Använd ett av följande format för blocken: parövningar, stationsträning, EMOM, AMRAP, TABATA, eller For Time/Time Cap.
*   Passet ska vara roligt, utmanande och ge en helkroppskänsla.
*   Inkludera gärna förflyttning över golvytan, som Farmers Walk, Bear Crawl eller att putta på löpbandet.
*   **Titel**: Sätt workout-titeln till något passande i stil med "Dagens Enkla WOD" eller liknande.
*   **Coach Tips**: Ge ett kort, peppande tips till deltagarna.

**Tillgänglig utrustning (Använd endast detta):**
Kettlebells, Hantlar, Stepbrädor, Plyoboxar, TRX-band, Airbikes, Roddmaskin, SkiErg, Slamballs, Viktplattor, Träningsbänkar, Landmine, Löpband (med puttfunktion), Battleropes, Gummiband (miniband och långa), Hopprep, Balansplattor. (Notera: Ingen skivstång för detta pass).`;

const avanceradWodPrompt = `Skapa en "Avancerad WOD".

**Regler:**
*   Total träningstid: 20–30 minuter.
*   Passet **MÅSTE** struktureras i två tydliga block i "blocks"-arrayen i JSON-svaret:
    *   **Första Blocket (Styrka):** Ett tungt styrkeinslag med skivstång. För detta block, sätt **ALLTID** \`settings.mode\` till \`"Time Cap"\`. Sätt en rimlig varaktighet på ca 12-15 minuter. Använd **ALDRIG** \`"Ingen Timer"\`. Exempel: tunga marklyft, thrusters, clean & press, frontböj. Sätt taggen för detta block till "Styrka".
    *   **Andra Blocket (Kondition):** Ett flåsigt och utmanande block. Exempel: AMRAP, For Time, eller en parutmaning. Sätt taggen för detta block till "Kondition".
*   Passet får **INTE** innehålla akrobatiska övningar som muscle-ups eller handstand pushups.
*   Känslan ska vara en klassisk, rolig och svettig WOD med CrossFit-känsla.
*   **Titel**: Ge passet en titel i stil med "Dagens Avancerade WOD: Styrka & Flås" eller liknande. Titeln får INTE innehålla tekniska ID:n, koder eller filnamn.
*   **Coach Tips**: Ge ett kort, peppande tips till deltagarna.

**Tillgänglig utrustning (Använd endast detta):**
4 rackställningar med chins-stänger, 4 skivstänger med bumper plates, Kettlebells, Hantlar, Stepbrädor, Plyoboxar, TRX-band, Airbikes, Roddmaskin, SkiErg, Slamballs, Viktplattor, Träningsbänkar, Landmine-fäste, Löpband (med puttfunktion), Battleropes, Gummiband, Hopprep, Balansplattor.`;

const DEFAULT_CONFIG: StudioConfig = {
    enableBoost: true,
    enableBreathingGuide: true,
    enableWarmup: true,
    enableBoostQrLogging: true,
    customCategories: [
        { id: 'default_cat_1', name: 'HIIT', prompt: 'Skapa ett standard HIIT pass.' },
        { id: 'default_cat_2', name: 'Workout', prompt: 'Skapa ett standard Workout pass.' },
        { id: 'default_cat_3', name: 'Funktionell träning', prompt: 'Skapa ett standard Funktionell träning pass.' },
    ]
};

const deepCopyAndPrepareAsNew = (workoutToCopy: Workout): Workout => {
    const newWorkout = JSON.parse(JSON.stringify(workoutToCopy));
    
    newWorkout.id = `workout-${Date.now()}`;
    newWorkout.title = `KOPIA - ${workoutToCopy.title}`;
    newWorkout.isPublished = false; // Always a draft
    newWorkout.isFavorite = false;
    newWorkout.createdAt = Date.now();

    newWorkout.blocks = newWorkout.blocks.map((block: WorkoutBlock, bIndex: number) => {
        block.id = `block-${Date.now()}-${bIndex}`;
        block.exercises = block.exercises.map((ex: Exercise, eIndex: number) => {
            ex.id = `ex-${Date.now()}-${bIndex}-${eIndex}`;
            return ex;
        });
        return block;
    });

    return newWorkout;
};


const MainContent: React.FC = () => {
  const { 
    selectedStudio, selectStudio, allStudios, setAllStudios,
    selectedOrganization, selectOrganization, allOrganizations, setAllOrganizations
  } = useStudio();
  const { role, userData, isStudioMode, signOut, isImpersonating, startImpersonation, stopImpersonation } = useAuth();
  
  // Local temporary role state for coach access
  const [sessionRole, setSessionRole] = useState<UserRole>(role);

  const [history, setHistory] = useState<Page[]>([Page.Home]);
  const page = history[history.length - 1];

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeBlock, setActiveBlock] = useState<WorkoutBlock | null>(null);
  const [activePasskategori, setActivePasskategori] = useState<string | null>(null);
  const [activeCustomPage, setActiveCustomPage] = useState<CustomPage | null>(null);

  const getEffectiveConfig = useCallback((studio: Studio | null, org: Organization | null): StudioConfig => {
    const orgConfig = org ? org.globalConfig : DEFAULT_CONFIG;
    if (!studio) return orgConfig;
    return {
      ...orgConfig,
      ...studio.configOverrides,
    };
  }, []);
  
  const studioConfig = useMemo(() => getEffectiveConfig(selectedStudio, selectedOrganization), [selectedStudio, selectedOrganization, getEffectiveConfig]);

  const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  
  const [isBoostModalOpen, setBoostModalOpen] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ workout: Workout, isFinal: boolean } | null>(null);
  const [workoutForQr, setWorkoutForQr] = useState<Workout | null>(null);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const [aiGeneratorPrompt, setAiGeneratorPrompt] = useState<string>('');
  const [isPromptFromBoost, setIsPromptFromBoost] = useState(false);
  const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage' | 'create'>('create');
  
  const [theme, setTheme] = useState('dark');
  const [isTimerHeaderVisible, setIsTimerHeaderVisible] = useState(true);
  const [isGeneratingBoost, setIsGeneratingBoost] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isBreathingSettingsOpen, setIsBreathingSettingsOpen] = useState(false);

  const { player, playerState, isSpotifyReady, hasSpotifyAuth, login } = useSpotifyPlayer(selectedStudio?.id || null);
  const isMusicPlayerVisible = isSpotifyReady && playerState && selectedStudio;
  
  const isPresentationContext = useMemo(() => {
    // The presentation flow is Home -> (List) -> Detail.
    // We check if the WorkoutDetail page was reached from one of these pages.
    if (page === Page.WorkoutDetail) {
        if (history.length < 2) return false; // Can't be presentation if there's no history
        const previousPage = history[history.length - 2];
        return [Page.Home, Page.WorkoutList].includes(previousPage);
    }
    // For other pages, this context is not relevant.
    return false;
  }, [page, history]);


  // Set the main page based on role when the component loads
  useEffect(() => {
    if (isImpersonating) return; // Don't change page if we are impersonating
    if (role === 'systemowner') {
        setHistory([Page.SystemOwner]);
    } else if (role === 'organizationadmin') {
        setHistory([Page.SuperAdmin]);
    } else {
        setHistory([Page.Home]);
    }
  }, [role, isImpersonating]);
  
  // Update session role if the main role changes (e.g. dev toolbar)
  useEffect(() => {
    setSessionRole(role);
  }, [role]);

  // Fetch workouts when organization changes
  useEffect(() => {
    if (selectedOrganization) {
        const fetchWorkouts = async () => {
            setWorkoutsLoading(true);
            try {
                const fetchedWorkouts = await getWorkoutsForOrganization(selectedOrganization.id);
                setWorkouts(fetchedWorkouts);
            } catch (error) {
                console.error("Error fetching workouts:", error);
                setWorkouts([]); // reset on error
            } finally {
                setWorkoutsLoading(false);
            }
        };
        fetchWorkouts();
    } else {
        setWorkouts([]);
        setWorkoutsLoading(false);
    }
}, [selectedOrganization]);

// Automatic cleanup of old, non-favorited workouts
useEffect(() => {
    if (workouts.length > 0 && selectedOrganization) {
        const cleanupWorkouts = async () => {
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            
            // Cleanup any unpublished workout that isn't a favorite and is older than a day.
            const workoutsToDelete = workouts.filter(w => 
                !w.isPublished && 
                !w.isFavorite && 
                w.createdAt &&
                (now - w.createdAt > ONE_DAY)
            );
            
            if (workoutsToDelete.length > 0) {
                console.log(`Cleaning up ${workoutsToDelete.length} old, non-favorite draft workouts.`);
                const deletePromises = workoutsToDelete.map(w => deleteWorkout(w.id));
                try {
                    await Promise.all(deletePromises);
                    // If successful, update state in one go.
                    const deletedIds = new Set(workoutsToDelete.map(w => w.id));
                    setWorkouts(prev => prev.filter(w => !deletedIds.has(w.id)));
                } catch (error) {
                    console.error("Failed to cleanup old workouts:", error);
                    // It will try again on next load
                }
            }
        };
        // Run cleanup with a small delay to not interfere with initial render
        const timer = setTimeout(cleanupWorkouts, 5000);
        return () => clearTimeout(timer);
    }
}, [workouts.length, selectedOrganization]); // Reruns if number of workouts changes


  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };
  
  const handleShowImage = (url: string) => {
    setPreviewImageUrl(url);
  };

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);
  
  useEffect(() => {
    const root = document.documentElement;
    const primaryColor = selectedOrganization?.primaryColor;
    if (primaryColor) {
      root.style.setProperty('--color-primary', primaryColor);
    } else {
      root.style.removeProperty('--color-primary');
    }
  }, [selectedOrganization]);


  const navigateTo = (destinationPage: Page) => {
    setHistory(prev => [...prev, destinationPage]);
  };
  
  const navigateReplace = (destinationPage: Page) => {
    setHistory(prev => {
        const newHistory = prev.slice(0, -1);
        newHistory.push(destinationPage);
        return newHistory;
    });
  };

  const handleCreateNewWorkout = () => {
    setWorkoutToEdit(null);
    setFocusedBlockId(null);
    if (sessionRole === 'member') {
        navigateTo(Page.SimpleWorkoutBuilder);
    } else {
        navigateTo(Page.WorkoutBuilder);
    }
  };

  const handlePassProgramNavigation = (mode: 'create' | 'generate' | 'parse' | 'manage') => {
    if (mode === 'create') {
        handleCreateNewWorkout();
    } else {
        setAiGeneratorPrompt('');
        setIsPromptFromBoost(false);
        setAiGeneratorInitialTab(mode);
        navigateTo(Page.AIGenerator);
    }
};

  const handleEditWorkout = (workout: Workout, blockId?: string) => {
    setWorkoutToEdit(workout);
    setFocusedBlockId(blockId || null);
    if (sessionRole === 'member') {
      navigateTo(Page.SimpleWorkoutBuilder);
    } else {
      navigateTo(Page.WorkoutBuilder);
    }
  };

  // Centralized function for saving a workout, updating state, and saving to DB
  const persistWorkoutStateAndDb = async (workout: Workout): Promise<Workout> => {
    if (!selectedOrganization) {
        alert("Kan inte spara pass: ingen organisation är vald.");
        return workout; // Return original on failure to prevent downstream errors
    }
    
    const isNew = !workouts.some(w => w.id === workout.id);
    const workoutToSave: Workout = { 
        ...workout, 
        organizationId: selectedOrganization.id,
        createdAt: isNew ? (workout.createdAt || Date.now()) : workout.createdAt,
        isFavorite: workout.isFavorite || false,
    };
  
    const originalWorkouts = [...workouts];
    
    const newWorkouts = isNew
        ? [workoutToSave, ...originalWorkouts]
        : originalWorkouts.map(w => (w.id === workoutToSave.id ? workoutToSave : w));
    
    setWorkouts(newWorkouts);
  
    if (activeWorkout?.id === workoutToSave.id) {
        setActiveWorkout(workoutToSave);
    }
  
    try {
      await saveWorkout(workoutToSave);
      return workoutToSave; // Return the saved workout on success
    } catch (error) {
      console.error("Kunde inte spara passet:", error);
      alert("Ett fel uppstod när passet skulle sparas. Försök igen.");
      // Revert state on error
      setWorkouts(originalWorkouts);
      if(activeWorkout?.id === workoutToSave.id) {
        setActiveWorkout(originalWorkouts.find(w => w.id === workoutToSave.id) || null);
      }
      return workout; // Return original workout
    }
  };
  
  const handleSaveWorkout = async (workout: Workout, startFirstBlock?: boolean) => {
    const savedWorkout = await persistWorkoutStateAndDb(workout);
    // Continue with navigation logic only if save was successful (IDs match)
    if (savedWorkout.id === workout.id) {
        setActiveWorkout(savedWorkout);
        if (startFirstBlock && savedWorkout.blocks.length > 0) {
            handleStartBlock(savedWorkout.blocks[0]);
        } else {
            navigateReplace(Page.WorkoutDetail);
        }
    }
  };
  
  const handleTogglePublishStatus = async (workoutId: string, isPublished: boolean) => {
    const workoutToToggle = workouts.find(w => w.id === workoutId);
    if (workoutToToggle) {
        const updatedWorkout = { ...workoutToToggle, isPublished };
        await persistWorkoutStateAndDb(updatedWorkout);
    }
  };

  const handleToggleFavoriteStatus = async (workoutId: string) => {
    const workoutToToggle = workouts.find(w => w.id === workoutId);
    if (workoutToToggle) {
        const updatedWorkout = { ...workoutToToggle, isFavorite: !workoutToToggle.isFavorite };
        await persistWorkoutStateAndDb(updatedWorkout);
    }
  };

  const handleBack = useCallback(() => {
    if (history.length <= 1) return;

    const currentPage = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    if (currentPage === Page.Coach) {
      // If going back from coach screen, reset role to member if original role was member
      if(role === 'member') {
        setSessionRole('member');
      }
    }
    
    // if going back to home, and original role is admin/owner, go to their main page instead
    if (newHistory[newHistory.length - 1] === Page.Home && (role === 'systemowner' || role === 'organizationadmin') && !isImpersonating) {
      if (role === 'systemowner') setHistory([Page.SystemOwner]);
      else setHistory([Page.SuperAdmin]);
      return;
    }

    setHistory(newHistory);
  }, [history, role, isImpersonating]);
  
  const handleDeleteWorkout = async (workoutId: string) => {
    if (!selectedOrganization) {
        alert("Kan inte radera pass: ingen organisation är vald.");
        return;
    }
    const originalWorkouts = workouts;
    setWorkouts(prevWorkouts => prevWorkouts.filter(w => w.id !== workoutId));
    try {
        await deleteWorkout(workoutId);
        // If the deleted workout was the one being viewed, navigate back.
        if (activeWorkout?.id === workoutId && page === Page.WorkoutDetail) {
          handleBack();
        }
    } catch (error) {
        console.error("Kunde inte ta bort passet:", error);
        alert("Ett fel uppstod när passet skulle tas bort. Försök igen.");
        setWorkouts(originalWorkouts); // Revert on error
    }
  };
  
  const handleStartBlock = (block: WorkoutBlock) => {
    setActiveBlock(block);
    if (block.settings.mode === TimerMode.NoTimer) {
        navigateTo(Page.RepsOnly);
    } else {
        navigateTo(Page.Timer);
    }
  };

  const handleStartFreestandingTimer = (block: WorkoutBlock) => {
    if (!selectedOrganization) {
        alert("Kan inte starta timer: ingen organisation är vald.");
        return;
    }
    const tempWorkout: Workout = {
        id: `freestanding-workout-${Date.now()}`,
        title: block.title,
        coachTips: '',
        blocks: [block],
        category: 'Ej kategoriserad',
        isPublished: false,
        organizationId: selectedOrganization.id
    };
    setActiveWorkout(tempWorkout);
    handleStartBlock(block);
  };

  const handleSelectWorkout = (workout: Workout) => {
    setActiveWorkout(workout);
    navigateTo(Page.WorkoutDetail);
  }
  
  const handleSelectBoostDifficulty = async (difficulty: 'enkel' | 'avancerad') => {
    if (!selectedOrganization) {
        alert("Kan inte skapa pass: ingen organisation är vald.");
        return;
    }
    const prompt = difficulty === 'enkel' ? enkelWodPrompt : avanceradWodPrompt;
    setBoostModalOpen(false);
    setIsGeneratingBoost(true);
    
    try {
      const generatedWorkout = await generateWorkout(prompt);
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const boostWorkout: Workout = {
          ...generatedWorkout,
          id: `boost-${Date.now()}`, // Ensure a unique ID
          title: `Dagens Boost - ${formattedDate}`,
          category: 'Boost',
          isPublished: false, // Never published for a member
          organizationId: selectedOrganization.id,
          createdAt: Date.now(),
          isFavorite: false,
      };

      // Auto-save the workout
      setWorkouts(prev => [boostWorkout, ...prev].sort((a,b) => a.title.localeCompare(b.title))); // Optimistic update
      await saveWorkout(boostWorkout); // Persist

      setActiveWorkout(boostWorkout);
      navigateTo(Page.WorkoutDetail);

    } catch (err) {
      console.error("Failed to generate Boost WOD:", err);
      alert(`Kunde inte skapa ett Boost-pass: ${err instanceof Error ? err.message : 'Ett okänt fel inträffade.'}`);
    } finally {
      setIsGeneratingBoost(false);
    }
  };

  const handleDuplicateWorkout = (workoutToCopy: Workout) => {
    const newDraft = deepCopyAndPrepareAsNew(workoutToCopy);
    setWorkoutToEdit(newDraft);
    navigateTo(Page.WorkoutBuilder);
  };

  const handleSelectPasskategori = (passkategori: Passkategori) => {
    const publishedWorkouts = workouts.filter(w => w.isPublished && w.category === passkategori);
    if (publishedWorkouts.length === 1) {
        handleSelectWorkout(publishedWorkouts[0]);
    } else {
        setActivePasskategori(passkategori);
        navigateTo(Page.WorkoutList);
    }
  };
  
  const handleCoachAccessRequest = () => {
    if (sessionRole === 'member') {
        setIsPasswordModalOpen(true);
    } else {
        navigateTo(Page.Coach);
    }
  };
  
  const handleSelectCustomPage = (page: CustomPage) => {
    setActiveCustomPage(page);
    navigateTo(Page.CustomContent);
  };

  
  const handleUpdateBlockSettings = (blockId: string, newSettings: Partial<TimerSettings>) => {
    if (!activeWorkout || !selectedOrganization) return;

    let updatedWorkout: Workout | null = null;
    const updatedBlocks = activeWorkout.blocks.map(b => 
      b.id === blockId ? { ...b, settings: { ...b.settings, ...newSettings } } : b
    );
    updatedWorkout = { ...activeWorkout, blocks: updatedBlocks };
    
    setActiveWorkout(updatedWorkout);

    if (sessionRole !== 'member') {
      const finalWorkout = updatedWorkout;
      setWorkouts(workouts.map(w => w.id === finalWorkout.id ? finalWorkout : w));
      // Persist this change
      saveWorkout(finalWorkout).catch(e => {
          console.error("Failed to save block settings", e);
          alert("Kunde inte spara blockinställningar.");
      });
    }
  };
  
  const handleGeneratedWorkout = (newWorkout: Workout) => {
    setWorkoutToEdit(newWorkout);
    setFocusedBlockId(null);
    navigateTo(Page.WorkoutBuilder);
  }
  
  const handleTimerFinish = useCallback((isNaturalFinish: boolean = false) => {
    if (completionInfo) return; // Prevent re-triggering if modal is already open
    
    if (!isNaturalFinish) {
      handleBack();
      return;
    }

    if (activeWorkout && activeBlock) {
        const blockIndex = activeWorkout.blocks.findIndex(b => b.id === activeBlock.id);
        const isLastBlock = blockIndex === activeWorkout.blocks.length - 1;
        setCompletionInfo({ workout: activeWorkout, isFinal: isLastBlock });
    } else if (activeWorkout) {
        // Fallback for freestanding timers or other edge cases
        setCompletionInfo({ workout: activeWorkout, isFinal: true });
    }
  }, [completionInfo, handleBack, activeWorkout, activeBlock]);

  const handleCloseWorkoutCompleteModal = () => {
    setCompletionInfo(null);
    handleBack(); // Always navigate back from the timer screen.
  };

  const handleSaveStudioConfig = async (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>) => {
    try {
      const updatedStudio = await updateStudioConfig(organizationId, studioId, newConfigOverrides);
      selectStudio(updatedStudio); 
      setAllStudios(prev => prev.map(s => s.id === studioId ? updatedStudio : s));
      handleBack();
    } catch (error) {
      console.error("Failed to save studio config:", error);
      alert("Kunde inte spara konfigurationen.");
    }
  };

  const handleSaveGlobalConfig = async (organizationId: string, newConfig: StudioConfig) => {
      try {
          await updateGlobalConfig(organizationId, newConfig);
          const updatedOrg = { ...selectedOrganization!, globalConfig: newConfig };
          selectOrganization(updatedOrg);
          setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
      } catch (error) {
           console.error("Failed to save global config:", error);
           alert("Kunde inte spara global konfiguration.");
      }
  };

  const handleCreateStudio = async (organizationId: string, name: string) => {
      try {
          const newStudio = await createStudio(organizationId, name);
          const newOrgs = allOrganizations.map(o => {
              if (o.id === organizationId) {
                  return { ...o, studios: [...o.studios, newStudio] };
              }
              return o;
          });
          setAllOrganizations(newOrgs);
          const updatedOrg = newOrgs.find(o => o.id === organizationId);
          if (updatedOrg) {
              selectOrganization(updatedOrg);
          }
      } catch (error) {
          console.error("Failed to create studio:", error);
          alert("Kunde inte skapa studio.");
      }
  };

    const handleUpdateStudio = async (organizationId: string, studioId: string, name: string) => {
        try {
            await updateStudio(organizationId, studioId, name);
            const newOrgs = allOrganizations.map(o => {
                if (o.id === organizationId) {
                    const newStudios = o.studios.map(s => s.id === studioId ? { ...s, name } : s);
                    return { ...o, studios: newStudios };
                }
                return o;
            });
            setAllOrganizations(newOrgs);
            const updatedOrg = newOrgs.find(o => o.id === organizationId);
            if (updatedOrg) {
                selectOrganization(updatedOrg);
            }
        } catch (error) {
            console.error("Failed to update studio:", error);
            alert("Kunde inte uppdatera studion.");
        }
    };

    const handleDeleteStudio = async (organizationId: string, studioId: string) => {
        try {
            await deleteStudio(organizationId, studioId);
            const newOrgs = allOrganizations.map(o => {
                if (o.id === organizationId) {
                    const newStudios = o.studios.filter(s => s.id !== studioId);
                    return { ...o, studios: newStudios };
                }
                return o;
            });
            setAllOrganizations(newOrgs);
            const updatedOrg = newOrgs.find(o => o.id === organizationId);
            if (updatedOrg) {
                selectOrganization(updatedOrg);
            }
        } catch (error) {
            console.error("Failed to delete studio:", error);
            alert("Kunde inte ta bort studion.");
        }
    };

  const handleCreateOrganization = async (name: string, subdomain: string) => {
    try {
        const newOrg = await createOrganization(name, subdomain);
        setAllOrganizations(prev => [...prev, newOrg]);
    } catch (error) {
        console.error("Failed to create organization:", error);
        alert(`Kunde inte skapa organisation: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };
  
  const handleUpdateOrganization = async (organizationId: string, name: string, subdomain: string) => {
    try {
        const updatedOrg = await updateOrganization(organizationId, name, subdomain);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization:", error);
        alert(`Kunde inte uppdatera organisation: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
        throw error;
    }
  };

  const handleDeleteOrganization = async (organizationId: string) => {
    try {
        await deleteOrganization(organizationId);
        setAllOrganizations(prev => prev.filter(o => o.id !== organizationId));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(null);
            setHistory([Page.SystemOwner]);
        }
    } catch (error) {
        console.error("Failed to delete organization:", error);
        alert(`Kunde inte ta bort organisation: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };
  
  const handleUpdateOrganizationPasswords = async (organizationId: string, passwords: Organization['passwords']) => {
    try {
        const updatedOrg = await updateOrganizationPasswords(organizationId, passwords);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization passwords:", error);
        alert(`Kunde inte uppdatera lösenord: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };

  const handleUpdateOrganizationLogo = async (organizationId: string, logoUrl: string) => {
    try {
        const updatedOrg = await updateOrganizationLogo(organizationId, logoUrl);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization logo:", error);
        alert(`Kunde inte uppdatera logotyp: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };

  const handleUpdateOrganizationPrimaryColor = async (organizationId: string, color: string) => {
    try {
        const updatedOrg = await updateOrganizationPrimaryColor(organizationId, color);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization primary color:", error);
        alert(`Kunde inte uppdatera primärfärg: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };

  const handleUpdateOrganizationCustomPages = async (organizationId: string, customPages: CustomPage[]) => {
    try {
        const updatedOrg = await updateOrganizationCustomPages(organizationId, customPages);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update custom pages:", error);
        alert(`Kunde inte uppdatera infosidor: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };


  const handleSelectOrganization = (organization: Organization) => {
      selectOrganization(organization);
      navigateTo(Page.SuperAdmin);
  };

  const handleSwitchToStudioView = (studio: Studio) => {
    selectStudio(studio);
    startImpersonation({ role: 'member', isStudioMode: true });
    setHistory([Page.Home]);
  };

  const handleReturnToAdmin = () => {
    stopImpersonation();
    setHistory([Page.SuperAdmin]);
  };
  
    const isQrLoggingEnabledForWorkout = (w: Workout | null): boolean => {
        if (!w) return false;
        if (w.category === 'Boost') {
            return !!studioConfig.enableBoostQrLogging;
        }
        if (w.category === 'Ej kategoriserad') {
            return true; 
        }
        const categoryConfig = studioConfig.customCategories.find(c => c.name === w.category);
        return categoryConfig?.enableQrLogging ?? false;
    };


  const renderPage = () => {
    switch (page) {
      case Page.Home:
        return <HomeScreen 
            navigateTo={navigateTo} 
            onSelectWorkout={handleSelectWorkout} 
            onSelectPasskategori={handleSelectPasskategori} 
            savedWorkouts={workouts} 
            onCreateNewWorkout={handleCreateNewWorkout} 
            onShowBoostModal={() => setBoostModalOpen(true)} 
            onCoachAccessRequest={handleCoachAccessRequest} 
            studioConfig={studioConfig} 
            organizationLogoUrl={selectedOrganization?.logoUrl}
        />;
      case Page.WorkoutDetail:
        return activeWorkout && <WorkoutDetailScreen 
            workout={activeWorkout} 
            onStartBlock={handleStartBlock} 
            onUpdateBlockSettings={handleUpdateBlockSettings} 
            onEditWorkout={handleEditWorkout} 
            isCoachView={sessionRole !== 'member'}
            onTogglePublish={handleTogglePublishStatus}
            onToggleFavorite={handleToggleFavoriteStatus}
            onDuplicate={handleDuplicateWorkout}
            onShowImage={handleShowImage}
            onShowQrCode={setWorkoutForQr}
            isPresentationMode={isPresentationContext}
            studioConfig={studioConfig}
            onDelete={handleDeleteWorkout}
        />;
      case Page.Timer:
        return activeBlock && <TimerScreen key={activeBlock.id} block={activeBlock} onFinish={handleTimerFinish} onHeaderVisibilityChange={setIsTimerHeaderVisible} onShowImage={handleShowImage} />;
      case Page.RepsOnly:
        return activeBlock && <RepsOnlyScreen block={activeBlock} onFinish={() => handleTimerFinish(false)} onShowImage={handleShowImage} />;
      case Page.Coach:
        return <CoachScreen 
                  role={sessionRole} 
                  navigateTo={navigateTo} 
                  onSelectCustomPage={handleSelectCustomPage}
                  isImpersonating={isImpersonating}
                  onReturnToAdmin={handleReturnToAdmin} 
               />;
      case Page.AIGenerator:
        return <AIGeneratorScreen 
                  onWorkoutGenerated={handleGeneratedWorkout} 
                  initialPrompt={aiGeneratorPrompt} 
                  isFromBoost={isPromptFromBoost} 
                  workouts={workouts}
                  onEditWorkout={handleEditWorkout}
                  onDeleteWorkout={handleDeleteWorkout}
                  onCreateNewWorkout={handleCreateNewWorkout}
                  initialMode={aiGeneratorInitialTab}
                  studioConfig={studioConfig}
                  workoutsLoading={workoutsLoading}
               />;
      case Page.FreestandingTimer:
        return <FreestandingTimerScreen onStart={handleStartFreestandingTimer} />;
      case Page.WorkoutBuilder:
        return <WorkoutBuilderScreen 
                  initialWorkout={workoutToEdit} 
                  onSave={handleSaveWorkout} 
                  onCancel={handleBack} 
                  focusedBlockId={focusedBlockId} 
                  studioConfig={studioConfig}
                  sessionRole={sessionRole}
                />;
      case Page.SimpleWorkoutBuilder:
        return <SimpleWorkoutBuilderScreen 
                  initialWorkout={workoutToEdit}
                  onSave={handleSaveWorkout} 
                  onCancel={handleBack} 
               />;
      case Page.BreathingGuide:
        return <BreathingGuideScreen 
                    onBack={handleBack} 
                    theme={theme} 
                    toggleTheme={toggleTheme}
                    isSettingsOpen={isBreathingSettingsOpen}
                    onOpenSettings={() => setIsBreathingSettingsOpen(true)}
                    onCloseSettings={() => setIsBreathingSettingsOpen(false)}
                />;
      case Page.Warmup:
        return <WarmupScreen onStartBlock={handleStartBlock} />;
      case Page.WorkoutList:
        return activePasskategori && <WorkoutListScreen 
            passkategori={activePasskategori} 
            workouts={workouts.filter(w => w.isPublished && w.category === activePasskategori)}
            onSelectWorkout={handleSelectWorkout}
        />;
      case Page.SavedWorkouts:
        return <SavedWorkoutsScreen 
            workouts={workouts.filter(w => !w.isPublished)} 
            onSelectWorkout={handleSelectWorkout} 
            onEditWorkout={handleEditWorkout}
            onDeleteWorkout={handleDeleteWorkout}
            onToggleFavorite={handleToggleFavoriteStatus}
            />;
      case Page.StudioSelection:
        return <StudioSelectionScreen onStudioSelected={handleBack} />;
      case Page.AdminConfig:
        return selectedOrganization && <AdminConfigScreen onSave={handleSaveStudioConfig} onCancel={handleBack} globalConfig={selectedOrganization.globalConfig} />;
      case Page.SuperAdmin:
        return selectedOrganization && <SuperAdminScreen 
                  organization={selectedOrganization}
                  adminRole={userData?.adminRole || 'admin'}
                  userRole={role}
                  onPassProgramNavigation={handlePassProgramNavigation}
                  onSaveGlobalConfig={handleSaveGlobalConfig}
                  onEditStudioConfig={(studio) => { selectStudio(studio); navigateTo(Page.AdminConfig); }}
                  onCreateStudio={handleCreateStudio}
                  onUpdateStudio={handleUpdateStudio}
                  onDeleteStudio={handleDeleteStudio}
                  onUpdatePasswords={handleUpdateOrganizationPasswords}
                  onUpdateLogo={handleUpdateOrganizationLogo}
                  onUpdatePrimaryColor={handleUpdateOrganizationPrimaryColor}
                  onUpdateOrganization={handleUpdateOrganization}
                  onUpdateCustomPages={handleUpdateOrganizationCustomPages}
                  onSwitchToStudioView={handleSwitchToStudioView}
              />;
      case Page.SystemOwner:
        return <SystemOwnerScreen 
                  allOrganizations={allOrganizations}
                  onSelectOrganization={handleSelectOrganization}
                  onCreateOrganization={handleCreateOrganization}
                  onDeleteOrganization={handleDeleteOrganization}
               />;
      case Page.CustomContent:
        return activeCustomPage && <CustomContentScreen page={activeCustomPage} />;
      case Page.StartProgram:
        return <StartProgramScreen />;
      case Page.Checklist:
        return <ChecklistScreen />;
      case Page.BasicNutrition:
        return <BasicNutritionScreen />;
      default:
        return <HomeScreen 
            navigateTo={navigateTo} 
            onSelectWorkout={handleSelectWorkout} 
            onSelectPasskategori={handleSelectPasskategori} 
            savedWorkouts={workouts} 
            onCreateNewWorkout={handleCreateNewWorkout} 
            onShowBoostModal={() => setBoostModalOpen(true)} 
            onCoachAccessRequest={handleCoachAccessRequest} 
            studioConfig={studioConfig} 
            organizationLogoUrl={selectedOrganization?.logoUrl}
        />;
    }
  };

  const isFullScreenPage = page === Page.Timer || page === Page.RepsOnly || page === Page.BreathingGuide;
  const paddingClass = isFullScreenPage ? '' : 'p-4 sm:p-6 lg:p-8';

  return (
    <div className={`bg-white dark:bg-black text-gray-800 dark:text-gray-200 min-h-screen font-sans flex flex-col ${paddingClass}`}>
       {isOffline && <DeveloperToolbar />}
       {(page === Page.Timer || !isFullScreenPage) && <Header 
        page={page} 
        onBack={handleBack} 
        theme={theme}
        toggleTheme={toggleTheme}
        isVisible={page === Page.Timer ? isTimerHeaderVisible : true}
        activeCustomPageTitle={page === Page.CustomContent ? activeCustomPage?.title : undefined}
        onSignOut={isStudioMode ? undefined : signOut}
        role={role}
        historyLength={history.length}
      />}
      <main className={`flex-grow flex flex-col items-center ${page === Page.Home ? 'justify-start' : 'justify-center'} ${isMusicPlayerVisible ? 'pb-24' : ''}`}>
        {renderPage()}
      </main>
      {isBoostModalOpen && (
        <BoostModal
          isOpen={isBoostModalOpen}
          onClose={() => setBoostModalOpen(false)}
          onSelectDifficulty={handleSelectBoostDifficulty}
        />
      )}
      {completionInfo && (
          <WorkoutCompleteModal
              isOpen={!!completionInfo}
              onClose={handleCloseWorkoutCompleteModal}
              workout={completionInfo.workout}
              isFinalBlock={completionInfo.isFinal}
              showQrButton={isQrLoggingEnabledForWorkout(completionInfo.workout)}
          />
      )}
      {isGeneratingBoost && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 flex-col gap-4" role="dialog" aria-modal="true" aria-labelledby="generating-boost-title">
            <div className="relative w-16 h-16 text-primary">
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
              <div className="absolute w-full h-full rounded-full bg-current opacity-70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
            </div>
            <p id="generating-boost-title" className="text-xl text-white font-semibold">Genererar din Dagens Boost...</p>
        </div>
      )}
      {isPasswordModalOpen && (
        <PasswordModal
          coachPassword={selectedOrganization?.passwords.coach}
          onClose={() => setIsPasswordModalOpen(false)}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setSessionRole('coach');
            if (selectedStudio) {
                navigateTo(Page.Coach);
            } else {
                navigateTo(Page.StudioSelection);
            }
          }}
        />
      )}
       {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />}
       {workoutForQr && (
          <QRCodeModal 
            isOpen={!!workoutForQr}
            onClose={() => setWorkoutForQr(null)}
            workout={workoutForQr}
          />
       )}
      {isMusicPlayerVisible && player && playerState && selectedStudio && (
        <MusicPlayerBar player={player!} playerState={playerState} studioId={selectedStudio.id} />
      )}
       {!isFullScreenPage && <Footer />}
    </div>
  );
}

// Header Component
const Header: React.FC<{ page: Page; onBack: () => void; theme: string, toggleTheme: () => void, isVisible?: boolean, activeCustomPageTitle?: string, onSignOut?: () => void, role?: UserRole, historyLength: number }> = ({ page, onBack, theme, toggleTheme, isVisible = true, activeCustomPageTitle, onSignOut, role, historyLength }) => {
  const themeToggleButton = (
    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Växla tema">
      {theme === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );

  const canGoBack = historyLength > 1;

  if (page === Page.Home) {
      return (
        <header className="w-full max-w-5xl mx-auto flex justify-end items-center pb-8">
           {themeToggleButton}
        </header>
      );
  }

  const getTitle = () => {
    switch(page) {
      case Page.CustomContent: return activeCustomPageTitle || 'Information';
      case Page.AIGenerator: return "Pass & Program";
      case Page.FreestandingTimer: return "Fristående Timer";
      case Page.WorkoutBuilder: return "Passbyggaren";
      case Page.SimpleWorkoutBuilder: return "Skapa Nytt Pass";
      case Page.WorkoutList: return "Välj Pass";
      case Page.SavedWorkouts: return "Sparade pass";
      case Page.Warmup: return "Uppvärmning";
      case Page.StudioSelection: return "Välj Studio";
      case Page.AdminConfig: return "Konfigurera Studio";
      case Page.SuperAdmin: return "";
      case Page.SystemOwner: return "Systemägare";
      case Page.RepsOnly: return "Övningar";
      case Page.StartProgram: return "Startprogram";
      case Page.Checklist: return "Checklista";
      case Page.BasicNutrition: return "Grundläggande Kost";
      default: return "";
    }
  }

  return (
    <header className={`w-full max-w-5xl mx-auto flex items-center transition-all duration-300 ease-in-out ${isVisible ? 'pb-8 opacity-100 max-h-40' : 'pb-0 opacity-0 max-h-0 pointer-events-none overflow-hidden'}`}>
      <div className="flex-1">
        {canGoBack && (
            <button onClick={onBack} className="text-primary hover:brightness-95 transition-colors text-lg font-semibold">
                <span>Tillbaka</span>
            </button>
        )}
      </div>
      <div className="flex-1 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getTitle()}</h1>
      </div>
      <div className="flex-1 flex justify-end items-center gap-4">
         {themeToggleButton}
         {onSignOut && (
            <button onClick={onSignOut} className="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors text-lg font-semibold">
                Logga ut
            </button>
         )}
      </div>
    </header>
  );
};


// Footer Component
const Footer: React.FC = () => (
  <footer className="w-full text-center text-gray-500 dark:text-gray-500 text-xs pt-8">
    <p>© 2025 Flexibel Hälsostudio. Alla rättigheter förbehållna.</p>
  </footer>
);

// WorkoutListScreen Component
interface WorkoutListScreenProps {
    passkategori: string;
    workouts: Workout[];
    onSelectWorkout: (workout: Workout) => void;
}

const WorkoutListScreen: React.FC<WorkoutListScreenProps> = ({ passkategori, workouts, onSelectWorkout }) => {
    return (
        <div className="w-full max-w-5xl mx-auto text-center">
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-8">{passkategori}</h1>
            {workouts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workouts.map(workout => (
                        <div key={workout.id} className="relative group">
                            <button
                                onClick={() => onSelectWorkout(workout)}
                                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold p-6 rounded-lg transition-colors duration-200 flex flex-col items-start justify-start text-xl shadow-lg text-left h-48"
                            >
                                <span className="text-2xl font-bold text-primary mb-2">{workout.title}</span>
                                <p className="text-sm font-normal text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">{workout.coachTips}</p>
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-xl">Det finns inga publicerade pass i denna passkategori ännu.</p>
            )}
        </div>
    );
}

// Screen for timer-less blocks
const RepsOnlyScreen: React.FC<{ block: WorkoutBlock; onFinish: () => void; onShowImage: (url: string) => void; }> = ({ block, onFinish, onShowImage }) => {
    
    const formatExerciseName = (ex: Exercise | null) => {
      if (!ex) return null;
      return ex.reps ? `${ex.reps} ${ex.name}` : ex.name;
    };

    return (
        <div className="w-full h-full flex-grow flex flex-col dark:bg-black">
            <div className="w-full max-w-5xl mx-auto flex-shrink-0 flex flex-col items-center justify-center p-6 md:p-8 rounded-2xl bg-gray-700">
                <h1 className="text-4xl md:text-6xl lg:text-7xl text-white uppercase tracking-widest">{block.title}</h1>
                <p className="text-xl text-gray-300 mt-2">Utför övningarna i din egen takt.</p>
            </div>
            
            <div className="w-full bg-transparent flex-grow overflow-y-auto mt-6">
                <div className="w-full max-w-5xl mx-auto p-4">
                    <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
                        <div className="space-y-2 mt-4">
                            {block.exercises.map((ex) => (
                                <div key={ex.id} className="p-4 rounded-lg bg-gray-200 dark:bg-slate-900 text-gray-800 dark:text-gray-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-3xl font-bold">{formatExerciseName(ex)}</p>
                                        {ex.imageUrl && (
                                            <button 
                                                onClick={() => onShowImage(ex.imageUrl!)} 
                                                className="text-current opacity-80 hover:opacity-100 transition"
                                                aria-label="Visa övningsbild"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    {ex.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ex.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full flex-shrink-0 py-4">
                <div className="w-full max-w-5xl mx-auto flex items-center justify-center">
                    <button onClick={onFinish} className="font-semibold py-3 px-8 rounded-lg flex items-center justify-center gap-2 text-md transition-colors text-white shadow-md bg-primary hover:brightness-95">
                        Klar med blocket
                    </button>
                </div>
            </div>
        </div>
    );
};


// TimerScreen Component
const TimerScreen: React.FC<{ block: WorkoutBlock; onFinish: (isNatural?: boolean) => void; onHeaderVisibilityChange: (isVisible: boolean) => void; onShowImage: (url: string) => void; }> = ({ block, onFinish, onHeaderVisibilityChange, onShowImage }) => {
  const { 
    status, currentTime, currentRound, currentExercise,
    start, pause, resume, reset, 
    totalRounds, totalExercises, currentExerciseIndex,
    isLastExerciseInRound,
    totalBlockDuration, totalTimeElapsed
  } = useWorkoutTimer(block);
  
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const hideTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    start();
  }, [start]);

  const isFreestanding = block.tag === 'Fristående';
  
  React.useEffect(() => {
    if (status === TimerStatus.Finished) {
      onFinish(true);
    }
  }, [status, onFinish]);

  const restartHideTimer = React.useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
        hideTimeoutRef.current = window.setTimeout(() => {
            setControlsVisible(false);
        }, 3000);
    }
  }, [status]);

  React.useEffect(() => {
    onHeaderVisibilityChange(controlsVisible);
  }, [controlsVisible, onHeaderVisibilityChange]);

  React.useEffect(() => {
    return () => onHeaderVisibilityChange(true);
  }, [onHeaderVisibilityChange]);

  React.useEffect(() => {
    if (controlsVisible) {
        restartHideTimer();
    }
    return () => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [controlsVisible, restartHideTimer]);

  React.useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) {
        restartHideTimer();
    } else {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        setControlsVisible(true);
    }
  }, [status, restartHideTimer]);

  const handleScreenInteraction = () => {
      if (!controlsVisible) {
          setControlsVisible(true);
      }
      restartHideTimer();
  };
  
  const onButtonPress = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    if (!controlsVisible) {
        setControlsVisible(true);
    }
    restartHideTimer();
  };


  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const timerStyle = getTimerStyle(status, block.settings.mode);
  
  const getProgress = () => totalBlockDuration === 0 ? 0 : (totalTimeElapsed / totalBlockDuration) * 100;

  const { outerAnimationClass, innerAnimationClass } = useMemo(() => {
    const totalTimeRemaining = totalBlockDuration - totalTimeElapsed;

    if (status !== TimerStatus.Running || totalTimeRemaining > 15) {
      return { outerAnimationClass: '', innerAnimationClass: '' };
    }

    let outerAnimClass = '';
    let innerAnimClass = '';
    if (totalTimeRemaining <= 5) {
      outerAnimClass = 'animate-pulse-bg-intense';
      innerAnimClass = 'animate-pulse-inset-intense';
    } else if (totalTimeRemaining <= 10) {
      outerAnimClass = 'animate-pulse-bg-medium';
      innerAnimClass = 'animate-pulse-inset-medium';
    } else {
      outerAnimClass = 'animate-pulse-bg-light';
      innerAnimClass = 'animate-pulse-inset-light';
    }
    
    return { outerAnimationClass: outerAnimClass, innerAnimationClass: innerAnimClass };
  }, [status, totalBlockDuration, totalTimeElapsed]);


  const getTopText = () => {
    switch (status) {
      case TimerStatus.Idle: return "Starta Block";
      case TimerStatus.Preparing: return `Gör dig redo`;
      case TimerStatus.Running:
        switch (block.settings.mode) {
          case TimerMode.Interval: return 'Arbete';
          case TimerMode.Tabata: return 'TABATA';
          case TimerMode.EMOM: return `EMOM ${totalRounds}`;
          case TimerMode.TimeCap: return `Time Cap ${Math.floor(block.settings.workTime / 60)} min`;
          case TimerMode.AMRAP: return `AMRAP ${Math.floor(block.settings.workTime / 60)} min`;
          case TimerMode.Stopwatch: return 'Stoppur';
          default: return 'Arbete';
        }
      case TimerStatus.Resting: return 'Vila';
      case TimerStatus.Paused: return 'Pausad';
      case TimerStatus.Finished: return 'Bra jobbat!';
      default: return '';
    }
  };
  
  const formatExerciseName = (ex: Exercise | null) => {
    if (!ex) return null;
    return ex.reps ? `${ex.reps} ${ex.name}` : ex.name;
  };
  
  const buttonClass = "font-semibold py-3 px-5 rounded-lg flex items-center justify-center gap-2 text-md transition-colors text-white shadow-md";

  const showRoundCounter =
    (block.settings.mode === TimerMode.Interval ||
      block.settings.mode === TimerMode.Tabata ||
      block.settings.mode === TimerMode.EMOM) &&
    totalRounds > 1 &&
    status !== TimerStatus.Idle &&
    status !== TimerStatus.Finished;

  const showExerciseCounter =
    (block.settings.mode === TimerMode.Interval ||
      block.settings.mode === TimerMode.Tabata ||
      block.settings.mode === TimerMode.EMOM) &&
    totalExercises > 1 &&
    status !== TimerStatus.Idle &&
    status !== TimerStatus.Finished;

  const roundCounterLabel = block.settings.mode === TimerMode.EMOM ? 'Minut' : 'Varv';


  return (
    <div 
        className={`w-full h-full flex-grow flex flex-col dark:bg-black transition-colors duration-500 ${outerAnimationClass}`}
        style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
        onClick={handleScreenInteraction}
    >
      <div 
        className={`w-full max-w-5xl mx-auto flex-shrink-0 flex flex-col items-center justify-center p-6 md:p-8 rounded-2xl transition-all duration-500 min-h-[200px] md:min-h-[250px] lg:min-h-[300px] lg:min-h-[300px] ${timerStyle.bg} ${innerAnimationClass}`}
      >
        <p className="text-4xl md:text-6xl lg:text-7xl text-white/80 uppercase tracking-widest mb-4">{getTopText()}</p>
        
        <p className="font-mono text-7xl sm:text-9xl md:text-[10rem] lg:text-[11rem] leading-none font-black text-white" style={{fontVariantNumeric: 'tabular-nums'}}>
          {formatTime(currentTime)}
        </p>

        <div className="w-full max-w-lg my-6">
            <div className="h-2 bg-white/20 rounded-full">
                <div className="h-2 bg-white rounded-full" style={{ width: `${getProgress()}%`, transition: 'width 0.5s ease-out' }}></div>
            </div>
        </div>

        <div className="text-center text-white/90 space-y-2">
          {(block.settings.mode === TimerMode.Interval || block.settings.mode === TimerMode.Tabata) &&
            status !== TimerStatus.Idle && status !== TimerStatus.Finished && (
              <p className="text-xl lg:text-2xl">
                {(totalRounds)} x ({formatTime(block.settings.workTime)} / {formatTime(block.settings.restTime)})
              </p>
            )}
          
          {(showRoundCounter || showExerciseCounter) && (
            <p className="text-2xl lg:text-3xl">
              {showRoundCounter && (
                <span className={showExerciseCounter ? "mr-6" : ""}>
                  {roundCounterLabel}: {currentRound} / {totalRounds}
                </span>
              )}
              {showExerciseCounter && (
                <span>
                  Övning: {currentExerciseIndex + 1} / {totalExercises}
                </span>
              )}
            </p>
          )}

        </div>
      </div>

      <div className={`w-full flex-shrink-0 py-4 transition-all duration-300 ${controlsVisible ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 py-0 overflow-hidden'}`}>
        <div className="w-full max-w-5xl mx-auto flex items-center justify-center gap-3">
          {status === TimerStatus.Idle && (
            <div className="flex items-center justify-center gap-3 w-full">
              <button onClick={onButtonPress(start)} className={`${buttonClass} bg-primary hover:brightness-95 flex-1`}>
                Starta
              </button>
              <button onClick={onButtonPress(() => onFinish(false))} className={`${buttonClass} bg-gray-600 hover:bg-gray-500 flex-1`}>
                Avbryt
              </button>
            </div>
          )}
          {status === TimerStatus.Paused && (
             <div className="flex items-center justify-center gap-3">
              <button onClick={onButtonPress(resume)} className={`${buttonClass} bg-primary hover:brightness-95`}>
                Fortsätt
              </button>
              <button onClick={onButtonPress(reset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
                Återställ
              </button>
              <button onClick={onButtonPress(() => onFinish(false))} className={`${buttonClass} bg-red-600 hover:bg-red-500`}>
                Avsluta Block
              </button>
            </div>
          )}
          {(status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing) && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={onButtonPress(pause)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
                Pausa
              </button>
              <button onClick={onButtonPress(reset)} className={`${buttonClass} bg-gray-600 hover:bg-gray-500`}>
                Återställ
              </button>
              <button onClick={onButtonPress(() => onFinish(false))} className={`${buttonClass} bg-red-600 hover:bg-red-500`}>
                Avsluta Block
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full bg-transparent flex-grow overflow-y-auto">
          {!isFreestanding && (
            <div className="w-full max-w-5xl mx-auto p-4">
              <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
                <div
                  className="w-full text-gray-600 dark:text-gray-300 mb-2 flex justify-between items-center"
                >
                  <span className="font-semibold text-lg">
                    Övningar i "{block.title}"
                  </span>
                </div>
                <div className={`mt-4 ${block.exercises.length > 10 ? 'grid sm:grid-cols-2 gap-2' : 'space-y-2'}`}>
                  {block.exercises.map((ex, index) => {
                    const isCurrent = index === currentExerciseIndex;
                    
                    const currentTimerStyle = getTimerStyle(status, block.settings.mode);
                    const workStyle = getTimerStyle(TimerStatus.Running, block.settings.mode);

                    let highlightClass = 'bg-gray-200 dark:bg-slate-900 text-gray-800 dark:text-gray-200';
                    let borderClass = 'border-2 border-transparent'; 

                    const highlightableModes = [TimerMode.Interval, TimerMode.Tabata, TimerMode.EMOM];
                    const shouldHighlight = highlightableModes.includes(block.settings.mode) && block.followMe === true;

                    if (shouldHighlight) {
                        if (status === TimerStatus.Running && isCurrent) {
                            highlightClass = `${workStyle.bg} ${workStyle.text}`;
                        } else if ((status === TimerStatus.Resting || status === TimerStatus.Preparing) && isCurrent) {
                            borderClass = `${currentTimerStyle.border} border-2`;
                        }
                    }

                    return (
                      <div key={ex.id} className={`p-4 rounded-lg transition-all duration-300 ${highlightClass} ${borderClass}`}>
                        <div className="flex justify-between items-center">
                          <p className="text-3xl font-bold">{formatExerciseName(ex)}</p>
                          {ex.imageUrl && (
                              <button 
                                  onClick={(e) => { e.stopPropagation(); onShowImage(ex.imageUrl!); }} 
                                  className="text-current opacity-80 hover:opacity-100 transition"
                                  aria-label="Visa övningsbild"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                              </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};