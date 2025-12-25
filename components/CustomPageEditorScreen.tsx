
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CustomPage, CustomPageTab } from '../types';
import { MarkdownRenderer } from './CustomContentScreen';
import { enhancePageWithAI } from '../services/geminiService';
import { SparklesIcon, CloseIcon } from './icons';

interface CustomPageEditorScreenProps {
    onSave: (page: CustomPage) => Promise<void>;
    onCancel: () => void;
    pageToEdit: CustomPage | null;
}

const AILoadingSpinner: React.FC = () => (
    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
);

const createNewTab = (): CustomPageTab => ({
    id: `tab-${Date.now()}`,
    title: 'Ny Flik',
    content: ''
});

// Toolbar Button Component
const ToolButton: React.FC<{ onClick: () => void; label: string; icon: React.ReactNode }> = ({ onClick, label, icon }) => (
    <button 
        onClick={onClick} 
        className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title={label}
        type="button"
    >
        {icon}
    </button>
);

export const CustomPageEditorScreen: React.FC<CustomPageEditorScreenProps> = ({ onSave, onCancel, pageToEdit }) => {
    const [title, setTitle] = useState('');
    const [tabs, setTabs] = useState<CustomPageTab[]>([]);
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    // Mobile toggle for Edit/Preview. Desktop uses split view.
    const [mobileViewMode, setMobileViewMode] = useState<'edit' | 'preview'>('edit');
    const [isProcessing, setIsProcessing] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    
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
    }, [pageToEdit]);

    const handleSave = async () => {
        setIsProcessing(true);
        const pageData: CustomPage = {
            id: pageToEdit?.id || `custom-page-${Date.now()}`,
            title: title.trim(),
            tabs: tabs,
        };
        await onSave(pageData);
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
            setMobileViewMode('preview'); // Switch to preview on mobile to show result
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
        setActiveTabIndex(newTabs.length - 1);
    };

    const handleRemoveTab = (e: React.MouseEvent, indexToRemove: number) => {
        e.stopPropagation();
        if (tabs.length <= 1) {
            alert("Du måste ha minst en flik.");
            return;
        }
        if (window.confirm(`Är du säker på att du vill ta bort fliken "${tabs[indexToRemove].title}"?`)) {
            const newTabs = tabs.filter((_, index) => index !== indexToRemove);
            setTabs(newTabs);
            if (activeTabIndex >= indexToRemove) {
                setActiveTabIndex(Math.max(0, activeTabIndex - 1));
            }
        }
    };

    const insertText = (prefix: string, suffix: string = '') => {
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = tabs[activeTabIndex].content;
        const before = text.substring(0, start);
        const selection = text.substring(start, end);
        const after = text.substring(end);

        const newText = before + prefix + selection + suffix + after;
        handleUpdateActiveTab('content', newText);
        
        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    const isSavable = useMemo(() => {
        return title.trim() !== '' && tabs.length > 0 && tabs.every(t => t.title.trim() !== '');
    }, [title, tabs]);
    
    const activeTab = tabs[activeTabIndex];

    return (
        <div className="w-full h-full flex flex-col animate-fade-in bg-gray-50 dark:bg-black max-h-[calc(100vh-100px)]">
             {/* HEADER */}
             <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div className="w-full sm:w-auto flex-grow max-w-2xl">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Huvudrubrik (Menyknapp)</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="T.ex. 'Välkomstguide'"
                        className="w-full bg-transparent text-2xl font-bold text-gray-900 dark:text-white border-b-2 border-transparent focus:border-primary focus:outline-none placeholder-gray-300 dark:placeholder-gray-700 transition-colors"
                    />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium px-4 py-2 transition-colors">Avbryt</button>
                    <button 
                        onClick={handleSave} 
                        disabled={!isSavable || isProcessing}
                        className="bg-primary hover:brightness-95 text-white font-bold py-2 px-6 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {isProcessing ? 'Sparar...' : 'Spara Sida'}
                    </button>
                </div>
            </div>

            {/* TABS BAR */}
            <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-2 pt-2 gap-1 overflow-x-auto flex-shrink-0">
                {tabs.map((tab, index) => (
                    <div 
                        key={tab.id} 
                        onClick={() => setActiveTabIndex(index)}
                        className={`
                            group relative px-4 py-2.5 min-w-[120px] max-w-[200px] rounded-t-lg cursor-pointer transition-colors flex items-center justify-between gap-2 select-none
                            ${activeTabIndex === index 
                                ? 'bg-white dark:bg-black text-primary border-t-2 border-primary' 
                                : 'bg-gray-200 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                            }
                        `}
                    >
                        <span className="truncate text-sm font-bold">{tab.title || 'Namnlös'}</span>
                        {tabs.length > 1 && (
                            <button
                                onClick={(e) => handleRemoveTab(e, index)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 hover:text-red-500 rounded-full transition-all"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}
                <button 
                    onClick={handleAddTab} 
                    className="px-3 py-2 text-gray-500 hover:text-primary hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Lägg till flik"
                >
                    <span className="text-xl font-bold">+</span>
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-grow flex overflow-hidden">
                {/* LEFT: EDITOR */}
                <div className={`flex-1 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 ${mobileViewMode === 'preview' ? 'hidden lg:flex' : 'flex'}`}>
                    
                    {/* Sub-header for active tab title */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                        <input
                            type="text"
                            value={activeTab?.title || ''}
                            onChange={e => handleUpdateActiveTab('title', e.target.value)}
                            placeholder="Flikens rubrik..."
                            className="w-full bg-transparent text-lg font-semibold text-gray-800 dark:text-gray-200 focus:outline-none placeholder-gray-400"
                        />
                    </div>

                    {/* Toolbar */}
                    <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1 bg-gray-50 dark:bg-gray-900">
                        <ToolButton onClick={() => insertText('**', '**')} label="Fetstil" icon={<span className="font-bold serif">B</span>} />
                        <ToolButton onClick={() => insertText('_', '_')} label="Kursiv" icon={<span className="italic serif">I</span>} />
                        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                        <ToolButton onClick={() => insertText('## ')} label="Rubrik 2" icon={<span className="font-bold">H2</span>} />
                        <ToolButton onClick={() => insertText('### ')} label="Rubrik 3" icon={<span className="font-bold text-sm">H3</span>} />
                        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                        <ToolButton onClick={() => insertText('* ')} label="Lista" icon={<span>• List</span>} />
                        <ToolButton onClick={() => insertText('> ')} label="Citat" icon={<span>“ Quote</span>} />
                        
                        <div className="flex-grow"></div>
                        
                        <button
                            onClick={handleEnhanceWithAI}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-xs font-bold uppercase tracking-wide"
                        >
                            {isProcessing ? <AILoadingSpinner /> : <SparklesIcon className="w-4 h-4" />}
                            <span>AI-Magi</span>
                        </button>
                        
                        {/* Mobile View Toggle */}
                        <button 
                            className="lg:hidden ml-2 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-sm font-medium"
                            onClick={() => setMobileViewMode('preview')}
                        >
                            Granska &rarr;
                        </button>
                    </div>

                    <textarea
                        ref={textAreaRef}
                        value={activeTab?.content || ''}
                        onChange={e => handleUpdateActiveTab('content', e.target.value)}
                        placeholder="Skriv ditt innehåll här... Använd verktygsfältet eller Markdown."
                        className="flex-grow w-full p-4 bg-white dark:bg-black text-gray-800 dark:text-gray-300 font-mono text-sm focus:outline-none resize-none"
                    />
                </div>

                {/* RIGHT: PREVIEW */}
                <div className={`flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col ${mobileViewMode === 'edit' ? 'hidden lg:flex' : 'flex'}`}>
                    {/* Mobile Header for Preview */}
                    <div className="lg:hidden p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-black">
                        <span className="font-bold text-sm uppercase text-gray-500">Förhandsgranskning</span>
                        <button 
                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-sm font-medium"
                            onClick={() => setMobileViewMode('edit')}
                        >
                            &larr; Redigera
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-6 sm:p-8">
                        <div className="prose prose-lg dark:prose-invert max-w-none mx-auto">
                            <MarkdownRenderer content={activeTab?.content || ''} className="" />
                        </div>
                        {!activeTab?.content && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <p>Skriv något till vänster för att se hur det ser ut här.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
