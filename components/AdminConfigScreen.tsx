
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StudioConfig, Studio, Organization } from '../types';
import { ToggleSwitch } from './icons';
import { uploadImage, deleteImageByUrl } from '../services/firebaseService';
import { resizeImage } from '../utils/imageUtils';
import { CategoryPromptManager } from './CategoryPromptManager';

// Define a type for keys that have boolean values in StudioConfig
type BooleanStudioConfigKeys = 'checkInImageEnabled' | 'enableNotes' | 'enableScreensaver' | 'enableExerciseBank' | 'enableHyrox';
type ConfigTab = 'modules' | 'categories' | 'checkin';

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
        if (key === 'checkInImageUrl') {
            const oldUrl = overrides.checkInImageUrl ?? effectiveConfig.checkInImageUrl;
            if (oldUrl && value !== oldUrl) {
                deleteImageByUrl(oldUrl);
            }
        }
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
                        {renderToggle('enableHyrox', "Aktivera 'HYROX'-modul")}
                        {renderToggle('enableNotes', "Aktivera 'Idé-tavlan'")}
                        {renderToggle('enableScreensaver', "Aktivera Skärmsläckare")}
                        {renderToggle('enableExerciseBank', "Aktivera Övningsbank")}
                    </div>
                );
            case 'checkin':
                return (
                     <div className="space-y-4 animate-fade-in">
                        <ToggleSwitch
                            label="Visa incheckningsbild (QR-kod)"
                            checked={overrides.checkInImageEnabled ?? effectiveConfig.checkInImageEnabled ?? false}
                            onChange={(checked) => handleConfigChange('checkInImageEnabled', checked)}
                        />

                        {(overrides.checkInImageEnabled ?? effectiveConfig.checkInImageEnabled) && (
                            <div className="pt-4 animate-fade-in">
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
                );
            case 'categories':
                const isOverridden = overrides.customCategories !== undefined;
                return (
                     <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg">Anpassade Passkategorier & AI-Prompts</h4>
                            {isOverridden ? (
                                <button onClick={() => resetFieldToGlobal('customCategories')} className="text-xs text-yellow-400 hover:underline">Återställ till global</button>
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
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[1001] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl text-gray-900 dark:text-white shadow-2xl border border-slate-200 dark:border-gray-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0">
                    <h2 className="text-2xl font-bold mb-1">Anpassa inställningar för</h2>
                    <h3 className="text-lg text-primary mb-6 font-semibold">{studio.name}</h3>
                </div>

                <div className="flex-shrink-0 border-b border-slate-300 dark:border-gray-600 mb-6">
                    <div className="flex items-center gap-2">
                        <TabButton tab="modules" label="Moduler" />
                        <TabButton tab="categories" label="Passkategorier" />
                        <TabButton tab="checkin" label="Incheckning" />
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    {renderContent()}
                </div>

                <div className="mt-8 flex gap-4 flex-shrink-0">
                    <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                    <button onClick={handleSaveChanges} disabled={!isDirty || isSaving} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
                        {isSaving ? 'Sparar...' : 'Spara ändringar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
