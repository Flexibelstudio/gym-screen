import React, { useState, useEffect } from 'react';
import { Lead } from '../../types';
import { getLeads, updateLeadStatus, updateLeadVerified, deleteLead } from '../../services/firebaseService';
import { MailIcon, PhoneIcon, CheckCircleIcon, ArchiveIcon, TrashIcon, RefreshIcon } from '../icons';
import { useConfirm } from '../ConfirmContext';

export const LeadsManagementTab: React.FC = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // Källfilter. 'all' = allt, annars ett source-värde. Leads utan source är
    // gamla förfrågningar från landningssidan och räknas som 'website'.
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    // Aktiva (nya + kontaktade) och arkivet visas var for sig. Radering gar
    // bara fran arkivet — arkivering blir da ett medvetet steg fore radering.
    const [vy, setVy] = useState<'aktiva' | 'arkiv'>('aktiva');
    const confirm = useConfirm();

    useEffect(() => {
        loadLeads();
    }, []);

    const loadLeads = async () => {
        setIsLoading(true);
        const data = await getLeads();
        setLeads(data);
        setIsLoading(false);
    };

    const handleStatusChange = async (id: string, newStatus: Lead['status']) => {
        await updateLeadStatus(id, newStatus);
        setLeads(leads.map(lead => lead.id === id ? { ...lead, status: newStatus } : lead));
    };

    const handleDelete = async (lead: Lead) => {
        const ok = await confirm({
            title: 'Radera lead?',
            message: `${lead.gymName || lead.name} tas bort permanent, inklusive kontaktuppgifterna. Det gar inte att angra.`,
            confirmText: 'Radera',
            cancelText: 'Avbryt',
            confirmColor: 'red'
        });
        if (!ok) return;
        try {
            await deleteLead(lead.id);
            setLeads(prev => prev.filter(l => l.id !== lead.id));
        } catch {
            alert('Kunde inte radera leadet. Forsok igen.');
        }
    };

    const handleVerifiedChange = async (id: string, verified: boolean) => {
        await updateLeadVerified(id, verified);
        setLeads(leads.map(lead => lead.id === id ? { ...lead, memberVerified: verified } : lead));
    };

    const sourceOf = (lead: Lead) => lead.source || 'website';
    const aktivaLeads = leads.filter(l => l.status !== 'archived');
    const arkivLeads = leads.filter(l => l.status === 'archived');
    const vyLeads = vy === 'arkiv' ? arkivLeads : aktivaLeads;
    const availableSources = Array.from(new Set(vyLeads.map(sourceOf)));
    const visibleLeads = sourceFilter === 'all' ? vyLeads : vyLeads.filter(l => sourceOf(l) === sourceFilter);
    const sourceLabel = (src: string) => src === 'klubbsverige' ? 'KlubbSverige' : src === 'website' ? 'Landningssidan' : src;

    const getStatusBadge = (status: Lead['status']) => {
        switch (status) {
            case 'new':
                return <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold">Ny</span>;
            case 'contacted':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-bold">Kontaktad</span>;
            case 'archived':
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 rounded-full text-xs font-bold">Arkiverad</span>;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Leads & Förfrågningar</h2>
                    <p className="text-gray-600 dark:text-gray-400">Hantera inkommande demo-förfrågningar från landningssidan.</p>
                </div>
                <button onClick={loadLeads} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium">
                    Uppdatera
                </button>
            </div>

            <div className="flex items-center gap-2 mb-5 border-b border-gray-200 dark:border-gray-700">
                {([['aktiva', `Aktiva (${aktivaLeads.length})`], ['arkiv', `Arkiv (${arkivLeads.length})`]] as const).map(([id, namn]) => (
                    <button
                        key={id}
                        onClick={() => { setVy(id); setSourceFilter('all'); }}
                        className={`px-4 py-2 -mb-px text-sm font-bold border-b-2 transition-colors ${vy === id ? 'border-primary text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        {namn}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-500">Laddar leads...</div>
            ) : vyLeads.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    {vy === 'arkiv' ? 'Arkivet är tomt.' : 'Inga aktiva förfrågningar.'}
                </div>
            ) : (
                <div className="space-y-4">
                    {availableSources.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2 pb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Källa</span>
                            {['all', ...availableSources].map(src => (
                                <button
                                    key={src}
                                    onClick={() => setSourceFilter(src)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${sourceFilter === src ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                >
                                    {src === 'all' ? `Alla (${vyLeads.length})` : `${sourceLabel(src)} (${vyLeads.filter(l => sourceOf(l) === src).length})`}
                                </button>
                            ))}
                        </div>
                    )}
                    {visibleLeads.map(lead => (
                        <div key={lead.id} className={`p-5 rounded-xl border transition-colors ${lead.status === 'new' ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{lead.gymName}</h3>
                                        {getStatusBadge(lead.status)}
                                        {lead.source === 'klubbsverige' && (
                                            <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs font-black uppercase tracking-wider">
                                                KlubbSverige
                                            </span>
                                        )}
                                        {lead.memberVerified && (
                                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-bold">
                                                Medlemskap verifierat
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">{new Date(lead.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="text-sm text-gray-700 dark:text-gray-300 mb-3 space-y-1">
                                        <p><span className="font-medium">Kontaktperson:</span> {lead.name}</p>
                                        {lead.orgNumber && <p><span className="font-medium">Org.nr:</span> <span className="font-mono">{lead.orgNumber}</span></p>}
                                        {lead.screensInterested ? <p><span className="font-medium">Antal skärmar:</span> {lead.screensInterested}</p> : null}
                                        {lead.campaignCode && <p><span className="font-medium">Kampanjkod:</span> <span className="font-mono">{lead.campaignCode}</span></p>}
                                        <div className="flex items-center gap-4">
                                            <p className="flex items-center gap-1"><MailIcon className="w-4 h-4 text-gray-400" /> {lead.email}</p>
                                            {lead.phone && <p className="flex items-center gap-1"><PhoneIcon className="w-4 h-4 text-gray-400" /> {lead.phone}</p>}
                                        </div>
                                    </div>
                                    {lead.message && (
                                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-400 italic border border-gray-100 dark:border-gray-800">
                                            "{lead.message}"
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex flex-col gap-2 min-w-[140px]">
                                    {lead.orgNumber && (
                                        <button
                                            onClick={() => handleVerifiedChange(lead.id, !lead.memberVerified)}
                                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${lead.memberVerified ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                            title="Stäm av org.nr mot KlubbSveriges medlemsregister"
                                        >
                                            {lead.memberVerified ? 'Verifierad' : 'Markera verifierad'}
                                        </button>
                                    )}

                                    <a 
                                        href={`mailto:${lead.email}?subject=${encodeURIComponent('Angående er förfrågan om SmartStudio')}`}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors text-sm"
                                    >
                                        <MailIcon className="w-4 h-4" /> Svara via e-post
                                    </a>
                                    
                                    {lead.status === 'new' && (
                                        <button 
                                            onClick={() => handleStatusChange(lead.id, 'contacted')}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors text-sm"
                                        >
                                            <CheckCircleIcon className="w-4 h-4" /> Markera kontaktad
                                        </button>
                                    )}
                                    
                                    {lead.status !== 'archived' && (
                                        <button 
                                            onClick={() => handleStatusChange(lead.id, 'archived')}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                                        >
                                            <ArchiveIcon className="w-4 h-4" /> Arkivera
                                        </button>
                                    )}

                                    {lead.status === 'archived' && (
                                        <>
                                            <button
                                                onClick={() => handleStatusChange(lead.id, 'contacted')}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                                                title="Flytta tillbaka till aktiva"
                                            >
                                                <RefreshIcon className="w-4 h-4" /> Återställ
                                            </button>
                                            <button
                                                onClick={() => handleDelete(lead)}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm"
                                            >
                                                <TrashIcon className="w-4 h-4" /> Radera
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
