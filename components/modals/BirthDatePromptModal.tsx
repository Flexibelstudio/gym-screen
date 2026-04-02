import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { updateUserProfile } from '../../services/firebaseService';
import { UserData } from '../../types';

interface BirthDatePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData;
}

export const BirthDatePromptModal: React.FC<BirthDatePromptModalProps> = ({ isOpen, onClose, userData }) => {
    const [birthDate, setBirthDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 8) v = v.slice(0, 8);
        if (v.length > 6) {
            v = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}`;
        } else if (v.length > 4) {
            v = `${v.slice(0, 4)}-${v.slice(4)}`;
        }
        setBirthDate(v);
    };

    const handleSave = async () => {
        if (birthDate.length !== 10) {
            alert("Vänligen ange ett fullständigt datum (ÅÅÅÅ-MM-DD).");
            return;
        }
        setIsSaving(true);
        try {
            await updateUserProfile(userData.uid, { birthDate });
            onClose();
        } catch (error) {
            console.error("Failed to save birth date", error);
            alert("Kunde inte spara födelsedatum. Försök igen.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={() => {}} title="Uppdatering av profil" size="md">
            <div className="p-6 text-center space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🎉</span>
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Hej!</h3>
                <p className="text-gray-600 dark:text-gray-300 text-lg">
                    Vi har uppdaterat profilsidan. Vänligen fyll i ditt födelsedatum för att fortsätta.
                </p>
                
                <div className="text-left mt-6">
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest ml-1">Födelsedatum</label>
                    <input
                        type="tel"
                        placeholder="ÅÅÅÅ-MM-DD"
                        maxLength={10}
                        value={birthDate}
                        onChange={handleDateChange}
                        className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm font-bold"
                    />
                </div>

                <button 
                    onClick={handleSave}
                    disabled={!birthDate || isSaving}
                    className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                    {isSaving ? 'Sparar...' : 'Spara och fortsätt'}
                </button>
            </div>
        </Modal>
    );
};
