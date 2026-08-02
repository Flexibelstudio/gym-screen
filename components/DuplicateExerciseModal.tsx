import React from 'react';
import { Modal } from './ui/Modal';

interface DuplicateExerciseModalProps {
    isOpen: boolean;
    existingName: string;
    inputName?: string;
    onUseExisting: () => void;
    onCreateAnyway: () => void;
    onClose: () => void;
}

export const DuplicateExerciseModal: React.FC<DuplicateExerciseModalProps> = ({
    isOpen,
    existingName,
    onUseExisting,
    onCreateAnyway,
    onClose
}) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Övningen finns redan">
            <div className="p-4 space-y-4 text-gray-900 dark:text-white">
                <p className="text-sm font-medium leading-relaxed">
                    Det finns redan en övning som heter <span className="font-bold text-primary">"{existingName}"</span>. Använd den så att din statistik hamnar på rätt ställe.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onUseExisting}
                        className="flex-1 bg-primary text-black font-extrabold py-3 px-4 rounded-xl shadow hover:opacity-90 transition text-sm"
                    >
                        Använd befintlig
                    </button>
                    <button
                        onClick={onCreateAnyway}
                        className="flex-1 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition text-sm"
                    >
                        Skapa ändå
                    </button>
                </div>
            </div>
        </Modal>
    );
};
