import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, TimerSettings, Passkategori, Studio, StudioConfig, Organization, CustomPage, UserRole, InfoMessage, StartGroup, InfoCarousel, WorkoutDiploma, RemoteSessionState, TimerStatus } from './types';

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
import { createOrganization, updateGlobalConfig, updateStudioConfig, createStudio, updateOrganization, updateOrganizationPasswords, updateOrganizationLogos, updateOrganizationPrimaryColor, updateOrganizationCustomPages, updateStudio, deleteStudio, archiveOrganization as deleteOrganization, updateOrganizationInfoCarousel, updateOrganizationFavicon, listenToOrganizationChanges, updateStudioRemoteState, getWorkoutById, getFreshCategoryWorkouts, listenToForegroundMessages, activateMemberSubscriptionLocally } from './services/firebaseService';
import { Toast } from './components/ui/ToastNotification';

// --- Utils ---
import { deepCopyAndPrepareAsNew } from './utils/workoutUtils';

// --- Components ---
import { WorkoutCompleteModal } from './components/WorkoutCompleteModal';
import { PasswordModal } from './components/PasswordModal';
import { ReAuthModal } from './components/ReAuthModal';
import { StudioSelectionScreen } from './components/StudioSelectionScreen';
import { StudioConfigModal } from './components/AdminConfigScreen';
import { LoginScreen } from './components/LoginScreen';
import { RegisterGymScreen } from './components/RegisterGymScreen'; 
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
import { RemoteControlScreen } from './components/RemoteControlScreen';
import { motion, AnimatePresence } from 'framer-motion';
import WorkoutDetailScreen, { WorkoutPresentationModal } from './components/WorkoutDetailScreen';
import { CloseIcon, PencilIcon } from './components/icons';
import { WorkoutDiplomaView } from './components/WorkoutDiplomaView';

// --- Modals ---
import { CancelConfirmationModal } from './components/modals/CancelConfirmationModal';
import { BirthDatePromptModal } from './components/modals/BirthDatePromptModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

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
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterGym, setShowRegisterGym] = useState(false); 
  const [minSplashTimeElapsed, setMinSplashTimeElapsed] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashTimeElapsed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  
  const [history, setHistory] = useState<Page[]>(() => {
      if (isStudioMode) return [Page.Home];
      if (role === 'systemowner') return [Page.SystemOwner];
      if (role === 'organizationadmin') return [Page.SuperAdmin];
      if (role === 'coach') return [Page.Coach];
      return [Page.MemberProfile];
  });

  const page = history[history.length - 1];

  // Scrolla alltid till toppen när vi byter sida
  useEffect(() => {
      const timer = setTimeout(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      }, 10);
      return () => clearTimeout(timer);
  }, [page]);

  const showWelcomePaywall = useMemo(() => {
      if (!currentUser || role !== 'organizationadmin' || isStudioMode) return false;
      return selectedOrganization?.systemFeePaid === false;
  }, [role, selectedOrganization?.systemFeePaid, isStudioMode, currentUser]);

  const hasActiveSubscription = useMemo(() => {
      if (role === 'systemowner' || role === 'organizationadmin' || role === 'coach') return true;
      if (userData?.subscriptionStatus === 'active') return true;
      return false;
  }, [role, userData?.subscriptionStatus]);

  const showPaywall = currentUser && !isStudioMode && !hasActiveSubscription && !showWelcomePaywall;
  const showPendingCoach = currentUser && !isStudioMode && userData?.status === 'pending_coach';
  const isGlobalLoading = authLoading || studioLoading || (currentUser && !userData && !isStudioMode);
  
  const isOrgMismatch = useMemo(() => {
      if (!currentUser || !userData?.organizationId || !selectedOrganization) return false;
      if (role === 'systemowner') return false;
      return userData.organizationId !== selectedOrganization.id;
  }, [userData?.organizationId, selectedOrganization?.id, currentUser, role]);

  // NEW: Ref to track if we have performed the initial cleanup of remote state
  const hasCleanedUpRef = useRef(false);
  const [isReadyToListen, setIsReadyToListen] = useState(false);
  const [pushToast, setPushToast] = useState<{ message: string, isVisible: boolean }>({ message: '', isVisible: false });

  // Push notification foreground listener
  useEffect(() => {
    if (isOffline) return;
    const unsubscribe = listenToForegroundMessages((payload) => {
      const title = payload.notification?.title || 'Ny notis';
      const body = payload.notification?.body || '';
      setPushToast({ message: `${title}: ${body}`, isVisible: true });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authLoading && !isStudioMode && currentUser) {
      const isAtInitialPage = history.length === 1;
      const currentPage = history[history.length - 1];

      if (role === 'systemowner' && currentPage !== Page.SystemOwner && isAtInitialPage) {
        setHistory([Page.SystemOwner]);
      } else if (role === 'organizationadmin' && currentPage !== Page.SuperAdmin && isAtInitialPage) {
        setHistory([Page.SuperAdmin]);
      } else if (role === 'coach' && currentPage !== Page.Coach && isAtInitialPage) {
        setHistory([Page.Coach]);
      } else if (role === 'member' && currentPage !== Page.MemberProfile && isAtInitialPage) {
        setHistory([Page.MemberProfile]);
      }
    }
  }, [role, authLoading, isStudioMode, history, currentUser]);

  const [remoteCommand, setRemoteCommand] = useState<{ type: string, timestamp: number } | null>(null);
  const [activeBlock, setActiveBlock] = useState<WorkoutBlock | null>(null);
  const lastLocalNavigationRef = useRef<number>(0);
  const pageEntryTimestampRef = useRef<number>(Date.now());

  const navigateTo = useCallback((targetPage: Page, options?: { activeWorkoutId?: string | null, activeBlockId?: string | null }) => {
    if (isStudioMode && selectedOrganization && selectedStudio) {
         let view: RemoteSessionState['view'] = 'menu';
         
         if (targetPage === Page.Timer || targetPage === Page.RepsOnly) {
             view = 'timer';
         } else if (targetPage === Page.WorkoutDetail) {
             view = 'preview';
         } else if (targetPage === Page.Home) {
             view = 'idle';
         }
         
         lastLocalNavigationRef.current = Date.now();

         updateStudioRemoteState(selectedOrganization.id, selectedStudio.id, {
             view,
             activeWorkoutId: options?.activeWorkoutId !== undefined ? options.activeWorkoutId : (activeWorkout?.id || null),
             activeBlockId: options?.activeBlockId !== undefined ? options.activeBlockId : (activeBlock?.id || null),
             lastUpdate: Date.now(),
             controllerName: 'Touch Screen'
         });
    }
    setHistory(prev => {
        if (prev[prev.length - 1] === targetPage) return prev;
        return [...prev, targetPage];
    });
  }, [isStudioMode, selectedOrganization, selectedStudio, activeWorkout, activeBlock]);

  const navigateReplace = useCallback((page: Page) => {
    lastLocalNavigationRef.current = Date.now();
    setHistory(prev => {
        const newHistory = prev.slice(0, -1);
        if (newHistory.length > 0 && newHistory[newHistory.length - 1] === page) {
            return newHistory;
        }
        newHistory.push(page);
        return newHistory;
    });
  }, []);

  // --- STUDIO RESET LOGIC (Emergency Brake) ---
  // If the page is reloaded in Studio Mode, clear the remote state.
  useEffect(() => {
      const clearRemoteStateOnMount = async () => {
          if (isStudioMode && selectedOrganization && selectedStudio && !hasCleanedUpRef.current) {
               hasCleanedUpRef.current = true;
               await updateStudioRemoteState(selectedOrganization.id, selectedStudio.id, null);
               // We wait for the snapshot to reflect the null state before listening
          } else if (!isStudioMode) {
               setIsReadyToListen(true);
          }
      };
      
      if (!studioLoading) {
          clearRemoteStateOnMount();
      }
  }, [isStudioMode, selectedOrganization?.id, selectedStudio?.id, studioLoading]);

  useEffect(() => {
      if (isStudioMode && hasCleanedUpRef.current && !isReadyToListen && selectedStudio && !selectedStudio.remoteState) {
          setIsReadyToListen(true);
      }
  }, [isStudioMode, isReadyToListen, selectedStudio?.remoteState]);

      // STUDIO RECEIVER LOGIC (TV Mode)
      useEffect(() => {
          if (!isStudioMode || !selectedOrganization || !selectedStudio || !isReadyToListen) return;
    
          const remote = selectedStudio.remoteState;
          
          if (remote) {
              if (remote.command && remote.commandTimestamp) {
                  if (remote.commandTimestamp > pageEntryTimestampRef.current) {
                      setRemoteCommand(prev => {
                          if (!prev || prev.timestamp !== remote.commandTimestamp) {
                              return { type: remote.command!, timestamp: remote.commandTimestamp! };
                          }
                          return prev;
                      });
                  }
              }

              const isRecentLocalNav = Date.now() - lastLocalNavigationRef.current < 3000;

              if (!isRecentLocalNav) {
                  if (remote.view === 'idle') {
                      if (page !== Page.Home) {
                          navigateReplace(Page.Home);
                          setActiveWorkout(null);
                      }
                  } else if (remote.activeWorkoutId) {
                      // PRIORITY: If we have customWorkoutData in remote state, use that!
                      // This ensures that 5 second adjustments are visible on all screens.
                      const workoutToLoad = (remote as any).customWorkoutData || workouts.find(w => w.id === remote.activeWorkoutId);
                      
                      const loadAndNavigate = (workout: Workout) => {
                          // Deep compare or ID check to prevent re-renders
                          if (activeWorkout?.id !== workout.id || JSON.stringify(activeWorkout) !== JSON.stringify(workout)) {
                              setActiveWorkout(workout);
                          }
    
                          if (remote.view === 'preview') {
                              if (page !== Page.WorkoutDetail) {
                                  navigateReplace(Page.WorkoutDetail);
                              }
                          } else if (remote.view === 'timer' && remote.activeBlockId) {
                              const blockToStart = workout.blocks.find(b => b.id === remote.activeBlockId);
                              if (blockToStart) {
                                  if (activeBlock?.id !== blockToStart.id || JSON.stringify(activeBlock) !== JSON.stringify(blockToStart)) {
                                      setActiveBlock(blockToStart);
                                  }
                                  const targetPage = blockToStart.settings.mode === TimerMode.NoTimer ? Page.RepsOnly : Page.Timer;
                                  if (page !== targetPage) {
                                      navigateReplace(targetPage);
                                  }
                              }
                          }
                      };

                      if (workoutToLoad) {
                          loadAndNavigate(workoutToLoad);
                      } else {
                          getWorkoutById(remote.activeWorkoutId).then(fetchedWorkout => {
                              if (fetchedWorkout) {
                                  loadAndNavigate(fetchedWorkout);
                              }
                          });
                      }
                  }
              }
          }
      }, [isStudioMode, selectedOrganization, selectedStudio, workouts, page, activeWorkout, activeBlock, navigateReplace, setActiveWorkout, isReadyToListen]);

      // AUTO-CLEAR STALE SESSIONS (5 minutes)
      useEffect(() => {
          if (!isStudioMode || !selectedOrganization || !selectedStudio) return;

          const checkStaleSession = () => {
              const remote = selectedStudio.remoteState;
              if (!remote) return;

              // Don't clear if it's actively running, resting, or preparing
              if (remote.status === TimerStatus.Running || 
                  remote.status === TimerStatus.Preparing || 
                  remote.status === TimerStatus.Resting) {
                  return;
              }

              // Only clear if there's an active workout or we are not in idle view
              if (remote.view === 'idle' && !remote.activeWorkoutId) return;

              const lastActivity = remote.commandTimestamp || remote.lastUpdate || 0;
              const timeSinceActivity = Date.now() - lastActivity;

              if (timeSinceActivity > 5 * 60 * 1000) {
                  console.log('Session stale for > 5 mins, auto-clearing...');
                  updateStudioRemoteState(selectedOrganization.id, selectedStudio.id, null);
              }
          };

          const intervalId = setInterval(checkStaleSession, 60000); // Check every minute
          checkStaleSession(); // Check immediately on mount/update

          return () => clearInterval(intervalId);
      }, [isStudioMode, selectedOrganization, selectedStudio]);

  const [customBackHandlerState, setCustomBackHandlerState] = useState<(() => void) | null>(null);
  const customBackHandlerRef = useRef<(() => void) | null>(null);

  const setCustomBackHandler = useCallback((handler: (() => void) | null) => {
      customBackHandlerRef.current = handler;
      setCustomBackHandlerState(handler ? () => handler : null);
  }, []);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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
    pageEntryTimestampRef.current = Date.now();
  }, [page]);

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
  const [isAutoTransition, setIsAutoTransition] = useState(false);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);
  const [reAuthPurpose, setReAuthPurpose] = useState<'admin' | 'profile'>('admin');

  const [isRegisteringHyroxTime, setIsRegisteringHyroxTime] = useState(false);
  const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage' | 'create'>('create');
  
  const [mobileLogData, setMobileLogData] = useState<{workoutId: string, organizationId: string, source?: 'qr_scan' | 'manual'} | null>(null);
  const [mobileViewData, setMobileViewData] = useState<Workout | null>(null); 
  const [isSearchWorkoutOpen, setIsSearchWorkoutOpen] = useState(false);
  const [showLogCancelModal, setShowLogCancelModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeDiploma, setActiveDiploma] = useState<WorkoutDiploma | null>(null);
  const [showBirthDatePrompt, setShowBirthDatePrompt] = useState(false);

  useEffect(() => {
      if (userData && !userData.birthDate && !isStudioMode) {
          setShowBirthDatePrompt(true);
      } else {
          setShowBirthDatePrompt(false);
      }
  }, [userData, isStudioMode]);

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

  useEffect(() => {
    const faviconUrl = selectedOrganization?.faviconUrl;
    if (faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = faviconUrl;

      let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
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
      const inviteCode = params.get('invite');
      const coachCode = params.get('coach');
      const successParam = params.get('success');
      const typeParam = params.get('type');
      
      if (inviteCode || coachCode) {
          setShowLogin(true);
      }

      // Optimistic update for member subscription success
      if (successParam === 'true' && typeParam === 'member' && userData?.uid) {
          console.log("Stripe checkout success! Optimistically activating subscription...");
          // Uppdatera doc lokalt så vi släpps igenom betalväggen snabbt
          activateMemberSubscriptionLocally(userData.uid).then(() => {
              // Rensa sen bort url params så vi slipper checka varje gång
              window.history.replaceState({}, document.title, window.location.pathname);
          });
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

  const pagesThatPreventScreensaver: Page[] = [
      Page.Timer, 
      Page.RepsOnly, 
      Page.IdeaBoard, 
      Page.MemberProfile, 
      Page.MemberRegistry, 
      Page.MobileLog,
      Page.RemoteControl 
  ];

  const resetInactivityTimer = useCallback(() => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (isStudioMode && studioConfig.enableScreensaver && !pagesThatPreventScreensaver.includes(page)) {
          const timeoutMinutes = studioConfig.screensaverTimeoutMinutes || 15;
          inactivityTimerRef.current = window.setTimeout(() => {
              setIsScreensaverActive(true);
          }, timeoutMinutes * 60 * 1000);
      } else {
          if (isScreensaverActive) setIsScreensaverActive(false);
      }
  }, [isStudioMode, studioConfig.enableScreensaver, studioConfig.screensaverTimeoutMinutes, page, isScreensaverActive]);

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

  const isInfoBannerVisible = (page === Page.Home || isScreensaverActive) && activeInfoMessages.length > 0;

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



  const handleBack = useCallback(() => {
    if (customBackHandlerRef.current) {
      customBackHandlerRef.current();
      return;
    }

    if (history.length <= 1) return;

    const currentPage = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const targetPage = newHistory[newHistory.length - 1];
    
    if (currentPage === Page.Coach && role === 'member') {
        setSessionRole('member');
    }
    
    if (currentPage === Page.IdeaBoard) setActiveWorkout(null);

    if (currentPage === Page.WorkoutList && isPickingForLog) {
        setIsPickingForLog(false);
    }
    
    // Clear active block if we are leaving the timer
    let nextActiveBlockId = activeBlock?.id || null;
    if (targetPage === Page.WorkoutDetail || targetPage === Page.Home || targetPage === Page.Coach || targetPage === Page.SuperAdmin) {
        setActiveBlock(null);
        nextActiveBlockId = null;
    }
    
    if (targetPage === Page.Home || targetPage === Page.Coach || targetPage === Page.SuperAdmin) {
        setActiveWorkout(null);
    }
    
    if (isStudioMode && selectedOrganization && selectedStudio) {
         let view: RemoteSessionState['view'] = 'menu';
         
         if (targetPage === Page.Timer || targetPage === Page.RepsOnly) {
             view = 'timer';
         } else if (targetPage === Page.WorkoutDetail) {
             view = 'preview';
         } else if (targetPage === Page.Home) {
             view = 'idle';
         }
         
         setRemoteCommand(null);
         lastLocalNavigationRef.current = Date.now();

         updateStudioRemoteState(selectedOrganization.id, selectedStudio.id, {
             view,
             activeWorkoutId: (targetPage === Page.Home || targetPage === Page.Coach || targetPage === Page.SuperAdmin) ? null : (activeWorkout?.id || null),
             activeBlockId: nextActiveBlockId,
             lastUpdate: Date.now(),
             controllerName: 'Touch Screen'
         });
    }
    
    setHistory(newHistory);
  }, [history, role, isImpersonating, setActiveWorkout, isPickingForLog, isStudioMode, selectedOrganization, selectedStudio, activeWorkout, activeBlock]);

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
    const isMemberRole = sessionRole === 'member' || isStudioMode;
    const workoutToSave = { 
        ...workout, 
        isMemberDraft: workout.isMemberDraft ?? isMemberRole 
    };
    const savedWorkout = await saveWorkout(workoutToSave);
    
    if (startFirstBlock && savedWorkout.blocks.length > 0) {
        handleStartBlock(savedWorkout.blocks[0], savedWorkout);
    } else {
        setActiveWorkout(savedWorkout);
        
        if (isStudioMode) {
            if (selectedOrganization && selectedStudio) {
                updateStudioRemoteState(selectedOrganization.id, selectedStudio.id, {
                    view: 'preview',
                    activeWorkoutId: savedWorkout.id,
                    activeBlockId: null,
                    lastUpdate: Date.now(),
                    controllerName: 'Touch Screen'
                });
            }
            navigateReplace(Page.WorkoutDetail);
        } else if (isEditingNewDraft) {
            setIsEditingNewDraft(false);
            navigateReplace(Page.WorkoutDetail);
        } else {
            handleBack();
            setPreferredAdminTab('pass-program');
        }
    }
  };

  const handleSaveOnly = async (workout: Workout) => {
      const isMemberRole = sessionRole === 'member' || isStudioMode;
      return await saveWorkout({ 
          ...workout, 
          isMemberDraft: workout.isMemberDraft ?? isMemberRole 
      });
  };
  
  const handleTogglePublishStatus = async (workoutId: string, isPublished: boolean, silentPublish?: boolean) => {
    const workoutToToggle = workouts.find(w => w.id === workoutId);
    if (workoutToToggle) await saveWorkout({ ...workoutToToggle, isPublished, silentPublish });
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
    const isSavedWorkout = workouts.some(w => w.id === workoutContext.id);

    pageEntryTimestampRef.current = Date.now();
    setIsAutoTransition(false); 

    if (isStudioMode && selectedOrganization && selectedStudio && isSavedWorkout) {
        setRemoteCommand(null);
        setActiveWorkout(workoutContext);
        setActiveBlock(block);
        const targetPage = block.settings.mode === TimerMode.NoTimer ? Page.RepsOnly : Page.Timer;
        navigateTo(targetPage, { activeWorkoutId: workoutContext.id, activeBlockId: block.id });
        return;
    }
    setActiveWorkout(workoutContext);
    setActiveBlock(block);
    if (block.settings.mode === TimerMode.NoTimer) navigateTo(Page.RepsOnly);
    else navigateTo(Page.Timer);
  };

  const handleStartFreestandingTimer = (block: WorkoutBlock) => {
    setIsAutoTransition(false);
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

    pageEntryTimestampRef.current = Date.now();
    setRemoteCommand(null);

    setIsAutoTransition(false); 
    setActiveWorkout(tempWorkout);
    setActiveBlock(block);
    if (block.settings.mode === TimerMode.NoTimer) navigateTo(Page.RepsOnly, { activeWorkoutId: tempWorkout.id, activeBlockId: block.id });
    else navigateTo(Page.Timer, { activeWorkoutId: tempWorkout.id, activeBlockId: block.id });
  };

  const handleSelectWorkout = (workout: Workout, action: 'view' | 'log' = 'view') => {
    if (isStudioMode) {
        setActiveWorkout(workout);
        navigateTo(Page.WorkoutDetail, { activeWorkoutId: workout.id });
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
    let categoryWorkouts = workouts.filter(w => w.category === passkategori && w.isPublished && !w.isMemberDraft);
    
    if (categoryWorkouts.length === 1 && !isPickingForLog) {
        if (isStudioMode) {
            handleSelectWorkout(categoryWorkouts[0]);
            return;
        } else {
             handleSelectWorkout(categoryWorkouts[0], 'view');
             return;
        }
    }

    if (!isStudioMode) {
        if (isPickingForLog) {
             setIsPickingForLog(true);
        }
    }
    
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
    const workoutWithOrg = { 
        ...workout, 
        organizationId: selectedOrganization?.id || '',
        isMemberDraft: true 
    };
    setActiveWorkout(workoutWithOrg); 
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

  const handleTimerFinish = useCallback((finishData: { isNatural?: boolean; time?: number, raceId?: string }) => {
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

    if (activeWorkout && activeBlock && activeBlock.autoAdvance) {
        const blockIndex = activeWorkout.blocks.findIndex(b => b.id === activeBlock.id);
        const nextBlockInWorkout = activeWorkout.blocks[blockIndex + 1];
        if (nextBlockInWorkout) {
            setIsAutoTransition(true);
            pageEntryTimestampRef.current = Date.now();
            lastLocalNavigationRef.current = Date.now(); 
            
            if (isStudioMode && selectedOrganization && selectedStudio) {
                setRemoteCommand(null);
                updateStudioRemoteState(selectedOrganization.id, selectedStudio.id, {
                    activeWorkoutId: activeWorkout.id,
                    view: 'timer',
                    activeBlockId: nextBlockInWorkout.id,
                    lastUpdate: Date.now(),
                    controllerName: 'Auto-Advance'
                });
            }
            
            setActiveBlock(nextBlockInWorkout);
            return;
        }
    }

    if (activeWorkout && activeBlock) {
        const blockIndex = activeWorkout.blocks.findIndex(b => b.id === activeBlock.id);
        const isLastBlock = blockIndex === activeWorkout.blocks.length - 1;
        setCompletionInfo({ workout: activeWorkout, isFinal: isLastBlock, blockTag: activeBlock.tag, finishTime: time });
    } else if (activeWorkout) {
        setCompletionInfo({ workout: activeWorkout, isFinal: true, blockTag: activeWorkout.blocks[0]?.tag, finishTime: time });
    }
  }, [completionInfo, handleBack, activeWorkout, activeBlock, isStudioMode, navigateReplace, selectedOrganization, selectedStudio, workouts]);

  const handleCloseWorkoutCompleteModal = () => {
    if (!completionInfo) return;

    const isFinalBlock = completionInfo.isFinal;
    const workoutId = completionInfo.workout.id;
    const isFreestanding = workoutId.startsWith('freestanding-workout-') || 
                           workoutId.startsWith('fs-workout-');

    setCompletionInfo(null);
    setRemoteCommand(null);

    if (isFreestanding) {
        setActiveWorkout(null);
        setActiveBlock(null);
        handleBack();
        return;
    }

    setActiveBlock(null);

    if (isFinalBlock) {
      if (page === Page.Timer || page === Page.RepsOnly) {
          navigateReplace(Page.WorkoutDetail);
      } else if (history.length > 1) {
          handleBack();
      }
    } else {
      if (page === Page.Timer || page === Page.RepsOnly) {
          navigateReplace(Page.WorkoutDetail);
      } else {
          handleBack();
      }
    }
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  }

  const handleLogWorkoutRequest = (workoutId: string, orgId: string) => {
    setIsSearchWorkoutOpen(false);
    setMobileViewData(null); 
    setMobileLogData({ workoutId, organizationId: orgId, source: 'manual' });
  };

  const handleCancelLog = (isSuccess?: boolean, diploma?: WorkoutDiploma) => {
      if (isSuccess === true) {
          setMobileLogData(null);
          window.history.replaceState({}, document.title, window.location.pathname);
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
      window.history.replaceState({}, document.title, window.location.pathname);
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

  const isFullScreenPage = page === Page.Timer || page === Page.RepsOnly || page === Page.IdeaBoard || page === Page.RemoteControl;
  const isAdminDashboardMode = page === Page.SuperAdmin || page === Page.SystemOwner;
  const paddingClass = (isFullScreenPage || isAdminDashboardMode) ? '' : 'p-4 sm:p-6 lg:p-8';
  
  const isAdminOrCoach = role === 'systemowner' || role === 'organizationadmin' || role === 'coach';
  const isMemberFacingPage = [Page.Home, Page.WorkoutDetail, Page.SavedWorkouts, Page.MemberProfile, Page.WorkoutList, Page.WorkoutGamesHub].includes(page);
  const isAdminFacingPage = [Page.Coach, Page.SuperAdmin, Page.SystemOwner, Page.AdminAnalytics, Page.MemberRegistry].includes(page);

  const showSupportChat = !isStudioMode && isAdminOrCoach && isAdminFacingPage;
  const showScanButton = ((!isStudioMode && isMemberFacingPage) || (page === Page.MemberProfile)) && studioConfig.enableWorkoutLogging;

  const isAnyModalOpen = !!(mobileLogData || mobileViewData || isSearchWorkoutOpen || isScannerOpen || activeDiploma);
  
  if (page === Page.RemoteControl) {
      return (
          <RemoteControlScreen onBack={handleBack} />
      );
  }
  
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
  
  if (!authLoading && !currentUser && !isStudioMode) {
      if (showRegisterGym) {
          return <RegisterGymScreen onCancel={() => setShowRegisterGym(false)} />;
      }
      if (showLogin) {
          return <LoginScreen onClose={() => setShowLogin(false)} onRegisterGym={() => setShowRegisterGym(true)} />;
      }
      return <LandingPage onLoginClick={() => setShowLogin(true)} onRegisterGymClick={() => setShowRegisterGym(true)} />;
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

  return (
    <div className={`bg-white dark:bg-black text-gray-800 dark:text-gray-200 font-sans flex flex-col ${isStudioMode && page === Page.Home ? 'h-screen overflow-hidden' : 'min-h-screen'} ${paddingClass}`}>
       {isOffline && (
            <div className="bg-red-500 text-white text-xs font-bold uppercase tracking-widest py-2 px-4 flex justify-center items-center gap-2 fixed top-0 w-full z-[10000] shadow-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18"></path>
                </svg>
                Du är offline - allt du loggar sparas lokalt
            </div>
       )}
       <SeasonalOverlay page={page} />
       
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
       {isStudioMode && <PBOverlay />}

       <div className={(isAnyModalOpen || showPaywall || showWelcomePaywall || showPendingCoach || !(page === Page.Timer || !isFullScreenPage)) ? 'hidden' : 'contents'}>
           <Header 
            page={page} 
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
                
                remoteCommand={remoteCommand}
                
                functions={{
                    selectOrganization: handleSelectOrganization,
                    createOrganization: handleCreateOrganization,
                    deleteOrganization: handleDeleteOrganization,
                    saveGlobalConfig: handleSaveGlobalConfig,
                    createStudio: handleCreateStudio,
                    updateStudio: updateStudio,
                    deleteStudio: deleteStudio,
                    updatePasswords: updateOrganizationPasswords,
                    updateLogos: updateOrganizationLogos,
                    updateFavicon: updateOrganizationFavicon,
                    updatePrimaryColor: updateOrganizationPrimaryColor,
                    updateOrganization: handleUpdateOrganization,
                    updateCustomPages: updateOrganizationCustomPages,
                    updateInfoCarousel: updateOrganizationInfoCarousel,
                    
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
                    setRegisteringHyroxTime: setIsRegisteringHyroxTime,
                    setFollowMeShowImage: setFollowMeShowImage,
                    
                    handleGeneratedWorkout: handleGeneratedWorkout,
                    handleWorkoutInterpreted: handleWorkoutInterpretedFromNote,
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
            
            {remoteCommand && (
                <div style={{ display: 'none' }} data-command={remoteCommand.type} data-timestamp={remoteCommand.timestamp} />
            )}
          </main>
          
          {isInfoBannerVisible && !isScreensaverActive && (
              // hidden md:block (osynlig på mobil), fast höjd h-[512px] på resten.
              <div className="hidden md:block flex-shrink-0 w-full h-[512px] relative z-[40]">
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
      </AnimatePresence>

      <AnimatePresence>
          {mobileViewData && (
              <WorkoutPresentationModal
                  workout={mobileViewData}
                  onClose={() => setMobileViewData(null)}
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
          onLogout={signOut}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setSessionRole('coach');
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
            <>
                <Screensaver 
                    logoUrl={selectedOrganization?.logoUrlDark || selectedOrganization?.logoUrlLight}
                    bottomOffset={isInfoBannerVisible ? (window.innerWidth >= 768 ? 512 : 0) : 0}
                />
                {isInfoBannerVisible && (
                    <div className="hidden md:block fixed bottom-0 left-0 right-0 h-[512px] z-[1001]">
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