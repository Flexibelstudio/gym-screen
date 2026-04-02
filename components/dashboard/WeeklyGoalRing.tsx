import React from 'react';

interface WeeklyGoalRingProps {
    current: number;
    goal: number;
}

export const WeeklyGoalRing: React.FC<WeeklyGoalRingProps> = ({ current, goal }) => {
    const safeCurrent = Number(current) || 0;
    const safeGoal = Number(goal) || 3;
    const radius = 170;
    const circumference = 2 * Math.PI * radius;
    const percent = Math.min(100, Math.max(0, (safeCurrent / safeGoal) * 100));
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2 w-full text-left">Veckomål</h3>
            
            <div className="relative flex items-center justify-center w-full max-w-[320px] aspect-square">
                <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 400 400">
                    <circle
                        cx="200"
                        cy="200"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="32"
                        fill="transparent"
                        className="text-gray-100 dark:text-gray-800"
                    />
                    <circle
                        cx="200"
                        cy="200"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="32"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-primary transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-8xl sm:text-9xl font-black text-gray-900 dark:text-white leading-none mb-1">{safeCurrent}</span>
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">av {safeGoal} pass</span>
                    <span className="text-xs font-bold text-gray-500 text-center">
                        {safeCurrent >= safeGoal ? 'Målet nått! 🔥' : `${safeGoal - safeCurrent} pass kvar`}
                    </span>
                </div>
            </div>
        </div>
    );
};
