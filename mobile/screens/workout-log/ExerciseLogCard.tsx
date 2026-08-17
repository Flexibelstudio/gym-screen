import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalculatorIcon, CheckIcon, CloseIcon, PlusIcon } from '../../../components/icons';
import { PersonalBest } from '../../../types';
import { calculate1RM, getRepsForPercentage, getTargetWeightForExercise, getRestSecondsForPercentage, TrainingProfile, getSetScore } from '../../../utils/workoutUtils';
import { LocalExerciseResult, LastPerformanceRecord, LocalSetDetail } from './types';
import { ChevronDownIcon, formatLastPerformance, formatLastPerformanceSets, TimeInput, GROUP_COLORS, GRID_COLS_MAP, DEFAULT_REST_SECONDS, normalizeDecimalInput } from './utils';

export const ExerciseLogCard: React.FC<{
  name: string;
  result: LocalExerciseResult;
  onUpdate: (updates: Partial<LocalExerciseResult>) => void;
  onRemove?: () => void;
  lastPerformance?: LastPerformanceRecord | null;
  personalBest?: PersonalBest | null;
  isLastInGroup?: boolean;
  onAddGroupSet?: () => void;
  userId?: string;
  sessionMode?: 'normal' | 'fatigued';
  history?: Record<string, LastPerformanceRecord>;
  personalBests?: Record<string, PersonalBest>;
  blockProfile?: TrainingProfile | null;
  sessionPct?: number | null;
  onSelectSessionPct?: (pct: number | null) => void;
  onStartRestTimer?: (seconds: number, groupId: string | null, setIndex: number, exerciseId: string) => void;
  onOpenCalculator?: (context: { 
      exerciseName: string, 
      current1RM?: number, 
      activeTargetPct?: number | null, 
      activePctSource?: 'coach' | 'session' | 'none',
      onSelectTargetPct?: (pct: number | null) => void 
  }) => void;
  canEditFields: boolean;
  blockTag?: string;
}> = ({ name, result, onUpdate, onRemove, lastPerformance, personalBest, isLastInGroup, onAddGroupSet, userId, sessionMode = 'normal', history, personalBests, blockProfile, sessionPct, onSelectSessionPct, onStartRestTimer, onOpenCalculator, canEditFields, blockTag }) => {
    
    const normalizedBlockTag = (blockTag || '').trim().toLowerCase();
    const isStrengthLike = normalizedBlockTag === '' || normalizedBlockTag === 'styrka' || normalizedBlockTag === 'hypertrofi';

    // Knappen sitter längst ner i gruppens sista övning, men raden läggs till i
    // samtliga övningar i gruppen — alltså ovanför skärmkanten. Utan kvittens här
    // ser det ut som att ingenting hände.
    const [groupSetAdded, setGroupSetAdded] = useState(false);
    const groupSetAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (groupSetAddedTimerRef.current) clearTimeout(groupSetAddedTimerRef.current); }, []);

    const trackingFields = result.trackingFields || ['reps', 'weight'];
    const showReps = trackingFields.includes('reps');
    const showWeight = trackingFields.includes('weight');
    const showTime = trackingFields.includes('time');
    const showDistance = trackingFields.includes('distance');
    const showKcal = trackingFields.includes('kcal');

    const dynamicColsCount = [showReps, showWeight, showTime, showDistance, showKcal].filter(Boolean).length;
    const gridColsClass = GRID_COLS_MAP[dynamicColsCount] || 'grid-cols-[36px_repeat(2,_1fr)_40px_48px]';

    const prescribedPct = (blockProfile && blockProfile.hasWeightMath !== false && blockProfile.targetPct !== undefined && blockProfile.targetPct > 0) ? blockProfile.targetPct : null;

    const targetInfo = useMemo(() => {
        return getTargetWeightForExercise({
            exerciseName: name,
            personalBests: personalBests || (personalBest ? { [name]: personalBest } : {}),
            history: history || (lastPerformance ? { [name]: lastPerformance } : {}),
            userId,
            mode: sessionMode,
            prescribedPct,
            sessionPct
        });
    }, [name, personalBests, personalBest, history, lastPerformance, userId, sessionMode, prescribedPct, sessionPct]);

    // Extract tailwind color classes from groupColor (e.g. "bg-pink-500")
    const groupColorObj = result.groupColor ? GROUP_COLORS.find(c => c.bg === result.groupColor) : null;
    const borderColorClass = groupColorObj ? groupColorObj.border : 'border-gray-100 dark:border-gray-800';
    const textColorClass = groupColorObj ? groupColorObj.text : 'text-primary';
    const lightBgClass = groupColorObj ? groupColorObj.lightBg : 'bg-primary/5';
    const lightBorderClass = groupColorObj ? groupColorObj.lightBorder : 'border-primary/20';

    const FIELD_LABELS: Record<string, string> = {
        reps: 'reps', weight: 'vikt', time: 'tid', distance: 'distans', kcal: 'kcal'
    };

    const getMissingFields = (set: LocalSetDetail): string[] => {
        return trackingFields.filter(f => {
            const raw = (set as any)[f];
            return raw === undefined || raw === null || String(raw).trim() === '';
        });
    };

    const handleSetChange = (index: number, field: keyof LocalSetDetail, value: string) => {
        const newSets = [...result.setDetails];
        newSets[index] = { ...newSets[index], [field]: value };
        onUpdate({ setDetails: newSets });
        if (invalidSetIdx === index) { setInvalidSetIdx(null); }
    };

    const handleToggleComplete = (index: number) => {
         const wasCompleted = result.setDetails[index].completed;
         if (!wasCompleted) {
             const missing = getMissingFields(result.setDetails[index]);
             if (missing.length > 0) {
                 setInvalidSetIdx(index);
                 if (window.navigator.vibrate) { window.navigator.vibrate([40, 60, 40]); }
                 return;
             }
         }
         setInvalidSetIdx(null);
         if (wasCompleted) {
             setSetFeedback(null);
         }

         if (window.navigator.vibrate) {
             window.navigator.vibrate(wasCompleted ? 5 : 15);
         }
         
         const newSets = [...result.setDetails];
         const isNowCompleted = !wasCompleted;
         newSets[index] = { ...newSets[index], completed: isNowCompleted };
         onUpdate({ setDetails: newSets });

         if (!wasCompleted && isNowCompleted && showWeight && showReps) {
             const s = result.setDetails[index];
             const w = parseFloat(s.weight) || 0;
             const r = parseFloat(s.reps) || 0;
             if (w > 0 && r > 0) {
                 const oneRm = calculate1RM(w, r, s.rir) || 0;
                 const score = getSetScore(w, r, oneRm);

                 if (score <= sessionBestRef.current) {
                     setSetFeedback(null);
                 } else {
                     const pbW = personalBest?.weight || 0;
                     const pbR = personalBest?.reps || 0;
                     const pbRm = personalBest?.calculated1RM || 0;
                     const pbScore = personalBest ? getSetScore(pbW, pbR, pbRm) : -1;

                     let text = '';
                     if (score > pbScore && score > sessionBestRef.current) {
                         text = 'Bästa setet du gjort på den här övningen.';
                     } else {
                         const lastW = parseFloat(lastPerformance?.weight as any) || 0;
                         const lastR = parseFloat(lastPerformance?.reps as any) || 0;
                         if (lastW > 0 && w > lastW) {
                             const diff = String(Math.round((w - lastW) * 10) / 10).replace('.', ',');
                             text = `+${diff} kg sen sist.`;
                         } else if (lastW > 0 && w === lastW && lastR > 0 && r > lastR) {
                             const extra = r - lastR;
                             text = extra === 1 ? 'Samma vikt, ett rep till.' : `Samma vikt, ${extra} reps till.`;
                         }
                     }

                     if (score > sessionBestRef.current) { sessionBestRef.current = score; }
                     setSetFeedback(text ? { index, text } : null);
                 }
             }
         }

         if (!wasCompleted && isNowCompleted && onStartRestTimer && isStrengthLike) {
             let restSec = 0;
             if (blockProfile && blockProfile.restSeconds && blockProfile.restSeconds > 0) {
                 restSec = blockProfile.restSeconds;
             } else if (targetInfo && targetInfo.targetPct && targetInfo.targetPct > 0) {
                 restSec = getRestSecondsForPercentage(targetInfo.targetPct);
             }
             if (restSec <= 0 && showWeight) {
                 restSec = DEFAULT_REST_SECONDS;
             }
             if (restSec > 0) {
                 onStartRestTimer(restSec, result.groupId || null, index, result.exerciseId);
             }
         }
    };

    const handleAddSet = () => {
        const lastSet = result.setDetails[result.setDetails.length - 1];
        const newSet = lastSet ? { ...lastSet, completed: false, rir: null } : { weight: '', reps: '', time: '', distance: '', kcal: '', completed: false, rir: null };
        onUpdate({ setDetails: [...result.setDetails, newSet] });
    };

    const handleRemoveSet = (index: number) => {
        if (result.setDetails.length <= 1) return;
        onUpdate({ setDetails: result.setDetails.filter((_, i) => i !== index) });
    };

    const [isEditingFields, setIsEditingFields] = useState(false);
    const [showMoreFields, setShowMoreFields] = useState(false);
    const [isNoteActive, setIsNoteActive] = useState(true);
    const [isNoteExpanded, setIsNoteExpanded] = useState(false);
    const [invalidSetIdx, setInvalidSetIdx] = useState<number | null>(null);
    const [setFeedback, setSetFeedback] = useState<{ index: number; text: string } | null>(null);
    const sessionBestRef = useRef<number>(0);

    // Calculate/Get current 1RM for this exercise
    const current1RM = useMemo(() => {
        if (personalBest) {
            if (personalBest.calculated1RM !== undefined && personalBest.calculated1RM > 0) {
                return Math.round(personalBest.calculated1RM);
            } else if (personalBest.weight > 0) {
                return calculate1RM(personalBest.weight, personalBest.reps || 1) || undefined;
            }
        } else if (lastPerformance) {
            const lastWeight = parseFloat(lastPerformance.weight as any) || 0;
            const lastReps = parseFloat(lastPerformance.reps as any) || 0;
            if (lastWeight > 0 && lastReps > 0 && lastReps <= 10) {
                return calculate1RM(lastWeight, lastReps) || undefined;
            }
        }
        return undefined;
    }, [personalBest, lastPerformance]);

    const handleTargetPctSelection = (pct: number | null) => {
        if (onSelectSessionPct) onSelectSessionPct(pct);
    };

    const ALL_TRACKING_FIELDS = [
        { id: 'reps', label: 'Reps' },
        { id: 'weight', label: 'Vikt' },
        { id: 'time', label: 'Tid' },
        { id: 'distance', label: 'Distans' },
        { id: 'kcal', label: 'Kcal' },
    ] as const;

    const inactiveFields = ALL_TRACKING_FIELDS.filter(f => !trackingFields.includes(f.id));

    const toggleField = (field: 'reps' | 'weight' | 'time' | 'distance' | 'kcal') => {
        if (!canEditFields) return;
        const current = [...trackingFields];
        const has = current.includes(field);
        if (has) {
            if (current.length <= 1) return; // Block unchecking the last field
            onUpdate({ trackingFields: current.filter(f => f !== field) });
        } else {
            onUpdate({ trackingFields: [...current, field] });
        }
    };

    return (
        <div className={`bg-white dark:bg-gray-900 rounded-2xl p-4 mb-1 border shadow-sm transition-all ${result.groupColor ? `border-l-4 ${borderColorClass} border-y-gray-100 border-r-gray-100 dark:border-y-gray-800 dark:border-r-gray-800` : 'border-gray-100 dark:border-gray-800'}`}>
            <div className="flex flex-col gap-2 mb-4">
                <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-black text-gray-900 dark:text-white text-xl truncate leading-[1.2] pt-[0.1em]">{name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {(() => {
                                // Hela setlistan om den finns, annars den gamla
                                // sammanfattningen, som även täcker tid och distans.
                                const formatted = formatLastPerformanceSets(lastPerformance) || formatLastPerformance(lastPerformance);
                                if (formatted) {
                                    return (
                                        <div className="inline-flex items-center gap-1.5 bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-[1.2] pt-[0.1em]">Senast:</span>
                                            <span className="text-gray-900 dark:text-white font-black tabular-nums">
                                                {formatted}
                                            </span>
                                        </div>
                                    );
                                }
                                return (
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-wider leading-[1.2] pt-[0.1em]">
                                       Ingen historik
                                    </p>
                                );
                            })()}

                            {/* 1RM Badge (Current 1RM integer) */}
                            {current1RM ? (
                                <div className="inline-flex items-center gap-1 bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg text-xs font-black tracking-wide font-mono tabular-nums">
                                    <span>1RM: {current1RM} kg</span>
                                </div>
                            ) : null}

                            {/* Target Weight Badge */}
                            {(() => {
                                const hasWeightMath = showWeight && showReps && (blockProfile ? blockProfile.hasWeightMath !== false : true);

                                let sourceSuffix = '';
                                if (targetInfo.pctSource === 'coach') sourceSuffix = 'coachens upplägg';
                                else if (targetInfo.pctSource === 'session') sourceSuffix = 'ditt val idag';

                                let underradText = '';
                                if (targetInfo.targetPct) {
                                    const parts = [`${targetInfo.targetPct} % av 1RM`];
                                    if (sourceSuffix) parts.push(sourceSuffix);
                                    if (sessionMode === 'fatigued') parts.push('sliten idag');
                                    underradText = parts.join(' · ');
                                } else if (sessionMode === 'fatigued') {
                                    underradText = 'sliten idag';
                                }

                                const showBadge = hasWeightMath && targetInfo.base !== null && targetInfo.scaled !== null && targetInfo.pctSource !== 'none';

                                return (
                                    <>
                                        {showBadge && (() => {
                                            const formattedScaled = String(targetInfo.scaled).replace('.', ',');
                                            const formattedBase = String(targetInfo.base).replace('.', ',');
                                            const targetReps = targetInfo.targetPct && targetInfo.targetPct > 0 ? getRepsForPercentage(targetInfo.targetPct) : 0;
                                            const repsText = targetReps > 0 ? ` × ~${targetReps} reps` : '';

                                            if (sessionMode === 'fatigued') {
                                                return (
                                                    <div 
                                                        onClick={() => {
                                                            if (onOpenCalculator) {
                                                                onOpenCalculator({ 
                                                                    exerciseName: name, 
                                                                    current1RM: current1RM,
                                                                    activeTargetPct: targetInfo.targetPct,
                                                                    activePctSource: targetInfo.pctSource,
                                                                    onSelectTargetPct: handleTargetPctSelection
                                                                });
                                                            }
                                                        }}
                                                        className={`inline-flex flex-col bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-mono tabular-nums ${onOpenCalculator ? 'cursor-pointer hover:bg-amber-500/20' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-black tracking-wide">DAGENS MÅL: {formattedScaled} kg{repsText}</span>
                                                            {targetInfo.base !== targetInfo.scaled && (
                                                                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 line-through">
                                                                    {formattedBase} kg
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-semibold opacity-80">{underradText}</span>
                                                    </div>
                                                );
                                            } else if (targetInfo.targetPct) {
                                                return (
                                                    <div 
                                                        onClick={() => {
                                                            if (onOpenCalculator) {
                                                                onOpenCalculator({ 
                                                                    exerciseName: name, 
                                                                    current1RM: current1RM,
                                                                    activeTargetPct: targetInfo.targetPct,
                                                                    activePctSource: targetInfo.pctSource,
                                                                    onSelectTargetPct: handleTargetPctSelection
                                                                });
                                                            }
                                                        }}
                                                        className={`inline-flex flex-col bg-primary/10 dark:bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-lg font-mono tabular-nums ${onOpenCalculator ? 'cursor-pointer hover:bg-primary/20' : ''}`}
                                                    >
                                                        <span className="text-xs font-black tracking-wide">MÅL: {formattedScaled} kg{repsText}</span>
                                                        <span className="text-[10px] font-semibold opacity-80">{underradText}</span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        {/* Fatigued suggestion badge when no target percentage is selected */}
                                        {sessionMode === 'fatigued' && targetInfo.pctSource === 'none' && targetInfo.scaled !== null && targetInfo.scaled > 0 && (() => {
                                            const formattedScaled = String(targetInfo.scaled).replace('.', ',');
                                            return (
                                                <div className="inline-flex items-center gap-1 bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums">
                                                    <span>Sliten idag — ta ca {formattedScaled} kg</span>
                                                </div>
                                            );
                                        })()}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                    {/* Gear / Edit / Delete buttons */}
                    <div className="flex items-center gap-2">
                        {onOpenCalculator && (
                            <button 
                                onClick={() => {
                                    onOpenCalculator({ 
                                        exerciseName: name, 
                                        current1RM: current1RM,
                                        activeTargetPct: targetInfo.targetPct,
                                        activePctSource: targetInfo.pctSource,
                                        onSelectTargetPct: handleTargetPctSelection
                                    });
                                }}
                                className="p-3 rounded-2xl transition-all active:scale-90 bg-gray-50 dark:bg-gray-800 text-primary hover:bg-primary/20 dark:hover:bg-primary/20 shadow-sm"
                            >
                                <CalculatorIcon className="w-5 h-5" />
                            </button>
                        )}
                        {canEditFields && (
                            <button 
                                onClick={() => setIsEditingFields(!isEditingFields)}
                                className={`p-3 rounded-2xl transition-all active:scale-90 shadow-sm ${isEditingFields ? 'bg-primary/10 text-primary' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                            
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onUpdate({ skipped: !result.skipped })}
                            title={result.skipped ? 'Ta med övningen igen' : 'Hoppa över övningen'}
                            className={`p-3 rounded-2xl transition-all active:scale-90 shadow-sm ${result.skipped ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M5.6 5.6l12.8 12.8"></path></svg>
                        </button>
                        {onRemove && (
                            <button 
                                onClick={onRemove}
                                className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all active:scale-90 shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>
                        )}
                    </div>
                </div>

                {canEditFields && inactiveFields.length > 0 && !isEditingFields && (
                    <div className="mt-1">
                        {!showMoreFields ? (
                            <button
                                type="button"
                                onClick={() => setShowMoreFields(true)}
                                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary-light bg-gray-50/80 dark:bg-gray-800/80 hover:bg-primary/10 px-2.5 py-1 rounded-full transition-all border border-gray-200 dark:border-gray-700/60 active:scale-95"
                            >
                                <PlusIcon className="w-3 h-3" />
                                <span>+ fler fält</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 flex-wrap p-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/80 animate-fade-in">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mr-1">Lägg till:</span>
                                {inactiveFields.map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => {
                                            toggleField(f.id as any);
                                            if (inactiveFields.length <= 1) {
                                                setShowMoreFields(false);
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
                                    onClick={() => setShowMoreFields(false)}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1 rounded-lg"
                                    title="Dölj"
                                >
                                    <CloseIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {canEditFields && isEditingFields && (
                    <div className="flex flex-wrap gap-2 mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                        <div className="w-full text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Välj fält att logga</div>
                        {[
                            { id: 'reps', label: 'Reps' },
                            { id: 'weight', label: 'Vikt' },
                            { id: 'time', label: 'Tid' },
                            { id: 'distance', label: 'Distans' },
                            { id: 'kcal', label: 'Kcal' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => toggleField(f.id as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    trackingFields.includes(f.id as any) 
                                        ? 'bg-primary text-white shadow-sm' 
                                        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                                 }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <div className={`grid ${gridColsClass} gap-2 px-1 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider`}>
                        <div className="text-center">Set</div>
                        {showReps && <div className="text-center">Reps</div>}
                        {showWeight && <div className="text-center">Vikt</div>}
                        {showTime && <div className="text-center">Tid</div>}
                        {showDistance && <div className="text-center">Distans</div>}
                        {showKcal && <div className="text-center">Kcal</div>}
                        <div></div>
                        <div className="text-center">Klar</div>
                    </div>

                    {!result.skipped && result.setDetails.map((set, index) => {
                        // Aktiv rad = första oavbockade. Får en färgad kant så den skiljer sig
                        // tydligt från de redan ifyllda, som är nedtonade.
                        const isActiveSet = index === result.setDetails.findIndex(sd => !sd.completed);
                        const isWeightAndRepsOnly = showWeight && showReps && !showTime && !showDistance && !showKcal;
                        const hasValidWeightAndReps = (parseFloat(set.weight) > 0) && (parseFloat(set.reps) > 0);
                        const showRirRow = Boolean(set.completed) && isWeightAndRepsOnly && hasValidWeightAndReps && isStrengthLike;
                        const missingFields = getMissingFields(set);
                        const canComplete = set.completed || missingFields.length === 0;

                        return (
                            <React.Fragment key={index}>
                                <div className={`grid ${gridColsClass} gap-2 items-center transition-all rounded-xl -mx-1.5 px-1.5 py-1 ${set.completed ? 'opacity-50' : 'opacity-100'} ${isActiveSet ? 'ring-2 ring-primary/70 bg-primary/5' : 'ring-0'}`}>
                                    <div className="flex justify-center items-center">
                                        <span className={`text-sm font-black rounded-full w-8 h-8 flex items-center justify-center transition-colors shadow-sm ${set.completed ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{index + 1}</span>
                                    </div>
                                    
                                    {showReps && (
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 shadow-inner">
                                            <input type="text" inputMode="numeric" value={set.reps} onChange={(e) => handleSetChange(index, 'reps', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-xl focus:outline-none text-center" disabled={set.completed} />
                                        </div>
                                    )}
                                    
                                    {showWeight && (
                                        <div className="relative">
                                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 shadow-inner">
                                                <input type="text" inputMode="decimal" value={set.weight} onChange={(e) => handleSetChange(index, 'weight', normalizeDecimalInput(e.target.value))} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-xl focus:outline-none text-center" disabled={set.completed} />
                                            </div>
                                        </div>
                                    )}

                                    {showTime && (
                                        // Min:sek-fälten i stället för en rå sifferruta — ingen kan
                                        // gissa att "12,37" betyder 12 minuter 22 sekunder. Samma
                                        // TimeInput som egna aktiviteter redan använder; värdet
                                        // lagras oförändrat som decimala minuter.
                                        <div className={set.completed ? 'pointer-events-none opacity-60' : ''}>
                                            <TimeInput
                                                value={set.time != null ? String(set.time) : ''}
                                                onChange={(val) => handleSetChange(index, 'time', val)}
                                                compact
                                                className="w-full"
                                            />
                                        </div>
                                    )}

                                    {showDistance && (
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 shadow-inner">
                                            <input type="text" inputMode="decimal" value={set.distance || ''} onChange={(e) => handleSetChange(index, 'distance', normalizeDecimalInput(e.target.value))} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-xl focus:outline-none text-center" disabled={set.completed} />
                                        </div>
                                    )}

                                    {showKcal && (
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 shadow-inner">
                                            <input type="number" inputMode="numeric" value={set.kcal || ''} onChange={(e) => handleSetChange(index, 'kcal', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-xl focus:outline-none text-center" disabled={set.completed} />
                                        </div>
                                    )}

                                    <div className="flex justify-center">
                                        {result.setDetails.length > 1 && (
                                            <button 
                                                onClick={() => handleRemoveSet(index)} 
                                                className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center p-2 active:scale-95 transition-all shadow-sm" 
                                                disabled={set.completed}
                                            >
                                                <CloseIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex justify-center">
                                        <button 
                                            onClick={() => handleToggleComplete(index)} 
                                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-md transform active:scale-90 ${set.completed ? 'bg-green-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'} ${canComplete ? '' : 'opacity-40'}`}
                                        >
                                            {set.completed ? <CheckIcon className="w-6 h-6" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-45" />}
                                        </button>
                                    </div>
                                </div>
                                {invalidSetIdx === index && missingFields.length > 0 && (
                                    <div className="mt-1.5 mb-1 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 animate-fade-in">
                                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                                            Fyll i {missingFields.map(f => FIELD_LABELS[f] || f).join(' och ')} innan du bockar av setet.
                                        </span>
                                    </div>
                                )}
                                {setFeedback && setFeedback.index === index && (
                                    <div className="mt-1.5 mb-1 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/60 animate-fade-in">
                                        <span className="text-xs font-bold text-green-700 dark:text-green-400">
                                            {setFeedback.text}
                                        </span>
                                    </div>
                                )}
                                {showRirRow && (
                                    <div className="mt-1.5 mb-2 p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                            Reps i reserv
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {[
                                                { label: '0', val: 0 },
                                                { label: '1', val: 1 },
                                                { label: '2', val: 2 },
                                                { label: '3+', val: 3 },
                                            ].map(opt => {
                                                const isSelected = set.rir === opt.val;
                                                return (
                                                    <button
                                                        key={opt.val}
                                                        type="button"
                                                        onClick={() => {
                                                            const newRir = isSelected ? null : opt.val;
                                                            handleSetChange(index, 'rir' as any, newRir as any);
                                                        }}
                                                        className={`min-h-[40px] px-3.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
                                                            isSelected
                                                                ? 'bg-primary text-white shadow-sm'
                                                                : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                    {result.skipped && (
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Överhoppad — räknas inte med</span>
                            <button
                                type="button"
                                onClick={() => onUpdate({ skipped: false })}
                                className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 underline underline-offset-2 active:scale-95"
                            >
                                Ångra
                            </button>
                        </div>
                    )}
                    {(!result.groupId && !result.skipped) && (
                        <button onClick={handleAddSet} className="w-full mt-3 py-3.5 flex items-center justify-center gap-2 text-sm font-black text-primary bg-primary/10 hover:bg-primary/15 rounded-xl transition-all border border-primary/30 border-dashed shadow-sm"><PlusIcon className="w-4 h-4" /> Lägg till set</button>
                    )}
                    {(result.groupId && isLastInGroup && onAddGroupSet && !result.skipped) && (
                        <button 
                            onClick={() => {
                                onAddGroupSet();
                                setGroupSetAdded(true);
                                if (groupSetAddedTimerRef.current) clearTimeout(groupSetAddedTimerRef.current);
                                groupSetAddedTimerRef.current = setTimeout(() => setGroupSetAdded(false), 2200);
                            }}
                            className={`w-full mt-3 py-3.5 flex items-center justify-center gap-2 text-sm font-black rounded-xl transition-all border border-dashed shadow-sm ${groupSetAdded ? 'border-solid ring-2 ring-primary/30' : ''} ${textColorClass} ${lightBorderClass} ${lightBgClass}`}
                        >
                            {groupSetAdded
                                ? <>✓ Set {result.setDetails.length} tillagt i hela gruppen</>
                                : <><PlusIcon className="w-4 h-4" /> Lägg till set för gruppen</>}
                        </button>
                    )}
                </div>
                
                {/* Anteckningar för övningen */}
                {isNoteActive && (
                    <AnimatePresence initial={false} mode="wait">
                        {isNoteExpanded ? (
                            <motion.div 
                                key="expanded"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="pt-3 border-t border-gray-100 dark:border-gray-800 overflow-hidden"
                            >
                                {lastPerformance?.note && (
                                    <div className="mb-3 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100/50 dark:border-blue-800/30 shadow-sm">
                                        <span className="block text-xs font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-1">Anteckning:</span>
                                        <p className="text-sm text-blue-900/80 dark:text-blue-200/80 italic leading-relaxed">
                                            "{lastPerformance.note}"
                                        </p>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pl-1 mb-2">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Din anteckning</label>
                                    <button 
                                        onClick={() => setIsNoteExpanded(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center justify-center active:scale-95"
                                        title="Fäll ihop"
                                    >
                                        <span className="transform rotate-180 block text-gray-400 dark:text-gray-500">
                                            <ChevronDownIcon className="w-5 h-5 stroke-[2.5]" />
                                        </span>
                                    </button>
                                </div>
                                <textarea 
                                    value={result.note || ''} 
                                    onChange={(e) => onUpdate({ note: e.target.value })}
                                    placeholder="Lägg till en kommentar..."
                                    className="w-full bg-gray-50/50 dark:bg-gray-800/50 text-sm text-gray-900 dark:text-gray-100 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 focus:outline-none focus:border-primary/55 focus:ring-1 focus:ring-primary/55 transition-all resize-none min-h-[85px] shadow-sm font-medium"
                                />
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="collapsed"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="pt-3 border-t border-dashed border-gray-100 dark:border-gray-800"
                            >
                                <button 
                                    onClick={() => setIsNoteExpanded(true)}
                                    className="w-full flex justify-between items-center pl-1 group focus:outline-none"
                                >
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest group-hover:text-primary transition-colors flex items-center gap-1.5">
                                        Anteckning
                                        {result.note && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
                                    </span>
                                    <span className="text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center active:scale-95 transition-all">
                                        <ChevronDownIcon className="w-5 h-5 stroke-[2.5]" />
                                    </span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
