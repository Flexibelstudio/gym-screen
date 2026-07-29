import React, { useState, useEffect, useMemo } from 'react';
import { PersonalBest, WorkoutLog } from '../types';
import { listenToPersonalBests, updatePersonalBest, resetPersonalBest, db } from '../services/firebaseService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { TrophyIcon, PencilIcon, SaveIcon, DumbbellIcon, CalculatorIcon, CloseIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, InformationCircleIcon } from './icons';
import { OneRepMaxModal } from './OneRepMaxModal';
import { Modal } from './ui/Modal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculate1RM } from '../utils/workoutUtils';
import { canonicalizeExerciseName } from '../data/exerciseAliases';
import { useConfirm } from './ConfirmContext';
import { LEVEL_NAMES } from '../data/fitnessStandards';
import { getAgeFromBirthDate, getStrengthAssessment, findLift1RM } from '../utils/fitnessBenchmarks';
import { useStudio } from '../context/StudioContext';

export interface MyStrengthScreenProps {
    userData: any;
    logs?: WorkoutLog[];
    onClose?: () => void;
    onBack?: () => void;
    onOpenProfileEdit?: () => void;
}

const LevelIndicator: React.FC<{ level: number; levelName: string }> = ({ level, levelName }) => {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Nivå
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                    {levelName}
                </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 h-2">
                {[1, 2, 3, 4, 5].map((seg) => (
                    <div
                        key={seg}
                        className={`h-full rounded-full transition-colors ${
                            seg <= level ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-800'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
};

export const MyStrengthScreen: React.FC<MyStrengthScreenProps> = ({ userData, logs, onClose, onBack, onOpenProfileEdit }) => {
    const [pbs, setPbs] = useState<PersonalBest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCalculator, setShowCalculator] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [displayLimit, setDisplayLimit] = useState(10);
    const confirm = useConfirm();
    const { selectedOrganization, studioConfig } = useStudio();
    const enableFitnessBenchmarks = (selectedOrganization?.globalConfig?.enableFitnessBenchmarks ?? studioConfig?.enableFitnessBenchmarks) !== false;

    useEffect(() => {
        if (!userData?.uid) return;
        
        setIsLoading(true);
        const unsubscribe = listenToPersonalBests(
            userData.uid, 
            (data) => {
                setPbs(data);
                setIsLoading(false);
            },
            (error) => {
                console.error("Failed to load PBs", error);
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }, [userData?.uid]);

    const sortedPbs = useMemo(() => {
        // Collect and group all exercises from PB and logs by canonical key
        const pbMap = new Map<string, PersonalBest>();

        const addOrMergePB = (rawName: string, weight: number, reps: number, calc1RM: number, date?: number, id?: string) => {
            const canonicalKey = canonicalizeExerciseName(rawName);
            const calculated1RM = calc1RM || calculate1RM(weight, reps) || weight || 0;

            if (!pbMap.has(canonicalKey)) {
                pbMap.set(canonicalKey, {
                    id: id || canonicalKey,
                    exerciseName: rawName.trim(),
                    weight,
                    reps,
                    calculated1RM,
                    date
                });
            } else {
                const existing = pbMap.get(canonicalKey)!;
                const existing1RM = existing.calculated1RM || calculate1RM(existing.weight, existing.reps) || existing.weight || 0;

                let newWeight = existing.weight;
                let newReps = existing.reps;
                let new1RM = existing1RM;
                let newDate = Math.max(existing.date || 0, date || 0);

                if (calculated1RM > existing1RM) {
                    new1RM = calculated1RM;
                    newWeight = weight;
                    newReps = reps;
                }

                let nameToKeep = existing.exerciseName;
                if (rawName.trim().length < nameToKeep.length && !rawName.includes('(')) {
                    nameToKeep = rawName.trim();
                }

                pbMap.set(canonicalKey, {
                    ...existing,
                    exerciseName: nameToKeep,
                    weight: newWeight,
                    reps: newReps,
                    calculated1RM: new1RM,
                    date: newDate
                });
            }
        };

        pbs.forEach(pb => {
            if (pb && pb.exerciseName) {
                const w = pb.weight || 0;
                const r = pb.reps || 0;
                const c1rm = pb.calculated1RM || calculate1RM(w, r) || 0;
                addOrMergePB(pb.exerciseName, w, r, c1rm, pb.date, pb.id);
            }
        });

        if (logs) {
            logs.forEach(log => {
                if (log.exerciseResults) {
                    log.exerciseResults.forEach(ex => {
                        if (!ex.exerciseName) return;
                        let maxW = 0;
                        let maxR = 0;
                        if (ex.setDetails) {
                            ex.setDetails.forEach(s => {
                                const w = parseFloat(s.weight as any) || 0;
                                const r = parseFloat(s.reps as any) || 0;
                                if (w > maxW || (w === maxW && r > maxR)) {
                                    maxW = w;
                                    maxR = r;
                                }
                            });
                        } else {
                            maxW = parseFloat(ex.weight as any) || 0;
                            maxR = parseFloat(ex.reps as any) || 0;
                        }
                        const c1rm = calculate1RM(maxW, maxR) || maxW || 0;
                        addOrMergePB(ex.exerciseName, maxW, maxR, c1rm, log.date);
                    });
                }
            });
        }

        return Array.from(pbMap.values()).sort((a, b) => {
            const dateA = a.date || 0;
            const dateB = b.date || 0;
            if (dateB !== dateA) {
                return dateB - dateA;
            }
            return a.exerciseName.localeCompare(b.exerciseName, 'sv');
        });
    }, [pbs, logs]);

    const filteredPbs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return sortedPbs;
        return sortedPbs.filter(pb => pb.exerciseName.toLowerCase().includes(term));
    }, [sortedPbs, searchTerm]);

    const visiblePbs = useMemo(() => {
        if (searchTerm.trim() !== '') {
            return filteredPbs;
        }
        return filteredPbs.slice(0, displayLimit);
    }, [filteredPbs, searchTerm, displayLimit]);

    const historyData = useMemo(() => {
        const data: Record<string, { points: any[], latestNote?: string }> = {};
        const sourceLogs = logs || [];
        const sortedLogs = [...sourceLogs].sort((a, b) => a.date - b.date);

        sortedPbs.forEach(pb => {
            const exerciseName = pb.exerciseName;
            const canonicalKey = canonicalizeExerciseName(exerciseName);
            const dataPoints: any[] = [];
            let latestNote: string | undefined = undefined;

            sortedLogs.forEach(log => {
                if (!log.exerciseResults) return;
                
                const exResult = log.exerciseResults.find(ex => canonicalizeExerciseName(ex.exerciseName) === canonicalKey);
                if (!exResult) return;
                
                // Keep the latest note (since sortedLogs is chronological, the last one seen is the most recent)
                if (exResult.note) {
                    latestNote = exResult.note;
                }
                
                let best1RM = 0;
                
                if (exResult.setDetails) {
                    exResult.setDetails.forEach(s => {
                        const w = parseFloat(s.weight as any);
                        const r = parseFloat(s.reps as any);
                        if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0 && r <= 10) {
                            const oneRm = calculate1RM(w, r);
                            if (oneRm && oneRm > best1RM) {
                                best1RM = oneRm;
                            }
                        }
                    });
                } else if (exResult.weight && exResult.reps) {
                    const w = parseFloat(exResult.weight as any);
                    const r = parseFloat(exResult.reps as any);
                    if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0 && r <= 10) {
                        const oneRm = calculate1RM(w, r);
                        if (oneRm && oneRm > best1RM) {
                            best1RM = oneRm;
                        }
                    }
                }
                
                if (best1RM > 0) {
                    dataPoints.push({
                        date: new Date(log.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
                        timestamp: log.date,
                        oneRM: best1RM
                    });
                }
            });
            
            data[exerciseName] = { points: dataPoints, latestNote };
        });
        
        return data;
    }, [logs, sortedPbs]);

    const toggleExpand = (exerciseName: string) => {
        if (expandedExercise === exerciseName) {
            setExpandedExercise(null);
        } else {
            setExpandedExercise(exerciseName);
        }
    };

    const handleReset = async (exerciseName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userData?.uid) return;
        
        const isConfirmed = await confirm({
            title: `Nollställ 1RM för ${exerciseName}?`,
            message: "Din historik sparas, men det aktuella personbästat visas som 0 tills du loggar ett nytt resultat.",
            confirmText: "Nollställ",
            cancelText: "Avbryt",
            confirmColor: "red"
        });

        if (isConfirmed) {
            await resetPersonalBest(userData.uid, exerciseName);
        }
    };

    const liftsConfig = [
        { key: 'squat' as const, title: 'Knäböj', lowerName: 'knäböj' },
        { key: 'bench' as const, title: 'Bänkpress', lowerName: 'bänkpress' },
        { key: 'deadlift' as const, title: 'Marklyft', lowerName: 'marklyft' },
        { key: 'press' as const, title: 'Axelpress', lowerName: 'axelpress' },
    ];

    const age = getAgeFromBirthDate(userData?.birthDate);
    const bodyWeight = typeof userData?.bodyWeight === 'number' && userData.bodyWeight > 0 ? userData.bodyWeight : null;
    const gender = userData?.gender;

    return (
        <div className="w-full animate-fade-in">
            {enableFitnessBenchmarks && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-[1.2] pt-[0.1em]">
                                HUR STARK ÄR DU?
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowInfoModal(true)}
                                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                aria-label="Information om styrkenivåer"
                            >
                                <InformationCircleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-3">
                        Din nivå jämförs med andra som tränar — i din ålder, ditt kön och din kroppsvikt.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {liftsConfig.map((lift) => {
                            const oneRM = findLift1RM(sortedPbs, lift.key);
                            const assessment = (gender === 'male' || gender === 'female') && age !== null && bodyWeight !== null && oneRM !== null
                                ? getStrengthAssessment(lift.key, gender, age, bodyWeight, oneRM)
                                : null;

                            return (
                                <div key={lift.key} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between space-y-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="font-bold text-gray-900 dark:text-white text-base">{lift.title}</h4>
                                        {oneRM !== null && (
                                            <span className="text-amber-600 dark:text-amber-400 font-mono font-bold text-xs bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/30 tabular-nums shrink-0">
                                                1RM: {oneRM} kg
                                            </span>
                                        )}
                                    </div>

                                    {oneRM === null ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                            Logga {lift.lowerName} för att se din nivå.
                                        </p>
                                    ) : bodyWeight === null ? (
                                        <div className="space-y-2">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                                Ange kroppsvikt i din profil för att se jämförelsen.
                                            </p>
                                            {onOpenProfileEdit && (
                                                <button
                                                    onClick={onOpenProfileEdit}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                                >
                                                    Till profilen →
                                                </button>
                                            )}
                                        </div>
                                    ) : (age === null || !userData?.birthDate) ? (
                                        <div className="space-y-2">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                                Ange födelsedatum i din profil för att se jämförelsen.
                                            </p>
                                            {onOpenProfileEdit && (
                                                <button
                                                    onClick={onOpenProfileEdit}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                                >
                                                    Till profilen →
                                                </button>
                                            )}
                                        </div>
                                    ) : (gender !== 'male' && gender !== 'female') ? (
                                        <div className="space-y-3">
                                            <LevelIndicator level={0} levelName="På väg" />
                                            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic leading-snug">
                                                Jämförelser finns för man/kvinna. Din progression räknas ändå.
                                            </p>
                                        </div>
                                    ) : assessment ? (
                                        <div className="space-y-3">
                                            <LevelIndicator level={assessment.level} levelName={assessment.levelName} />
                                            <div className="space-y-1 pt-1 border-t border-gray-100 dark:border-gray-800/60 text-xs">
                                                <p className="text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium">Snitt i din ålder & kön:</span>{' '}
                                                    <span className="font-bold text-gray-900 dark:text-white font-mono tabular-nums">
                                                        {String(assessment.averageKg).replace('.', ',')} kg
                                                    </span>
                                                </p>
                                                {assessment.level < 5 && assessment.nextLevelKg !== null && (
                                                    <p className="text-gray-600 dark:text-gray-400">
                                                        <span className="font-medium">Nästa nivå:</span>{' '}
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                                                            {LEVEL_NAMES[assessment.level + 1]}
                                                        </span>{' '}
                                                        vid{' '}
                                                        <span className="font-bold text-gray-900 dark:text-white font-mono tabular-nums">
                                                            {String(assessment.nextLevelKg).replace('.', ',')} kg
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Här samlas dina tyngsta lyft som du har loggat i appen.</p>
                </div>
                
                <button 
                    onClick={() => setShowCalculator(true)}
                    className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors shadow-sm shrink-0"
                >
                    <CalculatorIcon className="w-5 h-5" />
                    <span>Räkna ut 1RM</span>
                </button>
            </div>

            {sortedPbs.length > 0 && (
                <div className="mb-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Sök övning..."
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold"
                            >
                                Rensa
                            </button>
                        )}
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-xs font-bold uppercase tracking-widest">Hämtar rekord...</p>
                </div>
            ) : sortedPbs.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-600">
                        <DumbbellIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inga rekord än</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-sm">
                        Dina personbästa sparas automatiskt när du loggar pass. Använd kalkylatorn för att uppskatta din styrka tills dess!
                    </p>
                </div>
            ) : filteredPbs.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Inga övningar matchar '{searchTerm}'</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid gap-3">
                        {visiblePbs.map(pb => {
                            const isExpanded = expandedExercise === pb.exerciseName;
                            const hasHistoryData = historyData[pb.exerciseName];
                            const hasHistory = hasHistoryData && hasHistoryData.points.length > 0;
                            const latestNote = hasHistoryData?.latestNote;
                            
                            return (
                            <div key={pb.id} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:shadow-md overflow-hidden">
                                <div 
                                    className="p-4 flex items-center justify-between cursor-pointer"
                                    onClick={() => toggleExpand(pb.exerciseName)}
                                >
                                    <div className="min-w-0 pr-2">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{pb.exerciseName}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                                                {new Date(pb.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="text-right">
                                                {pb.weight === 0 && pb.reps === 0 ? (
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-right mt-1">
                                                        Nollställt
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-baseline justify-end gap-1">
                                                            <span className="font-black text-xl text-primary">
                                                                {pb.weight > 0 
                                                                    ? (pb.reps ? <>{pb.reps} <span className="text-base text-primary/70 font-bold mx-0.5">×</span> {pb.weight}</> : pb.weight)
                                                                    : pb.reps}
                                                            </span>
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-0.5">{pb.weight > 0 ? 'kg' : 'reps'}</span>
                                                        </div>
                                                        {pb.calculated1RM ? (
                                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-right">
                                                                1RM: {pb.calculated1RM} kg
                                                            </div>
                                                        ) : (pb.weight > 0 ? (
                                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-right">
                                                                1RM
                                                            </div>
                                                        ) : null)}
                                                    </>
                                                )}
                                            </div>
                                            <div className="text-gray-400 ml-1">
                                                {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                                        {latestNote && (
                                            <div className="mb-4 bg-yellow-50/50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-100/50 dark:border-yellow-800/30">
                                                <span className="block text-[9px] font-black uppercase tracking-widest text-yellow-600/70 dark:text-yellow-400/70 mb-1">Anteckning:</span>
                                                <p className="text-xs text-yellow-900/80 dark:text-yellow-200/80 italic leading-relaxed">
                                                    "{latestNote}"
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">1RM Historik</h4>
                                            <button 
                                                onClick={(e) => handleReset(pb.exerciseName, e)}
                                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                                <span>Nollställ 1RM</span>
                                            </button>
                                        </div>
                                        
                                        {hasHistory ? (
                                            <div className="h-48 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={historyData[pb.exerciseName].points} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                        <XAxis 
                                                            dataKey="date" 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            tick={{ fontSize: 10, fill: '#9ca3af' }} 
                                                            dy={10}
                                                        />
                                                        <YAxis 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            tick={{ fontSize: 10, fill: '#9ca3af' }} 
                                                        />
                                                        <Tooltip 
                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                                            formatter={(value: number) => [`${value} kg`, '1RM']}
                                                            labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                                                        />
                                                        <Line 
                                                            type="monotone" 
                                                            dataKey="oneRM" 
                                                            stroke="#4f46e5" 
                                                            strokeWidth={3}
                                                            dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                                                            activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 0 }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Ingen historik hittades för denna övning.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )})}
                    </div>

                    {!searchTerm.trim() && visiblePbs.length < filteredPbs.length && (
                        <div className="pt-2 text-center">
                            <button
                                onClick={() => setDisplayLimit(prev => prev + 20)}
                                className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm"
                            >
                                Visa fler ({filteredPbs.length - visiblePbs.length} kvar)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showCalculator && <OneRepMaxModal onClose={() => setShowCalculator(false)} />}

            <Modal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} title="Så funkar nivåerna">
                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    <p>
                        Nivåerna bygger på hur mycket du lyfter i förhållande till din kroppsvikt, justerat för ålder och kön. En 45-årig kvinna på 68 kg och en 25-årig man på 90 kg kan alltså båda vara "Stark" — det är samma prestation, mätt rättvist.
                    </p>

                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">Nivåerna</h4>
                        <ul className="space-y-1">
                            <li><strong className="font-bold text-gray-900 dark:text-white">Nybörjare</strong> — starkare än ungefär 5 % av dem som tränar</li>
                            <li><strong className="font-bold text-gray-900 dark:text-white">Motionär</strong> — starkare än ungefär 20 %</li>
                            <li><strong className="font-bold text-gray-900 dark:text-white">Stark</strong> — starkare än ungefär hälften. Det här är en riktigt bra nivå.</li>
                            <li><strong className="font-bold text-gray-900 dark:text-white">Mycket stark</strong> — starkare än ungefär 80 %</li>
                            <li><strong className="font-bold text-gray-900 dark:text-white">Elit</strong> — starkare än ungefär 95 %. Tävlingsnivå.</li>
                        </ul>
                    </div>

                    <p>
                        Ligger du under Nybörjare står det "På väg" — för det är precis vad du är.
                    </p>

                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">Var kommer siffrorna ifrån?</h4>
                        <p>
                            Från en av världens största databaser över loggade lyft, med hundratals miljoner registrerade set. Det är alltså jämförelser mot andra som tränar — inte mot befolkningen i stort. Mot en genomsnittlig vuxen är även "Nybörjare" imponerande.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">Kom ihåg</h4>
                        <p>
                            Jämförelsen är krydda. Det som faktiskt spelar roll är din egen kurva över tid — att du lyfter mer i år än förra året. Nivåerna är till för att sätta ord på var du står, inte för att döma.
                        </p>
                    </div>

                    <p>
                        Jämförelser finns i dag för man och kvinna. Har du valt något annat visas din progression men ingen nivå.
                    </p>
                </div>
            </Modal>
        </div>
    );
};