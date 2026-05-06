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
                <p className="text-sm text-gray-500 mb-4">
                    Har du tränat och loggat din historik tidigare utanför denna app? Fyll i dina befintliga siffror nedan för att få med dem. Denna åtgärd kan bara göras en gång.
                </p>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Totalt antal pass</label>
                    <input 
                        type="number" 
                        value={totalWorkouts} 
                        onChange={(e) => setTotalWorkouts(e.target.value)}
                        placeholder="t.ex. 125"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-gray-900 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Aktuell Streak (antal veckor i rad)</label>
                    <input 
                        type="number" 
                        value={streakWeeks} 
                        onChange={(e) => setStreakWeeks(e.target.value)}
                        placeholder="t.ex. 5"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-gray-900 dark:text-white"
                    />
                </div>
                <div className="flex gap-4 pt-4">
                    <button 
                        onClick={onClose} 
                        className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold uppercase tracking-wider"
                    >
                        Avbryt
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold uppercase tracking-wider disabled:opacity-50"
                    >
                        {loading ? 'Sparar...' : 'Spara & Lås'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
