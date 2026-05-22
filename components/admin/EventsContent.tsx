import React, { useState, useEffect } from 'react';
import { Organization, HyroxRace, StartGroup, RaceParticipant, HyroxRaceResult } from '../../types';
import { getPastRaces, saveRace, deleteRace } from '../../services/firebaseService';
import { PlusIcon, CalendarIcon, UsersIcon, TrashIcon, PencilIcon, SaveIcon } from '../icons';
import { motion } from 'framer-motion';

interface EventsContentProps {
    organization: Organization;
}

const EventEditor: React.FC<{
    event: HyroxRace | null;
    organizationId: string;
    studios: { id: string, name: string }[];
    onSave: (event: HyroxRace) => void;
    onCancel: () => void;
}> = ({ event, organizationId, studios, onSave, onCancel }) => {
    const [raceName, setRaceName] = useState(event?.raceName || '');
    const [scheduledDate, setScheduledDate] = useState(
        event?.scheduledDate ? new Date(event.scheduledDate).toISOString().split('T')[0] : ''
    );
    const [studioId, setStudioId] = useState(event?.studioId || '');
    const [participantsText, setParticipantsText] = useState('');
    const [participants, setParticipants] = useState<RaceParticipant[]>(
        event?.startGroups?.flatMap(g => g.participantList || []) || []
    );
    const [startGroups, setStartGroups] = useState<StartGroup[]>(
        event?.startGroups || [{ id: 'group-1', name: 'Heat 1', participants: '', participantList: [] }]
    );
    const [draggedParticipantId, setDraggedParticipantId] = useState<string | null>(null);

    const assignedIds = new Set(startGroups.flatMap(g => g.participantList?.map(p => p.id) || []));
    const unassignedParticipants = participants.filter(p => !assignedIds.has(p.id));

    const handleDragStart = (e: React.DragEvent, participantId: string) => {
        setDraggedParticipantId(participantId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', participantId);
    };

    const handleDropToUnassigned = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedParticipantId) return;

        setStartGroups(prevGroups => prevGroups.map(g => ({
            ...g,
            participantList: (g.participantList || []).filter(p => p.id !== draggedParticipantId)
        })));
        setDraggedParticipantId(null);
    };

    const handleDropToGroup = (e: React.DragEvent, groupId: string) => {
        e.preventDefault();
        if (!draggedParticipantId) return;

        const participant = participants.find(p => p.id === draggedParticipantId);
        if (!participant) return;

        setStartGroups(prevGroups => {
            const cleanedGroups = prevGroups.map(g => ({
                ...g,
                participantList: (g.participantList || []).filter(p => p.id !== draggedParticipantId)
            }));

            return cleanedGroups.map(g => {
                if (g.id === groupId) {
                    return {
                        ...g,
                        participantList: [...(g.participantList || []), participant]
                    };
                }
                return g;
            });
        });
        setDraggedParticipantId(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDeleteParticipant = (participantId: string) => {
        setParticipants(participants.filter(x => x.id !== participantId));
        setStartGroups(prevGroups => prevGroups.map(g => ({
            ...g,
            participantList: (g.participantList || []).filter(p => p.id !== participantId)
        })));
    };

    const [editingResultId, setEditingResultId] = useState<string | null>(null);
    const [editResultTime, setEditResultTime] = useState<number>(0);
    const [results, setResults] = useState<HyroxRaceResult[]>(event?.results || []);

    const [addMethod, setAddMethod] = useState<'manual' | 'import'>('manual');
    const [manualName, setManualName] = useState('');
    const [manualEmail, setManualEmail] = useState('');
    const [manualDivision, setManualDivision] = useState('Singel Herr');
    const [manualPartnerName, setManualPartnerName] = useState('');
    const [manualPartnerEmail, setManualPartnerEmail] = useState('');
    const [importDivision, setImportDivision] = useState('Singel Herr');
    const [editingParticipant, setEditingParticipant] = useState<RaceParticipant | null>(null);

    const divisions = [
        'Singel Herr',
        'Singel Dam',
        'Dubbel Herr',
        'Dubbel Dam',
        'Dubbel Mix',
        'Stafett/Lag'
    ];

    const getDivisionColor = (div?: string) => {
        const d = div || 'Singel Herr';
        if (d === 'Singel Herr') return 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
        if (d === 'Singel Dam') return 'bg-pink-50 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800';
        if (d === 'Dubbel Herr') return 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
        if (d === 'Dubbel Dam') return 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
        if (d === 'Dubbel Mix') return 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
        return 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    };

    const handleAddManualParticipant = () => {
        if (!manualName.trim()) {
            alert('Fyll i deltagarnamn.');
            return;
        }

        const isDouble = manualDivision.includes('Dubbel') || manualDivision.includes('Mix');
        if (isDouble && !manualPartnerName.trim()) {
            alert('Fyll i partnerns namn.');
            return;
        }

        const newP: RaceParticipant = {
            id: `p-${Date.now()}`,
            name: manualName.trim(),
            email: manualEmail.trim() || undefined,
            division: manualDivision,
            partnerName: isDouble ? manualPartnerName.trim() : undefined,
            partnerEmail: (isDouble && manualPartnerEmail.trim()) ? manualPartnerEmail.trim() : undefined,
            startNumber: participants.length + 1
        };

        setParticipants([...participants, newP]);
        setManualName('');
        setManualEmail('');
        setManualPartnerName('');
        setManualPartnerEmail('');
    };

    const handleStartEditParticipant = (p: RaceParticipant) => {
        setEditingParticipant({ ...p });
    };

    const handleUpdateParticipant = () => {
        if (!editingParticipant) return;
        if (!editingParticipant.name.trim()) {
            alert('Deltagarnamn får inte vara tomt.');
            return;
        }

        const isDouble = editingParticipant.division?.includes('Dubbel') || editingParticipant.division?.includes('Mix');
        const updatedP: RaceParticipant = {
            ...editingParticipant,
            name: editingParticipant.name.trim(),
            email: editingParticipant.email?.trim() || undefined,
            partnerName: isDouble ? editingParticipant.partnerName?.trim() : undefined,
            partnerEmail: (isDouble && editingParticipant.partnerEmail?.trim()) ? editingParticipant.partnerEmail.trim() : undefined,
        };

        setParticipants(prev => prev.map(p => p.id === updatedP.id ? updatedP : p));

        setStartGroups(prevGroups => prevGroups.map(g => ({
            ...g,
            participantList: (g.participantList || []).map(p => p.id === updatedP.id ? updatedP : p)
        })));

        setEditingParticipant(null);
    };

    const handleImportParticipants = () => {
        if (!participantsText.trim()) return;
        const lines = participantsText.split('\n').map(l => l.trim()).filter(Boolean);
        
        const newParticipants: RaceParticipant[] = lines.map((line, index) => {
            const parts = line.split(/[-;,]/).map(p => p.trim());
            const emails = parts.filter(p => p.includes('@'));
            const nonEmails = parts.filter(p => !p.includes('@') && p !== '');

            const name = nonEmails[0] || 'Deltagare';
            const email = emails[0] || undefined;
            const partnerName = nonEmails[1] || undefined;
            const partnerEmail = emails[1] || undefined;
            
            let division = importDivision;
            if (partnerName && division.startsWith('Singel')) {
                division = 'Dubbel Mix';
            }

            return {
                id: `p-${Date.now()}-${index}`,
                name,
                email,
                partnerName,
                partnerEmail,
                division,
                startNumber: participants.length + index + 1
            };
        });

        setParticipants([...participants, ...newParticipants]);
        setParticipantsText('');
    };

    const handleSave = () => {
        if (!raceName) {
            alert('Ange ett namn för eventet.');
            return;
        }

        const updatedGroups = [...startGroups];
        if (updatedGroups.length > 0) {
            const assignedIds = new Set(updatedGroups.flatMap(g => g.participantList?.map(p => p.id) || []));
            const unassigned = participants.filter(p => !assignedIds.has(p.id));
            if (unassigned.length > 0) {
                updatedGroups[0].participantList = [...(updatedGroups[0].participantList || []), ...unassigned];
            }
        }

        const newEvent: HyroxRace = {
            id: event?.id || `race-${Date.now()}`,
            organizationId,
            studioId: studioId || undefined,
            raceName,
            createdAt: event?.createdAt || Date.now(),
            scheduledDate: scheduledDate ? new Date(scheduledDate).getTime() : undefined,
            status: event?.status || 'planned',
            exercises: event?.exercises || [], 
            startGroups: updatedGroups,
            results: results
        };

        onSave(newEvent);
    };

    const handleSaveResult = (participantId: string) => {
        setResults(prev => prev.map(r => 
            (r.participantId === participantId || r.participant === participantId) 
                ? { ...r, time: editResultTime } 
                : r
        ).sort((a, b) => a.time - b.time));
        setEditingResultId(null);
    };

    const handleResetToPlanned = () => {
        if (!event) return;
        if (window.confirm('Är du säker på att du vill återställa detta event till planerat? Alla resultat kommer att raderas.')) {
            const newEvent: HyroxRace = {
                ...event,
                status: 'planned',
                results: []
            };
            onSave(newEvent);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {event?.status === 'completed' ? 'Genomfört Event' : 'Eventdetaljer'}
                </h3>
                {event?.status === 'completed' && (
                    <button 
                        onClick={handleResetToPlanned}
                        className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-200 transition-colors"
                    >
                        Återställ till planerat
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Eventnamn</label>
                    <input 
                        type="text" 
                        value={raceName}
                        onChange={(e) => setRaceName(e.target.value)}
                        placeholder="T.ex. Vårens Hyrox-simulering"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Datum</label>
                    <input 
                        type="date" 
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Skärm / Studio</label>
                    <select 
                        value={studioId}
                        onChange={(e) => setStudioId(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                    >
                        <option value="">Alla skärmar</option>
                        {studios.map(studio => (
                            <option key={studio.id} value={studio.id}>{studio.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Deltagare & Startlista</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* LEFT COLUMN: Add or Edit Participant */}
                    <div className="space-y-4">
                        {editingParticipant ? (
                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4 relative">
                                <h4 className="font-bold text-gray-900 dark:text-white text-md">Ändra deltagaruppgifter</h4>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Deltagarnamn / Lagmedlem 1 (Krav)</label>
                                    <input 
                                        type="text"
                                        value={editingParticipant.name}
                                        onChange={e => setEditingParticipant({ ...editingParticipant, name: e.target.value })}
                                        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">E-post (Kopplar resultat till medlemskonto)</label>
                                    <input 
                                        type="email"
                                        value={editingParticipant.email || ''}
                                        onChange={e => setEditingParticipant({ ...editingParticipant, email: e.target.value || undefined })}
                                        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Division / Klass</label>
                                    <select 
                                        value={editingParticipant.division || 'Singel Herr'}
                                        onChange={e => setEditingParticipant({ ...editingParticipant, division: e.target.value })}
                                        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    >
                                        {divisions.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                {(editingParticipant.division?.includes('Dubbel') || editingParticipant.division?.includes('Mix') || editingParticipant.division?.includes('Lag')) && (
                                    <div className="pt-2 border-t border-gray-150 dark:border-gray-800 space-y-3">
                                        <p className="text-xs font-semibold text-gray-500">Partneruppgifter (Lagmedlem 2)</p>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Partnerns Namn</label>
                                            <input 
                                                type="text"
                                                value={editingParticipant.partnerName || ''}
                                                onChange={e => setEditingParticipant({ ...editingParticipant, partnerName: e.target.value || undefined })}
                                                className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Partnerns E-post</label>
                                            <input 
                                                type="email"
                                                value={editingParticipant.partnerEmail || ''}
                                                onChange={e => setEditingParticipant({ ...editingParticipant, partnerEmail: e.target.value || undefined })}
                                                className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button 
                                        onClick={handleUpdateParticipant}
                                        className="flex-1 bg-primary text-white text-sm font-bold py-2 rounded-lg hover:brightness-105"
                                    >
                                        Spara ändringar
                                    </button>
                                    <button 
                                        onClick={() => setEditingParticipant(null)}
                                        className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-bold px-4 py-2 rounded-lg"
                                    >
                                        Avbryt
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4 text-xs font-semibold">
                                    <button
                                        onClick={() => setAddMethod('manual')}
                                        className={`flex-1 py-2 text-center rounded-lg transition-colors ${addMethod === 'manual' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Lägg till manuellt
                                    </button>
                                    <button
                                        onClick={() => setAddMethod('import')}
                                        className={`flex-1 py-2 text-center rounded-lg transition-colors ${addMethod === 'import' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Importera (Excel-lista)
                                    </button>
                                </div>

                                {addMethod === 'manual' ? (
                                    <div className="bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-4">
                                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">Registrera person eller lag</h4>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Deltagarnamn / Lagmedlem 1 *</label>
                                            <input 
                                                type="text" 
                                                placeholder="T.ex. Karin Svensson"
                                                value={manualName}
                                                onChange={e => setManualName(e.target.value)}
                                                className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">E-post * (Kopplar resultat automatiskt)</label>
                                            <input 
                                                type="email" 
                                                placeholder="karin@mindmote.se"
                                                value={manualEmail}
                                                onChange={e => setManualEmail(e.target.value)}
                                                className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Division / Klass</label>
                                            <select 
                                                value={manualDivision}
                                                onChange={e => setManualDivision(e.target.value)}
                                                className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                            >
                                                {divisions.map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {(manualDivision.includes('Dubbel') || manualDivision.includes('Mix') || manualDivision.includes('Lag')) && (
                                            <div className="pt-2 border-t border-gray-150 dark:border-gray-800 space-y-3">
                                                <p className="text-xs font-semibold text-gray-500">Partner (Lagmedlem 2)</p>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Namn *</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="T.ex. Maria Nilsson"
                                                        value={manualPartnerName}
                                                        onChange={e => setManualPartnerName(e.target.value)}
                                                        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">E-post</label>
                                                    <input 
                                                        type="email" 
                                                        placeholder="maria@mindmote.se"
                                                        value={manualPartnerEmail}
                                                        onChange={e => setManualPartnerEmail(e.target.value)}
                                                        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <button 
                                            onClick={handleAddManualParticipant}
                                            className="w-full bg-primary text-white text-sm font-bold py-2 rounded-lg hover:brightness-105"
                                        >
                                            Lägg till deltagare
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Massimport från Excel / Text</h4>
                                            <select 
                                                value={importDivision}
                                                onChange={e => setImportDivision(e.target.value)}
                                                className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-900 dark:text-white outline-none"
                                            >
                                                {divisions.map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Klistra in rader. Vi letar automatiskt upp namn och e-post (om det finns en @). <br />
                                            Format standard: <code className="bg-gray-100 dark:bg-gray-900 p-0.5 rounded text-red-500">Namn - E-post</code>
                                        </p>
                                        <textarea 
                                            value={participantsText}
                                            onChange={(e) => setParticipantsText(e.target.value)}
                                            placeholder="Anna Andersson - anna@exempel.se&#10;Johan Karlsson - johan@exempel.se - Erik Svensson - erik@exempel.se"
                                            className="w-full h-32 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none resize-none"
                                        />
                                        <button 
                                            onClick={handleImportParticipants}
                                            className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-xs"
                                        >
                                            Importera till deltagarlistan ({importDivision})
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* RIGHT COLUMN: Participant list */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                Alla Deltagare ({unassignedParticipants.length} otilldelade)
                            </label>
                            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded font-mono">
                                Totalt: {participants.length}
                            </span>
                        </div>
                        <div 
                            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-[350px] overflow-y-auto space-y-2"
                            onDrop={handleDropToUnassigned}
                            onDragOver={handleDragOver}
                        >
                            {unassignedParticipants.length === 0 ? (
                                <p className="text-gray-500 text-xs text-center mt-12">Alla deltagare är tilldelade heat, eller så finns inga deltagare registrerade.</p>
                            ) : (
                                unassignedParticipants.map(p => (
                                    <div 
                                        key={p.id} 
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, p.id)}
                                        className="flex justify-between items-center bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all shadow-xs"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="bg-primary/10 text-primary font-bold text-xs px-2 py-1 rounded-md">#{p.startNumber}</span>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {p.name} {p.partnerName && <span className="text-gray-500 font-normal">& {p.partnerName}</span>}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-1 items-center">
                                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getDivisionColor(p.division)}`}>
                                                        {p.division || 'Singel Herr'}
                                                    </span>
                                                    {p.email && <span className="text-[11px] text-gray-400 truncate max-w-[140px]" title={p.email}>{p.email}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => handleStartEditParticipant(p)}
                                                className="text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 p-1 rounded-lg"
                                                title="Redigera deltagare"
                                            >
                                                <PencilIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteParticipant(p.id)}
                                                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded-lg"
                                                title="Ta bort deltagare"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-8">

                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Heat (Startgrupper)</h3>
                    <button 
                        onClick={() => setStartGroups([...startGroups, { id: `group-${Date.now()}`, name: `Heat ${startGroups.length + 1}`, participants: '', participantList: [] }])}
                        className="text-primary font-bold text-sm flex items-center gap-1 hover:underline"
                    >
                        <PlusIcon className="w-4 h-4" /> Lägg till Heat
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {startGroups.map((group, index) => (
                        <div 
                            key={group.id} 
                            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col"
                            onDrop={(e) => handleDropToGroup(e, group.id)}
                            onDragOver={handleDragOver}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <input 
                                    type="text" 
                                    value={group.name}
                                    onChange={(e) => {
                                        const newGroups = [...startGroups];
                                        newGroups[index].name = e.target.value;
                                        setStartGroups(newGroups);
                                    }}
                                    className="bg-transparent font-bold text-gray-900 dark:text-white outline-none border-b border-transparent focus:border-primary"
                                />
                                <button 
                                    onClick={() => setStartGroups(startGroups.filter(g => g.id !== group.id))}
                                    className="text-gray-400 hover:text-red-500"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="flex-grow bg-white dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-2 min-h-[100px] space-y-2">
                                {!group.participantList || group.participantList.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center mt-8">Dra deltagare hit</p>
                                ) : (
                                    group.participantList.map(p => (
                                        <div 
                                            key={p.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, p.id)}
                                            className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 cursor-grab active:cursor-grabbing text-sm"
                                        >
                                            <span className="text-primary font-bold text-xs">#{p.startNumber}</span>
                                            <span className="font-medium text-gray-900 dark:text-white truncate">
                                                {p.name} {p.partnerName && `& ${p.partnerName}`}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {event?.status === 'completed' && results && results.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Resultat</h3>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
                        {results.map((result, index) => {
                            const resultId = result.participantId || result.participant;
                            const isEditing = editingResultId === resultId;
                            
                            return (
                                <div key={index} className="flex justify-between items-center bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-gray-900 dark:text-white">{index + 1}.</span>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{result.participant}</p>
                                            {result.partnerName && <p className="text-xs text-gray-500">& {result.partnerName}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    value={Math.floor(editResultTime / 60)}
                                                    onChange={(e) => setEditResultTime((parseInt(e.target.value) || 0) * 60 + (editResultTime % 60))}
                                                    className="w-16 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-right"
                                                />
                                                <span>:</span>
                                                <input 
                                                    type="number" 
                                                    value={editResultTime % 60}
                                                    onChange={(e) => setEditResultTime(Math.floor(editResultTime / 60) * 60 + (parseInt(e.target.value) || 0))}
                                                    className="w-16 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-right"
                                                    max="59"
                                                />
                                                <button 
                                                    onClick={() => handleSaveResult(resultId)}
                                                    className="bg-green-100 text-green-800 px-3 py-1 rounded font-bold text-xs"
                                                >
                                                    Spara
                                                </button>
                                                <button 
                                                    onClick={() => setEditingResultId(null)}
                                                    className="bg-gray-100 text-gray-800 px-3 py-1 rounded font-bold text-xs"
                                                >
                                                    Avbryt
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="font-mono font-bold text-lg text-gray-900 dark:text-white">
                                                    {Math.floor(result.time / 60)}:{String(result.time % 60).padStart(2, '0')}
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setEditingResultId(resultId);
                                                        setEditResultTime(result.time);
                                                    }}
                                                    className="text-gray-400 hover:text-primary"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-4 pt-8 border-t border-gray-200 dark:border-gray-800">
                <button 
                    onClick={onCancel}
                    className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                >
                    Avbryt
                </button>
                <button 
                    onClick={handleSave}
                    className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-md hover:brightness-110 flex items-center gap-2"
                >
                    <SaveIcon className="w-5 h-5" /> Spara Event
                </button>
            </div>
        </div>
    );
};

export const EventsContent: React.FC<EventsContentProps> = ({ organization }) => {
    const [events, setEvents] = useState<HyroxRace[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [selectedEvent, setSelectedEvent] = useState<HyroxRace | null>(null);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'archive'>('upcoming');

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const fetchedRaces = await getPastRaces(organization.id);
            setEvents(fetchedRaces);
        } catch (error) {
            console.error("Failed to fetch events", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, [organization.id]);

    const handleSaveEvent = async (event: HyroxRace) => {
        try {
            await saveRace(event, organization.id);
            await fetchEvents();
            setView('list');
            setSelectedEvent(null);
        } catch (error) {
            console.error("Failed to save event", error);
            alert("Kunde inte spara eventet.");
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        // Since we can't use window.confirm, we'll just delete it for now.
        // Or we could add a custom confirm modal, but let's keep it simple.
        try {
            await deleteRace(eventId);
            await fetchEvents();
        } catch (error) {
            console.error("Failed to delete event", error);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Laddar event...</div>;
    }

    const upcomingEvents = events.filter(e => e.status !== 'completed' && (!e.results || e.results.length === 0));
    const completedEvents = events.filter(e => e.status === 'completed' || (e.results && e.results.length > 0));

    if (view === 'list') {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Event & Tävlingar</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Planera och hantera kommande lopp och simuleringar.</p>
                    </div>
                    <button 
                        onClick={() => setView('create')}
                        className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-md hover:brightness-110 flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" /> Skapa Event
                    </button>
                </div>

                <div className="flex border-b border-gray-200 dark:border-gray-800">
                    <button
                        onClick={() => setActiveTab('upcoming')}
                        className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${
                            activeTab === 'upcoming'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        Kommande ({upcomingEvents.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('archive')}
                        className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${
                            activeTab === 'archive'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        Arkiv / Genomförda ({completedEvents.length})
                    </button>
                </div>

                {activeTab === 'upcoming' && (
                    upcomingEvents.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-800 shadow-sm">
                            <div className="bg-gray-100 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CalendarIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Inga event planerade</h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                                Här kan du skapa upp Hyrox-simuleringar och andra tävlingar i förväg, hantera startlistor och heat.
                            </p>
                            <button 
                                onClick={() => setView('create')}
                                className="text-primary font-bold hover:underline"
                            >
                                Skapa ditt första event
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {upcomingEvents.map(event => (
                                <div key={event.id} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{event.raceName}</h3>
                                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                            Planerat
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4" />
                                            {event.scheduledDate ? new Date(event.scheduledDate).toLocaleDateString('sv-SE') : 'Inget datum satt'}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <UsersIcon className="w-4 h-4" />
                                            {event.startGroups?.reduce((acc, g) => acc + (g.participantList?.length || 0), 0) || 0} deltagare
                                        </div>
                                    </div>
                                    <div className="mt-6 flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setSelectedEvent(event);
                                                setView('edit');
                                            }}
                                            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold py-2 rounded-lg transition-colors text-sm"
                                        >
                                            Hantera
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEvent(event.id)}
                                            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center"
                                            title="Radera event"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {activeTab === 'archive' && (
                    completedEvents.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-800 shadow-sm">
                            <div className="bg-gray-100 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CalendarIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Inget i arkivet</h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                                När ett lopp är genomfört på skärmen hamnar det här automatiskt.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {completedEvents.map(event => (
                                <div key={event.id} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow opacity-80">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{event.raceName}</h3>
                                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-800">
                                            Genomfört
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4" />
                                            {new Date(event.createdAt).toLocaleDateString('sv-SE')}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <UsersIcon className="w-4 h-4" />
                                            {event.results?.length || 0} i mål
                                        </div>
                                    </div>
                                    <div className="mt-6 flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setSelectedEvent(event);
                                                setView('edit');
                                            }}
                                            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold py-2 rounded-lg transition-colors text-sm"
                                        >
                                            Visa detaljer
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEvent(event.id)}
                                            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center"
                                            title="Radera event"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => { setView('list'); setSelectedEvent(null); }}
                    className="text-gray-500 hover:text-gray-900 dark:hover:text-white font-bold"
                >
                    &larr; Tillbaka
                </button>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    {view === 'create' ? 'Skapa Nytt Event' : 'Hantera Event'}
                </h2>
            </div>
            
            <EventEditor 
                event={selectedEvent} 
                organizationId={organization.id} 
                studios={organization.studios}
                onSave={handleSaveEvent} 
                onCancel={() => { setView('list'); setSelectedEvent(null); }} 
            />
        </div>
    );
};
