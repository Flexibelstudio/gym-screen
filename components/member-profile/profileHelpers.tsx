import { WorkoutLog, MemberGoals } from '../../types';
import { getYearWeek } from '../../utils/workoutUtils';
import React from 'react';
import { DumbbellIcon, FireIcon, UserIcon, SparklesIcon } from '../icons';

export const getSisuAchievementTitle = (points: number) => {
    if (points >= 20) return { title: "Superhjälte 🌟", desc: "Nivå Sisu-Elit", color: "text-yellow-300" };
    if (points >= 10) return { title: "Sisu-Kämpe 💪", desc: "Stark hängivenhet", color: "text-amber-200" };
    if (points > 0) return { title: "Deltagare 🎯", desc: "Aktiv lagspelare", color: "text-orange-200" };
    return { title: "Hejaklack 📣", desc: "Tillsammans är vi starkast", color: "text-amber-100" };
};

export const calculateWeeklyStreak = (logs: WorkoutLog[], migratedStats?: { totalWorkouts: number; streakWeeks: number; migratedAtDate: string; }) => {
    const activeWeeks = new Set<string>();
    
    logs.forEach(log => {
        if (log.date) {
            activeWeeks.add(getYearWeek(new Date(log.date)));
        }
    });

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
    const hasTrainedCurrentWeek = activeWeeks.has(currentWeekKey);

    let checkDate = new Date(now.getTime());
    checkDate.setHours(0, 0, 0, 0);

    if (hasTrainedCurrentWeek) {
        streak = 1;
        checkDate.setDate(checkDate.getDate() - 7);
    } else {
        // Current week is ongoing with no workout yet; check previous week
        checkDate.setDate(checkDate.getDate() - 7);
        const prevWeekKey = getYearWeek(checkDate);
        if (!activeWeeks.has(prevWeekKey)) {
            return 0; // Both current and previous week have no workout
        }
    }

    // Count consecutive preceding active weeks
    while (true) {
        const weekKey = getYearWeek(checkDate);
        if (activeWeeks.has(weekKey)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 7);
        } else {
            break;
        }
    }

    return streak;
};

export const getGoalCoachingAdvice = (goals: MemberGoals, logs: WorkoutLog[]): { status: string, advice: string, color: string } => {
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
                advice: `Du har inte loggat så många pass nyligen än. För en balanserad utveckling, kom igång denna vecka med ett kort, peppande styrkepass och ett skönt konditionspass.`,
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
                advice: "För att starta din resa mot ökad styrka, boka in veckans första styrkepass redan idag. Fokusera på basövningar med bra teknik och rörlighet.",
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
        status: "Du är på väg mot dina mål 🌟",
        advice: `Grymt jobbat med dina uppsatta mål. Försök att planera in 2-3 pass i veckan som stöder dina delmål. Här ser du löpande hur din träning ligger till mot dem.`,
        color: "blue"
    };
};

const MILESTONES: { count: number; name: string }[] = [
    { count: 10, name: 'Igång' },
    { count: 25, name: 'Vanan sitter' },
    { count: 50, name: 'Stammis' },
    { count: 100, name: 'Hundraklubben' },
    { count: 250, name: 'Veteran' },
    { count: 500, name: 'Legendarisk' },
    { count: 1000, name: 'Tusenklubben' },
];

export const getMilestoneInfo = (count: number) => {
    const reached = MILESTONES.filter(m => count >= m.count).pop() || null;
    const next = MILESTONES.find(m => count < m.count) || null;
    const from = reached ? reached.count : 0;
    const span = next ? next.count - from : 0;
    const progress = next && span > 0
        ? Math.min(100, Math.max(0, ((count - from) / span) * 100))
        : 100;

    return {
        reachedName: reached ? reached.name : null,
        nextName: next ? next.name : null,
        workoutsToNext: next ? next.count - count : 0,
        progress
    };
};

export const getAthleteArchetype = (
    strengthScore: number | null,
    conditioningScore: number | null,
    logCount: number
) => {
    if (strengthScore !== null && conditioningScore !== null) {
        const detail = `Styrka ${strengthScore} · Kondition ${conditioningScore}`;
        const diff = strengthScore - conditioningScore;

        if (diff > 10) {
            return { title: "Lyftaren", icon: <DumbbellIcon className="w-5 h-5" />, color: "from-red-500 to-pink-600", desc: `Tunga lyft är din grej. ${detail}.` };
        }
        if (diff < -10) {
            return { title: "Maskinen", icon: <FireIcon className="w-5 h-5" />, color: "from-orange-400 to-red-500", desc: `Uthållighet av stål. ${detail}.` };
        }
        return { title: "Hybridatlet", icon: <UserIcon className="w-5 h-5" />, color: "from-indigo-500 to-purple-600", desc: `Du håller ihop styrka och kondition. ${detail}.` };
    }

    if (logCount < 3) {
        return { title: "Nykomling", icon: <SparklesIcon className="w-5 h-5" />, color: "from-blue-500 to-cyan-500", desc: "Du är i början av din resa. Logga några pass så visar vi din profil." };
    }

    const missing: string[] = [];
    if (strengthScore === null) missing.push('knäböj, bänkpress och marklyft');
    if (conditioningScore === null) missing.push('ett 2000 m roddtest');

    return {
        title: "På gång",
        icon: <SparklesIcon className="w-5 h-5" />,
        color: "from-slate-500 to-slate-700",
        desc: `Logga ${missing.join(' och ')} så kan vi visa din träningsprofil.`
    };
};

export function parseRowingInputTime(input: string): number | null {
    if (!input) return null;
    const clean = input.trim().replace(',', '.');
    const match = clean.match(/^(\d{1,2}):([0-5]?\d(?:\.\d)?)$/);
    if (!match) return null;
    const min = parseInt(match[1], 10);
    const sec = parseFloat(match[2]);
    if (isNaN(min) || isNaN(sec)) return null;
    const totalSeconds = min * 60 + sec;
    if (totalSeconds < 60 || totalSeconds > 3600) return null;
    return totalSeconds;
}
