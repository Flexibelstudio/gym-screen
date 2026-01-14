import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getMemberLogs, getWorkoutsForOrganization, saveWorkoutLog, uploadImage } from '../../services/firebaseService';
import { generateMemberInsights, MemberInsightResponse, generateWorkoutDiploma, generateImage } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext'; 
import { useWorkout } from '../../context/WorkoutContext'; 
import { CloseIcon, DumbbellIcon, SparklesIcon, FireIcon, RunningIcon, InformationCircleIcon, LightningIcon, PlusIcon, TrashIcon, CheckIcon, CalculatorIcon } from '../../components/icons'; 
import { Modal } from '../../components/ui/Modal';
import { OneRepMaxModal } from '../../components/OneRepMaxModal';
import { WorkoutLogType, RepRange, ExerciseResult, MemberFeeling, WorkoutDiploma, WorkoutLog, ExerciseSetDetail } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Confetti } from '../../components/WorkoutCompleteModal';
import { DailyFormInsightModal } from '../../components/DailyFormInsightModal';

// --- Local Types for Form State ---

interface LocalSetDetail {
    weight: string;
    reps: string;
    completed: boolean;
}

interface LocalExerciseResult {
  exerciseId: string;
  exerciseName: string;
  setDetails: LocalSetDetail[];
  distance?: string;
  kcal?: string;
  isBodyweight?: boolean;
  blockId: string;
  blockTitle: string;
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
  logType?: WorkoutLogType;
  blocks: {
      id: string;
      title: string;
      tag: string;
      exercises: { id: string; name: string; loggingEnabled?: boolean }[];
      settings: { rounds: number; mode: string };
  }[];
}

// --- FUN COMPARISON DATA ---
const WEIGHT_COMPARISONS = [
    { name: "Hamstrar", singular: "en Hamster", weight: 0.15, emoji: "🐹" },
    { name: "Fotbollar", singular: "en Fortboll", weight: 0.45, emoji: "⚽" },
    { name: "Paket Smör", singular: "ett Paket Smör", weight: 0.5, emoji: "🧈" },
    { name: "iPads", singular: "en iPad", weight: 0.5, emoji: "📱" },
    { name: "Ananasar", singular: "en Ananas", weight: 1, emoji: "🍍" },
    { name: "Chihuahuas", singular: "en Chihuahua", weight: 2, emoji: "🐕" },
    { name: "Tegelstenar", singular: "en Tegelsten", weight: 3, emoji: "🧱" },
    { name: "Katter", singular: "en Katt", weight: 5, emoji: "🐈" },
    { name: "Bowlingklot", singular: "ett Bowlingklot", weight: 7, emoji: "🎳" },
    { name: "Bildäck", singular: "ett Bildäck", weight: 10, emoji: "🛞" },
    { name: "Vattenmeloner", singular: "en Vattenmelon", weight: 12, emoji: "🍉" },
    { name: "Corgis", singular: "en Corgi", weight: 12, emoji: "🐶" },
    { name: "Mikrovågsugnar", singular: "en Mikrovågsugn", weight: 15, emoji: "📟" },
    { name: "Cyklar", singular: "en Cykel", weight: 15, emoji: "🚲" },
    { name: "Säckar Cement", singular: "en Säck Cement", weight: 25, emoji: "🏗️" },
    { name: "Golden Retrievers", singular: "en Golden Retriever", weight: 30, emoji: "🦮" },
    { name: "Toalettstolar", singular: "en Toalettstol", weight: 40, emoji: "🚽" },
    { name: "Diskmaskiner", singular: "en Diskmaskin", weight: 50, emoji: "🍽️" },
    { name: "Vargar", singular: "en Varg", weight: 50, emoji: "🐺" },
    { name: "Ölkaggar", singular: "en Ölkagge", weight: 60, emoji: "🍺" },
    { name: "Tvättmaskiner", singular: "en Tvättmaskin", weight: 80, emoji: "🧺" },
    { name: "Vuxna Män", singular: "en Genomsnittlig Man", weight: 80, emoji: "👨" },
    { name: "Vuxna Kvinnor", singular: "en Genomsnittlig Kvinna", weight: 65, emoji: "👩" },
    { name: "Kängurus", singular: "en Känguru", weight: 90, emoji: "🦘" },
    { name: "Vespor", singular: "en Vespa", weight: 110, emoji: "🛵" },
    { name: "Pandor", singular: "en Panda", weight: 120, emoji: "🐼" },
    { name: "Kylskåp", singular: "ett Kylskåp", weight: 150, emoji: "🧊" },
    { name: "Gorillor", singular: "en Gorilla", weight: 180, emoji: "🦍" },
    { name: "Lejon", singular: "ett Lejon", weight: 200, emoji: "🦁" },
    { name: "Varuautomater", singular: "en Varuautomat", weight: 300, emoji: "🎰" },
    { name: "Sibiriska Tigrar", singular: "en Sibirisk Tiger", weight: 300, emoji: "🐅" },
    { name: "Konsertflyglar", singular: "en Konsertflygel", weight: 500, emoji: "🎹" },
    { name: "Hästar", singular: "en Häst", weight: 500, emoji: "🐎" },
    { name: "Mjölkkor", singular: "en Mjölkko", weight: 600, emoji: "🐄" },
    { name: "Stora Älgar", singular: "en Stor Älg", weight: 700, emoji: "🫎" },
    { name: "Giraffer", singular: "en Giraff", weight: 800, emoji: "🦒" },
    { name: "Amerikanska Bisonoxar", singular: "en Bisonoxe", weight: 900, emoji: "🦬" },
    { name: "Smart Cars", singular: "en Smart Car", weight: 900, emoji: "🚗" },
    { name: "Personbilar", singular: "en Personbil", weight: 1500, emoji: "🚘" },
    { name: "Flodhästar", singular: "en Flodhäst", weight: 1500, emoji: "🦛" },
    { name: "Noshörningar", singular: "en Noshörning", weight: 2000, emoji: "🦏" },
    { name: "Vita Hajar", singular: "en Vit Haj", weight: 2000, emoji: "🦈" },
    { name: "Späckhuggare", singular: "en Späckhuggare", weight: 4000, emoji: "🐋" },
    { name: "Elefanter", singular: "en Elefant", weight: 5000, emoji: "🐘" },
    { name: "T-Rex", singular: "en T-Rex", weight: 8000, emoji: "🦖" },
    { name: "Skolbussar", singular: "en Skolbuss", weight: 12000, emoji: "🚌" },
    { name: "Stridsvagnar", singular: "en Stridsvagn", weight: 60000, emoji: "🛡️" },
    { name: "Lokomotiv", singular: "ett Lokomotiv", weight: 100000, emoji: "🚂" },
    { name: "Blåvalar", singular: "en Blåval", weight: 150000, emoji: "🐳" },
    { name: "Frihetsgudinnor", singular: "en Frihetsgudinna", weight: 225000, emoji: "🗽" },
    { name: "Boeing 747", singular: "en Boeing 747", weight: 400000, emoji: "✈️" },
    { name: "Rymdfärjor", singular: "en Rymdfärja", weight: 2000000, emoji: "🚀" },
    { name: "Eiffeltorn", singular: "ett Eiffeltorn", weight: 10000000, emoji: "🗼" }
];

const getFunComparison = (totalWeight: number) => {
    if (totalWeight <= 0) return null;
    
    // Find objects where the total weight lifted is at least equal to one of the item
    const suitableComparisons = WEIGHT_COMPARISONS.filter(item => totalWeight >= item.weight);
    
    if (suitableComparisons.length === 0) {
        // Fallback for very light weights
        const item = WEIGHT_COMPARISONS[0];
        return {
            count: (totalWeight / item.weight).toFixed(1),
            name: item.name,
            single: item.singular,
            weight: item.weight,
            emoji: item.emoji
        };
    }

    // Prefer comparisons that result in a number between 1 and 20 for readability
    const niceMatches = suitableComparisons.filter(item => {
        const count = totalWeight / item.weight;
        return count >= 1 && count <= 50;
    });

    let bestMatch;
    if (niceMatches.length > 0) {
        bestMatch = niceMatches[Math.floor(Math.random() * niceMatches.length)];
    } else {
        // If nothing fits perfectly in the range, take the heaviest possible item
        bestMatch = suitableComparisons[suitableComparisons.length - 1];
    }

    const rawCount = totalWeight / bestMatch.weight;
    // Format: Use 1 decimal if less than 10, otherwise integer
    const formattedCount = rawCount < 10 ? rawCount.toFixed(1) : Math.round(rawCount).toString();

    return {
        count: formattedCount,
        name: bestMatch.name,
        single: bestMatch.singular,
        weight: bestMatch.weight,
        emoji: bestMatch.emoji
    };
};

const COMMON_ACTIVITIES = ["Funktionell Träning", "HIIT", "Löpning", "Promenad", "Workout", "Yoga", "Cykling", "Simning", "Racketsport", "Vardagsmotion"];
const KROPPSKANSLA_TAGS = ["Pigg", "Stark", "Seg", "Stel", "Ont", "Stressad", "Bra musik", "Bra pepp", "Grymt pass"];
const RPE_LEVELS = [
    { range: '1-2', label: 'Mycket lätt', desc: 'Du kan sjunga eller prata helt obehindrat.', color: 'bg-emerald-500' },
    { range: '3-4', label: 'Lätt', desc: 'Du börjar bli varm men kan fortfarande prata enkelt.', color: 'bg-green-500' },
    { range: '5-6', label: 'Måttligt', desc: 'Du flåsar lite och kan bara prata i korta meningar.', color: 'bg-yellow-500' },
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
    insights: MemberInsightResponse;
    onStart: () => void;
    onCancel: () => void;
    onFeelingChange: (feeling: 'good' | 'neutral' | 'bad') => void;
    currentFeeling: 'good' | 'neutral' | 'bad';
}> = ({ workoutTitle, insights, onStart, onCancel, onFeelingChange, currentFeeling }) => {
    const displayStrategy = currentFeeling === 'bad' ? "Lyssna på kroppen idag. Fokusera på teknik och sänk vikterna." : (insights.strategy || insights.readiness.message);
    const isInjuredMode = currentFeeling === 'bad';
    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-indigo-50 dark:from-indigo-900/40 to-transparent z-0"></div>
            <div className="relative z-10 flex flex-col h-full overflow-y-auto p-6 scrollbar-hide">
                <div className="flex justify-between items-start mb-6"><button onClick={onCancel} className="text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white font-bold text-sm uppercase tracking-widest px-2 py-1 transition-colors">Avbryt</button></div>
                <div className="text-center mb-8"><span className="inline-block py-1 px-3 rounded-full bg-primary/10 dark:bg-white/10 border border-primary/20 dark:border-white/20 text-xs font-bold uppercase tracking-widest text-primary mb-4">Pre-Game Strategy</span><h1 className="text-3xl font-black leading-tight mb-2 text-gray-900 dark:text-white">{workoutTitle}</h1><p className="text-gray-500 dark:text-gray-400 text-sm">Din personliga plan för dagens pass</p></div>
                <div className="mb-8"><p className="text-center text-xs font-bold uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider">Hur känns kroppen?</p><div className="flex gap-3 justify-center">
                    {['good', 'neutral', 'bad'].map((f) => (
                        <button key={f} onClick={() => onFeelingChange(f as any)} className={`p-4 rounded-2xl border-2 transition-all ${currentFeeling === f ? 'bg-indigo-50 dark:bg-indigo-500/20 border-primary scale-105 shadow-lg' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200'}`}>
                            <span className="text-2xl block">{f === 'good' ? '🔥' : f === 'bad' ? '🤕' : '🙂'}</span>
                        </button>
                    ))}
                </div></div>
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-100 dark:border-gray-700 rounded-3xl p-6 shadow-xl mb-6">
                    <div className="flex items-start gap-4 mb-6"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg"><SparklesIcon className="w-6 h-6 text-white" /></div><div><h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">Dagens Fokus</h3><p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium italic">"{displayStrategy}"</p></div></div>
                    <div className="space-y-4">
                        {!isInjuredMode && insights.suggestions && Object.keys(insights.suggestions).length > 0 && (
                            <div><h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Smart Load (Förslag)</h4><div className="space-y-2">
                                {Object.entries(insights.suggestions).slice(0, 3).map(([exercise, suggestion]) => (
                                    <div key={exercise} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50"><span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{exercise}</span><span className="text-sm font-bold text-primary">{suggestion}</span></div>
                                ))}
                            </div></div>
                        )}
                        {(isInjuredMode || (insights.scaling && Object.keys(insights.scaling).length > 0)) && (
                            <div className="mt-4"><h4 className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1"><LightningIcon className="w-3 h-3" /> Alternativ / Skalning</h4><div className="space-y-2">
                                {insights.scaling && Object.entries(insights.scaling).map(([exercise, alternative]) => (
                                    <div key={exercise} className="bg-orange-50 dark:bg-orange-500/10 p-3 rounded-xl border border-orange-100 dark:border-orange-500/20"><div className="text-xs text-orange-600 dark:text-orange-300 line-through mb-0.5">{exercise}</div><div className="text-sm font-bold text-gray-900 dark:text-white">👉 {alternative}</div></div>
                                ))}
                                {isInjuredMode && (!insights.scaling || Object.keys(insights.scaling).length === 0) && (
                                    <div className="bg-orange-50 dark:bg-orange-500/10 p-3 rounded-xl border border-orange-100 dark:border-orange-500/20"><div className="text-sm font-bold text-gray-900 dark:text-white">Sänk vikterna med 30-50% och fokusera på fullt rörelseutslag.</div></div>
                                )}
                            </div></div>
                        )}
                    </div>
                </div>
                <div className="mt-auto pt-4 pb-8"><button onClick={onStart} className="w-full bg-primary hover:brightness-110 text-white font-black text-lg py-5 rounded-2xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"><span className="tracking-tight uppercase">Starta passet</span><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button></div>
            </div>
        </div>
    );
};

const ExerciseLogCard: React.FC<{
  name: string;
  result: LocalExerciseResult;
  onUpdate: (updates: Partial<LocalExerciseResult>) => void;
  onOpenDailyForm: (exerciseName: string) => void;
  aiSuggestion?: string;
  lastPerformance?: { weight: number, reps: string } | null;
}> = ({ name, result, onUpdate, onOpenDailyForm, aiSuggestion, lastPerformance }) => {
    
    const calculate1RM = (weight: string, reps: string) => {
        const w = parseFloat(weight);
        const r = parseFloat(reps);
        if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0) {
            if (r === 1) return Math.round(w);
            const oneRm = w * (1 + r / 30);
            return Math.round(oneRm);
        }
        return null;
    };

    const handleSetChange = (index: number, field: 'weight' | 'reps', value: string) => {
        const newSets = [...result.setDetails];
        newSets[index] = { ...newSets[index], [field]: value };
        onUpdate({ setDetails: newSets });
    };

    const handleToggleComplete = (index: number) => {
         const newSets = [...result.setDetails];
         newSets[index] = { ...newSets[index], completed: !newSets[index].completed };
         onUpdate({ setDetails: newSets });
    }

    const handleAddSet = () => {
        const lastSet = result.setDetails[result.setDetails.length - 1];
        const newSet = lastSet ? { ...lastSet, completed: false } : { weight: '', reps: '', completed: false };
        onUpdate({ setDetails: [...result.setDetails, newSet] });
    };

    const handleRemoveSet = (index: number) => {
        if (result.setDetails.length <= 1) return;
        onUpdate({ setDetails: result.setDetails.filter((_, i) => i !== index) });
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-gray-800 shadow-sm transition-all">
            <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-white text-base truncate">{name}</h4>
                    {lastPerformance ? (
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                            Senast: <span className="text-gray-600 dark:text-gray-300">{lastPerformance.weight}kg x {lastPerformance.reps}</span>
                        </p>
                    ) : (
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Första gången</p>
                    )}
                </div>
                <button 
                    onClick={() => onOpenDailyForm(name)}
                    className="bg-purple-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 shadow-md active:scale-95 transition-all"
                >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-tight">Hitta dagsform</span>
                </button>
            </div>

            <div className="space-y-2">
                <div className="grid grid-cols-[30px_1fr_1fr_40px_40px] gap-2 px-1 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    <div className="text-center">Set</div>
                    <div className="text-center">Reps</div>
                    <div className="text-center">Vikt (kg)</div>
                    <div></div>
                    <div className="text-center">Klar</div>
                </div>

                {result.setDetails.map((set, index) => {
                    const oneRm = calculate1RM(set.weight, set.reps);
                    return (
                        <div key={index} className={`grid grid-cols-[30px_1fr_1fr_40px_40px] gap-2 items-center transition-opacity ${set.completed ? 'opacity-50' : 'opacity-100'}`}>
                            <div className="flex justify-center items-center">
                                <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center">{index + 1}</span>
                            </div>
                            <div className="bg-gray-5 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                <input type="text" inputMode="numeric" value={set.reps} onChange={(e) => handleSetChange(index, 'reps', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center" disabled={set.completed} />
                            </div>
                            <div className="relative">
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
                                    <input type="number" value={set.weight} onChange={(e) => handleSetChange(index, 'weight', e.target.value)} placeholder="0" className="w-full bg-transparent text-gray-900 dark:text-white font-black text-lg focus:outline-none text-center" disabled={set.completed} />
                                </div>
                                {oneRm && !set.completed && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10">🔥 1RM: {oneRm}</div>
                                )}
                            </div>
                            <div className="flex justify-center">
                                {result.setDetails.length > 1 && (
                                    <button onClick={() => handleRemoveSet(index)} className="text-gray-300 hover:text-red-500 transition-colors p-2" disabled={set.completed}><CloseIcon className="w-5 h-5" /></button>
                                )}
                            </div>
                            <div className="flex justify-center">
                                <button onClick={() => handleToggleComplete(index)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-sm ${set.completed ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                                    <CheckIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
                <button onClick={handleAddSet} className="w-full mt-2 py-2 flex items-center justify-center gap-1 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors border border-primary/20 border-dashed"><PlusIcon className="w-3 h-3" /> Lägg till set</button>
            </div>
        </div>
    );
};

const CustomActivityForm: React.FC<{
  activityName: string; duration: string; distance: string; calories: string; onUpdate: (field: string, value: string) => void; isQuickMode?: boolean;
}> = ({ activityName, duration, distance, calories, onUpdate, isQuickMode }) => {
    return (
        <div className="space-y-6 py-2 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
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
                    <div><label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Aktivitet *</label><input value={activityName} onChange={(e) => onUpdate('name', e.target.value)} placeholder="T.ex. Powerwalk" disabled={isQuickMode} className={`w-full text-xl font-black text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 ${isQuickMode ? 'opacity-70' : ''}`} /></div>
                    <div><label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Tid (min) *</label><input type="number" value={duration} onChange={(e) => onUpdate('duration', e.target.value)} placeholder="T.ex. 60" className="w-full font-black text-lg text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Kalorier (kcal)</label><input type="number" value={calories} onChange={(e) => onUpdate('calories', e.target.value)} placeholder="T.ex. 350" className="w-full font-black text-lg text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700" /></div>
                        <div><label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Distans (km)</label><input type="number" value={distance} onChange={(e) => onUpdate('distance', e.target.value)} placeholder="T.ex. 5.3" className="w-full font-black text-lg text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700" /></div>
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
                <div className="mt-10"><h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-4">Kroppskänsla</h5><div className="flex flex-wrap gap-2">
                    {KROPPSKANSLA_TAGS.map(tag => (<button key={tag} onClick={() => toggleTag(tag)} className={`px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${data.tags.includes(tag) ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-700'}`}>{tag}</button>))}
                </div></div>
                <div className="mt-10"><h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-3 ml-1">Kommentar</h5><textarea value={data.comment} onChange={(e) => onUpdate({ comment: e.target.value })} placeholder="Anteckningar..." rows={4} className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[1.5rem] p-5 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner" /></div>
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
    if (val !== undefined) result[key] = (val && typeof v === 'object' && !(val instanceof Date)) ? cleanForFirestore(val) : val;
  });
  return result;
};

export const WorkoutLogScreen = ({ workoutId, organizationId, onClose, navigation, route }: any) => {
  const { currentUser } = useAuth();
  const { workouts: contextWorkouts } = useWorkout();
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
  const [showCelebration, setShowCelebration] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [dailyFormTarget, setDailyFormTarget] = useState<string | null>(null);
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [viewMode, setViewMode] = useState<'pre-game' | 'logging'>(isManualMode ? 'logging' : 'pre-game');
  const [dailyFeeling, setDailyFeeling] = useState<'good' | 'neutral' | 'bad'>('neutral');
  const [customActivity, setCustomActivity] = useState({ name: '', duration: '', distance: '', calories: '' });
  const [sessionStats, setSessionStats] = useState({ distance: '', calories: '' });
  
  // UPDATED: Record stores both weight and reps
  const [history, setHistory] = useState<Record<string, { weight: number, reps: string }>>({}); 
  const [aiInsights, setAiInsights] = useState<MemberInsightResponse | null>(null);

  const isQuickWorkoutMode = workout?.logType === 'quick';
  
  const uncheckedSetsCount = useMemo(() => {
      if (isQuickWorkoutMode || isManualMode) return 0;
      return exerciseResults.reduce((acc, ex) => acc + ex.setDetails.filter(s => !s.completed).length, 0);
  }, [isQuickWorkoutMode, isManualMode, exerciseResults]);

  const isFormValid = useMemo(() => {
      if (isSubmitting) return false;
      if (isQuickWorkoutMode || isManualMode) {
          return customActivity.name.trim() !== '' && customActivity.duration.trim() !== '';
      }
      const totalSets = exerciseResults.reduce((acc, ex) => acc + ex.setDetails.length, 0);
      return totalSets > 0 && uncheckedSetsCount === 0;
  }, [isSubmitting, isQuickWorkoutMode, isManualMode, customActivity, exerciseResults, uncheckedSetsCount]);
  
  useEffect(() => {
    if (!oId) { setLoading(false); return; }
    if (isManualMode) { setLoading(false); return; }
    if (!wId) { setLoading(false); return; }

    const init = async () => {
        try {
            const orgWorkouts = await getWorkoutsForOrganization(oId);
            let foundWorkout = orgWorkouts.find(w => w.id === wId);
            
            if (!foundWorkout) {
                 foundWorkout = contextWorkouts.find(w => w.id === wId);
            }
            
            if (foundWorkout) {
                setWorkout(foundWorkout as unknown as WorkoutData);
                
                if (foundWorkout.logType === 'quick') {
                    setCustomActivity(prev => ({ ...prev, name: foundWorkout!.title }));
                    setViewMode('logging');
                }

                const exercises: LocalExerciseResult[] = [];
                const hasExplicitLogging = foundWorkout.blocks.some(b => 
                    b.exercises.some(e => e.loggingEnabled === true)
                );

                foundWorkout.blocks.forEach(block => {
                    if (block.tag === 'Uppvärmning') return;
                    const defaultSets: LocalSetDetail[] = [{ weight: '', reps: '', completed: false }];

                    block.exercises.forEach(ex => {
                        const shouldInclude = hasExplicitLogging 
                            ? ex.loggingEnabled === true 
                            : ex.loggingEnabled !== false;

                        if (shouldInclude) {
                            exercises.push({
                                exerciseId: ex.id,
                                exerciseName: ex.name,
                                setDetails: [...defaultSets],
                                distance: '',
                                kcal: '',
                                blockId: block.id,
                                blockTitle: block.title
                            });
                        }
                    });
                });
                
                setExerciseResults(exercises);
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

                try {
                    const exerciseNames = exercises.map(e => e.exerciseName);
                    if (exerciseNames.length > 0) {
                        const insights = await generateMemberInsights(logs, foundWorkout.title, exerciseNames);
                        setAiInsights(insights);
                    } else {
                        setViewMode('logging');
                    }
                } catch (err) { 
                    console.log("AI Insight Error", err); 
                    if (viewMode === 'pre-game') setViewMode('logging');
                }
            }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };
    
    init();
  }, [wId, oId, userId, isManualMode, contextWorkouts]);

  const handleCancel = (isSuccess = false, diploma: WorkoutDiploma | null = null) => {
    if (onClose) onClose(isSuccess, diploma as any);
    else if (navigation) navigation.goBack();
  };

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

  const handleStartWorkout = () => {
      if (aiInsights?.suggestions && dailyFeeling !== 'bad') {
          const newResults = exerciseResults.map(res => {
              const suggestion = aiInsights.suggestions[res.exerciseName];
              if (suggestion) {
                  const weightMatch = suggestion.match(/(\d+)/);
                  if (weightMatch) {
                      const suggestedWeight = weightMatch[0];
                      const newSets = res.setDetails.map(set => ({
                          ...set,
                          weight: set.weight || suggestedWeight
                      }));
                      return { ...res, setDetails: newSets };
                  }
              }
              return res;
          });
          setExerciseResults(newResults);
      }
      setViewMode('logging');
  };

  const handleApplyDailyFormWeight = (exerciseName: string, weight: string) => {
      const index = exerciseResults.findIndex(r => r.exerciseName === exerciseName);
      if (index !== -1) {
          const updatedSets = exerciseResults[index].setDetails.map(set => ({
              ...set,
              weight: weight
          }));
          handleUpdateResult(index, { setDetails: updatedSets });
      }
  };

  const handleSubmit = async () => {
      if (!isFormValid) return;

      setIsSubmitting(true);
      try {
          const isQuickOrManual = isManualMode || workout?.logType === 'quick';
          const logDateMs = new Date(logDate).getTime();
          
          let totalVolume = 0;
          const newPBs: { name: string; diff: number }[] = [];

          const finalLogRaw: any = {
              memberId: userId,
              organizationId: oId,
              workoutId: isManualMode ? 'manual' : (wId || 'unknown'),
              workoutTitle: isQuickOrManual ? customActivity.name : (workout?.title || 'Träningspass'),
              date: logDateMs,
              source: isManualMode ? 'manual' : 'qr_scan',
              rpe: logData.rpe,
              feeling: logData.feeling,
              tags: logData.tags || [],
              comment: logData.comment || '',
              exerciseResults: isQuickOrManual ? [] : exerciseResults.map(r => {
                  const validWeights = r.setDetails.map(s => parseFloat(s.weight)).filter(n => !isNaN(n));
                  const maxWeight = validWeights.length > 0 ? Math.max(...validWeights) : null;
                  
                  const previousPB = history[r.exerciseName]?.weight; 
                  if (maxWeight && previousPB && maxWeight > previousPB) {
                      newPBs.push({ name: r.exerciseName, diff: maxWeight - previousPB });
                  }

                  r.setDetails.forEach(s => {
                      const weight = parseFloat(s.weight);
                      const reps = parseFloat(s.reps);
                      if (!isNaN(weight) && !isNaN(reps)) {
                          totalVolume += weight * reps;
                      }
                  });

                  const repsValues = r.setDetails.map(s => s.reps).filter(Boolean);
                  const uniqueReps = [...new Set(repsValues)];
                  const repsSummary = uniqueReps.length === 1 ? uniqueReps[0] : (uniqueReps.length > 0 ? 'Mixed' : null);

                  return {
                      exerciseId: r.exerciseId,
                      exerciseName: r.exerciseName,
                      setDetails: r.setDetails.map(s => ({
                          weight: parseFloat(s.weight) || null,
                          reps: s.reps || null
                      })),
                      weight: maxWeight, 
                      reps: repsSummary, 
                      sets: r.setDetails.length,
                      distance: null, 
                      kcal: null,
                      blockId: r.blockId
                  };
              })
          };

          if (isQuickOrManual) {
              finalLogRaw.activityType = isManualMode ? 'custom_activity' : 'gym_workout';
              finalLogRaw.durationMinutes = parseInt(customActivity.duration) || 0;
              finalLogRaw.totalDistance = parseFloat(customActivity.distance) || 0;
              finalLogRaw.totalCalories = parseInt(customActivity.calories) || 0;
              
              const finalLog = cleanForFirestore(finalLogRaw);
              await saveWorkoutLog(finalLog);
              
              setShowCelebration(true);
          } else {
              finalLogRaw.totalDistance = parseFloat(sessionStats.distance) || 0;
              finalLogRaw.totalCalories = parseInt(sessionStats.calories) || 0;

              let diplomaData: WorkoutDiploma | null = null;

              if (totalVolume > 0) {
                  const comparison = getFunComparison(totalVolume);
                  
                  if (comparison) {
                      diplomaData = {
                          title: newPBs.length > 0 ? "NYTT REKORD!" : "ENORM INSATS!",
                          subtitle: `Du lyfte totalt ${totalVolume.toLocaleString()} kg`,
                          achievement: `Det motsvarar ca ${comparison.count} st ${comparison.name}`,
                          footer: `En ${comparison.single} väger ca ${comparison.weight} kg`,
                          imagePrompt: comparison.emoji, 
                          newPBs: newPBs.length > 0 ? newPBs : undefined
                      };
                  }
              } else if (finalLogRaw.totalDistance > 0 || finalLogRaw.totalCalories > 0) {
                  try {
                      diplomaData = await generateWorkoutDiploma(finalLogRaw);
                      if (diplomaData) {
                          diplomaData.newPBs = newPBs.length > 0 ? newPBs : undefined;
                          if (newPBs.length > 0) diplomaData.title = "NYTT REKORD!";
                      }
                  } catch (e) {
                      diplomaData = {
                          title: newPBs.length > 0 ? "NYTT REKORD!" : "GRYMT JOBBAT!",
                          subtitle: "Passet är genomfört.",
                          achievement: `Distans: ${finalLogRaw.totalDistance} km | Kcal: ${finalLogRaw.totalCalories}`,
                          footer: "Starkt jobbat!",
                          imagePrompt: "🔥",
                          newPBs: newPBs.length > 0 ? newPBs : undefined
                      };
                  }
              }

              if (!diplomaData) {
                   diplomaData = {
                       title: newPBs.length > 0 ? "NYTT REKORD!" : "BRA JOBBAT!",
                       subtitle: "Passet är genomfört.",
                       achievement: "Kontinuitet är nyckeln.",
                       footer: "Ses snart igen!",
                       imagePrompt: "🔥",
                       newPBs: newPBs.length > 0 ? newPBs : undefined
                    };
              }

              finalLogRaw.diploma = diplomaData;
              const finalLog = cleanForFirestore(finalLogRaw);
              await saveWorkoutLog(finalLog);
              
              if (diplomaData.imagePrompt) {
                  try {
                      const base64Image = await generateImage(diplomaData.imagePrompt);
                      if (base64Image) {
                          const storagePath = `users/${userId}/diplomas/log_${Date.now()}.jpg`;
                          finalLogRaw.diploma.imageUrl = await uploadImage(storagePath, base64Image);
                      }
                  } catch (e) { console.warn(e); }
              }

              handleCancel(true, finalLogRaw.diploma || null);
          }

      } catch (err) {
          console.error(err);
          alert("Kunde inte spara. Ett tekniskt fel uppstod.");
          setIsSubmitting(false);
      }
  };

  if (loading) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                  {isManualMode ? 'Laddar formulär...' : 'Hämtar din personliga strategi...'}
              </p>
          </div>
      );
  }

  if (viewMode === 'pre-game' && aiInsights && workout) {
      return (
          <PreGameView 
            workoutTitle={workout.title}
            insights={aiInsights}
            onStart={handleStartWorkout}
            onCancel={() => handleCancel(false)}
            onFeelingChange={setDailyFeeling}
            currentFeeling={dailyFeeling}
          />
      );
  }

  return (
    <div className="bg-gray-5 dark:bg-black text-gray-900 dark:text-white flex flex-col relative h-full">
      <AnimatePresence>
        {showCelebration && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
                <Confetti />
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white p-10 rounded-[2.5rem] text-center shadow-2xl max-w-sm mx-4 relative z-10"
                >
                    <div className="text-7xl mb-6">🎉</div>
                    <h2 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight">Snyggt jobbat!</h2>
                    <p className="text-gray-500 font-medium leading-relaxed mb-8">Ditt pass är registrerat.</p>
                    
                    <button 
                        onClick={() => handleCancel(true)}
                        className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-tight"
                    >
                        Klar
                    </button>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-gray-900 p-6 px-8 flex-shrink-0 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shadow-sm z-10">
        <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight truncate">
                {isManualMode || isQuickWorkoutMode ? 'Logga Aktivitet' : workout?.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Registrera dina resultat</p>
        </div>
        <div className="flex items-center gap-2">
            {!isQuickWorkoutMode && !isManualMode && (
                <button 
                    onClick={() => setShowCalculator(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-all shadow-sm active:scale-95"
                    title="1RM Kalkylator"
                >
                    <CalculatorIcon className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-wider">1RM Kalkylator</span>
                </button>
            )}
            <button onClick={() => handleCancel(false)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex-shrink-0 shadow-sm active:scale-90">
                <CloseIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-5 dark:bg-black scrollbar-hide">
          <div className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
              
              <div className="mb-8">
                  <label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2 ml-1">Datum</label>
                  <div className="relative">
                      <input 
                          type="date"
                          value={logDate}
                          onChange={(e) => setLogDate(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none transition font-bold text-lg shadow-sm"
                      />
                  </div>
              </div>

              {!isManualMode && aiInsights && aiInsights.readiness && (
                  <div className={`p-5 rounded-[1.5rem] mb-8 shadow-sm flex items-start gap-4 border border-white/20 ${
                      aiInsights.readiness.status === 'low' ? 'bg-orange-100 text-orange-900' : 
                      aiInsights.readiness.status === 'high' ? 'bg-green-100 text-green-900' : 
                      'bg-blue-100 text-blue-900'
                  }`}>
                      <div className="p-2 bg-white/50 rounded-xl flex-shrink-0 shadow-inner">
                          <SparklesIcon className="w-5 h-5" />
                      </div>
                      <div>
                          <h4 className="font-black text-xs uppercase tracking-widest opacity-70 mb-1">Dagsform</h4>
                          <p className="font-bold text-sm leading-relaxed">{aiInsights.readiness.message}</p>
                      </div>
                  </div>
              )}

              {isManualMode || isQuickWorkoutMode ? (
                  <CustomActivityForm 
                      activityName={customActivity.name}
                      duration={customActivity.duration}
                      distance={customActivity.distance}
                      calories={customActivity.calories}
                      onUpdate={handleCustomActivityUpdate}
                      isQuickMode={isQuickWorkoutMode}
                  />
              ) : (
                  <>
                    {exerciseResults.map((result, index) => {
                        const isNewBlock = index === 0 || result.blockId !== exerciseResults[index - 1].blockId;
                        return (
                            <React.Fragment key={result.exerciseId}>
                                {isNewBlock && (
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
                                    onOpenDailyForm={(name) => setDailyFormTarget(name)}
                                    aiSuggestion={aiInsights?.suggestions?.[result.exerciseName]}
                                    lastPerformance={history[result.exerciseName]} 
                                />
                            </React.Fragment>
                        );
                    })}

                    <div className="mt-8 mb-6 bg-white dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Kalorier (kcal)</label>
                                <input 
                                    type="number"
                                    value={sessionStats.calories}
                                    onChange={(e) => setSessionStats(prev => ({ ...prev, calories: e.target.value }))}
                                    placeholder="T.ex. 350"
                                    className="w-full font-black text-lg text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Distans (km)</label>
                                <input 
                                    type="number"
                                    value={sessionStats.distance}
                                    onChange={(e) => setSessionStats(prev => ({ ...prev, distance: e.target.value }))}
                                    placeholder="T.ex. 5.3"
                                    className="w-full font-black text-lg text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700"
                                />
                            </div>
                        </div>
                    </div>
                  </>
              )}

              <PostWorkoutForm 
                data={logData} 
                onUpdate={u => setLogData(prev => ({ ...prev, ...u }))} 
              />

              {/* ACTION BUTTONS - IN CONTENT FLOW */}
              <div className="mt-12 space-y-4 pb-12">
                  {!isFormValid && !isQuickWorkoutMode && !isManualMode && (
                      <div className="text-center animate-fade-in">
                          <p className="text-orange-600 dark:text-orange-400 text-xs font-black uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                              <InformationCircleIcon className="w-3.5 h-3.5" /> {uncheckedSetsCount} set kvar att checka av
                          </p>
                      </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                          onClick={() => handleCancel(false)}
                          className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 font-black py-5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm"
                      >
                          Avbryt
                      </button>
                      <button 
                          onClick={handleSubmit}
                          disabled={!isFormValid}
                          className="flex-[2] bg-primary hover:brightness-110 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:shadow-none disabled:transform-none text-xl uppercase tracking-tight"
                      >
                          {isSubmitting ? 'Sparar...' : (isManualMode || isQuickWorkoutMode ? 'Spara Aktivitet' : 'Spara Pass')}
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {showCalculator && <OneRepMaxModal onClose={() => setShowCalculator(false)} />}
      <AnimatePresence>{dailyFormTarget && (<DailyFormInsightModal isOpen={!!dailyFormTarget} onClose={() => setDailyFormTarget(null)} exerciseName={dailyFormTarget} feeling={dailyFeeling} allLogs={allLogs} onApplySuggestion={(weight) => handleApplyDailyFormWeight(dailyFormTarget, weight)} />)}</AnimatePresence>
    </div>
  );
}