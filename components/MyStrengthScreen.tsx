
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
        <div className="w-full max-w-4xl mx-auto px-6 pb-20 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            Min Styrka
                            <TrophyIcon className="w-8 h-8 text-yellow-500" />
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Dina personbästa i olika övningar.</p>
                    </div>
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
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-xs font-bold uppercase tracking-widest">Hämtar rekord...</p>
                </div>
            ) : sortedPbs.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-600">
                        <DumbbellIcon className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inga rekord än</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Dina personbästa sparas automatiskt när du loggar pass. Använd kalkylatorn för att uppskatta din styrka tills dess!
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {sortedPbs.map(pb => (
                        <div key={pb.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between transition-all hover:shadow-md">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{pb.exerciseName}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
                                    {new Date(pb.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                {editingId === pb.id ? (
                                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                        <input 
                                            type="number" 
                                            value={editValue} 
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-20 bg-transparent text-right font-black text-xl text-gray-900 dark:text-white focus:outline-none p-2"
                                            autoFocus
                                        />
                                        <button onClick={() => saveEdit(pb)} className="p-2 bg-green-500 text-white rounded-lg shadow-sm hover:bg-green-600 transition-colors">
                                            <SaveIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={cancelEdit} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                            <CloseIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-3xl text-primary">{pb.weight}</span>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">kg</span>
                                        <button 
                                            onClick={() => startEditing(pb)}
                                            className="p-2 text-gray-300 hover:text-primary transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
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
