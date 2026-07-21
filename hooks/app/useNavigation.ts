import { useState, useEffect, useCallback, useRef } from 'react';
import { Page, UserRole, Workout, WorkoutBlock, Organization, Studio, UserData } from '../../types';

export interface UseNavigationDeps {
  role: UserRole;
  sessionRole: UserRole;
  setSessionRole: (role: UserRole) => void;
  activeWorkout: Workout | null;
  setActiveWorkout: (workout: Workout | null) => void;
  activeBlock: WorkoutBlock | null;
  setActiveBlock: (block: WorkoutBlock | null) => void;
  isPickingForLog: boolean;
  setIsPickingForLog: (picking: boolean) => void;
  isStudioMode: boolean;
  selectedOrganization: Organization | null;
  selectedStudio: Studio | null;
  currentUser: any;
  userData: UserData | null;
  authLoading: boolean;
  isImpersonating: boolean;
}

export const useNavigation = (deps: UseNavigationDeps) => {
  const {
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
    isImpersonating,
  } = deps;

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

  // --- FIXEN: Vi tillåter denna effekt att köras även i StudioMode! ---
  useEffect(() => {
    if (!authLoading && currentUser) {
      const isAtInitialPage = history.length === 1;
      const currentPage = history[history.length - 1];

      const actualRole = userData?.role || role;

      if (isStudioMode && currentPage !== Page.Home && isAtInitialPage) {
        setHistory([Page.Home]); // Tvinga in studiovyn
      } else if (!isStudioMode) {
        if (actualRole === 'systemowner' && currentPage !== Page.SystemOwner && isAtInitialPage) {
          setHistory([Page.SystemOwner]);
        } else if (actualRole === 'organizationadmin' && currentPage !== Page.SuperAdmin && isAtInitialPage) {
          setHistory([Page.SuperAdmin]);
        } else if (actualRole === 'coach' && currentPage !== Page.Coach && isAtInitialPage) {
          setHistory([Page.Coach]);
        } else if (actualRole === 'member' && currentPage !== Page.MemberProfile && isAtInitialPage) {
          setHistory([Page.MemberProfile]);
        }
      }
    }
  }, [role, userData, authLoading, isStudioMode, history.length, currentUser]);

  const lastLocalNavigationRef = useRef<number>(0);

  const navigateTo = useCallback((targetPage: Page, options?: { activeWorkoutId?: string | null, activeBlockId?: string | null }) => {
    setHistory(prev => {
      if (prev[prev.length - 1] === targetPage) return prev;
      return [...prev, targetPage];
    });
  }, [isStudioMode, selectedOrganization, selectedStudio, activeWorkout, activeBlock]);

  const navigateReplace = useCallback((targetPage: Page) => {
    lastLocalNavigationRef.current = Date.now();
    setHistory(prev => {
      const newHistory = prev.slice(0, -1);
      if (newHistory.length > 0 && newHistory[newHistory.length - 1] === targetPage) {
        return newHistory;
      }
      newHistory.push(targetPage);
      return newHistory;
    });
  }, []);

  const [customBackHandlerState, setCustomBackHandlerState] = useState<(() => void) | null>(null);
  const customBackHandlerRef = useRef<(() => void) | null>(null);

  const setCustomBackHandler = useCallback((handler: (() => void) | null) => {
    customBackHandlerRef.current = handler;
    setCustomBackHandlerState(handler ? () => handler : null);
  }, []);

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

    setHistory(newHistory);
  }, [history, role, isImpersonating, setActiveWorkout, isPickingForLog, isStudioMode, selectedOrganization, selectedStudio, activeWorkout, activeBlock, setSessionRole, setIsPickingForLog, setActiveBlock]);

  return {
    history,
    setHistory,
    page,
    navigateTo,
    navigateReplace,
    handleBack,
    setCustomBackHandler,
    customBackHandlerState,
    lastLocalNavigationRef,
  };
};
