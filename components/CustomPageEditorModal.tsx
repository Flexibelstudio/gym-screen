







import React, { useState, useEffect, useRef } from 'react';
import { CustomPage } from '../types';
import { MarkdownRenderer } from './CustomContentScreen';
import { enhancePageWithAI } from '../services/geminiService';

interface CustomPageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (page: CustomPage) => void;
    pageToEdit: CustomPage | null;
}

const AILoadingSpinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


export const CustomPageEditorModal: React.FC<CustomPageEditorModalProps> = ({ isOpen, onClose, onSave, pageToEdit }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [aiHasBeenRun, setAiHasBeenRun] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (pageToEdit) {
            setTitle(pageToEdit.title);
            setContent(pageToEdit.content);
        } else {
            // New page
            setTitle('');
            setContent('');
        }
        // Always start in edit mode and reset AI-run status
        setViewMode('edit'); 
        setAiHasBeenRun(false);
    }, [pageToEdit, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!title.trim()) {
            alert("Titeln får inte vara tom.");
            return;
        }
        const pageData: CustomPage = {
            id: pageToEdit?.id || `custom-page-${Date.now()}`,
            title: title.trim(),
            content: content,
        };
        onSave(pageData);
    };
    
    const handleEnhanceWithAI = async () => {
        if (!content.trim()) {
            alert("Det finns inget innehåll att förbättra.");
            return;
        }
        setIsEnhancing(true);
        try {
            const enhancedContent = await enhancePageWithAI(content);
            setContent(enhancedContent);
            setViewMode('preview'); // Switch to preview mode after enhancing
            setAiHasBeenRun(true); // Enable saving after AI has run
        } catch (error) {
            alert(error instanceof Error ? error.message : "Ett fel uppstod vid AI-förbättring.");
        } finally {
            setIsEnhancing(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-gray-800 rounded-xl w-full max-w-6xl h-[90vh] text-white shadow-2xl border border-gray-700 flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold">{pageToEdit ? 'Redigera infosida' : 'Skapa ny infosida'}</h2>
                    <div className="flex items-center gap-4">
                        {viewMode === 'preview' && (
                             <button onClick={() => setViewMode('edit')} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg text-sm">
                                Dölj förhandsgranskning
                            </button>
                        )}
                        <button
                            onClick={handleEnhanceWithAI}
                            disabled={isEnhancing}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                            {isEnhancing ? <AILoadingSpinner /> : '✨'}
                            <span>{isEnhancing ? 'Jobbar...' : 'AI-magi'}</span>
                        </button>
                    </div>
                </div>

                {/* Content area */}
                <div className={`flex-grow grid grid-cols-1 ${viewMode === 'preview' ? 'md:grid-cols-2' : ''} gap-6 p-4 sm:p-6 overflow-hidden`}>
                    {/* Left Pane: Editor */}
                    <div className="flex flex-col gap-4 overflow-y-auto">
                        <div>
                            <label htmlFor="page-title" className="block text-sm font-medium text-gray-300 mb-1">Titel</label>
                            <input
                                id="page-title"
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Titel som visas på knappen"
                                className="w-full bg-black text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-col flex-grow">
                            <label htmlFor="page-content" className="block text-sm font-medium text-gray-300 mb-2">Innehåll (Stöder Markdown)</label>
                            <textarea
                                id="page-content"
                                ref={textareaRef}
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="Skriv eller klistra in innehållet för sidan här...&#10;Använd sedan 'AI-magi' för att formatera och snygga till texten."
                                className="w-full flex-grow bg-black text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none font-mono resize-none"
                            />
                        </div>
                    </div>

                    {/* Right Pane: Preview */}
                     {viewMode === 'preview' && (
                        <div className="flex flex-col gap-2 overflow-y-auto">
                            <label className="block text-sm font-medium text-gray-300 flex-shrink-0">Förhandsgranskning</label>
                            <div className="bg-black rounded-lg border border-gray-600 flex-grow">
                                <div className="h-full overflow-y-auto">
                                    <MarkdownRenderer content={content} className="prose prose-lg dark:prose-invert max-w-none p-6" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-gray-700 flex justify-end gap-4 flex-shrink-0">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Avbryt</button>
                    <button 
                        onClick={handleSave} 
                        disabled={!aiHasBeenRun}
                        className="bg-primary hover:brightness-95 text-white font-bold py-2 px-6 rounded-lg disabled:bg-primary/50 disabled:cursor-not-allowed"
                    >
                        Spara sida
                    </button>
                </div>
            </div>
        </div>
    );
};