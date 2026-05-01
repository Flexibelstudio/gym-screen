import React from 'react';
import { Modal } from './Modal';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'red' | 'primary' | 'blue';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Ja',
    cancelText = 'Avbryt',
    confirmColor = 'red'
}) => {
    
    // Style configurations for confirm button
    const confirmButtonStyles = {
        red: 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white',
        primary: 'bg-primary hover:bg-primary/90 text-primary-content',
        blue: 'bg-blue-600 hover:bg-blue-700 text-white'
    };
    
    const selectedConfirmClass = confirmButtonStyles[confirmColor] || confirmButtonStyles.red;

    const footer = (
        <div className="flex gap-3">
            <button 
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
                {cancelText}
            </button>
            <button 
                onClick={() => {
                    onConfirm();
                    onClose();
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors ${selectedConfirmClass}`}
            >
                {confirmText}
            </button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" footer={footer}>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {message}
            </p>
        </Modal>
    );
};
