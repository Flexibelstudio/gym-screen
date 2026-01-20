
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, TimerSettings, Passkategori, Studio, StudioConfig, Organization, CustomPage, UserRole, InfoMessage, StartGroup, InfoCarousel, WorkoutDiploma } from './types';

import { useStudio } from './context/StudioContext';
import { useAuth } from './context/AuthContext';
import { useWorkout } from './context/WorkoutContext';

// --- ROUTER ---
import { AppRouter } from './components/AppRouter';

// --- Services ---
import { createOrganization, updateGlobalConfig, updateStudioConfig, createStudio, updateOrganization, updateOrganizationPasswords, updateOrganizationLogos, updateOrganizationPrimaryColor, updateOrganizationCustomPages, updateStudio, deleteStudio, archiveOrganization as deleteOrganization, updateOrganizationInfoCarousel, updateOrganizationFavicon } from './services/firebaseService';

// --- Utils ---
import { deepCopyAndPrepareAsNew } from './utils/workoutUtils';

// --- Components ---
import { WorkoutCompleteModal } from './components/WorkoutCompleteModal';
import { PasswordModal } from './components/PasswordModal';
import { ReAuthModal } from './components/ReAuthModal';
import { StudioSelectionScreen } from './components/StudioSelectionScreen';
import { StudioConfigModal } from './components/AdminConfigScreen';
import { LoginScreen } from './components/LoginScreen';
import { LandingPage } from './components/LandingPage';
import { DeveloperToolbar } from './components/DeveloperToolbar';
import { InfoCarouselBanner } from './components/InfoCarouselBanner';
import { TermsOfServiceModal } from './components/TermsOfServiceModal';
import { SupportChat } from './components/SupportChat';
import { Screensaver } from './components/common/Screensaver';
import { ImagePreviewModal } from './components/ui/ImagePreviewModal';
import { Header } from './components/layout/Header';
import { SeasonalOverlay } from './components/common/SeasonalOverlay';
import { SpotlightOverlay } from './components/SpotlightOverlay';
import { PBOverlay } from './components/PBOverlay'; 
import { ScanButton } from './components/ScanButton';
import { WorkoutLogScreen } from './mobile/screens/WorkoutLogScreen';
import { WorkoutListScreen } from './components/WorkoutListScreen';
import { WebQRScanner } from './components/WebQRScanner';
import { motion, AnimatePresence } from 'framer-motion';
import WorkoutDetailScreen from './components/WorkoutDetailScreen';
import { CloseIcon, PencilIcon } from './components/icons';
import { WorkoutDiplomaView } from './components/WorkoutDiplomaView';

// --- Modals ---
import { CancelConfirmationModal } from './components/modals/CancelConfirmationModal';

const THEME_STORAGE_KEY = 'flexibel-screen-theme';

const App: React.FC = () => {
  const { 
    selectedStudio, selectStudio, setAllStudios,
    selectedOrganization, selectOrganization, allOrganizations, setAllOrganizations,
    studioConfig, studioLoading
  } = useStudio();
  const { role, userData, isStudioMode, signOut, isImpersonating, startImpersonation, stopImpersonation, showTerms, acceptTerms, currentUser, authLoading } = useAuth();
  const { workouts, activeWorkout, setActiveWorkout, saveWorkout, deleteWorkout } = useWorkout();
  
  const [sessionRole, setSessionRole] = useState<UserRole>(role);
  const [showLogin, setShowLogin] = useState(true);
  
  const [history, setHistory] = useState<Page[]>(() => {
      if (isStudioMode) return [Page.Home];
      if (role === 'systemowner') return [Page.SystemOwner];
      if (role === 'organizationadmin') return [Page.SuperAdmin];
      return [Page.MemberProfile];
  });

  const page = history[history.length - 1];

  useEffect(() => {
    if (!authLoading && !isStudioMode && currentUser) {
      const isAtInitialPage = history.length === 1;
      const currentPage = history[history.length - 1];

      if (role === 'systemowner' && currentPage !== Page.SystemOwner && isAtInitialPage) {
        setHistory([Page.SystemOwner]);
      } else if (role === 'organizationadmin' && currentPage !== Page.SuperAdmin && isAtInitialPage) {
        setHistory([Page.SuperAdmin]);
      } else if (role === 'member' && currentPage !== Page.MemberProfile && isAtInitialPage) {
        setHistory([Page.MemberProfile]);
      }
    }
  }, [role, authLoading, isStudioMode, history, currentUser]);

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

  const [activeBlock, setActiveBlock] = useState<WorkoutBlock | null>(null);
  const [activePasskategori, setActivePasskategori] = useState<string | null>(null);
  const [isPickingForLog, setIsPickingForLog] = useState(false);
  const [activeCustomPage, setActiveCustomPage] = useState<CustomPage | null>(null);
  const [racePrepState, setRacePrepState] = useState<{ groups: StartGroup[]; interval: number } | null>(null);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null);
  const [isEditingNewDraft, setIsEditingNewDraft] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [customPageToEdit, setCustomPageToEdit] = useState<CustomPage | null>(null);
  const [studioToEditConfig, setStudioToEditConfig] = useState<Studio | null>(null);
  const [completionInfo, setCompletionInfo] = useState<{ workout: Workout, isFinal: boolean, blockTag?: string, finishTime?: number } | null>(null);
  const [preferredAdminTab, setPreferredAdminTab] = useState<string>('dashboard');
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);
  const [reAuthPurpose, setReAuthPurpose] = useState<'admin' | 'profile'>('admin');

  const [isRegisteringHyroxTime, setIsRegisteringHyroxTime] = useState(false);
  const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage' | 'create'>('create');
  
  const [mobileLogData, setMobileLogData] = useState<{workoutId: string, organizationId: string} | null>(null);
  const [mobileViewData, setMobileViewData] = useState<Workout | null>(null); 
  const [isSearchWorkoutOpen, setIsSearchWorkoutOpen] = useState(false);
  const [showLogCancelModal, setShowLogCancelModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeDiploma, setActiveDiploma] = useState<WorkoutDiploma | null>(null);

  useEffect(() => {
      if (mobileLogData || mobileViewData || isSearchWorkoutOpen || isScannerOpen || activeDiploma) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
  }, [mobileLogData, mobileViewData, isSearchWorkoutOpen, isScannerOpen, activeDiploma]);

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
  const [profileEditTrigger, setProfileEditTrigger] = useState(0);

  // Dynamically update favicon and apple-touch-icon based on organization branding
  useEffect(() => {
    const faviconUrl = selectedOrganization?.faviconUrl;
    if (faviconUrl) {
      // Update browser tab icon
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = faviconUrl;

      // Update PWA/iOS homescreen icon
      let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
      if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        document.getElementsByTagName('head')[0].appendChild(appleLink);
      }
      appleLink.href = faviconUrl;
    }
  }, [selectedOrganization?.faviconUrl]);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const logPayload = params.get('log');
      if (logPayload) {
          try {
              const decoded = JSON.parse(atob(logPayload));
              if (decoded.wid && decoded.oid) {
                  setMobileLogData({ workoutId: decoded.wid, organizationId: decoded.oid });
                  window.history.replaceState({}, document.title, window.location.pathname);
              }
          } catch (e) {
              console.error("Failed to parse QR payload from URL", e);
          }
      }
  }, []);

  const pagesThatPreventScreensaver: Page[] = [
      Page.Timer, 
      Page.RepsOnly, 
      Page.IdeaBoard, 
      Page.MemberProfile, 
      Page.MemberRegistry, 
      Page.MobileLog
  ];

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
    
    if (currentPage === Page.IdeaBoard) setActiveWorkout(null);

    if (currentPage === Page.WorkoutList && isPickingForLog) {
        setIsPickingForLog(false);
    }
    
    setHistory(newHistory);
  }, [history, role, isImpersonating, customBackHandler, setActiveWorkout, isPickingForLog]);

  const handleMemberProfileRequest = () => {
      if (isStudioMode) {
          setReAuthPurpose('profile');
          setIsReAuthModalOpen(true);
      } else {
          setProfileEditTrigger(0); 
          if (page !== Page.MemberProfile) {
              navigateTo(Page.MemberProfile);
          }
      }
  };

  const handleEditProfileRequest = () => {
      if (isStudioMode) {
          setReAuthPurpose('profile');
          setIsReAuthModalOpen(true);
      } else {
          setProfileEditTrigger(Date.now());
          if (page !== Page.MemberProfile) {
              navigateTo(Page.MemberProfile);
          }
      }
  };

  const handleReturnToAdminRequest = () => {
      if (currentUser?.isAnonymous) {
          // Om vi är helt anonyma, logga ut så vi ser inloggningssidan
          signOut();
      } else {
          setReAuthPurpose('admin');
          setIsReAuthModalOpen(true);
      }
  };

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

  const handleAdjustWorkout = (workoutToAdjust: Workout) => {
    const newDraft = deepCopyAndPrepareAsNew(workoutToAdjust);
    newDraft.title = `Justering: ${workoutToAdjust.title}`;
    newDraft.isMemberDraft = true;
    newDraft.isPublished = false;
    if (!newDraft.organizationId && selectedOrganization) {
        newDraft.organizationId = selectedOrganization.id;
    }
    setActiveWorkout(newDraft);
    setIsEditingNewDraft(true);
    navigateTo(Page.SimpleWorkoutBuilder);
  };

  const handleSaveAndNavigate = async (workout: Workout, startFirstBlock?: boolean) => {
    const savedWorkout = await saveWorkout(workout);
    if (startFirstBlock && savedWorkout.blocks.length > 0) {
        handleStartBlock(savedWorkout.blocks[0], savedWorkout);
    } else {
        setActiveWorkout(savedWorkout);
        navigateReplace(Page.WorkoutDetail);
        if (sessionRole !== 'member') {
            setPreferredAdminTab('pass-program');
        }
    }
  };

  const handleSaveOnly = async (workout: Workout) => {
      return await saveWorkout(workout);
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
        organizationId: selectedOrganization.id,
        createdAt: Date.now() 
    };
    handleStartBlock(block, tempWorkout);
  };

  const handleSelectWorkout = (workout: Workout, action: 'view' | 'log' = 'view') => {
    if (isStudioMode) {
        setActiveWorkout(workout);
        navigateTo(Page.WorkoutDetail);
        return;
    }

    if (action === 'view') {
        setMobileViewData(workout);
        return;
    }

    if (isSearchWorkoutOpen && selectedOrganization) {
        handleLogWorkoutRequest(workout.id, selectedOrganization.id);
        return;
    }

    if (isPickingForLog && selectedOrganization) {
        handleLogWorkoutRequest(workout.id, selectedOrganization.id);
        return;
    }

    if (action === 'log' && selectedOrganization) {
        handleLogWorkoutRequest(workout.id, selectedOrganization.id);
        return;
    }

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
    if (!isStudioMode) setIsPickingForLog(true); 
    setActivePasskategori(passkategori);
    navigateTo(Page.WorkoutList);
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
    setActiveWorkout({ ...workout }); // Option 2: Remove isMemberDraft flag
    setIsEditingNewDraft(true);
    navigateTo(Page.SimpleWorkoutBuilder);
  };
  
  const handleReturnToGroupPrep = useCallback(() => {
    if (activeWorkout && (activeWorkout.id.startsWith('hyrox-full-race') || activeWorkout.id.startsWith('custom-race'))) {
        setRacePrepState({
            groups: activeWorkout.startGroups || [],
            interval: activeWorkout.startIntervalMinutes || 2,
        });
        handleBack();
    }
  }, [activeWorkout, handleBack]);

  const handleTimerFinish = useCallback((finishData: { isNatural?: boolean; time?: number, raceId?: string } = {}) => {
    const { isNatural = false, time, raceId } = finishData;

    // Om vi har ett raceId betyder det att ett lopp precis slutförts manuellt och sparats.
    if (raceId) {
        setIsBackButtonHidden(false);
        setActiveRaceId(raceId);
        // Använd navigateReplace för att ta bort "Timer" från historikstacken
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
      if (history.length > 1) {
          handleBack();
      }
    } else {
      handleBack();
    }
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  }

  const handleLogWorkoutRequest = (workoutId: string, orgId: string) => {
    setIsSearchWorkoutOpen(false);
    setMobileViewData(null); 
    setMobileLogData({ workoutId, organizationId: orgId });
  };

  const handleCancelLog = (isSuccess?: boolean, diploma?: WorkoutDiploma) => {
      if (isSuccess === true) {
          setMobileLogData(null);
          if (diploma) {
              setActiveDiploma(diploma);
          }
      } else {
          setShowLogCancelModal(true);
      }
  };

  const confirmCancelLog = () => {
      localStorage.removeItem('smart-skarm-active-log');
      setMobileLogData(null);
      setShowLogCancelModal(false);
  };

  const closeCancelModal = () => {
      setShowLogCancelModal(false);
  };

  const handleScanCode = (data: string | null) => {
      if (!data) return;
      try {
          let payload: any;
          if (data.includes('log=')) {
              const parts = data.split('log=');
              const base64 = parts[1].split('&')[0];
              payload = JSON.parse(atob(base64));
          } else {
              payload = JSON.parse(data);
          }
          if (payload && payload.wid && payload.oid) {
              handleLogWorkoutRequest(payload.wid, payload.oid);
              setIsScannerOpen(false);
          }
      } catch (e) {
          console.error("Failed to parse scanned code", e);
      }
  };

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
          const newOrgs = allOrganizations.length > 0 ? allOrganizations.map(o => o.id === organizationId ? { ...o, studios: [...o.studios, newStudio] } : o) : [];
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
  
  const handleUpdateOrganization = async (organizationId: string, name: string, subdomain: string, inviteCode?: string) => {
    try {
        const updatedOrg = await updateOrganization(organizationId, name, subdomain, inviteCode);
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
        throw error;
    }
  };

  const handleUpdateOrganizationLogos = async (organizationId: string, logos: { light: string; dark: string }) => {
    try {
        const updatedOrg = await updateOrganizationLogos(organizationId, logos);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update logos:", error);
        throw error;
    }
  };

  const handleUpdateOrganizationFavicon = async (organizationId: string, faviconUrl: string) => {
    try {
        const updatedOrg = await updateOrganizationFavicon(organizationId, faviconUrl);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update favicon:", error);
        throw error;
    }
  };

  const handleUpdateOrganizationPrimaryColor = async (organizationId: string, color: string) => {
    try {
        const updatedOrg = await updateOrganizationPrimaryColor(organizationId, color);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update primary color:", error);
        throw error;
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

  const handleSelectRace = (raceId: string) => {
    setActiveRaceId(raceId);
    navigateTo(Page.HyroxRaceDetail);
  };

  const isFullScreenPage = page === Page.Timer || page === Page.RepsOnly || page === Page.IdeaBoard;
  const paddingClass = isFullScreenPage ? '' : 'p-4 sm:p-6 lg:p-8';
  
  const isAdminOrCoach = role === 'systemowner' || role === 'organizationadmin' || role === 'coach';
  const isMemberFacingPage = [Page.Home, Page.WorkoutDetail, Page.SavedWorkouts, Page.MemberProfile, Page.WorkoutList].includes(page);
  const isAdminFacingPage = [Page.Coach, Page.SuperAdmin, Page.SystemOwner, Page.AdminAnalytics, Page.MemberRegistry].includes(page);

  const showSupportChat = !isStudioMode && isAdminOrCoach && isAdminFacingPage;
  const showScanButton = ((!isStudioMode && isMemberFacingPage) || (page === Page.MemberProfile)) && studioConfig.enableWorkoutLogging;

  // OM INTE INLOGGAD OCH INTE STUDIO MODE -> VISA LANDNINGSSIDA
  if (!authLoading && !currentUser && !isStudioMode) {
      if (showLogin) {
          return <LoginScreen onClose={() => setShowLogin(false)} />;
      }
      return <LandingPage onLoginClick={() => setShowLogin(true)} />;
  }

  // OM INLOGGAD MEN DATA SAKNAS (Firestore document inte skapat än)
  if (currentUser && !userData && !isStudioMode && !authLoading) {
    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Slutför din profil...</h2>
            <p className="text-gray-500 mt-2">Hittade inget medlemskonto för {currentUser.email}.</p>
            <button onClick={() => signOut()} className="mt-6 text-primary font-bold hover:underline">Logga ut och försök igen</button>
        </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-black text-gray-800 dark:text-gray-200 font-sans flex flex-col ${isStudioMode && page === Page.Home ? 'h-screen overflow-hidden' : 'min-h-screen'} ${paddingClass}`}>
       <SeasonalOverlay page={page} />
       
       {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center p-2 font-semibold z-[1001]">
            Du är offline. Viss funktionalitet kan vara begränsad och ändringar sparas lokalt.
        </div>
       )}
       
       <DeveloperToolbar />
       
       {isStudioMode && <SpotlightOverlay />} 
       {isStudioMode && <PBOverlay />}

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
        onMemberProfileRequest={handleMemberProfileRequest} 
        onEditProfileRequest={handleEditProfileRequest}
        isStudioMode={isStudioMode}
      />}

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
          <main 
            className={`flex-1 min-0 w-full ${isFullScreenPage ? 'block relative' : `flex flex-col items-center ${page === Page.Home ? 'justify-start' : 'justify-center'}`}`}
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
                mobileLogData={null}
                
                preferredAdminTab={preferredAdminTab}
                profileEditTrigger={profileEditTrigger}

                onSelectWorkout={handleSelectWorkout}
                onSelectPasskategori={handleSelectPasskategori}
                onCreateNewWorkout={handleCreateNewWorkout}
                onStartBlock={handleStartBlock}
                onEditWorkout={handleEditWorkout}
                onDeleteWorkout={handleDeleteWorkout}
                onSaveWorkout={handleSaveAndNavigate}
                onSaveWorkoutNoNav={handleSaveOnly}
                onTogglePublish={handleTogglePublishStatus}
                onToggleFavorite={handleToggleFavoriteStatus}
                onDuplicateWorkout={handleDuplicateWorkout}
                onTimerFinish={handleTimerFinish}
                
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
                    updateFavicon: handleUpdateOrganizationFavicon,
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
                    handleReturnToAdmin: handleReturnToAdminRequest, 
                    handleGoToSystemOwner: () => setHistory([Page.SystemOwner]),
                    setShowImage: (url) => setPreviewImageUrl(url),
                    setTimerHeaderVisible: setIsTimerHeaderVisible,
                    setBackButtonHidden: setIsBackButtonHidden,
                    setRacePrepState: setRacePrepState,
                    setCompletionInfo: setCompletionInfo,
                    setRegisteringHyroxTime: setRegisteringHyroxTime,
                    setFollowMeShowImage: setFollowMeShowImage,
                    
                    handleGeneratedWorkout: handleGeneratedWorkout,
                    handleWorkoutInterpreted: handleWorkoutInterpretedFromNote,
                    handleAdjustWorkout: handleAdjustWorkout,
                    setAiGeneratorInitialTab: setAiGeneratorInitialTab,
                    setCustomBackHandler: setCustomBackHandler,
                    
                    handleStartFreestandingTimer: handleStartFreestandingTimer,
                    handleStartRace: handleStartRace,
                    handleSelectRace: handleSelectRace,
                    handleSelectCustomPage: handleSelectCustomPage,
                    handleReturnToGroupPrep: handleReturnToGroupPrep,
                    
                    handleMemberProfileRequest: handleMemberProfileRequest,
                    handleEditProfileRequest: handleEditProfileRequest,
                    handleLogWorkoutRequest: handleLogWorkoutRequest
                }}
            />
          </main>
          
          {isInfoBannerVisible && (
              <div className="flex-shrink-0 w-full h-[320px] lg:h-[480px] xl:h-[512px] relative z-[40]">
                  <InfoCarouselBanner 
                    messages={activeInfoMessages} 
                    className="relative !h-full" 
                    forceDark={isScreensaverActive} 
                  />
              </div>
          )}
      </div>
      
      <AnimatePresence>
          {isSearchWorkoutOpen && (
              <>
                  <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990]"
                      onClick={() => setIsSearchWorkoutOpen(false)}
                  />
                  <motion.div 
                      initial={{ y: '100%', opacity: 0 }}
                      animate={{ y: '0%', opacity: 1 }}
                      exit={{ y: '100%', opacity: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="fixed inset-x-0 top-[5vh] bottom-[5vh] z-[10000] px-1 pointer-events-none"
                  >
                      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] h-full max-w-2xl mx-auto shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                          <div className="flex-grow overflow-y-auto pt-6">
                            <WorkoutListScreen 
                                onSelectWorkout={handleSelectWorkout}
                            />
                          </div>
                          <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                                <button 
                                    onClick={() => setIsSearchWorkoutOpen(false)}
                                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold py-4 rounded-2xl transition-all active:scale-95"
                                >
                                    STÄNG
                                </button>
                          </div>
                      </div>
                  </motion.div>
              </>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {mobileViewData && (
              <>
                  <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10010]"
                      onClick={() => setMobileViewData(null)}
                  />
                  <motion.div 
                      initial={{ y: '100%', opacity: 0 }}
                      animate={{ y: '0%', opacity: 1 }}
                      exit={{ y: '100%', opacity: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="fixed inset-x-0 top-[8vh] bottom-0 z-[10020] px-1 pointer-events-none"
                  >
                      <div className="bg-white dark:bg-gray-900 rounded-t-[2.5rem] h-full max-w-2xl mx-auto shadow-2xl overflow-hidden flex flex-col pointer-events-auto border-t border-gray-200 dark:border-gray-800">
                          <div className="flex-shrink-0 p-4 flex justify-center items-center relative">
                              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                              <button 
                                onClick={() => setMobileViewData(null)}
                                className="absolute right-6 p-2 bg-gray-100 dark:bg-gray-800 rounded-full"
                              >
                                  <CloseIcon className="w-5 h-5 text-gray-400" />
                              </button>
                          </div>
                          
                          <div className="flex-grow overflow-y-auto pt-2">
                             {selectedOrganization && (
                                <WorkoutDetailScreen 
                                    workout={mobileViewData} 
                                    onStartBlock={(block) => handleStartBlock(block, mobileViewData)} 
                                    onUpdateBlockSettings={() => {}}
                                    onEditWorkout={() => {}} 
                                    onAdjustWorkout={handleAdjustWorkout}
                                    isCoachView={false} 
                                    onTogglePublish={() => {}}
                                    onToggleFavorite={handleToggleFavoriteStatus}
                                    onDuplicate={() => {}}
                                    onShowImage={setPreviewImageUrl} 
                                    isPresentationMode={false}
                                    studioConfig={studioConfig}
                                    followMeShowImage={followMeShowImage}
                                    setFollowMeShowImage={setFollowMeShowImage}
                                    onUpdateWorkout={handleSaveOnly}
                                    onVisualize={() => {}}
                                    onLogWorkout={handleLogWorkoutRequest}
                                    onClose={() => setMobileViewData(null)}
                                />
                             )}
                          </div>
                      </div>
                  </motion.div>
              </>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {mobileLogData && (
              <>
                  <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10030]"
                      onClick={() => handleCancelLog(false)}
                  />
                  <motion.div 
                      initial={{ y: '100%', opacity: 0 }}
                      animate={{ y: '0%', opacity: 1 }}
                      exit={{ y: '100%', opacity: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="fixed inset-x-0 top-[5vh] bottom-[5vh] z-[10040] px-1 pointer-events-none"
                  >
                      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] h-full max-w-2xl mx-auto shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                          <WorkoutLogScreen 
                              workoutId={mobileLogData.workoutId} 
                              organizationId={mobileLogData.organizationId} 
                              onClose={handleCancelLog}
                          />
                      </div>
                  </motion.div>
              </>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {activeDiploma && (
              <WorkoutDiplomaView 
                diploma={activeDiploma} 
                onClose={() => setActiveDiploma(null)} 
              />
          )}
      </AnimatePresence>

      <AnimatePresence>
          {isScannerOpen && (
            <WebQRScanner 
                onScan={handleScanCode}
                onClose={() => setIsScannerOpen(false)}
            />
          )}
      </AnimatePresence>

      <AnimatePresence>
          {showLogCancelModal && (
              <CancelConfirmationModal 
                  onConfirm={confirmCancelLog} 
                  onCancel={closeCancelModal} 
              />
          )}
      </AnimatePresence>

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
          onClose={handleClosePasswordModal}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setSessionRole('coach');
            // Tvinga navigering direkt till coachvyn
            navigateTo(Page.Coach);
          }}
        />
      )}
      
      {isReAuthModalOpen && (
        <ReAuthModal
            onClose={() => setIsReAuthModalOpen(false)}
            onSuccess={() => {
                setIsReAuthModalOpen(false);
                if (reAuthPurpose === 'admin') {
                    stopImpersonation();
                    setHistory([Page.SuperAdmin]);
                } else {
                    setProfileEditTrigger(Date.now());
                    if (page !== Page.MemberProfile) {
                        navigateTo(Page.MemberProfile);
                    }
                }
            }}
        />
      )}
       
       {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />}
       
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
       
       {showSupportChat && <SupportChat />}

       {showScanButton && !mobileLogData && !mobileViewData && !isSearchWorkoutOpen && (
          <div className="fixed bottom-6 right-6 z-50">
              <ScanButton 
                onScan={() => setIsScannerOpen(true)} 
                onLogWorkout={handleLogWorkoutRequest}
                onSearch={() => {
                    setIsSearchWorkoutOpen(true);
                }} 
              />
          </div>
       )}
    </div>
  );
}

export default App;
