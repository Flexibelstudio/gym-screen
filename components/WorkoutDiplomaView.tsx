import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutDiploma } from '../types';
import { CloseIcon } from './icons';
import { useStudio } from '../context/StudioContext';

interface WorkoutDiplomaViewProps {
    diploma: WorkoutDiploma & { imageUrl?: string };
    onClose: () => void;
}

const Confetti = React.memo(() => {
    const particles = useMemo(() => Array.from({ length: 80 }).map((_, i) => ({
        id: i,
        style: {
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${4 + Math.random() * 4}s`,
            backgroundColor: ['#14b8a6', '#0d9488', '#fbbf24', '#f59e0b', '#6b7280'][Math.floor(Math.random() * 5)],
            transform: `rotate(${Math.random() * 360}deg)`
        }
    })), []);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 overflow-hidden pointer-events-none z-[12500]" 
            aria-hidden="true"
        >
            {particles.map(p => (
                <div key={p.id} className="confetti-piece" style={p.style}></div>
            ))}
        </motion.div>
    );
});

export const WorkoutDiplomaView: React.FC<WorkoutDiplomaViewProps> = ({ diploma, onClose }) => {
    const { selectedOrganization } = useStudio();
    const [showConfetti, setShowConfetti] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowConfetti(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    const title = diploma.title;
    const subtitle = diploma.subtitle || diploma.message || "";
    const achievement = diploma.achievement || diploma.comparison || "";
    const footer = diploma.footer || "";
    const studioName = selectedOrganization?.name || "SmartCoach";
    
    const icon = diploma.imagePrompt || "🏆"; 

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[12000] bg-black/70 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
            onClick={onClose}
        >
            <AnimatePresence>
                {showConfetti && <Confetti />}
            </AnimatePresence>
            
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 40 }}
                transition={{ type: "spring", damping: 20, stiffness: 120 }}
                className="relative w-full max-w-sm rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] flex flex-col bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800"
                style={{ 
                    fontFamily: '"Inter", sans-serif',
                    aspectRatio: '9/16',
                    maxHeight: '90vh'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-0 right-0 w-64 h-64 hidden dark:block bg-primary/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 hidden dark:block bg-purple-500/10 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none"></div>

                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-50 p-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full shadow-md border border-gray-200 dark:border-white/10 transition-all active:scale-90"
                >
                    <CloseIcon className="w-5 h-5 text-gray-500 dark:text-white" />
                </button>

                <div className="relative z-10 flex flex-col h-full justify-between p-8 sm:p-10 text-center">
                    <div className="pt-8">
                        <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none mb-4 text-black dark:text-white">
                            {title}
                        </h1>
                        <div className="inline-block px-4 py-1.5 rounded-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 shadow-sm">
                            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-700 dark:text-gray-300">
                                {subtitle}
                            </p>
                        </div>
                    </div>

                    <div className="flex-grow flex flex-col items-center justify-center py-6">
                        <motion.div 
                            initial={{ scale: 0.5, rotate: -10 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                            className="text-[8.5rem] sm:text-[10.5rem] leading-none filter drop-shadow-2xl mb-8 transform hover:scale-110 transition-transform cursor-default select-none"
                        >
                            {icon}
                        </motion.div>
                        
                        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-7 rounded-[2rem] w-full shadow-sm">
                            <p className="text-xl sm:text-2xl font-black text-black dark:text-white leading-tight mb-2">
                                {achievement}
                            </p>
                            
                            {/* PB SECTION - Unified Naming */}
                            {diploma.newPBs && diploma.newPBs.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Nya Rekord Satta! 🏆</p>
                                    {diploma.newPBs.map((pb, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs font-bold text-gray-900 dark:text-white bg-white dark:bg-black/40 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                                            <span className="truncate pr-2">{pb.exerciseName}</span>
                                            <span className="text-primary shrink-0">+{pb.diff} kg</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="w-12 h-1.5 bg-primary mx-auto my-4 rounded-full"></div>
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-400 italic">
                                {footer}
                            </p>
                        </div>
                    </div>

                    <div className="pb-4">
                        <div className="flex justify-between items-end px-2">
                            <div className="text-left">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Datum</p>
                                <p className="text-xs font-bold text-black dark:text-white">{new Date().toLocaleDateString('sv-SE')}</p>
                            </div>
                            
                            <div className="text-right">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Studio</p>
                                <p className="text-xs font-black text-primary uppercase">{studioName}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 px-8 pb-8">
                    <button 
                        onClick={onClose}
                        className="w-full bg-black dark:bg-white text-white dark:text-black hover:brightness-110 font-black py-5 rounded-2xl shadow-xl transition-all transform active:scale-95 text-lg uppercase tracking-widest"
                    >
                        Stäng
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};