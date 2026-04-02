import React, { useMemo } from 'react';
import { WorkoutLog } from '../../types';

interface ActivityCalendarProps {
    logs: WorkoutLog[];
    onDayClick: (date: Date, logs: WorkoutLog[]) => void;
}

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ logs, onDayClick }) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Get days in month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    // Adjust for Monday as first day of week
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(currentYear, currentMonth, i + 1);
        const dateString = date.toISOString().split('T')[0];
        
        // Find logs for this day
        const dayLogs = logs.filter(log => {
            const logDate = new Date(log.date);
            return logDate.toISOString().split('T')[0] === dateString;
        });

        return {
            date,
            dayNumber: i + 1,
            logs: dayLogs,
            isToday: dateString === today.toISOString().split('T')[0]
        };
    });

    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    {monthNames[currentMonth]} {currentYear}
                </h3>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                {['MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR', 'SÖN'].map(day => (
                    <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square rounded-xl bg-transparent"></div>
                ))}
                
                {days.map((day, i) => (
                    <button
                        key={i}
                        onClick={() => onDayClick(day.date, day.logs)}
                        className={`aspect-square flex flex-col items-center justify-start pt-2 rounded-xl transition-all relative group
                            ${day.isToday ? 'bg-gray-50 dark:bg-gray-800 border-2 border-primary/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'}
                        `}
                    >
                        <span className={`text-sm font-bold ${day.isToday ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                            {day.dayNumber}
                        </span>
                        
                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                            {day.logs.slice(0, 4).map((log, idx) => (
                                <div 
                                    key={idx} 
                                    className={`w-1.5 h-1.5 rounded-full ${log.activityType === 'custom_activity' ? 'bg-orange-500' : 'bg-primary'}`}
                                />
                            ))}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
