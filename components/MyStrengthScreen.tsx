import React, { useState, useEffect, useMemo } from 'react';
import { PersonalBest, WorkoutLog } from '../types';
import { listenToPersonalBests, updatePersonalBest, resetPersonalBest, db } from '../services/firebaseService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { TrophyIcon, PencilIcon, SaveIcon, DumbbellIcon, CalculatorIcon, CloseIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon } from './icons';
import { OneRepMaxModal } from './OneRepMaxModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculate1RM } from '../utils/workoutUtils';
import { useConfirm } from './ConfirmContext';

export interface MyStrengthScreenProps {
    userData: any;
    logs?: WorkoutLog[];
    onClose?: () => void;
    onBack?: () => void;
}

export const MyStrengthScreen: React.FC<MyStrengthScreenProps> = ({ userData, logs, onClose, onBack }) => {
    const [pbs, setPbs] = useState<PersonalBest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCalculator, setShowCalculator] = useState(false);
    const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
    const confirm = useConfirm();

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
        // Collect all exercises from PB and logs
        const pbMap = new Map<string, PersonalBest>();
        pbs.forEach(pb => pbMap.set(pb.exerciseName.toLowerCase().trim(), pb));

        if (logs) {
            logs.forEach(log => {
                if (log.exerciseResults) {
                    log.exerciseResults.forEach(ex => {
                        const nameKey = ex.exerciseName.toLowerCase().trim();
                        if (!pbMap.has(nameKey)) {
                            // Find best set in this log textually just to have something
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

                            pbMap.set(nameKey, {
                                id: nameKey,
                                exerciseName: ex.exerciseName.trim(),
                                weight: maxW,
                                reps: maxR,
                                calculated1RM: calculate1RM(maxW, maxR) || 0,
                                date: log.date
                            });
                        }
                    });
                }
            });
        }

        return Array.from(pbMap.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'sv'));
    }, [pbs, logs]);

    const historyData = useMemo(() => {
        const data: Record<string, { points: any[], latestNote?: string }> = {};
        const sourceLogs = logs || [];
        const sortedLogs = [...sourceLogs].sort((a, b) => a.date - b.date);

        sortedPbs.forEach(pb => {
            const exerciseName = pb.exerciseName;
            const dataPoints: any[] = [];
            let latestNote: string | undefined = undefined;

            sortedLogs.forEach(log => {
                if (!log.exerciseResults) return;
                
                const exResult = log.exerciseResults.find(ex => ex.exerciseName.trim().toLowerCase() === exerciseName.trim().toLowerCase());
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
                
                // For reps-only exercises, we want to at least save the points for something, but here we just leave them out of the 1RM chart.
                // However, we still have the latestNote!
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

    return (
        <div className="w-full animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Här samlas dina tyngsta lyft som du har loggat i appen.</p>
                </div>
                
                <button 
                    onClick={() => setShowCalculator(true)}
                    className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
                >
                    <CalculatorIcon className="w-5 h-5" />
                    <span>Räkna ut 1RM</span>
                </button>
            </div>

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
            ) : (
                <div className="grid gap-3">
                    {sortedPbs.map(pb => {
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
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-yellow-600/70 dark:text-yellow-400/70 mb-1">Anteckning från förra passet:</span>
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
            )}

            {showCalculator && <OneRepMaxModal onClose={() => setShowCalculator(false)} />}
        </div>
    );
};