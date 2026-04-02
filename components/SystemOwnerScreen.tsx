import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Organization, SmartScreenPricing, InvoiceDetails, SeasonalThemeSetting, ThemeDateRange } from '../types';
import { OvningsbankContent } from './OvningsbankContent';
import { getSmartScreenPricing, updateSmartScreenPricing, updateOrganizationFreeCoaches, getSeasonalThemes, updateSeasonalThemes, archiveOrganization, restoreOrganization, deleteOrganizationPermanently, updateOrganizationName, getMembers } from '../services/firebaseService';
import { PencilIcon, HomeIcon, BuildingIcon, SparklesIcon, ToggleSwitch, ChevronDownIcon, CloseIcon } from './icons';
import { calculateInvoiceDetails } from '../utils/billing';
import { SystemDashboardContent } from './admin/SystemDashboardContent';
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
}

const OrganizationCard: React.FC<OrganizationCardProps> = React.memo(({ org, onSelect, onArchive, onRestore, onDeletePermanent, onUpdateFreeCoaches, onUpdateName }) => {
    const [freeCoaches, setFreeCoaches] = useState(org.freeCoachAccounts || 0);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(org.name);
    const [isSavingName, setIsSavingName] = useState(false);
    const [memberCount, setMemberCount] = useState<number | null>(null);
    const [staffCount, setStaffCount] = useState<number | null>(null);

    const isArchived = org.status === 'archived';

    useEffect(() => {
        setFreeCoaches(org.freeCoachAccounts || 0);
        setEditNameValue(org.name);
    }, [org.freeCoachAccounts, org.name]);

    useEffect(() => {
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
    }, [org.id]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            await onUpdateFreeCoaches(org.id, freeCoaches);
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
        <div className={`p-4 rounded-lg border shadow-sm transition-all ${isArchived ? 'bg-gray-100 dark:bg-gray-800/20 border-gray-300 dark:border-gray-800 opacity-80' : 'bg-slate-200 dark:bg-gray-900/50 border-slate-300 dark:border-gray-700'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={editNameValue}
                                    onChange={(e) => setEditNameValue(e.target.value)}
                                    className="bg-white dark:bg-gray-900 text-black dark:text-white px-2 py-1 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary text-lg font-semibold w-64"
                                    disabled={isSavingName}
                                    autoFocus
                                />
                                <button onClick={handleSaveName} disabled={isSavingName || !editNameValue.trim() || editNameValue === org.name} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-md disabled:opacity-50 text-sm font-semibold">
                                    {isSavingName ? 'Sparar...' : 'Spara'}
                                </button>
                                <button onClick={() => { setIsEditingName(false); setEditNameValue(org.name); }} disabled={isSavingName} className="bg-gray-500 hover:bg-gray-400 text-white p-1.5 rounded-md disabled:opacity-50">
                                    <CloseIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="font-semibold text-gray-900 dark:text-white text-lg">{org.name}</p>
                                {!isArchived && (
                                    <button onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-primary transition-colors">
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </>
                        )}
                        {isArchived && <span className="bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Arkiverad</span>}
                        
                        {!isArchived && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ml-2 ${isStripeActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                <div className={`w-2 h-2 rounded-full ${isStripeActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                {isStripeActive ? 'Betalning: Aktiv' : 'Kort saknas / Inaktiv'}
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        <div className="bg-white dark:bg-black/20 p-3 rounded-lg border border-slate-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Skärmar</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{org.studios.length} st</p>
                        </div>
                        <div className="bg-white dark:bg-black/20 p-3 rounded-lg border border-slate-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Personal</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{staffCount !== null ? staffCount : '-'} st</p>
                        </div>
                        <div className="bg-white dark:bg-black/20 p-3 rounded-lg border border-slate-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Medlemmar</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{memberCount !== null ? memberCount : '-'} st</p>
                        </div>
                        <div className="bg-white dark:bg-black/20 p-3 rounded-lg border border-slate-200 dark:border-gray-700 flex flex-col justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Gratis coacher</p>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={freeCoaches}
                                    onChange={(e) => setFreeCoaches(Number(e.target.value))}
                                    className="w-16 bg-slate-100 dark:bg-gray-900 text-black dark:text-white p-1 rounded border border-slate-300 dark:border-gray-600 text-center font-bold"
                                />
                                <button onClick={handleSaveSettings} disabled={isSaving || freeCoaches === (org.freeCoachAccounts || 0)} className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs font-semibold disabled:opacity-50">
                                    {isSaving ? '...' : 'Spara'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-row sm:flex-col gap-2 items-end flex-shrink-0 mt-4 sm:mt-0">
                    {!isArchived && (
                        <>
                            <button onClick={onSelect} className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg text-sm w-full sm:w-auto">Hantera</button>
                            <button onClick={onArchive} className="bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2 px-4 rounded-lg text-sm w-full sm:w-auto">Arkivera</button>
                        </>
                    )}
                    {isArchived && (
                        <>
                            <button onClick={onRestore} className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg text-sm w-full sm:w-auto">Återaktivera</button>
                            <button onClick={onDeletePermanent} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg text-sm w-full sm:w-auto">Radera Permanent</button>
                        </>
                    )}
                </div>
            </div>
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

export const SystemOwnerScreen: React.FC<SystemOwnerScreenProps> = ({ allOrganizations, onSelectOrganization, onCreateOrganization, onDeleteOrganization }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'themes' | 'bank'>('dashboard');
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

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'list', label: 'Organisationer' },
        { id: 'themes', label: 'Säsongsteman' },
        { id: 'bank', label: 'Övningsbank' }
    ] as const;

    const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Dashboard';

    const activeOrgs = localOrgs.filter(o => o.status !== 'archived');
    const archivedOrgs = localOrgs.filter(o => o.status === 'archived');

    return (
        <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-black">
            {/* Top Navigation */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
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
            <div className="flex-grow overflow-y-auto p-4 sm:p-8">
                <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                    
                    {activeTab === 'dashboard' && (
                        <SystemDashboardContent organizations={localOrgs} />
                    )}

                    {activeTab === 'list' && (
                        <>
                            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700 shadow-sm">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b border-slate-300 dark:border-gray-700 pb-3 mb-4">Mina Kunder</h3>
                                
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

                    {activeTab === 'themes' && (
                        <SeasonalThemesTab />
                    )}

                    {activeTab === 'bank' && (
                        <OvningsbankContent />
                    )}
                </div>
            </div>
        </div>
    );
};
