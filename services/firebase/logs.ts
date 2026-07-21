import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, or, orderBy, limit, onSnapshot, writeBatch, serverTimestamp, runTransaction, deleteField 
} from 'firebase/firestore';
import { db, isOffline, sanitizeData, getPBId, getLeaderboardDocId } from './init';
import { calculate1RM } from '../../utils/workoutUtils';
import { getOrganizationById } from './organizations';
import { getGlobalSummerChallenge } from './misc';
import { WorkoutLog, PersonalBest, WorkoutResult, MemberGoals, Workout, StudioEvent } from '../../types';

export const saveWorkoutLog = async (logData: any): Promise<{ log: any, newRecords: { exerciseName: string, weight: number, diff: number, reps?: number, calculated1RM?: number }[] }> => {
    if (isOffline || !db || !logData.organizationId) {
        return { log: logData, newRecords: [] };
    }
    
    const newLogRef = doc(collection(db, 'workoutLogs'));
    const newLog = { id: newLogRef.id, ...logData };
    // Säkerställ att locationId sparas, annars sätt till default
    if (!newLog.locationId) {
        const org = await getOrganizationById(logData.organizationId);
        if (org && org.locations && org.locations.length > 0) {
            newLog.locationId = org.locations[0].id;
        }
    }
    const newRecords: { exerciseName: string; weight: number; diff: number; reps?: number; calculated1RM?: number }[] = [];

    if (logData.workoutId && logData.workoutId !== 'manual' && !logData.benchmarkId) {
        try {
            const wSnap = await getDoc(doc(db, 'workouts', logData.workoutId));
            if (wSnap.exists()) {
                const wData = wSnap.data() as Workout;
                if (wData.aiProgressionPrompt) {
                    newLog.aiProgressionPrompt = wData.aiProgressionPrompt;
                }
                if (wData.benchmarkId) {
                    newLog.benchmarkId = wData.benchmarkId;
                    if (newLog.durationMinutes) {
                        newLog.benchmarkValue = newLog.durationMinutes * 60;
                    } else if (newLog.exerciseResults && newLog.exerciseResults.length > 0) {
                         const maxWeight = Math.max(...newLog.exerciseResults.map((ex: any) => ex.weight || 0));
                         if (maxWeight > 0) newLog.benchmarkValue = maxWeight;
                    }
                }
            }
        } catch (e) {}
    }

    let showOnLeaderboard = true;

    if (logData.memberId) {
        try {
            const userSnap = await getDoc(doc(db, 'users', logData.memberId));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                newLog.memberName = `${userData.firstName || 'Medlem'} ${userData.lastName ? userData.lastName[0] + '.' : ''}`.trim();
                newLog.memberPhotoUrl = userData.photoUrl || null;
                showOnLeaderboard = userData.showOnLeaderboard !== false;
                newLog.showOnLeaderboard = showOnLeaderboard;
                // Add location from user object if not already explicitly sent
                if (!newLog.locationId && userData.locationId) {
                    newLog.locationId = userData.locationId;
                }

                // Beräkna Sommarutmaning-poäng & veckomål-milestones för denna log
                if (userData.joinedSummerChallenge) {
                    const challenge = await getGlobalSummerChallenge();
                    const challengeStart = challenge?.startDate;
                    const challengeEnd = challenge?.endDate;
                    const logTime = newLog.date || Date.now();
                    
                    const isWithinChallengeDates = (!challengeStart || logTime >= challengeStart) && (!challengeEnd || logTime <= challengeEnd);

                    if (isWithinChallengeDates) {
                        const now = new Date();
                        const currentDay = now.getDay() || 7;
                        const monday = new Date(now);
                        monday.setDate(now.getDate() - (currentDay - 1));
                        monday.setHours(0, 0, 0, 0);
                        const thisWeekMonday = monday.getTime();

                        // Hämta deltagarens veckomål för innevarande vecka (med anpassning om det är första veckan)
                        const baseGoal = userData.summerChallengeGoals?.[thisWeekMonday] !== undefined 
                            ? userData.summerChallengeGoals[thisWeekMonday] 
                            : (userData.summerChallengeGoal || 3);

                        let myGoal = baseGoal;
                        const joinedAt = userData.joinedSummerChallengeAt || 0;
                        if (joinedAt >= thisWeekMonday && joinedAt < thisWeekMonday + 7 * 24 * 60 * 60 * 1000) {
                            const joinDate = new Date(joinedAt);
                            const joinDay = joinDate.getDay() || 7; // Monday = 1, ..., Sunday = 7
                            const daysLeft = Math.max(0, 7 - joinDay);
                            myGoal = Math.max(1, Math.round((daysLeft / 7) * baseGoal));
                        }

                        // Beräkna poäng för detta NYA pass
                        let newPassPoints = 0;
                        if (newLog.inStudio === true) {
                            newPassPoints = 2;
                        } else {
                            const isLessThan30 = newLog.durationMinutes !== undefined && newLog.durationMinutes > 0 && newLog.durationMinutes < 30;
                            if (!isLessThan30) {
                                newPassPoints = 1;
                            }
                        }

                        if (newPassPoints > 0) {
                            // Hämta användarens loggar för innevarande vecka för att se ackumulerade veckopoäng innan detta pass
                            const q = query(
                                collection(db, 'workoutLogs'),
                                where("memberId", "==", logData.memberId),
                                where("date", ">=", thisWeekMonday)
                            );
                            const weekLogsSnap = await getDocs(q);
                            let previousWeekPoints = 0;
                            
                            weekLogsSnap.forEach(snap => {
                                const l = snap.data();
                                const lDate = l.date || 0;
                                if ((!challengeStart || lDate >= challengeStart) && (!challengeEnd || lDate <= challengeEnd)) {
                                    let pts = 0;
                                    if (l.inStudio === true) {
                                        pts = 2;
                                    } else {
                                        const isLessThan30 = l.durationMinutes !== undefined && l.durationMinutes > 0 && l.durationMinutes < 30;
                                        if (!isLessThan30) {
                                            pts = 1;
                                        }
                                    }
                                    previousWeekPoints += pts;
                                }
                            });

                            const totalPointsWithNew = previousWeekPoints + newPassPoints;

                            if (previousWeekPoints < myGoal && totalPointsWithNew >= myGoal) {
                                newLog.reachedSummerGoal = true;
                            } else if (previousWeekPoints >= myGoal) {
                                newLog.overDeliveredSummerGoal = true;
                            }
                        }
                    }
                }
            }
        } catch (e) { console.warn("Failed to enrich log", e); }
    }

    const batch = writeBatch(db);

    if (logData.memberId && logData.exerciseResults) {
        try {
            const pbCollectionRef = collection(db, 'users', logData.memberId, 'personalBests');
            const currentPBsSnap = await getDocs(pbCollectionRef);
            const currentPBs: Record<string, any> = {};
            currentPBsSnap.forEach(d => currentPBs[d.id] = d.data());

            for (const exResult of logData.exerciseResults) {
                let bestSet: { weight: number, reps: number, oneRm: number } | null = null;
                
                const processSet = (wVal: any, rVal: any) => {
                    const w = parseFloat(wVal) || 0;
                    const r = parseFloat(rVal) || 0;
                    
                    if (r > 0 || w > 0) {
                        let oneRm = 0;
                        if (w > 0 && r > 0 && r <= 10) {
                            oneRm = calculate1RM(w, r) || 0;
                        }
                        
                        const currentScore = oneRm > 0 ? oneRm * 10000 : (w > 0 ? w * 100 + r : r);
                        const bestScore = bestSet ? (bestSet.oneRm > 0 ? bestSet.oneRm * 10000 : (bestSet.weight > 0 ? bestSet.weight * 100 + bestSet.reps : bestSet.reps)) : -1;
                        
                        if (currentScore > bestScore) {
                            bestSet = { weight: w, reps: r, oneRm };
                        }
                    }
                };

                if (exResult.setDetails && exResult.setDetails.length > 0) {
                    exResult.setDetails.forEach((s: any) => processSet(s.weight, s.reps));
                } else if (exResult.weight || exResult.reps) {
                    processSet(exResult.weight, exResult.reps);
                }

                if (bestSet && exResult.exerciseName) {
                    const pbId = getPBId(exResult.exerciseName);
                    
                    const existingPB = currentPBs[pbId];
                    let existingScore = -1;
                    if (existingPB) {
                        const ew = existingPB.weight || 0;
                        const er = existingPB.reps || 0;
                        const eRm = existingPB.calculated1RM || 0;
                        existingScore = eRm > 0 ? eRm * 10000 : (ew > 0 ? ew * 100 + er : er);
                    }

                    const newScore = bestSet.oneRm > 0 ? bestSet.oneRm * 10000 : (bestSet.weight > 0 ? bestSet.weight * 100 + bestSet.reps : bestSet.reps);

                    if (newScore > existingScore) {
                        const pbData: PersonalBest = { 
                            id: pbId, 
                            exerciseName: exResult.exerciseName.trim(), 
                            weight: bestSet.weight, 
                            reps: bestSet.reps,
                            calculated1RM: bestSet.oneRm,
                            date: Date.now() 
                        };
                        batch.set(doc(db, 'users', logData.memberId, 'personalBests', pbId), pbData);
                        
                        // For pure reps exercises, diff can just be the difference in reps.
                        // Or if 1RM exists, the difference in 1RM.
                        let computedDiff = 0;
                        if (bestSet.oneRm > 0 && existingPB && existingPB.calculated1RM) {
                            computedDiff = parseFloat((bestSet.oneRm - existingPB.calculated1RM).toFixed(2));
                        } else if (bestSet.weight === 0 && existingPB && existingPB.weight === 0) {
                            computedDiff = bestSet.reps - (existingPB.reps || 0);
                        } else if (bestSet.weight > 0 && (!existingPB || existingPB.weight === 0)) {
                            computedDiff = bestSet.weight;
                        } else if (existingPB && bestSet.weight > existingPB.weight) {
                            computedDiff = bestSet.weight - existingPB.weight;
                        }

                        newRecords.push({
                            exerciseName: exResult.exerciseName.trim(),
                            weight: bestSet.weight, 
                            reps: bestSet.reps,
                            calculated1RM: bestSet.oneRm,
                            diff: computedDiff
                        });
                    }
                }
            }

            if (newRecords.length > 0 && showOnLeaderboard) {
                newLog.newPBs = newRecords;
                const eventRef = doc(collection(db, 'studio_events'));
                const eventData: StudioEvent = {
                    id: eventRef.id,
                    type: 'pb',
                    organizationId: logData.organizationId,
                    locationId: newLog.locationId || logData.locationId || null, 
                    timestamp: Date.now(),
                    data: { 
                        userName: newLog.memberName || 'En medlem', 
                        userPhotoUrl: newLog.memberPhotoUrl || null, 
                        records: newRecords
                    }
                };
                batch.set(eventRef, eventData);
            }
        } catch (e) { console.error("PB calculation failed", e); }
    }

    batch.set(newLogRef, newLog);
    await batch.commit();

    return { log: newLog, newRecords };
};

export const updateWorkoutLog = async (logId: string, updates: Partial<WorkoutLog>) => {
    if (isOffline || !db || !logId) return;
    try {
        await updateDoc(doc(db, 'workoutLogs', logId), sanitizeData(updates));
    } catch (e) { console.error("updateWorkoutLog failed", e); }
};

export const deleteWorkoutLog = async (logId: string) => {
    if (isOffline || !db || !logId) return;
    try {
        await deleteDoc(doc(db, 'workoutLogs', logId));
    } catch (e) { console.error("deleteWorkoutLog failed", e); }
};

export const toggleWorkoutLogLike = async (logId: string, memberId: string, memberName: string, currentlyLiked: boolean) => {
    if (isOffline || !db || !logId || !memberId) return;
    try {
        const docRef = doc(db, 'workoutLogs', logId);
        if (currentlyLiked) {
            await updateDoc(docRef, {
                [`likes.${memberId}`]: deleteField()
            });
        } else {
            await updateDoc(docRef, {
                [`likes.${memberId}`]: {
                    uid: memberId,
                    name: memberName,
                    likedAt: Date.now()
                }
            });
        }
    } catch (e) {
        console.error("toggleWorkoutLogLike failed", e);
    }
};

export const listenToMemberLogs = (memberId: string, onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db || !memberId) {
        onUpdate([]);
        return () => {};
    }
    const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => d.data() as WorkoutLog));
    }, (err) => console.error("listenToMemberLogs failed", err));
};


export const listenToCommunityLogs = (orgId: string, onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate([]);
        return () => {};
    }
    const q = query(collection(db, 'workoutLogs'), where("organizationId", "==", orgId), orderBy("date", "desc"), limit(20));
    return onSnapshot(q, (snap) => {
        const logs = snap.docs.map(d => d.data() as WorkoutLog).filter(log => log.showOnLeaderboard !== false && log.inStudio !== false);
        onUpdate(logs);
    }, (err) => console.error("listenToCommunityLogs failed", err));
};

export const listenToCommunityLogsByLocations = (orgId: string, locationIds: string[], onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db || !orgId || locationIds.length === 0) {
        onUpdate([]);
        return () => {};
    }

    const unsubscribes: (() => void)[] = [];
    const logsPerLocation: Record<string, WorkoutLog[]> = {};

    const emitMergedLogs = () => {
        let merged: WorkoutLog[] = [];
        for (const loc of locationIds) {
            if (logsPerLocation[loc]) {
                merged = [...merged, ...logsPerLocation[loc]];
            }
        }
        // Sortera efter datum (nyast först)
        merged.sort((a, b) => b.date - a.date);
        onUpdate(merged);
    };

    locationIds.forEach(locId => {
        const q = query(
            collection(db, 'workoutLogs'),
            where("organizationId", "==", orgId),
            where("locationId", "==", locId),
            orderBy("date", "desc"),
            limit(20)
        );
        const unsub = onSnapshot(q, (snap) => {
            const logs = snap.docs.map(d => d.data() as WorkoutLog).filter(log => log.showOnLeaderboard !== false && log.inStudio !== false);
            logsPerLocation[locId] = logs;
            emitMergedLogs();
        }, (err) => console.error(`listenToCommunityLogsByLocations failed for loc ${locId}`, err));
        unsubscribes.push(unsub);
    });

    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
};

export const listenToLeaderboardLogs = (orgId: string, limitCount: number, onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate([]);
        return () => {};
    }
    const q = query(collection(db, 'workoutLogs'), where("organizationId", "==", orgId), orderBy("date", "desc"), limit(limitCount));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => d.data() as WorkoutLog));
    }, (err) => console.error("listenToLeaderboardLogs failed", err));
};

export const getMemberLogs = async (memberId: string): Promise<WorkoutLog[]> => {
    if (isOffline || !db || !memberId) return []; 
    try {
        const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as WorkoutLog);
    } catch (e) { return []; }
};

export const getOrganizationLogs = async (orgId: string, limitCount: number = 100): Promise<WorkoutLog[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(collection(db, 'workoutLogs'), where("organizationId", "==", orgId), orderBy("date", "desc"), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as WorkoutLog);
    } catch (e) { return []; }
};

export const getMemberDataForAI = async (memberId: string): Promise<{ logs: WorkoutLog[], pbs: PersonalBest[] }> => {
    if (isOffline || !db || !memberId) return { logs: [], pbs: [] };

    try {
        // Fetch last 15 workout logs
        const logsQuery = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"), limit(15));
        const logsSnap = await getDocs(logsQuery);
        const logs = logsSnap.docs.map(d => d.data() as WorkoutLog);

        // Fetch all personal bests
        const pbsSnap = await getDocs(collection(db, 'users', memberId, 'personalBests'));
        const pbs = pbsSnap.docs.map(d => d.data() as PersonalBest);

        return { logs, pbs };
    } catch (error) {
        console.error("Error fetching member data for AI:", error);
        return { logs: [], pbs: [] };
    }
};

export const listenToPersonalBests = (userId: string, onUpdate: (pbs: PersonalBest[]) => void, onError?: (err: any) => void) => {
    if (isOffline || !db || !userId) {
        onUpdate([]);
        return () => {};
    }
    return onSnapshot(collection(db, 'users', userId, 'personalBests'), (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() }) as PersonalBest));
    }, (err) => {
        console.error("listenToPersonalBests failed", err);
        if (onError) onError(err);
    });
};

export const updatePersonalBest = async (userId: string, exerciseName: string, weight: number) => {
    if (isOffline || !db || !userId) return;
    const pbId = getPBId(exerciseName);
    try {
        await setDoc(doc(db, 'users', userId, 'personalBests', pbId), { id: pbId, exerciseName: exerciseName.trim(), weight, date: Date.now() });
    } catch (e) { console.error("updatePersonalBest failed", e); }
};

export const resetPersonalBest = async (userId: string, exerciseName: string) => {
    if (isOffline || !db || !userId) return;
    const pbId = getPBId(exerciseName);
    try {
        await setDoc(doc(db, 'users', userId, 'personalBests', pbId), { 
            id: pbId, 
            exerciseName: exerciseName.trim(), 
            weight: 0, 
            reps: 0,
            calculated1RM: 0,
            date: Date.now() 
        });
    } catch (e) { console.error("resetPersonalBest failed", e); }
};


export const saveWorkoutResult = async (result: WorkoutResult) => {
    if (isOffline || !db) return;
    try {
        await setDoc(doc(db, 'workout_results', result.id), sanitizeData(result));
    } catch (e) { console.error("saveWorkoutResult failed", e); }
};

export const getWorkoutResults = async (workoutId: string, orgId: string): Promise<WorkoutResult[]> => {
    if (isOffline || !db || !workoutId) return [];
    try {
        const q = query(collection(db, 'workout_results'), where('workoutId', '==', workoutId), where('organizationId', '==', orgId), orderBy('finishTime', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as WorkoutResult);
    } catch (e) { return []; }
};