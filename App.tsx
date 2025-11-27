
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, TimerSettings, Passkategori, Studio, StudioConfig, Organization, CustomPage, CustomCategoryWithPrompt, UserRole, InfoMessage, DisplayWindow, Note, StartGroup, InfoCarousel } from './types';

import { useStudio } from './context/StudioContext';
import { useAuth } from './context/AuthContext';
import { useWorkout } from './context/WorkoutContext';

import { FreestandingTimerScreen } from './components/FreestandingTimerScreen';
import { parseWorkoutFromText } from './services/geminiService';
import { createOrganization, updateGlobalConfig, updateStudioConfig, createStudio, updateOrganization, updateOrganizationPasswords, updateOrganizationLogos, updateOrganizationPrimaryColor, updateOrganizationCustomPages, updateStudio, deleteStudio, deleteOrganization, updateOrganizationInfoCarousel, deleteImageByUrl } from './services/firebaseService';
import { WorkoutBuilderScreen } from './components/WorkoutBuilderScreen';
import { SimpleWorkoutBuilderScreen } from './components/SimpleWorkoutBuilderScreen';
import { WorkoutCompleteModal } from './components/WorkoutCompleteModal';
import WorkoutDetailScreen from './components/WorkoutDetailScreen';
import SavedWorkoutsScreen from './components/SavedWorkoutsScreen';
import { PasswordModal } from './components/PasswordModal';
import { ReAuthModal } from './components/ReAuthModal';
import { AIGeneratorScreen } from './components/AIGeneratorScreen';
import { CoachScreen } from './components/CoachScreen';
import { StudioSelectionScreen } from './components/StudioSelectionScreen';
import { StudioConfigModal } from './components/AdminConfigScreen';
import { SuperAdminScreen } from './components/SuperAdminScreen';
import { SystemOwnerScreen } from './components/SystemOwnerScreen';
import { HomeScreen } from './components/HomeScreen';
import { CustomContentScreen } from './components/CustomContentScreen';
import { LoginScreen } from './components/LoginScreen';
import { DeveloperToolbar } from './components/DeveloperToolbar';
import { CustomPageEditorScreen } from './components/CustomPageEditorScreen';
import { InfoCarouselBanner } from './components/InfoCarouselBanner';
import { NotesScreen } from './components/NotesScreen';
import { HyroxScreen } from './components/HyroxScreen';
import { TermsOfServiceModal } from './components/TermsOfServiceModal';
import { SupportChat } from './components/SupportChat';
import { HyroxRaceListScreen } from './components/HyroxRaceListScreen';
import { HyroxRaceDetailScreen } from './components/HyroxRaceDetailScreen';
import { TimerScreen } from './components/TimerScreen';
import { RepsOnlyScreen } from './components/RepsOnlyScreen';
import { WorkoutListScreen } from './components/WorkoutListScreen';
import { Screensaver } from './components/common/Screensaver';
import { ImagePreviewModal } from './components/ui/ImagePreviewModal';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';

// --- Main App Router ---
export default function App() {
  const { authLoading, currentUser, role, isStudioMode } = useAuth();
  const { studioLoading, selectedStudio, selectOrganization, allOrganizations, selectedOrganization } = useStudio();
  const { workouts, activeWorkout, setActiveWorkout, saveWorkout, deleteWorkout } = useWorkout();
  
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
      // Anonymous user (a a studio screen) needs to be configured.
      return (
        <div className="bg-black text-white min-h-screen">
          <StudioSelectionScreen onStudioSelected={() => { /* Reload handled by context */ }} />
        </div>
      );
  }

  return <MainContent />;
}

const deepCopyAndPrepareAsNew = (workoutToCopy: Workout): Workout => {
    const newWorkout = JSON.parse(JSON.stringify(workoutToCopy));
    
    newWorkout.id = `workout-${Date.now()}`;
    newWorkout.title = `KOPIA - ${workoutToCopy.title}`;
    newWorkout.isPublished = false; // Always a draft
    newWorkout.isFavorite = false;
    newWorkout.createdAt = Date.now();
    delete newWorkout.participants; // Do not copy participants

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

const THEME_STORAGE_KEY = 'flexibel-screen-theme';

const MainContent: React.FC = () => {
  const { 
    selectedStudio, selectStudio, allStudios, setAllStudios,
    selectedOrganization, selectOrganization, allOrganizations, setAllOrganizations,
    studioConfig
  } = useStudio();
  const { role, userData, isStudioMode, signOut, isImpersonating, startImpersonation, stopImpersonation, showTerms, acceptTerms } = useAuth();
  const { workouts, isLoading: workoutsLoading, activeWorkout, setActiveWorkout, saveWorkout, deleteWorkout } = useWorkout();
  
  // Local temporary role state for coach access
  const [sessionRole, setSessionRole] = useState<UserRole>(role);

  const [history, setHistory] = useState<Page[]>([Page.Home]);
  const page = history[history.length - 1];
  const [customBackHandler, setCustomBackHandler] = useState<(() => void) | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const [activeBlock, setActiveBlock] = useState<WorkoutBlock | null>(null);
  const [activePasskategori, setActivePasskategori] = useState<string | null>(null);
  const [activeCustomPage, setActiveCustomPage] = useState<CustomPage | null>(null);
  const [racePrepState, setRacePrepState] = useState<{ groups: StartGroup[]; interval: number } | null>(null);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null);
  
  // New state for visualizing workout on Idea Board
  const [workoutToVisualize, setWorkoutToVisualize] = useState<Workout | null>(null);

  const [isEditingNewDraft, setIsEditingNewDraft] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [customPageToEdit, setCustomPageToEdit] = useState<CustomPage | null>(null);
  const [studioToEditConfig, setStudioToEditConfig] = useState<Studio | null>(null);
  
  const [completionInfo, setCompletionInfo] = useState<{ workout: Workout, isFinal: boolean, blockTag?: string, finishTime?: number } | null>(null);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);
  const [isRegisteringHyroxTime, setIsRegisteringHyroxTime] = useState(false);

  const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage' | 'create'>('create');
  
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    // If no saved theme, respect user's OS preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    // Default to dark
    return 'dark';
  });
  const [isTimerHeaderVisible, setIsTimerHeaderVisible] = useState(true);
  
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [isBackButtonHidden, setIsBackButtonHidden] = useState(false);
  const [followMeShowImage, setFollowMeShowImage] = useState(true);
  const inactivityTimerRef = useRef<number | null>(null);

    const pagesThatPreventScreensaver: Page[] = [
        Page.Timer,
        Page.RepsOnly,
    ];

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }

        if (studioConfig.enableScreensaver && !pagesThatPreventScreensaver.includes(page)) {
            const timeoutMinutes = studioConfig.screensaverTimeoutMinutes || 15;
            inactivityTimerRef.current = window.setTimeout(() => {
                setIsScreensaverActive(true);
            }, timeoutMinutes * 60 * 1000);
        }
    }, [studioConfig.enableScreensaver, studioConfig.screensaverTimeoutMinutes, page]);

    const handleUserActivity = useCallback(() => {
        if (isScreensaverActive) {
            setIsScreensaverActive(false);
        }
        resetInactivityTimer();
    }, [isScreensaverActive, resetInactivityTimer]);

    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
            }
        };
    }, [resetInactivityTimer, page]);

    useEffect(() => {
        const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
        events.forEach(event => window.addEventListener(event, handleUserActivity));
        return () => {
            events.forEach(event => window.removeEventListener(event, handleUserActivity));
        };
    }, [handleUserActivity]);


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

  const activeInfoMessages = useMemo((): InfoMessage[] => {
    const infoCarousel = selectedOrganization?.infoCarousel;
    if (!infoCarousel?.isEnabled || !selectedStudio || !infoCarousel.messages) {
        return [];
    }
    const now = new Date();
    // Filter messages that are currently active
    return infoCarousel.messages.filter(msg => {
        const isStudioMatch = msg.visibleInStudios.includes('all') || msg.visibleInStudios.includes(selectedStudio.id);
        if (!isStudioMatch) return false;

        const hasStartDate = msg.startDate && msg.startDate.length > 0;
        const hasEndDate = msg.endDate && msg.endDate.length > 0;

        if (hasStartDate && new Date(msg.startDate!) > now) return false; // Not yet active
        if (hasEndDate && new Date(msg.endDate!) < now) return false; // Expired

        return true;
    }).sort((a, b) => a.internalTitle.localeCompare(b.internalTitle)); // Stable sort order
  }, [selectedOrganization, selectedStudio]);

  const isInfoBannerVisible = page === Page.Home && activeInfoMessages.length > 0;

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

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };
  
  const handleShowImage = (url: string) => {
    setPreviewImageUrl(url);
  };

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
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


  const navigateTo = (page: Page) => {
    setHistory(prev => [...prev, page]);
  };
  
  const navigateReplace = (page: Page) => {
    setHistory(prev => {
        const newHistory = prev.slice(0, -1);
        newHistory.push(page);
        return newHistory;
    });
  };

  const handleCreateNewWorkout = () => {
    setActiveWorkout(null);
    setFocusedBlockId(null);
    setIsEditingNewDraft(true);
    if (sessionRole === 'member') {
        navigateTo(Page.SimpleWorkoutBuilder);
    } else {
        navigateTo(Page.WorkoutBuilder);
    }
  };

  const handleEditWorkout = (workout: Workout, blockId?: string) => {
    setActiveWorkout(workout);
    setFocusedBlockId(blockId || null);
    setIsEditingNewDraft(false);
    if (sessionRole === 'member') {
      navigateTo(Page.SimpleWorkoutBuilder);
    } else {
      navigateTo(Page.WorkoutBuilder);
    }
  };

  const handleSaveAndNavigate = async (workout: Workout, startFirstBlock?: boolean) => {
    const savedWorkout = await saveWorkout(workout);
    if (startFirstBlock && savedWorkout.blocks.length > 0) {
        handleStartBlock(savedWorkout.blocks[0], savedWorkout);
    } else {
        setActiveWorkout(savedWorkout);
        const isCoachOrAdmin = sessionRole !== 'member';
        const cameFromBuilder = page === Page.WorkoutBuilder || page === Page.SimpleWorkoutBuilder;

        if (isCoachOrAdmin && cameFromBuilder) {
            setAiGeneratorInitialTab('manage');
            navigateReplace(Page.AIGenerator);
        } else {
            navigateReplace(Page.WorkoutDetail);
        }
    }
  };
  
  const handleTogglePublishStatus = async (workoutId: string, isPublished: boolean) => {
    const workoutToToggle = workouts.find(w => w.id === workoutId);
    if (workoutToToggle) {
        await saveWorkout({ ...workoutToToggle, isPublished });
    }
  };

  const handleToggleFavoriteStatus = async (workoutId: string) => {
    const workoutToToggle = workouts.find(w => w.id === workoutId);
    if (workoutToToggle) {
        await saveWorkout({ ...workoutToToggle, isFavorite: !workoutToToggle.isFavorite });
    }
  };

  const handleBack = useCallback(() => {
    if (customBackHandler) {
      customBackHandler();
      return;
    }
    if (history.length <= 1) return;

    const currentPage = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    if (currentPage === Page.Coach) {
      // If going back from coach screen, reset role to member if original role was member
      if(role === 'member') {
        setSessionRole('member');
      }
    }
    
    if (currentPage === Page.IdeaBoard) {
        setWorkoutToVisualize(null); // Clear visualization state
    }
    
    // if going back to home, and original role is admin/owner, go to their main page instead
    if (newHistory[newHistory.length - 1] === Page.Home && (role === 'systemowner' || role === 'organizationadmin') && !isImpersonating) {
      if (role === 'systemowner') setHistory([Page.SystemOwner]);
      else setHistory([Page.SuperAdmin]);
      return;
    }

    setHistory(newHistory);
  }, [history, role, isImpersonating, customBackHandler]);
  
  const handleDeleteWorkout = async (workoutId: string) => {
    await deleteWorkout(workoutId);
    if (activeWorkout?.id === workoutId && page === Page.WorkoutDetail) {
      handleBack();
    }
  };
  
  const handleStartBlock = (block: WorkoutBlock, workoutContext: Workout) => {
    setActiveWorkout(workoutContext);
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
    handleStartBlock(block, tempWorkout);
  };

  const handleSelectWorkout = (workout: Workout) => {
    setActiveWorkout(workout);
    if ((workout.id.startsWith('hyrox-full-race') || workout.id.startsWith('custom-race')) && workout.blocks.length > 0) {
      handleStartBlock(workout.blocks[0], workout);
    } else {
      navigateTo(Page.WorkoutDetail);
    }
  };

  const handleStartRace = (workout: Workout) => {
    if (workout.blocks.length > 0) {
      handleStartBlock(workout.blocks[0], workout);
    }
  };
  
  const handleDuplicateWorkout = (workoutToCopy: Workout) => {
    const newDraft = deepCopyAndPrepareAsNew(workoutToCopy);
    setActiveWorkout(newDraft);
    setIsEditingNewDraft(true);
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

  const handleGeneratedWorkout = (newWorkout: Workout) => {
    setActiveWorkout(newWorkout);
    setFocusedBlockId(null);
    setIsEditingNewDraft(true);
    navigateTo(Page.WorkoutBuilder);
  }
  
  const handleWorkoutInterpretedFromNote = (workout: Workout) => {
    setActiveWorkout({ ...workout, isMemberDraft: true });
    setIsEditingNewDraft(true);
    navigateTo(Page.SimpleWorkoutBuilder);
  };
  
  const handleTimerFinish = useCallback((finishData: { isNatural?: boolean; time?: number, raceId?: string } = {}) => {
    const { isNatural = false, time, raceId } = finishData;

    if (raceId) {
        setIsBackButtonHidden(false); // Ensure back button is shown on results screen
        setActiveRaceId(raceId);
        navigateReplace(Page.HyroxRaceDetail);
        return;
    }
    
    if (completionInfo) return; // Prevent re-triggering if modal is already open

    if (!isNatural) {
      handleBack();
      return;
    }

    if (activeWorkout && activeBlock) {
        const blockIndex = activeWorkout.blocks.findIndex(b => b.id === activeBlock.id);
        const isLastBlock = blockIndex === activeWorkout.blocks.length - 1;
        setCompletionInfo({ workout: activeWorkout, isFinal: isLastBlock, blockTag: activeBlock.tag, finishTime: time });
    } else if (activeWorkout) {
        setCompletionInfo({ workout: activeWorkout, isFinal: true, blockTag: activeWorkout.blocks[0]?.tag, finishTime: time });
    }
  }, [completionInfo, handleBack, activeWorkout, activeBlock]);

  const handleCloseWorkoutCompleteModal = () => {
    const isFinalBlock = completionInfo?.isFinal;
    setCompletionInfo(null);
    
    if (isFinalBlock) {
      const homePage = (role === 'systemowner' || role === 'organizationadmin') && !isImpersonating 
          ? (role === 'systemowner' ? Page.SystemOwner : Page.SuperAdmin) 
          : Page.Home;
      setHistory([homePage]);
    } else {
      handleBack();
    }
  };

  const handleReturnToGroupPrep = () => {
    if (activeWorkout && (activeWorkout.id.startsWith('hyrox-full-race') || activeWorkout.id.startsWith('custom-race'))) {
        setRacePrepState({
            groups: activeWorkout.startGroups || [],
            interval: activeWorkout.startIntervalMinutes || 2,
        });
        handleBack();
    }
  };


  const handleSaveStudioConfig = async (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>) => {
    try {
      const updatedStudio = await updateStudioConfig(organizationId, studioId, newConfigOverrides);
      selectStudio(updatedStudio); 
      setAllStudios(prev => prev.map(s => s.id === studioId ? updatedStudio : s));
      setStudioToEditConfig(null); // Close modal on success
    } catch (error) {
      console.error("Failed to save studio config:", error);
      alert("Kunde inte spara konfigurationen.");
    }
  };

  const handleEditStudioConfig = (studio: Studio) => {
      setStudioToEditConfig(studio);
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

  const handleUpdateOrganizationLogos = async (organizationId: string, logos: { light: string; dark: string }) => {
    try {
        const updatedOrg = await updateOrganizationLogos(organizationId, logos);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update organization logos:", error);
        alert(`Kunde inte uppdatera logotyper: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
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
        setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
        if (selectedOrganization?.id === organizationId) {
            selectOrganization(updatedOrg);
        }
    } catch (error) {
        console.error("Failed to update custom pages:", error);
        alert(`Kunde inte uppdatera infosidor: ${error instanceof Error ? error.message : "Ett okänt fel inträffade."}`);
    }
  };

    const handleUpdateOrganizationInfoCarousel = async (organizationId: string, infoCarousel: InfoCarousel) => {
        try {
            const updatedOrg = await updateOrganizationInfoCarousel(organizationId, infoCarousel);
            setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
            if (selectedOrganization?.id === organizationId) {
                selectOrganization(updatedOrg);
            }
        } catch (error) {
            console.error("Failed to update info carousel:", error);
            // Re-throw the error so the calling component can handle UI state
            throw error;
        }
    };
    
    const handleEditCustomPage = (page: CustomPage | null) => {
        setCustomPageToEdit(page);
        navigateTo(Page.CustomPageEditor);
    };

    const handleSaveCustomPage = async (pageData: CustomPage) => {
        if (!selectedOrganization) return;

        const isNew = !selectedOrganization.customPages?.some(p => p.id === pageData.id);
        const updatedPages = isNew
            ? [...(selectedOrganization.customPages || []), pageData]
            : (selectedOrganization.customPages || []).map(p => p.id === pageData.id ? pageData : p);
        
        await handleUpdateOrganizationCustomPages(selectedOrganization.id, updatedPages);
        handleBack();
    };
    
    const handleDeleteCustomPage = async (pageId: string) => {
        if (!selectedOrganization) return;
        if (window.confirm("Är du säker på att du vill ta bort denna infosida?")) {
            const updatedPages = (selectedOrganization.customPages || []).filter(p => p.id !== pageId);
            await handleUpdateOrganizationCustomPages(selectedOrganization.id, updatedPages);
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
    setIsReAuthModalOpen(true);
  };
  
  const handleSelectRace = (raceId: string) => {
    setActiveRaceId(raceId);
    navigateTo(Page.HyroxRaceDetail);
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
            onShowBoostModal={() => {}} 
            studioConfig={studioConfig} 
            organizationLogoUrlLight={selectedOrganization?.logoUrlLight}
            organizationLogoUrlDark={selectedOrganization?.logoUrlDark}
            theme={theme}
        />;
      case Page.WorkoutDetail:
        return activeWorkout && <WorkoutDetailScreen 
            workout={activeWorkout} 
            onStartBlock={(block) => handleStartBlock(block, activeWorkout)} 
            onUpdateBlockSettings={(blockId, newSettings) => {
                const updatedWorkout = {
                    ...activeWorkout,
                    blocks: activeWorkout.blocks.map(b => 
                        b.id === blockId ? { ...b, settings: { ...b.settings, ...newSettings } } : b
                    )
                };
                saveWorkout(updatedWorkout);
            }}
            onUpdateWorkout={(updatedWorkout) => {
                saveWorkout(updatedWorkout);
            }}
            onEditWorkout={handleEditWorkout} 
            isCoachView={sessionRole !== 'member'}
            onTogglePublish={handleTogglePublishStatus}
            onToggleFavorite={handleToggleFavoriteStatus}
            onDuplicate={handleDuplicateWorkout}
            onShowImage={handleShowImage} 
            isPresentationMode={isPresentationContext}
            studioConfig={studioConfig}
            onDelete={handleDeleteWorkout}
            followMeShowImage={followMeShowImage}
            setFollowMeShowImage={setFollowMeShowImage}
            onVisualize={(workout) => {
                setWorkoutToVisualize(workout);
                navigateTo(Page.IdeaBoard);
            }}
        />;
      case Page.Timer:
        return activeBlock && <TimerScreen 
            key={activeBlock.id} 
            block={activeBlock} 
            onFinish={handleTimerFinish} 
            onHeaderVisibilityChange={setIsTimerHeaderVisible} 
            onShowImage={handleShowImage} 
            setCompletionInfo={setCompletionInfo}
            setIsRegisteringHyroxTime={setIsRegisteringHyroxTime}
            setIsBackButtonHidden={setIsBackButtonHidden}
            followMeShowImage={followMeShowImage}
            organization={selectedOrganization}
            onBackToGroups={handleReturnToGroupPrep}
        />;
      case Page.RepsOnly:
        return activeBlock && <RepsOnlyScreen block={activeBlock} onFinish={() => handleTimerFinish({ isNatural: false })} onShowImage={handleShowImage} organization={selectedOrganization} />;
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
                  onEditWorkout={handleEditWorkout}
                  onDeleteWorkout={handleDeleteWorkout}
                  onTogglePublish={handleTogglePublishStatus}
                  onCreateNewWorkout={handleCreateNewWorkout}
                  initialMode={aiGeneratorInitialTab}
                  studioConfig={studioConfig}
                  setCustomBackHandler={setCustomBackHandler}
                  workouts={workouts}
                  workoutsLoading={workoutsLoading}
               />;
      case Page.FreestandingTimer:
        return <FreestandingTimerScreen onStart={handleStartFreestandingTimer} />;
      case Page.WorkoutBuilder:
        return <WorkoutBuilderScreen 
                  initialWorkout={activeWorkout}
                  onSave={handleSaveAndNavigate} 
                  onCancel={handleBack} 
                  focusedBlockId={focusedBlockId} 
                  studioConfig={studioConfig}
                  sessionRole={sessionRole}
                  isNewDraft={isEditingNewDraft}
                />;
      case Page.SimpleWorkoutBuilder:
        return <SimpleWorkoutBuilderScreen 
                  initialWorkout={activeWorkout}
                  onSave={handleSaveAndNavigate} 
                  onCancel={handleBack} 
               />;
      case Page.WorkoutList:
        return activePasskategori && <WorkoutListScreen 
            passkategori={activePasskategori}
            onSelectWorkout={handleSelectWorkout}
        />;
      case Page.SavedWorkouts:
        return <SavedWorkoutsScreen 
            workouts={workouts.filter(w => w.isMemberDraft)} 
            onSelectWorkout={handleSelectWorkout} 
            onEditWorkout={handleEditWorkout}
            onDeleteWorkout={handleDeleteWorkout}
            onToggleFavorite={handleToggleFavoriteStatus}
            onCreateNewWorkout={handleCreateNewWorkout}
            isStudioMode={isStudioMode}
            />;
      case Page.StudioSelection:
        return <StudioSelectionScreen onStudioSelected={handleBack} />;
      case Page.SuperAdmin:
        return selectedOrganization && <SuperAdminScreen 
                  organization={selectedOrganization}
                  adminRole={userData?.adminRole || 'admin'}
                  userRole={role}
                  theme={theme}
                  onSaveGlobalConfig={handleSaveGlobalConfig}
                  onEditStudioConfig={handleEditStudioConfig}
                  onCreateStudio={handleCreateStudio}
                  onUpdateStudio={handleUpdateStudio}
                  onDeleteStudio={handleDeleteStudio}
                  onUpdatePasswords={handleUpdateOrganizationPasswords}
                  onUpdateLogos={handleUpdateOrganizationLogos}
                  onUpdatePrimaryColor={handleUpdateOrganizationPrimaryColor}
                  onUpdateOrganization={handleUpdateOrganization}
                  onUpdateCustomPages={handleUpdateOrganizationCustomPages}
                  onSwitchToStudioView={handleSwitchToStudioView}
                  onEditCustomPage={handleEditCustomPage}
                  onDeleteCustomPage={handleDeleteCustomPage}
                  onUpdateInfoCarousel={handleUpdateOrganizationInfoCarousel}
                  onUpdateDisplayWindows={async () => {}} 
                  workouts={workouts}
                  workoutsLoading={workoutsLoading}
                  onSaveWorkout={saveWorkout}
                  onDeleteWorkout={handleDeleteWorkout}
                  onTogglePublish={handleTogglePublishStatus}
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
      case Page.CustomPageEditor:
        return <CustomPageEditorScreen
                  onSave={handleSaveCustomPage}
                  onCancel={handleBack}
                  pageToEdit={customPageToEdit}
               />
      case Page.IdeaBoard:
        return <NotesScreen 
            onWorkoutInterpreted={handleWorkoutInterpretedFromNote}
            studioConfig={studioConfig}
            initialWorkoutToDraw={workoutToVisualize}
        />;
      case Page.Hyrox:
        return <HyroxScreen 
                   navigateTo={navigateTo}
                   onSelectWorkout={handleStartRace}
                   studioConfig={studioConfig}
                   racePrepState={racePrepState}
                   onPrepComplete={() => setRacePrepState(null)}
               />;
      case Page.HyroxRaceList:
        return <HyroxRaceListScreen onSelectRace={handleSelectRace} />;
      case Page.HyroxRaceDetail:
        return activeRaceId && <HyroxRaceDetailScreen raceId={activeRaceId} onBack={handleBack} />;
      default:
        return <HomeScreen 
            navigateTo={navigateTo} 
            onSelectWorkout={handleSelectWorkout} 
            onSelectPasskategori={handleSelectPasskategori} 
            savedWorkouts={workouts}
            onCreateNewWorkout={handleCreateNewWorkout} 
            onShowBoostModal={() => {}} 
            studioConfig={studioConfig} 
            organizationLogoUrlLight={selectedOrganization?.logoUrlLight}
            organizationLogoUrlDark={selectedOrganization?.logoUrlDark}
            theme={theme}
        />;
    }
  };

  const isFullScreenPage = page === Page.Timer || page === Page.RepsOnly;
  const paddingClass = isFullScreenPage ? '' : 'p-4 sm:p-6 lg:p-8';

  const infoBannerHeight = 512; // h-[512px] in Tailwind

  const mainPaddingBottom = useMemo(() => {
    return isInfoBannerVisible ? infoBannerHeight : 0;
  }, [isInfoBannerVisible]);
  
  // Update: Remove Page.Home from showClock condition.
  // The header clock should only appear on specific pages like WorkoutDetail
  // where there isn't already a large prominent clock.
  const showClock = isStudioMode && (page === Page.WorkoutDetail);
  
  const primaryColor = selectedOrganization?.primaryColor || '#14b8a6';
  
  const handleCloseRegistration = () => {
    setIsRegisteringHyroxTime(false);
    setCompletionInfo(null);
  };

  return (
    <div className={`bg-white dark:bg-black text-gray-800 dark:text-gray-200 min-h-screen font-sans flex flex-col ${paddingClass}`}>
       {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center p-2 font-semibold z-[1001]">
            Du är offline. Viss funktionalitet kan vara begränsad och ändringar sparas lokalt.
        </div>
       )}
       <DeveloperToolbar />
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
        showClock={showClock}
        hideBackButton={isBackButtonHidden}
        onCoachAccessRequest={handleCoachAccessRequest}
        showCoachButton={isStudioMode}
      />}
      <main 
        className={`flex-grow flex flex-col items-center ${page === Page.Home ? 'justify-start' : 'justify-center'}`}
        style={{ paddingBottom: `${mainPaddingBottom}px`}}
      >
        {renderPage()}
      </main>
      
      {completionInfo && (
          <WorkoutCompleteModal
              isOpen={!!completionInfo}
              onClose={isRegisteringHyroxTime ? handleCloseRegistration : handleCloseWorkoutCompleteModal}
              workout={completionInfo.workout}
              isFinalBlock={completionInfo.isFinal}
              blockTag={completionInfo.blockTag}
              finishTime={completionInfo.finishTime}
              organizationId={selectedOrganization?.id}
              isRegistration={isRegisteringHyroxTime}
          />
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
      {isReAuthModalOpen && (
        <ReAuthModal
            onClose={() => setIsReAuthModalOpen(false)}
            onSuccess={() => {
                setIsReAuthModalOpen(false);
                stopImpersonation();
            }}
        />
      )}
       {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />}
       
       {isInfoBannerVisible && <InfoCarouselBanner messages={activeInfoMessages} className="bottom-0" forceDark={isScreensaverActive} />}

       {studioToEditConfig && selectedOrganization && (
        <StudioConfigModal
            isOpen={!!studioToEditConfig}
            onClose={() => setStudioToEditConfig(null)}
            studio={studioToEditConfig}
            organization={selectedOrganization}
            onSave={handleSaveStudioConfig}
        />
       )}
        {isScreensaverActive && (
            <Screensaver 
                logoUrl={selectedOrganization?.logoUrlDark || selectedOrganization?.logoUrlLight}
                bottomOffset={isInfoBannerVisible ? 512 : 0}
            />
        )}
       {showTerms && <TermsOfServiceModal onAccept={acceptTerms} />}
       {!isFullScreenPage && <Footer />}
       {!isStudioMode && <SupportChat />}
    </div>
  );
}
