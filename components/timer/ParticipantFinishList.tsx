
import React, { useMemo } from 'react';

interface FinishData { time: number; placement: number | null; }

interface ParticipantFinishListProps {
    participants: string[];
    finishData: Record<string, FinishData>;
    onFinish: (name: string) => void;
    onEdit: (name: string) => void;
    isSaving: (name: string) => boolean;
}

export const ParticipantFinishList: React.FC<ParticipantFinishListProps> = ({ participants, finishData, onFinish, onEdit, isSaving }) => {
    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const sortedParticipants = useMemo(() => {
        const unfinished = participants.filter(p => !finishData[p]);
        const finished = participants
            .filter(p => finishData[p])
            .sort((a, b) => finishData[a].time - finishData[b].time);
        return [...finished, ...unfinished];
    }, [participants, finishData]);

    return (
        <div className="flex flex-col p-4 flex-grow min-h-0">
            <h3 className="text-3xl font-bold text-white mb-4 flex-shrink-0">Resultat</h3>
            <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                {sortedParticipants.map((name, index) => {
                    const finishedInfo = finishData[name];
                    const isFinished = !!finishedInfo;
                    const displayPlacement = isFinished ? index + 1 : null;

                    return (
                        <div
                            key={name}
                            onClick={() => {
                              if (isFinished) {
                                onEdit(name);
                              }
                            }}
                            className={`p-3 rounded-lg flex justify-between items-center transition-all ${
                                isFinished
                                ? 'bg-green-900/40 border border-green-500/50 cursor-pointer hover:bg-green-900/60 hover:border-green-400'
                                : 'bg-gray-800 border border-transparent'
                            }`}
                        >
                            <span className={`font-semibold truncate mr-2 ${isFinished ? 'text-gray-300' : 'text-white'}`}>
                              {isFinished && <span className="font-bold mr-2 text-green-400">{displayPlacement}.</span>}
                              <span className={isFinished ? '' : ''}>{name}</span>
                            </span>
                            {isFinished ? (
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xl font-bold text-white">{formatTime(finishedInfo.time)}</span>
                                    <span className="text-xs text-gray-400 bg-gray-900/50 px-1.5 py-0.5 rounded">Redigera</span>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onFinish(name); }}
                                    disabled={isSaving(name)}
                                    className="text-white text-xs font-bold py-2 px-4 rounded-full transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-green-600 disabled:cursor-wait shadow-lg active:scale-95"
                                >
                                    {isSaving(name) ? 'Sparar...' : 'I Mål!'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
