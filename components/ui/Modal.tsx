import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon } from '../icons';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
    footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', footer }) => {
    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '4xl': 'max-w-4xl',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center z-[1000] p-4"
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                    <motion.div
                        className={`bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh] ${sizeClasses[size]}`}
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                        {title && (
                            <div className="flex-shrink-0 flex items-center justify-between p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{title}</h2>
                                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors" aria-label="Stäng">
                                    <CloseIcon className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                        <div className="flex-grow p-6 sm:p-8 overflow-y-auto">
                            {children}
                        </div>
                        {footer && (
                            <div className="flex-shrink-0 p-6 sm:p-8 border-t border-gray-100 dark:border-gray-700">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};