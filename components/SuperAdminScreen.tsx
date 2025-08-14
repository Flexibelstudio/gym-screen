import React, { useState, useEffect, useRef } from 'react';
import { StudioConfig, Studio, Organization, CustomPage, CustomCategoryWithPrompt, Page, UserData, UserRole, EquipmentItem } from '../types';
import { ToggleSwitch } from './icons';
import { getAdminsForOrganization, setAdminRole, getCoachesForOrganization } from '../services/firebaseService';

type AdminTab = 'drift' | 'utrustning' | 'organisation' | 'admin';

interface SuperAdminScreenProps {
    organization: Organization;
    adminRole: 'superadmin' | 'admin';
    userRole: UserRole;
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
        <div className="bg-slate-800 rounded-xl border border-gray-700 p-8">
            <div className="text-center">
                <h3 className="text-3xl font-bold text-white">Bygg ett eget pass</h3>
                <p className="text-gray-400 mt-2 max-w-lg mx-auto">
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
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                    >
                        Skapa med AI
                    </button>
                    <button
                        onClick={() => onNavigate('parse')}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                    >
                        Klistra in Pass
                    </button>
                    <button
                        onClick={() => onNavigate('manage')}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
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
    const { organization, onSaveGlobalConfig } = props;
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

    const displayLogoUrl = organization.logoUrlDark || organization.logoUrlLight;

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

            <div className="mb-6 flex border-b border-gray-700" role="tablist">
                <TabButton tabId="drift" activeTab={activeTab} setActiveTab={setActiveTab}>
                    Drift & Innehåll
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
             <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Egna Infosidor</h3>
                <p className="text-sm text-gray-400">Skapa och hantera informationssidor som visas som knappar för coacher.</p>
                <div className="space-y-3">
                    {organization.customPages && organization.customPages.map(page => (
                        <div key={page.id} className="bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-gray-700">
                            <p className="font-semibold text-white">{page.title}</p>
                            <div className="flex gap-2">
                                <button onClick={() => onEditCustomPage(page)} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">Redigera</button>
                                <button onClick={() => onDeleteCustomPage(page.id)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg">Ta bort</button>
                            </div>
                        </div>
                    ))}
                     {(!organization.customPages || organization.customPages.length === 0) && <p className="text-gray-400 text-center py-4">Inga infosidor har skapats ännu.</p>}
                </div>
                <div className="pt-4 flex justify-start items-center">
                    <button onClick={() => onEditCustomPage(null)} className="bg-primary hover:brightness-95 text-white font-bold py-2 px-5 rounded-lg">
                        Lägg till ny sida
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-700">
                <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                    <h3 className="text-2xl font-bold text-white">Globala Inställningar (Standard för nya studios)</h3>
                    <button onClick={handleSaveConfig} disabled={!isConfigDirty || isSavingConfig} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 shadow-lg">
                        {isSavingConfig ? 'Sparar...' : 'Spara Globala Inställningar'}
                    </button>
                </div>

                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-300">Valbara Moduler</h4>
                    <ToggleSwitch label="Aktivera 'Dagens Boost'" checked={config.enableBoost} onChange={(c) => handleUpdateConfigField('enableBoost', c)} />
                    <ToggleSwitch label="Aktivera 'Uppvärmning'" checked={config.enableWarmup} onChange={(c) => handleUpdateConfigField('enableWarmup', c)} />
                    <ToggleSwitch label="Aktivera 'Andningsguide'" checked={config.enableBreathingGuide} onChange={(c) => handleUpdateConfigField('enableBreathingGuide', c)} />
                </div>
                <div className="space-y-2">
                    <h4 className="font-semibold text-gray-300">Anpassade Passkategorier & AI-Prompts</h4>
                     <CategoryPromptManager
                        categories={config.customCategories}
                        onCategoriesChange={(cats) => handleUpdateConfigField('customCategories', cats)}
                        isSaving={isSavingConfig}
                     />
                </div>
            </div>
            
            <PassProgramModule onNavigate={onPassProgramNavigation} />

            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Studios</h3>
                <div className="space-y-3">
                    {organization.studios.map(studio => {
                        if (studio.id === editingStudioId) {
                            return (
                                <div key={studio.id} className="bg-gray-700 p-4 rounded-lg border border-primary flex flex-wrap justify-between items-center gap-4">
                                    <input
                                        value={editingStudioName}
                                        onChange={(e) => setEditingStudioName(e.target.value)}
                                        className="flex-grow bg-black text-white p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
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
                            <div key={studio.id} className="bg-gray-900/50 p-4 rounded-lg flex flex-wrap justify-between items-center gap-4 border border-gray-700">
                                <p className="text-lg font-semibold text-white">{studio.name}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => onEditStudioConfig(studio)} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">Anpassa</button>
                                    <button onClick={() => handleEditStudio(studio)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg">Redigera</button>
                                    <button onClick={() => handleDeleteStudio(studio)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg">Radera</button>
                                </div>
                            </div>
                        )
                    })}
                    {organization.studios.length === 0 && <p className="text-gray-400 text-center py-4">Inga studios har skapats ännu.</p>}
                </div>
                <form onSubmit={handleCreateStudio} className="pt-6 border-t border-gray-700 flex gap-4">
                    <input type="text" value={newStudioName} onChange={(e) => setNewStudioName(e.target.value)} placeholder="Namn på ny studio" className="w-full bg-black text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition" disabled={isCreatingStudio}/>
                    <button type="submit" disabled={!newStudioName.trim() || isCreatingStudio} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-500 whitespace-nowrap">
                        {isCreatingStudio ? 'Skapar...' : 'Skapa Studio'}
                    </button>
                </form>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Växla till Studiovy</h3>
                <p className="text-sm text-gray-400">Testa appen ur en medlems perspektiv genom att temporärt byta till en specifik studiovy. Du kan enkelt återvända till adminläget från "För Coacher"-menyn.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {organization.studios.map(studio => (
                        <button
                            key={studio.id}
                            onClick={() => onSwitchToStudioView(studio)}
                            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
                        >
                            {studio.name}
                        </button>
                    ))}
                </div>
                 {organization.studios.length === 0 && <p className="text-gray-400 text-center py-4">Inga studios har skapats ännu för att kunna förhandsgranska.</p>}
            </div>
        </>
    );
};

const UtrustningContent: React.FC<SuperAdminScreenProps & ConfigProps> = ({ config, isSavingConfig, isConfigDirty, handleUpdateConfigField, handleSaveConfig }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-700">
            <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-white">Global Utrustningslista (Standard för alla studios)</h3>
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
            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Organisationsinformation</h3>
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="org-name" className="block text-sm font-medium text-gray-300 mb-1">Organisationsnamn</label>
                        <input
                           id="org-name"
                           type="text"
                           value={name}
                           onChange={e => setName(e.target.value)}
                           readOnly={!isSystemOwner}
                           className={`w-full p-3 rounded-md border transition-colors ${isSystemOwner ? 'bg-black text-white border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none' : 'bg-black text-gray-400 border-gray-600 cursor-not-allowed'}`}
                        />
                    </div>
                    <div>
                        <label htmlFor="org-subdomain" className="block text-sm font-medium text-gray-300 mb-1">Subdomän</label>
                        <div className="flex items-center">
                            <input
                               id="org-subdomain"
                               type="text"
                               value={subdomain}
                               onChange={e => setSubdomain(e.target.value)}
                               readOnly={!isSystemOwner}
                               className={`w-full p-3 rounded-l-md border-y border-l transition-colors ${isSystemOwner ? 'bg-black text-white border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none' : 'bg-black text-gray-400 border-gray-600 cursor-not-allowed'}`}
                            />
                            <span className="px-3 py-3 bg-gray-700 text-gray-400 rounded-r-md border-y border-r border-gray-600">.flexibel.app</span>
                        </div>
                    </div>
                </div>
                <div className="pt-4 flex justify-end">
                     {isSystemOwner ? (
                        <button onClick={handleSaveOrgInfo} disabled={!isOrgInfoDirty || isSavingOrgInfo} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                            {isSavingOrgInfo ? 'Sparar...' : 'Spara ändringar'}
                        </button>
                    ) : (
                        <p className="text-xs text-gray-400">Endast en Systemägare kan ändra namn och subdomän.</p>
                    )}
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Profilering & Varumärke</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Förhandsvisning</label>
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-700">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Logotyp för Ljust Tema</label>
                        <p className="text-xs text-gray-400 mt-1 mb-2">Använd en mörk logotyp. Visas på vit bakgrund.</p>
                        <input 
                            type="file" 
                            accept="image/*,.svg"
                            onChange={(e) => handleLogoFileChange(e, 'light')} 
                            className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300">Logotyp för Mörkt Tema</label>
                        <p className="text-xs text-gray-400 mt-1 mb-2">Använd en ljus/vit logotyp. Visas på mörk bakgrund.</p>
                        <input 
                            type="file" 
                            accept="image/*,.svg"
                            onChange={(e) => handleLogoFileChange(e, 'dark')} 
                            className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500"
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

                <hr className="border-gray-700" />
                
                <div className="space-y-2">
                    <label htmlFor="primary-color" className="block text-sm font-medium text-gray-300">Primärfärg</label>
                    <div className="flex items-center gap-4">
                        <input type="color" id="primary-color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-12 p-1 bg-transparent border-none rounded-lg cursor-pointer"/>
                        <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="bg-black text-white p-2 rounded-md border border-gray-600 font-mono"/>
                        <button onClick={handleSaveColor} disabled={!isColorDirty || isSavingColor} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 ml-auto">
                                {isSavingColor ? 'Sparar...' : 'Spara Färg'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">Denna färg kommer att användas för knappar och andra primära element.</p>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Lösenordshantering</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Coach-lösenord</label>
                        <div className="flex items-center">
                            <input value={passwords.coach} onChange={(e) => handlePasswordChange('coach', e.target.value)} type={showCoachPassword ? "text" : "password"} className="w-full bg-black text-white p-3 rounded-l-md border-y border-l border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"/>
                            <button onClick={() => setShowCoachPassword(!showCoachPassword)} className="px-4 py-3 bg-gray-700 rounded-r-md border-y border-r border-gray-600 text-gray-300">
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
    
    const handleInviteUser = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Inbjudningsfunktion är ej implementerad.\nSkulle bjudit in: ${newUserEmail} med rollen ${newUserRole}.`);
        // Here you would typically call a cloud function that handles user creation and invitation.
        // e.g., inviteUser(organization.id, newUserEmail, newUserRole);
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
        <div className="bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-700">
            <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Hantera Användare</h3>

            {/* Admins List */}
            <div className="space-y-3">
                <h4 className="font-semibold text-gray-300">Administratörer</h4>
                {isLoading ? (
                    <p className="text-gray-400">Laddar administratörer...</p>
                ) : admins.length > 0 ? (
                     admins.map(admin => (
                        <div key={admin.uid} className="bg-gray-900/50 p-3 rounded-lg flex flex-wrap justify-between items-center gap-4 border border-gray-700">
                            <div>
                               <p className="font-semibold text-white">{admin.email}</p>
                               <p className={`text-xs px-2 py-0.5 mt-1 rounded-full inline-block ${admin.adminRole === 'superadmin' ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                 {admin.adminRole === 'superadmin' ? 'Superadmin' : 'Admin'}
                               </p>
                            </div>
                            <div className="flex gap-2">
                               <button onClick={() => handleChangeAdminRole(admin.uid, admin.adminRole || 'admin')} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 text-sm rounded-lg">
                                    Ändra Roll
                               </button>
                               <button onClick={() => handleRemoveUser(admin.email)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-3 text-sm rounded-lg">
                                    Ta bort
                               </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-400">Inga administratörer hittades för denna organisation.</p>
                )}
            </div>
            
            {/* Coaches List */}
            <div className="space-y-3 pt-4 border-t border-gray-700">
                <h4 className="font-semibold text-gray-300">Coacher</h4>
                {isLoading ? (
                    <p className="text-gray-400">Laddar coacher...</p>
                ) : coaches.length > 0 ? (
                     coaches.map(coach => (
                        <div key={coach.uid} className="bg-gray-900/50 p-3 rounded-lg flex flex-wrap justify-between items-center gap-4 border border-gray-700">
                            <div>
                               <p className="font-semibold text-white">{coach.email}</p>
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
                    <p className="text-gray-400">Inga coacher hittades för denna organisation.</p>
                )}
            </div>

            {/* Invite Form */}
            <form onSubmit={handleInviteUser} className="pt-6 border-t border-gray-700 space-y-3">
                <h4 className="font-semibold text-gray-300">Bjud in ny användare</h4>
                <div className="flex flex-col sm:flex-row gap-4">
                    <input 
                        type="email"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                        placeholder="E-postadress"
                        className="w-full bg-black text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
                        required
                    />
                    <select
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as 'coach' | 'admin')}
                        className="w-full sm:w-auto bg-black text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                        <option value="coach">Coach</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                 <button type="submit" className="w-full sm:w-auto bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg">
                    Skicka inbjudan
                </button>
            </form>
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
            {categories.map(cat => (
                <div key={cat.id} className="bg-black/50 p-4 rounded-lg border border-gray-600 space-y-3">
                    <div className="flex justify-between items-center gap-4">
                        <input
                            type="text"
                            value={cat.name}
                            onChange={(e) => handleUpdateCategory(cat.id, 'name', e.target.value)}
                            placeholder="Namn på passkategori"
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
                        placeholder="AI-instruktioner för denna passkategori..."
                        className="w-full h-32 bg-gray-900 text-white p-2 rounded-md border border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-sm"
                        disabled={isSaving}
                    />
                </div>
            ))}
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
            <p className="text-sm text-gray-400">
                Detta är standardutrustningen som finns i alla era studios. Enskilda studios kan sedan anpassa denna lista.
            </p>
            {equipment.map(item => (
                <div key={item.id} className="bg-black/50 p-4 rounded-lg border border-gray-600">
                    <div className="flex justify-between items-center gap-4">
                        <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateEquipment(item.id, 'name', e.target.value)}
                            placeholder="Namn på redskap"
                            className="w-full bg-gray-900 text-white p-2 rounded-md border border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition font-semibold"
                            disabled={isSaving}
                        />
                         <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateEquipment(item.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                            className="w-24 bg-gray-900 text-white p-2 rounded-md border border-gray-500 focus:ring-2 focus:ring-primary focus:outline-none transition text-center"
                            disabled={isSaving}
                            min="0"
                        />
                        <button onClick={() => handleRemoveEquipment(item.id)} className="text-red-500 hover:text-red-400 font-semibold flex-shrink-0">
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