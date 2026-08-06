import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon, SparklesIcon, CloseIcon } from '../icons';

export const SmartItem: React.FC<{ letter: string, color: string, title: string, text: string }> = ({ letter, color, title, text }) => (
    <div className="flex gap-4 group">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm transition-transform group-hover:scale-110`}>
            {letter}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">{title}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{text || 'Ej angivet.'}</p>
        </div>
    </div>
);

// --- Resume Banner Component (Enhanced Amber UI) ---
export const ResumeWorkoutBanner: React.FC<{ 
    workoutTitle: string, 
    onContinue: () => void, 
    onDismiss: () => void 
}> = ({ workoutTitle, onContinue, onDismiss }) => (
    <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-400 to-orange-500 rounded-[2rem] p-6 text-orange-950 shadow-xl shadow-orange-500/30 border border-white/40"
    >
        {/* Animated background highlights */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-600/10 rounded-full blur-2xl -ml-10 -mb-10"></div>
        
        <div className="relative z-10 flex flex-wrap md:flex-nowrap items-center justify-between gap-5">
            <div className="flex items-center gap-4 text-left flex-1 min-w-[250px]">
                <div className="w-14 h-14 bg-orange-950/10 rounded-2xl flex items-center justify-center shadow-inner shrink-0 border border-orange-950/5">
                    <ClockIcon className="w-7 h-7 text-orange-900 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-900/60 mb-0.5">Du har ett pågående pass</h4>
                    <p className="text-xl font-black leading-[1.2] pt-[0.1em] line-clamp-2 break-words text-orange-950 drop-shadow-sm">{workoutTitle}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
                <button 
                    onClick={onDismiss}
                    className="flex-1 sm:flex-none min-h-[44px] px-5 py-3 rounded-xl text-xs font-black bg-orange-950/10 hover:bg-orange-950/20 transition-colors uppercase tracking-widest text-orange-900 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-orange-900"
                >
                    Släng
                </button>
                <button 
                    onClick={onContinue}
                    className="flex-[2] sm:flex-none min-h-[44px] px-8 py-3 rounded-xl text-xs font-black bg-primary text-white shadow-xl hover:scale-105 transition-all uppercase tracking-widest active:scale-95 ring-2 ring-orange-950/5 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    Fortsätt logga
                </button>
            </div>
        </div>
    </motion.div>
);

export const MonthlyWrappedBanner: React.FC<{ 
    monthNameCap: string, 
    onOpen: () => void, 
    onDismiss: () => void 
}> = ({ monthNameCap, onOpen, onDismiss }) => (
    <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 relative overflow-hidden bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-purple-950/20 border border-purple-500/30"
    >
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-left flex-1 min-w-[220px]">
                <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center shrink-0 border border-purple-400/30 text-purple-300">
                    <SparklesIcon className="w-6 h-6 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-300/80 mb-0.5">Månadssummering</h4>
                    <p className="text-lg font-black leading-tight text-white drop-shadow-sm">
                        Din {monthNameCap} är klar 🎉 — se din summering
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                <button
                    onClick={onDismiss}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
                    title="Avfärda"
                >
                    <CloseIcon className="w-4 h-4" />
                </button>
                <button
                    onClick={onOpen}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-black bg-primary hover:bg-primary-dark text-white shadow-lg transition-all uppercase tracking-wider active:scale-95 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    Se summering
                </button>
            </div>
        </div>
    </motion.div>
);
