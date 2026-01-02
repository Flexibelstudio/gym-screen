
import React from 'react';
import { Member } from '../types';
import { UsersIcon, SparklesIcon, ChartBarIcon, DumbbellIcon, HeartIcon, LightningIcon } from './icons';

interface MemberDetailScreenProps {
    memberId: string | null;
    onBack: () => void;
}

export const MemberDetailScreen: React.FC<MemberDetailScreenProps> = ({ memberId, onBack }) => {
    // Mock Data based on ID (in real app, fetch from DB)
    const memberName = "Anna Andersson";
    const status = "Aktiv";
    const joinDate = "2024-01-15";

    return (
        <div className="w-full max-w-6xl mx-auto p-6 space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={onBack} 
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        {memberName}
                        <span className="text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            {status}
                        </span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Medlem sedan {joinDate}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Profile */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <ChartBarIcon className="w-5 h-5 text-primary" />
                            Fysik-profil
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600 dark:text-gray-300">Styrka</span>
                                    <span className="font-bold text-gray-900 dark:text-white">80%</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600 dark:text-gray-300">Uthållighet</span>
                                    <span className="font-bold text-gray-900 dark:text-white">40%</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '40%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600 dark:text-gray-300">Frekvens</span>
                                    <span className="font-bold text-gray-900 dark:text-white">90%</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Senaste Aktivitet</h3>
                        <ul className="space-y-3">
                            <li className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Igår</span>
                                <span className="font-medium text-gray-900 dark:text-white">Benstyrka (RPE 8)</span>
                            </li>
                            <li className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">3 dagar sen</span>
                                <span className="font-medium text-gray-900 dark:text-white">Konditionspass (RPE 6)</span>
                            </li>
                            <li className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">5 dagar sen</span>
                                <span className="font-medium text-gray-900 dark:text-white">Teknik: Ryck</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Right Column: AI Analysis */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-20">
                            <SparklesIcon className="w-32 h-32" />
                        </div>
                        <div className="relative z-10">
                            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                                <span className="bg-white/20 p-2 rounded-lg"><SparklesIcon className="w-6 h-6" /></span>
                                AI-Coach Analys
                            </h2>
                            
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                                    <h4 className="font-bold text-green-300 mb-2 flex items-center gap-2">
                                        <span className="text-lg">💪</span> Styrkor
                                    </h4>
                                    <p className="text-sm leading-relaxed text-purple-50">
                                        Mycket konsekvent närvaro. Stark utveckling i basövningar som marklyft och knäböj. Visar god återhämtningsförmåga mellan set.
                                    </p>
                                </div>

                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                                    <h4 className="font-bold text-yellow-300 mb-2 flex items-center gap-2">
                                        <span className="text-lg">⚠️</span> Förbättringsområden
                                    </h4>
                                    <p className="text-sm leading-relaxed text-purple-50">
                                        Tappar ofta intensitet i slutet av passen (RPE sjunker drastiskt). Missar ofta rena cardio-delen eller avbryter den för tidigt.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 bg-white text-indigo-900 rounded-xl p-6 shadow-lg">
                                <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <span className="text-2xl">🚀</span> Coach Actions
                                </h4>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2 text-sm font-medium">
                                        <span className="text-indigo-500 mt-1">•</span>
                                        Föreslå PT-timme för att se över pacing-strategi i konditionsdelar.
                                    </li>
                                    <li className="flex items-start gap-2 text-sm font-medium">
                                        <span className="text-indigo-500 mt-1">•</span>
                                        Uppmuntra till att logga vikter noggrannare för att säkerställa progressiv överbelastning.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
