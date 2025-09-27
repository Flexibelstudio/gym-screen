import React from 'react';
import { DisplayWindow } from '../types';
import { useStudio } from '../context/StudioContext';

interface DisplayWindowSelectionScreenProps {
    onSelectWindow: (window: DisplayWindow) => void;
}

export const DisplayWindowSelectionScreen: React.FC<DisplayWindowSelectionScreenProps> = ({ onSelectWindow }) => {
    const { selectedOrganization } = useStudio();
    
    const availableWindows = (selectedOrganization?.displayWindows || []).filter(w => w.isEnabled);

    return (
        <div className="w-full flex flex-col items-center justify-center p-8">
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-2">Välj Skyltfönster</h1>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">Välj vilket skyltfönster som ska visas på den här skärmen.</p>
            </div>
            {availableWindows.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                    {availableWindows.map(window => (
                        <button
                            key={window.id}
                            onClick={() => onSelectWindow(window)}
                            className="bg-gray-800 hover:bg-primary/20 hover:border-primary border-2 border-gray-700 text-white font-bold text-3xl h-48 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-lg"
                        >
                            {window.name}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center p-12 bg-gray-800 rounded-lg border border-dashed border-gray-700">
                    <p className="text-gray-400 text-lg">Det finns inga aktiverade skyltfönster att visa.</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Be en administratör att aktivera ett skyltfönster i inställningarna.</p>
                </div>
            )}
        </div>
    );
};
