import React from 'react';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';

interface PendingCoachScreenProps {
    onLogout: () => void;
}

const PendingCoachScreen: React.FC<PendingCoachScreenProps> = ({ onLogout }) => {
    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="bg-white dark:bg-gray-900 rounded-3xl p-10 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 z-10 relative"
            >
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Väntar på godkännande</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg leading-relaxed">
                    Ditt konto som coach har skapats, men det måste godkännas av en administratör innan du kan logga in. Vi meddelar dig så snart ditt konto är aktivt.
                </p>

                <button 
                    onClick={onLogout}
                    className="flex items-center justify-center w-full gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold py-4 px-6 rounded-xl transition-all"
                >
                    <LogOut size={20} />
                    Logga ut
                </button>
            </motion.div>
        </div>
    );
};

export default PendingCoachScreen;
