
import React, { useState, useEffect, useMemo } from 'react';
import { HyroxRace } from '../types';
import { getRace, listenToRace } from '../services/firebaseService';
import QRCode from 'react-qr-code';

interface HyroxRaceDetailScreenProps {
    raceId: string;
    onBack: () => void;
}

const formatResultTime = (timeInSeconds: number) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    
    const parts: string[] = [];
    if (hours > 0) parts.push(String(hours).padStart(2, '0'));
    parts.push(String(minutes).padStart(2, '0'));
    parts.push(String(seconds).padStart(2, '0'));

    return parts.join(':');
};

export const HyroxRaceDetailScreen: React.FC<HyroxRaceDetailScreenProps> = ({ raceId, onBack }) => {
    const [race, setRace] = useState<HyroxRace | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        const unsubscribe = listenToRace(raceId, (raceData) => {
            setIsLoading(false);
            if (!raceData) {
                setError("Loppet kunde inte hittas.");
            } else {
                setRace(raceData);
                setError(null);
            }
        });
        return () => unsubscribe();
    }, [raceId]);

    const [selectedDivision, setSelectedDivision] = useState<string>('all');

    const activeDivisions = useMemo(() => {
        if (!race) return [];
        const divs = new Set<string>();
        race.results.forEach(r => {
            if (r.division) divs.add(r.division);
        });
        return Array.from(divs).sort();
    }, [race]);

    const filteredResults = useMemo(() => {
        if (!race) return [];
        const list = [...race.results].sort((a, b) => a.time - b.time);
        if (selectedDivision === 'all') return list;
        return list.filter(r => r.division === selectedDivision);
    }, [race, selectedDivision]);
    
    if (isLoading) {
        return <div className="text-center text-gray-900 dark:text-white">Laddar resultat...</div>;
    }
    
    if (error) {
        return <div className="text-center text-red-500">{error}</div>;
    }

    if (!race) {
        return null;
    }

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/live/${raceId}` : 'https://mindmote.se/live';

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in relative px-4 py-6">
            <div className="text-center mb-8">
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs uppercase tracking-wider">Slutresultat sparat</span>
                <h1 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mt-1.5 tracking-tight">{race.raceName}</h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 mt-2 font-medium">
                    {new Date(race.createdAt).toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* RESULTS TABLE */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-[2rem] p-6 sm:p-8 shadow-xl border border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-black tracking-tight text-gray-950 dark:text-gray-50 mb-3 uppercase">Placeringar</h2>
                    
                    {activeDivisions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-5">
                            <button
                                onClick={() => setSelectedDivision('all')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                                    selectedDivision === 'all'
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-black'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-250 dark:hover:bg-gray-600/80'
                                }`}
                            >
                                Alla klasser
                            </button>
                            {activeDivisions.map(div => (
                                <button
                                    key={div}
                                    onClick={() => setSelectedDivision(div)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                                        selectedDivision === div
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-black'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-650 dark:text-gray-300 hover:bg-gray-250 dark:hover:bg-gray-600/80'
                                    }`}
                                >
                                    {div}
                                </button>
                            ))}
                        </div>
                    )}

                    {filteredResults.length > 0 ? (
                        <>
                            <div className="overflow-x-auto rounded-xl border border-gray-150 dark:border-gray-700">
                                <table className="w-full text-left border-collapse">
                                    <thead className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                                        <tr>
                                            <th className="p-4 w-16 text-xs font-black uppercase tracking-wider text-gray-400">#</th>
                                            <th className="p-4 text-xs font-black uppercase tracking-wider text-gray-400">Namn</th>
                                            <th className="p-4 text-xs font-black uppercase tracking-wider text-gray-400">Startgrupp</th>
                                            <th className="p-4 text-right text-xs font-black uppercase tracking-wider text-gray-400">Tid</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResults.map((result, index) => {
                                            const group = race.startGroups.find(g => g.id === result.groupId);
                                            const matchedParticipant = group?.participantList?.find(p => 
                                                p.name === result.participant || 
                                                (p.partnerName && `${p.name} & ${p.partnerName}` === result.participant)
                                            );
                                            const finalTeamName = result.teamName || matchedParticipant?.teamName;
                                            
                                            let rowClass = "border-b border-gray-150 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50";
                                            let textClass = "text-gray-900 dark:text-white";
                                            
                                            switch(index) {
                                                case 0: // Gold
                                                    rowClass = `bg-amber-400 hover:bg-amber-300 border-b border-amber-500/20 last:border-b-0`;
                                                    textClass = "text-black font-extrabold";
                                                    break;
                                                case 1: // Silver
                                                    rowClass = `bg-slate-300 hover:bg-slate-200 border-b border-slate-400/20 last:border-b-0`;
                                                    textClass = "text-black font-extrabold";
                                                    break;
                                                case 2: // Bronze
                                                    rowClass = `bg-[#CD7F32]/80 hover:bg-[#CD7F32]/90 border-b border-orange-950/20 last:border-b-0`;
                                                    textClass = "text-white font-extrabold";
                                                    break;
                                            }

                                            return (
                                                <tr key={result.participant} className={rowClass}>
                                                    <td className={`p-4 text-sm font-black ${textClass}`}>
                                                        {index === 0 && '🥇 '}
                                                        {index === 1 && '🥈 '}
                                                        {index === 2 && '🥉 '}
                                                        {index > 2 && `${index + 1}`}
                                                    </td>
                                                    <td className={`p-4 text-sm font-bold ${textClass}`}>
                                                        {finalTeamName ? (
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-black ${index <= 2 ? 'text-black' : 'text-indigo-650 dark:text-indigo-400'}`}>{finalTeamName}</span>
                                                                <span className={`text-xs font-semibold ${index <= 2 ? 'text-black/75' : 'text-gray-500 dark:text-gray-450'}`}>
                                                                    {result.participant.includes(' & ') ? (
                                                                        <span>
                                                                            {result.participant.split(' & ')[0]} <span className="font-semibold text-gray-450 opacity-90">&</span> {result.participant.split(' & ')[1]}
                                                                        </span>
                                                                    ) : (
                                                                        result.participant
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span>
                                                                {result.participant.includes(' & ') ? (
                                                                    <span>
                                                                        {result.participant.split(' & ')[0]} <span className={`font-semibold opacity-90 ${index <= 2 ? 'text-black' : 'text-gray-400'}`}>&</span> {result.participant.split(' & ')[1]}
                                                                    </span>
                                                                ) : (
                                                                    result.participant
                                                                )}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className={`p-4 text-sm ${index > 2 ? 'text-gray-650 dark:text-gray-300 font-medium' : `${textClass}`}`}>
                                                        <div className="flex flex-col">
                                                            <span>{group?.name || 'Okänd'}</span>
                                                            {selectedDivision === 'all' && result.division && (
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${index <= 2 ? 'text-black/60' : 'text-indigo-500 dark:text-indigo-400'}`}>
                                                                    {result.division}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={`p-4 text-right font-mono text-sm ${textClass}`}>{formatResultTime(result.time)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="text-center font-bold text-gray-400 dark:text-gray-500 mt-4 text-xs uppercase tracking-widest">
                                Totalt {race.results.length} deltagare slutförde loppet
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Inga resultat har registrerats för detta lopp ännu.</p>
                    )}
                </div>

                {/* QR-CODE AND SAVE TO PHONE SIDE PANEL */}
                <div className="bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 border border-slate-800 text-white rounded-[2.5rem] p-8 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02]">
                        <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" />
                        </svg>
                    </div>

                    <div className="relative z-10 w-full flex flex-col items-center">
                        <span className="px-2.5 py-1 rounded bg-indigo-500/25 text-indigo-300 font-extrabold text-[9px] uppercase tracking-widest mb-3">Visa i mobilen</span>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2">Skanna resultat</h3>
                        <p className="text-xs text-slate-300 mb-6 leading-relaxed">
                            Håll upp mobilkameran mot QR-koden för att ladda ner slutresultatet och se din personliga tid och placering!
                        </p>
                        <div className="bg-white p-4 rounded-[2rem] shadow-inner border border-slate-700/50 mb-5 flex items-center justify-center">
                            <QRCode 
                                value={shareUrl} 
                                size={180}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                level="M"
                            />
                        </div>
                        <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-widest">Studios Liveresultat</span>
                        <p className="text-[9px] text-slate-400 mt-2 font-mono break-all max-w-full px-2">
                            {shareUrl}
                        </p>
                        
                        <button 
                            onClick={onBack}
                            className="mt-8 bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-extrabold py-3.5 px-6 rounded-2xl tracking-wider uppercase transition-all w-full"
                        >
                            Avsluta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
