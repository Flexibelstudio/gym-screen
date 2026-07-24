import { useCallback, useEffect, useRef } from 'react';
import { Page, StudioConfig } from '../../types';

const pagesThatPreventScreensaver: Page[] = [
    Page.Timer, 
    Page.RepsOnly, 
    Page.IdeaBoard, 
    Page.MemberProfile, 
    Page.MemberRegistry, 
    Page.MobileLog
];

interface UseInactivityTimerParams {
  isStudioMode: boolean;
  studioConfig: StudioConfig;
  page: Page;
  isScreensaverActive: boolean;
  setIsScreensaverActive: (active: boolean) => void;
}

export const useInactivityTimer = ({
  isStudioMode,
  studioConfig,
  page,
  isScreensaverActive,
  setIsScreensaverActive,
}: UseInactivityTimerParams) => {
  const inactivityTimerRef = useRef<number | null>(null);

  const resetInactivityTimer = useCallback(() => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (isStudioMode && studioConfig?.enableScreensaver && !pagesThatPreventScreensaver.includes(page)) {
          const timeoutMinutes = studioConfig.screensaverTimeoutMinutes || 15;
          inactivityTimerRef.current = window.setTimeout(() => {
              setIsScreensaverActive(true);
          }, timeoutMinutes * 60 * 1000);
      } else {
          if (isScreensaverActive) setIsScreensaverActive(false);
      }
  }, [isStudioMode, studioConfig?.enableScreensaver, studioConfig?.screensaverTimeoutMinutes, page, isScreensaverActive, setIsScreensaverActive]);

  const handleUserActivity = useCallback(() => {
      if (isScreensaverActive) setIsScreensaverActive(false);
      resetInactivityTimer();
  }, [isScreensaverActive, resetInactivityTimer, setIsScreensaverActive]);

  useEffect(() => {
      resetInactivityTimer();
      return () => { if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
  }, [resetInactivityTimer, page]);

  useEffect(() => {
      const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
      events.forEach(event => window.addEventListener(event, handleUserActivity));
      return () => { events.forEach(event => window.removeEventListener(event, handleUserActivity)); };
  }, [handleUserActivity]);

  return { handleUserActivity, resetInactivityTimer };
};
