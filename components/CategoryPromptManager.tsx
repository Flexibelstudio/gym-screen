
import React, { useState } from 'react';
import { CustomCategoryWithPrompt } from '../types';
import { ICON_OPTIONS, getIconComponent } from './icons';

interface CategoryPromptManagerProps {
    categories: CustomCategoryWithPrompt[];
    onCategoriesChange: (categories: CustomCategoryWithPrompt[]) => void;
    isSaving: boolean;
}

export const CategoryPromptManager: React.FC<CategoryPromptManagerProps> = ({ categories, onCategoriesChange, isSaving }) => {
    const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
    const [editingState, setEditingState] = useState<Record<string, string>>({});
    const [iconPickerOpen, setIconPickerOpen] = useState<string | null>(null);

    const togglePrompt = (id: string) => {
        setExpandedPrompts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleStartEditing = (cat: CustomCategoryWithPrompt) => setEditingState(prev => ({ ...prev, [cat.id]: cat.name }));
    const handleCancelEditing = (id: string) => setEditingState(prev => { const n = {...prev}; delete n[id]; return n; });
    const handleEditingChange = (id: string, value: string) => setEditingState(prev => ({ ...prev, [id]: value }));

    const handleUpdateCategory = (id: string, field: 'name' | 'prompt' | 'icon', value: string) => {
        onCategoriesChange(categories.map(cat => cat.id === id ? { ...cat, [field]: value } : cat));
    };
    
    const handleSaveName = (id: string) => {
        const newName = editingState[id];
        if (newName === undefined || newName.trim() === '') return;
        handleUpdateCategory(id, 'name', newName);
        handleCancelEditing(id);
    };

    const handleAddCategory = () => {
        const newCategory: CustomCategoryWithPrompt = {
            id: `cat-${Date.now()}`,
            name: 'Ny Passkategori',
            prompt: 'Skriv AI-prompten för denna kategori här.',
            icon: 'dumbbell'
        };
        onCategoriesChange([...categories, newCategory]);
    };

    const handleRemoveCategory = (id: string) => {
        if (window.confirm("Är du säker på att du vill ta bort denna passkategori?")) {
            onCategoriesChange(categories.filter(cat => cat.id !== id));
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Dessa passkategorier visas som knappar på hemskärmen och i AI-passbyggaren.
            </p>
            {categories.map(cat => {
                const isExpanded = !!expandedPrompts[cat.id];
                const isEditing = editingState.hasOwnProperty(cat.id);
                const CurrentIcon = getIconComponent(cat.icon || 'dumbbell');
                const isPickingIcon = iconPickerOpen === cat.id;

                return (
                    <div key={cat.id} className="bg-slate-200/50 dark:bg-black/50 p-4 rounded-lg border border-slate-300 dark:border-gray-600">
                        <div className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-3 flex-grow">
                                <button 
                                    onClick={() => setIconPickerOpen(isPickingIcon ? null : cat.id)}
                                    className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                                    title="Ändra ikon"
                                >
                                    <CurrentIcon className="w-6 h-6" />
                                </button>
                                
                                <div className="flex-grow">
                                    {isEditing ? (
                                        <input type="text" value={editingState[cat.id]} onChange={(e) => handleEditingChange(cat.id, e.target.value)} className="w-full bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 ring-2 ring-primary focus:outline-none transition font-semibold" disabled={isSaving} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveName(cat.id)} />
                                    ) : (
                                        <p className="p-2 font-semibold text-gray-900 dark:text-white">{cat.name}</p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex-shrink-0 flex items-center gap-3">
                                {isEditing ? (
                                    <>
                                        <button onClick={() => handleSaveName(cat.id)} className="text-sm text-primary hover:text-green-400 transition-colors whitespace-nowrap font-semibold">Spara</button>
                                        <button onClick={() => handleCancelEditing(cat.id)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap">Avbryt</button>
                                    </>
                                ) : (
                                    <button onClick={() => handleStartEditing(cat)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap">Redigera namn</button>
                                )}
                                <button onClick={() => togglePrompt(cat.id)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap">
                                    {isExpanded ? 'Dölj prompt' : 'Visa prompt'}
                                </button>
                                <button onClick={() => handleRemoveCategory(cat.id)} className="text-red-500 hover:text-red-400 font-semibold text-sm">Ta bort</button>
                            </div>
                        </div>

                        {isPickingIcon && (
                            <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-inner animate-fade-in">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-3">Välj ikon</p>
                                <div className="flex flex-wrap gap-3">
                                    {ICON_OPTIONS.map(option => (
                                        <button
                                            key={option.key}
                                            onClick={() => {
                                                handleUpdateCategory(cat.id, 'icon', option.key);
                                                setIconPickerOpen(null);
                                            }}
                                            className={`p-3 rounded-lg flex flex-col items-center gap-1 transition-all ${cat.icon === option.key ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                        >
                                            <option.component className="w-6 h-6" />
                                            <span className="text-[10px] font-medium">{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isExpanded && (
                            <textarea value={cat.prompt} onChange={(e) => handleUpdateCategory(cat.id, 'prompt', e.target.value)} placeholder="AI-instruktioner..." className="w-full h-32 bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-sm mt-3 animate-fade-in" disabled={isSaving}/>
                        )}
                    </div>
                )
            })}
             <button onClick={handleAddCategory} disabled={isSaving} className="w-full mt-4 bg-primary/20 hover:bg-primary/40 text-primary font-bold py-2 px-4 rounded-lg transition-colors border-2 border-dashed border-primary/50">
                Lägg till ny passkategori
            </button>
        </div>
    );
};