
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StudioConfig, CustomCategoryWithPrompt, EquipmentItem } from '../types';
import { useStudio } from '../context/StudioContext';
import { ToggleSwitch } from './icons';

// Define a type for keys that have boolean values in StudioConfig
type BooleanStudioConfigKeys = 'enableBoost' | 'enableWarmup' | 'enableBreathingGuide' | 'checkInImageEnabled';

const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.95): Promise<string> => {
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

// --- Sub-component for uploading images ---
const ImageUploader: React.FC<{
  label: string;
  imageUrl: string | null;
  onImageChange: (url: string) => void;
  isSaving: boolean;
}> = ({ label, imageUrl, onImageChange, isSaving }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
        try {
            const resizedImage = await resizeImage(file, 1024, 1024, 0.95);
            onImageChange(resizedImage);
        } catch (error) {
            console.error("Image resizing failed:", error);
            alert("Bilden kunde inte förminskas. Försök med en annan bild eller en mindre bild.");
        }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleRemoveImage = () => {
      onImageChange('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-400">{label}</label>
      {imageUrl ? (
        <div className="relative group">
          <img src={imageUrl} alt="Förhandsvisning" className="w-48 h-48 object-cover rounded-md" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={handleRemoveImage}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-full shadow-lg"
            >
              Ta bort bild
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-4 w-48 h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/20' : 'border-gray-600 hover:border-primary hover:bg-gray-700/50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
            accept="image/*"
            className="hidden"
            disabled={isSaving}
          />
          <div className="text-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <p className="font-semibold mt-1 text-sm">Dra och släpp en bild</p>
            <p className="text-xs">eller klicka för att välja fil</p>
          </div>
        </div>
      )}
    </div>
  );
};


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
    const effectiveConfig = useMemo(() => {
        const effectiveEquipment = [...(globalConfig.equipmentInventory || [])];
        if (overrides.equipmentInventory) {
            overrides.equipmentInventory.forEach(overrideItem => {
                const index = effectiveEquipment.findIndex(item => item.id === overrideItem.id);
                if (index !== -1) {
                    effectiveEquipment[index] = overrideItem;
                } else {
                    effectiveEquipment.push(overrideItem);
                }
            });
        }
        return {
            ...globalConfig,
            ...overrides,
            equipmentInventory: effectiveEquipment,
        };
    }, [globalConfig, overrides]);

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
            const globalValue = globalConfig[key] ?? false;
            if (globalValue === value) {
                // If the new value is the same as global, remove the override
                delete newOverrides[key];
            } else {
                // Otherwise, set the override
                newOverrides[key] = value;
            }
            return newOverrides;
        });
    };

    const handleConfigChange = <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => {
        setOverrides(prev => ({ ...prev, [key]: value }));
    };

    const resetFieldToGlobal = <K extends keyof StudioConfig>(key: K) => {
        setOverrides(prev => {
            const newOverrides = { ...prev };
            delete newOverrides[key];
            return newOverrides;
        });
    };

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
        const currentValue = effectiveConfig[key] ?? false;

        return (
             <div className="flex items-center justify-between p-2 -ml-2 rounded-lg hover:bg-gray-700/50">
                 <ToggleSwitch 
                    label={label}
                    checked={currentValue}
                    onChange={(checked) => handleToggleChange(key, checked)}
                />
                <div className="w-28 text-right">
                {isOverridden ? (
                    <button onClick={() => handleToggleChange(key, globalConfig[key] ?? false)} className="text-xs text-yellow-400 hover:underline">Återställ</button>
                ) : (
                    <span className="text-xs text-gray-500">Ärvd</span>
                )}
                </div>
            </div>
        )
    };
    
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
                <h3 className="text-xl font-bold text-primary border-b border-gray-700 pb-3 mb-4">Incheckningsbild (QR-kod)</h3>
                <ToggleSwitch
                    label="Visa incheckningsbild"
                    checked={overrides.checkInImageEnabled ?? false}
                    onChange={(checked) => handleConfigChange('checkInImageEnabled', checked)}
                />

                {overrides.checkInImageEnabled && (
                    <div className="pt-4 animate-fade-in">
                        <ImageUploader
                            label="Ladda upp QR-kod"
                            imageUrl={overrides.checkInImageUrl || null}
                            onImageChange={(url) => handleConfigChange('checkInImageUrl', url)}
                            isSaving={isSaving}
                        />
                        <p className="text-xs text-gray-500 mt-2">Denna bild sparas specifikt för denna studio.</p>
                    </div>
                )}
            </div>

            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                    <h3 className="text-xl font-bold text-primary">Anpassade Passkategorier & AI-Prompts</h3>
                    {overrides.customCategories !== undefined ? (
                        <button onClick={() => resetFieldToGlobal('customCategories')} className="text-xs text-yellow-400 hover:underline">Återställ till global</button>
                    ) : (
                        <span className="text-xs text-gray-500">Ärvd</span>
                    )}
                </div>
                 <CategoryPromptManager
                    categories={effectiveConfig.customCategories}
                    onCategoriesChange={(cats) => handleConfigChange('customCategories', cats)}
                    isSaving={isSaving}
                 />
            </div>

             <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                    <h3 className="text-xl font-bold text-primary">Studiounik Utrustning</h3>
                    {overrides.equipmentInventory !== undefined ? (
                        <button onClick={() => resetFieldToGlobal('equipmentInventory')} className="text-xs text-yellow-400 hover:underline">Återställ till global</button>
                    ) : (
                        <span className="text-xs text-gray-500">Ärvd</span>
                    )}
                </div>
                 <StudioEquipmentManager
                    globalEquipment={globalConfig.equipmentInventory || []}
                    studioOverrides={overrides.equipmentInventory || []}
                    onOverridesChange={(equip) => handleConfigChange('equipmentInventory', equip)}
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
    const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
    const [editingState, setEditingState] = useState<Record<string, string>>({}); // { catId: 'edited name' }

    const togglePrompt = (id: string) => {
        setExpandedPrompts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Edit state handlers
    const handleStartEditing = (cat: CustomCategoryWithPrompt) => {
        setEditingState(prev => ({ ...prev, [cat.id]: cat.name }));
    };

    const handleCancelEditing = (id: string) => {
        setEditingState(prev => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
        });
    };

    const handleEditingChange = (id: string, value: string) => {
        setEditingState(prev => ({ ...prev, [id]: value }));
    };

    const handleUpdateCategory = (id: string, field: 'name' | 'prompt', value: string) => {
        const newCategories = categories.map(cat =>
            cat.id === id ? { ...cat, [field]: value } : cat
        );
        onCategoriesChange(newCategories);
    };
    
    const handleSaveName = (id: string) => {
        const newName = editingState[id];
        if (newName === undefined || newName.trim() === '') {
            alert("Kategorinamnet kan inte vara tomt.");
            return;
        }
        handleUpdateCategory(id, 'name', newName);
        handleCancelEditing(id); // Exit editing mode
    };

    const handleAddCategory = () => {
        const newCategory: CustomCategoryWithPrompt = {
            id: `cat-${Date.now()}`,
            name: 'Ny Passkategori',
            prompt: 'Skriv AI-prompten för denna kategori här.',
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
            <p className="text-sm text-gray-400">
                Dessa passkategorier visas som knappar på hemskärmen och i AI-passbyggaren. Varje kategori måste ha en AI-prompt.
            </p>
            {categories.map(cat => {
                const isExpanded = !!expandedPrompts[cat.id];
                const isEditing = editingState.hasOwnProperty(cat.id);
                return (
                    <div key={cat.id} className="bg-black/50 p-4 rounded-lg border border-gray-600">
                        <div className="flex justify-between items-center gap-4">
                            <div className="flex-grow">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingState[cat.id]}
                                        onChange={(e) => handleEditingChange(cat.id, e.target.value)}
                                        placeholder="Namn på Passkategori"
                                        className="w-full bg-gray-900 text-white p-2 rounded-md border border-gray-500 ring-2 ring-primary focus:outline-none transition font-semibold"
                                        disabled={isSaving}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName(cat.id)}
                                    />
                                ) : (
                                    <p className="p-2 font-semibold text-white">{cat.name}</p>
                                )}
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-3">
                                {isEditing ? (
                                    <>
                                        <button onClick={() => handleSaveName(cat.id)} className="text-sm text-primary hover:text-green-400 transition-colors whitespace-nowrap font-semibold">Spara</button>
                                        <button onClick={() => handleCancelEditing(cat.id)} className="text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap">Avbryt</button>
                                    </>
                                ) : (
                                    <button onClick={() => handleStartEditing(cat)} className="text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap">Redigera</button>
                                )}
                                <button onClick={() => togglePrompt(cat.id)} className="text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap">
                                    {isExpanded ? 'Dölj prompt' : 'Visa prompt'}
                                </button>
                                <button onClick={() => handleRemoveCategory(cat.id)} className="text-red-500 hover:text-red-400 font-semibold text-sm">
                                    Ta bort
                                </button>
                            </div>
                        </div>
                        {isExpanded && (
                            <textarea
                                value={cat.prompt}
                                onChange={(e) => handleUpdateCategory(cat.id, 'prompt', e.target.value)}
                                placeholder="AI-instruktioner för denna passkategori..."
                                className="w-full h-32 bg-gray-900 text-white p-2 rounded-md border border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-sm mt-3 animate-fade-in"
                                disabled={isSaving}
                            />
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

// --- Sub-component for managing studio-specific equipment ---
interface StudioEquipmentManagerProps {
    globalEquipment: EquipmentItem[];
    studioOverrides: EquipmentItem[];
    onOverridesChange: (overrides: EquipmentItem[]) => void;
    isSaving: boolean;
}
const StudioEquipmentManager: React.FC<StudioEquipmentManagerProps> = ({ globalEquipment, studioOverrides, onOverridesChange, isSaving }) => {

    const effectiveEquipment = useMemo(() => {
        const combined = [...globalEquipment];
        studioOverrides.forEach(override => {
            const index = combined.findIndex(item => item.id === override.id);
            if (index > -1) {
                combined[index] = override; // Replace with override
            } else {
                combined.push(override); // Add new studio-specific item
            }
        });
        return combined;
    }, [globalEquipment, studioOverrides]);

    const handleUpdateOverride = (id: string, name: string, quantity: number) => {
        const existingOverride = studioOverrides.find(item => item.id === id);
        const globalItem = globalEquipment.find(item => item.id === id);

        // If the change results in the item being identical to the global one, remove the override
        if (globalItem && globalItem.name === name && globalItem.quantity === quantity) {
            onOverridesChange(studioOverrides.filter(item => item.id !== id));
            return;
        }

        if (existingOverride) {
            onOverridesChange(studioOverrides.map(item => item.id === id ? { ...item, name, quantity } : item));
        } else {
            onOverridesChange([...studioOverrides, { id, name, quantity }]);
        }
    };
    
    const handleResetToGlobal = (id: string) => {
        onOverridesChange(studioOverrides.filter(item => item.id !== id));
    };

    const handleAddStudioSpecific = () => {
        const newItem: EquipmentItem = {
            id: `equip_studio_${Date.now()}`,
            name: 'Nytt Redskap',
            quantity: 1,
        };
        onOverridesChange([...studioOverrides, newItem]);
    };
    
    const handleRemoveStudioSpecific = (id: string) => {
        onOverridesChange(studioOverrides.filter(item => item.id !== id));
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-400">
                Här är den effektiva utrustningslistan för denna studio. Du kan anpassa antal, eller lägga till redskap som bara finns här.
            </p>
            {effectiveEquipment.map(item => {
                const isOverridden = studioOverrides.some(ov => ov.id === item.id);
                const isStudioSpecific = !globalEquipment.some(ge => ge.id === item.id);

                return (
                    <div key={item.id} className={`bg-black/50 p-4 rounded-lg border space-y-2 ${isOverridden ? 'border-yellow-500/50' : 'border-gray-600'}`}>
                        <div className="flex justify-between items-center gap-4">
                            <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateOverride(item.id, e.target.value, item.quantity)}
                                placeholder="Namn på redskap"
                                className="w-full bg-gray-900 text-white p-2 rounded-md border border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition font-semibold"
                                disabled={isSaving}
                            />
                            <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleUpdateOverride(item.id, item.name, parseInt(e.target.value, 10) || 0)}
                                className="w-24 bg-gray-900 text-white p-2 rounded-md border border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-center"
                                disabled={isSaving}
                                min="0"
                            />
                        </div>
                        <div className="flex justify-end items-center h-5">
                            {isStudioSpecific ? (
                                <button onClick={() => handleRemoveStudioSpecific(item.id)} className="text-xs text-red-400 hover:underline">Ta bort studiospecifikt</button>
                            ) : isOverridden ? (
                                <button onClick={() => handleResetToGlobal(item.id)} className="text-xs text-yellow-400 hover:underline">Återställ till global</button>
                            ) : (
                                <span className="text-xs text-gray-500">Ärvd</span>
                            )}
                        </div>
                    </div>
                );
            })}
            <button onClick={handleAddStudioSpecific} disabled={isSaving} className="w-full mt-4 bg-primary/20 hover:bg-primary/40 text-primary font-bold py-2 px-4 rounded-lg transition-colors border-2 border-dashed border-primary/50">
                Lägg till studiospecifikt redskap
            </button>
        </div>
    );
};