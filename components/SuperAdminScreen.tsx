



import React, { useState, useEffect, useRef } from 'react';
import { StudioConfig, Studio, Organization, CustomPage, CustomCategoryWithPrompt, Page, UserData, UserRole, EquipmentItem, InfoCarousel, InfoMessage, DisplayConfig, DisplayPost } from '../types';
import { ToggleSwitch } from './icons';
import { getAdminsForOrganization, setAdminRole, getCoachesForOrganization, inviteUser } from '../services/firebaseService';

type AdminTab = 'drift' | 'info' | 'utrustning' | 'organisation' | 'admin' | 'skyltfonster';

const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.7): Promise<string> => {
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

const ImageUploaderForBanner: React.FC<{
  imageUrl: string | null;
  onImageChange: (base64Url: string) => void;
  disabled?: boolean;
}> = ({ imageUrl, onImageChange, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (disabled || !file || !file.type.startsWith('image/')) return;
    try {
        const resizedImage = await resizeImage(file, 1920, 1080, 0.8);
        onImageChange(resizedImage);
    } catch (error) {
        console.error("Image resizing failed:", error);
        alert("Bilden kunde inte förminskas. Försök med en annan bild eller en mindre bild.");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if(!disabled) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  if (imageUrl) {
    return (
      <div className="relative group">
        <img src={imageUrl} alt="Förhandsvisning" className="w-48 h-auto object-cover rounded-md" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button onClick={() => !disabled && onImageChange('')} disabled={disabled} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-full shadow-lg">
            Ta bort
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center p-4 w-full h-32 border-2 border-dashed rounded-lg transition-colors ${
        disabled ? 'cursor-not-allowed bg-gray-700/50' : 'cursor-pointer'
      } ${
        isDragging ? 'border-primary bg-primary/20' : 'border-gray-600 hover:border-primary hover:bg-gray-700/50'
      }`}
    >
      <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e.target.files?.[0] || null)} accept="image/*" className="hidden" disabled={disabled} />
      <div className="text-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        <p className="font-semibold mt-1 text-sm">Dra och släpp en bild</p>
        <p className="text-xs">eller klicka för att välja fil</p>
      </div>
    </div>
  );
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

  const handleFile = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          onImageChange(e.target.result);
        }
      };
      reader.readAsDataURL(file);
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
            isDragging ? 'border-primary bg-primary/20' : 'border-gray-400 dark:border-gray-600 hover:border-primary hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
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


interface SuperAdminScreenProps {
    organization: Organization;
    adminRole: 'superadmin' | 'admin';
    userRole: UserRole;
    theme: string;
    onPassProgramNavigation: (mode: 'create' | 'generate' | 'parse' | 'manage') => void;
    onSaveGlobalConfig: (organizationId: string, newConfig: StudioConfig) => Promise<void>;
    onEditStudioConfig: (studio: Studio) => void;
    onCreateStudio: (organizationId: string, name: string) => Promise<void>;
    onUpdateStudio: (organizationId: string, studioId: string, name: string) => Promise<void>;
    onDeleteStudio: (organizationId: string, studioId: string) => Promise<void>;
    onUpdatePasswords: (organizationId: string, passwords: Organization['passwords']) => Promise<void>;
    onUpdateLogos: (organizationId: string, logos: { light: string; dark: string }) => Promise<void>;
    onUpdatePrimaryColor: (organizationId: string, color: string) => Promise<void>;
    onUpdateOrganization: (organizationId: string, name: string, subdomain: string) => Promise<void>;
    onUpdateCustomPages: (organizationId: string, pages: CustomPage[]) => Promise<void>;
    onSwitchToStudioView: (studio: Studio) => void;
    onEditCustomPage: (page: CustomPage | null) => void;
    onDeleteCustomPage: (pageId: string) => Promise<void>;
    onUpdateInfoCarousel: (organizationId: string, infoCarousel: InfoCarousel) => Promise<void>;
    onUpdateDisplayConfig: (organizationId: string, displayConfig: Organization['displayConfig']) => Promise<void>;
}

const TabButton: React.FC<{
    tabId: AdminTab;
    activeTab: AdminTab;
    setActiveTab: (tabId: AdminTab) => void;
    children: React.ReactNode;
}> = ({ tabId, activeTab, setActiveTab, children }) => {
    const isActive = activeTab === tabId;
    return (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-3 text-lg font-semibold transition-colors focus:outline-none ${isActive
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 dark:text-gray-400 hover:text-primary'
                }`}
            role="tab"
            aria-selected={isActive}
        >
            {children}
        </button>
    );
};

const PassProgramModule: React.FC<{
    onNavigate: (mode: 'create' | 'generate' | 'parse' | 'manage') => void;
}> = ({ onNavigate }) => {
    return (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-gray-700 p-8">
            <div className="text-center">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white">Bygg ett eget pass</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-lg mx-auto">
                    Klicka nedan för att öppna passbyggaren och skapa ett helt nytt, skräddarsytt pass från grunden.
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={() => onNavigate('create')}
                        className="bg-primary hover:brightness-95 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                    >
                        Skapa nytt
                    </button>
                    <button
                        onClick={() => onNavigate('generate')}
                        className="bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                    >
                        Skapa med AI
                    </button>
                    <button
                        onClick={() => onNavigate('parse')}
                        className="bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                    >
                        Klistra in Pass
                    </button>
                    <button
                        onClick={() => onNavigate('manage')}
                        className="bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                    >
                        Hantera Pass
                    </button>
                </div>
            </div>
        </div>
    );
};

// Props for components that manage parts of the global config
interface ConfigProps {
    config: StudioConfig;
    isSavingConfig: boolean;
    isConfigDirty: boolean;
    handleUpdateConfigField: <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => void;
    handleSaveConfig: () => Promise<void>;
}

export const SuperAdminScreen: React.FC<SuperAdminScreenProps> = (props) => {
    const { organization, onSaveGlobalConfig, theme } = props;
    const [activeTab, setActiveTab] = useState<AdminTab>('drift');

    // Lifted state for the entire global config
    const [config, setConfig] = useState<StudioConfig>(organization.globalConfig);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    useEffect(() => {
        setConfig(organization.globalConfig);
    }, [organization]);

    const handleUpdateConfigField = <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => {
        setConfig(prevConfig => ({ ...prevConfig, [key]: value }));
    };

    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            await onSaveGlobalConfig(organization.id, config);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingConfig(false);
        }
    };

    const isConfigDirty = JSON.stringify(config) !== JSON.stringify(organization.globalConfig);

    const configProps: ConfigProps = {
        config,
        isSavingConfig,
        isConfigDirty,
        handleUpdateConfigField,
        handleSaveConfig
    };
    
    const displayLogoUrl = theme === 'dark' 
        ? (organization.logoUrlDark || organization.logoUrlLight)
        : (organization.logoUrlLight || organization.logoUrlDark);

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
            {/* Identity Header */}
            <div className="text-center mb-4 min-h-[64px] flex items-center justify-center">
                {displayLogoUrl ? (
                    <img src={displayLogoUrl} alt={`${organization.name} logotyp`} className="max-h-16 object-contain" />
                ) : (
                    <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">{organization.name}</h1>
                )}
            </div>

            <div className="mb-6 flex border-b border-gray-200 dark:border-gray-700" role="tablist">
                <TabButton tabId="drift" activeTab={activeTab} setActiveTab={setActiveTab}>
                    Drift & Innehåll
                </TabButton>
                <TabButton tabId="info" activeTab={activeTab} setActiveTab={setActiveTab}>
                    Info & Meddelanden
                </TabButton>
                <TabButton tabId="skyltfonster" activeTab={activeTab} setActiveTab={setActiveTab}>
                    Skyltfönster
                </TabButton>
                <TabButton tabId="utrustning" activeTab={activeTab} setActiveTab={setActiveTab}>
                    Utrustning
                </TabButton>
                <TabButton tabId="organisation" activeTab={activeTab} setActiveTab={setActiveTab}>
                    Organisation & Varumärke
                </TabButton>
                <TabButton tabId="admin" activeTab={activeTab} setActiveTab={setActiveTab}>
                    Administration
                </TabButton>
            </div>

            <div className="space-y-8">
                {activeTab === 'drift' && <DriftContent {...props} {...configProps} />}
                {activeTab === 'info' && <InfoContent {...props} />}
                {activeTab === 'skyltfonster' && <SkyltfonsterContent {...props} />}
                {activeTab === 'utrustning' && <UtrustningContent {...props} {...configProps} />}
                {activeTab === 'organisation' && <OrganisationContent {...props} />}
                {activeTab === 'admin' && <AdminContent {...props} />}
            </div>
        </div>
    );
};


// --- Content Components for each Tab ---

const DriftContent: React.FC<SuperAdminScreenProps & ConfigProps> = ({ organization, onEditStudioConfig, onCreateStudio, onUpdateStudio, onDeleteStudio, onPassProgramNavigation, onUpdateCustomPages, onSwitchToStudioView, onEditCustomPage, onDeleteCustomPage, config, isSavingConfig, isConfigDirty, handleUpdateConfigField, handleSaveConfig }) => {
    const [newStudioName, setNewStudioName] = useState('');
    const [isCreatingStudio, setIsCreatingStudio] = useState(false);
    const [editingStudioId, setEditingStudioId] = useState<string | null>(null);
    const [editingStudioName, setEditingStudioName] = useState('');
    const [isSavingStudio, setIsSavingStudio] = useState(false);

    const handleCreateStudio = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newStudioName.trim()) return;
        setIsCreatingStudio(true);
        try {
            await onCreateStudio(organization.id, newStudioName.trim());
            setNewStudioName('');
        } catch(error) {
            console.error(error);
        } finally {
            setIsCreatingStudio(false);
        }
    };

    const handleEditStudio = (studio: Studio) => {
        setEditingStudioId(studio.id);
        setEditingStudioName(studio.name);
    };

    const handleCancelEditStudio = () => {
        setEditingStudioId(null);
        setEditingStudioName('');
    };

    const handleSaveStudio = async () => {
        if (!editingStudioId || !editingStudioName.trim()) return;
        setIsSavingStudio(true);
        try {
            await onUpdateStudio(organization.id, editingStudioId, editingStudioName.trim());
            handleCancelEditStudio();
        } catch (error) {
            console.error("Error saving studio name:", error);
            alert("Kunde inte spara studionamnet.");
        } finally {
            setIsSavingStudio(false);
        }
    };

    const handleDeleteStudio = (studio: Studio) => {
        if (window.confirm(`Är du säker på att du vill ta bort studion "${studio.name}"? Detta kan inte ångras.`)) {
            onDeleteStudio(organization.id, studio.id);
        }
    };
    
    return (
        <>
             <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Egna Infosidor</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Skapa och hantera informationssidor som visas som knappar för coacher.</p>
                <div className="space-y-3">
                    {organization.customPages && organization.customPages.map(page => (
                        <div key={page.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-slate-300 dark:border-gray-700">
                            <p className="font-semibold text-gray-900 dark:text-white">{page.title}</p>
                            <div className="flex gap-2">
                                <button onClick={() => onEditCustomPage(page)} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg">Redigera</button>
                                <button onClick={() => onDeleteCustomPage(page.id)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg">Ta bort</button>
                            </div>
                        </div>
                    ))}
                     {(!organization.customPages || organization.customPages.length === 0) && <p className="text-gray-500 dark:text-gray-400 text-center py-4">Inga infosidor har skapats ännu.</p>}
                </div>
                <div className="pt-4 flex justify-start items-center">
                    <button onClick={() => onEditCustomPage(null)} className="bg-primary hover:brightness-95 text-white font-bold py-2 px-5 rounded-lg">
                        Lägg till ny sida
                    </button>
                </div>
            </div>

            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
                <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Globala Inställningar (Standard för nya studios)</h3>
                    <button onClick={handleSaveConfig} disabled={!isConfigDirty || isSavingConfig} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 shadow-lg">
                        {isSavingConfig ? 'Sparar...' : 'Spara Globala Inställningar'}
                    </button>
                </div>

                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">Valbara Moduler</h4>
                    <ToggleSwitch label="Aktivera 'Dagens Boost'" checked={config.enableBoost} onChange={(c) => handleUpdateConfigField('enableBoost', c)} />
                    <ToggleSwitch label="Aktivera 'Uppvärmning'" checked={config.enableWarmup} onChange={(c) => handleUpdateConfigField('enableWarmup', c)} />
                    <ToggleSwitch label="Aktivera 'Andningsguide'" checked={config.enableBreathingGuide} onChange={(c) => handleUpdateConfigField('enableBreathingGuide', c)} />
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-300 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">Anpassade Passkategorier & AI-Prompts</h4>
                     <CategoryPromptManager
                        categories={config.customCategories}
                        onCategoriesChange={(cats) => handleUpdateConfigField('customCategories', cats)}
                        isSaving={isSavingConfig}
                     />
                </div>
            </div>
            
            <PassProgramModule onNavigate={onPassProgramNavigation} />

            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Studios</h3>
                <div className="space-y-3">
                    {organization.studios.map(studio => {
                        if (studio.id === editingStudioId) {
                            return (
                                <div key={studio.id} className="bg-slate-200 dark:bg-gray-700 p-4 rounded-lg border border-primary flex flex-wrap justify-between items-center gap-4">
                                    <input
                                        value={editingStudioName}
                                        onChange={(e) => setEditingStudioName(e.target.value)}
                                        className="flex-grow bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveStudio()}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveStudio} disabled={isSavingStudio} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                                            {isSavingStudio ? 'Sparar...' : 'Spara'}
                                        </button>
                                        <button onClick={handleCancelEditStudio} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">Avbryt</button>
                                    </div>
                                </div>
                            )
                        }
                        
                        return (
                            <div key={studio.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex flex-wrap justify-between items-center gap-4 border border-slate-300 dark:border-gray-700">
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">{studio.name}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => onEditStudioConfig(studio)} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg">Anpassa</button>
                                    <button onClick={() => handleEditStudio(studio)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg">Redigera</button>
                                    <button onClick={() => handleDeleteStudio(studio)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg">Radera</button>
                                </div>
                            </div>
                        )
                    })}
                    {organization.studios.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">Inga studios har skapats ännu.</p>}
                </div>
                <form onSubmit={handleCreateStudio} className="pt-6 border-t border-slate-300 dark:border-gray-700 flex gap-4">
                    <input type="text" value={newStudioName} onChange={(e) => setNewStudioName(e.target.value)} placeholder="Namn på ny studio" className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition" disabled={isCreatingStudio}/>
                    <button type="submit" disabled={!newStudioName.trim() || isCreatingStudio} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-500 whitespace-nowrap">
                        {isCreatingStudio ? 'Skapar...' : 'Skapa Studio'}
                    </button>
                </form>
            </div>
            
            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Växla till Studiovy</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Testa appen ur en medlems perspektiv genom att temporärt byta till en specifik studiovy. Du kan enkelt återvända till adminläget från "För Coacher"-menyn.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {organization.studios.map(studio => (
                        <button
                            key={studio.id}
                            onClick={() => onSwitchToStudioView(studio)}
                            className="bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
                        >
                            {studio.name}
                        </button>
                    ))}
                </div>
                 {organization.studios.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">Inga studios har skapats ännu för att kunna förhandsgranska.</p>}
            </div>
        </>
    );
};

const InfoContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdateInfoCarousel }) => {
    const defaultCarousel: InfoCarousel = { isEnabled: false, messages: [] };
    const [carousel, setCarousel] = useState<InfoCarousel>(organization.infoCarousel || defaultCarousel);
    const [editingMessage, setEditingMessage] = useState<InfoMessage | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setCarousel(organization.infoCarousel || defaultCarousel);
    }, [organization.infoCarousel]);

    const updateAndPersistCarousel = async (updatedCarousel: InfoCarousel) => {
        setIsSaving(true);
        const originalCarousel = carousel;
        setCarousel(updatedCarousel); 
        try {
            await onUpdateInfoCarousel(organization.id, updatedCarousel);
        } catch (e) {
            console.error(e);
            alert(`Ett fel uppstod vid sparande: ${e instanceof Error ? e.message : 'Okänt fel'}. Ändringen har återställts.`);
            setCarousel(originalCarousel);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateNewMessage = () => {
        const newMessage: InfoMessage = {
            id: `msg-${Date.now()}`,
            internalTitle: 'Nytt meddelande',
            headline: '',
            body: '',
            layout: 'text-only',
            animation: 'fade',
            durationSeconds: 10,
            visibleInStudios: ['all'],
        };
        setEditingMessage(newMessage);
    };

    const handleSaveMessage = (messageToSave: InfoMessage) => {
        const updatedMessages = carousel.messages.find(m => m.id === messageToSave.id)
            ? carousel.messages.map(m => m.id === messageToSave.id ? messageToSave : m)
            : [...carousel.messages, messageToSave];
        
        setEditingMessage(null);
        updateAndPersistCarousel({ ...carousel, messages: updatedMessages });
    };

    const handleRemoveMessage = (idToRemove: string) => {
        if (window.confirm("Är du säker på att du vill ta bort detta meddelande?")) {
            const updatedMessages = carousel.messages.filter(m => m.id !== idToRemove);
            updateAndPersistCarousel({ ...carousel, messages: updatedMessages });
        }
    };

    const handleToggleEnabled = (enabled: boolean) => {
        updateAndPersistCarousel({ ...carousel, isEnabled: enabled });
    };

    if (editingMessage) {
        return (
            <InfoMessageEditor
                message={editingMessage}
                studios={organization.studios}
                onSave={handleSaveMessage}
                onCancel={() => setEditingMessage(null)}
                isSaving={isSaving}
            />
        );
    }

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Info & Meddelanden</h3>
                {isSaving && <span className="text-sm text-gray-400">Sparar...</span>}
            </div>
            
            <ToggleSwitch
                label="Aktivera informationskarusell på hemskärmen"
                checked={carousel.isEnabled}
                onChange={handleToggleEnabled}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 -mt-3 pl-2">
                Om denna är aktiv kommer meddelanden att visas som en banner längst ner på hemskärmen.
            </p>

            <div className="space-y-3 pt-4 border-t border-slate-300 dark:border-gray-700">
                {carousel.messages.map(msg => (
                    <div key={msg.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-slate-300 dark:border-gray-700">
                        <p className="font-semibold text-gray-900 dark:text-white">{msg.internalTitle}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingMessage(msg)} disabled={isSaving} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Redigera</button>
                            <button onClick={() => handleRemoveMessage(msg.id)} disabled={isSaving} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Ta bort</button>
                        </div>
                    </div>
                ))}
                {carousel.messages.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">Inga meddelanden har skapats ännu.</p>}
            </div>
            <div className="pt-4 flex justify-start items-center">
                <button onClick={handleCreateNewMessage} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-bold py-2 px-5 rounded-lg disabled:opacity-50">
                    Skapa nytt meddelande
                </button>
            </div>
        </div>
    );
};

interface InfoMessageEditorProps {
    message: InfoMessage;
    studios: Studio[];
    onSave: (message: InfoMessage) => void;
    onCancel: () => void;
    isSaving?: boolean;
}

const InfoMessageEditor: React.FC<InfoMessageEditorProps> = ({ message, studios, onSave, onCancel, isSaving = false }) => {
    const [localMessage, setLocalMessage] = useState<InfoMessage>(message);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setLocalMessage(prev => ({ ...prev, [name]: value }));
    };

    const handleStudioVisibilityChange = (studioId: string) => {
        setLocalMessage(prev => {
            const currentStudios = prev.visibleInStudios;

            if (studioId === 'all') {
                const isAlreadyAll = currentStudios.includes('all');
                return { ...prev, visibleInStudios: isAlreadyAll ? [] : ['all'] };
            }
            
            let newStudios = currentStudios.filter(id => id !== 'all'); // Start with a clean list of specific studios
            if (newStudios.includes(studioId)) {
                newStudios = newStudios.filter(id => id !== studioId); // Uncheck
            } else {
                newStudios.push(studioId); // Check
            }

            // If all studios are now checked, simplify to ['all']
            if (studios.length > 0 && newStudios.length === studios.length) {
                return { ...prev, visibleInStudios: ['all'] };
            }
            
            return { ...prev, visibleInStudios: newStudios };
        });
    };

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg border border-slate-200 dark:border-gray-700 animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-6">
                {message.internalTitle !== 'Nytt meddelande' ? 'Redigera meddelande' : 'Skapa nytt meddelande'}
            </h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="internalTitle" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Intern titel (visas ej)</label>
                    <input type="text" name="internalTitle" id="internalTitle" value={localMessage.internalTitle} onChange={handleInputChange} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="layout" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Layout</label>
                        <select name="layout" id="layout" value={localMessage.layout} onChange={handleInputChange} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}>
                            <option value="text-only">Endast text</option>
                            <option value="image-left">Bild till vänster</option>
                            <option value="image-right">Bild till höger</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="animation" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Animation</label>
                        <select name="animation" id="animation" value={localMessage.animation} onChange={handleInputChange} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}>
                            <option value="fade">Tona in</option>
                            <option value="slide-left">Glid in från vänster</option>
                            <option value="slide-right">Glid in från höger</option>
                        </select>
                    </div>
                </div>

                 {localMessage.layout !== 'text-only' && (
                    <div className="animate-fade-in">
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Bild</label>
                        <div className="mt-1">
                             <ImageUploaderForBanner
                                imageUrl={localMessage.imageUrl || null}
                                onImageChange={(base64) => setLocalMessage(prev => ({...prev, imageUrl: base64}))}
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                 )}

                 <div>
                    <label htmlFor="headline" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Rubrik</label>
                    <input type="text" name="headline" id="headline" value={localMessage.headline} onChange={handleInputChange} placeholder="Rubrik som visas för medlemmar" className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                </div>
                <div>
                    <label htmlFor="body" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Brödtext</label>
                    <textarea name="body" id="body" value={localMessage.body} onChange={handleInputChange} rows={3} placeholder="Brödtext som visas för medlemmar" className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                </div>
                <div>
                    <label htmlFor="durationSeconds" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Visningstid (sekunder)</label>
                    <input type="number" name="durationSeconds" id="durationSeconds" value={localMessage.durationSeconds} onChange={(e) => setLocalMessage(prev => ({...prev, durationSeconds: parseInt(e.target.value, 10) || 10}))} min="3" className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Startdatum (frivilligt)</label>
                        <input type="date" name="startDate" id="startDate" value={localMessage.startDate ? localMessage.startDate.split('T')[0] : ''} onChange={(e) => setLocalMessage(prev => ({...prev, startDate: e.target.value ? new Date(e.target.value).toISOString() : ''}))} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                    </div>
                     <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Slutdatum (frivilligt)</label>
                        <input type="date" name="endDate" id="endDate" value={localMessage.endDate ? localMessage.endDate.split('T')[0] : ''} onChange={(e) => setLocalMessage(prev => ({...prev, endDate: e.target.value ? new Date(e.target.value).toISOString() : ''}))} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Synlighet</label>
                    <div className="mt-2 space-y-2 bg-slate-200 dark:bg-black/50 p-3 rounded-md">
                        <label className="flex items-center">
                            <input type="checkbox" checked={localMessage.visibleInStudios.includes('all')} onChange={() => handleStudioVisibilityChange('all')} className="h-4 w-4 text-primary border-gray-300 rounded" disabled={isSaving}/>
                            <span className="ml-2 text-gray-900 dark:text-white">Alla studios</span>
                        </label>
                        {studios.map(studio => (
                            <label key={studio.id} className="flex items-center">
                                <input type="checkbox" checked={localMessage.visibleInStudios.includes('all') || localMessage.visibleInStudios.includes(studio.id)} onChange={() => handleStudioVisibilityChange(studio.id)} className="h-4 w-4 text-primary border-gray-300 rounded" disabled={isSaving}/>
                                <span className="ml-2 text-gray-900 dark:text-white">{studio.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
             <div className="mt-6 flex gap-4">
                <button onClick={() => onSave(localMessage)} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg disabled:opacity-50" disabled={isSaving}>
                    {isSaving ? 'Sparar...' : 'Spara meddelande'}
                </button>
                <button onClick={onCancel} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg" disabled={isSaving}>Avbryt</button>
            </div>
        </div>
    );
};

const SkyltfonsterContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdateDisplayConfig }) => {
    const defaultConfig: DisplayConfig = { isEnabled: false, posts: [] };
    const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(organization.displayConfig || defaultConfig);
    const [editingPost, setEditingPost] = useState<DisplayPost | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [postToDelete, setPostToDelete] = useState<DisplayPost | null>(null);

    useEffect(() => {
        setDisplayConfig(organization.displayConfig || defaultConfig);
    }, [organization.displayConfig]);

    const updateAndPersist = async (updatedConfig: DisplayConfig) => {
        setIsSaving(true);
        const originalConfig = displayConfig;
        setDisplayConfig(updatedConfig);
        try {
            await onUpdateDisplayConfig(organization.id, updatedConfig);
        } catch (e) {
            console.error(e);
            alert(`Ett fel uppstod vid sparande: ${e instanceof Error ? e.message : 'Okänt fel'}. Ändringen har återställts.`);
            setDisplayConfig(originalConfig);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleToggleEnabled = (enabled: boolean) => {
        updateAndPersist({ ...displayConfig, isEnabled: enabled });
    };

    const handleCreateNewPost = () => {
        const newPost: DisplayPost = {
            id: `post-${Date.now()}`,
            internalTitle: 'Nytt inlägg',
            layout: 'text-only',
            durationSeconds: 15,
            visibleInStudios: ['all'],
            startDate: new Date().toISOString(),
            endDate: '',
        };
        setEditingPost(newPost);
    };
    
    const handleSavePost = (postToSave: DisplayPost) => {
        const isExisting = (displayConfig.posts || []).some(p => p.id === postToSave.id);
        const updatedPosts = isExisting
            ? (displayConfig.posts || []).map(p => p.id === postToSave.id ? postToSave : p)
            : [...(displayConfig.posts || []), postToSave];
        
        setEditingPost(null);
        updateAndPersist({ ...displayConfig, posts: updatedPosts });
    };

    const handleRemovePost = (idToRemove: string) => {
        const post = (displayConfig.posts || []).find(p => p.id === idToRemove);
        if (post) {
            setPostToDelete(post);
        }
    };
    
    const confirmRemovePost = () => {
        if (!postToDelete) return;
        const updatedPosts = (displayConfig.posts || []).filter(p => p.id !== postToDelete.id);
        updateAndPersist({ ...displayConfig, posts: updatedPosts });
        setPostToDelete(null); // Close modal and clear state
    };


    if (editingPost) {
        return (
            <DisplayPostEditor
                post={editingPost}
                studios={organization.studios}
                onSave={handleSavePost}
                onCancel={() => setEditingPost(null)}
                isSaving={isSaving}
            />
        );
    }
    
    const posts = displayConfig.posts || [];

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Skyltfönster</h3>
                {isSaving && <span className="text-sm text-gray-400">Sparar...</span>}
            </div>
            
            <ToggleSwitch
                label="Aktivera skyltfönster"
                checked={displayConfig.isEnabled}
                onChange={handleToggleEnabled}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 -mt-3 pl-2">
                Om denna är aktiv kan en dedikerad skärm visa en loop av bilder, videor och text.
            </p>

            <div className="space-y-3 pt-4 border-t border-slate-300 dark:border-gray-700">
                {posts.map(post => (
                    <div key={post.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-slate-300 dark:border-gray-700">
                        <p className="font-semibold text-gray-900 dark:text-white">{post.internalTitle}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingPost(post)} disabled={isSaving} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Redigera</button>
                            <button onClick={() => handleRemovePost(post.id)} disabled={isSaving} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Ta bort</button>
                        </div>
                    </div>
                ))}
                {posts.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">Inga inlägg har skapats ännu.</p>}
            </div>
            <div className="pt-4 flex justify-start items-center">
                <button onClick={handleCreateNewPost} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-bold py-2 px-5 rounded-lg disabled:opacity-50">
                    Skapa nytt inlägg
                </button>
            </div>

            {postToDelete && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setPostToDelete(null)}>
                    <div className="bg-slate-100 dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-slate-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Bekräfta borttagning</h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Är du säker på att du vill ta bort inlägget "{postToDelete.internalTitle}"? Detta kan inte ångras.
                        </p>
                        <div className="flex gap-4">
                            <button onClick={() => setPostToDelete(null)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">
                                Avbryt
                            </button>
                            <button onClick={confirmRemovePost} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors">
                                Ta bort
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DisplayPostPreview: React.FC<{ post: DisplayPost }> = ({ post }) => {
    const renderContent = () => {
        // Using smaller font sizes and padding for the preview
        switch(post.layout) {
            case 'image-fullscreen':
                return (
                     <div className="w-full h-full relative text-white">
                        {post.imageUrl ? <img src={post.imageUrl} alt={post.headline || ''} className="absolute inset-0 w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">Helskärmsbild</div>}
                        <div className="absolute inset-0 bg-black/50 flex flex-col justify-end p-4">
                            {post.headline && <h1 className="text-xl font-black drop-shadow-lg line-clamp-2">{post.headline}</h1>}
                            {post.body && <p className="text-xs mt-1 max-w-full drop-shadow-md line-clamp-3">{post.body}</p>}
                        </div>
                    </div>
                );
            case 'video-fullscreen':
                 return (
                    <div className="w-full h-full relative bg-black">
                        {post.videoUrl ? (
                            <video src={post.videoUrl} className="absolute inset-0 w-full h-full object-cover" autoPlay loop muted playsInline key={post.videoUrl} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.55a1.5 1.5 0 01.45 2.12l-2.2 3.03a1.5 1.5 0 01-2.12.45L12 14.53V17a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 016 17v-3a1.5 1.5 0 011.5-1.5h1.53L12.5 9.5a1.5 1.5 0 012.12-.45l3.03 2.2a1.5 1.5 0 01.45 2.12V10z" /></svg>
                                <span className="ml-2">Videoförhandsvisning</span>
                            </div>
                        )}
                    </div>
                );
            case 'image-left':
                return (
                    <div className="w-full h-full flex items-stretch justify-center bg-gray-900 text-white gap-4 p-4">
                        <div className="w-1/2 h-full flex-shrink-0">
                            {post.imageUrl ? (
                                <img src={post.imageUrl} alt={post.headline || ''} className="w-full h-full object-cover rounded" />
                            ) : (
                                <div className="w-full h-full bg-gray-800 rounded flex items-center justify-center text-gray-600 text-sm">Ingen bild</div>
                            )}
                        </div>
                        <div className="w-1/2 flex flex-col justify-center">
                             {post.headline && <h1 className="text-xl font-black line-clamp-3">{post.headline}</h1>}
                             {post.body && <p className="text-xs mt-2 line-clamp-6">{post.body}</p>}
                        </div>
                    </div>
                );
            case 'text-only':
            default:
                return (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white text-center p-4">
                         {post.headline && <h1 className="text-2xl font-black line-clamp-3">{post.headline}</h1>}
                         {post.body && <p className="text-sm mt-2 max-w-full line-clamp-6">{post.body}</p>}
                    </div>
                );
        }
    }

    return (
        <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-600 shadow-lg">
            {renderContent()}
        </div>
    );
};

interface DisplayPostEditorProps {
    post: DisplayPost;
    studios: Studio[];
    onSave: (post: DisplayPost) => void;
    onCancel: () => void;
    isSaving?: boolean;
}

const DisplayPostEditor: React.FC<DisplayPostEditorProps> = ({ post, studios, onSave, onCancel, isSaving = false }) => {
    const [localPost, setLocalPost] = useState<DisplayPost>(post);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setLocalPost(prev => ({ ...prev, [name]: value }));
    };
    
    const handleStudioVisibilityChange = (studioId: string) => {
        setLocalPost(prev => {
            const currentStudios = prev.visibleInStudios || ['all'];

            if (studioId === 'all') {
                const isAlreadyAll = currentStudios.includes('all');
                return { ...prev, visibleInStudios: isAlreadyAll ? [] : ['all'] };
            }
            
            let newStudios = currentStudios.filter(id => id !== 'all');
            if (newStudios.includes(studioId)) {
                newStudios = newStudios.filter(id => id !== studioId);
            } else {
                newStudios.push(studioId);
            }

            if (studios.length > 0 && newStudios.length === studios.length) {
                return { ...prev, visibleInStudios: ['all'] };
            }
            
            return { ...prev, visibleInStudios: newStudios };
        });
    };

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg border border-slate-200 dark:border-gray-700 animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-6">
                Redigera inlägg
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="internalTitle" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Intern titel (visas ej)</label>
                        <input type="text" name="internalTitle" id="internalTitle" value={localPost.internalTitle} onChange={handleInputChange} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                    </div>
                    
                    <div>
                        <label htmlFor="layout" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Layout</label>
                        <select name="layout" id="layout" value={localPost.layout} onChange={handleInputChange} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}>
                            <option value="text-only">Endast text</option>
                            <option value="image-fullscreen">Helskärmsbild med text</option>
                            <option value="image-left">Bild till vänster</option>
                            <option value="video-fullscreen">Helskärmsvideo</option>
                        </select>
                    </div>

                    {(localPost.layout === 'image-fullscreen' || localPost.layout === 'image-left') && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Bild</label>
                            <ImageUploaderForBanner imageUrl={localPost.imageUrl || null} onImageChange={(base64) => setLocalPost(p => ({...p, imageUrl: base64}))} disabled={isSaving} />
                        </div>
                    )}
                    
                    {localPost.layout === 'video-fullscreen' && (
                        <div className="animate-fade-in">
                            <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Länk till video (.mp4)</label>
                            <input type="text" name="videoUrl" id="videoUrl" value={localPost.videoUrl || ''} onChange={handleInputChange} placeholder="https://.../video.mp4" className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                        </div>
                    )}
                    
                    {(localPost.layout !== 'video-fullscreen') && (
                        <>
                        <div>
                            <label htmlFor="headline" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Rubrik (frivillig)</label>
                            <input type="text" name="headline" id="headline" value={localPost.headline || ''} onChange={handleInputChange} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                        </div>
                        <div>
                            <label htmlFor="body" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Brödtext (frivillig)</label>
                            <textarea name="body" id="body" value={localPost.body || ''} onChange={handleInputChange} rows={3} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                        </div>
                        </>
                    )}
                    
                    <div>
                        <label htmlFor="durationSeconds" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Visningstid (sekunder)</label>
                        <input type="number" name="durationSeconds" id="durationSeconds" value={localPost.durationSeconds} onChange={(e) => setLocalPost(p => ({...p, durationSeconds: parseInt(e.target.value, 10) || 15}))} min="3" className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving}/>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Startdatum (frivilligt)</label>
                            <input type="date" name="startDate" id="startDate" value={localPost.startDate ? localPost.startDate.split('T')[0] : ''} onChange={(e) => setLocalPost(p => ({ ...p, startDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving} />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Slutdatum (frivilligt)</label>
                            <input type="date" name="endDate" id="endDate" value={localPost.endDate ? localPost.endDate.split('T')[0] : ''} onChange={(e) => setLocalPost(p => ({ ...p, endDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))} className="w-full mt-1 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600" disabled={isSaving} />
                        </div>
                    </div>

                     <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Synlighet</label>
                        <div className="mt-2 space-y-2 bg-slate-200 dark:bg-black/50 p-3 rounded-md">
                            <label className="flex items-center">
                                <input type="checkbox" checked={(localPost.visibleInStudios || []).includes('all')} onChange={() => handleStudioVisibilityChange('all')} className="h-4 w-4 text-primary border-gray-300 rounded" disabled={isSaving}/>
                                <span className="ml-2 text-gray-900 dark:text-white">Alla studios</span>
                            </label>
                            {studios.map(studio => (
                                <label key={studio.id} className="flex items-center">
                                    <input type="checkbox" checked={(localPost.visibleInStudios || []).includes('all') || (localPost.visibleInStudios || []).includes(studio.id)} onChange={() => handleStudioVisibilityChange(studio.id)} className="h-4 w-4 text-primary border-gray-300 rounded" disabled={isSaving}/>
                                    <span className="ml-2 text-gray-900 dark:text-white">{studio.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Förhandsgranskning</label>
                    <DisplayPostPreview post={localPost} />
                </div>
            </div>

             <div className="mt-8 flex gap-4">
                <button onClick={() => onSave(localPost)} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg disabled:opacity-50" disabled={isSaving}>
                    {isSaving ? 'Sparar...' : 'Spara inlägg'}
                </button>
                <button onClick={onCancel} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg" disabled={isSaving}>Avbryt</button>
            </div>
        </div>
    );
};


const UtrustningContent: React.FC<SuperAdminScreenProps & ConfigProps> = ({ config, isSavingConfig, isConfigDirty, handleUpdateConfigField, handleSaveConfig }) => {
    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Global Utrustningslista (Standard för alla studios)</h3>
                <button onClick={handleSaveConfig} disabled={!isConfigDirty || isSavingConfig} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 shadow-lg">
                    {isSavingConfig ? 'Sparar...' : 'Spara ändringar'}
                </button>
            </div>
            <GlobalEquipmentManager
                equipment={config.equipmentInventory || []}
                onEquipmentChange={(equip) => handleUpdateConfigField('equipmentInventory', equip)}
                isSaving={isSavingConfig}
            />
        </div>
    );
};

const OrganisationContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdateLogos, onUpdatePrimaryColor, onUpdatePasswords, userRole, onUpdateOrganization }) => {
    const [passwords, setPasswords] = useState<Organization['passwords']>(organization.passwords);
    const [isSavingPasswords, setIsSavingPasswords] = useState(false);
    const [showCoachPassword, setShowCoachPassword] = useState(false);
    
    const [name, setName] = useState(organization.name);
    const [subdomain, setSubdomain] = useState(organization.subdomain);
    const [isSavingOrgInfo, setIsSavingOrgInfo] = useState(false);

    const [logoLightPreview, setLogoLightPreview] = useState<string | null>(organization.logoUrlLight || null);
    const [logoLightFile, setLogoLightFile] = useState<File | null>(null);
    const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(organization.logoUrlDark || null);
    const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);

    const [isSavingLogos, setIsSavingLogos] = useState(false);
    const [primaryColor, setPrimaryColor] = useState(organization.primaryColor || '#14b8a6');
    const [isSavingColor, setIsSavingColor] = useState(false);
    
    const isSystemOwner = userRole === 'systemowner';

    useEffect(() => {
        setPasswords(organization.passwords);
        setLogoLightPreview(organization.logoUrlLight || null);
        setLogoDarkPreview(organization.logoUrlDark || null);
        setPrimaryColor(organization.primaryColor || '#14b8a6');
        setLogoLightFile(null);
        setLogoDarkFile(null);
        setName(organization.name);
        setSubdomain(organization.subdomain);
    }, [organization]);

    const handlePasswordChange = (level: 'coach', value: string) => {
        setPasswords(prev => ({ ...prev, [level]: value }));
    };

    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>, theme: 'light' | 'dark') => {
        const file = e.target.files?.[0];
        if (file) {
            if (theme === 'light') setLogoLightFile(file);
            if (theme === 'dark') setLogoDarkFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                if (theme === 'light') setLogoLightPreview(reader.result as string);
                if (theme === 'dark') setLogoDarkPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveLogos = async () => {
        setIsSavingLogos(true);
        try {
            await onUpdateLogos(organization.id, {
                light: logoLightPreview || '',
                dark: logoDarkPreview || ''
            });
            setLogoLightFile(null);
            setLogoDarkFile(null);
        } catch (error) {
            console.error("Failed to save logos", error);
        } finally {
            setIsSavingLogos(false);
        }
    };

    const handleSaveColor = async () => {
        setIsSavingColor(true);
        try {
            await onUpdatePrimaryColor(organization.id, primaryColor);
        } catch (error) {
            console.error("Failed to save color", error);
        } finally {
            setIsSavingColor(false);
        }
    };

    const handleSavePasswords = async () => {
        setIsSavingPasswords(true);
        try {
            await onUpdatePasswords(organization.id, passwords);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingPasswords(false);
        }
    };
    
    const handleSaveOrgInfo = async () => {
        if (!isOrgInfoDirty) return;
        setIsSavingOrgInfo(true);
        try {
            await onUpdateOrganization(organization.id, name, subdomain);
        } catch (error) {
            // Error is handled/alerted by the calling component in App.tsx
        } finally {
            setIsSavingOrgInfo(false);
        }
    };

    const isPasswordsDirty = JSON.stringify(passwords) !== JSON.stringify(organization.passwords);
    const isLogosDirty = !!logoLightFile || !!logoDarkFile;
    const isColorDirty = primaryColor !== (organization.primaryColor || '#14b8a6');
    const isOrgInfoDirty = name !== organization.name || subdomain !== organization.subdomain;

    return (
        <>
            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Organisationsinformation</h3>
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organisationsnamn</label>
                        <input
                           id="org-name"
                           type="text"
                           value={name}
                           onChange={e => setName(e.target.value)}
                           readOnly={!isSystemOwner}
                           className={`w-full p-3 rounded-md border transition-colors ${isSystemOwner ? 'bg-white dark:bg-black text-black dark:text-white border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none' : 'bg-slate-200 dark:bg-black text-gray-500 dark:text-gray-400 border-slate-300 dark:border-gray-600 cursor-not-allowed'}`}
                        />
                    </div>
                    <div>
                        <label htmlFor="org-subdomain" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subdomän</label>
                        <div className="flex items-center">
                            <input
                               id="org-subdomain"
                               type="text"
                               value={subdomain}
                               onChange={e => setSubdomain(e.target.value)}
                               readOnly={!isSystemOwner}
                               className={`w-full p-3 rounded-l-md border-y border-l transition-colors ${isSystemOwner ? 'bg-white dark:bg-black text-black dark:text-white border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none' : 'bg-slate-200 dark:bg-black text-gray-500 dark:text-gray-400 border-slate-300 dark:border-gray-600 cursor-not-allowed'}`}
                            />
                            <span className="px-3 py-3 bg-slate-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-r-md border-y border-r border-slate-300 dark:border-gray-600">.flexibel.app</span>
                        </div>
                    </div>
                </div>
                <div className="pt-4 flex justify-end">
                     {isSystemOwner ? (
                        <button onClick={handleSaveOrgInfo} disabled={!isOrgInfoDirty || isSavingOrgInfo} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                            {isSavingOrgInfo ? 'Sparar...' : 'Spara ändringar'}
                        </button>
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Endast en Systemägare kan ändra namn och subdomän.</p>
                    )}
                </div>
            </div>

            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Profilering & Varumärke</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Förhandsvisning</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-8 border border-gray-300 text-center">
                             <div className="mb-4 flex justify-center h-16 items-center">
                                {logoLightPreview ? (
                                    <img src={logoLightPreview} alt="Logotyp förhandsgranskning (ljust tema)" className="max-h-16 max-w-xs object-contain" />
                                ) : (
                                    <p className="text-gray-500 text-sm">Ingen logotyp för ljust tema</p>
                                )}
                            </div>
                            <button className="px-4 py-2 rounded-lg font-semibold" style={{backgroundColor: primaryColor, color: 'white'}}>Exempelknapp</button>
                        </div>
                        <div className="bg-black rounded-lg p-8 border border-gray-700 text-center">
                             <div className="mb-4 flex justify-center h-16 items-center">
                                {logoDarkPreview ? (
                                    <img src={logoDarkPreview} alt="Logotyp förhandsgranskning (mörkt tema)" className="max-h-16 max-w-xs object-contain" />
                                ) : (
                                    <p className="text-gray-500 text-sm">Ingen logotyp för mörkt tema</p>
                                )}
                            </div>
                            <button className="px-4 py-2 rounded-lg font-semibold" style={{backgroundColor: primaryColor, color: 'white'}}>Exempelknapp</button>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-300 dark:border-gray-700">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logotyp för Ljust Tema</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">Använd en mörk logotyp. Visas på vit bakgrund.</p>
                        <input 
                            type="file" 
                            accept="image/*,.svg"
                            onChange={(e) => handleLogoFileChange(e, 'light')} 
                            className="text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-200 dark:file:bg-gray-600 file:text-gray-800 dark:file:text-white hover:file:bg-gray-300 dark:hover:file:bg-gray-500"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logotyp för Mörkt Tema</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">Använd en ljus/vit logotyp. Visas på mörk bakgrund.</p>
                        <input 
                            type="file" 
                            accept="image/*,.svg"
                            onChange={(e) => handleLogoFileChange(e, 'dark')} 
                            className="text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-200 dark:file:bg-gray-600 file:text-gray-800 dark:file:text-white hover:file:bg-gray-300 dark:hover:file:bg-gray-500"
                        />
                    </div>
                </div>
                 <div className="flex justify-end">
                    <button 
                        onClick={handleSaveLogos} 
                        disabled={!isLogosDirty || isSavingLogos} 
                        className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                        {isSavingLogos ? 'Sparar...' : 'Spara Logotyper'}
                    </button>
                </div>

                <hr className="border-slate-300 dark:border-gray-700" />
                
                <div className="space-y-2">
                    <label htmlFor="primary-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Primärfärg</label>
                    <div className="flex items-center gap-4">
                        <input type="color" id="primary-color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-12 p-1 bg-transparent border-none rounded-lg cursor-pointer"/>
                        <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600 font-mono"/>
                        <button onClick={handleSaveColor} disabled={!isColorDirty || isSavingColor} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 ml-auto">
                                {isSavingColor ? 'Sparar...' : 'Spara Färg'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">Denna färg kommer att användas för knappar och andra primära element.</p>
                </div>
            </div>

            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Lösenordshantering</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coach-lösenord</label>
                        <div className="flex items-center">
                            <input value={passwords.coach} onChange={(e) => handlePasswordChange('coach', e.target.value)} type={showCoachPassword ? "text" : "password"} className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-l-md border-y border-l border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"/>
                            <button onClick={() => setShowCoachPassword(!showCoachPassword)} className="px-4 py-3 bg-slate-200 dark:bg-gray-700 rounded-r-md border-y border-r border-slate-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                {showCoachPassword ? 'Dölj' : 'Visa'}
                            </button>
                        </div>
                    </div>
                </div>
                 <div className="pt-4 flex justify-end">
                    <button onClick={handleSavePasswords} disabled={!isPasswordsDirty || isSavingPasswords} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                        {isSavingPasswords ? 'Sparar...' : 'Spara Lösenord'}
                    </button>
                </div>
            </div>
        </>
    );
};

const AdminContent: React.FC<SuperAdminScreenProps> = ({ organization }) => {
    const [admins, setAdmins] = useState<UserData[]>([]);
    const [coaches, setCoaches] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState<'coach' | 'admin'>('coach');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccessMessage, setInviteSuccessMessage] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [copyButtonText, setCopyButtonText] = useState('Kopiera länk');


    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [fetchedAdmins, fetchedCoaches] = await Promise.all([
                    getAdminsForOrganization(organization.id),
                    getCoachesForOrganization(organization.id)
                ]);
                setAdmins(fetchedAdmins);
                setCoaches(fetchedCoaches);
            } catch (error) {
                console.error("Failed to fetch users:", error);
                alert("Kunde inte hämta användare.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [organization.id]);
    
    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail.trim()) return;

        setIsInviting(true);
        setInviteError('');
        setInviteSuccessMessage('');
        setInviteLink('');

        try {
            const result = await inviteUser(organization.id, newUserEmail, newUserRole);
            if (result.success) {
                setInviteSuccessMessage(result.message || `Inbjudan skapad för ${newUserEmail}!`);
                if (result.link) {
                    setInviteLink(result.link);
                }
                setNewUserEmail('');
                setNewUserRole('coach');
            } else {
                setInviteError(result.message || 'Ett oväntat fel inträffade.');
            }
        } catch (error) {
            setInviteError(error instanceof Error ? error.message : 'Ett klientfel inträffade.');
        } finally {
            setIsInviting(false);
        }
    };

    const handleCopyLink = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink).then(() => {
            setCopyButtonText('Kopierad!');
            setTimeout(() => setCopyButtonText('Kopiera länk'), 2000);
        }, (err) => {
            console.error('Could not copy text: ', err);
            alert('Kunde inte kopiera länken.');
        });
    };

    const handleChangeAdminRole = async (uid: string, currentRole: 'superadmin' | 'admin') => {
        const targetRole = currentRole === 'superadmin' ? 'admin' : 'superadmin';
        if (window.confirm(`Är du säker på att du vill ändra rollen för denna administratör till ${targetRole}?`)) {
            try {
                await setAdminRole(uid, targetRole);
                setAdmins(prevAdmins => prevAdmins.map(admin => 
                    admin.uid === uid ? { ...admin, adminRole: targetRole } : admin
                ));
            } catch (error) {
                 alert(`Kunde inte ändra roll: ${error}`);
            }
        }
    };
    
    const handleRemoveUser = (email: string) => {
        alert(`Borttagningsfunktion är ej implementerad.\nSkulle tagit bort: ${email}.`);
        // This would be a destructive action, likely a cloud function call.
    };

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Hantera Användare</h3>

            {/* Admins List */}
            <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Administratörer</h4>
                {isLoading ? (
                    <p className="text-gray-500 dark:text-gray-400">Laddar administratörer...</p>
                ) : admins.length > 0 ? (
                     admins.map(admin => (
                        <div key={admin.uid} className="bg-slate-200 dark:bg-gray-900/50 p-3 rounded-lg flex flex-wrap justify-between items-center gap-4 border border-slate-300 dark:border-gray-700">
                            <div>
                               <p className="font-semibold text-gray-900 dark:text-white">{admin.email}</p>
                               <p className={`text-xs px-2 py-0.5 mt-1 rounded-full inline-block ${admin.adminRole === 'superadmin' ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                 {admin.adminRole === 'superadmin' ? 'Superadmin' : 'Admin'}
                               </p>
                            </div>
                            <div className="flex gap-2">
                               <button onClick={() => handleChangeAdminRole(admin.uid, admin.adminRole || 'admin')} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-3 text-sm rounded-lg">
                                    Ändra Roll
                               </button>
                               <button onClick={() => handleRemoveUser(admin.email)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-3 text-sm rounded-lg">
                                    Ta bort
                               </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">Inga administratörer hittades för denna organisation.</p>
                )}
            </div>
            
            {/* Coaches List */}
            <div className="space-y-3 pt-4 border-t border-slate-300 dark:border-gray-700">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Coacher</h4>
                {isLoading ? (
                    <p className="text-gray-500 dark:text-gray-400">Laddar coacher...</p>
                ) : coaches.length > 0 ? (
                     coaches.map(coach => (
                        <div key={coach.uid} className="bg-slate-200 dark:bg-gray-900/50 p-3 rounded-lg flex flex-wrap justify-between items-center gap-4 border border-slate-300 dark:border-gray-700">
                            <div>
                               <p className="font-semibold text-gray-900 dark:text-white">{coach.email}</p>
                               <p className="text-xs px-2 py-0.5 mt-1 rounded-full inline-block bg-teal-600 text-white">
                                 Coach
                               </p>
                            </div>
                            <div className="flex gap-2">
                               <button onClick={() => handleRemoveUser(coach.email)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-3 text-sm rounded-lg">
                                    Ta bort
                               </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">Inga coacher hittades för denna organisation.</p>
                )}
            </div>

            {/* Invite Form */}
            <div className="pt-6 border-t border-slate-300 dark:border-gray-700 space-y-3">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Bjud in ny användare</h4>
                 <form onSubmit={handleInviteUser} className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <input 
                            type="email"
                            value={newUserEmail}
                            onChange={e => setNewUserEmail(e.target.value)}
                            placeholder="E-postadress"
                            className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
                            required
                            disabled={isInviting}
                        />
                        <select
                            value={newUserRole}
                            onChange={e => setNewUserRole(e.target.value as 'coach' | 'admin')}
                            className="w-full sm:w-auto bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
                            disabled={isInviting}
                        >
                            <option value="coach">Coach</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                     <button type="submit" disabled={isInviting || !newUserEmail.trim()} className="w-full sm:w-auto bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50">
                        {isInviting ? 'Skickar...' : 'Skicka inbjudan'}
                    </button>
                </form>
                
                 {(inviteSuccessMessage || inviteError) && (
                    <div className="mt-4 p-4 rounded-lg border bg-slate-200/50 dark:bg-black/50 border-slate-300 dark:border-gray-600">
                        {inviteError && <p className="text-red-500 text-sm">{inviteError}</p>}
                        {inviteSuccessMessage && (
                            <div className="space-y-3">
                                <p className="text-green-600 dark:text-green-400 font-semibold">{inviteSuccessMessage}</p>
                                {inviteLink && (
                                    <div>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                                            VIKTIGT: Kopiera engångslänken nedan och skicka den manuellt till användaren (t.ex. via SMS eller Teams).
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={inviteLink}
                                                className="w-full p-2 bg-slate-200 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded-md border border-slate-300 dark:border-gray-700 font-mono text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCopyLink}
                                                className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg whitespace-nowrap"
                                            >
                                                {copyButtonText}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Dessa passkategorier visas som knappar på hemskärmen och i AI-passbyggaren. Varje kategori måste ha en AI-prompt.
            </p>
            {categories.map(cat => {
                const isExpanded = !!expandedPrompts[cat.id];
                const isEditing = editingState.hasOwnProperty(cat.id);
                return (
                    <div key={cat.id} className="bg-slate-200/50 dark:bg-black/50 p-4 rounded-lg border border-slate-300 dark:border-gray-600">
                        <div className="flex justify-between items-center gap-4">
                            <div className="flex-grow">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingState[cat.id]}
                                        onChange={(e) => handleEditingChange(cat.id, e.target.value)}
                                        placeholder="Namn på Passkategori"
                                        className="w-full bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 ring-2 ring-primary focus:outline-none transition font-semibold"
                                        disabled={isSaving}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName(cat.id)}
                                    />
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
                                    <button onClick={() => handleStartEditing(cat)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap">Redigera</button>
                                )}
                                <button onClick={() => togglePrompt(cat.id)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap">
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
                                className="w-full h-32 bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-sm mt-3 animate-fade-in"
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

// --- Sub-component for managing global equipment ---
interface GlobalEquipmentManagerProps {
    equipment: EquipmentItem[];
    onEquipmentChange: (equipment: EquipmentItem[]) => void;
    isSaving: boolean;
}
const GlobalEquipmentManager: React.FC<GlobalEquipmentManagerProps> = ({ equipment, onEquipmentChange, isSaving }) => {

    const handleUpdateEquipment = (id: string, field: 'name' | 'quantity', value: string | number) => {
        const newEquipment = equipment.map(item => 
            item.id === id ? { ...item, [field]: value } : item
        );
        onEquipmentChange(newEquipment);
    };

    const handleAddEquipment = () => {
        const newItem: EquipmentItem = {
            id: `equip-${Date.now()}`,
            name: 'Nytt Redskap',
            quantity: 1,
        };
        onEquipmentChange([...equipment, newItem]);
    };

    const handleRemoveEquipment = (id: string) => {
        if (window.confirm("Är du säker på att du vill ta bort detta redskap från den globala listan?")) {
            onEquipmentChange(equipment.filter(item => item.id !== id));
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Detta är standardutrustningen som finns i alla era studios. Enskilda studios kan sedan anpassa denna lista.
            </p>
            {equipment.map(item => (
                <div key={item.id} className="bg-slate-200/50 dark:bg-black/50 p-4 rounded-lg border border-slate-300 dark:border-gray-600">
                    <div className="flex justify-between items-center gap-4">
                        <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateEquipment(item.id, 'name', e.target.value)}
                            placeholder="Namn på redskap"
                            className="w-full bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition font-semibold"
                            disabled={isSaving}
                        />
                         <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateEquipment(item.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                            className="w-24 bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-400 dark:border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-center"
                            disabled={isSaving}
                            min="0"
                        />
                        <button onClick={() => handleRemoveEquipment(item.id)} className="text-red-500 hover:text-red-400 font-semibold text-sm">
                            Ta bort
                        </button>
                    </div>
                </div>
            ))}
            <button onClick={handleAddEquipment} disabled={isSaving} className="w-full mt-4 bg-primary/20 hover:bg-primary/40 text-primary font-bold py-2 px-4 rounded-lg transition-colors border-2 border-dashed border-primary/50">
                Lägg till nytt redskap
            </button>
        </div>
    );
};