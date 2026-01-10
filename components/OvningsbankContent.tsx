import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BankExercise } from '../types';
import { getExerciseBank, saveExerciseToBank, deleteExerciseFromBank } from '../services/firebaseService';
import { generateExerciseSuggestions } from '../services/geminiService';
// FIX: Safer import for react-window to handle both Vite and CDN environments
import * as ReactWindow from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// Handle potential import issues with react-window in different environments
// This looks for Named export, Default export with property, or the module itself
const FixedSizeList = ReactWindow.FixedSizeList || (ReactWindow as any).default?.FixedSizeList || ReactWindow;
// Fallback to a simple div if react-window fails completely (very rare with above fix)
const List = FixedSizeList || (({ children }: any) => <div>{children}</div>);

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

interface ExerciseEditorModalProps {
    exercise: BankExercise | null;
    onSave: (exercise: BankExercise) => Promise<void>;
    onClose: () => void;
}

const ExerciseEditorModal: React.FC<ExerciseEditorModalProps> = ({ exercise, onSave, onClose }) => {
    const [localExercise, setLocalExercise] = useState<Partial<BankExercise>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalExercise(exercise ? { ...exercise } : { name: '', description: '' });
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
            tags: localExercise.tags?.filter(t => t) || [],
            imageUrl: localExercise.imageUrl
        };
        await onSave(exerciseToSave);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg text-white shadow-2xl border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{exercise?.id ? 'Redigera övning' : 'Lägg till ny övning'}</h2>
                <div className="space-y-4">
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
            imageUrl: suggestion.imageUrl
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
                            {({ height, width }: { height: number, width: number }) => (
                                <List
                                    height={height}
                                    itemCount={filteredBank.length}
                                    itemSize={88} 
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