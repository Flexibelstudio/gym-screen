import React, { useState } from 'react';
import { Organization } from '../../types';
import { EXERCISE_ALIASES, EXERCISE_DISPLAY_NAMES } from '../../data/exerciseAliases';
import { functions } from '../../services/firebaseService';
import { httpsCallable } from 'firebase/functions';

interface ExerciseMergeAnalysisCardProps {
    organizations: Organization[];
}

interface WinnerData {
    name: string;
    weight: number;
    reps: number;
    calculated1RM: number;
}

interface ExampleData {
    memberName: string;
    names: string[];
    winner: WinnerData;
}

interface GroupAffected {
    canonical: string;
    memberCount: number;
    docCount: number;
    examples: ExampleData[];
}

interface AnalysisReport {
    membersExamined: number;
    pbDocsExamined: number;
    groupsAffected: GroupAffected[];
    pbDocsToWrite: number;
    pbDocsToDelete: number;
    logsExamined: number;
    logsToRewrite: number;
    exerciseResultEntriesToRewrite: number;
    estimatedWrites: number;
}

export const ExerciseMergeAnalysisCard: React.FC<ExerciseMergeAnalysisCardProps> = ({ organizations }) => {
    const activeOrgs = organizations.filter(o => o.status !== 'archived');
    const [selectedOrgId, setSelectedOrgId] = useState<string>(activeOrgs[0]?.id || organizations[0]?.id || '');
    const [migrateLogs, setMigrateLogs] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [report, setReport] = useState<AnalysisReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRunAnalysis = async () => {
        if (!selectedOrgId) {
            alert('Vänligen välj en organisation.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setReport(null);

        try {
            // Bygg aliasGroups från EXERCISE_ALIASES och EXERCISE_DISPLAY_NAMES
            const aliasGroups = Object.entries(EXERCISE_ALIASES).map(([canonicalKey, variants]) => {
                const canonicalFormatted = EXERCISE_DISPLAY_NAMES[canonicalKey] || (canonicalKey.charAt(0).toUpperCase() + canonicalKey.slice(1));
                return {
                    canonical: canonicalFormatted,
                    variants: variants
                };
            });

            const callable = httpsCallable<any, AnalysisReport>(functions, 'mergeDuplicateExerciseNames');
            const response = await callable({
                orgId: selectedOrgId,
                aliasGroups,
                dryRun: true, // Alltid torrkörning i detta steg
                migrateLogs: migrateLogs
            });

            setReport(response.data);
        } catch (err: any) {
            console.error('Analyse error:', err);
            setError(err.message || 'Ett fel inträffade vid analysen.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>📊</span> Analysera övningsdubbletter
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Sök efter personbästa och historik med varianter av samma övningsnamn (t.ex. "Bänkpress" vs "Bänkpress (Bench Press)").
                    </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800/50 self-start sm:self-auto">
                    ⚠️ SÄKERHETSLÄGE: Endast Torrkörning (Dry Run)
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                        Välj Organisation / Gym
                    </label>
                    <select
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                        {organizations.map(org => (
                            <option key={org.id} value={org.id}>
                                {org.name} ({org.id})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                    <input
                        type="checkbox"
                        id="migrateLogsCheck"
                        checked={migrateLogs}
                        onChange={(e) => setMigrateLogs(e.target.checked)}
                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <label htmlFor="migrateLogsCheck" className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        Granska även historiska träningsloggar (<code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded">workoutLogs</code>)
                    </label>
                </div>
            </div>

            <button
                onClick={handleRunAnalysis}
                disabled={isLoading || !selectedOrgId}
                className="w-full sm:w-auto px-6 py-3 bg-primary hover:brightness-95 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <span className="animate-spin">⏳</span>
                        <span>Analyserar medlemsdata...</span>
                    </>
                ) : (
                    <>
                        <span>🔍</span>
                        <span>Analysera övningsdubbletter</span>
                    </>
                )}
            </button>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 text-sm">
                    <strong>Fel vid analys:</strong> {error}
                </div>
            )}

            {report && (
                <div className="mt-6 space-y-6 bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>📋</span> Analysrapport (Torrkörning)
                        </h4>
                        <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                            Inga ändringar gjorda i databasen
                        </span>
                    </div>

                    {/* Sammanfattande nyckeltal */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Medlemmar</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">{report.membersExamined}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">PB-dokument</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">{report.pbDocsExamined}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">PB att skriva</span>
                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{report.pbDocsToWrite}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">PB att radera</span>
                            <span className="text-xl font-black text-amber-600 dark:text-amber-400">{report.pbDocsToDelete}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Loggar granskade</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">{report.logsExamined}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Loggar att ändra</span>
                            <span className="text-xl font-black text-blue-600 dark:text-blue-400">{report.logsToRewrite}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Övningsrader ändras</span>
                            <span className="text-xl font-black text-purple-600 dark:text-purple-400">{report.exerciseResultEntriesToRewrite}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase">Est. Skrivningar</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">{report.estimatedWrites}</span>
                        </div>
                    </div>

                    {/* Detaljerade grupper */}
                    <div className="space-y-4">
                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            Påverkade övningsgrupper ({report.groupsAffected.length})
                        </h5>

                        {report.groupsAffected.length === 0 ? (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                ✨ Inga övningsdubbletter hittades i denna organisation!
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {report.groupsAffected.map((group, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                            <span className="font-bold text-base text-slate-900 dark:text-white">
                                                {group.canonical}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                {group.memberCount} medlem(mar) påverkade • {group.docCount} PB-dokument totalt
                                            </span>
                                        </div>

                                        {group.examples && group.examples.length > 0 && (
                                            <div className="space-y-2">
                                                <span className="text-xs font-bold text-slate-500 uppercase">Exempel (max 3):</span>
                                                <div className="space-y-2">
                                                    {group.examples.map((ex, exIdx) => (
                                                        <div key={exIdx} className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800 space-y-1">
                                                            <div className="font-bold text-slate-800 dark:text-slate-200">
                                                                👤 {ex.memberName}
                                                            </div>
                                                            <div className="text-slate-600 dark:text-slate-400">
                                                                <strong>Funna varianter:</strong> {ex.names.join(', ')}
                                                            </div>
                                                            <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                🏆 <strong>Vinnande värde ({ex.winner.name}):</strong> Vikt: {ex.winner.weight}kg, Reps: {ex.winner.reps}, 1RM: {ex.winner.calculated1RM}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Rå JSON-utskrift */}
                    <details className="mt-4 text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold py-1">
                            Visa Rå JSON-rapport
                        </summary>
                        <pre className="mt-2 p-4 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed">
                            {JSON.stringify(report, null, 2)}
                        </pre>
                    </details>
                </div>
            )}
        </div>
    );
};
