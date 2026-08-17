import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../../../components/ui/Modal';
import { calculate1RM, getRepsForPercentage } from '../../../utils/workoutUtils';
import { normalizeDecimalInput } from './utils';

export const OneRMCalculatorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    context: { 
        exerciseName?: string; 
        current1RM?: number; 
        activeTargetPct?: number | null;
        activePctSource?: 'coach' | 'session' | 'none';
        onSelectTargetPct?: (pct: number | null) => void;
        onSelectWeight?: (w: number) => void; 
    } | null;
}> = ({ isOpen, onClose, context }) => {
    const [calcWeight, setCalcWeight] = useState<string>('');
    const [calcReps, setCalcReps] = useState<string>('');
    
    useEffect(() => {
        if (isOpen) {
            setCalcWeight('');
            setCalcReps('');
        }
    }, [isOpen]);

    let calculated1RM = null;
    if (calcWeight && calcReps) {
        calculated1RM = calculate1RM(calcWeight, calcReps);
    } else if (context?.current1RM) {
        calculated1RM = context.current1RM;
    }

    const percentages = [60, 65, 70, 75, 80, 85, 90, 95];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={context?.exerciseName ? `1RM: ${context.exerciseName}` : "1RM Kalkylator"} size="sm">
            <div className="space-y-6">
                {(context?.exerciseName && context?.current1RM && !calcWeight) ? (
                    <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">Uppskattat 1RM</p>
                        <p className="text-4xl font-black text-gray-900 dark:text-white">{context.current1RM} <span className="text-lg opacity-50">kg</span></p>
                    </div>
                ) : null}

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">Räkna ut (nytt) 1RM</p>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Vikt (kg)</label>
                            <input type="text" inputMode="decimal" value={calcWeight} onChange={e => setCalcWeight(normalizeDecimalInput(e.target.value))} className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-black text-lg p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-primary text-center transition-colors" placeholder="Ex. 100" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Reps (max 10)</label>
                            <input type="number" inputMode="numeric" value={calcReps} onChange={e => setCalcReps(e.target.value)} className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-black text-lg p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-primary text-center transition-colors" placeholder="Ex. 5" />
                        </div>
                    </div>
                    {calcWeight && calcReps && calculated1RM && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-4 rounded-xl text-center shadow-lg">
                            <p className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-0.5">Ditt nya 1RM</p>
                            <p className="text-3xl font-black">{calculated1RM} <span className="text-sm opacity-70">kg</span></p>
                        </motion.div>
                    )}
                </div>

                {calculated1RM && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                {context?.onSelectTargetPct ? "Välj arbets-procent (% av 1RM)" : "Procent av 1RM"}
                            </p>
                            {context?.activeTargetPct ? (
                                <span className="text-[10px] font-black text-primary uppercase">
                                    Aktivt: {context.activeTargetPct}%
                                </span>
                            ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {percentages.map(p => {
                                const weight = Math.round((calculated1RM as number) * (p / 100) * 2) / 2;
                                const formattedWeight = weight.toString().replace('.', ',');
                                const reps = getRepsForPercentage(p);
                                const isActive = context?.activeTargetPct === p;
                                const isClickable = !!(context?.onSelectTargetPct || context?.onSelectWeight);
                                return (
                                    <button 
                                        key={p} 
                                        onClick={() => {
                                            if (context?.onSelectTargetPct) {
                                                context.onSelectTargetPct(p);
                                            }
                                            if (context?.onSelectWeight) {
                                                context.onSelectWeight(weight);
                                            }
                                            if (context?.onSelectTargetPct || context?.onSelectWeight) {
                                                onClose();
                                            }
                                        }}
                                        disabled={!isClickable}
                                        className={`p-3 rounded-xl flex justify-between items-center transition-all ${
                                            isActive
                                                ? 'bg-primary text-white shadow-md ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900'
                                                : isClickable
                                                    ? 'bg-primary/5 border border-primary/20 hover:bg-primary/10 active:scale-[0.98]'
                                                    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className={`text-sm font-black ${isActive ? 'text-white' : isClickable ? 'text-primary' : 'text-gray-400'}`}>{p}%</span>
                                            <span className={`text-xs font-black ${isActive ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                {formattedWeight} kg <span className="opacity-80">· ~{reps} reps</span>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {context?.activeTargetPct && context?.onSelectTargetPct && context?.activePctSource === 'session' && (
                    <div>
                        <button 
                            onClick={() => {
                                context.onSelectTargetPct?.(null);
                                onClose();
                            }}
                            className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition text-sm"
                        >
                            Ta bort mitt val ({context.activeTargetPct} %)
                        </button>
                    </div>
                )}
                
                <div className="pt-2">
                    <button onClick={onClose} className="w-full py-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition">Stäng kalkylator</button>
                </div>
            </div>
        </Modal>
    );
};
