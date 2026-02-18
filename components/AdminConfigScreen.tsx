
import React, { useState, useEffect, useRef } from 'react';
import { StudioConfig, Studio, Organization, ThemeOption } from '../types';
import { ToggleSwitch, CloseIcon, SaveIcon, InformationCircleIcon } from './icons';
import { uploadImage, deleteImageByUrl, getSmartScreenPricing } from '../services/firebaseService';
import { resizeImage } from '../utils/imageUtils';
import { CategoryPromptManager } from './CategoryPromptManager';
import { Toast } from './ui/Notification';

// Define a type for keys that have boolean values in StudioConfig
type BooleanStudioConfigKeys = 'checkInImageEnabled' | 'enableNotes' | 'enableScreensaver' | 'enableExerciseBank' | 'enableHyrox' | 'enableWorkoutLogging';
type ConfigTab = 'modules' | 'categories' | 'checkin';

// ... (ImageUploader component remains unchanged) ...
// --- Sub-component for uploading images ---
const ImageUploader: React.FC<{
  label: string;
  imageUrl: string | null;
  onImageChange: (url: string) => void;
  isSaving: boolean;
  organizationId: string;
  studioId: string;
}> = ({ label, imageUrl, onImageChange, isSaving, organizationId, studioId }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
        setIsUploading(true);
        try {
            const resizedBase64 = await resizeImage(file, 1024, 1024, 0.95);
            const path = `organizations/${organizationId}/studios/${studioId}/check-in-qr.jpg`;
            const downloadURL = await uploadImage(path, resizedBase64);
            onImageChange(downloadURL);
        } catch (error) {
            console.error("Image upload failed:", error);
            alert("Bilden kunde inte laddas upp. Försök med en annan bild.");
        } finally {
            setIsUploading(false);
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
              disabled={isSaving || isUploading}
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
          {isUploading && <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div></div>}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
            accept="image/*"
            className="hidden"
            disabled={isSaving || isUploading}
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
    // Merge global config with studio overrides
    const initialConfig = { ...organization.globalConfig, ...studio.configOverrides };
    
    const [overrides, setOverrides] = useState<Partial<StudioConfig>>(studio.configOverrides || {});
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<ConfigTab>('modules');
    
    // Toast state
    const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

    // Profit Calculator State
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [baseCost, setBaseCost] = useState(19);
    const [customerPrice, setCustomerPrice] = useState(49);

    const globalConfig = organization.globalConfig;

    useEffect(() => {
        if (isOpen) {
            setOverrides(studio.configOverrides || {});
            setActiveTab('modules');
        }
    }, [isOpen, studio]);

    useEffect(() => {
        if (showPricingModal) {
            getSmartScreenPricing().then(pricing => {
                if (pricing && pricing.workoutLoggingPricePerMember !== undefined) {
                    setBaseCost(pricing.workoutLoggingPricePerMember);
                }
            });
        }
    }, [showPricingModal]);

    if (!isOpen) return null;

    const effectiveConfig = { ...globalConfig, ...overrides };

    const handleToggleChange = (key: BooleanStudioConfigKeys, value: boolean) => {
        // Special logic for activating logging -> Show Pricing Modal first
        if (key === 'enableWorkoutLogging' && value === true) {
            setShowPricingModal(true);
            return;
        }

        setOverrides(prev => {
            const newOverrides = { ...prev };
            const globalValue = globalConfig[key] ?? false;
            
            // If checking matches global, remove override. Else set override.
            if (globalValue === value) {
                delete newOverrides[key];
            } else {
                newOverrides[key] = value;
            }
            return newOverrides;
        });
    };

    const handleConfigChange = <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => {
        if (key === 'checkInImageUrl') {
            const oldUrl = overrides.checkInImageUrl ?? effectiveConfig.checkInImageUrl;
            if (oldUrl && value !== oldUrl) {
                deleteImageByUrl(oldUrl);
            }
        }
        setOverrides(prev => ({ ...prev, [key]: value }));
    };
    
    // ... (handleAiConfigChange and resetFieldToGlobal) ...
    const handleAiConfigChange = (field: 'instructions' | 'tone', value: string) => {
        setOverrides(prev => ({
            ...prev,
            aiSettings: {
                ...(prev.aiSettings || effectiveConfig.aiSettings || {}),
                [field]: value
            }
        }));
    };

    const resetFieldToGlobal = <K extends keyof StudioConfig>(key: K) => {
        setOverrides(prev => {
            const newOverrides = { ...prev };
            delete newOverrides[key];
            return newOverrides;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(organization.id, studio.id, overrides);
        setIsSaving(false);
        onClose();
    };
    
    const isDirty = JSON.stringify(overrides) !== JSON.stringify(studio.configOverrides || {});

    const renderToggle = (key: BooleanStudioConfigKeys, label: string, description: string, onInfoClick?: () => void) => {
        const isOverridden = overrides[key] !== undefined;
        const currentValue = effectiveConfig[key] ?? false;

        return (
             <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800/50 transition-colors">
                 <div className="flex-grow flex items-center relative pr-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <ToggleSwitch 
                                label={label}
                                checked={currentValue}
                                onChange={(checked) => handleToggleChange(key, checked)}
                            />
                            {onInfoClick && (
                                <button 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInfoClick(); }}
                                    className="text-gray-400 hover:text-blue-500 transition-colors"
                                    title="Läs mer"
                                >
                                    <InformationCircleIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-14">{description}</p>
                    </div>
                 </div>
                <div className="w-32 text-right space-x-2 shrink-0">
                {isOverridden ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-yellow-600 dark:text-yellow-500 font-semibold uppercase tracking-wide">Avviker från global</span>
                        <button onClick={() => handleToggleChange(key, globalConfig[key] ?? false)} className="text-xs text-primary hover:underline">Återställ</button>
                    </div>
                ) : (
                    <span className="text-xs text-gray-400 italic">Ärvd från global</span>
                )}
                </div>
            </div>
        )
    };
    
    const TabButton: React.FC<{tab: ConfigTab, label: string}> = ({tab, label}) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab 
                ? 'border-primary text-primary' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
            {label}
        </button>
    );
    
    const renderContent = () => {
        switch (activeTab) {
            case 'modules':
                return (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 px-2">Funktioner</h3>
                        {renderToggle('enableWorkoutLogging', "Aktivera Passloggning", "Låt medlemmar logga sina resultat via QR-kod.", () => setShowPricingModal(true))}
                        
                        {effectiveConfig.enableWorkoutLogging && (
                            <div className="ml-14 mr-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4 border-primary animate-fade-in">
                                <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3">🤖 AI-Coach Inställningar</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tonläge</label>
                                        <select 
                                            value={effectiveConfig.aiSettings?.tone || 'neutral'}
                                            onChange={(e) => handleAiConfigChange('tone', e.target.value)}
                                            className="w-full p-2 text-sm rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none"
                                        >
                                            <option value="neutral">Neutral & Professionell</option>
                                            <option value="enthusiastic">Peppande & Entusiastisk</option>
                                            <option value="strict">Sträng & Militärisk</option>
                                            <option value="sales">Säljande & Serviceinriktad</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Systeminstruktioner</label>
                                        <textarea 
                                            rows={3}
                                            value={effectiveConfig.aiSettings?.instructions || ''}
                                            onChange={(e) => handleAiConfigChange('instructions', e.target.value)}
                                            placeholder="T.ex: Påminn alltid om att boka PT om resultaten planar ut..."
                                            className="w-full p-2 text-sm rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {renderToggle('enableNotes', "Aktivera 'Idé-tavlan'", "Whiteboard för coacher.")}
                        {renderToggle('enableExerciseBank', "Aktivera Övningsbank", "Tillgång till globala övningar.")}
                        {renderToggle('enableHyrox', "Aktivera HYROX-modul", "Tävlingsläge och tidtagning.")}
                    </div>
                );

            case 'categories':
                const isOverriddenCat = overrides.customCategories !== undefined;
                return (
                      <div className="space-y-4 animate-fade-in px-2">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold">Anpassade Passkategorier</h4>
                            {isOverriddenCat ? (
                                <button onClick={() => resetFieldToGlobal('customCategories')} className="text-xs text-yellow-500 hover:underline">Återställ till global</button>
                            ) : (
                                <span className="text-xs text-gray-500">Ärvd från global</span>
                            )}
                        </div>
                        <CategoryPromptManager
                            categories={effectiveConfig.customCategories}
                            onCategoriesChange={(newCats) => handleConfigChange('customCategories', newCats)}
                            isSaving={isSaving}
                        />
                    </div>
                );

            case 'checkin':
                return (
                    <div className="space-y-6 animate-fade-in px-2">
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Tema</h3>
                            <select 
                                value={overrides.seasonalTheme ?? effectiveConfig.seasonalTheme ?? 'auto'}
                                onChange={(e) => setOverrides({ ...overrides, seasonalTheme: e.target.value as ThemeOption })}
                                className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="auto">Automatiskt (Datumstyrt)</option>
                                <option value="none">Inget tema</option>
                                <option value="winter">Vinter</option>
                                <option value="christmas">Jul</option>
                                <option value="newyear">Nyår</option>
                                <option value="summer">Sommar</option>
                                <option value="halloween">Halloween</option>
                            </select>
                        </div>

                         <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                             <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Navigering (Knappar)</h3>
                             <p className="text-xs text-gray-500 mb-2">Anpassa var knapparna för "Tillbaka" och "Stäng" ska visas. Bra om skärmen sitter högt upp.</p>
                             <select 
                                value={overrides.navigationControlPosition ?? effectiveConfig.navigationControlPosition ?? 'top'}
                                onChange={(e) => setOverrides({ ...overrides, navigationControlPosition: e.target.value as 'top' | 'bottom' })}
                                className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="top">Överkant (Standard)</option>
                                <option value="bottom">Nederkant (För höga skärmar)</option>
                            </select>
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                            {renderToggle('enableScreensaver', "Skärmsläckare", "Visa logotyp vid inaktivitet.")}
                            
                            {effectiveConfig.enableScreensaver && (
                                <div className="mt-4 ml-14 flex items-center gap-4 animate-fade-in">
                                    <label className="text-sm text-gray-700 dark:text-gray-300">
                                        Tid innan start (minuter):
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="60"
                                        value={overrides.screensaverTimeoutMinutes ?? effectiveConfig.screensaverTimeoutMinutes ?? 15}
                                        onChange={(e) => setOverrides({ ...overrides, screensaverTimeoutMinutes: parseInt(e.target.value) })}
                                        className="w-20 p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-center font-bold"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                            {renderToggle('checkInImageEnabled', "Visa incheckningsbild", "QR-kod för incheckning.")}

                            {(overrides.checkInImageEnabled ?? effectiveConfig.checkInImageEnabled) && (
                                <div className="mt-4 ml-14 animate-fade-in">
                                    <ImageUploader
                                        label="Ladda upp QR-kod"
                                        imageUrl={overrides.checkInImageUrl ?? effectiveConfig.checkInImageUrl ?? null}
                                        onImageChange={(url) => handleConfigChange('checkInImageUrl', url)}
                                        isSaving={isSaving}
                                        organizationId={organization.id}
                                        studioId={studio.id}
                                    />
                                    <p className="text-xs text-gray-500 mt-2">Denna bild sparas specifikt för denna studio.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
        <Toast isVisible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[1001] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl text-gray-900 dark:text-white shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Inställningar</h2>
                        <p className="text-primary font-medium">{studio.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <CloseIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>
                {/* Tabs */}
                <div className="px-6 pt-2 flex gap-4 border-b border-gray-200 dark:border-gray-800">
                    <TabButton tab="modules" label="Moduler & Funktioner" />
                    <TabButton tab="checkin" label="Tema & Skärm" />
                    <TabButton tab="categories" label="Kategorier" />
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {renderContent()}
                </div>
                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors">
                        Avbryt
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={!isDirty || isSaving} 
                        className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? 'Sparar...' : <><SaveIcon className="w-5 h-5" /> Spara ändringar</>}
                    </button>
                </div>
            </div>
        </div>
        {/* Pricing Modal */}
        {showPricingModal && (
             <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1002] p-4 animate-fade-in" onClick={() => setShowPricingModal(false)}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* ... Pricing modal content ... */}
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-center">
                        <h3 className="text-2xl font-black mb-1">Aktivera Passloggning 🚀</h3>
                        <p className="text-blue-100 text-sm">Ge dina medlemmar en modern träningsupplevelse</p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm space-y-2 text-gray-700 dark:text-gray-300">
                            <p>✅ <strong>För medlemmar:</strong> Logga resultat, se progression och få AI-feedback.</p>
                            <p>✅ <strong>För gymmet:</strong> Ökad retention, data och automatisk merförsäljning.</p>
                        </div>
                         {/* ... costs ... */}
                         <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                                <span className="font-medium">Licenskostnad</span>
                                <span className="font-bold">{baseCost} kr / mån</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border-2 border-primary/20 bg-white dark:bg-gray-800">
                                <label htmlFor="price" className="font-bold text-primary">Ditt pris till kund</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        id="price"
                                        type="number" 
                                        value={customerPrice} 
                                        onChange={e => setCustomerPrice(Number(e.target.value))}
                                        className="w-20 text-right font-bold bg-transparent border-b border-gray-300 focus:border-primary outline-none"
                                    />
                                    <span>kr/mån</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-xl text-center">
                            <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Din potentiella vinst</p>
                            <p className="text-3xl font-black text-green-600 dark:text-green-400">
                                {Math.max(0, customerPrice - baseCost) * 100 * 12} kr <span className="text-base font-medium opacity-70">/ år</span>
                            </p>
                            <p className="text-xs text-green-700/70 dark:text-green-400/70 mt-1">(vid 100 medlemmar)</p>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex gap-3">
                        <button onClick={() => setShowPricingModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Avbryt</button>
                        <button 
                            onClick={async () => {
                                const newOverrides = { ...overrides, enableWorkoutLogging: true };
                                setOverrides(newOverrides);
                                try {
                                    await onSave(organization.id, studio.id, newOverrides);
                                    setToast({ message: "Passloggning aktiverad!", visible: true });
                                } catch(e) { console.error(e); }
                                setShowPricingModal(false);
                            }} 
                            className="flex-[2] py-3 bg-primary text-white font-bold rounded-lg shadow-lg hover:brightness-110"
                        >
                            Godkänn & Aktivera
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
