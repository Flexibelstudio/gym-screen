import React, { useState, useMemo } from 'react';
import { PersonalBest } from '../../../types';
import { getTargetWeightForExercise, getRepsForPercentage } from '../../../utils/workoutUtils';
import { LastPerformanceRecord } from './types';

// --- Pre-Game Strategy View ---

export const PreGameView: React.FC<{
    workoutTitle: string;
    exercises: { id: string; name: string; exerciseName?: string; blockId?: string }[];
    blocks?: { blockId: string; title: string; planPct: number }[];
    blockPct?: Record<string, number | null>;
    onChangeBlockPct?: (blockId: string, pct: number | null) => void;
    aiProgressionPrompt?: string;
    history: Record<string, LastPerformanceRecord>;
    personalBests: Record<string, PersonalBest>;
    userId?: string;
    onStart: (mode: 'normal' | 'fatigued') => void;
    onCancel: () => void;
}> = ({ workoutTitle, exercises, blocks = [], blockPct = {}, onChangeBlockPct, aiProgressionPrompt, history, personalBests, userId, onStart, onCancel }) => {
    const [mode, setMode] = useState<'normal' | 'fatigued'>('normal');

    const exerciseTargets = useMemo(() => {
        return exercises.map(ex => {
            const exName = ex.exerciseName || ex.name || '';
            const b = ex.blockId ? blocks.find(x => x.blockId === ex.blockId) : undefined;
            const res = getTargetWeightForExercise({
                exerciseName: exName,
                personalBests,
                history,
                userId,
                mode,
                prescribedPct: b ? b.planPct : null,
                sessionPct: ex.blockId ? (blockPct[ex.blockId] ?? null) : null
            });
            return {
                exName,
                bas: res.base,
                scaledWeight: res.scaled,
                targetPct: res.targetPct,
                basSource: res.source
            };
        });
    }, [exercises, history, personalBests, userId, mode, blocks, blockPct]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-hidden animate-fade-in">
            {/* Scrollable Content Area */}
            <div className="relative z-10 flex-1 overflow-y-auto p-6 scrollbar-hide">
                <div className="flex justify-between items-start mb-6">
                    <button onClick={onCancel} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white font-bold text-xs uppercase tracking-widest px-3 py-1 transition-all active:scale-95 leading-[1.2] pt-[0.1em]">Avbryt</button>
                </div>
                
                <div className="text-center mb-8">
                    <span className="inline-block py-1.5 px-3.5 rounded-full bg-primary/10 dark:bg-white/10 border border-primary/20 dark:border-white/20 text-xs font-black uppercase tracking-wider text-primary mb-4 leading-[1.2] pt-[0.1em]">Pre-Game Strategy</span>
                    <h1 className="text-3xl font-black leading-[1.2] pt-[0.1em] mb-2 text-gray-900 dark:text-white uppercase tracking-tight">{workoutTitle}</h1>
                </div>

                {/* 1. LÄGEN BUTTONS */}
                <div className="mb-8">
                    <p className="text-center text-xs font-black uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider leading-[1.2] pt-[0.1em]">Välj dagens känsla</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setMode('normal')}
                            className={`min-h-[52px] p-4 rounded-2xl border-2 font-black transition-all active:scale-95 text-center ${mode === 'normal' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
                        >
                            <span className="block text-sm uppercase tracking-wider">SOM VANLIGT</span>
                            <span className={`block text-xs font-normal mt-0.5 opacity-90 ${mode === 'normal' ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>följ planen</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('fatigued')}
                            className={`min-h-[52px] p-4 rounded-2xl border-2 font-black transition-all active:scale-95 text-center ${mode === 'fatigued' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
                        >
                            <span className="block text-sm uppercase tracking-wider">SLITEN IDAG</span>
                            <span className={`block text-xs font-normal mt-0.5 opacity-90 ${mode === 'fatigued' ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>skala ner</span>
                        </button>
                    </div>
                </div>

                {blocks.length > 0 && (
                    <div className="mb-8">
                        <p className="text-center text-xs font-black uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider leading-[1.2] pt-[0.1em]">Intensitet per block</p>
                        <div className="space-y-2.5">
                            {blocks.map(b => {
                                const current = blockPct[b.blockId] ?? b.planPct;
                                const isChanged = current !== b.planPct;
                                const step = (delta: number) => {
                                    const next = Math.max(40, Math.min(100, current + delta));
                                    onChangeBlockPct?.(b.blockId, next === b.planPct ? null : next);
                                };
                                return (
                                    <div key={b.blockId} className="flex items-center justify-between bg-white dark:bg-gray-800/80 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80 shadow-sm">
                                        <div className="min-w-0 pr-2">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white block truncate uppercase">{b.title}</span>
                                            {isChanged && (
                                                <button
                                                    type="button"
                                                    onClick={() => onChangeBlockPct?.(b.blockId, null)}
                                                    className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 hover:text-primary transition-colors"
                                                >
                                                    Planen: {b.planPct} % — återställ
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button type="button" onClick={() => step(-5)} className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-lg active:scale-90 transition-all">−</button>
                                            <span className={`text-base font-black tabular-nums w-16 text-center ${isChanged ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{current} %</span>
                                            <button type="button" onClick={() => step(5)} className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-lg active:scale-90 transition-all">+</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 3. TEXTER */}
                <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 mb-6">
                    {mode === 'normal' ? (
                        <div>
                            <h3 className="font-black text-base text-gray-900 dark:text-white mb-1 uppercase tracking-tight">Följ planen</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Dagens målvikter är baserade på dina senaste resultat.</p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="font-black text-base text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-tight">Vi tar det lite lugnare</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Vikterna är nedskalade ca 10 %. Kör tekniskt, ta längre vila och avsluta i tid.</p>
                        </div>
                    )}

                    {aiProgressionPrompt && aiProgressionPrompt.trim().length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Coachens instruktion</h4>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 italic">{aiProgressionPrompt}</p>
                        </div>
                    )}
                </div>

                {/* 2. MÅLVIKT PER ÖVNING */}
                <div className="mb-8">
                    <h3 className="text-xs font-black uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider">Målvikter för övningar</h3>
                    <div className="space-y-2.5">
                        {exerciseTargets.map((item, idx) => {
                            const targetReps = item.targetPct && item.targetPct > 0 ? getRepsForPercentage(item.targetPct) : 0;
                            return (
                                <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800/80 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80 shadow-sm">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white pr-2">{item.exName}</span>
                                    <div className="text-right whitespace-nowrap">
                                        {item.bas !== null && item.scaledWeight !== null ? (
                                            <div className="flex items-center gap-2">
                                                {mode === 'fatigued' && item.bas !== item.scaledWeight && (
                                                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 line-through tabular-nums">
                                                        {String(item.bas).replace('.', ',')} kg
                                                    </span>
                                                )}
                                                <span className="text-sm font-black tabular-nums text-primary dark:text-primary">
                                                    {String(item.scaledWeight).replace('.', ',')} kg{targetReps > 0 ? ` × ~${targetReps} reps` : ''}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                                                Ingen historik än
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-6 font-medium">
                    Vid smärta eller skada — prata med din coach.
                </p>

                {/* --- START BUTTON IN SCROLL FLOW --- */}
                <div className="pb-12">
                    <button onClick={() => onStart(mode)} className="w-full min-h-[52px] bg-primary hover:brightness-110 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 focus:ring-2 focus:ring-primary uppercase tracking-tight">
                        <span className="leading-[1.2] pt-[0.1em]">Starta passet</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
