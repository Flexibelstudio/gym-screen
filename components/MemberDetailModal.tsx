import { useState, useEffect, useMemo } from 'react';
import { Member, WorkoutLog, SmartGoalDetail } from '../types';
import { Modal } from './ui/Modal';
import { getMemberLogs } from '../services/firebaseService';
import { analyzeMemberProgress, MemberProgressAnalysis } from '../services/geminiService';
import { motion } from 'framer-motion';
import { ChartBarIcon, SparklesIcon, InformationCircleIcon, DumbbellIcon, FireIcon } from './icons';

interface MemberDetailModalProps {
    visible: boolean;
    member: Member;
    onClose: () => void;
}

const getYearWeek = (date: Date) => {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
};

const calculateWeeklyStreak = (logs: WorkoutLog[]) => {
    if (logs.length === 0) return 0;
    const activeWeeks = new Set(logs.map(log => getYearWeek(new Date(log.date))));
    const now = new Date();
    let streak = 0;
    let checkDate = new Date(now);
    
    // Kolla om de tränat denna vecka
    const currentWeekKey = getYearWeek(checkDate);
    const hasTrainedThisWeek = activeWeeks.has(currentWeekKey);
    
    if (hasTrainedThisWeek) {
        streak = 1;
    } else {
        // Om inte denna vecka, kolla förra veckan för att se om streaken fortfarande lever
        checkDate.setDate(checkDate.getDate() - 7);
        const lastWeekKey = getYearWeek(checkDate);
        if (activeWeeks.has(lastWeekKey)) {
            streak = 1;
        } else {
            return 0; // Ingen aktivitet varken denna eller förra veckan
        }
    }

    // Räkna bakåt så länge vi hittar aktiva veckor
    while (true) {
        checkDate.setDate(checkDate.getDate() - 7);
        const prevWeekKey = getYearWeek(checkDate);
        if (activeWeeks.has(prevWeekKey)) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
};

const SmartItem: React.FC<{ letter: string, color: string, title: string, text: string }> = ({ letter, color, title, text }) => (
    <div className="flex gap-4 group">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm transition-transform group-hover:scale-110`}>
            {letter}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{title}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{text || 'Ej angivet.'}</p>
        </div>
    </div>
);

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ visible, member, onClose }) => {
    const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
    const [analysis, setAnalysis] = useState<MemberProgressAnalysis | null>(null);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        if (visible && member) {
            const loadData = async () => {
                try {
                    const targetId = member.id || member.uid;
                    if (!targetId) return;

                    // 1. Hämta loggar först (detta går snabbt)
                    const logs = await getMemberLogs(targetId);
                    setRecentLogs(logs);
                    
                    // 2. Starta AI-analys om det finns loggar
                    if (logs.length > 0) {
                        setIsLoadingAnalysis(true);
                        const result = await analyzeMemberProgress(logs, member.firstName, member.goals);
                        setAnalysis(result);
                        setIsLoadingAnalysis(false);
                    }
                } catch (e) {
                    console.error("Data fetch error:", e);
                    setIsLoadingAnalysis(false);
                }
            }
            loadData();
        } else {
            // Reset state when closing
            setRecentLogs([]);
            setAnalysis(null);
            setIsLoadingAnalysis(false);
        }
    }, [visible, member]);

    const streak = useMemo(() => calculateWeeklyStreak(recentLogs), [recentLogs]);

    if (!visible) return null;

    const smart = member.goals?.smartCriteria;

    return (
        <Modal isOpen={visible} onClose={onClose} title={`${member.firstName} ${member.lastName}`} size="lg">
            <div className="space-y-8 pb-4">
                {/* Header Info */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-6">
                    <div className="flex items-center gap-4">
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

                    {/* Streak Indicator for Coach */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-2xl border border-orange-100 dark:border-orange-800/50 flex items-center gap-3 shadow-sm">
                        <div className="relative">
                            <FireIcon className={`w-6 h-6 ${streak > 0 ? 'text-orange-500 animate-pulse' : 'text-gray-300'}`} />
                            {streak > 0 && <div className="absolute inset-0 bg-orange-400 blur-md opacity-20 animate-pulse"></div>}
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest leading-none mb-0.5">Streak</p>
                            <p className="text-xl font-black text-orange-700 dark:text-orange-300 leading-none">{streak} <span className="text-[10px] font-bold">VECKOR</span></p>
                        </div>
                    </div>
                </div>

                {/* --- SMARTA MÅL --- */}
                {member.goals?.hasSpecificGoals && (
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Målanalys (SMART)</h3>
                            <span className="text-xl">🎯</span>
                        </div>

                        <div className="space-y-5 relative">
                            {smart ? (
                                <>
                                    <SmartItem letter="S" color="bg-blue-500" title="Specifikt" text={smart.specific} />
                                    <SmartItem letter="M" color="bg-emerald-500" title="Mätbart" text={smart.measurable} />
                                    <SmartItem letter="A" color="bg-orange-500" title="Accepterat" text={smart.achievable} />
                                    <SmartItem letter="R" color="bg-rose-500" title="Relevant" text={smart.relevant} />
                                </>
                            ) : (
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                    <p className="text-xs text-gray-400 italic">SMART-analys saknas.</p>
                                </div>
                            )}
                            <SmartItem letter="T" color="bg-indigo-500" title="Tid" text={member.goals?.targetDate || 'Ingen deadline.'} />
                        </div>
                    </div>
                )}

                {/* --- AI SEKTION (Fysik-index & Insikter) --- */}
                <div className="space-y-6">
                    {isLoadingAnalysis ? (
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-8 border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-gray-400 text-sm font-bold uppercase tracking-widest">AI:n beräknar fysik-index...</span>
                        </div>
                    ) : analysis ? (
                        <>
                            {/* FYSIK-INDEX */}
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

                                <div className="space-y-6">
                                    {[
                                        { label: 'Styrka', val: analysis.metrics.strength || 50, color: 'bg-red-500' },
                                        { label: 'Kondition', val: analysis.metrics.endurance || 50, color: 'bg-blue-500' },
                                        { label: 'Frekvens', val: analysis.metrics.frequency || 50, color: 'bg-green-500' }
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
                            </div>

                            {/* AI-COACH INSIKTER */}
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 p-6 rounded-2xl border border-indigo-100 dark:border-gray-700 shadow-sm">
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
                        </>
                    ) : !isLoadingAnalysis && recentLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-full mb-3 shadow-sm">
                                <ChartBarIcon className="w-6 h-6 text-gray-300" />
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white font-bold mb-1">Ingen data tillgänglig</p>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Medlemmen har inte loggat några pass än, så fysik-indexet kan inte beräknas.
                            </p>
                        </div>
                    ) : null}
                </div>

                {/* --- SEKTION: SENASTE PASS --- */}
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Senaste aktivitet</h4>
                        <span className="text-[10px] font-bold text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded uppercase">{recentLogs.length} pass totalt</span>
                    </div>
                    
                    <div className="space-y-3">
                        {recentLogs.length > 0 ? (
                            recentLogs.slice(0, 5).map(log => (
                                <div key={log.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary/20 transition-colors">
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white">{log.workoutTitle}</p>
                                        <p className="text-xs text-gray-500">{new Date(log.date).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {log.feeling && (
                                            <span className="text-sm" title="Känsla">
                                                {log.feeling === 'good' ? '🔥' : log.feeling === 'bad' ? '🤕' : '🙂'}
                                            </span>
                                        )}
                                        {log.rpe && (
                                            <div className="px-2 py-1 bg-white dark:bg-black rounded-lg border border-gray-100 dark:border-gray-700 text-[10px] font-black text-gray-600 dark:text-gray-400 shadow-sm">
                                                RPE {log.rpe}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-100 dark:border-gray-800">
                                <p className="text-sm text-gray-400 italic">Inga pass registrerade än.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};