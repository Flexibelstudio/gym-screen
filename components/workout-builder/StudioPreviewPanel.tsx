import React from 'react';
import { Workout, TimerMode } from '../../types';
import { calculateBlockDuration } from '../../hooks/useWorkoutTimer';
import { getBlockProfile, getBlockPlanParts, getSideLabel } from '../../utils/workoutUtils';

export interface StudioPreviewPanelProps {
    workout: Workout;
    onClose: () => void;
}

const fmt = (s: number) => {
    if (s <= 0) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m} min${sec > 0 ? ` ${sec} s` : ''}` : `${sec} s`;
};

export const StudioPreviewPanel: React.FC<StudioPreviewPanelProps> = ({ workout, onClose }) => {
    if (workout.showInStudio === false) {
        return (
            <div className="space-y-4 text-gray-900 dark:text-white">
                <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold">Så blir det på skärmen</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                        title="Stäng"
                    >
                        ✕
                    </button>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800/50 text-sm">
                    Det här passet visas inte på skärmen. Slå på &apos;Visa på skärm&apos; för att använda det i studion.
                </div>
            </div>
        );
    }

    const blocks = workout.blocks || [];
    let hasOpenEnded = false;
    const totalWorkoutDuration = blocks.reduce((acc, block, index) => {
        const exercisesCount = block.exercises?.length || 0;
        const duration = calculateBlockDuration(block.settings, exercisesCount);
        const isLast = index === blocks.length - 1;
        const transition = (block.autoAdvance && !isLast) ? (block.transitionTime || 0) : 0;
        if (duration >= 86400) { hasOpenEnded = true; return acc + transition; }
        return acc + duration + transition;
    }, 0);

    return (
        <div className="space-y-6 text-gray-900 dark:text-white">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                    <h2 className="text-xl font-bold">Så blir det på skärmen</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Förhandsvisning av förväntat beteende i studion
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                    title="Stäng"
                >
                    ✕
                </button>
            </div>

            {/* Top Summary */}
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <h3 className="text-lg font-bold">{workout.title || 'Namnlöst pass'}</h3>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <div>
                        <span className="font-semibold text-gray-900 dark:text-white">Antal block:</span> {blocks.length}
                    </div>
                    <div>
                        <span className="font-semibold text-gray-900 dark:text-white">Totaltid pass:</span> {hasOpenEnded ? `minst ${fmt(totalWorkoutDuration)}` : fmt(totalWorkoutDuration)}
                    </div>
                </div>
                {hasOpenEnded && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Ett eller flera block har öppen längd och räknas inte in.
                    </div>
                )}
            </div>

            {/* Blocks List */}
            <div className="space-y-4">
                {blocks.map((block, index) => {
                    const isLast = index === blocks.length - 1;
                    const exercisesCount = block.exercises?.length || 0;
                    const blockDuration = calculateBlockDuration(block.settings, exercisesCount);
                    const isOpenEnded = blockDuration >= 86400;
                    const mode = block.settings?.mode;
                    const prepareTime = block.settings?.prepareTime || 0;

                    let timerText = '';
                    switch (mode) {
                        case TimerMode.Interval:
                        case TimerMode.Tabata: {
                            const rounds = block.settings?.rounds || exercisesCount;
                            const workTime = block.settings?.workTime || 0;
                            const restTime = block.settings?.restTime || 0;
                            timerText = `${rounds} varv × ${workTime} s arbete / ${restTime} s vila`;
                            break;
                        }
                        case TimerMode.EMOM: {
                            const rounds = block.settings?.rounds || 0;
                            timerText = `${rounds} minuter, en start per minut`;
                            break;
                        }
                        case TimerMode.AMRAP: {
                            const workTime = block.settings?.workTime || 0;
                            timerText = `Så många varv som möjligt på ${fmt(workTime)}`;
                            break;
                        }
                        case TimerMode.TimeCap: {
                            const workTime = block.settings?.workTime || 0;
                            timerText = `Tidsgräns ${fmt(workTime)}`;
                            break;
                        }
                        case TimerMode.Stopwatch: {
                            timerText = 'Stoppur, räknar uppåt utan gräns';
                            break;
                        }
                        case TimerMode.Custom: {
                            const seq = block.settings?.sequence || [];
                            const seqStr = seq.map(s => `${s.title || 'Segment'} ${fmt(s.duration || 0)}`).join(', ');
                            const roundsStr = (block.settings?.rounds && block.settings.rounds > 1)
                                ? ` (Sekvensen körs ${block.settings.rounds} gånger)`
                                : '';
                            timerText = seqStr ? `${seqStr}${roundsStr}` : 'Sekvens';
                            break;
                        }
                        case TimerMode.NoTimer:
                        default: {
                            timerText = 'Ingen timer';
                            break;
                        }
                    }

                    const showBlockPlan = (block as any).showBlockPlan !== false;
                    const profile = getBlockProfile(block as any);
                    const planParts = showBlockPlan ? getBlockPlanParts(profile) : [];

                    return (
                        <div key={block.id || index} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                            {/* Block header */}
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 pb-2">
                                <h4 className="font-bold text-base">{index + 1}. {block.title || 'Namnlöst block'}</h4>
                                {block.tag && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                        {block.tag}
                                    </span>
                                )}
                            </div>

                            {/* Timer mode & duration */}
                            <div className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
                                <div><span className="font-semibold text-gray-800 dark:text-gray-200">Timer:</span> {timerText}</div>
                                {prepareTime > 0 && (
                                    <div><span className="font-semibold text-gray-800 dark:text-gray-200">Förberedelse:</span> {fmt(prepareTime)}</div>
                                )}
                                {isOpenEnded ? (
                                    <div><span className="font-semibold text-gray-800 dark:text-gray-200">Längd:</span> Öppen — pågår tills coachen avslutar blocket</div>
                                ) : (
                                    <div><span className="font-semibold text-gray-800 dark:text-gray-200">{prepareTime > 0 ? 'Total tid (exkl. förberedelse)' : 'Total tid'}:</span> {fmt(blockDuration)}</div>
                                )}
                            </div>

                            {/* Transition & Follow me */}
                            <div className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
                                <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">Övergång:</span>{' '}
                                    {block.autoAdvance && !isLast
                                        ? `Går vidare automatiskt till nästa block efter ${fmt(block.transitionTime || 0)}`
                                        : 'Stannar efter blocket och väntar på start'
                                    }
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">Visningsläge:</span>{' '}
                                    {block.followMe
                                        ? 'Följ mig är på — övningarna visas en i taget i takt med timern'
                                        : 'Alla övningar visas samtidigt'
                                    }
                                </div>
                            </div>

                            {/* Screen Texts */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200/80 dark:border-gray-700/80 space-y-2 text-xs">
                                <div className="font-bold uppercase tracking-wider text-[10px] text-gray-400">Texter som kommer upp på skärmen</div>
                                
                                {/* Upplägg */}
                                <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-0.5">Under blockrubriken:</span>
                                    {!showBlockPlan ? (
                                        <span className="text-gray-500 italic">Upplägget är avstängt för det här blocket</span>
                                    ) : planParts.length > 0 ? (
                                        <span className="p-1.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-mono text-gray-800 dark:text-gray-200 block">
                                            {planParts.join(' · ')}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 italic">Ingen uppläggsrad visas</span>
                                    )}
                                </div>

                                {/* Uppläggsbeskrivning */}
                                <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-0.5">Uppläggsbeskrivning:</span>
                                    {block.showDescriptionInTimer && block.setupDescription?.trim() ? (
                                        <p className="p-1.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                            {block.setupDescription}
                                        </p>
                                    ) : (
                                        <span className="text-gray-500 italic">Visas inte</span>
                                    )}
                                </div>

                                {/* Övningsbeskrivningar */}
                                {!block.showExerciseDescriptions && (
                                    <div>
                                        <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-0.5">Övningsbeskrivningar:</span>
                                        <span className="text-gray-500 italic">Visas inte</span>
                                    </div>
                                )}
                            </div>

                            {/* Exercises list */}
                            <div className="space-y-1.5 pt-1">
                                <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                    Övningar ({exercisesCount})
                                </div>
                                {exercisesCount === 0 ? (
                                    <div className="text-xs text-gray-500 italic">Inga övningar i blocket</div>
                                ) : (
                                    <div className="space-y-1">
                                        {block.exercises.map((ex, exIdx) => {
                                            const sideLabel = getSideLabel(ex.side);
                                            const repsText = ex.reps?.trim();
                                            return (
                                                <div key={ex.id || exIdx} className="p-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200/80 dark:border-gray-700/80 text-xs">
                                                    <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 flex-wrap">
                                                        <span>{ex.name || 'Namnlös övning'}</span>
                                                        {repsText && <span className="font-normal text-gray-600 dark:text-gray-400"> {repsText}</span>}
                                                        {sideLabel && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                                                {sideLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {block.showExerciseDescriptions && ex.description?.trim() && (
                                                        <div className="text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap pl-2 border-l-2 border-gray-300 dark:border-gray-600">
                                                            {ex.description.trim()}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
