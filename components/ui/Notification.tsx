
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckIcon, InformationCircleIcon } from '../icons';

interface ToastProps {
    message: string;
    type?: 'success' | 'info' | 'error';
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', isVisible, onClose, duration = 3000 }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose, duration]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    className="fixed top-6 left-0 right-0 z-[2000] flex justify-center pointer-events-none"
                >
                    <div className={`
                        pointer-events-auto px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[300px]
                        ${type === 'success' 
                            ? 'bg-white dark:bg-gray-800 border-green-500/30 text-gray-900 dark:text-white' 
                            : 'bg-white dark:bg-gray-800 border-blue-500/30 text-gray-900 dark:text-white'}
                    `}>
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                            ${type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}
                        `}>
                            {type === 'success' ? <CheckIcon className="w-5 h-5" /> : <InformationCircleIcon className="w-5 h-5" />}
                        </div>
                        <p className="font-bold text-sm tracking-tight">{message}</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
