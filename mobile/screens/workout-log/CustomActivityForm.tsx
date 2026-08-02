import React, { useState, useEffect } from 'react';
import { TimeInput } from './utils';

export const CustomActivityForm: React.FC<{
  activityName: string; duration: string; distance: string; calories: string; onUpdate: (field: string, value: string) => void; isQuickMode?: boolean; hasExercises?: boolean; organizationConfig?: any; attemptedSubmit?: boolean;
}> = ({ activityName, duration, distance, calories, onUpdate, isQuickMode, hasExercises, organizationConfig, attemptedSubmit }) => {
    const [isExpanded, setIsExpanded] = useState(!hasExercises);
    const commonActivities = organizationConfig?.commonActivities || ["Funktionell Träning", "HIIT", "Löpning", "Promenad", "Workout", "Yoga", "Cykling", "Simning", "Racketsport", "Vardagsmotion", "Styrketräning"];

    useEffect(() => {
        setIsExpanded(!hasExercises);
    }, [hasExercises]);

    const isNameInvalid = !!(attemptedSubmit && !hasExercises && activityName.trim() === '');
    const isDurationInvalid = !!(attemptedSubmit && !hasExercises && (duration.trim() === '' || duration.trim() === '0' || duration.trim() === '00:00'));

    if (hasExercises && !isExpanded) {
        return (
            <div className="py-2 animate-fade-in">
                <button 
                    onClick={() => setIsExpanded(true)}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-4 rounded-3xl flex items-center justify-between text-left transition-all active:scale-95"
                >
                    <div>
                        <h3 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest">Generell Aktivitet</h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                            Frivilligt: Ange namn, konditionstid eller distans för passet
                        </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 py-2 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm relative">
                {hasExercises && (
                    <button 
                        onClick={() => setIsExpanded(false)}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                )}
                
                {!isQuickMode && (
                    <>
                        <h3 className="text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Vanliga aktiviteter</h3>
                        <div className="flex flex-wrap gap-2.5">
                            {commonActivities.map((act: string) => (
                                <button key={act} onClick={() => onUpdate('name', act)} className={`px-4.5 py-3 rounded-2xl text-sm font-extrabold border-2 transition-all active:scale-95 ${activityName === act ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-102 font-black' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{act}</button>
                            ))}
                        </div>
                    </>
                )}
                <div className={`mt-4 space-y-5 ${isQuickMode ? 'mt-0' : 'mt-8'}`}>
                    <div>
                        <label className="block text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2">Aktivitet {!hasExercises && '*'}</label>
                        <input value={activityName} onChange={(e) => onUpdate('name', e.target.value)} placeholder={hasExercises ? "T.ex. Funktionellt (Frivilligt)" : "T.ex. Powerwalk"} disabled={isQuickMode} className={`w-full text-xl font-black text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border-2 shadow-sm focus:ring-2 transition-all ${
                            isNameInvalid 
                                ? 'border-red-500 focus:ring-red-500 shadow-sm shadow-red-500/10 focus:border-red-500' 
                                : 'border-gray-100 dark:border-gray-700 focus:ring-primary'
                        } ${isQuickMode ? 'opacity-70' : ''}`} />
                        {isNameInvalid && (
                            <p className="text-red-500 dark:text-red-400 text-xs font-bold pl-1 mt-1.5 flex items-center gap-1 animate-fade-in">
                                <span>●</span> Du måste ange aktivitetens namn (t.ex. Powerwalk).
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2">Tid (min:sek) {!hasExercises && '*'}</label>
                        <TimeInput value={duration} onChange={(val) => onUpdate('duration', val)} placeholder="60" className="w-full" error={isDurationInvalid} />
                        {isDurationInvalid && (
                            <p className="text-red-500 dark:text-red-400 text-xs font-bold pl-1 mt-1.5 flex items-center gap-1 animate-fade-in">
                                <span>●</span> Du måste ange en tid i minuter (t.ex. 45).
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2">Kcal</label>
                            <input type="number" value={calories} onChange={(e) => onUpdate('calories', e.target.value)} placeholder="T.ex. 350" className="w-full font-black text-xl text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2">Distans (km)</label>
                            <input type="number" value={distance} onChange={(e) => onUpdate('distance', e.target.value)} placeholder="T.ex. 5.3" className="w-full font-black text-xl text-gray-900 dark:text-white focus:outline-none bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
