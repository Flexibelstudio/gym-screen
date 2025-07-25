import React from 'react';
import { Studio } from '../types';
import { useStudio } from '../context/StudioContext';

interface StudioSelectionScreenProps {
    onStudioSelected?: () => void;
}

export const StudioSelectionScreen: React.FC<StudioSelectionScreenProps> = ({ onStudioSelected }) => {
    const { selectStudio, allStudios, selectedOrganization, loading: contextLoading } = useStudio();

    const handleSelect = (studio: Studio) => {
        selectStudio(studio);
        if (onStudioSelected) {
            onStudioSelected();
        }
    };

    if (contextLoading) {
        return <div className="flex-grow flex items-center justify-center text-white text-xl">Laddar...</div>;
    }

    if (!selectedOrganization) {
        return <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-white">Ingen organisation vald</h2>
            <p className="text-gray-400 mt-2">Gå tillbaka och välj en organisation för att se dess studios.</p>
        </div>;
    }

    if (allStudios.length === 0) {
        return <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-white">Inga Studios Hittades</h2>
            <p className="text-gray-400 mt-2">Den valda organisationen har inga studios registrerade.</p>
        </div>;
    }

    return (
        <div className="w-full flex flex-col items-center justify-center p-8">
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-2">Välj Aktiv Studio</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                {allStudios.map(studio => (
                    <button
                        key={studio.id}
                        onClick={() => handleSelect(studio)}
                        className="bg-gray-800 hover:bg-primary/20 hover:border-primary border-2 border-gray-700 text-white font-bold text-3xl h-48 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-lg"
                    >
                        {studio.name}
                    </button>
                ))}
            </div>
             <p className="text-gray-500 mt-16 text-sm">Du kan byta studio när som helst från "För Coacher"-menyn.</p>
        </div>
    );
};