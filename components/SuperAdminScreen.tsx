
import React, { useState, useEffect, useMemo } from 'react';
import { StudioConfig, Studio, Organization, CustomPage, UserData, UserRole, InfoCarousel, DisplayWindow, Workout, CompanyDetails, ThemeOption } from '../types';
import { ToggleSwitch, HomeIcon, DocumentTextIcon, SpeakerphoneIcon, SparklesIcon, UsersIcon, DumbbellIcon, BriefcaseIcon, BuildingIcon, SettingsIcon, ChartBarIcon, SaveIcon, CopyIcon, PencilIcon, TrashIcon, CloseIcon, InformationCircleIcon, CheckIcon } from './icons';
import { getAdminsForOrganization, getCoachesForOrganization, updateOrganizationCompanyDetails, getSmartScreenPricing } from '../services/firebaseService';
import { OvningsbankContent } from './OvningsbankContent';
import { useStudio } from '../context/StudioContext';
import { CompanyDetailsOnboardingModal } from './CompanyDetailsOnboardingModal';
import { Modal } from './ui/Modal';
import { Toast } from './ui/Notification';
import { CategoryPromptManager } from './CategoryPromptManager';
import { DashboardContent, PassProgramContent } from './admin/DashboardContent';
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
import { motion, AnimatePresence } from 'framer-motion';

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

interface ConfigProps {
    config: StudioConfig;
    isSavingConfig: boolean;
    setIsSavingConfig: React.Dispatch<React.SetStateAction<boolean>>;
    isConfigDirty: boolean;
    handleUpdateConfigField: <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => void;
    handleSaveConfig: (configOverride?: StudioConfig) => Promise<void>;
    showToast: (msg: string) => void;
    onTriggerUpgrade: () => void;
}

// --- NEW INFO MODAL FOR WORKOUT LOGGING ---
const FeatureInfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Smart Medlemsupplevelse" size="lg">
        <div className="space-y-6 text-gray-800 dark:text-gray-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl text-white">
                <h3 className="text-xl font-bold mb-2">Mer än bara en loggbok 🚀</h3>
                <p className="opacity-90">
                    Genom att aktivera denna funktion låser du upp hela potentialen i SmartStudio. Det handlar om att ge dina medlemmar verktyg för att lyckas, och dig verktyg för att driva verksamheten.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-bold text-lg text-primary mb-3 flex items-center gap-2">
                        <UsersIcon className="w-5 h-5" /> För Medlemmen
                    </h4>
                    <ul className="space-y-2 text-sm">
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Träningsdagbok:</strong> Smidig loggning via QR-kod.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>AI-Coach:</strong> Personlig feedback och strategi inför varje pass.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Visuell Progression:</strong> Snygga grafer över styrka och kondition.</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-bold text-lg text-purple-500 mb-3 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5" /> För Gymmet
                    </h4>
                    <ul className="space-y-2 text-sm">
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Medlemsregister:</strong> Full översikt över dina medlemmar.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Data & Analys:</strong> Se vilka pass som är populärast och hur nöjda medlemmarna är.</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-500">✓</span>
                            <span><strong>Community:</strong> Live-feed på skärmarna när någon loggar ett PB.</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Tips:</strong> Detta är också en intäktsmöjlighet! Många gym tar en liten extra avgift (t.ex. 29-49 kr/mån) för att ge medlemmar tillgång till "Premium-appen" med AI-coaching och loggning.
            </div>
        </div>
        <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-3 px-6 rounded-xl transition-colors">Stäng</button>
        </div>
    </Modal>
);

// --- Reusable Pricing/Upgrade Modal ---
const PricingModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isProcessing: boolean;
}> = ({ isOpen, onClose, onConfirm, isProcessing }) => {
    const [baseCost, setBaseCost] = useState(19);
    const [customerPrice, setCustomerPrice] = useState(49);

    useEffect(() => {
        if (isOpen) {
            getSmartScreenPricing().then(pricing => {
                if (pricing && pricing.workoutLoggingPricePerMember !== undefined) {
                    setBaseCost(pricing.workoutLoggingPricePerMember);
                }
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={true} onClose={onClose} title="Aktivera Hela Paketet 🚀" size="lg">
            <div className="p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
                    <h3 className="text-xl font-bold mb-2">Ett paket – alla funktioner</h3>
                    <p className="text-blue-100 text-sm">
                        Genom att aktivera Passloggning får du automatiskt tillgång till Medlemsregistret, Analysverktyg och intäktsmöjligheter.
                    </p>
                </div>

                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-1">För Medlemmen</h4>
                            <ul className="text-blue-800 dark:text-blue-200 list-disc list-inside space-y-1">
                                <li>Sparar träningshistorik</li>
                                <li>Får AI-analys & tips</li>
                                <li>Ser sina framsteg visuellt</li>
                            </ul>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl">
                            <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-1">För Gymmet (Detta ingår)</h4>
                            <ul className="text-purple-800 dark:text-purple-200 list-disc list-inside space-y-1">
                                <li><strong>Medlemsregister & Statistik</strong></li>
                                <li><strong>Analys & Trender</strong></li>
                                <li>Ökad retention (nöjdare kunder)</li>
                                <li><strong>Ny intäktsström</strong></li>
                            </ul>
                        </div>
                    </div>

                    <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-6">
                        <h4 className="font-bold text-gray-900 dark:text-white text-center mb-4">Räkna på din vinst</h4>
                        
                        <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
                            <div className="flex-1 w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Vår avgift (Licens)</span>
                                <div className="text-2xl font-mono font-bold text-gray-700 dark:text-gray-300">
                                    {baseCost} <span className="text-sm font-normal">kr/mån</span>
                                </div>
                            </div>

                            <div className="text-gray-400 font-bold text-xl">+</div>

                            <div className="flex-1 w-full p-4 bg-white dark:bg-gray-700 rounded-xl border-2 border-primary/30 shadow-sm">
                                <label htmlFor="customerPriceInput" className="block text-xs font-bold text-primary uppercase mb-1">Ditt påslag (Pris till kund)</label>
                                <div className="flex items-baseline gap-2">
                                    <input 
                                        id="customerPriceInput"
                                        type="number" 
                                        value={customerPrice}
                                        onChange={(e) => setCustomerPrice(Number(e.target.value))}
                                        className="w-24 bg-transparent text-2xl font-mono font-bold text-gray-900 dark:text-white border-b-2 border-primary focus:outline-none"
                                    />
                                    <span className="text-sm text-gray-500 font-medium">kr/mån</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-2xl text-center border border-green-200 dark:border-green-800 mt-4">
                            <p className="text-xs font-bold text-green-800 dark:text-green-300 uppercase tracking-widest mb-2">
                                Din potentiella extra intäkt
                            </p>
                            <div className="text-5xl font-black text-green-700 dark:text-green-400 tracking-tight">
                                {(Math.max(0, customerPrice - baseCost) * 100 * 12).toLocaleString()} kr
                            </div>
                            <p className="text-sm text-green-800 dark:text-green-300 mt-2 font-medium opacity-80">
                                per år (vid 100 anslutna medlemmar)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex gap-4">
                    <button onClick={onClose} disabled={isProcessing} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                        Avbryt
                    </button>
                    <button onClick={onConfirm} disabled={isProcessing} className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-primary hover:brightness-110 shadow-lg shadow-primary/30 transition-all transform active:scale-95 disabled:opacity-50">
                        {isProcessing ? 'Aktiverar...' : 'Aktivera Passloggning'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const FeatureLockedView: React.FC<{ 
    title: string; 
    description: string; 
    features: string[];
    onActivate: () => void;
}> = ({ title, description, features, onActivate }) => (
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
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-widest text-xs">Detta ingår i paketet:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    {features.map((f, i) => (
                        <div key={i} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                            <span className="text-primary font-bold">✓</span>
                            <span className="font-medium">{f}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <button 
                onClick={onActivate}
                className="bg-primary hover:brightness-110 text-white font-black py-4 px-10 rounded-2xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-1 active:scale-95"
            >
                Gå till Aktivering 🚀
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
                        className="bg-gray-5 dark:bg-gray-700 hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white font-medium py-4 px-6 rounded-xl transition-all text-left flex items-center justify-between group"
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

const GlobalaInställningarContent: React.FC<SuperAdminScreenProps & ConfigProps> = (props) => {
    const { config, isSavingConfig, isConfigDirty, handleUpdateConfigField, handleSaveConfig, organization, onTriggerUpgrade } = props;
    const [showFeatureInfo, setShowFeatureInfo] = useState(false);

    const handleAiChange = (field: 'instructions' | 'tone', value: string) => {
        handleUpdateConfigField('aiSettings', {
            ...(config.aiSettings || {}),
            [field]: value
        });
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
                        <div className="bg-gray-5 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch 
                                label="HYROX-modul" 
                                checked={!!config.enableHyrox} 
                                onChange={(checked) => handleUpdateConfigField('enableHyrox', checked)} 
                            />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Aktiverat verktyg för tävlingar och HYROX-pass.</p>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <ToggleSwitch 
                                    label="Medlemsupplevelse & Loggning" 
                                    checked={!!config.enableWorkoutLogging} 
                                    onChange={(checked) => {
                                        if (checked) onTriggerUpgrade();
                                        else handleUpdateConfigField('enableWorkoutLogging', false);
                                    }} 
                                />
                                <button 
                                    onClick={() => setShowFeatureInfo(true)}
                                    className="text-gray-400 hover:text-primary transition-colors"
                                    title="Läs mer om denna funktion"
                                >
                                    <InformationCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 pl-2">
                                Låser upp medlemsappen, träningsdagbok, AI-coach och medlemsregister.
                            </p>
                            {!config.enableWorkoutLogging && (
                                <button onClick={onTriggerUpgrade} className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-2 pl-2 hover:underline">
                                    📊 Räkna på din vinst & läs mer...
                                </button>
                            )}
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
                                            className="w-full p-2 text-sm rounded bg-gray-5 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none resize-none"
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

                        <div className="bg-gray-5 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
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
            
            <FeatureInfoModal isOpen={showFeatureInfo} onClose={() => setShowFeatureInfo(false)} />
        </div>
    );
};

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

    const configProps: ConfigProps = {
        config,
        isSavingConfig,
        setIsSavingConfig, 
        isConfigDirty,
        handleUpdateConfigField,
        handleSaveConfig,
        showToast: (msg) => setToast({ message: msg, visible: true }),
        onTriggerUpgrade: () => setIsUpgradeModalOpen(true)
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
                        {/* INVITE CODE SECTION - ALWAYS VISIBLE */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in">
                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                <div className="bg-white p-4 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col items-center shrink-0">
                                    {qrUrl ? (
                                        <>
                                            <QRCode 
                                                value={qrUrl} 
                                                size={160} 
                                                fgColor="#000000"
                                                bgColor="#ffffff"
                                                level="M"
                                            />
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
                                                <span className="text-4xl font-black font-mono tracking-[0.15em] text-primary">
                                                    {organization.inviteCode}
                                                </span>
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
                                            <button 
                                                onClick={handleGenerateNewInviteCode}
                                                className="bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-md hover:brightness-110"
                                            >
                                                Generera inbjudningskod nu
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

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
                if (!organization.globalConfig.enableWorkoutLogging) {
                    return (
                        <FeatureLockedView 
                            title="Analys & Trender ingår i Passloggning 🚀"
                            description="Få djupa insikter i hur dina medlemmar presterar och mår. Se trender över tid och optimera ditt träningsutbud."
                            features={[
                                "Fullständig passanalys 📊",
                                "Medlemsregister 👥",
                                "Generera intäkter 💰",
                                "AI-Coaching för medlemmar 🤖"
                            ]}
                            onActivate={() => setIsUpgradeModalOpen(true)}
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
                            onDuplicateWorkout={onDuplicateWorkout}
                        />;
            case 'infosidor':
                return <InfosidorContent {...props} />;
            case 'info-karusell':
                return <InfoKarusellContent {...props} />;
            case 'medlemmar':
                return <MemberManagementScreen onSelectMember={onSelectMember} />;
            case 'globala-installningar':
                return <GlobalaInställningarContent {...props} {...configProps} />;
            case 'studios':
                return <StudiosContent {...props} />;
            case 'varumarke':
                return <VarumarkeContent 
                            organization={organization}
                            onUpdatePasswords={props.onUpdatePasswords}
                            onUpdateLogos={props.onUpdateLogos}
                            onUpdateFavicon={props.onUpdateFavicon}
                            onUpdatePrimaryColor={props.onUpdatePrimaryColor}
                        />;
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
            <Toast 
                isVisible={toast.visible} 
                message={toast.message} 
                onClose={() => setToast({ ...toast, visible: false })} 
            />

            <header className="h-16 flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleMenuIconClick}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Meny"
                    >
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    {userRole === 'systemowner' && (
                        <button 
                            onClick={onGoToSystemOwner || onBack}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-xs border border-gray-200 dark:border-gray-700 mr-2"
                        >
                            &larr; Systemvy
                        </button>
                    )}
                    {studioLoading ? (
                        <div className="h-8 w-24 bg-transparent"></div>
                    ) : displayLogoUrl ? (
                        <img src={displayLogoUrl} alt={`${organization.name} logotyp`} className="max-h-8 object-contain" />
                    ) : (
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">{organization.name}</h1>
                    )}
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile Drawer */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <>
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
                                onClick={() => setIsMobileMenuOpen(false)}
                            />
                            <motion.aside
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-gray-900 z-[70] lg:hidden shadow-2xl flex flex-col"
                            >
                                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="font-black text-gray-900 dark:text-white tracking-tighter uppercase text-sm">Administration</h3>
                                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 p-2">
                                        <CloseIcon className="w-6 h-6" />
                                    </button>
                                </div>
                                {renderNavItems(true)}
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Desktop Sidebar */}
                <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 hidden lg:flex flex-col transition-all duration-300 ease-in-out`}>
                    {renderNavItems(false)}
                </aside>
                
                <main className="flex-grow p-4 sm:p-8 lg:p-10 overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto">
                        {showOnboardingBanner && (
                            <div className="bg-yellow-100 border border-yellow-200 text-yellow-800 p-4 text-center mb-8 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-center gap-2 animate-fade-in">
                                <span>⚠️ Er företagsinformation är ofullständig.</span>
                                <button onClick={() => setShowOnboardingModal(true)} className="font-bold underline hover:text-yellow-900">Klicka här för att komplettera.</button>
                            </div>
                        )}
                        <div className={mainContentWrapperClass}>
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
            
            <PricingModal 
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                onConfirm={handleEnablePaidFeatures}
                isProcessing={isSavingConfig}
            />
        </div>
    );
};

interface NavElement {
    type: 'header' | 'link';
    label: string;
    id?: AdminTab;
    icon?: any;
}
