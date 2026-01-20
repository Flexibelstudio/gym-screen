
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
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
        >
            <motion.h2 
                initial={{ scale: 0.9, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                className="text-white text-5xl md:text-7xl font-black tracking-tighter mb-12 drop-shadow-2xl"
            >
                PAUSAD
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
            
            <p className="mt-12 text-white/50 font-medium uppercase tracking-widest text-sm">
                Klicka på en knapp för att fortsätta
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
                className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
            >
                <h2 className="text-2xl font-bold mb-1">Hantera Resultat</h2>
                <p className="text-primary font-semibold text-lg mb-6">{participantName}</p>

                <div className="space-y-6">
                    {/* Time Editor */}
                    <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-3 text-center">Justera Tid</label>
                        <div className="flex items-center gap-2 justify-center">
                            <div className="flex flex-col items-center">
                                <input
                                    type="number"
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-20 text-center bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-2xl font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                                />
                                <span className="text-xs text-gray-500 mt-1">min</span>
                            </div>
                            <span className="text-2xl font-bold pb-6">:</span>
                            <div className="flex flex-col items-center">
                                <input
                                    type="number"
                                    value={seconds}
                                    onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                    className="w-20 text-center bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-2xl font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                                />
                                <span className="text-xs text-gray-500 mt-1">sek</span>
                            </div>
                        </div>
                        <button 
                            onClick={handleSave}
                            className="w-full mt-4 bg-primary hover:brightness-95 text-white font-bold py-2 rounded-lg transition-colors shadow-sm"
                        >
                            Spara ny tid
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={onAddPenalty}
                            className="flex flex-col items-center justify-center p-3 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors border border-orange-200 dark:border-orange-800"
                        >
                            <span className="text-lg font-bold">+1:00</span>
                            <span className="text-xs font-medium">Strafftid</span>
                        </button>
                        <button 
                            onClick={onUndo}
                            className="flex flex-col items-center justify-center p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800"
                        >
                            <span className="text-lg font-bold">Ångra</span>
                            <span className="text-xs font-medium">Ta bort målgång</span>
                        </button>
                    </div>
                </div>
                
                <button 
                    onClick={onCancel}
                    className="w-full mt-6 text-gray-500 hover:text-gray-800 dark:hover:text-white font-medium py-2 transition-colors"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ångra målgång?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Vill du ta bort tiden för <span className="font-bold">{participantName}</span> och sätta dem som aktiva igen?</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 rounded-lg">Nej</button>
                <button onClick={onConfirm} disabled={isSaving} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg disabled:opacity-50">Ja, ångra</button>
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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Avsluta loppet?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Detta kommer att nollställa klockan. Vill du starta om eller lämna?</p>
            <div className="flex flex-col gap-3">
                <button onClick={onConfirm} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg shadow-sm transition-colors">
                    Starta om loppet (Nollställ)
                </button>
                {onExit && (
                    <button onClick={onExit} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-sm transition-colors">
                        Avsluta & Gå hem
                    </button>
                )}
                <button onClick={onCancel} className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-3 rounded-lg transition-colors">
                    Avbryt
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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Redigera startgrupper?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Om du går tillbaka nu nollställs loppet. Vill du fortsätta?</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 rounded-lg">Avbryt</button>
                <button onClick={onConfirm} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-2 rounded-lg">Gå tillbaka</button>
            </div>
        </div>
    </div>
);

export const RaceFinishAnimation: React.FC<{ 
  winnerName: string | null; 
  onDismiss: () => void;
  isSaving?: boolean;
}> = ({ winnerName, onDismiss, isSaving }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in" onClick={!isSaving ? onDismiss : undefined}>
        <Confetti />
        <div className="text-center text-white p-8" onClick={e => e.stopPropagation()}>
            <h1 className="text-6xl md:text-8xl font-black text-yellow-400 drop-shadow-lg mb-4 animate-bounce">MÅL!</h1>
            <p className="text-2xl md:text-4xl font-bold mb-8">Alla deltagare har gått i mål!</p>
            {winnerName && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border-2 border-yellow-400/50 shadow-2xl transform hover:scale-105 transition-transform duration-300">
                    <p className="text-sm uppercase tracking-widest text-yellow-200 mb-2">Vinnare</p>
                    <p className="text-4xl md:text-6xl font-black text-white">{winnerName}</p>
                </div>
            )}
            <button 
                onClick={onDismiss} 
                disabled={isSaving}
                className="mt-12 bg-white text-black font-black py-4 px-12 rounded-full text-xl hover:bg-gray-200 transition-all shadow-xl disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-3 mx-auto uppercase tracking-widest"
            >
                {isSaving && <div className="w-5 h-5 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>}
                {isSaving ? 'Sparar...' : 'Visa Resultat'}
            </button>
        </div>
    </div>
);
