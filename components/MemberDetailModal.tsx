import React, { useState, useEffect, useMemo } from 'react';
import { Member, WorkoutLog, SmartGoalDetail, PersonalBest } from '../types';
import { Modal } from './ui/Modal';
import { getMemberLogs, listenToPersonalBests } from '../services/firebaseService';
import { analyzeMemberProgress, MemberProgressAnalysis } from '../services/geminiService';
import { ChartBarIcon, SparklesIcon, DumbbellIcon, FireIcon } from './icons';
import { useStudio } from '../context/StudioContext';
import { MapPinIcon } from 'lucide-react';
import { calculateAge } from '../utils/dateUtils';
import { getYearWeek, getMemberLocationIds } from '../utils/workoutUtils';
import { getAgeFromBirthDate, findLift1RM, getStrengthScore } from '../utils/fitnessBenchmarks';
import { buildStrengthScoreHistory, buildRowingScoreHistory, getDaysSinceLastLog, getSessionsPerWeek } from '../utils/memberProgress';
import { LEVEL_NAMES, ROWING_LEVEL_NAMES } from '../data/fitnessStandards';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MemberDetailModalProps {
    visible: boolean;
    member: Member;
    onClose: () => void;
}

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

const ScoreCard: React.FC<{
    label: string;
    score: number | null;
    accent: string;
    emptyText: string;
    history: { date: string; score: number; label?: string }[];
    tooltipName: string;
    levelNames: string[];
}> = ({ label, score, accent, emptyText, history, tooltipName, levelNames }) => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        {score !== null ? (
            <>
                <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none">{score}</span>
                    <span className="text-sm font-bold text-gray-400">/ 100</span>
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                        {levelNames[Math.min(5, Math.floor(score / 20))] || levelNames[0]}
                    </span>
                </div>
                {history.length >= 2 ? (
                    <div className="h-36 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(value: number, _name: string, props: any) => [
                                        props?.payload?.label ? `${value} poäng · ${props.payload.label}` : `${value} poäng`,
                                        tooltipName
                                    ]}
                                    labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                                />
                                <Line type="monotone" dataKey="score" stroke={accent} strokeWidth={3} dot={{ r: 3, fill: accent, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, fill: accent, strokeWidth: 0 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Bara ett mättillfälle än. Kurvan ritas när det finns fler.</p>
                )}
            </>
        ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{emptyText}</p>
        )}
    </div>
);

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ visible, member, onClose }) => {
    const { selectedOrganization } = useStudio();
    const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
    const [pbs, setPbs] = useState<PersonalBest[]>([]);
    const [analysis, setAnalysis] = useState<MemberProgressAnalysis | null>(null);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'insights'>('overview');

    const targetId = member?.id || member?.uid || '';

    useEffect(() => {
        if (visible && member) {
            setActiveTab('overview');
            const loadData = async () => {
                try {
                    if (!targetId) return;
                    const logs = await getMemberLogs(targetId);
                    setRecentLogs(logs);
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
            setRecentLogs([]);
            setPbs([]);
            setAnalysis(null);
            setIsLoadingAnalysis(false);
        }
    }, [visible, member, targetId]);

    useEffect(() => {
        if (!visible || !targetId) return;
        const unsubscribe = listenToPersonalBests(targetId, setPbs);
        return () => unsubscribe();
    }, [visible, targetId]);

    const streak = useMemo(() => calculateWeeklyStreak(recentLogs), [recentLogs]);
    const daysSinceLastLog = useMemo(() => getDaysSinceLastLog(recentLogs), [recentLogs]);
    const sessionsPerWeek = useMemo(() => getSessionsPerWeek(recentLogs, 8), [recentLogs]);

    const memberAge = getAgeFromBirthDate(member?.birthDate) ?? (typeof member?.age === 'number' ? member.age : null);
    const memberBodyWeight = typeof member?.bodyWeight === 'number' && member.bodyWeight > 0 ? member.bodyWeight : null;
    const memberGender = member?.gender;

    const strengthScore = useMemo(() => {
        const result = getStrengthScore(
            { squat: findLift1RM(pbs, 'squat'), bench: findLift1RM(pbs, 'bench'), deadlift: findLift1RM(pbs, 'deadlift') },
            memberGender, memberAge, memberBodyWeight
        );
        return result ? result.score : null;
    }, [pbs, memberGender, memberAge, memberBodyWeight]);

    const strengthHistory = useMemo(
        () => buildStrengthScoreHistory(recentLogs, memberGender, memberAge, memberBodyWeight),
        [recentLogs, memberGender, memberAge, memberBodyWeight]
    );

    const rowingHistory = useMemo(
        () => buildRowingScoreHistory(recentLogs, memberGender, memberAge),
        [recentLogs, memberGender, memberAge]
    );

    const conditioningScore = rowingHistory.length > 0 ? rowingHistory[rowingHistory.length - 1].score : null;

    const baseLifts = useMemo(() => ([
        { key: 'squat' as const, title: 'Knäböj', value: findLift1RM(pbs, 'squat') },
        { key: 'bench' as const, title: 'Bänkpress', value: findLift1RM(pbs, 'bench') },
        { key: 'deadlift' as const, title: 'Marklyft', value: findLift1RM(pbs, 'deadlift') }
    ]), [pbs]);

    if (!visible) return null;

    const smart = member.goals?.smartCriteria;

    const statusTone = daysSinceLastLog === null
        ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400'
        : daysSinceLastLog <= 10
            ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50 text-green-800 dark:text-green-300'
            : daysSinceLastLog <= 20
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50 text-amber-800 dark:text-amber-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50 text-red-800 dark:text-red-300';

    const statusText = daysSinceLastLog === null
        ? 'Har inte loggat något pass än.'
        : daysSinceLastLog === 0
            ? `Loggade ett pass i dag. ${sessionsPerWeek} pass i veckan senaste två månaderna.`
            : `Loggade senast för ${daysSinceLastLog} ${daysSinceLastLog === 1 ? 'dag' : 'dagar'} sedan. ${sessionsPerWeek} pass i veckan senaste två månaderna.`;

    const tabs: { id: 'overview' | 'progress' | 'insights'; label: string }[] = [
        { id: 'overview', label: 'Översikt' },
        { id: 'progress', label: 'Utveckling' },
        { id: 'insights', label: 'Insikter' }
    ];

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
                            {(member.birthDate || member.age) && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    Ålder: <span className="font-medium text-gray-600 dark:text-gray-300">{calculateAge(member.birthDate, member.age)}</span>
                                    {member.birthDate && <span className="ml-1">({member.birthDate})</span>}
                                </p>
                            )}
                            <div className="flex gap-2 mt-2 flex-wrap">
                                {member.role === 'coach' && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">Coach</span>}
                                {member.isTrainingMember && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Medlem</span>}
                                {(() => {
                                    const locIds = getMemberLocationIds(member);
                                    if (locIds.length > 0 && selectedOrganization?.locations) {
                                        const names = locIds.map(id => selectedOrganization.locations.find(l => l.id === id)?.name || id);
                                        return (
                                            <span className="bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                                                <MapPinIcon className="w-3 h-3" />
                                                {names.join(', ')}
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
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

                <div className={`px-4 py-3 rounded-2xl border text-sm font-medium ${statusTone}`}>
                    {statusText}
                </div>

                <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-fade-in">
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
                )}

                {activeTab === 'progress' && (
                    <div className="space-y-6 animate-fade-in">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Samma siffror som medlemmen ser i appen. Poängen räknas ur loggade vikter och tider och är justerade för ålder, kön och kroppsvikt.
                        </p>

                        <ScoreCard
                            label="Styrkepoäng"
                            score={strengthScore}
                            accent="#4f46e5"
                            emptyText="Kräver loggade resultat i knäböj, bänkpress och marklyft, samt kön, födelsedatum och kroppsvikt i medlemmens profil."
                            history={strengthHistory}
                            tooltipName="Styrkepoäng"
                            levelNames={LEVEL_NAMES}
                        />

                        <ScoreCard
                            label="Konditionspoäng"
                            score={conditioningScore}
                            accent="#14b8a6"
                            emptyText="Kräver ett genomfört 2000 m roddtest, samt kön och födelsedatum i medlemmens profil."
                            history={rowingHistory}
                            tooltipName="Konditionspoäng"
                            levelNames={ROWING_LEVEL_NAMES}
                        />

                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <DumbbellIcon className="w-4 h-4 text-gray-400" />
                                <h4 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Personbästa, baslyft</h4>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {baseLifts.map(lift => (
                                    <div key={lift.key} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{lift.title}</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                            {lift.value ? `${Math.round(lift.value)}` : '–'}
                                            {lift.value ? <span className="text-xs font-bold text-gray-400 ml-1">kg</span> : null}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'insights' && (
                    <div className="space-y-6 animate-fade-in">
                        {isLoadingAnalysis ? (
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-8 border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-gray-400 text-sm font-bold uppercase tracking-widest">AI:n läser medlemmens pass...</span>
                            </div>
                        ) : analysis ? (
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

                                <p className="text-[10px] text-gray-400 mt-4">
                                    Texten är AI-genererad ur medlemmens loggade pass och formuleras olika vid varje tillfälle. Läs den som uppslag inför samtalet med medlemmen, inte som ett färdigt program. Siffrorna under Utveckling är däremot alltid desamma.
                                </p>
                            </div>
                        ) : !isLoadingAnalysis && recentLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center px-4 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-full mb-3 shadow-sm">
                                    <ChartBarIcon className="w-6 h-6 text-gray-300" />
                                </div>
                                <p className="text-sm text-gray-900 dark:text-white font-bold mb-1">Ingen analys tillgänglig</p>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Medlemmen har inte loggat några pass än.
                                </p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </Modal>
    );
};
