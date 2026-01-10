import React, { useState, useEffect } from 'react';
import { Member, WorkoutLog } from '../types';
import { Modal } from './ui/Modal';
import { getMemberLogs } from '../services/firebaseService';
import { analyzeMemberProgress, MemberProgressAnalysis } from '../services/geminiService';
import { motion } from 'framer-motion';
import { ChartBarIcon, SparklesIcon, InformationCircleIcon, DumbbellIcon } from './icons';

interface MemberDetailModalProps {
    visible: boolean;
    member: Member;
    onClose: () => void;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ visible, member, onClose }) => {
    const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
    const [analysis, setAnalysis] = useState<MemberProgressAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        if (visible && member) {
            const loadData = async () => {
                setIsLoading(true);
                try {
                    const logs = await getMemberLogs(member.uid);
                    setRecentLogs(logs);
                    
                    // Kör alltid analysen om det finns data
                    if (logs.length > 0) {
                        const result = await analyzeMemberProgress(logs, member.firstName, member.goals);
                        setAnalysis(result);
                    } else {
                        setAnalysis(null);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoading(false);
                }
            }
            loadData();
        }
    }, [visible, member]);

    if (!visible) return null;

    return (
        <Modal isOpen={visible} onClose={onClose} title={`${member.firstName} ${member.lastName}`} size="lg">
            <div className="space-y-8 pb-4">
                {/* Header Info */}
                <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-700 pb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary overflow-hidden border border-primary/20">
                        {member.photoUrl ? (
                            <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span>{member.firstName?.[0]}{member.lastName?.[0]}</span>
                        )}
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                        <div className="flex gap-2 mt-2">
                            {member.role === 'coach' && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">Coach</span>}
                            {member.isTrainingMember && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Medlem</span>}
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-12 text-center flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-400 text-sm font-medium">Hämtar data och genererar analys...</span>
                    </div>
                ) : (
                    <>
                        {/* --- SEKTION 1: FYSIK-INDEX (Visualisering) --- */}
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
                                    <p className="mb-1">AI:n analyserar de senaste 20 passen för att skapa en profil:</p>
                                    <ul className="space-y-1 ml-1">
                                        <li className="flex gap-2"><span className="text-red-500">●</span> <span><strong>Styrka:</strong> Ökar vid tunga lyft och låga repetitioner.</span></li>
                                        <li className="flex gap-2"><span className="text-blue-500">●</span> <span><strong>Kondition:</strong> Ökar vid hög puls, distans och hög volym.</span></li>
                                    </ul>
                                </div>
                            )}

                            {recentLogs.length > 0 ? (
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
                                                <motion.div 
                                                    initial={{ width: 0 }} 
                                                    animate={{ width: `${m.val}%` }} 
                                                    transition={{ duration: 1, ease: "easeOut" }}
                                                    className={`${m.color} h-full rounded-full`} 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-full mb-3 shadow-sm">
                                        <ChartBarIcon className="w-6 h-6 text-gray-300" />
                                    </div>
                                    <p className="text-sm text-gray-900 dark:text-white font-bold mb-1">Ingen data tillgänglig</p>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Medlemmen har inte loggat några pass än.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* --- SEKTION 2: AI-ANALYS (Textanalys för coachen) --- */}
                        {analysis && (
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 p-6 rounded-2xl border border-indigo-100 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="bg-white/80 p-1.5 rounded-lg shadow-sm">
                                        <SparklesIcon className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-wider">
                                        AI-Coach Insikter
                                    </h4>
                                </div>
                                
                                <div className="grid md:grid-cols-2 gap-6 mb-6">
                                    <div className="bg-white/60 dark:bg-black/20 p-4 rounded-xl">
                                        <p className="font-bold text-indigo-900 dark:text-indigo-200 text-xs uppercase tracking-wide mb-2">Styrkor</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.strengths}</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-black/20 p-4 rounded-xl">
                                        <p className="font-bold text-indigo-900 dark:text-indigo-200 text-xs uppercase tracking-wide mb-2">Utvecklingsområden</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.improvements}</p>
                                    </div>
                                </div>

                                {analysis.actions.length > 0 && (
                                    <div className="bg-indigo-100/50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                        <p className="font-bold text-indigo-900 dark:text-indigo-200 text-xs uppercase tracking-wide mb-3">Rekommenderade åtgärder</p>
                                        <ul className="space-y-2">
                                            {analysis.actions.map((action, i) => (
                                                <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                    <span className="text-indigo-500 font-bold">•</span>
                                                    {action}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- SEKTION 3: SENASTE PASS (Lista) --- */}
                        <div className="mt-8">
                            <h4 className="font-black text-gray-400 uppercase tracking-widest text-[10px] mb-4">Senaste aktivitet</h4>
                            <div className="space-y-3">
                                {recentLogs.slice(0, 5).map(log => (
                                    <div key={log.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-white">{log.workoutTitle}</p>
                                            <p className="text-xs text-gray-500">{new Date(log.date).toLocaleDateString()}</p>
                                        </div>
                                        {log.rpe && (
                                            <div className="px-2 py-1 bg-white dark:bg-black rounded-lg border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-400">
                                                RPE {log.rpe}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {recentLogs.length === 0 && (
                                    <p className="text-sm text-gray-400 italic text-center py-4">Inga pass registrerade.</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};