import React, { useState, useEffect, useMemo } from 'react';
import { PersonalBest } from '../types';
import { listenToPersonalBests, updatePersonalBest } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';
import { TrophyIcon, PencilIcon, SaveIcon, DumbbellIcon, CalculatorIcon, CloseIcon } from './icons';
import { OneRepMaxModal } from './OneRepMaxModal';

export const MyStrengthScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { userData } = useAuth();
    const [pbs, setPbs] = useState<PersonalBest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [showCalculator, setShowCalculator] = useState(false);

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

    const startEditing = (pb: PersonalBest) => {
        setEditingId(pb.id);
        setEditValue(pb.weight.toString());
    };

    const saveEdit = async (pb: PersonalBest) => {
        if (!userData?.uid) return;
        const newWeight = parseFloat(editValue);
        if (!isNaN(newWeight) && newWeight > 0) {
            await updatePersonalBest(userData.uid, pb.exerciseName, newWeight);
        }
        setEditingId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValue('');
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
                    {sortedPbs.map(pb => (
                        <div key={pb.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between transition-all hover:shadow-md">
                            <div className="min-w-0 pr-2">
                                <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{pb.exerciseName}</h3>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">
                                    {new Date(pb.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {editingId === pb.id ? (
                                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                        <input 
                                            type="number" 
                                            value={editValue} 
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-16 bg-transparent text-right font-black text-lg text-gray-900 dark:text-white focus:outline-none p-1"
                                            autoFocus
                                        />
                                        <button onClick={() => saveEdit(pb)} className="p-1.5 bg-green-500 text-white rounded-lg shadow-sm hover:bg-green-600 transition-colors">
                                            <SaveIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={cancelEdit} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                            <CloseIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-2xl text-primary">{pb.weight}</span>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">kg</span>
                                        <button 
                                            onClick={() => startEditing(pb)}
                                            className="p-1.5 text-gray-300 hover:text-primary transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg ml-2"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCalculator && <OneRepMaxModal onClose={() => setShowCalculator(false)} />}
        </div>
    );
};