import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { updateUserProfile } from '../../services/firebaseService';
import { UserData, Location } from '../../types';
import { MapPinIcon, CheckIcon } from '@heroicons/react/24/outline';

interface LocationPromptModalProps {
    isOpen: boolean;
    userData: UserData;
    locations: Location[];
    onClose: () => void;
}

export const LocationPromptModal: React.FC<LocationPromptModalProps> = ({ isOpen, userData, locations, onClose }) => {
    const [selectedId, setSelectedId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!selectedId) return;
        setIsSaving(true);
        try {
            await updateUserProfile(userData.uid, { locationId: selectedId });
            onClose();
        } catch (error) {
            console.error("Misslyckades att spara hemstudio", error);
            alert("Kunde inte spara din studio. Försök igen.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={() => {}} title="Välj din hemstudio" size="md">
            <div className="p-6 space-y-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                    <MapPinIcon className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Välj din hemstudio!</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                        För att du ska få rätt träningspass på skärmarna, dina personbästan och hamna på rätt orts topplista behöver du välja din hemstudio.
                    </p>
                </div>
                
                <div className="space-y-3 text-left mt-6">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tillgängliga studios</label>
                    <div className="grid grid-cols-1 gap-3">
                        {locations.map((loc) => {
                            const isSelected = selectedId === loc.id;
                            return (
                                <button
                                    key={loc.id}
                                    type="button"
                                    onClick={() => setSelectedId(loc.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold text-left ${
                                        isSelected 
                                            ? 'border-primary bg-primary/5 text-gray-900 dark:text-white dark:bg-primary/10 shadow-md' 
                                            : 'border-gray-200 dark:border-gray-750 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-850'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <MapPinIcon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
                                        <span>{loc.name}</span>
                                    </div>
                                    {isSelected && <CheckIcon className="w-5 h-5 text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <button 
                    onClick={handleSave}
                    disabled={!selectedId || isSaving}
                    className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Sparar...
                        </>
                    ) : 'Spara och fortsätt'}
                </button>
            </div>
        </Modal>
    );
};
