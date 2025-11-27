
import React, { useState } from 'react';
import { Organization, Studio } from '../../types';

interface StudiosContentProps {
    organization: Organization;
    onEditStudioConfig: (studio: Studio) => void;
    onCreateStudio: (organizationId: string, name: string) => Promise<void>;
    onUpdateStudio: (organizationId: string, studioId: string, name: string) => Promise<void>;
    onDeleteStudio: (organizationId: string, studioId: string) => Promise<void>;
}

export const StudiosContent: React.FC<StudiosContentProps> = ({ organization, onEditStudioConfig, onCreateStudio, onDeleteStudio }) => {
    const [newStudioName, setNewStudioName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudioName.trim()) return;
        setIsCreating(true);
        try {
            await onCreateStudio(organization.id, newStudioName.trim());
            setNewStudioName('');
        } catch (error) {
            console.error(error);
            alert("Kunde inte skapa skärm.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
         <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Skärmar</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Hantera dina skärmar och deras specifika inställningar.</p>
            </div>
            
             <div className="p-6 sm:p-8 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
                {organization.studios.map(studio => (
                    <div key={studio.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {studio.name[0].toUpperCase()}
                            </div>
                            <p className="font-bold text-lg text-gray-900 dark:text-white">{studio.name}</p>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button onClick={() => onEditStudioConfig(studio)} className="flex-1 sm:flex-none bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm">Inställningar</button>
                            <button onClick={() => onDeleteStudio(organization.id, studio.id)} className="flex-1 sm:flex-none bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold py-2 px-4 rounded-lg transition-colors text-sm border border-red-100 dark:border-red-900/30">Ta bort</button>
                        </div>
                    </div>
                ))}
                
                {organization.studios.length === 0 && (
                    <div className="text-center py-8 text-gray-400 italic">Inga skärmar skapade ännu.</div>
                )}
            </div>

             <div className="p-6 sm:p-8 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Lägg till ny skärm</h4>
                <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text" value={newStudioName} onChange={(e) => setNewStudioName(e.target.value)}
                        placeholder="Namn på skärm (t.ex. Reception, Gymgolv)"
                        className="flex-grow bg-gray-50 dark:bg-gray-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                    <button type="submit" disabled={isCreating || !newStudioName.trim()} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-transform active:scale-95">
                        {isCreating ? 'Skapar...' : 'Skapa Skärm'}
                    </button>
                </form>
            </div>
        </div>
    );
};
