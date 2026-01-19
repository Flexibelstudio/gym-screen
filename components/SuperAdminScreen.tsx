
import React, { useState, useEffect, useMemo } from 'react';
import { StudioConfig, Studio, Organization, CustomPage, UserData, UserRole, InfoCarousel, DisplayWindow, Workout, CompanyDetails } from '../types';
import { HomeIcon, DocumentTextIcon, SpeakerphoneIcon, UsersIcon, DumbbellIcon, BriefcaseIcon, BuildingIcon, SettingsIcon, ChartBarIcon, CopyIcon, CloseIcon, SparklesIcon } from './icons';
import { getAdminsForOrganization, getCoachesForOrganization } from '../services/firebaseService';
import { OvningsbankContent } from './OvningsbankContent';
import { useStudio } from '../context/StudioContext';
import { CompanyDetailsOnboardingModal } from './CompanyDetailsOnboardingModal';
import { Toast } from './ui/Notification';
import { DashboardContent, PassProgramContent } from './admin/DashboardContent';
import { StudiosContent } from './admin/StudiosContent';
import { InfosidorContent } from './admin/InfosidorContent';
import { InfoKarusellContent } from './admin/InfoKarusellContent';
import { VarumarkeContent } from './admin/VarumarkeContent';
import { CompanyInfoContent } from './admin/CompanyInfoContent';
import { generateWorkout } from '../services/geminiService';
import { MemberManagementScreen } from './MemberManagementScreen';
import { AdminAnalyticsScreen } from './AdminAnalyticsScreen';
import QRCode from "react-qr-code"; 
import { motion, AnimatePresence } from 'framer-motion';

// --- Importerade refaktorerade moduler ---
import { GlobalSettingsContent } from './admin/GlobalSettingsContent';
import { PricingModal } from './admin/AdminModals';
import { FeatureLockedView } from './admin/FeatureLockedView';
import { SwitchToStudioView } from './admin/SwitchToStudioView';

const MenuIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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
    'ovningsbank' | 'analytics';

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
    onUpdateFavicon: (organizationId: string, faviconUrl: string) => Promise<void>;
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
    onDuplicateWorkout: (workout: Workout) => void;
    onSelectMember: (memberId: string) => void;
    onBack?: () => void;
    onGoToSystemOwner?: () => void;
    initialTab?: string;
}

export const SuperAdminScreen: React.FC<SuperAdminScreenProps> = (props) => {
    const { organization, theme, onSaveGlobalConfig, workouts, onSelectMember, userRole, onBack, onGoToSystemOwner, initialTab, onDuplicateWorkout } = props;
    const { selectOrganization, studioLoading } = useStudio();
    const [activeTab, setActiveTab] = useState<AdminTab>((initialTab as AdminTab) || 'dashboard');
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false); 
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab as AdminTab);
        }
    }, [initialTab]);

    const [config, setConfig] = useState<StudioConfig>(organization.globalConfig);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    const [admins, setAdmins] = useState<UserData[]>([]);
    const [coaches, setCoaches] = useState<UserData[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    
    const [passProgramSubView, setPassProgramSubView] = useState<'hub' | 'ai' | 'builder' | 'manage'>('hub');
    const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
    const [isNewDraft, setIsNewDraft] = useState(false);
    const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage'>('generate');
    const [autoExpandCategory, setAutoExpandCategory] = useState<string | null>(null);
    
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
    
    const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });
    
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

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
            if (props.onUpdateOrganizationCompanyDetails) {
                await props.onUpdateOrganizationCompanyDetails(organization.id, details);
            } else {
                const { updateOrganizationCompanyDetails: updateService } = await import('../services/firebaseService');
                const updatedOrg = await updateService(organization.id, details);
                selectOrganization(updatedOrg);
            }
            setShowOnboardingModal(false);
            setShowOnboardingBanner(false);
            sessionStorage.removeItem(onboardingSkippedKey);
            setToast({ message: "Uppgifter sparade!", visible: true });
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
            setToast({ message: "Inställningar sparade!", visible: true });
        } catch (error) {
            console.error(error);
            setToast({ message: "Kunde inte spara inställningar.", visible: true });
        } finally {
            setIsSavingConfig(false);
        }
    };
    
    const handleEnablePaidFeatures = async () => {
        setIsSavingConfig(true);
        try {
            if (!organization.inviteCode) {
                const newCode = generateInviteCode();
                await props.onUpdateOrganization(organization.id, organization.name, organization.subdomain, newCode);
            }
            const newConfig = { ...organization.globalConfig, enableWorkoutLogging: true };
            setConfig(newConfig); 
            await handleSaveConfig(newConfig); 
            setIsUpgradeModalOpen(false);
            setToast({ message: "Funktioner aktiverade! 🎉", visible: true });
        } catch (error) {
            console.error("Failed to enable features:", error);
            setToast({ message: "Ett fel uppstod.", visible: true });
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleGenerateNewInviteCode = async () => {
        const newCode = generateInviteCode();
        await props.onUpdateOrganization(organization.id, organization.name, organization.subdomain, newCode);
        setToast({ message: "Ny kod skapad!", visible: true });
    };

    const handleQuickGenerate = async (prompt: string) => {
        try {
            const generatedWorkout = await generateWorkout(prompt, workouts);
            setWorkoutToEdit(generatedWorkout);
            setIsNewDraft(true);
            setActiveTab('pass-program');
            setPassProgramSubView('builder');
        } catch(e) {
            setToast({ message: "Kunde inte generera pass. Försök igen.", visible: true });
        }
    };

    const isConfigDirty = JSON.stringify(config) !== JSON.stringify(organization.globalConfig);

    const displayLogoUrl = theme === 'dark' 
        ? (organization.logoUrlDark || organization.logoUrlLight)
        : (organization.logoUrlLight || organization.logoUrlDark);

    const navItems = useMemo(() => {
        const allItems: any[] = [
            { type: 'link', id: 'dashboard', label: 'Översikt', icon: HomeIcon },
            { type: 'link', id: 'analytics', label: 'Analys & Trender', icon: ChartBarIcon },
            { type: 'header', label: 'Innehåll' },
            { type: 'link', id: 'pass-program', label: 'Pass & Program', icon: DumbbellIcon },
            { type: 'link', id: 'infosidor', label: 'Infosidor', icon: DocumentTextIcon },
            { type: 'link', id: 'info-karusell', label: 'Info-karusell', icon: SpeakerphoneIcon },
            { type: 'link', id: 'medlemmar', label: 'Team & Medlemmar', icon: UsersIcon },
            { type: 'header', label: 'Inställningar' },
            { type: 'link', id: 'globala-installningar', label: 'Globala Inställningar', icon: SettingsIcon },
            { type: 'link', id: 'studios', label: 'Skärmar', icon: BuildingIcon },
            { type: 'link', id: 'varumarke', label: 'Varumärke & Säkerhet', icon: SparklesIcon },
            { type: 'link', id: 'company-info', label: 'Företagsinformation', icon: BriefcaseIcon }
        ];

        if (userRole === 'coach') {
            return allItems.filter(item => {
                if (item.type === 'header' && item.label === 'Inställningar') return false;
                if (item.type === 'link') {
                    return !['globala-installningar', 'studios', 'varumarke', 'company-info'].includes(item.id);
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

    const handleMenuIconClick = () => {
        if (window.innerWidth < 1024) {
            setIsMobileMenuOpen(true);
        } else {
            setSidebarCollapsed(!isSidebarCollapsed);
        }
    };

    const handleNavClick = (tabId: AdminTab) => {
        setActiveTab(tabId);
        setIsMobileMenuOpen(false);
    };

    const renderNavItems = (isMobile: boolean) => (
        <nav className="flex-grow overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {navItems.map((item, index) => {
                if (item.type === 'header') {
                    if (isSidebarCollapsed && !isMobile) {
                        return <div key={index} className="h-px bg-gray-200 dark:bg-gray-800 my-4 mx-2" />;
                    }
                    return <h3 key={index} className="px-3 pt-5 pb-2 text-[11px] font-bold uppercase text-gray-400 tracking-widest whitespace-nowrap overflow-hidden">{item.label}</h3>
                }
                return (
                    <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id!)}
                        title={isSidebarCollapsed && !isMobile ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all font-bold text-sm w-full group ${
                            activeTab === item.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                        } ${isSidebarCollapsed && !isMobile ? 'justify-center' : 'text-left'}`}
                        role="tab"
                        aria-selected={activeTab === item.id}
                    >
                        <item.icon className={`w-6 h-6 flex-shrink-0 transition-colors ${activeTab === item.id ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                        {(!isSidebarCollapsed || isMobile) && <span className="whitespace-nowrap overflow-hidden text-base">{item.label}</span>}
                    </button>
                );
            })}
        </nav>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                const qrUrl = organization.inviteCode ? `${window.location.origin}/?invite=${organization.inviteCode}` : '';
                return (
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in">
                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                <div className="bg-white p-4 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col items-center shrink-0">
                                    {qrUrl ? (
                                        <>
                                            <QRCode value={qrUrl} size={160} fgColor="#000000" bgColor="#ffffff" level="M" />
                                            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Skanna för att ansluta</p>
                                        </>
                                    ) : (
                                        <div className="w-[160px] h-[160px] bg-gray-100 rounded-xl flex items-center justify-center text-gray-300">
                                            <SparklesIcon className="w-10 h-10" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 w-full text-center sm:text-left">
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight uppercase">Bjud in team & medlemmar</h2>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-lg">
                                        Använd denna QR-kod eller inbjudningskod för att låta dina medlemmar skapa konto i appen och kopplas direkt till {organization.name}.
                                    </p>
                                    {organization.inviteCode ? (
                                        <div className="flex flex-col sm:flex-row items-center gap-4">
                                            <div className="bg-gray-5 dark:bg-gray-900/50 px-8 py-3 rounded-2xl border-2 border-primary/20 shadow-inner">
                                                <span className="text-4xl font-black font-mono tracking-[0.15em] text-primary">{organization.inviteCode}</span>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(organization.inviteCode || '');
                                                    setToast({ message: "Kod kopierad!", visible: true });
                                                }}
                                                className="text-sm font-black text-primary hover:bg-primary/10 px-5 py-3 rounded-xl transition-all uppercase tracking-widest"
                                            >
                                                <CopyIcon className="w-4 h-4 inline mr-2" /> Kopiera
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center bg-gray-5 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                            <button onClick={handleGenerateNewInviteCode} className="bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-md hover:brightness-110">Generera inbjudningskod nu</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DashboardContent {...props} setActiveTab={setActiveTab} admins={admins} coaches={coaches} usersLoading={usersLoading} onQuickGenerate={handleQuickGenerate} />
                    </div>
                );
            case 'analytics':
                if (!organization.globalConfig.enableWorkoutLogging) {
                    return (
                        <FeatureLockedView 
                            title="Analys & Trender ingår i Passloggning 🚀"
                            description="Få djupa insikter i hur dina medlemmar presterar och mår. Se trender över tid och optimera ditt träningsutbud."
                            features={["Fullständig passanalys 📊", "Medlemsregister 👥", "Generera intäkter 💰", "AI-Coaching för medlemmar 🤖"]}
                            onActivate={() => setIsUpgradeModalOpen(true)}
                        />
                    );
                }
                return <AdminAnalyticsScreen />;
            case 'pass-program':
                return <PassProgramContent {...props} subView={passProgramSubView} setSubView={setPassProgramSubView} workoutToEdit={workoutToEdit} setWorkoutToEdit={setWorkoutToEdit} isNewDraft={isNewDraft} setIsNewDraft={setIsNewDraft} aiGeneratorInitialTab={aiGeneratorInitialTab} setAiGeneratorInitialTab={setAiGeneratorInitialTab} autoExpandCategory={autoExpandCategory} setAutoExpandCategory={setAutoExpandCategory} onReturnToHub={() => { setPassProgramSubView('hub'); setWorkoutToEdit(null); setIsNewDraft(false); }} onDuplicateWorkout={onDuplicateWorkout} />;
            case 'infosidor':
                return <InfosidorContent {...props} />;
            case 'info-karusell':
                return <InfoKarusellContent {...props} />;
            case 'medlemmar':
                return <MemberManagementScreen onSelectMember={onSelectMember} />;
            case 'globala-installningar':
                return <GlobalSettingsContent {...props} config={config} isSavingConfig={isSavingConfig} isConfigDirty={isConfigDirty} handleUpdateConfigField={handleUpdateConfigField} handleSaveConfig={handleSaveConfig} onTriggerUpgrade={() => setIsUpgradeModalOpen(true)} />;
            case 'studios':
                return <StudiosContent {...props} />;
            case 'varumarke':
                return <VarumarkeContent organization={organization} onUpdatePasswords={props.onUpdatePasswords} onUpdateLogos={props.onUpdateLogos} onUpdateFavicon={props.onUpdateFavicon} onUpdatePrimaryColor={props.onUpdatePrimaryColor} onShowToast={(msg) => setToast({ message: msg, visible: true })} />;
            case 'company-info':
                return <CompanyInfoContent organization={organization} onEdit={() => setShowOnboardingModal(true)} />;
            case 'ovningsbank':
                return <OvningsbankContent />;
            default:
                return null;
        }
    };

    return (
         <div className="w-full h-screen bg-gray-50 dark:bg-black flex flex-col overflow-hidden">
            <Toast isVisible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
            <header className="h-16 flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={handleMenuIconClick} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Meny"><MenuIcon className="w-6 h-6" /></button>
                    {userRole === 'systemowner' && (<button onClick={onGoToSystemOwner || onBack} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-xs border border-gray-200 dark:border-gray-700 mr-2">&larr; Systemvy</button>)}
                    {studioLoading ? (<div className="h-8 w-24 bg-transparent"></div>) : displayLogoUrl ? (<img src={displayLogoUrl} alt={`${organization.name} logotyp`} className="max-h-8 object-contain" />) : (<h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">{organization.name}</h1>)}
                </div>
            </header>
            <div className="flex flex-1 overflow-hidden relative">
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
                            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-gray-900 z-[70] lg:hidden shadow-2xl flex flex-col">
                                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center"><h3 className="font-black text-gray-900 dark:text-white tracking-tighter uppercase text-sm">Administration</h3><button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 p-2"><CloseIcon className="w-6 h-6" /></button></div>
                                {renderNavItems(true)}
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>
                <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 hidden lg:flex flex-col transition-all duration-300 ease-in-out`}>{renderNavItems(false)}</aside>
                <main className="flex-grow p-4 sm:p-8 lg:p-10 overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto">
                        {showOnboardingBanner && (<div className="bg-yellow-100 border border-yellow-200 text-yellow-800 p-4 text-center mb-8 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-center gap-2 animate-fade-in"><span>⚠️ Er företagsinformation är ofullständig.</span><button onClick={() => setShowOnboardingModal(true)} className="font-bold underline hover:text-yellow-900">Klicka här för att komplettera.</button></div>)}
                        <div className={mainContentWrapperClass}>
                            {renderContent()}
                            {activeTab !== 'company-info' && activeTab !== 'pass-program' && (<SwitchToStudioView organization={props.organization} onSwitchToStudioView={props.onSwitchToStudioView} />)}
                        </div>
                    </div>
                </main>
            </div>
            {showOnboardingModal && (<CompanyDetailsOnboardingModal isOpen={showOnboardingModal} initialDetails={organization.companyDetails} onSave={handleUpdateCompanyDetails} onSkip={handleSkipOnboarding} />)}
            <PricingModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} onConfirm={handleEnablePaidFeatures} isProcessing={isSavingConfig} />
        </div>
    );
};
