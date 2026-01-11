import React, { useState, useEffect } from 'react';
import { UserData, WorkoutLog, Page } from '../types';
import { getMemberLogs } from '../services/firebaseService';
import { analyzeMemberProgress, MemberProgressAnalysis } from '../services/geminiService';
import { SparklesIcon, ChartBarIcon, DumbbellIcon, ClockIcon, InformationCircleIcon } from './icons';
import { motion } from 'framer-motion';

interface MemberProfileScreenProps {
    userData: UserData;
    onBack: () => void;
    profileEditTrigger: number;
    navigateTo: (page: Page) => void;
}

export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({ userData, onBack, profileEditTrigger, navigateTo }) => {
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [analysis, setAnalysis] = useState<MemberProgressAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const fetchedLogs = await getMemberLogs(userData.uid);
                setLogs(fetchedLogs);
                if (fetchedLogs.length > 0) {
                    const analysisResult = await analyzeMemberProgress(fetchedLogs, userData.firstName || 'Medlem', userData.goals);
                    setAnalysis(analysisResult);
                }
            } catch (error) {
                console.error("Error fetching profile data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [userData.uid, profileEditTrigger]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64 text-gray-500">Laddar profil...</div>;
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-6 pb-20 animate-fade-in space-y-8">
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl border border-primary/20 overflow-hidden shadow-sm">
                    {userData?.photoUrl ? (
                        <img src={userData.photoUrl} alt="Profil" className="w-full h-full object-cover" />
                    ) : (
                        <span>{userData?.firstName?.[0] || '?'}{userData?.lastName?.[0] || '?'}</span>
                    )}
                </div>
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        {userData?.firstName} {userData?.lastName}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                        {userData?.email}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Fysik-index</h3>
                        <button onClick={() => setShowInfo(!showInfo)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <InformationCircleIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {showInfo && (
                        <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl text-xs text-gray-500 dark:text-gray-400 leading-relaxed border border-gray-100 dark:border-gray-700 animate-fade-in">
                            <p className="font-bold text-gray-700 dark:text-gray-300 mb-2">Hur funkar indexet?</p>
                            <p className="mb-1">AI:n analyserar dina senaste 20 pass för att skapa en profil:</p>
                            <ul className="space-y-1 ml-1">
                                <li className="flex gap-2"><span className="text-red-500">●</span> <span><strong>Styrka:</strong> Ökar vid tunga lyft och låga repetitioner.</span></li>
                                <li className="flex gap-2"><span className="text-blue-500">●</span> <span><strong>Kondition:</strong> Ökar vid hög puls, distans och hög volym.</span></li>
                            </ul>
                        </div>
                    )}

                    {logs.length > 0 ? (
                        <div className="space-y-6">
                            {[
                                { label: 'Styrka', val: analysis?.metrics.strength || 50, color: 'bg-red-500' },
                                { label: 'Kondition', val: analysis?.metrics.endurance || 50, color: 'bg-blue-500' },
                                { label: 'Frekvens', val: analysis?.metrics.frequency || 50, color: 'bg-green-500' }
                            ].map(m => (
                                <div key={m.label}>
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                                        <span className="text-gray-500">{m.label}</span>
                                        <span className="text-gray-900 dark:text-white">{m.val}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${m.val}%` }} className={`${m.color} h-full rounded-full`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-full mb-3 shadow-sm">
                                <SparklesIcon className="w-6 h-6 text-yellow-500" />
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white font-bold mb-1">Din profil skapas snart!</p>
                            <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                                Logga dina träningspass för att låsa upp ditt unika Fysik-index och få personliga insikter.
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                        <h3 className="font-black text-gray-400 mb-6 uppercase tracking-widest text-[10px]">Senaste Aktivitet</h3>
                        <div className="space-y-4">
                            {logs.slice(0, 5).map(log => (
                                <div key={log.id} className="flex items-center justify-between pb-4 border-b border-gray-50 dark:border-gray-800 last:border-0 last:pb-0">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[180px]">
                                            {log.workoutTitle}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(log.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        {log.rpe && <span className="text-xs font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">RPE {log.rpe}</span>}
                                    </div>
                                </div>
                            ))}
                            {logs.length === 0 && (
                                <p className="text-sm text-gray-500 text-center italic py-4">Inga pass loggade än.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {analysis && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 rounded-3xl p-8 border border-indigo-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-6">
                        <SparklesIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-100">AI-Analys</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-2">Styrkor</h4>
                            <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">{analysis.strengths}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-2">Fokusområden</h4>
                            <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">{analysis.improvements}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};