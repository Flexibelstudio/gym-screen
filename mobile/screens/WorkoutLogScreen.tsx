
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getMemberLogs, getWorkoutsForOrganization, saveWorkoutLog, uploadImage, updateWorkoutLog, deleteWorkoutLog } from '../../services/firebaseService';
import { generateMemberInsights, MemberInsightResponse, generateWorkoutDiploma, generateImage, getExerciseDagsformAdvice, ExerciseDagsformAdvice } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext'; 
import { useWorkout } from '../../context/WorkoutContext'; 
import { CloseIcon, SparklesIcon, FireIcon, InformationCircleIcon, LightningIcon, PlusIcon, TrashIcon, CheckIcon, ChartBarIcon, HistoryIcon } from '../../components/icons'; 
import { Modal } from '../../components/ui/Modal';
import { calculate1RM } from '../../utils/workoutUtils';
import { ExerciseResult, MemberFeeling, WorkoutDiploma, WorkoutLog, BenchmarkDefinition, BankExercise, Workout } from '../../types';
import { MOCK_EXERCISE_BANK } from '../../data/mockData';
import { saveCustomProgram, fetchCustomPrograms } from '../../services/firebaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { Confetti } from '../../components/WorkoutCompleteModal';
import { useStudio } from '../../context/StudioContext';
import { DailyFormInsightModal } from '../../components/DailyFormInsightModal';

// --- Local Storage Key ---
const ACTIVE_LOG_STORAGE_KEY = 'smart-skarm-active-log';

// --- Local Types for Form State ---

interface LocalSetDetail {
    weight: string;
    reps: string;
    time?: string;
    distance?: string;
    kcal?: string;
    completed: boolean;
}

interface LocalExerciseResult {
  exerciseId: string;
  exerciseName: string;
  setDetails: LocalSetDetail[];
  isBodyweight?: boolean;
  blockId: string;
  blockTitle: string;
  coachAdvice?: string;
  trackingFields?: ('time' | 'distance' | 'kcal' | 'reps' | 'weight')[];
  groupId?: string;
  groupColor?: string;
}

interface LogData {
  rpe: number | null;
  feeling: MemberFeeling | null;
  tags: string[];
  comment: string;
}

interface WorkoutData {
  id: string;
  title: string;
  benchmarkId?: string;
  blocks: {
      id: string;
      title: string;
      tag: string;
      exercises: { id: string; name: string; loggingEnabled?: boolean }[];
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
}> = ({ value, onChange, placeholder, className, compact }) => {
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
        <div className={`flex items-center ${compact ? '' : 'bg-gray-5 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 px-2'} focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all ${className}`}>
             <div className="flex-1 flex flex-col justify-center">
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={min}
                    onChange={(e) => update(e.target.value, sec)}
                    placeholder={placeholder || "0"}
                    className={`w-full bg-transparent font-black text-lg text-gray-900 dark:text-white focus:outline-none text-center appearance-none ${compact ? 'py-0' : 'p-4'}`}
                />
             </div>
             <span className={`text-gray-300 dark:text-gray-600 font-black ${compact ? 'text-lg pb-0' : 'text-2xl pb-1'}`}>:</span>
             <div className="flex-1 flex flex-col justify-center">
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={sec}
                    onChange={(e) => update(min, e.target.value)}
                    placeholder="00"
                    className={`w-full bg-transparent font-black text-lg text-gray-900 dark:text-white focus:outline-none text-center appearance-none ${compact ? 'py-0' : 'p-4'}`}
                />
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
    { name: "Fotbollar", singular: "en Fortboll", weight: 0.45, emoji: "⚽" },
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
    { name: "Noshörningar", singular: "en Noshörning", weight: 2000, emoji: "🛏️" },
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

const COMMON_ACTIVITIES = ["Funktionell Träning", "HIIT", "Löpning", "Promenad", "Workout", "Yoga", "Cykling", "Simning", "Racketsport", "Vardagsmotion"];
const KROPPSKANSLA_TAGS = ["Pigg", "Stark", "Seg", "Stel", "Ont", "Stressad", "Bra musik", "Bra pepp", "Grymt pass"];
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

// --- Mission Header Component (Koncept 2) ---
const MissionHeader: React.FC<{ strategy: string; feeling: 'good' | 'neutral' | 'bad' }> = ({ strategy, feeling }) => {
    let gradient = "from-indigo-500 to-purple-600";
    let icon = "⚡";
    let title = "Dagens Mission";

    if (feeling === 'good') {
        gradient = "from-orange-500 to-red-600";
        icon = "🔥";
        title = "Attack Mode";
    } else if (feeling === 'bad') {
        gradient = "from-teal-500 to-emerald-600";
        icon = "🛡️";
        title = "Smart & Stabilt";
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-5 text-white shadow-lg mb-6`}
        >
            <div className="relative z-10 flex items-start gap-4">
                <div className="text-3xl bg-white/20 rounded-xl p-2 h-12 w-12 flex items-center justify-center backdrop-blur-sm">
                    {icon}
                </div>
                <div>
                    <h3 className="font-black uppercase tracking-wider text-sm text-white/80 mb-1">{title}</h3>
                    <p className="font-bold text-lg leading-tight text-white">{strategy}</p>
                </div>
            </div>
            
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        </motion.div>
    );
};

// --- Pre-Game Strategy View ---

const PreGameView: React.FC<{
    workoutTitle: string;
    insights: MemberInsightResponse;
    onStart: () => void;
    onCancel: () => void;
    onFeelingChange: (feeling: 'good' | 'neutral' | 'bad') => void;
    currentFeeling: 'good' | 'neutral' | 'bad' | null;
}> = ({ workoutTitle, insights, onStart, onCancel, onFeelingChange, currentFeeling }) => {
    
    const activeContent = currentFeeling ? insights[currentFeeling] : null;
    const displayStrategy = activeContent?.strategy || activeContent?.readiness?.message || "Laddar strategi...";
    
    let themeClass = "from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800";
    
    if (currentFeeling === 'good') {
        themeClass = "from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20";
    } else if (currentFeeling === 'bad') {
        themeClass = "from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20";
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-hidden animate-fade-in">
            {/* Background Gradient */}
            <div className={`absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b ${themeClass} to-transparent z-0 transition-colors duration-500 pointer-events-none`}></div>
            
            {/* Scrollable Content Area */}
            <div className="relative z-10 flex-1 overflow-y-auto p-6 scrollbar-hide">
                <div className="flex justify-between items-start mb-6">
                    <button onClick={onCancel} className="text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white font-bold text-sm uppercase tracking-widest px-2 py-1 transition-colors">Avbryt</button>
                </div>
                
                <div className="text-center mb-8">
                    <span className="inline-block py-1 px-3 rounded-full bg-primary/10 dark:bg-white/10 border border-primary/20 dark:border-white/20 text-xs font-bold uppercase tracking-widest text-primary mb-4">Pre-Game Strategy</span>
                    <h1 className="text-3xl font-black leading-tight mb-2 text-gray-900 dark:text-white">{workoutTitle}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Din personliga plan för dagens pass</p>
                </div>
                
                <div className="mb-8">
                    <p className="text-center text-xs font-bold uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider">Hur känns kroppen?</p>
                    <div className="flex gap-3 justify-center">
                        {['good', 'neutral', 'bad'].map((f) => (
                            <button 
                                key={f} 
                                onClick={() => onFeelingChange(f as any)} 
                                className={`p-4 rounded-2xl border-2 transition-all ${currentFeeling === f ? 'bg-white dark:bg-gray-800 border-primary scale-110 shadow-lg z-10' : 'bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800'}`}
                            >
                                <span className="text-2xl block">{f === 'good' ? '🔥' : f === 'bad' ? '🤕' : '🙂'}</span>
                            </button>
                        ))}
                    </div>
                    {!currentFeeling && (
                        <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-4 animate-pulse">Klicka på en emoji för att få din strategi</p>
                    )}
                </div>

                {currentFeeling && (
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-100 dark:border-gray-700 rounded-3xl p-6 shadow-xl mb-6 transition-all animate-fade-in">
                        <div className="flex items-start gap-4 mb-6">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-lg ${currentFeeling === 'good' ? 'from-orange-500 to-red-600' : currentFeeling === 'bad' ? 'from-green-500 to-blue-600' : 'from-indigo-500 to-purple-600'}`}>
                                <SparklesIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">Dagens Fokus</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium italic">"{displayStrategy}"</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            {activeContent?.suggestions && Object.keys(activeContent.suggestions).length > 0 && (
                                <div className={`p-4 rounded-2xl border ${currentFeeling === 'good' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30' : 'bg-gray-50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-700'}`}>
                                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${currentFeeling === 'good' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                        {currentFeeling === 'good' && <FireIcon className="w-4 h-4" />}
                                        Smart Load (Dina resultatmål)
                                    </h4>
                                    <div className="space-y-2">
                                        {Object.entries(activeContent.suggestions).slice(0, 3).map(([exercise, suggestion]) => (
                                            <div key={exercise} className="flex justify-between items-center bg-white dark:bg-black/20 p-2.5 rounded-lg border border-gray-100 dark:border-white/5">
                                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{exercise}</span>
                                                <span className={`text-sm font-bold ${currentFeeling === 'good' ? 'text-orange-600 dark:text-orange-400' : 'text-primary'}`}>{suggestion}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {activeContent?.scaling && Object.keys(activeContent.scaling).length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <LightningIcon className="w-3 h-3" /> Alternativ / Skalning
                                    </h4>
                                    <div className="space-y-2">
                                        {Object.entries(activeContent.scaling).map(([exercise, alternative]) => (
                                            <div key={exercise} className="bg-white/50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                                <div className="text-xs text-gray-500 line-through mb-0.5">{exercise}</div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">👉 {alternative}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- START BUTTON IN SCROLL FLOW --- */}
                <div className="mt-8 pb-12">
                    <button onClick={onStart} className="w-full bg-primary hover:brightness-110 text-white font-black text-lg py-5 rounded-2xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 flex items-center justify-center gap-2">
                        <span className="tracking-tight uppercase">Starta passet</span>
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

const ExerciseLogCard: React.FC<{
  name: string;
  result: LocalExerciseResult;
  onUpdate: (updates: Partial<LocalExerciseResult>) => void;
  onRemove?: () => void;
  aiSuggestion?: string; // Koncept 1: Coach Whisper
  scaling?: string;      // Koncept 1: Alternativ
  lastPerformance?: { weight: number, reps: string } | null;
  isLastInGroup?: boolean;
  onAddGroupSet?: () => void;
}> = ({ name, result, onUpdate, onRemove, aiSuggestion, scaling, lastPerformance, isLastInGroup, onAddGroupSet }) => {
    
    const trackingFields = result.trackingFields || ['reps', 'weight'];
    const showReps = trackingFields.includes('reps');
    const showWeight = trackingFields.includes('weight');
    const showTime = trackingFields.includes('time');
    const showDistance = trackingFields.includes('distance');
    const showKcal = trackingFields.includes('kcal');

    const dynamicColsCount = [showReps, showWeight, showTime, showDistance, showKcal].filter(Boolean).length;
    const gridColsClass = `grid-cols-[30px_repeat(${dynamicColsCount},_1fr)_40px_40px]`;

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

    const [showTip, setShowTip] = useState(false);
    const [isEditingFields, setIsEditingFields] = useState(false);

    const toggleField = (field: 'reps' | 'weight' | 'time' | 'distance' | 'kcal') => {
        const current = [...trackingFields];
        const has = current.includes(field);
        if (has) {
            onUpdate({ trackingFields: current.filter(f => f !== field) });
        } else {
            onUpdate({ trackingFields: [...current, field] });
        }
    };

    return (
        <div className={`bg-white dark:bg-gray-900 rounded-2xl p-4 mb-3 border shadow-sm transition-all ${result.groupColor ? `border-l-4 ${borderColorClass} border-y-gray-100 border-r-gray-100 dark:border-y-gray-800 dark:border-r-gray-800` : 'border-gray-100 dark:border-gray-800'}`}>
            <div className="flex flex-col gap-2 mb-4">
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white text-base truncate">{name}</h4>
                        {lastPerformance ? (
                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                                Senast: <span className="text-gray-600 dark:text-gray-300">{lastPerformance.reps} x {lastPerformance.weight}kg</span>
                            </p>
                        ) : (
                            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mt-0.5">
                               Ingen historik
                            </p>
                        )}
                    </div>
                    {/* Gear / Edit / Delete buttons */}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsEditingFields(!isEditingFields)}
                            className={`p-2 rounded-xl transition-colors ${isEditingFields ? 'bg-primary/10 text-primary' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        {onRemove && (
                            <button 
                                onClick={onRemove}
                                className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>
                        )}
                    </div>
                </div>

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

                {/* Koncept 1: Coach Whisper & Scaling */}
                {(aiSuggestion || scaling) && (
                    <div className="flex flex-col gap-2">
                        {scaling && (
                            <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-lg border border-yellow-100 dark:border-yellow-800/30">
                                <LightningIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium leading-tight">
                                    <span className="font-bold">Alternativ:</span> {scaling}
                                </p>
                            </div>
                        )}
                        
                        {aiSuggestion && (
                            <div className="relative">
                                <button 
                                    onClick={() => setShowTip(!showTip)}
                                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors w-full sm:w-auto"
                                >
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                    <span>{showTip ? 'Dölj coachtips' : 'Visa coachtips'}</span>
                                </button>
                                <AnimatePresence>
                                    {showTip && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-2 bg-white dark:bg-black/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30 text-xs text-gray-700 dark:text-gray-300 italic shadow-sm">
                                                "{aiSuggestion}"
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <div className={`grid ${gridColsClass} gap-2 px-1 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider`}>
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
                        const oneRm = (showWeight && showReps) ? calculate1RM(set.weight, set.reps) : null;
                        return (
                            <div key={index} className={`grid ${gridColsClass} gap-2 items-center transition-all ${set.completed ? 'opacity-50' : 'opacity-100'}`}>
                                <div className="flex justify-center items-center">
                                    <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center transition-colors ${set.completed ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{index + 1}</span>
                                </div>
                                
                                {showReps && (
                                    <div className="bg-gray-5 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                        <input type="text" inputMode="numeric" value={set.reps} onChange={(e) => handleSetChange(index, 'reps', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center" disabled={set.completed} />
                                    </div>
                                )}
                                
                                {showWeight && (
                                    <div className="relative">
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                            <input type="number" value={set.weight} onChange={(e) => handleSetChange(index, 'weight', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center" disabled={set.completed} />
                                        </div>
                                        {oneRm && !set.completed && (
                                            <motion.div 
                                                initial={{ scale: 0.8, opacity: 0, y: 5 }}
                                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                                exit={{ scale: 0.8, opacity: 0 }}
                                                className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xl border border-gray-700 whitespace-nowrap z-20 pointer-events-none"
                                            >
                                                🔥 1RM: <span className="text-yellow-400">{oneRm}</span>
                                            </motion.div>
                                        )}
                                    </div>
                                )}

                                {showTime && (
                                    <div className="bg-gray-5 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                        <input type="number" value={set.time || ''} onChange={(e) => handleSetChange(index, 'time', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center" disabled={set.completed} />
                                    </div>
                                )}

                                {showDistance && (
                                    <div className="bg-gray-5 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                        <input type="number" value={set.distance || ''} onChange={(e) => handleSetChange(index, 'distance', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center" disabled={set.completed} />
                                    </div>
                                )}

                                {showKcal && (
                                    <div className="bg-gray-5 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                        <input type="number" value={set.kcal || ''} onChange={(e) => handleSetChange(index, 'kcal', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center" disabled={set.completed} />
                                    </div>
                                )}

                                <div className="flex justify-center">
                                    {result.setDetails.length > 1 && (
                                        <button onClick={() => handleRemoveSet(index)} className="text-gray-300 hover:text-red-500 transition-colors p-2" disabled={set.completed}><CloseIcon className="w-5 h-5" /></button>
                                    )}
                                </div>
                                <div className="flex justify-center">
                                    <button 
                                        onClick={() => handleToggleComplete(index)} 
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm transform active:scale-90 ${set.completed ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        {set.completed ? <CheckIcon className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full border border-current opacity-30" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {(!result.groupId) && (
                        <button onClick={handleAddSet} className="w-full mt-2 py-2 flex items-center justify-center gap-1 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors border border-primary/20 border-dashed"><PlusIcon className="w-3 h-3" /> Lägg till set</button>
                    )}
                    {(result.groupId && isLastInGroup && onAddGroupSet) && (
                        <button 
                            onClick={onAddGroupSet} 
                            className={`w-full mt-2 py-2 flex items-center justify-center gap-1 text-xs font-bold rounded-lg transition-colors border border-dashed ${textColorClass} ${lightBorderClass} ${lightBgClass}`}
                        >
                            <PlusIcon className="w-3 h-3" /> Lägg till set för gruppen
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const CustomActivityForm: React.FC<{
  activityName: string; duration: string; distance: string; calories: string; onUpdate: (field: string, value: string) => void; isQuickMode?: boolean; hasExercises?: boolean;
}> = ({ activityName, duration, distance, calories, onUpdate, isQuickMode, hasExercises }) => {
    const [isExpanded, setIsExpanded] = useState(!hasExercises);

    useEffect(() => {
        setIsExpanded(!hasExercises);
    }, [hasExercises]);

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
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                )}
                
                {!isQuickMode && (
                    <>
                        <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-4">Vanliga aktiviteter</h3>
                        <div className="flex flex-wrap gap-2">
                            {COMMON_ACTIVITIES.map(act => (
                                <button key={act} onClick={() => onUpdate('name', act)} className={`px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${activityName === act ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-5 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{act}</button>
                            ))}
                        </div>
                    </>
                )}
                <div className={`mt-4 space-y-5 ${isQuickMode ? 'mt-0' : 'mt-8'}`}>
                    <div>
                        <label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Aktivitet {!hasExercises && '*'}</label>
                        <input value={activityName} onChange={(e) => onUpdate('name', e.target.value)} placeholder={hasExercises ? "T.ex. Funktionellt (Frivilligt)" : "T.ex. Powerwalk"} disabled={isQuickMode} className={`w-full text-xl font-black text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 ${isQuickMode ? 'opacity-70' : ''}`} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Tid (min:sek) {!hasExercises && '*'}</label>
                        <TimeInput value={duration} onChange={(val) => onUpdate('duration', val)} placeholder="60" className="w-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Kcal</label><input type="number" value={calories} onChange={(e) => onUpdate('calories', e.target.value)} placeholder="T.ex. 350" className="w-full font-black text-lg text-gray-900 dark:text-white focus:outline-none bg-gray-5 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700" /></div>
                        <div><label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Distans (km)</label><input type="number" value={distance} onChange={(e) => onUpdate('distance', e.target.value)} placeholder="T.ex. 5.3" className="w-full font-black text-lg text-gray-900 dark:text-white focus:outline-none bg-gray-5 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700" /></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PostWorkoutForm: React.FC<{ data: LogData; onUpdate: (updates: Partial<LogData>) => void; }> = ({ data, onUpdate }) => {
    const [showRpeInfo, setShowRpeInfo] = useState(false);
    const toggleTag = (tag: string) => onUpdate({ tags: data.tags.includes(tag) ? data.tags.filter(t => t !== tag) : [...data.tags, tag] });
    const getRpeColor = (num: number) => num <= 4 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : num <= 7 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    return (
        <div className="mt-8 space-y-8 animate-fade-in">
            <div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-6">Hur kändes passet?</h4>
                <div className="space-y-4">
                    <div className="flex items-center gap-2"><h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">Ansträngning (RPE 1-10)</h5><button onClick={() => setShowRpeInfo(true)} className="p-1 -m-1 text-gray-300 hover:text-primary transition-colors"><InformationCircleIcon className="w-4 h-4" /></button></div>
                    <div className="flex justify-between gap-1 sm:gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <button key={num} onClick={() => onUpdate({ rpe: num })} className={`flex-1 h-12 rounded-xl flex items-center justify-center font-black text-sm transition-all ${data.rpe === num ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30 z-10' : `${getRpeColor(num)} opacity-60 hover:opacity-100`}`}>{num}</button>
                        ))}
                    </div>
                </div>
                <div className="mt-10"><h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Kroppskänsla</h5><div className="flex flex-wrap gap-2">
                    {KROPPSKANSLA_TAGS.map(tag => (<button key={tag} onClick={() => toggleTag(tag)} className={`px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${data.tags.includes(tag) ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-700'}`}>{tag}</button>))}
                </div></div>
                <div className="mt-10"><h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">Kommentar</h5><textarea value={data.comment} onChange={(e) => onUpdate({ comment: e.target.value })} placeholder="Anteckningar..." rows={4} className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[1.5rem] p-5 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner" /></div>
            </div>
            <Modal isOpen={showRpeInfo} onClose={() => setShowRpeInfo(false)} title="Vad är RPE?" size="sm"><div className="space-y-6"><p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">RPE (Rate of Perceived Exertion) är en skala mellan 1-10 som hjälper dig att skatta din ansträngning.</p><div className="space-y-2">
                {RPE_LEVELS.map(level => (<div key={level.range} className="flex gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800"><div className={`w-12 h-12 rounded-xl ${level.color} flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm`}>{level.range}</div><div><h6 className="font-bold text-gray-900 dark:text-white text-sm">{level.label}</h6><p className="text-xs text-gray-500 dark:text-gray-400">{level.desc}</p></div></div>))}
            </div><button onClick={() => setShowRpeInfo(false)} className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-4 rounded-xl mt-4">Jag förstår</button></div></Modal>
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

export const WorkoutLogScreen = ({ workoutId, organizationId, onClose, navigation, route, workouts: contextWorkouts = [] }: any) => {
  const { currentUser } = useAuth();
  const { selectedOrganization } = useStudio();
  const userId = currentUser?.uid || "offline_member_uid"; 
  const passedWId = workoutId || route?.params?.workoutId;
  const isManualMode = passedWId === 'MANUAL_ENTRY';
  const wId = isManualMode ? undefined : passedWId;
  const oId = organizationId || route?.params?.organizationId;

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [exerciseResults, setExerciseResults] = useState<LocalExerciseResult[]>([]);
  const [logData, setLogData] = useState<LogData>({ rpe: null, feeling: null, tags: [], comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [viewMode, setViewMode] = useState<'pre-game' | 'logging'>(isManualMode ? 'logging' : 'pre-game');
  const [dailyFeeling, setDailyFeeling] = useState<'good' | 'neutral' | 'bad' | null>(null);
  const [customActivity, setCustomActivity] = useState({ name: '', duration: '', distance: '', calories: '' });
  const [sessionStats, setSessionStats] = useState({ distance: '', calories: '', time: '', rounds: '' });
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [saveAsProgram, setSaveAsProgram] = useState(false);
  const [programName, setProgramName] = useState('');

  const [history, setHistory] = useState<Record<string, { weight: number, reps: string }>>({}); 
  const [aiInsights, setAiInsights] = useState<MemberInsightResponse | null>(null);
  
  const uncheckedSetsCount = useMemo(() => {
      if (isManualMode) return 0;
      return exerciseResults.reduce((acc, ex) => acc + ex.setDetails.filter(s => !s.completed).length, 0);
  }, [isManualMode, exerciseResults]);

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

  const isFormValid = useMemo(() => {
      if (isSubmitting) return false;
      if (isManualMode) {
          if (saveAsProgram && programName.trim().length === 0) return false;
          if (exerciseResults.length > 0) return true;
          return customActivity.name.trim() !== '' && customActivity.duration.trim() !== '';
      }

      if (benchmarkDefinition) {
          if (benchmarkDefinition.type === 'time' && !sessionStats.time) return false;
          if (benchmarkDefinition.type === 'reps' && !sessionStats.rounds) return false;
      }

      const totalSets = exerciseResults.reduce((acc, ex) => acc + ex.setDetails.length, 0);
      return totalSets > 0 && uncheckedSetsCount === 0;
  }, [isSubmitting, isManualMode, customActivity, exerciseResults, uncheckedSetsCount, benchmarkDefinition, sessionStats, saveAsProgram, programName]);
  
  // --- WAKE LOCK LOGIC ---
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active!');
      }
    } catch (err: any) {
      console.error(`Wake Lock error: ${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake Lock released manually');
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
    if (!oId) { setLoading(false); return; }
    if (isManualMode) { setLoading(false); return; }
    if (!wId) { setLoading(false); return; }
    if (workout?.id === wId) return; // Already initialized for this workout

    const init = async () => {
        // Reset state for new workout
        setAiInsights(null);
        setViewMode('pre-game');
        setDailyFeeling(null);
        
        try {
            const orgWorkouts = await getWorkoutsForOrganization(oId);
            let foundWorkout = orgWorkouts.find(w => w.id === wId);
            
            if (!foundWorkout) {
                 foundWorkout = contextWorkouts.find((w: any) => w.id === wId);
            }

            if (!foundWorkout && wId.startsWith('custom-')) {
                 const customPrograms = await fetchCustomPrograms(userId);
                 foundWorkout = customPrograms.find(w => w.id === wId);
            }
            
            if (foundWorkout) {
                setWorkout(foundWorkout as unknown as WorkoutData);

                // Check for saved session in localStorage
                const savedSessionRaw = localStorage.getItem(ACTIVE_LOG_STORAGE_KEY);
                let loadedResults: LocalExerciseResult[] | null = null;
                let loadedLogData: LogData | null = null;
                let loadedSessionStats: any = null;
                let loadedCustomActivity: any = null;
                let skipInsights = false;

                if (savedSessionRaw) {
                    const saved = JSON.parse(savedSessionRaw);
                    if (saved.workoutId === wId && saved.memberId === userId) {
                        loadedResults = saved.exerciseResults;
                        loadedLogData = saved.logData;
                        loadedSessionStats = saved.sessionStats;
                        loadedCustomActivity = saved.customActivity;
                        setViewMode('logging');
                        skipInsights = true;
                    }
                }

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
                
                setExerciseResults(exercises);
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

                const logs = await getMemberLogs(userId);
                setAllLogs(logs);
                const historyMap: Record<string, { weight: number, reps: string }> = {};
                
                exercises.forEach(currentEx => {
                    const match = logs.find(log => log.exerciseResults?.some(logEx => isExerciseMatch(currentEx.exerciseName, currentEx.exerciseId, logEx.exerciseName, logEx.exerciseId)));
                    
                    if (match) {
                        const exMatch = match.exerciseResults?.find(logEx => isExerciseMatch(currentEx.exerciseName, currentEx.exerciseId, logEx.exerciseName, logEx.exerciseId));
                        if (exMatch && exMatch.weight) {
                            let reps = '0';
                            if (exMatch.reps) {
                                reps = exMatch.reps.toString();
                            }
                            historyMap[currentEx.exerciseName] = { weight: exMatch.weight, reps };
                        }
                    }
                });
                
                setHistory(historyMap);

                if (!skipInsights) {
                    try {
                        const exerciseNames = exercises.map(e => e.exerciseName);
                        if (exerciseNames.length > 0) {
                            // Fetch complete insights immediately (good/neutral/bad)
                            const insights = await generateMemberInsights(logs, foundWorkout.title, exerciseNames, foundWorkout.aiProgressionPrompt, historyMap);
                            setAiInsights(insights);
                        } else {
                            setViewMode('logging');
                        }
                    } catch (err) { 
                        console.log("AI Insight Error", err); 
                        setViewMode('logging');
                    }
                }
            }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };
    
    init();
  }, [wId, oId, userId, isManualMode, contextWorkouts]);

  const handleFeelingChange = (feeling: 'good' | 'neutral' | 'bad') => {
      setDailyFeeling(feeling);
      // No async call here anymore. Content switches instantly in PreGameView.
  };

  // --- AUTO-SAVE LOGIC ---
  useEffect(() => {
    if (loading || isSubmitting || !userId || (!wId && !isManualMode)) return;

    const sessionData = {
        workoutId: wId || 'manual',
        workoutTitle: workout?.title || 'Träningspass',
        organizationId: oId,
        memberId: userId,
        exerciseResults,
        logData,
        sessionStats,
        customActivity,
        timestamp: Date.now()
    };

    localStorage.setItem(ACTIVE_LOG_STORAGE_KEY, JSON.stringify(sessionData));
  }, [exerciseResults, logData, sessionStats, customActivity, loading, isSubmitting, userId, wId, oId, isManualMode, workout]);

  const handleCancel = (isSuccess = false, diploma: WorkoutDiploma | null = null) => {
    if (isSuccess) {
        localStorage.removeItem(ACTIVE_LOG_STORAGE_KEY);
    }
    if (onClose) onClose(isSuccess, diploma as any);
    else if (navigation) navigation.goBack();
  };

  const handleAddManualExercise = (exerciseName: string) => {
      if (!exerciseName.trim()) return;
      const newEx: LocalExerciseResult = {
          exerciseId: 'manual-' + Date.now(),
          exerciseName: exerciseName.trim(),
          blockId: 'manual-block',
          blockTitle: 'Valda övningar',
          trackingFields: ['weight', 'reps'],
          setDetails: [{ weight: '', reps: '', completed: false }]
      };
      setExerciseResults(prev => [...prev, newEx]);
      setShowExerciseSearch(false);
      setExerciseSearchTerm('');
  };

  const filteredBank = MOCK_EXERCISE_BANK.filter(ex => ex.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()));

  const handleCustomActivityUpdate = (field: string, value: string) => {
    setCustomActivity(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdateResult = (index: number, updates: Partial<LocalExerciseResult>) => {
    setExerciseResults(prev => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
    });
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
      if (!isFormValid || !oId) return;

      setIsSubmitting(true);
      setSaveStatus('Registrerar passet...');
      
      try {
          const isQuickOrManual = isManualMode;
          
          const now = new Date();
          const selectedDate = new Date(logDate);
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
                  coachAdvice: r.coachAdvice
              };
          });

          const finalLogRaw: any = {
              memberId: userId,
              organizationId: oId,
              workoutId: isManualMode ? 'manual' : (wId || 'unknown'),
              workoutTitle: isQuickOrManual ? (customActivity.name || 'Eget Pass') : (workout?.title || 'Träningspass'),
              date: logDateMs,
              source: isManualMode ? 'manual' : 'qr_scan',
              rpe: logData.rpe,
              feeling: logData.feeling,
              tags: logData.tags || [],
              comment: logData.comment || '',
              exerciseResults: exerciseResultsToSave,
              benchmarkId: benchmarkDefinition?.id,
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
                      organizationId: oId, // Fallback if needed, but handled by read rules
                      blocks: [{
                          id: 'manual-block',
                          title: 'Valda övningar',
                          tag: 'Custom',
                          followMe: false,
                          settings: { rounds: 1, mode: "Stoppur" as any },
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
                              footer: `En ${comparison.single} väger ca ${comparison.weight} kg`,
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
                          footer: `En ${comparison.single} väger ca ${comparison.weight} kg`,
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

              if (diplomaData && diplomaData.imagePrompt) {
                  setSaveStatus('Genererar medaljbild...');
                  try {
                      const base64Image = await generateImage(diplomaData.imagePrompt);
                      if (base64Image) {
                          setSaveStatus('Färdigställer diplom...');
                          const storagePath = `users/${userId}/diplomas/log_${Date.now()}.jpg`;
                          diplomaData.imageUrl = await uploadImage(storagePath, base64Image);
                      }
                  } catch (e) { console.warn(e); }
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

  if (viewMode === 'pre-game' && aiInsights) {
      return (
          <PreGameView 
              workoutTitle={workout?.title || 'Träningspass'}
              insights={aiInsights}
              onStart={handleStartWorkout}
              onCancel={() => handleCancel(false)}
              onFeelingChange={handleFeelingChange}
              currentFeeling={dailyFeeling}
          />
      );
  }

  // --- KONCEPT 2: MISSION BANNER (Sticky Header) ---
  const activeInsight = dailyFeeling ? aiInsights?.[dailyFeeling] : undefined;
  const missionTitle = dailyFeeling === 'good' ? 'Attack Mode' : dailyFeeling === 'bad' ? 'Rehab Mode' : 'Maintenance Mode';

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

      <div className="bg-white dark:bg-gray-900 p-6 px-8 flex-shrink-0 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shadow-sm z-10">
        <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight truncate">
                    {isManualMode ? 'Logga Aktivitet' : workout?.title}
                </h1>
                <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md">BETA</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Registrera dina resultat</p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => handleCancel(false)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex-shrink-0 shadow-sm active:scale-90" disabled={isSubmitting}>
                <CloseIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-5 dark:bg-black scrollbar-hide">
          <div className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
              
              <div className="mb-6">
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

              {/* MISSION BANNER (KONCEPT 2) */}
              {!isManualMode && activeInsight && dailyFeeling && (
                  <MissionHeader 
                      strategy={activeInsight.strategy || activeInsight.readiness.message} 
                      feeling={dailyFeeling} 
                  />
              )}
              
              {isManualMode && (
                  <CustomActivityForm 
                      activityName={customActivity.name}
                      duration={customActivity.duration}
                      distance={customActivity.distance}
                      calories={customActivity.calories}
                      onUpdate={handleCustomActivityUpdate}
                      isQuickMode={false}
                      hasExercises={exerciseResults.length > 0}
                  />
              )}

              {isManualMode && (
                  <div className="mt-8 mb-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                          <h3 className="text-base font-black uppercase tracking-widest text-gray-800 dark:text-gray-200">
                              {exerciseResults.length > 0 ? 'Dina övningar' : 'Valfria övningar'}
                          </h3>
                          <button 
                              onClick={() => setShowExerciseSearch(true)}
                              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-primary rounded-full text-xs font-bold flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition uppercase tracking-wider"
                          >
                              <PlusIcon className="w-4 h-4" />
                              Lägg till övning
                          </button>
                      </div>
                  </div>
              )}

              {(!isManualMode || exerciseResults.length > 0) && (
                  <>
                    {!isManualMode && exerciseResults.length === 0 && (
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 text-center mb-8">
                            <p className="text-gray-500 text-sm">Inga övningar i detta pass är markerade för specifik loggning. Du kan fortfarande ange distans, kcal och skriva en kommentar nedan.</p>
                        </div>
                    )}
                    
                    {exerciseResults.map((result, index) => {
                        const isNewBlock = index === 0 || result.blockId !== exerciseResults[index - 1].blockId;
                        const isLastInGroup = result.groupId && (index === exerciseResults.length - 1 || exerciseResults[index + 1].groupId !== result.groupId);

                        return (
                            <React.Fragment key={result.exerciseId}>
                                {isNewBlock && !isManualMode && (
                                    <div className="mt-8 mb-4 flex items-center gap-3">
                                        <div className="h-5 w-1.5 bg-primary rounded-full shadow-sm"></div>
                                        <h3 className="text-base font-black uppercase tracking-widest text-gray-800 dark:text-gray-200">
                                            {result.blockTitle}
                                        </h3>
                                    </div>
                                )}
                                <ExerciseLogCard
                                    name={result.exerciseName}
                                    result={result}
                                    onUpdate={(updates) => handleUpdateResult(index, updates)}
                                    onRemove={isManualMode ? () => setExerciseResults(prev => prev.filter((_, i) => i !== index)) : undefined}
                                    aiSuggestion={activeInsight?.suggestions?.[result.exerciseName]} 
                                    scaling={activeInsight?.scaling?.[result.exerciseName]} 
                                    lastPerformance={history[result.exerciseName]} 
                                    isLastInGroup={isLastInGroup}
                                    onAddGroupSet={() => handleAddGroupSet(result.groupId!)}
                                />
                            </React.Fragment>
                        );
                    })}

                    {!isManualMode && (
                        <div className="mt-8 mb-6 bg-white dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                            <div className="grid grid-cols-2 gap-4">
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
                            </div>
                        </div>
                    )}
                  </>
              )}

              {isManualMode && exerciseResults.length > 0 && (
                  <div className="mt-6 p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-4">
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
                          <div className="animate-fade-in">
                              <input 
                                  type="text"
                                  value={programName}
                                  onChange={(e) => setProgramName(e.target.value)}
                                  placeholder="T.ex. Axlar & Rygg"
                                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium placeholder-gray-400"
                              />
                          </div>
                      )}
                  </div>
              )}

              <PostWorkoutForm 
                data={logData} 
                onUpdate={u => setLogData(prev => ({ ...prev, ...u }))} 
              />

              <div className="mt-12 space-y-4 pb-12">
                  {!isFormValid && !isManualMode && uncheckedSetsCount > 0 && (
                      <div className="text-center animate-fade-in">
                          <p className="text-orange-600 dark:text-orange-400 text-xs font-black uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                              <InformationCircleIcon className="w-3.5 h-3.5" /> {uncheckedSetsCount} set kvar att checka av
                          </p>
                      </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                          onClick={() => handleCancel(false)}
                          disabled={isSubmitting}
                          className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 font-black py-5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm disabled:opacity-50"
                      >
                          Avbryt
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
                                      <span className="text-[10px] font-black uppercase tracking-widest text-primary px-2 py-0.5 bg-primary/10 rounded">
                                          {ex.muscleGroup}
                                      </span>
                                  </div>
                              </div>
                              <PlusIcon className="w-5 h-5 text-gray-400" />
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
    </div>
  );
}
