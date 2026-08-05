import { Page, Workout, WorkoutBlock, Passkategori, UserRole, Organization, StudioConfig } from '../../types';
import { deepCopyAndPrepareAsNew, isWorkoutVisibleNow, getMemberLocationIds, isWorkoutVisibleForLocations, getDefaultLoggingForBlockTag, OTHER_CATEGORY } from '../../utils/workoutUtils';
import { saveCustomProgram, saveAdminActivity, updateCoachNote } from '../../services/firebaseService';
import { useConfirm } from '../../components/ConfirmContext';

export interface UseWorkoutActionsDeps {
  sessionRole: UserRole;
  isStudioMode: boolean;
  currentUser: { uid: string } | null;
  selectedOrganization: Organization | null;
  selectedStudio?: { locationId?: string } | null;
  userData?: { locationId?: string; locationIds?: string[] } | null;
  workouts: Workout[];
  activeWorkout: Workout | null;
  page: Page;
  isEditingNewDraft: boolean;
  returnToAdminOnSave: boolean;
  isSearchWorkoutOpen: boolean;
  isPickingForLog: boolean;
  studioConfig?: StudioConfig;

  setActiveWorkout: (workout: Workout | null) => void;
  setFocusedBlockId: (id: string | null) => void;
  setIsEditingNewDraft: (isEditing: boolean) => void;
  setReturnToAdminOnSave: (returnToAdmin: boolean) => void;
  setPreferredAdminTab: (tab: string) => void;
  setMobileViewData: (workout: Workout | null) => void;
  setIsPickingForLog: (isPicking: boolean) => void;
  setActivePasskategori: (category: Passkategori) => void;

  navigateTo: (page: Page, params?: any) => void;
  navigateReplace: (page: Page, params?: any) => void;
  handleBack: () => void;
  saveWorkout: (workout: Workout) => Promise<Workout>;
  deleteWorkout: (workoutId: string) => Promise<void>;
  handleStartBlock: (block: WorkoutBlock, workout: Workout) => void;
  handleLogWorkoutRequest: (workoutId: string, organizationId: string) => void;
}

export function useWorkoutActions(deps: UseWorkoutActionsDeps) {
  const confirm = useConfirm();
  const {
    sessionRole,
    isStudioMode,
    currentUser,
    selectedOrganization,
    workouts,
    activeWorkout,
    page,
    isEditingNewDraft,
    returnToAdminOnSave,
    isSearchWorkoutOpen,
    isPickingForLog,
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
  } = deps;

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
    if (sessionRole === 'member' || isStudioMode) navigateTo(Page.SimpleWorkoutBuilder);
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

    if (sessionRole === 'member' && !isStudioMode && currentUser?.uid) {
      await saveCustomProgram(currentUser.uid, workout);
      window.dispatchEvent(new Event('customProgramsUpdated'));
      setActiveWorkout(workout);
      setIsEditingNewDraft(false);
      handleBack();
      return;
    }

    const workoutToSave = {
      ...workout,
      isMemberDraft: workout.isMemberDraft ?? isMemberRole,
    };
    const savedWorkout = await saveWorkout(workoutToSave);

    // Om passet skapades från en anteckning, länka tillbaka från anteckningen till passet
    if (workoutToSave.sourceNoteId && savedWorkout?.id && selectedOrganization?.id) {
      try {
        await updateCoachNote(workoutToSave.sourceNoteId, {
          createdWorkoutId: savedWorkout.id,
          createdWorkoutTitle: savedWorkout.title,
        });
      } catch (err) {
        console.error("Kunde inte uppdatera anteckningen med passlänk:", err);
      }
    }

    if (startFirstBlock && savedWorkout.blocks.length > 0) {
      handleStartBlock(savedWorkout.blocks[0], savedWorkout);
    } else {
      setActiveWorkout(savedWorkout);

      if (isStudioMode) {
        navigateReplace(Page.WorkoutDetail);
      } else if (isEditingNewDraft) {
        setIsEditingNewDraft(false);
        if (returnToAdminOnSave) {
          setReturnToAdminOnSave(false);
          handleBack();
          setPreferredAdminTab('pass-program');
        } else {
          navigateReplace(Page.WorkoutDetail);
        }
      } else {
        handleBack();
        setPreferredAdminTab('pass-program');
      }
    }
  };

  const handleSaveOnly = async (workout: Workout) => {
    const isMemberRole = sessionRole === 'member' || isStudioMode;
    if (sessionRole === 'member' && !isStudioMode && currentUser?.uid) {
      await saveCustomProgram(currentUser.uid, workout);
      window.dispatchEvent(new Event('customProgramsUpdated'));
      return workout;
    }
    return await saveWorkout({
      ...workout,
      isMemberDraft: workout.isMemberDraft ?? isMemberRole,
    });
  };

  const handleTogglePublishStatus = async (workoutId: string, isPublished: boolean, silentPublish?: boolean) => {
    const workoutToToggle = workouts.find((w) => w.id === workoutId);
    if (workoutToToggle) {
      if (isPublished) {
        const untaggedBlocks = workoutToToggle.blocks?.filter(b => !(b.tag || '').trim()) || [];
        if (untaggedBlocks.length > 0) {
          const blockTitles = untaggedBlocks.map(b => b.title || 'Namnlöst block').join(', ');
          await confirm({
            title: "Blocktyp saknas",
            message: `Blockets typ styr loggning, målvikter och vilotider och måste därför vara vald innan passet publiceras. Följande block saknar typ: ${blockTitles}`,
            confirmText: "Gå tillbaka",
            cancelText: "Avbryt"
          });
          return;
        }

        const hasLoggingEligibleBlock = workoutToToggle.blocks?.some(b => getDefaultLoggingForBlockTag(b.tag)) || false;
        const hasAnyLoggingEnabled = workoutToToggle.blocks?.some(b => b.exercises?.some(e => e.loggingEnabled === true)) || false;

        if (hasLoggingEligibleBlock && !hasAnyLoggingEnabled) {
          const userConfirmed = await confirm({
            title: "Inget går att logga",
            message: "Det här passet innehåller styrke- eller konditionsblock, men ingen övning är markerad för loggning. Medlemmarna kommer inte kunna registrera några resultat. Vill du publicera ändå?",
            confirmText: "Publicera ändå",
            cancelText: "Gå tillbaka"
          });

          if (!userConfirmed) {
            return;
          }
        }
      }

      await saveWorkout({ ...workoutToToggle, isPublished, silentPublish });
      if (selectedOrganization) {
        try {
          saveAdminActivity({
            organizationId: selectedOrganization.id,
            userId: currentUser?.uid || 'unknown',
            userName: (currentUser as any)?.firstName || 'Coach',
            type: 'WORKOUT',
            action: isPublished ? 'PUBLISH' : 'UNPUBLISH',
            description: `${isPublished ? 'Publicerade' : 'Avpublicerade'} passet "${workoutToToggle.title}"`,
            timestamp: Date.now()
          });
        } catch (logErr) {
          console.warn("Failed to log activity:", logErr);
        }
      }
    }
  };

  const handleToggleFavoriteStatus = async (workoutId: string) => {
    const workoutToToggle = workouts.find((w) => w.id === workoutId);
    if (workoutToToggle) await saveWorkout({ ...workoutToToggle, isFavorite: !workoutToToggle.isFavorite });
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    const workoutToDelete = workouts.find((w) => w.id === workoutId);
    const title = workoutToDelete?.title || 'Pass';
    await deleteWorkout(workoutId);
    if (selectedOrganization) {
      try {
        saveAdminActivity({
          organizationId: selectedOrganization.id,
          userId: currentUser?.uid || 'unknown',
          userName: (currentUser as any)?.firstName || 'Coach',
          type: 'WORKOUT',
          action: 'DELETE',
          description: `Raderade passet "${title}"`,
          timestamp: Date.now()
        });
      } catch (logErr) {
        console.warn("Failed to log activity:", logErr);
      }
    }
    if (activeWorkout?.id === workoutId && page === Page.WorkoutDetail) {
      handleBack();
    }
  };

  const handleDuplicateWorkout = (workoutToCopy: Workout, origin?: string) => {
    if (origin === 'admin') setReturnToAdminOnSave(true);
    const newDraft = deepCopyAndPrepareAsNew(workoutToCopy);
    setActiveWorkout(newDraft);
    setIsEditingNewDraft(true);
    navigateTo(Page.WorkoutBuilder);
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
    if ((workout.id.startsWith('hyrox-full-race') || workout.id.includes('custom-race')) && workout.blocks.length > 0) {
      handleStartBlock(workout.blocks[0], workout);
    } else {
      navigateTo(Page.WorkoutDetail);
    }
  };

  const handleSelectPasskategori = (passkategori: Passkategori) => {
    const now = Date.now();
    const activeLocationIds = deps.isStudioMode
      ? getMemberLocationIds({ locationId: deps.selectedStudio?.locationId })
      : getMemberLocationIds(deps.userData);

    let categoryWorkouts = workouts.filter((w) => 
      w.category === passkategori && 
      isWorkoutVisibleForLocations(w, activeLocationIds, now) && 
      !w.isMemberDraft
    );

    const catConfig = deps.studioConfig?.customCategories?.find(c => c.name === passkategori);
    if (catConfig?.showOnlyLatestPublished && categoryWorkouts.length > 1) {
      let best = categoryWorkouts[0];
      for (let i = 1; i < categoryWorkouts.length; i++) {
        const cur = categoryWorkouts[i];
        const curTime = cur.publishAt ?? cur.createdAt ?? 0;
        const bestTime = best.publishAt ?? best.createdAt ?? 0;
        if (curTime > bestTime) {
          best = cur;
        }
      }
      categoryWorkouts = [best];
    }

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

  const handleGeneratedWorkout = (newWorkout: Workout) => {
    setActiveWorkout(newWorkout);
    setFocusedBlockId(null);
    setIsEditingNewDraft(true);
    navigateTo(Page.WorkoutBuilder);
  };

  const handleWorkoutInterpretedFromNote = (workout: Workout, sourceNoteId?: string) => {
    // Allt som skapas via AI-whiteboarden eller anteckningarna publiceras direkt
    // under Övriga pass, oavsett roll. Ingen rollgrening, inget utkastläge — ett
    // utkast går varken att logga eller skanna, och det var källan till flera fel.
    // Tyst publicering: en notis per pass någon skissar vid skärmen vore brus.
    const workoutWithOrg = {
      ...workout,
      organizationId: selectedOrganization?.id || '',
      isMemberDraft: false,
      isPublished: true,
      category: OTHER_CATEGORY,
      silentPublish: true,
      sourceNoteId: sourceNoteId,
    };
    setActiveWorkout(workoutWithOrg);
    setIsEditingNewDraft(true);
    navigateTo(Page.SimpleWorkoutBuilder);
  };

  const handleOpenWorkoutById = async (workoutId: string) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) {
      // Ingen tyst reserv. Har passet raderats sedan anteckningen länkades ska
      // coachen få veta det, inte mötas av en knapp som inte gör något.
      await confirm({
        title: "Passet finns inte längre",
        message: "Passet som skapades från den här anteckningen har tagits bort.",
        confirmText: "OK"
      });
      return;
    }
    // Öppna i den förenklade byggaren, samma som passet skapades i. Presentationsvyn
    // går bara att titta i, och då måste coachen bygga om passet för att rätta ett
    // fel. handleEditWorkout duger inte — den skickar en coach utanför studioläget
    // till den stora byggaren, som inte fungerar i mobilen.
    setActiveWorkout(workout);
    setFocusedBlockId(null);
    setIsEditingNewDraft(false);
    navigateTo(Page.SimpleWorkoutBuilder);
  };

  return {
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
    handleOpenWorkoutById,
  };
}
