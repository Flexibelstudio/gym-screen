export type RadarFlag = 'never_started' | 'gone' | 'lost_tempo' | 'plateau' | 'celebrate' | null;

export interface RadarMetrics {
    daysSinceCreated?: number;
    daysSinceLast?: number;
    medianIntervalDays?: number | null;
    threshold?: number;
    weeklyRecent?: number;
    weeklyBase?: number;
    countRecent?: number;
    countBase?: number;
    daysSinceLastPB?: number | null;
    hasRecentPB?: boolean;
    milestoneHit?: number | null;
    totalLogs?: number;
    [key: string]: any;
}

export interface MemberRadarResult {
    flag: RadarFlag;
    reason?: string;
    priority?: number;
    metrics?: RadarMetrics;
}

export interface RadarResultItem {
    member: any;
    flag: RadarFlag;
    reason?: string;
    priority?: number;
    metrics?: RadarMetrics;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseTimestamp(val: any): number {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = new Date(val).getTime();
        return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof val === 'object') {
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val.seconds === 'number') return val.seconds * 1000;
    }
    if (val instanceof Date) return val.getTime();
    return 0;
}

export function getMemberRadarFlag(
    member: any,
    memberLogs: any[],
    referenceDate: Date | string | number,
    lifetime?: { totalWorkouts?: number; lastLogDate?: number }
): MemberRadarResult {
    const refTime = parseTimestamp(referenceDate) || Date.now();

    const sortedLogs = [...(memberLogs || [])].sort(
        (a, b) => parseTimestamp(b.date) - parseTimestamp(a.date)
    );
    const logsCount = sortedLogs.length;
    const migratedCount = typeof member?.migratedStats?.totalWorkouts === 'number' ? member.migratedStats.totalWorkouts : 0;
    const totalWorkouts = lifetime?.totalWorkouts !== undefined 
        ? lifetime.totalWorkouts 
        : ((typeof member?.totalWorkoutsCount === 'number' ? member.totalWorkoutsCount : logsCount) + migratedCount);

    // 1. NEVER_STARTED (prio 1): 0 logs AND created > 14 days ago
    const createdAtMs = parseTimestamp(member?.createdAt);
    const daysSinceCreated = createdAtMs > 0 ? (refTime - createdAtMs) / MS_PER_DAY : 0;
    if (totalWorkouts === 0 && daysSinceCreated > 14) {
        return {
            flag: 'never_started',
            priority: 1,
            reason: `Blev medlem för ${Math.floor(daysSinceCreated)} dagar sedan men har inte loggat något pass än.`,
            metrics: {
                daysSinceCreated: Math.floor(daysSinceCreated),
                totalLogs: 0
            }
        };
    }

    // 2. GONE (prio 2):
    // - If we have >= 8 logs in sortedLogs: calculate median M of last 7 intervals.
    //   Flag if daysSinceLast > max(10, 2.5 * M).
    // - If we have < 8 logs (e.g. empty logs due to windowing, or few logs), but lastLogDate exists (from logs or lifetime.lastLogDate):
    //   Flag if daysSinceLast > 10. medianIntervalDays is null. Reason: "Inget pass på X dagar."
    if (sortedLogs.length >= 8) {
        const recent8 = sortedLogs.slice(0, 8);
        const intervals: number[] = [];
        for (let i = 0; i < 7; i++) {
            const tPrev = parseTimestamp(recent8[i].date);
            const tNext = parseTimestamp(recent8[i + 1].date);
            intervals.push((tPrev - tNext) / MS_PER_DAY);
        }
        intervals.sort((a, b) => a - b);
        const medianIntervalDays = intervals[3];

        const t0 = parseTimestamp(recent8[0].date);
        const daysSinceLast = (refTime - t0) / MS_PER_DAY;
        const threshold = Math.max(10, 2.5 * medianIntervalDays);

        if (daysSinceLast > threshold) {
            const formattedMedian = Number.isInteger(medianIntervalDays)
                ? medianIntervalDays
                : medianIntervalDays.toFixed(1);
            return {
                flag: 'gone',
                priority: 2,
                reason: `Inget pass på ${Math.floor(daysSinceLast)} dagar (brukar träna var ${formattedMedian}:e dag).`,
                metrics: {
                    daysSinceLast: Math.floor(daysSinceLast),
                    medianIntervalDays,
                    threshold,
                    totalLogs: totalWorkouts
                }
            };
        }
    } else {
        const lastLogMs = sortedLogs.length > 0
            ? parseTimestamp(sortedLogs[0].date)
            : parseTimestamp(lifetime?.lastLogDate);

        if (lastLogMs > 0) {
            const daysSinceLast = (refTime - lastLogMs) / MS_PER_DAY;
            if (daysSinceLast > 10) {
                return {
                    flag: 'gone',
                    priority: 2,
                    reason: `Inget pass på ${Math.floor(daysSinceLast)} dagar.`,
                    metrics: {
                        daysSinceLast: Math.floor(daysSinceLast),
                        medianIntervalDays: null,
                        threshold: 10,
                        totalLogs: totalWorkouts
                    }
                };
            }
        }
    }

    // 3. LOST_TEMPO (prio 3): A = pass in last 21 days, B = pass in window 22-63 days. Requires B >= 6.
    // weeklyRecent = A / 3, weeklyBase = B / 6. Flag if weeklyRecent < 0.5 * weeklyBase.
    let countRecent = 0; // last 21 days
    let countBase = 0;   // 22 to 63 days
    for (const log of sortedLogs) {
        const logMs = parseTimestamp(log.date);
        const daysAgo = (refTime - logMs) / MS_PER_DAY;
        if (daysAgo >= 0 && daysAgo <= 21) {
            countRecent++;
        } else if (daysAgo > 21 && daysAgo <= 63) {
            countBase++;
        }
    }

    if (countBase >= 6) {
        const weeklyRecent = countRecent / 3;
        const weeklyBase = countBase / 6;
        if (weeklyRecent < 0.5 * weeklyBase) {
            return {
                flag: 'lost_tempo',
                priority: 3,
                reason: `Tappat tempo: ${weeklyRecent.toFixed(2).replace('.', ',')} pass/vecka senaste 3 veckorna (jämfört med ${weeklyBase.toFixed(2).replace('.', ',')} pass/vecka tidigare).`,
                metrics: {
                    weeklyRecent: Math.round(weeklyRecent * 100) / 100,
                    weeklyBase: Math.round(weeklyBase * 100) / 100,
                    countRecent,
                    countBase,
                    totalLogs: totalWorkouts
                }
            };
        }
    }

    // 4. PLATEAU (prio 4): Skip if member.showOnLeaderboard === false.
    // >= 10 totalWorkouts AND >= 2 logs in last 21 days AND latest log with newPBs > 56 days ago (or missing)
    if (member?.showOnLeaderboard !== false) {
        if (totalWorkouts >= 10 && countRecent >= 2) {
            let daysSinceLastPB: number | null = null;

            const memberLastPBAtMs = parseTimestamp(member?.lastPBAt);
            if (memberLastPBAtMs > 0) {
                daysSinceLastPB = (refTime - memberLastPBAtMs) / MS_PER_DAY;
            } else {
                const pbLog = sortedLogs.find(
                    (log) => Array.isArray(log.newPBs) && log.newPBs.length > 0
                );
                if (pbLog) {
                    const pbLogMs = parseTimestamp(pbLog.date);
                    daysSinceLastPB = (refTime - pbLogMs) / MS_PER_DAY;
                }
            }

            if (daysSinceLastPB === null || daysSinceLastPB > 56) {
                return {
                    flag: 'plateau',
                    priority: 4,
                    reason: daysSinceLastPB !== null
                        ? `Inga nya personbästa på ${Math.floor(daysSinceLastPB)} dagar trots regelbunden träning (${countRecent} pass senaste 3 veckorna).`
                        : `Inga registrerade personbästa trots ${totalWorkouts} genomförda pass.`,
                    metrics: {
                        daysSinceLastPB: daysSinceLastPB !== null ? Math.floor(daysSinceLastPB) : null,
                        countRecent,
                        totalLogs: totalWorkouts
                    }
                };
            }
        }
    }

    // 5. CELEBRATE (prio 5): newPBs in last 7 days OR totalWorkouts is exactly 10, 25, 50, 100 and latest log within 7 days
    const latestLogMs = sortedLogs.length > 0
        ? parseTimestamp(sortedLogs[0].date)
        : parseTimestamp(lifetime?.lastLogDate);
    const daysSinceLatestLog = latestLogMs > 0 ? (refTime - latestLogMs) / MS_PER_DAY : 999;

    const hasRecentPB = member?.showOnLeaderboard !== false && sortedLogs.some((log) => {
        const logMs = parseTimestamp(log.date);
        const daysAgo = (refTime - logMs) / MS_PER_DAY;
        return daysAgo >= 0 && daysAgo <= 7 && Array.isArray(log.newPBs) && log.newPBs.length > 0;
    });

    const isMilestone = [10, 25, 50, 100].includes(totalWorkouts);
    const milestoneHit = isMilestone && daysSinceLatestLog <= 7 ? totalWorkouts : null;

    if (hasRecentPB || milestoneHit !== null) {
        let reason = 'Nytt personbästa!';
        if (hasRecentPB && milestoneHit !== null) {
            reason = `Nytt personbästa OCH milstolpe (${milestoneHit} pass) nåddes senaste veckan!`;
        } else if (hasRecentPB) {
            reason = 'Slog nytt personbästa senaste veckan!';
        } else if (milestoneHit !== null) {
            reason = `Nådde milstolpen ${milestoneHit} genomförda pass!`;
        }

        return {
            flag: 'celebrate',
            priority: 5,
            reason,
            metrics: {
                hasRecentPB,
                milestoneHit,
                totalLogs: totalWorkouts
            }
        };
    }

    // 6. Null
    return { flag: null };
}

export function buildRadar(
    members: any[],
    logsByMemberId: Record<string, any[]>,
    referenceDate: Date | string | number = new Date(),
    lifetimeByMemberId?: Record<string, { totalWorkouts?: number; lastLogDate?: number }>
): RadarResultItem[] {
    const results: RadarResultItem[] = [];
    const refMs = parseTimestamp(referenceDate) || Date.now();

    for (const member of members || []) {
        // Role check: exclude non-members (coach, organizationadmin, systemowner, admin)
        if (member.role && member.role !== 'member') continue;

        // Status check: exclude inactive or ended memberships
        if (member.status === 'inactive') continue;
        if (member.endDate) {
            const endMs = parseTimestamp(member.endDate);
            if (endMs > 0 && endMs <= refMs) continue;
        }

        const mId = member.uid || member.id;
        const memberLogs = logsByMemberId[mId] || [];
        const explicitLifetime = lifetimeByMemberId?.[mId];
        const migratedCount = typeof member?.migratedStats?.totalWorkouts === 'number' ? member.migratedStats.totalWorkouts : 0;
        let totalWorkouts: number | undefined;
        if (explicitLifetime?.totalWorkouts !== undefined) {
            totalWorkouts = explicitLifetime.totalWorkouts;
        } else {
            const baseCount = member?.totalWorkoutsCount ?? memberLogs.length;
            totalWorkouts = baseCount + migratedCount;
        }

        const lifetime = {
            totalWorkouts,
            lastLogDate: explicitLifetime?.lastLogDate ?? member?.lastWorkoutAt
        };
        const res = getMemberRadarFlag(member, memberLogs, referenceDate, lifetime);

        if (res && res.flag !== null) {
            results.push({
                member,
                flag: res.flag,
                reason: res.reason,
                priority: res.priority,
                metrics: res.metrics
            });
        }
    }

    // Sort by priority (1 before 2)
    // Within same priority:
    // - for 'gone': highest daysSinceLast first
    // - for 'lost_tempo': largest drop (weeklyBase - weeklyRecent) first
    results.sort((a, b) => {
        const pA = a.priority ?? 99;
        const pB = b.priority ?? 99;
        if (pA !== pB) return pA - pB;

        if (a.flag === 'gone' && b.flag === 'gone') {
            const dA = a.metrics?.daysSinceLast ?? 0;
            const dB = b.metrics?.daysSinceLast ?? 0;
            return dB - dA;
        }

        if (a.flag === 'lost_tempo' && b.flag === 'lost_tempo') {
            const dropA = (a.metrics?.weeklyBase ?? 0) - (a.metrics?.weeklyRecent ?? 0);
            const dropB = (b.metrics?.weeklyBase ?? 0) - (b.metrics?.weeklyRecent ?? 0);
            return dropB - dropA;
        }

        return 0;
    });

    return results;
}
