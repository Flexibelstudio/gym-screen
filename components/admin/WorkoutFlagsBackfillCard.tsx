import React, { useState } from 'react';
import { Organization } from '../../types';
import { functions } from '../../services/firebaseService';
import { httpsCallable } from 'firebase/functions';
import { useConfirm } from '../ConfirmContext';

interface WorkoutFlagsBackfillCardProps {
    organizations: Organization[];
}

interface BackfillReport {
    totalExamined: number;
    missingIsMemberDraft: number;
    missingPublishAt: number;
    skippedNoCreatedAt: number;
    updatedCount: number;
    skippedIds?: string[];
}

export const WorkoutFlagsBackfillCard: React.FC<WorkoutFlagsBackfillCardProps> = ({ organizations }) => {
    const confirm = useConfirm();
    const activeOrgs = organizations.filter(o => o.status !== 'archived');
    const [selectedOrgId, setSelectedOrgId] = useState<string>(activeOrgs[0]?.id || organizations[0]?.id || '');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isLiveRunning, setIsLiveRunning] = useState<boolean>(false);
    const [report, setReport] = useState<BackfillReport | null>(null);
    const [hasDryRunCompleted, setHasDryRunCompleted] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleOrgChange = (orgId: string) => {
        setSelectedOrgId(orgId);
        setReport(null);
        setError(null);
        setHasDryRunCompleted(false);
    };

    const handleDryRun = async () => {
        if (!selectedOrgId) {
            alert('Vänligen välj en organisation.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setReport(null);
        setHasDryRunCompleted(false);

        try {
            const callable = httpsCallable<any, BackfillReport>(functions, 'backfillWorkoutFlags');
            const response = await callable({
                orgId: selectedOrgId,
                dryRun: true
            });

            setReport(response.data);
            setHasDryRunCompleted(true);
        } catch (err: any) {
            console.error('Dry run error:', err);
            setError(err.message || 'Ett fel inträffade vid analysen.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLiveRun = async () => {
        if (!selectedOrgId || !report || !hasDryRunCompleted) return;

        const selectedOrg = organizations.find(o => o.id === selectedOrgId);
        const orgName = selectedOrg ? selectedOrg.name : selectedOrgId;

        const userConfirmed = await confirm({
            title: "Kör backfill skarpt?",
            message: `Vill du köra backfill skarpt för organisationen "${orgName}"? Torrkörningen hittade ${report.totalExamined} genomsökta pass.`,
            confirmText: "Kör skarpt",
            cancelText: "Avbryt"
        });

        if (!userConfirmed) return;

        setIsLiveRunning(true);
        setError(null);

        try {
            const callable = httpsCallable<any, BackfillReport>(functions, 'backfillWorkoutFlags');
            const response = await callable({
                orgId: selectedOrgId,
                dryRun: false
            });

            setReport(response.data);
            setHasDryRunCompleted(false);
        } catch (err: any) {
            console.error('Live run error:', err);
            setError(err.message || 'Ett fel inträffade vid skarp körning.');
        } finally {
            setIsLiveRunning(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>🏷️</span> Backfill av pass-flaggor
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Komplettera saknade <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">isMemberDraft</code> och <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">publishAt</code> på befintliga träningspass.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                        Välj Organisation / Gym
                    </label>
                    <select
                        value={selectedOrgId}
                        onChange={(e) => handleOrgChange(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                        {activeOrgs.map(org => (
                            <option key={org.id} value={org.id}>
                                {org.name} ({org.id})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={handleDryRun}
                    disabled={isLoading || isLiveRunning || !selectedOrgId}
                    className="px-6 py-3 bg-primary hover:brightness-95 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin">⏳</span>
                            <span>Analyserar...</span>
                        </>
                    ) : (
                        <>
                            <span>🔍</span>
                            <span>Analysera (torrkörning)</span>
                        </>
                    )}
                </button>

                <button
                    onClick={handleLiveRun}
                    disabled={isLoading || isLiveRunning || !selectedOrgId || !hasDryRunCompleted || (report ? (report.missingIsMemberDraft === 0 && report.missingPublishAt === 0) : false)}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLiveRunning ? (
                        <>
                            <span className="animate-spin">⏳</span>
                            <span>Kör skarpt...</span>
                        </>
                    ) : (
                        <>
                            <span>⚡</span>
                            <span>Kör skarpt</span>
                        </>
                    )}
                </button>
            </div>

            {hasDryRunCompleted && report && report.missingIsMemberDraft === 0 && report.missingPublishAt === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Inget att komplettera — alla pass har redan båda fälten.
                </p>
            )}

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 text-sm">
                    <strong>Fel:</strong> {error}
                </div>
            )}

            {report && (
                <div className="mt-6 space-y-6 bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>📋</span> Resultat
                        </h4>
                        <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                            {hasDryRunCompleted ? 'Torrkörningsrapport' : 'Skarp körning genomförd'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Pass genomsökta</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">{report.totalExamined}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Saknar isMemberDraft</span>
                            <span className="text-xl font-black text-amber-600 dark:text-amber-400">{report.missingIsMemberDraft}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Saknar publishAt</span>
                            <span className="text-xl font-black text-blue-600 dark:text-blue-400">{report.missingPublishAt}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Kan inte få publishAt (saknar giltig createdAt)</span>
                            <span className="text-xl font-black text-slate-500 dark:text-slate-400">{report.skippedNoCreatedAt}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Skrivna</span>
                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{report.updatedCount}</span>
                        </div>
                    </div>

                    {report.skippedIds && report.skippedIds.length > 0 && (
                        <div className="space-y-2">
                            <details className="text-xs">
                                <summary className="cursor-pointer text-slate-700 dark:text-slate-300 font-bold py-1">
                                    Hoppades över (saknar createdAt) ({report.skippedNoCreatedAt})
                                </summary>
                                <div className="mt-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto space-y-1">
                                    {report.skippedIds.slice(0, 50).map((id, idx) => (
                                        <div key={idx} className="font-mono text-slate-600 dark:text-slate-400">
                                            {id}
                                        </div>
                                    ))}
                                    {report.skippedNoCreatedAt > report.skippedIds.length && (
                                        <div className="text-slate-400 italic pt-1">
                                            ...och {report.skippedNoCreatedAt - report.skippedIds.length} till (visar max 50).
                                        </div>
                                    )}
                                </div>
                            </details>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Listan betyder att publishAt hoppades över — inte att dokumentet lämnades orört. Saknar samma dokument även isMemberDraft skrivs det fältet ändå.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
