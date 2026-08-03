import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Page, Workout, WorkoutBlock, Studio, Organization, CustomPage, UserRole, InfoMessage, StartGroup, InfoCarousel, WorkoutDiploma } from './types';

import { useStudio } from './context/StudioContext';
import { useAuth } from './context/AuthContext';
import { useWorkout } from './context/WorkoutContext';

// --- ROUTER ---
import { AppRouter } from './components/AppRouter';

// --- PAYWALL ---
import { PaywallScreen } from './components/PaywallScreen'; 
import { WelcomePaywall } from './components/WelcomePaywall'; 
import PendingCoachScreen from './components/PendingCoachScreen';

// --- Services ---
import { createOrganization, updateOrganization, updateOrganizationPasswords, updateOrganizationLogos, updateOrganizationPrimaryColor, updateOrganizationCustomPages, archiveOrganization as deleteOrganization, updateOrganizationInfoCarousel, updateOrganizationFavicon, updateOrganizationAppIcon } from './services/firebaseService';
import { Toast } from './components/ui/ToastNotification';

// --- Custom Hooks ---
import { useMinSplashTime } from './hooks/app/useMinSplashTime';
import { usePushToast } from './hooks/app/usePushToast';
import { useOnlineStatus } from './hooks/app/useOnlineStatus';
import { useTheme } from './hooks/app/useTheme';
import { useInactivityTimer } from './hooks/app/useInactivityTimer';
import { useNavigation } from './hooks/app/useNavigation';
import { useWorkoutActions } from './hooks/app/useWorkoutActions';
import { useTimerFlow } from './hooks/app/useTimerFlow';
import { useStudioAdmin } from './hooks/app/useStudioAdmin';

// --- Components ---
import { WorkoutCompleteModal } from './components/WorkoutCompleteModal';
import { PasswordModal } from './components/PasswordModal';
import { ReAuthModal } from './components/ReAuthModal';
import { StudioConfigModal } from './components/AdminConfigScreen';
import { LoginScreen } from './components/LoginScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';

const RegisterGymScreen = React.lazy(() => import('./components/RegisterGymScreen').then(m => ({ default: m.RegisterGymScreen })));
const LandingPage = React.lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
import { DeveloperToolbar } from './components/DeveloperToolbar';
import { InfoCarouselBanner } from './components/InfoCarouselBanner';
import { TermsOfServiceModal } from './components/TermsOfServiceModal';
import { SupportChat } from './components/SupportChat';
import { Screensaver } from './components/common/Screensaver';
import { ImagePreviewModal } from './components/ui/ImagePreviewModal';
import { Header } from './components/layout/Header';
import { SeasonalOverlay } from './components/common/SeasonalOverlay';
const HyroxRaceDetailScreen = React.lazy(() => import('./components/HyroxRaceDetailScreen').then(m => ({ default: m.HyroxRaceDetailScreen })));
import { SpotlightOverlay } from './components/SpotlightOverlay';
import { PBOverlay } from './components/PBOverlay'; 
import { ScanButton } from './components/ScanButton';
import { WorkoutLogScreen } from './mobile/screens/WorkoutLogScreen';
import { WorkoutListScreen } from './components/WorkoutListScreen';
import { WebQRScanner } from './components/WebQRScanner';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutPresentationModal } from './components/WorkoutDetailScreen';
import { WorkoutDiplomaView } from './components/WorkoutDiplomaView';

// --- Modals ---
import { BirthDatePromptModal } from './components/modals/BirthDatePromptModal';
import { LocationPromptModal } from './components/modals/LocationPromptModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { CoachWorkoutPreviewModal } from './components/CoachWorkoutPreviewModal';
import { updateUserProfile, fetchCustomPrograms } from './services/firebaseService';

const App: React.FC = () => {
  const { 
    selectedStudio, selectStudio, setAllStudios,
    selectedOrganization, selectOrganization, allOrganizations, setAllOrganizations,
    studioConfig, studioLoading
  } = useStudio();
  const { role, userData, isStudioMode, signOut, isImpersonating, startImpersonation, stopImpersonation, showTerms, acceptTerms, currentUser, authLoading, clearDeviceProvisioning } = useAuth();
  const { workouts, activeWorkout, setActiveWorkout, saveWorkout, deleteWorkout } = useWorkout();
  
  // --- DOMAIN ROUTING LOGIC ---
  const { isMarketingSite, isAppPortal } = useMemo(() => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    
    // Check if we are on the main marketing domain (smartstudio.se or www.smartstudio.se)
    const isMarketing = hostname === 'smartstudio.se' || hostname === 'www.smartstudio.se';
    
    // If the URL has ?marketing=true (useful for dev/testing), treat it as marketing site
    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const forceMarketing = searchParams.get('marketing') === 'true';
    
    // If the URL has ?app=true (useful for testing), treat it as app portal
    const forceAppPortal = searchParams.get('app') === 'true';

    const finalIsMarketing = (isMarketing || forceMarketing) && !forceAppPortal;
    
    return {
      isMarketingSite: finalIsMarketing,
      isAppPortal: !finalIsMarketing
    };
  }, []);

  const [sessionRole, setSessionRole] = useState<UserRole>(role);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterGym, setShowRegisterGym] = useState(false); 
  const minSplashTimeElapsed = useMinSplashTime();
  const [customPrograms, setCustomPrograms] = useState<Workout[]>([]);

  useEffect(() => {
    if (isStudioMode) {
      document.documentElement.classList.add('studio-mode');
    } else {
      document.documentElement.classList.remove('studio-mode');
    }
  }, [isStudioMode]);

  useEffect(() => {
    const loadCustomPrograms = async () => {
      if (currentUser?.uid) {
        try {
          const programs = await fetchCustomPrograms(currentUser.uid);
          setCustomPrograms(programs);
        } catch (e) {
          console.error("Failed to load custom programs in App.tsx", e);
        }
      } else {
        setCustomPrograms([]);
      }
    };
    loadCustomPrograms();
    
    const handleUpdateEvent = () => {
      loadCustomPrograms();
    };
    window.addEventListener('customProgramsUpdated', handleUpdateEvent);
    return () => {
      window.removeEventListener('customProgramsUpdated', handleUpdateEvent);
    };
  }, [currentUser]);
  
  const [activeBlock, setActiveBlock] = useState<WorkoutBlock | null>(null);
  const [isPickingForLog, setIsPickingForLog] = useState(false);
  const pageEntryTimestampRef = useRef<number>(Date.now());

  const { 
    history, 
    setHistory, 
    page, 
    navigateTo, 
    navigateReplace, 
    handleBack, 
    setCustomBackHandler, 
    customBackHandlerState, 
    lastLocalNavigationRef 
  } = useNavigation({
    role,
    sessionRole,
    setSessionRole,
    activeWorkout,
    setActiveWorkout,
    activeBlock,
    setActiveBlock,
    isPickingForLog,
    setIsPickingForLog,
    isStudioMode,
    selectedOrganization,
    selectedStudio,
    currentUser,
    userData,
    authLoading,
    isImpersonating
  });

  const showWelcomePaywall = useMemo(() => {
      if (!currentUser || role !== 'organizationadmin' || isStudioMode) return false;
      return selectedOrganization?.systemFeePaid === false;
  }, [role, selectedOrganization?.systemFeePaid, isStudioMode, currentUser]);

  const [optimisticSubActive, setOptimisticSubActive] = useState(() => {
      return sessionStorage.getItem('optimisticSubActive') === 'true';
  });

  // Nollställ optimistisk prenumeration när ingen användare är inloggad (t.ex. vid utloggning)
  useEffect(() => {
      if (!currentUser) {
          setOptimisticSubActive(false);
          sessionStorage.removeItem('optimisticSubActive');
      }
  }, [currentUser]);

  const hasActiveSubscription = useMemo(() => {
      if (role === 'systemowner' || role === 'organizationadmin' || role === 'coach') return true;
      if (userData?.status === 'inactive') return false;
      if (selectedOrganization?.membersPaidByGym === true &&
          !!userData?.organizationId &&
          selectedOrganization.id === userData.organizationId) return true;
      if (userData?.subscriptionStatus === 'active' || optimisticSubActive) return true;
      return false;
  }, [role, userData?.subscriptionStatus, userData?.status, userData?.organizationId,
      optimisticSubActive, selectedOrganization?.id, selectedOrganization?.membersPaidByGym]);

  const showPaywall = currentUser && !isStudioMode && !hasActiveSubscription && !showWelcomePaywall;
  const showPendingCoach = currentUser && !isStudioMode && userData?.status === 'pending_coach';
  const isGlobalLoading = authLoading || studioLoading;
  
  const isOrgMismatch = useMemo(() => {
      if (!currentUser || !userData?.organizationId || !selectedOrganization) return false;
      if (role === 'systemowner') return false;
      return userData.organizationId !== selectedOrganization.id;
  }, [userData?.organizationId, selectedOrganization?.id, currentUser, role]);

  const isOffline = useOnlineStatus();
  const { pushToast, setPushToast } = usePushToast(isOffline);

  const publicLiveRaceId = useMemo(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const qParam = searchParams.get('live');
    if (qParam) return qParam;
    if (path.startsWith('/live/')) {
       return path.substring(6).replace(/\/$/, '');
    }
    const pathParts = path.split('/');
    const liveIndex = pathParts.indexOf('live');
    if (liveIndex !== -1 && pathParts[liveIndex + 1]) {
       return pathParts[liveIndex + 1];
    }
    return null;
  }, []);

  const isResetPasswordPath = useMemo(() => {
    const path = window.location.pathname;
    return path === '/reset-password' || path === '/reset-password/';
  }, []);

  useEffect(() => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('connect') === 'success' && userData?.organizationId) {
          const checkStatus = async () => {
              try {
                  const apiUrl = import.meta.env.VITE_API_URL;
                  await fetch(`${apiUrl}/check-connect-status`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ organizationId: userData.organizationId })
                  });
                  // Clean up URL
                  window.history.replaceState({}, document.title, window.location.pathname);
              } catch (e) {
                  console.error("Failed to check connect status", e);
              }
          };
          checkStatus();
      }
  }, [userData?.organizationId]);

  // --- SERVICE WORKER AUTO-UPDATE & FRESH PUSHES ---
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;

    // Listen for the controllerchange event. This fires when a new service worker 
    // takes over (usually because it downloaded a new push and called skipWaiting() + clients.claim()).
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      // Only reload if the page was already controlled by a service worker.
      // If there was no controller, this is the very first service worker installation/activation,
      // so we don't need to force a reload, which would disrupt initial routing and clear URL parameters.
      if (!hadController) {
          console.log('Initial Service Worker claimed the client. Skipping reload because there was no prior controller.');
          return;
      }
      refreshing = true;
      console.log('New Service Worker activated! Reloading page to load the latest code...');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // To make sure a long-running/permanent screen checks for updates periodically 
    // (even if no manual navigation/reload is done), check for updates every 15 minutes.
    const intervalId = setInterval(() => {
      navigator.serviceWorker.ready.then((registration) => {
        console.log('Checking for service worker updates periodically...');
        registration.update().catch((err) => {
          console.warn('Failed to update service worker registration:', err);
        });
      });
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    pageEntryTimestampRef.current = Date.now();
    
    // Nollställ det aktiva loppet om man lämnar resultatskärmen,
    // vilket förhindrar felaktig navigering till föregående lopps resultat.
    if (page !== Page.HyroxRaceDetail) {
      setActiveRaceId(null);
    }

    // Återställ header-synlighet och back-knapp när man lämnar Timer-sidan
    if (page !== Page.Timer) {
      setIsTimerHeaderVisible(true);
      setIsBackButtonHidden(false);
    }
  }, [page]);

  const [activePasskategori, setActivePasskategori] = useState<string | null>(null);
  const [activeCustomPage, setActiveCustomPage] = useState<CustomPage | null>(null);
  const [racePrepState, setRacePrepState] = useState<{ groups: StartGroup[]; interval: number } | null>(null);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null);
  const [isEditingNewDraft, setIsEditingNewDraft] = useState(false);
  const [returnToAdminOnSave, setReturnToAdminOnSave] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [customPageToEdit, setCustomPageToEdit] = useState<CustomPage | null>(null);
  const [studioToEditConfig, setStudioToEditConfig] = useState<Studio | null>(null);
  const [completionInfo, setCompletionInfo] = useState<{ workout: Workout, isFinal: boolean, blockTag?: string, finishTime?: number } | null>(null);
  const [preferredAdminTab, setPreferredAdminTab] = useState<string>('dashboard');
  const [isAutoTransition, setIsAutoTransition] = useState(false);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordPurpose, setPasswordPurpose] = useState<'coachView' | 'unlock'>('coachView');
  const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);
  const [reAuthPurpose, setReAuthPurpose] = useState<'admin' | 'profile'>('admin');

  const [isRegisteringHyroxTime, setIsRegisteringHyroxTime] = useState(false);
  const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage' | 'create'>('create');
  
  const [mobileLogData, setMobileLogData] = useState<{workoutId: string, organizationId: string, source?: 'qr_scan' | 'manual'} | null>(null);
  const [mobileViewData, setMobileViewData] = useState<Workout | null>(null); 
  const [isSearchWorkoutOpen, setIsSearchWorkoutOpen] = useState(false);
  const [isCoachPreviewOpen, setIsCoachPreviewOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeDiploma, setActiveDiploma] = useState<WorkoutDiploma | null>(null);
  const [showBirthDatePrompt, setShowBirthDatePrompt] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  useEffect(() => {
      if (userData && !userData.birthDate && !isStudioMode) {
          setShowBirthDatePrompt(true);
      } else {
          setShowBirthDatePrompt(false);
      }
  }, [userData, isStudioMode]);

  useEffect(() => {
      const locations = selectedOrganization?.locations || [];
      if (userData && !userData.locationId && !isStudioMode && locations.length > 0) {
          if (locations.length === 1) {
              updateUserProfile(userData.uid, { locationId: locations[0].id }).catch(err => {
                  console.error("Auto-assign location failed", err);
              });
              setShowLocationPrompt(false);
          } else {
              setShowLocationPrompt(true);
          }
      } else {
          setShowLocationPrompt(false);
      }
  }, [userData, isStudioMode, selectedOrganization?.locations]);

  useEffect(() => {
      if (mobileLogData || mobileViewData || isSearchWorkoutOpen || isCoachPreviewOpen || isScannerOpen || activeDiploma) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
  }, [mobileLogData, mobileViewData, isSearchWorkoutOpen, isCoachPreviewOpen, isScannerOpen, activeDiploma]);

  const { theme, toggleTheme } = useTheme();

  const [isTimerHeaderVisible, setIsTimerHeaderVisible] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [isBackButtonHidden, setIsBackButtonHidden] = useState(false);
  const [followMeShowImage, setFollowMeShowImage] = useState(true);
  const [profileEditTrigger, setProfileEditTrigger] = useState(0);

  useEffect(() => {
    const faviconUrl = selectedOrganization?.faviconUrl || '/favicon.png';
    const appIconUrl = selectedOrganization?.appIconUrl || selectedOrganization?.faviconUrl || '/apple-touch-icon.png';

    // 1. Browser Tab Icon (Favicon)
    if (faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = faviconUrl;
    }

    // 2. iOS Home Screen Icon (Apple Touch Icon)
    if (appIconUrl) {
      let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
      if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        document.getElementsByTagName('head')[0].appendChild(appleLink);
      }
      appleLink.href = appIconUrl;
    }
  }, [selectedOrganization?.faviconUrl, selectedOrganization?.appIconUrl]);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const logPayload = params.get('log');
      const inviteCode = params.get('invite');
      const coachCode = params.get('coach');
      const successParam = params.get('success');
      const typeParam = params.get('type');
      
      if (inviteCode || coachCode) {
          setShowLogin(true);
      }

      // Optimistic update for member subscription success
      if (successParam === 'true' && typeParam === 'member' && userData?.uid) {
          console.log("Stripe checkout success! Waiting for webhook to process...");
          setOptimisticSubActive(true);
          sessionStorage.setItem('optimisticSubActive', 'true');
          window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (logPayload) {
          try {
              const decoded = JSON.parse(atob(logPayload));
              if (decoded.wid && decoded.oid) {
                  setMobileLogData({ workoutId: decoded.wid, organizationId: decoded.oid, source: 'qr_scan' });
              }
          } catch (e) {
              console.error("Failed to parse QR payload from URL", e);
          }
      }
  }, [userData?.uid]);

  useInactivityTimer({
    isStudioMode,
    studioConfig,
    page,
    isScreensaverActive,
    setIsScreensaverActive,
  });

  const activeInfoMessages = useMemo((): InfoMessage[] => {
    const infoCarousel = selectedOrganization?.infoCarousel;
    if (!infoCarousel?.isEnabled) return [];
    const messages = infoCarousel.messages || [];
    const now = new Date();
    const filtered = messages.filter(msg => {
        const isStudioMatch = !selectedStudio 
          ? msg.visibleInStudios.includes('all')
          : (msg.visibleInStudios.includes('all') || msg.visibleInStudios.includes(selectedStudio.id));
        if (!isStudioMatch) return false;
        if (msg.startDate && new Date(msg.startDate) > now) return false;
        if (msg.endDate && new Date(msg.endDate) < now) return false;
        return true;
    }).sort((a, b) => a.internalTitle.localeCompare(b.internalTitle));

    if (infoCarousel.enableJoinSlide) {
        const currentLoc = selectedOrganization?.locations?.find(l => l.id === selectedStudio?.locationId) || selectedOrganization?.locations?.[0];
        const code = currentLoc?.inviteCode || selectedOrganization?.inviteCode || '';
        const locName = currentLoc?.name || '';
        const orgName = selectedOrganization?.name || '';
        const logoUrl = selectedOrganization?.logoUrlLight || selectedOrganization?.logoUrlDark;

        if (code) {
            const joinSlideMsg: InfoMessage & { isJoinSlide?: boolean; joinUrl?: string; orgName?: string; locationName?: string; logoUrl?: string } = {
                id: 'join-slide-auto',
                internalTitle: 'Börja logga din träning — skanna koden',
                headline: `Börja logga din träning hos ${orgName}${locName ? ` — ${locName}` : ''}`,
                body: 'Skanna QR-koden med mobilen så är du igång på en minut.',
                durationSeconds: 15,
                animation: 'fade',
                layout: 'image-left',
                visibleInStudios: ['all'],
                isJoinSlide: true,
                joinUrl: `${window.location.origin}/?invite=${code}`,
                orgName,
                locationName: locName,
                logoUrl
            };
            filtered.push(joinSlideMsg);
        }
    }

    return filtered;
  }, [selectedOrganization, selectedStudio]);

  const isInfoBannerVisible = (page === Page.Home || isScreensaverActive) && activeInfoMessages.length > 0;

  useEffect(() => {
    setSessionRole(role);
  }, [role]);
  
  useEffect(() => {
    const root = document.documentElement;
    const primaryColor = selectedOrganization?.primaryColor;
    if (primaryColor) root.style.setProperty('--color-primary', primaryColor);
    else root.style.removeProperty('--color-primary');
  }, [selectedOrganization]);





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
          signOut();
      } else {
          setReAuthPurpose('admin');
          setIsReAuthModalOpen(true);
      }
  };

  const {
    handleStartBlock,
    handleStartFreestandingTimer,
    handleStartRace,
    handleSelectRace,
    handleReturnToGroupPrep,
    handleTimerFinish,
    handleCloseWorkoutCompleteModal,
    handleLogWorkoutRequest,
    handleCancelLog,
    handleScanCode,
  } = useTimerFlow({
    workouts,
    activeWorkout,
    activeBlock,
    completionInfo,
    page,
    history,
    selectedOrganization,
    selectedStudio,
    isStudioMode,
    pageEntryTimestampRef,
    lastLocalNavigationRef,
    setActiveWorkout,
    setActiveBlock,
    setIsAutoTransition,
    setIsBackButtonHidden,
    setActiveRaceId,
    setCompletionInfo,
    setRacePrepState,
    setIsSearchWorkoutOpen,
    setMobileViewData,
    setMobileLogData,
    setActiveDiploma,
    setIsScannerOpen,
    navigateTo,
    navigateReplace,
    handleBack,
  });

  const {
    handleCreateNewWorkout,
    handleEditWorkout,
    handleAdjustWorkout,
    handleSaveAndNavigate,
    handleSaveOnly,
    handleTogglePublishStatus,
    handleToggleFavoriteStatus,
    handleDeleteWorkout,
    handleDuplicateWorkout,
    handleSelectWorkout,
    handleSelectPasskategori,
    handleGeneratedWorkout,
    handleWorkoutInterpretedFromNote,
  } = useWorkoutActions({
    sessionRole,
    isStudioMode,
    currentUser,
    selectedOrganization,
    selectedStudio,
    userData,
    workouts,
    activeWorkout,
    page,
    isEditingNewDraft,
    returnToAdminOnSave,
    isSearchWorkoutOpen,
    isPickingForLog,
    studioConfig,
    setActiveWorkout,
    setFocusedBlockId,
    setIsEditingNewDraft,
    setReturnToAdminOnSave,
    setPreferredAdminTab,
    setMobileViewData,
    setIsPickingForLog,
    setActivePasskategori,
    navigateTo,
    navigateReplace,
    handleBack,
    saveWorkout,
    deleteWorkout,
    handleStartBlock,
    handleLogWorkoutRequest,
  });

  const handleCoachAccessRequest = () => {
    if (sessionRole === 'member') {
      setPasswordPurpose('coachView');
      setIsPasswordModalOpen(true);
    }
    else navigateTo(Page.Coach);
  };

  const handleUnlockCoachRequest = () => {
    if (sessionRole === 'member') {
      setPasswordPurpose('unlock');
      setIsPasswordModalOpen(true);
    }
  };
  
  const handlePreviewWorkoutsRequest = () => {
    setIsCoachPreviewOpen(true);
  };

  const handleSelectCustomPage = (page: CustomPage) => {
    setActiveCustomPage(page);
    navigateTo(Page.CustomContent);
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  }

  const {
    handleSaveStudioConfig,
    handleEditStudioConfig,
    handleSaveGlobalConfig,
    handleCreateStudio,
    handleUpdateStudio,
    handleDeleteStudio,
  } = useStudioAdmin({
    selectedOrganization,
    allOrganizations,
    selectOrganization,
    setAllOrganizations,
    selectStudio,
    setAllStudios,
    setStudioToEditConfig,
  });

  const handleCreateOrganization = async (name: string, subdomain: string) => {
    try {
        const newOrg = await createOrganization(name, subdomain);
        setAllOrganizations(prev => [...prev, newOrg]);
    } catch (error) {
        console.error("Failed to create organization:", error);
        alert(`Kunde inte skapa organisation: ${error instanceof Error ? error.message : "Okänt fel"}`);
    }
  };
  
  const handleUpdateOrganization = async (organizationId: string, name: string, subdomain: string, inviteCode?: string, coachCode?: string, maxFreeCoaches?: number) => {
    try {
        const updatedOrg = await updateOrganization(organizationId, name, subdomain, inviteCode, coachCode, maxFreeCoaches);
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

  const handleUpdateOrganizationAppIcon = async (organizationId: string, appIconUrl: string) => {
    try {
        const updatedOrg = await updateOrganizationAppIcon(organizationId, appIconUrl);
        setAllOrganizations(prev => prev.map(o => (o.id === organizationId ? updatedOrg : o)));
        if (selectedOrganization?.id === organizationId) selectOrganization(updatedOrg);
    } catch (error) {
        console.error("Failed to update app icon:", error);
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

  const isFullScreenPage = page === Page.Timer || page === Page.RepsOnly || page === Page.IdeaBoard;
  const isAdminDashboardMode = page === Page.SuperAdmin || page === Page.SystemOwner;
  const paddingClass = (isFullScreenPage || isAdminDashboardMode) ? '' : 'p-4 sm:p-6 lg:p-8';
  
  const isAdminOrCoach = role === 'systemowner' || role === 'organizationadmin' || role === 'coach';
  const isMemberFacingPage = [Page.Home, Page.WorkoutDetail, Page.SavedWorkouts, Page.MemberProfile, Page.WorkoutList, Page.WorkoutGamesHub].includes(page);
  const isAdminFacingPage = [Page.Coach, Page.SuperAdmin, Page.SystemOwner, Page.AdminAnalytics, Page.MemberRegistry].includes(page);

  const showSupportChat = !isStudioMode && isAdminOrCoach && isAdminFacingPage;
  const showScanButton = ((!isStudioMode && isMemberFacingPage) || (page === Page.MemberProfile)) && studioConfig.enableWorkoutLogging;

  const isAnyModalOpen = !!(mobileLogData || mobileViewData || isSearchWorkoutOpen || isScannerOpen || activeDiploma);
  
  const showSplashScreen = isGlobalLoading || !minSplashTimeElapsed;

  if (showSplashScreen) {
    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-8 text-center">
            <motion.img 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                src="/favicon.png" 
                alt="SmartStudio" 
                className="w-32 h-32 rounded-3xl shadow-lg" 
            />
        </div>
    );
  }
  
  if (isResetPasswordPath) {
    return <ResetPasswordScreen />;
  }
  
  if (publicLiveRaceId) {
    return (
      <div id="public-live-results" className={`min-h-screen ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-800'} p-4 sm:p-6 lg:p-8 flex flex-col`}>
        <div className="flex justify-between items-center mb-6 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2">
                <img src="/favicon.png" alt="Logo" className="w-8 h-8 rounded-lg" />
                <span className="font-semibold tracking-tight text-sm text-indigo-500 uppercase dark:text-indigo-400">Flexibel Friskvård</span>
            </div>
            <button 
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200 dark:border-slate-800"
            >
                {theme === 'dark' ? '☀️' : '🌙'}
            </button>
        </div>
        <React.Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Laddar lopp...</div>}>
          <HyroxRaceDetailScreen raceId={publicLiveRaceId} isPublicView={true} onBack={() => {
             window.location.href = '/';
          }} />
        </React.Suspense>
      </div>
    );
  }

  if (!authLoading && !currentUser && !isStudioMode) {
      if (isAppPortal) {
          // På app.smartstudio.se (eller i utvecklingsmiljö / staging-app utan ?marketing=true)
          // visar vi enbart LoginScreen, och skickar inte in onRegisterGym så knappen för att registrera gym göms helt!
          return <LoginScreen onClose={undefined} onRegisterGym={undefined} />;
      }

      // Annars på smartstudio.se (marknadsföringssidan/huvuddomänen eller i dev med ?marketing=true)
      return (
          <React.Suspense fallback={
              <div className="min-h-screen bg-black flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              </div>
          }>
              {showRegisterGym ? (
                  <RegisterGymScreen onCancel={() => setShowRegisterGym(false)} />
              ) : showLogin ? (
                  <LoginScreen onClose={() => setShowLogin(false)} onRegisterGym={() => setShowRegisterGym(true)} />
              ) : (
                  <LandingPage 
                      onLoginClick={() => {
                          const hostname = window.location.hostname;
                          const targetAppUrl = hostname.includes('staging.smartstudio.se')
                              ? 'https://app.staging.smartstudio.se'
                              : 'https://app.smartstudio.se';
                          window.location.href = targetAppUrl + window.location.search;
                      }} 
                      onRegisterGymClick={() => setShowRegisterGym(true)} 
                  />
              )}
          </React.Suspense>
      );
  }

  if (currentUser && !userData && !isStudioMode && !authLoading) {
    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-8 text-center">
            <img src="/favicon.png" alt="SmartStudio" className="w-20 h-20 mb-6 rounded-2xl shadow-sm" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Förbereder ditt konto...</h2>
            <p className="text-gray-500 mt-2">Detta tar bara några sekunder.</p>
            <div className="flex flex-col gap-4 mt-8">
                <button onClick={() => signOut()} className="text-primary font-bold hover:underline">Logga ut och försök igen</button>
                <button 
                    onClick={async () => {
                        try {
                            await currentUser.delete();
                            window.location.reload();
                        } catch (e) {
                            console.error('Kunde inte radera kontot:', e);
                            signOut();
                        }
                    }} 
                    className="text-gray-500 dark:text-gray-400 text-sm hover:underline transition-colors"
                >
                    Radera detta ofullständiga konto och börja om
                </button>
            </div>
        </div>
    );
  }

  if (isOrgMismatch && !isStudioMode) {
      return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-8 text-center">
            <img src="/favicon.png" alt="SmartStudio" className="w-20 h-20 mb-6 rounded-2xl shadow-sm" />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Hämtar organisation...</p>
        </div>
      );
  }

  const showUserBackground = page === Page.MemberProfile && !!userData?.backgroundImageUrl;
  const backgroundOverlayOpacity = userData?.backgroundOverlayOpacity ?? 20;

  return (
    <div id="app-root-container" className={`${showUserBackground ? 'bg-transparent' : 'bg-white dark:bg-black'} text-gray-800 dark:text-gray-200 font-sans flex flex-col ${isStudioMode && page === Page.Home ? 'h-screen overflow-hidden' : 'min-h-screen'} ${paddingClass}`}>
        {showUserBackground && (
            <div id="user-background-layer" className="fixed inset-0 z-[-1]">
                <img src={userData.backgroundImageUrl} alt="Background" className="w-full h-full object-cover" />
                <div 
                    className="absolute inset-0 pointer-events-none mix-blend-normal" 
                    style={{ backgroundColor: theme === 'dark' ? `rgba(0,0,0,${backgroundOverlayOpacity / 100})` : `rgba(255,255,255,${backgroundOverlayOpacity / 100})` }}
                ></div>
                {/* Mjuk gradient i överkant för att säkra ikonernas läsbarhet, också kopplad till opaciteten (minst viss procent för att alltid säkra ikoner) */}
                <div 
                    className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white to-transparent dark:from-black dark:to-transparent pointer-events-none mix-blend-normal"
                    style={{ opacity: Math.max(0.6, backgroundOverlayOpacity / 100) }}
                ></div>
            </div>
        )}
       {isOffline && (
            <div className="bg-red-500 text-white text-xs font-bold uppercase tracking-widest py-2 px-4 flex justify-center items-center gap-2 fixed top-0 w-full z-[10000] shadow-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18"></path>
                </svg>
                Du är offline - allt du loggar sparas lokalt
            </div>
       )}
       <SeasonalOverlay page={page} isStudioMode={isStudioMode} isAdminView={isAdminFacingPage} />
       
       <Toast 
         message={pushToast.message} 
         isVisible={pushToast.isVisible} 
         onClose={() => setPushToast(prev => ({ ...prev, isVisible: false }))} 
         duration={5000} 
         type="info" 
       />

       {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center p-2 font-semibold z-[1001]">
            Du är offline. Viss funktionalitet kan vara begränsad och ändringar sparas lokalt.
        </div>
       )}
       
       <DeveloperToolbar />
       
       {isStudioMode && <SpotlightOverlay />} 
       {isStudioMode && <PBOverlay isGrattisOpen={!!completionInfo} />}

       <div className={(isAnyModalOpen || showPaywall || showWelcomePaywall || showPendingCoach || !(page === Page.Timer || !isFullScreenPage)) ? 'hidden' : 'contents'}>
           <Header 
            page={page} 
            hasBackgroundImage={showUserBackground}
            onBack={handleBack} 
            theme={theme}
            toggleTheme={toggleTheme}
            isVisible={isTimerHeaderVisible}
            activeCustomPageTitle={page === Page.CustomContent ? activeCustomPage?.title : undefined}
            onSignOut={isStudioMode ? undefined : signOut}
            role={role}
            historyLength={history.length}
            showClock={isStudioMode && (page === Page.WorkoutDetail)}
            hideBackButton={isBackButtonHidden}
            onCoachAccessRequest={handleCoachAccessRequest}
            onPreviewWorkoutsRequest={isAdminOrCoach ? handlePreviewWorkoutsRequest : undefined}
            showCoachButton={isStudioMode}
            onMemberProfileRequest={handleMemberProfileRequest} 
            onEditProfileRequest={handleEditProfileRequest}
            isStudioMode={isStudioMode}
            hasCustomBack={!!customBackHandlerState}
            navigateTo={navigateTo}
          />
       </div>

      <div className="flex flex-col items-center flex-1 min-h-0 relative">
          <main 
            className={`flex-1 min-h-0 w-full ${isFullScreenPage || isAdminDashboardMode ? 'block relative' : `flex flex-col items-center ${page === Page.Home || page === Page.MemberProfile || page === Page.CoachNotes ? 'justify-start' : 'justify-center'}`}`}
          >
            {showPendingCoach ? (
                <PendingCoachScreen onLogout={signOut} />
            ) : showWelcomePaywall ? (
                <WelcomePaywall onLogout={signOut} userData={userData} />
            ) : showPaywall ? (
              <PaywallScreen onLogout={signOut} userData={userData} />
            ) : (
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
                customPrograms={customPrograms}
                activeWorkout={activeWorkout}
                activeBlock={activeBlock}
                
                passkategoriFilter={activePasskategori}
                activeCustomPage={activeCustomPage}
                customPageToEdit={customPageToEdit}
                activeRaceId={activeRaceId}
                isEditingNewDraft={isEditingNewDraft}
                racePrepState={racePrepState}
                followMeShowImage={followMeShowImage}
                mobileLogData={null}
                
                preferredAdminTab={preferredAdminTab}
                profileEditTrigger={profileEditTrigger}
                isAutoTransition={isAutoTransition}

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
                    updateAppIcon: handleUpdateOrganizationAppIcon,
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
                    checkUnsavedChanges: () => true,
                    setShowImage: (url) => setPreviewImageUrl(url),
                    setTimerHeaderVisible: setIsTimerHeaderVisible,
                    setBackButtonHidden: setIsBackButtonHidden,
                    setRacePrepState: setRacePrepState,
                    setCompletionInfo: setCompletionInfo,
                    setRegisteringHyroxTime: setIsRegisteringHyroxTime,
                    setFollowMeShowImage: setFollowMeShowImage,
                    
                    handleGeneratedWorkout: handleGeneratedWorkout,
                    handleWorkoutInterpreted: handleWorkoutInterpretedFromNote,
                    handleUnlockCoachRequest: handleUnlockCoachRequest,
                    handleAdjustWorkout: handleAdjustWorkout,
                    setAiGeneratorInitialTab: setAiGeneratorInitialTab,
                    setCustomBackHandler: setCustomBackHandler,
                    
                    handleStartFreestandingTimer: handleStartFreestandingTimer,
                    handleStartRace: handleStartRace,
                    handleSelectRace: handleSelectRace,
                    handleReturnToGroupPrep: handleReturnToGroupPrep,
                    handleSelectCustomPage: handleSelectCustomPage,
                    
                    handleMemberProfileRequest: handleMemberProfileRequest,
                    handleEditProfileRequest: handleEditProfileRequest,
                    handleLogWorkoutRequest: handleLogWorkoutRequest
                }}
              />
            )}
          </main>
          
          {isInfoBannerVisible && !isScreensaverActive && (
              // hidden md:block (osynlig på mobil), flex-shrink-0 och flexibel höjd baserat på skärmstorlek.
              <div className="hidden md:block flex-shrink-0 w-full info-banner-container relative z-[40]">
                  <InfoCarouselBanner 
                    messages={activeInfoMessages} 
                    className="relative !h-full" 
                    forceDark={false} 
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
                      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
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

          {isCoachPreviewOpen && (
              <CoachWorkoutPreviewModal 
                  isOpen={isCoachPreviewOpen}
                  onClose={() => setIsCoachPreviewOpen(false)}
                  workouts={workouts}
                  onPreviewWorkout={(workout) => {
                      setMobileViewData(workout);
                  }}
              />
          )}
      </AnimatePresence>

      <AnimatePresence>
          {mobileViewData && (
              <WorkoutPresentationModal
                  workout={mobileViewData}
                  onClose={() => setMobileViewData(null)}
                  isOwnProgram={customPrograms.some(cp => cp.id === mobileViewData.id)}
                  userId={currentUser?.uid || userData?.uid}
                  onWorkoutUpdated={(w) => setMobileViewData(w)}
              />
          )}
      </AnimatePresence>

      <AnimatePresence>
          {mobileLogData && !showPaywall && !showPendingCoach && (
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
                      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                      className="fixed inset-x-0 top-[5vh] bottom-[5vh] z-[10040] px-1 pointer-events-none"
                  >
                      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] h-full max-w-2xl mx-auto shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                          <WorkoutLogScreen 
                              workoutId={mobileLogData.workoutId} 
                              organizationId={mobileLogData.organizationId} 
                              source={mobileLogData.source}
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
          onLogout={signOut}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setSessionRole('coach');
            if (passwordPurpose === 'coachView') {
              navigateTo(Page.Coach);
            }
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
            <>
                <Screensaver 
                    logoUrl={selectedOrganization?.logoUrlDark || selectedOrganization?.logoUrlLight}
                    bottomOffset={isInfoBannerVisible ? (window.innerWidth >= 768 ? (window.innerHeight > 1100 ? 512 : 280) : 0) : 0}
                />
                {isInfoBannerVisible && (
                    <div className="hidden md:block fixed bottom-0 left-0 right-0 info-banner-container z-[1001]">
                        <InfoCarouselBanner 
                            messages={activeInfoMessages} 
                            className="relative !h-full" 
                            forceDark={true} 
                        />
                    </div>
                )}
            </>
        )}
       {showTerms && <TermsOfServiceModal onAccept={acceptTerms} />}
       
       {showSupportChat && <SupportChat />}

       {userData && showBirthDatePrompt && (
           <BirthDatePromptModal 
               isOpen={showBirthDatePrompt} 
               onClose={() => setShowBirthDatePrompt(false)} 
               userData={userData} 
           />
       )}

       {userData && showLocationPrompt && selectedOrganization?.locations && (
           <LocationPromptModal 
               isOpen={showLocationPrompt} 
               userData={userData} 
               locations={selectedOrganization.locations}
               onClose={() => setShowLocationPrompt(false)} 
           />
       )}

       {showScanButton && !showPaywall && !showWelcomePaywall && !showPendingCoach && !mobileLogData && !mobileViewData && !isSearchWorkoutOpen && !isScannerOpen && (
          <div className="fixed bottom-6 right-6 z-[50]">
              <ScanButton 
                onScan={() => setIsScannerOpen(true)} 
                onLogWorkout={handleLogWorkoutRequest}
                onSearch={() => {
                    setIsSearchWorkoutOpen(true);
                }} 
              />
          </div>
       )}

       <PWAInstallPrompt />
    </div>
  );
}

export default App;