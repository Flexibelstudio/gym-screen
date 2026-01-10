import React, { useState, useEffect } from 'react';
import { HyroxRace } from '../types';
import { getPastRaces } from '../services/firebaseService';
import { useStudio } from '../context/StudioContext';
import { motion } from 'framer-motion';

interface HyroxRaceListScreenProps {
    onSelectRace: (raceId: string) => void;
}

export const HyroxRaceListScreen: React.FC<HyroxRaceListScreenProps> = ({ onSelectRace }) => {
    const { selectedOrganization } = useStudio();
    const [races, setRaces] = useState<HyroxRace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedOrganization) {
            setError("Ingen organisation vald.");
            setIsLoading(false);
            return;
        }

        const fetchRaces = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const pastRaces = await getPastRaces(selectedOrganization.id);
                setRaces(pastRaces);
            } catch (e) {
                setError("Kunde inte hämta tidigare lopp.");
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRaces();
    }, [selectedOrganization]);

    return (
        <div className="w-full max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-8 text-center">Tidigare Lopp</h1>

            {isLoading && <p className="text-center text-gray-500 dark:text-gray-400">Laddar lopp...</p>}
            {error && <p className="text-center text-red-400">{error}</p>}
            
            {!isLoading && !error && (
                races.length > 0 ? (
                    <div className="space-y-4">
                        {races.map((race, index) => (
                            <motion.div
                                key={race.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: "easeOut", delay: index * 0.05 }}
                            >
                                <button
                                    onClick={() => onSelectRace(race.id)}
                                    className="w-full bg-gray-100 dark:bg-gray-800 px-6 py-4 rounded-xl flex justify-between items-center border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 shadow-sm transition-colors duration-150 ease-in-out text-left"
                                >
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{race.raceName}</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(race.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <span className="text-primary font-semibold hover:underline">Visa resultat &rarr;</span>
                                </button>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-12 bg-gray-100 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">Inga tidigare lopp har sparats.</p>
                    </div>
                )
            )}
        </div>
    );
};