import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Organization, HyroxRace, StartGroup, RaceParticipant, HyroxRaceResult } from '../../types';
import { getPastRaces, saveRace, deleteRace } from '../../services/firebaseService';
import { PlusIcon, CalendarIcon, UsersIcon, TrashIcon, PencilIcon, SaveIcon, QrCodeIcon, LinkIcon, CopyIcon, CloseIcon, TrophyIcon, CheckIcon, PaperAirplaneIcon, SparklesIcon } from '../icons';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import { Printer } from 'lucide-react';

export const generateShareImage = (event: HyroxRace, origin: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Gradient (Dark premium style)
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, '#0a0d14'); // Very rich black-blue
    grad.addColorStop(0.5, '#111625'); // Deep midnight navy
    grad.addColorStop(1, '#1b1437'); // Slate purple
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Decorative neon highlights
    const glow1 = ctx.createRadialGradient(1080, 0, 50, 1080, 0, 500);
    glow1.addColorStop(0, 'rgba(99, 102, 241, 0.22)');
    glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow1;
    ctx.beginPath();
    ctx.arc(1080, 0, 500, 0, Math.PI * 2);
    ctx.fill();

    const glow2 = ctx.createRadialGradient(0, 1080, 50, 0, 1080, 600);
    glow2.addColorStop(0, 'rgba(245, 158, 11, 0.12)');
    glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow2;
    ctx.beginPath();
    ctx.arc(0, 1080, 600, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 14;
    ctx.strokeRect(30, 30, 1020, 1020);

    // Header Branding
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ FLEXIBEL FRISKVÅRD & HÄLSA ⚡', 540, 95);

    // Divider Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(350, 135);
    ctx.lineTo(730, 135);
    ctx.stroke();

    // Badge status
    const isCompleted = event.status === 'completed';
    ctx.fillStyle = isCompleted ? '#34d399' : '#818cf8';
    ctx.font = '900 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(isCompleted ? 'OFFICIELLA SLUTRESULTAT' : 'KOMMANDE UTMANING & TIMING', 540, 180);

    // Event title
    ctx.fillStyle = '#ffffff';
    const eventName = (event.raceName || 'HYROX UTMANING').toUpperCase();
    if (eventName.length > 25) {
        ctx.font = '900 46px system-ui, -apple-system, sans-serif';
        ctx.fillText(eventName, 540, 245);
    } else {
        ctx.font = '900 60px system-ui, -apple-system, sans-serif';
        ctx.fillText(eventName, 540, 255);
    }

    // Date
    let dateStr = 'TÄVLINGSDAG';
    if (event.scheduledDate) {
        dateStr = new Date(event.scheduledDate).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '800 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(dateStr, 540, 315);

    // Find the QR source vector element
    const svgElement = document.querySelector('.share-qr-parent svg') || document.querySelector('svg');
    if (svgElement) {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const blobURL = window.URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            if (isCompleted && event.results && event.results.length > 0) {
                // Layout 1: COMPLETED RESULTS (Results left + QR scan right)
                ctx.textAlign = 'left';
                ctx.fillStyle = '#fbbf24';
                ctx.font = '900 28px system-ui, -apple-system, sans-serif';
                ctx.fillText('➔ RESULTAT TOPP 5', 100, 410);

                const sorted = [...event.results].sort((a, b) => a.time - b.time).slice(0, 5);
                let startY = 475;

                sorted.forEach((res, index) => {
                    const groupForParticipant = event.startGroups?.find(g => g.id === res.groupId);
                    const matchedParticipant = groupForParticipant?.participantList?.find(p => 
                        p.name === res.participant || 
                        (p.partnerName && `${p.name} & ${p.partnerName}` === res.participant)
                    );
                    const finalName = res.teamName || matchedParticipant?.teamName || res.participant;

                    // Row backdrop for accessibility
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(85, startY - 32, 590, 60, 10);
                        ctx.fill();
                    } else {
                        ctx.fillRect(85, startY - 32, 590, 60);
                    }

                    // Rank color
                    ctx.fillStyle = index === 0 ? '#fbbf24' : index === 1 ? '#cbd5e1' : index === 2 ? '#b45309' : '#475569';
                    ctx.beginPath();
                    ctx.arc(120, startY - 2, 20, 0, Math.PI * 2);
                    ctx.fill();

                    // Rank number text
                    ctx.fillStyle = index <= 2 ? '#000000' : '#ffffff';
                    ctx.font = '900 18px system-ui, -apple-system, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${index + 1}`, 120, startY);

                    // Participant full name
                    ctx.textAlign = 'left';
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
                    let displayName = finalName;
                    if (displayName.length > 25) {
                        displayName = displayName.substring(0, 23) + '...';
                    }
                    ctx.fillText(displayName, 160, startY);

                    // End time
                    ctx.textAlign = 'right';
                    ctx.fillStyle = '#34d399';
                    ctx.font = '900 24px Courier New, monospace';
                    const formattedTime = `${Math.floor(res.time / 60)}:${String(res.time % 60).padStart(2, '0')}`;
                    ctx.fillText(formattedTime, 655, startY);

                    startY += 78;
                });

                // QR Code Panel on right side
                ctx.fillStyle = '#111827';
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
                ctx.lineWidth = 2;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(722, 420, 260, 390, 24);
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.fillRect(722, 420, 260, 390);
                }

                // QR clean white background box
                ctx.fillStyle = '#ffffff';
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(752, 452, 200, 200, 16);
                    ctx.fill();
                } else {
                    ctx.fillRect(752, 452, 200, 200);
                }

                // QR draw
                ctx.drawImage(img, 762, 462, 180, 180);

                // Scanning prompt
                ctx.textAlign = 'center';
                ctx.fillStyle = '#94a3b8';
                ctx.font = '800 15px system-ui, -apple-system, sans-serif';
                ctx.fillText('SCANNA FÖR ATT SE ALLA', 852, 695);
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'extrabold 18px system-ui, -apple-system, sans-serif';
                ctx.fillText('RESULTAT & TIDER', 852, 725);
                ctx.fillStyle = '#6366f1';
                ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
                ctx.fillText('KOPPLA DIN PROFIL & SE', 852, 755);
                ctx.fillText('DINA UTMANINGAR', 852, 778);

            } else {
                // Layout 2: FUTURE SCANNER (Big clean QR Card in center)
                ctx.fillStyle = '#111827';
                ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
                ctx.lineWidth = 4;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(330, 370, 420, 540, 32);
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.fillRect(330, 370, 420, 540);
                }

                // White background
                ctx.fillStyle = '#ffffff';
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(380, 420, 320, 320, 24);
                    ctx.fill();
                } else {
                    ctx.fillRect(380, 420, 320, 320);
                }

                // Draw QR Image
                ctx.drawImage(img, 400, 440, 280, 280);

                // Scanning texts
                ctx.textAlign = 'center';
                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
                ctx.fillText('SCANNA MED MOBILEN FÖR LÄNK', 540, 785);

                const gradSub = ctx.createLinearGradient(300, 0, 780, 0);
                gradSub.addColorStop(0, '#f59e0b');
                gradSub.addColorStop(1, '#ffedd5');
                ctx.fillStyle = gradSub;
                ctx.font = '900 32px system-ui, -apple-system, sans-serif';
                ctx.fillText('★ FÖLJ LOPPET LIVE ★', 540, 835);
                
                ctx.fillStyle = '#818cf8';
                ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
                ctx.fillText('SE HEATS, TIDER och MELLANTIDER I REALTID', 540, 875);
            }

            // High aesthetic branding footer
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
            ctx.letterSpacing = '1px';
            ctx.fillText('ARRANGERAS & TIDSTAGS AV', 540, 970);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'extrabold 28px system-ui, -apple-system, sans-serif';
            ctx.letterSpacing = '3px';
            ctx.fillText('FLEXIBEL FRISKVÅRD & HÄLSA', 540, 1010);

            // Export Canvas as high-quality PNG
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${event.raceName.toLowerCase().replace(/\s+/g, '-')}-resultat.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobURL);
        };
        img.src = blobURL;
    } else {
        alert('Det uppstod ett mindre problem att hämta QR-koden. Klicka ur eller ladda om sidan och försök igen.');
    }
};

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

    const handleShare = (url: string, title: string, isCompleted: boolean = false) => {
        if (typeof window !== 'undefined' && navigator.share) {
            navigator.share({
                title: title,
                text: isCompleted ? `Se resultatet för loppet ${title}!` : `Följ loppet ${title} live!`,
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
    const [showPrintModal, setShowPrintModal] = useState(false);

    useEffect(() => {
        if (showPrintModal) {
            // Hitta utskriftsboxen och scrolla den i fokus i centrum, löser problem med iframes
            setTimeout(() => {
                const modalElement = document.querySelector('.printable-card-parent');
                if (modalElement) {
                    modalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 80);
        }
    }, [showPrintModal]);

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
        const originalP = participants.find(p => p.id === editingParticipant.id);
        const hadPartner = originalP?.partnerName?.trim() || editingParticipant.partnerName?.trim();

        // 1. Splitta lag till singlar om klassen ändras till singel
        let splitPartner: RaceParticipant | null = null;
        if (!isDouble && hadPartner) {
            const partName = editingParticipant.partnerName?.trim() || originalP?.partnerName?.trim() || 'Partner';
            const partEmail = editingParticipant.partnerEmail?.trim() || originalP?.partnerEmail?.trim() || undefined;
            // Bestäm klass för partnern baserat på den första deltagarens valda division
            const partnerDivision = editingParticipant.division?.includes('Herr') 
                ? 'Singel Dam' 
                : editingParticipant.division?.includes('Dam') 
                    ? 'Singel Herr' 
                    : editingParticipant.division || 'Singel Dam';

            splitPartner = {
                id: `p-split-${Date.now()}`,
                name: partName,
                email: partEmail,
                division: partnerDivision,
                startNumber: participants.length + 1
            };
        }

        const mergedId = editingParticipant.mergedFromParticipantId;

        const updatedP: RaceParticipant = {
            ...editingParticipant,
            name: editingParticipant.name.trim(),
            email: editingParticipant.email?.trim() || undefined,
            partnerName: isDouble ? editingParticipant.partnerName?.trim() : undefined,
            partnerEmail: (isDouble && editingParticipant.partnerEmail?.trim()) ? editingParticipant.partnerEmail.trim() : undefined,
            teamName: isDouble ? editingParticipant.teamName?.trim() : undefined,
        };
        // Ta bort mergedFromParticipantId så att det inte sparas
        delete updatedP.mergedFromParticipantId;

        setParticipants(prev => {
            let next = prev.map(p => p.id === updatedP.id ? updatedP : p);
            if (splitPartner) {
                next.push(splitPartner);
            }
            if (mergedId) {
                next = next.filter(p => p.id !== mergedId);
            }
            return next;
        });

        setStartGroups(prevGroups => prevGroups.map(g => {
            let newList = (g.participantList || []).map(p => p.id === updatedP.id ? updatedP : p);
            if (mergedId) {
                newList = newList.filter(p => p.id !== mergedId);
            }
            return {
                ...g,
                participantList: newList
            };
        }));

        setEditingParticipant(null);
    };

    const handleImportParticipants = () => {
        if (!participantsText.trim()) return;
        const lines = participantsText.split('\n').map(l => l.trim()).filter(Boolean);
        
        const newParticipants: RaceParticipant[] = lines.map((line, index) => {
            let teamName: string | undefined = undefined;
            let restOfLine = line;

            // 1. Kolla först om det finns lagnamn via ett kolon, t.ex. "Lagnamn: Karin - Johan"
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                teamName = line.substring(0, colonIndex).trim();
                restOfLine = line.substring(colonIndex + 1).trim();
            }

            const parts = restOfLine.split(/[-;,]/).map(p => p.trim());
            const emails = parts.filter(p => p.includes('@'));
            const nonEmails = parts.filter(p => !p.includes('@') && p !== '');

            let name = 'Deltagare';
            let partnerName: string | undefined = undefined;

            if (nonEmails.length >= 3 && !teamName) {
                // Om inget lagnamn fanns via kolon, men det finns minst 3 icke-email delar (t.ex. "Team Blixten - Karin - Johan")
                teamName = nonEmails[0];
                name = nonEmails[1];
                partnerName = nonEmails[2];
            } else if (nonEmails.length >= 2) {
                name = nonEmails[0];
                partnerName = nonEmails[1];
            } else {
                name = nonEmails[0] || 'Deltagare';
            }

            const email = emails[0] || undefined;
            const partnerEmail = emails[1] || undefined;
            
            let division = importDivision;
            if ((partnerName || teamName) && division.startsWith('Singel')) {
                division = 'Dubbel Mix';
            }

            return {
                id: `p-${Date.now()}-${index}`,
                name,
                email,
                partnerName,
                partnerEmail,
                teamName,
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

        if (!studioId) {
            alert('Vänligen välj en skärm / studio för detta event.');
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
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Skärm / Studio (Krav)</label>
                    <select 
                        value={studioId}
                        onChange={(e) => setStudioId(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none text-sm"
                    >
                        <option value="">Välj en skärm...</option>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Deltagare & Startlista</h3>
                    <button 
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-sm transition-colors"
                    >
                        <Printer className="w-4 h-4 text-indigo-550 dark:text-indigo-400" />
                        <span>Skriv ut startlista (Manuell hantering)</span>
                    </button>
                </div>
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
                                            <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1">
                                                <span>👥</span> Slå ihop med en annan deltagare (valfritt)
                                            </label>
                                            <select
                                                value={editingParticipant.mergedFromParticipantId || ''}
                                                onChange={e => {
                                                    const selectedId = e.target.value;
                                                    if (!selectedId) {
                                                        setEditingParticipant({
                                                            ...editingParticipant,
                                                            partnerName: '',
                                                            partnerEmail: '',
                                                            mergedFromParticipantId: undefined
                                                        });
                                                    } else {
                                                        const found = participants.find(p => p.id === selectedId);
                                                        if (found) {
                                                            setEditingParticipant({
                                                                ...editingParticipant,
                                                                partnerName: found.name,
                                                                partnerEmail: found.email || '',
                                                                mergedFromParticipantId: found.id
                                                            });
                                                        }
                                                    }
                                                }}
                                                className="w-full text-sm bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 outline-none font-semibold transition"
                                            >
                                                <option value="">-- Välj person för att slå ihop till lag --</option>
                                                {participants
                                                    .filter(p => p.id !== editingParticipant.id && !p.partnerName)
                                                    .map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name} ({p.division || 'Singel'}) {p.email ? `- ${p.email}` : ''}
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-450 mt-1">
                                                Välj en existerande deltagare för att automatiskt fylla i partneruppgifter. Den valda personen tas bort som enskild deltagare när du klickar på "Spara ändringar".
                                            </p>
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
                                            Klistra in rader. Vi letar automatiskt upp namn, lagnamn och e-post. En rad blir en startande (Singel, Par-lag eller Lag med Lagnamn). <br />
                                            <span className="font-bold font-mono text-[10px] block mt-1 text-emerald-600 dark:text-emerald-400">Exempel med lagnamn: Team Blixten: Karin - karin@exempel.se - Johan - johan@exempel.se</span>
                                            <span className="font-bold font-mono text-[10px] block text-emerald-600 dark:text-emerald-400">Exempel med lagnamn: Team Blixten - Karin - karin@exempel.se - Johan - johan@exempel.se</span>
                                            <span className="font-bold">Singel:</span> <code className="bg-gray-100 dark:bg-gray-900 p-0.5 rounded text-red-500">Karin Larsson - karin@exempel.se</code> <br />
                                            <span className="font-bold">Par (Dubbel):</span> <code className="bg-gray-100 dark:bg-gray-900 p-0.5 rounded text-indigo-500">Karin Larsson - karin@exempel.se - Johan Larsson - johan@exempel.se</code>
                                        </p>
                                        <textarea 
                                            value={participantsText}
                                            onChange={(e) => setParticipantsText(e.target.value)}
                                            placeholder="Anna Andersson - anna@exempel.se&#10;Team Blixten: Karin Larsson - karin@exempel.se - Johan Larsson - johan@exempel.se&#10;Team Norrland - Karin Larsson - karin@exempel.se - Johan Larsson - johan@exempel.se"
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
                                                        <>{p.name} {p.partnerName && <> & {p.partnerName}</>}</>
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
                        {event?.status === 'completed' ? 'Dela Resultat & QR-kod' : 'Dela Liveresultat & QR-kod'}
                    </h3>
                    <div className="bg-gradient-to-br from-indigo-50/50 via-white to-amber-55/30 dark:from-slate-900/40 dark:via-slate-900/60 dark:to-indigo-950/20 border border-indigo-100 dark:border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6">
                        <div className="bg-white p-3 rounded-2xl border border-gray-200 dark:border-gray-750 flex-shrink-0 shadow-lg dark:shadow-none share-qr-parent">
                            <QRCode 
                                value={`${window.location.origin}/live/${event.id}`} 
                                size={120}
                                level="M"
                            />
                        </div>
                        <div className="flex-1 space-y-4 text-center md:text-left animate-fade-in">
                            <div>
                                <h4 className="font-extrabold text-sm text-gray-900 dark:text-white mb-1">
                                    {event?.status === 'completed' ? 'Scanna eller gå till Resultatlänken' : 'Scanna eller gå till Live-länken'}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg">
                                    {event?.status === 'completed'
                                        ? 'Deltagare och åskådare kan scanna denna QR-kod eller använda länken för att se det sparade slutresultatet med alla tider och placeringar.'
                                        : 'Åskådare, ledare och deltagare kan scanna denna QR-kod eller använda länken för att följa tävlingen i realtid (tider, placeringar, heat) direkt på mobilen eller en extra skärm.'}
                                </p>
                            </div>
                            
                            <div className="flex flex-col gap-2.5 max-w-md">
                                <div className="flex flex-col sm:flex-row gap-2.5">
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
                                            onClick={() => handleShare(`${window.location.origin}/live/${event.id}`, raceName || 'Hyrox Race', event?.status === 'completed')}
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
                                            <span>{event?.status === 'completed' ? 'Öppna resultat' : 'Öppna live-vy'}</span>
                                        </a>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => generateShareImage(event, window.location.origin)}
                                    className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:brightness-110 text-black font-black uppercase tracking-wider py-3 px-4 rounded-xl transition-all shadow-md shadow-amber-500/10 active:scale-[0.99] flex items-center justify-center gap-2 text-xs"
                                >
                                    <SparklesIcon className="w-4 h-4 text-black animate-pulse" />
                                    <span>Ladda ner delningsbild (Sociala Medier)</span>
                                </button>
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

            {/* PRINT OVERLAY MODAL */}
            <AnimatePresence>
                {showPrintModal && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm print-modal-parent">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 printable-card-parent"
                        >
                            {/* HEADING BANNER - HIDE ON PRINT */}
                            <div className="p-6 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center printable-screen-only">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-lg">
                                        <Printer className="w-5 h-5 flex-shrink-0" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-sm">Förhandsgranskning av startlista</h3>
                                        <p className="text-xs text-gray-500">Utskrift är optimerad för A4 (stående format)</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="bg-indigo-650 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-500/25"
                                    >
                                        <Printer className="w-4 h-4 flex-shrink-0" />
                                        Skriv ut nu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowPrintModal(false)}
                                        className="bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-xl text-xs"
                                    >
                                        Stäng
                                    </button>
                                </div>
                            </div>

                            {/* PRINTABLE AREA */}
                            <div className="flex-1 overflow-y-auto p-8 bg-white text-gray-900 printable-area leading-normal">
                                <style dangerouslySetInnerHTML={{ __html: `
                                    @media print {
                                        body {
                                            background-color: white !important;
                                            color: black !important;
                                        }
                                        #root {
                                            display: none !important;
                                        }
                                        .print-modal-parent {
                                            position: absolute !important;
                                            left: 0 !important;
                                            top: 0 !important;
                                            width: 100% !important;
                                            height: auto !important;
                                            background: white !important;
                                            display: block !important;
                                        }
                                        .printable-card-parent {
                                            border: none !important;
                                            box-shadow: none !important;
                                            max-height: none !important;
                                            overflow: visible !important;
                                            background: white !important;
                                        }
                                        .printable-screen-only {
                                            display: none !important;
                                        }
                                        .printable-area {
                                            overflow: visible !important;
                                            padding: 0 !important;
                                            margin: 0 !important;
                                            background: white !important;
                                        }
                                        .avoid-break {
                                            page-break-inside: avoid !important;
                                            break-inside: avoid !important;
                                        }
                                    }
                                `}} />

                                {/* Document header */}
                                <div className="border-b-4 border-gray-900 pb-3 mb-6 bg-white">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">MANUELL STARTLISTA & HANTERING</span>
                                            <h1 className="text-2xl font-black text-gray-950 uppercase tracking-tight leading-tight mt-0.5">
                                                {raceName || "Hyrox Tävling"}
                                            </h1>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase font-bold text-gray-500">Arrangör</div>
                                            <div className="text-xs font-black text-gray-900 uppercase">Flexibel Friskvård & Hälsa</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 mt-2.5 text-xs text-gray-650">
                                        {scheduledDate && (
                                            <div>
                                                <span className="font-bold">Datum: </span>
                                                {new Date(scheduledDate).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </div>
                                        )}
                                        <div>
                                            <span className="font-bold">Intervall mellan heat: </span>
                                            {startIntervalMinutes} min {startIntervalSeconds > 0 ? `${startIntervalSeconds} sek` : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Body - Heats / Startlistor */}
                                <div className="space-y-6 bg-white">
                                    {startGroups.map((group, groupIdx) => {
                                        let groupTimeStr = "";
                                        if (scheduledDate) {
                                            const baseDate = new Date(scheduledDate);
                                            const intervalMs = ((startIntervalMinutes || 2) + (startIntervalSeconds || 0) / 60) * 60 * 1000;
                                            const heatTime = new Date(baseDate.getTime() + groupIdx * intervalMs);
                                            groupTimeStr = heatTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                                        }

                                        const pList = group.participantList || [];
                                        return (
                                            <div key={group.id} className="avoid-break border border-gray-200 rounded-xl p-4 bg-gray-50/40">
                                                <h3 className="font-black text-xs text-gray-950 border-b border-gray-400 pb-1.5 mb-3 uppercase tracking-wider flex justify-between items-center">
                                                    <span>{group.name}</span>
                                                    {groupTimeStr && <span className="font-mono text-xs font-bold text-indigo-700">Starttid: {groupTimeStr}</span>}
                                                </h3>
                                                <table className="w-full text-[11px] text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-gray-300 bg-gray-100 text-gray-700 font-bold text-[9px] uppercase tracking-wider">
                                                            <th className="py-1 px-2 border border-gray-200 w-12 text-center">Startnr</th>
                                                            <th className="py-1 px-2 border border-gray-200">Deltagare / Lagnamn</th>
                                                            <th className="py-1 px-2 border border-gray-200 w-28">Klass/Division</th>
                                                            <th className="py-1 px-2 border border-gray-200 w-16 text-center">Checkad</th>
                                                            <th className="py-1 px-2 border border-gray-200 w-28">Manuell Tid</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pList.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="py-3 text-center text-gray-500 italic border border-gray-200 bg-white">
                                                                    Inga deltagare tilldelade till detta heat
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            pList.map((p) => {
                                                                const displayNames = p.partnerName ? `${p.name} & ${p.partnerName}` : p.name;
                                                                return (
                                                                    <tr key={p.id} className="border-b border-gray-250 bg-white hover:bg-gray-50">
                                                                        <td className="py-2.5 px-2 border border-gray-200 text-center font-bold text-xs text-gray-950">
                                                                            {p.startNumber || '—'}
                                                                        </td>
                                                                        <td className="py-2.5 px-2 border border-gray-200 font-medium">
                                                                            {p.teamName ? (
                                                                                <div>
                                                                                    <div className="font-black text-xs text-gray-950">{p.teamName}</div>
                                                                                    <div className="text-[10px] text-gray-650 font-medium">{displayNames}</div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="font-bold text-gray-950 text-xs">{displayNames}</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2.5 px-2 border border-gray-200 text-[11px] font-semibold text-gray-750">
                                                                            {p.division || '—'}
                                                                        </td>
                                                                        <td className="py-2.5 px-2 border border-gray-200 text-center">
                                                                            <div className="inline-block w-4 h-4 rounded border border-gray-450 bg-white" />
                                                                        </td>
                                                                        <td className="py-2.5 px-2 border border-gray-200 text-gray-300 font-mono text-[10px] font-bold text-center">
                                                                            ______ : ______ (m:s)
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Footer info */}
                                <div className="mt-8 border-t border-gray-400 pt-4 flex justify-between items-center text-[10px] text-gray-500 font-medium bg-white">
                                    <div>Utskriven: {new Date().toLocaleDateString('sv-SE')} | Smart Skärm Event Management</div>
                                    <div>Sida 1 av 1</div>
                                </div>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}
            </AnimatePresence>
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
    const [showDemoSuccessModal, setShowDemoSuccessModal] = useState(false);
    const [createdTestEvent, setCreatedTestEvent] = useState<HyroxRace | null>(null);

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
        const race = events.find(e => e.id === eventId);
        const name = race ? `"${race.raceName}"` : 'detta event';
        if (!window.confirm(`Är du säker på att du vill radera ${name}? Detta går inte att ångra och raderar även eventuella resultat.`)) {
            return;
        }
        try {
            await deleteRace(eventId);
            await fetchEvents();
        } catch (error) {
            console.error("Failed to delete event", error);
        }
    };

    const handleCreateTestEvent = async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 2);
        futureDate.setHours(10, 0, 0, 0);

        const testGroups: StartGroup[] = [
            {
                id: 'group-test-1',
                name: 'Heat 1 (Singel Herr)',
                participants: '',
                participantList: [
                    { id: 'p-test-1', name: 'Johan Andersson', email: 'johan@test.se', division: 'Singel Herr', startNumber: 101 },
                    { id: 'p-test-2', name: 'Nicklas Bergqvist', email: 'nicklas@test.se', division: 'Singel Herr', startNumber: 102 },
                    { id: 'p-test-3', name: 'Marcus Lindgren', email: 'marcus@test.se', division: 'Singel Herr', startNumber: 103 },
                    { id: 'p-test-4', name: 'Andreas Östling', email: 'andreas@test.se', division: 'Singel Herr', startNumber: 104 },
                    { id: 'p-test-5', name: 'Emil Sjöberg', email: 'emil@test.se', division: 'Singel Herr', startNumber: 105 }
                ]
            },
            {
                id: 'group-test-2',
                name: 'Heat 2 (Singel Dam)',
                participants: '',
                participantList: [
                    { id: 'p-test-6', name: 'Karin Wahlström', email: 'karin@test.se', division: 'Singel Dam', startNumber: 201 },
                    { id: 'p-test-7', name: 'Emma Dahlström', email: 'emma@test.se', division: 'Singel Dam', startNumber: 202 },
                    { id: 'p-test-8', name: 'Sofia Gustafsson', email: 'sofia@test.se', division: 'Singel Dam', startNumber: 203 },
                    { id: 'p-test-9', name: 'Linnéa Holm', email: 'linnea@test.se', division: 'Singel Dam', startNumber: 204 },
                    { id: 'p-test-10', name: 'Jessica Nyberg', email: 'jessica@test.se', division: 'Singel Dam', startNumber: 205 }
                ]
            },
            {
                id: 'group-test-3',
                name: 'Heat 3 (Dubbel Herr)',
                participants: '',
                participantList: [
                    { id: 'p-test-11', name: 'Peter Nilsson', partnerName: 'Jonas Ek', teamName: 'Team Powerhouse', division: 'Dubbel Herr', startNumber: 301 },
                    { id: 'p-test-12', name: 'Mikael Skog', partnerName: 'Daniel Gren', teamName: 'Skogarna FC', division: 'Dubbel Herr', startNumber: 302 },
                    { id: 'p-test-13', name: 'Stefan Frisk', partnerName: 'Christian Bolt', teamName: 'Pulsjägarna', division: 'Dubbel Herr', startNumber: 303 },
                    { id: 'p-test-14', name: 'Fredrik Lind', partnerName: 'Erik Ström', teamName: 'Stålbröderna', division: 'Dubbel Herr', startNumber: 304 },
                    { id: 'p-test-15', name: 'Oskar Vesterlund', partnerName: 'Filip Wallin', teamName: 'Norrlands Guld', division: 'Dubbel Herr', startNumber: 305 }
                ]
            },
            {
                id: 'group-test-4',
                name: 'Heat 4 (Dubbel Dam)',
                participants: '',
                participantList: [
                    { id: 'p-test-16', name: 'Maria Hedlund', partnerName: 'Sara Wikström', teamName: 'Systerskapet', division: 'Dubbel Dam', startNumber: 401 },
                    { id: 'p-test-17', name: 'Hanna Lindqvist', partnerName: 'Josefin Roos', teamName: 'The Iron Maidens', division: 'Dubbel Dam', startNumber: 402 },
                    { id: 'p-test-18', name: 'Julia Sandberg', partnerName: 'Elin Falk', teamName: 'Falkarna', division: 'Dubbel Dam', startNumber: 403 },
                    { id: 'p-test-19', name: 'Victoria Berg', partnerName: 'Moa Ljung', teamName: 'Träningsglädje', division: 'Dubbel Dam', startNumber: 404 },
                    { id: 'p-test-20', name: 'Amanda Blom', partnerName: 'Linda Ekdahl', teamName: 'Dubbel Trubbel', division: 'Dubbel Dam', startNumber: 405 }
                ]
            },
            {
                id: 'group-test-5',
                name: 'Heat 5 (Dubbel Mix)',
                participants: '',
                participantList: [
                    { id: 'p-test-21', name: 'Malin Åström', partnerName: 'Henrik Åström', teamName: 'Team Åström', division: 'Dubbel Mix', startNumber: 501 },
                    { id: 'p-test-22', name: 'Sandra Vester', partnerName: 'Mattias Vester', teamName: 'Dynamiska Duon', division: 'Dubbel Mix', startNumber: 502 },
                    { id: 'p-test-23', name: 'Louise Kjellin', partnerName: 'Robert Kjellin', teamName: 'Kjellin Express', division: 'Dubbel Mix', startNumber: 503 },
                    { id: 'p-test-24', name: 'Clara Söder', partnerName: 'Sebastian Söder', teamName: 'Söder & Co', division: 'Dubbel Mix', startNumber: 504 },
                    { id: 'p-test-25', name: 'Rebecca Lund', partnerName: 'Christoffer Lund', teamName: 'Slutspurtarna', division: 'Dubbel Mix', startNumber: 505 }
                ]
            }
        ];

        const testRace: HyroxRace = {
            id: `race-test-${Date.now()}`,
            organizationId: organization.id,
            raceName: 'Demo: Flexibel Sommarutmaning ☀️',
            createdAt: Date.now(),
            scheduledDate: futureDate.getTime(),
            status: 'planned',
            exercises: [],
            startGroups: testGroups,
            results: [],
            startIntervalMinutes: 5
        };

        try {
            await saveRace(testRace, organization.id);
            await fetchEvents();
            setCreatedTestEvent(testRace);
            setShowDemoSuccessModal(true);
        } catch (error) {
            console.error("Failed to create test event", error);
            alert("Kunde inte skapa test-event.");
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Event & Tävlingar</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Planera och hantera kommande lopp och simuleringar.</p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        <button 
                            onClick={handleCreateTestEvent}
                            className="bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white px-5 py-3 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2 text-sm"
                        >
                            <SparklesIcon className="w-4 h-4 text-amber-100 animate-pulse" />
                            <span>Generera Test-event</span>
                        </button>
                        <button 
                            onClick={() => setView('create')}
                            className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-md hover:brightness-110 flex items-center gap-2 text-sm"
                        >
                            <PlusIcon className="w-5 h-5" /> Skapa Event
                        </button>
                    </div>
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
                                    {shareEvent.status === 'completed'
                                        ? 'Deltagare och publik kan scanna koden eller öppna länken på mobilen för att se det sparade slutresultatet med alla tider och placeringar!'
                                        : 'Deltagare och publik kan scanna koden eller öppna länken på mobilen för att se startlistor, heat, realtidsklockor och slutresultat live!'}
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
                                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl mb-4 shadow-inner share-qr-parent">
                                    <div className="bg-white p-3 rounded-xl shadow-md border border-gray-250 flex items-center justify-center">
                                        <QRCode 
                                            value={`${window.location.origin}/live/${shareEvent.id}`} 
                                            size={140}
                                            level="M"
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-3.5 uppercase tracking-widest bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-full">
                                        {shareEvent.status === 'completed' ? 'Skanna resultat' : 'Skanna live-tavla'}
                                    </span>
                                </div>
                                
                                {/* ACTIONS */}
                                <div className="space-y-2">
                                    <button
                                        onClick={() => generateShareImage(shareEvent, window.location.origin)}
                                        className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:brightness-110 text-black font-black uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs"
                                    >
                                        <SparklesIcon className="w-4 h-4 text-black animate-pulse" />
                                        <span>Ladda ner delningsbild</span>
                                    </button>

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
                                                    text: shareEvent.status === 'completed'
                                                         ? `Se resultatet för loppet ${shareEvent.raceName}!`
                                                         : `Följ loppet ${shareEvent.raceName} live!`,
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
                                            <span>{shareEvent.status === 'completed' ? 'Öppna resultat' : 'Öppna live-vy'}</span>
                                        </a>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* DEMO SUCCESS OVERLAY MODAL */}
                <AnimatePresence>
                    {showDemoSuccessModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowDemoSuccessModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            
                            {/* Card */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                transition={{ type: "spring", duration: 0.4 }}
                                className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-lg relative z-10 p-8 text-gray-900 dark:text-white"
                            >
                                <button
                                    onClick={() => setShowDemoSuccessModal(false)}
                                    className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                    <CloseIcon className="w-5 h-5" />
                                </button>
                                
                                <div className="flex flex-col items-center text-center mt-2">
                                    {/* Brand highlight */}
                                    <div className="relative mb-5">
                                        <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full scale-125 animate-pulse" />
                                        <div className="p-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white relative z-10 shadow-lg border-2 border-white dark:border-gray-950">
                                            <SparklesIcon className="w-8 h-8 animate-pulse text-white" />
                                        </div>
                                    </div>
                                    
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-1 rounded-full border border-amber-200/50 dark:border-amber-900/40 mb-3 select-none animate-fade-in">
                                        Test-event skapat! ☀️
                                    </span>
                                    
                                    <h3 className="text-xl font-black text-gray-950 dark:text-white uppercase tracking-tight leading-tight">
                                        Demo: Flexibel Sommarutmaning
                                    </h3>
                                    
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-2 leading-relaxed">
                                        Ett fullständigt test-event har genererats för att enkelt utvärdera systemet och live-skärmarna.
                                    </p>
                                </div>

                                {/* Event structure breakdown */}
                                <div className="mt-6 p-5 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl space-y-3.5">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-gray-500 dark:text-gray-450 uppercase tracking-wider text-[10px]">Struktur</span>
                                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400">5 Heat (1 per division)</span>
                                    </div>
                                    <div className="border-t border-gray-200 dark:border-gray-850 my-2" />
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-gray-500 dark:text-gray-450 uppercase tracking-wider text-[10px]">Deltagare</span>
                                        <span className="font-extrabold text-gray-900 dark:text-white">25 st (5 per heat)</span>
                                    </div>
                                    <div className="border-t border-gray-200 dark:border-gray-850 my-2" />
                                    <div className="flex justify-between items-start text-xs">
                                        <span className="font-bold text-gray-500 dark:text-gray-450 uppercase tracking-wider text-[10px] mt-0.5">Dubbelklasserna</span>
                                        <span className="font-semibold text-gray-700 dark:text-gray-300 text-right max-w-[200px]">
                                            Tilldelade med <span className="font-black text-indigo-600 dark:text-indigo-400">Lagnamn</span>, partners och startnummer.
                                        </span>
                                    </div>
                                </div>

                                <p className="text-[11px] text-gray-400 dark:text-gray-550 text-center mt-5 leading-normal max-w-xs mx-auto">
                                    Du kan nu skriva ut startlistor, starta live-klockor eller lägga till tider för att se liveresultaten uppdateras i realtid!
                                </p>

                                <div className="mt-6">
                                    <button
                                        onClick={() => {
                                            setShowDemoSuccessModal(false);
                                            if (createdTestEvent) {
                                                setSelectedEvent(createdTestEvent);
                                                setView('edit');
                                            }
                                        }}
                                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 space-x-2 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center text-sm text-center cursor-pointer"
                                    >
                                        <span>Grymt, visa loppet!</span>
                                    </button>
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
