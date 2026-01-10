
import React from 'react';
import { Studio } from '../types';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';

interface StudioSelectionScreenProps {
    onStudioSelected?: () => void;
}

export const StudioSelectionScreen: React.FC<StudioSelectionScreenProps> = ({ onStudioSelected }) => {
    const { selectStudio, allStudios, selectedOrganization, studioLoading: contextLoading } = useStudio();
    const { signOut, clearDeviceProvisioning } = useAuth();

    const handleSelect = (studio: Studio) => {
        // Lås enheten som en permanent skärm i localStorage
        localStorage.setItem('ny-screen-device-locked', 'true');
        selectStudio(studio);
        if (onStudioSelected) {
            onStudioSelected();
        }
    };

    const handleGoBack = () => {
        if (window.confirm("Är du säker på att du vill avsluta studioläget? Detta loggar ut enheten och tar bort låset till denna organisation.")) {
            // VIKTIGT: Rensa låset först för att bryta loopen
            clearDeviceProvisioning();
            signOut();
        }
    };

    if (contextLoading) {
        return <div className="flex-grow flex items-center justify-center text-white text-xl">Laddar...</div>;
    }

    if (!selectedOrganization) {
        return <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-white">Ingen organisation vald</h2>
            <p className="text-gray-400 mt-2">Gå tillbaka och välj en organisation för att se dess studios.</p>
            <button
                onClick={handleGoBack}
                className="mt-8 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
                Tillbaka till inloggning
            </button>
        </div>;
    }

    if (allStudios.length === 0) {
        return <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-white">Inga Studios Hittades</h2>
            <p className="text-gray-400 mt-2">Den valda organisationen har inga studios registrerade.</p>
            <button
                onClick={handleGoBack}
                className="mt-8 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
                Tillbaka till inloggning
            </button>
        </div>;
    }

    return (
        <div className="w-full flex flex-col items-center justify-center p-8">
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-2">Vilken anläggning är det här?</h1>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">Valet sparas lokalt på den här enheten och bestämmer vilka pass och inställningar som visas för medlemmar.</p>
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
             <button
                onClick={handleGoBack}
                className="mt-8 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
             >
                Tillbaka till inloggning
             </button>
        </div>
    );
};
