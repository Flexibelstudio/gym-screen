import React, { useState } from 'react';
import { Organization } from '../types';

interface SystemOwnerScreenProps {
    allOrganizations: Organization[];
    onSelectOrganization: (organization: Organization) => void;
    onCreateOrganization: (name: string, subdomain: string) => Promise<void>;
    onDeleteOrganization: (organizationId: string) => void;
}

export const SystemOwnerScreen: React.FC<SystemOwnerScreenProps> = ({ allOrganizations, onSelectOrganization, onCreateOrganization, onDeleteOrganization }) => {
    const [newOrgName, setNewOrgName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrgName.trim()) return;
        setIsCreating(true);
        try {
            const subdomain = newOrgName.trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
            await onCreateOrganization(newOrgName.trim(), subdomain);
            setNewOrgName('');
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Ett okänt fel inträffade.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = (org: Organization) => {
        if (window.confirm(`Är du säker på att du vill ta bort organisationen "${org.name}"? Detta kommer att radera all data permanent och kan inte ångras.`)) {
            onDeleteOrganization(org.id);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
            <p className="text-center text-gray-500 dark:text-gray-400">
                Här hanterar du alla kundorganisationer i plattformen.
            </p>

            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-yellow-300 dark:border-yellow-700">
                <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 border-b border-slate-300 dark:border-gray-700 pb-3">Hantera Organisationer</h3>
                <div className="space-y-3">
                    {allOrganizations.map(org => (
                        <div key={org.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-slate-300 dark:border-gray-700">
                            <div>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">{org.name}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-500">{org.subdomain}.flexibel.app</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onSelectOrganization(org)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                                >
                                    Hantera
                                </button>
                                <button
                                    onClick={() => handleDelete(org)}
                                    className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                                >
                                    Ta bort
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleCreate} className="pt-6 border-t border-slate-300 dark:border-gray-700 space-y-3">
                    <input
                        type="text"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="Namn på ny organisation"
                        className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-yellow-500 focus:outline-none transition"
                        disabled={isCreating}
                    />
                    <button type="submit" disabled={!newOrgName.trim() || isCreating} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-500">
                        {isCreating ? 'Skapar...' : 'Skapa Ny Organisation'}
                    </button>
                </form>
            </div>
        </div>
    );
};