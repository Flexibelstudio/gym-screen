import React, { useState, useEffect, useMemo, useRef } from 'react';
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

    // Total minutes
    const totalMinutes = monthLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    let formattedTime = `${totalMinutes} min`;
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
        totalMinutes,
        formattedTime,
        topWorkout,
        monthPBs,
        streakDays: maxStreak,
        comparisonDiff,
        prevMonthName: monthNamesSwedish[prevMonth],
        hasData: workoutCount > 0
    };
}

/**
 * Generates a 1080x1920 Story Canvas image for sharing.
 */
export const generateWrappedCanvasImage = async (
    stats: MonthlyWrappedStats,
    gymName: string,
    userName: string
): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Glowing subtle accents
    const glow1 = ctx.createRadialGradient(250, 350, 20, 250, 350, 500);
    glow1.addColorStop(0, 'rgba(249, 115, 22, 0.25)');
    glow1.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 1080, 1920);

    const glow2 = ctx.createRadialGradient(850, 1350, 20, 850, 1350, 600);
    glow2.addColorStop(0, 'rgba(168, 85, 247, 0.22)');
    glow2.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, 1080, 1920);

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    };

    // Header badge
    ctx.fillStyle = '#f97316';
    ctx.font = '900 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MIN TRÄNINGSMÅNAD', 540, 170);

    // Month Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 76px sans-serif';
    ctx.fillText(`${stats.monthNameCap.toUpperCase()} ${stats.year}`, 540, 260);

    // Gym Subtitle
    ctx.fillStyle = '#9ca3af';
    ctx.font = '700 32px sans-serif';
    ctx.fillText(gymName || 'SmartSkärm Träning', 540, 315);

    // Main Card Frame
    drawRoundedRect(80, 370, 920, 1360, 48, 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.12)');

    // User Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    ctx.fillText(userName || 'Medlem', 540, 465);

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, 505);
    ctx.lineTo(940, 505);
    ctx.stroke();

    // Stat 1: Workout Count
    drawRoundedRect(130, 545, 400, 240, 28, 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = '#f97316';
    ctx.font = '900 84px sans-serif';
    ctx.fillText(String(stats.workoutCount), 330, 655);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '700 22px sans-serif';
    ctx.fillText('TRÄNINGSPASS', 330, 720);

    // Stat 2: Total Time
    drawRoundedRect(550, 545, 400, 240, 28, 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 42px sans-serif';
    ctx.fillText(stats.formattedTime, 750, 650);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '700 22px sans-serif';
    ctx.fillText('TOTAL TID', 750, 720);

    // Stat 3: Top Workout
    drawRoundedRect(130, 815, 820, 180, 28, 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = '#9ca3af';
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MEST KÖRDA PASS', 170, 865);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px sans-serif';
    ctx.fillText(stats.topWorkout?.title || 'Blandad träning', 170, 925);
    if (stats.topWorkout?.count) {
        ctx.fillStyle = '#f97316';
        ctx.font = '800 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${stats.topWorkout.count} st`, 910, 925);
    }

    // Stat 4: PBs
    ctx.textAlign = 'left';
    drawRoundedRect(130, 1025, 820, 240, 28, 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = '#eab308';
    ctx.font = '700 22px sans-serif';
    ctx.fillText('MÅNADENS REKORD (PB:S)', 170, 1075);
    if (stats.monthPBs.length > 0) {
        const pbText = stats.monthPBs.slice(0, 2).map(p => `${p.exerciseName}: ${p.weight} kg`).join('  •  ');
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 32px sans-serif';
        ctx.fillText(pbText, 170, 1135);
        if (stats.monthPBs.length > 2) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '600 24px sans-serif';
            ctx.fillText(`+ ${stats.monthPBs.length - 2} till rekord`, 170, 1190);
        }
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 32px sans-serif';
        ctx.fillText('Inga nya PB:s den här månaden', 170, 1135);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '600 24px sans-serif';
        ctx.fillText('Redo för nya rekord nästa månad!', 170, 1190);
    }

    // Stat 5: Streak & Comparison
    drawRoundedRect(130, 1295, 820, 180, 28, 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = '#a855f7';
    ctx.font = '700 22px sans-serif';
    ctx.fillText('SVIT & UTVECKLING', 170, 1345);

    const compStr = stats.comparisonDiff > 0
        ? `+${stats.comparisonDiff} pass vs ${stats.prevMonthName}`
        : stats.comparisonDiff < 0
        ? `${stats.comparisonDiff} pass vs ${stats.prevMonthName}`
        : `Lika många pass som i ${stats.prevMonthName}`;
    const streakStr = stats.streakDays > 1 ? `${stats.streakDays} dagar i rad 🔥` : `Aktiv månad 💪`;

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 30px sans-serif';
    ctx.fillText(`${streakStr}  •  ${compStr}`, 170, 1405);

    // Footer
    ctx.fillStyle = '#6b7280';
    ctx.font = '700 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Loggat med SmartSkärm • ${gymName || 'Träning'}`, 540, 1785);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas toBlob failed"));
        }, 'image/png');
    });
};

interface MonthlyWrappedProps {
    isOpen: boolean;
    onClose: () => void;
    logs: WorkoutLog[];
    personalBests?: PersonalBest[];
    userName: string;
    gymName?: string;
}

export const MonthlyWrappedModal: React.FC<MonthlyWrappedProps> = ({
    isOpen,
    onClose,
    logs,
    personalBests = [],
    userName,
    gymName = 'Mitt gym'
}) => {
    if (!isOpen) return null;

    const stats = useMemo(() => calculateMonthlyStats(logs, personalBests), [logs, personalBests]);
    const [currentStep, setCurrentStep] = useState(0);
    const [isSharing, setIsSharing] = useState(false);
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

        // Conditional card: PB:s only if there are any
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

    const handleShare = async () => {
        try {
            setIsSharing(true);
            const blob = await generateWrappedCanvasImage(stats, gymName, userName);
            const fileName = `min-manad-${stats.monthName}-${stats.year}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `Min träningsmånad - ${stats.monthNameCap} ${stats.year}`,
                    text: `Kolla in min träningsmånad för ${stats.monthNameCap}! 💪`,
                    files: [file]
                });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error("Failed to share image", err);
        } finally {
            setIsSharing(false);
        }
    };

    // --- Empty State ---
    if (!stats.hasData) {
        return (
            <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
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
                        className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-wider"
                    >
                        Stäng
                    </button>
                </motion.div>
            </div>
        );
    }

    const currentCard = cards[currentStep];

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-gray-950 text-white flex flex-col justify-between select-none overflow-hidden"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
        >
            {/* Header / Progress Bar & Close */}
            <div className="relative z-30 p-4 pt-6 max-w-md w-full mx-auto">
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
                        <span className="text-xs font-black uppercase tracking-widest text-primary px-2.5 py-1 bg-primary/20 rounded-full border border-primary/30">
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

            {/* Tap Navigation Overlays (Left/Right) */}
            <div className="absolute inset-0 z-20 flex pointer-events-auto">
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
            <div className="relative z-10 flex-1 flex items-center justify-center p-6 max-w-md w-full mx-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentCard.id}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.05, y: -10 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="w-full text-center"
                    >
                        {/* 1. INTRO CARD */}
                        {currentCard.type === 'intro' && (
                            <div className="space-y-6">
                                <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                                    className="w-24 h-24 bg-gradient-to-tr from-primary via-orange-500 to-amber-400 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-primary/40 ring-4 ring-white/10"
                                >
                                    <SparklesIcon className="w-12 h-12 text-white" />
                                </motion.div>

                                <div className="space-y-2">
                                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-orange-400">
                                        Träningssummering
                                    </h2>
                                    <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                                        Din {stats.monthNameCap} <br />
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400">
                                            {stats.year}
                                        </span>
                                    </h1>
                                </div>

                                <p className="text-gray-300 font-medium text-base">
                                    Hej {userName}! Dags att fira dina träningsframgångar under månaden.
                                </p>

                                <div className="pt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 animate-bounce">
                                    <span>Tryck för att fortsätta</span>
                                    <ChevronRightIcon className="w-4 h-4" />
                                </div>
                            </div>
                        )}

                        {/* 2. WORKOUT COUNT CARD */}
                        {currentCard.type === 'count' && (
                            <div className="space-y-6">
                                <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl mx-auto flex items-center justify-center border border-blue-500/30">
                                    <DumbbellIcon className="w-8 h-8" />
                                </div>

                                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-blue-400">
                                    Antal Loggade Pass
                                </h3>

                                <motion.div 
                                    initial={{ scale: 0.5 }}
                                    animate={{ scale: 1 }}
                                    className="text-7xl sm:text-8xl font-black text-white font-mono tracking-tight"
                                >
                                    {stats.workoutCount}
                                </motion.div>

                                <p className="text-xl font-bold text-gray-200">
                                    pass genomförda i {stats.monthName}! 🎉
                                </p>

                                <p className="text-sm text-gray-400 max-w-xs mx-auto">
                                    Varje enskilt pass för dig närmare dina mål. Grymt jobbat!
                                </p>
                            </div>
                        )}

                        {/* 3. TOTAL TIME CARD */}
                        {currentCard.type === 'time' && (
                            <div className="space-y-6">
                                <div className="w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-2xl mx-auto flex items-center justify-center border border-cyan-500/30">
                                    <ClockIcon className="w-8 h-8" />
                                </div>

                                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400">
                                    Total Träningstid
                                </h3>

                                <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                                    {stats.formattedTime}
                                </div>

                                <p className="text-base font-medium text-gray-300 max-w-xs mx-auto">
                                    Nedlagda minuter av ren dedikation under {stats.monthName}.
                                </p>
                            </div>
                        )}

                        {/* 4. FAVORITE WORKOUT CARD */}
                        {currentCard.type === 'favorite' && (
                            <div className="space-y-6">
                                <div className="w-16 h-16 bg-orange-500/20 text-orange-400 rounded-2xl mx-auto flex items-center justify-center border border-orange-500/30">
                                    <FireIcon className="w-8 h-8" />
                                </div>

                                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-orange-400">
                                    Mest Körda Pass
                                </h3>

                                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                                    <div className="text-2xl sm:text-3xl font-black text-white mb-2">
                                        {stats.topWorkout?.title || 'Blandade Pass'}
                                    </div>
                                    {stats.topWorkout && (
                                        <div className="inline-block px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-xs font-bold border border-orange-500/30">
                                            Kört {stats.topWorkout.count} gånger
                                        </div>
                                    )}
                                </div>

                                <p className="text-sm text-gray-400">
                                    Din absoluta favorit under månaden!
                                </p>
                            </div>
                        )}

                        {/* 5. PBS CARD */}
                        {currentCard.type === 'pbs' && (
                            <div className="space-y-6">
                                <div className="w-16 h-16 bg-yellow-500/20 text-yellow-400 rounded-2xl mx-auto flex items-center justify-center border border-yellow-500/30">
                                    <TrophyIcon className="w-8 h-8" />
                                </div>

                                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-yellow-400">
                                    Månadens Personliga Rekord
                                </h3>

                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {stats.monthPBs.map((pb, idx) => (
                                        <div 
                                            key={idx}
                                            className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-left"
                                        >
                                            <span className="font-bold text-white text-sm">
                                                {pb.exerciseName}
                                            </span>
                                            <span className="font-mono font-black text-yellow-400 text-base">
                                                {pb.weight} kg {pb.reps ? `× ${pb.reps}` : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-xs text-yellow-200/70 font-semibold">
                                    🏆 Ny milstolpe nådd!
                                </p>
                            </div>
                        )}

                        {/* 6. COMPARISON & STREAK CARD */}
                        {currentCard.type === 'comparison' && (
                            <div className="space-y-6">
                                <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl mx-auto flex items-center justify-center border border-purple-500/30">
                                    <SparklesIcon className="w-8 h-8" />
                                </div>

                                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-purple-400">
                                    Månadsjämförelse & Svit
                                </h3>

                                <div className="grid grid-cols-1 gap-4 text-left">
                                    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            Vs. {stats.prevMonthName}
                                        </div>
                                        <div className="text-2xl font-black text-white">
                                            {stats.comparisonDiff > 0 ? (
                                                <span className="text-green-400">+{stats.comparisonDiff} pass fler 📈</span>
                                            ) : stats.comparisonDiff < 0 ? (
                                                <span className="text-orange-400">{stats.comparisonDiff} pass</span>
                                            ) : (
                                                <span className="text-blue-400">Samma antal pass 🤝</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            Längsta Träningssvit
                                        </div>
                                        <div className="text-2xl font-black text-white">
                                            {stats.streakDays > 1 ? `${stats.streakDays} dagar i rad 🔥` : `1 aktiv månad 💪`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 7. SUMMARY / SHARE CARD */}
                        {currentCard.type === 'summary' && (
                            <div className="space-y-5">
                                <div className="p-5 bg-gradient-to-b from-gray-900 to-gray-950 border border-white/15 rounded-3xl shadow-2xl text-left relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                                Min Månad
                                            </span>
                                            <h4 className="text-xl font-black text-white leading-tight">
                                                {stats.monthNameCap} {stats.year}
                                            </h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-gray-400 block">
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
                                            <span className="text-2xl font-black text-primary font-mono">{stats.workoutCount}</span>
                                        </div>

                                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Tid</span>
                                            <span className="text-base font-black text-cyan-400">{stats.formattedTime}</span>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-3">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Mest Körda</span>
                                        <span className="text-sm font-bold text-white truncate block">
                                            {stats.topWorkout?.title || 'Blandade Pass'}
                                        </span>
                                    </div>

                                    {stats.monthPBs.length > 0 && (
                                        <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 mb-3">
                                            <span className="text-[10px] font-bold text-yellow-400 uppercase block">Månadens Rekord</span>
                                            <span className="text-xs font-bold text-white truncate block">
                                                {stats.monthPBs[0].exerciseName}: {stats.monthPBs[0].weight} kg
                                                {stats.monthPBs.length > 1 ? ` (+${stats.monthPBs.length - 1} till)` : ''}
                                            </span>
                                        </div>
                                    )}

                                    <div className="text-[10px] text-gray-500 text-center pt-1 border-t border-white/5">
                                        Loggat i SmartSkärm • {gymName}
                                    </div>
                                </div>

                                <div className="space-y-3 pointer-events-auto">
                                    <button
                                        onClick={handleShare}
                                        disabled={isSharing}
                                        className="w-full py-4 bg-gradient-to-r from-primary to-orange-500 hover:from-primary-dark hover:to-orange-600 text-white font-black rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm uppercase tracking-wider"
                                    >
                                        <SparklesIcon className="w-5 h-5" />
                                        {isSharing ? 'Genererar bild...' : 'Dela din månad'}
                                    </button>

                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 bg-white/10 hover:bg-white/20 text-gray-300 font-bold rounded-2xl transition-colors text-xs uppercase tracking-wider"
                                    >
                                        Stäng
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Controls (Previous / Next Buttons) */}
            <div className="relative z-30 p-6 max-w-md w-full mx-auto flex items-center justify-between text-xs text-gray-400 font-bold">
                <button
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
                >
                    ← Bakåt
                </button>

                <span>
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
        </div>
    );
};
