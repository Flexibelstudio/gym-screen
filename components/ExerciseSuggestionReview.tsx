import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SuggestedExercise, BankExercise } from '../types';
import { getSuggestedExercises, approveExerciseSuggestion, deleteExerciseSuggestion, updateExerciseSuggestion } from '../services/firebaseService';
import { DumbbellIcon } from './icons';

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
            canvas.width = width; canvas.height = height;
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

const ImageUploader: React.FC<{ imageUrl: string | null, onImageChange: (url: string) => void, disabled?: boolean }> = ({ imageUrl, onImageChange, disabled }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFile = async (file: File | null) => {
        if (disabled || !file || !file.type.startsWith('image/')) return;
        const resized = await resizeImage(file, 800, 800, 0.8);
        onImageChange(resized);
    };
    return (
        <div className="space-y-2">
            {imageUrl && <img src={imageUrl} alt="Preview" className="w-full h-48 object-cover rounded-md" />}
            <button onClick={() => fileInputRef.current?.click()} disabled={disabled} className="w-full bg-gray-600 text-white p-2 rounded text-sm hover:bg-gray-500">Byt bild</button>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e.target.files?.[0] || null)} accept="image/*" className="hidden" disabled={disabled} />
        </div>
    );
};

const SuggestionEditorModal: React.FC<{ suggestion: SuggestedExercise, onSaveAndApprove: (s: SuggestedExercise) => Promise<void>, onClose: () => void }> = ({ suggestion, onSaveAndApprove, onClose }) => {
    const [local, setLocal] = useState(suggestion);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await onSaveAndApprove(local);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg text-white shadow-2xl border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">Redigera & Godkänn Förslag</h2>
                <div className="space-y-4">
                    <ImageUploader imageUrl={local.imageUrl || null} onImageChange={(url) => setLocal(p => ({ ...p, imageUrl: url }))} disabled={isSaving} />
                    <div><label className="text-sm text-gray-400">Namn</label><input type="text" value={local.name} onChange={(e) => setLocal(p => ({ ...p, name: e.target.value }))} className="w-full bg-black p-3 rounded" disabled={isSaving} /></div>
                    <div><label className="text-sm text-gray-400">Beskrivning</label><textarea value={local.description} onChange={(e) => setLocal(p => ({ ...p, description: e.target.value }))} rows={4} className="w-full bg-black p-3 rounded" disabled={isSaving} /></div>
                    <div>
                        <label className="text-sm text-gray-400">Taggar (komma-separerade)</label>
                        <input type="text" value={local.tags?.join(', ') || ''} onChange={(e) => setLocal(p => ({ ...p, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) }))} placeholder="t.ex. axlar, styrka, hantlar" className="w-full bg-black p-3 rounded" disabled={isSaving} />
                    </div>
                </div>
                <div className="mt-6 flex gap-4">
                    <button onClick={onClose} disabled={isSaving} className="flex-1 bg-gray-600 font-bold py-3 rounded">Avbryt</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-primary font-bold py-3 rounded disabled:opacity-50">{isSaving ? 'Sparar...' : 'Spara & Godkänn'}</button>
                </div>
            </div>
        </div>
    );
};

export const ExerciseSuggestionReview: React.FC = () => {
    const [suggestions, setSuggestions] = useState<SuggestedExercise[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingSuggestion, setEditingSuggestion] = useState<SuggestedExercise | null>(null);

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        setIsLoading(true);
        const suggs = await getSuggestedExercises();
        setSuggestions(suggs);
        setIsLoading(false);
    };

    const handleApprove = async (suggestion: SuggestedExercise) => {
        await approveExerciseSuggestion(suggestion);
        await fetchSuggestions();
    };

    const handleSaveAndApprove = async (suggestion: SuggestedExercise) => {
        await updateExerciseSuggestion(suggestion); // First, save changes
        await approveExerciseSuggestion(suggestion); // Then, approve it
        await fetchSuggestions();
        setEditingSuggestion(null);
    };

    const handleDelete = async (suggestion: SuggestedExercise) => {
        if (window.confirm(`Är du säker på att du vill ta bort förslaget "${suggestion.name}"?`)) {
            await deleteExerciseSuggestion(suggestion.id);
            await fetchSuggestions();
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
            <div className="border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Granska Nya Övningsförslag</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Här samlas nya övningar som skapats av coacher. Granska och godkänn dem för att lägga till dem i den globala övningsbanken.</p>
            </div>
            {isLoading ? <p className="text-center text-gray-400">Laddar förslag...</p> : suggestions.length === 0 ? <p className="text-center text-gray-400">Inga nya övningsförslag att granska.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {suggestions.map(sugg => (
                        <div key={sugg.id} className="bg-white dark:bg-gray-900/50 rounded-lg shadow border border-slate-200 dark:border-gray-700 flex flex-col">
                            {sugg.imageUrl ? (
                                <img src={sugg.imageUrl} alt={sugg.name} className="w-full h-40 object-cover rounded-t-lg bg-gray-700" />
                            ) : (
                                <div className="w-full h-40 bg-gray-700 rounded-t-lg flex items-center justify-center">
                                    <DumbbellIcon className="w-16 h-16 text-gray-500" />
                                </div>
                            )}
                            <div className="p-4 flex-grow flex flex-col">
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{sugg.name}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex-grow">{sugg.description}</p>
                                <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-slate-200 dark:border-gray-700">Från pass: <span className="font-semibold">"{sugg.sourceWorkoutTitle}"</span></p>
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button onClick={() => handleApprove(sugg)} className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-3 rounded text-sm">Godkänn</button>
                                    <button onClick={() => setEditingSuggestion(sugg)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-3 rounded text-sm">Redigera</button>
                                    <button onClick={() => handleDelete(sugg)} className="col-span-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-3 rounded text-sm">Ta bort</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {editingSuggestion && <SuggestionEditorModal suggestion={editingSuggestion} onSaveAndApprove={handleSaveAndApprove} onClose={() => setEditingSuggestion(null)} />}
        </div>
    );
};