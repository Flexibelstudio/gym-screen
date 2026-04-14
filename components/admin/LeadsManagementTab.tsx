import React, { useState, useEffect } from 'react';
import { Lead } from '../../types';
import { getLeads, updateLeadStatus } from '../../services/firebaseService';
import { MailIcon, PhoneIcon, CheckCircleIcon, ArchiveIcon } from '../icons';

export const LeadsManagementTab: React.FC = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

            {isLoading ? (
                <div className="text-center py-12 text-gray-500">Laddar leads...</div>
            ) : leads.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    Inga förfrågningar ännu.
                </div>
            ) : (
                <div className="space-y-4">
                    {leads.map(lead => (
                        <div key={lead.id} className={`p-5 rounded-xl border transition-colors ${lead.status === 'new' ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{lead.gymName}</h3>
                                        {getStatusBadge(lead.status)}
                                        <span className="text-xs text-gray-500">{new Date(lead.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="text-sm text-gray-700 dark:text-gray-300 mb-3 space-y-1">
                                        <p><span className="font-medium">Kontaktperson:</span> {lead.name}</p>
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
                                    <a 
                                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${lead.email}&su=${encodeURIComponent('Angående er förfrågan om SmartStudio')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors text-sm"
                                    >
                                        <MailIcon className="w-4 h-4" /> Svara (Gmail)
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
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
