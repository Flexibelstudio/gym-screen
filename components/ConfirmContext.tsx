import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ConfirmModal } from './ui/ConfirmModal';

interface ConfirmContextType {
    confirm: (options: { title?: string, message: string, confirmText?: string, cancelText?: string, confirmColor?: 'red' | 'primary' | 'blue' }) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<Parameters<ConfirmContextType['confirm']>[0] | null>(null);
    const [resolver, setResolver] = useState<(value: boolean) => void>();

    const confirm = (opts: Parameters<ConfirmContextType['confirm']>[0]) => {
        return new Promise<boolean>((resolve) => {
            setOptions(opts);
            setResolver(() => resolve);
            setIsOpen(true);
        });
    };

    const handleConfirm = () => {
        setIsOpen(false);
        if (resolver) resolver(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        if (resolver) resolver(false);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {options && (
                <ConfirmModal
                    isOpen={isOpen}
                    onClose={handleCancel}
                    onConfirm={handleConfirm}
                    title={options.title || "Bekräfta"}
                    message={options.message}
                    confirmText={options.confirmText}
                    cancelText={options.cancelText}
                    confirmColor={options.confirmColor}
                />
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
};

// Also patch the global window.confirm so that existing synchronous code that can't use hooks
// still works but it will use the browser default. Since we can't make window.confirm async,
// we will have to update the components using it.
