



import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CustomPage, CustomPageTab } from '../types';
import { MarkdownRenderer } from './CustomContentScreen';
import { enhancePageWithAI } from '../services/geminiService';

interface CustomPageEditorScreenProps {
    onSave: (page: CustomPage) => Promise<void>;
    onCancel: () => void;
    pageToEdit: CustomPage | null;
}

const AILoadingSpinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const createNewTab = (): CustomPageTab => ({
    id: `tab-${Date.now()}`,
    title: 'Ny Flik',
    content: ''
});

export const CustomPageEditorScreen: React.FC<CustomPageEditorScreenProps> = ({ onSave, onCancel, pageToEdit }) => {
    const [title, setTitle] = useState('');
    const [tabs, setTabs] = useState<CustomPageTab[]>([]);
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const [isProcessing, setIsProcessing] = useState(false);
    
    useEffect(() => {
        if (pageToEdit) {
            setTitle(pageToEdit.title);
            setTabs(pageToEdit.tabs && pageToEdit.tabs.length > 0 ? pageToEdit.tabs : [createNewTab()]);
            setActiveTabIndex(0);
        } else {
            setTitle('');
            setTabs([createNewTab()]);
            setActiveTabIndex(0);
        }
        setViewMode('edit');
    }, [pageToEdit]);

    const handleSave = async () => {
        setIsProcessing(true);
        const pageData: CustomPage = {
            id: pageToEdit?.id || `custom-page-${Date.now()}`,
            title: title.trim(),
            tabs: tabs,
        };
        await onSave(pageData);
        // isProcessing will be implicitly false on navigation
    };
    
    const handleEnhanceWithAI = async () => {
        const activeTab = tabs[activeTabIndex];
        if (!activeTab || !activeTab.content.trim()) {
            alert("Det finns inget innehåll i den valda fliken att förbättra.");
            return;
        }
        setIsProcessing(true);
        try {
            const enhancedContent = await enhancePageWithAI(activeTab.content);
            const newTabs = [...tabs];
            newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], content: enhancedContent };
            setTabs(newTabs);
            setViewMode('preview');
        } catch (error) {
            alert(error instanceof Error ? error.message : "Ett fel uppstod vid AI-förbättring.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleUpdateActiveTab = (field: 'title' | 'content', value: string) => {
        const newTabs = [...tabs];
        newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], [field]: value };
        setTabs(newTabs);
    };

    const handleAddTab = () => {
        const newTab = createNewTab();
        const newTabs = [...tabs, newTab];
        setTabs(newTabs);
        setActiveTabIndex(newTabs.length - 1); // Switch to the new tab
    };

    const handleRemoveTab = (indexToRemove: number) => {
        if (tabs.length <= 1) {
            alert("Du måste ha minst en flik.");
            return;
        }
        if (window.confirm(`Är du säker på att du vill ta bort fliken "${tabs[indexToRemove].title}"?`)) {
            const newTabs = tabs.filter((_, index) => index !== indexToRemove);
            setTabs(newTabs);
            // Adjust active tab index if needed
            if (activeTabIndex >= indexToRemove) {
                setActiveTabIndex(Math.max(0, activeTabIndex - 1));
            }
        }
    };

    const isSavable = useMemo(() => {
        return title.trim() !== '' && tabs.length > 0 && tabs.every(t => t.title.trim() !== '');
    }, [title, tabs]);
    
    const activeTab = tabs[activeTabIndex];

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{pageToEdit ? 'Redigera infosida' : 'Skapa ny infosida'}</h2>
                     <div className="flex items-center gap-4">
                        {viewMode === 'preview' && (
                             <button onClick={() => setViewMode('edit')} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg text-sm">
                                Redigeringsläge
                            </button>
                        )}
                        <button
                            onClick={handleEnhanceWithAI}
                            disabled={isProcessing}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                            {isProcessing ? <AILoadingSpinner /> : '✨'}
                            <span>{isProcessing ? 'Jobbar...' : 'AI-magi'}</span>
                        </button>
                    </div>
                </div>
                
                 <div>
                    <label htmlFor="page-title" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Sidans Huvudtitel</label>
                    <input
                        id="page-title"
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Titel som visas på knappen i coach-menyn"
                        className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none text-xl"
                    />
                </div>
                
                 {/* Content area */}
                <div className="flex flex-col gap-6">
                   {/* TAB CONTROLS */}
                    <div className="border-b border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 overflow-x-auto">
                           {tabs.map((tab, index) => (
                               <div key={tab.id} className="relative">
                                    <button
                                      onClick={() => setActiveTabIndex(index)}
                                      className={`px-4 py-3 font-semibold transition-colors focus:outline-none whitespace-nowrap rounded-t-md ${activeTabIndex === index ? 'bg-gray-100 dark:bg-gray-700 text-primary' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                                    >
                                      {tab.title || 'Namnlös flik'}
                                    </button>
                                     <button
                                        onClick={() => handleRemoveTab(index)}
                                        className="absolute top-0 right-0 p-1 text-gray-500 hover:text-red-400 transition-colors"
                                        aria-label="Ta bort flik"
                                        title="Ta bort flik"
                                    >
                                        &times;
                                    </button>
                               </div>
                           ))}
                            <button onClick={handleAddTab} className="p-3 text-primary hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md">+</button>
                        </div>
                    </div>
                    
                    {/* EDITOR/PREVIEW GRID */}
                    <div className={`grid grid-cols-1 ${viewMode === 'preview' ? 'lg:grid-cols-2' : ''} gap-6`}>
                        {/* Left Pane: Editor */}
                        <div className="flex flex-col gap-4 min-h-[50vh]">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Redigera Flik: <span className="text-primary">{activeTab?.title}</span></h3>
                            <div>
                                <label htmlFor="tab-title" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Flikens Titel</label>
                                <input
                                    id="tab-title"
                                    type="text"
                                    value={activeTab?.title || ''}
                                    onChange={e => handleUpdateActiveTab('title', e.target.value)}
                                    className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
                                />
                            </div>
                            <div className="flex flex-col flex-grow">
                                <label htmlFor="page-content" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Innehåll (Stöder Markdown)</label>
                                <textarea
                                    id="page-content"
                                    value={activeTab?.content || ''}
                                    onChange={e => handleUpdateActiveTab('content', e.target.value)}
                                    placeholder="Skriv eller klistra in innehållet för sidan här...&#10;Använd sedan 'AI-magi' för att formatera och snygga till texten."
                                    className="w-full flex-grow bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none font-mono resize-none"
                                />
                            </div>
                        </div>

                        {/* Right Pane: Preview */}
                         {viewMode === 'preview' && (
                            <div className="flex flex-col gap-2 min-h-[50vh]">
                                <label className="block text-lg font-semibold text-gray-900 dark:text-white flex-shrink-0">Förhandsgranskning</label>
                                <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-700 flex-grow">
                                    <div className="h-full overflow-y-auto">
                                        <MarkdownRenderer content={activeTab?.content || ''} className="prose prose-lg dark:prose-invert max-w-none p-6" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 flex justify-end gap-4">
                <button onClick={onCancel} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-3 px-6 rounded-lg transition-colors">Avbryt</button>
                <button 
                    onClick={handleSave} 
                    disabled={!isSavable || isProcessing}
                    className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                    title={!isSavable ? "Sidan måste ha en huvudtitel och varje flik måste ha en titel." : ""}
                >
                    {isProcessing ? 'Sparar...' : 'Spara sida'}
                </button>
            </div>
        </div>
    );
};