import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Organization, SmartScreenPricing, InvoiceDetails, SeasonalThemeSetting, ThemeDateRange } from '../types';
import { OvningsbankContent } from './OvningsbankContent';
import { getSmartScreenPricing, updateSmartScreenPricing, updateOrganizationFreeCoaches, getSeasonalThemes, updateSeasonalThemes, archiveOrganization, restoreOrganization, deleteOrganizationPermanently, updateOrganizationName, getMembers, requestPushNotificationPermission, auth, updateGlobalConfig, updateOrganizationMigrationOption, updateOrganizationStripeBypassOption, getGlobalSummerChallenge, updateGlobalSummerChallenge, listenToGlobalSummerChallenge } from '../services/firebaseService';
import { PencilIcon, HomeIcon, BuildingIcon, SparklesIcon, ToggleSwitch, ChevronDownIcon, CloseIcon } from './icons';
import { MoreVertical } from 'lucide-react';
import { calculateInvoiceDetails } from '../utils/billing';
import { SystemDashboardContent } from './admin/SystemDashboardContent';
import { GalleryManagementTab } from './admin/GalleryManagementTab';
import { LeadsManagementTab } from './admin/LeadsManagementTab';
import { motion, AnimatePresence } from 'framer-motion';

interface SystemOwnerScreenProps {
    allOrganizations: Organization[];
    onSelectOrganization: (organization: Organization) => void;
    onCreateOrganization: (name: string, subdomain: string) => Promise<void>;
    onDeleteOrganization: (organizationId: string) => void;
}

interface OrganizationCardProps {
    org: Organization;
    onSelect: () => void;
    onArchive: () => void;
    onRestore?: () => void;
    onDeletePermanent?: () => void;
    onUpdateFreeCoaches: (orgId: string, count: number) => Promise<void>;
    onUpdateName: (orgId: string, name: string) => Promise<void>;
    onUpdateGlobalConfig: (orgId: string, config: any) => Promise<void>;
    onUpdateMigrationOption: (orgId: string, allow: boolean) => Promise<void>;
    onUpdateStripeBypassOption: (orgId: string, allow: boolean) => Promise<void>;
}

const OrganizationCard: React.FC<OrganizationCardProps> = React.memo(({ org, onSelect, onArchive, onRestore, onDeletePermanent, onUpdateFreeCoaches, onUpdateName, onUpdateGlobalConfig, onUpdateMigrationOption, onUpdateStripeBypassOption }) => {
    const [freeCoaches, setFreeCoaches] = useState(org.freeCoachAccounts || 0);
    const [enableEventsModule, setEnableEventsModule] = useState(org.globalConfig?.enableEventsModule || false);
    const [enableSummerChallenge, setEnableSummerChallenge] = useState(org.globalConfig?.enableSummerChallenge || false);
    const [summerStartDate, setSummerStartDate] = useState(org.globalConfig?.summerChallengeStartDate ? new Date(org.globalConfig.summerChallengeStartDate).toISOString().split('T')[0] : '');
    const [summerEndDate, setSummerEndDate] = useState(org.globalConfig?.summerChallengeEndDate ? new Date(org.globalConfig.summerChallengeEndDate).toISOString().split('T')[0] : '');
    const [allowMigrationOption, setAllowMigrationOption] = useState(org.allowMigrationOption || false);
    const [allowStripeBypass, setAllowStripeBypass] = useState(org.allowStripeBypass || false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(org.name);
    const [isSavingName, setIsSavingName] = useState(false);
    const [memberCount, setMemberCount] = useState<number | null>(null);
    const [staffCount, setStaffCount] = useState<number | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const isArchived = org.status === 'archived';

    const orgStartIso = org.globalConfig?.summerChallengeStartDate ? new Date(org.globalConfig.summerChallengeStartDate).toISOString().split('T')[0] : '';
    const orgEndIso = org.globalConfig?.summerChallengeEndDate ? new Date(org.globalConfig.summerChallengeEndDate).toISOString().split('T')[0] : '';

    const hasChanges = freeCoaches !== (org.freeCoachAccounts || 0) || 
        enableEventsModule !== (org.globalConfig?.enableEventsModule || false) || 
        enableSummerChallenge !== (org.globalConfig?.enableSummerChallenge || false) ||
        summerStartDate !== orgStartIso ||
        summerEndDate !== orgEndIso ||
        allowMigrationOption !== (org.allowMigrationOption || false) ||
        allowStripeBypass !== (org.allowStripeBypass || false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setFreeCoaches(org.freeCoachAccounts || 0);
        setEditNameValue(org.name);
        setEnableEventsModule(org.globalConfig?.enableEventsModule || false);
        setEnableSummerChallenge(org.globalConfig?.enableSummerChallenge || false);
        setSummerStartDate(org.globalConfig?.summerChallengeStartDate ? new Date(org.globalConfig.summerChallengeStartDate).toISOString().split('T')[0] : '');
        setSummerEndDate(org.globalConfig?.summerChallengeEndDate ? new Date(org.globalConfig.summerChallengeEndDate).toISOString().split('T')[0] : '');
    }, [org.freeCoachAccounts, org.name, org.globalConfig?.enableEventsModule, org.globalConfig?.enableSummerChallenge, org.globalConfig?.summerChallengeStartDate, org.globalConfig?.summerChallengeEndDate]);

    useEffect(() => {
        if (!isExpanded) return; // Only fetch counts if expanded (performance optimization)
        const fetchCounts = async () => {
            try {
                const members = await getMembers(org.id);
                setMemberCount(members.filter(m => m.role === 'member').length);
                setStaffCount(members.filter(m => m.role === 'coach' || m.role === 'organizationadmin').length);
            } catch (error) {
                console.error("Failed to fetch member counts", error);
            }
        };
        fetchCounts();
    }, [org.id, isExpanded]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            await onUpdateFreeCoaches(org.id, freeCoaches);
            await onUpdateGlobalConfig(org.id, { 
                ...org.globalConfig, 
                enableEventsModule, 
                enableSummerChallenge,
                summerChallengeStartDate: summerStartDate ? new Date(summerStartDate + 'T00:00:00').getTime() : null,
                summerChallengeEndDate: summerEndDate ? new Date(summerEndDate + 'T23:59:59').getTime() : null
            });
            await onUpdateMigrationOption(org.id, allowMigrationOption);
            await onUpdateStripeBypassOption(org.id, allowStripeBypass);
        } catch (error) {
            alert("Kunde inte spara inställningarna.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSaveName = async () => {
        if (!editNameValue.trim() || editNameValue === org.name) {
            setIsEditingName(false);
            return;
        }
        setIsSavingName(true);
        try {
            await onUpdateName(org.id, editNameValue.trim());
            setIsEditingName(false);
        } catch (error) {
            alert("Kunde inte spara namnet.");
        } finally {
            setIsSavingName(false);
        }
    };
    
    const isStripeActive = org.systemFeePaid;

    return (
        <div className={`p-4 rounded-[2rem] border shadow-sm transition-all group hover:border-gray-300 dark:hover:border-gray-600 ${isArchived ? 'bg-gray-100 dark:bg-gray-800/20 border-gray-300 dark:border-gray-800 opacity-80' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
            <div 
                className="flex flex-col sm:flex-row justify-between items-center gap-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-1 w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center text-primary shrink-0 border border-gray-200 dark:border-gray-700 shadow-inner group-hover:scale-105 transition-transform">
                                <BuildingIcon className="w-6 h-6" />
                            </div>
                            <div>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            value={editNameValue}
                                            onChange={(e) => setEditNameValue(e.target.value)}
                                            className="bg-white dark:bg-gray-800 text-black dark:text-white px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary text-xl font-bold w-64"
                                            disabled={isSavingName}
                                            autoFocus
                                        />
                                        <button onClick={handleSaveName} disabled={isSavingName || !editNameValue.trim() || editNameValue === org.name} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-md disabled:opacity-50 text-sm font-semibold shadow-sm">
                                            {isSavingName ? 'Sparar...' : 'Spara'}
                                        </button>
                                        <button onClick={() => { setIsEditingName(false); setEditNameValue(org.name); }} disabled={isSavingName} className="bg-gray-500 hover:bg-gray-400 text-white p-1.5 rounded-md disabled:opacity-50 shadow-sm">
                                            <CloseIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-900 dark:text-white text-xl tracking-tight">{org.name}</p>
                                        {!isArchived && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }} 
                                                className="text-gray-400 hover:text-primary transition-colors p-1"
                                                title="Redigera namn"
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        {isArchived && <span className="bg-gray-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm ml-2">Arkiverad</span>}
                                    </div>
                                )}
                                {!isArchived && (
                                    <div className="flex items-center mt-1">
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isStripeActive ? 'bg-green-100/50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-100/50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${isStripeActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            {isStripeActive ? 'Stripe: Aktiv' : 'Kort saknas / Inaktiv'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Mobilvy-chevron */}
                        <div className="sm:hidden text-gray-400">
                             <ChevronDownIcon className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="hidden sm:flex text-gray-400 mr-2 cursor-pointer hover:text-primary transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                         <ChevronDownIcon className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    {!isArchived ? (
                        <button onClick={onSelect} className="flex-1 sm:flex-none justify-center flex items-center bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors shadow-sm">
                            Hantera
                        </button>
                    ) : (
                        <button onClick={onRestore} className="flex-1 sm:flex-none justify-center flex items-center bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors shadow-sm">
                            Återaktivera
                        </button>
                    )}
                    
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setShowMenu(!showMenu)} className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors shrink-0">
                            <MoreVertical className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        </button>
                        <AnimatePresence>
                            {showMenu && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-10"
                                >
                                    {!isArchived ? (
                                        <button 
                                            onClick={() => { setShowMenu(false); onArchive(); }} 
                                            className="w-full text-left px-5 py-3.5 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-bold transition-colors"
                                        >
                                            Arkivera kund
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => { setShowMenu(false); onDeletePermanent?.(); }} 
                                            className="w-full text-left px-5 py-3.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors"
                                        >
                                            Radera Permanent
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
            
            {/* EXPANDABLE CONTENT */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-6 mt-4 border-t border-gray-100 dark:border-gray-800">
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-1">Skärmar</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{org.studios.length} <span className="text-sm font-bold text-gray-400">st</span></p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-1">Personal</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{staffCount !== null ? staffCount : '-'} <span className="text-sm font-bold text-gray-400">st</span></p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-1">Medlemmar</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{memberCount !== null ? memberCount : '-'} <span className="text-sm font-bold text-gray-400">st</span></p>
                                </div>
                                <div className="bg-white dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-2">Gratis coacher</p>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={freeCoaches}
                                            onChange={(e) => setFreeCoaches(Number(e.target.value))}
                                            className="w-16 bg-gray-100 dark:bg-gray-900 text-black dark:text-white px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-center font-bold focus:ring-2 focus:ring-primary outline-none"
                                        />
                                        <button onClick={handleSaveSettings} disabled={isSaving || !hasChanges} className="bg-primary hover:brightness-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors shadow-sm">
                                            {isSaving ? '...' : 'Spara'}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-2">Moduler</p>
                                    <div className="space-y-2">
                                        <div className="scale-90 origin-left">
                                            <ToggleSwitch 
                                                label="Events & Tävlingar"
                                                checked={enableEventsModule} 
                                                onChange={async () => {
                                                    const newValue = !enableEventsModule;
                                                    setEnableEventsModule(newValue);
                                                    try {
                                                        await onUpdateGlobalConfig(org.id, { ...org.globalConfig, enableEventsModule: newValue });
                                                    } catch (e) {
                                                        setEnableEventsModule(!newValue);
                                                        alert("Ett fel inträffade vid sparande.");
                                                    }
                                                }} 
                                            />
                                        </div>
                                        <div className="scale-90 origin-left">
                                            <ToggleSwitch 
                                                label="Importfunktion"
                                                checked={allowMigrationOption} 
                                                onChange={async () => {
                                                    const newValue = !allowMigrationOption;
                                                    setAllowMigrationOption(newValue);
                                                    try {
                                                        await onUpdateMigrationOption(org.id, newValue);
                                                    } catch (e) {
                                                        setAllowMigrationOption(!newValue);
                                                        alert("Ett fel inträffade vid sparande.");
                                                    }
                                                }} 
                                            />
                                        </div>
                                        <div className="scale-90 origin-left flex flex-col gap-2">
                                            <ToggleSwitch 
                                                label="Sommarutmaning"
                                                checked={enableSummerChallenge} 
                                                onChange={async () => {
                                                    const newValue = !enableSummerChallenge;
                                                    setEnableSummerChallenge(newValue);
                                                    try {
                                                        await onUpdateGlobalConfig(org.id, { ...org.globalConfig, enableSummerChallenge: newValue });
                                                    } catch (e) {
                                                        setEnableSummerChallenge(!newValue);
                                                        alert("Ett fel inträffade vid sparande.");
                                                    }
                                                }} 
                                            />
                                            {enableSummerChallenge && (
                                                <div className="mt-2 pl-2 border-l-2 border-amber-500 space-y-2 animate-fade-in text-left">
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-amber-500 mb-1">Startdatum</label>
                                                        <input 
                                                            type="date"
                                                            value={summerStartDate}
                                                            onChange={(e) => setSummerStartDate(e.target.value)}
                                                            className="w-full bg-gray-100 dark:bg-gray-800 text-black dark:text-white px-2 py-1 rounded border border-gray-200 dark:border-gray-700 font-bold text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-amber-500 mb-1">Slutdatum</label>
                                                        <input 
                                                            type="date"
                                                            value={summerEndDate}
                                                            onChange={(e) => setSummerEndDate(e.target.value)}
                                                            className="w-full bg-gray-100 dark:bg-gray-800 text-black dark:text-white px-2 py-1 rounded border border-gray-200 dark:border-gray-700 font-bold text-xs"
                                                        />
                                                    </div>
                                                    {hasChanges && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSaveSettings();
                                                            }}
                                                            disabled={isSaving}
                                                            className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white font-black py-1 px-2 rounded text-[10px] uppercase tracking-wider shadow-sm transition-all"
                                                        >
                                                            {isSaving ? 'Sparar...' : 'Spara datum 💾'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                                    <p className="text-[10px] text-orange-500 dark:text-orange-400 font-black uppercase tracking-widest mb-2">System Bypass</p>
                                    <div className="scale-90 origin-left">
                                        <ToggleSwitch 
                                            label="Kräv ej Stripe"
                                            checked={allowStripeBypass} 
                                            onChange={async () => {
                                                const newValue = !allowStripeBypass;
                                                setAllowStripeBypass(newValue);
                                                try {
                                                    await onUpdateStripeBypassOption(org.id, newValue);
                                                } catch (e) {
                                                    setAllowStripeBypass(!newValue);
                                                    alert("Ett fel inträffade vid sparande.");
                                                }
                                            }} 
                                        />
                                    </div>
                                    <p className="text-[9px] text-gray-500 font-medium mt-2 leading-tight">Stänger av tvingande registreringskrav för systemhyra.</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

const SmartScreenPricingCard: React.FC = () => {
    const [pricing, setPricing] = useState<SmartScreenPricing | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editValues, setEditValues] = useState({ first: '0', additional: '0' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchPricing = async () => {
            setIsLoading(true);
            try {
                const data = await getSmartScreenPricing();
                setPricing(data);
                setEditValues({
                    first: String(data.firstScreenPrice),
                    additional: String(data.additionalScreenPrice),
                });
            } catch (error) {
                console.error("Failed to fetch pricing", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPricing();
    }, []);

    const handleSave = async () => {
        if (!pricing) return;
        setIsSaving(true);
        try {
            const newPricing: SmartScreenPricing = {
                firstScreenPrice: Number(editValues.first),
                additionalScreenPrice: Number(editValues.additional),
            };
            await updateSmartScreenPricing(newPricing);
            setPricing(newPricing);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to save pricing", error);
            alert("Kunde inte spara prissättningen.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCancel = () => {
        if (pricing) {
            setEditValues({
                first: String(pricing.firstScreenPrice),
                additional: String(pricing.additionalScreenPrice),
            });
        }
        setIsEditing(false);
    };

    if (isLoading) {
        return <div className="bg-slate-200 dark:bg-gray-900/50 p-6 rounded-lg border border-slate-300 dark:border-gray-700 animate-pulse h-28"></div>
    }

    if (!pricing) {
        return <div className="bg-slate-200 dark:bg-gray-900/50 p-6 rounded-lg border border-slate-300 dark:border-gray-700">Kunde inte ladda prissättning.</div>
    }

    return (
        <div className="bg-slate-200 dark:bg-gray-900/50 p-6 rounded-lg border border-slate-300 dark:border-gray-700">
            {!isEditing ? (
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">Prissättning</h4>
                        <div className="mt-2 text-gray-700 dark:text-gray-300 space-x-6">
                            <span><span className="font-semibold">Grundpaket (inkl. 1 skärm):</span> {pricing.firstScreenPrice} kr/mån</span>
                            <span><span className="font-semibold">Ytterligare skärm:</span> {pricing.additionalScreenPrice} kr/mån</span>
                        </div>
                    </div>
                    <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-primary transition-colors">
                        <PencilIcon className="w-6 h-6" />
                    </button>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Redigera Prissättning</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Grundpaket (inkl. 1 skärm) (kr/mån)</label>
                            <input
                                type="number"
                                value={editValues.first}
                                onChange={(e) => setEditValues(prev => ({ ...prev, first: e.target.value }))}
                                className="w-full bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ytterligare skärm (kr/mån)</label>
                            <input
                                type="number"
                                value={editValues.additional}
                                onChange={(e) => setEditValues(prev => ({ ...prev, additional: e.target.value }))}
                                className="w-full bg-white dark:bg-black text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={handleCancel} disabled={isSaving} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">Avbryt</button>
                        <button onClick={handleSave} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg">{isSaving ? 'Sparar...' : 'Spara'}</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const SeasonalThemesTab: React.FC = () => {
    const [themes, setThemes] = useState<SeasonalThemeSetting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        getSeasonalThemes().then(data => {
            setThemes(data);
            setIsLoading(false);
        });
    }, []);

    const handleToggleTheme = (id: string, isEnabled: boolean) => {
        setThemes(prev => prev.map(t => t.id === id ? { ...t, isEnabled } : t));
    };

    const handleRangeChange = (themeId: string, rangeIndex: number, field: keyof ThemeDateRange, value: any) => {
        setThemes(prev => prev.map(t => {
            if (t.id === themeId) {
                const newRanges = [...t.ranges];
                newRanges[rangeIndex] = { ...newRanges[rangeIndex], [field]: value };
                return { ...t, ranges: newRanges };
            }
            return t;
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSeasonalThemes(themes);
            alert("Säsongsteman sparade!");
        } catch (error) {
            console.error(error);
            alert("Kunde inte spara säsongsteman.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="text-center py-10 text-gray-500">Laddar säsongsteman...</div>;

    const MONTHS = [
        "Januari", "Februari", "Mars", "April", "Maj", "Juni",
        "Juli", "Augusti", "September", "Oktober", "November", "December"
    ];

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-6 border border-slate-200 dark:border-gray-700 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-300 dark:border-gray-700 pb-4">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Säsongsteman</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Styr när olika visuella effekter ska aktiveras automatiskt.</p>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="bg-primary hover:brightness-95 text-white font-bold py-2 px-6 rounded-lg shadow-sm disabled:opacity-50"
                >
                    {isSaving ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {themes.map(theme => (
                    <div key={theme.id} className="bg-white dark:bg-gray-900/50 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-primary" />
                                {theme.name}
                            </h4>
                            <div className="w-24">
                                <ToggleSwitch 
                                    label={theme.isEnabled ? "PÅ" : "AV"} 
                                    checked={theme.isEnabled} 
                                    onChange={(checked) => handleToggleTheme(theme.id, checked)} 
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {theme.ranges.map((range, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                    {range.useWeekNumber ? (
                                        <div className="lg:col-span-4">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Veckonummer</label>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-gray-400">Vecka</span>
                                                <input 
                                                    type="number" 
                                                    value={range.weekNumber || 44} 
                                                    onChange={(e) => handleRangeChange(theme.id, idx, 'weekNumber', parseInt(e.target.value) || 1)}
                                                    className="w-20 bg-gray-100 dark:bg-black border border-slate-300 dark:border-gray-700 p-2 rounded text-center font-bold"
                                                />
                                                <span className="text-xs text-gray-500 italic">(Aktiveras under hela den valda veckan varje år)</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="lg:col-span-2">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Från</label>
                                                <div className="flex gap-2">
                                                    <select 
                                                        value={range.startDay} 
                                                        onChange={(e) => handleRangeChange(theme.id, idx, 'startDay', parseInt(e.target.value))}
                                                        className="flex-1 bg-gray-100 dark:bg-black border border-slate-300 dark:border-gray-700 p-2 rounded text-sm"
                                                    >
                                                        {Array.from({ length: 31 }).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                                                    </select>
                                                    <select 
                                                        value={range.startMonth} 
                                                        onChange={(e) => handleRangeChange(theme.id, idx, 'startMonth', parseInt(e.target.value))}
                                                        className="flex-[2] bg-gray-100 dark:bg-black border border-slate-300 dark:border-gray-700 p-2 rounded text-sm"
                                                    >
                                                        {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="lg:col-span-2">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Till</label>
                                                <div className="flex gap-2">
                                                    <select 
                                                        value={range.endDay} 
                                                        onChange={(e) => handleRangeChange(theme.id, idx, 'endDay', parseInt(e.target.value))}
                                                        className="flex-1 bg-gray-100 dark:bg-black border border-slate-300 dark:border-gray-700 p-2 rounded text-sm"
                                                    >
                                                        {Array.from({ length: 31 }).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                                                    </select>
                                                    <select 
                                                        value={range.endMonth} 
                                                        onChange={(e) => handleRangeChange(theme.id, idx, 'endMonth', parseInt(e.target.value))}
                                                        className="flex-[2] bg-gray-100 dark:bg-black border border-slate-300 dark:border-gray-700 p-2 rounded text-sm"
                                                    >
                                                        {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={!!range.useWeekNumber} 
                                            onChange={(e) => handleRangeChange(theme.id, idx, 'useWeekNumber', e.target.checked)}
                                            className="w-4 h-4 rounded text-primary"
                                        />
                                        <span className="text-xs text-gray-500 font-medium">Använd Vecka</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ChallengesTab: React.FC<{
    organizations: Organization[];
    onUpdateGlobalConfig: (orgId: string, config: any) => Promise<void>;
}> = ({ organizations, onUpdateGlobalConfig }) => {
    const activeOrgs = organizations.filter(o => o.status !== 'archived');
    
    // Globala tillstånd för utmaningen
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let unsubscribe = () => {};
        try {
            unsubscribe = listenToGlobalSummerChallenge((data) => {
                if (data) {
                    setTitle(data.title || 'Sommarutmaningen ☀️');
                    setDescription(data.description || '');
                    
                    const toLocalDateString = (ts: number) => {
                        const d = new Date(ts);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${y}-${m}-${day}`;
                    };

                    setStartDate(data.startDate ? toLocalDateString(data.startDate) : '');
                    setEndDate(data.endDate ? toLocalDateString(data.endDate) : '');
                    setIsPublished(data.isPublished || false);
                }
                setIsLoading(false);
            });
        } catch (error) {
            console.error(error);
            setIsLoading(false);
        }
        return () => unsubscribe();
    }, []);

    const handleSaveGlobal = async () => {
        setIsSaving(true);
        try {
            await updateGlobalSummerChallenge({
                title,
                description,
                startDate: startDate ? new Date(startDate + 'T00:00:00').getTime() : null,
                endDate: endDate ? new Date(endDate + 'T23:59:59').getTime() : null,
                isPublished
            });
            alert("Övergripande inställningar för utmaningen har sparats!");
        } catch (e) {
            alert("Det gick inte att spara de övergripande inställningarna.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleOrgActivation = async (org: Organization, currentVal: boolean) => {
        try {
            await onUpdateGlobalConfig(org.id, {
                ...(org.globalConfig || {}),
                enableSummerChallenge: !currentVal
            });
        } catch (e) {
            alert("Kunde inte uppdatera gymmet.");
        }
    };

    if (isLoading) {
        return (
            <div className="p-12 text-center text-slate-500">
                Laddar inställningar för utmaningen...
            </div>
        );
    }

    return (
        <div className="space-y-8 text-left">
            {/* 1. Övergripande inställningar */}
            <div className="bg-slate-100 dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] space-y-6 border border-slate-200 dark:border-gray-700 shadow-sm">
                <div className="border-b border-slate-300 dark:border-gray-750 pb-4">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <span>☀️</span> Övergripande Utmaning
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Sätt gemensamma datum och information som gäller för hela systemet. När du publicerar visas presentationen på anslutna gymmets dashboard.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-2">Utmaningens Rubrik</label>
                            <input 
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-white dark:bg-gray-950 text-black dark:text-white px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="T.ex. Sommar-Sisu 2026"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-2">Beskrivning / Regler (visas på dashboarden)</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="w-full bg-white dark:bg-gray-950 text-black dark:text-white px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 font-medium text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="T.ex. Samla poäng tillsammans genom att registrera träningspass under sommaren!"
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-2">Startdatum</label>
                                <input 
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-950 text-black dark:text-white px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-2">Slutdatum</label>
                                <input 
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-950 text-black dark:text-white px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900/40 p-4 rounded-3xl border border-slate-200/60 dark:border-gray-750 flex items-center justify-between gap-4">
                            <div>
                                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Publicera utmaningen på gymmen</h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">När utmaningen publiceras visas en snygg presentation på anslutna gymmens dashboards.</p>
                            </div>
                            <div className="shrink-0 scale-90">
                                <ToggleSwitch 
                                    label=""
                                    checked={isPublished}
                                    onChange={setIsPublished}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveGlobal}
                            disabled={isSaving}
                            className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black uppercase text-xs tracking-wider py-4 px-6 rounded-2xl shadow-md transition-all cursor-pointer"
                        >
                            {isSaving ? 'Sparar...' : 'Spara globala inställningar 🏆'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Gymmens status och aktivering */}
            <div className="bg-slate-100 dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] space-y-4 border border-slate-200 dark:border-gray-700 shadow-sm">
                <div className="border-b border-slate-300 dark:border-gray-750 pb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Anslutna Gyms Status och Aktivering</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Varje gym (organisation) kan själva välja att slå på utmaningen under Inställningar, eller så kan du slå på/av det åt dem direkt här.
                    </p>
                </div>

                <div className="divide-y divide-slate-200/60 dark:divide-gray-750">
                    {activeOrgs.map(org => {
                        const isOrgEnabled = !!org.globalConfig?.enableSummerChallenge;
                        return (
                            <div key={org.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{org.name}</h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Subdomän: <span className="font-mono">{org.subdomain || 'saknas'}</span>
                                    </p>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                        isOrgEnabled 
                                        ? 'bg-emerald-100 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-400' 
                                        : 'bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-slate-400'
                                    }`}>
                                        {isOrgEnabled ? 'AKTIVERAD 🟢' : 'EJ AKTIVERAD 💨'}
                                    </span>

                                    <div className="scale-90">
                                        <ToggleSwitch 
                                            label=""
                                            checked={isOrgEnabled}
                                            onChange={() => handleToggleOrgActivation(org, isOrgEnabled)}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const SystemOwnerScreen: React.FC<SystemOwnerScreenProps> = ({ allOrganizations, onSelectOrganization, onCreateOrganization, onDeleteOrganization }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'challenges' | 'themes' | 'bank' | 'gallery' | 'leads'>('dashboard');
    const [newOrgName, setNewOrgName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [localOrgs, setLocalOrgs] = useState(allOrganizations);
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

    useEffect(() => {
        setLocalOrgs(allOrganizations);
    }, [allOrganizations]);
    
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrgName.trim()) return;
        setIsCreating(true);
        try {
            const subdomain = newOrgName.trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
            await onCreateOrganization(newOrgName.trim(), subdomain);
            setNewOrgName('');
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Ett okänt fel inträffade.");
        } finally {
            setIsCreating(false);
        }
    };

    // Soft delete (archive)
    const handleArchive = useCallback(async (org: Organization) => {
        if (window.confirm(`Vill du arkivera "${org.name}"? Tjänsten kommer omedelbart att låsas för alla användare.`)) {
            try {
                await archiveOrganization(org.id);
                setLocalOrgs(prev => prev.map(o => o.id === org.id ? { ...o, status: 'archived' } : o));
            } catch (e) { alert("Misslyckades att arkivera."); }
        }
    }, []);

    // Restore
    const handleRestore = useCallback(async (org: Organization) => {
        try {
            await restoreOrganization(org.id);
            setLocalOrgs(prev => prev.map(o => o.id === org.id ? { ...o, status: 'active' } : o));
        } catch (e) { alert("Misslyckades att återställa."); }
    }, []);

    // Hard delete
    const handleDeletePermanent = useCallback((org: Organization) => {
        if (window.confirm(`VARNING: Vill du radera "${org.name}" PERMANENT? Detta går inte att ångra och ALL data i molnet försvinner.`)) {
            onDeleteOrganization(org.id);
        }
    }, [onDeleteOrganization]);
    
    const handleUpdateFreeCoaches = useCallback(async (orgId: string, count: number) => {
        const updatedOrg = await updateOrganizationFreeCoaches(orgId, count);
        setLocalOrgs(prev => prev.map(o => o.id === orgId ? updatedOrg : o));
    }, []);

    const handleUpdateName = useCallback(async (orgId: string, newName: string) => {
        const updatedOrg = await updateOrganizationName(orgId, newName);
        if (updatedOrg) {
            setLocalOrgs(prev => prev.map(o => o.id === orgId ? updatedOrg : o));
        }
    }, []);

    const handleUpdateGlobalConfig = useCallback(async (orgId: string, config: any) => {
        await updateGlobalConfig(orgId, config);
        setLocalOrgs(prev => prev.map(o => o.id === orgId ? { ...o, globalConfig: config } : o));
    }, []);

    const handleUpdateMigrationOption = useCallback(async (orgId: string, allow: boolean) => {
        await updateOrganizationMigrationOption(orgId, allow);
        setLocalOrgs(prev => prev.map(o => o.id === orgId ? { ...o, allowMigrationOption: allow } : o));
    }, []);

    const handleUpdateStripeBypassOption = useCallback(async (orgId: string, allow: boolean) => {
        await updateOrganizationStripeBypassOption(orgId, allow);
        setLocalOrgs(prev => prev.map(o => o.id === orgId ? { ...o, allowStripeBypass: allow } : o));
    }, []);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'list', label: 'Organisationer' },
        { id: 'challenges', label: 'Sommarutmaning ☀️' },
        { id: 'themes', label: 'Säsongsteman' },
        { id: 'bank', label: 'Övningsbank' },
        { id: 'gallery', label: 'Kundgalleri' },
        { id: 'leads', label: 'Leads' }
    ] as const;

    const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Dashboard';

    const activeOrgs = localOrgs.filter(o => o.status !== 'archived');
    const archivedOrgs = localOrgs.filter(o => o.status === 'archived');

    return (
        <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-black">
            {/* Top Navigation */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 pl-6 pr-16 sm:pr-24 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <img src="/favicon.png" alt="Logo" className="w-8 h-8 object-contain" />
                    <span className="hidden sm:inline">Systemadmin</span>
                </h1>
                
                {/* Desktop Tabs */}
                <div className="hidden lg:flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)} 
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Mobile Dropdown Trigger */}
                <div className="flex lg:hidden">
                    <button 
                        onClick={() => setIsActionSheetOpen(true)}
                        className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl text-sm font-bold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 active:scale-95 transition-all"
                    >
                        <span>{currentTabLabel}</span>
                        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Mobile Action Sheet */}
            <AnimatePresence>
                {isActionSheetOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] lg:hidden"
                            onClick={() => setIsActionSheetOpen(false)}
                        />
                        {/* Sheet */}
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-[2rem] z-[2001] lg:hidden shadow-2xl p-6 pb-12 flex flex-col items-center"
                        >
                            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-8"></div>
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Välj Vy</h3>
                            <div className="w-full space-y-2">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setIsActionSheetOpen(false);
                                        }}
                                        className={`w-full py-4 px-6 rounded-2xl text-lg font-bold transition-all ${
                                            activeTab === tab.id
                                            ? 'bg-primary/10 text-primary border-2 border-primary'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => setIsActionSheetOpen(false)}
                                    className="w-full py-4 text-gray-400 font-bold mt-4"
                                >
                                    Stäng
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Content Area */}
            <div id="admin-scroll-container" className="flex-grow overflow-y-auto p-4 sm:p-8">
                <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                    
                    {activeTab === 'dashboard' && (
                        <SystemDashboardContent organizations={localOrgs} />
                    )}

                    {activeTab === 'list' && (
                        <>
                            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700 shadow-sm">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Mina Kunder</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-gray-900/50 p-3 rounded-xl flex items-center gap-2 mb-4">
                                    <span>💡</span>
                                    <span><strong>Hitta tidsinställningar för Sommarutmaningen:</strong> Vi har skapat en helt egen flik "Sommarutmaning ☀️" i toppmenyn för att du enkelt ska kunna ställa in start- och slutdatum för alla gym på ett ställe! Men du kan också styra det per gym här nedan genom att expandera inställningarna.</span>
                                </p>
                                
                                <div className="space-y-6">
                                    <section>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Aktiva ({activeOrgs.length})</h4>
                                        <div className="space-y-3">
                                            {activeOrgs.map(org => (
                                                    <OrganizationCard 
                                                        key={org.id} 
                                                        org={org} 
                                                        onSelect={() => onSelectOrganization(org)}
                                                        onArchive={() => handleArchive(org)}
                                                        onUpdateFreeCoaches={handleUpdateFreeCoaches}
                                                        onUpdateName={handleUpdateName}
                                                        onUpdateGlobalConfig={handleUpdateGlobalConfig}
                                                        onUpdateMigrationOption={handleUpdateMigrationOption}
                                                        onUpdateStripeBypassOption={handleUpdateStripeBypassOption}
                                                    />
                                            ))}
                                        </div>
                                    </section>

                                    {archivedOrgs.length > 0 && (
                                        <section className="pt-8 border-t border-gray-200 dark:border-gray-700">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-orange-500 mb-4">Arkiverade / Inaktiverade ({archivedOrgs.length})</h4>
                                            <div className="space-y-3">
                                                {archivedOrgs.map(org => (
                                                    <OrganizationCard 
                                                        key={org.id} 
                                                        org={org} 
                                                        onSelect={() => onSelectOrganization(org)}
                                                        onArchive={() => {}}
                                                        onRestore={() => handleRestore(org)}
                                                        onDeletePermanent={() => handleDeletePermanent(org)}
                                                        onUpdateFreeCoaches={handleUpdateFreeCoaches}
                                                        onUpdateName={handleUpdateName}
                                                        onUpdateGlobalConfig={handleUpdateGlobalConfig}
                                                        onUpdateMigrationOption={handleUpdateMigrationOption}
                                                        onUpdateStripeBypassOption={handleUpdateStripeBypassOption}
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>

                                <form onSubmit={handleCreate} className="pt-8 border-t border-slate-300 dark:border-gray-700 space-y-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lägg till nytt gym</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={newOrgName}
                                            onChange={(e) => setNewOrgName(e.target.value)}
                                            placeholder="Gymmets namn"
                                            className="flex-grow bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
                                            disabled={isCreating}
                                        />
                                        <button type="submit" disabled={!newOrgName.trim() || isCreating} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:bg-gray-500">
                                            {isCreating ? 'Skapar...' : 'Skapa'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                            
                            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700 shadow-sm">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Systeminställningar & Prissättning</h3>
                                <SmartScreenPricingCard />
                            </div>
                        </>
                    )}

                    {activeTab === 'challenges' && (
                        <ChallengesTab 
                            organizations={localOrgs} 
                            onUpdateGlobalConfig={handleUpdateGlobalConfig} 
                        />
                    )}

                    {activeTab === 'themes' && (
                        <SeasonalThemesTab />
                    )}

                    {activeTab === 'bank' && (
                        <OvningsbankContent />
                    )}

                    {activeTab === 'gallery' && (
                        <GalleryManagementTab />
                    )}

                    {activeTab === 'leads' && (
                        <LeadsManagementTab />
                    )}
                </div>
            </div>
        </div>
    );
};
