
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
            className="fixed inset-0 overflow-hidden pointer-events-none z-[100001]" 
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
    const displayTitle = diploma.title || (pbCount > 0 ? "NYTT REKORD!" : "SNYGGT JOBBAT!");
    
    const subtitle = diploma.subtitle || diploma.message || "";
    const achievement = diploma.achievement || diploma.comparison || "";
    const footer = diploma.footer || "";
    const studioName = selectedOrganization?.name || "SmartCoach";
    
    // Safely parse icon: Fallback if AI gave a long description instead of a single emoji
    const icon = (diploma.imagePrompt && diploma.imagePrompt.length <= 15) ? diploma.imagePrompt : "🏆"; 

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
            className="fixed inset-0 z-[100000] bg-slate-50/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-10"
            onClick={onClose}
        >
            <AnimatePresence>
                {showConfetti && <Confetti />}
            </AnimatePresence>
            
            <motion.div 
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-[0_40px_80px_-15px_rgba(20,184,166,0.25)] dark:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] flex flex-col bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
                style={{ 
                    fontFamily: '"Inter", sans-serif',
                    maxHeight: '85vh'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Dekorativt ljus */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-record/20 dark:bg-record/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 dark:hidden rounded-full blur-[60px] -ml-10 -mb-10 pointer-events-none"></div>
                
                {/* Kryss (X) */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 min-h-[44px] min-w-[44px] p-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full shadow-xs transition-all active:scale-95 flex items-center justify-center"
                    aria-label="Stäng diplom"
                >
                    <CloseIcon className="w-5 h-5 text-gray-500 dark:text-white" />
                </button>

                {/* HEADER */}
                <div className="pt-8 pb-3 text-center px-6 flex-shrink-0 relative z-10">
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-[1.2] pt-[0.1em] mb-2 text-black dark:text-white">
                        {displayTitle}
                    </h1>
                    <div className="inline-block px-4 py-1 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-700 dark:text-gray-400 leading-[1.2] pt-[0.1em]">
                            {subtitle}
                        </p>
                    </div>
                </div>

                {/* HUVUDINNEHÅLL */}
                <div className="flex-grow overflow-y-auto px-6 pb-4 custom-scrollbar relative z-10">
                    <div className="flex flex-col items-center">
                        <motion.div 
                            initial={{ scale: 0.5, rotate: -3 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className={`${iconSizeClass} leading-none filter drop-shadow-2xl select-none`}
                        >
                            {icon}
                        </motion.div>
                        
                        <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-5 rounded-2xl w-full shadow-xs backdrop-blur-xs">
                            <p className="text-xl sm:text-2xl font-black text-black dark:text-white leading-tight mb-4 text-center">
                                {achievement}
                            </p>
                            
                            {/* PB-LISTA - RECORD GULD */}
                            {pbCount > 0 && (
                                <div className="space-y-2 mb-3">
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-record text-center mb-3 leading-[1.2] pt-[0.1em]">Nya PB satta 🏆</p>
                                    <div className="space-y-1.5">
                                        {diploma.newPBs?.map((pb, i) => {
                                            let diffText = `+${pb.diff} kg`;
                                            if (pb.weight === 0 && pb.reps !== undefined) {
                                                diffText = `+${pb.diff} reps`;
                                            } else if (pb.weight === 0 && pb.reps === undefined) {
                                                // Assuming time PB, diff is in seconds
                                                const m = Math.floor(pb.diff / 60);
                                                const s = Math.floor(pb.diff % 60);
                                                diffText = m > 0 ? `-${m}m ${s}s` : `-${s}s`;
                                            }
                                            return (
                                                <div key={i} className="flex justify-between items-center text-xs font-bold text-gray-900 dark:text-white bg-record/10 dark:bg-record/15 px-4 py-2.5 rounded-xl border border-record/30 shadow-xs">
                                                    <span className="truncate pr-4 uppercase tracking-tight leading-[1.2] pt-[0.1em]">{pb.exerciseName}</span>
                                                    <span className="text-record font-black shrink-0 tabular-nums">{diffText}</span>
                                                </div>
                                            );
                                        })}
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

                {/* FOOTER INFO & KNAPPAR */}
                <div className="px-6 pb-6 flex-shrink-0 flex flex-col gap-3 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-900 pt-4 relative z-10">
                    <div className="flex justify-between items-center">
                        <div className="text-left">
                            <p className="text-[10px] font-bold text-gray-900 dark:text-white tabular-nums">{new Date().toLocaleDateString('sv-SE')}</p>
                        </div>
                        
                        <div className="text-right flex flex-col items-end">
                            {selectedOrganization?.logoUrlLight ? (
                                <img src={selectedOrganization.logoUrlLight} alt={studioName} className="h-10 object-contain dark:hidden" referrerPolicy="no-referrer" />
                            ) : null}
                            {selectedOrganization?.logoUrlDark ? (
                                <img src={selectedOrganization.logoUrlDark} alt={studioName} className="h-10 object-contain hidden dark:block" referrerPolicy="no-referrer" />
                            ) : null}
                            {(!selectedOrganization?.logoUrlLight && !selectedOrganization?.logoUrlDark) && (
                                <p className="text-[12px] font-black text-primary uppercase tracking-tight">{studioName}</p>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={onClose}
                        className="w-full min-h-[44px] bg-primary hover:brightness-110 text-white font-black py-3 px-4 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-wider flex items-center justify-center shadow-lg shadow-primary/20"
                    >
                        <span>Stäng</span>
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );

    return createPortal(modalContent, document.body);
};
