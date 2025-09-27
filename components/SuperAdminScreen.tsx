import React, { useState, useEffect, useRef, useMemo } from 'react';
// FIX: Removed unused 'EquipmentItem' type from imports to fix compilation error.
import { StudioConfig, Studio, Organization, CustomPage, CustomCategoryWithPrompt, Page, UserData, UserRole, InfoCarousel, InfoMessage, DisplayWindow, DisplayPost, Workout, CompanyDetails } from '../types';
import { ToggleSwitch, HomeIcon, DocumentTextIcon, SpeakerphoneIcon, SparklesIcon, UsersIcon, DumbbellIcon, BriefcaseIcon } from './icons';
import { getAdminsForOrganization, setAdminRole, getCoachesForOrganization, uploadImage, updateOrganizationCompanyDetails } from '../services/firebaseService';
import { inviteUserCall } from '../services/inviteUser';
import { AIGeneratorScreen } from './AIGeneratorScreen';
import { WorkoutBuilderScreen } from './WorkoutBuilderScreen';
import { OvningsbankContent } from './OvningsbankContent';
import { generateCarouselImage } from '../services/geminiService';
import { useStudio } from '../context/StudioContext';
import { CompanyDetailsOnboardingModal } from './CompanyDetailsOnboardingModal';

const AILoadingSpinner: React.FC = () => (
    <div className="relative w-8 h-8">
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
    </div>
);

// --- Sidebar Icons ---
const SettingsIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
const InfoIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const DisplayIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);
const BuildingIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
);

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

            // Force JPEG conversion by drawing on a white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Always convert to JPEG for consistent compression and size reduction
            const dataUrl = canvas.toDataURL('image/jpeg', quality);

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
  onImageChange: (url: string) => void;
  disabled?: boolean;
  organizationId: string;
}> = ({ imageUrl, onImageChange, disabled, organizationId }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (disabled || !file || !file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
        const resizedBase64Image = await resizeImage(file, 1280, 1280, 0.75);
        const path = `organizations/${organizationId}/content_images/${Date.now()}-${file.name}`;
        const downloadURL = await uploadImage(path, resizedBase64Image);
        onImageChange(downloadURL);
    } catch (error) {
        console.error("Image upload failed:", error);
        alert("Bilden kunde inte laddas upp. Försök med en annan bild.");
    } finally {
        setIsUploading(false);
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
      {isUploading && (
        <div className="absolute inset-0 bg-gray-900/80 rounded-md z-10 flex flex-col items-center justify-center gap-2">
            <AILoadingSpinner />
            <p className="text-sm font-semibold text-gray-300">Laddar upp...</p>
        </div>
      )}
      <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e.target.files?.[0] || null)} accept="image/*" className="hidden" disabled={disabled} />
      <div className="text-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        <p className="font-semibold mt-1 text-sm">Dra och släpp en bild</p>
        <p className="text-xs">eller klicka för att välja fil</p>
      </div>
    </div>
  );
};

type AdminTab = 
    'dashboard' | 
    'pass-program' | 'infosidor' | 'info-karusell' | 'skyltfonster' |
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
        <div className="mt-12 bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Växla till Studiovy</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Testa appen ur en medlems perspektiv genom att temporärt byta till en specifik studiovy. Du kan enkelt återvända till adminläget från "För Coacher"-menyn.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    );
};


const AnvandareContent: React.FC<SuperAdminScreenProps & { admins: UserData[], coaches: UserData[], isLoading: boolean }> = ({ organization, admins, coaches, isLoading }) => {
    const handleSetAdminRole = async (uid: string, adminRole: 'superadmin' | 'admin') => {
        // Basic confirmation for a destructive action
        if (window.confirm("Är du säker på att du vill ändra denna användares admin-roll?")) {
            try {
                await setAdminRole(uid, adminRole);
                alert("Användarrollen har uppdaterats.");
                // A production app would re-fetch here.
            } catch (error) {
                alert(`Kunde inte ändra roll: ${error instanceof Error ? error.message : "Okänt fel"}`);
            }
        }
    };

    const UserList: React.FC<{ users: UserData[], title: string, showAdminRoles?: boolean }> = ({ users, title, showAdminRoles }) => (
        <div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h4>
            <div className="bg-slate-200 dark:bg-gray-900/50 rounded-lg border border-slate-300 dark:border-gray-700">
                <ul className="divide-y divide-slate-300 dark:divide-gray-700">
                    {isLoading ? <li className="p-4 text-gray-500">Laddar...</li> : users.length === 0 ? <li className="p-4 text-gray-500">Inga användare hittades.</li> : users.map(user => (
                        <li key={user.uid} className="p-4 flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{user.email}</p>
                                {showAdminRoles && user.adminRole && <p className="text-xs font-mono px-2 py-0.5 mt-1 rounded-full inline-block bg-primary/20 text-primary">{user.adminRole}</p>}
                            </div>
                            {showAdminRoles && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleSetAdminRole(user.uid, user.adminRole === 'admin' ? 'superadmin' : 'admin')} className="text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded-md">
                                        Växla roll
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Lägg till Användare</h3>
                <div className="bg-slate-200 dark:bg-black/30 p-4 rounded-lg text-gray-700 dark:text-gray-300 space-y-4">
                    <p className="font-semibold">Kontakta oss för att lägga till nya användare</p>
                    <p className="text-sm">
                        För att lägga till en ny coach eller administratör, vänligen skicka ett mail till <a href="mailto:support@flexibel.app" className="text-primary underline">support@flexibel.app</a> med personens e-postadress och önskad roll.
                    </p>
                    <div>
                        <p className="font-semibold text-sm mb-1">Roller:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            <li><span className="font-bold">Coach:</span> Har tillgång till "För Coacher"-vyn för att skapa och hantera pass, se infosidor, etc.</li>
                            <li><span className="font-bold">Organisationsadmin:</span> Har full tillgång till alla inställningar för er organisation, inklusive att hantera studios, varumärke och innehåll.</li>
                        </ul>
                    </div>
                </div>
            </div>
            <UserList users={admins} title="Administratörer" showAdminRoles />
            <UserList users={coaches} title="Coacher" />
        </div>
    );
};

const CompanyInfoInputField: React.FC<{label: string, value?: string, onChange: (val: string) => void, placeholder?: string, type?: string}> = ({label, value, onChange, placeholder, type="text"}) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || label}
            className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
        />
    </div>
);

export const SuperAdminScreen: React.FC<SuperAdminScreenProps> = (props) => {
    const { organization, theme, onSaveGlobalConfig, adminRole } = props;
    const { selectOrganization } = useStudio();
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    
    // State for the main config tab
    const [config, setConfig] = useState<StudioConfig>(organization.globalConfig);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // State for the Users tab
    const [admins, setAdmins] = useState<UserData[]>([]);
    const [coaches, setCoaches] = useState<UserData[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    
    // State for the Pass & Program sub-navigation
    const [passProgramSubView, setPassProgramSubView] = useState<'hub' | 'ai' | 'builder'>('hub');
    const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
    const [isNewDraft, setIsNewDraft] = useState(false);
    const [aiGeneratorInitialTab, setAiGeneratorInitialTab] = useState<'generate' | 'parse' | 'manage'>('generate');
    
    // State for company details onboarding
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
            selectOrganization(updatedOrg); // Update context to reflect changes
            setShowOnboardingModal(false);
            setShowOnboardingBanner(false);
            sessionStorage.removeItem(onboardingSkippedKey);
        } catch (e) {
            alert("Kunde inte spara uppgifterna. Försök igen.");
            throw e; // Re-throw to keep modal open
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

    // Reset Pass & Program sub-view when leaving the main tab
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
                alert("Kunde inte hämta användare.");
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
        { type: 'link', id: 'skyltfonster', label: 'Skyltfönster', icon: DisplayIcon },
        { type: 'header', label: 'Inställningar' },
        { type: 'link', id: 'globala-installningar', label: 'Globala Inställningar', icon: SettingsIcon },
        { type: 'link', id: 'studios', label: 'Studios', icon: BuildingIcon },
        { type: 'link', id: 'varumarke', label: 'Varumärke & Säkerhet', icon: SparklesIcon },
        { type: 'link', id: 'company-info', label: 'Företagsinformation', icon: BriefcaseIcon },
        { type: 'link', id: 'anvandare', label: 'Användare', icon: UsersIcon },
    ];
    
    const mainContentWrapperClass = useMemo(() => {
        if (activeTab === 'pass-program' && passProgramSubView === 'builder') {
            return ''; // Use full width for builder, it has its own max-width.
        }
        return 'max-w-4xl mx-auto';
    }, [activeTab, passProgramSubView]);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <DashboardContent {...props} setActiveTab={setActiveTab} admins={admins} coaches={coaches} usersLoading={usersLoading} />;
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
            case 'skyltfonster':
                return <SkyltfonsterContent {...props} />;
            case 'globala-installningar':
                return <GlobalaInställningarContent {...props} {...configProps} />;
            case 'studios':
                return <StudiosContent {...props} />;
            case 'varumarke':
                return <VarumarkeContent {...props} />;
            case 'company-info':
                return <CompanyInfoContent {...props} />;
            case 'anvandare':
                return <AnvandareContent {...props} admins={admins} coaches={coaches} isLoading={usersLoading} />;
            default:
                return null;
        }
    };

    return (
         <div className="w-full max-w-screen-2xl mx-auto flex bg-slate-50 dark:bg-black">
            <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 p-4 border-r border-gray-200 dark:border-gray-800 hidden md:flex flex-col sticky top-0 h-screen">
                <div className="flex-shrink-0 mb-8 min-h-[40px] flex items-center px-2">
                    {displayLogoUrl ? (
                        <img src={displayLogoUrl} alt={`${organization.name} logotyp`} className="max-h-10 object-contain" />
                    ) : (
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{organization.name}</h1>
                    )}
                </div>
                <nav className="flex flex-col space-y-1">
                    {navItems.map((item, index) => {
                        if (item.type === 'header') {
                            return <h3 key={index} className="px-3 pt-4 pb-1 text-xs font-bold uppercase text-gray-400 tracking-wider">{item.label}</h3>
                        }
                        return (
                             <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-medium text-base ${
                                    activeTab === item.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                 role="tab"
                                 aria-selected={activeTab === item.id}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </aside>
            
            <main className="flex-grow p-6 sm:p-8 lg:p-10">
                {showOnboardingBanner && (
                    <div className="bg-yellow-500 text-black font-semibold p-3 text-center mb-6 rounded-lg shadow-md animate-fade-in">
                        ⚠ Er företagsinformation är ofullständig. <button onClick={() => setShowOnboardingModal(true)} className="underline hover:text-white">Klicka här för att komplettera.</button>
                    </div>
                )}
                <div className={mainContentWrapperClass}>
                    {activeTab !== 'dashboard' && (
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className="md:hidden mb-6 flex items-center gap-2 text-primary hover:brightness-95 transition-colors font-semibold text-base"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                            </svg>
                            <span>Tillbaka till översikt</span>
                        </button>
                    )}
                    {renderContent()}
                    {activeTab !== 'company-info' && <SwitchToStudioView 
                        organization={props.organization} 
                        onSwitchToStudioView={props.onSwitchToStudioView} 
                    />}
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

// --- Sub-View Components for SuperAdminScreen ---

const DashboardContent: React.FC<SuperAdminScreenProps & { setActiveTab: (tab: AdminTab) => void, admins: UserData[], coaches: UserData[], usersLoading: boolean }> = ({ organization, workouts, workoutsLoading, setActiveTab, admins, coaches, usersLoading }) => {
    
    const publishedWorkouts = workouts.filter(w => w.isPublished);
    const recentWorkouts = [...workouts].sort((a, b) => (b.createdAt || 0) - (b.createdAt || 0)).slice(0, 5);

    const stats = [
        { label: 'Publicerade Pass', value: workoutsLoading ? '...' : publishedWorkouts.length, icon: DumbbellIcon },
        { label: 'Aktiva Studios', value: organization.studios.length, icon: BuildingIcon },
        { label: 'Admins & Coacher', value: usersLoading ? '...' : admins.length + coaches.length, icon: UsersIcon },
    ];

    const quickActions = [
        { label: 'Skapa nytt pass', action: () => setActiveTab('pass-program'), icon: DumbbellIcon },
        { label: 'Bjud in användare', action: () => setActiveTab('anvandare'), icon: UsersIcon },
        { label: 'Redigera info-karusell', action: () => setActiveTab('info-karusell'), icon: SpeakerphoneIcon },
    ];
    
    return (
        <div className="space-y-10">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">Översikt</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map(stat => (
                    <div key={stat.label} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                             <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                             <stat.icon className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {quickActions.map(action => (
                    <button 
                        key={action.label} 
                        onClick={action.action}
                        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:shadow-lg transition-all text-left flex items-center gap-4"
                    >
                        <div className="bg-primary/10 text-primary p-3 rounded-full">
                            <action.icon className="w-6 h-6" />
                        </div>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">{action.label}</span>
                    </button>
                 ))}
            </div>

            <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Senaste Passen</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {workoutsLoading ? (
                            <li className="p-4 text-center text-gray-500 dark:text-gray-400">Laddar pass...</li>
                        ) : recentWorkouts.length > 0 ? (
                            recentWorkouts.map(workout => (
                                <li key={workout.id} className="p-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{workout.title}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(workout.createdAt || 0).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                     <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${workout.isPublished ? 'bg-primary/20 text-primary' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                        {workout.isPublished ? 'Publicerat' : 'Utkast'}
                                    </span>
                                </li>
                            ))
                        ) : (
                           <li className="p-4 text-center text-gray-500 dark:text-gray-400">Inga pass har skapats ännu.</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// --- Pass & Program Sub-Router and Content ---

interface PassProgramContentProps extends SuperAdminScreenProps {
    subView: 'hub' | 'ai' | 'builder';
    setSubView: (view: 'hub' | 'ai' | 'builder') => void;
    workoutToEdit: Workout | null;
    setWorkoutToEdit: (workout: Workout | null) => void;
    isNewDraft: boolean;
    setIsNewDraft: (isNew: boolean) => void;
    aiGeneratorInitialTab: 'generate' | 'parse' | 'manage';
    setAiGeneratorInitialTab: (tab: 'generate' | 'parse' | 'manage') => void;
    onReturnToHub: () => void;
}

const PassProgramContent: React.FC<PassProgramContentProps> = (props) => {
    const { 
        subView, setSubView, 
        workoutToEdit, setWorkoutToEdit,
        isNewDraft, setIsNewDraft,
        aiGeneratorInitialTab, setAiGeneratorInitialTab,
        onReturnToHub,
    } = props;

    const handleNavigation = (mode: 'create' | 'generate' | 'parse' | 'manage') => {
        if (mode === 'create') {
            setWorkoutToEdit(null);
            setIsNewDraft(true);
            setSubView('builder');
        } else {
            setAiGeneratorInitialTab(mode);
            setSubView('ai');
        }
    };

    const handleEditWorkout = (workout: Workout) => {
        setWorkoutToEdit(workout);
        setIsNewDraft(false);
        setSubView('builder');
    };

    const handleWorkoutGenerated = (newWorkout: Workout) => {
        setWorkoutToEdit(newWorkout);
        setIsNewDraft(true);
        setSubView('builder');
    };
    
    const handleReturnToManageView = () => {
        setAiGeneratorInitialTab('manage');
        setSubView('ai');
        setWorkoutToEdit(null);
        setIsNewDraft(false);
    };

    const handleSaveWorkout = async (workout: Workout) => {
        await props.onSaveWorkout(workout);
        handleReturnToManageView();
    };

    const renderSubView = () => {
        switch (subView) {
            case 'hub':
                return <PassProgramModule onNavigate={handleNavigation} />;
            case 'ai':
                return (
                    <div className="space-y-4">
                        <button onClick={onReturnToHub} className="text-primary hover:brightness-95 transition-colors font-semibold">
                            &larr; Tillbaka till översikt
                        </button>
                        <AIGeneratorScreen
                            onWorkoutGenerated={handleWorkoutGenerated}
                            workouts={props.workouts}
                            onEditWorkout={handleEditWorkout}
                            onDeleteWorkout={props.onDeleteWorkout}
                            onTogglePublish={props.onTogglePublish}
                            onCreateNewWorkout={() => handleNavigation('create')}
                            initialMode={aiGeneratorInitialTab}
                            studioConfig={props.organization.globalConfig}
                            workoutsLoading={props.workoutsLoading}
                            setCustomBackHandler={() => {}} // No-op as we use our own back button
                            initialPrompt=""
                            isFromBoost={false}
                        />
                    </div>
                );
            case 'builder':
                return (
                    <div className="space-y-4">
                        <button onClick={handleReturnToManageView} className="text-primary hover:brightness-95 transition-colors font-semibold">
                            &larr; Tillbaka till passhanteraren
                        </button>
                        <WorkoutBuilderScreen
                            initialWorkout={workoutToEdit}
                            onSave={handleSaveWorkout}
                            onCancel={handleReturnToManageView}
                            focusedBlockId={null}
                            studioConfig={props.organization.globalConfig}
                            sessionRole={props.userRole}
                            isNewDraft={isNewDraft}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return <div className="animate-fade-in">{renderSubView()}</div>;
};

const InfosidorContent: React.FC<SuperAdminScreenProps> = ({ organization, onEditCustomPage, onDeleteCustomPage }) => (
    <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Egna Infosidor</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Skapa och hantera informationssidor som visas som knappar för coacher.</p>
        <div className="space-y-3">
            {(organization.customPages || []).map(page => (
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
);

interface CategoryPromptManagerProps {
    categories: CustomCategoryWithPrompt[];
    onCategoriesChange: (categories: CustomCategoryWithPrompt[]) => void;
    isSaving: boolean;
    onAutoSave?: (categories: CustomCategoryWithPrompt[]) => void;
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

const GlobalaInställningarContent: React.FC<SuperAdminScreenProps & ConfigProps> = ({ config, isSavingConfig, isConfigDirty, handleUpdateConfigField, handleSaveConfig, organization }) => {
    
    const handleAutoSaveCategories = async (newCategories: CustomCategoryWithPrompt[]) => {
        const newConfig = { ...config, customCategories: newCategories };
        handleUpdateConfigField('customCategories', newCategories);
        await handleSaveConfig(newConfig);
    };
    
    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Globala Inställningar</h3>
                <button onClick={() => handleSaveConfig()} disabled={!isConfigDirty || isSavingConfig} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 shadow-lg">
                    {isSavingConfig ? 'Sparar...' : 'Spara Globala Inställningar'}
                </button>
            </div>

            <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Valbara Moduler</h4>
                <ToggleSwitch label="Aktivera 'Dagens Boost'" checked={config.enableBoost} onChange={(c) => handleUpdateConfigField('enableBoost', c)} />
                <ToggleSwitch label="Aktivera 'Uppvärmning'" checked={config.enableWarmup} onChange={(c) => handleUpdateConfigField('enableWarmup', c)} />
                <ToggleSwitch label="Aktivera 'Andningsguide'" checked={config.enableBreathingGuide} onChange={(c) => handleUpdateConfigField('enableBreathingGuide', c)} />
                <ToggleSwitch label="Aktivera 'HYROX'-modul" checked={config.enableHyrox ?? false} onChange={(c) => handleUpdateConfigField('enableHyrox', c)} />
                <ToggleSwitch label="Aktivera 'Idé-tavlan'" checked={config.enableNotes ?? false} onChange={(c) => handleUpdateConfigField('enableNotes', c)} />
                <ToggleSwitch label="Aktivera Skärmsläckare" checked={config.enableScreensaver ?? false} onChange={(c) => handleUpdateConfigField('enableScreensaver', c)} />
                {config.enableScreensaver && (
                    <div className="pl-8 pt-2 animate-fade-in">
                        <label htmlFor="screensaver-timeout" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Tid till skärmsläckare (minuter)</label>
                        <input
                            id="screensaver-timeout"
                            type="number"
                            value={config.screensaverTimeoutMinutes || 15}
                            onChange={(e) => handleUpdateConfigField('screensaverTimeoutMinutes', parseInt(e.target.value, 10))}
                            className="w-32 bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600"
                            min="1"
                        />
                    </div>
                )}
                <ToggleSwitch label="Aktivera Övningsbank" checked={config.enableExerciseBank ?? false} onChange={(c) => handleUpdateConfigField('enableExerciseBank', c)} />
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-300 dark:border-gray-700">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Anpassade Passkategorier & AI-Prompts</h4>
                 <CategoryPromptManager
                    categories={config.customCategories}
                    onCategoriesChange={(cats) => handleUpdateConfigField('customCategories', cats)}
                    onAutoSave={handleAutoSaveCategories}
                    isSaving={isSavingConfig}
                 />
            </div>
        </div>
    );
};

const StudiosContent: React.FC<SuperAdminScreenProps> = ({ organization, onEditStudioConfig, onCreateStudio, onUpdateStudio, onDeleteStudio, onSwitchToStudioView }) => {
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
        <div className="space-y-8">
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
                                    <button onClick={() => handleEditStudio(studio)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg">Byt namn</button>
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
        </div>
    );
};

// --- These components are defined below the main export ---
const PassProgramModule: React.FC<{
    onNavigate: (mode: 'create' | 'generate' | 'parse' | 'manage') => void;
}> = ({ onNavigate }) => {
    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-8 rounded-xl border border-slate-200 dark:border-gray-700">
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

const InfoKarusellContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdateInfoCarousel }) => {
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
                organizationId={organization.id}
            />
        );
    }

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Info-karusell</h3>
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
    organizationId: string;
}

const InfoMessageEditor: React.FC<InfoMessageEditorProps> = ({ message, studios, onSave, onCancel, isSaving = false, organizationId }) => {
    const [localMessage, setLocalMessage] = useState<InfoMessage>(message);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    const handleGenerateAiImage = async () => {
        if (!localMessage.headline && !localMessage.body) {
            alert("Skriv en rubrik eller brödtext först för att ge AI:n kontext.");
            return;
        }
        setIsGeneratingImage(true);
        try {
            const prompt = `A vibrant, inspiring, and visually appealing image for a gym or health studio information banner. The image should visually represent the theme: "${localMessage.headline}". Additional context: "${localMessage.body}". The style should be modern, clean, and motivational, suitable for a digital screen. Avoid adding any text to the image.`;
            const imageDataUrl = await generateCarouselImage(prompt);
            const path = `organizations/${organizationId}/content_images/ai-${Date.now()}.jpg`;
            const downloadURL = await uploadImage(path, imageDataUrl);
            setLocalMessage(prev => ({...prev, imageUrl: downloadURL}));
        } catch (error) {
            alert(`Kunde inte generera bild: ${error instanceof Error ? error.message : "Okänt fel"}`);
        } finally {
            setIsGeneratingImage(false);
        }
    };

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
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Bild</label>
                            <button
                                onClick={handleGenerateAiImage}
                                disabled={isSaving || isGeneratingImage}
                                className="text-sm font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ✨ {isGeneratingImage ? 'Genererar...' : 'Generera med AI'}
                            </button>
                        </div>
                        <div className="mt-1 relative">
                            {isGeneratingImage && (
                                <div className="absolute inset-0 bg-gray-900/80 rounded-md z-10 flex flex-col items-center justify-center gap-2">
                                    <AILoadingSpinner />
                                    <p className="text-sm font-semibold text-gray-300">Genererar bild...</p>
                                </div>
                            )}
                             <ImageUploaderForBanner
                                imageUrl={localMessage.imageUrl || null}
                                onImageChange={(url) => setLocalMessage(prev => ({...prev, imageUrl: url}))}
                                disabled={isSaving || isGeneratingImage}
                                organizationId={organizationId}
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

const SkyltfonsterContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdateDisplayWindows }) => {
    const [windows, setWindows] = useState<DisplayWindow[]>(organization.displayWindows || []);
    const [editingWindow, setEditingWindow] = useState<DisplayWindow | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [windowToEditName, setWindowToEditName] = useState<{id: string, name: string} | null>(null);
    
    useEffect(() => {
        setWindows(organization.displayWindows || []);
    }, [organization.displayWindows]);

    const updateAndPersist = async (updatedWindows: DisplayWindow[]) => {
        setIsSaving(true);
        const originalWindows = windows;
        setWindows(updatedWindows);
        try {
            await onUpdateDisplayWindows(organization.id, updatedWindows);
        } catch (e) {
            console.error(e);
            alert(`Ett fel uppstod vid sparande: ${e instanceof Error ? e.message : 'Okänt fel'}. Ändringen har återställts.`);
            setWindows(originalWindows);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateWindow = () => {
        const newWindow: DisplayWindow = {
            id: `window-${Date.now()}`,
            name: 'Nytt Skyltfönster',
            isEnabled: true,
            posts: [],
        };
        updateAndPersist([...windows, newWindow]);
    };
    
    const handleToggleWindowEnabled = (id: string, isEnabled: boolean) => {
        const updatedWindows = windows.map(w => w.id === id ? { ...w, isEnabled } : w);
        updateAndPersist(updatedWindows);
    };

    const handleRemoveWindow = (id: string) => {
        if (window.confirm("Är du säker på att du vill ta bort detta skyltfönster?")) {
            updateAndPersist(windows.filter(w => w.id !== id));
        }
    };

    const handleSaveWindowName = () => {
        if (!windowToEditName) return;
        const updatedWindows = windows.map(w => w.id === windowToEditName.id ? { ...w, name: windowToEditName.name } : w);
        setWindowToEditName(null);
        updateAndPersist(updatedWindows);
    };

    const handleSavePosts = (windowWithUpdatedPosts: DisplayWindow) => {
        const updatedWindows = windows.map(w => w.id === windowWithUpdatedPosts.id ? windowWithUpdatedPosts : w);
        setEditingWindow(null);
        updateAndPersist(updatedWindows);
    };

    if (editingWindow) {
        return <DisplayPostEditor 
            post={editingWindow}
            studios={organization.studios}
            onSave={handleSavePosts}
            onCancel={() => setEditingWindow(null)}
            isSaving={isSaving}
            organizationId={organization.id}
        />
    }

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
             <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Skyltfönster</h3>
                {isSaving && <span className="text-sm text-gray-400">Sparar...</span>}
            </div>
            
            <div className="space-y-3">
                {windows.map(win => (
                     <div key={win.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg border border-slate-300 dark:border-gray-700">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                             {windowToEditName?.id === win.id ? (
                                <input
                                    type="text"
                                    value={windowToEditName.name}
                                    onChange={(e) => setWindowToEditName({ id: win.id, name: e.target.value })}
                                    className="flex-grow bg-white dark:bg-black p-2 rounded-md font-semibold"
                                    autoFocus
                                />
                             ) : (
                                <p className="font-semibold text-gray-900 dark:text-white">{win.name}</p>
                             )}
                            <div className="flex gap-2 items-center flex-wrap">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className="text-sm text-gray-500">Aktiv:</span>
                                    <ToggleSwitch checked={win.isEnabled} onChange={(checked) => handleToggleWindowEnabled(win.id, checked)} label="" />
                                </label>
                                {windowToEditName?.id === win.id ? (
                                    <>
                                        <button onClick={handleSaveWindowName} className="bg-primary text-white font-semibold py-2 px-4 rounded-lg">Spara</button>
                                        <button onClick={() => setWindowToEditName(null)} className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg">Avbryt</button>
                                    </>
                                ) : (
                                    <button onClick={() => setWindowToEditName({ id: win.id, name: win.name })} className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg">Byt namn</button>
                                )}
                                <button onClick={() => setEditingWindow(win)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">Redigera inlägg</button>
                                <button onClick={() => handleRemoveWindow(win.id)} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg">Ta bort</button>
                            </div>
                        </div>
                    </div>
                ))}
                {windows.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">Inga skyltfönster har skapats ännu.</p>}
            </div>

            <div className="pt-4 flex justify-start items-center">
                <button onClick={handleCreateWindow} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-bold py-2 px-5 rounded-lg disabled:opacity-50">
                    Skapa nytt skyltfönster
                </button>
            </div>
        </div>
    );
};

const DisplayPostPreview: React.FC<{ post: DisplayPost }> = ({ post }) => {
    const renderContent = () => {
        // Using smaller font sizes and padding for the preview
        switch(post.layout) {
            case 'image-fullscreen':
                const overlayClass = post.disableOverlay ? '' : 'bg-black/50';
                return (
                     <div className="w-full h-full relative text-white">
                        {post.imageUrl ? <img src={post.imageUrl} alt={post.headline || ''} className="absolute inset-0 w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">Helskärmsbild</div>}
                        <div className={`absolute inset-0 ${overlayClass} flex flex-col justify-end p-4`}>
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
    post: DisplayWindow; // This component now edits an entire DisplayWindow's posts
    studios: Studio[];
    onSave: (window: DisplayWindow) => void;
    onCancel: () => void;
    isSaving?: boolean;
    organizationId: string;
}

const DisplayPostEditor: React.FC<DisplayPostEditorProps> = ({ post: initialWindow, studios, onSave, onCancel, isSaving = false, organizationId }) => {
    const [windowState, setWindowState] = useState<DisplayWindow>(initialWindow);
    const [editingPost, setEditingPost] = useState<DisplayPost | null>(null);

    const handleSavePost = (postToSave: DisplayPost) => {
        const isExisting = (windowState.posts || []).some(p => p.id === postToSave.id);
        const updatedPosts = isExisting
            ? (windowState.posts || []).map(p => p.id === postToSave.id ? postToSave : p)
            : [...(windowState.posts || []), postToSave];
        
        setWindowState(prev => ({ ...prev, posts: updatedPosts }));
        setEditingPost(null);
    };

    const handleRemovePost = (idToRemove: string) => {
        if (window.confirm("Är du säker på att du vill ta bort detta inlägg?")) {
            setWindowState(prev => ({ ...prev, posts: (prev.posts || []).filter(p => p.id !== idToRemove) }));
        }
    };

    if (editingPost) {
        return <DisplayPostForm
            post={editingPost}
            studios={studios}
            onSave={handleSavePost}
            onCancel={() => setEditingPost(null)}
            isSaving={isSaving}
            organizationId={organizationId}
        />
    }

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg border border-slate-200 dark:border-gray-700 animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-6">
                Redigera inlägg för "{windowState.name}"
            </h3>
             <div className="space-y-3">
                {(windowState.posts || []).map(post => (
                    <div key={post.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-slate-300 dark:border-gray-700">
                        <p className="font-semibold text-gray-900 dark:text-white">{post.internalTitle}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingPost(post)} disabled={isSaving} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Redigera</button>
                            <button onClick={() => handleRemovePost(post.id)} disabled={isSaving} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Ta bort</button>
                        </div>
                    </div>
                ))}
                {(windowState.posts || []).length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">Inga inlägg har skapats ännu.</p>}
            </div>
            <div className="pt-4 mt-4 border-t border-slate-300 dark:border-gray-700 flex justify-between items-center">
                 <button onClick={() => setEditingPost({ id: `post-${Date.now()}`, internalTitle: 'Nytt inlägg', layout: 'text-only', durationSeconds: 15, visibleInStudios: ['all']})} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-bold py-2 px-5 rounded-lg disabled:opacity-50">
                    Skapa nytt inlägg
                </button>
                <div>
                     <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg" disabled={isSaving}>Tillbaka</button>
                     <button onClick={() => onSave(windowState)} className="ml-4 bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50" disabled={isSaving}>
                        Spara Alla Ändringar
                    </button>
                </div>
            </div>
        </div>
    );
};

interface DisplayPostFormProps {
    post: DisplayPost;
    studios: Studio[];
    onSave: (post: DisplayPost) => void;
    onCancel: () => void;
    isSaving?: boolean;
    organizationId: string;
}

const DisplayPostForm: React.FC<DisplayPostFormProps> = ({ post, studios, onSave, onCancel, isSaving = false, organizationId }) => {
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
                            <ImageUploaderForBanner imageUrl={localPost.imageUrl || null} onImageChange={(url) => setLocalPost(p => ({...p, imageUrl: url}))} disabled={isSaving} organizationId={organizationId} />
                            <div className="mt-4">
                                <ToggleSwitch
                                    label="Visa bild utan mörk toning"
                                    checked={!!localPost.disableOverlay}
                                    onChange={(checked) => setLocalPost(p => ({...p, disableOverlay: checked}))}
                                />
                                <p className="text-xs text-gray-500 mt-1 pl-2">
                                    Använd detta om din bild redan har inbakad text eller design som inte ska mörkna.
                                </p>
                            </div>
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

const VarumarkeContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdateLogos, onUpdatePrimaryColor, onUpdatePasswords, userRole, onUpdateOrganization }) => {
    const [passwords, setPasswords] = useState<Organization['passwords']>(organization.passwords);
    const [isSavingPasswords, setIsSavingPasswords] = useState(false);
    const [showCoachPassword, setShowCoachPassword] = useState(false);
    
    const [name, setName] = useState(organization.name);
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
    }, [organization]);

    const handlePasswordChange = (level: 'coach', value: string) => {
        setPasswords(prev => ({ ...prev, [level]: value }));
    };

    const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>, theme: 'light' | 'dark') => {
        const file = e.target.files?.[0];
        if (file) {
            if (theme === 'light') setLogoLightFile(file);
            if (theme === 'dark') setLogoDarkFile(file);
    
            if (file.type === 'image/svg+xml') {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    if (theme === 'light') setLogoLightPreview(result);
                    if (theme === 'dark') setLogoDarkPreview(result);
                };
                reader.readAsDataURL(file);
                return;
            }
    
            try {
                // Use resizeImage for raster images to compress and resize them.
                // Using 512x512 with 0.9 quality for logos.
                const resizedImage = await resizeImage(file, 512, 512, 0.9);
                if (theme === 'light') setLogoLightPreview(resizedImage);
                if (theme === 'dark') setLogoDarkPreview(resizedImage);
            } catch (error) {
                console.error("Logo resizing failed:", error);
                alert("Logotypen kunde inte bearbetas. Försök med en annan fil.");
            }
        }
    };

    const handleSaveLogos = async () => {
        setIsSavingLogos(true);
        try {
            let finalLightUrl = logoLightPreview || '';
            let finalDarkUrl = logoDarkPreview || '';

            if (logoLightFile && logoLightPreview) {
                const path = `organizations/${organization.id}/logos/logo-light-${Date.now()}`;
                finalLightUrl = await uploadImage(path, logoLightPreview);
            }
    
            if (logoDarkFile && logoDarkPreview) {
                const path = `organizations/${organization.id}/logos/logo-dark-${Date.now()}`;
                finalDarkUrl = await uploadImage(path, logoDarkPreview);
            }
    
            await onUpdateLogos(organization.id, {
                light: finalLightUrl,
                dark: finalDarkUrl
            });
    
            setLogoLightFile(null);
            setLogoDarkFile(null);
        } catch (error) {
            console.error("Failed to save logos", error);
            alert("Logotyperna kunde inte sparas.");
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
            await onUpdateOrganization(organization.id, name, organization.subdomain);
        } catch (error) {
            // Error is handled/alerted by the calling component in App.tsx
        } finally {
            setIsSavingOrgInfo(false);
        }
    };

    const isPasswordsDirty = JSON.stringify(passwords) !== JSON.stringify(organization.passwords);
    const isLogosDirty = !!logoLightFile || !!logoDarkFile;
    const isColorDirty = primaryColor !== (organization.primaryColor || '#14b8a6');
    const isOrgInfoDirty = name !== organization.name;

    return (
        <div className="space-y-8">
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
                                    <img src={logoLightPreview} alt="Logotyp förhandsgranskning" className="max-h-16" />
                                ) : (
                                    <p className="text-gray-400 text-sm">Logotyp (Ljust tema)</p>
                                )}
                            </div>
                            <button className="font-bold py-3 px-6 rounded-lg text-white" style={{ backgroundColor: primaryColor }}>Exempelknapp</button>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-8 border border-gray-700 text-center">
                             <div className="mb-4 flex justify-center h-16 items-center">
                                {logoDarkPreview ? (
                                    <img src={logoDarkPreview} alt="Logotyp förhandsgranskning" className="max-h-16" />
                                ) : (
                                    <p className="text-gray-500 text-sm">Logotyp (Mörkt tema)</p>
                                )}
                            </div>
                             <button className="font-bold py-3 px-6 rounded-lg text-white" style={{ backgroundColor: primaryColor }}>Exempelknapp</button>
                        </div>
                    </div>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                    <div>
                        <label htmlFor="logo-light" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logotyp (Ljust Tema)</label>
                        <input id="logo-light" type="file" onChange={(e) => handleLogoFileChange(e, 'light')} accept="image/png, image/jpeg, image/svg+xml" className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                    </div>
                     <div>
                        <label htmlFor="logo-dark" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logotyp (Mörkt Tema)</label>
                        <input id="logo-dark" type="file" onChange={(e) => handleLogoFileChange(e, 'dark')} accept="image/png, image/jpeg, image/svg+xml" className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                    </div>
                 </div>
                 <div className="pt-2 flex justify-end">
                    <button onClick={handleSaveLogos} disabled={!isLogosDirty || isSavingLogos} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                        {isSavingLogos ? 'Sparar...' : 'Spara Logotyper'}
                    </button>
                </div>
                
                 <div className="pt-4 border-t border-slate-300 dark:border-gray-700">
                    <label htmlFor="primary-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Primärfärg</label>
                    <div className="flex items-center gap-4">
                        <input id="primary-color" type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 h-12 p-1 bg-white dark:bg-gray-700 rounded-lg border-2 border-slate-300 dark:border-gray-600" />
                        <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition font-mono" />
                         <button onClick={handleSaveColor} disabled={!isColorDirty || isSavingColor} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 whitespace-nowrap">
                             {isSavingColor ? 'Sparar...' : 'Spara Färg'}
                        </button>
                    </div>
                </div>
            </div>
            
             <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Säkerhet & Lösenord</h3>
                <div className="relative">
                    <label htmlFor="coach-pw" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coach-lösenord</label>
                    <input
                       id="coach-pw"
                       type={showCoachPassword ? 'text' : 'password'}
                       value={passwords.coach}
                       onChange={e => handlePasswordChange('coach', e.target.value)}
                       className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition font-mono text-lg"
                    />
                    <button onClick={() => setShowCoachPassword(!showCoachPassword)} className="absolute top-9 right-3 text-gray-500 dark:text-gray-400">
                        {showCoachPassword ? 'Dölj' : 'Visa'}
                    </button>
                </div>
                <div className="pt-4 flex justify-end">
                    <button onClick={handleSavePasswords} disabled={!isPasswordsDirty || isSavingPasswords} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                        {isSavingPasswords ? 'Sparar...' : 'Spara Lösenord'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CompanyInfoContent: React.FC<SuperAdminScreenProps> = ({ organization }) => {
    const { selectOrganization } = useStudio();
    const [details, setDetails] = useState<CompanyDetails>(organization.companyDetails || {});
    const [isSaving, setIsSaving] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    
    useEffect(() => {
        setDetails(organization.companyDetails || {});
    }, [organization.companyDetails]);

    const isDirty = useMemo(() => JSON.stringify(details) !== JSON.stringify(organization.companyDetails || {}), [details, organization.companyDetails]);

    const handleInputChange = (section: 'billingAddress' | 'billingContact', field: string, value: string) => {
        setDetails(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
    };

    const handleSimpleChange = (field: keyof Omit<CompanyDetails, 'billingAddress' | 'billingContact'>, value: string) => {
        setDetails(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedOrg = await updateOrganizationCompanyDetails(organization.id, details);
            selectOrganization(updatedOrg); // Update context
        } catch (error) {
            console.error("Failed to save company details:", error);
            alert("Kunde inte spara företagsinformationen.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-8 border border-slate-200 dark:border-gray-700">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Företags- & Faktureringsinformation</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Vänligen fyll i och håll er information uppdaterad. Korrekta uppgifter säkerställer en smidig fakturering och gör det enklare för oss att ge er snabb support.
                    </p>
                </div>

                {/* Företagsinformation */}
                <div className="space-y-4 p-4 border-t border-slate-300 dark:border-gray-700">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Företagsinformation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CompanyInfoInputField label="Juridiskt Företagsnamn" value={details.legalName} onChange={val => handleSimpleChange('legalName', val)} />
                        <CompanyInfoInputField label="Organisationsnummer" value={details.orgNumber} onChange={val => handleSimpleChange('orgNumber', val)} />
                    </div>
                </div>

                {/* Faktureringsadress */}
                <div className="space-y-4 p-4 border-t border-slate-300 dark:border-gray-700">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Faktureringsadress</h4>
                    <CompanyInfoInputField label="Gatuadress" value={details.billingAddress?.street} onChange={val => handleInputChange('billingAddress', 'street', val)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CompanyInfoInputField label="Postnummer" value={details.billingAddress?.zip} onChange={val => handleInputChange('billingAddress', 'zip', val)} />
                        <CompanyInfoInputField label="Ort" value={details.billingAddress?.city} onChange={val => handleInputChange('billingAddress', 'city', val)} />
                    </div>
                </div>
                
                {/* Kontaktuppgifter */}
                <div className="space-y-4 p-4 border-t border-slate-300 dark:border-gray-700">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Kontaktuppgifter</h4>
                    <CompanyInfoInputField label="Faktureringsmail (för fakturor)" type="email" value={details.billingContact?.email} onChange={val => handleInputChange('billingContact', 'email', val)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CompanyInfoInputField label="Namn på kontaktperson" value={details.billingContact?.name} onChange={val => handleInputChange('billingContact', 'name', val)} />
                        <CompanyInfoInputField label="E-post till kontaktperson" type="email" value={details.billingContact?.emailContact} onChange={val => handleInputChange('billingContact', 'emailContact', val)} />
                        <CompanyInfoInputField label="Telefonnummer till kontaktperson" value={details.billingContact?.phone} onChange={val => handleInputChange('billingContact', 'phone', val)} />
                    </div>
                </div>

                <div className="pt-4 flex justify-between items-center">
                    <button onClick={() => setIsTermsModalOpen(true)} className="text-sm text-gray-500 dark:text-gray-400 underline hover:text-primary transition-colors">
                        Läs användarvillkoren
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Sparar...' : 'Spara ändringar'}
                    </button>
                </div>
            </div>
            {isTermsModalOpen && <TermsAndConditionsModal onClose={() => setIsTermsModalOpen(false)} />}
        </>
    );
};

const TermsAndConditionsModal: React.FC<{onClose: () => void}> = ({ onClose }) => (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1002] p-4" onClick={onClose}>
        <div 
            className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                 <h2 className="text-2xl font-bold">Användarvillkor för SmartStudio Organisationer</h2>
                 <button onClick={onClose} className="text-3xl font-light text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">&times;</button>
            </div>
            <div className="flex-grow overflow-y-auto p-6 prose prose-lg dark:prose-invert max-w-none">
                <p className="text-sm text-gray-500">Senast uppdaterad: 2024-10-26</p>
                <p>Välkommen som administratör för SmartStudio! Genom att använda våra administrativa verktyg godkänner du ("Användaren", "du") följande villkor som reglerar din användning av tjänsten som tillhandahålls av oss ("Tjänsten", "vi").</p>
                
                <h3>1. Användarens Ansvar</h3>
                <p><strong>Kontosäkerhet:</strong> Du är ansvarig för att hålla dina inloggningsuppgifter hemliga. Dela inte ditt lösenord med någon annan.</p>
                <p><strong>Innehåll:</strong> Du är fullt ansvarig för allt innehåll som du eller dina coacher skapar och publicerar via plattformen, inklusive träningspass, övningar, bilder och informationstexter.</p>
                <p><strong>Olämpligt material:</strong> Det är strängt förbjudet att ladda upp eller publicera innehåll som är olagligt, stötande, diskriminerande eller som gör intrång i någon annans immateriella rättigheter.</p>

                <h3>2. Användning av AI-tjänster</h3>
                <p><strong>Verktyg och Inspiration:</strong> Plattformens AI-funktioner (t.ex. "Passbyggaren") är avsedda som ett verktyg för att generera inspiration och utkast.</p>
                <p><strong>Professionell Granskning:</strong> Allt AI-genererat innehåll, särskilt träningspass och övningar, måste granskas och vid behov anpassas av en kvalificerad coach eller instruktör innan det publiceras eller används med medlemmar. AI:n kan generera felaktig eller olämplig information.</p>
                <p><strong>Ansvarsfulla Prompts:</strong> Du åtar dig att inte använda AI-funktionerna för att generera skadligt, olagligt eller oetiskt innehåll.</p>

                <h3>3. Datahantering och Integritet</h3>
                <p>Vi behandlar personuppgifter i enlighet med gällande dataskyddslagar (GDPR). Vår fullständiga integritetspolicy beskriver hur vi samlar in och använder data.</p>
                <p>Som administratör har du tillgång till viss data om din organisation. Denna data får endast användas i enlighet med er organisations integritetspolicy och för att administrera Tjänsten.</p>

                <h3>4. Immateriella Rättigheter</h3>
                <p><strong>Tjänsten:</strong> Vi äger alla rättigheter till SmartStudio-plattformen, dess kod, design och varumärke.</p>
                <p><strong>Ditt Innehåll:</strong> Din organisation behåller äganderätten till det innehåll (träningspass, bilder etc.) som ni skapar. Ni ger oss dock en licens att visa och distribuera detta innehåll via Tjänsten så länge ni är kunder hos oss.</p>

                <h3>5. Ansvarsfriskrivning</h3>
                <p>Tjänsten tillhandahålls "i befintligt skick". Vi garanterar inte att den alltid kommer vara fri från fel eller avbrott.</p>
                <p>Vi är inte ansvariga för några personskador eller andra skador som kan uppstå som ett resultat av att följa träningspass skapade eller distribuerade via plattformen. Det är alltid er organisations och era coachers ansvar att säkerställa att träningen utförs på ett säkert och korrekt sätt.</p>

                <h3>6. Ändringar i Villkoren</h3>
                <p>Vi förbehåller oss rätten att när som helst ändra dessa villkor. Vid väsentliga ändringar kommer vi att meddela dig, och du kan behöva godkänna de nya villkoren för att fortsätta använda de administrativa funktionerna.</p>
            </div>
             <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button onClick={onClose} className="bg-primary hover:brightness-95 text-white font-bold py-2 px-6 rounded-lg">Stäng</button>
            </div>
        </div>
    </div>
);