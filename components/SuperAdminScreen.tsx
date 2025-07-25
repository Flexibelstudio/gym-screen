



import React, { useState, useEffect, useRef } from 'react';
import { StudioConfig, Studio, Organization, CustomPage, CustomCategoryWithPrompt } from '../types';
import { ToggleSwitch } from './icons';
import { CustomPageEditorModal } from './CustomPageEditorModal';


const AILoadingSpinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


interface SuperAdminScreenProps {
    organization: Organization;
    onSaveGlobalConfig: (organizationId: string, newConfig: StudioConfig) => Promise<void>;
    onEditStudioConfig: (studio: Studio) => void;
    onCreateStudio: (organizationId: string, name: string) => Promise<void>;
    onUpdatePasswords: (organizationId: string, passwords: Organization['passwords']) => Promise<void>;
    onUpdateLogo: (organizationId: string, logoUrl: string) => Promise<void>;
    onUpdatePrimaryColor: (organizationId: string, color: string) => Promise<void>;
    onUpdateOrganization: (organizationId: string, name: string, subdomain: string) => Promise<void>;
    onUpdateCustomPages: (organizationId: string, pages: CustomPage[]) => Promise<void>;
}

export const SuperAdminScreen: React.FC<SuperAdminScreenProps> = ({
    organization,
    onSaveGlobalConfig,
    onEditStudioConfig,
    onCreateStudio,
    onUpdatePasswords,
    onUpdateLogo,
    onUpdatePrimaryColor,
    onUpdateOrganization,
    onUpdateCustomPages,
}) => {
    const [config, setConfig] = useState<StudioConfig>(organization.globalConfig);
    const [passwords, setPasswords] = useState<Organization['passwords']>(organization.passwords);
    const [name, setName] = useState(organization.name);
    const [subdomain, setSubdomain] = useState(organization.subdomain);
    
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isSavingPasswords, setIsSavingPasswords] = useState(false);
    const [isSavingOrgDetails, setIsSavingOrgDetails] = useState(false);

    const [newStudioName, setNewStudioName] = useState('');
    const [isCreatingStudio, setIsCreatingStudio] = useState(false);
    
    const [showCoachPassword, setShowCoachPassword] = useState(false);
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    
    const [logoPreview, setLogoPreview] = useState<string | null>(organization.logoUrl || null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isSavingLogo, setIsSavingLogo] = useState(false);
    
    const [primaryColor, setPrimaryColor] = useState(organization.primaryColor || '#14b8a6');
    const [isSavingColor, setIsSavingColor] = useState(false);

    // State for custom pages
    const [customPages, setCustomPages] = useState<CustomPage[]>(organization.customPages || []);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [pageToEdit, setPageToEdit] = useState<CustomPage | null>(null);
    const scrollPositionRef = useRef(0);


    useEffect(() => {
        setConfig(organization.globalConfig);
        setPasswords(organization.passwords);
        setName(organization.name);
        setSubdomain(organization.subdomain);
        setLogoPreview(organization.logoUrl || null);
        setPrimaryColor(organization.primaryColor || '#14b8a6');
        setCustomPages(organization.customPages || []);
        
        // Clear file-based states
        setLogoFile(null);
    }, [organization]);

    const handleToggleChange = (key: 'enableBoost' | 'enableWarmup' | 'enableBreathingGuide', value: boolean) => {
        setConfig(prevConfig => ({ ...prevConfig, [key]: value }));
    };

    const handleCategoriesChange = (updatedCategories: CustomCategoryWithPrompt[]) => {
        setConfig(prevConfig => ({ ...prevConfig, customCategories: updatedCategories }));
    };
    
    const handlePasswordChange = (level: 'coach' | 'superadmin', value: string) => {
        setPasswords(prev => ({ ...prev, [level]: value }));
    };

    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSaveOrgDetails = async () => {
        if (!name.trim() || !subdomain.trim()) return;
        setIsSavingOrgDetails(true);
        try {
            await onUpdateOrganization(organization.id, name.trim(), subdomain.trim());
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingOrgDetails(false);
        }
    };

    const handleSaveLogo = async () => {
        if (!logoPreview || !logoFile) return;
        setIsSavingLogo(true);
        try {
            await onUpdateLogo(organization.id, logoPreview);
            setLogoFile(null);
        } catch (error) {
            console.error("Failed to save logo", error);
        } finally {
            setIsSavingLogo(false);
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

    // --- Custom Page Handlers ---
    const handleOpenEditor = (page: CustomPage | null = null) => {
        scrollPositionRef.current = window.scrollY;
        setPageToEdit(page);
        setIsEditorOpen(true);
    };

    const handleCloseEditor = () => {
        setIsEditorOpen(false);
        // Restore scroll position after the modal has been removed from the DOM
        requestAnimationFrame(() => {
            window.scrollTo(0, scrollPositionRef.current);
        });
    };

    const handleSavePage = async (pageData: CustomPage) => {
        let updatedPages;
        const isExistingPage = customPages.some(p => p.id === pageData.id);

        if (isExistingPage) {
            updatedPages = customPages.map(p => p.id === pageData.id ? pageData : p);
        } else {
            updatedPages = [...customPages, pageData];
        }
        
        setCustomPages(updatedPages);
        
        try {
            await onUpdateCustomPages(organization.id, updatedPages);
        } catch (err) {
            console.error("Failed to save page changes:", err);
            setCustomPages(customPages); 
            alert("Kunde inte spara ändringarna på sidan.");
        } finally {
            handleCloseEditor();
            setPageToEdit(null);
        }
    };


    const handleDeletePage = async (pageId: string) => {
        if (window.confirm("Är du säker på att du vill ta bort denna infosida?")) {
            const updatedPages = customPages.filter(p => p.id !== pageId);
            setCustomPages(updatedPages);
            try {
                await onUpdateCustomPages(organization.id, updatedPages);
            } catch (err) {
                console.error("Failed to delete page:", err);
                setCustomPages(customPages); // Revert on failure
                alert("Kunde inte ta bort sidan.");
            }
        }
    };

    const isOrgDetailsDirty = name !== organization.name || subdomain !== organization.subdomain;
    const isConfigDirty = JSON.stringify(config) !== JSON.stringify(organization.globalConfig);
    const isPasswordsDirty = JSON.stringify(passwords) !== JSON.stringify(organization.passwords);
    const isLogoDirty = !!logoFile;
    const isColorDirty = primaryColor !== (organization.primaryColor || '#14b8a6');

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
             <p className="text-center text-gray-400">
                Här hanterar du all information för organisationen <span className="font-bold text-white">{organization.name}</span>. Ändringar som sparas här påverkar alla studios inom organisationen.
            </p>

            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Organisationsinformation</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="org-name" className="block text-sm font-medium text-gray-300 mb-1">Organisationsnamn</label>
                        <input id="org-name" type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-black text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none" />
                    </div>
                    <div>
                        <label htmlFor="org-subdomain" className="block text-sm font-medium text-gray-300 mb-1">Subdomän</label>
                        <div className="flex items-center">
                            <input id="org-subdomain" type="text" value={subdomain} onChange={e => setSubdomain(e.target.value)} className="w-full bg-black text-white p-3 rounded-l-md border-y border-l border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none" />
                            <span className="px-3 py-3 bg-gray-700 text-gray-400 rounded-r-md border-y border-r border-gray-600">.flexibel.app</span>
                        </div>
                    </div>
                </div>
                <div className="pt-4 flex justify-end">
                    <button onClick={handleSaveOrgDetails} disabled={!isOrgDetailsDirty || isSavingOrgDetails} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                        {isSavingOrgDetails ? 'Sparar...' : 'Spara Grundinfo'}
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Profilering & Varumärke</h3>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Organisationslogotyp</label>
                    <div className="flex items-center gap-4">
                        <div className="w-24 h-24 bg-black rounded-md flex items-center justify-center">
                            {logoPreview ? <img src={logoPreview} alt="Förhandsgranskning" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-500">Ingen logo</span>}
                        </div>
                        <input type="file" accept="image/*" onChange={handleLogoFileChange} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/80 file:text-white hover:file:bg-primary"/>
                        <button onClick={handleSaveLogo} disabled={!isLogoDirty || isSavingLogo} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                            {isSavingLogo ? 'Sparar...' : 'Spara Logo'}
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <label htmlFor="primary-color" className="block text-sm font-medium text-gray-300">Primärfärg</label>
                    <div className="flex items-center gap-4">
                        <input type="color" id="primary-color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-12 p-1 bg-transparent border-none rounded-lg cursor-pointer"/>
                        <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="bg-black text-white p-2 rounded-md border border-gray-600 font-mono"/>
                        <button onClick={handleSaveColor} disabled={!isColorDirty || isSavingColor} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                             {isSavingColor ? 'Sparar...' : 'Spara Färg'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">Denna färg kommer att användas för knappar och andra primära element.</p>
                </div>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Egna Infosidor</h3>
                <p className="text-sm text-gray-400">Skapa och hantera informationssidor som visas som knappar för coacher.</p>
                <div className="space-y-3">
                    {customPages.map(page => (
                        <div key={page.id} className="bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-gray-700">
                            <p className="font-semibold text-white">{page.title}</p>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenEditor(page)} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">Redigera</button>
                                <button onClick={() => handleDeletePage(page.id)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg">Ta bort</button>
                            </div>
                        </div>
                    ))}
                     {customPages.length === 0 && <p className="text-gray-400 text-center py-4">Inga infosidor har skapats ännu.</p>}
                </div>
                <div className="pt-4 flex justify-start items-center">
                    <button onClick={() => handleOpenEditor(null)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-5 rounded-lg">
                        Lägg till ny sida
                    </button>
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
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Admin-lösenord</label>
                        <div className="flex items-center">
                            <input value={passwords.superadmin} onChange={(e) => handlePasswordChange('superadmin', e.target.value)} type={showAdminPassword ? "text" : "password"} className="w-full bg-black text-white p-3 rounded-l-md border-y border-l border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"/>
                             <button onClick={() => setShowAdminPassword(!showAdminPassword)} className="px-4 py-3 bg-gray-700 rounded-r-md border-y border-r border-gray-600 text-gray-300">
                                {showAdminPassword ? 'Dölj' : 'Visa'}
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
            
            <div className="bg-gray-800 p-6 rounded-lg space-y-6 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Globala Inställningar (Standard för nya studios)</h3>
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-300">Valbara Moduler</h4>
                    <ToggleSwitch label="Aktivera 'Dagens Boost'" checked={config.enableBoost} onChange={(c) => handleToggleChange('enableBoost', c)} />
                    <ToggleSwitch label="Aktivera 'Uppvärmning'" checked={config.enableWarmup} onChange={(c) => handleToggleChange('enableWarmup', c)} />
                    <ToggleSwitch label="Aktivera 'Andningsguide'" checked={config.enableBreathingGuide} onChange={(c) => handleToggleChange('enableBreathingGuide', c)} />
                </div>
                <div className="space-y-2">
                    <h4 className="font-semibold text-gray-300">Anpassade Passkategorier & AI-Prompts</h4>
                     <CategoryPromptManager
                        categories={config.customCategories}
                        onCategoriesChange={handleCategoriesChange}
                        isSaving={isSavingConfig}
                     />
                </div>
                 <div className="pt-4 flex justify-end">
                    <button onClick={handleSaveConfig} disabled={!isConfigDirty || isSavingConfig} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                        {isSavingConfig ? 'Sparar...' : 'Spara Globala Inställningar'}
                    </button>
                </div>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg space-y-4 border border-gray-700">
                <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-3 mb-4">Studios</h3>
                <div className="space-y-3">
                    {organization.studios.map(studio => (
                        <div key={studio.id} className="bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-gray-700">
                            <p className="text-lg font-semibold text-white">{studio.name}</p>
                            <button onClick={() => onEditStudioConfig(studio)} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg">Anpassa</button>
                        </div>
                    ))}
                    {organization.studios.length === 0 && <p className="text-gray-400 text-center py-4">Inga studios har skapats ännu.</p>}
                </div>
                <form onSubmit={handleCreateStudio} className="pt-6 border-t border-gray-700 flex gap-4">
                    <input type="text" value={newStudioName} onChange={(e) => setNewStudioName(e.target.value)} placeholder="Namn på ny studio" className="w-full bg-black text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition" disabled={isCreatingStudio}/>
                    <button type="submit" disabled={!newStudioName.trim() || isCreatingStudio} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-500 whitespace-nowrap">
                        {isCreatingStudio ? 'Skapar...' : 'Skapa Studio'}
                    </button>
                </form>
            </div>

            {isEditorOpen && (
                <CustomPageEditorModal
                    isOpen={isEditorOpen}
                    onClose={handleCloseEditor}
                    onSave={handleSavePage}
                    pageToEdit={pageToEdit}
                />
            )}
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