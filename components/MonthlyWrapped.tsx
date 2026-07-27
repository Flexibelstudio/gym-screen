import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { WorkoutLog, PersonalBest } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { TrophyIcon, SparklesIcon, CloseIcon, ChevronRightIcon, FireIcon, ClockIcon, DumbbellIcon } from './icons';

export interface MonthlyWrappedStats {
    monthName: string; // e.g. "juni"
    monthNameCap: string; // e.g. "Juni"
    year: number; // e.g. 2026
    workoutCount: number; // e.g. 12
    totalMinutes: number; // e.g. 540
    formattedTime: string; // e.g. "9 timmar 0 min"
    topWorkout: { title: string; count: number } | null;
    monthPBs: { exerciseName: string; weight: number; reps?: number }[];
    streakDays: number; // Max consecutive active days in target month
    comparisonDiff: number; // workoutCount - prevWorkoutCount
    prevMonthName: string; // e.g. "maj"
    hasData: boolean;
}

/**
 * Calculates monthly wrapped stats for the LAST COMPLETED calendar month.
 */
export function calculateMonthlyStats(
    logs: WorkoutLog[],
    personalBests: PersonalBest[] = [],
    referenceDate = new Date()
): MonthlyWrappedStats {
    const currentYear = referenceDate.getFullYear();
    const currentMonth = referenceDate.getMonth(); // 0-indexed

    // Target last completed month
    let targetYear = currentYear;
    let targetMonth = currentMonth - 1;
    if (targetMonth < 0) {
        targetMonth = 11;
        targetYear = currentYear - 1;
    }

    // Month before target month (for comparison)
    let prevYear = targetYear;
    let prevMonth = targetMonth - 1;
    if (prevMonth < 0) {
        prevMonth = 11;
        prevYear = targetYear - 1;
    }

    const monthNamesSwedish = [
        "januari", "februari", "mars", "april", "maj", "juni",
        "juli", "augusti", "september", "oktober", "november", "december"
    ];

    const targetMonthStart = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0).getTime();
    const targetMonthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999).getTime();

    const prevMonthStart = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0).getTime();
    const prevMonthEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999).getTime();

    const monthLogs = logs.filter(l => l.date >= targetMonthStart && l.date <= targetMonthEnd);
    const prevMonthLogs = logs.filter(l => l.date >= prevMonthStart && l.date <= prevMonthEnd);

    const workoutCount = monthLogs.length;

    // Total minutes rounded to whole integer (no decimal minutes)
    const totalMinutes = monthLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
    const roundedMinutes = Math.round(totalMinutes);
    const hours = Math.floor(roundedMinutes / 60);
    const mins = roundedMinutes % 60;
    let formattedTime = `${roundedMinutes} min`;
    if (hours > 0) {
        formattedTime = mins > 0 ? `${hours} tim ${mins} min` : `${hours} timmar`;
    }

    // Top workout title or activity
    const workoutCounts: Record<string, number> = {};
    monthLogs.forEach(log => {
        const title = (log.workoutTitle || log.tags?.[0] || 'Träningspass').trim();
        workoutCounts[title] = (workoutCounts[title] || 0) + 1;
    });

    let topWorkout: { title: string; count: number } | null = null;
    let maxCount = 0;
    Object.entries(workoutCounts).forEach(([title, count]) => {
        if (count > maxCount) {
            maxCount = count;
            topWorkout = { title, count };
        }
    });

    // Month PBs (from personalBests list + log.newPBs)
    const monthPBsMap = new Map<string, { exerciseName: string; weight: number; reps?: number }>();
    personalBests.forEach(pb => {
        if (pb.date >= targetMonthStart && pb.date <= targetMonthEnd) {
            const key = pb.exerciseName.toLowerCase().trim();
            monthPBsMap.set(key, { exerciseName: pb.exerciseName, weight: pb.weight, reps: pb.reps });
        }
    });

    monthLogs.forEach(log => {
        if (log.newPBs && Array.isArray(log.newPBs)) {
            log.newPBs.forEach(pb => {
                const key = (pb.exerciseName || '').toLowerCase().trim();
                if (key && !monthPBsMap.has(key)) {
                    monthPBsMap.set(key, { exerciseName: pb.exerciseName, weight: pb.weight, reps: pb.reps });
                }
            });
        }
    });

    const monthPBs = Array.from(monthPBsMap.values());

    // Streak calculation (max consecutive active days in month)
    const activeDates = Array.from(new Set(
        monthLogs.map(l => {
            const d = new Date(l.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })
    )).sort();

    let maxStreak = activeDates.length > 0 ? 1 : 0;
    let currentStreak = activeDates.length > 0 ? 1 : 0;

    for (let i = 1; i < activeDates.length; i++) {
        const prev = new Date(activeDates[i - 1]).getTime();
        const curr = new Date(activeDates[i]).getTime();
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
            currentStreak = 1;
        }
    }

    const comparisonDiff = workoutCount - prevMonthLogs.length;

    const targetMonthName = monthNamesSwedish[targetMonth];
    const monthNameCap = targetMonthName.charAt(0).toUpperCase() + targetMonthName.slice(1);

    return {
        monthName: targetMonthName,
        monthNameCap,
        year: targetYear,
        workoutCount,
        totalMinutes: roundedMinutes,
        formattedTime,
        topWorkout,
        monthPBs,
        streakDays: maxStreak,
        comparisonDiff,
        prevMonthName: monthNamesSwedish[prevMonth],
        hasData: workoutCount > 0
    };
}

interface MonthlyWrappedProps {
    isOpen: boolean;
    onClose: () => void;
    logs: WorkoutLog[];
    personalBests?: PersonalBest[];
    userName: string;
    gymName?: string;
    referenceDate?: Date;
}

export const MonthlyWrappedModal: React.FC<MonthlyWrappedProps> = ({
    isOpen,
    onClose,
    logs,
    personalBests = [],
    userName,
    gymName = 'Mitt gym',
    referenceDate
}) => {
    const stats = useMemo(() => calculateMonthlyStats(logs, personalBests, referenceDate), [logs, personalBests, referenceDate]);
    const [currentStep, setCurrentStep] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Check if user prefers reduced motion
    const prefersReducedMotion = typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    // Build array of active card slides
    const cards = useMemo(() => {
        const list: { id: string; type: string }[] = [
            { id: 'intro', type: 'intro' },
            { id: 'count', type: 'count' },
            { id: 'time', type: 'time' },
            { id: 'favorite', type: 'favorite' },
        ];

        if (stats.monthPBs.length > 0) {
            list.push({ id: 'pbs', type: 'pbs' });
        }

        list.push({ id: 'comparison', type: 'comparison' });
        list.push({ id: 'summary', type: 'summary' });

        return list;
    }, [stats]);

    const totalSteps = cards.length;

    // Auto-advance timer (unless paused or on summary step)
    useEffect(() => {
        if (!stats.hasData) return;
        if (isPaused || currentStep === totalSteps - 1) return;

        const timer = setTimeout(() => {
            setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
        }, 6000);

        return () => clearTimeout(timer);
    }, [currentStep, isPaused, totalSteps, stats.hasData]);

    // Reset step state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(0);
            setIsPaused(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    // --- Empty State ---
    if (!stats.hasData) {
        return createPortal(
            <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative"
                >
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full bg-gray-800/50"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>

                    <div className="w-16 h-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <SparklesIcon className="w-8 h-8" />
                    </div>

                    <h3 className="text-2xl font-black text-white tracking-tight mb-2">
                        Min Månad — {stats.monthNameCap}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Inga pass loggade i {stats.monthName} — ny månad, nya möjligheter! 💪
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-primary hover:brightness-110 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-wider"
                    >
                        Stäng
                    </button>
                </motion.div>
            </div>,
            document.body
        );
    }

    const currentCard = cards[currentStep];

    return createPortal(
        <div 
            className="fixed inset-0 z-[10000] bg-gray-950 text-white flex flex-col justify-between select-none overflow-hidden"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
        >
            {/* Header / Progress Bar & Close */}
            <div className="relative z-30 p-4 pt-6 max-w-md w-full mx-auto pointer-events-auto">
                <div className="flex gap-1.5 mb-4">
                    {cards.map((card, idx) => (
                        <div 
                            key={card.id} 
                            className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden"
                        >
                            <div 
                                className={`h-full bg-white transition-all duration-300 ${
                                    idx < currentStep ? 'w-full' : idx === currentStep ? 'w-full animate-pulse' : 'w-0'
                                }`}
                            />
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-widest text-work px-2.5 py-1 bg-work/20 rounded-full border border-work/30">
                            Min Månad
                        </span>
                        <span className="text-xs font-bold text-gray-400">
                            {stats.monthNameCap} {stats.year}
                        </span>
                    </div>

                    <button 
                        onClick={onClose}
                        className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        aria-label="Stäng"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Tap Navigation Overlays (Left 33% / Right 67%) */}
            <div className="absolute inset-0 z-10 flex pointer-events-auto">
                <div 
                    onClick={handlePrev}
                    className="w-1/3 h-full cursor-pointer"
                    title="Föregående"
                />
                <div 
                    onClick={handleNext}
                    className="w-2/3 h-full cursor-pointer"
                    title="Nästa"
                />
            </div>

            {/* Main Story Content Card */}
            <div className="relative z-20 flex-1 flex items-center justify-center p-4 sm:p-6 max-w-md w-full mx-auto pointer-events-none">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentCard.id}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.05, y: -10 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="w-full pointer-events-auto"
                    >
                        {/* 1. INTRO CARD */}
                        {currentCard.type === 'intro' && (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-sm min-h-[420px] relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-work/20 via-transparent to-transparent pointer-events-none motion-reduce:hidden" />
                                
                                <div className="relative z-10 space-y-6 flex flex-col items-center justify-center my-auto">
                                    <motion.div 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                                        className="w-20 h-20 bg-gradient-to-tr from-work via-amber-500 to-record rounded-3xl flex items-center justify-center shadow-2xl ring-4 ring-white/10"
                                    >
                                        <SparklesIcon className="w-10 h-10 text-white" />
                                    </motion.div>

                                    <div className="space-y-2">
                                        <h2 className="text-xs font-black uppercase tracking-[0.25em] text-work leading-[1.2] pt-[0.1em]">
                                            Träningssummering
                                        </h2>
                                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-[1.2] pt-[0.1em] uppercase">
                                            Din {stats.monthNameCap} <br />
                                            <span className="text-work">
                                                {stats.year}
                                            </span>
                                        </h1>
                                    </div>

                                    <p className="text-gray-300 font-medium text-base max-w-xs leading-relaxed">
                                        Hej {userName}! Dags att fira dina träningsframgångar under månaden.
                                    </p>

                                    <div className="pt-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 animate-bounce motion-reduce:animate-none">
                                        <span>Tryck för att fortsätta</span>
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. WORKOUT COUNT CARD */}
                        {currentCard.type === 'count' && (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-sm min-h-[420px] relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-work/25 via-transparent to-transparent pointer-events-none motion-reduce:hidden" />

                                <div className="relative z-10 space-y-5 flex flex-col items-center justify-center my-auto w-full">
                                    <div className="w-16 h-16 bg-work/20 text-work rounded-2xl flex items-center justify-center border border-work/30">
                                        <DumbbellIcon className="w-8 h-8" />
                                    </div>

                                    <h3 className="text-xs font-black uppercase tracking-[0.25em] text-work leading-[1.2] pt-[0.1em]">
                                        Antal Loggade Pass
                                    </h3>

                                    <motion.div 
                                        initial={{ scale: 0.5 }}
                                        animate={{ scale: 1 }}
                                        className="text-8xl sm:text-9xl font-black text-white font-mono tracking-tight tabular-nums leading-none"
                                    >
                                        {stats.workoutCount}
                                    </motion.div>

                                    <p className="text-2xl font-black text-gray-100 tracking-tight leading-[1.2] pt-[0.1em]">
                                        pass i {stats.monthName}! 🎉
                                    </p>

                                    <p className="text-sm text-gray-300 max-w-xs font-medium leading-relaxed">
                                        Varje pass bygger din hälsa. Riktigt starkt jobbat!
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 3. TOTAL TIME CARD */}
                        {currentCard.type === 'time' && (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-sm min-h-[420px] relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rest/25 via-transparent to-transparent pointer-events-none motion-reduce:hidden" />

                                <div className="relative z-10 space-y-5 flex flex-col items-center justify-center my-auto w-full">
                                    <div className="w-16 h-16 bg-rest/20 text-rest rounded-2xl flex items-center justify-center border border-rest/30">
                                        <ClockIcon className="w-8 h-8" />
                                    </div>

                                    <h3 className="text-xs font-black uppercase tracking-[0.25em] text-rest leading-[1.2] pt-[0.1em]">
                                        Total Träningstid
                                    </h3>

                                    <div className="text-5xl sm:text-6xl font-black text-white tracking-tight tabular-nums my-2 leading-[1.2] pt-[0.1em]">
                                        {stats.formattedTime}
                                    </div>

                                    <p className="text-base font-bold text-gray-200 max-w-xs leading-relaxed">
                                        Nedlagd tid i gymmet under {stats.monthName}.
                                    </p>

                                    <p className="text-xs text-gray-400 font-medium">
                                        Konsistent träning som ger resultat.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 4. FAVORITE WORKOUT CARD */}
                        {currentCard.type === 'favorite' && (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-sm min-h-[420px] relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-work/20 via-transparent to-transparent pointer-events-none motion-reduce:hidden" />

                                <div className="relative z-10 space-y-5 flex flex-col items-center justify-center my-auto w-full">
                                    <div className="w-16 h-16 bg-work/20 text-work rounded-2xl flex items-center justify-center border border-work/30">
                                        <FireIcon className="w-8 h-8" />
                                    </div>

                                    <h3 className="text-xs font-black uppercase tracking-[0.25em] text-work leading-[1.2] pt-[0.1em]">
                                        Mest Körda Pass
                                    </h3>

                                    <div className="p-6 bg-white/5 border border-white/10 rounded-3xl w-full max-w-xs">
                                        <div className="text-2xl sm:text-3xl font-black text-white mb-3 leading-[1.2] pt-[0.1em]">
                                            {stats.topWorkout?.title || 'Blandade Pass'}
                                        </div>
                                        {stats.topWorkout && (
                                            <div className="inline-block px-3 py-1.5 bg-work/20 text-work rounded-full text-xs font-black border border-work/30 uppercase tracking-wider tabular-nums">
                                                Kört {stats.topWorkout.count} gånger
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-300 font-medium">
                                        Din go-to favorit under månaden!
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 5. PBS CARD */}
                        {currentCard.type === 'pbs' && (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-sm min-h-[420px] relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-record/25 via-transparent to-transparent pointer-events-none motion-reduce:hidden" />

                                <div className="relative z-10 space-y-5 flex flex-col items-center justify-center my-auto w-full">
                                    <div className="w-16 h-16 bg-record/20 text-record rounded-2xl flex items-center justify-center border border-record/30">
                                        <TrophyIcon className="w-8 h-8" />
                                    </div>

                                    <h3 className="text-xs font-black uppercase tracking-[0.25em] text-record leading-[1.2] pt-[0.1em]">
                                        Månadens Rekord
                                    </h3>

                                    <div className="space-y-2.5 max-h-56 overflow-y-auto w-full max-w-xs pr-1">
                                        {stats.monthPBs.map((pb, idx) => (
                                            <div 
                                                key={idx}
                                                className="flex items-center justify-between p-3.5 bg-record/10 border border-record/20 rounded-2xl text-left"
                                            >
                                                <span className="font-black text-white text-sm truncate pr-2">
                                                    {pb.exerciseName}
                                                </span>
                                                <span className="font-mono font-black text-record text-base shrink-0 tabular-nums">
                                                    {pb.weight} kg {pb.reps ? `× ${pb.reps}` : ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <p className="text-xs text-record font-bold uppercase tracking-wider">
                                        🏆 Nya milstolpar i hamn!
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 6. COMPARISON & STREAK CARD */}
                        {currentCard.type === 'comparison' && (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-sm min-h-[420px] relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent pointer-events-none motion-reduce:hidden" />

                                <div className="relative z-10 space-y-5 flex flex-col items-center justify-center my-auto w-full">
                                    <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center border border-purple-500/30">
                                        <SparklesIcon className="w-8 h-8" />
                                    </div>

                                    <h3 className="text-xs font-black uppercase tracking-[0.25em] text-purple-400 leading-[1.2] pt-[0.1em]">
                                        Jämförelse & Svit
                                    </h3>

                                    <div className="grid grid-cols-1 gap-3 text-left w-full max-w-xs">
                                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                                Vs. {stats.prevMonthName}
                                            </div>
                                            <div className="text-xl font-black text-white leading-[1.2] pt-[0.1em] tabular-nums">
                                                {stats.comparisonDiff > 0 ? (
                                                    <span className="text-green-400">+{stats.comparisonDiff} pass fler 📈</span>
                                                ) : stats.comparisonDiff < 0 ? (
                                                    <span className="text-work">{stats.comparisonDiff} pass</span>
                                                ) : (
                                                    <span className="text-rest">Samma antal pass 🤝</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                                Aktivitetssvit
                                            </div>
                                            <div className="text-xl font-black text-white leading-[1.2] pt-[0.1em] tabular-nums">
                                                {stats.streakDays > 1 ? `${stats.streakDays} dagar i rad 🔥` : `1 aktiv månad 💪`}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 7. SUMMARY / SHARE CARD */}
                        {currentCard.type === 'summary' && (
                            <div className="space-y-4 w-full">
                                <div className="p-5 bg-gradient-to-b from-gray-900 to-gray-950 border border-white/15 rounded-3xl shadow-2xl text-left relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-work">
                                                Min Månad
                                            </span>
                                            <h4 className="text-xl font-black text-white leading-[1.2] pt-[0.1em] uppercase">
                                                {stats.monthNameCap} {stats.year}
                                            </h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-gray-300 block">
                                                {userName}
                                            </span>
                                            <span className="text-[10px] text-gray-500">
                                                {gymName}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Pass</span>
                                            <span className="text-2xl font-black text-work font-mono tabular-nums">{stats.workoutCount}</span>
                                        </div>

                                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Tid</span>
                                            <span className="text-base font-black text-rest tabular-nums">{stats.formattedTime}</span>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-3">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Mest Körda</span>
                                        <span className="text-sm font-bold text-white truncate block">
                                            {stats.topWorkout?.title || 'Blandade Pass'}
                                        </span>
                                    </div>

                                    {stats.monthPBs.length > 0 && (
                                        <div className="p-3 bg-record/10 rounded-xl border border-record/20 mb-3">
                                            <span className="text-[10px] font-bold text-record uppercase block">Månadens Rekord</span>
                                            <span className="text-xs font-bold text-white truncate block tabular-nums">
                                                {stats.monthPBs[0].exerciseName}: {stats.monthPBs[0].weight} kg
                                                {stats.monthPBs.length > 1 ? ` (+${stats.monthPBs.length - 1} till)` : ''}
                                            </span>
                                        </div>
                                    )}

                                    <div className="text-[10px] text-gray-500 text-center pt-1 border-t border-white/5">
                                        Loggat i SmartStudio • {gymName}
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Controls (Previous / Next Buttons) */}
            <div className="relative z-30 p-6 max-w-md w-full mx-auto flex items-center justify-between text-xs text-gray-400 font-bold pointer-events-auto">
                <button
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
                >
                    ← Bakåt
                </button>

                <span className="tabular-nums">
                    {currentStep + 1} / {totalSteps}
                </span>

                <button
                    onClick={handleNext}
                    disabled={currentStep === totalSteps - 1}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
                >
                    Nästa →
                </button>
            </div>
        </div>,
        document.body
    );
};

