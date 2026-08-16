
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getMemberLogs, getVisibleWorkoutsForMembers, getWorkoutById, saveWorkoutLog, updateWorkoutLog, getOrganizationExerciseBank, getMemberCustomExercises, addMemberCustomExercise, deleteMemberCustomExercise, updateMemberCustomExercise, listenToPersonalBests } from '../../services/firebaseService';
import { generateWorkoutDiploma } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext'; 
import { CloseIcon, InformationCircleIcon, PlusIcon, TrashIcon, CalculatorIcon } from '../../components/icons'; 
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { calculate1RM, findDuplicateBankExercise, canonicalizeExerciseName, getBlockProfile, getBlockPlanParts, TrainingProfile, getTargetWeightForExercise } from '../../utils/workoutUtils';
import { playTimerSound } from '../../hooks/useWorkoutTimer';
import { DuplicateExerciseModal } from '../../components/DuplicateExerciseModal';
import { ExerciseResult, WorkoutDiploma, WorkoutLog, BankExercise, Workout, PersonalBest, TimerMode } from '../../types';
import { MOCK_EXERCISE_BANK } from '../../data/mockData';
import { saveCustomProgram, fetchCustomPrograms } from '../../services/firebaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { Confetti } from '../../components/WorkoutCompleteModal';
import { useStudio } from '../../context/StudioContext';
import { BlockGroup, LocalSetDetail, LastPerformanceRecord, LocalExerciseResult, LogData, WorkoutData } from './workout-log/types';
import { ACTIVE_LOG_STORAGE_KEY, ChevronDownIcon, extractPerformanceFromLogEx, TimeInput, getRandomDiplomaTitle, getFunComparison, isExerciseMatch, GROUP_COLORS, cleanForFirestore } from './workout-log/utils';
import { CustomActivityForm } from './workout-log/CustomActivityForm';
import { PostWorkoutForm } from './workout-log/PostWorkoutForm';
import { OneRMCalculatorModal } from './workout-log/OneRMCalculatorModal';
import { PreGameView } from './workout-log/PreGameView';
import { ExerciseLogCard } from './workout-log/ExerciseLogCard';

// Ett set är tomt när inget av de loggbara fälten har ett värde. rir räknas inte —
// det är en kvalificering av ett resultat, inte ett resultat i sig.
const isSetEmpty = (s: { weight?: any; reps?: any; time?: any; distance?: any; kcal?: any }) => {
    const has = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';
    return !has(s.weight) && !has(s.reps) && !has(s.time) && !has(s.distance) && !has(s.kcal);
};

export const WorkoutLogScreen = ({ workoutId, organizationId, source, onClose, navigation, route, workouts: contextWorkouts = [] }: any) => {
  const { currentUser, userData } = useAuth();
  const { selectedOrganization, studioConfig } = useStudio();
  const isSummerThemeActive = useMemo(() => {
    return !!(studioConfig?.enableSummerChallenge || selectedOrganization?.globalConfig?.enableSummerChallenge);
  }, [studioConfig?.enableSummerChallenge, selectedOrganization?.globalConfig?.enableSummerChallenge]);

  const [globalChallenge, setGlobalChallenge] = useState<any>(null);

  useEffect(() => {
    if (!isSummerThemeActive) return;
    let unsubChallenge = () => {};
    import('../../services/firebaseService').then(({ listenToGlobalSummerChallenge }) => {
      unsubChallenge = listenToGlobalSummerChallenge((data) => {
        setGlobalChallenge(data);
      });
    });
    return () => unsubChallenge();
  }, [isSummerThemeActive]);

  const configToUse = useMemo(() => {
    const base = !selectedOrganization ? (studioConfig || {}) : {
        ...(selectedOrganization || {}),
        ...(selectedOrganization.globalConfig || {}),
        ...(studioConfig || {})
    };
    if (globalChallenge) {
        return {
            ...base,
            summerChallengeStartDate: globalChallenge.startDate,
            summerChallengeEndDate: globalChallenge.endDate,
            id: globalChallenge.id || 'default'
        } as any;
    }
    return base as any;
  }, [studioConfig, selectedOrganization, globalChallenge]);

  const activeChallengeId = useMemo(() => {
    if (!configToUse) return 'default';
    if (configToUse.summerChallengeStartDate && configToUse.summerChallengeEndDate) {
        return `summer_${configToUse.summerChallengeStartDate}_${configToUse.summerChallengeEndDate}`;
    }
    return configToUse.id || 'default';
  }, [configToUse]);

  const isSummerChallengeOn = useMemo(() => {
    if (!isSummerThemeActive) return false;
    if (!userData?.joinedSummerChallenge || userData?.joinedChallengeId !== activeChallengeId) return false;
    
    // Kontrollera om utmaningen faktiskt är aktiv just nu baserat på datumen
    const now = Date.now();
    const startDate = configToUse?.summerChallengeStartDate;
    const endDate = configToUse?.summerChallengeEndDate;
    if (startDate && now < startDate) return false;
    if (endDate && now > endDate) return false;
    
    return true;
  }, [isSummerThemeActive, userData?.joinedSummerChallenge, userData?.joinedChallengeId, activeChallengeId, configToUse]);
  const userId = currentUser?.uid || "offline_member_uid"; 
  const passedWId = workoutId || route?.params?.workoutId;
  const isManualMode = passedWId === 'MANUAL_ENTRY';
  const wId = isManualMode ? undefined : passedWId;
  const oId = organizationId || route?.params?.organizationId;
  const finalOrgId = oId || selectedOrganization?.id;

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [exerciseResults, setExerciseResults] = useState<LocalExerciseResult[]>([]);
  const [logData, setLogData] = useState<LogData>({ rpe: null, feeling: null, tags: [], comment: '', imageUrl: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  
  const getLocalDateString = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [logDate, setLogDate] = useState(getLocalDateString(new Date()));
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [viewMode, setViewMode] = useState<'pre-game' | 'logging'>(isManualMode ? 'logging' : 'pre-game');
  const [sessionMode, setSessionMode] = useState<'normal' | 'fatigued'>('normal');
  const [sessionPctMap, setSessionPctMap] = useState<Record<string, number | null>>({});
  const [sessionPctByBlock, setSessionPctByBlock] = useState<Record<string, number | null>>({});
  const [customActivity, setCustomActivity] = useState({ name: '', duration: '', distance: '', calories: '' });

  const blockProfilesMap = useMemo(() => {
      if (!workout || !workout.blocks) return {};
      const map: Record<string, TrainingProfile | null> = {};
      workout.blocks.forEach(block => {
          if (block.id) {
              map[block.id] = getBlockProfile(block as any);
          }
      });
      return map;
  }, [workout]);

  const blockTagsMap = useMemo(() => {
      if (!workout || !workout.blocks) return {};
      const map: Record<string, string> = {};
      workout.blocks.forEach(block => {
          if (block.id) {
              map[block.id] = (block.tag || '').trim();
          }
      });
      return map;
  }, [workout]);

  const preGameBlocks = useMemo(() => {
      if (!workout?.blocks) return [];
      return workout.blocks
          .map(b => ({
              blockId: b.id,
              title: b.title,
              planPct: blockProfilesMap[b.id]?.targetPct || 0,
              hasWeightMath: blockProfilesMap[b.id]?.hasWeightMath !== false,
          }))
          .filter(b => b.hasWeightMath && b.planPct > 0);
  }, [workout, blockProfilesMap]);

  const canEditTrackingFields = useMemo(() => {
      if (isManualMode) return true;
      const id = workout?.id || wId;
      return !!(id && typeof id === 'string' && id.startsWith('custom-'));
  }, [isManualMode, workout, wId]);

  const handleSelectSessionPct = (exerciseName: string, pct: number | null) => {
      const canonKey = canonicalizeExerciseName(exerciseName);
      setSessionPctMap(prev => ({
          ...prev,
          [canonKey]: pct
      }));
  };
  const [sessionStats, setSessionStats] = useState({ distance: '', calories: '', time: '', rounds: '' });
  const [activeSummaryFields, setActiveSummaryFields] = useState<string[]>([]);
  const [showSummaryMoreFields, setShowSummaryMoreFields] = useState(false);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [saveAsProgram, setSaveAsProgram] = useState(false);
  const [programName, setProgramName] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // --- Rest Timer State & Controls ---
  // Avstängningen gäller det pågående passet, inte för alltid. Skälen att stänga av
  // är nästan alltid situationsbundna — bråttom, samsas om en stång, fullt på gymmet.
  // Läget följer med i utkastet nedan, så det överlever omladdning av SAMMA pass men
  // återgår till på nästa gång. Vilka block timern faktiskt startar i avgörs av
  // blockets kategori i ExerciseLogCard, inte här.
  const [restTimerEnabled, setRestTimerEnabled] = useState<boolean>(true);

  const toggleRestTimer = () => {
    setRestTimerEnabled(prev => !prev);
  };

  const [restTimer, setRestTimer] = useState<{
    endTime: number;
    totalSeconds: number;
    status: 'running' | 'completed';
  } | null>(null);

  const [remainingRestSeconds, setRemainingRestSeconds] = useState<number>(0);
  const restWakeLockSentinelRef = useRef<any>(null);

  const exerciseResultsRef = useRef<LocalExerciseResult[]>([]);
  useEffect(() => { exerciseResultsRef.current = exerciseResults; }, [exerciseResults]);

  const startRestTimer = useCallback((seconds: number, groupId: string | null = null, setIndex: number = -1, exerciseId: string = '') => {
    if (!restTimerEnabled || seconds <= 0) return;

    // I ett superset ska timern starta först när sista övningen i gruppen loggats
    // för det här varvet. Den anropande övningens eget set räknas som klart: dess
    // setState har inte hunnit slå igenom när den här callbacken körs, så vi
    // utesluter den ur kontrollen i stället för att läsa ett inaktuellt värde.
    if (groupId && setIndex >= 0) {
      const others = exerciseResultsRef.current.filter(
        e => e.groupId === groupId && e.exerciseId !== exerciseId && !e.skipped
      );
      const allDone = others.every(e => {
        const s = e.setDetails[setIndex];
        if (!s) return true;
        return s.completed;
      });
      if (!allDone) return;
    }

    const endTime = Date.now() + seconds * 1000;
    setRestTimer({
      endTime,
      totalSeconds: seconds,
      status: 'running'
    });
    setRemainingRestSeconds(seconds);
  }, [restTimerEnabled]);

  const handleAdd30Seconds = useCallback(() => {
    setRestTimer(prev => {
      if (!prev) return null;
      const newEndTime = prev.endTime + 30000;
      return {
        ...prev,
        endTime: newEndTime,
        status: 'running'
      };
    });
  }, []);

  const handleSkipRestTimer = useCallback(() => {
    setRestTimer(null);
  }, []);

  // Timer Tick & Visibility Effect
  useEffect(() => {
    if (!restTimer || restTimer.status !== 'running') return;

    const checkTimer = () => {
      const now = Date.now();
      const diffMs = restTimer.endTime - now;
      const remaining = Math.max(0, Math.ceil(diffMs / 1000));
      setRemainingRestSeconds(remaining);

      if (remaining <= 0) {
        setRestTimer(prev => prev ? { ...prev, status: 'completed' } : null);

        try {
          playTimerSound((studioConfig?.soundProfile as any) || 'boxing', 1);
        } catch (e) {
          console.error('Error playing rest timer sound:', e);
        }

        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
        } catch (e) {
          console.error('Error vibrating:', e);
        }
      }
    };

    checkTimer();
    const intervalId = setInterval(checkTimer, 500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [restTimer, studioConfig?.soundProfile]);

  // Auto-hide when completed after 5 seconds
  useEffect(() => {
    if (restTimer && restTimer.status === 'completed') {
      const timeoutId = setTimeout(() => {
        setRestTimer(null);
      }, 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [restTimer]);

  // WakeLock while timer is running
  useEffect(() => {
    let isMounted = true;
    const requestWakeLock = async () => {
      if (restTimer && restTimer.status === 'running' && 'wakeLock' in navigator) {
        try {
          if (!restWakeLockSentinelRef.current) {
            const wl = await (navigator as any).wakeLock.request('screen');
            if (isMounted) {
              restWakeLockSentinelRef.current = wl;
              wl.addEventListener('release', () => {
                restWakeLockSentinelRef.current = null;
              });
            } else {
              wl.release();
            }
          }
        } catch (err) {
          console.error('WakeLock error in rest timer:', err);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (restWakeLockSentinelRef.current) {
        try {
          await restWakeLockSentinelRef.current.release();
        } catch (err) {
          console.error('WakeLock release error:', err);
        }
        restWakeLockSentinelRef.current = null;
      }
    };

    if (restTimer && restTimer.status === 'running') {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      isMounted = false;
      releaseWakeLock();
    };
  }, [restTimer]);
  
  const scanSource = source || route?.params?.source;
  const [inStudio, setInStudio] = useState<boolean | null>(scanSource === 'qr_scan' ? true : null);
  const [workoutLoadFailed, setWorkoutLoadFailed] = useState(false);

  const [history, setHistory] = useState<Record<string, LastPerformanceRecord>>({}); 
  const [personalBests, setPersonalBests] = useState<Record<string, PersonalBest>>({});

  useEffect(() => {
      if (!userId) return;
      try {
          const unsubscribe = listenToPersonalBests(
              userId,
              (data) => {
                  const pbMap: Record<string, PersonalBest> = {};
                  data.forEach(pb => {
                      if (pb && pb.exerciseName) {
                          const canonicalKey = canonicalizeExerciseName(pb.exerciseName);
                          const rawKey = pb.exerciseName.toLowerCase().trim();
                          const existing = pbMap[canonicalKey];

                          const pb1RM = (typeof pb.calculated1RM === 'number' && pb.calculated1RM > 0)
                              ? pb.calculated1RM
                              : (calculate1RM(pb.weight, pb.reps) || pb.weight || 0);

                          if (!existing) {
                              pbMap[canonicalKey] = pb;
                              pbMap[rawKey] = pb;
                          } else {
                              const existing1RM = (typeof existing.calculated1RM === 'number' && existing.calculated1RM > 0)
                                  ? existing.calculated1RM
                                  : (calculate1RM(existing.weight, existing.reps) || existing.weight || 0);

                              if (pb1RM > existing1RM) {
                                  pbMap[canonicalKey] = pb;
                                  pbMap[rawKey] = pb;
                              }
                          }
                      }
                  });
                  setPersonalBests(pbMap);
              },
              (err) => {
                  console.error("listenToPersonalBests subscription error in WorkoutLogScreen", err);
              }
          );
          return () => unsubscribe();
      } catch (e) {
          console.error("Failed to register listenToPersonalBests in WorkoutLogScreen", e);
      }
  }, [userId]);

  const [exerciseBank, setExerciseBank] = useState<BankExercise[]>(MOCK_EXERCISE_BANK);
  
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorContext, setCalculatorContext] = useState<{
    exerciseName?: string,
    current1RM?: number,
    activeTargetPct?: number | null,
    activePctSource?: 'coach' | 'session' | 'none',
    onSelectTargetPct?: (pct: number | null) => void,
    onSelectWeight?: (w: number) => void
  } | null>(null);
  const [exerciseToEdit, setExerciseToEdit] = useState<BankExercise | null>(null);
  const [editExerciseName, setEditExerciseName] = useState("");
  const [exerciseToDelete, setExerciseToDelete] = useState<BankExercise | null>(null);
  
  // Bara set med värden kan vara "kvar att bocka av". Överhoppade övningar räknas
  // aldrig, oavsett vad som står i deras fält.
  const uncheckedSetsCount = useMemo(() => {
      if (isManualMode) return 0;
      return exerciseResults.filter(ex => !ex.skipped).reduce((acc, ex) => acc + ex.setDetails.filter(s => !s.completed && !isSetEmpty(s)).length, 0);
  }, [isManualMode, exerciseResults]);

  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [expandedSubGroupId, setExpandedSubGroupId] = useState<string | null>(null);
  const hasAutoOpenedSubGroupRef = useRef(false);
  const autoAdvancedSubGroupsRef = useRef<Set<string>>(new Set());

  // Håller exakt ett superset öppet: det man håller på med. När ett superset blir
  // helt klart fälls det ihop och nästa ofärdiga öppnas, en gång per grupp. Stänger
  // medlemmen allt manuellt respekteras det och vi öppnar inget igen.
  useEffect(() => {
      const groups = new Map<string, typeof exerciseResults>();
      exerciseResults.forEach(r => {
          if (!r.groupId) return;
          const arr = groups.get(r.groupId) || [];
          arr.push(r);
          groups.set(r.groupId, arr);
      });
      if (groups.size === 0) return;

      // En grupp räknas som klar när VARJE övning har minst ett avbockat set och
      // inget ifyllt set lämnats obockat. Tomma set får finnas — man kan hoppa över
      // ett avslutande set. Men enbart tomma set betyder att övningen inte är gjord,
      // annars vore en orörd grupp "klar" direkt och skulle aldrig öppnas.
      const isGroupDone = (list: typeof exerciseResults) => {
          const active = list.filter(e => !e.skipped);
          if (active.length === 0) return true;
          return active.every(e =>
              e.setDetails.some(s => s.completed) &&
              e.setDetails.every(s => s.completed || isSetEmpty(s))
          );
      };

      const order = Array.from(groups.keys());
      const firstUnfinished = order.find(id => !isGroupDone(groups.get(id)!)) || null;

      setExpandedSubGroupId(prev => {
          if (prev === null) {
              if (hasAutoOpenedSubGroupRef.current) return null;
              hasAutoOpenedSubGroupRef.current = true;
              return firstUnfinished;
          }
          const current = groups.get(prev);
          if (!current) return firstUnfinished;
          if (!isGroupDone(current)) return prev;
          if (autoAdvancedSubGroupsRef.current.has(prev)) return prev;
          autoAdvancedSubGroupsRef.current.add(prev);
          return firstUnfinished;
      });
  }, [exerciseResults]);
  const [logStep, setLogStep] = useState<'exercises' | 'summary'>('exercises');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasAutoExpandedRef = useRef(false);

  const blockGroups = useMemo(() => {
      const groups: BlockGroup[] = [];
      exerciseResults.forEach((result, index) => {
          const bId = result.blockId || 'default-manual';
          const bTitle = result.blockTitle || 'Övningar';
          let group = groups.find(g => g.blockId === bId);
          if (!group) {
              group = {
                  blockId: bId,
                  blockTitle: bTitle,
                  exercises: []
              };
              groups.push(group);
          }
          group.exercises.push({ result, originalIndex: index });
      });
      return groups;
  }, [exerciseResults]);

  useEffect(() => {
      if (hasAutoExpandedRef.current) return;
      if (viewMode !== 'logging') return;
      if (blockGroups.length === 0) return;
      const firstUnfinished = blockGroups.find(g =>
          g.exercises.some(e => e.result.setDetails.some(s => !s.completed))
      ) || blockGroups[0];
      if (firstUnfinished) {
          setExpandedBlockId(firstUnfinished.blockId);
          hasAutoExpandedRef.current = true;
      }
  }, [blockGroups, viewMode]);

  const getBlockCompletionInfo = (group: BlockGroup) => {
      let totalSets = 0;
      let completedSets = 0;
      group.exercises.forEach(ex => {
          totalSets += ex.result.setDetails.length;
          completedSets += ex.result.setDetails.filter(s => s.completed).length;
      });
      return { totalSets, completedSets };
  };

  // --- BENCHMARK LOGIC ---
  const benchmarkDefinition = useMemo(() => {
      if (!workout?.benchmarkId || !selectedOrganization?.benchmarkDefinitions) return null;
      return selectedOrganization.benchmarkDefinitions.find(b => b.id === workout.benchmarkId);
  }, [workout?.benchmarkId, selectedOrganization?.benchmarkDefinitions]);

  const prevBenchmarkBest = useMemo(() => {
      if (!benchmarkDefinition || !allLogs) return undefined;
      const relevantLogs = allLogs.filter(l => l.benchmarkId === benchmarkDefinition.id && l.benchmarkValue !== undefined);
      if (relevantLogs.length === 0) return undefined;

      const sorted = relevantLogs.sort((a, b) => {
          if (benchmarkDefinition.type === 'time') return (a.benchmarkValue || 0) - (b.benchmarkValue || 0);
          return (b.benchmarkValue || 0) - (a.benchmarkValue || 0);
      });
      return sorted[0]?.benchmarkValue;
  }, [benchmarkDefinition, allLogs]);

  const formatPrev = (val: number, type: string) => {
      if (type === 'time') {
          const m = Math.floor(val / 60);
          const s = val % 60;
          return `${m}:${s.toString().padStart(2, '0')}`;
      }
      return val.toString();
  };

  const getValidationErrors = () => {
      const errors: string[] = [];
      if (inStudio === null) {
          errors.push("Välj var passet genomfördes — knapparna finns ovanför felrutan.");
      }
      if (isManualMode) {
          if (exerciseResults.length === 0) {
              if (customActivity.name.trim().length === 0) {
                  errors.push("Aktivitetens namn saknas. Ange vad du har tränat (t.ex. Powerwalk).");
              }
              if (customActivity.duration.trim().length === 0 || customActivity.duration.trim() === '0' || customActivity.duration.trim() === '00:00') {
                  errors.push("Tid saknas. Fyll i hur länge du har tränat.");
              }
          }
          if (saveAsProgram && programName.trim().length === 0) {
              errors.push("Programnamn saknas. Du måste namnge ditt program.");
          }
      } else {
          const setsToSave = exerciseResults.filter(ex => !ex.skipped).reduce((acc, ex) => acc + ex.setDetails.filter(s => s.completed || !isSetEmpty(s)).length, 0);
          if (setsToSave === 0) {
              errors.push("Inga övningar är loggade än. Fyll i minst en övning eller bocka av den du gjort.");
          } else if (uncheckedSetsCount > 0) {
              errors.push(`Du har ${uncheckedSetsCount} ifyllda set som inte är avbockade. Bocka av dem, eller markera övningen som överhoppad.`);
          }
          if (benchmarkDefinition) {
              if (benchmarkDefinition.type === 'time' && !sessionStats.time) {
                  errors.push("Tid för benchmark-övning saknas.");
              }
              if (benchmarkDefinition.type === 'reps' && !sessionStats.rounds) {
                  errors.push("Siffror för benchmark-reps/varv saknas.");
              }
          }
      }
      return errors;
  };

  const isFormValid = useMemo(() => {
      if (isSubmitting) return false;
      return getValidationErrors().length === 0;
  }, [isSubmitting, isManualMode, customActivity, exerciseResults, uncheckedSetsCount, benchmarkDefinition, sessionStats, saveAsProgram, programName, inStudio]);
  
  // --- WAKE LOCK LOGIC ---
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        console.warn(`Wake Lock not allowed: ${err.name}, ${err.message}`);
      } else {
        console.warn(`Wake Lock error: ${err?.name}, ${err?.message}`);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.error('Failed to release Wake Lock', err);
      }
    }
  };

  useEffect(() => {
    if (viewMode === 'logging') {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && viewMode === 'logging') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [viewMode]);

  // --- LOAD INITIAL DATA ---
  useEffect(() => {
    if (!finalOrgId) { setLoading(false); return; }
    if (!isManualMode && !wId) { setLoading(false); return; }
    if (!isManualMode && workout?.id === wId) return; // Already initialized for this workout

    const init = async () => {
        // Reset state for new workout
        setViewMode(isManualMode ? 'logging' : 'pre-game');
        setLogStep('exercises');
        setSessionPctMap({});
        setSessionPctByBlock({});
        setWorkoutLoadFailed(false);
        
        try {
            let foundWorkout: any = null;

            if (!isManualMode) {
                const orgWorkouts = await getVisibleWorkoutsForMembers(finalOrgId);
                foundWorkout = orgWorkouts.find(w => w.id === wId);
                
                if (!foundWorkout) {
                     foundWorkout = contextWorkouts.find((w: any) => w.id === wId);
                }

                if (!foundWorkout && wId && wId.startsWith('custom-')) {
                     const customPrograms = await fetchCustomPrograms(userId);
                     foundWorkout = customPrograms.find(w => w.id === wId);
                }

                if (!foundWorkout && wId) {
                    // QR-koden är behörigheten. Listfrågan filtrerar bort utkast, men
                    // ett pass man skannat vid skärmen ska gå att logga — annars kan
                    // en medlem inte logga sin egen justering av dagens pass.
                    // firestore.rules tillåter läsning per id inom organisationen.
                    const direct = await getWorkoutById(wId);
                    if (direct && direct.organizationId === finalOrgId) {
                        foundWorkout = direct;
                    }
                }

                if (!foundWorkout && wId) {
                    // Ingen tyst reserv. Utan detta renderas en tom loggningsvy med
                    // reservtiteln "Träningspass" och en osann förklaring om att
                    // inga övningar är markerade.
                    console.error("Passet kunde inte hämtas", wId);
                    setWorkoutLoadFailed(true);
                }
            }
            
            // Fetch stuff independently of workout
            const logs = await getMemberLogs(userId);
            setAllLogs(logs);

            const bank = await getOrganizationExerciseBank(finalOrgId);
            const userCustomExercises = await getMemberCustomExercises(userId);
            setExerciseBank([...bank, ...userCustomExercises].sort((a, b) => a.name.localeCompare(b.name, 'sv')));

            const savedSessionRaw = localStorage.getItem(ACTIVE_LOG_STORAGE_KEY);
            let loadedResults: LocalExerciseResult[] | null = null;
            let loadedLogData: LogData | null = null;
            let loadedSessionStats: any = null;
            let loadedCustomActivity: any = null;
            let skipInsights = false;

            if (savedSessionRaw) {
                const saved = JSON.parse(savedSessionRaw);
                if (saved.workoutId === (wId || 'manual') && saved.memberId === userId) {
                    loadedResults = saved.exerciseResults;
                    loadedLogData = saved.logData;
                    loadedSessionStats = saved.sessionStats;
                    loadedCustomActivity = saved.customActivity;
                    if (typeof saved.restTimerEnabled === 'boolean') setRestTimerEnabled(saved.restTimerEnabled);
                    setViewMode('logging');
                    skipInsights = true;
                }
            }

            if (foundWorkout) {
                setWorkout(foundWorkout as unknown as WorkoutData);

                const exercises: LocalExerciseResult[] = [];

                foundWorkout.blocks.forEach(block => {
                    if (block.tag === 'Uppvärmning') return;
                    const defaultSets: LocalSetDetail[] = [{ weight: '', reps: '', time: '', distance: '', kcal: '', completed: false }];

                    block.exercises.forEach(ex => {
                        if (ex.loggingEnabled === true) {
                            const savedRes = loadedResults?.find(lr => lr.exerciseId === ex.id);
                            if (savedRes) {
                                exercises.push({
                                    ...savedRes,
                                    originalBankId: savedRes.originalBankId ?? ex.originalBankId ?? null
                                });
                            } else {
                                exercises.push({
                                    exerciseId: ex.id,
                                    exerciseName: ex.name,
                                    setDetails: [...defaultSets],
                                    blockId: block.id,
                                    blockTitle: block.title,
                                    trackingFields: ex.trackingFields,
                                    groupId: ex.groupId,
                                    groupColor: ex.groupColor,
                                    originalBankId: ex.originalBankId ?? null
                                });
                            }
                        }
                    });
                });
                
                const defaultDuration = foundWorkout.durationMinutes ? String(foundWorkout.durationMinutes) : ((foundWorkout as any).duration ? String((foundWorkout as any).duration) : '');
                
                setExerciseResults(exercises);
                if (loadedLogData) setLogData(loadedLogData);
                if (loadedSessionStats) {
                    setSessionStats({
                        distance: loadedSessionStats.distance || '',
                        calories: loadedSessionStats.calories || '',
                        time: (loadedSessionStats.time && loadedSessionStats.time.trim() !== '' && loadedSessionStats.time !== '0') ? loadedSessionStats.time : defaultDuration,
                        rounds: loadedSessionStats.rounds || ''
                    });
                } else {
                    setSessionStats({
                        distance: '',
                        calories: '',
                        time: defaultDuration,
                        rounds: ''
                    });
                }
                if (loadedCustomActivity) setCustomActivity(loadedCustomActivity);

                const historyMap: Record<string, LastPerformanceRecord> = {};
                
                exercises.forEach(currentEx => {
                    const hasRealPerformance = (logEx: any) => {
                        if (logEx.setDetails && logEx.setDetails.length > 0) {
                            return logEx.setDetails.some((s: any) => 
                                (parseFloat(String(s.weight)) || 0) > 0 || 
                                (parseFloat(String(s.reps)) || 0) > 0 ||
                                (parseFloat(String(s.time)) || 0) > 0 ||
                                (parseFloat(String(s.distance)) || 0) > 0 ||
                                (parseFloat(String(s.kcal || s.calories)) || 0) > 0
                            );
                        }
                        return (parseFloat(String(logEx.weight)) || 0) > 0 || 
                               (parseFloat(String(logEx.reps)) || 0) > 0 ||
                               (parseFloat(String(logEx.time)) || 0) > 0 ||
                               (parseFloat(String(logEx.distance)) || 0) > 0 ||
                               (parseFloat(String(logEx.calories || logEx.kcal)) || 0) > 0;
                    };

                    let match = logs.find(log => 
                        log.exerciseResults?.some(logEx => 
                            isExerciseMatch(currentEx.exerciseName, currentEx.exerciseId, logEx.exerciseName, logEx.exerciseId) &&
                            hasRealPerformance(logEx)
                        )
                    );
                    
                    if (!match) {
                        match = logs.find(log => 
                            log.exerciseResults?.some(logEx => 
                                isExerciseMatch(currentEx.exerciseName, currentEx.exerciseId, logEx.exerciseName, logEx.exerciseId)
                            )
                        );
                    }
                    
                    let mostRecentNote: string | undefined = undefined;
                    const logWithNote = logs.find(log => log.exerciseResults?.some(logEx => isExerciseMatch(currentEx.exerciseName, currentEx.exerciseId, logEx.exerciseName, logEx.exerciseId) && logEx.note));
                    if (logWithNote) {
                        const exWithNote = logWithNote.exerciseResults?.find(logEx => isExerciseMatch(currentEx.exerciseName, currentEx.exerciseId, logEx.exerciseName, logEx.exerciseId) && logEx.note);
                        if (exWithNote) mostRecentNote = exWithNote.note;
                    }

                    if (match) {
                        const exMatch = match.exerciseResults?.find(logEx => isExerciseMatch(currentEx.exerciseName, currentEx.exerciseId, logEx.exerciseName, logEx.exerciseId));
                        if (exMatch) {
                            historyMap[currentEx.exerciseName] = extractPerformanceFromLogEx(exMatch, mostRecentNote);
                        }
                    }
                });
                
                setHistory(historyMap);

                if (!skipInsights) {
                    const isCustomWorkout = foundWorkout.id?.startsWith('custom-') || false;
                    const preGameDisabledByGlobalSetting = isCustomWorkout && userData?.usePreGameForCustomWorkouts === false;
                    const hasPreviousLogsForWorkout = logs.some(log => log.workoutId === wId);
                    
                    if (foundWorkout.usePreGame === false || preGameDisabledByGlobalSetting || !hasPreviousLogsForWorkout) {
                        setViewMode('logging');
                    } else {
                        const exerciseNames = exercises.map(e => e.exerciseName);
                        if (exerciseNames.length === 0) {
                            setViewMode('logging');
                        }
                    }
                }
            } else {
                 if (loadedResults) setExerciseResults(loadedResults);
                 if (loadedLogData) setLogData(loadedLogData);
                 if (loadedSessionStats) {
                     setSessionStats({
                         distance: loadedSessionStats.distance || '',
                         calories: loadedSessionStats.calories || '',
                         time: loadedSessionStats.time || '',
                         rounds: loadedSessionStats.rounds || ''
                     });
                 }
                 if (loadedCustomActivity) setCustomActivity(loadedCustomActivity);
                 
                 // Compute history for loaded manual mode results
                 if (loadedResults) {
                     const historyMap: Record<string, LastPerformanceRecord> = {};
                     loadedResults.forEach(currentEx => {
                         const hasRealPerformance = (logEx: any) => {
							if (logEx.setDetails && logEx.setDetails.length > 0) {
								return logEx.setDetails.some((s: any) => 
                                    (parseFloat(String(s.weight)) || 0) > 0 || 
                                    (parseFloat(String(s.reps)) || 0) > 0 ||
                                    (parseFloat(String(s.time)) || 0) > 0 ||
                                    (parseFloat(String(s.distance)) || 0) > 0 ||
                                    (parseFloat(String(s.kcal || s.calories)) || 0) > 0
                                );
							}
							return (parseFloat(String(logEx.weight)) || 0) > 0 || 
                                   (parseFloat(String(logEx.reps)) || 0) > 0 ||
                                   (parseFloat(String(logEx.time)) || 0) > 0 ||
                                   (parseFloat(String(logEx.distance)) || 0) > 0 ||
                                   (parseFloat(String(logEx.calories || logEx.kcal)) || 0) > 0;
						};

						let match = logs.find(log => 
							log.exerciseResults?.some(logEx => 
								logEx.exerciseName.toLowerCase() === currentEx.exerciseName.toLowerCase() &&
								hasRealPerformance(logEx)
							)
						);

						if (!match) {
							match = logs.find(log => 
								log.exerciseResults?.some(logEx => 
									logEx.exerciseName.toLowerCase() === currentEx.exerciseName.toLowerCase()
								)
							);
						}

                         let mostRecentNote: string | undefined = undefined;
                         const logWithNote = logs.find(log => log.exerciseResults?.some(logEx => logEx.exerciseName.toLowerCase() === currentEx.exerciseName.toLowerCase() && logEx.note));
                         if (logWithNote) {
                             const exWithNote = logWithNote.exerciseResults?.find(logEx => logEx.exerciseName.toLowerCase() === currentEx.exerciseName.toLowerCase() && logEx.note);
                             if (exWithNote) mostRecentNote = exWithNote.note;
                         }

                         if (match) {
                             const exMatch = match.exerciseResults?.find(logEx => logEx.exerciseName.toLowerCase() === currentEx.exerciseName.toLowerCase());
                             if (exMatch) {
                                 historyMap[currentEx.exerciseName] = extractPerformanceFromLogEx(exMatch, mostRecentNote);
                             }
                         }
                     });
                     setHistory(historyMap);
                 }
            }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };
    
    init();
}, [wId, finalOrgId, userId, isManualMode]);

  // --- AUTO-SAVE LOGIC ---
  useEffect(() => {
    if (loading || isSubmitting || !userId || (!wId && !isManualMode)) return;

    const sessionData = {
        workoutId: wId || 'manual',
        workoutTitle: workout?.title || 'Träningspass',
        organizationId: finalOrgId,
        memberId: userId,
        exerciseResults,
        logData,
        sessionStats,
        restTimerEnabled,
        customActivity,
        timestamp: Date.now()
    };

    localStorage.setItem(ACTIVE_LOG_STORAGE_KEY, JSON.stringify(sessionData));
  }, [exerciseResults, logData, sessionStats, restTimerEnabled, customActivity, loading, isSubmitting, userId, wId, finalOrgId, isManualMode, workout]);

  const handleCancel = (isSuccess = false, diploma: WorkoutDiploma | null = null) => {
    setSessionPctMap({});
    setSessionPctByBlock({});
    if (isSuccess) {
        localStorage.removeItem(ACTIVE_LOG_STORAGE_KEY);
    }
    if (onClose) onClose(isSuccess, diploma as any);
    else if (navigation) navigation.goBack();
  };

  const [duplicateWarning, setDuplicateWarning] = useState<{
      inputName: string;
      existing: BankExercise;
  } | null>(null);

  const handleAddManualExercise = async (exerciseName: string, forceCreateAnyway = false) => {
      if (!exerciseName.trim()) return;

      const duplicate = findDuplicateBankExercise(exerciseName, exerciseBank);

      if (duplicate && duplicate.name.toLowerCase().trim() === exerciseName.trim().toLowerCase()) {
          forceCreateAnyway = false;
          exerciseName = duplicate.name;
      } else if (duplicate && !forceCreateAnyway) {
          setDuplicateWarning({
              inputName: exerciseName,
              existing: duplicate
          });
          return;
      }

      const existingInBank = exerciseBank.find(ex => ex.name.toLowerCase() === exerciseName.trim().toLowerCase());
      let newExerciseId = 'manual-' + Date.now();
      let bankId: string | null = null;
      let finalName = exerciseName.trim();
      
      if (!existingInBank && userId) {
          try {
              const savedEx = await addMemberCustomExercise(userId, finalName);
              setExerciseBank(prev => [...prev, savedEx].sort((a, b) => a.name.localeCompare(b.name, 'sv')));
              newExerciseId = savedEx.id;
              bankId = savedEx.id;
          } catch (e) {
              console.error("Failed to add custom exercise", e);
          }
      } else if (existingInBank) {
          newExerciseId = existingInBank.id;
          bankId = existingInBank.id;
          finalName = existingInBank.name;
      }

      const newEx: LocalExerciseResult = {
          exerciseId: newExerciseId,
          exerciseName: finalName,
          blockId: 'manual-block',
          blockTitle: 'Valda övningar',
          trackingFields: ['weight', 'reps'],
          setDetails: [{ weight: '', reps: '', completed: false }],
          originalBankId: bankId
      };

      const match = allLogs.find(log => log.exerciseResults?.some(logEx => logEx.exerciseName.toLowerCase() === exerciseName.trim().toLowerCase()));
      
      let mostRecentNote: string | undefined = undefined;
      const logWithNote = allLogs.find(log => log.exerciseResults?.some(logEx => logEx.exerciseName.toLowerCase() === exerciseName.trim().toLowerCase() && logEx.note));
      if (logWithNote) {
          const exWithNote = logWithNote.exerciseResults?.find(logEx => logEx.exerciseName.toLowerCase() === exerciseName.trim().toLowerCase() && logEx.note);
          if (exWithNote) mostRecentNote = exWithNote.note;
      }

      if (match) {
          const exMatch = match.exerciseResults?.find(logEx => logEx.exerciseName.toLowerCase() === exerciseName.trim().toLowerCase());
          if (exMatch) {
              const perfRecord = extractPerformanceFromLogEx(exMatch, mostRecentNote);
              setHistory(prev => ({
                  ...prev,
                  [exerciseName.trim()]: perfRecord
              }));
          }
      }

      setExerciseResults(prev => [...prev, newEx]);
      setShowExerciseSearch(false);
      setExerciseSearchTerm('');
  };

  const filteredBank = exerciseBank.filter(ex => ex.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()));

  const handleCustomActivityUpdate = (field: string, value: string) => {
    setCustomActivity(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdateResult = (index: number, updates: Partial<LocalExerciseResult>) => {
    setExerciseResults(prev => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
    });

    if (updates.trackingFields) {
        const isCustomWorkout = (wId && typeof wId === 'string' && wId.startsWith('custom-')) || 
                                (workout?.id && typeof workout.id === 'string' && workout.id.startsWith('custom-'));
        if (isCustomWorkout && userId && workout) {
            const exId = exerciseResults[index]?.exerciseId;
            if (exId) {
                const updatedWorkout = JSON.parse(JSON.stringify(workout)) as WorkoutData;
                let foundEx = false;
                if (updatedWorkout.blocks) {
                    for (const block of updatedWorkout.blocks) {
                        if (block.exercises) {
                            const ex = block.exercises.find(e => e.id === exId);
                            if (ex) {
                                (ex as any).trackingFields = updates.trackingFields;
                                foundEx = true;
                                break;
                            }
                        }
                    }
                }
                if (foundEx) {
                    setWorkout(updatedWorkout);
                    saveCustomProgram(userId, updatedWorkout as any).catch(err => {
                        console.error("Fel vid sparande av trackingFields till eget pass:", err);
                    });
                }
            }
        }
    }
  };

  const handleAddGroupSet = (groupId: string) => {
      setExerciseResults(prev => {
          return prev.map(ex => {
              if (ex.groupId === groupId) {
                  const lastSet = ex.setDetails[ex.setDetails.length - 1];
                  const newSet = lastSet ? { ...lastSet, completed: false } : { weight: '', reps: '', time: '', distance: '', kcal: '', completed: false };
                  return { ...ex, setDetails: [...ex.setDetails, newSet] };
              }
              return ex;
          });
      });
  };

  const handleStartWorkout = (mode: 'normal' | 'fatigued' = 'normal') => {
      setSessionMode(mode);
      setViewMode('logging');
  };

  const handleSubmit = async () => {
      setAttemptedSubmit(true);
      if (getValidationErrors().length > 0) {
          setTimeout(() => {
              scrollContainerRef.current?.scrollTo({ top: 400, behavior: 'smooth' });
          }, 50);
          return;
      }
      if (!finalOrgId) return;

      setIsSubmitting(true);
      setSaveStatus('Registrerar passet...');
      
      try {
          const isQuickOrManual = isManualMode;
          
          const now = new Date();
          const dateParts = logDate.split('-');
          const selectedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
          const isToday = selectedDate.toDateString() === now.toDateString();
          
          let logDateMs: number;
          if (isToday) {
              logDateMs = Date.now();
          } else {
              selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
              logDateMs = selectedDate.getTime();
          }
          
          let totalVolume = 0;
          
          const exerciseResultsToSave = exerciseResults.filter(r => !r.skipped).map(r => {
              const validWeights = r.setDetails.map(s => parseFloat(s.weight)).filter(n => !isNaN(n));
              const maxWeight = validWeights.length > 0 ? Math.max(...validWeights) : null;
              
              let totalTime = 0;
              let totalDistance = 0;
              let totalKcal = 0;

              r.setDetails.forEach(s => {
                  const weight = parseFloat(s.weight);
                  const reps = parseFloat(s.reps);
                  if (!isNaN(weight) && !isNaN(reps)) {
                      totalVolume += weight * reps;
                  }
                  if (s.time) totalTime += parseFloat(s.time) || 0;
                  if (s.distance) totalDistance += parseFloat(s.distance) || 0;
                  if (s.kcal) totalKcal += parseFloat(s.kcal) || 0;
              });

              const repsValues = r.setDetails.map(s => s.reps).filter(Boolean);
              const uniqueReps = [...new Set(repsValues)];
              const repsSummary = uniqueReps.length === 1 ? uniqueReps[0] : (uniqueReps.length > 0 ? 'Mixed' : null);

              const blockProfile = r.blockId ? blockProfilesMap[r.blockId] : undefined;
              const prescribedPct = (blockProfile && blockProfile.hasWeightMath !== false && blockProfile.targetPct !== undefined && blockProfile.targetPct > 0)
                  ? blockProfile.targetPct
                  : null;
              const canonName = canonicalizeExerciseName(r.exerciseName);
              const sessionPctForEx = sessionPctMap[canonName] ?? sessionPctMap[r.exerciseName] ?? (r.blockId ? sessionPctByBlock[r.blockId] : undefined) ?? null;
              const savedTargetInfo = getTargetWeightForExercise({
                  exerciseName: r.exerciseName,
                  personalBests,
                  history,
                  userId,
                  mode: sessionMode,
                  prescribedPct,
                  sessionPct: sessionPctForEx
              });

              return {
                  exerciseId: r.exerciseId,
                  exerciseName: r.exerciseName,
                  originalBankId: r.originalBankId ?? null,
                  trackingFields: r.trackingFields,
                  setDetails: r.setDetails.filter(s => s.completed || !isSetEmpty(s)).map(s => ({
                      weight: parseFloat(s.weight) || null,
                      reps: s.reps || null,
                      time: s.time ? parseFloat(s.time) : null,
                      distance: s.distance ? parseFloat(s.distance) : null,
                      kcal: s.kcal ? parseFloat(s.kcal) : null,
                      rir: s.rir !== undefined && s.rir !== null ? Number(s.rir) : null
                  })),
                  weight: maxWeight, 
                  reps: repsSummary, 
                  sets: r.setDetails.length,
                  time: totalTime > 0 ? totalTime : null,
                  distance: totalDistance > 0 ? totalDistance : null,
                  kcal: totalKcal > 0 ? totalKcal : null,
                  blockId: r.blockId,
                  prescribedPct: prescribedPct,
                  appliedPct: savedTargetInfo.targetPct ?? null,
                  pctSource: savedTargetInfo.pctSource,
                  estimated1RM: savedTargetInfo.current1RM ?? null,
                  coachAdvice: r.coachAdvice,
                  note: r.note
              };
          }).filter(r => r.setDetails.length > 0);

          // Poäng i sommarutmaningen (Sommar-Sisu)
          let calculatedSummerPoints = 0;
          if (inStudio === true) {
              calculatedSummerPoints = 2;
          } else {
              const durRaw = isQuickOrManual ? customActivity.duration : sessionStats.time;
              const dur = parseFloat(durRaw) || 0;
              if (dur === 0 || dur >= 30) {
                  calculatedSummerPoints = 1;
              }
          }

          const finalLogRaw: any = {
              memberId: userId,
              organizationId: finalOrgId,
              workoutId: isManualMode ? 'manual' : (wId || 'unknown'),
              workoutTitle: isQuickOrManual ? (customActivity.name || 'Eget Pass') : (workout?.title || 'Träningspass'),
              date: logDateMs,
              source: isManualMode ? 'manual' : 'qr_scan',
              rpe: logData.rpe,
              feeling: logData.feeling,
              tags: logData.tags || [],
              comment: logData.comment || '',
              imageUrl: logData.imageUrl || '',
              summerPoints: calculatedSummerPoints,
              exerciseResults: exerciseResultsToSave,
              benchmarkId: benchmarkDefinition?.id,
              totalVolume: totalVolume > 0 ? totalVolume : undefined,
              inStudio: inStudio,
              sessionMode: sessionMode,
              locationId: userData?.locationId,
          };

          finalLogRaw.durationMinutes = parseFloat(isQuickOrManual ? customActivity.duration : sessionStats.time) || 0;
          finalLogRaw.totalDistance = parseFloat(isQuickOrManual ? customActivity.distance : sessionStats.distance) || 0;
          finalLogRaw.totalCalories = parseInt(isQuickOrManual ? customActivity.calories : sessionStats.calories) || 0;
          
          const roundsValue = parseFloat(sessionStats.rounds);
          if (!isNaN(roundsValue) && roundsValue > 0) {
              finalLogRaw.rounds = roundsValue;
          }
          
          if (isQuickOrManual) {
              finalLogRaw.activityType = 'custom_activity';
              
              if (saveAsProgram && programName.trim().length > 0) {
                  const newWorkout: Workout = {
                      id: 'custom-' + Date.now(),
                      title: programName.trim(),
                      category: 'Mina sparade program',
                      isPublished: true,
                      createdAt: Date.now(),
                      organizationId: finalOrgId, // Fallback if needed, but handled by read rules
                      blocks: [{
                          id: 'manual-block',
                          title: 'Valda övningar',
                          tag: 'Custom',
                          followMe: false,
                          settings: { rounds: 1, mode: "Stoppur" as any, workTime: 0, restTime: 0, prepareTime: 0 },
                          exercises: exerciseResultsToSave.map((r: any) => ({ 
                              id: r.exerciseId, 
                              name: r.exerciseName,
                              trackingFields: r.trackingFields,
                              loggingEnabled: true 
                          }))
                      }]
                  };
                  await saveCustomProgram(userId, newWorkout);
              }
          }

          if (benchmarkDefinition && !isQuickOrManual) {
              if (benchmarkDefinition.type === 'time') {
                  finalLogRaw.benchmarkValue = (parseFloat(sessionStats.time) || 0) * 60;
              } else if (benchmarkDefinition.type === 'reps') {
                  finalLogRaw.benchmarkValue = parseFloat(sessionStats.rounds) || 0;
              } else if (benchmarkDefinition.type === 'weight') {
                  finalLogRaw.benchmarkValue = totalVolume;
              }
          }

          setSaveStatus(isQuickOrManual ? 'Sparar...' : 'Letar efter nya rekord...');
          const { log: savedLog, newRecords } = await saveWorkoutLog(cleanForFirestore(finalLogRaw));

          if (benchmarkDefinition && finalLogRaw.benchmarkValue !== undefined && !isQuickOrManual) {
                  let isBenchmarkPB = false;
                  let benchmarkDiff = 0;
                  if (prevBenchmarkBest === undefined) {
                      isBenchmarkPB = true;
                  } else {
                      if (benchmarkDefinition.type === 'time') {
                          isBenchmarkPB = finalLogRaw.benchmarkValue < prevBenchmarkBest;
                          benchmarkDiff = prevBenchmarkBest - finalLogRaw.benchmarkValue;
                      } else {
                          isBenchmarkPB = finalLogRaw.benchmarkValue > prevBenchmarkBest;
                          benchmarkDiff = finalLogRaw.benchmarkValue - prevBenchmarkBest;
                      }
                  }

                  if (isBenchmarkPB) {
                      newRecords.push({
                          exerciseName: benchmarkDefinition.title,
                          weight: benchmarkDefinition.type === 'weight' ? finalLogRaw.benchmarkValue : 0,
                          diff: benchmarkDiff,
                          reps: benchmarkDefinition.type === 'reps' ? finalLogRaw.benchmarkValue : undefined,
                      });
                  }
              }

              let diplomaData: WorkoutDiploma | null = null;

              if (benchmarkDefinition && finalLogRaw.benchmarkValue !== undefined) {
                  if (benchmarkDefinition.type === 'weight') {
                      const comparison = getFunComparison(finalLogRaw.benchmarkValue);
                      if (comparison) {
                          diplomaData = {
                              title: getRandomDiplomaTitle(),
                              subtitle: `BENCHMARK: ${benchmarkDefinition.title}`,
                              achievement: `Du lyfte totalt ${finalLogRaw.benchmarkValue.toLocaleString()} kg! Det motsvarar ca ${comparison.count} st ${comparison.name}`,
                              footer: `${comparison.single.charAt(0).toUpperCase() + comparison.single.slice(1)} väger ca ${comparison.weight.toLocaleString('sv-SE')} kg`,
                              imagePrompt: comparison.emoji,
                              newPBs: newRecords.length > 0 ? newRecords : undefined
                          };
                      }
                  } else if (benchmarkDefinition.type === 'reps') {
                      diplomaData = {
                          title: getRandomDiplomaTitle(),
                          subtitle: `BENCHMARK: ${benchmarkDefinition.title}`,
                          achievement: `Du klarade hela ${finalLogRaw.benchmarkValue} varv/reps!`,
                          footer: "Vilken maskin!",
                          imagePrompt: "🤖",
                          newPBs: newRecords.length > 0 ? newRecords : undefined
                      };
                  } else if (benchmarkDefinition.type === 'time') {
                      const m = Math.floor(finalLogRaw.benchmarkValue / 60);
                      const s = Math.floor(finalLogRaw.benchmarkValue % 60);
                      const timeStr = m > 0 ? `${m} min ${s} sek` : `${s} sekunder`;
                      diplomaData = {
                          title: getRandomDiplomaTitle(),
                          subtitle: `BENCHMARK: ${benchmarkDefinition.title}`,
                          achievement: `Du slutförde passet på ${timeStr}!`,
                          footer: "Snabbt jobbat!",
                          imagePrompt: "⚡",
                          newPBs: newRecords.length > 0 ? newRecords : undefined
                      };
                  }
              }

              if (!diplomaData && totalVolume > 0) {
                  const comparison = getFunComparison(totalVolume);
                  if (comparison) {
                      diplomaData = {
                          title: getRandomDiplomaTitle(),
                          subtitle: `Du lyfte totalt ${totalVolume.toLocaleString()} kg`,
                          achievement: `Det motsvarar ca ${comparison.count} st ${comparison.name}`,
                          footer: `${comparison.single.charAt(0).toUpperCase() + comparison.single.slice(1)} väger ca ${comparison.weight.toLocaleString('sv-SE')} kg`,
                          imagePrompt: comparison.emoji, 
                          newPBs: newRecords.length > 0 ? newRecords : undefined
                      };
                  }
              } else if (!diplomaData && (finalLogRaw.totalDistance > 0 || finalLogRaw.totalCalories > 0 || finalLogRaw.durationMinutes > 0)) {
                  // Fallback for cardio/time-based workouts
                  let achievementText = "";
                  if (finalLogRaw.totalDistance > 0) {
                      achievementText = `Du avverkade ${finalLogRaw.totalDistance} km!`;
                  } else if (finalLogRaw.totalCalories > 0) {
                      achievementText = `Du brände ${finalLogRaw.totalCalories} kcal!`;
                  } else if (finalLogRaw.durationMinutes > 0) {
                      achievementText = `Du kämpade i ${finalLogRaw.durationMinutes} minuter!`;
                  }
                  
                  diplomaData = {
                      title: getRandomDiplomaTitle(),
                      subtitle: "Grymt jobbat!",
                      achievement: achievementText,
                      footer: "Starkt jobbat!",
                      imagePrompt: "🔥",
                      newPBs: newRecords.length > 0 ? newRecords : undefined
                  };
              }

              if (!diplomaData) {
                  setSaveStatus('AI:n skriver ditt diplom...');
                  try {
                      diplomaData = await generateWorkoutDiploma({ ...savedLog, newPBs: newRecords });
                      if (diplomaData) {
                          diplomaData.title = getRandomDiplomaTitle();
                          diplomaData.newPBs = newRecords.length > 0 ? newRecords : undefined;
                      }
                  } catch (e) {
                      diplomaData = {
                          title: getRandomDiplomaTitle(),
                          subtitle: "Passet är genomfört.",
                          achievement: `Distans: ${finalLogRaw.totalDistance} km | Kcal: ${finalLogRaw.totalCalories}`,
                          footer: "Starkt jobbat!",
                          imagePrompt: "🔥",
                          newPBs: newRecords.length > 0 ? newRecords : undefined
                      };
                  }
              }

              if (diplomaData) {
                  await updateWorkoutLog(savedLog.id, { diploma: diplomaData });
              }

              localStorage.removeItem(ACTIVE_LOG_STORAGE_KEY);
              handleCancel(true, diplomaData || undefined);

      } catch (err) {
          console.error(err);
          alert("Kunde inte spara. Ett tekniskt fel uppstod.");
          setIsSubmitting(false);
          setSaveStatus('');
      }
  };

  if (loading) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm mb-8 text-center">
                  {isManualMode ? 'Laddar formulär...' : 'Hämtar din personliga strategi...'}
              </p>
              
              {!isManualMode && (
                  <button 
                      onClick={() => {
                          setLoading(false);
                          setViewMode('logging');
                      }}
                      className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                      Hoppa över
                  </button>
              )}
          </div>
      );
  }

  if (viewMode === 'pre-game') {
      return (
          <PreGameView 
              workoutTitle={workout?.title || 'Träningspass'}
              exercises={exerciseResults.map(e => ({ id: e.exerciseId, name: e.exerciseName, exerciseName: e.exerciseName, blockId: e.blockId }))}
              blocks={preGameBlocks}
              blockPct={sessionPctByBlock}
              onChangeBlockPct={(blockId, pct) => setSessionPctByBlock(prev => {
                  const next = { ...prev };
                  if (pct === null) { delete next[blockId]; } else { next[blockId] = pct; }
                  return next;
              })}
              aiProgressionPrompt={workout?.aiProgressionPrompt}
              history={history}
              personalBests={personalBests}
              userId={userId}
              onStart={handleStartWorkout}
              onCancel={() => handleCancel(false)}
          />
      );
  }

  return (
    <div className="bg-gray-50 dark:bg-black text-gray-900 dark:text-white flex flex-col relative h-full">
      {isSubmitting && (
          <div className="absolute inset-0 z-[1000] bg-white/10 dark:bg-black/10 pointer-events-auto" />
      )}

      <AnimatePresence>
        {showCelebration && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md"
            >
                <Confetti />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] text-center shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] dark:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] max-w-sm mx-4 relative z-10 border border-gray-100 dark:border-gray-800"
                >
                    <div className="text-7xl mb-6 drop-shadow-xl">🎉</div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Snyggt jobbat!</h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">Ditt pass är nu registrerat.</p>
                    
                    <button 
                        onClick={() => handleCancel(true)}
                        className="w-full bg-primary hover:brightness-110 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-tight"
                    >
                        Klar
                    </button>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <OneRMCalculatorModal 
          isOpen={showCalculator} 
          onClose={() => setShowCalculator(false)} 
          context={calculatorContext} 
      />

      <div className="bg-white dark:bg-gray-900 p-6 px-8 flex-shrink-0 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shadow-sm z-10">
        <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-[1.2] pt-[0.1em] truncate">
                    {isManualMode ? 'Logga Aktivitet' : workout?.title}
                </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Registrera dina resultat</p>
        </div>
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={toggleRestTimer}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 border ${
                    restTimerEnabled 
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 dark:bg-emerald-500/20' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700'
                }`}
                title="Slå på/av vilotimer mellan set"
            >
                <span className={`w-2 h-2 rounded-full ${restTimerEnabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                <span>{restTimerEnabled ? 'Vilotimer' : 'Vilotimer av'}</span>
            </button>
            <button 
                onClick={() => {
                    setCalculatorContext(null);
                    setShowCalculator(true);
                }} 
                className="p-3 bg-primary/10 dark:bg-primary/20 rounded-full hover:bg-primary/20 dark:hover:bg-primary/30 transition-all flex-shrink-0 shadow-sm active:scale-90" 
                disabled={isSubmitting}
            >
                <CalculatorIcon className="w-6 h-6 text-primary" />
            </button>
            <button onClick={() => handleCancel(false)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex-shrink-0 shadow-sm active:scale-90" disabled={isSubmitting}>
                <CloseIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-gray-50 dark:bg-black scrollbar-hide">
          <div className="p-2 sm:p-4 max-w-2xl mx-auto w-full">
              
              {/* Banner when session is fatigued */}
              {sessionMode === 'fatigued' && (
                  <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-sm animate-fade-in">
                      <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl flex-shrink-0">⚡</span>
                          <span className="text-xs font-bold leading-snug">
                              Sliten idag — vikterna är ca 10 % lägre idag.
                          </span>
                      </div>
                      <button
                          type="button"
                          onClick={() => setSessionMode('normal')}
                          className="flex-shrink-0 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition shadow-sm active:scale-95"
                      >
                          Kör som vanligt
                      </button>
                  </div>
              )}

              {/* Steg-indikator */}
              <div className="mb-6 flex gap-2 select-none">
                  <button
                      type="button"
                      onClick={() => {
                          setLogStep('exercises');
                          setTimeout(() => {
                              scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                          }, 50);
                      }}
                      className={`flex-1 p-3.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${logStep === 'exercises' ? 'bg-primary/15 text-primary border-primary/25 shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800'}`}
                  >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${logStep === 'exercises' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>1</span>
                      <span>Övningar ({exerciseResults.length})</span>
                  </button>
                  <button
                      type="button"
                      onClick={() => {
                          setLogStep('summary');
                          setTimeout(() => {
                              scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                          }, 50);
                      }}
                      className={`flex-1 p-3.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${logStep === 'summary' ? 'bg-primary/15 text-primary border-primary/25 shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800'}`}
                  >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${logStep === 'summary' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>2</span>
                      <span>Sammanfattning</span>
                  </button>
              </div>

              {logStep === 'exercises' ? (
                  <div className="space-y-6 animate-fade-in">
                      {!isManualMode && workout?.coachTips && (
                          <div className="p-5 rounded-[2rem] bg-gray-50/75 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                                  <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Coachens passbeskrivning</label>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-semibold whitespace-pre-line">
                                  {workout.coachTips}
                              </p>
                          </div>
                      )}

                      <div>
                          <label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Datum</label>
                          <div className="relative">
                              <input 
                                  type="date"
                                  value={logDate}
                                  onChange={(e) => setLogDate(e.target.value)}
                                  className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none transition font-bold text-lg shadow-sm"
                              />
                          </div>
                      </div>
                      
                      {isManualMode && (
                          <CustomActivityForm 
                              activityName={customActivity.name}
                              duration={customActivity.duration}
                              distance={customActivity.distance}
                              calories={customActivity.calories}
                              onUpdate={handleCustomActivityUpdate}
                              isQuickMode={false}
                              hasExercises={exerciseResults.length > 0}
                              organizationConfig={selectedOrganization?.globalConfig}
                              attemptedSubmit={attemptedSubmit}
                          />
                      )}

                      {isManualMode && (
                          <div className="mt-8 mb-4 flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                  <h3 className="text-base font-black uppercase tracking-widest text-gray-800 dark:text-gray-200">
                                      {exerciseResults.length > 0 ? 'Dina övningar' : 'Valfria övningar'}
                                  </h3>
                                  {exerciseResults.length === 0 && (
                                      <button 
                                          onClick={() => setShowExerciseSearch(true)}
                                          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-primary rounded-full text-xs font-bold flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition uppercase tracking-wider"
                                      >
                                          <PlusIcon className="w-4 h-4" />
                                          Lägg till övning
                                      </button>
                                  )}
                              </div>
                          </div>
                      )}

                      {(!isManualMode || exerciseResults.length > 0) && (
                          <>
                            {!isManualMode && exerciseResults.length === 0 && (
                                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 text-center mb-8">
                                    {workoutLoadFailed ? (
                                        <p className="text-red-600 dark:text-red-400 text-sm font-semibold">
                                            Passet kunde inte hämtas. Det är antingen inte publicerat än, eller borttaget. Be din coach publicera passet och skanna om.
                                        </p>
                                    ) : (
                                        <p className="text-gray-500 text-sm">Inga övningar i detta pass är markerade för specifik loggning. Du kan gå till nästa steg för att fylla i övriga resultat.</p>
                                    )}
                                </div>
                            )}
                            
                            {isManualMode ? (
                                <div className="flex flex-col gap-4">
                                    {exerciseResults.map((result, index) => {
                                        const isLastInGroup = result.groupId && (index === exerciseResults.length - 1 || exerciseResults[index + 1].groupId !== result.groupId);

                                        return (
                                            <ExerciseLogCard
                                                key={result.exerciseId}
                                                name={result.exerciseName}
                                                result={result}
                                                blockTag={blockTagsMap[result.blockId || ''] || ''}
                                                canEditFields={canEditTrackingFields || result.blockId === 'manual-block'}
                                                userId={currentUser?.uid}
                                                sessionMode={sessionMode}
                                                history={history}
                                                personalBests={personalBests}
                                                onUpdate={(updates) => handleUpdateResult(index, updates)}
                                                onStartRestTimer={startRestTimer}
                                                onRemove={() => setExerciseResults(prev => prev.filter((_, i) => i !== index))}
                                                lastPerformance={history[result.exerciseName]} 
                                                personalBest={personalBests[result.exerciseName.toLowerCase().trim()]}
                                                isLastInGroup={isLastInGroup}
                                                onAddGroupSet={() => handleAddGroupSet(result.groupId!)}
                                                sessionPct={sessionPctMap[canonicalizeExerciseName(result.exerciseName)] ?? sessionPctMap[result.exerciseName] ?? (result.blockId ? sessionPctByBlock[result.blockId] : undefined) ?? null}
                                                onOpenCalculator={(ctx) => {
                                                    setCalculatorContext({
                                                        ...ctx,
                                                        onSelectWeight: (weight: number) => {
                                                            setExerciseResults(prev => {
                                                                const newResults = [...prev];
                                                                const res = {...newResults[index]};
                                                                res.setDetails = res.setDetails.map(s => ({...s}));
                                                                
                                                                // Find first uncompleted set
                                                                let targetIdx = res.setDetails.findIndex(s => !s.completed);
                                                                if (targetIdx === -1) {
                                                                    // if all completed, just use the last one
                                                                    targetIdx = res.setDetails.length - 1;
                                                                }
                                                                if (targetIdx !== -1) {
                                                                    res.setDetails[targetIdx].weight = weight.toString();
                                                                }
                                                                newResults[index] = res;
                                                                return newResults;
                                                            });
                                                        }
                                                    });
                                                    setShowCalculator(true);
                                                }}
                                            />
                                        );
                                    })}
                                    
                                    <div className="flex justify-center pt-2">
                                        <button 
                                            onClick={() => setShowExerciseSearch(true)}
                                            className="w-full py-4 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-primary/20 hover:border-primary/50 text-primary dark:text-primary-light hover:bg-primary/5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all uppercase tracking-wider shadow-sm"
                                        >
                                            <PlusIcon className="w-5 h-5" />
                                            Lägg till övning
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                blockGroups.map((group) => {
                                    const isExpanded = expandedBlockId === group.blockId;
                                    const { totalSets, completedSets } = getBlockCompletionInfo(group);
                                    const isAllDone = totalSets > 0 && completedSets === totalSets;
                                    const isStarted = totalSets > 0 && completedSets > 0 && completedSets < totalSets;

                                    let headerBgClass = '';
                                    let lineClass = '';
                                    let statusTextClass = '';

                                    if (isAllDone) {
                                        headerBgClass = 'bg-green-50/60 hover:bg-green-100/70 dark:bg-green-950/10 dark:hover:bg-green-950/20 border-green-200/50 dark:border-green-800/20';
                                        lineClass = 'bg-green-500';
                                        statusTextClass = 'text-green-600 dark:text-green-400 font-bold';
                                    } else if (isStarted) {
                                        headerBgClass = 'bg-amber-50/30 hover:bg-amber-100/40 dark:bg-amber-950/5 dark:hover:bg-amber-950/10 border-amber-200/40 dark:border-amber-900/30 shadow-sm';
                                        lineClass = 'bg-amber-500';
                                        statusTextClass = 'text-amber-600 dark:text-amber-400 font-bold';
                                    } else {
                                        headerBgClass = isExpanded
                                            ? 'bg-gray-100/75 hover:bg-gray-100 dark:bg-slate-900/90 dark:hover:bg-slate-900 border-gray-200/50 dark:border-gray-800/40 shadow-sm'
                                            : 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-slate-900/60 border-gray-200 dark:border-gray-800/40 shadow-sm';
                                        lineClass = 'bg-gray-300 dark:bg-gray-700';
                                        statusTextClass = 'text-gray-500 dark:text-gray-400';
                                    }

                                    return (
                                        <div key={group.blockId} className="mb-2 last:mb-3 animate-fade-in">
                                            {/* Collapsible Block Header */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    const target = e.currentTarget;
                                                    const isNowExpanded = expandedBlockId !== group.blockId;
                                                    setExpandedBlockId(prev => prev === group.blockId ? null : group.blockId);
                                                    if (isNowExpanded) {
                                                        setTimeout(() => {
                                                            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                        }, 120);
                                                    }
                                                }}
                                                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between select-none ${headerBgClass}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-6 w-1 rounded-full transition-colors ${lineClass}`}></div>
                                                    <div>
                                                        <h4 className="text-sm font-black uppercase text-gray-800 dark:text-gray-100 tracking-wider">
                                                            {group.blockTitle}
                                                        </h4>
                                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                                                            <span>{group.exercises.length} {group.exercises.length === 1 ? 'övning' : 'övningar'}</span>
                                                            {totalSets > 0 && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className={statusTextClass}>
                                                                        {completedSets}/{totalSets} set klara
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {(() => {
                                                            const group_block = workout?.blocks?.find(b => b.id === group.blockId);
                                                            if (group_block && (group_block as any).showBlockPlan === false) return null;
                                                            const parts = getBlockPlanParts(
                                                                blockProfilesMap[group.blockId],
                                                                (group_block as any)?.showIntensity !== false
                                                            );
                                                            if (parts.length === 0) return null;
                                                            return (
                                                                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                                                    {parts.join(' · ')}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pr-1">
                                                    {isAllDone && (
                                                        <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                            Klar 🏆
                                                        </span>
                                                    )}
                                                    {isStarted && (
                                                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950/45 text-amber-700 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                            Pågår ⚡
                                                        </span>
                                                    )}
                                                    <span className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                                        <ChevronDownIcon className="w-5 h-5 stroke-[2.5]" />
                                                    </span>
                                                </div>
                                            </button>

                                            {/* Collapsible Content */}
                                            <AnimatePresence initial={false}>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                                        className="overflow-hidden space-y-2 mt-2 px-0.5"
                                                    >
                                                        {(() => {
                                                            // Gruppera övningar inom detta block efter deras groupId (superset)
                                                            const subGroups: {
                                                                groupId?: string;
                                                                groupColor?: string;
                                                                exercises: typeof group.exercises;
                                                            }[] = [];

                                                            group.exercises.forEach(ex => {
                                                                const gId = ex.result.groupId;
                                                                if (!gId) {
                                                                    // Ingen grupp = fristående övning
                                                                    subGroups.push({
                                                                        exercises: [ex]
                                                                    });
                                                                } else {
                                                                    // Sök om det redan finns en undergrupp med detta groupId
                                                                    let subG = subGroups.find(sg => sg.groupId === gId);
                                                                    if (!subG) {
                                                                        subG = {
                                                                            groupId: gId,
                                                                            groupColor: ex.result.groupColor,
                                                                            exercises: []
                                                                        };
                                                                        subGroups.push(subG);
                                                                    }
                                                                    subG.exercises.push(ex);
                                                                }
                                                            });

                                                            const getGroupColorStyles = (colorName?: string) => {
                                                                if (!colorName) return null;
                                                                return GROUP_COLORS.find(c => c.bg === colorName) || null;
                                                            };

                                                            return subGroups.map((subGroup) => {
                                                                if (subGroup.groupId) {
                                                                    // Det här är ett superset (undergrupp)
                                                                    const isSubExpanded = expandedSubGroupId === subGroup.groupId;
                                                                    const subGroupColorObj = getGroupColorStyles(subGroup.groupColor);
                                                                    
                                                                    const borderLeftClass = subGroupColorObj ? `border-l-4 ${subGroupColorObj.border}` : '';
                                                                    const headerBg = subGroupColorObj ? subGroupColorObj.lightBg : 'bg-gray-50 dark:bg-gray-800/40';
                                                                    const textColor = subGroupColorObj ? subGroupColorObj.text : 'text-gray-700 dark:text-gray-300';
                                                                    const textHover = subGroupColorObj ? 'hover:bg-opacity-80' : 'hover:bg-gray-100 dark:hover:bg-gray-800/60';
                                                                    
                                                                    // Beräkna antal färdiga set inom detta superset för en liten badge (t.ex. "3/6 klara")
                                                                    let subTotalSets = 0;
                                                                    let subCompletedSets = 0;
                                                                    subGroup.exercises.forEach(ex => {
                                                                        if (ex.result.skipped) return;
                                                                        subTotalSets += ex.result.setDetails.length;
                                                                        subCompletedSets += ex.result.setDetails.filter(s => s.completed).length;
                                                                    });

                                                                    return (
                                                                        <div key={subGroup.groupId} className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden mb-2 shadow-sm">
                                                                            {/* Superset Header */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    const target = e.currentTarget;
                                                                                    const isNowExpanded = !isSubExpanded;
                                                                                    setExpandedSubGroupId(isNowExpanded ? subGroup.groupId! : null);
                                                                                    if (isNowExpanded) {
                                                                                        setTimeout(() => {
                                                                                            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                                        }, 120);
                                                                                    }
                                                                                }}
                                                                                className={`w-full text-left p-3 flex items-center justify-between select-none transition-colors ${headerBg} ${borderLeftClass} ${textHover}`}
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className={`text-xs font-black uppercase tracking-widest ${textColor} flex items-center gap-1.5`}>
                                                                                        <span className="flex h-1.5 w-1.5 relative">
                                                                                           <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${subGroupColorObj ? subGroupColorObj.bg : 'bg-gray-400'} opacity-75`}></span>
                                                                                           <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${subGroupColorObj ? subGroupColorObj.bg : 'bg-gray-400'}`}></span>
                                                                                        </span>
                                                                                        Superset ({subGroup.exercises.length} övningar)
                                                                                    </div>
                                                                                    {subTotalSets > 0 && (
                                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/85 dark:bg-black/20 text-gray-600 dark:text-gray-300">
                                                                                            {subCompletedSets}/{subTotalSets} set
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <span className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isSubExpanded ? 'rotate-180' : ''}`}>
                                                                                    <ChevronDownIcon className="w-4 h-4 stroke-[2.5]" />
                                                                                </span>
                                                                            </button>
                                                                            
                                                                            {/* Superset Content */}
                                                                            <AnimatePresence initial={false}>
                                                                                {isSubExpanded && (
                                                                                    <motion.div
                                                                                        initial={{ opacity: 0, height: 0 }}
                                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                                        exit={{ opacity: 0, height: 0 }}
                                                                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                                                                        className="p-1 space-y-1 bg-gray-50/25 dark:bg-gray-950/5"
                                                                                    >
                                                                                        {subGroup.exercises.map(({ result, originalIndex }, idxInsideSub) => {
                                                                                             // superset session mode
                                                                                            const isLastInGroup = idxInsideSub === subGroup.exercises.length - 1;
                                                                                            
                                                                                            return (
                                                                                                <ExerciseLogCard
                                                                                                    key={result.exerciseId}
                                                                                                    name={result.exerciseName}
                                                                                                    result={result}
                                                                                                    blockTag={blockTagsMap[result.blockId || ''] || ''}
                                                                                                    onUpdate={(updates) => handleUpdateResult(originalIndex, updates)}
                                                                                                    lastPerformance={history[result.exerciseName]} 
                                                                                                    personalBest={personalBests[result.exerciseName.toLowerCase().trim()]}
                                                                                                    isLastInGroup={isLastInGroup}
                                                                                                    canEditFields={canEditTrackingFields || result.blockId === 'manual-block'}
                                                                                                    onAddGroupSet={() => handleAddGroupSet(result.groupId!)}
                                                                                                    userId={userId}
                                                                                                    history={history}
                                                                                                    personalBests={personalBests}
                                                                                                    sessionMode={sessionMode}
                                                                                                    blockProfile={result.blockId ? blockProfilesMap[result.blockId] : undefined}
                                                                                                    sessionPct={sessionPctMap[canonicalizeExerciseName(result.exerciseName)] ?? sessionPctMap[result.exerciseName] ?? (result.blockId ? sessionPctByBlock[result.blockId] : undefined) ?? null}
                                                                                                    onSelectSessionPct={(pct) => handleSelectSessionPct(result.exerciseName, pct)}
                                                                                                    onStartRestTimer={startRestTimer}
                                                                                                    onOpenCalculator={(ctx) => {
                                                                                                        setCalculatorContext({
                                                                                                            ...ctx,
                                                                                                            onSelectWeight: (weight: number) => {
                                                                                                                setExerciseResults(prev => {
                                                                                                                    const newResults = [...prev];
                                                                                                                    const res = {...newResults[originalIndex]};
                                                                                                                    res.setDetails = res.setDetails.map(s => ({...s}));
                                                                                                                    
                                                                                                                    let targetIdx = res.setDetails.findIndex(s => !s.completed);
                                                                                                                    if (targetIdx === -1) {
                                                                                                                        targetIdx = res.setDetails.length - 1;
                                                                                                                    }
                                                                                                                    if (targetIdx !== -1) {
                                                                                                                        res.setDetails[targetIdx].weight = weight.toString();
                                                                                                                    }
                                                                                                                    newResults[originalIndex] = res;
                                                                                                                    return newResults;
                                                                                                                });
                                                                                                            }
                                                                                                        });
                                                                                                        setShowCalculator(true);
                                                                                                    }}
                                                                                                />
                                                                                            );
                                                                                        })}
                                                                                    </motion.div>
                                                                                )}
                                                                                                                                                                                      </AnimatePresence>
                                                                         </div>
                                                                     );
                                                                 } else {
                                                                     // Det här är en helt vanlig, fristående övning (subGroup har inget groupId)
                                                                    const { result, originalIndex } = subGroup.exercises[0];
                                                                    return (
                                                                        <ExerciseLogCard
                                                                            key={result.exerciseId}
                                                                            name={result.exerciseName}
                                                                            result={result}
                                                                            blockTag={blockTagsMap[result.blockId || ''] || ''}
                                                                            onUpdate={(updates) => handleUpdateResult(originalIndex, updates)}
                                                                            lastPerformance={history[result.exerciseName]} 
                                                                            personalBest={personalBests[result.exerciseName.toLowerCase().trim()]}
                                                                             canEditFields={canEditTrackingFields || result.blockId === 'manual-block'}
                                                                            isLastInGroup={false}
                                                                            userId={userId}
                                                                            history={history}
                                                                            personalBests={personalBests}
                                                                            sessionMode={sessionMode}
                                                                            blockProfile={result.blockId ? blockProfilesMap[result.blockId] : undefined}
                                                                            sessionPct={sessionPctMap[canonicalizeExerciseName(result.exerciseName)] ?? sessionPctMap[result.exerciseName] ?? (result.blockId ? sessionPctByBlock[result.blockId] : undefined) ?? null}
                                                                            onSelectSessionPct={(pct) => handleSelectSessionPct(result.exerciseName, pct)}
                                                                            onStartRestTimer={startRestTimer}
                                                                             onOpenCalculator={(ctx) => {
                                                                                 setCalculatorContext({
                                                                                     ...ctx,
                                                                                    onSelectWeight: (weight: number) => {
                                                                                        setExerciseResults(prev => {
                                                                                            const newResults = [...prev];
                                                                                            const res = {...newResults[originalIndex]};
                                                                                            res.setDetails = res.setDetails.map(s => ({...s}));
                                                                                            
                                                                                            let targetIdx = res.setDetails.findIndex(s => !s.completed);
                                                                                            if (targetIdx === -1) {
                                                                                                targetIdx = res.setDetails.length - 1;
                                                                                            }
                                                                                            if (targetIdx !== -1) {
                                                                                                res.setDetails[targetIdx].weight = weight.toString();
                                                                                            }
                                                                                            newResults[originalIndex] = res;
                                                                                            return newResults;
                                                                                        });
                                                                                    }
                                                                                });
                                                                                setShowCalculator(true);
                                                                            }}
                                                                        />
                                                                    );
                                                                }
                                                            });
                                                        })()}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            )}
                          </>
                      )}

                      {isManualMode && exerciseResults.length > 0 && (
                          <div className="mt-4 p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-4">
                              <div className="flex items-center gap-3">
                                  <input 
                                      type="checkbox" 
                                      checked={saveAsProgram}
                                      onChange={(e) => setSaveAsProgram(e.target.checked)}
                                      id="saveAsProgram"
                                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor="saveAsProgram" className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                      Spara som nytt program
                                  </label>
                              </div>
                              {saveAsProgram && (
                                  <div className="animate-fade-in space-y-1.5">
                                      <input 
                                          type="text"
                                          value={programName}
                                          onChange={(e) => setProgramName(e.target.value)}
                                          placeholder="T.ex. Axlar & Rygg"
                                          className={`w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 transition-all font-medium placeholder-gray-400 ${
                                              attemptedSubmit && programName.trim().length === 0
                                                  ? 'border-red-500 focus:ring-red-500 shadow-sm shadow-red-500/10'
                                                  : 'border-gray-200 dark:border-gray-700 focus:ring-primary'
                                          }`}
                                      />
                                      {attemptedSubmit && programName.trim().length === 0 && (
                                          <p className="text-red-500 dark:text-red-400 text-xs font-bold pl-1 animate-fade-in">
                                              ● Programnamn saknas. Du måste namnge ditt program.
                                          </p>
                                      )}
                                  </div>
                              )}
                          </div>
                      )}

                      {/* NÄSTA / GÅ VIDARE KNAPP */}
                      <div className="pt-6 pb-12 space-y-4">
                          {!isManualMode && uncheckedSetsCount > 0 && (
                              <div className="text-center animate-fade-in bg-amber-500/10 border border-amber-500/20 py-3.5 rounded-2xl">
                                  <p className="text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 px-3">
                                      <InformationCircleIcon className="w-4 h-4 flex-shrink-0 text-amber-500" /> {uncheckedSetsCount} set kvar att checka av innan du kan spara passet
                                  </p>
                              </div>
                          )}
                          <button
                              type="button"
                              onClick={() => {
                                  setLogStep('summary');
                                  setTimeout(() => {
                                      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                  }, 50);
                              }}
                              className={`w-full font-black py-5 rounded-2xl transition-all transform active:scale-95 text-lg uppercase tracking-tight flex items-center justify-center gap-2 ${
                                  !isManualMode && uncheckedSetsCount > 0
                                      ? 'bg-transparent border-2 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                                      : 'bg-primary hover:brightness-110 text-white shadow-xl shadow-primary/20'
                              }`}
                          >
                              <span>Gå vidare till sammanfattning</span>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                              </svg>
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-6 animate-fade-in">
                      {/* STEP 2: SUMMARY */}
                      {!isManualMode && (() => {
                          const hasAmrapBlock = !!workout?.blocks?.some(b => b.settings?.mode === TimerMode.AMRAP);
                          const showRounds = activeSummaryFields.includes('rounds') || hasAmrapBlock || (sessionStats.rounds !== undefined && String(sessionStats.rounds).trim() !== '') || benchmarkDefinition?.type === 'reps';
                          const showCalories = activeSummaryFields.includes('calories') || (sessionStats.calories !== undefined && String(sessionStats.calories).trim() !== '');
                          const showDistance = activeSummaryFields.includes('distance') || (sessionStats.distance !== undefined && String(sessionStats.distance).trim() !== '');

                          const inactiveSummaryFields = [
                              { id: 'rounds', label: 'Varv / Reps', show: showRounds },
                              { id: 'calories', label: 'kcal', show: showCalories },
                              { id: 'distance', label: 'km', show: showDistance }
                          ].filter(f => !f.show);

                          return (
                              <div className="p-5 bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                                  <div className="grid grid-cols-2 gap-4">
                                      {/* TID (MIN:SEK) - ALWAYS VISIBLE */}
                                      <div>
                                          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 flex justify-between ${benchmarkDefinition?.type === 'time' ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                              Tid (min:sek)
                                              {benchmarkDefinition?.type === 'time' && prevBenchmarkBest && (
                                                  <span className="text-[9px] bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded">PB: {formatPrev(prevBenchmarkBest, 'time')}</span>
                                              )}
                                          </label>
                                          <div className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-2 border transition-colors ${benchmarkDefinition?.type === 'time' ? 'border-yellow-400 dark:border-yellow-600 ring-2 ring-yellow-400/20' : 'border-gray-100 dark:border-gray-700'}`}>
                                              <TimeInput
                                                  value={sessionStats.time}
                                                  onChange={(val) => setSessionStats(prev => ({ ...prev, time: val }))}
                                                  placeholder={benchmarkDefinition?.type === 'time' ? "45" : "-"}
                                                  className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center"
                                                  compact={true}
                                              />
                                          </div>
                                      </div>

                                      {/* VARV / REPS */}
                                      {showRounds && (
                                          <div>
                                              <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 flex justify-between ${benchmarkDefinition?.type === 'reps' ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                                  Varv / Reps
                                                  {benchmarkDefinition?.type === 'reps' && prevBenchmarkBest && (
                                                      <span className="text-[9px] bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded">PB: {formatPrev(prevBenchmarkBest, 'reps')}</span>
                                                  )}
                                              </label>
                                              <div className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-2 border transition-colors ${benchmarkDefinition?.type === 'reps' ? 'border-yellow-400 dark:border-yellow-600 ring-2 ring-yellow-400/20' : 'border-gray-100 dark:border-gray-700'}`}>
                                                  <input 
                                                      type="number"
                                                      inputMode="numeric"
                                                      value={sessionStats.rounds}
                                                      onChange={(e) => setSessionStats(prev => ({ ...prev, rounds: e.target.value }))}
                                                      placeholder={benchmarkDefinition?.type === 'reps' ? "T.ex. 5" : "-"}
                                                      className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center"
                                                  />
                                              </div>
                                          </div>
                                      )}

                                      {/* KCAL */}
                                      {showCalories && (
                                          <div>
                                              <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">kcal</label>
                                              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                                  <input 
                                                      type="number"
                                                      inputMode="numeric"
                                                      value={sessionStats.calories}
                                                      onChange={(e) => setSessionStats(prev => ({ ...prev, calories: e.target.value }))}
                                                      placeholder="T.ex. 350"
                                                      className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center"
                                                  />
                                              </div>
                                          </div>
                                      )}

                                      {/* KM */}
                                      {showDistance && (
                                          <div>
                                              <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">km</label>
                                              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                                  <input 
                                                      type="number"
                                                      inputMode="decimal"
                                                      value={sessionStats.distance}
                                                      onChange={(e) => setSessionStats(prev => ({ ...prev, distance: e.target.value }))}
                                                      placeholder="T.ex. 3.5"
                                                      className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center"
                                                  />
                                              </div>
                                          </div>
                                      )}
                                  </div>

                                  {/* "+ fler fält" chip for summary */}
                                  {inactiveSummaryFields.length > 0 && (
                                      <div className="mt-3">
                                          {!showSummaryMoreFields ? (
                                              <button
                                                  type="button"
                                                  onClick={() => setShowSummaryMoreFields(true)}
                                                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary-light bg-gray-50/80 dark:bg-gray-800/80 hover:bg-primary/10 px-2.5 py-1 rounded-full transition-all border border-gray-200 dark:border-gray-700/60 active:scale-95"
                                              >
                                                  <PlusIcon className="w-3 h-3" />
                                                  <span>+ fler fält</span>
                                              </button>
                                          ) : (
                                              <div className="flex items-center gap-1.5 flex-wrap p-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/80 animate-fade-in">
                                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mr-1">Lägg till:</span>
                                                  {inactiveSummaryFields.map(f => (
                                                      <button
                                                          key={f.id}
                                                          type="button"
                                                          onClick={() => {
                                                              setActiveSummaryFields(prev => [...prev, f.id]);
                                                              if (inactiveSummaryFields.length <= 1) {
                                                                  setShowSummaryMoreFields(false);
                                                              }
                                                          }}
                                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-primary dark:text-primary-light hover:bg-primary hover:text-white transition-all shadow-2xs active:scale-95"
                                                      >
                                                          <PlusIcon className="w-3 h-3" />
                                                          {f.label}
                                                      </button>
                                                  ))}
                                                  <button
                                                      type="button"
                                                      onClick={() => setShowSummaryMoreFields(false)}
                                                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1 rounded-lg"
                                                      title="Dölj"
                                                  >
                                                      <CloseIcon className="w-3.5 h-3.5" />
                                                  </button>
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          );
                      })()}

                      <PostWorkoutForm 
                          data={logData} 
                          onUpdate={u => setLogData(prev => ({ ...prev, ...u }))} 
                          userId={userId}
                          isSummerChallengeOn={isSummerChallengeOn}
                      />

                      <div className="mt-8 space-y-6 pb-12">
                          <div className="space-y-3">
                              <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1 text-center">Var genomfördes passet?</h3>
                              <div className="grid grid-cols-2 gap-3">
                                  <button
                                      type="button"
                                      onClick={() => setInStudio(true)}
                                      className={`py-4 px-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                                          inStudio === true
                                              ? 'border-primary bg-primary/10 text-primary'
                                              : (attemptedSubmit && inStudio !== false)
                                                  ? 'border-red-500 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400'
                                                  : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                      }`}
                                  >
                                      {selectedOrganization?.name || 'På Gymmet'}
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => setInStudio(false)}
                                      className={`py-4 px-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                                          inStudio === false
                                              ? 'border-primary bg-primary/10 text-primary'
                                              : (attemptedSubmit && inStudio !== true)
                                                  ? 'border-red-500 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400'
                                                  : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                      }`}
                                  >
                                      Annan plats
                                  </button>
                              </div>
                          </div>

                          {getValidationErrors().length > 0 && (
                               <div className="space-y-3 p-5 rounded-[2rem] bg-red-500/10 border border-red-500/20 text-left animate-fade-in mb-4">
                                   <p className="text-red-700 dark:text-red-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 pl-1">
                                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-4 h-4 text-red-500 flex-shrink-0">
                                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                                       </svg>
                                       Kvar att fylla i innan du kan spara:
                                   </p>
                                   <ul className="list-disc pl-5 space-y-1 text-xs font-bold text-red-600 dark:text-red-300">
                                       {getValidationErrors().map((err, idx) => (
                                           <li key={idx}>{err}</li>
                                       ))}
                                   </ul>
                               </div>
                           )}

                           {!attemptedSubmit && !isFormValid && !isManualMode && uncheckedSetsCount > 0 && (
                              <div className="text-center animate-fade-in bg-amber-500/10 border border-amber-500/20 py-3.5 rounded-2xl">
                                  <p className="text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 px-3">
                                      <InformationCircleIcon className="w-4 h-4 flex-shrink-0 text-amber-500" /> {uncheckedSetsCount} set kvar att checka av för att kunna spara
                                  </p>
                              </div>
                          )}

                          <div className="flex flex-col sm:flex-row gap-4 pt-4">
                              <button 
                                  type="button"
                                  onClick={() => {
                                      setLogStep('exercises');
                                      setTimeout(() => {
                                          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                      }, 50);
                                  }}
                                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-black py-5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                                  </svg>
                                  <span>Tillbaka till övningarna</span>
                              </button>
                              
                              <div className="flex-[2] flex flex-col items-center gap-3">
                                  <button 
                                      onClick={handleSubmit}
                                      disabled={!isFormValid || isSubmitting}
                                      className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:shadow-none disabled:transform-none text-xl uppercase tracking-tight flex items-center justify-center gap-3"
                                  >
                                      {isSubmitting ? (
                                          <>
                                              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                              <span>Sparar...</span>
                                          </>
                                      ) : (
                                          <span>{isManualMode ? 'Spara Aktivitet' : 'Spara Pass'}</span>
                                      )}
                                  </button>
                                  
                                  <AnimatePresence>
                                      {isSubmitting && saveStatus && (
                                          <motion.p 
                                              initial={{ opacity: 0, y: 10 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              exit={{ opacity: 0 }}
                                              className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest animate-pulse"
                                          >
                                              {saveStatus}
                                          </motion.p>
                                      )}
                                  </AnimatePresence>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* REST TIMER FLOATING BAR */}
      {restTimer && (
          <div className="fixed bottom-4 left-3 right-3 z-50 max-w-md mx-auto pointer-events-auto animate-fade-in">
              <div 
                  onClick={() => {
                      if (restTimer.status === 'completed') setRestTimer(null);
                  }}
                  className={`rounded-3xl shadow-2xl border backdrop-blur-md transition-all ${
                      restTimer.status === 'completed'
                          ? 'bg-work text-white border-work cursor-pointer px-5 py-7'
                          : 'bg-rest text-white border-rest px-5 py-4'
                  }`}
              >
                  {restTimer.status === 'running' ? (
                      <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-center gap-3">
                              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-sm font-black uppercase tracking-[0.2em] text-gray-300">Vila</span>
                          </div>
                          <div className="text-center leading-none">
                              <span className="text-7xl font-black font-mono tabular-nums tracking-tighter text-white">
                                  {Math.floor(remainingRestSeconds / 60)}:{String(remainingRestSeconds % 60).padStart(2, '0')}
                              </span>
                          </div>
                          <div className="flex items-stretch gap-3">
                              <button
                                  type="button"
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleAdd30Seconds();
                                  }}
                                  className="flex-1 min-h-[56px] rounded-2xl bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-base font-bold text-gray-100 border border-gray-600/50 transition active:scale-95"
                              >
                                  +30 s
                              </button>
                              <button
                                  type="button"
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleSkipRestTimer();
                                  }}
                                  className="flex-1 min-h-[56px] rounded-2xl bg-gray-800/60 dark:bg-gray-700/60 hover:bg-gray-700 text-base font-semibold text-gray-300 hover:text-white transition active:scale-95"
                              >
                                  Hoppa över
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                          <span className="text-3xl font-black uppercase tracking-wide">VILA KLAR</span>
                          <span className="text-sm opacity-90 font-normal">Tryck för att stänga</span>
                      </div>
                  )}
              </div>
          </div>
      )}

{showExerciseSearch && (
          <Modal isOpen={showExerciseSearch} onClose={() => setShowExerciseSearch(false)} size="lg">
              <div className="flex flex-col items-center w-full h-[85vh]">
                  <div className="w-full flex items-center justify-between mb-4 mt-2 sm:mb-8 sm:mt-0 cursor-pointer" onClick={() => setShowExerciseSearch(false)}>
                      <h2 className="text-xl font-black uppercase tracking-widest text-gray-900 dark:text-white">Lägg till övning</h2>
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                          <CloseIcon className="w-5 h-5 text-gray-500" />
                      </div>
                  </div>
                  
                  <div className="w-full relative mb-6">
                      <input 
                          type="text" 
                          placeholder="Sök i övningsbanken eller skriv egen..." 
                          value={exerciseSearchTerm}
                          onChange={(e) => setExerciseSearchTerm(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-[2rem] py-4 px-6 font-bold focus:outline-none focus:ring-2 focus:ring-primary border border-gray-200 dark:border-gray-700"
                      />
                  </div>

                  <div className="w-full flex-1 overflow-y-auto scrollbar-hide space-y-2 pb-10">
                      {exerciseSearchTerm.length > 0 && !filteredBank.some(ex => ex.name.toLowerCase() === exerciseSearchTerm.toLowerCase()) && (
                          <div 
                              onClick={() => handleAddManualExercise(exerciseSearchTerm)}
                              className="p-4 rounded-2xl border-2 border-dashed border-primary hover:bg-primary/5 transition flex items-center gap-3 cursor-pointer mb-4"
                          >
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                  <PlusIcon className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                  <div className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Skapa Egen:</div>
                                  <div className="font-medium text-gray-600 dark:text-gray-300">"{exerciseSearchTerm}"</div>
                              </div>
                          </div>
                      )}
                      
                      {filteredBank.map(ex => (
                          <div 
                              key={ex.id}
                              onClick={() => handleAddManualExercise(ex.name)}
                              className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition flex items-center gap-4 cursor-pointer"
                          >
                              <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500 font-black text-lg">
                                  {ex.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-gray-900 dark:text-white truncate">{ex.name}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${ex.category === 'Custom Egen' ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' : 'text-primary bg-primary/10'}`}>
                                          {ex.category === 'Custom Egen' ? 'Egen' : ex.category}
                                      </span>
                                  </div>
                              </div>
                              {ex.category === 'Custom Egen' ? (
                                  <div className="flex items-center gap-1">
                                      <button onClick={(e) => {
                                          e.stopPropagation();
                                          setEditExerciseName(ex.name);
                                          setExerciseToEdit(ex);
                                      }} className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Ändra namn">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                      </button>
                                      <button onClick={(e) => {
                                          e.stopPropagation();
                                          setExerciseToDelete(ex);
                                      }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Ta bort">
                                          <TrashIcon className="w-5 h-5" />
                                      </button>
                                  </div>
                              ) : (
                                  <PlusIcon className="w-5 h-5 text-gray-400" />
                              )}
                          </div>
                      ))}
                      {filteredBank.length === 0 && exerciseSearchTerm.length === 0 && (
                          <div className="text-center py-10">
                              <p className="text-gray-500 font-medium">Sök för att hitta övningar.</p>
                          </div>
                      )}
                  </div>
              </div>
          </Modal>
      )}

      {exerciseToDelete && (
          <ConfirmModal
              isOpen={!!exerciseToDelete}
              onClose={() => setExerciseToDelete(null)}
              onConfirm={async () => {
                  if (!userId) return;
                  const id = exerciseToDelete.id;
                  await deleteMemberCustomExercise(userId, id);
                  setExerciseBank(prev => prev.filter(b => b.id !== id));
                  setExerciseToDelete(null);
              }}
              title="Ta bort övning"
              message={`Är du säker på att du vill ta bort "${exerciseToDelete.name}"?`}
              confirmText="Ta bort"
              cancelText="Avbryt"
              confirmColor="red"
          />
      )}

      {exerciseToEdit && (
          <Modal 
              isOpen={!!exerciseToEdit} 
              onClose={() => setExerciseToEdit(null)} 
              title="Byt namn på övning" 
              size="sm"
              footer={
                  <div className="flex gap-2 justify-end w-full">
                      <button onClick={() => setExerciseToEdit(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg transition-colors">
                          Avbryt
                      </button>
                      <button 
                          onClick={async () => {
                              if (!userId) return;
                              const newName = editExerciseName.trim();
                              if (newName !== "" && newName !== exerciseToEdit.name) {
                                  try {
                                      await updateMemberCustomExercise(userId, exerciseToEdit.id, newName);
                                      setExerciseBank(prev => prev.map(b => b.id === exerciseToEdit.id ? { ...b, name: newName } : b));
                                  } catch (error) {
                                      console.error("Fel vid uppdatering av namn:", error);
                                  }
                              }
                              setExerciseToEdit(null);
                          }} 
                          className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                      >
                          Spara
                      </button>
                  </div>
              }
          >
              <div className="p-4 pt-2">
                  <input 
                      type="text" 
                      value={editExerciseName}
                      onChange={(e) => setEditExerciseName(e.target.value)}
                      placeholder="Övningens namn"
                      autoFocus
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-900 dark:text-gray-100"
                  />
              </div>
          </Modal>
      )}

      {duplicateWarning && (
          <DuplicateExerciseModal
              isOpen={!!duplicateWarning}
              existingName={duplicateWarning.existing.name}
              inputName={duplicateWarning.inputName}
              onUseExisting={() => {
                  const ex = duplicateWarning.existing;
                  setDuplicateWarning(null);
                  handleAddManualExercise(ex.name, true);
              }}
              onCreateAnyway={() => {
                  const input = duplicateWarning.inputName;
                  setDuplicateWarning(null);
                  handleAddManualExercise(input, true);
              }}
              onClose={() => setDuplicateWarning(null)}
          />
      )}
    </div>
  );
};
