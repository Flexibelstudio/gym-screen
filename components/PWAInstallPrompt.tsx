import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const PWAInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already installed/standalone
        const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;
        setIsStandalone(isAppMode);

        if (isAppMode) return;

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);

        if (isIOSDevice) {
            // Show iOS prompt after a short delay
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }

        // Listen for Android/Chrome install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    if (isStandalone || !showPrompt) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 p-5 z-[100]"
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <img src="/favicon.png" alt="App Icon" className="w-14 h-14 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800" />
                        <div>
                            <h3 className="font-black text-gray-900 dark:text-white text-lg leading-tight">Installera Appen</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Snabbare åtkomst & offline-stöd</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowPrompt(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full p-1.5 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {isIOS ? (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700/50">
                        <p className="flex items-center gap-3 mb-3 font-medium">
                            <span className="bg-white dark:bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">1</span>
                            Klicka på <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> i menyn
                        </p>
                        <p className="flex items-center gap-3 font-medium">
                            <span className="bg-white dark:bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">2</span>
                            Välj <strong>Lägg till på hemskärmen</strong> <span className="bg-white dark:bg-gray-700 p-1 rounded text-xs shadow-sm ml-auto">⊞</span>
                        </p>
                    </div>
                ) : (
                    <button 
                        onClick={handleInstallClick}
                        className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30 active:scale-[0.98]"
                    >
                        Lägg till på hemskärmen
                    </button>
                )}
            </motion.div>
        </AnimatePresence>
    );
};
