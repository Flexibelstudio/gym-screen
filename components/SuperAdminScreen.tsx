
import React, { useState, useEffect, useMemo } from 'react';
import { StudioConfig, Studio, Organization, CustomPage, Page, UserData, UserRole, InfoCarousel, DisplayWindow, Workout, CompanyDetails } from '../types';
import { ToggleSwitch, HomeIcon, DocumentTextIcon, SpeakerphoneIcon, SparklesIcon, UsersIcon, DumbbellIcon, BriefcaseIcon, BuildingIcon, SettingsIcon } from './icons';
import { getAdminsForOrganization, getCoachesForOrganization, updateOrganizationCompanyDetails } from '../services/firebaseService';
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

type AdminTab = 
    'dashboard' | 
    'pass-program' | 'infosidor' | 'info-karusell' |
    'globala-installningar' | 'studios' | 'varumarke' | 'company-info' |
    'anvandare' | 'ovningsbank';

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
    onUpdateOrganization: (organizationId: string, name: string, subdomain: string) => Promise<void>;
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
}

interface ConfigProps {
    config: StudioConfig;
    isSavingConfig: boolean;
    isConfigDirty: boolean;
    handleUpdateConfigField: <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => void;
    handleSaveConfig: (configOverride?: StudioConfig) => Promise<void>;
}

interface NavItem {
    type: 'link';
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}
interface NavHeader {
    type: 'header';
    label: string;
}
type NavElement = NavItem | NavHeader;

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
                            För att lägga till nya coacher eller administratörer, skicka ett mail till <a href="mailto:info@flexibel.app" className="underline hover:text-indigo-900 font-semibold">support@flexibel.app</a>. 
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

const AiCoachInfoContent: React.FC<{ onReadMoreClick?: () => void }> = ({ onReadMoreClick }) => (
    <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex-shrink-0">
            <SparklesIcon className="w-6 h-6" />
        </div>
        <div>
            <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-1">AI Coach – Din digitala kollega</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
                AI Coach analyserar dina pass och ger feedback på balans, variation och återhämtning. Den hjälper dig att säkerställa hög kvalitet på träningen.
            </p>
            {onReadMoreClick && (
                <button onClick={onReadMoreClick} className="text-primary font-semibold text-sm hover:underline">
                    Läs mer om hur det fungerar
                </button>
            )}
        </div>
    </div>
);

const AiCoachInfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Om AI Coach" size="md">
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>AI Coach är systemets intelligenta assistent som bygger på Googles Gemini-modell. Den är tränad för att förstå träningslogik, övningsstruktur och progression.</p>
            <h5 className="font-bold text-gray-900 dark:text-white">Funktioner:</h5>
            <ul className="list-disc list-inside space-y-1">
                <li>Skapar nya pass med "studions stil".</li>
                <li>Ger "Magic Pen"-förslag för att finjustera block.</li>
                <li>Ger feedback på intensitet och balans.</li>
            </ul>
        </div>
      </Modal>
    );
};

const GlobalaInställningarContent: React.FC<SuperAdminScreenProps & ConfigProps> = ({ config, isSavingConfig, isConfigDirty, handleUpdateConfigField, handleSaveConfig }) => {
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch label="HYROX-modul" checked={!!config.enableHyrox} onChange={(checked) => handleUpdateConfigField('enableHyrox', checked)} />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Aktiverar verktyg för tävlingar och HYROX-pass.</p>
                        </div>
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
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Passkategorier & AI</h4>
                    <CategoryPromptManager
                        categories={config.customCategories}
                        onCategoriesChange={(newCats) => handleUpdateConfigField('customCategories', newCats)}
                        isSaving={isSavingConfig}
                    />
                </section>
            </div>
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
    const { organization, theme, onSaveGlobalConfig, workouts, onSaveWorkout } = props;
    const { selectOrganization } = useStudio();
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    
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
            const updatedOrg = await updateOrganizationCompanyDetails(organization.id, details);
            selectOrganization(updatedOrg); 
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
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleQuickGenerate = async (prompt: string) => {
        // NOTE: We must generate the workout *before* switching tabs.
        // If we switch tabs immediately, the WorkoutBuilder mounts with a null 'workoutToEdit', 
        // creating a race condition where the user sees an empty builder before the AI finishes.
        // The dashboard UI will handle the 'isLoading' state during this wait.
        try {
            const generatedWorkout = await generateWorkout(prompt, workouts);
            setWorkoutToEdit(generatedWorkout);
            setIsNewDraft(true);
            
            // Only switch views after the data is ready.
            setActiveTab('pass-program');
            setPassProgramSubView('builder');
        } catch(e) {
            alert("Kunde inte generera pass. Försök igen.");
            // Stay on dashboard on error
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

    const navItems: NavElement[] = [
        { type: 'link', id: 'dashboard', label: 'Översikt', icon: HomeIcon },
        { type: 'header', label: 'Innehåll' },
        { type: 'link', id: 'pass-program', label: 'Pass & Program', icon: DumbbellIcon },
        { type: 'link', id: 'infosidor', label: 'Infosidor', icon: DocumentTextIcon },
        { type: 'link', id: 'info-karusell', label: 'Info-karusell', icon: SpeakerphoneIcon },
        { type: 'header', label: 'Inställningar' },
        { type: 'link', id: 'globala-installningar', label: 'Globala Inställningar', icon: SettingsIcon },
        { type: 'link', id: 'studios', label: 'Skärmar', icon: BuildingIcon },
        { type: 'link', id: 'varumarke', label: 'Varumärke & Säkerhet', icon: SparklesIcon },
        { type: 'link', id: 'company-info', label: 'Företagsinformation', icon: BriefcaseIcon },
        { type: 'link', id: 'anvandare', label: 'Användare', icon: UsersIcon },
    ];
    
    const mainContentWrapperClass = useMemo(() => {
        if (activeTab === 'pass-program' && passProgramSubView === 'builder') {
            return ''; 
        }
        return 'max-w-5xl mx-auto';
    }, [activeTab, passProgramSubView]);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <DashboardContent 
                            {...props} 
                            setActiveTab={setActiveTab} 
                            admins={admins} 
                            coaches={coaches} 
                            usersLoading={usersLoading}
                            onQuickGenerate={handleQuickGenerate}
                        />;
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
         <div className="w-full max-w-screen-2xl mx-auto flex bg-gray-50 dark:bg-black min-h-screen">
            <aside className="w-72 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 hidden lg:flex flex-col sticky top-0 h-screen shadow-sm z-10">
                <div className="flex-shrink-0 h-20 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
                    {displayLogoUrl ? (
                        <img src={displayLogoUrl} alt={`${organization.name} logotyp`} className="max-h-10 object-contain" />
                    ) : (
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">{organization.name}</h1>
                    )}
                </div>
                <nav className="flex-grow overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    {navItems.map((item, index) => {
                        if (item.type === 'header') {
                            return <h3 key={index} className="px-3 pt-5 pb-2 text-[11px] font-bold uppercase text-gray-400 tracking-widest">{item.label}</h3>
                        }
                        return (
                             <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all font-medium text-sm w-full group ${
                                    activeTab === item.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                                }`}
                                 role="tab"
                                 aria-selected={activeTab === item.id}
                            >
                                <item.icon className={`w-5 h-5 flex-shrink-0 transition-colors ${activeTab === item.id ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </aside>
            
            <main className="flex-grow p-4 sm:p-8 lg:p-10 overflow-x-hidden">
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
            </main>
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
