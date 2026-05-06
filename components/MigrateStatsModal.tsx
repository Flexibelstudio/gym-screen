import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { UserData } from '../types';
import { updateUserProfile } from '../services/firebaseService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData;
}

export const MigrateStatsModal: React.FC<Props> = ({ isOpen, onClose, userData }) => {
    const [totalWorkouts, setTotalWorkouts] = useState('');
    const [streakWeeks, setStreakWeeks] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        const workouts = parseInt(totalWorkouts, 10);
        const streak = parseInt(streakWeeks, 10);

        if (isNaN(workouts) || isNaN(streak) || workouts < 0 || streak < 0) {
            alert('Vänligen fyll i giltiga siffror.');
            return;
        }

        if (window.confirm('Är du säker på att siffrorna stämmer? Det går inte att ändra i efterhand.')) {
            setLoading(true);
            try {
                await updateUserProfile(userData.uid, {
                    migratedStats: {
                        totalWorkouts: workouts,
                        streakWeeks: streak,
                        migratedAtDate: new Date().toISOString()
                    }
                });
                onClose();
            } catch (err) {
                console.error(err);
                alert('Kunde inte spara statistiken.');
            } finally {
                setLoading(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importera befintlig historik" size="sm">
            <div className="space-y-6">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 p-4 rounded-2xl text-sm leading-relaxed border border-indigo-100 dark:border-indigo-800/50">
                    Har du tränat och loggat din historik tidigare utanför denna app? Fyll i dina befintliga siffror nedan för att få med dem. <br/><strong className="mt-2 block text-indigo-900 dark:text-indigo-300">Denna åtgärd kan bara göras en gång.</strong>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-2 ml-1">Totalt antal pass</label>
                    <input 
                        type="number" 
                        value={totalWorkouts} 
                        onChange={(e) => setTotalWorkouts(e.target.value)}
                        placeholder="t.ex. 125"
                        className="w-full bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 text-xl font-bold text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-2 ml-1">Aktuell Streak (veckor i rad)</label>
                    <input 
                        type="number" 
                        value={streakWeeks} 
                        onChange={(e) => setStreakWeeks(e.target.value)}
                        placeholder="t.ex. 5"
                        className="w-full bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 text-xl font-bold text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                </div>
                <div className="flex gap-4 pt-4">
                    <button 
                        onClick={onClose} 
                        className="flex-1 px-4 py-4 border-2 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Avbryt
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="flex-1 px-4 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-sm uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
                    >
                        {loading ? 'Sparar...' : 'Spara & Lås'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
