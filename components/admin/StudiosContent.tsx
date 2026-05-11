
import React, { useState } from 'react';
import { Organization, Studio } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface StudiosContentProps {
    organization: Organization;
    onEditStudioConfig: (studio: Studio) => void;
    onCreateStudio: (organizationId: string, name: string, locationId?: string) => Promise<void>;
    onUpdateStudio: (organizationId: string, studioId: string, name: string, locationId?: string) => Promise<void>;
    onDeleteStudio: (organizationId: string, studioId: string) => Promise<void>;
    onSwitchToStudioView: (studio: Studio) => void;
    onLockStudioDevice?: (studio: Studio) => void;
}

export const StudiosContent: React.FC<StudiosContentProps> = ({ organization, onEditStudioConfig, onCreateStudio, onUpdateStudio, onDeleteStudio, onSwitchToStudioView, onLockStudioDevice }) => {
    const { signOut } = useAuth();
    const [newStudioName, setNewStudioName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    // Custom Modals State
    const [studioToLock, setStudioToLock] = useState<Studio | null>(null);
    const [studioToDelete, setStudioToDelete] = useState<{id: string, name: string} | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudioName.trim()) return;

        if (organization.studios.length >= 1) {
            const confirmAdd = window.confirm(`Observera: Eftersom 1 skärm ingår i din licens kommer tillägg av denna extra skärm att öka din månadskostnad med 995 kr/mån (löpande månadsvis utan bindningstid).\n\nVill du fortsätta och skapa skärmen "${newStudioName.trim()}"?`);
            if (!confirmAdd) return;
        }

        setIsCreating(true);
        try {
            const defaultLocationId = organization.locations && organization.locations.length > 0 ? organization.locations[0].id : undefined;
            await onCreateStudio(organization.id, newStudioName.trim(), defaultLocationId);
            setNewStudioName('');
        } catch (error) {
            console.error(error);
            alert("Kunde inte skapa skärm.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = () => {
        if (!studioToDelete) return;
        onDeleteStudio(organization.id, studioToDelete.id);
        setStudioToDelete(null);
    };

    const confirmLockDevice = () => {
        if (!studioToLock || !onLockStudioDevice) return;
        onLockStudioDevice(studioToLock);
        setStudioToLock(null);
    };

    return (
         <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative">
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Skärmar</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Hantera dina skärmar och deras specifika inställningar.</p>
            </div>
            
             <div className="p-6 sm:p-8 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
                {organization.studios.map(studio => (
                    <div key={studio.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl flex flex-col xl:flex-row justify-between items-center gap-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 flex-grow w-full xl:w-auto">
                            <div>
                                <p className="font-bold text-lg text-gray-900 dark:text-white truncate">{studio.name}</p>
                                {organization.locations && organization.locations.length > 0 && (
                                    <select
                                        value={studio.locationId || organization.locations[0].id}
                                        onChange={(e) => onUpdateStudio(organization.id, studio.id, studio.name, e.target.value || undefined)}
                                        className="mt-1 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="">-- Välj ort/studio för skärmen --</option>
                                        {organization.locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
                            <button 
                                onClick={() => setStudioToLock(studio)}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm shadow-sm flex items-center gap-2"
                            >
                                Lås enhet 📺
                            </button>
                            <button onClick={() => onSwitchToStudioView(studio)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm shadow-sm flex items-center gap-2">
                                Förhandsgranska (Preview)
                            </button>
                            <button onClick={() => onEditStudioConfig(studio)} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm">Inställningar</button>
                            <button onClick={() => setStudioToDelete({id: studio.id, name: studio.name})} className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold py-2 px-4 rounded-lg transition-colors text-sm border border-red-100 dark:border-red-900/30">Ta bort</button>
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

            {/* Lock Device Modal */}
            {studioToLock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700 transform transition-all">
                        <div className="px-6 py-8 border-b border-gray-200 dark:border-gray-700 text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
                                <span className="text-3xl">📺</span>
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Lås denna skärm</h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                Vill du ställa in <strong>DENNA</strong> enhet (den du klickar på just nu) som skärmen <strong className="text-gray-900 dark:text-white">"{studioToLock.name}"</strong>?
                            </p>
                        </div>
                        <div className="px-6 py-6 bg-gray-50 dark:bg-gray-800/50">
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm mb-6 border border-blue-200 dark:border-blue-800/50">
                                <strong>Viktigt:</strong> Detta kommer logga ut din admin-användare och permanent låsa denna webbläsare till skärm-läget. Perfekt för TV-skärmen i gymmet!
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setStudioToLock(null)}
                                    className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={confirmLockDevice}
                                    className="flex-1 px-4 py-3 bg-blue-600 outline-none text-white text-base font-bold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md transition-colors"
                                >
                                    Ja, lås enhet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Device Modal */}
            {studioToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700 transform transition-all">
                        <div className="px-6 py-8 border-b border-gray-200 dark:border-gray-700 text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                                <span className="text-3xl">🗑️</span>
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Ta bort skärm</h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                Är du säker på att du vill ta bort skärmen <strong className="text-gray-900 dark:text-white">"{studioToDelete.name}"</strong>?
                            </p>
                        </div>
                        <div className="px-6 py-6 bg-gray-50 dark:bg-gray-800/50">
                            {organization.studios.length > 1 && (
                                <div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 p-4 rounded-xl text-sm mb-6 border border-green-200 dark:border-green-800/50">
                                    Eftersom du har fler än 1 skärm kommer borttagningen av denna skärm att minska din månadskostnad med 995 kr/mån från och med nästa faktura.
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setStudioToDelete(null)}
                                    className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-3 bg-red-600 outline-none text-white text-base font-bold rounded-xl hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md transition-colors"
                                >
                                    Ja, ta bort
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
