import React, { useState, useEffect } from 'react';
import { WorkoutLog } from '../types';
import { getOrganizationLogsSince } from '../services/firebaseService';

interface LastSessionFeedbackProps {
    workoutId: string;
    organizationId: string;
    locationId?: string;
}

export const LastSessionFeedback: React.FC<LastSessionFeedbackProps> = ({
    workoutId,
    organizationId,
    locationId
}) => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<WorkoutLog[]>([]);

    useEffect(() => {
        let isMounted = true;
        const fetchFeedback = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
                const fetchedLogs = await getOrganizationLogsSince(organizationId, sixtyDaysAgo);
                if (isMounted) {
                    setLogs(fetchedLogs);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err?.message || 'Okänt fel');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        if (organizationId && workoutId) {
            fetchFeedback();
        } else {
            setIsLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [organizationId, workoutId, locationId]);

    if (isLoading) {
        return (
            <div className="bg-blue-50 dark:bg-blue-950/40 border-l-[12px] border-blue-500 rounded-2xl p-6 shadow-sm">
                <p className="text-gray-600 dark:text-gray-300 font-medium">Hämtar…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-blue-50 dark:bg-blue-950/40 border-l-[12px] border-blue-500 rounded-2xl p-6 shadow-sm">
                <p className="text-red-600 dark:text-red-400 font-medium">Kunde inte hämta feedbacken: {error}</p>
            </div>
        );
    }

    // Filtrera loggar för passet, studion (inStudio) och eventuell ort (locationId)
    const filteredLogs = logs.filter(log => {
        if (log.workoutId !== workoutId) return false;
        if (log.inStudio !== true) return false;
        if (locationId && log.locationId !== locationId) return false;
        return true;
    });

    if (filteredLogs.length === 0) {
        return (
            <div className="bg-blue-50 dark:bg-blue-950/40 border-l-[12px] border-blue-500 rounded-2xl p-6 shadow-sm">
                <p className="text-blue-900 dark:text-blue-200 font-medium">Passet har inte körts i studion här ännu.</p>
            </div>
        );
    }

    // Gruppering per kalenderdag
    const dayGroups: { [dayStr: string]: { logs: WorkoutLog[]; latestDate: number } } = {};
    for (const log of filteredLogs) {
        const dayStr = new Date(log.date).toLocaleDateString('sv-SE');
        if (!dayGroups[dayStr]) {
            dayGroups[dayStr] = { logs: [], latestDate: log.date };
        }
        dayGroups[dayStr].logs.push(log);
        if (log.date > dayGroups[dayStr].latestDate) {
            dayGroups[dayStr].latestDate = log.date;
        }
    }

    const sortedDayGroups = Object.values(dayGroups).sort((a, b) => b.latestDate - a.latestDate);
    const latestGroup = sortedDayGroups[0];

    if (!latestGroup || latestGroup.logs.length === 0) {
        return (
            <div className="bg-blue-50 dark:bg-blue-950/40 border-l-[12px] border-blue-500 rounded-2xl p-6 shadow-sm">
                <p className="text-blue-900 dark:text-blue-200 font-medium">Passet har inte körts i studion här ännu.</p>
            </div>
        );
    }

    const dayLogs = latestGroup.logs;
    const latestDate = latestGroup.latestDate;

    // Datumskrift: "tisdag 29 juli"
    const formattedDate = new Date(latestDate).toLocaleDateString('sv-SE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    // Antal loggar
    const totalLogsCount = dayLogs.length;

    // Beräkning av snitt-RPE (ENDAST loggar där rpe inte är null och inte undefined)
    const rpeLogs = dayLogs.filter(l => l.rpe !== null && l.rpe !== undefined);
    const avgRpeNum = rpeLogs.length > 0 
        ? rpeLogs.reduce((acc, curr) => acc + Number(curr.rpe), 0) / rpeLogs.length 
        : null;
    const avgRpeStr = avgRpeNum !== null 
        ? avgRpeNum.toFixed(1).replace('.', ',') 
        : null;

    // Känslofördelning (good = bra, neutral = neutrala, bad = tung)
    const goodCount = dayLogs.filter(l => l.feeling === 'good').length;
    const neutralCount = dayLogs.filter(l => l.feeling === 'neutral').length;
    const badCount = dayLogs.filter(l => l.feeling === 'bad').length;

    const feelingParts: string[] = [];
    if (goodCount > 0) feelingParts.push(`${goodCount} bra`);
    if (neutralCount > 0) feelingParts.push(`${neutralCount} neutrala`);
    if (badCount > 0) feelingParts.push(`${badCount} tung`);
    const feelingText = feelingParts.join(' · ');

    // Vanligaste taggarna (max 3)
    const tagCounts: { [tag: string]: number } = {};
    for (const log of dayLogs) {
        if (Array.isArray(log.tags)) {
            for (const tag of log.tags) {
                if (tag) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            }
        }
    }
    const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    // Kommentarer med medlemsskrivet namn
    const comments = dayLogs
        .filter(l => l.comment && l.comment.trim() !== '')
        .map(l => ({
            memberName: l.memberName || 'Anonym',
            comment: l.comment.trim()
        }));

    return (
        <div className="bg-blue-50 dark:bg-blue-950/40 border-l-[12px] border-blue-500 rounded-2xl p-6 shadow-sm space-y-4 text-gray-900 dark:text-gray-100">
            <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <span>📊</span> Senast passet kördes
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium capitalize">
                    {formattedDate}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
                <span>{totalLogsCount} loggade passet</span>
                {avgRpeStr && (
                    <>
                        <span className="text-gray-400">•</span>
                        <span>Snitt-RPE {avgRpeStr}</span>
                    </>
                )}
                {feelingText && (
                    <>
                        <span className="text-gray-400">•</span>
                        <span>{feelingText}</span>
                    </>
                )}
            </div>

            {topTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {topTags.map(([tag, count]) => (
                        <span 
                            key={tag} 
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200"
                        >
                            {tag} ({count})
                        </span>
                    ))}
                </div>
            )}

            {comments.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
                    {comments.map((c, idx) => (
                        <p key={idx} className="text-sm">
                            <span className="font-bold">{c.memberName}:</span> {c.comment}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};
