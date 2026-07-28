
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getMemberLogs, getVisibleWorkoutsForMembers, saveWorkoutLog, uploadImage, updateWorkoutLog, deleteWorkoutLog, getOrganizationExerciseBank, getMemberCustomExercises, addMemberCustomExercise, deleteMemberCustomExercise, updateMemberCustomExercise, listenToPersonalBests } from '../../services/firebaseService';
import { generateWorkoutDiploma, generateImage } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext'; 
import { useWorkout } from '../../context/WorkoutContext'; 
import { CloseIcon, SparklesIcon, FireIcon, InformationCircleIcon, LightningIcon, PlusIcon, TrashIcon, CheckIcon, ChartBarIcon, HistoryIcon, CalculatorIcon } from '../../components/icons'; 
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { calculate1RM, findDuplicateBankExercise, canonicalizeExerciseName } from '../../utils/workoutUtils';
import { DuplicateExerciseModal } from '../../components/DuplicateExerciseModal';
import { ExerciseResult, MemberFeeling, WorkoutDiploma, WorkoutLog, BenchmarkDefinition, BankExercise, Workout, PersonalBest } from '../../types';
import { MOCK_EXERCISE_BANK } from '../../data/mockData';
import { saveCustomProgram, fetchCustomPrograms } from '../../services/firebaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { Confetti } from '../../components/WorkoutCompleteModal';
import { useStudio } from '../../context/StudioContext';
import { resizeImage } from '../../utils/imageUtils';

// --- Local Storage Key ---
const ACTIVE_LOG_STORAGE_KEY = 'smart-skarm-active-log';

interface BlockGroup {
  blockId: string;
  blockTitle: string;
  exercises: {
      result: LocalExerciseResult;
      originalIndex: number;
  }[];
}

const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
);

// --- Local Types for Form State ---

interface LocalSetDetail {
    weight: string;
    reps: string;
    time?: string;
    distance?: string;
    kcal?: string;
    completed: boolean;
}

interface LastPerformanceRecord {
    weight?: number | null;
    reps?: string | number | null;
    time?: string | number | null;
    distance?: string | number | null;
    kcal?: string | number | null;
    note?: string;
    trackingFields?: string[];
}

function formatTimeValue(val: string | number): string {
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

    if (hasReps && hasWeight) {
        parts.push(`${repsStr} × ${weightNum} kg`);
    } else if (hasReps) {
        parts.push(`${repsStr} reps`);
    } else if (hasWeight) {
        parts.push(`${weightNum} kg`);
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

function extractPerformanceFromLogEx(exMatch: any, note?: string): LastPerformanceRecord {
    let bestWeight = 0;
    let bestReps = '0';
    let bestTime: string | number = '';
    let bestDistance: string | number = '';
    let bestKcal: string | number = '';
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
    } else {
        bestWeight = parseFloat(String(exMatch.weight)) || 0;
        bestReps = exMatch.reps != null ? String(exMatch.reps) : '0';
        bestTime = exMatch.time != null ? exMatch.time : '';
        bestDistance = exMatch.distance != null ? exMatch.distance : '';
        bestKcal = exMatch.kcal != null ? exMatch.kcal : (exMatch.calories != null ? exMatch.calories : '');
    }

    return {
        weight: bestWeight,
        reps: bestReps,
        time: bestTime,
        distance: bestDistance,
        kcal: bestKcal,
        note,
        trackingFields
    };
}

interface LocalExerciseResult {
  exerciseId: string;
  exerciseName: string;
  setDetails: LocalSetDetail[];
  isBodyweight?: boolean;
  blockId: string;
  blockTitle: string;
  coachAdvice?: string;
  note?: string;
  trackingFields?: ('time' | 'distance' | 'kcal' | 'reps' | 'weight')[];
  groupId?: string;
  groupColor?: string;
}

interface LogData {
  rpe: number | null;
  feeling: MemberFeeling | null;
  tags: string[];
  comment: string;
  imageUrl?: string;
}

interface WorkoutData {
  id: string;
  title: string;
  coachTips?: string;
  benchmarkId?: string;
  aiProgressionPrompt?: string;
  usePreGame?: boolean;
  blocks: {
      id: string;
      title: string;
      tag: string;
      exercises: { id: string; name: string; exerciseName?: string; loggingEnabled?: boolean }[];
      settings: { rounds: number; mode: string };
  }[];
}

// --- TIME INPUT COMPONENT ---
const TimeInput: React.FC<{
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

// --- DIPLOMA TITLES & COMPARISONS ---
const DIPLOMA_TITLES = [
    "SNYGGT JOBBAT!", "GRYMT KÖRT!", "VILKEN KÄMPE!", "STARKARE ÄN IGÅR!", "VÄRLDSKLASS!", 
    "HELT OTROLIGT!", "DU ÄGDE PASSET!", "VILKEN INSATS!", "HELT MAGISKT!", "DU GJORDE DET!", 
    "GE DIG SJÄLV EN HIGH-FIVE!", "PASSET ÄR DITT!", "EN RIKTIG SEGER!", "TOPPFORM!", "OJ OJ OJ!"
];

const getRandomDiplomaTitle = () => DIPLOMA_TITLES[Math.floor(Math.random() * DIPLOMA_TITLES.length)];

const WEIGHT_COMPARISONS = [
    { name: "Hamstrar", singular: "en Hamster", weight: 0.15, emoji: "🐹" },
    { name: "Fotbollar", singular: "en Fotboll", weight: 0.45, emoji: "⚽" },
    { name: "Ananasar", singular: "en Ananas", weight: 1, emoji: "🍍" },
    { name: "Chihuahuas", singular: "en Chihuahua", weight: 2, emoji: "🐕" },
    { name: "Katter", singular: "en Katt", weight: 5, emoji: "🐈" },
    { name: "Bildäck", singular: "ett Bildäck", weight: 10, emoji: "🛞" },
    { name: "Cyklar", singular: "en Cykel", weight: 15, emoji: "🚲" },
    { name: "Golden Retrievers", singular: "en Golden Retriever", weight: 30, emoji: "🦮" },
    { name: "Diskmaskiner", singular: "en Diskmaskin", weight: 50, emoji: "🍽️" },
    { name: "Vuxna Män", singular: "en Genomsnittlig Man", weight: 80, emoji: "👨" },
    { name: "Pandor", singular: "en Panda", weight: 120, emoji: "🐼" },
    { name: "Gorillor", singular: "en Gorilla", weight: 180, emoji: "🦍" },
    { name: "Lejon", singular: "ett Lejon", weight: 200, emoji: "🦁" },
    { name: "Sibiriska Tigrar", singular: "en Sibirisk Tiger", weight: 300, emoji: "🐅" },
    { name: "Konsertflyglar", singular: "en Konsertflygel", weight: 500, emoji: "🎹" },
    { name: "Hästar", singular: "en Häst", weight: 500, emoji: "🐎" },
    { name: "Giraffer", singular: "en Giraff", weight: 800, emoji: "🦒" },
    { name: "Personbilar", singular: "en Personbil", weight: 1500, emoji: "🚘" },
    { name: "Noshörningar", singular: "en Noshörning", weight: 2000, emoji: "🦏" },
    { name: "Elefanter", singular: "en Elefant", weight: 5000, emoji: "🐘" },
    { name: "T-Rex", singular: "en T-Rex", weight: 8000, emoji: "🦖" },
    { name: "Skolbussar", singular: "en Skolbuss", weight: 12000, emoji: "🚌" },
    { name: "Blåvalar", singular: "en Blåval", weight: 150000, emoji: "🐳" },
    { name: "Boeing 747", singular: "en Boeing 747", weight: 400000, emoji: "✈️" },
];

const getFunComparison = (totalWeight: number) => {
    if (totalWeight <= 0) return null;
    const suitableComparisons = WEIGHT_COMPARISONS.filter(item => totalWeight >= item.weight);
    if (suitableComparisons.length === 0) {
        const item = WEIGHT_COMPARISONS[0];
        return { count: (totalWeight / item.weight).toFixed(1), name: item.name, singular: item.singular, weight: item.weight, emoji: item.emoji };
    }
    const niceMatches = suitableComparisons.filter(item => {
        const count = totalWeight / item.weight;
        return count >= 1 && count <= 50;
    });
    let bestMatch = niceMatches.length > 0 ? niceMatches[Math.floor(Math.random() * niceMatches.length)] : suitableComparisons[suitableComparisons.length - 1];
    const rawCount = totalWeight / bestMatch.weight;
    const formattedCount = rawCount < 10 ? rawCount.toFixed(1) : Math.round(rawCount).toString();
    return { count: formattedCount, name: bestMatch.name, single: bestMatch.singular, weight: bestMatch.weight, emoji: bestMatch.emoji };
};

const KROPPSKANSLA_TAGS = ["Pigg", "Stark", "Svag", "Trött", "Seg", "Stel", "Ont", "Stressad", "Taggad", "Bra musik", "Bra pepp", "Grymt pass"];
const RPE_LEVELS = [
    { range: '1-2', label: 'Mycket lätt', desc: 'Du kan sjunga eller prata helt obehindrat.', color: 'bg-emerald-500' },
    { range: '3-4', label: 'Lätt', desc: 'Du börjar bli varm men kan fortfarande prata enkelt.', color: 'bg-green-500' },
    { range: '5-6', label: 'Måttligt', desc: 'Du börjar bli djupt andfådd.', color: 'bg-yellow-500' },
    { range: '7-8', label: 'Hårt', desc: 'Det är ansträngande. Du kan bara svara med enstaka ord.', color: 'bg-orange-500' },
    { range: '9', label: 'Mycket hårt', desc: 'Nära ditt max. Du kan inte prata alls.', color: 'bg-red-500' },
    { range: '10', label: 'Maximalt', desc: 'Absolut max. Du kan inte göra en enda rep till.', color: 'bg-black' },
];

const normalizeString = (str: string) => str.toLowerCase().trim().replace(/[^\w\såäöÅÄÖ]/g, ''); 

const isExerciseMatch = (targetName: string, targetId: string, candidateName: string, candidateId: string | undefined): boolean => {
    if (targetId && candidateId && targetId === candidateId) return true;
    const nTarget = normalizeString(targetName);
    const nCandidate = normalizeString(candidateName);
    if (nTarget === nCandidate) return true;
    if (nCandidate.includes(nTarget) && nTarget.length > 3) return true;
    return false;
};

// --- Pre-Game Strategy View ---

const PreGameView: React.FC<{
    workoutTitle: string;
    exercises: { id: string; name: string; exerciseName?: string }[];
    aiProgressionPrompt?: string;
    history: Record<string, LastPerformanceRecord>;
    personalBests: Record<string, PersonalBest>;
    userId?: string;
    onStart: () => void;
    onCancel: () => void;
}> = ({ workoutTitle, exercises, aiProgressionPrompt, history, personalBests, userId, onStart, onCancel }) => {
    const [mode, setMode] = useState<'normal' | 'fatigued'>('normal');

    const exerciseTargets = useMemo(() => {
        return exercises.map(ex => {
            const exName = ex.exerciseName || ex.name || '';
            const cleanKey = exName.toLowerCase().trim();

            const pb = personalBests[cleanKey];
            let current1RM: number | undefined = undefined;
            if (pb) {
                if (pb.calculated1RM !== undefined && pb.calculated1RM > 0) {
                    current1RM = Math.round(pb.calculated1RM);
                } else if (pb.weight > 0) {
                    current1RM = calculate1RM(pb.weight, pb.reps || 1) || undefined;
                }
            } else {
                const lastPerf = history[exName];
                if (lastPerf) {
                    const lastWeight = typeof lastPerf.weight === 'number' ? lastPerf.weight : (parseFloat(String(lastPerf.weight)) || 0);
                    const lastReps = typeof lastPerf.reps === 'number' ? lastPerf.reps : (parseFloat(String(lastPerf.reps)) || 0);
                    if (lastWeight > 0 && lastReps > 0 && lastReps <= 10) {
                        current1RM = calculate1RM(lastWeight, lastReps) || undefined;
                    }
                }
            }

            const storageKey = `target_pct_${userId || 'user'}_${cleanKey}`;
            let targetPct: number | null = null;
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) targetPct = parseInt(saved, 10);
            } catch {}

            let bas: number | null = null;
            let basSource: 'targetPct' | 'history' | 'none' = 'none';

            if (current1RM && current1RM > 0 && targetPct && targetPct > 0) {
                bas = Math.round(current1RM * (targetPct / 100) * 2) / 2;
                basSource = 'targetPct';
            } else {
                const lastPerf = history[exName];
                const lastWeight = typeof lastPerf?.weight === 'number' ? lastPerf.weight : (parseFloat(String(lastPerf?.weight)) || 0);
                if (lastWeight > 0) {
                    bas = lastWeight;
                    basSource = 'history';
                }
            }

            let scaledWeight: number | null = null;
            if (bas !== null) {
                if (mode === 'normal') {
                    scaledWeight = bas;
                } else {
                    scaledWeight = Math.round((bas * 0.9) / 2.5) * 2.5;
                }
            }

            return {
                exName,
                bas,
                scaledWeight,
                targetPct,
                current1RM,
                basSource
            };
        });
    }, [exercises, history, personalBests, userId, mode]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-hidden animate-fade-in">
            {/* Scrollable Content Area */}
            <div className="relative z-10 flex-1 overflow-y-auto p-6 scrollbar-hide">
                <div className="flex justify-between items-start mb-6">
                    <button onClick={onCancel} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white font-bold text-xs uppercase tracking-widest px-3 py-1 transition-all active:scale-95 leading-[1.2] pt-[0.1em]">Avbryt</button>
                </div>
                
                <div className="text-center mb-8">
                    <span className="inline-block py-1.5 px-3.5 rounded-full bg-primary/10 dark:bg-white/10 border border-primary/20 dark:border-white/20 text-xs font-black uppercase tracking-wider text-primary mb-4 leading-[1.2] pt-[0.1em]">Pre-Game Strategy</span>
                    <h1 className="text-3xl font-black leading-[1.2] pt-[0.1em] mb-2 text-gray-900 dark:text-white uppercase tracking-tight">{workoutTitle}</h1>
                </div>

                {/* 1. LÄGEN BUTTONS */}
                <div className="mb-8">
                    <p className="text-center text-xs font-black uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider leading-[1.2] pt-[0.1em]">Välj dagens känsla</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setMode('normal')}
                            className={`min-h-[52px] p-4 rounded-2xl border-2 font-black transition-all active:scale-95 text-center ${mode === 'normal' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
                        >
                            <span className="block text-sm uppercase tracking-wider">SOM VANLIGT</span>
                            <span className={`block text-xs font-normal mt-0.5 opacity-90 ${mode === 'normal' ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>följ planen</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('fatigued')}
                            className={`min-h-[52px] p-4 rounded-2xl border-2 font-black transition-all active:scale-95 text-center ${mode === 'fatigued' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
                        >
                            <span className="block text-sm uppercase tracking-wider">SLITEN IDAG</span>
                            <span className={`block text-xs font-normal mt-0.5 opacity-90 ${mode === 'fatigued' ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>skala ner</span>
                        </button>
                    </div>
                </div>

                {/* 3. TEXTER */}
                <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 mb-6">
                    {mode === 'normal' ? (
                        <div>
                            <h3 className="font-black text-base text-gray-900 dark:text-white mb-1 uppercase tracking-tight">Följ planen</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Dagens målvikter är baserade på dina senaste resultat.</p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="font-black text-base text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-tight">Vi tar det lite lugnare</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Vikterna är nedskalade ca 10 %. Kör tekniskt, ta längre vila och avsluta i tid.</p>
                        </div>
                    )}

                    {aiProgressionPrompt && aiProgressionPrompt.trim().length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Coachens instruktion</h4>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 italic">{aiProgressionPrompt}</p>
                        </div>
                    )}
                </div>

                {/* 2. MÅLVIKT PER ÖVNING */}
                <div className="mb-8">
                    <h3 className="text-xs font-black uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider">Målvikter för övningar</h3>
                    <div className="space-y-2.5">
                        {exerciseTargets.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800/80 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80 shadow-sm">
                                <span className="text-sm font-bold text-gray-900 dark:text-white pr-2">{item.exName}</span>
                                <div className="text-right whitespace-nowrap">
                                    {item.bas !== null && item.scaledWeight !== null ? (
                                        <div className="flex items-center gap-2">
                                            {mode === 'fatigued' && item.bas !== item.scaledWeight && (
                                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 line-through tabular-nums">
                                                    {String(item.bas).replace('.', ',')} kg
                                                </span>
                                            )}
                                            <span className="text-sm font-black tabular-nums text-primary dark:text-primary">
                                                {String(item.scaledWeight).replace('.', ',')} kg
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                                            Ingen historik än
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-6 font-medium">
                    Vid smärta eller skada — prata med din coach.
                </p>

                {/* --- START BUTTON IN SCROLL FLOW --- */}
                <div className="pb-12">
                    <button onClick={onStart} className="w-full min-h-[52px] bg-primary hover:brightness-110 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 focus:ring-2 focus:ring-primary uppercase tracking-tight">
                        <span className="leading-[1.2] pt-[0.1em]">Starta passet</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

const GROUP_COLORS = [
    { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-900/20', lightBorder: 'border-blue-200 dark:border-blue-800' },
    { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-500', lightBg: 'bg-pink-50 dark:bg-pink-900/20', lightBorder: 'border-pink-200 dark:border-pink-800' },
    { bg: 'bg-lime-500', border: 'border-lime-500', text: 'text-lime-500', lightBg: 'bg-lime-50 dark:bg-lime-900/20', lightBorder: 'border-lime-200 dark:border-lime-800' },
    { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', lightBg: 'bg-orange-50 dark:bg-orange-900/20', lightBorder: 'border-orange-200 dark:border-orange-800' },
    { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500', lightBg: 'bg-purple-50 dark:bg-purple-900/20', lightBorder: 'border-purple-200 dark:border-purple-800' },
];

const GRID_COLS_MAP: Record<number, string> = {
    1: 'grid-cols-[36px_repeat(1,_1fr)_40px_48px]',
    2: 'grid-cols-[36px_repeat(2,_1fr)_40px_48px]',
    3: 'grid-cols-[36px_repeat(3,_1fr)_40px_48px]',
    4: 'grid-cols-[36px_repeat(4,_1fr)_40px_48px]',
    5: 'grid-cols-[36px_repeat(5,_1fr)_40px_48px]',
};

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
  onOpenCalculator?: (context: { 
      exerciseName: string, 
      current1RM?: number, 
      activeTargetPct?: number | null, 
      onSelectTargetPct?: (pct: number | null) => void 
  }) => void;
}> = ({ name, result, onUpdate, onRemove, lastPerformance, personalBest, isLastInGroup, onAddGroupSet, userId, onOpenCalculator }) => {
    
    const trackingFields = result.trackingFields || ['reps', 'weight'];
    const showReps = trackingFields.includes('reps');
    const showWeight = trackingFields.includes('weight');
    const showTime = trackingFields.includes('time');
    const showDistance = trackingFields.includes('distance');
    const showKcal = trackingFields.includes('kcal');

    const dynamicColsCount = [showReps, showWeight, showTime, showDistance, showKcal].filter(Boolean).length;
    const gridColsClass = GRID_COLS_MAP[dynamicColsCount] || 'grid-cols-[36px_repeat(2,_1fr)_40px_48px]';

    // Extract tailwind color classes from groupColor (e.g. "bg-pink-500")
    const groupColorObj = result.groupColor ? GROUP_COLORS.find(c => c.bg === result.groupColor) : null;
    const borderColorClass = groupColorObj ? groupColorObj.border : 'border-gray-100 dark:border-gray-800';
    const textColorClass = groupColorObj ? groupColorObj.text : 'text-primary';
    const lightBgClass = groupColorObj ? groupColorObj.lightBg : 'bg-primary/5';
    const lightBorderClass = groupColorObj ? groupColorObj.lightBorder : 'border-primary/20';

    const handleSetChange = (index: number, field: keyof LocalSetDetail, value: string) => {
        const newSets = [...result.setDetails];
        newSets[index] = { ...newSets[index], [field]: value };
        onUpdate({ setDetails: newSets });
    };

    const handleToggleComplete = (index: number) => {
         if (window.navigator.vibrate) {
             window.navigator.vibrate(result.setDetails[index].completed ? 5 : 15);
         }
         
         const newSets = [...result.setDetails];
         newSets[index] = { ...newSets[index], completed: !newSets[index].completed };
         onUpdate({ setDetails: newSets });
    }

    const handleAddSet = () => {
        const lastSet = result.setDetails[result.setDetails.length - 1];
        const newSet = lastSet ? { ...lastSet, completed: false } : { weight: '', reps: '', time: '', distance: '', kcal: '', completed: false };
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

    // Local state for target percentage (persisted per member & exercise)
    const storageKey = `target_pct_${userId || 'user'}_${name.toLowerCase().trim()}`;
    const [targetPct, setTargetPct] = useState<number | null>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? parseInt(saved, 10) : null;
        } catch {
            return null;
        }
    });

    const handleSetTargetPct = useCallback((pct: number | null) => {
        setTargetPct(pct);
        try {
            if (pct === null) {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, pct.toString());
            }
        } catch {}
    }, [storageKey]);

    const ALL_TRACKING_FIELDS = [
        { id: 'reps', label: 'Reps' },
        { id: 'weight', label: 'Vikt' },
        { id: 'time', label: 'Tid' },
        { id: 'distance', label: 'Distans' },
        { id: 'kcal', label: 'Kcal' },
    ] as const;

    const inactiveFields = ALL_TRACKING_FIELDS.filter(f => !trackingFields.includes(f.id));

    const toggleField = (field: 'reps' | 'weight' | 'time' | 'distance' | 'kcal') => {
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
                                const formatted = formatLastPerformance(lastPerformance);
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
                            {targetPct && current1RM ? (() => {
                                const targetWeight = Math.round(current1RM * (targetPct / 100) * 2) / 2;
                                const formattedTargetWeight = targetWeight.toString().replace('.', ',');
                                return (
                                    <div className="inline-flex items-center gap-1 bg-primary/10 dark:bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-lg text-xs font-black tracking-wide font-mono tabular-nums">
                                        <span>MÅL: {formattedTargetWeight} kg ({targetPct} % av 1RM)</span>
                                    </div>
                                );
                            })() : null}
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
                                        activeTargetPct: targetPct,
                                        onSelectTargetPct: handleSetTargetPct
                                    });
                                }}
                                className="p-3 rounded-2xl transition-all active:scale-90 bg-gray-50 dark:bg-gray-800 text-primary hover:bg-primary/20 dark:hover:bg-primary/20 shadow-sm"
                            >
                                <CalculatorIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button 
                            onClick={() => setIsEditingFields(!isEditingFields)}
                            className={`p-3 rounded-2xl transition-all active:scale-90 shadow-sm ${isEditingFields ? 'bg-primary/10 text-primary' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-650 dark:hover:text-gray-200'}`}
                        
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
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

                {inactiveFields.length > 0 && !isEditingFields && (
                    <div className="mt-1">
                        {!showMoreFields ? (
                            <button
                                type="button"
                                onClick={() => setShowMoreFields(true)}
                                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary-light bg-gray-50/80 dark:bg-gray-800/80 hover:bg-primary/10 px-2.5 py-1 rounded-full transition-all border border-gray-150 dark:border-gray-700/60 active:scale-95"
                            >
                                <PlusIcon className="w-3 h-3" />
                                <span>+ fler fält</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 flex-wrap p-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-150 dark:border-gray-700/80 animate-fade-in">
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

                {isEditingFields && (
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

                    {result.setDetails.map((set, index) => {
                        return (
                            <div key={index} className={`grid ${gridColsClass} gap-2 items-center transition-all ${set.completed ? 'opacity-50' : 'opacity-100'}`}>
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
                                            <input type="number" value={set.weight} onChange={(e) => handleSetChange(index, 'weight', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-xl focus:outline-none text-center" disabled={set.completed} />
                                        </div>
                                    </div>
                                )}

                                {showTime && (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 shadow-inner">
                                        <input type="number" value={set.time || ''} onChange={(e) => handleSetChange(index, 'time', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-xl focus:outline-none text-center" disabled={set.completed} />
                                    </div>
                                )}

                                {showDistance && (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 shadow-inner">
                                        <input type="number" value={set.distance || ''} onChange={(e) => handleSetChange(index, 'distance', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-xl focus:outline-none text-center" disabled={set.completed} />
                                    </div>
                                )}

                                {showKcal && (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 shadow-inner">
                                        <input type="number" value={set.kcal || ''} onChange={(e) => handleSetChange(index, 'kcal', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-xl focus:outline-none text-center" disabled={set.completed} />
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
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-md transform active:scale-90 ${set.completed ? 'bg-green-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                    >
                                        {set.completed ? <CheckIcon className="w-6 h-6" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-45" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {(!result.groupId) && (
                        <button onClick={handleAddSet} className="w-full mt-3 py-3.5 flex items-center justify-center gap-2 text-sm font-black text-primary bg-primary/10 hover:bg-primary/15 rounded-xl transition-all border border-primary/30 border-dashed shadow-sm"><PlusIcon className="w-4 h-4" /> Lägg till set</button>
                    )}
                    {(result.groupId && isLastInGroup && onAddGroupSet) && (
                        <button 
                            onClick={onAddGroupSet} 
                            className={`w-full mt-3 py-3.5 flex items-center justify-center gap-2 text-sm font-black rounded-xl transition-all border border-dashed shadow-sm ${textColorClass} ${lightBorderClass} ${lightBgClass}`}
                        >
                            <PlusIcon className="w-4 h-4" /> Lägg till set för gruppen
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
                                    <label className="block text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-widest">Din anteckning</label>
                                    <button 
                                        onClick={() => setIsNoteExpanded(false)}
                                        className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 transition-all flex items-center justify-center active:scale-95"
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
                                    <span className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-widest group-hover:text-primary transition-colors flex items-center gap-1.5">
                                        Anteckning
                                        {result.note && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
                                    </span>
                                    <span className="text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 flex items-center justify-center active:scale-95 transition-all">
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

const CustomActivityForm: React.FC<{
  activityName: string; duration: string; distance: string; calories: string; onUpdate: (field: string, value: string) => void; isQuickMode?: boolean; hasExercises?: boolean; organizationConfig?: any; attemptedSubmit?: boolean;
}> = ({ activityName, duration, distance, calories, onUpdate, isQuickMode, hasExercises, organizationConfig, attemptedSubmit }) => {
    const [isExpanded, setIsExpanded] = useState(!hasExercises);
    const commonActivities = organizationConfig?.commonActivities || ["Funktionell Träning", "HIIT", "Löpning", "Promenad", "Workout", "Yoga", "Cykling", "Simning", "Racketsport", "Vardagsmotion", "Styrketräning"];

    useEffect(() => {
        setIsExpanded(!hasExercises);
    }, [hasExercises]);

    const isNameInvalid = !!(attemptedSubmit && !hasExercises && activityName.trim() === '');
    const isDurationInvalid = !!(attemptedSubmit && !hasExercises && (duration.trim() === '' || duration.trim() === '0' || duration.trim() === '00:00'));

    if (hasExercises && !isExpanded) {
        return (
            <div className="py-2 animate-fade-in">
                <button 
                    onClick={() => setIsExpanded(true)}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-4 rounded-3xl flex items-center justify-between text-left transition-all active:scale-95"
                >
                    <div>
                        <h3 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest">Generell Aktivitet</h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                            Frivilligt: Ange namn, konditionstid eller distans för passet
                        </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 py-2 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm relative">
                {hasExercises && (
                    <button 
                        onClick={() => setIsExpanded(false)}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                )}
                
                {!isQuickMode && (
                    <>
                        <h3 className="text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Vanliga aktiviteter</h3>
                        <div className="flex flex-wrap gap-2.5">
                            {commonActivities.map((act: string) => (
                                <button key={act} onClick={() => onUpdate('name', act)} className={`px-4.5 py-3 rounded-2xl text-sm font-extrabold border-2 transition-all active:scale-95 ${activityName === act ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-102 font-black' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{act}</button>
                            ))}
                        </div>
                    </>
                )}
                <div className={`mt-4 space-y-5 ${isQuickMode ? 'mt-0' : 'mt-8'}`}>
                    <div>
                        <label className="block text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2">Aktivitet {!hasExercises && '*'}</label>
                        <input value={activityName} onChange={(e) => onUpdate('name', e.target.value)} placeholder={hasExercises ? "T.ex. Funktionellt (Frivilligt)" : "T.ex. Powerwalk"} disabled={isQuickMode} className={`w-full text-xl font-black text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border-2 shadow-sm focus:ring-2 transition-all ${
                            isNameInvalid 
                                ? 'border-red-500 focus:ring-red-500 shadow-sm shadow-red-500/10 focus:border-red-500' 
                                : 'border-gray-100 dark:border-gray-700 focus:ring-primary'
                        } ${isQuickMode ? 'opacity-70' : ''}`} />
                        {isNameInvalid && (
                            <p className="text-red-500 dark:text-red-400 text-xs font-bold pl-1 mt-1.5 flex items-center gap-1 animate-fade-in">
                                <span>●</span> Du måste ange aktivitetens namn (t.ex. Powerwalk).
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2">Tid (min:sek) {!hasExercises && '*'}</label>
                        <TimeInput value={duration} onChange={(val) => onUpdate('duration', val)} placeholder="60" className="w-full" error={isDurationInvalid} />
                        {isDurationInvalid && (
                            <p className="text-red-500 dark:text-red-400 text-xs font-bold pl-1 mt-1.5 flex items-center gap-1 animate-fade-in">
                                <span>●</span> Du måste ange en tid i minuter (t.ex. 45).
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2">Kcal</label>
                            <input type="number" value={calories} onChange={(e) => onUpdate('calories', e.target.value)} placeholder="T.ex. 350" className="w-full font-black text-xl text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2">Distans (km)</label>
                            <input type="number" value={distance} onChange={(e) => onUpdate('distance', e.target.value)} placeholder="T.ex. 5.3" className="w-full font-black text-xl text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PostWorkoutForm: React.FC<{ data: LogData; onUpdate: (updates: Partial<LogData>) => void; userId?: string; isSummerChallengeOn?: boolean; }> = ({ data, onUpdate, userId, isSummerChallengeOn = false }) => {
    const [showRpeInfo, setShowRpeInfo] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const toggleTag = (tag: string) => onUpdate({ tags: data.tags.includes(tag) ? data.tags.filter(t => t !== tag) : [...data.tags, tag] });
    const getRpeColor = (num: number) => num <= 4 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : num <= 7 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const resized = await resizeImage(file, 800, 800, 0.8);
            const path = `workouts/${userId || 'unknown'}/workout_${Date.now()}.jpg`;
            const url = await uploadImage(path, resized);
            onUpdate({ imageUrl: url });
        } catch (err) {
            console.error("Upload image for workout failed:", err);
            alert("Det gick inte att ladda upp bilden. Försök igen!");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="mt-8 space-y-8 animate-fade-in">
            <div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-6 leading-[1.2] pt-[0.1em]">Hur kändes passet?</h4>
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-[1.2] pt-[0.1em]">Ansträngning (RPE 1-10)</h5>
                        <button onClick={() => setShowRpeInfo(true)} className="p-1.5 -m-1.5 text-gray-400 hover:text-primary transition-colors focus:ring-2 focus:ring-primary rounded-lg">
                            <InformationCircleIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex justify-between gap-1 sm:gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <button 
                                key={num} 
                                onClick={() => onUpdate({ rpe: num })} 
                                className={`flex-1 min-h-[44px] rounded-xl flex items-center justify-center font-black text-sm tabular-nums transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary ${data.rpe === num ? 'bg-primary text-white scale-105 shadow-md shadow-primary/30 z-10' : `${getRpeColor(num)} opacity-70 hover:opacity-100`}`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-10">
                    <h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 leading-[1.2] pt-[0.1em]">Kroppskänsla</h5>
                    <div className="flex flex-wrap gap-2">
                        {KROPPSKANSLA_TAGS.map(tag => (
                            <button 
                                key={tag} 
                                onClick={() => toggleTag(tag)} 
                                className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary ${data.tags.includes(tag) ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* --- Sommarpepp Bild-uppladdning (visas endast under sommarutmaningen) --- */}
                {isSummerChallengeOn && (
                    <div className="mt-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center bg-gray-50/50 dark:bg-gray-900/10 hover:border-primary/50 transition-colors animate-fade-in">
                        <h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 leading-[1.2] pt-[0.1em]">📸 Dela en sommarbild</h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto font-medium">Bifoga en bild till ditt pass så visas den i Sommarfeeden på SmartStudio och Topplistan! ☀️</p>
                        {data.imageUrl ? (
                            <div className="relative inline-block mt-2">
                                <img src={data.imageUrl} alt="Bifogad sommarbild" className="w-32 h-32 object-cover rounded-2xl shadow-md border-2 border-primary" />
                                <button 
                                    onClick={(e) => { e.preventDefault(); onUpdate({ imageUrl: '' }); }}
                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <label className={`cursor-pointer min-h-[44px] px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow hover:bg-primary dark:hover:bg-primary dark:hover:text-white hover:text-white active:scale-95 flex items-center gap-2 focus:ring-2 focus:ring-primary ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {isUploading ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            Laddar upp...
                                        </>
                                    ) : (
                                        <>
                                            <span>Bifoga bild</span>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                                </label>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-10">
                    <h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1 leading-[1.2] pt-[0.1em]">Kommentar</h5>
                    <textarea value={data.comment} onChange={(e) => onUpdate({ comment: e.target.value })} placeholder="Anteckningar..." rows={4} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner font-medium" />
                </div>
            </div>
            <Modal isOpen={showRpeInfo} onClose={() => setShowRpeInfo(false)} title="Vad är RPE?" size="sm">
                <div className="space-y-6">
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">RPE (Rate of Perceived Exertion) är en skala mellan 1-10 som hjälper dig att skatta din ansträngning.</p>
                    <div className="space-y-2">
                        {RPE_LEVELS.map(level => (
                            <div key={level.range} className="flex gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                                <div className={`w-12 h-12 rounded-xl ${level.color} flex items-center justify-center text-white font-black tabular-nums flex-shrink-0 shadow-xs`}>{level.range}</div>
                                <div>
                                    <h6 className="font-bold text-gray-900 dark:text-white text-sm">{level.label}</h6>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{level.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setShowRpeInfo(false)} className="w-full min-h-[44px] bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black py-3.5 rounded-xl uppercase tracking-wider text-xs active:scale-95 transition-all">Jag förstår</button>
                </div>
            </Modal>
        </div>
    );
};

const cleanForFirestore = (obj: any): any => {
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

const OneRMCalculatorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    context: { 
        exerciseName?: string; 
        current1RM?: number; 
        activeTargetPct?: number | null;
        onSelectTargetPct?: (pct: number | null) => void;
        onSelectWeight?: (w: number) => void; 
    } | null;
}> = ({ isOpen, onClose, context }) => {
    const [calcWeight, setCalcWeight] = useState<string>('');
    const [calcReps, setCalcReps] = useState<string>('');
    
    useEffect(() => {
        if (isOpen) {
            setCalcWeight('');
            setCalcReps('');
        }
    }, [isOpen]);

    let calculated1RM = null;
    if (calcWeight && calcReps) {
        calculated1RM = calculate1RM(calcWeight, calcReps);
    } else if (context?.current1RM) {
        calculated1RM = context.current1RM;
    }

    const percentages = [60, 65, 70, 75, 80, 85, 90, 95];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={context?.exerciseName ? `1RM: ${context.exerciseName}` : "1RM Kalkylator"} size="sm">
            <div className="space-y-6">
                {(context?.exerciseName && context?.current1RM && !calcWeight) ? (
                    <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">Uppskattat 1RM</p>
                        <p className="text-4xl font-black text-gray-900 dark:text-white">{context.current1RM} <span className="text-lg opacity-50">kg</span></p>
                    </div>
                ) : null}

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">Räkna ut (nytt) 1RM</p>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Vikt (kg)</label>
                            <input type="number" inputMode="decimal" value={calcWeight} onChange={e => setCalcWeight(e.target.value)} className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-black text-lg p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-primary text-center transition-colors" placeholder="Ex. 100" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Reps (max 10)</label>
                            <input type="number" inputMode="numeric" value={calcReps} onChange={e => setCalcReps(e.target.value)} className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-black text-lg p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-primary text-center transition-colors" placeholder="Ex. 5" />
                        </div>
                    </div>
                    {calcWeight && calcReps && calculated1RM && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-4 rounded-xl text-center shadow-lg">
                            <p className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-0.5">Ditt nya 1RM</p>
                            <p className="text-3xl font-black">{calculated1RM} <span className="text-sm opacity-70">kg</span></p>
                        </motion.div>
                    )}
                </div>

                {calculated1RM && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                {context?.onSelectTargetPct ? "Välj arbets-procent (% av 1RM)" : "Procent av 1RM"}
                            </p>
                            {context?.activeTargetPct ? (
                                <span className="text-[10px] font-black text-primary uppercase">
                                    Aktivt: {context.activeTargetPct}%
                                </span>
                            ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {percentages.map(p => {
                                const weight = Math.round((calculated1RM as number) * (p / 100) * 2) / 2;
                                const formattedWeight = weight.toString().replace('.', ',');
                                const isActive = context?.activeTargetPct === p;
                                const isClickable = !!(context?.onSelectTargetPct || context?.onSelectWeight);
                                return (
                                    <button 
                                        key={p} 
                                        onClick={() => {
                                            if (context?.onSelectTargetPct) {
                                                context.onSelectTargetPct(p);
                                                onClose();
                                            } else if (context?.onSelectWeight) {
                                                context.onSelectWeight(weight);
                                                onClose();
                                            }
                                        }}
                                        disabled={!isClickable}
                                        className={`p-3 rounded-xl flex justify-between items-center transition-all ${
                                            isActive
                                                ? 'bg-primary text-white shadow-md ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900'
                                                : isClickable
                                                    ? 'bg-primary/5 border border-primary/20 hover:bg-primary/10 active:scale-[0.98]'
                                                    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className={`text-sm font-black ${isActive ? 'text-white' : isClickable ? 'text-primary' : 'text-gray-400'}`}>{p}%</span>
                                            <span className={`text-lg font-black ${isActive ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{formattedWeight} <span className="text-xs opacity-70">kg</span></span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {context?.activeTargetPct && context?.onSelectTargetPct && (
                    <div>
                        <button 
                            onClick={() => {
                                context.onSelectTargetPct?.(null);
                                onClose();
                            }}
                            className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition text-sm"
                        >
                            Ta bort mål ({context.activeTargetPct} %)
                        </button>
                    </div>
                )}
                
                <div className="pt-2">
                    <button onClick={onClose} className="w-full py-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition">Stäng kalkylator</button>
                </div>
            </div>
        </Modal>
    );
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
  const [customActivity, setCustomActivity] = useState({ name: '', duration: '', distance: '', calories: '' });
  const [sessionStats, setSessionStats] = useState({ distance: '', calories: '', time: '', rounds: '' });
  const [activeSummaryFields, setActiveSummaryFields] = useState<string[]>([]);
  const [showSummaryMoreFields, setShowSummaryMoreFields] = useState(false);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [saveAsProgram, setSaveAsProgram] = useState(false);
  const [programName, setProgramName] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  
  const scanSource = source || route?.params?.source;
  const [inStudio, setInStudio] = useState<boolean | null>(scanSource === 'qr_scan' ? true : null);

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
  const [calculatorContext, setCalculatorContext] = useState<{ exerciseName?: string, current1RM?: number, onSelectWeight?: (w: number) => void } | null>(null);
  const [exerciseToEdit, setExerciseToEdit] = useState<BankExercise | null>(null);
  const [editExerciseName, setEditExerciseName] = useState("");
  const [exerciseToDelete, setExerciseToDelete] = useState<BankExercise | null>(null);
  
  const uncheckedSetsCount = useMemo(() => {
      if (isManualMode) return 0;
      return exerciseResults.reduce((acc, ex) => acc + ex.setDetails.filter(s => !s.completed).length, 0);
  }, [isManualMode, exerciseResults]);

  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({});
  const [logStep, setLogStep] = useState<'exercises' | 'summary'>('exercises');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
          errors.push("Du måste välja om du tränat på gymmet eller på annan plats.");
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
          const totalSets = exerciseResults.reduce((acc, ex) => acc + ex.setDetails.length, 0);
          if (totalSets === 0) {
              errors.push("Inga övningar har genomförts. Kontrollera att du lagt till set.");
          } else if (uncheckedSetsCount > 0) {
              errors.push(`Du har ${uncheckedSetsCount} set kvar att checka av innan du kan spara passet.`);
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
                            exercises.push(savedRes || {
                                exerciseId: ex.id,
                                exerciseName: ex.name,
                                setDetails: [...defaultSets],
                                blockId: block.id,
                                blockTitle: block.title,
                                trackingFields: ex.trackingFields,
                                groupId: ex.groupId,
                                groupColor: ex.groupColor
                            });
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
        customActivity,
        timestamp: Date.now()
    };

    localStorage.setItem(ACTIVE_LOG_STORAGE_KEY, JSON.stringify(sessionData));
  }, [exerciseResults, logData, sessionStats, customActivity, loading, isSubmitting, userId, wId, finalOrgId, isManualMode, workout]);

  const handleCancel = (isSuccess = false, diploma: WorkoutDiploma | null = null) => {
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
      let finalName = exerciseName.trim();
      
      if (!existingInBank && userId) {
          try {
              const savedEx = await addMemberCustomExercise(userId, finalName);
              setExerciseBank(prev => [...prev, savedEx].sort((a, b) => a.name.localeCompare(b.name, 'sv')));
              newExerciseId = savedEx.id;
          } catch (e) {
              console.error("Failed to add custom exercise", e);
          }
      } else if (existingInBank) {
          newExerciseId = existingInBank.id;
          finalName = existingInBank.name;
      }

      const newEx: LocalExerciseResult = {
          exerciseId: newExerciseId,
          exerciseName: finalName,
          blockId: 'manual-block',
          blockTitle: 'Valda övningar',
          trackingFields: ['weight', 'reps'],
          setDetails: [{ weight: '', reps: '', completed: false }]
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

  const handleStartWorkout = () => {
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
          
          const exerciseResultsToSave = exerciseResults.map(r => {
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

              return {
                  exerciseId: r.exerciseId,
                  exerciseName: r.exerciseName,
                  trackingFields: r.trackingFields,
                  setDetails: r.setDetails.map(s => ({
                      weight: parseFloat(s.weight) || null,
                      reps: s.reps || null,
                      time: s.time ? parseFloat(s.time) : null,
                      distance: s.distance ? parseFloat(s.distance) : null,
                      kcal: s.kcal ? parseFloat(s.kcal) : null
                  })),
                  weight: maxWeight, 
                  reps: repsSummary, 
                  sets: r.setDetails.length,
                  time: totalTime > 0 ? totalTime : null,
                  distance: totalDistance > 0 ? totalDistance : null,
                  kcal: totalKcal > 0 ? totalKcal : null,
                  blockId: r.blockId,
                  coachAdvice: r.coachAdvice,
                  note: r.note
              };
          });

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
              locationId: userData?.locationId,
          };

          finalLogRaw.durationMinutes = parseFloat(isQuickOrManual ? customActivity.duration : sessionStats.time) || 0;
          finalLogRaw.totalDistance = parseFloat(isQuickOrManual ? customActivity.distance : sessionStats.distance) || 0;
          finalLogRaw.totalCalories = parseInt(isQuickOrManual ? customActivity.calories : sessionStats.calories) || 0;
          
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
              exercises={exerciseResults.map(e => ({ id: e.exerciseId, name: e.exerciseName, exerciseName: e.exerciseName }))}
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
    <div className="bg-gray-5 dark:bg-black text-gray-900 dark:text-white flex flex-col relative h-full">
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

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-gray-5 dark:bg-black scrollbar-hide">
          <div className="p-2 sm:p-4 max-w-2xl mx-auto w-full">
              
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
                      className={`flex-1 p-3.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${logStep === 'exercises' ? 'bg-primary/15 text-primary border-primary/25 shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-150 dark:border-gray-800'}`}
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
                      className={`flex-1 p-3.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${logStep === 'summary' ? 'bg-primary/15 text-primary border-primary/25 shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-150 dark:border-gray-800'}`}
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
                                    <p className="text-gray-500 text-sm">Inga övningar i detta pass är markerade för specifik loggning. Du kan gå till nästa steg för att fylla i övriga resultat.</p>
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
                                                userId={currentUser?.uid}
                                                onUpdate={(updates) => handleUpdateResult(index, updates)}
                                                onRemove={() => setExerciseResults(prev => prev.filter((_, i) => i !== index))}
                                                lastPerformance={history[result.exerciseName]} 
                                                personalBest={personalBests[result.exerciseName.toLowerCase().trim()]}
                                                isLastInGroup={isLastInGroup}
                                                onAddGroupSet={() => handleAddGroupSet(result.groupId!)}
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
                                        headerBgClass = 'bg-amber-50/30 hover:bg-amber-100/40 dark:bg-amber-955/5 dark:hover:bg-amber-955/10 border-amber-200/40 dark:border-amber-900/30 shadow-sm';
                                        lineClass = 'bg-amber-500';
                                        statusTextClass = 'text-amber-600 dark:text-amber-400 font-bold';
                                    } else {
                                        headerBgClass = isExpanded
                                            ? 'bg-gray-100/75 hover:bg-gray-100 dark:bg-slate-900/90 dark:hover:bg-slate-900 border-gray-200/50 dark:border-gray-850/40 shadow-sm'
                                            : 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-slate-900/60 border-gray-150 dark:border-gray-800/40 shadow-sm';
                                        lineClass = 'bg-gray-300 dark:bg-gray-750';
                                        statusTextClass = 'text-gray-500 dark:text-gray-450';
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
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pr-1">
                                                    {isAllDone && (
                                                        <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                            Klar 🏆
                                                        </span>
                                                    )}
                                                    {isStarted && (
                                                        <span className="text-[10px] bg-amber-100 dark:bg-amber-955/45 text-amber-700 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
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
                                                                    const isSubExpanded = expandedSubGroups[subGroup.groupId] === true; // Standard-ihopfälld (false)
                                                                    const subGroupColorObj = getGroupColorStyles(subGroup.groupColor);
                                                                    
                                                                    const borderLeftClass = subGroupColorObj ? `border-l-4 ${subGroupColorObj.border}` : '';
                                                                    const headerBg = subGroupColorObj ? subGroupColorObj.lightBg : 'bg-gray-50 dark:bg-gray-800/40';
                                                                    const textColor = subGroupColorObj ? subGroupColorObj.text : 'text-gray-700 dark:text-gray-300';
                                                                    const textHover = subGroupColorObj ? 'hover:bg-opacity-80' : 'hover:bg-gray-100 dark:hover:bg-gray-800/60';
                                                                    
                                                                    // Beräkna antal färdiga set inom detta superset för en liten badge (t.ex. "3/6 klara")
                                                                    let subTotalSets = 0;
                                                                    let subCompletedSets = 0;
                                                                    subGroup.exercises.forEach(ex => {
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
                                                                                    setExpandedSubGroups(prev => ({
                                                                                        ...prev,
                                                                                        [subGroup.groupId!]: isNowExpanded
                                                                                    }));
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
                                                                                            const isLastInGroup = idxInsideSub === subGroup.exercises.length - 1;
                                                                                            
                                                                                            return (
                                                                                                <ExerciseLogCard
                                                                                                    key={result.exerciseId}
                                                                                                    name={result.exerciseName}
                                                                                                    result={result}
                                                                                                    onUpdate={(updates) => handleUpdateResult(originalIndex, updates)}
                                                                                                    lastPerformance={history[result.exerciseName]} 
                                                                                                    personalBest={personalBests[result.exerciseName.toLowerCase().trim()]}
                                                                                                    isLastInGroup={isLastInGroup}
                                                                                                    onAddGroupSet={() => handleAddGroupSet(result.groupId!)}
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
                                                                            onUpdate={(updates) => handleUpdateResult(originalIndex, updates)}
                                                                            lastPerformance={history[result.exerciseName]} 
                                                                            personalBest={personalBests[result.exerciseName.toLowerCase().trim()]}
                                                                            isLastInGroup={false}
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
                              className="w-full bg-primary hover:brightness-110 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-tight flex items-center justify-center gap-2"
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
                          const showRounds = activeSummaryFields.includes('rounds') || (sessionStats.rounds !== undefined && String(sessionStats.rounds).trim() !== '') || benchmarkDefinition?.type === 'reps';
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
                                                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary-light bg-gray-50/80 dark:bg-gray-800/80 hover:bg-primary/10 px-2.5 py-1 rounded-full transition-all border border-gray-150 dark:border-gray-700/60 active:scale-95"
                                              >
                                                  <PlusIcon className="w-3 h-3" />
                                                  <span>+ fler fält</span>
                                              </button>
                                          ) : (
                                              <div className="flex items-center gap-1.5 flex-wrap p-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-150 dark:border-gray-700/80 animate-fade-in">
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
                                      className={`py-4 px-3 rounded-2xl border-2 font-bold text-sm transition-all ${inStudio === true ? 'border-primary bg-primary/10 text-primary' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                  >
                                      {selectedOrganization?.name || 'På Gymmet'}
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => setInStudio(false)}
                                      className={`py-4 px-3 rounded-2xl border-2 font-bold text-sm transition-all ${inStudio === false ? 'border-primary bg-primary/10 text-primary' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
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
                                   <ul className="list-disc pl-5 space-y-1 text-xs font-bold text-red-650 dark:text-red-350">
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
                                  <span>Gå tillbaka</span>
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
