
import React, { useState, useEffect, useMemo } from 'react';
import { StudioConfig, Studio, Organization, CustomPage, UserData, UserRole, InfoCarousel, DisplayWindow, Workout, CompanyDetails, ThemeOption } from '../types';
import { ToggleSwitch, HomeIcon, DocumentTextIcon, SpeakerphoneIcon, SparklesIcon, UsersIcon, DumbbellIcon, BriefcaseIcon, BuildingIcon, SettingsIcon, ChartBarIcon, SaveIcon, CopyIcon } from './icons';
import { getAdminsForOrganization, getCoachesForOrganization, updateOrganizationCompanyDetails, getSmartScreenPricing } from '../services/firebaseService';
import { AIGeneratorScreen } from './AIGeneratorScreen';
import { WorkoutBuilderScreen } from './WorkoutBuilderScreen';
import { OvningsbankContent } from './OvningsbankContent';
import { useStudio } from '../context/StudioContext';
import { CompanyDetailsOnboardingModal } from './CompanyDetailsOnboardingModal';
import { Modal } from './ui/Modal';
import { CategoryPromptManager } from './CategoryPromptManager';
import { DashboardContent } from './admin/DashboardContent';
import { StudiosContent } from './admin/StudiosContent';
import { InfosidorContent } from './admin/InfosidorContent';
import { InfoKarusellContent } from './admin/InfoKarusellContent';
import { VarumarkeContent } from './admin/VarumarkeContent';
import { CompanyInfoContent } from './admin/CompanyInfoContent';
import { generateWorkout } from '../services/geminiService';
import { SelectField } from './admin/AdminShared';
import { MemberManagementScreen } from './MemberManagementScreen';
import { AdminAnalyticsScreen } from './AdminAnalyticsScreen';
import QRCode from "react-qr-code"; 

// --- Icons specific to this file ---
const MenuIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const LockClosedIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
);

const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

type AdminTab = 
    'dashboard' | 
    'pass-program' | 'infosidor' | 'info-karusell' | 'medlemmar' |
    'globala-installningar' | 'studios' | 'varumarke' | 'company-info' |
    'anvandare' | 'ovningsbank' | 'analytics';

interface SuperAdminScreenProps {
    organization: Organization;
    adminRole: 'superadmin' | 'admin';
    userRole: UserRole;
    theme: string;
    onSaveGlobalConfig: (organizationId: string, newConfig: StudioConfig) => Promise<void>;
    onEditStudioConfig: (studio: Studio) => void;
    onCreateStudio: (organizationId: string, name: string) => Promise<void>;
    onUpdateStudio: (organizationId: string, studioId: string, name: string) => Promise<void>;
    onDeleteStudio: (organizationId: string, studioId: string) => Promise<void>;
    onUpdatePasswords: (organizationId: string, passwords: Organization['passwords']) => Promise<void>;
    onUpdateLogos: (organizationId: string, logos: { light: string; dark: string }) => Promise<void>;
    onUpdatePrimaryColor: (organizationId: string, color: string) => Promise<void>;
    onUpdateOrganization: (organizationId: string, name: string, subdomain: string, inviteCode?: string) => Promise<void>;
    onUpdateOrganizationCompanyDetails?: (organizationId: string, details: CompanyDetails) => Promise<void>;
    onUpdateCustomPages: (organizationId: string, pages: CustomPage[]) => Promise<void>;
    onSwitchToStudioView: (studio: Studio) => void;
    onEditCustomPage: (page: CustomPage | null) => void;
    onDeleteCustomPage: (pageId: string) => Promise<void>;
    onUpdateInfoCarousel: (organizationId: string, infoCarousel: InfoCarousel) => Promise<void>;
    onUpdateDisplayWindows: (organizationId: string, displayWindows: DisplayWindow[]) => Promise<void>;
    workouts: Workout[];
    workoutsLoading: boolean;
    onSaveWorkout: (workout: Workout) => Promise<Workout>;
    onDeleteWorkout: (workoutId: string) => Promise<void>;
    onTogglePublish: (workoutId: string, isPublished: boolean) => void;
    onSelectMember: (memberId: string) => void;
}

interface ConfigProps {
    config: StudioConfig;
    isSavingConfig: boolean;
    setIsSavingConfig: React.Dispatch<React.SetStateAction<boolean>>;
    isConfigDirty: boolean;
    handleUpdateConfigField: <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => void;
    handleSaveConfig: (configOverride?: StudioConfig) => Promise<void>;
}

const FeatureLockedView: React.FC<{ 
    title: string; 
    description: string; 
    features: string[];
    onGoToSettings: () => void;
}> = ({ title, description, features, onGoToSettings }) => (
    <div className="max-w-3xl mx-auto py-12 px-6 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 dark:border-gray-700 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <LockClosedIcon className="w-64 h-64" />
            </div>
            
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <LockClosedIcon className="w-10 h-10" />
            </div>
            
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">{title}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 leading-relaxed">
                {description}
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 mb-10 text-left border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-widest text-xs">Detta ingår vid aktivering:</h4>
                <ul className="space-y-3">
                    {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                            <span className="text-primary font-bold">✓</span>
                            <span className="font-medium">{f}</span>
                        </li>
                    ))}
                </ul>
            </div>
            
            <button 
                onClick={onGoToSettings}
                className="bg-primary hover:brightness-110 text-white font-black py-4 px-10 rounded-2xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-1 active:scale-95"
            >
                Aktivera nu i inställningar
            </button>
        </div>
    </div>
);

const SwitchToStudioView: React.FC<{
    organization: Organization;
    onSwitchToStudioView: (studio: Studio) => void;
}> = ({ organization, onSwitchToStudioView }) => {
    return (
        <div className="mt-12 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Växla till Skärmvy</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Växla till skärmvy. Du återvänder hit via "För Coacher"-menyn.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {organization.studios.map(studio => (
                    <button
                        key={studio.id}
                        onClick={() => onSwitchToStudioView(studio)}
                        className="bg-gray-50 dark:bg-gray-700 hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white font-medium py-4 px-6 rounded-xl transition-all text-left flex items-center justify-between group"
                    >
                        <span>{studio.name}</span>
                        <span className="text-gray-400 group-hover:text-primary transition-colors">→</span>
                    </button>
                ))}
            </div>
            {organization.studios.length === 0 && <p className="text-gray-400 text-sm italic">Inga skärmar skapade ännu.</p>}
        </div>
    );
};

const AnvandareContent: React.FC<SuperAdminScreenProps & { admins: UserData[], coaches: UserData[], isLoading: boolean }> = ({ organization, admins, coaches, isLoading }) => {
    const UserList: React.FC<{ users: UserData[], title: string, showAdminRoles?: boolean }> = ({ users, title, showAdminRoles }) => (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <h4 className="font-bold text-gray-800 dark:text-white">{title} <span className="text-gray-400 font-normal ml-2 text-sm">{users.length} st</span></h4>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {isLoading ? <li className="p-6 text-gray-500">Laddar...</li> : users.length === 0 ? <li className="p-6 text-gray-500 italic text-sm">Inga användare i denna grupp.</li> : users.map(user => (
                    <li key={user.uid} className="p-4 sm:px-6 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {user.email[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">{user.email}</p>
                                {showAdminRoles && user.adminRole && <p className="text-[10px] uppercase tracking-wider font-bold text-primary mt-0.5">{user.adminRole}</p>}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white dark:bg-indigo-900/50 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-300">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-1">Hantera Teamet</h3>
                        <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed max-w-2xl">
                            För att lägga till nya coacher eller administratörer, skicka ett mail till <a href="mailto:hej@smartstudio.se" className="underline hover:text-indigo-900 font-semibold">hej@smartstudio.se</a>. 
                            Ange personens e-postadress och om de ska vara <strong>Coach</strong> (passhantering) eller <strong>Admin</strong> (full access).
                        </p>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UserList users={admins} title="Administratörer" showAdminRoles />
                <UserList users={coaches} title="Coacher" />
            </div>
        </div>
    );
};

const PassProgramModule: React.FC<{ onNavigate: (mode: 'create' | 'generate' | 'parse' | 'manage') => void }> = ({ onNavigate }) => {
    return (
        <div className="space-y-8 py-4">
            <div className="text-center max-w-2xl mx-auto mb-10">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Pass & Program</h2>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Skapa, hantera och publicera träningspass. Använd AI för att snabbt generera nya pass eller tolka dina anteckningar.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <button onClick={() => onNavigate('create')} className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <DumbbellIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Skapa nytt pass</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Bygg ett pass från grunden med vår passbyggare.</p>
                </button>

                <button onClick={() => onNavigate('generate')} className="group bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 p-8 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-900/30 hover:border-purple-300 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Skapa med AI</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Låt AI:n generera ett komplett pass baserat på dina önskemål.</p>
                </button>

                <button onClick={() => onNavigate('parse')} className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <DocumentTextIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Tolka från text</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Klistra in anteckningar och låt systemet strukturera upp det.</p>
                </button>

                <button onClick={() => onNavigate('manage')} className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:shadow-md transition-all text-left">
                    <div className="w-12 h-12 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <SettingsIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Hantera pass</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Redigera, publicera och ta bort dina befintliga pass.</p>
                </button>
            </div>
        </div>
    );
};

const AiCoachInfoContent: React.FC<{ onReadMoreClick: () => void }> = ({ onReadMoreClick }) => (
    <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-2xl flex items-center justify-center flex-shrink-0">
            <SparklesIcon className="w-8 h-8" />
        </div>
        <div className="flex-grow text-center md:text-left">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Nya AI Coach är här! 🤖</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Få feedback på dina passupplägg, generera övningsbeskrivningar och skapa variation med ett klick.</p>
        </div>
        <button onClick={onReadMoreClick} className="px-5 py-2 bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300 font-bold rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-50 transition-colors shadow-sm">
            Läs mer
        </button>
    </div>
);

const AiCoachInfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Smart AI Coach 🤖" size="lg">
        <div className="space-y-6 text-gray-800 dark:text-gray-200">
            <p className="text-lg font-medium leading-relaxed">SmartStudio AI Coach är din personliga assistent i passbyggandet. Här är vad den kan hjälpa dig med:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
                    <h5 className="font-bold text-purple-900 dark:text-purple-100 mb-2">✨ Skapa pass från idé</h5>
                    <p className="text-sm">Skriv "Ett tungt benpass med fokus på explosivitet" så bygger AI:n blocken, övningarna och sätter timern åt dig.</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <h5 className="font-bold text-blue-900 dark:text-blue-100 mb-2">📋 Tolka anteckningar</h5>
                    <p className="text-sm">Har du skrivit ner passet på mobilen eller ett papper? Klistra in texten eller fota den i Idé-tavlan för att digitalisera det direkt.</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30">
                    <h5 className="font-bold text-green-900 dark:text-green-100 mb-2">🧠 Analysera & Förbättra</h5>
                    <p className="text-sm">Klicka på "Analysera" i passbyggaren för att få coach-feedback på balans, flås-faktor och "Magic Pen"-förslag på specifika förbättringar.</p>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-900/30">
                    <h5 className="font-bold text-orange-900 dark:text-orange-100 mb-2">🖼️ Generera Bilder</h5>
                    <p className="text-sm">Saknas en bild till en övning? Använd AI:n för att skapa en unik illustration som visas på skärmen.</p>
                </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl text-sm italic border-l-4 border-primary">
                AI:n är ett verktyg för inspiration och effektivitet. Granska alltid passet innan publicering för att säkerställa att det matchar din expertis och medlemmarnas behov.
            </div>
            <button onClick={onClose} className="w-full bg-primary text-white font-bold py-3 rounded-xl">Uppfattat!</button>
        </div>
    </Modal>
);

const GlobalaInställningarContent: React.FC<SuperAdminScreenProps & ConfigProps> = (props) => {
    const { config, isSavingConfig, setIsSavingConfig, isConfigDirty, handleUpdateConfigField, handleSaveConfig, organization, onUpdateOrganization } = props;
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [baseCost, setBaseCost] = useState(19);
    const [customerPrice, setCustomerPrice] = useState(49);

    useEffect(() => {
        if (showPricingModal) {
            getSmartScreenPricing().then(pricing => {
                if (pricing && pricing.workoutLoggingPricePerMember !== undefined) {
                    setBaseCost(pricing.workoutLoggingPricePerMember);
                }
            });
        }
    }, [showPricingModal]);

    const handleAiChange = (field: 'instructions' | 'tone', value: string) => {
        handleUpdateConfigField('aiSettings', {
            ...(config.aiSettings || {}),
            [field]: value
        });
    };

    const confirmAndEnableLogging = async () => {
        setIsSavingConfig(true);
        try {
            // 1. Generate invite code if missing
            if (!organization.inviteCode) {
                const newCode = generateInviteCode();
                await onUpdateOrganization(organization.id, organization.name, organization.subdomain, newCode);
            }

            // 2. Enable logging in config and save
            handleUpdateConfigField('enableWorkoutLogging', true);
            await handleSaveConfig({ ...config, enableWorkoutLogging: true });
            
            setShowPricingModal(false);
            alert("Passloggning aktiverad och inbjudningskod skapad!");
        } catch (error) {
            console.error(error);
            alert("Kunde inte aktivera modulen.");
        } finally {
            setIsSavingConfig(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Globala Inställningar</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Dessa inställningar gäller som standard för alla skärmar.</p>
                </div>
                <button onClick={() => handleSaveConfig()} disabled={!isConfigDirty || isSavingConfig} className="bg-primary hover:brightness-95 text-white font-semibold py-2.5 px-6 rounded-xl disabled:opacity-50 shadow-sm transition-all transform active:scale-95">
                    {isSavingConfig ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>

            <div className="p-6 sm:p-8 space-y-8">
                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Funktioner & Moduler</h4>
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch 
                                label="HYROX-modul" 
                                checked={!!config.enableHyrox} 
                                onChange={(checked) => handleUpdateConfigField('enableHyrox', checked)} 
                            />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Aktiverar verktyg för tävlingar och HYROX-pass.</p>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch 
                                label="Passloggning & QR" 
                                checked={!!config.enableWorkoutLogging} 
                                onChange={(checked) => {
                                    if (checked) setShowPricingModal(true);
                                    else handleUpdateConfigField('enableWorkoutLogging', false);
                                }} 
                            />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Låt medlemmar logga sina pass och få AI-feedback.</p>
                            {organization.inviteCode && (
                                <p className="text-[10px] text-primary font-bold mt-1 pl-2">KOD AKTIV: {organization.inviteCode}</p>
                            )}
                            <button onClick={() => setShowPricingModal(true)} className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-2 pl-2 hover:underline">
                                📊 Räkna på din vinst & läs mer...
                            </button>
                        </div>

                        {config.enableWorkoutLogging && (
                            <div className="ml-8 p-4 bg-white dark:bg-black/20 rounded-xl border border-blue-100 dark:border-blue-900/30 animate-fade-in">
                                <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <SparklesIcon className="w-4 h-4 text-purple-500" />
                                    AI-Coach Inställningar
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Systeminstruktioner</label>
                                        <textarea 
                                            rows={3}
                                            value={config.aiSettings?.instructions || ''}
                                            onChange={(e) => handleAiChange('instructions', e.target.value)}
                                            placeholder="T.ex: Påminn alltid om att boka PT om resultaten planar ut..."
                                            className="w-full p-2 text-sm rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tonläge</label>
                                        <select 
                                            value={config.aiSettings?.tone || 'neutral'}
                                            onChange={(e) => handleAiChange('tone', e.target.value)}
                                            className="w-full p-2 text-sm rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none"
                                        >
                                            <option value="neutral">Neutral & Professionell</option>
                                            <option value="enthusiastic">Peppande & Entusiastisk</option>
                                            <option value="strict">Sträng & Militärisk</option>
                                            <option value="sales">Säljande & Serviceinriktad</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch label="Idé-tavlan (Whiteboard)" checked={!!config.enableNotes} onChange={(checked) => handleUpdateConfigField('enableNotes', checked)} />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Digital rityta för att skissa pass och idéer.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch label="Övningsbank" checked={!!config.enableExerciseBank} onChange={(checked) => handleUpdateConfigField('enableExerciseBank', checked)} />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Ger coacher tillgång till det gemensamma övningsbiblioteket.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <ToggleSwitch label="Skärmsläckare" checked={!!config.enableScreensaver} onChange={(checked) => handleUpdateConfigField('enableScreensaver', checked)} />
                                {config.enableScreensaver && (
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="60"
                                            value={config.screensaverTimeoutMinutes || 15} 
                                            onChange={(e) => handleUpdateConfigField('screensaverTimeoutMinutes', parseInt(e.target.value) || 15)}
                                            className="w-16 bg-white dark:bg-gray-800 text-center p-1 rounded border border-gray-300 dark:border-gray-600 text-sm"
                                        />
                                        <span className="text-xs text-gray-500">min</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2 pl-2">Visar logotyp och klocka vid inaktivitet.</p>
                        </div>
                    </div>
                </section>

                <div className="border-t border-gray-100 dark:border-gray-700 my-6"></div>

                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Säsong & Tema</h4>
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                        <SelectField 
                            label="Säsongstema" 
                            value={config.seasonalTheme || 'none'} 
                            onChange={(val) => handleUpdateConfigField('seasonalTheme', val as ThemeOption)}
                        >
                            <option value="none">Inget tema (Standard)</option>
                            <option value="auto">Automatiskt (Datumstyrt)</option>
                            <option value="winter">Vinter ❄️</option>
                            <option value="christmas">Jul 🎄</option>
                            <option value="newyear">Nyår 🎆</option>
                            <option value="valentines">Alla Hjärtans ❤️</option>
                            <option value="easter">Påsk 🐣</option>
                            <option value="midsummer">Midsommar 🌸</option>
                            <option value="summer">Sommar ☀️</option>
                            <option value="halloween">Halloween 🎃</option>
                        </SelectField>
                        <p className="text-xs text-gray-500 mt-2">
                            Lägger till subtila visuella effekter (t.ex. snö, konfetti) ovanpå din befintliga design.
                        </p>
                    </div>
                </section>

                <div className="border-t border-gray-100 dark:border-gray-700 my-6"></div>

                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Passkategorier</h4>
                    <CategoryPromptManager
                        categories={config.customCategories}
                        onCategoriesChange={(newCats) => handleUpdateConfigField('customCategories', newCats)}
                        isSaving={isSavingConfig}
                    />
                </section>
            </div>

            {showPricingModal && (
                <Modal isOpen={true} onClose={() => setShowPricingModal(false)} title="Aktivera Passloggning 🚀" size="md">
                    <div className="space-y-6 p-2">
                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-left">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Varför aktivera Passloggning?</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                <p className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">FÖR MEDLEMMEN:</p>
                                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <li className="flex gap-2"><span>📈</span> Ser progression (förra passets vikter).</li>
                                    <li className="flex gap-2"><span>🤖</span> Får AI-feedback direkt i mobilen.</li>
                                    <li className="flex gap-2"><span>🔥</span> Roligare träning & statistik.</li>
                                </ul>
                                </div>
                                <div>
                                <p className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">FÖR DIG (GYMMET):</p>
                                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    <li className="flex gap-2"><span>💰</span> Automatisk merförsäljning (Upsell).</li>
                                    <li className="flex gap-2"><span>📊</span> Djup analys av medlemmarna.</li>
                                    <li className="flex gap-2"><span>🔒</span> Ökad retention.</li>
                                </ul>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                                <span className="text-gray-600 dark:text-gray-300 font-medium">Din licenskostnad</span>
                                <span className="font-bold text-gray-900 dark:text-white">{baseCost} kr / mån</span>
                            </div>

                            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                                <label htmlFor="customerPrice" className="text-gray-700 dark:text-gray-200 font-bold">Ditt pris till kund</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        id="customerPrice"
                                        type="number" 
                                        value={customerPrice} 
                                        onChange={(e) => setCustomerPrice(Number(e.target.value))}
                                        className="w-24 text-right p-2 rounded border border-gray-300 dark:border-gray-500 bg-transparent font-bold text-lg focus:ring-2 focus:ring-primary outline-none"
                                    />
                                    <span className="font-medium text-gray-500">kr / mån</span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t-2 border-dashed border-gray-200 dark:border-gray-700 my-4"></div>

                        <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl border-2 border-green-100 dark:border-green-900/30 text-center space-y-6">
                            <div>
                                <p className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-wider mb-1">Din vinst per medlem</p>
                                <p className="text-4xl font-black text-green-600 dark:text-green-400">
                                    {Math.max(0, customerPrice - baseCost)} kr<span className="text-lg text-green-600/70 font-bold">/mån</span>
                                </p>
                            </div>
                            
                            <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Potential vid 100 medlemmar</p>
                                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                    {(Math.max(0, customerPrice - baseCost) * 100 * 12).toLocaleString()} kr / år
                                </p>
                            </div>
                        </div>
                        
                        <p className="text-sm text-red-600 dark:text-red-400 font-bold mt-4 text-center border-t border-red-200 dark:border-red-800 pt-4">
                            Detta kostar extra och genom att aktivera funktionen godkänner du villkoren.
                        </p>
                    </div>
                    
                    <div className="mt-6 flex gap-3">
                         <button onClick={() => setShowPricingModal(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-3 rounded-lg transition-colors">
                            Avbryt
                        </button>
                        <button 
                            onClick={confirmAndEnableLogging}
                            disabled={isSavingConfig}
                            className="flex-[2] bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg shadow-lg shadow-primary/20 transition-all transform active:scale-95"
                        >
                            Jag godkänner och aktiverar
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const PassProgramContent: React.FC<SuperAdminScreenProps & {
    subView: 'hub' | 'ai' | 'builder';
    setSubView: (view: 'hub' | 'ai' | 'builder') => void;
    workoutToEdit: Workout | null;
    setWorkoutToEdit: (w: Workout | null) => void;
    isNewDraft: boolean;
    setIsNewDraft: (b: boolean) => void;
    aiGeneratorInitialTab: 'generate' | 'parse' | 'manage';
    setAiGeneratorInitialTab: (tab: 'generate' | 'parse' | 'manage') => void;
    onReturnToHub: () => void;
    autoExpandCategory: string | null;
    setAutoExpandCategory: (category: string | null) => void;
}> = ({
    subView, setSubView, workoutToEdit, setWorkoutToEdit, isNewDraft, setIsNewDraft,
    aiGeneratorInitialTab, setAiGeneratorInitialTab, onReturnToHub,
    onSaveWorkout, workouts, workoutsLoading, onDeleteWorkout, onTogglePublish,
    organization, autoExpandCategory, setAutoExpandCategory
}) => {
    const handleNavigate = (mode: 'create' | 'generate' | 'parse' | 'manage') => {
        if (mode === 'create') {
            setWorkoutToEdit(null);
            setIsNewDraft(true);
            setSubView('builder');
        } else {
            setAiGeneratorInitialTab(mode === 'manage' ? 'manage' : (mode === 'parse' ? 'parse' : 'generate'));
            setSubView('ai');
        }
    };

    const handleWorkoutGenerated = (workout: Workout) => {
        setWorkoutToEdit(workout);
        setIsNewDraft(true);
        setSubView('builder');
    };

    const handleEditWorkout = (workout: Workout) => {
        setWorkoutToEdit(workout);
        setIsNewDraft(false);
        setSubView('builder');
    };

    const handleSaveAndReturn = async (workout: Workout) => {
        const saved = await onSaveWorkout(workout);
        const category = saved.category || 'Ej kategoriserad';
        setAutoExpandCategory(category);
        setAiGeneratorInitialTab('manage');
        setSubView('ai');
    };

    const [isAiInfoOpen, setIsAiInfoOpen] = useState(false);

    if (subView === 'ai') {
        return (
            <div className="animate-fade-in">
                <button onClick={onReturnToHub} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-primary transition-colors font-medium">
                    <span>&larr;</span> Tillbaka till meny
                </button>
                <AIGeneratorScreen
                    onWorkoutGenerated={handleWorkoutGenerated}
                    onEditWorkout={handleEditWorkout}
                    onDeleteWorkout={onDeleteWorkout}
                    onTogglePublish={onTogglePublish}
                    onCreateNewWorkout={() => handleNavigate('create')}
                    initialMode={aiGeneratorInitialTab}
                    studioConfig={organization.globalConfig}
                    setCustomBackHandler={() => {}}
                    workouts={workouts}
                    workoutsLoading={workoutsLoading}
                    initialExpandedCategory={autoExpandCategory}
                />
            </div>
        );
    }

    if (subView === 'builder') {
        return (
            <div className="animate-fade-in w-full">
                <WorkoutBuilderScreen
                    initialWorkout={workoutToEdit}
                    onSave={handleSaveAndReturn}
                    onCancel={onReturnToHub}
                    studioConfig={organization.globalConfig}
                    sessionRole="organizationadmin"
                    isNewDraft={isNewDraft}
                />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <PassProgramModule onNavigate={handleNavigate} />
            <div className="mt-12 bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-100 dark:border-blue-800/30">
                <AiCoachInfoContent onReadMoreClick={() => setIsAiInfoOpen(true)} />
            </div>
            <AiCoachInfoModal isOpen={isAiInfoOpen} onClose={() => setIsAiInfoOpen(false)} />
        </div>
    );
};

export const SuperAdminScreen: React.FC<SuperAdminScreenProps> = (props) => {
    const { organization, theme, onSaveGlobalConfig, workouts, onSaveWorkout, onSelectMember, userRole } = props;
    const { selectOrganization } = useStudio();
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false); 
    
    const [config, setConfig] = useState<StudioConfig>(organization.globalConfig);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    const [admins, setAdmins] = useState<UserData[]>([]);
    const [coaches, setCoaches] = useState<UserData[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    
    const [passProgramSubView, setPassProgramSubView] = useState<'hub' | 'ai' | 'builder'>('hub');
    const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
    const [isNewDraft, setIsNewDraft] = useState(false);
    const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage'>('generate');
    const [autoExpandCategory, setAutoExpandCategory] = useState<string | null>(null);
    
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
    
    const isCompanyDetailsIncomplete = (org: Organization): boolean => {
        return !org.companyDetails?.legalName?.trim() || !org.companyDetails?.orgNumber?.trim();
    };

    const onboardingSkippedKey = `onboardingSkipped_${organization.id}`;

    useEffect(() => {
        if (organization && isCompanyDetailsIncomplete(organization)) {
            const hasSkipped = sessionStorage.getItem(onboardingSkippedKey);
            if (hasSkipped) {
                setShowOnboardingBanner(true);
            } else {
                setShowOnboardingModal(true);
            }
        } else {
            setShowOnboardingModal(false);
            setShowOnboardingBanner(false);
        }
    }, [organization, onboardingSkippedKey]);
    
    const handleUpdateCompanyDetails = async (details: CompanyDetails) => {
        try {
            // Check if onUpdateOrganizationCompanyDetails exists in props
            if (props.onUpdateOrganizationCompanyDetails) {
                await props.onUpdateOrganizationCompanyDetails(organization.id, details);
            } else {
                // Fallback to updating details through the organization service if needed
                const { updateOrganizationCompanyDetails: updateService } = await import('../services/firebaseService');
                const updatedOrg = await updateService(organization.id, details);
                selectOrganization(updatedOrg);
            }
            setShowOnboardingModal(false);
            setShowOnboardingBanner(false);
            sessionStorage.removeItem(onboardingSkippedKey);
        } catch (e) {
            alert("Kunde inte spara uppgifterna. Försök igen.");
            throw e;
        }
    };

    const handleSkipOnboarding = () => {
        sessionStorage.setItem(onboardingSkippedKey, 'true');
        setShowOnboardingModal(false);
        setShowOnboardingBanner(true);
    };

    useEffect(() => {
        setConfig(organization.globalConfig);
    }, [organization]);

    useEffect(() => {
        if (activeTab !== 'pass-program') {
            setPassProgramSubView('hub');
        }
    }, [activeTab]);

    useEffect(() => {
        const fetchData = async () => {
            setUsersLoading(true);
            try {
                const [fetchedAdmins, fetchedCoaches] = await Promise.all([
                    getAdminsForOrganization(organization.id),
                    getCoachesForOrganization(organization.id)
                ]);
                setAdmins(fetchedAdmins);
                setCoaches(fetchedCoaches);
            } catch (error) {
                console.error("Failed to fetch users:", error);
            } finally {
                setUsersLoading(false);
            }
        };
        fetchData();
    }, [organization.id]);

    const handleUpdateConfigField = <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => {
        setConfig(prevConfig => ({ ...prevConfig, [key]: value }));
    };

    const handleSaveConfig = async (configOverride?: StudioConfig) => {
        setIsSavingConfig(true);
        try {
            await onSaveGlobalConfig(organization.id, configOverride || config);
            alert("Inställningar sparade!");
        } catch (error) {
            console.error(error);
            alert("Kunde inte spara inställningar.");
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleQuickGenerate = async (prompt: string) => {
        try {
            const generatedWorkout = await generateWorkout(prompt, workouts);
            setWorkoutToEdit(generatedWorkout);
            setIsNewDraft(true);
            
            // Only switch views after the data is ready.
            setActiveTab('pass-program');
            setPassProgramSubView('builder');
        } catch(e) {
            alert("Kunde inte generera pass. Försök igen.");
        }
    };

    const isConfigDirty = JSON.stringify(config) !== JSON.stringify(organization.globalConfig);

    const configProps: ConfigProps = {
        config,
        isSavingConfig,
        setIsSavingConfig, // Pass down the function
        isConfigDirty,
        handleUpdateConfigField,
        handleSaveConfig
    };
    
    const displayLogoUrl = theme === 'dark' 
        ? (organization.logoUrlDark || organization.logoUrlLight)
        : (organization.logoUrlLight || organization.logoUrlDark);

    const navItems = useMemo(() => {
        const allItems: NavElement[] = [
            { type: 'link', id: 'dashboard', label: 'Översikt', icon: HomeIcon },
            { type: 'link', id: 'analytics', label: 'Analys & Trender', icon: ChartBarIcon },
            { type: 'header', label: 'Innehåll' },
            { type: 'link', id: 'pass-program', label: 'Pass & Program', icon: DumbbellIcon },
            { type: 'link', id: 'infosidor', label: 'Infosidor', icon: DocumentTextIcon },
            { type: 'link', id: 'info-karusell', label: 'Info-karusell', icon: SpeakerphoneIcon },
            { type: 'link', id: 'medlemmar', label: 'Medlemmar', icon: UsersIcon },
            { type: 'header', label: 'Inställningar' },
            { type: 'link', id: 'globala-installningar', label: 'Globala Inställningar', icon: SettingsIcon },
            { type: 'link', id: 'studios', label: 'Skärmar', icon: BuildingIcon },
            { type: 'link', id: 'varumarke', label: 'Varumärke & Säkerhet', icon: SparklesIcon },
            { type: 'link', id: 'company-info', label: 'Företagsinformation', icon: BriefcaseIcon },
            { type: 'link', id: 'anvandare', label: 'Användare', icon: UsersIcon },
        ];

        if (userRole === 'coach') {
            // Filter out admin-only settings
            return allItems.filter(item => {
                if (item.type === 'header' && item.label === 'Inställningar') return false;
                if (item.type === 'link') {
                    return !['globala-installningar', 'studios', 'varumarke', 'company-info', 'anvandare'].includes(item.id);
                }
                return true;
            });
        }
        
        return allItems;
    }, [userRole]);
    
    const mainContentWrapperClass = useMemo(() => {
        if (activeTab === 'pass-program' && passProgramSubView === 'builder') {
            return ''; 
        }
        return 'max-w-5xl mx-auto';
    }, [activeTab, passProgramSubView]);

    const isLoggingEnabled = organization.globalConfig.enableWorkoutLogging === true;

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="space-y-8">
                        {/* --- INBJUDNINGSSEKTION PÅ DASHBOARD --- */}
                        {isLoggingEnabled && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Bjud in medlemmar</h2>
                                <p className="text-gray-500 text-sm mb-6">
                                    Använd denna QR-kod eller inbjudningskod för att låta dina medlemmar skapa konto i appen och kopplas till ditt gym.
                                </p>
                                
                                {organization.inviteCode ? (
                                    <div className="flex flex-col sm:flex-row gap-8 items-center">
                                        <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
                                            <QRCode value={organization.inviteCode} size={150} />
                                        </div>
                                        <div className="flex-1 w-full text-center sm:text-left">
                                            <div className="mb-4">
                                                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Inbjudningskod</label>
                                                <div className="text-3xl font-mono font-bold text-primary tracking-widest mt-1 select-all">
                                                    {organization.inviteCode}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(organization.inviteCode || '')}
                                                className="text-sm font-medium text-primary hover:text-primary/80 flex items-center justify-center sm:justify-start gap-2 bg-primary/10 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
                                            >
                                                <CopyIcon className="w-4 h-4" /> Kopiera kod
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                        <p className="text-gray-500 text-sm mb-4">Ingen inbjudningskod är skapad än. Du kan skapa en genom att aktivera Passloggning i de globala inställningarna.</p>
                                        <button 
                                            onClick={() => setActiveTab('globala-installningar')}
                                            className="text-primary font-bold hover:underline"
                                        >
                                            Gå till inställningar &rarr;
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <DashboardContent 
                            {...props} 
                            setActiveTab={setActiveTab} 
                            admins={admins} 
                            coaches={coaches} 
                            usersLoading={usersLoading}
                            onQuickGenerate={handleQuickGenerate}
                        />
                    </div>
                );
            case 'analytics':
                if (!isLoggingEnabled) {
                    return (
                        <FeatureLockedView 
                            title="Lås upp Analys & Trender 📊"
                            description="Få djupa insikter i hur dina medlemmar presterar och mår. Se trender över tid och optimera ditt träningsutbud."
                            features={[
                                "Visualisera medlemsaktivitet per vecka/månad",
                                "Se snitt-RPE och känsla för olika passkategorier",
                                "Identifiera populära övningar och utmaningar",
                                "AI-genererade trendspaningar för hela gymmet"
                            ]}
                            onGoToSettings={() => setActiveTab('globala-installningar')}
                        />
                    );
                }
                return <AdminAnalyticsScreen />;
            case 'pass-program':
                return <PassProgramContent
                            {...props}
                            subView={passProgramSubView}
                            setSubView={setPassProgramSubView}
                            workoutToEdit={workoutToEdit}
                            setWorkoutToEdit={setWorkoutToEdit}
                            isNewDraft={isNewDraft}
                            setIsNewDraft={setIsNewDraft}
                            aiGeneratorInitialTab={aiGeneratorInitialTab}
                            setAiGeneratorInitialTab={setAiGeneratorInitialTab}
                            autoExpandCategory={autoExpandCategory}
                            setAutoExpandCategory={setAutoExpandCategory}
                            onReturnToHub={() => {
                                setPassProgramSubView('hub');
                                setWorkoutToEdit(null);
                                setIsNewDraft(false);
                            }}
                        />;
            case 'infosidor':
                return <InfosidorContent {...props} />;
            case 'info-karusell':
                return <InfoKarusellContent {...props} />;
            case 'medlemmar':
                if (!isLoggingEnabled) {
                    return (
                        <FeatureLockedView 
                            title="Lås upp Medlemsregistret 👥"
                            description="Håll koll på dina medlemmar, deras personliga mål och träningshistorik på ett och samma ställe."
                            features={[
                                "Samla alla medlemmar i en snygg lista",
                                "Se individuella mål och deadlinas",
                                "Få AI-analys av enskilda medlemmars styrkor/svagheter",
                                "Styr medlemskapets giltighetstid och status"
                            ]}
                            onGoToSettings={() => setActiveTab('globala-installningar')}
                        />
                    );
                }
                return <MemberManagementScreen onSelectMember={onSelectMember} />;
            case 'globala-installningar':
                return <GlobalaInställningarContent {...props} {...configProps} />;
            case 'studios':
                return <StudiosContent {...props} />;
            case 'varumarke':
                return <VarumarkeContent {...props} />;
            case 'company-info':
                return <CompanyInfoContent organization={organization} onEdit={() => setShowOnboardingModal(true)} />;
            case 'anvandare':
                return <AnvandareContent {...props} admins={admins} coaches={coaches} isLoading={usersLoading} />;
            case 'ovningsbank':
                return <OvningsbankContent />;
            default:
                return null;
        }
    };

    return (
         <div className="w-full h-screen bg-gray-50 dark:bg-black flex flex-col overflow-hidden">
            {/* --- TOP HEADER --- */}
            <header className="h-16 flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title={isSidebarCollapsed ? "Expandera meny" : "Fäll ihop meny"}
                    >
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    {displayLogoUrl ? (
                        <img src={displayLogoUrl} alt={`${organization.name} logotyp`} className="max-h-8 object-contain" />
                    ) : (
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">{organization.name}</h1>
                    )}
                </div>
            </header>

            {/* --- MAIN LAYOUT (Sidebar + Content) --- */}
            <div className="flex flex-1 overflow-hidden">
                {/* --- SIDEBAR --- */}
                <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 hidden lg:flex flex-col transition-all duration-300 ease-in-out`}>
                    <nav className="flex-grow overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {navItems.map((item, index) => {
                            if (item.type === 'header') {
                                if (isSidebarCollapsed) {
                                    return <div key={index} className="h-px bg-gray-200 dark:bg-gray-800 my-4 mx-2" />;
                                }
                                return <h3 key={index} className="px-3 pt-5 pb-2 text-[11px] font-bold uppercase text-gray-400 tracking-widest whitespace-nowrap overflow-hidden">{item.label}</h3>
                            }
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    title={isSidebarCollapsed ? item.label : undefined}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm w-full group ${
                                        activeTab === item.id
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                                    } ${isSidebarCollapsed ? 'justify-center' : 'text-left'}`}
                                    role="tab"
                                    aria-selected={activeTab === item.id}
                                >
                                    <item.icon className={`w-5 h-5 flex-shrink-0 transition-colors ${activeTab === item.id ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                                    {!isSidebarCollapsed && <span className="whitespace-nowrap overflow-hidden">{item.label}</span>}
                                </button>
                            );
                        })}
                    </nav>
                </aside>
                
                {/* --- MAIN CONTENT AREA --- */}
                <main className="flex-grow p-4 sm:p-8 lg:p-10 overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto">
                        {showOnboardingBanner && (
                            <div className="bg-yellow-100 border border-yellow-200 text-yellow-800 p-4 text-center mb-8 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-center gap-2 animate-fade-in">
                                <span>⚠️ Er företagsinformation är ofullständig.</span>
                                <button onClick={() => setShowOnboardingModal(true)} className="font-bold underline hover:text-yellow-900">Klicka här för att komplettera.</button>
                            </div>
                        )}
                        <div className={mainContentWrapperClass}>
                            {activeTab !== 'dashboard' && (
                                <button
                                    onClick={() => setActiveTab('dashboard')}
                                    className="lg:hidden mb-6 flex items-center gap-2 text-gray-600 hover:text-primary transition-colors font-medium text-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    <span>Tillbaka till översikt</span>
                                </button>
                            )}
                            {renderContent()}
                            
                            {activeTab !== 'company-info' && activeTab !== 'pass-program' && (
                                <SwitchToStudioView 
                                    organization={props.organization} 
                                    onSwitchToStudioView={props.onSwitchToStudioView} 
                                />
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {showOnboardingModal && (
                <CompanyDetailsOnboardingModal 
                    isOpen={showOnboardingModal}
                    initialDetails={organization.companyDetails}
                    onSave={handleUpdateCompanyDetails}
                    onSkip={handleSkipOnboarding}
                />
            )}
        </div>
    );
};

interface NavElement {
    type: 'header' | 'link';
    label: string;
    id?: AdminTab;
    icon?: any;
}
