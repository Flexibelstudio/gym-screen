
import React from 'react';
import { Member } from '../types';
import { CloseIcon, ChartBarIcon, SparklesIcon, DumbbellIcon } from './icons';

interface MemberDetailModalProps {
    visible: boolean;
    onClose: () => void;
    member: Member | null;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ visible, onClose, member }) => {
    if (!visible || !member) return null;

    // Mock Analysis Data (In a real app, this would be fetched based on member.id)
    const stats = {
        strength: 75,
        endurance: 60,
        frequency: 85,
        recentActivity: [
            { label: 'Igår', desc: 'Benstyrka (RPE 8)' },
            { label: '3 dagar sen', desc: 'Konditionspass (RPE 6)' },
            { label: '5 dagar sen', desc: 'Teknik: Ryck' },
        ]
    };

    return (
        <div className="fixed inset-0 z-[1002] flex items-center justify-center p-4">
            {/* Overlay */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
                onClick={onClose}
            ></div>

            {/* Container */}
            <div 
                className="relative bg-white dark:bg-gray-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-zoom-fade-in border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button (Absolute) */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full bg-gray-100/50 hover:bg-gray-200 dark:bg-gray-800/50 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors backdrop-blur-sm"
                    aria-label="Stäng"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-4 p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 pr-16">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {member.firstName[0]}{member.lastName[0]}
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3 flex-wrap">
                            {member.firstName} {member.lastName}
                            <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${member.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                {member.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                            </span>
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto p-6 md:p-8 space-y-8 bg-gray-50 dark:bg-black/20">
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Goals, Stats & Profile */}
                        <div className="space-y-6">
                            {/* Goals Section */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                                <div className="relative z-10">
                                    <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                                        <span className="text-2xl">🎯</span> Medlemmens Mål
                                    </h3>
                                    {member.goals?.hasSpecificGoals ? (
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                {member.goals.selectedGoals.map(g => (
                                                    <span key={g} className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-sm font-medium border border-white/10">
                                                        {g}
                                                    </span>
                                                ))}
                                            </div>
                                            {member.goals.targetDate && (
                                                <p className="text-blue-100 text-xs font-medium mt-2 pt-2 border-t border-white/10">
                                                    Måldatum: <span className="font-mono font-bold">{member.goals.targetDate}</span>
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-blue-100 italic text-sm">Har inte angett specifika mål.</p>
                                    )}
                                </div>
                                {/* Decorative background circle */}
                                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <ChartBarIcon className="w-5 h-5 text-primary" />
                                    Fysik-profil
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-600 dark:text-gray-300">Styrka</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{stats.strength}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-red-500 h-2 rounded-full" style={{ width: `${stats.strength}%` }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-600 dark:text-gray-300">Uthållighet</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{stats.endurance}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.endurance}%` }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-600 dark:text-gray-300">Frekvens</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{stats.frequency}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.frequency}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Senaste Aktivitet</h3>
                                <ul className="space-y-3">
                                    {stats.recentActivity.map((activity, index) => (
                                        <li key={index} className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                            <span className="text-gray-500 dark:text-gray-400">{activity.label}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{activity.desc}</span>
                                        </li>
                                    ))}
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
                                            <p className="text-sm leading-relaxed text-indigo-50">
                                                Mycket konsekvent närvaro. Stark utveckling i basövningar som marklyft och knäböj. Visar god återhämtningsförmåga mellan set.
                                            </p>
                                        </div>

                                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                                            <h4 className="font-bold text-yellow-300 mb-2 flex items-center gap-2">
                                                <span className="text-lg">⚠️</span> Förbättringsområden
                                            </h4>
                                            <p className="text-sm leading-relaxed text-indigo-50">
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
            </div>
        </div>
    );
};
