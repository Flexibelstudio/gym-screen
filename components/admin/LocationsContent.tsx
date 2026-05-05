import React, { useState } from 'react';
import { Organization, Location } from '../../types';
import { updateOrganizationLocations } from '../../services/firebaseService';

interface LocationsContentProps {
    organization: Organization;
}

export const LocationsContent: React.FC<LocationsContentProps> = ({ organization }) => {
    const [locations, setLocations] = useState<Location[]>(organization.locations || []);
    const [newLocationName, setNewLocationName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLocationName.trim()) return;

        setIsSaving(true);
        try {
            const newLocation: Location = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                name: newLocationName.trim(),
                createdAt: Date.now(),
            };
            const updatedLocations = [...locations, newLocation];
            await updateOrganizationLocations(organization.id, updatedLocations);
            setLocations(updatedLocations);
            setNewLocationName('');
        } catch (error) {
            console.error(error);
            alert("Kunde inte skapa ort.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (locationId: string, locationName: string) => {
        if (!window.confirm(`Är du säker på att du vill ta bort "${locationName}"? Medlemmar och skärmar kopplade till denna ort kommer tappa kopplingen.`)) {
            return;
        }

        setIsSaving(true);
        try {
            const updatedLocations = locations.filter(loc => loc.id !== locationId);
            await updateOrganizationLocations(organization.id, updatedLocations);
            setLocations(updatedLocations);
        } catch(e) {
            console.error(e);
            alert("Kunde inte ta bort ort.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
         <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Studios / Orter</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lägg till orter eller fysiska anläggningar för att kunna dela upp medlemmar och skärmar per plats.</p>
            </div>
            
             <div className="p-6 sm:p-8 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
                {locations.map(loc => (
                    <div key={loc.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl flex flex-col xl:flex-row justify-between items-center gap-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 flex-grow w-full xl:w-auto">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                                {loc.name[0].toUpperCase()}
                            </div>
                            <p className="font-bold text-lg text-gray-900 dark:text-white truncate">{loc.name}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
                            <button onClick={() => handleDelete(loc.id, loc.name)} disabled={isSaving} className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold py-2 px-4 rounded-lg transition-colors text-sm border border-red-100 dark:border-red-900/30">Ta bort</button>
                        </div>
                    </div>
                ))}
                
                {locations.length === 0 && (
                    <div className="text-center py-8 text-gray-400 italic">Inga studios/orter upplagda ännu.</div>
                )}
            </div>

             <div className="p-6 sm:p-8 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Lägg till ny studio/ort</h4>
                <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)}
                        placeholder="Namn på ort/studio (t.ex. Stockholm, Gym 1)"
                        className="flex-grow bg-gray-50 dark:bg-gray-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                    <button type="submit" disabled={isSaving || !newLocationName.trim()} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-transform active:scale-95">
                        {isSaving ? 'Sparar...' : 'Spara ny studio'}
                    </button>
                </form>
            </div>
        </div>
    );
};
