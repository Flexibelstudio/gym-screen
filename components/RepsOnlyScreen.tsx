
import React from 'react';
import { WorkoutBlock, Exercise, Organization } from '../types';
import { useWorkout } from '../context/WorkoutContext';
import { PlayIcon } from './icons';

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

    const count = block.exercises.length;
    const isLargeList = count > 8;
    const textSizeScale = isLargeList ? 0.6 : count > 6 ? 0.7 : count > 4 ? 0.85 : 1;
    const repsSizeScale = isLargeList ? 0.6 : count > 6 ? 0.7 : count > 4 ? 0.85 : 1;

    const titleBaseRem = 2.25;
    const repsBaseRem = 3;

    const calculatedTitleSize = `${titleBaseRem * textSizeScale}rem`;
    const calculatedRepsSize = `${repsBaseRem * repsSizeScale}rem`;

    const padding = isLargeList ? 'pl-8 pr-4 py-2' : count > 6 ? 'pl-8 pr-6 py-3' : 'px-10 py-4';

    return (
        <div className="w-full h-full flex flex-col bg-black p-4 md:p-6 overflow-hidden relative">
            {/* Top Header Box */}
            <div className="w-full flex-shrink-0 transition-colors duration-500 rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl bg-blue-600 border-blue-400 border-4 mb-4">
                <h1 className="text-5xl md:text-7xl lg:text-8xl text-white uppercase tracking-widest font-black text-center leading-none drop-shadow-lg">
                    {block.title}
                </h1>
                <p className="text-xl md:text-2xl text-blue-100 mt-4 font-bold uppercase tracking-wider text-center mb-6">
                    Utför i din egen takt
                </p>
                <button 
                    onClick={onFinish} 
                    className="font-black text-xl py-4 px-12 rounded-2xl flex items-center justify-center gap-3 transition-all text-blue-600 shadow-xl bg-white hover:bg-blue-50 hover:scale-105 active:scale-95"
                >
                    <span>Klar med blocket</span>
                    <PlayIcon className="w-6 h-6" />
                </button>
            </div>
            
            {/* Exercises List */}
            <div className="w-full flex-1 flex flex-col overflow-hidden pb-1">
                {block.exercises.map((ex, i) => {
                    const useGroupColor = !!ex.groupColor;
                    const nextEx = block.exercises[i + 1];
                    const isGroupedWithNext = nextEx && ex.groupId && ex.groupId === nextEx.groupId;
                    
                    let mbClass = '';
                    if (i < block.exercises.length - 1) {
                        if (isGroupedWithNext) {
                            mbClass = isLargeList ? 'mb-0' : 'mb-1';
                        } else {
                            mbClass = isLargeList ? 'mb-1' : count > 6 ? 'mb-2' : 'mb-4';
                        }
                    }
                    
                    return (
                        <div 
                            key={ex.id} 
                            className={`flex-1 min-h-0 bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl flex flex-col justify-center border-l-[12px] shadow-sm transition-all relative group ${
                                useGroupColor 
                                ? ex.groupColor.replace('bg-', 'border-') 
                                : 'border-gray-100 dark:border-transparent'
                            } ${padding} ${mbClass}`}
                            style={{ 
                                borderLeftColor: useGroupColor ? undefined : '#3b82f6' // blue-500
                            }}
                        >
                            <div className="flex items-center w-full gap-6 md:gap-8">
                                {ex.reps && (
                                    <div className="shrink-0 flex items-center justify-center bg-blue-500/10 rounded-2xl border border-blue-500/20 px-4 py-2 min-w-[80px] md:min-w-[120px]">
                                        <span 
                                            className="font-mono font-black text-blue-500 whitespace-nowrap leading-none"
                                            style={{ fontSize: calculatedRepsSize }}
                                        >
                                            {formatReps(ex.reps)}
                                        </span>
                                    </div>
                                )}
                                <h4 
                                    className="font-black text-gray-900 dark:text-white leading-[0.9] tracking-tight overflow-visible whitespace-normal transition-all duration-300"
                                    style={{ fontSize: calculatedTitleSize }}
                                >
                                    {ex.name}
                                </h4>
                            </div>

                            {ex.description && count <= 8 && (
                                <div className="mt-3 hidden sm:block pl-1">
                                    <p className="font-medium text-gray-600 dark:text-gray-300 leading-snug line-clamp-2" style={{ fontSize: `calc(${calculatedTitleSize} * 0.6)` }}>
                                        {ex.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
