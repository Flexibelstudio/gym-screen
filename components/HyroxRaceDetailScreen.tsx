
import React, { useState, useEffect, useMemo } from 'react';
import { HyroxRace } from '../types';
import { getRace } from '../services/firebaseService';

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
        const fetchRace = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const raceData = await getRace(raceId);
                if (!raceData) {
                    throw new Error("Loppet kunde inte hittas.");
                }
                setRace(raceData);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Ett okänt fel inträffade.");
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRace();
    }, [raceId]);

    const sortedResults = useMemo(() => {
        if (!race) return [];
        return [...race.results].sort((a, b) => a.time - b.time);
    }, [race]);
    
    if (isLoading) {
        return <div className="text-center text-gray-900 dark:text-white">Laddar resultat...</div>;
    }
    
    if (error) {
        return <div className="text-center text-red-500">{error}</div>;
    }

    if (!race) {
        return null;
    }

    return (
        <div className="w-full max-w-4xl mx-auto animate-fade-in relative">
            <div className="text-center mb-8 pt-8 sm:pt-0">
                <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white">Resultat – {race.raceName}</h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">
                    {new Date(race.createdAt).toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-primary mb-4">Resultatöversikt</h2>
                {sortedResults.length > 0 ? (
                    <>
                        <div className="overflow-x-auto rounded-md">
                            <table className="w-full text-left">
                                <thead className="border-b-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/50">
                                    <tr>
                                        <th className="p-3 w-16 text-sm font-semibold text-gray-500 dark:text-gray-400">#</th>
                                        <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Namn</th>
                                        <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Startgrupp</th>
                                        <th className="p-3 text-right text-sm font-semibold text-gray-500 dark:text-gray-400">Tid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedResults.map((result, index) => {
                                        const group = race.startGroups.find(g => g.id === result.groupId);
                                        
                                        let rowClass = "border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700/50";
                                        let textClass = "text-gray-900 dark:text-white";
                                        
                                        switch(index) {
                                            case 0: // Gold
                                                rowClass = `bg-[#FFD700] hover:bg-yellow-400/80 border-b border-yellow-800/20 last:border-b-0`;
                                                textClass = "text-black font-semibold";
                                                break;
                                            case 1: // Silver
                                                rowClass = `bg-[#C0C0C0] hover:bg-gray-400/80 border-b border-gray-600/20 last:border-b-0`;
                                                textClass = "text-black font-semibold";
                                                break;
                                            case 2: // Bronze
                                                rowClass = `bg-[#CD7F32] hover:bg-orange-700/80 border-b border-orange-900/20 last:border-b-0`;
                                                textClass = "text-white font-semibold";
                                                break;
                                        }

                                        return (
                                            <tr key={result.participant} className={rowClass}>
                                                <td className={`p-3 font-bold ${textClass}`}>
                                                    {index === 0 && '🥇 '}
                                                    {index === 1 && '🥈 '}
                                                    {index === 2 && '🥉 '}
                                                    {index + 1}
                                                </td>
                                                <td className={`p-3 ${textClass}`}>{result.participant}</td>
                                                <td className={`p-3 ${index > 2 ? 'text-gray-600 dark:text-gray-300' : textClass}`}>{group?.name || 'Okänd'}</td>
                                                <td className={`p-3 text-right font-mono ${textClass}`}>{formatResultTime(result.time)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                         <div className="text-center text-gray-500 dark:text-gray-400 mt-4 text-sm">
                            Totalt {sortedResults.length} deltagare slutförde loppet.
                        </div>
                    </>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Inga resultat har registrerats för detta lopp ännu.</p>
                )}
            </div>
        </div>
    );
};
