import React, { useState, useEffect } from 'react';
import { WorkoutLog, WorkoutDiploma } from '../../types';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ConfirmContext';
import { TrophyIcon, TrashIcon } from '../icons';

// Formaterar en set-rad utifrån vad som faktiskt loggats. Tidigare visades alltid
// "vikt × reps", vilket blev "- × -" för övningar som loggas med tid, distans
// eller kalorier. Tid lagras som decimala minuter (TimeInput) och visas som mm:ss.
const formatSetLine = (s: any): string => {
    const parts: string[] = [];
    const weight = parseFloat(String(s.weight));
    const hasWeight = !isNaN(weight) && weight > 0;
    const repsStr = s.reps !== undefined && s.reps !== null ? String(s.reps).trim() : '';
    const hasReps = repsStr !== '' && repsStr !== '0';
    if (hasWeight || hasReps) {
        parts.push(`${hasWeight ? `${weight} kg` : '-'} × ${hasReps ? repsStr : '-'}`);
    }
    const t = parseFloat(String(s.time));
    if (!isNaN(t) && t > 0) {
        const m = Math.floor(t);
        const sec = Math.round((t - m) * 60);
        parts.push(`${m}:${String(sec).padStart(2, '0')}`);
    }
    const d = parseFloat(String(s.distance));
    if (!isNaN(d) && d > 0) parts.push(`${d} m`);
    const k = parseFloat(String(s.kcal));
    if (!isNaN(k) && k > 0) parts.push(`${k} kcal`);
    return parts.length > 0 ? parts.join(' · ') : '- × -';
};

export const LogDetailModal: React.FC<{
    log: WorkoutLog,
    canEdit?: boolean,
    onClose: () => void,
    onUpdate: (id: string, data: Partial<WorkoutLog>) => void,
    onDelete: (id: string) => void,
    onViewDiploma?: (diploma: WorkoutDiploma) => void
}> = ({ log, canEdit = true, onClose, onUpdate, onDelete, onViewDiploma }) => {
    const [isEditing, setIsEditing] = useState(false);
    const confirm = useConfirm();
    const [comment, setComment] = useState(log.comment || '');
    const [exerciseResults, setExerciseResults] = useState(() => {
        return (log.exerciseResults || []).map(ex => ({
            ...ex,
            setDetails: ex.setDetails ? ex.setDetails.map(s => ({ ...s })) : undefined
        }));
    });

    useEffect(() => {
        setComment(log.comment || '');
        setExerciseResults(
            (log.exerciseResults || []).map(ex => ({
                ...ex,
                setDetails: ex.setDetails ? ex.setDetails.map(s => ({ ...s })) : undefined
            }))
        );
    }, [log]);

    const handleSetChange = (exIdx: number, setIdx: number, field: 'weight' | 'reps', val: string) => {
        setExerciseResults(prev => {
            const next = [...prev];
            const ex = { ...next[exIdx] };
            if (ex.setDetails) {
                const sets = [...ex.setDetails];
                const s = { ...sets[setIdx] };
                if (field === 'weight') {
                    s.weight = val === '' ? null : (parseFloat(val) || 0);
                } else if (field === 'reps') {
                    s.reps = val === '' ? null : val;
                }
                sets[setIdx] = s;
                ex.setDetails = sets;
            }
            next[exIdx] = ex;
            return next;
        });
    };

    const handleSummaryChange = (exIdx: number, field: 'weight' | 'reps', val: string) => {
        setExerciseResults(prev => {
            const next = [...prev];
            const ex = { ...next[exIdx] };
            if (field === 'weight') {
                ex.weight = val === '' ? null : (parseFloat(val) || 0);
            } else if (field === 'reps') {
                ex.reps = val === '' ? null : val;
            }
            next[exIdx] = ex;
            return next;
        });
    };

    const handleSave = () => {
        let newTotalVolume = 0;

        // Samma regler som WorkoutLogScreen använder vid sparning: weight = max av
        // alla parsebara vikter (inklusive noll), reps = det gemensamma värdet om
        // alla set har samma, annars 'Mixed', och null när inga reps finns.
        const updatedResults = exerciseResults.map(ex => {
            if (ex.setDetails && ex.setDetails.length > 0) {
                const validWeights = ex.setDetails
                    .map(s => parseFloat(String(s.weight)))
                    .filter(n => !isNaN(n));
                const maxWeight = validWeights.length > 0 ? Math.max(...validWeights) : null;

                ex.setDetails.forEach(s => {
                    const w = parseFloat(String(s.weight));
                    const r = parseFloat(String(s.reps));
                    if (!isNaN(w) && !isNaN(r)) newTotalVolume += w * r;
                });

                const repsValues = ex.setDetails.map(s => s.reps).filter(Boolean);
                const uniqueReps = [...new Set(repsValues)];
                const repsSummary = uniqueReps.length === 1 ? uniqueReps[0] : (uniqueReps.length > 0 ? 'Mixed' : null);

                return { ...ex, weight: maxWeight, reps: repsSummary };
            }

            const w = parseFloat(String(ex.weight));
            const r = parseFloat(String(ex.reps));
            if (!isNaN(w) && !isNaN(r)) newTotalVolume += w * r;
            return ex;
        });

        onUpdate(log.id, {
            comment,
            exerciseResults: updatedResults,
            totalVolume: newTotalVolume > 0 ? newTotalVolume : undefined
        });
        setIsEditing(false);
    };

    const handleDelete = async () => {
        const isConfirmed = await confirm({
            title: "Ta bort pass?",
            message: "Är du säker på att du vill ta bort detta pass? Detta går inte att ångra.",
            confirmText: "Ta bort",
            confirmColor: "red"
        });
        if (isConfirmed) { onDelete(log.id); onClose(); }
    };

    const isCustomActivity = log.activityType === 'custom_activity' || (!log.exerciseResults || log.exerciseResults.length === 0);

    return (
        <Modal isOpen={true} onClose={onClose} title={log.workoutTitle} size="lg">
            <div className="space-y-6">
                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>{new Date(log.date).toLocaleString()}</span>
                    <div className="flex gap-2">
                        {log.feeling && <span className="font-medium" title="Känsla">{log.feeling === 'good' ? '🔥' : log.feeling === 'bad' ? '🤕' : '🙂'}</span>}
                        {log.rpe && <span className="font-bold bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">RPE {log.rpe}</span>}
                    </div>
                </div>

                {isCustomActivity && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div className="grid grid-cols-3 gap-4 divide-x divide-gray-200 dark:divide-gray-700">
                            <div className="text-center px-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tid</p>
                                <p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.durationMinutes || 0}<span className="text-xs ml-1 font-normal text-gray-500">min</span></p>
                            </div>
                            <div className="text-center px-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Distans</p>
                                <p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.totalDistance || 0}<span className="text-xs ml-1 font-normal text-gray-500">km</span></p>
                            </div>
                            <div className="text-center px-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Energi</p>
                                <p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.totalCalories || 0}<span className="text-xs ml-1 font-normal text-gray-500">kcal</span></p>
                            </div>
                        </div>
                    </div>
                )}

                {typeof log.rounds === 'number' && log.rounds > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Varv / Reps</p>
                            <p className="font-mono font-bold text-3xl text-gray-900 dark:text-white">{log.rounds}</p>
                        </div>
                    </div>
                )}

                {exerciseResults && exerciseResults.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Resultat</h4>
                        {exerciseResults.map((ex, exIdx) => (
                            <div key={exIdx} className="bg-gray-50 dark:bg-gray-900 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{ex.exerciseName}</span>
                                    {!isEditing && !ex.setDetails?.length && (
                                        <span className="font-mono text-primary font-bold text-sm">
                                            {ex.weight ? `${ex.weight}kg` : ''} {ex.reps ? ` ${ex.reps}` : ''}
                                        </span>
                                    )}
                                </div>

                                {isEditing ? (
                                    ex.setDetails && ex.setDetails.length > 0 ? (
                                        <div className="space-y-2 pt-1">
                                            {ex.setDetails.map((s, setIdx) => (
                                                <div key={setIdx} className="flex items-center gap-3 text-xs bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                                    <span className="font-bold text-gray-400 w-12">Set {setIdx + 1}</span>
                                                    <div className="flex items-center gap-1.5 flex-1">
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            step="0.5"
                                                            value={s.weight ?? ''}
                                                            onChange={e => handleSetChange(exIdx, setIdx, 'weight', e.target.value)}
                                                            placeholder="0"
                                                            className="w-20 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-right font-mono text-gray-900 dark:text-white font-bold focus:ring-1 focus:ring-primary outline-none"
                                                        />
                                                        <span className="text-gray-500">kg</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-1">
                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            value={s.reps ?? ''}
                                                            onChange={e => handleSetChange(exIdx, setIdx, 'reps', e.target.value)}
                                                            placeholder="0"
                                                            className="w-16 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-right font-mono text-gray-900 dark:text-white font-bold focus:ring-1 focus:ring-primary outline-none"
                                                        />
                                                        <span className="text-gray-500">reps</span>
                                                    </div>
                                                    {s.rir !== undefined && s.rir !== null && (
                                                        <span className="text-gray-400 font-mono text-[11px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                                                            RIR {s.rir}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 pt-1">
                                            <div className="flex items-center gap-1.5 flex-1">
                                                <label className="text-xs text-gray-400">Vikt:</label>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    step="0.5"
                                                    value={ex.weight ?? ''}
                                                    onChange={e => handleSummaryChange(exIdx, 'weight', e.target.value)}
                                                    placeholder="0"
                                                    className="w-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-right font-mono text-gray-900 dark:text-white font-bold focus:ring-1 focus:ring-primary outline-none text-xs"
                                                />
                                                <span className="text-xs text-gray-500">kg</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-1">
                                                <label className="text-xs text-gray-400">Reps:</label>
                                                <input
                                                    type="text"
                                                    value={ex.reps ?? ''}
                                                    onChange={e => handleSummaryChange(exIdx, 'reps', e.target.value)}
                                                    placeholder="0"
                                                    className="w-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-right font-mono text-gray-900 dark:text-white font-bold focus:ring-1 focus:ring-primary outline-none text-xs"
                                                />
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    ex.setDetails && ex.setDetails.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            {ex.setDetails.map((s, setIdx) => (
                                                <div key={setIdx} className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 px-2.5 py-1.5 rounded-md">
                                                    <span className="font-semibold text-gray-500">Set {setIdx + 1}</span>
                                                    <div className="flex items-center gap-3 font-mono">
                                                        <span>{formatSetLine(s)}</span>
                                                        {s.rir !== undefined && s.rir !== null && (
                                                            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">RIR {s.rir}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-sm uppercase tracking-wider">Kommentar</h4>
                    {isEditing ? (
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition text-sm"
                            rows={3}
                        />
                    ) : (
                        <p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg italic border border-gray-100 dark:border-gray-800 text-sm">
                            {log.comment || "Ingen kommentar."}
                        </p>
                    )}
                </div>

                {log.diploma && onViewDiploma && (
                    <button
                        onClick={() => onViewDiploma(log.diploma!)}
                        className="w-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold py-3 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800/50"
                    >
                        <TrophyIcon className="w-5 h-5" /> Visa Diplom
                    </button>
                )}

                <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleSave}
                                className="flex-1 bg-primary text-white font-bold py-3 rounded-xl hover:brightness-110 transition-colors shadow-sm"
                            >
                                Spara ändringar
                            </button>
                            <button
                                onClick={() => {
                                    setComment(log.comment || '');
                                    setExerciseResults((log.exerciseResults || []).map(ex => ({ ...ex, setDetails: ex.setDetails ? ex.setDetails.map(s => ({ ...s })) : undefined })));
                                    setIsEditing(false);
                                }}
                                className="px-5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Avbryt
                            </button>
                        </>
                    ) : (
                        canEdit && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Redigera pass
                            </button>
                        )
                    )}
                    <button
                        onClick={handleDelete}
                        className="px-6 text-red-500 font-bold bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors flex items-center justify-center border border-red-100 dark:border-red-900/30"
                        title="Radera pass"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </Modal>
    );
};
