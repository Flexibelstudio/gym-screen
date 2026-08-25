import React, { useState, useEffect } from 'react';
import { LastPerformanceRecord } from './types';

export const ACTIVE_LOG_STORAGE_KEY = 'smart-skarm-active-log';

/**
 * En påbörjad loggning håller sex timmar. Längre än så är det inte längre samma
 * träningspass, och ett halvfärdigt pass från i tisdags ska inte erbjuda
 * "fortsätt" på lördagen.
 */
export const ACTIVE_LOG_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Har den sparade sessionen något medlemmen faktiskt fyllt i? */
export const activeLogHasContent = (session: any): boolean => {
    if (!session) return false;
    const results = session.exerciseResults;
    if (Array.isArray(results) && results.length > 0) return true;
    if (session.customActivity && (session.customActivity.name || session.customActivity.duration)) return true;
    return false;
};

/** Sparad session som är för gammal räknas som obefintlig. */
export const isActiveLogFresh = (session: any, now: number = Date.now()): boolean => {
    if (!session) return false;
    const ts = typeof session.timestamp === 'number' ? session.timestamp : 0;
    if (!ts) return false;
    const age = now - ts;
    // Negativ ålder betyder att enhetens klocka går fel — då litar vi på sessionen
    // hellre än att kasta medlemmens arbete.
    return age < ACTIVE_LOG_MAX_AGE_MS;
};
export const DEFAULT_REST_SECONDS = 90;

/**
 * Svenska tangentbord ger komma som decimaltecken. Med type="number" kastar
 * webbläsaren hela värdet vid komma, och parseFloat("114,5") ger 114 — båda tyst.
 * Fälten är därför type="text" med inputMode="decimal", och det som skrivs
 * normaliseras här: komma blir punkt, allt utom siffror och punkt faller bort, och
 * bara ett decimaltecken behålls. Downstream ser alltid punktform, så alla
 * parseFloat-anrop fungerar oförändrat.
 */
export const normalizeDecimalInput = (raw: string): string => {
    const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join('')}`;
};

export const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
);

export function formatTimeValue(val: string | number): string {
    if (!val && val !== 0) return '';
    const sVal = String(val).trim();
    if (!sVal) return '';
    if (sVal.includes(':')) return sVal;
    const num = parseFloat(sVal);
    if (isNaN(num) || num <= 0) return '';
    
    let totalSec = num;
    if (num < 100) {
        totalSec = Math.round(num * 60);
    }
    const m = Math.floor(totalSec / 60);
    const s = Math.round(totalSec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatLastPerformance(perf: LastPerformanceRecord | null | undefined): string | null {
    if (!perf) return null;

    const parts: string[] = [];

    const weightNum = perf.weight != null ? parseFloat(String(perf.weight)) : 0;
    const hasWeight = !isNaN(weightNum) && weightNum > 0;

    const repsStr = perf.reps != null ? String(perf.reps).trim() : '';
    const repsNum = parseFloat(repsStr);
    const hasReps = repsStr !== '' && repsStr !== '0' && (!isNaN(repsNum) ? repsNum > 0 : true);

    const kcalStr = perf.kcal != null ? String(perf.kcal).trim() : '';
    const kcalNum = parseFloat(kcalStr);
    const hasKcal = kcalStr !== '' && kcalStr !== '0' && !isNaN(kcalNum) && kcalNum > 0;

    const distStr = perf.distance != null ? String(perf.distance).trim() : '';
    const distNum = parseFloat(distStr);
    const hasDist = distStr !== '' && distStr !== '0' && !isNaN(distNum) && distNum > 0;

    const timeStr = perf.time != null ? String(perf.time).trim() : '';
    const timeFormatted = formatTimeValue(timeStr);
    const hasTime = timeFormatted !== '';

    let rirSuffix = '';
    if (perf.rir != null && perf.rir > 0) {
        if (perf.rir >= 3) {
            rirSuffix = ' (3+ kvar)';
        } else {
            rirSuffix = ` (${perf.rir} kvar)`;
        }
    }

    if (hasReps && hasWeight) {
        parts.push(`${repsStr} × ${weightNum} kg${rirSuffix}`);
    } else if (hasReps) {
        parts.push(`${repsStr} reps${rirSuffix}`);
    } else if (hasWeight) {
        parts.push(`${weightNum} kg${rirSuffix}`);
    }

    if (hasKcal) {
        parts.push(`${kcalNum} kcal`);
    }

    if (hasTime) {
        parts.push(timeFormatted);
    }

    if (hasDist) {
        parts.push(`${String(distNum).replace('.', ',')} km`);
    }

    if (parts.length === 0) return null;
    return parts.join(' · ');
}

/**
 * Formaterar hela setlistan från förra passet: "5 × 115 kg · 3 × 100 kg · 1 × 90 kg".
 * Returnerar null när listan saknas eller när något set saknar både vikt och reps —
 * då används formatLastPerformance i stället, som även hanterar tid, distans och kcal.
 */
export function formatLastPerformanceSets(perf: LastPerformanceRecord | null | undefined): string | null {
    if (!perf || !perf.sets || perf.sets.length === 0) return null;

    const parts = perf.sets.map(s => {
        const repsStr = String(s.reps || '').trim();
        const hasReps = repsStr !== '' && repsStr !== '0';
        const hasWeight = s.weight > 0;
        if (!hasReps && !hasWeight) return null;

        let rirSuffix = '';
        if (s.rir != null && s.rir > 0) {
            rirSuffix = s.rir >= 3 ? ' (3+ kvar)' : ` (${s.rir} kvar)`;
        }

        if (hasReps && hasWeight) return `${repsStr} × ${s.weight} kg${rirSuffix}`;
        if (hasReps) return `${repsStr} reps${rirSuffix}`;
        return `${s.weight} kg${rirSuffix}`;
    }).filter(Boolean) as string[];

    if (parts.length === 0) return null;
    return parts.join(' · ');
}

export function extractPerformanceFromLogEx(exMatch: any, note?: string): LastPerformanceRecord {
    let bestWeight = 0;
    let bestReps = '0';
    let bestTime: string | number = '';
    let bestDistance: string | number = '';
    let bestKcal: string | number = '';
    let bestRir: number | null = null;
    const trackingFields: string[] = exMatch.trackingFields || [];

    if (exMatch.setDetails && exMatch.setDetails.length > 0) {
        let bestSet = exMatch.setDetails[0];
        for (let i = 1; i < exMatch.setDetails.length; i++) {
            const s = exMatch.setDetails[i];
            const currW = parseFloat(String(s.weight)) || 0;
            const prevW = parseFloat(String(bestSet.weight)) || 0;
            if (currW > prevW) {
                bestSet = s;
            } else if (currW === prevW) {
                const currR = parseFloat(String(s.reps)) || 0;
                const prevR = parseFloat(String(bestSet.reps)) || 0;
                if (currR > prevR) {
                    bestSet = s;
                } else if (currR === prevR) {
                    const currKcal = parseFloat(String(s.kcal || s.calories)) || 0;
                    const prevKcal = parseFloat(String(bestSet.kcal || bestSet.calories)) || 0;
                    if (currKcal > prevKcal) {
                        bestSet = s;
                    }
                }
            }
        }
        bestWeight = parseFloat(String(bestSet.weight)) || 0;
        bestReps = bestSet.reps != null ? String(bestSet.reps) : '0';
        bestTime = bestSet.time != null ? bestSet.time : '';
        bestDistance = bestSet.distance != null ? bestSet.distance : '';
        bestKcal = bestSet.kcal != null ? bestSet.kcal : (bestSet.calories != null ? bestSet.calories : '');
        bestRir = bestSet.rir != null ? Number(bestSet.rir) : null;
    } else {
        bestWeight = parseFloat(String(exMatch.weight)) || 0;
        bestReps = exMatch.reps != null ? String(exMatch.reps) : '0';
        bestTime = exMatch.time != null ? exMatch.time : '';
        bestDistance = exMatch.distance != null ? exMatch.distance : '';
        bestKcal = exMatch.kcal != null ? exMatch.kcal : (exMatch.calories != null ? exMatch.calories : '');
        bestRir = exMatch.rir != null ? Number(exMatch.rir) : null;
    }

    // Hela setlistan följer med, i den ordning de kördes. Bara set med vikt eller
    // reps tas med — tomma rader ska inte synas i historiken.
    const sets = (exMatch.setDetails || [])
        .map((s: any) => ({
            weight: parseFloat(String(s.weight)) || 0,
            reps: s.reps != null ? String(s.reps) : '',
            rir: s.rir != null ? Number(s.rir) : null
        }))
        .filter((s: any) => s.weight > 0 || (s.reps !== '' && s.reps !== '0'));

    return {
        weight: bestWeight,
        reps: bestReps,
        time: bestTime,
        distance: bestDistance,
        kcal: bestKcal,
        rir: bestRir,
        note,
        trackingFields,
        sets
    };
}

export const TimeInput: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
    compact?: boolean;
    error?: boolean;
}> = ({ value, onChange, placeholder, className, compact, error }) => {
    const [min, setMin] = useState('');
    const [sec, setSec] = useState('');

    useEffect(() => {
        const val = parseFloat(value);
        if (isNaN(val) && !value) {
             if (min !== '' || sec !== '') {
                 setMin('');
                 setSec('');
             }
             return;
        }

        const currentMin = parseInt(min || '0', 10);
        const currentSec = parseInt(sec || '0', 10);
        const currentTotal = currentMin + (currentSec / 60);

        if (!isNaN(val) && Math.abs(val - currentTotal) > 0.001) {
            const m = Math.floor(val);
            const s = Math.round((val - m) * 60);
            setMin(m.toString());
            setSec(s.toString().padStart(2, '0'));
        }
    }, [value]);

    const update = (mStr: string, sStr: string) => {
        setMin(mStr);
        setSec(sStr);
        const m = parseInt(mStr || '0', 10);
        const s = parseInt(sStr || '0', 10);
        const total = m + (s / 60);
        onChange(total.toString());
    };

    return (
        <div className={`flex items-center justify-center ${compact ? 'px-2 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl border' : 'bg-primary/5 dark:bg-primary/10 rounded-2xl border-2 p-3 shadow-xs'} ${
            error 
                ? 'border-red-500 ring-2 ring-red-500/20' 
                : compact ? 'border-gray-200 dark:border-gray-700' : 'border-primary/30'
        } focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all ${className}`}>
             <div className="flex-1 flex flex-col justify-center items-center">
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={min}
                    onChange={(e) => update(e.target.value, sec)}
                    placeholder={placeholder || "0"}
                    className={`w-full bg-transparent font-black tabular-nums text-gray-900 dark:text-white focus:outline-none text-center appearance-none ${compact ? 'text-base py-0' : 'text-3xl sm:text-4xl py-2'}`}
                />
                {!compact && <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-[1.2] pt-[0.1em]">Minuter</span>}
             </div>
             <span className={`text-primary font-black ${compact ? 'text-base' : 'text-3xl pb-3'}`}>:</span>
             <div className="flex-1 flex flex-col justify-center items-center">
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={sec}
                    onChange={(e) => update(min, e.target.value)}
                    placeholder="00"
                    className={`w-full bg-transparent font-black tabular-nums text-gray-900 dark:text-white focus:outline-none text-center appearance-none ${compact ? 'text-base py-0' : 'text-3xl sm:text-4xl py-2'}`}
                />
                {!compact && <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-[1.2] pt-[0.1em]">Sekunder</span>}
             </div>
        </div>
    );
};

export const DIPLOMA_TITLES = [
    "SNYGGT JOBBAT!", "GRYMT KÖRT!", "VILKEN KÄMPE!", "STARKARE ÄN IGÅR!", "VÄRLDSKLASS!", 
    "HELT OTROLIGT!", "DU ÄGDE PASSET!", "VILKEN INSATS!", "HELT MAGISKT!", "DU GJORDE DET!", 
    "GE DIG SJÄLV EN HIGH-FIVE!", "PASSET ÄR DITT!", "EN RIKTIG SEGER!", "TOPPFORM!", "OJ OJ OJ!"
];

export const getRandomDiplomaTitle = () => DIPLOMA_TITLES[Math.floor(Math.random() * DIPLOMA_TITLES.length)];

export const WEIGHT_COMPARISONS = [
    { name: "Hamstrar", singular: "en Hamster", weight: 0.15, emoji: "🐹" },
    { name: "Fotbollar", singular: "en Fotboll", weight: 0.45, emoji: "⚽" },
    { name: "Ananasar", singular: "en Ananas", weight: 1, emoji: "🍍" },
    { name: "Mjölkpaket", singular: "ett Mjölkpaket", weight: 1, emoji: "🥛" },
    { name: "Chihuahuas", singular: "en Chihuahua", weight: 2, emoji: "🐕" },
    { name: "Katter", singular: "en Katt", weight: 5, emoji: "🐈" },
    { name: "Bowlingklot", singular: "ett Bowlingklot", weight: 7, emoji: "🎳" },
    { name: "Bildäck", singular: "ett Bildäck", weight: 10, emoji: "🛞" },
    { name: "Cyklar", singular: "en Cykel", weight: 15, emoji: "🚲" },
    { name: "Resväskor", singular: "en Resväska", weight: 20, emoji: "🧳" },
    { name: "Golden Retrievers", singular: "en Golden Retriever", weight: 30, emoji: "🦮" },
    { name: "Diskmaskiner", singular: "en Diskmaskin", weight: 50, emoji: "🍽️" },
    { name: "Tvättmaskiner", singular: "en Tvättmaskin", weight: 70, emoji: "🧺" },
    { name: "Vuxna Män", singular: "en Genomsnittlig Man", weight: 80, emoji: "👨" },
    { name: "Renar", singular: "en Ren", weight: 100, emoji: "🦌" },
    { name: "Pandor", singular: "en Panda", weight: 120, emoji: "🐼" },
    { name: "Gorillor", singular: "en Gorilla", weight: 180, emoji: "🦍" },
    { name: "Motorcyklar", singular: "en Motorcykel", weight: 200, emoji: "🏍️" },
    { name: "Lejon", singular: "ett Lejon", weight: 200, emoji: "🦁" },
    { name: "Björnar", singular: "en Björn", weight: 300, emoji: "🐻" },
    { name: "Sibiriska Tigrar", singular: "en Sibirisk Tiger", weight: 300, emoji: "🐅" },
    { name: "Krokodiler", singular: "en Krokodil", weight: 400, emoji: "🐊" },
    { name: "Konsertflyglar", singular: "en Konsertflygel", weight: 500, emoji: "🎹" },
    { name: "Hästar", singular: "en Häst", weight: 500, emoji: "🐎" },
    { name: "Kor", singular: "en Ko", weight: 700, emoji: "🐄" },
    { name: "Giraffer", singular: "en Giraff", weight: 800, emoji: "🦒" },
    { name: "Bufflar", singular: "en Buffel", weight: 900, emoji: "🐃" },
    { name: "Personbilar", singular: "en Personbil", weight: 1500, emoji: "🚘" },
    { name: "Noshörningar", singular: "en Noshörning", weight: 2000, emoji: "🦏" },
    { name: "Traktorer", singular: "en Traktor", weight: 4000, emoji: "🚜" },
    { name: "Elefanter", singular: "en Elefant", weight: 5000, emoji: "🐘" },
    { name: "Späckhuggare", singular: "en Späckhuggare", weight: 5500, emoji: "🐋" },
    { name: "T-Rex", singular: "en T-Rex", weight: 8000, emoji: "🦖" },
    { name: "Skolbussar", singular: "en Skolbuss", weight: 12000, emoji: "🚌" },
    { name: "Lastbilar", singular: "en Lastbil", weight: 15000, emoji: "🚚" },
    { name: "Blåvalar", singular: "en Blåval", weight: 150000, emoji: "🐳" },
    { name: "Boeing 747", singular: "en Boeing 747", weight: 400000, emoji: "✈️" },
];

export const getFunComparison = (totalWeight: number) => {
    if (totalWeight <= 0) return null;
    const suitableComparisons = WEIGHT_COMPARISONS.filter(item => totalWeight >= item.weight);
    if (suitableComparisons.length === 0) {
        const item = WEIGHT_COMPARISONS[0];
        return { count: (totalWeight / item.weight).toFixed(1), name: item.name, single: item.singular, weight: item.weight, emoji: item.emoji };
    }
    const tightMatches = suitableComparisons.filter(item => {
        const count = totalWeight / item.weight;
        return count >= 1 && count <= 20;
    });
    const niceMatches = suitableComparisons.filter(item => {
        const count = totalWeight / item.weight;
        return count >= 1 && count <= 50;
    });
    let bestMatch = tightMatches.length > 0 
        ? tightMatches[Math.floor(Math.random() * tightMatches.length)] 
        : (niceMatches.length > 0 
            ? niceMatches[Math.floor(Math.random() * niceMatches.length)] 
            : suitableComparisons[suitableComparisons.length - 1]);
    const rawCount = totalWeight / bestMatch.weight;
    const formattedCount = rawCount < 10 ? rawCount.toFixed(1) : Math.round(rawCount).toString();
    return { count: formattedCount, name: bestMatch.name, single: bestMatch.singular, weight: bestMatch.weight, emoji: bestMatch.emoji };
};

export const KROPPSKANSLA_TAGS = ["Pigg", "Stark", "Svag", "Trött", "Seg", "Stel", "Ont", "Stressad", "Taggad", "Bra musik", "Bra pepp", "Grymt pass"];

export const RPE_LEVELS = [
    { range: '1-2', label: 'Mycket lätt', desc: 'Du kan sjunga eller prata helt obehindrat.', color: 'bg-emerald-500' },
    { range: '3-4', label: 'Lätt', desc: 'Du börjar bli varm men kan fortfarande prata enkelt.', color: 'bg-green-500' },
    { range: '5-6', label: 'Måttligt', desc: 'Du börjar bli djupt andfådd.', color: 'bg-yellow-500' },
    { range: '7-8', label: 'Hårt', desc: 'Det är ansträngande. Du kan bara svara med enstaka ord.', color: 'bg-orange-500' },
    { range: '9', label: 'Mycket hårt', desc: 'Nära ditt max. Du kan inte prata alls.', color: 'bg-red-500' },
    { range: '10', label: 'Maximalt', desc: 'Absolut max. Du kan inte göra en enda rep till.', color: 'bg-black' },
];

export const normalizeString = (str: string) => str.toLowerCase().trim().replace(/[^\w\såäöÅÄÖ]/g, ''); 

export const isExerciseMatch = (targetName: string, targetId: string, candidateName: string, candidateId: string | undefined): boolean => {
    if (targetId && candidateId && targetId === candidateId) return true;
    const nTarget = normalizeString(targetName);
    const nCandidate = normalizeString(candidateName);
    if (nTarget === nCandidate) return true;
    if (nCandidate.includes(nTarget) && nTarget.length > 3) return true;
    return false;
};

export const GROUP_COLORS = [
    { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-900/20', lightBorder: 'border-blue-200 dark:border-blue-800' },
    { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-500', lightBg: 'bg-pink-50 dark:bg-pink-900/20', lightBorder: 'border-pink-200 dark:border-pink-800' },
    { bg: 'bg-lime-500', border: 'border-lime-500', text: 'text-lime-500', lightBg: 'bg-lime-50 dark:bg-lime-900/20', lightBorder: 'border-lime-200 dark:border-lime-800' },
    { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', lightBg: 'bg-orange-50 dark:bg-orange-900/20', lightBorder: 'border-orange-200 dark:border-orange-800' },
    { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500', lightBg: 'bg-purple-50 dark:bg-purple-900/20', lightBorder: 'border-purple-200 dark:border-purple-800' },
];

export const GRID_COLS_MAP: Record<number, string> = {
    1: 'grid-cols-[36px_repeat(1,_1fr)_40px_48px]',
    2: 'grid-cols-[36px_repeat(2,_1fr)_40px_48px]',
    3: 'grid-cols-[36px_repeat(3,_1fr)_40px_48px]',
    4: 'grid-cols-[36px_repeat(4,_1fr)_40px_48px]',
    5: 'grid-cols-[36px_repeat(5,_1fr)_40px_48px]',
};

export const cleanForFirestore = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(v => (v && typeof v === 'object' ? cleanForFirestore(v) : v)).filter(v => v !== undefined);
  const result: any = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined && val !== null) {
        if (typeof val === 'number' && isNaN(val)) return;
        result[key] = (val && typeof val === 'object' && !(val instanceof Date)) ? cleanForFirestore(val) : val;
    }
  });
  return result;
};
