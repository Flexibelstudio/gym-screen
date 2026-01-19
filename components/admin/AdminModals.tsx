
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { SparklesIcon, UsersIcon, ChartBarIcon, InformationCircleIcon } from '../icons';
import { getSmartScreenPricing } from '../../services/firebaseService';

export const FeatureInfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Smart Medlemsupplevelse" size="lg">
        <div className="space-y-6 text-gray-800 dark:text-gray-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl text-white">
                <h3 className="text-xl font-bold mb-2">Mer än bara en loggbok 🚀</h3>
                <p className="opacity-90">
                    Genom att aktivera denna funktion låser du upp hela potentialen i SmartStudio. Det handlar om att ge dina medlemmar verktyg för att lyckas, och dig verktyg för att driva verksamheten.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-bold text-lg text-primary mb-3 flex items-center gap-2">
                        <UsersIcon className="w-5 h-5" /> För Medlemmen
                    </h4>
                    <ul className="space-y-2 text-sm">
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Träningsdagbok:</strong> Smidig loggning via QR-kod.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>AI-Coach:</strong> Personlig feedback och strategi inför varje pass.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Visuell Progression:</strong> Snygga grafer över styrka och kondition.</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-bold text-lg text-purple-500 mb-3 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5" /> För Gymmet
                    </h4>
                    <ul className="space-y-2 text-sm">
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Medlemsregister:</strong> Full översikt över dina medlemmar.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Data & Analys:</strong> Se vilka pass som är populärast och hur nöjda medlemmarna är.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Community:</strong> Live-feed på skärmarna när någon loggar ett PB.</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Tips:</strong> Detta är också en intäktsmöjlighet! Många gym tar en liten extra avgift (t.ex. 29-49 kr/mån) för att ge medlemmar tillgång till "Premium-appen" med AI-coaching och loggning.
            </div>
        </div>
        <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-3 px-6 rounded-xl transition-colors">Stäng</button>
        </div>
    </Modal>
);

export const PricingModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isProcessing: boolean;
}> = ({ isOpen, onClose, onConfirm, isProcessing }) => {
    const [baseCost, setBaseCost] = useState(19);
    const [customerPrice, setCustomerPrice] = useState(49);

    useEffect(() => {
        if (isOpen) {
            getSmartScreenPricing().then(pricing => {
                if (pricing && pricing.workoutLoggingPricePerMember !== undefined) {
                    setBaseCost(pricing.workoutLoggingPricePerMember);
                }
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={true} onClose={onClose} title="Aktivera Hela Paketet 🚀" size="lg">
            <div className="p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
                    <h3 className="text-xl font-bold mb-2">Ett paket – alla funktioner</h3>
                    <p className="text-blue-100 text-sm">
                        Genom att aktivera Passloggning får du automatiskt tillgång till Medlemsregistret, Analysverktyg och intäktsmöjligheter.
                    </p>
                </div>

                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-1">För Medlemmen</h4>
                            <ul className="text-blue-800 dark:text-blue-200 list-disc list-inside space-y-1">
                                <li>Sparar träningshistorik</li>
                                <li>Får AI-analys & tips</li>
                                <li>Ser sina framsteg visuellt</li>
                            </ul>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl">
                            <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-1">För Gymmet (Detta ingår)</h4>
                            <ul className="text-purple-800 dark:text-purple-200 list-disc list-inside space-y-1">
                                <li><strong>Medlemsregister & Statistik</strong></li>
                                <li><strong>Analys & Trender</strong></li>
                                <li>Ökad retention (nöjdare kunder)</li>
                                <li><strong>Ny intäktsström</strong></li>
                            </ul>
                        </div>
                    </div>

                    <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-6">
                        <h4 className="font-bold text-gray-900 dark:text-white text-center mb-4">Räkna på din vinst</h4>
                        
                        <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
                            <div className="flex-1 w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Vår avgift (Licens)</span>
                                <div className="text-2xl font-mono font-bold text-gray-700 dark:text-gray-300">
                                    {baseCost} <span className="text-sm font-normal">kr/mån</span>
                                </div>
                            </div>

                            <div className="text-gray-400 font-bold text-xl">+</div>

                            <div className="flex-1 w-full p-4 bg-white dark:bg-gray-700 rounded-xl border-2 border-primary/30 shadow-sm">
                                <label htmlFor="customerPriceInput" className="block text-xs font-bold text-primary uppercase mb-1">Ditt påslag (Pris till kund)</label>
                                <div className="flex items-baseline gap-2">
                                    <input 
                                        id="customerPriceInput"
                                        type="number" 
                                        value={customerPrice}
                                        onChange={(e) => setCustomerPrice(Number(e.target.value))}
                                        className="w-24 bg-transparent text-2xl font-mono font-bold text-gray-900 dark:text-white border-b-2 border-primary focus:outline-none"
                                    />
                                    <span className="text-sm text-gray-500 font-medium">kr/mån</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-2xl text-center border border-green-200 dark:border-green-800 mt-4">
                            <p className="text-xs font-bold text-green-800 dark:text-green-300 uppercase tracking-widest mb-2">
                                Din potentiella extra intäkt
                            </p>
                            <div className="text-5xl font-black text-green-700 dark:text-green-400 tracking-tight">
                                {(Math.max(0, customerPrice - baseCost) * 100 * 12).toLocaleString()} kr
                            </div>
                            <p className="text-sm text-green-800 dark:text-green-300 mt-2 font-medium opacity-80">
                                per år (vid 100 anslutna medlemmar)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex gap-4">
                    <button onClick={onClose} disabled={isProcessing} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                        Avbryt
                    </button>
                    <button onClick={onConfirm} disabled={isProcessing} className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-primary hover:brightness-110 shadow-lg shadow-primary/30 transition-all transform active:scale-95 disabled:opacity-50">
                        {isProcessing ? 'Aktiverar...' : 'Aktivera Passloggning'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
