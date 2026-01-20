
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Confetti } from '../WorkoutCompleteModal';

export const PauseOverlay: React.FC<{
    onResume: () => void;
    onRestart: () => void;
    onFinish: () => void;
}> = ({ onResume, onRestart, onFinish }) => {
    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/60 dark:bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
        >
            <motion.h2 
                initial={{ scale: 0.9, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                className="text-gray-900 dark:text-white text-5xl md:text-7xl font-black tracking-tighter mb-12 drop-shadow-2xl uppercase"
            >
                Pausad
            </motion.h2>

            <div className="flex flex-col gap-6 w-full max-w-md">
                <button 
                    onClick={onResume}
                    className="w-full bg-primary hover:brightness-110 text-white font-black py-6 rounded-3xl text-3xl shadow-2xl transition-all transform active:scale-95 border-b-8 border-teal-700 uppercase"
                >
                    Fortsätt
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={onRestart}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl text-xl shadow-xl transition-all transform active:scale-95 border-b-4 border-yellow-700 uppercase"
                    >
                        Starta om
                    </button>
                    <button 
                        onClick={onFinish}
                        className="bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl text-xl shadow-xl transition-all transform active:scale-95 border-b-4 border-red-800 uppercase"
                    >
                        Avsluta
                    </button>
                </div>
            </div>
            
            <p className="mt-12 text-gray-500 dark:text-white/50 font-black uppercase tracking-[0.3em] text-sm">
                Välj ett alternativ för att gå vidare
            </p>
        </motion.div>
    );
};

export const EditResultModal: React.FC<{
    participantName: string;
    currentTime: number;
    onSave: (newTime: number) => void;
    onAddPenalty: () => void;
    onUndo: () => void;
    onCancel: () => void;
}> = ({ participantName, currentTime, onSave, onAddPenalty, onUndo, onCancel }) => {
    const [minutes, setMinutes] = useState(0);
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        setMinutes(Math.floor(currentTime / 60));
        setSeconds(currentTime % 60);
    }, [currentTime]);

    const handleSave = () => {
        onSave(minutes * 60 + seconds);
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onCancel}
        >
            <motion.div
                className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 sm:p-10 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-100 dark:border-gray-800"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
            >
                <h2 className="text-2xl font-black uppercase tracking-tight mb-1">Rätta Resultat</h2>
                <p className="text-primary font-black text-xl mb-8">{participantName}</p>

                <div className="space-y-6">
                    {/* Time Editor */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-inner">
                        <label className="block text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 mb-4 text-center tracking-widest">Justera Tid</label>
                        <div className="flex items-center gap-3 justify-center">
                            <div className="flex flex-col items-center">
                                <input
                                    type="number"
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-24 text-center bg-white dark:bg-black border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-3xl font-mono font-black focus:ring-4 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                                />
                                <span className="text-[10px] font-bold text-gray-400 uppercase mt-2">min</span>
                            </div>
                            <span className="text-3xl font-black pb-8 text-gray-300">:</span>
                            <div className="flex flex-col items-center">
                                <input
                                    type="number"
                                    value={seconds}
                                    onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                    className="w-24 text-center bg-white dark:bg-black border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-3xl font-mono font-black focus:ring-4 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                                />
                                <span className="text-[10px] font-bold text-gray-400 uppercase mt-2">sek</span>
                            </div>
                        </div>
                        <button 
                            onClick={handleSave}
                            className="w-full mt-6 bg-primary hover:brightness-95 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 uppercase tracking-widest text-sm"
                        >
                            Spara ny tid
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={onAddPenalty}
                            className="flex flex-col items-center justify-center p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-2xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all border border-orange-200 dark:border-orange-800"
                        >
                            <span className="text-xl font-black">+1:00</span>
                            <span className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">Strafftid</span>
                        </button>
                        <button 
                            onClick={onUndo}
                            className="flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-200 dark:border-red-800"
                        >
                            <span className="text-xl font-black">Ångra</span>
                            <span className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">Ta bort</span>
                        </button>
                    </div>
                </div>
                
                <button 
                    onClick={onCancel}
                    className="w-full mt-8 text-gray-400 hover:text-gray-900 dark:hover:text-white font-black uppercase tracking-widest text-xs transition-colors"
                >
                    Avbryt
                </button>
            </motion.div>
        </div>
    );
};

export const UndoConfirmationModal: React.FC<{
    participantName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ participantName, onConfirm, onCancel, isSaving }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Ångra målgång?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed font-medium">Vill du ta bort tiden för <span className="font-bold text-gray-900 dark:text-white">{participantName}</span> och sätta dem som aktiva igen?</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Nej</button>
                <button onClick={onConfirm} disabled={isSaving} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-500/20 disabled:opacity-50 uppercase tracking-widest text-xs">Ja, ångra</button>
            </div>
        </div>
    </div>
);

export const RaceResetConfirmationModal: React.FC<{
    onConfirm: () => void;
    onCancel: () => void;
    onExit?: () => void;
}> = ({ onConfirm, onCancel, onExit }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-md text-center shadow-2xl border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Avsluta loppet?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed font-medium">Detta kommer att nollställa klockan och rensa alla tider. Är du säker?</p>
            <div className="flex flex-col gap-3">
                <button onClick={onConfirm} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black py-4 rounded-2xl shadow-lg shadow-yellow-500/20 transition-all uppercase tracking-widest text-sm">
                    Starta om loppet (Nollställ)
                </button>
                {onExit && (
                    <button onClick={onExit} className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-500/20 transition-all uppercase tracking-widest text-sm">
                        Avsluta & Gå hem
                    </button>
                )}
                <button onClick={onCancel} className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-sm">
                    Tillbaka till loppet
                </button>
            </div>
        </div>
    </div>
);

export const RaceBackToPrepConfirmationModal: React.FC<{
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Redigera grupper?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed font-medium">Om du går tillbaka nu nollställs klockan och tiderna. Vill du fortsätta?</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Avbryt</button>
                <button onClick={onConfirm} className="flex-1 bg-primary hover:brightness-95 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 uppercase tracking-widest text-xs">Fortsätt</button>
            </div>
        </div>
    </div>
);

export const RaceFinishAnimation: React.FC<{ winnerName: string | null; onDismiss: () => void }> = ({ winnerName, onDismiss }) => (
    <div className="fixed inset-0 bg-white/90 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] animate-fade-in" onClick={onDismiss}>
        <Confetti />
        <div className="text-center p-8 max-w-2xl" onClick={e => e.stopPropagation()}>
            <motion.h1 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-8xl md:text-[10rem] font-black text-yellow-500 dark:text-yellow-400 drop-shadow-2xl mb-4 animate-bounce tracking-tighter"
            >
                MÅL!
            </motion.h1>
            <p className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white mb-12 uppercase tracking-tight">Alla deltagare är hemma!</p>
            
            {winnerName && (
                <motion.div 
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white dark:bg-white/10 backdrop-blur-md rounded-[3rem] p-10 border-4 border-yellow-400 shadow-[0_30px_60px_-15px_rgba(234,179,8,0.3)] dark:shadow-2xl transform transition-transform duration-300 mb-12"
                >
                    <p className="text-xs font-black uppercase tracking-[0.4em] text-yellow-600 dark:text-yellow-300 mb-4">Dagens Vinnare</p>
                    <p className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">{winnerName}</p>
                </motion.div>
            )}
            
            <button 
                onClick={onDismiss} 
                className="bg-gray-900 dark:bg-white text-white dark:text-black font-black py-5 px-12 rounded-full text-xl shadow-2xl hover:scale-105 transition-transform uppercase tracking-widest active:scale-95"
            >
                Visa Resultattavla
            </button>
        </div>
    </div>
);
