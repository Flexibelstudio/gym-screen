import { useCallback } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Organization, Studio, WorkoutDiploma } from '../../types';

export interface UseTimerFlowDeps {
  workouts: Workout[];
  activeWorkout: Workout | null;
  activeBlock: WorkoutBlock | null;
  completionInfo: { workout: Workout; isFinal: boolean; blockTag?: string; finishTime?: number } | null;
  page: Page;
  history: Page[];
  selectedOrganization: Organization | null;
  selectedStudio: Studio | null;
  isStudioMode: boolean;

  pageEntryTimestampRef: React.MutableRefObject<number>;
  lastLocalNavigationRef: React.MutableRefObject<number>;

  setActiveWorkout: (workout: Workout | null) => void;
  setActiveBlock: (block: WorkoutBlock | null) => void;
  setIsAutoTransition: (isAuto: boolean) => void;
  setIsBackButtonHidden: (hidden: boolean) => void;
  setActiveRaceId: (raceId: string | null) => void;
  setCompletionInfo: (info: { workout: Workout; isFinal: boolean; blockTag?: string; finishTime?: number } | null) => void;
  setRacePrepState: (state: { groups: any[]; interval: number } | null) => void;
  setIsSearchWorkoutOpen: (open: boolean) => void;
  setMobileViewData: (data: Workout | null) => void;
  setMobileLogData: (data: { workoutId: string; organizationId: string; source: 'qr_scan' | 'manual' } | null) => void;
  setActiveDiploma: (diploma: WorkoutDiploma | null) => void;
  setIsScannerOpen: (open: boolean) => void;

  navigateTo: (page: Page, params?: any) => void;
  navigateReplace: (page: Page, params?: any) => void;
  handleBack: () => void;
}

export function useTimerFlow(deps: UseTimerFlowDeps) {
  const {
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
  } = deps;

  const handleStartBlock = (block: WorkoutBlock, workoutContext: Workout) => {
    const isSavedWorkout = workouts.some((w) => w.id === workoutContext.id);

    pageEntryTimestampRef.current = Date.now();
    setIsAutoTransition(false);

    if (isStudioMode && selectedOrganization && selectedStudio && isSavedWorkout) {
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
    if (!selectedOrganization) return alert('Kan inte starta timer: ingen organisation är vald.');
    const tempWorkout: Workout = {
      id: `freestanding-workout-${Date.now()}`,
      title: block.title,
      coachTips: '',
      blocks: [block],
      category: 'Ej kategoriserad',
      isPublished: false,
      organizationId: selectedOrganization.id,
      createdAt: Date.now(),
    };

    pageEntryTimestampRef.current = Date.now();

    setIsAutoTransition(false);
    setActiveWorkout(tempWorkout);
    setActiveBlock(block);
    if (block.settings.mode === TimerMode.NoTimer)
      navigateTo(Page.RepsOnly, { activeWorkoutId: tempWorkout.id, activeBlockId: block.id });
    else navigateTo(Page.Timer, { activeWorkoutId: tempWorkout.id, activeBlockId: block.id });
  };

  const handleStartRace = (workout: Workout) => {
    if (workout.blocks.length > 0) handleStartBlock(workout.blocks[0], workout);
  };

  const handleSelectRace = (raceId: string) => {
    setActiveRaceId(raceId);
    navigateTo(Page.HyroxRaceDetail);
  };

  const handleReturnToGroupPrep = useCallback(() => {
    if (activeWorkout && (activeWorkout.id.startsWith('hyrox-full-race') || activeWorkout.id.includes('custom-race'))) {
      setRacePrepState({
        groups: activeWorkout.startGroups || [],
        interval: activeWorkout.startIntervalMinutes || 2,
      });
      handleBack();
    }
  }, [activeWorkout, handleBack, setRacePrepState]);

  const handleTimerFinish = useCallback(
    (finishData: { isNatural?: boolean; time?: number; raceId?: string }) => {
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
        const blockIndex = activeWorkout.blocks.findIndex((b) => b.id === activeBlock.id);
        const nextBlockInWorkout = activeWorkout.blocks[blockIndex + 1];
        if (nextBlockInWorkout) {
          setIsAutoTransition(true);
          pageEntryTimestampRef.current = Date.now();
          lastLocalNavigationRef.current = Date.now();

          setActiveBlock(nextBlockInWorkout);
          return;
        }
      }

      if (activeWorkout && activeBlock) {
        const blockIndex = activeWorkout.blocks.findIndex((b) => b.id === activeBlock.id);
        const isLastBlock = blockIndex === activeWorkout.blocks.length - 1;
        setCompletionInfo({ workout: activeWorkout, isFinal: isLastBlock, blockTag: activeBlock.tag, finishTime: time });
      } else if (activeWorkout) {
        setCompletionInfo({ workout: activeWorkout, isFinal: true, blockTag: activeWorkout.blocks[0]?.tag, finishTime: time });
      }
    },
    [
      completionInfo,
      handleBack,
      activeWorkout,
      activeBlock,
      isStudioMode,
      navigateReplace,
      selectedOrganization,
      selectedStudio,
      workouts,
      setIsBackButtonHidden,
      setActiveRaceId,
      setIsAutoTransition,
      pageEntryTimestampRef,
      lastLocalNavigationRef,
      setActiveBlock,
      setCompletionInfo,
    ]
  );

  const handleCloseWorkoutCompleteModal = () => {
    if (!completionInfo) return;

    const isFinalBlock = completionInfo.isFinal;
    const workoutId = completionInfo.workout.id;
    const isFreestanding = workoutId.startsWith('freestanding-workout-') || workoutId.startsWith('fs-workout-');

    setCompletionInfo(null);

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

  const handleLogWorkoutRequest = (workoutId: string, orgId: string, source: 'qr_scan' | 'manual' = 'manual') => {
    setIsSearchWorkoutOpen(false);
    setMobileViewData(null);
    setMobileLogData({ workoutId, organizationId: orgId, source });
  };

  const handleCancelLog = (isSuccess?: boolean, diploma?: WorkoutDiploma) => {
    setMobileLogData(null);
    window.history.replaceState({}, document.title, window.location.pathname);
    if (isSuccess === true && diploma) {
      setActiveDiploma(diploma);
    }
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
        handleLogWorkoutRequest(payload.wid, payload.oid, 'qr_scan');
        setIsScannerOpen(false);
      }
    } catch (e) {
      console.error('Failed to parse scanned code', e);
    }
  };

  return {
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
  };
}
