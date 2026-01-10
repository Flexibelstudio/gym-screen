
import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';

export const OneRepMaxModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [weight, setWeight] = useState<string>('');
    const [reps, setReps] = useState<string>('');
    const [estimated1RM, setEstimated1RM] = useState<number | null>(null);

    useEffect(() => {
        const w = parseFloat(weight);
        const r = parseFloat(reps);
        if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0) {
            // Fix: If reps is 1, the 1RM is exactly the weight lifted.
            if (r === 1) {
                setEstimated1RM(Math.round(w));
            } else {
                // Epley Formula: 1RM = Weight * (1 + Reps/30)
                const oneRm = w * (1 + r / 30);
                setEstimated1RM(Math.round(oneRm));
            }
        } else {
            setEstimated1RM(null);
        }
    }, [weight, reps]);

    const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

    return (
        <Modal isOpen={true} onClose={onClose} title="1RM Kalkylator" size="md">
            <div className="space-y-6">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Räkna ut ditt estimerade maxlyft (1RM) baserat på vad du lyft tidigare.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Vikt (kg)</label>
                        <input 
                            type="number" 
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder="0"
                            className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center font-black text-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Reps</label>
                        <input 
                            type="number" 
                            value={reps}
                            onChange={(e) => setReps(e.target.value)}
                            placeholder="0"
                            className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center font-black text-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                </div>

                {estimated1RM !== null && (
                    <div className="animate-fade-in space-y-6">
                        <div className="bg-primary/10 border border-primary/20 p-6 rounded-2xl text-center">
                            <p className="text-xs font-bold uppercase text-primary tracking-widest mb-1">Ditt Estimerade 1RM</p>
                            <p className="text-5xl font-black text-gray-900 dark:text-white">{estimated1RM} kg</p>
                        </div>

                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wider">Procenttabell</h4>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {percentages.map(pct => (
                                    <div key={pct} className={`p-2 rounded-lg text-center ${pct === 100 ? 'bg-gray-800 text-white col-span-3 sm:col-span-4' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                        <span className="block text-[10px] font-bold opacity-60">{pct}%</span>
                                        <span className="block font-black text-lg">{Math.round((estimated1RM * pct) / 100)} kg</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                <button onClick={onClose} className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-3 rounded-xl transition-colors">
                    Stäng
                </button>
            </div>
        </Modal>
    );
};
