import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { WorkoutLog, BenchmarkDefinition } from '../../types';
import { saveWorkoutLog } from '../../services/firebaseService';
import { ROWING_LEVEL_NAMES } from '../../data/fitnessStandards';
import { getAgeFromBirthDate, getRowingAssessment, formatRowingTime } from '../../utils/fitnessBenchmarks';
import { buildRowingScoreHistory } from '../../utils/memberProgress';
import { TrophyIcon, InformationCircleIcon } from '../icons';
import { Modal } from '../ui/Modal';
import { parseRowingInputTime } from './profileHelpers';

const BenchmarkDetailModal: React.FC<{ 
    benchmark: any, 
    onClose: () => void, 
    onViewLog: (log: WorkoutLog) => void,
    formatResult: (val: number, type: string) => string,
    getUnit: (type: string) => string
}> = ({ benchmark, onClose, onViewLog, formatResult, getUnit }) => {
    const { def, history, pb } = benchmark;
    
    // Prepare chart data
    const chartData = [...history].reverse().map((log: any) => ({
        name: new Date(log.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
        value: log.benchmarkValue,
        fullDate: new Date(log.date).toLocaleDateString('sv-SE'),
    }));

    return (
        <Modal isOpen={true} onClose={onClose} title={def.title} size="lg">
            <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Personbästa</p>
                        <p className="text-2xl font-black text-primary">
                            {formatResult(pb.benchmarkValue, def.type)} <span className="text-sm">{getUnit(def.type)}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Försök</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{history.length}</p>
                    </div>
                </div>

                {history.length > 1 && (
                    <div className="h-48 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} vertical={false} />
                                <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => def.type === 'time' ? formatResult(val, def.type) : val} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }}
                                    formatter={(value: number) => [formatResult(value, def.type) + ' ' + getUnit(def.type), 'Resultat']}
                                    labelFormatter={(label) => `Datum: ${label}`}
                                />
                                <Line type="monotone" dataKey="value" stroke="#14B8A6" strokeWidth={3} dot={{ r: 4, fill: '#14B8A6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-3">Historik</h4>
                    <div className="space-y-2">
                        {history.map((log: any, index: number) => {
                            const isPB = log.id === pb.id;
                            let diffText = null;
                            let isImprovement = false;
                            
                            if (index < history.length - 1) {
                                const prevLog = history[index + 1];
                                const diff = log.benchmarkValue - prevLog.benchmarkValue;
                                if (diff !== 0) {
                                    isImprovement = def.type === 'time' ? diff < 0 : diff > 0;
                                    const diffFormatted = formatResult(Math.abs(diff), def.type);
                                    diffText = isImprovement ? `+${diffFormatted}` : `-${diffFormatted}`;
                                    if (def.type === 'time') {
                                        diffText = isImprovement ? `-${diffFormatted}` : `+${diffFormatted}`;
                                    }
                                }
                            }

                            return (
                                <div 
                                    key={log.id} 
                                    onClick={() => onViewLog(log)}
                                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-white/10 cursor-pointer hover:border-primary/50 transition-colors"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                                                {new Date(log.date).toLocaleDateString('sv-SE')}
                                            </span>
                                            {isPB && <span className="bg-record/10 text-record text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-record/20">PB</span>}
                                        </div>
                                        <div className="flex gap-2 mt-1 text-xs text-gray-500">
                                            {log.feeling && <span>{log.feeling === 'good' ? '🔥' : log.feeling === 'bad' ? '🤕' : '🙂'}</span>}
                                            {log.rpe && <span className="tabular-nums">RPE {log.rpe}</span>}
                                            {log.diploma && <span className="text-record flex items-center gap-1"><TrophyIcon className="w-3 h-3" /> Diplom</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-lg text-gray-900 dark:text-white tabular-nums">
                                            {formatResult(log.benchmarkValue, def.type)} <span className="text-xs font-bold text-gray-500">{getUnit(def.type)}</span>
                                        </div>
                                        {diffText && (
                                            <div className={`text-[10px] font-bold tabular-nums ${isImprovement ? 'text-work' : 'text-danger'}`}>
                                                {diffText} {getUnit(def.type)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const Rowing2000mCard: React.FC<{
    logs: WorkoutLog[];
    userData?: any;
    onOpenProfileEdit?: () => void;
}> = ({ logs, userData, onOpenProfileEdit }) => {
    const [timeInput, setTimeInput] = useState('');
    const [showCustomDistance, setShowCustomDistance] = useState(false);
    const [distanceInput, setDistanceInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const rowingLogs = useMemo(() => {
        return logs
            .filter(l => l.benchmarkId === 'platform_row_2000m' && typeof l.benchmarkValue === 'number' && l.benchmarkValue > 0)
            .sort((a, b) => b.date - a.date);
    }, [logs]);

    const latestAttempt = rowingLogs[0];
    const history = rowingLogs.slice(0, 10);

    const age = getAgeFromBirthDate(userData?.birthDate);
    const gender = userData?.gender;

    const rowingScoreHistory = useMemo(
        () => buildRowingScoreHistory(logs, gender, age),
        [logs, gender, age]
    );

    const latestRowingScore = rowingScoreHistory.length > 0
        ? rowingScoreHistory[rowingScoreHistory.length - 1].score
        : null;

    const latestDistance = latestAttempt ? (latestAttempt.benchmarkDistance ?? 2000) : 2000;
    const isFullTest = latestDistance === 2000;

    const latestAssessment = latestAttempt && isFullTest && (gender === 'male' || gender === 'female') && age !== null
        ? getRowingAssessment(gender, age, latestAttempt.benchmarkValue!)
        : null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        let targetDistance = 2000;
        if (showCustomDistance && distanceInput.trim()) {
            const parsedDist = parseInt(distanceInput.trim(), 10);
            if (isNaN(parsedDist) || parsedDist < 100 || parsedDist > 10000) {
                setErrorMsg('Ange en giltig sträcka mellan 100 och 10 000 m.');
                return;
            }
            targetDistance = parsedDist;
        }

        const seconds = parseRowingInputTime(timeInput);
        if (seconds === null) {
            setErrorMsg('Ange en giltig tid mellan 1:00 och 60:00 (t.ex. 7:15 eller 07:15.3)');
            return;
        }

        const orgId = userData?.organizationId;
        if (!userData?.uid || !orgId) {
            setErrorMsg('Medlemsuppgifter saknas.');
            return;
        }

        setIsSaving(true);
        try {
            await saveWorkoutLog({
                memberId: userData.uid,
                organizationId: orgId,
                date: Date.now(),
                workoutTitle: targetDistance === 2000 ? '2000 m Rodd' : `${targetDistance} m Rodd`,
                workoutId: 'manual',
                benchmarkId: 'platform_row_2000m',
                benchmarkValue: seconds,
                benchmarkDistance: targetDistance,
            });
            setTimeInput('');
            setDistanceInput('');
            setShowCustomDistance(false);
        } catch (err) {
            console.error('Failed to save rowing log', err);
            setErrorMsg('Kunde inte spara resultatet. Försök igen.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center justify-between w-full sm:w-auto">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-gray-900 dark:text-white text-lg tracking-tight leading-[1.2] pt-[0.1em]">2000 M RODD</h3>
                            <button
                                type="button"
                                onClick={() => setShowInfoModal(true)}
                                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                aria-label="Information om 2000 m rodd"
                            >
                                <InformationCircleIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Konditionstest — Concept2</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Logga nytt resultat
                </label>

                {showCustomDistance && (
                    <div className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                            Sträcka (meter)
                        </label>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={distanceInput}
                            onChange={(e) => setDistanceInput(e.target.value)}
                            placeholder="t.ex. 500"
                            min={100}
                            max={10000}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={timeInput}
                        onChange={(e) => setTimeInput(e.target.value)}
                        placeholder="mm:ss (t.ex. 7:15 eller 7:15.0)"
                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white font-mono placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                        type="submit"
                        disabled={isSaving || !timeInput.trim()}
                        className="bg-primary text-white font-bold text-xs px-4 py-2 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                    >
                        {isSaving ? 'Sparar...' : 'Spara test'}
                    </button>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={() => {
                            setShowCustomDistance(!showCustomDistance);
                            if (showCustomDistance) setDistanceInput('');
                        }}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors underline"
                    >
                        {showCustomDistance ? 'Standard 2000 m' : 'Jag rodde en kortare sträcka'}
                    </button>
                </div>

                {errorMsg && <p className="text-xs text-red-500 font-medium">{errorMsg}</p>}
            </form>

            {latestAttempt && (
                <div className="bg-gray-50/50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-100 dark:border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                            Senaste test ({new Date(latestAttempt.date).toLocaleDateString('sv-SE')})
                        </span>
                        <span className="font-mono font-bold text-base text-primary tabular-nums">
                            {isFullTest ? formatRowingTime(latestAttempt.benchmarkValue!) : `${latestDistance} m · ${formatRowingTime(latestAttempt.benchmarkValue!)}`}
                        </span>
                    </div>

                    {!isFullTest ? (
                        <p className="text-xs text-gray-600 dark:text-gray-300 font-medium pt-1">
                            Jämförelse görs på 2000 m. Kör hela sträckan för att se din nivå.
                        </p>
                    ) : (age === null || !userData?.birthDate) ? (
                        <div className="space-y-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                Ange födelsedatum i din profil för att se jämförelsen.
                            </p>
                            {onOpenProfileEdit && (
                                <button
                                    type="button"
                                    onClick={onOpenProfileEdit}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                >
                                    Till profilen →
                                </button>
                            )}
                        </div>
                    ) : (gender !== 'male' && gender !== 'female') ? (
                        <div className="space-y-2">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Nivå
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                        Igång
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-1.5 h-2">
                                    {[1, 2, 3, 4, 5].map((seg) => (
                                        <div key={seg} className="h-full rounded-full bg-gray-200 dark:bg-gray-800" />
                                    ))}
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                                Jämförelser finns för man/kvinna. Din progression räknas ändå.
                            </p>
                        </div>
                    ) : latestAssessment ? (
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Nivå
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                        {latestAssessment.levelName}
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-1.5 h-2">
                                    {[1, 2, 3, 4, 5].map((seg) => (
                                        <div
                                            key={seg}
                                            className={`h-full rounded-full transition-colors ${
                                                seg <= latestAssessment.level ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-800'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1 pt-1 border-t border-gray-200/60 dark:border-gray-700/60 text-xs">
                                <p className="text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Snitt i din ålder & kön:</span>{' '}
                                    <span className="font-bold text-gray-900 dark:text-white font-mono tabular-nums">
                                        {formatRowingTime(latestAssessment.averageSec)}
                                    </span>
                                </p>
                                {latestAssessment.level < 5 && latestAssessment.nextLevelSec !== null && (
                                    <p className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Nästa nivå:</span>{' '}
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                                            {ROWING_LEVEL_NAMES[latestAssessment.level + 1]}
                                        </span>{' '}
                                        vid{' '}
                                        <span className="font-bold text-gray-900 dark:text-white font-mono tabular-nums">
                                            {formatRowingTime(latestAssessment.nextLevelSec)}
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}

            {latestRowingScore !== null && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Din konditionspoäng</p>
                    <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-none">{latestRowingScore}</span>
                        <span className="text-sm font-bold text-gray-400">/ 100</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Samma skala som din styrkepoäng, räknad på din senaste hela 2000-metare och justerad för din ålder och ditt kön.
                    </p>

                    {rowingScoreHistory.length >= 2 ? (
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={rowingScoreHistory} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                        formatter={(value: number, _name: string, props: any) => [`${value} poäng · ${props?.payload?.label ?? ''}`, 'Konditionspoäng']}
                                        labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                                    />
                                    <Line type="monotone" dataKey="score" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4, fill: '#14b8a6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#14b8a6', strokeWidth: 0 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Gör om testet så ritas din utvecklingskurva här.
                        </p>
                    )}
                </div>
            )}

            {history.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Tidigare försök ({history.length})
                    </h4>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                        {history.map((item) => {
                            const itemDist = item.benchmarkDistance ?? 2000;
                            return (
                                <div key={item.id} className="py-2 flex items-center justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {new Date(item.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                                        {itemDist === 2000 ? formatRowingTime(item.benchmarkValue!) : `${itemDist} m · ${formatRowingTime(item.benchmarkValue!)}`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <Modal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} title="2000 m rodd">
                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">Så gör du testet</h4>
                        <p>
                            Ro 2000 meter så snabbt du kan på en Concept2-maskin. Värm upp ordentligt, håll ett jämnt tempo och spara lite till slutet. Orkar du inte hela sträckan — logga ändå det du gjorde och ange hur långt du rodde. Kortare distanser sparas i din historik så att du kan slå dem nästa gång, men jämförelsen mot andra görs bara på hela 2000 meter.
                        </p>
                    </div>

                    <p>
                        <strong className="font-bold text-gray-900 dark:text-white">Nivåerna</strong> följer samma skala som styrkan och är justerade för din ålder och ditt kön. En 60-årig man som ror på 8:00 presterar lika bra som en 30-åring på 7:04 — därför jämförs du med din egen åldersgrupp.
                    </p>

                    <p>
                        <strong className="font-bold text-gray-900 dark:text-white">Snittet</strong> som visas är tiden för mittennivån i din åldersgrupp — alltså vad hälften klarar. Ligger du över är du i gott sällskap; ligger du under har du ett tydligt mål.
                    </p>

                    <p>
                        Testa igen om 8–12 veckor. Det är då förändringen syns.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export const BenchmarksView: React.FC<{
    logs: WorkoutLog[];
    definitions: BenchmarkDefinition[];
    onViewLog: (log: WorkoutLog) => void;
    userData?: any;
    onOpenProfileEdit?: () => void;
    enableFitnessBenchmarks?: boolean;
}> = ({ logs, definitions, onViewLog, userData, onOpenProfileEdit, enableFitnessBenchmarks }) => {
    const [selectedBenchmark, setSelectedBenchmark] = useState<any>(null);

    // Process data to find PBs for each benchmark definition and sort them
    const sortedBenchmarks = useMemo(() => {
        const mapped = definitions.map(def => {
            // Find all logs that match this benchmark ID
            const relevantLogs = logs.filter(l => l.benchmarkId === def.id && l.benchmarkValue !== undefined);
            
            if (relevantLogs.length === 0) return { def, pb: null, attempts: 0, lastDate: 0, history: [] };

            // Sort by date descending (newest first)
            const history = [...relevantLogs].sort((a, b) => b.date - a.date);

            // Sort based on type to find PB
            const sortedLogs = [...relevantLogs].sort((a, b) => {
                if (def.type === 'time') return (a.benchmarkValue || 0) - (b.benchmarkValue || 0); // Lower time is better
                return (b.benchmarkValue || 0) - (a.benchmarkValue || 0); // Higher reps/weight is better
            });
            
            // Find latest date for sorting the list
            const lastDate = history[0].date;

            // Calculate trend (latest vs previous)
            let trend = null;
            if (history.length > 1) {
                const latest = history[0].benchmarkValue || 0;
                const previous = history[1].benchmarkValue || 0;
                const diff = latest - previous;
                
                let isImprovement = false;
                if (def.type === 'time') {
                    isImprovement = diff < 0;
                } else {
                    isImprovement = diff > 0;
                }
                
                trend = {
                    diff: Math.abs(diff),
                    isImprovement,
                    hasChanged: diff !== 0
                };
            }

            return {
                def,
                pb: sortedLogs[0],
                latest: history[0],
                attempts: relevantLogs.length,
                lastDate,
                history,
                trend
            };
        });

        // Filter out benchmarks that have never been attempted
        const attemptedBenchmarks = mapped.filter(item => item.pb !== null);

        // Sort: Most recently attempted/completed first
        return attemptedBenchmarks.sort((a, b) => b.lastDate - a.lastDate);

    }, [logs, definitions]);

    const formatResult = (val: number, type: string) => {
        if (type === 'time') {
            const m = Math.floor(val / 60);
            const s = val % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
        return `${val}`;
    };

    const getUnit = (type: string) => {
        if (type === 'time') return ''; // Usually looks better without 'min' if format is MM:SS
        if (type === 'reps') return 'Varv'; // Changed from 'reps' to 'Varv' as requested
        if (type === 'weight') return 'kg';
        return '';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {enableFitnessBenchmarks && (
                <Rowing2000mCard
                    logs={logs}
                    userData={userData}
                    onOpenProfileEdit={onOpenProfileEdit}
                />
            )}

            {sortedBenchmarks.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                    <p className="text-gray-400 text-sm">Här visas dina resultat när du kört ett benchmark-pass.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sortedBenchmarks.map((benchmark) => {
                        const { def, pb, attempts, trend } = benchmark;
                        return (
                            <div 
                                key={def.id} 
                                onClick={() => setSelectedBenchmark(benchmark)}
                                className={`cursor-pointer relative overflow-hidden rounded-3xl p-6 transition-all bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 border-2 border-yellow-400/30 dark:border-yellow-500/20 hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-lg`}
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-3xl -mr-6 -mt-6"></div>
                                
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-bold truncate pr-2 text-lg text-gray-900 dark:text-white">
                                            {def.title}
                                        </h4>
                                        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-lg">
                                            <TrophyIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                                                {formatResult(pb!.benchmarkValue!, def.type)} <span className="text-sm text-gray-500 font-bold">{getUnit(def.type)}</span>
                                            </p>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-wider font-bold">
                                                {new Date(pb!.date).toLocaleDateString('sv-SE')} • {attempts} försök
                                            </p>
                                        </div>
                                        {trend && trend.hasChanged && (
                                            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trend.isImprovement ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                {trend.isImprovement ? '↑' : '↓'} {formatResult(trend.diff, def.type)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}


            {selectedBenchmark && (
                <BenchmarkDetailModal 
                    benchmark={selectedBenchmark} 
                    onClose={() => setSelectedBenchmark(null)} 
                    onViewLog={onViewLog}
                    formatResult={formatResult}
                    getUnit={getUnit}
                />
            )}
        </div>
    );
};
