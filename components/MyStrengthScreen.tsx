import React, { useState, useEffect, useMemo } from 'react';
import { PersonalBest, WorkoutLog } from '../types';
import { listenToPersonalBests, updatePersonalBest, db } from '../services/firebaseService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { TrophyIcon, PencilIcon, SaveIcon, DumbbellIcon, CalculatorIcon, CloseIcon, ChevronDownIcon, ChevronUpIcon } from './icons';
import { OneRepMaxModal } from './OneRepMaxModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculate1RM } from '../utils/workoutUtils';

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
        return [...pbs].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'sv'));
    }, [pbs]);

    const historyData = useMemo(() => {
        const data: Record<string, any[]> = {};
        const sourceLogs = logs || [];
        const sortedLogs = [...sourceLogs].sort((a, b) => a.date - b.date);

        sortedPbs.forEach(pb => {
            const exerciseName = pb.exerciseName;
            const dataPoints: any[] = [];

            sortedLogs.forEach(log => {
                if (!log.exerciseResults) return;
                
                const exResult = log.exerciseResults.find(ex => ex.exerciseName.trim().toLowerCase() === exerciseName.trim().toLowerCase());
                if (!exResult) return;
                
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
            
            data[exerciseName] = dataPoints;
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
                        const hasHistory = historyData[pb.exerciseName] && historyData[pb.exerciseName].length > 0;
                        
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
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="font-black text-xl text-primary">
                                                    {pb.reps ? `${pb.reps} x ${pb.weight}` : pb.weight}
                                                </span>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">kg</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-right">
                                                {pb.calculated1RM ? `1RM: ${pb.calculated1RM} kg` : '1RM'}
                                            </div>
                                        </div>
                                        <div className="text-gray-400 ml-1">
                                            {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">1RM Historik</h4>
                                    
                                    {hasHistory ? (
                                        <div className="h-48 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={historyData[pb.exerciseName]} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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