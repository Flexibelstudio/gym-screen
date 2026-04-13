import React, { useState, useEffect } from 'react';
import { Organization, HyroxRace, StartGroup, RaceParticipant } from '../../types';
import { getPastRaces, saveRace } from '../../services/firebaseService';
import { PlusIcon, CalendarIcon, UsersIcon, TrashIcon, PencilIcon, SaveIcon } from '../icons';
import { motion } from 'framer-motion';

interface EventsContentProps {
    organization: Organization;
}

const EventEditor: React.FC<{
    event: HyroxRace | null;
    organizationId: string;
    onSave: (event: HyroxRace) => void;
    onCancel: () => void;
}> = ({ event, organizationId, onSave, onCancel }) => {
    const [raceName, setRaceName] = useState(event?.raceName || '');
    const [scheduledDate, setScheduledDate] = useState(
        event?.scheduledDate ? new Date(event.scheduledDate).toISOString().split('T')[0] : ''
    );
    const [participantsText, setParticipantsText] = useState('');
    const [participants, setParticipants] = useState<RaceParticipant[]>(
        event?.startGroups?.flatMap(g => g.participantList || []) || []
    );
    const [startGroups, setStartGroups] = useState<StartGroup[]>(
        event?.startGroups || [{ id: 'group-1', name: 'Heat 1', participants: '', participantList: [] }]
    );

    const handleImportParticipants = () => {
        if (!participantsText.trim()) return;
        const lines = participantsText.split('\n').map(l => l.trim()).filter(Boolean);
        
        const newParticipants: RaceParticipant[] = lines.map((line, index) => {
            // Simple parsing: "Name - Email - PartnerName - PartnerEmail"
            const parts = line.split(/[-;,]/).map(p => p.trim());
            const name = parts[0];
            const email = parts.length > 1 && parts[1].includes('@') ? parts[1] : undefined;
            
            let partnerName = undefined;
            let partnerEmail = undefined;

            if (parts.length > 2 && !parts[1].includes('@')) {
                 // If format is "Name - PartnerName"
                 partnerName = parts[1];
            } else if (parts.length > 2) {
                 partnerName = parts[2];
                 if (parts.length > 3 && parts[3].includes('@')) {
                     partnerEmail = parts[3];
                 }
            }
            
            return {
                id: `p-${Date.now()}-${index}`,
                name,
                email,
                partnerName,
                partnerEmail,
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

        // For now, put all unassigned participants in the first group if they aren't assigned
        // In a real app, we'd have drag-and-drop. Here we just do a simple assignment.
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
            raceName,
            createdAt: event?.createdAt || Date.now(),
            scheduledDate: scheduledDate ? new Date(scheduledDate).getTime() : undefined,
            status: event?.status || 'planned',
            exercises: event?.exercises || [], // We can let them select exercises later
            startGroups: updatedGroups,
            results: event?.results || []
        };

        onSave(newEvent);
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Deltagare & Startlista</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Importera deltagare (Klistra in från Excel)</label>
                        <p className="text-xs text-gray-500 mb-2">Format: Namn - E-post - Partner Namn - Partner E-post (en per rad)</p>
                        <textarea 
                            value={participantsText}
                            onChange={(e) => setParticipantsText(e.target.value)}
                            placeholder="Anna Andersson - anna@exempel.se&#10;Johan Karlsson - johan@exempel.se - Erik Svensson - erik@exempel.se"
                            className="w-full h-32 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none resize-none mb-4"
                        />
                        <button 
                            onClick={handleImportParticipants}
                            className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                        >
                            Lägg till i listan
                        </button>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Alla Deltagare ({participants.length})</label>
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-48 overflow-y-auto space-y-2">
                            {participants.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center mt-8">Inga deltagare tillagda än.</p>
                            ) : (
                                participants.map(p => (
                                    <div key={p.id} className="flex justify-between items-center bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-primary/10 text-primary font-bold text-xs px-2 py-1 rounded-md">#{p.startNumber}</span>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {p.name} {p.partnerName && <span className="text-gray-500 font-normal">& {p.partnerName}</span>}
                                                </p>
                                                <div className="flex gap-2">
                                                    {p.email && <p className="text-xs text-gray-500">{p.email}</p>}
                                                    {p.partnerEmail && <p className="text-xs text-gray-500">({p.partnerEmail})</p>}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setParticipants(participants.filter(x => x.id !== p.id))}
                                            className="text-red-500 hover:bg-red-50 p-1 rounded-md"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
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
                        <div key={group.id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-2">
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
                            <p className="text-xs text-gray-500">
                                Deltagare tilldelas automatiskt till Heat 1 för tillfället. (Drag-and-drop kommer i nästa uppdatering).
                            </p>
                        </div>
                    ))}
                </div>
            </div>

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

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Laddar event...</div>;
    }

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

                {events.length === 0 ? (
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
                        {events.map(event => (
                            <div key={event.id} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{event.raceName}</h3>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${event.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {event.status === 'completed' ? 'Genomfört' : 'Planerat'}
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
                                </div>
                            </div>
                        ))}
                    </div>
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
                onSave={handleSaveEvent} 
                onCancel={() => { setView('list'); setSelectedEvent(null); }} 
            />
        </div>
    );
};
