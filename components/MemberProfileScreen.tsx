import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WorkoutLog, UserData, MemberGoals, Page, UserRole, SmartGoalDetail, WorkoutDiploma, StudioConfig, BenchmarkDefinition } from '../types';
import { listenToMemberLogs, updateUserGoals, updateUserProfile, uploadImage, updateWorkoutLog, deleteWorkoutLog, requestPushNotificationPermission, auth, getPastRaces } from '../services/firebaseService';
import { ChartBarIcon, DumbbellIcon, PencilIcon, SparklesIcon, UserIcon, FireIcon, LightningIcon, TrashIcon, CloseIcon, TrophyIcon, ToggleSwitch, ClockIcon, HistoryIcon, FlagIcon, StarIcon, ChevronRightIcon, SunIcon } from './icons';
import { Modal } from './ui/Modal';
import { useConfirm } from './ConfirmContext';
import { resizeImage } from '../utils/imageUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { MyStrengthScreen } from './MyStrengthScreen';
import { WorkoutDiplomaView } from './WorkoutDiplomaView';
import { useStudio } from '../context/StudioContext';

// --- Local Storage Key ---
const ACTIVE_LOG_STORAGE_KEY = 'smart-skarm-active-log';

import { ActivityCalendar } from './dashboard/ActivityCalendar';
import { BodyHeatmap } from './dashboard/BodyHeatmap';
import { WeeklyGoalRing } from './dashboard/WeeklyGoalRing';
import { Leaderboard } from './dashboard/Leaderboard';
import { Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MigrateStatsModal } from './MigrateStatsModal';

interface MemberProfileScreenProps {
    userData: UserData;
    onBack: () => void;
    profileEditTrigger: number;
    navigateTo: (page: Page) => void;
    functions: any;
    studioConfig: StudioConfig;
}

// --- Helper Components ---

const SmartItem: React.FC<{ letter: string, color: string, title: string, text: string }> = ({ letter, color, title, text }) => (
    <div className="flex gap-4 group">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm transition-transform group-hover:scale-110`}>
            {letter}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">{title}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{text || 'Ej angivet.'}</p>
        </div>
    </div>
);

// --- Resume Banner Component (Enhanced Amber UI) ---
const ResumeWorkoutBanner: React.FC<{ 
    workoutTitle: string, 
    onContinue: () => void, 
    onDismiss: () => void 
}> = ({ workoutTitle, onContinue, onDismiss }) => (
    <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-400 to-orange-500 rounded-[2rem] p-6 text-orange-950 shadow-xl shadow-orange-500/30 border border-white/40"
    >
        {/* Animated background highlights */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-600/10 rounded-full blur-2xl -ml-10 -mb-10"></div>
        
        <div className="relative z-10 flex flex-wrap md:flex-nowrap items-center justify-between gap-5">
            <div className="flex items-center gap-4 text-left flex-1 min-w-[250px]">
                <div className="w-14 h-14 bg-orange-950/10 rounded-2xl flex items-center justify-center shadow-inner shrink-0 border border-orange-950/5">
                    <ClockIcon className="w-7 h-7 text-orange-900 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-900/60 mb-0.5">Du har ett pågående pass</h4>
                    <p className="text-xl font-black leading-tight line-clamp-2 break-words text-orange-950 drop-shadow-sm">{workoutTitle}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
                <button 
                    onClick={onDismiss}
                    className="flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-black bg-orange-950/10 hover:bg-orange-950/20 transition-colors uppercase tracking-widest text-orange-900"
                >
                    Släng
                </button>
                <button 
                    onClick={onContinue}
                    className="flex-[2] sm:flex-none px-8 py-3 rounded-xl text-xs font-black bg-white text-orange-600 shadow-xl hover:scale-105 transition-all uppercase tracking-widest active:scale-95 ring-2 ring-orange-950/5"
                >
                    Fortsätt logga
                </button>
            </div>
        </div>
    </motion.div>
);

// --- Helper Functions ---

const getYearWeek = (date: Date) => {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
};

const calculateWeeklyStreak = (logs: WorkoutLog[], migratedStats?: { totalWorkouts: number; streakWeeks: number; migratedAtDate: string; }) => {
    const activeWeeks = new Set(logs.map(log => getYearWeek(new Date(log.date))));
    
    if (migratedStats?.streakWeeks && migratedStats?.migratedAtDate) {
        let migrationCheckDate = new Date(migratedStats.migratedAtDate);
        for (let i = 0; i < migratedStats.streakWeeks; i++) {
            activeWeeks.add(getYearWeek(migrationCheckDate));
            migrationCheckDate.setDate(migrationCheckDate.getDate() - 7);
        }
    }

    if (activeWeeks.size === 0) return 0;

    const now = new Date();
    let streak = 0;
    
    // Check if current week has a workout
    const currentWeekKey = getYearWeek(now);
    if (activeWeeks.has(currentWeekKey)) {
        streak++;
    }

    let checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - 7);
    while (true) {
        const weekKey = getYearWeek(checkDate);
        if (activeWeeks.has(weekKey)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 7);
        } else { break; }
    }
    return streak;
};

const getGoalCoachingAdvice = (goals: MemberGoals, logs: WorkoutLog[]): { status: string, advice: string, color: string } => {
    if (!goals || !goals.hasSpecificGoals || !goals.selectedGoals || goals.selectedGoals.length === 0) {
        return {
            status: "Sätt ett mål för att få coaching",
            advice: "Klicka på 'Redigera mål' för att ställa in dina SMART-mål, så kan jag analysera din träning och ge dig skräddarsydda tips!",
            color: "blue"
        };
    }

    let strengthCount = 0;
    let conditioningCount = 0;
    
    // Sort logs to check the most recent 10 workouts
    const recentLogs = [...logs].sort((a, b) => b.date - a.date).slice(0, 10);
    
    recentLogs.forEach(log => {
        const titleLower = (log.workoutTitle || '').toLowerCase();
        const hasCardioTag = log.tags?.some(tag => ['kondition', 'cardio', 'utmaning', 'löpning', 'intervaller'].includes(tag.toLowerCase()));
        const hasStrengthTag = log.tags?.some(tag => ['styrka', 'gym', 'tyngdlyftning', 'skivstång', 'kraft', 'gym_workout'].includes(tag.toLowerCase()));
        
        const isStrengthWord = titleLower.includes('styrka') || titleLower.includes('barbell') || titleLower.includes('kraft') || titleLower.includes('gym');
        const isConditioningWord = titleLower.includes('kondition') || titleLower.includes('cardio') || titleLower.includes('löpning') || titleLower.includes('intervall') || titleLower.includes('cykel') || titleLower.includes('rodd') || titleLower.includes('hiit') || titleLower.includes('pulspass');
        
        if (hasStrengthTag || isStrengthWord) {
            strengthCount++;
        }
        if (hasCardioTag || isConditioningWord) {
            conditioningCount++;
        }
    });

    const wantsStrength = goals.selectedGoals.some(g => g.toLowerCase().includes('styrka') || g.toLowerCase().includes('muskel'));
    const wantsConditioning = goals.selectedGoals.some(g => g.toLowerCase().includes('kondition') || g.toLowerCase().includes('uthållighet') || g.toLowerCase().includes('hjärthälsa') || g.toLowerCase().includes('viktminskning'));

    if (wantsStrength && wantsConditioning) {
        const ratio = strengthCount === 0 && conditioningCount === 0 ? 0.5 : strengthCount / (strengthCount + conditioningCount || 1);
        if (ratio >= 0.4 && ratio <= 0.6 && (strengthCount > 0 || conditioningCount > 0)) {
            return {
                status: "Perfekt balans i träningen! 🎉",
                advice: `Du balanserar din styrketräning (${strengthCount} st pass nyligen) och din konditionsträning (${conditioningCount} st pass nyligen) helt enligt plan! Fortsätt med denna jämna fördelning för att nå ditt mål optimalt och bibehålla en stark och uthållig kropp.`,
                color: "emerald"
            };
        } else if (strengthCount > conditioningCount + 2) {
            return {
                status: "Fokus på återstående kondition 🏃‍♂️",
                advice: `Du bygger fantastisk styrka just nu (${strengthCount} st styrkebaserade pass nyligen)! Men eftersom du också har mål inom kondition, glöm inte att smyga in lite flås. Prova att lägga till 1-2 dedikerade konditionspass eller pulshöjande avslutningar denna vecka.`,
                color: "orange"
            };
        } else if (conditioningCount > strengthCount + 2) {
            return {
                status: "Dags för tunga lyft 💪",
                advice: `Otrolig uthållighet! Din kondition (${conditioningCount} st pass nyligen) är på topp. För att komplettera din profil och stödja dina styrkemål, se till att lägga in ett fokuserat styrkepass den här veckan där du utmanar musklerna med lite tyngre belastning.`,
                color: "orange"
            };
        } else {
            return {
                status: "Sätt igång träningsmaskinen! 🚀",
                advice: `Du har inte loggat så många pass nyligen än. För en balanserad utveckling, kom igång denna vecka med ett kort, peppande styrkepass och ett skönt konditionspass. Fråga vår AI-coach i chatten nedan om du vill ha hjälp att lägga upp det!`,
                color: "blue"
            };
        }
    } else if (wantsStrength) {
        if (strengthCount > 0 && conditioningCount > strengthCount + 1) {
            return {
                status: "Uppmärksamma ditt styrkemål! 💪",
                advice: `Du har loggat ${conditioningCount} st konditionspass nyligen, men ditt primära mål är att bygga styrka. För bästa resultat och muskelutveckling, försök skifta om balansen och lägg in ett styrkepass där du fokuserar på progressiv överbelastning nyligen.`,
                color: "orange"
            };
        } else if (strengthCount > 2) {
            return {
                status: "Styrkeprogression på rätt spår! 🔥",
                advice: `Brutalt bra jobbat! Du har kört ${strengthCount} st styrkepass nyligen och håller en utmärkt riktning mot ditt styrkemål. Kom ihåg att logga dina vikter i appen så vi kan hålla koll på dina personliga rekord till nästa vecka!`,
                color: "emerald"
            };
        } else {
            return {
                status: "Dags att väcka musklerna! 🏋️‍♂️",
                advice: "För att starta din resa mot ökad styrka, boka in veckans första styrkepass redan idag. Fokusera på basövningar med bra teknik och rörlighet, och glöm inte att söka guidning av AI-coachen i chatten vid minsta osäkerhet!",
                color: "blue"
            };
        }
    } else if (wantsConditioning) {
        if (conditioningCount > 0 && strengthCount > conditioningCount + 1) {
            return {
                status: "Glöm inte flåset! 💓",
                advice: `Du bygger en stark grund med styrkepass (${strengthCount} st nyligen), men kom ihåg att ditt hjärta och flås är i fokus för ditt mål. Försök byta ut ett av styrkepassen mot ett roligt intervallpass, cykling eller löpning denna vecka för att maximera uthålligheten!`,
                color: "orange"
            };
        } else if (conditioningCount > 2) {
            return {
                status: "Konditionen frodas! 🐆",
                advice: `Snyggt flåsat! Med hela ${conditioningCount} st utförda konditionspass i din senaste historik är din puls på precis rätt nivå för att slå dina uthållighetsmål. Håll uppe kontinuiteten och våga utmana tempot lite extra på nästa pass!`,
                color: "emerald"
            };
        } else {
            return {
                status: "Boka in veckans flåspass 🏃‍♀️",
                advice: "Att förbättra konditionen handlar om regelbundenhet. Kör igång denna vecka med ett lättillgängligt konditionspass, t.ex. ett 20-30 minuters HIIT-pass, cykel- eller raska intervaller. Ta det i din egen takt och känn glädjen när flåset ökar!",
                color: "blue"
            };
        }
    }

    return {
        status: "Nå dina mål tillsammans med coachen 🌟",
        advice: `Grymt jobbat med dina uppsatta mål. Försök att planera in 2-3 pass i veckan som stöder dina delmål. Vår AI-coach i chatten står alltid redo med personliga rekommendationer utifrån vad du körde senast!`,
        color: "blue"
    };
};

const getLevelInfo = (count: number) => {
    const workoutsPerLevel = 10;
    const level = Math.floor(count / workoutsPerLevel) + 1;
    const workoutsInCurrentLevel = count % workoutsPerLevel;
    const progressToNext = (workoutsInCurrentLevel / workoutsPerLevel) * 100;
    return { level, progressToNext, workoutsInCurrentLevel, workoutsPerLevel };
};

const getAthleteArchetype = (logs: WorkoutLog[]) => {
    if (logs.length < 3) return { title: "Nykomling", icon: <SparklesIcon className="w-5 h-5" />, color: "from-blue-500 to-cyan-500", desc: "Du är i början av din resa. Fortsätt såhär!" };
    let strengthCount = 0, cardioCount = 0, hyroxCount = 0;
    logs.forEach(l => {
        const t = (l.workoutTitle + (l.tags?.join(' ') || '')).toLowerCase();
        if (t.includes('styrka') || t.includes('gym') || t.includes('power')) strengthCount++;
        if (t.includes('kondition') || t.includes('flås') || t.includes('löpning')) cardioCount++;
        if (t.includes('hyrox')) hyroxCount++;
    });
    if (hyroxCount > 3) return { title: "HYROX-Krigare", icon: <LightningIcon className="w-5 h-5" />, color: "from-yellow-500 to-orange-500", desc: "Du älskar funktionell fitness och tävlingsmomentet!" };
    if (strengthCount > cardioCount + 2) return { title: "Lyftaren", icon: <DumbbellIcon className="w-5 h-5" />, color: "from-red-500 to-pink-600", desc: "Tunga lyft är din grej. Starkt jobbat!" };
    if (cardioCount > strengthCount + 2) return { title: "Maskinen", icon: <FireIcon className="w-5 h-5" />, color: "from-orange-400 to-red-500", desc: "Uthållighet av stål. Du slutar aldrig!" };
    return { title: "Hybridatlet", icon: <UserIcon className="w-5 h-5" />, color: "from-indigo-500 to-purple-600", desc: "Du behärskar både styrka och kondition. Den kompletta atleten." };
};

const BenchmarkDetailModal: React.FC<{ 
    benchmark: any, 
    onClose: () => void, 
    onViewLog: (log: WorkoutLog) => void,
    formatResult: (val: number, type: string) => string,
    getUnit: (type: string) => string
}> = ({ benchmark, onClose, onViewLog, formatResult, getUnit }) => {
    const { def, history, pb } = benchmark;
    
    // Prepare chart data
    const chartData = [...history].reverse().map((log: any) => ({
        name: new Date(log.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
        value: log.benchmarkValue,
        fullDate: new Date(log.date).toLocaleDateString('sv-SE'),
    }));

    return (
        <Modal isOpen={true} onClose={onClose} title={def.title} size="lg">
            <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Personbästa</p>
                        <p className="text-2xl font-black text-primary">
                            {formatResult(pb.benchmarkValue, def.type)} <span className="text-sm">{getUnit(def.type)}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Försök</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{history.length}</p>
                    </div>
                </div>

                {history.length > 1 && (
                    <div className="h-48 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} vertical={false} />
                                <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => def.type === 'time' ? formatResult(val, def.type) : val} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }}
                                    formatter={(value: number) => [formatResult(value, def.type) + ' ' + getUnit(def.type), 'Resultat']}
                                    labelFormatter={(label) => `Datum: ${label}`}
                                />
                                <Line type="monotone" dataKey="value" stroke="#14B8A6" strokeWidth={3} dot={{ r: 4, fill: '#14B8A6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-3">Historik</h4>
                    <div className="space-y-2">
                        {history.map((log: any, index: number) => {
                            const isPB = log.id === pb.id;
                            let diffText = null;
                            let isImprovement = false;
                            
                            if (index < history.length - 1) {
                                const prevLog = history[index + 1];
                                const diff = log.benchmarkValue - prevLog.benchmarkValue;
                                if (diff !== 0) {
                                    isImprovement = def.type === 'time' ? diff < 0 : diff > 0;
                                    const diffFormatted = formatResult(Math.abs(diff), def.type);
                                    diffText = isImprovement ? `+${diffFormatted}` : `-${diffFormatted}`;
                                    if (def.type === 'time') {
                                        diffText = isImprovement ? `-${diffFormatted}` : `+${diffFormatted}`;
                                    }
                                }
                            }

                            return (
                                <div 
                                    key={log.id} 
                                    onClick={() => onViewLog(log)}
                                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-primary/50 transition-colors"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900 dark:text-white">
                                                {new Date(log.date).toLocaleDateString('sv-SE')}
                                            </span>
                                            {isPB && <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">PB</span>}
                                        </div>
                                        <div className="flex gap-2 mt-1 text-xs text-gray-500">
                                            {log.feeling && <span>{log.feeling === 'good' ? '🔥' : log.feeling === 'bad' ? '🤕' : '🙂'}</span>}
                                            {log.rpe && <span>RPE {log.rpe}</span>}
                                            {log.diploma && <span className="text-indigo-500 flex items-center gap-1"><TrophyIcon className="w-3 h-3" /> Diplom</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-lg text-gray-900 dark:text-white">
                                            {formatResult(log.benchmarkValue, def.type)} <span className="text-xs font-bold text-gray-500">{getUnit(def.type)}</span>
                                        </div>
                                        {diffText && (
                                            <div className={`text-[10px] font-bold ${isImprovement ? 'text-green-500' : 'text-red-500'}`}>
                                                {diffText} {getUnit(def.type)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const BenchmarksView: React.FC<{ logs: WorkoutLog[], definitions: BenchmarkDefinition[], onViewLog: (log: WorkoutLog) => void }> = ({ logs, definitions, onViewLog }) => {
    const [selectedBenchmark, setSelectedBenchmark] = useState<any>(null);

    // Process data to find PBs for each benchmark definition and sort them
    const sortedBenchmarks = useMemo(() => {
        const mapped = definitions.map(def => {
            // Find all logs that match this benchmark ID
            const relevantLogs = logs.filter(l => l.benchmarkId === def.id && l.benchmarkValue !== undefined);
            
            if (relevantLogs.length === 0) return { def, pb: null, attempts: 0, lastDate: 0, history: [] };

            // Sort by date descending (newest first)
            const history = [...relevantLogs].sort((a, b) => b.date - a.date);

            // Sort based on type to find PB
            const sortedLogs = [...relevantLogs].sort((a, b) => {
                if (def.type === 'time') return (a.benchmarkValue || 0) - (b.benchmarkValue || 0); // Lower time is better
                return (b.benchmarkValue || 0) - (a.benchmarkValue || 0); // Higher reps/weight is better
            });
            
            // Find latest date for sorting the list
            const lastDate = history[0].date;

            // Calculate trend (latest vs previous)
            let trend = null;
            if (history.length > 1) {
                const latest = history[0].benchmarkValue || 0;
                const previous = history[1].benchmarkValue || 0;
                const diff = latest - previous;
                
                let isImprovement = false;
                if (def.type === 'time') {
                    isImprovement = diff < 0;
                } else {
                    isImprovement = diff > 0;
                }
                
                trend = {
                    diff: Math.abs(diff),
                    isImprovement,
                    hasChanged: diff !== 0
                };
            }

            return {
                def,
                pb: sortedLogs[0],
                latest: history[0],
                attempts: relevantLogs.length,
                lastDate,
                history,
                trend
            };
        });

        // Filter out benchmarks that have never been attempted
        const attemptedBenchmarks = mapped.filter(item => item.pb !== null);

        // Sort: Most recently attempted/completed first
        return attemptedBenchmarks.sort((a, b) => b.lastDate - a.lastDate);

    }, [logs, definitions]);

    const formatResult = (val: number, type: string) => {
        if (type === 'time') {
            const m = Math.floor(val / 60);
            const s = val % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
        return `${val}`;
    };

    const getUnit = (type: string) => {
        if (type === 'time') return ''; // Usually looks better without 'min' if format is MM:SS
        if (type === 'reps') return 'Varv'; // Changed from 'reps' to 'Varv' as requested
        if (type === 'weight') return 'kg';
        return '';
    };

    if (sortedBenchmarks.length === 0) {
        return (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 animate-fade-in">
                <p className="text-gray-400 text-sm">Här visas dina resultat när du kört ett benchmark-pass.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sortedBenchmarks.map((benchmark) => {
                    const { def, pb, attempts, trend } = benchmark;
                    return (
                        <div 
                            key={def.id} 
                            onClick={() => setSelectedBenchmark(benchmark)}
                            className={`cursor-pointer relative overflow-hidden rounded-3xl p-6 transition-all bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 border-2 border-yellow-400/30 dark:border-yellow-500/20 hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-lg`}
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-3xl -mr-6 -mt-6"></div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="font-bold truncate pr-2 text-lg text-gray-900 dark:text-white">
                                        {def.title}
                                    </h4>
                                    <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-lg">
                                        <TrophyIcon className="w-4 h-4" />
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                                            {formatResult(pb!.benchmarkValue!, def.type)} <span className="text-sm text-gray-500 font-bold">{getUnit(def.type)}</span>
                                        </p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-wider font-bold">
                                            {new Date(pb!.date).toLocaleDateString('sv-SE')} • {attempts} försök
                                        </p>
                                    </div>
                                    {trend && trend.hasChanged && (
                                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trend.isImprovement ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {trend.isImprovement ? '↑' : '↓'} {formatResult(trend.diff, def.type)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedBenchmark && (
                <BenchmarkDetailModal 
                    benchmark={selectedBenchmark} 
                    onClose={() => setSelectedBenchmark(null)} 
                    onViewLog={onViewLog}
                    formatResult={formatResult}
                    getUnit={getUnit}
                />
            )}
        </div>
    );
};

// --- Sub-components ---

const GoalsEditModal: React.FC<{ currentGoals?: MemberGoals, onSave: (goals: MemberGoals) => void, onClose: () => void }> = ({ currentGoals, onSave, onClose }) => {
    const [selectedGoals, setSelectedGoals] = useState<string[]>(currentGoals?.selectedGoals || []);
    const [targetDate, setTargetDate] = useState(currentGoals?.targetDate || '');
    const [isSmartEnabled, setIsSmartEnabled] = useState(!!currentGoals?.smartCriteria);
    const [smart, setSmart] = useState<SmartGoalDetail>(currentGoals?.smartCriteria || { specific: '', measurable: '', achievable: '', relevant: '', timeBound: '' });
    
    const toggleGoal = (goal: string) => setSelectedGoals(selectedGoals.includes(goal) ? selectedGoals.filter(g => g !== goal) : [...selectedGoals, goal]);
    
    const handleClear = () => {
        setSelectedGoals([]);
        setTargetDate('');
        setIsSmartEnabled(false);
        setSmart({ specific: '', measurable: '', achievable: '', relevant: '', timeBound: '' });
    };

    const handleSave = () => {
        const isNewGoalText = currentGoals?.smartCriteria?.specific !== (isSmartEnabled ? smart.specific : undefined);
        const isNewTargetDate = currentGoals?.targetDate !== targetDate;
        const startDate = (isNewGoalText || isNewTargetDate || !currentGoals?.startDate)
            ? new Date().toISOString().split('T')[0]
            : currentGoals.startDate;

        onSave({
            hasSpecificGoals: selectedGoals.length > 0 || (isSmartEnabled && !!smart.specific),
            selectedGoals,
            targetDate,
            startDate,
            smartCriteria: isSmartEnabled ? smart : undefined
        });
    };
    
    const inputClasses = "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all font-medium";
    const labelClasses = "block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1";
    
    return (
        <Modal isOpen={true} onClose={onClose} title="Sätt dina mål" size="md">
            <div className="space-y-8">
                <div className="flex justify-end">
                    <button onClick={handleClear} className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors uppercase tracking-wider">
                        Börja om / Rensa
                    </button>
                </div>
                <div><label className={labelClasses}>Målkategorier</label><div className="flex flex-wrap gap-2">{['Bli starkare', 'Bygga muskler', 'Gå ner i vikt', 'Bättre kondition', 'HYROX', 'Må bra', 'Rörlighet'].map(goal => (<button key={goal} onClick={() => toggleGoal(goal)} className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${selectedGoals.includes(goal) ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-transparent hover:border-gray-300'}`}>{goal}</button>))}</div></div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50"><ToggleSwitch label="Använd SMART-metoden" checked={isSmartEnabled} onChange={setIsSmartEnabled} /><p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mt-2 ml-1">För dig som vill vara extra tydlig</p></div>
                <AnimatePresence>{isSmartEnabled && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                    <div><label className={labelClasses}>S - Specifikt (Vad exakt?)</label><input value={smart.specific} onChange={e => setSmart({...smart, specific: e.target.value})} className={inputClasses} placeholder="T.ex. Klara 5 chins eller 100kg i knäböj" /></div>
                    <div><label className={labelClasses}>M - Mätbart (Hur vet vi?)</label><input value={smart.measurable} onChange={e => setSmart({...smart, measurable: e.target.value})} className={inputClasses} placeholder="T.ex. Genom antal repetitioner eller kg på stången" /></div>
                    <div><label className={labelClasses}>A - Accepterat (Är det rimligt?)</label><input value={smart.achievable} onChange={e => setSmart({...smart, achievable: e.target.value})} className={inputClasses} placeholder="T.ex. Ja, jag tränar 3 gånger i veckan" /></div>
                    <div><label className={labelClasses}>R - Relevant (Varför är det viktigt?)</label><input value={smart.relevant} onChange={e => setSmart({...smart, relevant: e.target.value})} className={inputClasses} placeholder="T.ex. För att känna mig starkare i vardagen" /></div>
                </motion.div>)}</AnimatePresence>
                <div><label className={labelClasses}>T - Tidsbestämt (Måldatum)</label><input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={inputClasses} /></div>
                <button onClick={handleSave} className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-widest">Spara Mål</button>
            </div>
        </Modal>
    );
};

const LogDetailModal: React.FC<{ log: WorkoutLog, onClose: () => void, onUpdate: (id: string, data: Partial<WorkoutLog>) => void, onDelete: (id: string) => void, onViewDiploma?: (diploma: WorkoutDiploma) => void }> = ({ log, onClose, onUpdate, onDelete, onViewDiploma }) => {
    const [isEditing, setIsEditing] = useState(false);
    const confirm = useConfirm();
    const [comment, setComment] = useState(log.comment || '');
    const handleSave = () => { onUpdate(log.id, { comment }); setIsEditing(false); };
    const handleDelete = async () => {
        const isConfirmed = await confirm({
            title: "Ta bort pass?",
            message: "Är du säker på att du vill ta bort detta pass? Detta går inte att ångra.",
            confirmText: "Ta bort",
            confirmColor: "red"
        });
        if(isConfirmed) { onDelete(log.id); onClose(); }
    };
    const isCustomActivity = log.activityType === 'custom_activity' || (!log.exerciseResults || log.exerciseResults.length === 0);
    return (
        <Modal isOpen={true} onClose={onClose} title={log.workoutTitle} size="lg">
            <div className="space-y-6">
                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400"><span>{new Date(log.date).toLocaleString()}</span><div className="flex gap-2">{log.feeling && <span className="font-medium" title="Känsla">{log.feeling === 'good' ? '🔥' : log.feeling === 'bad' ? '🤕' : '🙂'}</span>}{log.rpe && <span className="font-bold bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">RPE {log.rpe}</span>}</div></div>
                {isCustomActivity && (<div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700"><div className="grid grid-cols-3 gap-4 divide-x divide-gray-200 dark:divide-gray-700"><div className="text-center px-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tid</p><p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.durationMinutes || 0}<span className="text-xs ml-1 font-normal text-gray-500">min</span></p></div><div className="text-center px-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Distans</p><p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.totalDistance || 0}<span className="text-xs ml-1 font-normal text-gray-500">km</span></p></div><div className="text-center px-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Energi</p><p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.totalCalories || 0}<span className="text-xs ml-1 font-normal text-gray-500">kcal</span></p></div></div></div>)}
                {log.exerciseResults && log.exerciseResults.length > 0 && (<div className="space-y-2"><h4 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-2">Resultat</h4>{log.exerciseResults.map((ex, i) => (<div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800"><span className="font-medium text-gray-800 dark:text-gray-200">{ex.exerciseName}</span><span className="font-mono text-primary font-bold">{ex.weight ? `${ex.weight}kg` : ''} {ex.reps ? ` ${ex.reps}` : ''}</span></div>))}</div>)}
                <div><h4 className="font-bold text-gray-900 dark:text-white mb-2 text-sm uppercase tracking-wider">Kommentar</h4>{isEditing ? (<textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition" rows={3} />) : (<p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg italic border border-gray-100 dark:border-gray-800">{log.comment || "Ingen kommentar."}</p>)}</div>
                {log.diploma && onViewDiploma && (
                    <button 
                        onClick={() => onViewDiploma(log.diploma!)}
                        className="w-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold py-3 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800/50"
                    >
                        <TrophyIcon className="w-5 h-5" /> Visa Diplom
                    </button>
                )}
                <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">{isEditing ? (<button onClick={handleSave} className="flex-1 bg-primary text-white font-bold py-3 rounded-xl hover:brightness-110 transition-colors">Spara ändringar</button>) : (<button onClick={() => setIsEditing(true)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Redigera text</button>)}<button onClick={handleDelete} className="px-6 text-red-500 font-bold bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors flex items-center justify-center border border-red-100 dark:border-red-900/30" title="Radera pass"><TrashIcon className="w-5 h-5" /></button></div>
            </div>
        </Modal>
    );
};

const PushNotificationSettings: React.FC = () => {
    const [isRequesting, setIsRequesting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');

    const handleEnablePush = async () => {
        if (!auth?.currentUser?.uid) return;
        setIsRequesting(true);
        setStatus('idle');
        try {
            const token = await requestPushNotificationPermission(auth.currentUser.uid);
            if (token) {
                setStatus('granted');
            } else {
                setStatus('denied');
            }
        } catch (error) {
            console.error(error);
            setStatus('error');
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-gray-800/50 p-6 rounded-2xl border border-slate-200 dark:border-gray-700 mt-2">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Push-notiser</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Aktivera push-notiser för att få uppdateringar och påminnelser direkt i din enhet.
            </p>
            
            <div className="flex items-center gap-4">
                <button 
                    onClick={handleEnablePush} 
                    disabled={isRequesting || status === 'granted'}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                        status === 'granted' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-primary text-white hover:brightness-110'
                    } disabled:opacity-50`}
                >
                    {isRequesting ? 'Aktiverar...' : status === 'granted' ? 'Aktiverat' : 'Aktivera push-notiser'}
                </button>
                {status === 'denied' && <span className="text-sm text-red-500">Nekades av webbläsaren</span>}
                {status === 'error' && <span className="text-sm text-red-500">Ett fel uppstod</span>}
            </div>
        </div>
    );
};

export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({ userData, onBack, profileEditTrigger, navigateTo, functions, studioConfig }) => {
    const { selectedOrganization } = useStudio();
    const isNewUser = !userData.firstName || !userData.organizationId;
    const confirm = useConfirm();
    
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(isNewUser);
    const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingGoals, setIsEditingGoals] = useState(false);
    const [isCreatingNewGoal, setIsCreatingNewGoal] = useState(false);
    const [isMyStrengthVisible, setIsMyStrengthVisible] = useState(false);
    const [viewingDiploma, setViewingDiploma] = useState<WorkoutDiploma | null>(null);
    const [communityLogs, setCommunityLogs] = useState<WorkoutLog[]>([]);
    const [membersList, setMembersList] = useState<any[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<WorkoutLog | null>(null);
    const [isShowingAllPhotos, setIsShowingAllPhotos] = useState(false);
    const [showFormulaInfo, setShowFormulaInfo] = useState(false);
    const [dismissedSummerChallenge, setDismissedSummerChallenge] = useState(() => {
        if (typeof window !== 'undefined' && userData?.uid) {
            return localStorage.getItem(`dismissed-summer-challenge-${userData.uid}`) === 'true';
        }
        return false;
    });

    useEffect(() => {
        if (userData?.uid) {
            const dismissed = localStorage.getItem(`dismissed-summer-challenge-${userData.uid}`) === 'true';
            setDismissedSummerChallenge(dismissed);
        }
    }, [userData?.uid]);

    useEffect(() => {
        const activeTheme = !!(studioConfig?.enableSummerChallenge || selectedOrganization?.globalConfig?.enableSummerChallenge);
        if (!activeTheme || !userData.organizationId) return;
        import('../services/firebaseService').then(({ listenToMembers }) => {
            const unsubscribe = listenToMembers(userData.organizationId!, (members) => {
                setMembersList(members);
            });
            return () => unsubscribe();
        });
    }, [studioConfig, selectedOrganization, userData.organizationId]);

    const configToUse = useMemo(() => {
        if (!selectedOrganization) return studioConfig || {};
        return {
            ...(selectedOrganization || {}),
            ...(selectedOrganization.globalConfig || {}),
            ...(studioConfig || {})
        } as any;
    }, [studioConfig, selectedOrganization]);

    const isSummerThemeActive = useMemo(() => {
        return !!configToUse?.enableSummerChallenge;
    }, [configToUse]);

    const currentTimestamp = Date.now();

    const isChallengeStarted = useMemo(() => {
        if (!isSummerThemeActive) return false;
        if (!configToUse?.summerChallengeStartDate) return true; // Default to true if not set
        return currentTimestamp >= configToUse.summerChallengeStartDate;
    }, [isSummerThemeActive, configToUse, currentTimestamp]);

    const isChallengeEnded = useMemo(() => {
        if (!isSummerThemeActive) return false;
        if (!configToUse?.summerChallengeEndDate) return false;
        return currentTimestamp > configToUse.summerChallengeEndDate;
    }, [isSummerThemeActive, configToUse, currentTimestamp]);

    const filteredCommunityLogs = useMemo(() => {
        if (!userData?.locationId) return communityLogs;
        return communityLogs.filter(log => log.locationId === userData.locationId);
    }, [communityLogs, userData?.locationId]);

    const [sisuDetailsExpanded, setSisuDetailsExpanded] = useState(false);
    const [justActivatedSummer, setJustActivatedSummer] = useState(false);

    const summerStats = useMemo(() => {
        if (!isSummerThemeActive) return { 
            avgPoints: 0, 
            totalPoints: 0, 
            activeUsersCount: 0, 
            label: 'SVALT', 
            emoji: '❄️', 
            colorClass: 'text-sky-400', 
            bannerBgClass: 'from-blue-600/30 to-slate-900', 
            scale: 'svalt',
            N: 1,
            thresholdLjummet: 3,
            thresholdVarmt: 6,
            thresholdHet: 10,
            nextTarget: 3,
            totalRegisteredCount: 0
        };
        
        const now = new Date();
        const currentDay = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - (currentDay - 1));
        monday.setHours(0, 0, 0, 0);

        const thisWeeksLogs = filteredCommunityLogs.filter(log => (log.date || 0) >= monday.getTime());
        const userPointsMap: Record<string, number> = {};
        let totalPoints = 0;

        thisWeeksLogs.forEach(log => {
            const uid = log.memberId;
            if (!uid) return;
            let pts = 0;
            if (log.inStudio === true) {
                pts = 2;
            } else {
                const isLessThan30 = log.durationMinutes !== undefined && log.durationMinutes > 0 && log.durationMinutes < 30;
                if (!isLessThan30) {
                    pts = 1;
                }
            }
            userPointsMap[uid] = (userPointsMap[uid] || 0) + pts;
            totalPoints += pts;
        });

        const activeUsersCount = Object.keys(userPointsMap).length;

        // Base member count (N): signed up BEFORE this week's Monday
        const locationMembers = membersList.filter(m => {
            if (userData?.locationId && m.locationId !== userData.locationId) return false;
            return true;
        });

        const challengeParticipantsOnSunday = locationMembers.filter(m => {
            if (!m.joinedSummerChallenge) return false;
            const joinedAt = m.joinedSummerChallengeAt || 0;
            return joinedAt < monday.getTime();
        });

        const N = Math.max(1, challengeParticipantsOnSunday.length);

        const thresholdLjummet = 3 * N;
        const thresholdVarmt = 6 * N;
        const thresholdHet = 10 * N;

        let label = 'SVALT';
        let emoji = '❄️';
        let colorClass = 'text-sky-400';
        let bannerBgClass = 'from-sky-500/10 to-slate-900';
        let scale = 'svalt';
        let nextTarget = thresholdLjummet;

        if (totalPoints >= thresholdHet) {
            label = 'HET';
            emoji = '🌋';
            colorClass = 'text-red-500 dark:text-red-400';
            bannerBgClass = 'from-red-500/20 to-slate-950';
            scale = 'het';
            nextTarget = -1;
        } else if (totalPoints >= thresholdVarmt) {
            label = 'VARMT';
            emoji = '🔥';
            colorClass = 'text-orange-500 dark:text-orange-400';
            bannerBgClass = 'from-orange-500/20 to-slate-950';
            scale = 'varmt';
            nextTarget = thresholdHet;
        } else if (totalPoints >= thresholdLjummet) {
            label = 'LJUMMET';
            emoji = '🌤️';
            colorClass = 'text-yellow-500 dark:text-yellow-400';
            bannerBgClass = 'from-yellow-500/20 to-slate-950';
            scale = 'ljummet';
            nextTarget = thresholdVarmt;
        }

        const avgPoints = N > 0 ? Number((totalPoints / N).toFixed(1)) : 0;
        const totalRegisteredCount = locationMembers.filter(m => m.joinedSummerChallenge).length;

        return {
            totalPoints,
            avgPoints,
            activeUsersCount,
            label,
            emoji,
            colorClass,
            bannerBgClass,
            scale,
            N,
            thresholdLjummet,
            thresholdVarmt,
            thresholdHet,
            nextTarget,
            totalRegisteredCount
        };
    }, [filteredCommunityLogs, isSummerThemeActive, membersList, userData?.locationId]);

    const [activeTab, setActiveTab] = useState<'overview' | 'goals' | 'strength' | 'benchmarks'>(() => {
        const saved = localStorage.getItem('smart-skarm-profile-active-tab');
        if (saved === 'summer') return 'overview';
        return (saved as any) || 'overview';
    });

    useEffect(() => {
        localStorage.setItem('smart-skarm-profile-active-tab', activeTab);
    }, [activeTab]);


    const [summerTabLeaderboard, setSummerTabLeaderboard] = useState<'weekly' | 'overall'>('weekly');

    useEffect(() => {
        if (!isSummerThemeActive || !userData.organizationId) return;
        import('../services/firebaseService').then(({ listenToLeaderboardLogs }) => {
            const unsubscribe = listenToLeaderboardLogs(userData.organizationId!, 1000, (logs) => {
                setCommunityLogs(logs);
            });
            return () => unsubscribe();
        });
    }, [isSummerThemeActive, userData.organizationId]);
    const [selectedDateLogs, setSelectedDateLogs] = useState<{date: Date, logs: WorkoutLog[]} | null>(null);
    const [personalHyroxResults, setPersonalHyroxResults] = useState<{ id: string; raceName: string; date: string; time: number; placement: number; division: string }[]>([]);
    const [hyroxSectionCollapsed, setHyroxSectionCollapsed] = useState(true);
    
    // Resume session state
    const [activeSession, setActiveSession] = useState<any | null>(null);

    const isOwnProfile = auth?.currentUser?.uid === userData.uid;
    const [showMigrateModal, setShowMigrateModal] = useState(false);

    // Form states
    const [firstName, setFirstName] = useState(userData.firstName || '');
    const [lastName, setLastName] = useState(userData.lastName || '');
    const [birthDate, setBirthDate] = useState(userData.birthDate || '');
    const [gender, setGender] = useState(userData.gender || 'prefer_not_to_say');
    const [photoUrl, setPhotoUrl] = useState(userData.photoUrl || '');
    const [backgroundImageUrl, setBackgroundImageUrl] = useState(userData.backgroundImageUrl || '');
    const [backgroundOverlayOpacity, setBackgroundOverlayOpacity] = useState(userData.backgroundOverlayOpacity ?? 20);
    const [weeklyGoal, setWeeklyGoal] = useState(userData.weeklyGoal || 3);
    const [showGoalSaved, setShowGoalSaved] = useState(false);
    const [showOnLeaderboard, setShowOnLeaderboard] = useState(userData.showOnLeaderboard !== false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bgFileInputRef = useRef<HTMLInputElement>(null);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 8) v = v.slice(0, 8);
        if (v.length > 6) {
            v = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}`;
        } else if (v.length > 4) {
            v = `${v.slice(0, 4)}-${v.slice(4)}`;
        }
        setBirthDate(v);
    };

    useEffect(() => {
        if (profileEditTrigger > 0) setIsEditing(true);
    }, [profileEditTrigger]);

    // Reactive LocalStorage checking
    const checkActiveSession = () => {
        const saved = localStorage.getItem(ACTIVE_LOG_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.memberId === userData.uid) {
                    const title = parsed.workoutTitle || "Namnlöst pass";
                    setActiveSession({ ...parsed, displayTitle: title });
                    return;
                }
            } catch(e) { console.warn(e); }
        }
        setActiveSession(null);
    };

    // 1. Initial check
    useEffect(() => { checkActiveSession(); }, [userData.uid]);

    // 2. Refresh when window gains focus (e.g. after closing the log modal)
    useEffect(() => {
        window.addEventListener('focus', checkActiveSession);
        return () => window.removeEventListener('focus', checkActiveSession);
    }, []);

    // 3. Interval check if a session is currently displayed (to clear it immediately after save)
    useEffect(() => {
        const interval = setInterval(checkActiveSession, 2000);
        return () => clearInterval(interval);
    }, []);

    // Real-time log listening
    useEffect(() => {
        if (!userData.uid) return;
        setLoading(true);
        const unsubscribe = listenToMemberLogs(userData.uid, (data) => {
            setLogs(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [userData.uid]);

    useEffect(() => {
        const orgId = userData.organizationId || selectedOrganization?.id;
        if (!orgId || !userData.email) return;

        const fetchResults = async () => {
            try {
                const pastRaces = await getPastRaces(orgId);
                const userResults: typeof personalHyroxResults = [];

                pastRaces.forEach(race => {
                    if (!race.results) return;
                    
                    const matchedResult = race.results.find(res => 
                        res.email?.toLowerCase() === userData.email.toLowerCase() || 
                        res.partnerEmail?.toLowerCase() === userData.email.toLowerCase()
                    );
                    if (matchedResult) {
                        // Find division from startgroups
                        let division = 'Singel Herr';
                        race.startGroups?.forEach(g => {
                            const p = g.participantList?.find(pl => 
                                pl.email?.toLowerCase() === userData.email.toLowerCase() ||
                                pl.partnerEmail?.toLowerCase() === userData.email.toLowerCase()
                            );
                            if (p && p.division) {
                                division = p.division;
                            }
                        });

                        // Calculate live placement by sorting results
                        const sortedResults = [...race.results].sort((a, b) => a.time - b.time);
                        const calculatedPlacement = sortedResults.findIndex(res => 
                            res.email?.toLowerCase() === userData.email.toLowerCase() ||
                            res.partnerEmail?.toLowerCase() === userData.email.toLowerCase()
                        ) + 1;

                        userResults.push({
                            id: race.id,
                            raceName: race.raceName,
                            date: typeof race.createdAt === 'number' ? new Date(race.createdAt).toISOString() : String(race.createdAt),
                            time: matchedResult.time,
                            placement: calculatedPlacement > 0 ? calculatedPlacement : 1,
                            division
                        });
                    }
                });

                setPersonalHyroxResults(userResults);
            } catch (err) {
                console.error("Failed to fetch past races for user results context", err);
            }
        };

        fetchResults();
    }, [userData.organizationId, selectedOrganization?.id, userData.email]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsSaving(true);
        try {
            const resized = await resizeImage(file, 400, 400, 0.8);
            const path = `users/${userData.uid}/profile_${Date.now()}.jpg`;
            const url = await uploadImage(path, resized);
            setPhotoUrl(url);
            await updateUserProfile(userData.uid, { photoUrl: url });
        } catch (err) {
            alert("Kunde inte spara bilden.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsSaving(true);
        try {
            const resized = await resizeImage(file, 1200, 1600, 0.8);
            const path = `users/${userData.uid}/bg_${Date.now()}.jpg`;
            const url = await uploadImage(path, resized);
            setBackgroundImageUrl(url);
            await updateUserProfile(userData.uid, { backgroundImageUrl: url });
        } catch (err) {
            alert("Kunde inte spara bakgrundsbilden.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (birthDate && birthDate.length !== 10) {
            alert("Vänligen ange ett fullständigt födelsedatum (ÅÅÅÅ-MM-DD).");
            return;
        }
        setIsSaving(true);
        try {
            await updateUserProfile(userData.uid, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                birthDate: birthDate || undefined,
                gender: gender as any,
                weeklyGoal: Number(weeklyGoal),
                showOnLeaderboard,
                backgroundOverlayOpacity: Number(backgroundOverlayOpacity)
            });
            setIsEditing(false);
        } catch (error) {
            alert("Kunde inte spara profil.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveGoals = async (newGoals: MemberGoals) => {
        try {
            await updateUserGoals(userData.uid, newGoals);
            setIsEditingGoals(false);
        } catch (error) {
            alert("Kunde inte spara målen.");
        }
    };

    const [showArchetypeInfo, setShowArchetypeInfo] = useState(false);

    const handleUpdateLog = async (logId: string, updates: Partial<WorkoutLog>) => {
        await updateWorkoutLog(logId, updates);
    };

    const handleDeleteLog = async (logId: string) => {
        await deleteWorkoutLog(logId);
        setSelectedLog(null);
    };

    const stats = useMemo(() => {
        const totalWorkouts = logs.length + (userData?.migratedStats?.totalWorkouts || 0);
        const now = new Date();
        const thisMonth = logs.filter(l => {
            const date = new Date(l.date);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length;
        const weeklyStreak = calculateWeeklyStreak(logs, userData?.migratedStats);
        const currentWeekKey = getYearWeek(now);
        const thisWeek = logs.filter(l => getYearWeek(new Date(l.date)) === currentWeekKey).length;
        const hasTrainedThisWeek = thisWeek > 0;

        // Beräkna Sommar-Sisu poäng för den här användaren i realtid
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        let summerTotalPoints = 0;
        let summerWeekPoints = 0;

        logs.forEach(log => {
            let pts = 0;
            if (log.inStudio === true) {
                pts = 2;
            } else {
                const isLessThan30 = log.durationMinutes !== undefined && log.durationMinutes > 0 && log.durationMinutes < 30;
                if (!isLessThan30) {
                    pts = 1;
                }
            }
            summerTotalPoints += pts;
            
            const logTime = new Date(log.date).getTime();
            if (logTime >= startOfWeek.getTime()) {
                summerWeekPoints += pts;
            }
        });

        return { 
            totalWorkouts, 
            thisMonth, 
            weeklyStreak, 
            hasTrainedThisWeek, 
            thisWeek, 
            summerTotalPoints, 
            summerWeekPoints 
        };
    }, [logs, userData?.migratedStats]);

    const daysLeft = useMemo(() => {
        if (!userData.goals?.targetDate) return null;
        const target = new Date(userData.goals.targetDate);
        const now = new Date();
        const diffTime = target.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }, [userData.goals?.targetDate]);

    const progressPercentage = useMemo(() => {
        if (!userData.goals?.targetDate || !userData.goals?.startDate) return 0;
        const start = new Date(userData.goals.startDate).getTime();
        const target = new Date(userData.goals.targetDate).getTime();
        const now = new Date().getTime();
        if (target <= start) return 100;
        const total = target - start;
        const elapsed = now - start;
        const percent = Math.floor((elapsed / total) * 100);
        return Math.min(100, Math.max(0, percent));
    }, [userData.goals]);

    const archetype = useMemo(() => getAthleteArchetype(logs), [logs]);
    const { level, progressToNext, workoutsInCurrentLevel, workoutsPerLevel } = useMemo(() => getLevelInfo(logs.length), [logs]);

    const handleResumeWorkout = () => {
        if (activeSession && functions.handleLogWorkoutRequest) {
            const workoutId = activeSession.workoutId === 'manual' ? 'MANUAL_ENTRY' : activeSession.workoutId;
            functions.handleLogWorkoutRequest(workoutId, activeSession.organizationId);
        }
    };

    const handleDismissResume = async () => {
        const isConfirmed = await confirm({
            title: "Släng sparad data?",
            message: "Är du säker på att du vill kasta det sparade passet? All data du fyllt i kommer att försvinna.",
            confirmText: "Släng passet",
            confirmColor: "red"
        });
        if (isConfirmed) {
            localStorage.removeItem(ACTIVE_LOG_STORAGE_KEY);
            setActiveSession(null);
        }
    };

    // --- RENDER EDIT FORM ---
    if (isEditing) {
        return (
            <div className="w-full max-w-2xl mx-auto px-6 py-12 animate-fade-in pb-32">
                <style>{`
                    #user-background-layer { display: none !important; }
                    #app-root-container { background-color: #ffffff !important; }
                    html.dark #app-root-container { background-color: #000000 !important; }
                `}</style>
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Redigera profil</h2>
                    {!isNewUser && (
                        <button onClick={() => setIsEditing(false)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                            <CloseIcon className="w-6 h-6 text-gray-500" />
                        </button>
                    )}
                </div>

                <div className="space-y-8">
                    {/* Profilbild */}
                    <div className="flex flex-col items-center gap-4">
                        <div 
                            className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-900 shadow-xl flex items-center justify-center overflow-hidden cursor-pointer relative group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-12 h-12 text-gray-300" />}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-xs font-black uppercase tracking-widest">Ändra</span>
                            </div>
                            {isSaving && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>

                    {/* Bakgrundsbild */}
                    <div className="flex flex-col items-center gap-4">
                        <div 
                            className="w-full h-32 sm:h-48 rounded-2xl bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-900 shadow-xl flex items-center justify-center overflow-hidden cursor-pointer relative group"
                            onClick={() => bgFileInputRef.current?.click()}
                        >
                            {backgroundImageUrl ? (
                                <>
                                    <img src={backgroundImageUrl} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 block dark:hidden mix-blend-normal pointer-events-none" style={{ backgroundColor: `rgba(255,255,255,${backgroundOverlayOpacity / 100})` }}></div>
                                    <div className="absolute inset-0 hidden dark:block mix-blend-normal pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${backgroundOverlayOpacity / 100})` }}></div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center text-gray-400">
                                    <span className="text-sm font-bold uppercase tracking-widest mb-1">Bakgrundsbild</span>
                                    <span className="text-xs">Klicka för att ladda upp</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-xs font-black uppercase tracking-widest">Ändra bakgrundsbild</span>
                            </div>
                            {isSaving && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}
                        </div>
                        <input type="file" ref={bgFileInputRef} onChange={handleBgFileChange} accept="image/*" className="hidden" />
                        {backgroundImageUrl && (
                            <div className="flex flex-col items-center gap-4 w-full">
                                <div className="w-full max-w-xs space-y-2">
                                    <label className="flex justify-between text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                                        <span>Dämpning av bakgrund</span>
                                        <span>{backgroundOverlayOpacity}%</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={backgroundOverlayOpacity} 
                                        onChange={(e) => setBackgroundOverlayOpacity(Number(e.target.value))}
                                        className="w-full accent-primary"
                                    />
                                    <p className="text-xs text-gray-500 text-center">Justerar hur mycket bilden skuggas för att öka kontrasten för meny och text.</p>
                                </div>
                                <button 
                                    onClick={async () => {
                                        const isConfirmed = await confirm({
                                            title: "Ta bort bakgrundsbild?",
                                            message: "Är du säker på att du vill ta bort bakgrundsbilden? Detta går inte att ångra.",
                                            confirmText: "Ta bort",
                                            confirmColor: "red"
                                        });
                                        if (isConfirmed) {
                                            setIsSaving(true);
                                            setBackgroundImageUrl('');
                                            await updateUserProfile(userData.uid, { backgroundImageUrl: '' });
                                            setIsSaving(false);
                                        }
                                    }}
                                    className="flex items-center justify-center px-4 py-2 border border-red-500/30 hover:border-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 text-red-500 dark:text-red-400 hover:text-red-600 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 shadow-sm"
                                >
                                    <TrashIcon className="w-4 h-4 mr-1.5" />
                                    Ta bort bakgrundsbild
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Förnamn</label>
                            <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Efternamn</label>
                            <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Födelsedatum</label>
                            <input type="tel" placeholder="ÅÅÅÅ-MM-DD" maxLength={10} value={birthDate} onChange={handleDateChange} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Kön</label>
                            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold appearance-none">
                                <option value="prefer_not_to_say">Vill ej ange</option>
                                <option value="male">Man</option>
                                <option value="female">Kvinna</option>
                                <option value="other">Annat</option>
                            </select>
                        </div>
                        {selectedOrganization?.locations && selectedOrganization.locations.length > 0 && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Din Studio / Ort</label>
                                <input 
                                    readOnly 
                                    value={selectedOrganization.locations.find(l => l.id === userData.locationId)?.name || selectedOrganization.locations[0]?.name || 'Ingen'} 
                                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-gray-500 dark:text-gray-400 outline-none shadow-sm font-bold cursor-not-allowed" 
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="flex items-start pt-6">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <div className="relative mt-0.5 flex-shrink-0">
                                    <input type="checkbox" className="sr-only" checked={showOnLeaderboard} onChange={e => setShowOnLeaderboard(e.target.checked)} />
                                    <div className={`block w-14 h-8 rounded-full transition-colors ${showOnLeaderboard ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${showOnLeaderboard ? 'transform translate-x-6' : ''}`}></div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                        Dela mina resultat i gymmet
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm leading-relaxed">
                                        Visar dig på topplistan och i gymmets gemensamma flöde när du loggar pass och slår rekord.
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {isOwnProfile && !userData.migratedStats && selectedOrganization?.allowMigrationOption && (
                        <div className="mt-8 bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <HistoryIcon className="w-32 h-32 text-indigo-300" />
                            </div>
                            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded-full mb-3">
                                        <SparklesIcon className="w-3 h-3" /> Engångsåtgärd
                                    </div>
                                    <h4 className="text-xl font-black text-white tracking-tight mb-2">Importera tidigare historik</h4>
                                    <p className="text-sm text-indigo-200/80 max-w-md leading-relaxed font-medium">
                                        Har du tränat hos oss tidigare? Lägg till din gamla historik så behåller du ditt totala antal pass och din nuvarande streak.
                                    </p>
                                </div>
                                <button 
                                    onClick={(e) => { e.preventDefault(); setShowMigrateModal(true); }}
                                    className="w-full sm:w-auto px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95 whitespace-nowrap"
                                >
                                    Importera nu
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <PushNotificationSettings />
                    
                    <div className="pt-8">
                        <button 
                            onClick={handleSaveProfile} 
                            disabled={isSaving || !firstName.trim() || !lastName.trim()}
                            className="w-full bg-primary hover:brightness-110 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-tight disabled:opacity-50"
                        >
                            {isSaving ? 'Sparar...' : 'Spara ändringar'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-0.5 sm:px-3 pt-2 pb-24 animate-fade-in relative z-0 overflow-x-hidden">
            
            {/* 1. Resume Workout Banner */}
            {activeSession && (
                <ResumeWorkoutBanner 
                    workoutTitle={activeSession.displayTitle}
                    onContinue={handleResumeWorkout}
                    onDismiss={handleDismissResume}
                />
            )}

            {/* --- FLIKAR I HEADER --- */}
            {document.getElementById('member-header-tabs') && createPortal(
                <div className="flex gap-2 sm:gap-4 transition-all" style={{ filter: userData.backgroundImageUrl ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.4))' : 'none' }}>
                    {[
                        { id: 'overview', label: 'Översikt', icon: ChartBarIcon },
                        { id: 'goals', label: 'Mål', icon: Target },
                        { id: 'strength', label: 'Styrka', icon: TrophyIcon },
                        { id: 'benchmarks', label: 'Benchmarks', icon: StarIcon }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`p-2 sm:p-2.5 rounded-full transition-all ${
                                activeTab === tab.id 
                                ? 'bg-primary/20 text-primary shadow-sm' 
                                : `text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 ${userData.backgroundImageUrl ? 'text-white/80 hover:text-white' : ''}`
                            }`}
                            title={tab.label}
                        >
                            <tab.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                        </button>
                    ))}
                </div>,
                document.getElementById('member-header-tabs')!
            )}

            {/* --- FLIKINNEHÅLL --- */}

            {isOwnProfile && !userData.migratedStats && selectedOrganization?.allowMigrationOption && (
                <div className="mb-8 bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-fade-in">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <HistoryIcon className="w-32 h-32 text-indigo-300" />
                    </div>
                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded-full mb-3">
                                <SparklesIcon className="w-3 h-3" /> Engångsåtgärd
                            </div>
                            <h4 className="text-xl font-black text-white tracking-tight mb-2">Importera tidigare historik</h4>
                            <p className="text-sm text-indigo-200/80 max-w-md leading-relaxed font-medium">
                                Har du tränat hos oss tidigare? Lägg till din gamla historik så behåller du ditt totala antal pass och din nuvarande streak.
                            </p>
                        </div>
                        <button 
                            onClick={(e) => { e.preventDefault(); setShowMigrateModal(true); }}
                            className="w-full sm:w-auto px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95 whitespace-nowrap"
                        >
                            Importera nu
                        </button>
                    </div>
                </div>
            )}

            {/* Modal för bildvisning från Sommarfeeden */}
            {selectedPhoto && (
                <Modal 
                    isOpen={!!selectedPhoto} 
                    onClose={() => setSelectedPhoto(null)} 
                    title={`Loggat av ${selectedPhoto.memberName || 'Medlem'}`}
                    size="md"
                >
                    <div className="space-y-6 text-left text-gray-900 dark:text-white">
                        <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 shadow-md">
                            <img src={selectedPhoto.imageUrl} alt="Sommarbild" className="w-full max-h-[450px] object-cover" />
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                {selectedPhoto.memberPhotoUrl ? (
                                    <img src={selectedPhoto.memberPhotoUrl} alt="Medlem" className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center font-black select-none text-sm">{selectedPhoto.memberName?.[0]?.toUpperCase() || '?'}</div>
                                )}
                                <div>
                                    <h5 className="font-bold text-sm leading-none mb-1">{selectedPhoto.memberName || 'Anonym Medlem'}</h5>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider leading-none">
                                        {new Date(selectedPhoto.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <p className="text-xs font-black text-[#fbbf24] uppercase tracking-wider mb-2 leading-none">📋 {selectedPhoto.workoutTitle || 'Träningspass'}</p>
                                {selectedPhoto.comment ? (
                                    <p className="text-sm italic">
                                        "{selectedPhoto.comment}"
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest leading-none">Inget meddelande angivet</p>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setSelectedPhoto(null)}
                                className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow hover:bg-primary hover:text-white duration-150 active:scale-95"
                            >
                                Stäng
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal för gallerivy - Se alla bilder */}
            {isShowingAllPhotos && (
                <Modal
                    isOpen={isShowingAllPhotos}
                    onClose={() => setIsShowingAllPhotos(false)}
                    title="📸 Sommarfeeden - Alla bilder"
                    size="lg"
                >
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-250 dark:scrollbar-thumb-gray-800 text-left text-gray-900 dark:text-white pb-4">
                        <p className="text-xs text-gray-500 font-bold mb-4">
                            Klicka på en bild för att läsa meddelandet och se mer detaljer.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {filteredCommunityLogs
                                .filter(log => log.imageUrl && log.imageUrl.trim() !== '')
                                .sort((a, b) => b.date - a.date)
                                .map((log) => (
                                    <button
                                        key={`all_${log.id || `${log.memberId}_${log.date}`}`}
                                        onClick={() => {
                                            setIsShowingAllPhotos(false);
                                            setSelectedPhoto(log);
                                        }}
                                        className="group flex flex-col bg-gray-50 dark:bg-slate-905/20 dark:bg-slate-900 rounded-2xl p-1.5 border border-gray-100 dark:border-white/5 transition-all hover:scale-[1.03] hover:border-primary/30 text-left"
                                    >
                                        <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2 bg-black/10">
                                            <img 
                                                src={log.imageUrl} 
                                                alt={log.workoutTitle || "Sommarbild"}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="px-1 pb-1 min-w-0">
                                            <span className="block text-[10px] font-black text-gray-800 dark:text-gray-200 truncate group-hover:text-primary transition-colors">
                                                {log.memberName || 'Medlem'}
                                            </span>
                                            <span className="block text-[8px] font-bold text-gray-400 dark:text-gray-500 truncate uppercase mt-0.5">
                                                {log.workoutTitle || 'Tränat'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>
                </Modal>
            )}

            {activeTab === 'overview' && (
                <div className="space-y-3 sm:space-y-5 animate-fade-in">
                    
                    {/* Sommar-Sisu aktivering (Card 1) */}
                    {isSummerThemeActive && !userData.joinedSummerChallenge && !dismissedSummerChallenge && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-400 to-yellow-100 dark:from-orange-600 dark:via-amber-500 dark:to-yellow-200 text-amber-950 border-none rounded-[2rem] p-6 sm:p-8 shadow-[0_12px_40px_rgba(249,115,22,0.18)] text-left animate-fade-in">
                            {/* Spinning animated sun */}
                            <div className="absolute -right-8 -top-8 w-36 h-36 text-white/25 pointer-events-none select-none">
                                <svg viewBox="0 0 100 100" className="w-full h-full animate-spin [animation-duration:45s] fill-current">
                                    <circle cx="50" cy="50" r="16" />
                                    <line x1="50" y1="10" x2="50" y2="22" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                    <line x1="50" y1="90" x2="50" y2="78" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                    <line x1="10" y1="50" x2="22" y2="50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                    <line x1="90" y1="50" x2="78" y2="50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                    <line x1="21.72" y1="21.72" x2="30.2" y2="30.2" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                    <line x1="78.28" y1="78.28" x2="69.8" y2="69.8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                    <line x1="21.72" y1="78.28" x2="30.2" y2="69.8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                    <line x1="78.28" y1="21.72" x2="69.8" y2="30.2" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                </svg>
                            </div>

                            {/* Stylized background wave pattern */}
                            <div className="absolute bottom-0 left-0 right-0 h-8 opacity-20 pointer-events-none">
                                <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full fill-white">
                                    <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,42.4V0Z" />
                                </svg>
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-start gap-4">
                                    <span className="text-4xl select-none animate-bounce origin-bottom drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]">☀️</span>
                                    <div className="flex-1 min-w-0">
                                        <span className="inline-block bg-white/40 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider text-amber-950 mb-2">
                                            Sommarutmaning 2026
                                        </span>
                                        <h4 className="text-xl sm:text-2xl font-black text-amber-950 tracking-tight leading-tight mb-2">
                                            Vill du anta utmaningen? 🌻
                                        </h4>
                                        <p className="text-xs sm:text-sm text-amber-900 font-semibold leading-relaxed mb-5 max-w-xl">
                                            Varje pass du loggar ger dig poäng och hjälper till att öka snittpoängen och temperaturen i studion. Du kan logga både pass i gymmet och utomhusaktiviteter! Tillsammans får vi temperaturnålen att stiga.
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await updateUserProfile(userData.uid, { joinedSummerChallenge: true, joinedSummerChallengeAt: Date.now() } as any);
                                                        setJustActivatedSummer(true);
                                                        const confetti = await import('canvas-confetti');
                                                        confetti.default({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
                                                    } catch (err) {
                                                        console.error("Kunde inte gå med i utmaningen:", err);
                                                    }
                                                }}
                                                className="px-6 py-3 bg-amber-950 hover:bg-amber-900 text-amber-50 text-[11px] sm:text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg hover:shadow-orange-700/25 active:scale-95 duration-100"
                                            >
                                                Jag är på! Gå med ☀️
                                            </button>
                                            <button
                                                onClick={() => {
                                                    localStorage.setItem(`dismissed-summer-challenge-${userData.uid}`, 'true');
                                                    setDismissedSummerChallenge(true);
                                                }}
                                                className="px-4 py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-amber-900/80 hover:text-amber-950 hover:bg-white/30 rounded-2xl transition-all duration-100"
                                            >
                                                Kanske senare
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Liten text/knapp om man avvisat men vill hoppa på senare */}
                    {isSummerThemeActive && !userData.joinedSummerChallenge && dismissedSummerChallenge && (
                        <div className="bg-gradient-to-r from-amber-400/20 via-orange-405/10 to-rose-400/25 border border-amber-300/30 dark:border-amber-500/10 rounded-2xl p-4 flex sm:flex-row flex-col items-center justify-between gap-3 text-left animate-fade-in shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl animate-spin [animation-duration:15s]">🌻</span>
                                <div className="min-w-0">
                                    <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5 leading-none">Sommar-Sisu 2026</p>
                                    <p className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300 font-semibold leading-tight">
                                        Psst! Har du ändrat dig? Du kan fortfarande gå med i utmaningen och bidra!
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        await updateUserProfile(userData.uid, { joinedSummerChallenge: true, joinedSummerChallengeAt: Date.now() } as any);
                                        localStorage.removeItem(`dismissed-summer-challenge-${userData.uid}`);
                                        setDismissedSummerChallenge(false);
                                        setJustActivatedSummer(true);
                                        const confetti = await import('canvas-confetti');
                                        confetti.default({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
                                    } catch (err) {
                                        console.error("Kunde inte gå med i utmaningen:", err);
                                    }
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow hover:brightness-110 active:scale-95 duration-100 whitespace-nowrap"
                            >
                                Gå med nu! ☀️
                            </button>
                        </div>
                    )}

                    {/* Weekly Goal Ring (Huge, now integrated with Summer-Sisu points if joined) */}
                    <WeeklyGoalRing 
                        current={stats.thisWeek} 
                        goal={userData.weeklyGoal || 3} 
                        hasSummerSisu={isSummerThemeActive && !!userData.joinedSummerChallenge}
                        summerWeekPoints={stats.summerWeekPoints}
                        summerTotalPoints={stats.summerTotalPoints}
                    />

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        <div className="relative overflow-hidden bg-gray-900 dark:bg-gray-800 rounded-2xl p-3 sm:p-4 shadow-lg border border-gray-800 text-center flex flex-col items-center justify-center min-h-[100px] group">
                            <div className="absolute -right-2 -top-2 text-gray-800 dark:text-gray-700 opacity-50 transform rotate-12 transition-transform group-hover:scale-110">
                                <DumbbellIcon className="w-16 h-16" />
                            </div>
                            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">Totalt</span>
                            <p className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight relative z-10">{stats.totalWorkouts}</p>
                        </div>

                        <div className="relative overflow-hidden bg-primary bg-gradient-to-br from-white/20 via-transparent to-black/30 rounded-2xl p-3 sm:p-4 shadow-lg shadow-primary/20 text-center flex flex-col items-center justify-center min-h-[100px] group">
                            <div className="absolute -right-2 -bottom-2 text-white opacity-20 transform -rotate-12 transition-transform group-hover:scale-110">
                                <ChartBarIcon className="w-16 h-16" />
                            </div>
                            <span className="block text-[10px] font-black text-white/80 uppercase tracking-widest mb-1 relative z-10">{new Date().toLocaleString('sv-SE', { month: 'long' })}</span>
                            <p className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight relative z-10">{stats.thisMonth}</p>
                        </div>

                        <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-500 dark:to-red-500 rounded-2xl p-3 sm:p-4 shadow-lg shadow-orange-500/20 text-center flex flex-col items-center justify-center min-h-[100px] group">
                            <div className="absolute -left-2 -bottom-2 text-orange-200 dark:text-white opacity-20 transform -rotate-12 transition-transform group-hover:scale-110">
                                <FireIcon className="w-16 h-16" />
                            </div>
                            <span className="block text-[10px] font-black text-orange-600 dark:text-white/80 uppercase tracking-widest mb-1 relative z-10">Streak</span>
                            <div className="flex items-center justify-center relative z-10 min-h-[36px] gap-1">
                                <p className="text-3xl sm:text-4xl font-black text-orange-500 dark:text-white leading-none tracking-tight">
                                    {stats.weeklyStreak}
                                </p>
                                <FireIcon className={`w-8 h-8 ${stats.hasTrainedThisWeek ? 'text-orange-500 dark:text-white animate-pulse' : 'text-gray-300 dark:text-gray-600 opacity-50'}`} />
                            </div>
                        </div>
                    </div>

                    {/* Goal Progress Bar Card */}
                    {userData.goals?.smartCriteria?.specific && userData.goals?.targetDate && daysLeft !== null && (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-3 text-xs font-black text-gray-500 uppercase tracking-widest">
                                <span className="flex-1 text-left truncate mr-2" title={userData.goals.smartCriteria.specific}>
                                    🎯 SMART-mål: {userData.goals.smartCriteria.specific}
                                </span>
                                <span className="text-right min-w-[50px]">Framsteg</span>
                            </div>
                            
                            {daysLeft <= 0 ? (
                                <div className="text-center p-3 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-xl border border-emerald-500/20 dark:border-emerald-500/10">
                                    <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-tight text-xs">Måldatum nått! ({userData.goals.targetDate})</h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Dags att utvärdera och sätta ett nytt mål under Mål-fliken!</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="flex-grow">
                                        <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-50 dark:border-gray-950">
                                            <div 
                                                className="h-full bg-primary rounded-full transition-all duration-1000 relative shadow-[0_0_10px_rgba(20,184,166,0.5)]" 
                                                style={{ width: `${Math.max(1.5, progressPercentage)}%` }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right min-w-[70px]">
                                        <span className="block text-lg font-black text-gray-900 dark:text-white leading-none">{daysLeft}</span>
                                        <span className="text-[9px] uppercase font-bold text-gray-400">Dagar kvar</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Level Meter */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Nivå {level}</span>
                            <span className="text-xs font-bold text-gray-400">
                                {workoutsInCurrentLevel} av {workoutsPerLevel} pass till nivå {level + 1}
                            </span>
                        </div>
                        <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progressToNext}%` }}></div>
                        </div>
                    </div>

                    {/* Archetype card */}
                    <div className={`bg-gradient-to-br ${archetype.color} rounded-2xl p-3 sm:p-4 text-white shadow-lg relative overflow-hidden`}>
                        <div className="relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-black uppercase tracking-widest text-white/70">Din Träningsprofil</p>
                                    <button 
                                        onClick={() => setShowArchetypeInfo(true)}
                                        className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                                        aria-label="Information om träningsprofiler"
                                    >
                                        <span className="text-xs font-bold text-white">i</span>
                                    </button>
                                </div>
                                <h3 className="text-3xl font-black flex items-center gap-3">
                                    {archetype.title}
                                    <span className="bg-white/20 p-1.5 rounded-lg">{archetype.icon}</span>
                                </h3>
                            </div>
                            <p className="text-lg font-medium text-white/90 leading-relaxed max-w-lg mt-4">{archetype.desc}</p>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/20 rounded-full blur-[60px] pointer-events-none"></div>
                    </div>

                    {/* Sommar-Sisu status & rules (collapsible) (Card 2) */}
                    {isSummerThemeActive && !!userData.joinedSummerChallenge && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-400 to-yellow-100 dark:from-orange-600 dark:via-amber-500 dark:to-yellow-200 text-amber-950 border-none rounded-[2rem] shadow-[0_12px_40px_rgba(249,115,22,0.18)] animate-fade-in text-left">
                            
                            {/* Summer sun rays backdrop glow */}
                            <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-white/10 rounded-full blur-[50px] pointer-events-none"></div>

                            {/* Header click-to-toggle button */}
                            <button
                                onClick={() => {
                                    setSisuDetailsExpanded(!sisuDetailsExpanded);
                                    setJustActivatedSummer(false);
                                }}
                                className="w-full px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between text-left focus:outline-none bg-black/5 hover:bg-black/10 transition-all duration-150"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl select-none animate-bounce origin-bottom [animation-duration:3s]">🌻</span>
                                    <div>
                                        <span className="text-[9px] font-black tracking-widest text-orange-950/75 uppercase block leading-none mb-1">Du deltar i utmaningen! ☀️</span>
                                        <span className="text-xs sm:text-sm font-extrabold text-amber-950 leading-none">
                                            {!isChallengeStarted ? (
                                                <span>Utmaningen startar snart! ⏳</span>
                                            ) : (
                                                <span>Studions mätare: <span className="inline-flex items-center gap-1 bg-amber-950/20 px-2 py-0.5 rounded-lg text-xs font-black text-amber-950 tracking-wider ml-1">{summerStats.label} {summerStats.emoji}</span></span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-amber-950/10 rounded-xl p-1.5 border border-amber-950/5">
                                    <span className={`text-amber-950 transition-transform duration-200 ${(sisuDetailsExpanded || justActivatedSummer) ? 'rotate-180' : ''}`}>
                                        <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                        </svg>
                                    </span>
                                </div>
                            </button>

                            <AnimatePresence initial={false}>
                                {(sisuDetailsExpanded || justActivatedSummer) && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border-t border-amber-950/10 bg-amber-50/15 backdrop-blur-md"
                                    >
                                        <div className="p-5 sm:p-6 space-y-6 text-amber-950">
                                            
                                            {!isChallengeStarted ? (
                                                /* Pre-start Countdown Stats Block */
                                                <div className="bg-amber-50/70 dark:bg-amber-950/20 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-amber-200/35 relative overflow-hidden shadow-sm">
                                                    <div className="flex justify-between items-start select-none">
                                                        <div>
                                                            <p className="text-[9px] font-bold text-amber-900 uppercase tracking-widest mb-1.5 font-black font-sans">Nedräkning ⏳</p>
                                                            <h3 className="text-2xl sm:text-3xl font-black text-amber-950 tracking-tight mb-1">
                                                                Utmaningen startar snart!
                                                            </h3>
                                                            <p className="text-[11px] text-amber-900/90 font-semibold leading-normal max-w-sm mt-1">
                                                                {configToUse?.summerChallengeStartDate ? (
                                                                    <>Startdatum: <span className="font-extrabold">{new Date(configToUse.summerChallengeStartDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</span></>
                                                                ) : 'Startdatum ej satt.'}
                                                            </p>
                                                        </div>
                                                        
                                                        <div className="relative w-12 h-12 bg-white/50 rounded-xl flex items-center justify-center text-2xl border border-white/60 shadow-inner">
                                                            <span className="animate-pulse">📅</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="h-[1px] bg-amber-950/10 my-3.5" />
                                                    
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[9px] font-black text-amber-900/60 uppercase tracking-wider mb-0.5">Dagar kvar</p>
                                                            <p className="text-base font-extrabold text-amber-950">
                                                                {configToUse?.summerChallengeStartDate ? Math.max(0, Math.ceil((configToUse.summerChallengeStartDate - Date.now()) / (1000 * 60 * 60 * 24))) : '-'} st
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-amber-900/60 uppercase tracking-wider mb-0.5">Anmälda i gymmet</p>
                                                            <p className="text-base font-extrabold text-amber-950">
                                                                {summerStats.totalRegisteredCount} st
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Main Stats Block: matching Bild 1 & Proposal 2 */
                                                <div className="bg-amber-50/70 dark:bg-amber-950/20 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-amber-200/35 relative overflow-hidden shadow-sm">
                                                    <div className="flex justify-between items-start select-none">
                                                        <div>
                                                            <p className="text-[9px] font-bold text-amber-900 uppercase tracking-widest mb-1.5 font-black font-sans">Gymmet tillsammans ☀️</p>
                                                            <h3 className="text-3xl sm:text-4xl font-black text-amber-950 tracking-tight mb-1 flex items-center gap-2">
                                                                <span>{summerStats.label}</span>
                                                                <span className="text-2xl sm:text-3xl">{summerStats.emoji}</span>
                                                            </h3>
                                                            <p className="text-[11px] text-amber-900/90 font-semibold leading-normal max-w-sm">
                                                                Veckans status. Ju fler poäng vi loggar, desto mer stiger mätaren!
                                                            </p>
                                                        </div>
                                                        
                                                        <div className="relative w-12 h-12 bg-white/50 rounded-xl flex items-center justify-center text-2xl border border-white/60 shadow-inner">
                                                            <span className="animate-pulse">🔥</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="h-[1px] bg-amber-950/10 my-3.5" />
                                                    
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[9px] font-black text-amber-900/60 uppercase tracking-wider mb-0.5">Totala poäng denna vecka</p>
                                                            <p className="text-base font-extrabold text-amber-950">{summerStats.totalPoints} poäng</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-amber-900/60 uppercase tracking-wider mb-0.5">Nivåns mål</p>
                                                            <p className="text-base font-extrabold text-amber-950">
                                                                {summerStats.nextTarget > 0 ? `${summerStats.nextTarget} poäng` : "Fullt ös! 🔥"}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 text-[10px] text-amber-950/60 flex flex-col gap-1 border-t border-amber-950/5 pt-2">
                                                        <span>• Basantal registrerade i söndags: <strong className="text-amber-950">{summerStats.N} st</strong></span>
                                                        <span>• Aktiva deltagare denna vecka: <strong className="text-amber-950">{summerStats.activeUsersCount} st</strong></span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Point rules info */}
                                            <div className="space-y-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <h5 className="text-[9px] font-black uppercase tracking-wider text-amber-900">Så här samlar ni poäng</h5>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowFormulaInfo(true)}
                                                        className="w-4 h-4 rounded-full bg-amber-500/15 hover:bg-amber-500/35 text-amber-950 border border-amber-500/25 flex items-center justify-center text-[10px] font-black transition-all cursor-pointer shadow-sm relative -top-0.5"
                                                        title="Visa information om mätarens smarta formel"
                                                    >
                                                        i
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2.5">
                                                    <div className="bg-amber-50/60 dark:bg-amber-950/15 rounded-2xl p-4 border border-amber-200/20 flex items-start gap-3">
                                                        <span className="text-base bg-amber-800 text-white p-2 rounded-xl leading-none shadow-sm">🏋️‍♀️</span>
                                                        <div className="text-left">
                                                            <p className="text-xs font-black text-amber-950 uppercase tracking-wider">2 Poäng</p>
                                                            <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed font-semibold">
                                                                Träning i studion! Det gäller alla pass som genomförs på plats i studion.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-amber-50/60 dark:bg-amber-950/15 rounded-2xl p-4 border border-amber-200/20 flex items-start gap-3">
                                                        <span className="text-base bg-[#43a047] text-white p-2 rounded-xl leading-none shadow-sm">🏃‍♂️</span>
                                                        <div className="text-left">
                                                            <p className="text-xs font-black text-amber-950 uppercase tracking-wider">1 Poäng</p>
                                                            <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed font-semibold">
                                                                Träning utanför studion! Alla hemma- eller utomhusaktiviteter (powerwalk, löpning, cykling etc.) på minst 30 minuter.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {showFormulaInfo && (
                                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in" onClick={() => setShowFormulaInfo(false)}>
                                                    <div className="bg-amber-50 dark:bg-gray-900 p-6 rounded-[2.5rem] border-2 border-amber-300 dark:border-amber-900/40 shadow-2xl max-w-sm w-full text-left" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <span className="text-2xl bg-amber-400 text-amber-950 p-2 rounded-2xl shadow-sm leading-none">🌟</span>
                                                            <h4 className="text-sm font-black text-amber-950 dark:text-amber-50 uppercase tracking-wider">Mätarens nivåinsamling</h4>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <p className="text-xs font-black text-amber-900 dark:text-amber-300">
                                                                Smart formel: Ljummet (3p), Varmt (6p), Het (10p) per aktiv person.
                                                            </p>
                                                            <p className="text-xs text-amber-950/80 dark:text-amber-200/70 leading-relaxed font-semibold">
                                                                Mätarens kravnivåer baseras på antalet anmälda söndagen innan veckan startar.
                                                            </p>
                                                            <p className="text-xs text-amber-950/80 dark:text-amber-200/70 leading-relaxed font-semibold">
                                                                Nya medlemmar som går med under pågående vecka kan direkt bidra med poäng, men höjer inte mätarens svårighetsgrad förrän nästkommande vecka! Det gör att ingen belastar snittet i onödan.
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowFormulaInfo(false)}
                                                            className="mt-6 w-full bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black uppercase text-xs tracking-wider py-3 px-4 rounded-2xl shadow-md transition-all cursor-pointer"
                                                        >
                                                            Stäng fönster
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Photo feed inline */}
                                            {filteredCommunityLogs.filter(log => log.imageUrl && log.imageUrl.trim() !== '').length > 0 && (
                                                <div className="space-y-3 pt-4 border-t border-white/5">
                                                    <div className="flex justify-between items-center">
                                                        <h5 className="text-[9px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                                            <span>📸</span> Sommarfeeden i gymmet
                                                        </h5>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setIsShowingAllPhotos(true)}
                                                            className="text-[9px] font-black uppercase tracking-wider text-primary hover:underline px-2 py-1 bg-white/5 rounded-lg border border-white/5 transition-colors hover:bg-white/10"
                                                        >
                                                            Se alla ({filteredCommunityLogs.filter(log => log.imageUrl && log.imageUrl.trim() !== '').length})
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                                                        {filteredCommunityLogs
                                                            .filter(log => log.imageUrl && log.imageUrl.trim() !== '')
                                                            .sort((a, b) => b.date - a.date)
                                                            .map((log) => (
                                                                <button
                                                                    key={log.id || `${log.memberId}_${log.date}`}
                                                                    onClick={() => setSelectedPhoto(log)}
                                                                    className="flex-shrink-0 w-28 text-left bg-white/5 rounded-2xl p-1 shadow-md border border-white/5 transition-transform hover:scale-[1.02]"
                                                                >
                                                                    <div className="relative w-full h-24 rounded-xl overflow-hidden mb-1">
                                                                        <img 
                                                                            src={log.imageUrl} 
                                                                            alt={log.workoutTitle || "Sommarbild"}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                    <span className="block text-[9px] font-black text-gray-300 truncate px-1">
                                                                        {log.memberName || 'Medlem'}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <ActivityCalendar 
                        logs={logs} 
                        onDayClick={(date, dayLogs) => {
                            if (dayLogs.length > 0) {
                                setSelectedDateLogs({ date, logs: dayLogs });
                            }
                        }} 
                    />

                    {/* --- MINA HYROX & EVENT-RESULTAT --- */}
                    {personalHyroxResults.length > 0 && (
                        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-amber-50/30 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 border border-indigo-100 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg relative overflow-hidden animate-fade-in text-gray-900 dark:text-white mt-3.5">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.06] dark:opacity-[0.03] pointer-events-none">
                                <TrophyIcon className="w-48 h-48 text-indigo-500 dark:text-yellow-500" />
                            </div>
                            
                            <div className="relative z-10">
                                <button
                                    onClick={() => setHyroxSectionCollapsed(!hyroxSectionCollapsed)}
                                    className="w-full flex items-center justify-between text-left focus:outline-none select-none"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[9px] uppercase tracking-wider">Mina Resultat</span>
                                        <h3 className="text-lg font-black uppercase tracking-tight text-gray-950 dark:text-white">HYROX & Eventlopp</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {hyroxSectionCollapsed && (
                                            <span className="hidden sm:inline-block text-xs bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full font-bold">
                                                {personalHyroxResults.length} {personalHyroxResults.length === 1 ? 'lopp' : 'lopp'}
                                            </span>
                                        )}
                                        <span className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${!hyroxSectionCollapsed ? 'rotate-90' : ''}`}>
                                            <ChevronRightIcon className="w-5 h-5 stroke-[2.5]" />
                                        </span>
                                    </div>
                                </button>
                                
                                <AnimatePresence initial={false}>
                                    {!hyroxSectionCollapsed && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="flex items-center justify-between mb-4 mt-4">
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-450 font-bold">Kopplad via e-post</span>
                                            </div>
                                            
                                            <p className="text-xs text-slate-550 dark:text-slate-300 mb-5 leading-relaxed">
                                                Här presenteras dina officiella tider och placeringar från alla genomförda utmaningar och event du deltagit i hos oss.
                                            </p>
                                            
                                            <div className="space-y-3">
                                                {personalHyroxResults.map(res => (
                                                    <div 
                                                        key={res.id}
                                                        className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-slate-150 dark:border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-white dark:hover:bg-white/10 shadow-sm dark:shadow-none transition-all duration-150"
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xs text-indigo-600 dark:text-amber-400">Plats #{res.placement}</span>
                                                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-150">{res.raceName}</h4>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/30">
                                                                    {res.division}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                                    {new Date(res.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-white/5">
                                                            <span className="text-xs text-slate-400 dark:text-slate-500 block sm:hidden">Din Sluttid</span>
                                                            <span className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                                                {Math.floor(res.time / 60)}:{String(res.time % 60).padStart(2, '0')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {userData.organizationId && (
                        <Leaderboard organizationId={userData.organizationId} />
                    )}
                </div>
            )}

            {activeTab === 'goals' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="text-xl">🎯</span> Mina Mål
                            </h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsCreatingNewGoal(true)} 
                                    className="px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
                                >
                                    Nytt mål
                                </button>
                                <button 
                                    onClick={() => setIsEditingGoals(true)} 
                                    className="p-2 text-gray-400 hover:text-primary transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
                                    title="Redigera mål"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            {!userData.goals?.hasSpecificGoals ? (
                                <div className="text-center py-6 px-4 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 space-y-4">
                                    <p className="text-gray-500 text-sm font-medium italic">Du har inte valt några konkreta mål för din träning ännu.</p>
                                    <div className="bg-gradient-to-r from-primary/10 to-indigo-500/10 p-5 rounded-2xl border border-primary/20 text-left space-y-3 max-w-md mx-auto">
                                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5 leading-none">
                                            🚀 Maximera dina resultat med SMART-metoden!
                                        </h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-semibold">
                                            Genom att sätta ett <strong>SMART-mål</strong> (Specifikt, Mätbart, Accepterat, Relevant och Tidsbestämt) sätter du en tydlig kompass för din hälsoresa. Då får du dessutom en interaktiv progressbar på din översikt och personligt stöttande analyser från din AI-coach här i appen!
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setIsCreatingNewGoal(true)} 
                                        className="px-6 py-3 bg-primary text-white font-black rounded-xl hover:brightness-110 transition-all text-xs uppercase tracking-wider shadow-lg shadow-primary/15"
                                    >
                                        Skapa mitt första mål nu
                                    </button>
                                </div>
                            ) : !userData.goals?.smartCriteria?.specific ? (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap gap-2">
                                        {userData.goals.selectedGoals?.map(g => (
                                            <span key={g} className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide border border-gray-200 dark:border-gray-700">{g}</span>
                                        ))}
                                    </div>

                                    <div className="bg-gradient-to-r from-primary/10 to-indigo-500/10 p-5 rounded-2xl border border-primary/20 text-left space-y-3">
                                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5 leading-none">
                                            🎯 Gör dina val till ett SMART mål!
                                        </h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-semibold">
                                            Du har valt dina kategorier! Gör dem ännu mer kraftfulla genom att formulera ett specifikt och tidsbestämt <strong>SMART-mål</strong>. När du gör det kan vi rita upp en interaktiv progressbar på din översikt, och din AI-coach kommer att ge dig anpassade framstegstips löpande!
                                        </p>
                                        <button 
                                            onClick={() => setIsEditingGoals(true)} 
                                            className="px-4 py-2.5 bg-primary text-white font-black rounded-xl hover:brightness-110 transition-all text-xs uppercase tracking-wider"
                                        >
                                            Formulera ett SMART-mål nu ⭐️
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap gap-2">
                                        {userData.goals.selectedGoals?.map(g => (
                                            <span key={g} className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide border border-gray-200 dark:border-gray-700">{g}</span>
                                        ))}
                                    </div>

                                    <div className="pt-2 border-t border-gray-50 dark:border-gray-800">
                                        <div className="mb-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Målanalys (SMART)</p>
                                        </div>
                                        
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <SmartItem letter="S" color="bg-blue-500" title="Specifikt" text={userData.goals.smartCriteria.specific} />
                                                <SmartItem letter="M" color="bg-emerald-500" title="Mätbart" text={userData.goals.smartCriteria.measurable || '-'} />
                                                <SmartItem letter="A" color="bg-orange-500" title="Accepterat" text={userData.goals.smartCriteria.achievable || '-'} />
                                                <SmartItem letter="R" color="bg-rose-500" title="Relevant" text={userData.goals.smartCriteria.relevant || '-'} />
                                                <SmartItem letter="T" color="bg-indigo-500" title="Tid" text={userData.goals.targetDate || 'Ingen deadline.'} />
                                            </div>

                                            {daysLeft !== null && (
                                                daysLeft <= 0 ? (
                                                    <div className="space-y-4 pt-1">
                                                        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5 p-5 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/10 text-center space-y-3">
                                                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto text-2xl">
                                                                🏁
                                                            </div>
                                                            <div className="space-y-1">
                                                                <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-tight text-sm">Måldatum nått!</h4>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">Deadlinet för ditt uppsatta mål ({userData.goals.targetDate}) har nåtts.</p>
                                                            </div>
                                                            <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 text-left">
                                                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                    <span>💡</span> Feedback från coachen
                                                                </p>
                                                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-semibold">
                                                                    Snyggt jobbat att du kämpat på mot ditt mål! Nu när måldatumet är nått är det ett perfekt tillfälle att stanna upp, utvärdera och fira dina framsteg tillsammans med din personliga PT i fickformat. Fråga PT-coachen i chatten vad nästa steg bör bli för att hålla kontinuiteten uppe!
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => setIsCreatingNewGoal(true)}
                                                                    className="flex-grow px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/10 uppercase tracking-wider"
                                                                >
                                                                    Sätt ett nytt spännande mål!
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
                                                        <div className="flex-grow">
                                                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>Framsteg</span><span>{userData.goals.targetDate}</span></div>
                                                            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden p-0.5 border border-gray-100 dark:border-gray-800">
                                                                <div 
                                                                    className="h-full bg-primary rounded-full transition-all duration-1000 relative shadow-[0_0_10px_rgba(20,184,166,0.5)]" 
                                                                    style={{ width: `${Math.max(1.5, progressPercentage)}%` }}
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-center min-w-[60px]"><span className="block text-xl font-black text-gray-900 dark:text-white leading-none">{daysLeft}</span><span className="text-[9px] uppercase font-bold text-gray-400">Dagar kvar</span></div>
                                                    </div>
                                                )
                                            )}

                                            {/* AI-Coach Insight Card (Steg 3) */}
                                            {daysLeft !== null && daysLeft > 0 && (() => {
                                                const adviceData = getGoalCoachingAdvice(userData.goals!, logs);
                                                const bgCol = adviceData.color === 'emerald' 
                                                    ? 'from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5 border-emerald-500/20 dark:border-emerald-500/10'
                                                    : adviceData.color === 'orange'
                                                    ? 'from-orange-500/10 to-amber-500/10 dark:from-orange-500/5 dark:to-amber-500/5 border-orange-500/20 dark:border-orange-500/10'
                                                    : 'from-blue-500/10 to-indigo-500/10 dark:from-blue-500/5 dark:to-indigo-500/5 border-blue-500/20 dark:border-blue-500/10';

                                                const iconCol = adviceData.color === 'emerald' ? 'text-emerald-500 dark:text-emerald-400'
                                                    : adviceData.color === 'orange' ? 'text-orange-500 dark:text-orange-400'
                                                    : 'text-blue-500 dark:text-blue-400';

                                                return (
                                                    <div className={`bg-gradient-to-r ${bgCol} p-5 rounded-3xl border text-left space-y-3 relative overflow-hidden backdrop-blur-sm shadow-sm animate-fade-in`}>
                                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                                            <SparklesIcon className="w-20 h-20 text-primary" />
                                                        </div>
                                                        <div className="flex items-center gap-2 relative z-10">
                                                            <SparklesIcon className={`w-5 h-5 ${iconCol}`} />
                                                            <h4 className="font-extrabold text-xs text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                                                                AI-Coachens analys & rekommendation
                                                            </h4>
                                                        </div>
                                                        <div className="space-y-2 relative z-10">
                                                            <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                                                                {adviceData.status}
                                                              </p>
                                                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-semibold">
                                                                {adviceData.advice}
                                                            </p>
                                                        </div>
                                                        <div className="pt-1 flex justify-end relative z-10">
                                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black flex items-center gap-1">
                                                                Öppna coach-chatten nere till höger för din fullständiga plan ↗
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="text-xl">📅</span> Veckomål
                            </h3>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Hur många pass siktar du på att träna varje vecka?
                            </p>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="14" 
                                    value={weeklyGoal} 
                                    onChange={e => setWeeklyGoal(Number(e.target.value))} 
                                    className="w-24 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-center text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold text-lg" 
                                />
                                <button 
                                    onClick={async () => {
                                        try {
                                            await updateUserProfile(userData.uid, { weeklyGoal: Number(weeklyGoal) });
                                            setShowGoalSaved(true);
                                            setTimeout(() => setShowGoalSaved(false), 3000);
                                        } catch (e) {
                                            console.error(e);
                                            alert("Kunde inte spara veckomål.");
                                        }
                                    }}
                                    className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 transition-colors shadow-sm"
                                >
                                    {showGoalSaved ? 'Sparat!' : 'Spara'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'strength' && (
                <div className="animate-fade-in">
                    <MyStrengthScreen 
                        userData={userData} 
                        logs={logs} 
                        onClose={() => setActiveTab('overview')} 
                    />
                </div>
            )}

            {activeTab === 'benchmarks' && (
                selectedOrganization && (
                    <BenchmarksView 
                        logs={logs} 
                        definitions={selectedOrganization.benchmarkDefinitions || []} 
                        onViewLog={setSelectedLog}
                    />
                )
            )}

            {(isEditingGoals || isCreatingNewGoal) && (
                <GoalsEditModal 
                    currentGoals={isCreatingNewGoal ? undefined : userData.goals} 
                    onSave={(goals) => {
                        handleSaveGoals(goals);
                        setIsCreatingNewGoal(false);
                    }} 
                    onClose={() => {
                        setIsEditingGoals(false);
                        setIsCreatingNewGoal(false);
                    }} 
                />
            )}
            {selectedDateLogs && (
                <Modal isOpen={true} onClose={() => setSelectedDateLogs(null)} title={`Pass den ${selectedDateLogs.date.toLocaleDateString('sv-SE')}`}>
                    <div className="space-y-4">
                        {selectedDateLogs.logs.map(log => (
                            <button
                                key={log.id}
                                onClick={() => {
                                    setSelectedDateLogs(null);
                                    setSelectedLog(log);
                                }}
                                className="w-full text-left bg-gray-50 dark:bg-gray-800 p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
                            >
                                <div className="flex-1 w-full relative">
                                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">{log.workoutTitle || 'Pass'}</h4>
                                    
                                    {log.exerciseResults && log.exerciseResults.length > 0 && (
                                        <div className="space-y-1 mb-6 text-sm text-gray-600 dark:text-gray-400 pr-8">
                                            {log.exerciseResults.slice(0, 4).map((ex, i) => (
                                                <div key={i} className="truncate">
                                                    {ex.sets > 0 ? `${ex.sets}x ` : ''}{ex.exerciseName}
                                                </div>
                                            ))}
                                            {log.exerciseResults.length > 4 && (
                                                <div className="text-xs text-gray-400 italic mt-1">och {log.exerciseResults.length - 4} till...</div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                        <span>{new Date(log.date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                                        {log.durationMinutes ? (
                                            <span className="font-medium">{log.durationMinutes} min</span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="ml-4 w-8 h-8 flex-shrink-0 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors shadow-sm self-start mt-1">
                                    <ChevronRightIcon className="w-4 h-4" />
                                </div>
                            </button>
                        ))}
                    </div>
                </Modal>
            )}
            {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} onUpdate={handleUpdateLog} onDelete={handleDeleteLog} onViewDiploma={setViewingDiploma} />}
            
            {showArchetypeInfo && (
                <Modal isOpen={true} onClose={() => setShowArchetypeInfo(false)} title="Träningsprofiler">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Din träningsprofil baseras på vilken typ av pass du loggar mest. Här är de olika profilerna du kan uppnå:
                        </p>
                        
                        <div className="space-y-3">
                            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-xl text-white">
                                <h4 className="font-black flex items-center gap-2 mb-1">
                                    Nykomling <SparklesIcon className="w-4 h-4" />
                                </h4>
                                <p className="text-sm text-white/90">Du är i början av din resa. Fortsätt såhär!</p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-red-500 to-pink-600 p-4 rounded-xl text-white">
                                <h4 className="font-black flex items-center gap-2 mb-1">
                                    Lyftaren <DumbbellIcon className="w-4 h-4" />
                                </h4>
                                <p className="text-sm text-white/90">Tunga lyft är din grej. Starkt jobbat!</p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-orange-400 to-red-500 p-4 rounded-xl text-white">
                                <h4 className="font-black flex items-center gap-2 mb-1">
                                    Maskinen <FireIcon className="w-4 h-4" />
                                </h4>
                                <p className="text-sm text-white/90">Uthållighet av stål. Du slutar aldrig!</p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-4 rounded-xl text-white">
                                <h4 className="font-black flex items-center gap-2 mb-1">
                                    HYROX-Krigare <LightningIcon className="w-4 h-4" />
                                </h4>
                                <p className="text-sm text-white/90">Du älskar funktionell fitness och tävlingsmomentet!</p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-xl text-white">
                                <h4 className="font-black flex items-center gap-2 mb-1">
                                    Hybridatlet <UserIcon className="w-4 h-4" />
                                </h4>
                                <p className="text-sm text-white/90">Du behärskar både styrka och kondition. Den kompletta atleten.</p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setShowArchetypeInfo(false)}
                            className="w-full py-3 mt-6 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            Stäng
                        </button>
                    </div>
                </Modal>
            )}

            <AnimatePresence>
                {viewingDiploma && (
                    <WorkoutDiplomaView 
                        diploma={viewingDiploma} 
                        onClose={() => setViewingDiploma(null)} 
                    />
                )}
            </AnimatePresence>

            <MigrateStatsModal 
                isOpen={showMigrateModal}
                onClose={() => setShowMigrateModal(false)}
                userData={userData}
            />
        </div>
    );
};

export default MemberProfileScreen;