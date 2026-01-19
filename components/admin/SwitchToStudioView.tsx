
import React from 'react';
import { Organization, Studio } from '../../types';

interface SwitchToStudioViewProps {
    organization: Organization;
    onSwitchToStudioView: (studio: Studio) => void;
}

export const SwitchToStudioView: React.FC<SwitchToStudioViewProps> = ({ organization, onSwitchToStudioView }) => {
    return (
        <div className="mt-12 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Växla till Skärmvy</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Växla till skärmvy. Du återvänder hit via "För Coacher"-menyn.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {organization.studios.map(studio => (
                    <button
                        key={studio.id}
                        onClick={() => onSwitchToStudioView(studio)}
                        className="bg-gray-5 dark:bg-gray-700 hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white font-medium py-4 px-6 rounded-xl transition-all text-left flex items-center justify-between group"
                    >
                        <span>{studio.name}</span>
                        <span className="text-gray-400 group-hover:text-primary transition-colors">→</span>
                    </button>
                ))}
            </div>
            {organization.studios.length === 0 && <p className="text-gray-400 text-sm italic">Inga skärmar skapade ännu.</p>}
        </div>
    );
};
