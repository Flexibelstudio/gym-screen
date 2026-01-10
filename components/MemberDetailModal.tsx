
import React, { useState, useEffect } from 'react';
import { Member, WorkoutLog } from '../types';
import { Modal } from './ui/Modal';
import { getMemberLogs } from '../services/firebaseService';
import { analyzeMemberProgress, MemberProgressAnalysis } from '../services/geminiService';
import { motion } from 'framer-motion';
import { ChartBarIcon, SparklesIcon, InformationCircleIcon } from './icons';

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
                    if (logs.length > 0) {
                        const result = await analyzeMemberProgress(logs, member.firstName, member.goals);
                        setAnalysis(result);
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
            <div className="space-y-6">
                <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-700 pb-6">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl font-bold text-gray-500 overflow-hidden">
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
                    <div className="py-12 text-center text-gray-400">Laddar analys...</div>
                ) : (
                    <>
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
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${m.val}%` }} className={`${m.color} h-full rounded-full`} />
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
                                    <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-medium px-3 py-2 rounded-lg">
                                        Tips: Uppmuntra medlemmen att logga sina resultat i appen för att generera analysen.
                                    </div>
                                </div>
                            )}
                        </div>

                        {analysis && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <SparklesIcon className="w-4 h-4 text-purple-500" />
                                    AI-Coach Insikter
                                </h4>
                                <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide mb-1">Styrkor</p>
                                        <p>{analysis.strengths}</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide mb-1">Utvecklingsområden</p>
                                        <p>{analysis.improvements}</p>
                                    </div>
                                    {analysis.actions.length > 0 && (
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide mb-1">Rekommenderade åtgärder</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {analysis.actions.map((action, i) => (
                                                    <li key={i}>{action}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};
