import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Organization, SmartScreenPricing, InvoiceDetails, SeasonalThemeSetting, ThemeDateRange } from '../types';
import { OvningsbankContent } from './OvningsbankContent';
import { getSmartScreenPricing, updateSmartScreenPricing, updateOrganizationDiscount, updateOrganizationBilledStatus, undoLastBilling, getSeasonalThemes, updateSeasonalThemes, archiveOrganization, restoreOrganization, deleteOrganizationPermanently } from '../services/firebaseService';
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
    pricing: SmartScreenPricing;
    onSelect: () => void;
    onArchive: () => void;
    onRestore?: () => void;
    onDeletePermanent?: () => void;
    onUpdateDiscount: (orgId: string, discount: { type: 'percentage' | 'fixed', value: number }) => Promise<void>;
    onMarkAsBilled: (orgId: string, month: string) => void;
    onUndoBilling: (orgId: string) => void;
}

const OrganizationCard: React.FC<OrganizationCardProps> = React.memo(({ org, pricing, onSelect, onArchive, onRestore, onDeletePermanent, onUpdateDiscount, onMarkAsBilled, onUndoBilling }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(org.discountType || 'percentage');
    const [discountValue, setDiscountValue] = useState(org.discountValue || org.discountPercentage || 0);
    const [isSaving, setIsSaving] = useState(false);

    const isArchived = org.status === 'archived';

    useEffect(() => {
        setDiscountType(org.discountType || 'percentage');
        setDiscountValue(org.discountValue || org.discountPercentage || 0);
    }, [org.discountType, org.discountValue, org.discountPercentage]);

    const billingDetails = useMemo(() => {
        if (!pricing) return { currentInvoice: null, nextInvoicePrognosis: null };

        const currentInvoice = calculateInvoiceDetails(org, pricing);
        
        const hypotheticalNextOrg: Organization = {
            ...org,
            lastBilledMonth: currentInvoice.billingMonthForAction,
        };
        const nextInvoicePrognosis = calculateInvoiceDetails(hypotheticalNextOrg, pricing);

        return { currentInvoice, nextInvoicePrognosis };

    }, [org, pricing]);


    const handleSaveDiscount = async () => {
        setIsSaving(true);
        try {
            await onUpdateDiscount(org.id, { type: discountType, value: discountValue });
        } catch (error) {
            alert("Kunde inte spara rabatten.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const formatKr = (amount: number) => {
        return `${amount.toFixed(2).replace('.', ',')} kr`;
    };

    const { currentInvoice, nextInvoicePrognosis } = billingDetails;


    if (!currentInvoice) {
        return null; // or a loading skeleton
    }
    
    const isBilled = org.lastBilledMonth === currentInvoice.billingMonthForAction;

    return (
        <div className={`p-4 rounded-lg border shadow-sm transition-all ${isArchived ? 'bg-gray-100 dark:bg-gray-800/20 border-gray-300 dark:border-gray-800 opacity-80' : 'bg-slate-200 dark:bg-gray-900/50 border-slate-300 dark:border-gray-700'}`}>
            <div className="flex justify-between items-start gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white text-lg">{org.name}</p>
                        {isArchived && <span className="bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Arkiverad</span>}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Antal skärmar: {org.studios.length} st</p>
                     {isBilled && org.lastBilledDate ? (
                        <div className="text-sm text-green-600 dark:text-green-400 font-semibold flex items-center gap-2 mt-2">
                             <span>{currentInvoice.billingPeriod} Fakturerad: {new Date(org.lastBilledDate).toLocaleDateString('sv-SE')}</span>
                             <button onClick={() => onUndoBilling(org.id)} className="text-xs text-gray-500 hover:underline">(Ångra)</button>
                        </div>
                    ) : (
                         <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Att fakturera {currentInvoice.billingPeriod}:</p>
                    )}
                    <p className={`text-4xl font-bold mt-1 ${isArchived ? 'text-gray-400' : 'text-teal-600 dark:text-teal-400'}`}>{formatKr(currentInvoice.totalAmount)}</p>
                    {!isArchived && nextInvoicePrognosis && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            Beräknat att fakturera {nextInvoicePrognosis.billingPeriod}: <span className="font-semibold">{formatKr(nextInvoicePrognosis.totalAmount)}</span>
                        </p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-end flex-shrink-0">
                    {!isArchived && (
                        <>
                            {!isBilled && (
                                <button onClick={() => onMarkAsBilled(org.id, currentInvoice.billingMonthForAction)} className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg text-sm whitespace-nowrap">
                                    Markera fakturerad
                                </button>
                            )}
                            <button onClick={() => setIsExpanded(!isExpanded)} className="bg-slate-300 dark:bg-gray-700 hover:bg-slate-400 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg text-sm whitespace-nowrap">
                                {isExpanded ? 'Dölj' : 'Underlag'}
                            </button>
                            <button onClick={onSelect} className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg text-sm">Hantera</button>
                            <button onClick={onArchive} className="bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2 px-4 rounded-lg text-sm">Arkivera</button>
                        </>
                    )}
                    {isArchived && (
                        <>
                            <button onClick={onRestore} className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg text-sm">Återaktivera</button>
                            <button onClick={onDeletePermanent} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg text-sm">Radera Permanent</button>
                        </>
                    )}
                </div>
            </div>
            {isExpanded && !isArchived && (
                <div className="mt-4 pt-4 border-t border-slate-300 dark:border-gray-600 space-y-4 animate-fade-in">
                    <div className="bg-white dark:bg-black/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Ordinarie kostnad för {currentInvoice.billingPeriod}</h4>
                        <ul className="space-y-1 text-sm">
                            {currentInvoice.regularItems.map((item, index) => (
                                <li key={index} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-gray-700 last:border-b-0">
                                    <span className="text-gray-800 dark:text-white">{item.description}</span>
                                    <span className="font-mono text-gray-500 dark:text-gray-400">{item.quantity} st á {item.price} kr</span>
                                    <span className="font-mono font-semibold text-gray-900 dark:text-white w-28 text-right">{formatKr(item.total)}</span>
                                </li>
                            ))}
                        </ul>

                        {currentInvoice.adjustmentItems.length > 0 && (
                             <>
                                <h4 className="font-semibold text-gray-800 dark:text-white mb-2 mt-4">Justeringar från {currentInvoice.adjustmentPeriod}</h4>
                                <ul className="space-y-1 text-sm">
                                    {currentInvoice.adjustmentItems.map((item, index) => (
                                        <li key={index} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-gray-700 last:border-b-0 text-blue-600 dark:text-blue-400">
                                            <span>{item.description}</span>
                                            <span className="font-mono font-semibold w-28 text-right">+ {formatKr(item.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                             </>
                        )}
                        
                        <ul className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700 text-sm">
                             <li className="flex justify-between items-center py-2 text-red-600 dark:text-red-400">
                                <span className="font-semibold">Organisationsrabatt</span>
                                <span className="font-mono">{currentInvoice.discountDescription}</span>
                                <span className="font-mono font-semibold w-28 text-right">-{formatKr(currentInvoice.discountAmount)}</span>
                            </li>
                        </ul>
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700 flex justify-end items-baseline">
                            <span className="text-lg font-semibold text-gray-600 dark:text-gray-300 mr-4">Totalsumma (exkl. moms):</span>
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatKr(currentInvoice.totalAmount)}</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-black/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Ange rabatt</h4>
                        <div className="flex items-center gap-2">
                             <input 
                                id={`discount-${org.id}`}
                                type="number" 
                                value={discountValue}
                                onChange={(e) => setDiscountValue(Number(e.target.value))}
                                className="w-32 bg-white dark:bg-gray-900 text-black dark:text-white p-2 rounded-md border border-slate-300 dark:border-gray-600 text-right"
                            />
                            <div className="bg-slate-300 dark:bg-gray-700 p-1 rounded-lg flex text-sm">
                                <button onClick={() => setDiscountType('percentage')} className={`px-3 py-1 rounded-md transition-colors ${discountType === 'percentage' ? 'bg-white dark:bg-black shadow font-semibold' : ''}`}>%</button>
                                <button onClick={() => setDiscountType('fixed')} className={`px-3 py-1 rounded-md transition-colors ${discountType === 'fixed' ? 'bg-white dark:bg-black shadow font-semibold' : ''}`}>kr</button>
                            </div>
                             <button onClick={handleSaveDiscount} disabled={isSaving} className="ml-auto bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                                {isSaving ? 'Sparar...' : 'Spara rabatt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
    const [pricing, setPricing] = useState<SmartScreenPricing | null>(null);
    const [localOrgs, setLocalOrgs] = useState(allOrganizations);
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

    useEffect(() => {
        setLocalOrgs(allOrganizations);
    }, [allOrganizations]);

    useEffect(() => {
        getSmartScreenPricing().then(setPricing);
    }, []);
    
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
    
    const handleUpdateDiscount = useCallback(async (orgId: string, discount: { type: 'percentage' | 'fixed', value: number }) => {
        const updatedOrg = await updateOrganizationDiscount(orgId, discount);
        setLocalOrgs(prev => prev.map(o => o.id === orgId ? updatedOrg : o));
    }, []);

    const handleMarkAsBilled = useCallback(async (orgId: string, monthToMarkAsBilled: string) => {
        if (!window.confirm(`Är du säker på att du vill markera denna period som fakturerad?`)) return;
        try {
            const updatedOrg = await updateOrganizationBilledStatus(orgId, monthToMarkAsBilled);
            setLocalOrgs(prev => prev.map(o => o.id === orgId ? updatedOrg : o));
        } catch (error) {
            console.error(error);
            alert("Kunde inte markera som fakturerad.");
        }
    }, []);
    
    const handleUndoBilling = useCallback(async (orgId: string) => {
        if (!window.confirm(`Är du säker på att du vill ångra den senaste faktureringen?`)) return;
        try {
            const updatedOrg = await undoLastBilling(orgId);
            setLocalOrgs(prev => prev.map(o => o.id === orgId ? updatedOrg : o));
        } catch (error) {
            console.error(error);
            alert("Kunde inte ångra fakturering.");
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
                    <span className="bg-gradient-to-tr from-primary to-teal-600 w-8 h-8 rounded-lg"></span>
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
                                            {pricing ? activeOrgs.map(org => (
                                                <OrganizationCard 
                                                    key={org.id} 
                                                    org={org} 
                                                    pricing={pricing} 
                                                    onSelect={() => onSelectOrganization(org)}
                                                    onArchive={() => handleArchive(org)}
                                                    onUpdateDiscount={handleUpdateDiscount}
                                                    onMarkAsBilled={handleMarkAsBilled}
                                                    onUndoBilling={handleUndoBilling}
                                                />
                                            )) : (
                                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Laddar prisinformation...</div>
                                            )}
                                        </div>
                                    </section>

                                    {archivedOrgs.length > 0 && (
                                        <section className="pt-8 border-t border-gray-200 dark:border-gray-700">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-orange-500 mb-4">Arkiverade / Inaktiverade ({archivedOrgs.length})</h4>
                                            <div className="space-y-3">
                                                {pricing && archivedOrgs.map(org => (
                                                    <OrganizationCard 
                                                        key={org.id} 
                                                        org={org} 
                                                        pricing={pricing} 
                                                        onSelect={() => onSelectOrganization(org)}
                                                        onArchive={() => {}}
                                                        onRestore={() => handleRestore(org)}
                                                        onDeletePermanent={() => handleDeletePermanent(org)}
                                                        onUpdateDiscount={handleUpdateDiscount}
                                                        onMarkAsBilled={handleMarkAsBilled}
                                                        onUndoBilling={handleUndoBilling}
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
