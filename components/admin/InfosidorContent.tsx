
import React from 'react';
import { Organization, CustomPage } from '../../types';
import { DocumentTextIcon } from '../icons';

interface InfosidorContentProps {
    organization: Organization;
    onEditCustomPage: (page: CustomPage | null) => void;
    onDeleteCustomPage: (pageId: string) => Promise<void>;
}

export const InfosidorContent: React.FC<InfosidorContentProps> = ({ organization, onEditCustomPage, onDeleteCustomPage }) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Infosidor</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                        Skapa digitala handböcker, välkomstguider eller instruktioner för dina coacher.
                    </p>
                </div>
                <button 
                    onClick={() => onEditCustomPage(null)} 
                    className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                >
                    <span className="text-xl">+</span> Skapa ny sida
                </button>
            </div>
            
            {(organization.customPages || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400 mb-4">
                        <DocumentTextIcon className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inga infosidor än</h4>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md text-center mb-8">
                        Infosidor är perfekta för att samla viktig information på ett ställe.
                    </p>
                    <button 
                        onClick={() => onEditCustomPage(null)} 
                        className="text-primary font-semibold hover:underline"
                    >
                        Skapa din första sida nu
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {organization.customPages!.map(page => (
                        <div 
                            key={page.id} 
                            className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-300 flex flex-col h-full"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                                    <DocumentTextIcon className="w-6 h-6" />
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteCustomPage(page.id); }}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Ta bort sida"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mb-6 flex-grow">
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                                    {page.title}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-medium text-gray-600 dark:text-gray-300">
                                        {page.tabs.length} {page.tabs.length === 1 ? 'flik' : 'flikar'}
                                    </span>
                                    <span>•</span>
                                    <span className="truncate">
                                        {page.tabs[0]?.title || 'Utan rubrik'}
                                    </span>
                                </div>
                            </div>

                            <button 
                                onClick={() => onEditCustomPage(page)} 
                                className="w-full bg-gray-50 dark:bg-gray-700/50 hover:bg-primary hover:text-white text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <span>Redigera innehåll</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
