

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StudioConfig, CustomCategoryWithPrompt, EquipmentItem, Studio, Organization } from '../types';
import { ToggleSwitch } from './icons';

// Define a type for keys that have boolean values in StudioConfig
type BooleanStudioConfigKeys = 'enableBoost' | 'enableWarmup' | 'enableBreathingGuide' | 'checkInImageEnabled' | 'enableNotes' | 'enableScreensaver';
type ConfigTab = 'modules' | 'categories' | 'equipment' | 'checkin';


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
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">{label}</label>
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
            isDragging ? 'border-primary bg-primary/20' : 'border-gray-400 dark:border-gray-600 hover:border-primary hover:bg-slate-100 dark:hover:bg-gray-700/50'
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
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <p className="font-semibold mt-1 text-sm">Dra och släpp en bild</p>
            <p className="text-xs">eller klicka för att välja fil</p>
          </div>
        </div>
      )}
    </div>
  );
};


interface StudioConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    studio: Studio;
    organization: Organization;
    onSave: (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>) => Promise<void>;
}

export const StudioConfigModal: React.FC<StudioConfigModalProps> = ({ isOpen, onClose, studio, organization, onSave }) => {
    const [overrides, setOverrides] = useState<Partial<StudioConfig>>(studio.configOverrides || {});
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<ConfigTab>('modules');
    const globalConfig = organization.globalConfig;

    useEffect(() => {
        if (studio) {
            setOverrides(studio.configOverrides || {});
            setActiveTab('modules');
        }
    }, [studio]);
    
    if (!isOpen) return null;

    const effectiveConfig = { ...globalConfig, ...overrides };

    const handleToggleChange = (key: BooleanStudioConfigKeys, value: boolean) => {
        setOverrides(prev => {
            const newOverrides = { ...prev };
            const globalValue = globalConfig[key] ?? false;
            if (globalValue === value) {
                delete newOverrides[key];
            } else {
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
        setIsSaving(true);
        try {
            await onSave(organization.id, studio.id, overrides);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const isDirty = JSON.stringify(overrides) !== JSON.stringify(studio.configOverrides || {});

    const renderToggle = (key: BooleanStudioConfigKeys, label: string) => {
        const isOverridden = overrides[key] !== undefined;
        const currentValue = effectiveConfig[key] ?? false;

        return (
             <div className="flex items-center justify-between p-2 -ml-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-gray-700/50">
                 <ToggleSwitch 
                    label={label}
                    checked={currentValue}
                    onChange={(checked) => handleToggleChange(key, checked)}
                />
                <div className="w-36 text-right space-x-2">
                {isOverridden ? (
                    <>
                        <span className="text-xs text-yellow-500 font-semibold">Åsidosätter global</span>
                        <button onClick={() => handleToggleChange(key, globalConfig[key] ?? false)} className="text-xs text-yellow-400 hover:underline">Återställ</button>
                    </>
                ) : (
                    <span className="text-xs text-gray-500">Ärvd från global</span>
                )}
                </div>
            </div>
        )
    };
    
    const TabButton: React.FC<{tab: ConfigTab, label: string}> = ({tab, label}) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                activeTab === tab 
                ? 'bg-primary text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
        >
            {label}
        </button>
    );
    
    const renderContent = () => {
        switch (activeTab) {
            case 'modules':
                return (
                    <div className="space-y-2 animate-fade-in">
                        {renderToggle('enableBoost', "Aktivera 'Dagens Boost'")}
                        {renderToggle('enableWarmup', "Aktivera 'Uppvärmning'")}
                        {renderToggle('enableBreathingGuide', "Aktivera 'Andningsguide'")}
                        {renderToggle('enableNotes', "Aktivera 'Idé-tavlan'")}
                        {renderToggle('enableScreensaver', "Aktivera Skärmsläckare")}
                    </div>
                );
            case 'checkin':
                return (
                     <div className="space-y-4 animate-fade-in">
                        <ToggleSwitch
                            label="Visa incheckningsbild (QR-kod)"
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
                );
             case 'categories':
                return (
                     <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg">Anpassade Passkategorier & AI-Prompts</h4>
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
                );
            case 'equipment':
                return (
                    <div className="space-y-4 animate-fade-in">
                         <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg">Studiounik Utrustning</h4>
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
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className="bg-slate-100 dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-3xl text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex-shrink-0">
                    <h2 className="text-2xl font-bold mb-1">Anpassa <span className="text-primary">{studio.name}</span></h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                        Ändringar här åsidosätter de globala inställningarna för organisationen.
                    </p>
                    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                        <div className="flex items-center gap-2">
                           <TabButton tab="modules" label="Moduler" />
                           <TabButton tab="categories" label="Passkategorier" />
                           <TabButton tab="equipment" label="Utrustning" />
                           <TabButton tab="checkin" label="Incheckning" />
                        </div>
                    </div>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2">
                    {renderContent()}
                </div>

                <div className="pt-6 flex justify-end gap-4 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 mt-6">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-3 px-6 rounded-lg transition-colors">Avbryt</button>
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
    const [editingState, setEditingState] = useState<Record<string, string>>({});

    const togglePrompt = (id: string) => {
        setExpandedPrompts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleStartEditing = (cat: CustomCategoryWithPrompt) => setEditingState(prev => ({ ...prev, [cat.id]: cat.name }));
    const handleCancelEditing = (id: string) => setEditingState(prev => { const n = {...prev}; delete n[id]; return n; });
    const handleEditingChange = (id: string, value: string) => setEditingState(prev => ({ ...prev, [id]: value }));

    const handleUpdateCategory = (id: string, field: 'name' | 'prompt', value: string) => {
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
                return (
                    <div key={cat.id} className="bg-slate-200/50 dark:bg-black/50 p-4 rounded-lg border border-slate-300 dark:border-gray-600">
                        <div className="flex justify-between items-center gap-4">
                            <div className="flex-grow">
                                {isEditing ? (
                                    <input type="text" value={editingState[cat.id]} onChange={(e) => handleEditingChange(cat.id, e.target.value)} className="w-full bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 ring-2 ring-primary focus:outline-none transition font-semibold" disabled={isSaving} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveName(cat.id)} />
                                ) : (
                                    <p className="p-2 font-semibold text-gray-900 dark:text-white">{cat.name}</p>
                                )}
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Anpassa antal, eller lägg till redskap som bara finns i denna studio.
            </p>
            {effectiveEquipment.map(item => {
                const isOverridden = studioOverrides.some(ov => ov.id === item.id);
                const isStudioSpecific = !globalEquipment.some(ge => ge.id === item.id);

                return (
                    <div key={item.id} className={`bg-slate-200/50 dark:bg-black/50 p-4 rounded-lg border space-y-2 ${isOverridden ? 'border-yellow-500/50' : 'border-slate-300 dark:border-gray-600'}`}>
                        <div className="flex justify-between items-center gap-4">
                            <input type="text" value={item.name} onChange={(e) => handleUpdateOverride(item.id, e.target.value, item.quantity)} placeholder="Namn på redskap" className="w-full bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition font-semibold" disabled={isSaving} />
                            <input type="number" value={item.quantity} onChange={(e) => handleUpdateOverride(item.id, item.name, parseInt(e.target.value, 10) || 0)} className="w-24 bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-center" disabled={isSaving} min="0" />
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