
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Organization, Workout, UserData, BenchmarkDefinition } from '../../types';
import { DumbbellIcon, BuildingIcon, UsersIcon, SpeakerphoneIcon, SparklesIcon, CopyIcon, PencilIcon, TrashIcon, ShuffleIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, TrophyIcon, EyeIcon, ChartBarIcon, PlusIcon } from '../icons';
import { motion, AnimatePresence } from 'framer-motion';
import { AIGeneratorScreen } from '../AIGeneratorScreen';
import { WorkoutBuilderScreen } from '../WorkoutBuilderScreen';
import { deepCopyAndPrepareAsNew, getWorkoutStatusInfo, getWorkoutVisibilityIssues, isWorkoutLoggable, OTHER_CATEGORY } from '../../utils/workoutUtils';
import { ManageBenchmarksModal, FeatureInfoModal } from './AdminModals';
import { updateOrganizationBenchmarks, updateOrganizationWorkoutFolders, resolveAndCreateExercises, updateGlobalConfig, listenToGlobalSummerChallenge, listenToMembers, listenToCommunityLogs, listenToCommunityLogsByLocations, getOrganizationLogs, getSmartScreenPricing } from '../../services/firebaseService';
import { WorkoutPresentationModal } from '../WorkoutDetailScreen';

// ... (Types and Interfaces remain same)

type AdminTab = 
    'dashboard' | 
    'pass-program' | 'infosidor' | 'info-karusell' |
    'globala-installningar' | 'studios' | 'varumarke' | 'company-info' |
    'medlemmar' | 'ovningsbank' | 'analytics';

interface DashboardContentProps {
    organization: Organization;
    workouts: Workout[];
    workoutsLoading: boolean;
    setActiveTab?: (tab: AdminTab) => void;
    admins?: UserData[];
    coaches?: UserData[];
    usersLoading?: boolean;
    onQuickGenerate?: (prompt: string) => Promise<void>;
    onTriggerUpgrade?: () => void;
}

// ... (WelcomeBanner, SetupProgressWidget, QuickAIWidget, DashboardContent components remain the same)
// ... (Skipping to PassProgramContent where handleCopyToLibrary is located)
const WelcomeBanner: React.FC<{ name: string }> = ({ name }) => (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden mb-10">
        <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-2 tracking-tight">
                Hej, {name}! 👋
            </h1>
            <p className="text-purple-100 text-lg max-w-xl">
                Redo att skapa magi för dina medlemmar? Här har du full kontroll över din studio.
            </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="absolute left-0 bottom-0 w-48 h-48 bg-purple-800/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>
    </div>
);

const SetupProgressWidget: React.FC<{
    org: Organization;
    workoutCount: number;
    studioCount: number;
}> = ({ org, workoutCount, studioCount }) => {
    const DEFAULT_COLOR = '#14b8a6';
    
    const steps = [
        { label: "Ladda upp logotyp", completed: !!(org.logoUrlLight || org.logoUrlDark) },
        { label: "Välj primärfärg", completed: (org.primaryColor || DEFAULT_COLOR).toLowerCase() !== DEFAULT_COLOR },
        { label: "Anpassa kategorier", completed: (org.globalConfig.customCategories || []).length > 0 },
        { label: "Skapa första skärmen", completed: studioCount > 0 },
        { label: "Skapa första passet", completed: workoutCount > 0 },
    ];

    const completedCount = steps.filter(s => s.completed).length;
    const totalSteps = steps.length;
    const progress = (completedCount / totalSteps) * 100;

    if (progress === 100) return null; // Hide when done

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Kom igång med SmartStudio</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Din checklista för en komplett upplevelse.</p>
                </div>
                <span className="font-bold text-primary">{completedCount}/{totalSteps} klart</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
                <motion.div 
                    className="bg-primary h-3 rounded-full" 
                    initial={{ width: 0 }} 
                    animate={{ width: `${progress}%` }} 
                    transition={{ duration: 1 }}
                />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {steps.map((step, i) => (
                    <div key={i} className={`text-xs font-medium flex items-center gap-2 ${step.completed ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                        <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border ${step.completed ? 'bg-green-100 border-green-200 dark:bg-green-900/30' : 'border-gray-300'}`}>
                            {step.completed && "✓"}
                        </span>
                        {step.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

const QuickAIWidget: React.FC<{ onGenerate: (prompt: string) => void }> = ({ onGenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        setIsLoading(true);
        await onGenerate(prompt);
        setIsLoading(false);
    };

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 text-white shadow-lg mb-10 relative overflow-hidden border border-gray-700/50">
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">Snabbgenerator</h3>
                </div>
                <p className="text-gray-400 mb-6">
                    Inget krångel. Berätta vad du behöver, så bygger AI:n passet åt dig direkt.
                </p>
                <form onSubmit={handleSubmit} className="relative">
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="t.ex. 'Ett tufft benpass på 45 minuter med kettlebells'..." 
                        className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-xl py-4 pl-5 pr-32 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white/15 transition-all"
                    />
                    <button 
                        type="submit"
                        disabled={!prompt.trim() || isLoading}
                        className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">Jobbar...</span>
                        ) : (
                            <>
                                <span>Skapa</span>
                                <span>✨</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl"></div>
        </div>
    );
};

const ChallengePromoWidget: React.FC<{ org: Organization }> = ({ org }) => {
    const [challenge, setChallenge] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [localEnabled, setLocalEnabled] = useState(!!org.globalConfig?.enableSummerChallenge);
    const [members, setMembers] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        setLocalEnabled(!!org.globalConfig?.enableSummerChallenge);
    }, [org.globalConfig?.enableSummerChallenge]);

    useEffect(() => {
        const unsubscribe = listenToGlobalSummerChallenge((data) => {
            setChallenge(data);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!org.id || !localEnabled) return;
        const unsubMembers = listenToMembers(org.id, (data) => setMembers(data));
        const locIds = org.locations?.map(l => l.id) || [];
        const unsubLogs = locIds.length > 0 
            ? listenToCommunityLogsByLocations(org.id, locIds, (data) => setLogs(data))
            : listenToCommunityLogs(org.id, (data) => setLogs(data));
        return () => {
            unsubMembers();
            unsubLogs();
        };
    }, [org.id, localEnabled]);

    const handleActivate = async () => {
        setIsSaving(true);
        try {
            await updateGlobalConfig(org.id, {
                ...(org.globalConfig || {}),
                enableSummerChallenge: true
            });
            setLocalEnabled(true);
            alert("Sommarutmaningen har aktiverats! Dina medlemmar kan nu se och delta i utmaningen med spelschema och termometer i sina appar.");
        } catch (e) {
            alert("Kunde inte aktivera utmaningen.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!challenge || !challenge.isPublished) return null;

    const nowMs = Date.now();
    const graceEnd = challenge.endDate ? challenge.endDate + 7 * 24 * 60 * 60 * 1000 : 0;
    const isChallengeEnded = challenge.endDate ? nowMs > challenge.endDate : false;
    const isExpired = challenge.endDate ? nowMs > graceEnd : false;

    // Om utmaningen har löpt ut helt (mer än 1 vecka efter slutdatum), visa den inte alls
    if (isExpired) return null;

    const startStr = challenge.startDate ? new Date(challenge.startDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : '';
    const endStr = challenge.endDate ? new Date(challenge.endDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : '';

    const challengeId = challenge.startDate && challenge.endDate
        ? `summer_${challenge.startDate}_${challenge.endDate}`
        : (challenge.id || 'default');

    // Beräkna realtidssatstistik för detta gym
    const activeChallengeMembers = members.filter(m => m.joinedSummerChallenge && m.joinedChallengeId === challengeId);
    const participantsCount = activeChallengeMembers.length;

    const challengeLogs = logs.filter(l => {
        if (!challenge.startDate || !challenge.endDate) return false;
        return l.date >= challenge.startDate && l.date <= challenge.endDate;
    });

    let gymGrandTotalPoints = 0;
    challengeLogs.forEach(log => {
        const uid = log.memberId;
        if (!uid) return;
        const logMember = activeChallengeMembers.find(m => m.uid === uid);
        if (!logMember) return;
        const logTime = log.date || 0;
        if (logTime < (logMember.joinedSummerChallengeAt || 0)) return;

        let pts = 0;
        if (log.inStudio === true) {
            pts = 2;
        } else {
            const isLessThan30 = log.durationMinutes !== undefined && log.durationMinutes > 0 && log.durationMinutes < 30;
            if (!isLessThan30) {
                pts = 1;
            }
        }
        gymGrandTotalPoints += pts;
    });

    // Veckostatistik (nuvarande vecka)
    const now = new Date();
    const currentDay = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (currentDay - 1));
    monday.setHours(0, 0, 0, 0);

    const thisWeeksLogs = challengeLogs.filter(log => (log.date || 0) >= monday.getTime());
    let gymThisWeekPoints = 0;
    thisWeeksLogs.forEach(log => {
        const uid = log.memberId;
        if (!uid) return;
        const logMember = activeChallengeMembers.find(m => m.uid === uid);
        if (!logMember) return;
        const logTime = log.date || 0;
        if (logTime < (logMember.joinedSummerChallengeAt || 0)) return;

        let pts = 0;
        if (log.inStudio === true) {
            pts = 2;
        } else {
            const isLessThan30 = log.durationMinutes !== undefined && log.durationMinutes > 0 && log.durationMinutes < 30;
            if (!isLessThan30) {
                pts = 1;
            }
        }
        gymThisWeekPoints += pts;
    });

    let clubWeeklyTarget = 0;
    activeChallengeMembers.forEach(m => {
        const baseGoal = m.summerChallengeGoals?.[monday.getTime()] !== undefined
            ? m.summerChallengeGoals[monday.getTime()]
            : (m.summerChallengeGoal || 3);
        
        let goalVal = baseGoal;
        const joinedAt = m.joinedSummerChallengeAt || 0;
        if (joinedAt >= monday.getTime() && joinedAt < monday.getTime() + 7 * 24 * 60 * 60 * 1000) {
            const joinDate = new Date(joinedAt);
            const joinDay = joinDate.getDay() || 7;
            const daysLeft = Math.max(0, 7 - joinDay);
            goalVal = Math.max(1, Math.round((daysLeft / 7) * baseGoal));
        }
        clubWeeklyTarget += goalVal;
    });
    if (clubWeeklyTarget <= 0) {
        clubWeeklyTarget = 3 * Math.max(1, participantsCount);
    }
    const completionPercentage = clubWeeklyTarget > 0 ? Math.round((gymThisWeekPoints / clubWeeklyTarget) * 100) : 0;

    let temperatureLabel = 'SVALT';
    let temperatureEmoji = '❄️';
    if (completionPercentage >= 110) {
        temperatureLabel = 'ÖVERHETTNING';
        temperatureEmoji = '🌋';
    } else if (completionPercentage >= 100) {
        temperatureLabel = 'HET';
        temperatureEmoji = '🔥';
    } else if (completionPercentage >= 70) {
        temperatureLabel = 'VARM';
        temperatureEmoji = '☀️';
    } else if (completionPercentage >= 40) {
        temperatureLabel = 'LJUMMEN';
        temperatureEmoji = '🌤️';
    }

    if (isChallengeEnded && localEnabled) {
        // Vacker sammanfattning efter avslutad utmaning
        return (
            <div className="bg-gradient-to-br from-amber-600 via-orange-500 to-amber-900 text-white p-6 sm:p-8 rounded-[2rem] border-none shadow-[0_12px_40px_rgba(249,115,22,0.18)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 mb-8 text-left relative overflow-hidden">
                <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white/10 rounded-full blur-[60px] pointer-events-none"></div>
                <div className="flex-1 space-y-3 relative z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-3xl animate-pulse">🏆</span>
                        <span className="text-xs font-black uppercase tracking-widest text-amber-200">Avslutad Utmaning • Slutresultat</span>
                    </div>
                    <h3 className="text-xl sm:text-3xl font-black tracking-tight leading-none text-white">
                        {challenge.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-amber-100 font-medium max-w-2xl leading-relaxed">
                        Utmaningen är officiellt avslutad! Era medlemmar kämpade fantastiskt. Nedan ser du gymmet sammanställda slutresultat. Denna rapport ligger kvar till <strong>{new Date(graceEnd).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}</strong> innan den försvinner helt.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                        <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                            <span className="block text-[10px] font-bold uppercase text-amber-200/80 mb-0.5 leading-none">Deltagare</span>
                            <span className="text-lg font-black leading-none">{participantsCount} st</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                            <span className="block text-[10px] font-bold uppercase text-amber-200/80 mb-0.5 leading-none">Totala poäng</span>
                            <span className="text-lg font-black leading-none">{gymGrandTotalPoints} p</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
                            <span className="block text-[10px] font-bold uppercase text-amber-200/80 mb-0.5 leading-none">Slutlig temp</span>
                            <span className="text-sm font-black bg-white/20 px-2 py-1 rounded-lg inline-flex items-center gap-1 mt-0.5">{temperatureLabel} {temperatureEmoji}</span>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 flex items-center justify-center relative z-10">
                    <div className="w-16 h-16 bg-amber-400/20 text-yellow-300 rounded-3xl flex items-center justify-center text-3xl border border-white/20 shadow-lg animate-bounce [animation-duration:4s]">
                        🥇
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-900/10 p-6 sm:p-8 rounded-[2rem] border border-amber-200/40 dark:border-amber-900/40 shadow-sm flex flex-col items-stretch justify-between gap-6 mb-8 text-left transition-all duration-300">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl animate-spin [animation-duration:12s]">☀️</span>
                        <span className="text-xs font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">Officiell Utmaning</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-amber-950 dark:text-amber-100 tracking-tight leading-none">
                        {challenge.title}
                    </h3>
                    {challenge.startDate && challenge.endDate && (
                        <div className="flex flex-wrap gap-2 items-center text-xs font-bold text-amber-900/80 dark:text-amber-300 font-mono">
                             <span>Giltighetsperiod: {startStr} - {endStr}</span>
                             <span className="px-2 py-0.5 rounded-md bg-amber-950/15 dark:bg-amber-100/10 text-amber-950 dark:text-amber-100 font-sans">
                                 {(() => {
                                     const startDiff = challenge.startDate - Date.now();
                                     const endDiff = challenge.endDate - Date.now();
                                     const daysToStart = Math.max(0, Math.ceil(startDiff / (1000 * 60 * 60 * 24)));
                                     const daysRemaining = Math.max(0, Math.ceil(endDiff / (1000 * 60 * 60 * 24)));
                                     if (daysToStart > 0) return `⏳ Startar om ${daysToStart} dagar`;
                                     if (daysRemaining === 0) return `⏳ Avslutas idag!`;
                                     return `⏳ ${daysRemaining} dagar kvar`;
                                 })()}
                             </span>
                        </div>
                    )}
                    {challenge.description && (
                        <p className="text-xs sm:text-sm text-amber-900/80 dark:text-amber-200/70 leading-relaxed max-w-2xl font-medium">
                            {challenge.description}
                        </p>
                    )}
                </div>

                <div className="shrink-0 w-full md:w-auto">
                    {localEnabled ? (
                        <div className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 py-3 px-5 rounded-2xl text-center text-xs font-black uppercase tracking-wider h-auto flex items-center justify-center gap-2">
                            <span>🟢</span> Aktiv på ert gym
                        </div>
                    ) : (
                        <button
                            onClick={handleActivate}
                            disabled={isSaving}
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white font-black uppercase text-xs tracking-wider py-4 px-6 rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                            {isSaving ? 'Aktiverar...' : 'Aktivera på vårt gym! 🚀'}
                        </button>
                    )}
                </div>
            </div>

            {/* Realtids-statistik i admin (visas endast om utmaningen är aktiv på detta gym) */}
            {localEnabled && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 pt-5 border-t border-amber-950/10 dark:border-amber-100/15 text-amber-950 dark:text-amber-100">
                    <div className="bg-white/40 dark:bg-black/10 p-3 rounded-2xl border border-amber-950/5 dark:border-white/5">
                        <span className="block text-[10px] font-black uppercase text-amber-900/60 dark:text-amber-400/60 leading-none mb-1">Anmälda deltagare</span>
                        <span className="text-lg font-black font-sans leading-none">{participantsCount} st</span>
                    </div>
                    <div className="bg-white/40 dark:bg-black/10 p-3 rounded-2xl border border-amber-950/5 dark:border-white/5">
                        <span className="block text-[10px] font-black uppercase text-amber-900/60 dark:text-amber-400/60 leading-none mb-1">Totala poäng</span>
                        <span className="text-lg font-black font-sans leading-none">{gymGrandTotalPoints} p</span>
                    </div>
                    <div className="bg-white/40 dark:bg-black/10 p-3 rounded-2xl border border-amber-950/5 dark:border-white/5">
                        <span className="block text-[10px] font-black uppercase text-amber-900/60 dark:text-amber-400/60 leading-none mb-1">Gymmet denna vecka</span>
                        <span className="text-lg font-black font-sans leading-none">{gymThisWeekPoints} / {clubWeeklyTarget} p</span>
                    </div>
                    <div className="bg-white/40 dark:bg-black/10 p-3 rounded-2xl border border-amber-950/5 dark:border-white/5">
                        <span className="block text-[10px] font-black uppercase text-amber-900/60 dark:text-amber-400/60 leading-none mb-1.5">Nuvarande temperatur</span>
                        <span className="text-xs font-black bg-amber-950/15 dark:bg-white/10 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 leading-none">{temperatureLabel} {temperatureEmoji}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const MemberAppSalesCard: React.FC<{ onTriggerUpgrade?: () => void; onShowInfo: () => void }> = ({ onTriggerUpgrade, onShowInfo }) => {
    const [baseCost, setBaseCost] = useState(19);
    const customerPrice = 39;

    useEffect(() => {
        getSmartScreenPricing().then(pricing => {
            if (pricing && pricing.workoutLoggingPricePerMember !== undefined) {
                setBaseCost(pricing.workoutLoggingPricePerMember);
            }
        }).catch(() => {});
    }, []);

    const gymShare = Math.max(0, customerPrice - baseCost);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <ChartBarIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-1">
                        Den som ser att det går framåt säger inte upp sitt medlemskap.
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Medlemsappen ger era medlemmar svart på vitt att träningen ger resultat — och er en bild av vem som är på väg bort, medan ni fortfarande kan göra något åt det.
                    </p>
                </div>
            </div>

            <ul className="space-y-3 mb-6 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex gap-3">
                    <span className="text-indigo-500 font-black">›</span>
                    <span><strong className="text-gray-900 dark:text-white">Se vilka som håller i.</strong> Registret visar vem som loggat den senaste tiden och vem som inte synts på tre veckor. I tid för att höra av er.</span>
                </li>
                <li className="flex gap-3">
                    <span className="text-indigo-500 font-black">›</span>
                    <span><strong className="text-gray-900 dark:text-white">Medlemmen ser sin egen utveckling.</strong> Vikter, reps och personbästa pass för pass, i grafer som gör framstegen svåra att missa. Och hur styrkan ligger till mot Strength Levels databas — nybörjare, motionär, stark, mycket stark, elit — i deras egen ålders- och viktklass.</span>
                </li>
                <li className="flex gap-3">
                    <span className="text-indigo-500 font-black">›</span>
                    <span><strong className="text-gray-900 dark:text-white">Ge dem något att sikta på.</strong> Lägg upp era egna benchmarks: 2 000 m på roddmaskinen, max antal armhävningar, vad ni vill. Medlemmarna testar sig, ser sin tid och jagar den nästa gång.</span>
                </li>
                <li className="flex gap-3">
                    <span className="text-indigo-500 font-black">›</span>
                    <span><strong className="text-gray-900 dark:text-white">Och tjäna på det.</strong> {gymShare} kr per ansluten medlem och månad, rakt in till er.</span>
                </li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => onTriggerUpgrade && onTriggerUpgrade()} className="flex-1 bg-primary hover:brightness-110 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-95">
                    Räkna på vad det ger
                </button>
                <button onClick={onShowInfo} className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-3 px-6 rounded-xl transition-colors">
                    Så funkar Medlemsappen
                </button>
            </div>
        </div>
    );
};

const MemberAppStatsPanel: React.FC<{ organizationId: string; joinSlideActive: boolean; onOpenAnalytics?: () => void; onOpenInfoCarousel?: () => void }> = ({ organizationId, joinSlideActive, onOpenAnalytics, onOpenInfoCarousel }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!organizationId) return;
        let cancelled = false;
        setIsLoading(true);
        getOrganizationLogs(organizationId, 500)
            .then(data => { if (!cancelled) { setLogs(data || []); setIsLoading(false); } })
            .catch(() => { if (!cancelled) { setLogs([]); setIsLoading(false); } });
        return () => { cancelled = true; };
    }, [organizationId]);

    const summary = useMemo(() => {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const recent = logs.filter(l => (l.date || 0) >= cutoff);
        const members = new Set(recent.map(l => l.memberId).filter(Boolean));
        const rpeValues = recent.map(l => l.rpe).filter(r => typeof r === 'number' && r > 0);
        const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;
        return { passCount: recent.length, memberCount: members.size, avgRpe };
    }, [logs]);

    const cells = [
        { label: 'Loggade pass', value: isLoading ? '...' : String(summary.passCount) },
        { label: 'Medlemmar som loggat', value: isLoading ? '...' : String(summary.memberCount) },
        { label: 'Snitt-RPE', value: isLoading ? '...' : (summary.avgRpe !== null ? summary.avgRpe.toFixed(1) : '–') }
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                        <ChartBarIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Medlemsappen</h3>
                        <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Senaste 30 dagarna</p>
                    </div>
                </div>
                {onOpenAnalytics && (
                    <button onClick={onOpenAnalytics} className="text-sm font-bold text-primary hover:underline flex-shrink-0">
                        Analys &amp; Trender →
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {cells.map(cell => (
                    <div key={cell.label} className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{cell.label}</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{cell.value}</p>
                    </div>
                ))}
            </div>

            {!isLoading && summary.passCount === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                    Inga loggade pass den senaste månaden än. Bjud in era medlemmar under Studios/Orter så börjar siffrorna fyllas på.
                </p>
            )}

            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {joinSlideActive ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-bold text-green-600 dark:text-green-400">QR-sliden rullar på skärmen.</span> Nya medlemmar kan skanna sig in i appen direkt från golvet.
                    </p>
                ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-bold text-amber-600 dark:text-amber-400">QR-sliden är avstängd.</span> Slå på den så visar skärmen en kod som medlemmarna kan skanna för att komma igång i appen.
                    </p>
                )}
                {onOpenInfoCarousel && (
                    <button onClick={onOpenInfoCarousel} className="text-sm font-bold text-primary hover:underline flex-shrink-0 self-start sm:self-auto">
                        Info-karusell →
                    </button>
                )}
            </div>
        </div>
    );
};

const DashboardContent: React.FC<DashboardContentProps> = ({ organization, workouts, workoutsLoading, setActiveTab, admins, coaches, usersLoading, onQuickGenerate, onTriggerUpgrade }) => {
    
    // Filtrera bort medlems-utkast (justeringar) från admin-översikten
    const officialWorkouts = useMemo(() => workouts.filter(w => !w.isMemberDraft), [workouts]);
    const publishedWorkouts = useMemo(() => officialWorkouts.filter(w => w.isPublished), [officialWorkouts]);
    const recentWorkouts = useMemo(() => [...officialWorkouts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5), [officialWorkouts]);

    const [showMemberAppInfo, setShowMemberAppInfo] = useState(false);
    const hasMemberApp = !!organization.globalConfig?.enableWorkoutLogging;
    const joinSlideActive = !!(organization.infoCarousel?.isEnabled && organization.infoCarousel?.enableJoinSlide);

    const stats = [
        { label: 'Publicerade Pass', value: workoutsLoading ? '...' : publishedWorkouts.length, icon: DumbbellIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { label: 'Aktiva Skärmar', value: organization.studios.length, icon: BuildingIcon, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        { label: 'Teammedlemmar', value: usersLoading ? '...' : admins.length + coaches.length, icon: UsersIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <WelcomeBanner name={organization.name} />

            <ChallengePromoWidget org={organization} />

            {hasMemberApp ? (
                <MemberAppStatsPanel
                    organizationId={organization.id}
                    joinSlideActive={joinSlideActive}
                    onOpenAnalytics={setActiveTab ? () => setActiveTab('analytics') : undefined}
                    onOpenInfoCarousel={setActiveTab ? () => setActiveTab('info-karusell') : undefined}
                />
            ) : (
                <MemberAppSalesCard
                    onTriggerUpgrade={onTriggerUpgrade}
                    onShowInfo={() => setShowMemberAppInfo(true)}
                />
            )}
            
            <SetupProgressWidget 
                org={organization} 
                workoutCount={officialWorkouts.length} 
                studioCount={organization.studios.length} 
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                <div className="lg:col-span-2">
                    <QuickAIWidget onGenerate={onQuickGenerate} />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {stats.map(stat => (
                            <div key={stat.label} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-32 transition-transform hover:-translate-y-1 duration-300 group">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                                    <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                                        <stat.icon className="w-5 h-5" />
                                    </div>
                                </div>
                                <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                            <h3 className="font-bold text-gray-900 dark:text-white">Senaste Pass</h3>
                            <button onClick={() => setActiveTab('pass-program')} className="text-xs font-bold text-primary hover:text-primary/80 uppercase tracking-wide">Visa alla</button>
                        </div>
                        <div className="p-2">
                            {workoutsLoading ? (
                                <p className="p-4 text-center text-gray-400 text-sm">Laddar...</p>
                            ) : recentWorkouts.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="text-gray-400 text-sm italic mb-2">Inga pass ännu.</p>
                                    <button onClick={() => setActiveTab('pass-program')} className="text-primary text-sm font-semibold hover:underline">Skapa ditt första!</button>
                                </div>
                            ) : (
                                <ul className="space-y-1">
                                    {recentWorkouts.map(w => (
                                        <li key={w.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-xl transition-colors">
                                            <div className={`w-2 h-2 rounded-full ${w.isPublished ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <div className="flex-grow min-w-0">
                                                <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{w.title}</p>
                                                <p className="text-xs text-gray-500 truncate">{w.category || 'Okategoriserad'}</p>
                                            </div>
                                            <span className="text-xs text-gray-400 font-mono">
                                                {new Date(w.createdAt || 0).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Genvägar</h3>
                        <div className="space-y-2">
                            <button onClick={() => setActiveTab('medlemmar')} className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group">
                                <span className="w-5 h-5 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">👥</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hantera Team</span>
                            </button>
                            <button onClick={() => setActiveTab('info-karusell')} className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group">
                                <span className="w-5 h-5 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">📢</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Uppdatera Karusell</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <FeatureInfoModal isOpen={showMemberAppInfo} onClose={() => setShowMemberAppInfo(false)} />
        </div>
    );
};

const PassProgramModule: React.FC<{ 
    onNavigate: (mode: 'create' | 'generate' | 'parse' | 'manage') => void;
    onManageBenchmarks: () => void;
}> = ({ onNavigate, onManageBenchmarks }) => {
    return (
        <div className="space-y-8 py-4">
            <div className="text-center max-w-2xl mx-auto mb-10">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Pass & Program</h2>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Skapa, hantera och publicera träningspass. Använd AI för att snabbt generera nya pass.
                </p>
                <button onClick={onManageBenchmarks} className="mt-6 text-sm font-bold text-primary hover:underline flex items-center justify-center gap-2 mx-auto">
                    <TrophyIcon className="w-4 h-4" /> Hantera Benchmarks
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                <button onClick={() => onNavigate('create')} className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <DumbbellIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Skapa nytt pass</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Bygg ett pass från grunden med vår passbyggare.</p>
                </button>

                <button onClick={() => onNavigate('generate')} className="group bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 p-8 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-900/30 hover:border-purple-300 hover:shadow-md transition-all text-left flex border border-primary">
                    <div>
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <SparklesIcon className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Skapa med AI</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            Låt AI:n generera ett pass från dina önskemål, text, bild, youtube-länk eller anteckning.
                        </p>
                    </div>
                </button>

                <button onClick={() => onNavigate('manage')} className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Hantera pass</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Redigera, kopiera, publicera och ta bort dina befintliga pass.</p>
                </button>
            </div>
        </div>
    );
};

const ManageWorkoutsView: React.FC<{
    workouts: Workout[];
    locations?: { id: string; name: string }[];
    organization?: Organization;
    onEdit: (workout: Workout) => void;
    onDelete: (id: string) => void;
    onDuplicate: (workout: Workout, origin?: string) => void;
    onTogglePublish: (id: string, isPublished: boolean, silentPublish?: boolean) => void;
    onCopyToLibrary: (workout: Workout) => void;
    onMoveToLibrary: (workout: Workout) => void;
    onMoveToOtherPass: (workout: Workout) => void;
    onBack: () => void;
    onCreateNew?: () => void;
    onCreateWithAI?: () => void;
    onManageBenchmarks?: () => void;
    onSaveFolders?: (folders: { id: string; name: string; createdAt: number; parentId?: string }[]) => Promise<void>;
    onMoveToFolder?: (workout: Workout, folderId: string | undefined) => Promise<void>;
    members?: { uid: string; firstName?: string; lastName?: string; email?: string }[];
    onAssignToMember?: (workout: Workout, member: { uid: string; name: string } | null) => Promise<void>;
}> = ({ workouts, locations, organization, onEdit, onDelete, onDuplicate, onTogglePublish, onCopyToLibrary, onMoveToLibrary, onMoveToOtherPass, onBack, onCreateNew, onCreateWithAI, onManageBenchmarks, onSaveFolders, onMoveToFolder, members, onAssignToMember }) => {
    
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

    // --- MAPPAR ---
    // Mapplistan är REN ADMINORDNING. Den påverkar aldrig vad medlemmar eller
    // skärmen ser — det styrs fortfarande av passets kategori.
    // 'all' = alla, 'favorites' = mest körda, 'cat:<namn>' = kategori (finns
    // automatiskt för varje kategori gymmet skapat), 'folder:<id>' = egen mapp,
    // 'nofolder' = pass utan egen mapp.
    const FAVORITES_COUNT = 10;
    const [activeFolder, setActiveFolder] = useState<string>('all');
    const [isFolderMenuFor, setIsFolderMenuFor] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    // null = ingen inmatning öppen, '' = ny mapp på toppnivå, '<id>' = undermapp till den mappen
    const [addingFolderUnder, setAddingFolderUnder] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [assignFor, setAssignFor] = useState<Workout | null>(null);
    const [assignSearch, setAssignSearch] = useState('');
    const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);

    const customFolders = organization?.workoutFolders || [];
    const topFolders = customFolders.filter(f => !f.parentId);
    const childrenOf = (id: string) => customFolders.filter(f => f.parentId === id);
    // En förälders innehåll inkluderar undermapparnas pass, annars göms de.
    const folderIdsWithin = (id: string) => [id, ...childrenOf(id).map(c => c.id)];
    const categories = organization?.globalConfig?.customCategories || [];
    
    const [activeTab, setActiveTab] = useState<'official' | 'drafts'>('official');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [previewWorkout, setPreviewWorkout] = useState<Workout | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: 'title' | 'category' | 'createdAt' | 'createdByName' | 'isPublished' | 'runCount' | 'logCount' | 'lastRunAt', direction: 'asc' | 'desc' | 'none' }>({
        key: 'createdAt',
        direction: 'none'
    });
    const [publishConfirmWorkoutId, setPublishConfirmWorkoutId] = useState<string | null>(null);
    const [deleteConfirmWorkoutId, setDeleteConfirmWorkoutId] = useState<string | null>(null);
    const [copyConfirmWorkoutId, setCopyConfirmWorkoutId] = useState<string | null>(null);
    
    const ITEMS_PER_PAGE = 50;

    // Filter workouts based on selected tab.
    // Pass från AI-whiteboarden/anteckningarna är publicerade med isMemberDraft
    // false (så att QR och loggning fungerar) men bär kategorin Övriga pass.
    // I adminlistan hör de hemma under Medlemsutkast, inte i gymmets bibliotek —
    // därför sorterar flikarna på kategori OCH utkastflaggan, utan att röra data.
    useEffect(() => { setSelectedIds([]); setIsBulkMenuOpen(false); }, [activeTab, activeFolder]);

    const filteredByTab = useMemo(() => {
        const base = activeTab === 'official'
            ? workouts.filter(w => !w.isMemberDraft && w.category !== OTHER_CATEGORY)
            : workouts.filter(w => w.isMemberDraft || w.category === OTHER_CATEGORY);

        // Tilldelade pass hör till en enskild medlem och ska inte blandas in i
        // gymmets vanliga utbud — de har en egen mapp.
        if (activeFolder === 'all') return base.filter(w => !w.assignedToUid);
        if (activeFolder === 'favorites') {
            return [...base]
                .filter(w => (w.runCount || 0) > 0)
                .sort((a, b) => (b.runCount || 0) - (a.runCount || 0))
                .slice(0, FAVORITES_COUNT);
        }
        if (activeFolder === 'assigned') return base.filter(w => !!w.assignedToUid);
        if (activeFolder === 'benchmarks') return base.filter(w => !!w.benchmarkId);
        if (activeFolder === 'nofolder') return base.filter(w => !w.folderId);
        if (activeFolder.startsWith('cat:')) {
            const catName = activeFolder.slice(4);
            return base.filter(w => w.category === catName);
        }
        if (activeFolder.startsWith('folder:')) {
            const fid = activeFolder.slice(7);
            const ids = folderIdsWithin(fid);
            return base.filter(w => w.folderId && ids.includes(w.folderId));
        }
        return base;
    }, [workouts, activeTab, activeFolder, customFolders]);

    // Antal per mapp räknas på fliken (bibliotek/utkast), inte på hela beståndet.
    const tabScopedWorkouts = useMemo(() => (
        activeTab === 'official'
            ? workouts.filter(w => !w.isMemberDraft && w.category !== OTHER_CATEGORY)
            : workouts.filter(w => w.isMemberDraft || w.category === OTHER_CATEGORY)
    ), [workouts, activeTab]);

    const countFor = (key: string) => {
        if (key === 'all') return tabScopedWorkouts.filter(w => !w.assignedToUid).length;
        if (key === 'favorites') return Math.min(FAVORITES_COUNT, tabScopedWorkouts.filter(w => (w.runCount || 0) > 0).length);
        if (key === 'assigned') return tabScopedWorkouts.filter(w => !!w.assignedToUid).length;
        if (key === 'benchmarks') return tabScopedWorkouts.filter(w => !!w.benchmarkId).length;
        if (key === 'nofolder') return tabScopedWorkouts.filter(w => !w.folderId).length;
        if (key.startsWith('cat:')) return tabScopedWorkouts.filter(w => w.category === key.slice(4)).length;
        if (key.startsWith('folder:')) {
            const ids = folderIdsWithin(key.slice(7));
            return tabScopedWorkouts.filter(w => w.folderId && ids.includes(w.folderId)).length;
        }
        return 0;
    };

    // Handle Sort Toggle
    const handleSort = (key: typeof sortConfig.key) => {
        setSortConfig(prev => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            if (prev.direction === 'desc') return { key, direction: 'none' };
            return { key, direction: 'asc' };
        });
    };

    // Filter and Sort based on Search, Sort and Date
    const filteredWorkouts = useMemo(() => {
        let result = filteredByTab.filter(w => {
            const searchLower = searchTerm.toLowerCase();
            return (
                (w.title || '').toLowerCase().includes(searchLower) ||
                (w.category || '').toLowerCase().includes(searchLower)
            );
        });

        // Apply Sorting
        if (sortConfig.direction !== 'none') {
            result.sort((a, b) => {
                // Körningskolumnerna saknas på pass som aldrig körts — de behandlas
                // som 0 så att sorteringen blir meningsfull i stället för godtycklig.
                const numericKey = sortConfig.key === 'runCount' || sortConfig.key === 'logCount' || sortConfig.key === 'lastRunAt';
                // Pass utan skapare (gamla pass) sorteras sist oavsett riktning.
                if (sortConfig.key === 'createdByName') {
                    const an = a.createdByName || '';
                    const bn = b.createdByName || '';
                    if (!an && !bn) return (b.createdAt || 0) - (a.createdAt || 0);
                    if (!an) return 1;
                    if (!bn) return -1;
                    const cmp = an.localeCompare(bn, 'sv');
                    return sortConfig.direction === 'asc' ? cmp : -cmp;
                }
                const aValue = numericKey ? (a[sortConfig.key] || 0) : a[sortConfig.key];
                const bValue = numericKey ? (b[sortConfig.key] || 0) : b[sortConfig.key];

                if (aValue === undefined || bValue === undefined) return 0;

                // Secondary sort by date (newest first) for stability
                const secondarySort = (b.createdAt || 0) - (a.createdAt || 0);

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return secondarySort;
            });
        } else {
            // Default sort: Newest first
            result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        return result;
    }, [filteredByTab, searchTerm, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredWorkouts.length / ITEMS_PER_PAGE);
    const paginatedWorkouts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredWorkouts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredWorkouts, currentPage]);

    // Reset to page 1 when search, sort, or tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortConfig, activeTab]);

    const SortIcon = ({ column }: { column: typeof sortConfig.key }) => {
        if (sortConfig.key !== column || sortConfig.direction === 'none') {
            return <div className="flex flex-col ml-1 opacity-20"><ChevronUpIcon className="w-2.5 h-2.5 mb-[-2px]" /><ChevronDownIcon className="w-2.5 h-2.5 mt-[-2px]" /></div>;
        }
        return sortConfig.direction === 'asc' 
            ? <ChevronUpIcon className="w-3 h-3 ml-1 text-primary" /> 
            : <ChevronDownIcon className="w-3 h-3 ml-1 text-primary" />;
    };

    return (
        <div className="flex flex-col animate-fade-in w-full h-[calc(100vh-7rem)] gap-6">
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Hantera Pass</h3>
                        <p className="text-gray-500 dark:text-gray-400">Totalt {workouts.length} pass i systemet</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                {(onCreateNew || onCreateWithAI) && (
                    <div className="relative">
                        <button
                            onClick={() => setIsCreateMenuOpen(v => !v)}
                            className="flex items-center gap-2 bg-primary hover:brightness-95 text-white font-bold py-2.5 px-5 rounded-xl shadow-sm transition-transform active:scale-95 whitespace-nowrap"
                        >
                            <PlusIcon className="w-4 h-4" /> Skapa pass
                        </button>
                        {isCreateMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsCreateMenuOpen(false)} />
                                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                                    <button
                                        onClick={() => { setIsCreateMenuOpen(false); onCreateNew && onCreateNew(); }}
                                        className="w-full text-left p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex gap-4 items-start"
                                    >
                                        <div className="w-10 h-10 flex-shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                            <DumbbellIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white">Bygg själv</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bygg passet från grunden i passbyggaren.</div>
                                        </div>
                                    </button>
                                    <div className="h-px bg-gray-100 dark:bg-gray-700" />
                                    <button
                                        onClick={() => { setIsCreateMenuOpen(false); onCreateWithAI && onCreateWithAI(); }}
                                        className="w-full text-left p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex gap-4 items-start"
                                    >
                                        <div className="w-10 h-10 flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-xl flex items-center justify-center">
                                            <SparklesIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white">Skapa med AI</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Utgå från dina önskemål, en text, bild, YouTube-länk eller anteckning.</div>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Sök pass..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                    />
                </div>
                </div>
            </div>

            {/* TABBAR FÖR BIBLIOTEK vs UTKAST */}
            <div className="flex-shrink-0 flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 w-fit">
                <button
                    onClick={() => setActiveTab('official')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
                        activeTab === 'official' 
                        ? 'bg-white dark:bg-gray-700 text-primary shadow-md' 
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Gymmets bibliotek
                </button>
                <button
                    onClick={() => setActiveTab('drafts')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
                        activeTab === 'drafts' 
                        ? 'bg-white dark:bg-gray-700 text-primary shadow-md' 
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Medlemsutkast
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                <div className="flex-grow min-h-0 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
                {/* MAPPAR — ren adminordning, påverkar inte medlemsvyn */}
                <aside className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col min-h-0 overflow-y-auto">
                    <div className="p-5 sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Våra pass</span>
                    </div>
                    <div className="p-2 space-y-1">
                    {[
                        { key: 'all', label: 'Alla pass', icon: '📋' },
                        { key: 'favorites', label: 'Mest körda', icon: '⭐' },
                        { key: 'benchmarks', label: 'Benchmarks', icon: '🏆' },
                        { key: 'assigned', label: 'Tilldelade pass', icon: '👤' },
                    ].map(item => (
                        <button
                            key={item.key}
                            onClick={() => { setActiveFolder(item.key); setCurrentPage(1); }}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${activeFolder === item.key ? 'bg-primary/10 text-primary' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            <span className="flex items-center gap-2 truncate"><span>{item.icon}</span> {item.label}</span>
                            <span className="text-xs opacity-70 flex-shrink-0">{countFor(item.key)}</span>
                        </button>
                    ))}

                    {categories.length > 0 && (
                        <div className="pt-4">
                            <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Kategorier</div>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => { setActiveFolder('cat:' + cat.name); setCurrentPage(1); }}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${activeFolder === 'cat:' + cat.name ? 'bg-primary/10 text-primary' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                >
                                    <span className="flex items-center gap-2 truncate"><span>📁</span> <span className="truncate">{cat.name}</span></span>
                                    <span className="text-xs opacity-70 flex-shrink-0">{countFor('cat:' + cat.name)}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="pt-4">
                        <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Egna mappar</div>
                        {topFolders.map(folder => (
                            <div key={folder.id}>
                                <div className="flex items-center">
                                    <button
                                        onClick={() => { setActiveFolder('folder:' + folder.id); setCurrentPage(1); }}
                                        className={`flex-grow min-w-0 flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${activeFolder === 'folder:' + folder.id ? 'bg-primary/10 text-primary' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                    >
                                        <span className="flex items-center gap-2 truncate"><span>🗂️</span> <span className="truncate">{folder.name}</span></span>
                                        <span className="text-xs opacity-70 flex-shrink-0">{countFor('folder:' + folder.id)}</span>
                                    </button>
                                    {onSaveFolders && (
                                        <>
                                            <button
                                                title="Ny mapp inuti"
                                                onClick={() => { setAddingFolderUnder(folder.id); setNewFolderName(''); }}
                                                className="p-1.5 text-gray-300 hover:text-primary transition-colors flex-shrink-0"
                                            >
                                                <PlusIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                title="Ta bort mappen (passen ligger kvar)"
                                                onClick={async () => {
                                                    const kids = childrenOf(folder.id);
                                                    const msg = kids.length > 0
                                                        ? `Ta bort "${folder.name}" och dess ${kids.length} undermapp(ar)? Passen ligger kvar och hamnar under "Utan mapp".`
                                                        : `Ta bort mappen "${folder.name}"? Passen ligger kvar och hamnar under "Utan mapp".`;
                                                    if (!window.confirm(msg)) return;
                                                    const removeIds = folderIdsWithin(folder.id);
                                                    await onSaveFolders(customFolders.filter(x => !removeIds.includes(x.id)));
                                                    if (activeFolder.startsWith('folder:') && removeIds.includes(activeFolder.slice(7))) setActiveFolder('all');
                                                }}
                                                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {childrenOf(folder.id).map(child => (
                                    <div key={child.id} className="flex items-center pl-4">
                                        <button
                                            onClick={() => { setActiveFolder('folder:' + child.id); setCurrentPage(1); }}
                                            className={`flex-grow min-w-0 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors ${activeFolder === 'folder:' + child.id ? 'bg-primary/10 text-primary font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                        >
                                            <span className="flex items-center gap-2 truncate"><span className="text-xs">↳</span> <span className="truncate">{child.name}</span></span>
                                            <span className="text-xs opacity-70 flex-shrink-0">{countFor('folder:' + child.id)}</span>
                                        </button>
                                        {onSaveFolders && (
                                            <button
                                                title="Ta bort mappen (passen ligger kvar)"
                                                onClick={async () => {
                                                    if (!window.confirm(`Ta bort mappen "${child.name}"? Passen ligger kvar och hamnar under "Utan mapp".`)) return;
                                                    await onSaveFolders(customFolders.filter(x => x.id !== child.id));
                                                    if (activeFolder === 'folder:' + child.id) setActiveFolder('all');
                                                }}
                                                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {addingFolderUnder === folder.id && onSaveFolders && (
                                    <form
                                        className="pl-4 pr-1 pt-1 flex gap-1"
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            const name = newFolderName.trim();
                                            if (!name) return;
                                            await onSaveFolders([...customFolders, { id: 'f-' + Date.now(), name, createdAt: Date.now(), parentId: folder.id }]);
                                            setNewFolderName('');
                                            setAddingFolderUnder(null);
                                        }}
                                    >
                                        <input
                                            autoFocus
                                            value={newFolderName}
                                            onChange={e => setNewFolderName(e.target.value)}
                                            onBlur={() => { if (!newFolderName.trim()) setAddingFolderUnder(null); }}
                                            placeholder="Undermappens namn"
                                            className="flex-grow min-w-0 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                        <button type="submit" className="px-2 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">OK</button>
                                    </form>
                                )}
                            </div>
                        ))}

                        <button
                            onClick={() => { setActiveFolder('nofolder'); setCurrentPage(1); }}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${activeFolder === 'nofolder' ? 'bg-primary/10 text-primary' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            <span className="flex items-center gap-2 truncate"><span>➖</span> Utan mapp</span>
                            <span className="text-xs opacity-70 flex-shrink-0">{countFor('nofolder')}</span>
                        </button>

                        {onSaveFolders && (addingFolderUnder === '' ? (
                            <form
                                className="px-1 pt-2 flex gap-1"
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    const name = newFolderName.trim();
                                    if (!name) return;
                                    await onSaveFolders([...customFolders, { id: 'f-' + Date.now(), name, createdAt: Date.now() }]);
                                    setNewFolderName('');
                                    setAddingFolderUnder(null);
                                }}
                            >
                                <input
                                    autoFocus
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onBlur={() => { if (!newFolderName.trim()) setAddingFolderUnder(null); }}
                                    placeholder="Mappens namn"
                                    className="flex-grow min-w-0 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button type="submit" className="px-2 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">OK</button>
                            </form>
                        ) : (
                            <button
                                onClick={() => { setAddingFolderUnder(''); setNewFolderName(''); }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-primary transition-colors"
                            >
                                <PlusIcon className="w-3.5 h-3.5" /> Ny mapp
                            </button>
                        ))}
                    </div>
                    </div>
                </aside>

                <div className="flex flex-col min-h-0">
                {activeFolder === 'benchmarks' && onManageBenchmarks && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                            Pass kopplade till ett benchmark. Resultaten jämförs över tid för medlemmarna.
                        </p>
                        <button
                            onClick={onManageBenchmarks}
                            className="flex items-center gap-2 bg-amber-500 hover:brightness-95 text-white text-sm font-bold py-2 px-4 rounded-xl transition-transform active:scale-95 whitespace-nowrap"
                        >
                            <TrophyIcon className="w-4 h-4" /> Hantera benchmarks
                        </button>
                    </div>
                )}
                {onMoveToFolder && selectedIds.length > 0 && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                        <span className="text-sm font-bold text-primary">{selectedIds.length} pass markerade</span>
                        <div className="relative">
                            <button
                                onClick={() => setIsBulkMenuOpen(v => !v)}
                                className="flex items-center gap-2 bg-primary hover:brightness-95 text-white text-sm font-bold py-2 px-4 rounded-xl transition-transform active:scale-95"
                            >
                                🗂️ Flytta till mapp
                            </button>
                            {isBulkMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsBulkMenuOpen(false)} />
                                    <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-1 max-h-72 overflow-y-auto">
                                        {customFolders.length === 0 && (
                                            <div className="px-3 py-2 text-xs text-gray-400 italic">Skapa en mapp först</div>
                                        )}
                                        {topFolders.map(folder => (
                                            <React.Fragment key={folder.id}>
                                                <button
                                                    onClick={async () => {
                                                        setIsBulkMenuOpen(false);
                                                        const targets = workouts.filter(w => selectedIds.includes(w.id));
                                                        for (const w of targets) await onMoveToFolder(w, folder.id);
                                                        setSelectedIds([]);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                >
                                                    {folder.name}
                                                </button>
                                                {childrenOf(folder.id).map(child => (
                                                    <button
                                                        key={child.id}
                                                        onClick={async () => {
                                                            setIsBulkMenuOpen(false);
                                                            const targets = workouts.filter(w => selectedIds.includes(w.id));
                                                            for (const w of targets) await onMoveToFolder(w, child.id);
                                                            setSelectedIds([]);
                                                        }}
                                                        className="w-full text-left pl-7 pr-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                    >
                                                        ↳ {child.name}
                                                    </button>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                        <button
                                            onClick={async () => {
                                                setIsBulkMenuOpen(false);
                                                const targets = workouts.filter(w => selectedIds.includes(w.id));
                                                for (const w of targets) await onMoveToFolder(w, undefined);
                                                setSelectedIds([]);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 mt-1"
                                        >
                                            Ta bort ur mapp
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                            Avmarkera
                        </button>
                    </div>
                )}
                <div className="flex-grow min-h-0 overflow-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-30">
                                {onMoveToFolder && (
                                    <th className="pl-5 pr-0 py-5 w-10 sticky left-0 z-20 bg-gray-50 dark:bg-gray-900/50">
                                        <input
                                            type="checkbox"
                                            aria-label="Markera alla på sidan"
                                            checked={paginatedWorkouts.length > 0 && paginatedWorkouts.every(w => selectedIds.includes(w.id))}
                                            onChange={(e) => {
                                                const pageIds = paginatedWorkouts.map(w => w.id);
                                                setSelectedIds(prev => e.target.checked
                                                    ? Array.from(new Set([...prev, ...pageIds]))
                                                    : prev.filter(id => !pageIds.includes(id)));
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                    </th>
                                )}
                                <th onClick={() => handleSort('title')} className={`p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors sticky z-20 bg-gray-50 dark:bg-gray-900/50 ${onMoveToFolder ? 'left-10' : 'left-0'}`}>
                                    <div className="flex items-center w-[16rem]">Titel <SortIcon column="title" /></div>
                                </th>
                                <th onClick={() => handleSort('category')} className={`p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors sticky z-20 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-100 dark:border-gray-700 ${onMoveToFolder ? 'left-[19rem]' : 'left-[17rem]'}`}>
                                    <div className="flex items-center w-[8rem]">Kategori <SortIcon column="category" /></div>
                                </th>
                                <th onClick={() => handleSort('createdAt')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Skapad <SortIcon column="createdAt" /></div>
                                </th>
                                <th onClick={() => handleSort('createdByName')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Skapad av <SortIcon column="createdByName" /></div>
                                </th>
                                <th onClick={() => handleSort('runCount')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Körd <SortIcon column="runCount" /></div>
                                </th>
                                <th onClick={() => handleSort('logCount')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Loggat <SortIcon column="logCount" /></div>
                                </th>
                                <th onClick={() => handleSort('lastRunAt')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Senast <SortIcon column="lastRunAt" /></div>
                                </th>
                                <th onClick={() => handleSort('isPublished')} className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">
                                    <div className="flex items-center">Status <SortIcon column="isPublished" /></div>
                                </th>
                                <th className="p-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] text-right">Åtgärder</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {paginatedWorkouts.length > 0 ? (
                                paginatedWorkouts.map((workout) => (
                                    <tr 
                                        key={workout.id} 
                                        className="group hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                                    >
                                        {onMoveToFolder && (
                                            <td className="pl-5 pr-0 py-5 sticky left-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/40 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Markera ${workout.title}`}
                                                    checked={selectedIds.includes(workout.id)}
                                                    onChange={(e) => setSelectedIds(prev => e.target.checked
                                                        ? [...prev, workout.id]
                                                        : prev.filter(id => id !== workout.id))}
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                                />
                                            </td>
                                        )}
                                        <td className={`p-5 sticky z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/40 transition-colors ${onMoveToFolder ? 'left-10' : 'left-0'}`}>
                                            <p className="font-bold text-gray-900 dark:text-white text-base truncate w-[16rem]">{workout.title}</p>
                                            {workout.assignedToName && (
                                                <p className="text-xs font-bold text-primary mt-0.5 truncate w-[16rem]">👤 {workout.assignedToName}</p>
                                            )}
                                            {workout.coachTips && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{workout.coachTips}</p>
                                            )}
                                            {(() => {
                                                const locIds = workout.locationIds || [];
                                                let locLabel = "Alla orter";
                                                if (locIds.length > 0 && locations && locations.length > 0) {
                                                    const names = locIds.map(id => locations.find(l => l.id === id)?.name || id);
                                                    locLabel = names.join(', ');
                                                }
                                                return (
                                                    <div className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                        <span className="truncate max-w-xs">{locLabel}</span>
                                                    </div>
                                                );
                                            })()}
                                            {(() => {
                                                const vis = getWorkoutVisibilityIssues(workout, organization?.globalConfig?.customCategories);
                                                if (vis.issues.length === 0) return null;
                                                return (
                                                    <div className="flex items-start gap-1.5 mt-1">
                                                        <span className="text-amber-500 text-xs leading-4">⚠</span>
                                                        <span className="text-[11px] text-amber-600 dark:text-amber-400 leading-4">
                                                            {vis.issues.join(' ')}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className={`p-5 sticky z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/40 transition-colors border-r border-gray-100 dark:border-gray-700 ${onMoveToFolder ? 'left-[19rem]' : 'left-[17rem]'}`}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                                    {workout.category || 'Okategoriserad'}
                                                </span>
                                                {workout.benchmarkId && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded border border-yellow-200 dark:border-yellow-800">
                                                        BENCHMARK
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                            {new Date(workout.createdAt || 0).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="p-5 text-sm text-gray-600 dark:text-gray-300">
                                            {workout.createdByName || <span className="text-gray-400">–</span>}
                                        </td>
                                        <td className="p-5 text-sm">
                                            {workout.runCount ? (
                                                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-primary/10 text-primary font-black">{workout.runCount}</span>
                                            ) : (
                                                <span className="text-gray-400">–</span>
                                            )}
                                        </td>
                                        <td className="p-5 text-sm">
                                            {workout.logCount ? (
                                                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black">{workout.logCount}</span>
                                            ) : isWorkoutLoggable(workout) ? (
                                                <span className="text-gray-400">–</span>
                                            ) : (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap" title="Ingen övning i passet har loggning påslagen">Ej loggbart</span>
                                            )}
                                        </td>
                                        <td className="p-5 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                            {workout.lastRunAt
                                                ? new Date(workout.lastRunAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
                                                : <span className="text-gray-400">–</span>}
                                        </td>
                                        <td className="p-5">
                                            {(() => {
                                                const statusInfo = getWorkoutStatusInfo(workout, Date.now(), organization?.globalConfig?.customCategories);
                                                return (
                                                    <button 
                                                        onClick={() => {
                                                            if (!workout.isPublished) {
                                                                setPublishConfirmWorkoutId(workout.id);
                                                            } else {
                                                                onTogglePublish(workout.id, false);
                                                            }
                                                        }}
                                                        className={`text-xs font-bold px-2 py-1 rounded transition-colors uppercase tracking-wider ${statusInfo.styleClass}`}
                                                    >
                                                        {statusInfo.label}
                                                    </button>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                {activeTab === 'drafts' && (
                                                    <>
                                                        {workout.isMemberDraft && workout.category !== OTHER_CATEGORY && (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm(`"${workout.title}" publiceras under Övriga pass och blir synligt för alla i gymmet. Ingen notis skickas. Fortsätta?`)) {
                                                                        onMoveToOtherPass(workout);
                                                                    }
                                                                }}
                                                                className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                                title="Flytta till Övriga pass (gamla utkast syns inte där förrän de flyttats)"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => onMoveToLibrary(workout)}
                                                            className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                            title="Flytta till gymmets bibliotek"
                                                        >
                                                            <ChevronRightIcon className="w-5 h-5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setCopyConfirmWorkoutId(workout.id);
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" 
                                                            title="Spara som permanent mall"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                                <button 
                                                    onClick={() => setPreviewWorkout(workout)} 
                                                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" 
                                                    title="Förhandsgranska"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => onEdit(workout)} 
                                                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" 
                                                    title="Redigera"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                {onAssignToMember && (
                                                    <button
                                                        onClick={() => { setAssignFor(workout); setAssignSearch(''); }}
                                                        className={`p-2 rounded-lg transition-colors ${workout.assignedToUid ? 'text-primary bg-primary/10' : 'text-gray-400 hover:text-primary hover:bg-primary/10'}`}
                                                        title={workout.assignedToName ? `Tilldelat: ${workout.assignedToName}` : 'Tilldela en medlem'}
                                                    >
                                                        <span className="text-base leading-none">👤</span>
                                                    </button>
                                                )}
                                                {onMoveToFolder && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setIsFolderMenuFor(isFolderMenuFor === workout.id ? null : workout.id)}
                                                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                            title="Flytta till mapp"
                                                        >
                                                            <span className="text-base leading-none">🗂️</span>
                                                        </button>
                                                        {isFolderMenuFor === workout.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-40" onClick={() => setIsFolderMenuFor(null)} />
                                                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-1 max-h-72 overflow-y-auto">
                                                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Flytta till mapp</div>
                                                                    {customFolders.length === 0 && (
                                                                        <div className="px-3 py-2 text-xs text-gray-400 italic">Skapa en mapp först</div>
                                                                    )}
                                                                    {customFolders.map(folder => (
                                                                        <button
                                                                            key={folder.id}
                                                                            onClick={async () => { setIsFolderMenuFor(null); await onMoveToFolder(workout, folder.id); }}
                                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${workout.folderId === folder.id ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-200'}`}
                                                                        >
                                                                            {workout.folderId === folder.id ? '✓ ' : ''}{folder.name}
                                                                        </button>
                                                                    ))}
                                                                    {workout.folderId && (
                                                                        <button
                                                                            onClick={async () => { setIsFolderMenuFor(null); await onMoveToFolder(workout, undefined); }}
                                                                            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 mt-1"
                                                                        >
                                                                            Ta bort ur mappen
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                <button 
                                                    onClick={() => onDuplicate(workout, 'admin')}
                                                    className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                    title="Kopiera pass"
                                                >
                                                    <CopyIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setDeleteConfirmWorkoutId(workout.id);
                                                    }} 
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" 
                                                    title="Ta bort"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={onMoveToFolder ? 10 : 9} className="p-12 text-center text-gray-400 italic">
                                        Inga pass hittades i denna flik.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                </div>
                </div>

                {/* Tilldela pass till medlem */}
                {assignFor && onAssignToMember && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setAssignFor(null)}>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white">Tilldela passet</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{assignFor.title}</p>
                                <p className="text-xs text-gray-400 mt-2">Ett tilldelat pass syns bara för den medlemmen i appen — aldrig på skärmen i lokalen.</p>
                            </div>
                            <div className="p-4">
                                <input
                                    autoFocus
                                    value={assignSearch}
                                    onChange={e => setAssignSearch(e.target.value)}
                                    placeholder="Sök medlem…"
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="max-h-72 overflow-y-auto px-2 pb-2">
                                {(members || [])
                                    .map(m => ({ uid: m.uid, name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || 'Namnlös', email: m.email || '' }))
                                    .filter(m => !assignSearch.trim() || m.name.toLowerCase().includes(assignSearch.toLowerCase()) || m.email.toLowerCase().includes(assignSearch.toLowerCase()))
                                    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
                                    .slice(0, 50)
                                    .map(m => (
                                        <button
                                            key={m.uid}
                                            onClick={async () => { await onAssignToMember(assignFor, m); setAssignFor(null); }}
                                            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${assignFor.assignedToUid === m.uid ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-200'}`}
                                        >
                                            {assignFor.assignedToUid === m.uid ? '✓ ' : ''}{m.name}
                                            {m.email && <span className="block text-xs text-gray-400">{m.email}</span>}
                                        </button>
                                    ))}
                                {(members || []).length === 0 && (
                                    <p className="px-4 py-3 text-sm text-gray-400 italic">Inga medlemmar hittades.</p>
                                )}
                            </div>
                            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between gap-3">
                                {assignFor.assignedToUid ? (
                                    <button
                                        onClick={async () => { await onAssignToMember(assignFor, null); setAssignFor(null); }}
                                        className="text-sm font-bold text-red-500 hover:underline"
                                    >
                                        Ta bort tilldelningen
                                    </button>
                                ) : <span />}
                                <button onClick={() => setAssignFor(null)} className="text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                    Stäng
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex-shrink-0 flex items-center justify-between p-4 mt-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                            Föregående
                        </button>
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                            Sida {currentPage} av {totalPages}
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Nästa
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {previewWorkout && (
                    <WorkoutPresentationModal
                        workout={previewWorkout}
                        onClose={() => setPreviewWorkout(null)}
                    />
                )}
            </AnimatePresence>

            {createPortal(
                <AnimatePresence>
                    {publishConfirmWorkoutId && (
                        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                            >
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Publicera pass</h3>
                                <p className="text-gray-600 dark:text-gray-300 mb-6">
                                    Vill du skicka en pushnotis till medlemmarna om att passet är publicerat?
                                </p>
                                {(() => {
                                    const wToPub = workouts.find(w => w.id === publishConfirmWorkoutId);
                                    if (!wToPub) return null;
                                    const vis = getWorkoutVisibilityIssues(wToPub, organization?.globalConfig?.customCategories);
                                    if (vis.issues.length === 0) return null;
                                    return (
                                        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/60">
                                            <div className="flex items-start gap-1.5">
                                                <span className="text-amber-500 text-xs leading-4">⚠</span>
                                                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                                                    Upplysning:
                                                </span>
                                            </div>
                                            <ul className="mt-1 list-disc list-inside text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                                {vis.issues.map((issue, idx) => (
                                                    <li key={idx}>{issue}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })()}
                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={() => {
                                            onTogglePublish(publishConfirmWorkoutId, true, false);
                                            setPublishConfirmWorkoutId(null);
                                        }}
                                        className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors"
                                    >
                                        Ja, skicka notis
                                    </button>
                                    <button 
                                        onClick={() => {
                                            onTogglePublish(publishConfirmWorkoutId, true, true);
                                            setPublishConfirmWorkoutId(null);
                                        }}
                                        className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Nej, publicera i tysthet
                                    </button>
                                    <button 
                                        onClick={() => setPublishConfirmWorkoutId(null)}
                                        className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 dark:hover:text-gray-300 transition-colors mt-2"
                                    >
                                        Avbryt
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {createPortal(
                <AnimatePresence>
                    {deleteConfirmWorkoutId && (
                        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                            >
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Ta bort pass</h3>
                                <p className="text-gray-600 dark:text-gray-300 mb-6">
                                    Är du säker på att du vill ta bort detta pass? Detta kan inte ångras.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button 
                                        onClick={() => setDeleteConfirmWorkoutId(null)}
                                        className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                    >
                                        Avbryt
                                    </button>
                                    <button 
                                        onClick={() => {
                                            onDelete(deleteConfirmWorkoutId);
                                            setDeleteConfirmWorkoutId(null);
                                        }}
                                        className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                                    >
                                        Ta bort
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {createPortal(
                <AnimatePresence>
                    {copyConfirmWorkoutId && (
                        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                            >
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Spara som mall</h3>
                                <p className="text-gray-600 dark:text-gray-300 mb-6">
                                    Vill du skapa en permanent kopia av detta pass i biblioteket? Originalet ligger kvar som utkast.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button 
                                        onClick={() => setCopyConfirmWorkoutId(null)}
                                        className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                    >
                                        Avbryt
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const workout = workouts.find(w => w.id === copyConfirmWorkoutId);
                                            if (workout) onCopyToLibrary(workout);
                                            setCopyConfirmWorkoutId(null);
                                        }}
                                        className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                                    >
                                        Spara som mall
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

const PassProgramContent: React.FC<DashboardContentProps & {
    subView: 'hub' | 'ai' | 'builder' | 'manage';
    setSubView: (view: 'hub' | 'ai' | 'builder' | 'manage') => void;
    workoutToEdit: Workout | null;
    setWorkoutToEdit: (w: Workout | null) => void;
    isNewDraft: boolean;
    setIsNewDraft: (b: boolean) => void;
    aiGeneratorInitialTab: 'generate' | 'parse' | 'manage';
    setAiGeneratorInitialTab: (tab: 'generate' | 'parse' | 'manage') => void;
    onReturnToHub: () => void;
    autoExpandCategory: string | null;
    setAutoExpandCategory: (category: string | null) => void;
    onSaveWorkout: (workout: Workout) => Promise<Workout>;
    onDeleteWorkout: (id: string) => Promise<void>;
    onTogglePublish: (id: string, isPublished: boolean, silentPublish?: boolean) => void;
    onDuplicateWorkout: (workout: Workout, origin?: string) => void;
    setCustomBackHandler?: (handler: (() => void) | null) => void;
}> = ({
    subView, setSubView, workoutToEdit, setWorkoutToEdit, isNewDraft, setIsNewDraft,
    aiGeneratorInitialTab, setAiGeneratorInitialTab, onReturnToHub,
    onSaveWorkout, workouts, workoutsLoading, onDeleteWorkout, onTogglePublish,
    organization, autoExpandCategory, setAutoExpandCategory, onDuplicateWorkout, setCustomBackHandler
}) => {
    
    const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
    // Medlemslistan behövs för att kunna tilldela pass till en enskild medlem (PT).
    const [ptMembers, setPtMembers] = useState<any[]>([]);
    useEffect(() => {
        if (!organization?.id) return;
        const unsub = listenToMembers(organization.id, (data) => setPtMembers(data));
        return () => unsub();
    }, [organization?.id]);

    const handleNavigate = async (mode: 'create' | 'generate' | 'parse' | 'manage') => {
        if (mode === 'create') {
            setWorkoutToEdit(null);
            setIsNewDraft(true);
            setSubView('builder');
        } else if (mode === 'manage') {
            setSubView('manage');
        } else {
            setAiGeneratorInitialTab(mode === 'parse' ? 'parse' : 'generate');
            setSubView('ai');
        }
    };

    const handleWorkoutGenerated = (workout: Workout) => {
        setWorkoutToEdit(workout);
        setIsNewDraft(true);
        setSubView('builder');
    };

    const handleEditWorkout = (workout: Workout) => {
        setWorkoutToEdit(workout);
        setIsNewDraft(false);
        setSubView('builder');
    };

    const handleSaveAndReturn = async (workout: Workout) => {
        const saved = await onSaveWorkout(workout);
        const category = saved.category || 'Ej kategoriserad';
        setAutoExpandCategory(category);
        setAiGeneratorInitialTab('manage');
        setSubView('manage'); 
    };

    const handleMoveToLibrary = async (workout: Workout) => {
        await onSaveWorkout({ ...workout, isMemberDraft: false });
    };

    // Flyttar ett gammalt utkast in i nya Övriga pass-modellen: publicerat, utan
    // utkastflagga, med kategorin Övriga pass. silentPublish är obligatorisk —
    // publiceringstriggern i functions skickar annars en pushnotis till alla
    // medlemmar när isPublished går från false till true.
    const handleMoveToOtherPass = async (workout: Workout) => {
        await onSaveWorkout({
            ...workout,
            category: OTHER_CATEGORY,
            isPublished: true,
            isMemberDraft: false,
            silentPublish: true,
        });
    };

    const handleCopyToLibrary = async (workout: Workout) => {
        let copy = deepCopyAndPrepareAsNew(workout);
        copy.isMemberDraft = false;
        copy.isPublished = false;
        copy.title = `Mall: ${workout.title}`;
        
        // VIKTIGT: createMissing = true. 
        // Detta gör att alla övningar som hittills bara funnits som text i utkastet nu blir officiella bank-övningar.
        copy = await resolveAndCreateExercises(organization.id, copy, true);
        
        await onSaveWorkout(copy);
        alert("Passet har sparats som en mall i biblioteket och övningar har lagts till i banken!");
    };
    
    // Mapparna lagras på organisationen, passets folderId på passet. Ren
    // adminordning — inget av det påverkar medlemsvyn eller skärmen.
    const handleSaveFolders = async (folders: { id: string; name: string; createdAt: number }[]) => {
        await updateOrganizationWorkoutFolders(organization.id, folders);
    };

    const handleMoveToFolder = async (workout: Workout, folderId: string | undefined) => {
        await onSaveWorkout({ ...workout, folderId });
    };

    // Tilldelat pass (PT): syns bara för den medlemmen i appen, aldrig på skärmen.
    const handleAssignToMember = async (workout: Workout, member: { uid: string; name: string } | null) => {
        await onSaveWorkout({
            ...workout,
            assignedToUid: member ? member.uid : undefined,
            assignedToName: member ? member.name : undefined,
        });
    };

    const handleUpdateBenchmarks = async (benchmarks: BenchmarkDefinition[]) => {
        await updateOrganizationBenchmarks(organization.id, benchmarks);
    };

    if (subView === 'ai') {
        return (
            <div className="animate-fade-in">
                <button onClick={() => setSubView('manage')} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-primary transition-colors font-medium">
                    <span>&larr;</span> Tillbaka till passlistan
                </button>
                <AIGeneratorScreen
                    onWorkoutGenerated={handleWorkoutGenerated}
                    onEditWorkout={handleEditWorkout}
                    onDeleteWorkout={onDeleteWorkout}
                    onTogglePublish={onTogglePublish}
                    onCreateNewWorkout={() => handleNavigate('create')}
                    initialMode={aiGeneratorInitialTab}
                    studioConfig={organization.globalConfig}
                    setCustomBackHandler={setCustomBackHandler}
                    workouts={workouts}
                    workoutsLoading={workoutsLoading}
                    initialExpandedCategory={autoExpandCategory}
                />
            </div>
        );
    }

    if (subView === 'builder') {
        return (
            <div className="animate-fade-in w-full">
                <WorkoutBuilderScreen
                    initialWorkout={workoutToEdit}
                    onSave={handleSaveAndReturn}
                    onCancel={() => setSubView('manage')}
                    studioConfig={organization.globalConfig}
                    sessionRole="organizationadmin"
                    isNewDraft={isNewDraft}
                    organization={organization}
                    isAdminView={true}
                    setCustomBackHandler={setCustomBackHandler}
                />
            </div>
        );
    }

    if (subView === 'manage') {
        return (
            <>
                <ManageWorkoutsView 
                    workouts={workouts}
                    locations={organization?.locations}
                    organization={organization}
                    onEdit={handleEditWorkout}
                    onDelete={onDeleteWorkout}
                    onDuplicate={onDuplicateWorkout}
                    onTogglePublish={onTogglePublish}
                    onCopyToLibrary={handleCopyToLibrary}
                    onMoveToLibrary={handleMoveToLibrary}
                    onMoveToOtherPass={handleMoveToOtherPass}
                    onBack={onReturnToHub}
                    onCreateNew={() => handleNavigate('create')}
                    onCreateWithAI={() => handleNavigate('generate')}
                    onManageBenchmarks={() => setShowBenchmarkModal(true)}
                    onSaveFolders={handleSaveFolders}
                    onMoveToFolder={handleMoveToFolder}
                    members={ptMembers}
                    onAssignToMember={handleAssignToMember}
                />
                {showBenchmarkModal && (
                    <ManageBenchmarksModal 
                        isOpen={showBenchmarkModal} 
                        onClose={() => setShowBenchmarkModal(false)}
                        benchmarks={organization.benchmarkDefinitions || []}
                        onSave={handleUpdateBenchmarks}
                    />
                )}
            </>
        );
    }

    return (
        <div className="animate-fade-in">
            <PassProgramModule 
                onNavigate={handleNavigate} 
                onManageBenchmarks={() => setShowBenchmarkModal(true)}
            />
            {showBenchmarkModal && (
                <ManageBenchmarksModal 
                    isOpen={showBenchmarkModal} 
                    onClose={() => setShowBenchmarkModal(false)}
                    benchmarks={organization.benchmarkDefinitions || []}
                    onSave={handleUpdateBenchmarks}
                />
            )}
        </div>
    );
};

export { DashboardContent, PassProgramContent, ManageWorkoutsView, SetupProgressWidget, QuickAIWidget };
