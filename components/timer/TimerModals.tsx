
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Confetti } from '../WorkoutCompleteModal';
import QRCode from 'react-qr-code';
import { Trophy, QrCode as QrIcon, Clipboard, Check, X, Award, ChevronRight, Share2, Sparkles } from 'lucide-react';

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
            className="fixed inset-0 z-[9999] bg-white/60 dark:bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center pointer-events-auto"
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
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-24 text-center bg-white dark:bg-black border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-3xl font-mono font-black focus:ring-4 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                                />
                                <span className="text-[10px] font-bold text-gray-400 uppercase mt-2">min</span>
                            </div>
                            <span className="text-3xl font-black pb-8 text-gray-300">:</span>
                            <div className="flex flex-col items-center">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
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

export const RaceFinishAnimation: React.FC<{ 
    winnerName: string | null; 
    finalRaceId?: string | null;
    onDismiss: () => void;
}> = ({ winnerName, finalRaceId, onDismiss }) => {
    // Helper to format time inside the modal
    const formatTime = (timeInSeconds: number) => {
        const mins = Math.floor(timeInSeconds / 60);
        const secs = timeInSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const [selectedDivision, setSelectedDivision] = useState<string>('all');
    const [copied, setCopied] = useState(false);

    let fallbackWinner: string | null = winnerName;
    let divisionWinners: { 
        division: string; 
        top3: { 
            rank: number; 
            name: string; 
            time: number;
            startNumber?: number;
            teamName?: string;
            partnerName?: string;
        }[] 
    }[] | null = null;

    if (winnerName && (winnerName.trim().startsWith('{') || winnerName.trim().startsWith('['))) {
        try {
            const parsed = JSON.parse(winnerName);
            if (parsed.divisions && Array.isArray(parsed.divisions)) {
                fallbackWinner = parsed.fallback || null;
                divisionWinners = parsed.divisions;
            }
        } catch (e) {
            console.error("Failed to parse winner JSON:", e);
        }
    }

    const divisions = divisionWinners ? divisionWinners.map(d => d.division) : [];

    // Compile active list based on selected tab
    const getActiveResults = () => {
        if (!divisionWinners) return [];

        if (selectedDivision === 'all') {
            // Merge all divisions and sort by time
            const allItems: {
                name: string;
                time: number;
                division: string;
                startNumber?: number;
                teamName?: string;
                partnerName?: string;
            }[] = [];

            divisionWinners.forEach(div => {
                div.top3.forEach(p => {
                    allItems.push({
                        ...p,
                        division: div.division
                    });
                });
            });

            // Sort ascending by time
            return allItems
                .sort((a, b) => a.time - b.time)
                .map((item, idx) => ({
                    ...item,
                    rank: idx + 1
                }));
        } else {
            const divObj = divisionWinners.find(d => d.division === selectedDivision);
            return divObj ? divObj.top3 : [];
        }
    };

    const activeResults = getActiveResults();
    const shareUrl = finalRaceId 
        ? `${window.location.origin}/live/${finalRaceId}`
        : `${window.location.origin}/live`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(err => console.error("Kunde inte kopiera:", err));
    };

    return (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center z-[110] animate-fade-in overflow-y-auto py-6 sm:py-10 px-4" onClick={onDismiss}>
            <Confetti />
            <div className="w-full max-w-6xl mx-auto my-auto bg-slate-900/60 dark:bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-500/10 to-transparent w-96 h-96 rounded-full blur-3xl -z-10" />
                <div className="absolute bottom-0 left-0 bg-gradient-to-r from-emerald-500/5 to-transparent w-96 h-96 rounded-full blur-3xl -z-10" />

                {/* HEADING ACCENT */}
                <div className="flex flex-col items-center text-center mb-8">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full mb-3 shadow-lg shadow-indigo-500/5"
                    >
                        <Trophy className="w-7 h-7 text-yellow-400 animate-bounce" />
                    </motion.div>
                    <motion.h1 
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight leading-tight"
                    >
                        Kanonlopp! Loppet är avslutat 🎉
                    </motion.h1>
                    <p className="text-slate-400 text-sm mt-1 max-w-lg">
                        Alla deltagare har gått i mål och tiderna är officiellt sparade. Se hela listan och dela resultaten!
                    </p>
                </div>

                {/* MAIN GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    
                    {/* LEFT PART: INTERACTIVE LEADERBOARD (2 COLS) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* FLIKAR / DIVISION SELECTOR */}
                        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                            <button
                                type="button"
                                onClick={() => setSelectedDivision('all')}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    selectedDivision === 'all'
                                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-550 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                                }`}
                            >
                                Totalt (Alla)
                            </button>
                            {divisions.map((div) => (
                                <button
                                    key={div}
                                    type="button"
                                    onClick={() => setSelectedDivision(div)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        selectedDivision === div
                                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-550 text-white shadow-md'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                                    }`}
                                >
                                    {div}
                                </button>
                            ))}
                        </div>

                        {/* RESULT LIST TABLE */}
                        <div className="bg-slate-950/45 border border-slate-850 rounded-3xl overflow-hidden max-h-[50vh] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-850 bg-slate-950/80 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                                        <th className="py-3 px-4 w-16 text-center">Plats</th>
                                        <th className="py-3 px-4 w-16 text-center">Startnr</th>
                                        <th className="py-3 px-4">Deltagare / Lagnamn</th>
                                        {selectedDivision === 'all' && <th className="py-3 px-4 w-32 hidden sm:table-cell">Klass</th>}
                                        <th className="py-3 px-4 w-28 text-right">Tid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeResults.length === 0 ? (
                                        <tr>
                                            <td colSpan={selectedDivision === 'all' ? 5 : 4} className="py-8 text-center text-slate-500 italic bg-transparent">
                                                Inga resultat tillgängliga för denna klass
                                            </td>
                                        </tr>
                                    ) : (
                                        activeResults.map((p, index) => {
                                            const isTop3 = p.rank <= 3;
                                            const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : null;
                                            // Split team and partner names if provided
                                            return (
                                                <tr key={index} className="border-b border-slate-900 hover:bg-slate-900/40 transition-colors">
                                                    <td className="py-3.5 px-4 text-center">
                                                        {medal ? (
                                                            <span className="text-xl inline-block drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{medal}</span>
                                                        ) : (
                                                            <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 font-black">
                                                                #{p.rank}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-mono font-bold text-xs text-indigo-400">
                                                        {p.startNumber || '—'}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {p.teamName ? (
                                                            <div>
                                                                <div className="font-extrabold text-white text-sm tracking-tight">{p.teamName}</div>
                                                                <div className="text-[10px] text-slate-400 font-semibold">{p.name} {p.partnerName ? `& ${p.partnerName}` : ''}</div>
                                                            </div>
                                                        ) : p.partnerName ? (
                                                            <div>
                                                                <div className="font-extrabold text-white text-sm tracking-tight">{p.name} & {p.partnerName}</div>
                                                                <div className="text-[10px] text-slate-450 uppercase tracking-wider text-[9px] font-bold">Dubbel</div>
                                                            </div>
                                                        ) : (
                                                            <div className="font-bold text-white text-sm tracking-tight">{p.name}</div>
                                                        )}
                                                    </td>
                                                    {selectedDivision === 'all' && (
                                                        <td className="py-3.5 px-4 text-xs font-bold text-slate-400 hidden sm:table-cell">
                                                            {(p as any).division}
                                                        </td>
                                                    )}
                                                    <td className="py-3.5 px-4 text-right">
                                                        <span className="font-mono text-sm font-black text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/15">
                                                            {formatTime(p.time)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* RIGHT PART: PUBLIC SHARE & QR CODE CARD (1 COL) */}
                    <div className="bg-slate-950/70 border border-slate-800/80 rounded-[2rem] p-6 text-center space-y-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center">
                        <div className="absolute top-0 right-0 bg-indigo-500/5 w-24 h-24 rounded-full blur-xl" />
                        
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit">
                            <QrIcon className="w-5 h-5 animate-pulse" />
                        </div>
                        
                        <div>
                            <h3 className="font-black text-sm text-white uppercase tracking-wider">Mobil Resultatlänk</h3>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                                Deltagare och publik kan enkelt scanna QR-koden med sina mobiler för att följa liveresultaten och se sina tider direkt!
                            </p>
                        </div>

                        {/* QR CODE BOX */}
                        <div className="bg-white p-4 rounded-[1.8rem] shadow-xl inline-block border-4 border-slate-800">
                            <QRCode 
                                value={shareUrl}
                                size={155}
                                level="M"
                            />
                        </div>
                    </div>

                </div>

                {/* BOTTOM CLOSE BAR */}
                <div className="mt-8 pt-6 border-t border-slate-850 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-400">
                    <span className="flex items-center gap-2 text-slate-500">
                        <Sparkles className="w-4 h-4 text-[#CD7F32] animate-pulse" />
                        Officiella tider sparade av Flexibel Friskvård & Hälsa
                    </span>
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black py-4 px-10 rounded-2xl text-xs shadow-xl active:scale-95 transition-all uppercase tracking-widest cursor-pointer hover:scale-[1.02]"
                    >
                        Spara & Gå Tillbaka
                    </button>
                </div>
            </div>
        </div>
    );
};
