
import React from 'react';
import { motion } from 'framer-motion';

interface CancelConfirmationModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export const CancelConfirmationModal: React.FC<CancelConfirmationModalProps> = ({ onConfirm, onCancel }) => (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[11000] flex items-center justify-center p-4"
        onClick={onCancel}
    >
        <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 max-sm w-full shadow-2xl text-center border border-gray-100 dark:border-gray-800"
            onClick={e => e.stopPropagation()}
        >
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">⚠️</span>
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Avbryt loggning?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                Dina resultat för det här passet kommer inte att sparas.
            </p>
            <div className="flex flex-col gap-3">
                <button 
                    onClick={onConfirm}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-500/20 transition-all active:scale-95"
                >
                    JA, AVBRYT
                </button>
                <button 
                    onClick={onCancel}
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold py-4 rounded-2xl transition-all active:scale-95"
                >
                    FORTSÄTT LOGGA
                </button>
            </div>
        </motion.div>
    </motion.div>
);
