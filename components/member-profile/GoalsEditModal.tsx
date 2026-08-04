import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MemberGoals, SmartGoalDetail } from '../../types';
import { Modal } from '../ui/Modal';
import { ToggleSwitch } from '../icons';

export const GoalsEditModal: React.FC<{ currentGoals?: MemberGoals, onSave: (goals: MemberGoals) => void, onClose: () => void }> = ({ currentGoals, onSave, onClose }) => {
    const [selectedGoals, setSelectedGoals] = useState<string[]>(currentGoals?.selectedGoals || []);
    const [targetDate, setTargetDate] = useState(currentGoals?.targetDate || '');
    const [isSmartEnabled, setIsSmartEnabled] = useState(!!currentGoals?.smartCriteria);
    const [smart, setSmart] = useState<SmartGoalDetail>(currentGoals?.smartCriteria || { specific: '', measurable: '', achievable: '', relevant: '', timeBound: '' });
    
    const toggleGoal = (goal: string) => setSelectedGoals(selectedGoals.includes(goal) ? selectedGoals.filter(g => g !== goal) : [...selectedGoals, goal]);
    
    const handleClear = () => {
        setSelectedGoals([]);
        setTargetDate('');
        setIsSmartEnabled(false);
        setSmart({ specific: '', measurable: '', achievable: '', relevant: '', timeBound: '' });
    };

    const handleSave = () => {
        const isNewGoalText = currentGoals?.smartCriteria?.specific !== (isSmartEnabled ? smart.specific : undefined);
        const isNewTargetDate = currentGoals?.targetDate !== targetDate;
        const startDate = (isNewGoalText || isNewTargetDate || !currentGoals?.startDate)
            ? new Date().toISOString().split('T')[0]
            : currentGoals.startDate;

        onSave({
            hasSpecificGoals: selectedGoals.length > 0 || (isSmartEnabled && !!smart.specific),
            selectedGoals,
            targetDate,
            startDate,
            smartCriteria: isSmartEnabled ? smart : undefined
        });
    };
    
    const inputClasses = "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all font-medium";
    const labelClasses = "block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1";
    
    return (
        <Modal isOpen={true} onClose={onClose} title="Sätt dina mål" size="md">
            <div className="space-y-8">
                <div className="flex justify-end">
                    <button onClick={handleClear} className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors uppercase tracking-wider">
                        Börja om / Rensa
                    </button>
                </div>
                <div><label className={labelClasses}>Målkategorier</label><div className="flex flex-wrap gap-2">{['Bli starkare', 'Bygga muskler', 'Gå ner i vikt', 'Bättre kondition', 'HYROX', 'Må bra', 'Rörlighet'].map(goal => (<button key={goal} onClick={() => toggleGoal(goal)} className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${selectedGoals.includes(goal) ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-transparent hover:border-gray-300'}`}>{goal}</button>))}</div></div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50"><ToggleSwitch label="Använd SMART-metoden" checked={isSmartEnabled} onChange={setIsSmartEnabled} /><p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mt-2 ml-1">För dig som vill vara extra tydlig</p></div>
                <AnimatePresence>{isSmartEnabled && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                    <div><label className={labelClasses}>S - Specifikt (Vad exakt?)</label><input value={smart.specific} onChange={e => setSmart({...smart, specific: e.target.value})} className={inputClasses} placeholder="T.ex. Klara 5 chins eller 100kg i knäböj" /></div>
                    <div><label className={labelClasses}>M - Mätbart (Hur vet vi?)</label><input value={smart.measurable} onChange={e => setSmart({...smart, measurable: e.target.value})} className={inputClasses} placeholder="T.ex. Genom antal repetitioner eller kg på stången" /></div>
                    <div><label className={labelClasses}>A - Accepterat (Är det rimligt?)</label><input value={smart.achievable} onChange={e => setSmart({...smart, achievable: e.target.value})} className={inputClasses} placeholder="T.ex. Ja, jag tränar 3 gånger i veckan" /></div>
                    <div><label className={labelClasses}>R - Relevant (Varför är det viktigt?)</label><input value={smart.relevant} onChange={e => setSmart({...smart, relevant: e.target.value})} className={inputClasses} placeholder="T.ex. För att känna mig starkare i vardagen" /></div>
                </motion.div>)}</AnimatePresence>
                <div><label className={labelClasses}>T - Tidsbestämt (Måldatum)</label><input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={inputClasses} /></div>
                <button onClick={handleSave} className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-widest">Spara Mål</button>
            </div>
        </Modal>
    );
};
