




import React, { useState, useEffect, useMemo } from 'react';
import { StudioConfig, CustomCategoryWithPrompt } from '../types';
import { useStudio } from '../context/StudioContext';
import { ToggleSwitch } from './icons';

// Define a type for keys that have boolean values in StudioConfig
type BooleanStudioConfigKeys = 'enableBoost' | 'enableWarmup' | 'enableBreathingGuide';

interface AdminConfigScreenProps {
    onSave: (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>) => Promise<void>;
    onCancel: () => void;
    globalConfig: StudioConfig;
}

export const AdminConfigScreen: React.FC<AdminConfigScreenProps> = ({ onSave, onCancel, globalConfig }) => {
    const { selectedStudio, selectedOrganization } = useStudio();
    // Local state now holds only the overrides
    const [overrides, setOverrides] = useState<Partial<StudioConfig>>(selectedStudio?.configOverrides || {});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (selectedStudio) {
            setOverrides(selectedStudio.configOverrides || {});
        }
    }, [selectedStudio]);

    // The effective config is a combination of global settings and local overrides
    const effectiveConfig = useMemo(() => ({
        ...globalConfig,
        ...overrides
    }), [globalConfig, overrides]);

    if (!selectedStudio || !selectedOrganization) {
        return (
            <div className="text-center p-8">
                <h2 className="text-2xl font-bold text-white">Ingen studio eller organisation vald</h2>
                <p className="text-gray-400 mt-2">Gå tillbaka och välj en studio för att kunna konfigurera den.</p>
            </div>
        );
    }
    
    const handleToggleChange = (key: BooleanStudioConfigKeys, value: boolean) => {
        setOverrides(prev => {
            const newOverrides = { ...prev };
            if (globalConfig[key] === value) {
                // If the new value is the same as global, remove the override
                delete newOverrides[key];
            } else {
                // Otherwise, set the override
                newOverrides[key] = value;
            }
            return newOverrides;
        });
    };

    const handleCategoriesChange = (updatedCategories: CustomCategoryWithPrompt[]) => {
         setOverrides(prev => ({ ...prev, customCategories: updatedCategories }));
    };

    const resetCategories = () => {
         setOverrides(prev => {
            const newOverrides = { ...prev };
            delete newOverrides.customCategories;
            return newOverrides;
         });
    }

    const handleSaveChanges = async () => {
        if (!selectedOrganization) return;
        setIsSaving(true);
        try {
            await onSave(selectedOrganization.id, selectedStudio.id, overrides);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const isDirty = JSON.stringify(overrides) !== JSON.stringify(selectedStudio.configOverrides || {});

    const renderToggle = (key: BooleanStudioConfigKeys, label: string) => {
        const isOverridden = overrides[key] !== undefined;
        const currentValue = effectiveConfig[key];

        return (
             <div className="flex items-center justify-between p-2 -ml-2 rounded-lg hover:bg-gray-700/50">
                 <ToggleSwitch 
                    label={label}
                    checked={currentValue}
                    onChange={(checked) => handleToggleChange(key, checked)}
                />
                <div className="w-28 text-right">
                {isOverridden ? (
                    <button onClick={() => handleToggleChange(key, globalConfig[key])} className="text-xs text-yellow-400 hover:underline">Återställ</button>
                ) : (
                    <span className="text-xs text-gray-500">Ärvd</span>
                )}
                </div>
            </div>
        )
    };
    
    const areCategoriesOverridden = overrides.customCategories !== undefined;

    return (
        <div className="w-full max-w-2xl mx-auto space-y-8 animate-fade-in pb-24">
            <p className="text-center text-gray-400">
                Här anpassar du inställningar specifikt för <span className="font-bold text-white">{selectedStudio.name}</span>. Ändringar här kommer att åsidosätta de globala standardinställningarna för er organisation.
            </p>

            <div className="bg-gray-800 p-6 rounded-lg space-y-2 border border-gray-700">
                <h3 className="text-xl font-bold text-primary border-b border-gray-700 pb-3 mb-4">Valbara Moduler</h3>
                {renderToggle('enableBoost', "Aktivera 'Dagens Boost'")}
                {renderToggle('enableWarmup', "Aktivera 'Uppvärmning'")}
                {renderToggle('enableBreathingGuide', "Aktivera 'Andningsguide'")}
            </div>

            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                    <h3 className="text-xl font-bold text-primary">Anpassade Passkategorier & AI-Prompts</h3>
                    {areCategoriesOverridden ? (
                        <button onClick={resetCategories} className="text-xs text-yellow-400 hover:underline">Återställ till global</button>
                    ) : (
                        <span className="text-xs text-gray-500">Ärvd</span>
                    )}
                </div>
                 <CategoryPromptManager
                    categories={effectiveConfig.customCategories}
                    onCategoriesChange={handleCategoriesChange}
                    isSaving={isSaving}
                 />
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 border-t border-gray-700 z-10">
                <div className="max-w-2xl mx-auto flex justify-end gap-4">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors">Avbryt</button>
                    <button onClick={handleSaveChanges} disabled={!isDirty || isSaving} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {isSaving ? 'Sparar...' : 'Spara ändringar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Sub-component for managing categories with prompts ---
interface CategoryPromptManagerProps {
    categories: CustomCategoryWithPrompt[];
    onCategoriesChange: (categories: CustomCategoryWithPrompt[]) => void;
    isSaving: boolean;
}
const CategoryPromptManager: React.FC<CategoryPromptManagerProps> = ({ categories, onCategoriesChange, isSaving }) => {

    const handleUpdateCategory = (id: string, field: 'name' | 'prompt', value: string) => {
        const newCategories = categories.map(cat => 
            cat.id === id ? { ...cat, [field]: value } : cat
        );
        onCategoriesChange(newCategories);
    };

    const handleAddCategory = () => {
        const newCategory: CustomCategoryWithPrompt = {
            id: `cat-${Date.now()}`,
            name: 'Ny Kategori',
            prompt: 'Skriv AI-prompten för denna kategori här.'
        };
        onCategoriesChange([...categories, newCategory]);
    };

    const handleRemoveCategory = (id: string) => {
        if (window.confirm("Är du säker på att du vill ta bort denna kategori?")) {
            onCategoriesChange(categories.filter(cat => cat.id !== id));
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-400">
                Dessa kategorier visas som knappar på hemskärmen och i AI-passbyggaren. Varje kategori måste ha en AI-prompt.
            </p>
            {categories.map(cat => (
                <div key={cat.id} className="bg-black/50 p-4 rounded-lg border border-gray-600 space-y-3">
                    <div className="flex justify-between items-center gap-4">
                        <input
                            type="text"
                            value={cat.name}
                            onChange={(e) => handleUpdateCategory(cat.id, 'name', e.target.value)}
                            placeholder="Kategorins namn"
                            className="w-full bg-gray-900 text-white p-2 rounded-md border border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition font-semibold"
                            disabled={isSaving}
                        />
                        <button onClick={() => handleRemoveCategory(cat.id)} className="text-red-500 hover:text-red-400 font-semibold flex-shrink-0">
                            Ta bort
                        </button>
                    </div>
                    <textarea
                        value={cat.prompt}
                        onChange={(e) => handleUpdateCategory(cat.id, 'prompt', e.target.value)}
                        placeholder="AI-instruktioner för denna kategori..."
                        className="w-full h-32 bg-gray-900 text-white p-2 rounded-md border border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-sm"
                        disabled={isSaving}
                    />
                </div>
            ))}
             <button onClick={handleAddCategory} disabled={isSaving} className="w-full mt-4 bg-primary/20 hover:bg-primary/40 text-primary font-bold py-2 px-4 rounded-lg transition-colors border-2 border-dashed border-primary/50">
                Lägg till ny kategori
            </button>
        </div>
    );
};