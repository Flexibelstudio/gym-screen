
import React from 'react';
import { WorkoutBlock, Exercise, Organization } from '../types';
import { useWorkout } from '../context/WorkoutContext';

interface RepsOnlyScreenProps {
    block: WorkoutBlock;
    onFinish: () => void;
    onShowImage: (url: string) => void; // Kept prop for compatibility
    organization: Organization | null;
}

// Helper to format reps without automatically appending 'reps'
const formatReps = (reps: string | undefined): string => {
    if (!reps) return '';
    return reps.trim();
};

export const RepsOnlyScreen: React.FC<RepsOnlyScreenProps> = ({ block, onFinish, onShowImage, organization }) => {
    const { activeWorkout } = useWorkout();

    return (
        <div className="w-full h-full flex-grow flex flex-col bg-slate-800 dark:bg-black overflow-hidden">
            <div className="w-full max-w-5xl mx-auto flex-shrink-0 flex flex-col items-center justify-center p-6 md:p-8">
                <h1 className="text-4xl md:text-6xl lg:text-7xl text-white uppercase tracking-widest font-black text-center">{block.title}</h1>
                <p className="text-xl text-gray-300 mt-2 font-medium">Utför övningarna i din egen takt.</p>
            </div>
            
            <div className="w-full flex-grow overflow-y-auto px-4 md:px-8 pb-32">
                <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
                    {block.exercises.map((ex, i) => {
                        const useGroupColor = !!ex.groupColor;
                        const nextEx = block.exercises[i + 1];
                        const isGroupedWithNext = nextEx && ex.groupId && ex.groupId === nextEx.groupId;
                        
                        let mbClass = '';
                        if (i < block.exercises.length - 1) {
                            if (isGroupedWithNext) {
                                mbClass = 'mb-1';
                            } else {
                                mbClass = 'mb-4';
                            }
                        }
                        
                        return (
                            <div 
                                key={ex.id} 
                                className={`flex-1 min-h-[120px] bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl flex flex-col justify-center border-l-[12px] shadow-sm transition-all relative group px-6 py-6 ${
                                    useGroupColor 
                                    ? ex.groupColor.replace('bg-', 'border-') 
                                    : 'border-slate-500 dark:border-slate-700'
                                } ${mbClass}`}
                                style={{ 
                                    borderLeftColor: useGroupColor ? undefined : '#64748b'
                                }}
                            >
                                <div className="flex items-center w-full gap-6 md:gap-8">
                                    {ex.reps && (
                                        <div className="shrink-0 flex items-center justify-center bg-primary/10 rounded-2xl border border-primary/20 px-6 py-4 min-w-[100px] md:min-w-[140px]">
                                            <span className="font-mono font-black text-primary text-4xl md:text-5xl whitespace-nowrap leading-none">
                                                {formatReps(ex.reps)}
                                            </span>
                                        </div>
                                    )}
                                    <h4 className="font-black text-gray-900 dark:text-white text-3xl md:text-5xl leading-[0.9] tracking-tight overflow-visible whitespace-normal">
                                        {ex.name}
                                    </h4>
                                </div>

                                {ex.description && (
                                    <div className="mt-4 pl-2">
                                        <p className="font-medium text-gray-600 dark:text-gray-300 text-lg md:text-xl leading-snug">
                                            {ex.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none flex justify-center">
                <button 
                    onClick={onFinish} 
                    className="pointer-events-auto font-black text-xl py-4 px-12 rounded-2xl flex items-center justify-center gap-2 transition-all text-white shadow-xl shadow-primary/30 bg-primary hover:brightness-110 hover:scale-105 active:scale-95"
                >
                    Klar med blocket
                </button>
            </div>
        </div>
    );
};
