import React, { useMemo } from 'react';
import { WorkoutLog } from '../../types';

interface BodyHeatmapProps {
    logs: WorkoutLog[];
}

export const BodyHeatmap: React.FC<BodyHeatmapProps> = ({ logs }) => {
    // Calculate muscle group frequencies from the last 30 days
    const muscleFrequencies = useMemo(() => {
        const freqs: Record<string, number> = {
            bröst: 0, axlar: 0, triceps: 0, rygg: 0, biceps: 0, 
            mage: 0, bål: 0, ben: 0, säte: 0, ländrygg: 0
        };
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        logs.forEach(log => {
            if (log.date < thirtyDaysAgo.getTime()) return;
            
            // We assume tags are stored in log.tags or we can extract from exerciseResults if we had the full bank
            // For now, we'll use log.tags which often contains muscle groups if they were tagged
            if (log.tags) {
                log.tags.forEach(tag => {
                    const t = tag.toLowerCase();
                    if (freqs[t] !== undefined) {
                        freqs[t]++;
                    }
                });
            }
        });
        
        return freqs;
    }, [logs]);

    // Simple color scale based on frequency
    const getColor = (count: number) => {
        if (count === 0) return '#e5e7eb'; // gray-200
        if (count < 3) return '#c7d2fe'; // indigo-200
        if (count < 6) return '#818cf8'; // indigo-400
        return '#4f46e5'; // indigo-600
    };

    // Map specific muscle groups to SVG parts
    const colors = {
        chest: getColor(muscleFrequencies['bröst']),
        shoulders: getColor(muscleFrequencies['axlar']),
        arms: getColor(Math.max(muscleFrequencies['biceps'], muscleFrequencies['triceps'])),
        core: getColor(Math.max(muscleFrequencies['mage'], muscleFrequencies['bål'])),
        legs: getColor(Math.max(muscleFrequencies['ben'], muscleFrequencies['säte'])),
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 w-full text-left">Muskelbelastning (30 dgr)</h3>
            
            <div className="relative w-32 h-64">
                <svg viewBox="0 0 100 200" className="w-full h-full drop-shadow-md">
                    {/* Head */}
                    <circle cx="50" cy="20" r="12" fill="#e5e7eb" />
                    
                    {/* Shoulders & Chest */}
                    <path d="M 30 40 Q 50 35 70 40 L 65 70 Q 50 75 35 70 Z" fill={colors.chest} stroke="#ffffff" strokeWidth="2" />
                    
                    {/* Core/Abs */}
                    <path d="M 35 70 Q 50 75 65 70 L 60 100 Q 50 105 40 100 Z" fill={colors.core} stroke="#ffffff" strokeWidth="2" />
                    
                    {/* Left Arm */}
                    <path d="M 30 40 Q 20 45 15 65 L 20 90 L 30 65 Z" fill={colors.arms} stroke="#ffffff" strokeWidth="2" />
                    
                    {/* Right Arm */}
                    <path d="M 70 40 Q 80 45 85 65 L 80 90 L 70 65 Z" fill={colors.arms} stroke="#ffffff" strokeWidth="2" />
                    
                    {/* Left Leg */}
                    <path d="M 40 100 L 30 160 L 45 160 L 50 110 Z" fill={colors.legs} stroke="#ffffff" strokeWidth="2" />
                    
                    {/* Right Leg */}
                    <path d="M 60 100 L 70 160 L 55 160 L 50 110 Z" fill={colors.legs} stroke="#ffffff" strokeWidth="2" />
                </svg>
            </div>
            
            <div className="flex gap-3 mt-4 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-200"></div> Låg</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-400"></div> Medel</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-600"></div> Hög</div>
            </div>
        </div>
    );
};
