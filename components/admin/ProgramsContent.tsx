import React, { useEffect, useMemo, useState } from 'react';
import { Organization, Program, Workout } from '../../types';
import { subscribeToProgramsForOrganization, updateProgramMembers, deleteProgram, newProgramFrom } from '../../services/firebaseService';
import { useConfirm } from '../ConfirmContext';
import { PlusIcon, PencilIcon, TrashIcon, UsersIcon } from '../icons';

// PROGRAM — pass byggda for utvalda medlemmar. Listan har, byggaren ar samma
// som for vanliga pass. Medlemslistan andras nar som helst; en andring i
// programmet slar igenom hos alla som star med.

type MedlemRad = { uid: string; firstName?: string; lastName?: string; email?: string };

const namnPa = (m: MedlemRad) => `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || 'Medlem';

export const ProgramsContent: React.FC<{
    organization: Organization;
    members: MedlemRad[];
    onEdit: (workout: Workout) => void;
}> = ({ organization, members, onEdit }) => {
    const confirm = useConfirm();
    const [program, setProgram] = useState<Program[]>([]);
    const [laddar, setLaddar] = useState(true);
    const [medlemsval, setMedlemsval] = useState<Program | null>(null);
    const [valda, setValda] = useState<string[]>([]);
    const [sok, setSok] = useState('');
    const [sparar, setSparar] = useState(false);

    useEffect(() => {
        if (!organization?.id) return;
        setLaddar(true);
        const avsluta = subscribeToProgramsForOrganization(organization.id, lista => {
            setProgram(lista);
            setLaddar(false);
        }, () => setLaddar(false));
        return () => avsluta();
    }, [organization?.id]);

    const oppnaMedlemsval = (p: Program) => {
        setMedlemsval(p);
        setValda([...(p.memberIds || [])]);
        setSok('');
    };

    const sparaMedlemmar = async () => {
        if (!medlemsval) return;
        setSparar(true);
        try {
            const namn: Record<string, string> = {};
            valda.forEach(uid => {
                const m = members.find(x => x.uid === uid);
                if (m) namn[uid] = namnPa(m);
            });
            await updateProgramMembers(medlemsval.id, valda, namn);
            setMedlemsval(null);
        } catch (e) {
            console.error(e);
            alert('Kunde inte spara medlemslistan.');
        } finally {
            setSparar(false);
        }
    };

    const radera = async (p: Program) => {
        const ok = await confirm({
            title: 'Radera program?',
            message: `"${p.title || 'Namnlöst program'}" tas bort för alla ${p.memberIds.length} medlemmar. Det går inte att ångra.`,
            confirmText: 'Radera',
            cancelText: 'Avbryt',
            confirmColor: 'red'
        });
        if (!ok) return;
        try { await deleteProgram(p.id); } catch { alert('Kunde inte radera programmet.'); }
    };

    const filtreradeMedlemmar = useMemo(() => {
        const q = sok.trim().toLowerCase();
        return [...members]
            .filter(m => !q || `${namnPa(m)} ${m.email || ''}`.toLowerCase().includes(q))
            .sort((a, b) => namnPa(a).localeCompare(namnPa(b), 'sv'));
    }, [members, sok]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Program</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pass byggda för utvalda medlemmar. Syns under "Mina program" i medlemsappen hos dem som står med.</p>
                </div>
                <button
                    onClick={() => onEdit(newProgramFrom(organization.id))}
                    className="bg-primary text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 hover:brightness-105 transition-colors text-sm"
                >
                    <PlusIcon className="w-4 h-4" /> Skapa program
                </button>
            </div>

            {laddar ? (
                <div className="text-center py-12 text-gray-500">Laddar program…</div>
            ) : program.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    Inga program ännu. Skapa ett och välj vilka medlemmar som ska ha det.
                </div>
            ) : (
                <div className="space-y-3">
                    {program.map(p => (
                        <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40">
                            <div className="min-w-0 flex-1">
                                <button onClick={() => onEdit(p)} className="text-left w-full">
                                    <h4 className="font-bold text-gray-900 dark:text-white truncate">{p.title || 'Namnlöst program'}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {(p.blocks || []).length} block · {(p.blocks || []).reduce((s, b) => s + (b.exercises || []).length, 0)} övningar
                                    </p>
                                </button>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {p.memberIds.length === 0 ? (
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Inga medlemmar valda än</span>
                                    ) : p.memberIds.slice(0, 6).map(uid => (
                                        <span key={uid} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                                            {p.memberNames?.[uid] || members.find(m => m.uid === uid)?.firstName || 'Medlem'}
                                        </span>
                                    ))}
                                    {p.memberIds.length > 6 && (
                                        <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px] font-bold">+{p.memberIds.length - 6}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => oppnaMedlemsval(p)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <UsersIcon className="w-4 h-4" /> Medlemmar ({p.memberIds.length})
                                </button>
                                <button onClick={() => onEdit(p)} className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10" title="Redigera">
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => radera(p)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Radera">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {medlemsval && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMedlemsval(null)} />
                    <div className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl border border-gray-200 dark:border-gray-800 p-6 max-h-[calc(100vh-2rem)] flex flex-col">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">Medlemmar</h3>
                        <p className="text-sm text-gray-500 mb-4 truncate">{medlemsval.title || 'Namnlöst program'}</p>
                        <input
                            type="text"
                            value={sok}
                            onChange={e => setSok(e.target.value)}
                            placeholder="Sök namn eller e-post…"
                            className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none mb-3"
                        />
                        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-lg">
                            {filtreradeMedlemmar.map(m => {
                                const vald = valda.includes(m.uid);
                                return (
                                    <label key={m.uid} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <input
                                            type="checkbox"
                                            checked={vald}
                                            onChange={() => setValda(prev => vald ? prev.filter(x => x !== m.uid) : [...prev, m.uid])}
                                            className="w-4 h-4 accent-primary"
                                        />
                                        <span className="min-w-0">
                                            <span className="font-semibold text-gray-900 dark:text-white block truncate">{namnPa(m)}</span>
                                            <span className="text-xs text-gray-500 block truncate">{m.email}</span>
                                        </span>
                                    </label>
                                );
                            })}
                            {filtreradeMedlemmar.length === 0 && (
                                <p className="text-xs text-gray-500 py-6 text-center">Inga medlemmar matchar.</p>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-4">
                            <span className="text-xs text-gray-500">{valda.length} valda</span>
                            <div className="flex gap-2">
                                <button onClick={() => setMedlemsval(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Avbryt</button>
                                <button onClick={sparaMedlemmar} disabled={sparar} className="px-5 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:brightness-105 disabled:opacity-50">
                                    {sparar ? 'Sparar…' : 'Spara'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
