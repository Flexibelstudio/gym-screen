import React from 'react';

interface WeeklyGoalRingProps {
    current: number;
    goal: number;
    summerWeekPoints?: number;
    summerTotalPoints?: number;
    hasSummerSisu?: boolean;
}

export const WeeklyGoalRing: React.FC<WeeklyGoalRingProps> = ({ 
    current, 
    goal, 
    summerWeekPoints = 0, 
    summerTotalPoints = 0, 
    hasSummerSisu = false 
}) => {
    const safeCurrent = Number(current) || 0;
    const safeGoal = Number(goal) || 3;
    const radius = 170;
    const circumference = 2 * Math.PI * radius;
    const percent = Math.min(100, Math.max(0, (safeCurrent / safeGoal) * 100));
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] p-4 sm:p-5 shadow-sm border border-gray-100/50 dark:border-gray-800/50 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center w-full max-w-[280px] aspect-square">
                <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 400 400">
                    <circle
                        cx="200"
                        cy="200"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="20"
                        fill="transparent"
                        className="text-gray-100 dark:text-gray-800"
                    />
                    <circle
                        cx="200"
                        cy="200"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="20"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-primary transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-xs sm:text-sm font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Veckomål</span>
                    <span className="text-7xl sm:text-8xl font-black text-gray-900 dark:text-white leading-none mb-1">{safeCurrent}</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">av {safeGoal} pass</span>
                    <span className="text-[10px] sm:text-xs font-bold text-gray-500">
                        {safeCurrent >= safeGoal ? 'Målet nått! 🔥' : `${safeGoal - safeCurrent} pass kvar`}
                    </span>
                </div>
            </div>

            {hasSummerSisu && (
                <div className="mt-4 flex items-center gap-4 border-t border-gray-150 dark:border-gray-800 pt-4 w-full justify-around">
                    <div className="text-center flex-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mb-0.5">Veckopoäng</span>
                        <span className="text-lg font-black text-amber-500 dark:text-amber-450 flex items-center justify-center gap-1">
                            ☀️ {summerWeekPoints}p
                        </span>
                    </div>
                    <div className="h-8 w-[1px] bg-gray-150 dark:bg-gray-800" />
                    <div className="text-center flex-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mb-0.5">Total Sisu</span>
                        <span className="text-lg font-black text-orange-500 flex items-center justify-center gap-1">
                            🏆 {summerTotalPoints}p
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
