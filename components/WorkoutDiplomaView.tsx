import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutDiploma } from '../types';
import { CloseIcon, TrophyIcon } from './icons';
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

    const pbCount = diploma.newPBs?.length || 0;
    // Använder titeln från diplomet (som nu slumpas vid skapande) istället för hårdkodad PB-text
    const displayTitle = diploma.title || (pbCount > 0 ? "NYTT REKORD!" : "SNYGGT JOBBAT!");
    
    const subtitle = diploma.subtitle || diploma.message || "";
    const achievement = diploma.achievement || diploma.comparison || "";
    const footer = diploma.footer || "";
    const studioName = selectedOrganization?.name || "SmartCoach";
    const icon = diploma.imagePrompt || "🏆"; 

    const iconSizeClass = pbCount > 5 
        ? "text-6xl sm:text-7xl mb-1" 
        : pbCount > 3 
            ? "text-7xl sm:text-8xl mb-3" 
            : "text-[9rem] sm:text-[10rem] mb-4";

    const modalContent = (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[12000] bg-black/90 dark:bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-10"
            onClick={onClose}
        >
            <AnimatePresence>
                {showConfetti && <Confetti />}
            </AnimatePresence>
            
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 40 }}
                transition={{ type: "spring", damping: 25, stiffness: 150 }}
                className="relative w-full max-w-sm rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] flex flex-col bg-white dark:bg-gray-950 border border-transparent dark:border-gray-800"
                style={{ 
                    fontFamily: '"Inter", sans-serif',
                    maxHeight: '85vh'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Dekorativt ljus */}
                <div className="absolute top-0 right-0 w-64 h-64 hidden dark:block bg-primary/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>
                
                {/* Kryss (X) */}
                <button 
                    onClick={onClose}
                    className="absolute top-5 right-5 z-50 p-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full shadow-sm transition-all active:scale-90"
                >
                    <CloseIcon className="w-5 h-5 text-gray-500 dark:text-white" />
                </button>

                {/* HEADER */}
                <div className="pt-10 pb-4 text-center px-8 flex-shrink-0">
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter leading-none mb-2 text-black dark:text-white">
                        {displayTitle}
                    </h1>
                    <div className="inline-block px-4 py-1 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-700 dark:text-gray-400">
                            {subtitle}
                        </p>
                    </div>
                </div>

                {/* HUVUDINNEHÅLL */}
                <div className="flex-grow overflow-y-auto px-6 pb-4 custom-scrollbar">
                    <div className="flex flex-col items-center">
                        <motion.div 
                            initial={{ scale: 0.5, rotate: -3 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className={`${iconSizeClass} leading-none filter drop-shadow-2xl select-none`}
                        >
                            {icon}
                        </motion.div>
                        
                        <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-5 rounded-[2rem] w-full shadow-sm">
                            <p className="text-xl sm:text-2xl font-black text-black dark:text-white leading-tight mb-4 text-center">
                                {achievement}
                            </p>
                            
                            {/* PB-LISTA */}
                            {pbCount > 0 && (
                                <div className="space-y-2 mb-3">
                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary text-center mb-2 opacity-80">Nya PB satta 🏆</p>
                                    <div className="space-y-1">
                                        {diploma.newPBs?.map((pb, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs font-bold text-gray-900 dark:text-white bg-white dark:bg-black/40 px-4 py-2.5 rounded-2xl border border-gray-50 dark:border-white/5 shadow-sm">
                                                <span className="truncate pr-4 uppercase tracking-tight">{pb.exerciseName}</span>
                                                <span className="text-primary font-black shrink-0">+{pb.diff} kg</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="w-10 h-0.5 bg-primary/20 mx-auto my-4 rounded-full"></div>
                            
                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 italic text-center leading-relaxed px-2">
                                {footer}
                            </p>
                        </div>
                    </div>
                </div>

                {/* FOOTER INFO */}
                <div className="px-8 pb-8 flex-shrink-0 flex justify-between items-center bg-white dark:bg-gray-950 border-t border-gray-50 dark:border-gray-900 pt-4">
                    <div className="text-left">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Datum</p>
                        <p className="text-[9px] font-bold text-gray-900 dark:text-white">{new Date().toLocaleDateString('sv-SE')}</p>
                    </div>
                    
                    <div className="text-right">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Studio</p>
                        <p className="text-[9px] font-black text-primary uppercase">{studioName}</p>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );

    return createPortal(modalContent, document.body);
};