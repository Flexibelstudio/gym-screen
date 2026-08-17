import React, { useState } from 'react';
import { functions } from '../../services/firebaseService';
import { httpsCallable } from 'firebase/functions';
import { useConfirm } from '../ConfirmContext';

interface MigrationReport {
    dryRun: boolean;
    total: number;
    migrated: string[];
    alreadyDone: string[];
    missing: string[];
}

/**
 * Systemägarverktyg för steg 1 av coachkodsflytten: kopierar varje organisations
 * passwords.coach till det låsta stället (organizations/{id}/private/auth).
 *
 * Torrkörning först — skarp körning låses upp efter genomförd torrkörning.
 * missing-listan ska vara TOM innan klientsidan byts (steg 3 i utrullningen).
 */
export const CoachCodeMigrationCard: React.FC = () => {
    const confirm = useConfirm();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isLiveRunning, setIsLiveRunning] = useState<boolean>(false);
    const [report, setReport] = useState<MigrationReport | null>(null);
    const [hasDryRunCompleted, setHasDryRunCompleted] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const runMigration = async (dryRun: boolean) => {
        const callable = httpsCallable<any, MigrationReport>(functions, 'migrateCoachUnlockCodes');
        const response = await callable({ dryRun });
        return response.data;
    };

    const handleDryRun = async () => {
        setIsLoading(true);
        setError(null);
        setReport(null);
        setHasDryRunCompleted(false);

        try {
            const data = await runMigration(true);
            setReport(data);
            setHasDryRunCompleted(true);
        } catch (err: any) {
            console.error('Dry run error:', err);
            setError(err.message || 'Ett fel inträffade vid torrkörningen.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLiveRun = async () => {
        if (!report || !hasDryRunCompleted) return;

        const userConfirmed = await confirm({
            title: 'Kör migreringen skarpt?',
            message: `Torrkörningen hittade ${report.migrated.length} organisationer som får sin coachkod kopierad till det låsta stället. Redan satta koder skrivs aldrig över.`,
            confirmText: 'Kör skarpt',
            cancelText: 'Avbryt'
        });

        if (!userConfirmed) return;

        setIsLiveRunning(true);
        setError(null);

        try {
            const data = await runMigration(false);
            setReport(data);
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
            <div className="border-b border-gray-100 dark:border-gray-700 pb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>🔐</span> Migrering av coachkoder
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Kopierar varje organisations coachkod till det låsta stället som serverkontrollen
                    läser ifrån (steg 1 i coachkodsflytten). Gäller alla organisationer på en gång.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={handleDryRun}
                    disabled={isLoading || isLiveRunning}
                    className="px-6 py-3 bg-primary hover:brightness-95 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading ? (<><span className="animate-spin">⏳</span> Analyserar…</>) : 'Torrkör (ändrar inget)'}
                </button>
                <button
                    onClick={handleLiveRun}
                    disabled={!hasDryRunCompleted || isLoading || isLiveRunning}
                    className="px-6 py-3 bg-danger hover:brightness-95 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLiveRunning ? (<><span className="animate-spin">⏳</span> Migrerar…</>) : 'Kör skarpt'}
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm font-bold">
                    {error}
                </div>
            )}

            {report && (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                            <div className="text-2xl font-black text-gray-900 dark:text-white">{report.total}</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organisationer totalt</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                            <div className="text-2xl font-black text-primary">{report.migrated.length}</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {report.dryRun ? 'Skulle kopieras' : 'Kopierade'}
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                            <div className="text-2xl font-black text-gray-900 dark:text-white">{report.alreadyDone.length}</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Redan klara</div>
                        </div>
                    </div>

                    {report.missing.length > 0 ? (
                        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30">
                            <div className="text-sm font-black text-danger uppercase tracking-wider mb-1">
                                {report.missing.length} organisationer saknar coachkod
                            </div>
                            <p className="text-xs text-danger/80 mb-2">
                                Dessa måste få en kod (via passwords eller setCoachUnlockCode) innan
                                klientsidan byts — annars låses de ute.
                            </p>
                            <div className="text-xs font-mono text-danger break-all">
                                {report.missing.join(', ')}
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-sm font-bold text-primary">
                            Ingen organisation saknar coachkod — klart för nästa steg.
                        </div>
                    )}

                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {report.dryRun
                            ? 'Torrkörning — ingenting har ändrats i databasen.'
                            : 'Skarp körning genomförd. Redan satta koder skrevs inte över.'}
                    </p>
                </div>
            )}
        </div>
    );
};
