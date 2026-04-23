
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Växla till skärmvy.</p>

            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 p-4 rounded-xl mb-6 shadow-sm">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
                    <span className="font-bold">⚠️ Varning:</span> Att öppna skärmvyn här kan störa eller avbryta ett pågående träningspass. Klicka bara här när det inte pågår pass på gymmets fysiska skärm!
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {organization.studios.map(studio => {
                    const locationName = organization.locations?.find(l => l.id === studio.locationId)?.name;
                    return (
                        <button
                            key={studio.id}
                            onClick={() => onSwitchToStudioView(studio)}
                            className="bg-gray-5 dark:bg-gray-700 hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary/50 border border-gray-200 dark:border-gray-600 text-left py-4 px-6 rounded-xl transition-all flex items-center justify-between group"
                        >
                            <div className="flex flex-col">
                                <span className="text-gray-700 dark:text-white font-medium">{studio.name}</span>
                                {locationName && <span className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{locationName}</span>}
                            </div>
                            <span className="text-gray-400 group-hover:text-primary transition-colors">→</span>
                        </button>
                    );
                })}
            </div>
            {organization.studios.length === 0 && <p className="text-gray-400 text-sm italic">Inga skärmar skapade ännu.</p>}
        </div>
    );
};
