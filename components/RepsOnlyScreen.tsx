
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
        <div className="flex-grow min-h-0 relative overflow-hidden flex flex-col transition-colors duration-1000 bg-slate-800 text-white">
            {/* Header Area */}
            <div className="w-full flex-shrink-0 flex flex-col items-center justify-center pt-12 pb-8 px-6 text-center z-10">
                <div className="mb-4 px-6 py-1.5 rounded-full bg-black/30 backdrop-blur-xl border border-white/20 shadow-lg inline-block">
                    <span className="font-black tracking-[0.2em] text-white/90 uppercase text-sm md:text-base">
                        Ingen Timer
                    </span>
                </div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white uppercase tracking-widest drop-shadow-lg leading-tight">
                    {block.title}
                </h1>
                <p className="text-xl md:text-2xl text-white/70 mt-4 font-medium tracking-wide">
                    Utför övningarna i din egen takt.
                </p>
            </div>
            
            {/* Exercises List */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 md:px-8 pb-4 custom-scrollbar z-10 w-full max-w-5xl mx-auto">
                <div className="space-y-3">
                    {block.exercises.map((ex) => {
                        const useGroupColor = !!ex.groupColor;
                        return (
                            <div 
                                key={ex.id} 
                                className={`p-5 md:p-6 rounded-2xl bg-black/40 backdrop-blur-sm border-l-[8px] border-y border-r border-white/10 shadow-lg transition-all hover:bg-black/50 ${
                                    useGroupColor ? ex.groupColor.replace('bg-', 'border-') : 'border-l-slate-500'
                                }`}
                            >
                                <div className="flex items-center gap-6">
                                    {ex.reps && (
                                        <div className="shrink-0 flex items-center justify-center bg-white/10 rounded-2xl border border-white/20 px-4 py-3 min-w-[100px]">
                                            <span className="font-mono font-black text-white text-3xl md:text-4xl leading-none">
                                                {formatReps(ex.reps)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-2xl md:text-4xl text-white/90 leading-tight">
                                            {ex.name}
                                        </h3>
                                        {ex.description && (
                                            <p className="text-lg md:text-xl text-white/60 mt-2 leading-relaxed">
                                                {ex.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Area */}
            <div className="w-full flex-shrink-0 py-6 px-6 z-10 bg-gradient-to-t from-slate-900/80 to-transparent">
                <div className="w-full max-w-5xl mx-auto flex items-center justify-center">
                    <button 
                        onClick={onFinish} 
                        className="font-black text-xl py-4 px-12 rounded-full flex items-center justify-center gap-3 transition-all text-white shadow-xl bg-teal-600 hover:bg-teal-500 hover:scale-105 active:scale-95 border-2 border-teal-400/50"
                    >
                        Klar med blocket
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
            
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-600/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-900/40 rounded-full blur-[100px]"></div>
            </div>
        </div>
    );
};
