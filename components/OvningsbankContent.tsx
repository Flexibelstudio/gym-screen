
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BankExercise } from '../types';
import { getExerciseBank, saveExerciseToBank, deleteExerciseFromBank, uploadImage } from '../services/firebaseService';
import { generateExerciseImage, generateExerciseSuggestions } from '../services/geminiService';
import { DumbbellIcon } from './icons';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const AILoadingSpinner: React.FC = () => (
    <div className="relative w-8 h-8">
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
    </div>
);

// --- Performance Hooks & Components ---

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

const LazyImage = React.memo(({ src, alt, className }: { src: string, alt: string, className: string }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsLoaded(true);
                observer.disconnect();
            }
        });
        if (ref.current) {
            observer.observe(ref.current);
        }
        return () => observer.disconnect();
    }, []);
    
    const placeholderClass = "bg-gray-700 flex items-center justify-center";

    return (
        <div ref={ref} className={`${className} ${!isLoaded ? placeholderClass : ''}`}>
            {isLoaded ? 
                <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />
                : <DumbbellIcon className="w-8 h-8 text-gray-500" />
            }
        </div>
    );
});


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
            id: localExercise.id || `bank_${Date.now()}`,
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
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg text-white shadow-2xl border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{exercise?.id ? 'Redigera övning' : 'Lägg till ny övning'}</h2>
                <div className="space-y-4">
                    <ImageUploader imageUrl={localExercise.imageUrl || null} onImageChange={(url) => setLocalExercise(p => ({ ...p, imageUrl: url }))} disabled={isSaving || isGeneratingImage} isLoading={isGeneratingImage} />
                    <button onClick={handleGenerateImage} disabled={isGeneratingImage || isSaving || !localExercise.name} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-3 rounded text-sm flex items-center justify-center gap-1 disabled:opacity-50">
                        {isGeneratingImage ? <AILoadingSpinner /> : '✨'}
                        <span>{isGeneratingImage ? 'Genererar...' : 'Generera bild med AI'}</span>
                    </button>
                    <div><label className="text-sm text-gray-400">Namn</label><input type="text" value={localExercise.name || ''} onChange={(e) => setLocalExercise(p => ({ ...p, name: e.target.value }))} className="w-full bg-black p-3 rounded" disabled={isSaving} /></div>
                    <div><label className="text-sm text-gray-400">Beskrivning</label><textarea value={localExercise.description || ''} onChange={(e) => setLocalExercise(p => ({ ...p, description: e.target.value }))} rows={4} className="w-full bg-black p-3 rounded" disabled={isSaving} /></div>
                    <div>
                        <label className="text-sm text-gray-400">Taggar (komma-separerade)</label>
                        <input type="text" value={localExercise.tags?.join(', ') || ''} onChange={(e) => setLocalExercise(p => ({ ...p, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) }))} placeholder="t.ex. axlar, styrka, hantlar" className="w-full bg-black p-3 rounded" disabled={isSaving} />
                    </div>
                </div>
                <div className="mt-6 flex gap-4">
                    <button onClick={onClose} disabled={isSaving} className="flex-1 bg-gray-600 font-bold py-3 rounded">Avbryt</button>
                    <button onClick={handleSave} disabled={isSaving || !localExercise.name} className="flex-1 bg-primary font-bold py-3 rounded disabled:opacity-50">{isSaving ? 'Sparar...' : 'Spara'}</button>
                </div>
            </div>
        </div>
    );
};

export const OvningsbankContent: React.FC = () => {
    const [bank, setBank] = useState<BankExercise[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingExercise, setEditingExercise] = useState<BankExercise | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState<Partial<BankExercise>[]>([]);
    const [suggestionPrompt, setSuggestionPrompt] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);
    
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const fetchBank = useCallback(async () => {
        setIsLoading(true);
        try {
            const exercises = await getExerciseBank();
            setBank(exercises);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBank();
    }, [fetchBank]);

    const filteredBank = useMemo(() => {
        if (!debouncedSearchTerm) return bank;
        const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
        return bank.filter(ex => 
            ex.name.toLowerCase().includes(lowerCaseSearchTerm) ||
            (ex.description && ex.description.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (ex.tags && ex.tags.some(tag => tag.toLowerCase().includes(lowerCaseSearchTerm)))
        );
    }, [bank, debouncedSearchTerm]);

    const handleSave = async (exercise: BankExercise) => {
        await saveExerciseToBank(exercise);
        await fetchBank(); // Re-fetch to get the latest sorted list
        setEditingExercise(null);
    };

    const handleDelete = async (exercise: BankExercise) => {
        if (window.confirm(`Är du säker på att du vill ta bort övningen "${exercise.name}"?`)) {
            await deleteExerciseFromBank(exercise.id);
            await fetchBank();
        }
    };
    
    const handleGenerateSuggestions = async () => {
        if (!suggestionPrompt) return;
        setIsSuggesting(true);
        setSuggestions([]);
        try {
            const newSuggestions = await generateExerciseSuggestions(suggestionPrompt);
            setSuggestions(newSuggestions);
        } catch (error) {
            console.error(error);
            alert("Kunde inte generera förslag.");
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleSaveSuggestion = async (suggestion: Partial<BankExercise>) => {
        const newExercise: BankExercise = {
            id: `bank_${Date.now()}`,
            name: suggestion.name || 'Namnlös',
            description: suggestion.description || '',
            tags: suggestion.tags || [],
            imageUrl: '',
        };
        await saveExerciseToBank(newExercise);
        setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
        await fetchBank();
    };


    const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
        const exercise = filteredBank[index];
        return (
            <div style={style} className="px-2 py-1">
                <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg flex items-center gap-3 border border-slate-200 dark:border-gray-700 h-full">
                    {exercise.imageUrl && <LazyImage src={exercise.imageUrl} alt={exercise.name} className="w-16 h-16 rounded flex-shrink-0" />}
                    <div className="flex-grow min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{exercise.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{exercise.description}</p>
                    </div>
                    <div className="flex-shrink-0 flex gap-2">
                        <button onClick={() => setEditingExercise(exercise)} className="text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded">Redigera</button>
                        <button onClick={() => handleDelete(exercise)} className="text-sm bg-red-600 hover:bg-red-500 text-white font-semibold py-1 px-3 rounded">Ta bort</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Global Övningsbank</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Sök i övningsbanken..." className="flex-grow w-full bg-white dark:bg-black p-3 rounded-md border border-slate-300 dark:border-gray-600" />
                    <button onClick={() => setEditingExercise({} as BankExercise)} className="w-full sm:w-auto bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg whitespace-nowrap">Lägg till ny övning</button>
                </div>
                <div className="h-[60vh] w-full">
                    {isLoading ? <p>Laddar...</p> : (
                        <AutoSizer>
                            {({ height, width }) => (
                                <List
                                    height={height}
                                    itemCount={filteredBank.length}
                                    itemSize={88} // 16px img + padding + gaps
                                    width={width}
                                >
                                    {Row}
                                </List>
                            )}
                        </AutoSizer>
                    )}
                </div>
            </div>
            
             <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Generera nya övningar med AI</h3>
                <div className="flex gap-4">
                    <input type="text" value={suggestionPrompt} onChange={e => setSuggestionPrompt(e.target.value)} placeholder="t.ex. 'nya bålövningar med landmine'" className="flex-grow w-full bg-white dark:bg-black p-3 rounded-md border border-slate-300 dark:border-gray-600" />
                    <button onClick={handleGenerateSuggestions} disabled={isSuggesting || !suggestionPrompt} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 disabled:opacity-50">
                        {isSuggesting ? <AILoadingSpinner /> : '✨'}
                        <span>{isSuggesting ? 'Genererar...' : 'Generera Förslag'}</span>
                    </button>
                </div>
                {suggestions.length > 0 && (
                    <div className="space-y-3 pt-4">
                        {suggestions.map((sugg, i) => (
                             <div key={i} className="bg-white dark:bg-gray-900/50 p-3 rounded-lg flex items-center gap-3 border border-slate-200 dark:border-gray-700">
                                <div className="flex-grow min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-white">{sugg.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{sugg.description}</p>
                                </div>
                                <button onClick={() => handleSaveSuggestion(sugg)} className="text-sm bg-green-600 hover:bg-green-500 text-white font-semibold py-1 px-3 rounded">Spara</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {editingExercise && <ExerciseEditorModal exercise={editingExercise} onSave={handleSave} onClose={() => setEditingExercise(null)} />}
        </div>
    );
};
