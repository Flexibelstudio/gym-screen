import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BankExercise } from '../types';
import { getExerciseBank, saveExerciseToBank, deleteExerciseFromBank, uploadImage } from '../services/firebaseService';
import { generateExerciseImage, generateExerciseSuggestions } from '../services/geminiService';
import { DumbbellIcon } from './icons';

const AILoadingSpinner: React.FC = () => (
    <div className="relative w-8 h-8">
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
    </div>
);

const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round(width * (maxHeight / height));
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(img.src);
                return reject(new Error('Could not get canvas context'));
            }

            const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            if (mimeType === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
            }
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL(mimeType, quality);
            URL.revokeObjectURL(img.src);
            resolve(dataUrl);
        };
        img.onerror = (error) => {
            URL.revokeObjectURL(img.src);
            reject(error);
        };
    });
};

interface ImageUploaderProps {
    imageUrl: string | null;
    onImageChange: (url: string) => void;
    disabled?: boolean;
    isLoading?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ imageUrl, onImageChange, disabled, isLoading }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    const handleFile = async (file: File | null) => {
        if (disabled || !file || !file.type.startsWith('image/')) return;
        setIsUploading(true);
        try {
            const resizedImage = await resizeImage(file, 800, 800, 0.8);
            const path = `exerciseBank/${Date.now()}-${file.name}`;
            const downloadURL = await uploadImage(path, resizedImage);
            onImageChange(downloadURL);
        } catch (error) {
            console.error("Image upload failed:", error);
            alert("Bilden kunde inte laddas upp.");
        } finally {
            setIsUploading(false);
        }
    };
    
    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    await handleFile(file);
                    e.preventDefault();
                    return;
                }
            }
        }
    }, []);

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if(!disabled) setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    };
    
    const combinedIsLoading = isLoading || isUploading;

    return (
        <div className="relative">
            {combinedIsLoading && (
                <div className="absolute inset-0 bg-gray-900/80 rounded-md z-10 flex flex-col items-center justify-center gap-2">
                    <AILoadingSpinner />
                    <p className="text-sm font-semibold text-gray-300">{isLoading ? 'Genererar bild...' : 'Laddar upp...'}</p>
                </div>
            )}
            {imageUrl ? (
                <div className="relative group">
                    <img src={imageUrl} alt="Förhandsvisning" className="w-full h-48 object-cover rounded-md" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => !disabled && onImageChange('')} disabled={disabled} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-full shadow-lg">Ta bort bild</button>
                    </div>
                </div>
            ) : (
                <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => !disabled && fileInputRef.current?.click()} className={`relative flex flex-col items-center justify-center p-4 w-full h-48 border-2 border-dashed rounded-lg transition-colors ${disabled ? 'cursor-not-allowed bg-gray-700/50' : 'cursor-pointer'} ${isDragging ? 'border-primary bg-primary/20' : 'border-gray-600 hover:border-primary hover:bg-gray-700/50'}`}>
                    <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e.target.files?.[0] || null)} accept="image/*" className="hidden" disabled={disabled} />
                    <div className="text-center text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <p className="font-semibold mt-2 text-sm">Dra & släpp, klicka, eller klistra in en bild</p>
                    </div>
                </div>
            )}
        </div>
    );
};

interface ExerciseEditorModalProps {
    exercise: BankExercise | null;
    onSave: (exercise: BankExercise) => Promise<void>;
    onClose: () => void;
}

const ExerciseEditorModal: React.FC<ExerciseEditorModalProps> = ({ exercise, onSave, onClose }) => {
    const [localExercise, setLocalExercise] = useState<Partial<BankExercise>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    useEffect(() => {
        setLocalExercise(exercise ? { ...exercise } : { name: '', description: '', imageUrl: '' });
    }, [exercise]);

    const handleSave = async () => {
        if (!localExercise.name) {
            alert("Namn är ett obligatoriskt fält.");
            return;
        }
        setIsSaving(true);
        const exerciseToSave: BankExercise = {
            id: localExercise.id || `exercise_${Date.now()}`,
            name: localExercise.name,
            description: localExercise.description || '',
            imageUrl: localExercise.imageUrl || '',
            tags: localExercise.tags?.filter(t => t) || [],
        };
        await onSave(exerciseToSave);
        setIsSaving(false);
    };

    const handleGenerateImage = async () => {
        if (!localExercise.name) {
            alert("Skriv ett namn på övningen först för att generera en bild.");
            return;
        }
        setIsGeneratingImage(true);
        try {
            const prompt = `En tydlig, högkvalitativ och realistisk bild som illustrerar fitnessövningen: "${localExercise.name}". Bilden ska vara i en ljus, modern gymmiljö. Minimalistisk bakgrund.`;
            const imageDataUrl = await generateExerciseImage(prompt);
            const path = `exerciseBank/ai-${Date.now()}-${localExercise.name.replace(/\s+/g, '-')}.jpg`;
            const downloadURL = await uploadImage(path, imageDataUrl);
            setLocalExercise(p => ({...p, imageUrl: downloadURL}));
        } catch (error) {
            alert("Kunde inte generera bild: " + (error as Error).message);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg text-white shadow-2xl border border-gray-700 animate-fade-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6 flex-shrink-0">{exercise ? 'Redigera Övning' : 'Lägg till Ny Övning'}</h2>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                     <div>
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="ex-image" className="block text-sm font-medium text-gray-400">Bild (frivillig)</label>
                            <button onClick={handleGenerateImage} disabled={isSaving || isGeneratingImage || !localExercise.name} className="text-sm font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                                ✨ Generera med AI
                            </button>
                        </div>
                        <ImageUploader 
                            imageUrl={localExercise.imageUrl || null} 
                            onImageChange={(url) => setLocalExercise(p => ({...p, imageUrl: url}))} 
                            disabled={isSaving || isGeneratingImage}
                            isLoading={isGeneratingImage}
                        />
                    </div>
                    <div>
                        <label htmlFor="ex-name" className="block text-sm font-medium text-gray-400 mb-2">Namn</label>
                        <input id="ex-name" type="text" value={localExercise.name || ''} onChange={(e) => setLocalExercise(p => ({...p, name: e.target.value}))} className="w-full bg-black p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary" disabled={isSaving} />
                    </div>
                    <div>
                        <label htmlFor="ex-desc" className="block text-sm font-medium text-gray-400 mb-2">Beskrivning (frivillig)</label>
                        <textarea id="ex-desc" value={localExercise.description || ''} onChange={(e) => setLocalExercise(p => ({...p, description: e.target.value}))} rows={4} className="w-full bg-black p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary" disabled={isSaving} />
                    </div>
                    <div>
                        <label htmlFor="ex-tags" className="block text-sm font-medium text-gray-400 mb-2">Taggar (komma-separerade)</label>
                        <input id="ex-tags" type="text" value={localExercise.tags?.join(', ') || ''} onChange={(e) => setLocalExercise(p => ({...p, tags: e.target.value.split(',').map(t => t.trim())}))} placeholder="t.ex. axlar, styrka, hantlar" className="w-full bg-black p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary" disabled={isSaving} />
                    </div>
                </div>
                <div className="mt-6 flex gap-4 flex-shrink-0">
                    <button onClick={onClose} disabled={isSaving} className="flex-1 bg-gray-600 hover:bg-gray-500 font-bold py-3 rounded-lg">Avbryt</button>
                    <button onClick={handleSave} disabled={isSaving || isGeneratingImage || !localExercise.name} className="flex-1 bg-primary hover:brightness-95 font-bold py-3 rounded-lg disabled:opacity-50">
                        {isSaving ? 'Sparar...' : 'Spara'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const OvningsbankContent: React.FC = () => {
    const [exercises, setExercises] = useState<BankExercise[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingExercise, setEditingExercise] = useState<BankExercise | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiSuggestionsList, setAiSuggestionsList] = useState<Partial<BankExercise>[]>([]);

    const fetchExercises = async () => {
        setIsLoading(true);
        try {
            const bankExercises = await getExerciseBank();
            setExercises(bankExercises);
            
            // Auto-expand the first group by default
            const firstGroup = getGroupForExercise(bankExercises[0]);
            if(firstGroup) {
                setExpandedGroups({ [firstGroup]: true });
            }

        } catch (error) {
            console.error("Failed to fetch exercise bank:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchExercises();
    }, []);
    
    const handleOpenModal = (exercise: BankExercise | null) => {
        setEditingExercise(exercise);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingExercise(null);
        setIsModalOpen(false);
    };

    const handleSave = async (exercise: BankExercise) => {
        await saveExerciseToBank(exercise);
        await fetchExercises();
        handleCloseModal();
    };

    const handleDelete = async (exerciseId: string, exerciseName: string) => {
        if (window.confirm(`Är du säker på att du vill ta bort övningen "${exerciseName}"?`)) {
            await deleteExerciseFromBank(exerciseId);
            setExercises(prev => prev.filter(ex => ex.id !== exerciseId));
        }
    };

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    };

    const getGroupForExercise = (exercise: BankExercise): string => {
        if (!exercise) return 'Övrigt';
        const tags = exercise.tags?.map(t => t.toLowerCase()) || [];

        const categoryMap: Record<string, string[]> = {
            'Kroppsvikt': ['kroppsvikt'],
            'Kettlebell': ['kettlebell'],
            'Skivstång': ['skivstång'],
            'Hantlar': ['hantlar'],
            'Landmine': ['landmine'],
            'Konditionsmaskiner': ['roddmaskin', 'air bike', 'skierg', 'löpband'],
            'Övrig Utrustning': ['box', 'medicinboll', 'hopprep', 'trx', 'gummiband'],
            'Bål & Rörlighet': ['bål', 'mage', 'rörlighet', 'isometrisk', 'balans', 'stabilitet', 'core'],
        };

        for (const [category, keywords] of Object.entries(categoryMap)) {
            if (tags.some(tag => keywords.includes(tag))) {
                return category;
            }
        }
        return 'Övrigt';
    };

    const filteredAndGroupedExercises = useMemo(() => {
        const filtered = exercises.filter(ex => {
            const lowerSearch = searchTerm.toLowerCase();
            return (
                ex.name.toLowerCase().includes(lowerSearch) ||
                (ex.description && ex.description.toLowerCase().includes(lowerSearch)) ||
                (ex.tags && ex.tags.some(tag => tag.toLowerCase().includes(lowerSearch)))
            );
        });

        const grouped = filtered.reduce((acc, ex) => {
            const group = getGroupForExercise(ex);
            if (!acc[group]) acc[group] = [];
            acc[group].push(ex);
            return acc;
        }, {} as Record<string, BankExercise[]>);

        return Object.keys(grouped)
            .sort((a, b) => a.localeCompare(b))
            .reduce((obj, key) => {
                obj[key] = grouped[key];
                return obj;
            }, {} as Record<string, BankExercise[]>);

    }, [exercises, searchTerm]);

    const handleGenerateSuggestions = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        setAiSuggestionsList([]);
        try {
            const suggestions = await generateExerciseSuggestions(aiPrompt);
            setAiSuggestionsList(suggestions);
        } catch (error) {
            alert("Kunde inte generera förslag: " + (error as Error).message);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleApproveSuggestion = (suggestion: Partial<BankExercise>) => {
        handleOpenModal({
            id: '', // New ID will be generated on save
            name: suggestion.name || '',
            description: suggestion.description || '',
            imageUrl: '', // User must add this
            tags: suggestion.tags || []
        });
        setAiSuggestionsList(prev => prev.filter(s => s.name !== suggestion.name));
    };

    const handleDiscardSuggestion = (suggestion: Partial<BankExercise>) => {
        setAiSuggestionsList(prev => prev.filter(s => s.name !== suggestion.name));
    };

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4 flex-wrap gap-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Global Övningsbank</h3>
                <div className="flex-grow max-w-sm">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Sök övning, tagg, muskelgrupp..."
                        className="w-full bg-white dark:bg-black p-2 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                </div>
                <button onClick={() => handleOpenModal(null)} className="bg-primary hover:brightness-95 text-white font-bold py-2 px-5 rounded-lg">Lägg till ny övning</button>
            </div>

            <div className="bg-slate-200 dark:bg-gray-900/50 p-6 rounded-lg space-y-4 border border-slate-300 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Generera övningsförslag med AI</h3>
                <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Skriv en prompt, t.ex. 'rotationsövningar med kroppsvikt' eller 'bröstträning med hantlar'..."
                    className="w-full h-24 bg-white dark:bg-black p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none"
                    disabled={isGenerating}
                />
                <button
                    onClick={handleGenerateSuggestions}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-5 rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                    {isGenerating ? <div className="relative w-5 h-5"><div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div></div> : '✨'}
                    <span>{isGenerating ? 'Genererar...' : 'Generera förslag'}</span>
                </button>
            </div>
            
            {aiSuggestionsList.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">AI-genererade förslag</h3>
                    <div className="space-y-3">
                        {aiSuggestionsList.map((sugg, index) => (
                            <div key={`${sugg.name}-${index}`} className="bg-white dark:bg-gray-900/50 p-4 rounded-lg border border-slate-200 dark:border-gray-700">
                                <h4 className="font-bold text-lg text-gray-900 dark:text-white">{sugg.name}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{sugg.description}</p>
                                {sugg.tags && sugg.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{sugg.tags.map(t => <span key={t} className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">{t}</span>)}</div>}
                                <div className="mt-3 flex gap-2">
                                    <button onClick={() => handleApproveSuggestion(sugg)} className="bg-green-600 hover:bg-green-500 text-white font-semibold py-1 px-3 rounded text-sm">Redigera & Godkänn</button>
                                    <button onClick={() => handleDiscardSuggestion(sugg)} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded text-sm">Ta bort</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {isLoading ? (
                <p className="text-gray-400 text-center py-8">Laddar övningar...</p>
            ) : Object.keys(filteredAndGroupedExercises).length === 0 ? (
                <p className="text-gray-400 text-center py-8">Inga övningar matchade din sökning.</p>
            ) : (
                <div className="space-y-4">
                    {Object.entries(filteredAndGroupedExercises).map(([groupName, groupExercises]) => {
                        const isExpanded = !!expandedGroups[groupName];
                        return (
                            <div key={groupName} className="bg-slate-200 dark:bg-gray-900/50 rounded-lg border border-slate-300 dark:border-gray-700">
                                <button onClick={() => toggleGroup(groupName)} className="w-full flex justify-between items-center p-4 text-left" aria-expanded={isExpanded}>
                                    <div className="flex items-center gap-3">
                                        <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">{groupName}</h4>
                                    </div>
                                    <span className="text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full">
                                        {groupExercises.length} övning(ar)
                                    </span>
                                </button>
                                {isExpanded && (
                                    <div className="p-4 border-t border-slate-300 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                                        {groupExercises.map(ex => (
                                            <div key={ex.id} className="bg-white dark:bg-gray-900/50 rounded-lg shadow-md border border-slate-200 dark:border-gray-700 flex flex-col">
                                                {ex.imageUrl ? (
                                                    <img src={ex.imageUrl} alt={ex.name} className="w-full h-40 object-cover rounded-t-lg bg-gray-700" />
                                                ) : (
                                                    <div className="w-full h-40 bg-gray-700 rounded-t-lg flex items-center justify-center">
                                                        <DumbbellIcon className="w-16 h-16 text-gray-500" />
                                                    </div>
                                                )}
                                                <div className="p-4 flex-grow flex flex-col">
                                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{ex.name}</h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex-grow line-clamp-3">{ex.description}</p>
                                                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
                                                        <button onClick={() => handleOpenModal(ex)} className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-3 rounded-lg text-sm">Redigera</button>
                                                        <button onClick={() => handleDelete(ex.id, ex.name)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-3 rounded-lg text-sm">Ta bort</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            
            {isModalOpen && (
                <ExerciseEditorModal
                    exercise={editingExercise}
                    onSave={handleSave}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};