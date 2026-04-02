import React from 'react';

interface WeeklyGoalRingProps {
    current: number;
    goal: number;
}

export const WeeklyGoalRing: React.FC<WeeklyGoalRingProps> = ({ current, goal }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const percent = Math.min(100, Math.max(0, (current / goal) * 100));
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 w-full text-left">Veckomål</h3>
            
            <div className="relative flex items-center justify-center">
                <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-gray-100 dark:text-gray-800"
                    />
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-primary transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-900 dark:text-white leading-none">{current}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">av {goal} pass</span>
                </div>
            </div>
            
            <p className="text-xs font-bold text-gray-500 mt-4 text-center">
                {current >= goal ? 'Målet nått! Grymt jobbat! 🔥' : `${goal - current} pass kvar till målet.`}
            </p>
        </div>
    );
};
