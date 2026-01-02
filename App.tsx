import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, TimerSettings, Passkategori, Studio, StudioConfig, Organization, CustomPage, CustomCategoryWithPrompt, UserRole, InfoMessage, DisplayWindow, Note, StartGroup, InfoCarousel, WorkoutQRPayload } from './types';

import { useStudio } from './context/StudioContext';
import { useAuth } from './context/AuthContext';
import { useWorkout } from './context/WorkoutContext';

// --- ROUTER ---
import { AppRouter } from './components/AppRouter';

// --- Services ---
import { parseWorkoutFromText } from './services/geminiService';
import { createOrganization, updateGlobalConfig, updateStudioConfig, createStudio, updateOrganization, updateOrganizationPasswords, updateOrganizationLogos, updateOrganizationPrimaryColor, updateOrganizationCustomPages, updateStudio, deleteStudio, deleteOrganization, updateOrganizationInfoCarousel, deleteImageByUrl } from './services/firebaseService';

// --- Components ---
import { WorkoutCompleteModal } from './components/WorkoutCompleteModal';
import { PasswordModal } from './components/PasswordModal';
import { ReAuthModal } from './components/ReAuthModal';
import { StudioSelectionScreen } from './components/StudioSelectionScreen';
import { StudioConfigModal } from './components/AdminConfigScreen';
import { LoginScreen } from './components/LoginScreen';
import { DeveloperToolbar } from './components/DeveloperToolbar';
import { InfoCarouselBanner } from './components/InfoCarouselBanner';
import { TermsOfServiceModal } from './components/TermsOfServiceModal';
import { SupportChat } from './components/SupportChat';
import { Screensaver } from './components/common/Screensaver';
import { ImagePreviewModal } from './components/ui/ImagePreviewModal';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { SeasonalOverlay } from './components/common/SeasonalOverlay';
// NY IMPORT: ScanButton
import { ScanButton } from './components/ScanButton';

// --- Main App ---
export default function App() {
  const { authLoading, currentUser, role, isStudioMode } = useAuth();
  const { studioLoading, selectedStudio, selectOrganization, allOrganizations, selectedOrganization } = useStudio();
  const { workouts, activeWorkout, setActiveWorkout, saveWorkout, deleteWorkout } = useWorkout();
  
  useEffect(() => {
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
      return (
        <div className="bg-black text-white min-h-screen">
          <StudioSelectionScreen onStudioSelected={() => { /* Context laddar om automatiskt */ }} />
        </div>
      );
  }

  return <MainContent />;
}

// Hjälpfunktion för att kopiera pass
const deepCopyAndPrepareAsNew = (workoutToCopy: Workout): Workout => {
    const newWorkout = JSON.parse(JSON.stringify(workoutToCopy));
    
    newWorkout.id = `workout-${Date.now()}`;
    newWorkout.title = `KOPIA - ${workoutToCopy.title}`;
    newWorkout.isPublished = false;
    newWorkout.isFavorite = false;
    newWorkout.createdAt = Date.now();
    delete newWorkout.participants; 

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
  const { role, userData, isStudioMode, signOut, isImpersonating, startImpersonation, stopImpersonation, showTerms, acceptTerms, currentUser } = useAuth();
  const { workouts, isLoading: workoutsLoading, activeWorkout, setActiveWorkout, saveWorkout, deleteWorkout } = useWorkout();
  
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // --- UI State ---
  const [activeBlock, setActiveBlock] = useState<WorkoutBlock | null>(null);
  const [activePasskategori, setActivePasskategori] = useState<string | null>(null);
  const [activeCustomPage, setActiveCustomPage] = useState<CustomPage | null>(null);
  const [racePrepState, setRacePrepState] = useState<{ groups: StartGroup[]; interval: number } | null>(null);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null);
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
  
  // --- NYTT FÖR LOGGNING ---
  const [mobileLogData, setMobileLogData] = useState<{workoutId: string, organizationId: string} | null>(null);

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });

  const [isTimerHeaderVisible, setIsTimerHeaderVisible] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [isBackButtonHidden, setIsBackButtonHidden] = useState(false);
  const [followMeShowImage, setFollowMeShowImage] = useState(true);
  const inactivityTimerRef = useRef<number | null>(null);

  // --- Screensaver Logic ---
    const pagesThatPreventScreensaver: Page[] = [Page.Timer, Page.RepsOnly, Page.IdeaBoard];

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (studioConfig.enableScreensaver && !pagesThatPreventScreensaver.includes(page)) {
            const timeoutMinutes = studioConfig.screensaverTimeoutMinutes || 15;
            inactivityTimerRef.current = window.setTimeout(() => {
                setIsScreensaverActive(true);
            }, timeoutMinutes * 60 * 1000);
        }
    }, [studioConfig.enableScreensaver, studioConfig.screensaverTimeoutMinutes, page]);

    const handleUserActivity = useCallback(() => {
        if (isScreensaverActive) setIsScreensaverActive(false);
        resetInactivityTimer();
    }, [isScreensaverActive, resetInactivityTimer]);

    useEffect(() => {
        resetInactivityTimer();
        return () => { if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
    }, [resetInactivityTimer, page]);

    useEffect(() => {
        const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
        events.forEach(event => window.addEventListener(event, handleUserActivity));
        return () => { events.forEach(event => window.removeEventListener(event, handleUserActivity)); };
    }, [handleUserActivity]);

  // --- Info Banner Logic ---
  const activeInfoMessages = useMemo((): InfoMessage[] => {
    const infoCarousel = selectedOrganization?.infoCarousel;
    if (!infoCarousel?.isEnabled || !selectedStudio || !infoCarousel.messages) return [];
    const now = new Date();
    return infoCarousel.messages.filter(msg => {
        const isStudioMatch = msg.visibleInStudios.includes('all') || msg.visibleInStudios.includes(selectedStudio.id);
        if (!isStudioMatch) return false;
        if (msg.startDate && new Date(msg.startDate) > now) return false;
        if (msg.endDate && new Date(msg.endDate) < now) return false;
        return true;
    }).sort((a, b) => a.internalTitle.localeCompare(b.internalTitle));
  }, [selectedOrganization, selectedStudio]);

  const isInfoBannerVisible = page === Page.Home && activeInfoMessages.length > 0;

  // --- Role & History Init ---
  useEffect(() => {
    if (isImpersonating) return;
    if (role === 'systemowner') setHistory([Page.SystemOwner]);
    else if (role === 'organizationadmin') setHistory([Page.SuperAdmin]);
    else setHistory([Page.Home]);
  }, [role, isImpersonating]);
  
  useEffect(() => {
    setSessionRole(role);
  }, [role]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };
  
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);
  
  useEffect(() => {
    const root = document.documentElement;
    const primaryColor = selectedOrganization?.primaryColor;
    if (primaryColor) root.style.setProperty('--color-primary', primaryColor);
    else root.style.removeProperty('--color-primary');
  }, [selectedOrganization]);

  // --- Navigation Functions ---
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

  const handleBack = useCallback(() => {
    if (customBackHandler) {
      customBackHandler();
      return;
    }
    if (history.length <= 1) return;

    const currentPage = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    if (currentPage === Page.Coach && role === 'member') {
        setSessionRole('member');
    }
    
    if (currentPage === Page.IdeaBoard) setWorkoutToVisualize(null);
    if (currentPage === Page.MobileLog) setMobileLogData(null); // Clear log data
    
    if (newHistory[newHistory.length - 1] === Page.Home && (role === 'systemowner' || role === 'organizationadmin') && !isImpersonating) {
      if (role === 'systemowner') setHistory([Page.SystemOwner]);
      else setHistory([Page.SuperAdmin]);
      return;
    }

    setHistory(newHistory);
  }, [history, role, isImpersonating, customBackHandler]);

  // --- Business Logic Handlers ---
  const handleCreateNewWorkout = () => {
    setActiveWorkout(null);
    setFocusedBlockId(null);
    setIsEditingNewDraft(true);
    if (sessionRole === 'member') navigateTo(Page.SimpleWorkoutBuilder);
    else navigateTo(Page.WorkoutBuilder);
  };

  const handleEditWorkout = (workout: Workout, blockId?: string) => {
    setActiveWorkout(workout);
    setFocusedBlockId(blockId || null);
    setIsEditingNewDraft(false);
    if (sessionRole === 'member') navigateTo(Page.SimpleWorkoutBuilder);
    else navigateTo(Page.WorkoutBuilder);
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
    if (workoutToToggle) await saveWorkout({ ...workoutToToggle, isPublished });
  };

  const handleToggleFavoriteStatus = async (workoutId: string) => {
    const workoutToToggle = workouts.find(w => w.id === workoutId);
    if (workoutToToggle) await saveWorkout({ ...workoutToToggle, isFavorite: !workoutToToggle.isFavorite });
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    await deleteWorkout(workoutId);
    if (activeWorkout?.id === workoutId && page === Page.WorkoutDetail) {
      handleBack();
    }
  };
  
  const handleStartBlock = (block: WorkoutBlock, workoutContext: Workout) => {
    setActiveWorkout(workoutContext);
    setActiveBlock(block);
    if (block.settings.mode === TimerMode.NoTimer) navigateTo(Page.RepsOnly);
    else navigateTo(Page.Timer);
  };

  const handleStartFreestandingTimer = (block: WorkoutBlock) => {
    if (!selectedOrganization) return alert("Kan inte starta timer: ingen organisation är vald.");
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
    if (workout.blocks.length > 0) handleStartBlock(workout.blocks[0], workout);
  };
  
  const handleDuplicateWorkout = (workoutToCopy: Workout) => {
    const newDraft = deepCopyAndPrepareAsNew(workoutToCopy);
    setActiveWorkout(newDraft);
    setIsEditingNewDraft(true);
    navigateTo(Page.WorkoutBuilder);
  };

  const handleSelectPasskategori = (passkategori: Passkategori) => {
    const publishedWorkouts = workouts.filter(w => w.isPublished && w.category === passkategori);
    if (publishedWorkouts.length === 1) handleSelectWorkout(publishedWorkouts[0]);
    else {
        setActivePasskategori(passkategori);
        navigateTo(Page.WorkoutList);
    }
  };
  
  const handleCoachAccessRequest = () => {
    if (sessionRole === 'member') setIsPasswordModalOpen(true);
    else navigateTo(Page.Coach);
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
        setIsBackButtonHidden(false);
        setActiveRaceId(raceId);
        navigateReplace(Page.HyroxRaceDetail);
        return;
    }
    if (completionInfo) return; 
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

  // --- Admin/Studio Config Handlers ---
  const handleSaveStudioConfig = async (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>) => {
    try {
      const updatedStudio = await updateStudioConfig(organizationId, studioId, newConfigOverrides);
      selectStudio(updatedStudio); 
      setAllStudios(prev => prev.map(s => s.id === studioId ? updatedStudio : s));
      setStudioToEditConfig(null);
    } catch (error) {
      console.error("Failed to save studio config:", error);
      alert("Kunde inte spara konfigurationen.");
    }
  };

  const handleEditStudioConfig = (studio: Studio) => setStudioToEditConfig(studio);

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
          const newOrgs = allOrganizations.map(o => o.id === organizationId ? { ...o, studios: [...o.studios, newStudio] } : o);
          setAllOrganizations(newOrgs);
          const updatedOrg = newOrgs.find(o => o.id === organizationId);
          if (updatedOrg) selectOrganization(updatedOrg);
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
                    return { ...o, studios: o.studios.map(s => s.id === studioId ? { ...s, name } : s) };
                }
                return o;
            });
            setAllOrganizations(newOrgs);
            const updatedOrg = newOrgs.find(o => o.id === organizationId);
            if (updatedOrg) selectOrganization(updatedOrg);
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
                    return { ...o, studios: o.studios.filter(s => s.id !== studioId) };
                }
                return o;
            });
            setAllOrganizations(newOrgs);
            const updatedOrg = newOrgs.find(o => o.id === organizationId);
            if (updatedOrg) selectOrganization(updatedOrg);
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
        alert(`Kunde inte skapa organisation: ${error instanceof Error ? error.message : "Okänt fel"}`);
    }
  };
  
  const handleUpdateOrganization = async (organizationId: string, name: string, subdomain: string) => {
    try {
        const updatedOrg = await updateOrganization(organizationId, name, subdomain);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update organization:", error);
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
        alert("Kunde inte ta bort organisationen.");
    }
  };
  
  const handleUpdateOrganizationPasswords = async (organizationId: string, passwords: Organization['passwords']) => {
    try {
        const updatedOrg = await updateOrganizationPasswords(organizationId, passwords);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update passwords:", error);
    }
  };

  const handleUpdateOrganizationLogos = async (organizationId: string, logos: { light: string; dark: string }) => {
    try {
        const updatedOrg = await updateOrganizationLogos(organizationId, logos);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update logos:", error);
    }
  };

  const handleUpdateOrganizationPrimaryColor = async (organizationId: string, color: string) => {
    try {
        const updatedOrg = await updateOrganizationPrimaryColor(organizationId, color);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update primary color:", error);
    }
  };

  const handleUpdateOrganizationCustomPages = async (organizationId: string, customPages: CustomPage[]) => {
    try {
        const updatedOrg = await updateOrganizationCustomPages(organizationId, customPages);
        setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update custom pages:", error);
    }
  };

    const handleUpdateOrganizationInfoCarousel = async (organizationId: string, infoCarousel: InfoCarousel) => {
        try {
            const updatedOrg = await updateOrganizationInfoCarousel(organizationId, infoCarousel);
            setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
            if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
        } catch (error) {
            console.error("Failed to update info carousel:", error);
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
    if (selectedOrganization) selectOrganization(selectedOrganization);
    selectStudio(studio);
    startImpersonation({ role: 'member', isStudioMode: true });
    setHistory([Page.Home]);
  };

  const handleReturnToAdmin = () => setIsReAuthModalOpen(true);
  
  const handleSelectRace = (raceId: string) => {
    setActiveRaceId(raceId);
    navigateTo(Page.HyroxRaceDetail);
  };

  const handleScanCode = (data: string | null) => {
      // HÄR KAN VI HANTERA SKANNINGEN
      // Om data är en länk eller JSON, parsa den och navigera
      if (!data) return;
      try {
          // Exempel på data: {"wid":"...","oid":"..."} base64 encoded
          // Vi låter ScanButton sköta själva avkodningen om den är smart, 
          // annars gör vi det här. Men MobileLogData är vad vi siktar på.
          // För nu antar vi att ScanButton eller QRScannerScreen gör jobbet och redirectar.
          // Om vi behöver sätta state manuellt:
          // setMobileLogData({ workoutId: '...', organizationId: '...' });
          // navigateTo(Page.MobileLog);
          console.log("Scanned code:", data);
      } catch (e) {
          console.error("Scan error", e);
      }
  };

  // --- Constants for Layout ---
  const isFullScreenPage = page === Page.Timer || page === Page.RepsOnly || page === Page.IdeaBoard;
  const paddingClass = isFullScreenPage ? '' : 'p-4 sm:p-6 lg:p-8';
  const isHomeInStudio = isStudioMode && page === Page.Home;
  const isMember = !!currentUser && role === 'member' && !isStudioMode;

  // --- Main Render ---
  return (
    <div className={`bg-white dark:bg-black text-gray-800 dark:text-gray-200 font-sans flex flex-col ${isHomeInStudio ? 'lg:h-screen lg:overflow-hidden min-h-screen' : 'min-h-screen'} ${paddingClass}`}>
       <SeasonalOverlay page={page} />
       
       {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center p-2 font-semibold z-[1001]">
            Du är offline. Viss funktionalitet kan vara begränsad och ändringar sparas lokalt.
        </div>
       )}
       
       <DeveloperToolbar />
       
       {/* Header logic remains in App.tsx to control visibility globally */}
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
        showClock={isStudioMode && (page === Page.WorkoutDetail)}
        hideBackButton={isBackButtonHidden}
        onCoachAccessRequest={handleCoachAccessRequest}
        showCoachButton={isStudioMode}
        onMemberProfileRequest={role === 'member' ? () => navigateTo(Page.MemberProfile) : undefined}
      />}

      <main 
        className={`flex-grow ${isFullScreenPage ? 'block w-full relative' : `flex flex-col items-center ${page === Page.Home ? 'justify-start' : 'justify-center'}`} ${isInfoBannerVisible && page === Page.Home ? 'pb-0 lg:pb-[512px]' : ''}`}
      >
        <AppRouter 
            page={page}
            navigateTo={navigateTo}
            handleBack={handleBack}
            role={sessionRole}
            userData={userData}
            studioConfig={studioConfig}
            selectedOrganization={selectedOrganization}
            allOrganizations={allOrganizations}
            isStudioMode={isStudioMode}
            isImpersonating={isImpersonating}
            theme={theme}
            
            workouts={workouts}
            activeWorkout={activeWorkout}
            activeBlock={activeBlock}
            
            passkategoriFilter={activePasskategori}
            activeCustomPage={activeCustomPage}
            activeRaceId={activeRaceId}
            racePrepState={racePrepState}
            followMeShowImage={followMeShowImage}
            mobileLogData={mobileLogData}
            
            onSelectWorkout={handleSelectWorkout}
            onSelectPasskategori={handleSelectPasskategori}
            onCreateNewWorkout={handleCreateNewWorkout}
            onStartBlock={handleStartBlock}
            onEditWorkout={handleEditWorkout}
            onDeleteWorkout={handleDeleteWorkout}
            onSaveWorkout={handleSaveAndNavigate}
            onTogglePublish={handleTogglePublishStatus}
            onToggleFavorite={handleToggleFavoriteStatus}
            onDuplicateWorkout={handleDuplicateWorkout}
            
            functions={{
                selectOrganization: handleSelectOrganization,
                createOrganization: handleCreateOrganization,
                deleteOrganization: handleDeleteOrganization,
                saveGlobalConfig: handleSaveGlobalConfig,
                createStudio: handleCreateStudio,
                updateStudio: handleUpdateStudio,
                deleteStudio: handleDeleteStudio,
                updatePasswords: handleUpdateOrganizationPasswords,
                updateLogos: handleUpdateOrganizationLogos,
                updatePrimaryColor: handleUpdateOrganizationPrimaryColor,
                updateOrganization: handleUpdateOrganization,
                updateCustomPages: handleUpdateOrganizationCustomPages,
                updateInfoCarousel: handleUpdateOrganizationInfoCarousel,
                
                saveCustomPage: handleSaveCustomPage,
                deleteCustomPage: handleDeleteCustomPage,
                editCustomPage: handleEditCustomPage,
                
                editStudioConfig: handleEditStudioConfig,
                switchToStudioView: handleSwitchToStudioView,
                
                handleCoachAccessRequest: handleCoachAccessRequest,
                handleReturnToAdmin: handleReturnToAdmin,
                setShowImage: setPreviewImageUrl,
                setTimerHeaderVisible: setIsTimerHeaderVisible,
                setBackButtonHidden: setIsBackButtonHidden,
                setRacePrepState: setRacePrepState,
                setCompletionInfo: setCompletionInfo,
                setRegisteringHyroxTime: setIsRegisteringHyroxTime,
                setFollowMeShowImage: setFollowMeShowImage,
                
                handleGeneratedWorkout: handleGeneratedWorkout,
                handleWorkoutInterpreted: handleWorkoutInterpretedFromNote,
                setAiGeneratorInitialTab: setAiGeneratorInitialTab,
                setCustomBackHandler: setCustomBackHandler,
                
                handleStartFreestandingTimer: handleStartFreestandingTimer,
                handleStartRace: handleStartRace,
                handleSelectRace: handleSelectRace,
                handleReturnToGroupPrep: handleReturnToGroupPrep,
                handleSelectCustomPage: handleSelectCustomPage
            }}
        />
      </main>
      
      {completionInfo && (
          <WorkoutCompleteModal
              isOpen={!!completionInfo}
              onClose={isRegisteringHyroxTime ? () => { setIsRegisteringHyroxTime(false); setCompletionInfo(null); } : handleCloseWorkoutCompleteModal}
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
            if (selectedStudio) navigateTo(Page.Coach);
            else navigateTo(Page.StudioSelection);
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
       
       {isInfoBannerVisible && <InfoCarouselBanner messages={activeInfoMessages} className="hidden lg:flex bottom-0" forceDark={isScreensaverActive} />}

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
                bottomOffset={isInfoBannerVisible ? (window.innerWidth >= 1024 ? 512 : 0) : 0}
            />
        )}
       {showTerms && <TermsOfServiceModal onAccept={acceptTerms} />}
       {!isFullScreenPage && <Footer />}
       {!isStudioMode && <SupportChat />}

       {/* --- SCAN BUTTON FOR MEMBERS --- */}
       {isMember && (
           <div className="fixed bottom-6 right-6 z-50">
               <ScanButton onScan={handleScanCode} />
           </div>
       )}
    </div>
  );
}