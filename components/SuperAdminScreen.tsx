import React, { useState, useEffect, useRef, useMemo } from 'react';
// FIX: Removed unused 'EquipmentItem' type from imports to fix compilation error.
import { StudioConfig, Studio, Organization, CustomPage, CustomCategoryWithPrompt, Page, UserData, UserRole, InfoCarousel, InfoMessage, DisplayWindow, DisplayPost, Workout, CompanyDetails, SmartScreenPricing } from '../types';
import { ToggleSwitch, HomeIcon, DocumentTextIcon, SpeakerphoneIcon, SparklesIcon, UsersIcon, DumbbellIcon, BriefcaseIcon } from './icons';
import { getAdminsForOrganization, setAdminRole, getCoachesForOrganization, uploadImage, updateOrganizationCompanyDetails, getSmartScreenPricing } from '../services/firebaseService';
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

const CostConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    organization: Organization;
}> = ({ isOpen, onClose, onConfirm, organization }) => {
    const [pricing, setPricing] = useState<SmartScreenPricing | null>(null);

    useEffect(() => {
        if (isOpen) {
            getSmartScreenPricing().then(setPricing);
        }
    }, [isOpen]);

    const calculations = useMemo(() => {
        if (!pricing) return null;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysRemaining = daysInMonth - now.getDate() + 1; // Inclusive of today

        const proratedCost = (pricing.additionalScreenPrice / daysInMonth) * daysRemaining;

        const existingStudios = organization.studios.length;
        // The new total monthly cost is for N+1 screens.
        // It's calculated as: 1 * firstScreenPrice + N * additionalScreenPrice.
        const newTotalMonthlyCost = pricing.firstScreenPrice + (existingStudios * pricing.additionalScreenPrice);

        return {
            proratedCost,
            newTotalMonthlyCost,
            daysRemaining,
            daysInMonth,
        };
    }, [organization.studios.length, pricing]);

    if (!isOpen || !pricing || !calculations) {
        // Render a loading state or nothing while pricing data is being fetched
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-lg text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">Bekräfta aktivering av ny skärm</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Du är på väg att lägga till en ny skärm för <span className="font-bold">{organization.name}</span>.
                </p>
                <div className="space-y-4 bg-slate-100 dark:bg-black/30 p-4 rounded-lg">
                    <div>
                        <p>Att aktivera denna skärm kommer att medföra en extra kostnad på <strong className="text-primary">{pricing.additionalScreenPrice} kr/månad</strong>.</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-white">1. Kostnad för innevarande månad</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Eftersom det är {calculations.daysRemaining} dagar kvar av månaden, tillkommer en proportionerlig kostnad för den återstående perioden på nästa faktura.
                        </p>
                        <p className="text-lg font-bold mt-1">
                            ({pricing.additionalScreenPrice} kr / {calculations.daysInMonth} dagar) &times; {calculations.daysRemaining} dagar = <span className="text-primary">{calculations.proratedCost.toFixed(2)} kr</span> (exkl. moms)
                        </p>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-white">2. Ny ordinarie månadskostnad</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Från och med nästa månad blir den nya totala månadskostnaden för deras {organization.studios.length + 1} skärmar:
                        </p>
                         <p className="text-lg font-bold mt-1">
                            {pricing.firstScreenPrice} kr + {organization.studios.length} &times; {pricing.additionalScreenPrice} kr = <span className="text-primary">{calculations.newTotalMonthlyCost.toFixed(2)} kr/månad</span> (exkl. moms)
                        </p>
                    </div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mt-6">
                    Är du säker på att du vill fortsätta och aktivera skärmen?
                </p>

                <div className="mt-6 flex gap-4">
                    <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                    <button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors">Godkänn & aktivera</button>
                </div>
            </div>
        </div>
    );
};

// FIX: Define SkyltfonsterContent component.
const SkyltfonsterContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdateDisplayWindows }) => {
    // This is a placeholder implementation. A full implementation would be much more complex.
    const [localWindows, setLocalWindows] = useState<DisplayWindow[]>(organization.displayWindows || []);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateDisplayWindows(organization.id, localWindows);
        } catch (error) {
            alert("Kunde inte spara ändringar.");
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
             <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Skyltfönster</h3>
                 <button onClick={handleSave} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 shadow-lg">
                    {isSaving ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Hantera skyltfönster som kan visas på skärmar.</p>
            {/* A full implementation would go here, allowing creation/editing of windows and posts */}
            <div className="text-center p-8 bg-slate-200 dark:bg-gray-900/50 rounded-lg">
                <p className="text-gray-500">Fullständig hantering av skyltfönster är under utveckling.</p>
            </div>
        </div>
    );
};

// FIX: Define VarumarkeContent component.
const VarumarkeContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdatePasswords, onUpdateLogos, onUpdatePrimaryColor }) => {
    const [passwords, setPasswords] = useState(organization.passwords);
    const [logoLight, setLogoLight] = useState(organization.logoUrlLight || '');
    const [logoDark, setLogoDark] = useState(organization.logoUrlDark || '');
    const [primaryColor, setPrimaryColor] = useState(organization.primaryColor || '#14b8a6');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Promise.all([
                onUpdatePasswords(organization.id, passwords),
                onUpdateLogos(organization.id, { light: logoLight, dark: logoDark }),
                onUpdatePrimaryColor(organization.id, primaryColor)
            ]);
            alert("Ändringar sparade!");
        } catch (error) {
            alert("Kunde inte spara ändringar.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
         <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Varumärke & Säkerhet</h3>
                 <button onClick={handleSave} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 shadow-lg">
                    {isSaving ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>
            {/* Passwords */}
            <div>
                <h4 className="font-semibold text-lg mb-2">Lösenord</h4>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm">Coach-lösenord</label>
                        <input type="text" value={passwords.coach} onChange={e => setPasswords(p => ({...p, coach: e.target.value}))} className="w-full bg-white dark:bg-black p-2 rounded-md border" />
                    </div>
                </div>
            </div>
             {/* Logos */}
            <div>
                <h4 className="font-semibold text-lg mb-2">Logotyper</h4>
                {/* A real implementation would use file uploads */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm">Logotyp (Ljust tema)</label>
                        <input type="text" value={logoLight} onChange={e => setLogoLight(e.target.value)} placeholder="URL till bild" className="w-full bg-white dark:bg-black p-2 rounded-md border" />
                    </div>
                     <div className="flex-1">
                        <label className="block text-sm">Logotyp (Mörkt tema)</label>
                        <input type="text" value={logoDark} onChange={e => setLogoDark(e.target.value)} placeholder="URL till bild" className="w-full bg-white dark:bg-black p-2 rounded-md border" />
                    </div>
                </div>
            </div>
            {/* Primary Color */}
            <div>
                <h4 className="font-semibold text-lg mb-2">Primärfärg</h4>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-24 h-12 p-1 border" />
            </div>
        </div>
    );
};

// FIX: Define CompanyInfoContent component.
const CompanyInfoContent: React.FC<SuperAdminScreenProps> = ({ organization }) => {
    // This component is currently read-only, editing happens in the modal.
    const { companyDetails } = organization;
    return (
         <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
             <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Företagsinformation</h3>
             <p className="text-sm">Juridiskt namn: <span className="font-semibold">{companyDetails?.legalName || 'Ej angett'}</span></p>
             <p className="text-sm">Org.nr: <span className="font-semibold">{companyDetails?.orgNumber || 'Ej angett'}</span></p>
             {/* A full implementation would show all details */}
        </div>
    );
};

// FIX: Define InfoKarusellContent component to manage the info carousel settings and messages.
const InfoKarusellContent: React.FC<SuperAdminScreenProps> = ({ organization, onUpdateInfoCarousel }) => {
    const [carousel, setCarousel] = useState<InfoCarousel>(() => 
        JSON.parse(JSON.stringify(organization.infoCarousel || { isEnabled: false, messages: [] }))
    );
    const [isSaving, setIsSaving] = useState(false);

    const handleUpdate = <K extends keyof InfoCarousel>(key: K, value: InfoCarousel[K]) => {
        setCarousel(prev => ({...prev, [key]: value}));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateInfoCarousel(organization.id, carousel);
            alert("Ändringar sparade!");
        } catch (error) {
            alert("Kunde inte spara ändringar.");
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
             <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Info-karusell</h3>
                 <button onClick={handleSave} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 shadow-lg">
                    {isSaving ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>
            <ToggleSwitch
                label="Aktivera info-karusell på hemskärmen"
                checked={carousel.isEnabled}
                onChange={(checked) => handleUpdate('isEnabled', checked)}
            />
             {/* A full message editor would be implemented here */}
            <div className="text-center p-8 bg-slate-200 dark:bg-gray-900/50 rounded-lg">
                <p className="text-gray-500">Fullständig hantering av meddelanden är under utveckling.</p>
            </div>
        </div>
    );
};

// FIX: Define StudiosContent component to manage studios within an organization.
const StudiosContent: React.FC<SuperAdminScreenProps> = ({ organization, onEditStudioConfig, onCreateStudio, onUpdateStudio, onDeleteStudio }) => {
    const [newStudioName, setNewStudioName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!newStudioName.trim()) return;
        setIsCreating(true);
        try {
            await onCreateStudio(organization.id, newStudioName.trim());
            setNewStudioName('');
        } catch (error) {
            console.error(error);
            alert("Kunde inte skapa studio.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
         <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Studios</h3>
             <div className="space-y-3">
                {organization.studios.map(studio => (
                    <div key={studio.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-slate-300 dark:border-gray-700">
                        <p className="font-semibold text-gray-900 dark:text-white">{studio.name}</p>
                        <div className="flex gap-2">
                            <button onClick={() => onEditStudioConfig(studio)} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg">Anpassa</button>
                            <button onClick={() => onDeleteStudio(organization.id, studio.id)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg">Ta bort</button>
                        </div>
                    </div>
                ))}
            </div>
             <div className="pt-6 border-t border-slate-300 dark:border-gray-700 space-y-3">
                <input
                    type="text" value={newStudioName} onChange={(e) => setNewStudioName(e.target.value)}
                    placeholder="Namn på ny studio"
                    className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border"
                />
                <button onClick={handleCreate} disabled={isCreating} className="w-full bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50">
                    {isCreating ? 'Skapar...' : 'Skapa Ny Studio'}
                </button>
            </div>
        </div>
    );
};

const PassProgramModule: React.FC<{ onNavigate: (mode: 'create' | 'generate' | 'parse' | 'manage') => void }> = ({ onNavigate }) => {
    return (
        <div className="space-y-6 max-w-2xl mx-auto text-center py-10">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Pass & Program</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
                Skapa, hantera och publicera träningspass. Använd AI för att snabbt generera nya pass eller tolka dina anteckningar.
            </p>
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                    onClick={() => onNavigate('create')}
                    className="bg-primary hover:brightness-95 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                >
                    Skapa nytt pass
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
                    Tolka från text
                </button>
                <button
                    onClick={() => onNavigate('manage')}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                >
                    Hantera pass
                </button>
            </div>
        </div>
    );
};

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
                 <button onClick={() => handleSaveConfig()} disabled={isSavingConfig || !isConfigDirty} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 shadow-lg">
                    {isSavingConfig ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>
            
             <h4 className="font-semibold text-lg">Moduler</h4>
            <div className="space-y-2">
                <ToggleSwitch label="Aktivera 'HYROX'-modul" checked={!!config.enableHyrox} onChange={(val) => handleUpdateConfigField('enableHyrox', val)} />
                <ToggleSwitch label="Aktivera 'Idé-tavlan'" checked={!!config.enableNotes} onChange={(val) => handleUpdateConfigField('enableNotes', val)} />
                <ToggleSwitch label="Aktivera Skärmsläckare" checked={!!config.enableScreensaver} onChange={(val) => handleUpdateConfigField('enableScreensaver', val)} />
                <ToggleSwitch label="Aktivera Övningsbank i Passbyggaren" checked={!!config.enableExerciseBank} onChange={(val) => handleUpdateConfigField('enableExerciseBank', val)} />
            </div>

            <h4 className="font-semibold text-lg pt-4 border-t border-slate-300 dark:border-gray-700">Passkategorier & AI-Prompts</h4>
            <CategoryPromptManager categories={config.customCategories} onCategoriesChange={(cats) => handleUpdateConfigField('customCategories', cats)} isSaving={isSavingConfig} />

        </div>
    );
};