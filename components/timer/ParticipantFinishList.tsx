
import React, { useMemo } from 'react';
import { RaceParticipant } from '../../types';

interface FinishData { time: number; placement: number | null; }

interface ParticipantFinishListProps {
    participants: RaceParticipant[];
    finishData: Record<string, FinishData>;
    onFinish: (id: string) => void;
    onEdit: (id: string) => void;
    isSaving: (id: string) => boolean;
}

export const ParticipantFinishList: React.FC<ParticipantFinishListProps> = ({ participants, finishData, onFinish, onEdit, isSaving }) => {
    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const sortedParticipants = useMemo(() => {
        const unfinished = participants.filter(p => !finishData[p.id]);
        const finished = participants
            .filter(p => finishData[p.id])
            .sort((a, b) => finishData[a.id].time - finishData[b.id].time);
        return [...finished, ...unfinished];
    }, [participants, finishData]);

    if (participants.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-full text-center">
                <p className="text-gray-400 dark:text-gray-500 italic">Inga deltagare startade.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col p-4 sm:p-6 flex-grow min-h-0 bg-white dark:bg-gray-900">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-6 flex-shrink-0 tracking-tight uppercase">Resultat</h3>
            <div className="flex-grow overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                {sortedParticipants.map((p, index) => {
                    const finishedInfo = finishData[p.id];
                    const isFinished = !!finishedInfo;
                    const displayPlacement = isFinished ? index + 1 : null;

                    return (
                        <div
                            key={p.id}
                            onClick={() => {
                              if (isFinished) {
                                onEdit(p.id);
                              }
                            }}
                            className={`p-4 rounded-xl flex justify-between items-center transition-all ${
                                isFinished
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40'
                                : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700'
                            }`}
                        >
                            <span className={`font-bold truncate mr-2 ${isFinished ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {isFinished && <span className="mr-2">#{displayPlacement}</span>}
                              <span>{p.name} {p.partnerName && <span className="text-gray-500 font-normal text-sm">& {p.partnerName}</span>}</span>
                            </span>
                            {isFinished ? (
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-lg font-black text-gray-900 dark:text-white">{formatTime(finishedInfo.time)}</span>
                                    <span className="text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 bg-white/50 dark:bg-gray-900/50 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">Ändra</span>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onFinish(p.id); }}
                                    disabled={isSaving(p.id)}
                                    className="text-white text-xs font-black py-2 px-4 rounded-lg transition-all bg-indigo-600 hover:bg-indigo-500 disabled:bg-green-600 disabled:cursor-wait shadow-md active:scale-95 uppercase tracking-widest"
                                >
                                    {isSaving(p.id) ? '...' : 'I Mål'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
