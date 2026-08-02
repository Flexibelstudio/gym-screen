import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { CloseIcon, QrCodeIcon, DumbbellIcon, PlusIcon, SearchIcon } from './icons';

interface ScanButtonProps {
    onScan: () => void;
    onLogWorkout: (workoutId: string, orgId: string) => void;
    onSearch: () => void;
}

export const ScanButton: React.FC<ScanButtonProps> = ({ onScan, onLogWorkout, onSearch }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { selectedOrganization } = useStudio();

    const handleManualLog = () => {
        setIsOpen(false);
        if (selectedOrganization) {
            onLogWorkout('MANUAL_ENTRY', selectedOrganization.id);
        }
    };

    return (
        <>
            {/* Backdrop Overlay to dim content */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-40 animate-fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className="relative flex flex-col items-end gap-3 z-50">
                {isOpen && (
                    <>
                        <button 
                            onClick={() => { setIsOpen(false); onScan(); }}
                            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-3 pr-6 transition-all hover:scale-105 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-full text-teal-600 dark:text-teal-400">
                                <QrCodeIcon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">Scanna QR-kod</span>
                        </button>

                        <button 
                            onClick={() => { setIsOpen(false); onSearch(); }}
                            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-3 pr-6 transition-all hover:scale-105 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-full text-indigo-600 dark:text-indigo-400">
                                <SearchIcon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">Söka Pass</span>
                        </button>

                        <button 
                            onClick={handleManualLog}
                            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-3 pr-6 transition-all hover:scale-105 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full text-gray-600 dark:text-gray-300">
                                <DumbbellIcon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">Logga Egen Aktivitet</span>
                        </button>
                    </>
                )}
                
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-4 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center ${isOpen ? 'bg-gray-800 dark:bg-gray-700 text-white rotate-45' : 'bg-primary text-white hover:scale-110 hover:brightness-110'}`}
                >
                    {isOpen ? <CloseIcon className="w-6 h-6" /> : <PlusIcon className="w-7 h-7" />}
                </button>
            </div>
        </>
    );
};
