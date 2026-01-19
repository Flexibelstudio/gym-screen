
import React from 'react';
import { LockClosedIcon } from '../icons';

interface FeatureLockedViewProps { 
    title: string; 
    description: string; 
    features: string[];
    onActivate: () => void;
}

export const FeatureLockedView: React.FC<FeatureLockedViewProps> = ({ title, description, features, onActivate }) => (
    <div className="max-w-3xl mx-auto py-12 px-6 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 dark:border-gray-700 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <LockClosedIcon className="w-64 h-64" />
            </div>
            
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <LockClosedIcon className="w-10 h-10" />
            </div>
            
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">{title}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 leading-relaxed">
                {description}
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 mb-10 text-left border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-widest text-xs">Detta ingår i paketet:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    {features.map((f, i) => (
                        <div key={i} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                            <span className="text-primary font-bold">✓</span>
                            <span className="font-medium">{f}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <button 
                onClick={onActivate}
                className="bg-primary hover:brightness-110 text-white font-black py-4 px-10 rounded-2xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-1 active:scale-95"
            >
                Gå till Aktivering 🚀
            </button>
        </div>
    </div>
);
