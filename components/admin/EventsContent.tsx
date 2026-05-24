import React, { useState, useEffect } from 'react';
import { Organization, HyroxRace, StartGroup, RaceParticipant, HyroxRaceResult } from '../../types';
import { getPastRaces, saveRace, deleteRace } from '../../services/firebaseService';
import { PlusIcon, CalendarIcon, UsersIcon, TrashIcon, PencilIcon, SaveIcon, QrCodeIcon, LinkIcon, CopyIcon, CloseIcon, TrophyIcon, CheckIcon, PaperAirplaneIcon } from '../icons';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

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
    const [startIntervalMinutes, setStartIntervalMinutes] = useState<number>(() => {
        if (event?.startIntervalMinutes !== undefined) {
            return Math.floor(event.startIntervalMinutes);
        }
        return 2;
    });
    const [startIntervalSeconds, setStartIntervalSeconds] = useState<number>(() => {
        if (event?.startIntervalMinutes !== undefined) {
            return Math.round((event.startIntervalMinutes % 1) * 60);
        }
        return 0;
    });
    const [participantsText, setParticipantsText] = useState('');
    const [participants, setParticipants] = useState<RaceParticipant[]>(
        event?.startGroups?.flatMap(g => g.participantList || []) || []
    );
    const [startGroups, setStartGroups] = useState<StartGroup[]>(
        event?.startGroups || [{ id: 'group-1', name: 'Heat 1', participants: '', participantList: [] }]
    );
    const [draggedParticipantId, setDraggedParticipantId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCopyLink = (url: string) => {
        if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleShare = (url: string, title: string) => {
        if (typeof window !== 'undefined' && navigator.share) {
            navigator.share({
                title: title,
                text: `Följ loppet ${title} live!`,
                url: url
            }).catch(err => console.log(err));
        } else {
            handleCopyLink(url);
        }
    };

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
    const [manualTeamName, setManualTeamName] = useState('');
    const [manualPartnerName, setManualPartnerName] = useState('');
    const [manualPartnerEmail, setManualPartnerEmail] = useState('');
    const [importDivision, setImportDivision] = useState('Singel Herr');
    const [editingParticipant, setEditingParticipant] = useState<RaceParticipant | null>(null);

    const divisions = [
        'Singel Herr',
        'Singel Dam',
        'Dubbel Herr',
        'Dubbel Dam',
        'Dubbel Mix'
    ];

    const getDivisionColor = (div?: string) => {
        const d = div || 'Singel Herr';
        if (d === 'Singel Herr') return 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
        if (d === 'Singel Dam') return 'bg-pink-50 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800';
        if (d === 'Dubbel Herr') return 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
        if (d === 'Dubbel Dam') return 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
        if (d === 'Dubbel Mix') return 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
        if (d === 'Lag Herr') return 'bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
        if (d === 'Lag Dam') return 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
        if (d === 'Lag Mix') return 'bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800';
        return 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    };

    const handleAddManualParticipant = () => {
        if (!manualName.trim()) {
            alert('Fyll i deltagarnamn.');
            return;
        }

        const isDouble = manualDivision.includes('Dubbel') || manualDivision.includes('Mix') || manualDivision.includes('Lag');
        if (isDouble && !manualPartnerName.trim()) {
            alert('Fyll i partnerns / lagmedlemmens namn.');
            return;
        }

        const newP: RaceParticipant = {
            id: `p-${Date.now()}`,
            name: manualName.trim(),
            email: manualEmail.trim() || undefined,
            division: manualDivision,
            partnerName: isDouble ? manualPartnerName.trim() : undefined,
            partnerEmail: (isDouble && manualPartnerEmail.trim()) ? manualPartnerEmail.trim() : undefined,
            teamName: (isDouble && manualTeamName.trim()) ? manualTeamName.trim() : undefined,
            startNumber: participants.length + 1
        };

        setParticipants([...participants, newP]);
        setManualName('');
        setManualEmail('');
        setManualTeamName('');
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

        const isDouble = editingParticipant.division?.includes('Dubbel') || editingParticipant.division?.includes('Mix') || editingParticipant.division?.includes('Lag');
        const updatedP: RaceParticipant = {
            ...editingParticipant,
            name: editingParticipant.name.trim(),
            email: editingParticipant.email?.trim() || undefined,
            partnerName: isDouble ? editingParticipant.partnerName?.trim() : undefined,
            partnerEmail: (isDouble && editingParticipant.partnerEmail?.trim()) ? editingParticipant.partnerEmail.trim() : undefined,
            teamName: isDouble ? editingParticipant.teamName?.trim() : undefined,
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
            results: results,
            startIntervalMinutes: startIntervalMinutes + (startIntervalSeconds / 60)
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
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tid mellan heat</label>
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                            <input 
                                type="number" 
                                min="0"
                                max="60"
                                value={startIntervalMinutes}
                                onChange={(e) => setStartIntervalMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                className="w-full bg-transparent text-gray-900 dark:text-white outline-none font-bold"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase ml-2 select-none">min</span>
                        </div>
                        <div className="flex-1 flex items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                            <input 
                                type="number" 
                                min="0"
                                max="59"
                                value={startIntervalSeconds}
                                onChange={(e) => setStartIntervalSeconds(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                                className="w-full bg-transparent text-gray-900 dark:text-white outline-none font-bold"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase ml-2 select-none">sek</span>
                        </div>
                    </div>
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
                                        <p className="text-xs font-semibold text-gray-500">Lag- & Partneruppgifter</p>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Lagnamn (T.ex. Team Flexibel)</label>
                                            <input 
                                                type="text"
                                                placeholder="Lämna tomt för att visa 'Namn & Partner'"
                                                value={editingParticipant.teamName || ''}
                                                onChange={e => setEditingParticipant({ ...editingParticipant, teamName: e.target.value || undefined })}
                                                className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Partnerns/Lagmedlem 2:s Namn</label>
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
                                                <p className="text-xs font-semibold text-gray-500">Lag- & Partneruppgifter</p>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Lagnamn (Frivilligt)</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="T.ex. Team Flexibel"
                                                        value={manualTeamName}
                                                        onChange={e => setManualTeamName(e.target.value)}
                                                        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none mb-3"
                                                     />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Partnerns / Lagmedlem 2:s Namn *</label>
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
                                                    {p.teamName ? (
                                                        <>
                                                            <span className="block text-sm font-black text-indigo-600 dark:text-indigo-400">{p.teamName}</span>
                                                            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{p.name} & {p.partnerName}</span>
                                                        </>
                                                    ) : (
                                                        <>{p.name} {p.partnerName && <span className="text-gray-500 font-normal">& {p.partnerName}</span>}</>
                                                    )}
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
                                                {p.teamName ? `${p.teamName} (${p.name} & ${p.partnerName})` : `${p.name}${p.partnerName ? ` & ${p.partnerName}` : ''}`}
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
                            
                            const groupForParticipant = event?.startGroups?.find(g => g.id === result.groupId);
                            const matchedParticipant = groupForParticipant?.participantList?.find(p => 
                                p.name === result.participant || 
                                (p.partnerName && `${p.name} & ${p.partnerName}` === result.participant)
                            );
                            const finalTeamName = result.teamName || matchedParticipant?.teamName;
                            
                            return (
                                <div key={index} className="flex justify-between items-center bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-gray-900 dark:text-white">{index + 1}.</span>
                                        <div>
                                            {finalTeamName ? (
                                                <>
                                                    <p className="font-bold text-indigo-600 dark:text-indigo-400">{finalTeamName}</p>
                                                    <p className="text-xs text-slate-500 font-medium">{result.participant}</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="font-bold text-gray-900 dark:text-white">{result.participant}</p>
                                                    {result.partnerName && <p className="text-xs text-gray-500">& {result.partnerName}</p>}
                                                </>
                                            )}
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

            {event?.id && (
                <div className="border-t border-gray-200 dark:border-gray-800 pt-8 mt-8">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                        <QrCodeIcon className="w-5 h-5 text-indigo-500" />
                        Dela Liveresultat & QR-kod
                    </h3>
                    <div className="bg-gradient-to-br from-indigo-50/50 via-white to-amber-55/30 dark:from-slate-900/40 dark:via-slate-900/60 dark:to-indigo-950/20 border border-indigo-100 dark:border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6">
                        <div className="bg-white p-3 rounded-2xl border border-gray-200 dark:border-gray-750 flex-shrink-0 shadow-lg dark:shadow-none">
                            <QRCode 
                                value={`${window.location.origin}/live/${event.id}`} 
                                size={120}
                                level="M"
                            />
                        </div>
                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <div>
                                <h4 className="font-extrabold text-sm text-gray-900 dark:text-white mb-1">
                                    Scanna eller gå till Live-länken
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg">
                                    Åskådare, ledare och deltagare kan scanna denna QR-kod eller använda länken för att följa tävlingen i realtid (tider, placeringar, heat) direkt på mobilen eller en extra skärm.
                                </p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2.5 max-w-md">
                                <button
                                    type="button"
                                    onClick={() => handleCopyLink(`${window.location.origin}/live/${event.id}`)}
                                    className="flex-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-white font-bold px-4 py-2.5 rounded-xl border border-gray-250 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                                >
                                    {copied ? (
                                        <>
                                            <CheckIcon className="w-4 h-4 text-emerald-500" />
                                            <span>Kopierad!</span>
                                        </>
                                    ) : (
                                        <>
                                            <CopyIcon className="w-4 h-4 text-slate-500" />
                                            <span>Kopiera länk</span>
                                        </>
                                    )}
                                </button>
                                
                                {typeof navigator !== 'undefined' && navigator.share ? (
                                    <button
                                        type="button"
                                        onClick={() => handleShare(`${window.location.origin}/live/${event.id}`, raceName || 'Hyrox Race')}
                                        className="flex-1 bg-primary text-white font-bold px-4 py-2.5 rounded-xl hover:brightness-110 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm shadow-primary/20"
                                    >
                                        <PaperAirplaneIcon className="w-4 h-4" />
                                        <span>Dela länk</span>
                                    </button>
                                ) : (
                                    <a
                                        href={`/live/${event.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 bg-indigo-650 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm shadow-indigo-500/20 text-center"
                                    >
                                        <LinkIcon className="w-4 h-4" />
                                        <span>Öppna live-vy</span>
                                    </a>
                                )}
                            </div>
                        </div>
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
    const [shareEvent, setShareEvent] = useState<HyroxRace | null>(null);
    const [copiedShare, setCopiedShare] = useState(false);

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
                                            {(() => {
                                                const sGroups = event.startGroups || [];
                                                let singles = 0;
                                                let teams = 0;
                                                let totalPhysical = 0;
                                                sGroups.forEach(g => {
                                                    g.participantList?.forEach(p => {
                                                        if (p.partnerName) {
                                                            teams++;
                                                            totalPhysical += 2;
                                                        } else {
                                                            singles++;
                                                            totalPhysical += 1;
                                                        }
                                                    });
                                                });
                                                if (teams > 0) {
                                                    return `${totalPhysical} deltagare (${teams} lag${singles > 0 ? `, ${singles} singel` : ''})`;
                                                }
                                                return `${totalPhysical} deltagare`;
                                            })()}
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
                                            onClick={() => setShareEvent(event)}
                                            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3.5 py-2 rounded-lg font-bold transition-colors flex items-center justify-center"
                                            title="Visa QR & Dela"
                                        >
                                            <QrCodeIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEvent(event.id)}
                                            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3.5 py-2 rounded-lg font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center"
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
                                            onClick={() => setShareEvent(event)}
                                            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3.5 py-2 rounded-lg font-bold transition-colors flex items-center justify-center animate-fade-in"
                                            title="Visa QR & Dela"
                                        >
                                            <QrCodeIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEvent(event.id)}
                                            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3.5 py-2 rounded-lg font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center"
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
                
                {/* EVENT SHARE / QR POPUP MODAL */}
                <AnimatePresence>
                    {shareEvent && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => { setShareEvent(null); setCopiedShare(false); }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            
                            {/* Card */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                transition={{ type: "spring", duration: 0.35 }}
                                className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-md relative z-10 p-6 text-gray-900 dark:text-white"
                            >
                                <button
                                    onClick={() => { setShareEvent(null); setCopiedShare(false); }}
                                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                    <CloseIcon className="w-5 h-5" />
                                </button>
                                
                                <div className="flex items-center gap-3 mb-4 pr-6">
                                    <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100/50 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                        <QrCodeIcon className="w-6 h-6" />
                                    </div>
                                    <div className="truncate">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                            shareEvent.status === 'completed' 
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400' 
                                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-400'
                                        }`}>
                                            {shareEvent.status === 'completed' ? 'Genomfört' : 'Kommande Live-tavla'}
                                        </span>
                                        <h3 className="text-lg font-black text-gray-950 dark:text-white leading-tight mt-1 truncate">
                                            {shareEvent.raceName}
                                        </h3>
                                    </div>
                                </div>
                                
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                                    Deltagare och publik kan scanna koden eller öppna länken på mobilen för att se startlistor, heat, realtidsklockor och slutresultat live!
                                </p>

                                {/* RESULTS QUICK-VIEW IF COMPLETED */}
                                {shareEvent.status === 'completed' && shareEvent.results && shareEvent.results.length > 0 && (
                                    <div className="mb-4 p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-950/50 rounded-2xl">
                                        <h4 className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2.5 select-none">
                                            <TrophyIcon className="w-4 h-4 text-amber-500" />
                                            Resultatpallen (Topp 3)
                                        </h4>
                                        <div className="space-y-1.5">
                                            {[...shareEvent.results]
                                                .sort((a, b) => a.time - b.time)
                                                .slice(0, 3)
                                                .map((res, idx) => {
                                                    const groupForParticipant = shareEvent.startGroups?.find(g => g.id === res.groupId);
                                                    const matchedParticipant = groupForParticipant?.participantList?.find(p => 
                                                        p.name === res.participant || 
                                                        (p.partnerName && `${p.name} & ${p.partnerName}` === res.participant)
                                                    );
                                                    const finalName = res.teamName || matchedParticipant?.teamName || res.participant;
                                                    
                                                    return (
                                                        <div key={idx} className="flex justify-between items-center text-xs">
                                                            <div className="flex items-center gap-2 truncate mr-2">
                                                                <span className="font-extrabold text-amber-600 dark:text-amber-400 w-4">#{idx + 1}</span>
                                                                <span className="font-bold text-gray-800 dark:text-slate-150 truncate">{finalName}</span>
                                                            </div>
                                                            <span className="font-mono font-bold text-gray-900 dark:text-white bg-white/80 dark:bg-black/35 px-1.5 py-0.5 rounded border border-gray-150 dark:border-gray-800">
                                                                {Math.floor(res.time / 60)}:{String(res.time % 60).padStart(2, '0')}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                        {shareEvent.results.length > 3 && (
                                            <div className="text-center mt-2.5 pt-2 border-t border-amber-100/50 dark:border-amber-950/50">
                                                <button
                                                    onClick={() => {
                                                        setSelectedEvent(shareEvent);
                                                        setView('edit');
                                                        setShareEvent(null);
                                                    }}
                                                    className="text-[10px] uppercase font-extrabold text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                                                >
                                                    Visa alla {shareEvent.results.length} resultat &rarr;
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* QR CODE BOX */}
                                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl mb-4 shadow-inner">
                                    <div className="bg-white p-3 rounded-xl shadow-md border border-gray-250 flex items-center justify-center">
                                        <QRCode 
                                            value={`${window.location.origin}/live/${shareEvent.id}`} 
                                            size={140}
                                            level="M"
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-3.5 uppercase tracking-widest bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-full">
                                        Skanna live-tavla
                                    </span>
                                </div>
                                
                                {/* ACTIONS */}
                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            if (typeof window !== 'undefined') {
                                                navigator.clipboard.writeText(`${window.location.origin}/live/${shareEvent.id}`);
                                                setCopiedShare(true);
                                                setTimeout(() => setCopiedShare(false), 2000);
                                            }
                                        }}
                                        className="w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white font-bold py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                                    >
                                        {copiedShare ? (
                                            <>
                                                <CheckIcon className="w-5 h-5 text-emerald-500" />
                                                <span>Kopierat!</span>
                                            </>
                                        ) : (
                                            <>
                                                <CopyIcon className="w-4 h-4 text-slate-500" />
                                                <span>Kopiera länk</span>
                                            </>
                                        )}
                                    </button>
                                    
                                    {typeof navigator !== 'undefined' && navigator.share ? (
                                        <button
                                            onClick={() => {
                                                navigator.share({
                                                    title: shareEvent.raceName,
                                                    text: `Följ loppet ${shareEvent.raceName} live!`,
                                                    url: `${window.location.origin}/live/${shareEvent.id}`
                                                }).catch(err => console.log(err));
                                            }}
                                            className="w-full bg-primary text-white font-bold py-2.5 px-4 rounded-xl hover:brightness-110 transition-colors flex items-center justify-center gap-2 text-sm"
                                        >
                                            <PaperAirplaneIcon className="w-4 h-4" />
                                            <span>Dela länk</span>
                                        </button>
                                    ) : (
                                        <a
                                            href={`/live/${shareEvent.id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-full bg-indigo-650 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm text-center block"
                                        >
                                            <LinkIcon className="w-4 h-4" />
                                            <span>Öppna live-vy</span>
                                        </a>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
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
