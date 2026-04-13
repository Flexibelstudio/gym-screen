

// ... (imports remain the same)
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInAnonymously, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  reauthenticateWithCredential,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  Auth,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  getDocsFromServer,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  or,
  orderBy, 
  limit, 
  onSnapshot, 
  writeBatch, 
  deleteField,
  serverTimestamp,
  Firestore,
  runTransaction
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  FirebaseStorage 
} from 'firebase/storage';
import { 
  getFunctions, 
  httpsCallable 
} from 'firebase/functions';
import { getMessaging, getToken, Messaging, onMessage } from 'firebase/messaging';

export const listenToForegroundMessages = (callback: (payload: any) => void) => {
    if (isOffline || !messaging) return () => {};
    return onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        callback(payload);
    });
};

import { firebaseConfig } from './firebaseConfig';
import { 
  Organization, UserData, Workout, InfoCarousel, 
  BankExercise, SuggestedExercise, WorkoutResult, CompanyDetails, 
  SmartScreenPricing, HyroxRace, SeasonalThemeSetting, MemberGoals, 
  WorkoutLog, CheckInEvent, Member, UserRole, PersonalBest, StudioEvent,
  CustomPage, AdminActivity, BenchmarkDefinition, RemoteSessionState, Studio
} from '../types';
import { MOCK_ORGANIZATIONS, MOCK_ORG_ADMIN, MOCK_EXERCISE_BANK, MOCK_MEMBERS, MOCK_SMART_SCREEN_PRICING } from '../data/mockData';

// --- INITIALISERING ---
const hasFirebaseConfig = !!(
    (import.meta as any).env?.VITE_FIREBASE_API_KEY || 
    (process as any).env?.VITE_FIREBASE_API_KEY
);

export const isOffline = !hasFirebaseConfig;

let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export let storage: FirebaseStorage | null = null;
export let messaging: Messaging | null = null;
let functions: any = null;

if (!isOffline) {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        functions = getFunctions(app, 'us-central1');
        
        // Messaging is only supported in browsers that support the required APIs
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            messaging = getMessaging(app);
        }
    } catch (error) {
        console.error("CRITICAL: Firebase init failed.", error);
    }
}

// ... (Rest of auth and helper functions remain unchanged)
const sanitizeData = <T>(data: T): T => JSON.parse(JSON.stringify(data));

const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const getPBId = (name: string) => name.toLowerCase().trim().replace(/[^\w]/g, '_');

const normalizeString = (str: string) => str.toLowerCase().trim().replace(/[^\w\såäöÅÄÖ]/g, '');

// ... (Previous exports like saveAdminActivity, getAdminActivities etc. remain unchanged)
export const saveAdminActivity = async (activity: Omit<AdminActivity, 'id'>) => {
    if (isOffline || !db) return;
    try {
        const ref = doc(collection(db, 'admin_activity'));
        await setDoc(ref, {
            ...sanitizeData(activity),
            id: ref.id
        });
    } catch (e) {
        console.error("Failed to save admin activity:", e);
    }
};

export const getAdminActivities = async (orgId: string, limitCount = 100): Promise<AdminActivity[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(
            collection(db, 'admin_activity'), 
            where('organizationId', '==', orgId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as AdminActivity);
    } catch (e) {
        console.error("getAdminActivities failed", e);
        return [];
    }
};

export const listenToAdminActivities = (orgId: string, onUpdate: (activities: AdminActivity[]) => void) => {
    if (isOffline || !db || !orgId) return () => {};
    const q = query(
        collection(db, 'admin_activity'), 
        where('organizationId', '==', orgId),
        orderBy('timestamp', 'desc'),
        limit(100)
    );
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => d.data() as AdminActivity));
    });
};

export const onAuthChange = (callback: (user: User | null) => void) => {
    if (isOffline || !auth) return () => {}; 
    return onAuthStateChanged(auth, callback);
};

export const signIn = async (email: string, password: string): Promise<User> => {
    if (isOffline || !auth) throw new Error("Appen är i offline-läge.");
    try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        return credential.user;
    } catch (error) {
        console.error("SignIn failed:", error);
        throw error;
    }
};

export const signInAsStudio = async (): Promise<User> => {
    if (isOffline || !auth) return { uid: 'offline_studio_uid', isAnonymous: true } as User;
    try {
        const credential = await signInAnonymously(auth);
        return credential.user;
    } catch (error) {
        console.error("Anonymous sign-in failed:", error);
        throw error;
    }
};

export const signOut = (): Promise<void> => (isOffline || !auth) ? Promise.resolve() : firebaseSignOut(auth);

export const sendPasswordResetEmail = (email: string) => (isOffline || !auth) ? Promise.resolve() : firebaseSendPasswordResetEmail(auth, email);

export const reauthenticateUser = async (user: User, password: string) => {
  if (isOffline || !auth || !user.email) return;
  const credential = EmailAuthProvider.credential(user.email, password);
  return await reauthenticateWithCredential(user, credential);
};

export const updateUserTermsAccepted = async (uid: string) => {
    if (isOffline || !db || !uid) return;
    try {
        await updateDoc(doc(db, 'users', uid), { termsAcceptedAt: Date.now() });
    } catch (e) { console.error("Terms update failed", e); }
};

export const getMembers = async (orgId: string): Promise<Member[]> => {
    if (isOffline || !db || !orgId) return MOCK_MEMBERS;
    try {
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), uid: d.id, id: d.id }) as Member);
    } catch (e) { console.error("getMembers failed", e); return []; }
};

export const getAdminsForOrganization = async (orgId: string): Promise<UserData[]> => {
    if (isOffline || !db || !orgId) return [MOCK_ORG_ADMIN];
    try {
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId), where('role', '==', 'organizationadmin'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserData);
    } catch (e) { return []; }
};

export const getCoachesForOrganization = async (orgId: string): Promise<UserData[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId), where('role', '==', 'coach'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserData);
    } catch (e) { return []; }
};

export const listenToMembers = (orgId: string, onUpdate: (members: Member[]) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate(MOCK_MEMBERS);
        return () => {};
    }
    const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
    return onSnapshot(q, (snap) => {
        const members = snap.docs.map(d => ({ ...d.data(), uid: d.id, id: d.id }) as Member);
        onUpdate(members);
    }, (err) => console.error("listenToMembers failed", err));
};

export const updateUserGoals = async (uid: string, goals: MemberGoals) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), { goals: sanitizeData(goals) });
};

export const updateUserProfile = async (uid: string, data: Partial<UserData>) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), sanitizeData(data));
    
    // If showOnLeaderboard preference changed, update recent workout logs so they disappear/appear immediately
    if (data.showOnLeaderboard !== undefined) {
        try {
            const now = new Date();
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)));
            startOfWeek.setHours(0, 0, 0, 0);
            
            const q = query(
                collection(db, 'workoutLogs'),
                where("memberId", "==", uid),
                where("date", ">=", startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000) // Go back an extra week just in case
            );
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => {
                batch.update(d.ref, { showOnLeaderboard: data.showOnLeaderboard });
            });
            await batch.commit();
        } catch (e) {
            console.error("Failed to update recent logs visibility", e);
        }
    }
};

export const requestPushNotificationPermission = async (uid: string): Promise<string | null> => {
    if (isOffline || !messaging || !db || !uid) return null;
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // Get the token
            const token = await getToken(messaging, {
                // VAPID key is optional if configured in Firebase Console, but recommended.
                // We'll let Firebase use the default sender ID from config.
            });
            
            if (token) {
                // Save token to user profile
                await updateDoc(doc(db, 'users', uid), {
                    fcmToken: token,
                    pushNotificationsEnabled: true
                });
                return token;
            }
        }
        return null;
    } catch (error) {
        console.error('Error requesting push notification permission:', error);
        return null;
    }
};

export const updateUserRoleCloud = async (targetUid: string, newRole: UserRole) => {
    if (isOffline || !functions) throw new Error("Offline eller systemet ej redo.");
    try {
        const func = httpsCallable(functions, 'flexUpdateUserRole');
        const result = await func({ targetUid, newRole });
        return result.data;
    } catch (err: any) {
        console.error("Cloud function error:", err);
        throw new Error(err.message || "Ett fel uppstod vid rollbyte.");
    }
};

export const approveCoach = async (uid: string) => {
    if (isOffline || !db || !uid) return;
    const approveCoachFn = httpsCallable(functions, 'flexApproveCoach');
    try {
        await approveCoachFn({ targetUid: uid });
    } catch (err: any) {
        console.error("Cloud function error:", err);
        throw new Error(err.message || "Ett fel uppstod vid godkännande av coach.");
    }
};

export const updateMemberEndDate = async (uid: string, date: string | null) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), { endDate: date });
};

export const registerMemberWithCode = async (email: string, pass: string, code: string, additionalData?: any) => {
    if (isOffline || !db || !auth) throw new Error("Systemet är i offline-läge.");

    const upperCode = code.toUpperCase();
    
    // Check for member code first
    let q = query(collection(db, 'organizations'), where('inviteCode', '==', upperCode));
    let snap = await getDocs(q);
    
    let isCoach = false;
    
    // If not found, check for coach code
    if (snap.empty) {
        q = query(collection(db, 'organizations'), where('coachCode', '==', upperCode));
        snap = await getDocs(q);
        if (snap.empty) {
            throw new Error("Ogiltig inbjudningskod.");
        }
        isCoach = true;
    }
    
    const organizationId = snap.docs[0].id;

    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    const userData = {
        uid: user.uid,
        email: email,
        role: isCoach ? 'coach' : 'member',
        status: isCoach ? 'pending_coach' : 'active',
        organizationId: organizationId,
        firstName: additionalData?.firstName || '',
        lastName: additionalData?.lastName || '',
        age: additionalData?.age || null,
        birthDate: additionalData?.birthDate || null,
        gender: additionalData?.gender || 'prefer_not_to_say',
        isTrainingMember: !isCoach,
        createdAt: serverTimestamp(),
        termsAcceptedAt: Date.now() 
    };
    
    await setDoc(doc(db, 'users', user.uid), userData);
    return user;
};

import { calculate1RM } from '../utils/workoutUtils';

export const saveWorkoutLog = async (logData: any): Promise<{ log: any, newRecords: { exerciseName: string, weight: number, diff: number, reps?: number, calculated1RM?: number }[] }> => {
    if (isOffline || !db || !logData.organizationId) {
        return { log: logData, newRecords: [] };
    }
    
    const newLogRef = doc(collection(db, 'workoutLogs'));
    const newLog = { id: newLogRef.id, ...logData };
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
                
                if (exResult.setDetails) {
                    exResult.setDetails.forEach((s: any) => {
                        const w = parseFloat(s.weight);
                        const r = parseFloat(s.reps);
                        if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0 && r <= 10) {
                            const oneRm = calculate1RM(w, r);
                            if (oneRm && (!bestSet || oneRm > bestSet.oneRm)) {
                                bestSet = { weight: w, reps: r, oneRm };
                            }
                        }
                    });
                } else if (exResult.weight && exResult.reps) {
                    const w = parseFloat(exResult.weight);
                    const r = parseFloat(exResult.reps);
                    if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0 && r <= 10) {
                        const oneRm = calculate1RM(w, r);
                        if (oneRm) {
                            bestSet = { weight: w, reps: r, oneRm };
                        }
                    }
                }

                if (bestSet && exResult.exerciseName) {
                    const pbId = getPBId(exResult.exerciseName);
                    // Fallback to weight if calculated1RM is missing for older records
                    const existingPBOneRm = currentPBs[pbId]?.calculated1RM || currentPBs[pbId]?.weight || 0; 

                    if (bestSet.oneRm > existingPBOneRm) {
                        const pbData: PersonalBest = { 
                            id: pbId, 
                            exerciseName: exResult.exerciseName.trim(), 
                            weight: bestSet.weight, 
                            reps: bestSet.reps,
                            calculated1RM: bestSet.oneRm,
                            date: Date.now() 
                        };
                        batch.set(doc(db, 'users', logData.memberId, 'personalBests', pbId), pbData);
                        
                        newRecords.push({
                            exerciseName: exResult.exerciseName.trim(),
                            weight: bestSet.weight, // Keep actual weight for UI
                            reps: bestSet.reps,
                            calculated1RM: bestSet.oneRm,
                            diff: parseFloat((bestSet.oneRm - existingPBOneRm).toFixed(2))
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
                    timestamp: Date.now(),
                    data: { 
                        memberId: logData.memberId,
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

export const getLeaderboardData = async (orgId: string): Promise<{ memberId: string, name: string, photoUrl: string, count: number, pbs: number }[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        // Get start of current week (Monday)
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const q = query(
            collection(db, 'workoutLogs'), 
            where("organizationId", "==", orgId),
            where("date", ">=", startOfWeek.getTime())
        );
        
        const snap = await getDocs(q);
        const logs = snap.docs.map(d => d.data() as WorkoutLog).filter(log => log.showOnLeaderboard !== false);
        
        // Aggregate by memberId
        const memberStats: Record<string, { count: number, pbs: number, name: string, photoUrl: string }> = {};
        
        logs.forEach(log => {
            if (!memberStats[log.memberId]) {
                memberStats[log.memberId] = { count: 0, pbs: 0, name: log.memberName || 'Okänd', photoUrl: log.memberPhotoUrl || '' };
            }
            memberStats[log.memberId].count += 1;
            if (log.newPBs && log.newPBs.length > 0) {
                memberStats[log.memberId].pbs += log.newPBs.length;
            }
        });

        // Convert to array and sort by count
        return Object.entries(memberStats)
            .map(([memberId, stats]) => ({ memberId, ...stats }))
            .sort((a, b) => b.count - a.count);

    } catch (e) {
        console.error("getLeaderboardData failed", e);
        return [];
    }
};

export const listenToLeaderboardData = (orgId: string, onUpdate: (data: { memberId: string, name: string, photoUrl: string, count: number, pbs: number }[]) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate([]);
        return () => {};
    }
    
    // Get start of current week (Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const q = query(
        collection(db, 'workoutLogs'), 
        where("organizationId", "==", orgId),
        where("date", ">=", startOfWeek.getTime())
    );
    
    return onSnapshot(q, (snap) => {
        const logs = snap.docs.map(d => d.data() as WorkoutLog).filter(log => log.showOnLeaderboard !== false);
        
        // Aggregate by memberId
        const memberStats: Record<string, { count: number, pbs: number, name: string, photoUrl: string }> = {};
        
        logs.forEach(log => {
            if (!memberStats[log.memberId]) {
                memberStats[log.memberId] = { count: 0, pbs: 0, name: log.memberName || 'Okänd', photoUrl: log.memberPhotoUrl || '' };
            }
            memberStats[log.memberId].count += 1;
            if (log.newPBs && log.newPBs.length > 0) {
                memberStats[log.memberId].pbs += log.newPBs.length;
            }
        });

        // Convert to array and sort by count
        const data = Object.entries(memberStats)
            .map(([memberId, stats]) => ({ memberId, ...stats }))
            .sort((a, b) => b.count - a.count);
            
        onUpdate(data);
    }, (error) => {
        console.error("listenToLeaderboardData failed", error);
    });
};

export const listenToMemberLogs = (memberId: string, onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db || !memberId) {
        onUpdate([]);
        return () => {};
    }
    const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"), limit(50));
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
        const logs = snap.docs.map(d => d.data() as WorkoutLog).filter(log => log.showOnLeaderboard !== false);
        onUpdate(logs);
    }, (err) => console.error("listenToCommunityLogs failed", err));
};

export const getMemberLogs = async (memberId: string): Promise<WorkoutLog[]> => {
    if (isOffline || !db || !memberId) return []; 
    try {
        const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"), limit(50));
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

export const listenForStudioEvents = (orgId: string, callback: (event: StudioEvent) => void) => {
    if (isOffline || !db || !orgId) return () => {};
    
    // VIKTIGT: Vi tar bort 'where timestamp > ...' från databasfrågan eftersom det kräver 
    // ett sammansatt index som kan krångla. Istället hämtar vi de 20 SENASTE händelserna
    // och filtrerar bort gamla events (äldre än 5 min) här i koden istället.
    // Detta gör lyssnaren mycket snabbare och mer pålitlig.

    const q = query(
        collection(db, 'studio_events'), 
        where('organizationId', '==', orgId), 
        orderBy('timestamp', 'desc'), // Hämta nyaste först
        limit(20)
    );

    return onSnapshot(q, (snapshot) => {
        // Eftersom vi sorterar 'desc' (nyast först), kommer snapshot.docChanges() 
        // leverera de nyaste eventen. Vi itererar igenom dem.
        
        // Vi samlar upp ändringarna och reverserar dem så att om vi får en batch 
        // (t.ex. vid start), så processar vi dem i kronologisk ordning (äldst till nyast)
        // för att kön ska kännas naturlig om flera kom in precis samtidigt.
        const changes = snapshot.docChanges();
        
        // Loopa baklänges eller reversera för att hantera ordningen om det behövs, 
        // men för realtidshändelser kommer de en och en.
        changes.forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data() as StudioEvent;
                
                // CLIENT-SIDE FILTERING:
                // Är eventet skapat för mer än 10 minuter sedan? Ignorera det.
                // Vi har en striktare spärr i PBOverlay (5 min), men detta sparar prestanda.
                const timeDiff = Date.now() - data.timestamp;
                if (timeDiff < 10 * 60 * 1000) { 
                    callback(data);
                }
            }
        });
    });
};

export const listenToWeeklyPBs = (orgId: string, onUpdate: (events: StudioEvent[]) => void) => {
    if (isOffline || !db || !orgId) { onUpdate([]); return () => {}; }
    
    // Vi tar bort tidsbegränsningen för att visa de senaste 20 rekorden oavsett när de sattes.
    // Vi filtrerar på 'type' i minnet för att undvika index-fel i Firestore.
    const q = query(
        collection(db, 'studio_events'), 
        where('organizationId', '==', orgId), 
        orderBy('timestamp', 'desc'), 
        limit(50)
    );
    return onSnapshot(q, (snap) => {
        const allEvents = snap.docs.map(d => d.data() as StudioEvent);
        const pbEvents = allEvents.filter(e => e.type === 'pb' || e.type === 'pb_batch');
        onUpdate(pbEvents.slice(0, 20));
    }, (error) => {
        console.error("Error listening to weekly PBs:", error);
    });
};

export const getOrganizations = async (): Promise<Organization[]> => {
    if (isOffline || !db) return MOCK_ORGANIZATIONS;
    try {
        const snap = await getDocs(collection(db, 'organizations'));
        return snap.docs.map(d => {
            const data = { id: d.id, ...d.data() } as Organization;
            if (!data.studios) data.studios = [];
            return data;
        });
    } catch (e) { return []; }
};

export const getOrganizationById = async (id: string): Promise<Organization | null> => {
    if (isOffline || !db || !id) return MOCK_ORGANIZATIONS.find(o => o.id === id) || null;
    try {
        const snap = await getDoc(doc(db, 'organizations', id));
        if (!snap.exists()) return null;
        const data = { id: snap.id, ...snap.data() } as Organization;
        if (!data.studios) data.studios = [];
        return data;
    } catch (e) { return null; }
};

export const listenToOrganizationChanges = (id: string, onUpdate: (org: Organization) => void) => {
    if (isOffline || !db || !id) return () => {}; 
    return onSnapshot(doc(db, 'organizations', id), (snap) => {
        if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as Organization;
            if (!data.studios) data.studios = [];
            onUpdate(data);
        }
    }, (err) => console.error("listenToOrganizationChanges failed", err));
};

// NYTT: Funktion för att uppdatera remote-state för en studio
export const updateStudioRemoteState = async (orgId: string, studioId: string, state: RemoteSessionState | null) => {
    if (isOffline || !db || !orgId || !studioId) return;
    try {
        const orgRef = doc(db, 'organizations', orgId);
        await runTransaction(db, async (transaction) => {
            const orgSnap = await transaction.get(orgRef);
            if (!orgSnap.exists()) {
                throw new Error("Organization does not exist!");
            }
            
            const orgData = orgSnap.data() as Organization;
            const updatedStudios = orgData.studios.map(studio => {
                if (studio.id === studioId) {
                    if (state === null) {
                        const { remoteState, ...rest } = studio;
                        return rest;
                    }
                    return { 
                        ...studio, 
                        remoteState: {
                            ...(studio.remoteState || {}),
                            ...state
                        } 
                    };
                }
                return studio;
            });
            
            transaction.update(orgRef, { studios: updatedStudios });
        });
    } catch (e) {
        console.error("Failed to update remote state:", e);
    }
};

export const createOrganization = async (name: string, subdomain: string): Promise<Organization> => {
    if(isOffline || !db) throw new Error("Offline");
    const id = `org_${subdomain}_${Date.now()}`;
    const newOrg: Organization = { 
        id, name, subdomain, passwords: { coach: '1234' }, studios: [], customPages: [], status: 'active',
        inviteCode: generateInviteCode(),
        globalConfig: { customCategories: [{ id: '1', name: 'Standard', prompt: '' }] } 
    };
    await setDoc(doc(db, 'organizations', id), newOrg);
    return newOrg;
};

// ... (updateOrganization functions)
export const updateOrganizationName = async (id: string, name: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { name });
    return getOrganizationById(id);
};

export const updateOrganization = async (id: string, name: string, subdomain: string, inviteCode?: string, coachCode?: string, maxFreeCoaches?: number) => {
    if(isOffline || !db || !id) return;
    const updateData: any = { name, subdomain };
    if (inviteCode) updateData.inviteCode = inviteCode.toUpperCase();
    if (coachCode) updateData.coachCode = coachCode.toUpperCase();
    if (maxFreeCoaches !== undefined) updateData.maxFreeCoaches = maxFreeCoaches;
    await updateDoc(doc(db, 'organizations', id), updateData);
    return getOrganizationById(id);
};

export const updateOrganizationPasswords = async (id: string, passwords: Organization['passwords']) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { passwords });
    return getOrganizationById(id);
};

export const updateOrganizationLogos = async (id: string, logos: { light: string; dark: string }) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { logoUrlLight: logos.light, logoUrlDark: logos.dark });
    return getOrganizationById(id);
};

export const updateOrganizationFavicon = async (id: string, faviconUrl: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { faviconUrl });
    return getOrganizationById(id);
};

export const updateOrganizationPrimaryColor = async (id: string, color: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { primaryColor: color });
    return getOrganizationById(id);
};

export const updateOrganizationCustomPages = async (id: string, customPages: CustomPage[]) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { customPages: sanitizeData(customPages) });
    return getOrganizationById(id);
};

export const updateOrganizationInfoCarousel = async (id: string, infoCarousel: InfoCarousel) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { infoCarousel: sanitizeData(infoCarousel) });
    return getOrganizationById(id);
};

export const updateOrganizationCompanyDetails = async (id: string, details: CompanyDetails) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { companyDetails: sanitizeData(details) });
    return getOrganizationById(id);
};

export const updateOrganizationDiscount = async (id: string, discount: { type: 'percentage' | 'fixed', value: number }) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { discountType: discount.type, discountValue: discount.value });
    return getOrganizationById(id);
};

export const updateOrganizationFreeCoaches = async (id: string, count: number) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { freeCoachAccounts: count });
    return getOrganizationById(id);
};

export const undoLastBilling = async (id: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { lastBilledMonth: deleteField(), lastBilledDate: deleteField() });
    return getOrganizationById(id);
};

export const updateGlobalConfig = async (id: string, config: any) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { globalConfig: sanitizeData(config) });
};

export const updateOrganizationBenchmarks = async (id: string, benchmarks: BenchmarkDefinition[]) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { benchmarkDefinitions: sanitizeData(benchmarks) });
    return getOrganizationById(id);
};

export const createStudio = async (orgId: string, name: string) => {
    if(isOffline || !db || !orgId) return { id: 'off', name };
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studio = { id: `st_${Date.now()}`, name, createdAt: Date.now(), configOverrides: {} };
    await updateDoc(doc(db, 'organizations', orgId), { studios: [...org.studios, studio] });
    return studio;
};

export const updateStudio = async (orgId: string, studioId: string, name: string) => {
    if(isOffline || !db || !orgId) return;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, name } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
};

export const deleteStudio = async (orgId: string, studioId: string) => {
    if(isOffline || !db || !orgId) return;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studios = org.studios.filter(s => s.id !== studioId);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
};

export const updateStudioConfig = async (orgId: string, studioId: string, overrides: any) => {
    if(isOffline || !db || !orgId) return {} as Studio;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, configOverrides: sanitizeData(overrides) } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
    return studios.find(s => s.id === studioId) as Studio;
};

export const getFreshCategoryWorkouts = async (orgId: string, category: string): Promise<Workout[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(
          collection(db, 'workouts'), 
          where("category", "==", category),
          where("isPublished", "==", true),
          where("isMemberDraft", "==", false)
        );
        const snap = await getDocsFromServer(q);
        
        return snap.docs
            .map(d => {
                const data = d.data() as Workout;
                if (!data.blocks) data.blocks = [];
                else {
                    data.blocks = data.blocks.map(block => ({
                        ...block,
                        exercises: block.exercises || []
                    }));
                }
                return data;
            })
            .filter(w => w.organizationId === orgId || w.organizationId === "" || w.organizationId === null);
    } catch (error) {
        console.error("Error fetching fresh category workouts:", error);
        return [];
    }
};

export const getWorkoutsForOrganization = async (orgId: string): Promise<Workout[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(
          collection(db, 'workouts'), 
          or(
            where("organizationId", "==", orgId),
            where("organizationId", "==", ""),
            where("organizationId", "==", null)
          )
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data() as Workout;
            if (!data.blocks) {
                data.blocks = [];
            } else {
                data.blocks = data.blocks.map(block => ({
                    ...block,
                    exercises: block.exercises || []
                }));
            }
            return data;
        }).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (e) { 
        console.error("getWorkoutsForOrganization failed", e);
        return []; 
    }
};

export const subscribeToWorkoutsForOrganization = (orgId: string, onUpdate: (workouts: Workout[]) => void, onError: (error: Error) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate([]);
        return () => {};
    }
    
    const q = query(
      collection(db, 'workouts'), 
      or(
        where("organizationId", "==", orgId),
        where("organizationId", "==", ""),
        where("organizationId", "==", null)
      )
    );

    return onSnapshot(q, (snap) => {
        const workouts = snap.docs.map(d => {
            const data = d.data() as Workout;
            if (!data.blocks) {
                data.blocks = [];
            } else {
                data.blocks = data.blocks.map(block => ({
                    ...block,
                    exercises: block.exercises || []
                }));
            }
            return data;
        }).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
        onUpdate(workouts);
    }, (error) => {
        console.error("subscribeToWorkoutsForOrganization failed", error);
        onError(error);
    });
};

export const getWorkoutById = async (id: string): Promise<Workout | null> => {
    if (isOffline || !db || !id) return null;
    try {
        const snap = await getDoc(doc(db, 'workouts', id));
        if (!snap.exists()) return null;
        const data = snap.data() as Workout;
        if (!data.blocks) {
            data.blocks = [];
        } else {
            data.blocks = data.blocks.map(block => ({
                ...block,
                exercises: block.exercises || []
            }));
        }
        return data;
    } catch (e) {
        console.error("getWorkoutById failed", e);
        return null;
    }
};

export const saveWorkout = async (w: Workout) => {
    if (isOffline || !db || !w.id) return;
    try {
        await setDoc(doc(db, 'workouts', w.id), sanitizeData(w), { merge: true });
    } catch (e) { console.error("saveWorkout failed", e); }
};

export const deleteWorkout = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        await deleteDoc(doc(db, 'workouts', id));
    } catch (e) { console.error("deleteWorkout failed", e); }
};

export const getExerciseBank = async (): Promise<BankExercise[]> => {
    if (isOffline || !db) return MOCK_EXERCISE_BANK;
    try {
        const snap = await getDocs(query(collection(db, 'exerciseBank'), orderBy('name')));
        return snap.docs.map(d => d.data() as BankExercise);
    } catch (e) { return MOCK_EXERCISE_BANK; }
};

export const getOrganizationExerciseBank = async (orgId: string): Promise<BankExercise[]> => {
    if (isOffline || !db || !orgId) return MOCK_EXERCISE_BANK;
    try {
        // 1. Fetch Global Bank
        const globalSnap = await getDocs(query(collection(db, 'exerciseBank'), orderBy('name')));
        const globalBank = globalSnap.docs.map(d => d.data() as BankExercise);

        // 2. Fetch Custom Bank
        const customQ = query(collection(db, 'custom_exercises'), where('organizationId', '==', orgId));
        const customSnap = await getDocs(customQ);
        const customBank = customSnap.docs.map(d => d.data() as BankExercise);

        return [...globalBank, ...customBank].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    } catch (e) { return MOCK_EXERCISE_BANK; }
};

// Resolver Function (The logic engine)
export const resolveAndCreateExercises = async (orgId: string, workout: Workout, createMissing: boolean = false): Promise<Workout> => {
    if (isOffline || !db) return workout; // Safety

    // 1. Get combined banks
    const combinedBank = await getOrganizationExerciseBank(orgId);
    const bankMap = new Map(combinedBank.map(b => [b.id, b])); // Create Map for O(1) lookup
    const newlyCreatedCache: Record<string, BankExercise> = {};

    // 2. Helper for matching
    const findMatch = (name: string) => {
        const nName = normalizeString(name);
        
        // Try exact normalized match first
        let match = combinedBank.find(b => normalizeString(b.name) === nName);
        if(match) return match;

        // Try "contains" match (reversed)
        match = combinedBank.find(b => normalizeString(b.name).includes(nName));
        
        if (!match) {
             match = combinedBank.find(b => nName.includes(normalizeString(b.name)));
        }

        return match;
    };

    // 3. Process blocks
    const resolvedBlocks = await Promise.all(workout.blocks.map(async (block) => {
        const resolvedExercises = await Promise.all(block.exercises.map(async (ex) => {
            // Case 1: It claims to be from the bank
            if (ex.isFromBank) {
                // If it claims to be from bank, we MUST verify the ID exists.
                // If it doesn't exist (deleted), we downgrade it to ad-hoc.
                if (bankMap.has(ex.id)) {
                    // Valid link. Optionally sync details? 
                    const bankEx = bankMap.get(ex.id);
                    return {
                        ...ex,
                        imageUrl: bankEx?.imageUrl || ex.imageUrl, // Sync image
                        description: bankEx?.description || ex.description, // Optional: Sync desc
                        // Keep the existing loggingEnabled state, or default to false if undefined
                        loggingEnabled: ex.loggingEnabled !== undefined ? ex.loggingEnabled : false
                    };
                } else {
                    // INVALID LINK (Deleted from bank). Downgrade to Ad-hoc.
                    return {
                        ...ex,
                        isFromBank: false,
                        loggingEnabled: false,
                        // Keep existing name/reps/desc as they are in the workout
                    };
                }
            }

            // Case 2: Ad-hoc (Try to match by name or create new)
            const match = findMatch(ex.name);

            if (match) {
                return {
                    ...ex,
                    id: match.id, // THE MAGIC: Link to Master ID
                    originalBankId: match.id, // Helper for history tracking
                    description: ex.description || match.description, 
                    imageUrl: match.imageUrl || ex.imageUrl,
                    isFromBank: true,
                    loggingEnabled: ex.loggingEnabled !== undefined ? ex.loggingEnabled : false
                };
            }

            // If no match found, and we are NOT allowed to create missing exercises (e.g. Ad-hoc/AI)
            // Just return the exercise as-is but ensure logging is disabled to keep data clean
            if (!createMissing) {
                return {
                    ...ex,
                    isFromBank: false,
                    loggingEnabled: false
                };
            }

            // Check cache for duplicates in same workout session
            const nName = normalizeString(ex.name);
            if (newlyCreatedCache[nName]) {
                const cached = newlyCreatedCache[nName];
                return { 
                    ...ex, 
                    id: cached.id, 
                    originalBankId: cached.id,
                    isFromBank: true, 
                    loggingEnabled: ex.loggingEnabled !== undefined ? ex.loggingEnabled : false
                };
            }

            // Create new Custom Exercise
            const newId = `custom_${orgId}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
            const newBankEx: BankExercise = {
                id: newId,
                name: ex.name, // Use the provided name
                description: ex.description || '',
                tags: [], 
                organizationId: orgId
            };

            // Add to Firestore
            await setDoc(doc(db, 'custom_exercises', newId), newBankEx);

            // Add to cache
            newlyCreatedCache[nName] = newBankEx;
            
            return {
                ...ex,
                id: newId,
                originalBankId: newId,
                isFromBank: true,
                loggingEnabled: ex.loggingEnabled !== undefined ? ex.loggingEnabled : false
            };
        }));

        return { ...block, exercises: resolvedExercises };
    }));

    return { ...workout, blocks: resolvedBlocks };
};

export const saveExerciseToBank = async (ex: BankExercise) => {
    if (isOffline || !db || !ex.id) return;
    try {
        // Om övningen har ett organizationId eller ID:t börjar på 'custom_', spara i custom_exercises
        const collectionName = ex.organizationId || ex.id.startsWith('custom_') 
            ? 'custom_exercises' 
            : 'exerciseBank';
            
        await setDoc(doc(db, collectionName, ex.id), sanitizeData(ex), { merge: true });
    } catch (e) { console.error("saveExerciseToBank failed", e); }
};

export const deleteExerciseFromBank = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        // Check if it's a custom exercise based on ID prefix
        const collectionName = id.startsWith('custom_') ? 'custom_exercises' : 'exerciseBank';
        await deleteDoc(doc(db, collectionName, id));
    } catch (e) { console.error("deleteExerciseFromBank failed", e); }
};

export const mergeExercises = async (sourceId: string, targetId: string) => {
    if (isOffline || !db) return;
    try {
        let targetEx: BankExercise | null = null;
        let sourceEx: BankExercise | null = null;
        
        const globalTargetSnap = await getDoc(doc(db, 'exerciseBank', targetId));
        if (globalTargetSnap.exists()) targetEx = globalTargetSnap.data() as BankExercise;
        else {
            const customTargetSnap = await getDoc(doc(db, 'custom_exercises', targetId));
            if (customTargetSnap.exists()) targetEx = customTargetSnap.data() as BankExercise;
        }

        const globalSourceSnap = await getDoc(doc(db, 'exerciseBank', sourceId));
        if (globalSourceSnap.exists()) sourceEx = globalSourceSnap.data() as BankExercise;
        else {
            const customSourceSnap = await getDoc(doc(db, 'custom_exercises', sourceId));
            if (customSourceSnap.exists()) sourceEx = customSourceSnap.data() as BankExercise;
        }

        if (!targetEx || !sourceEx) {
            throw new Error("Kunde inte hitta båda övningarna för sammanslagning.");
        }

        // Hitta alla pass som använder source-övningen
        const workoutsSnap = await getDocs(collection(db, 'workouts'));
        const batch = writeBatch(db);
        let updateCount = 0;

        workoutsSnap.forEach(docSnap => {
            const workout = docSnap.data() as Workout;
            let modified = false;

            if (workout.blocks) {
                workout.blocks.forEach(block => {
                    if (block.exercises) {
                        block.exercises.forEach(ex => {
                            if (ex.id === sourceId || ex.name === sourceEx!.name) {
                                ex.id = targetId;
                                ex.name = targetEx!.name;
                                ex.isFromBank = true;
                                modified = true;
                            }
                        });
                    }
                });
            }

            if (modified) {
                batch.update(docSnap.ref, { blocks: workout.blocks });
                updateCount++;
            }
        });

        if (updateCount > 0) {
            await batch.commit();
            console.log(`Uppdaterade ${updateCount} pass.`);
        }

        // Ta bort source-övningen
        await deleteExerciseFromBank(sourceId);

    } catch (e) {
        console.error("mergeExercises failed", e);
        throw e;
    }
};

export const updateExerciseImageOverride = async (orgId: string, exerciseId: string, imageUrl: string | null) => {
    if (isOffline || !db || !orgId) return;
    try {
        const orgRef = doc(db, 'organizations', orgId);
        if (imageUrl) {
            await updateDoc(orgRef, { [`exerciseOverrides.${exerciseId}`]: { imageUrl } });
        } else {
            await updateDoc(orgRef, { [`exerciseOverrides.${exerciseId}`]: deleteField() });
        }
        return getOrganizationById(orgId);
    } catch (e) { console.error("updateExerciseImageOverride failed", e); }
};

// ... (Rest of the file remains same: billing, images, hyrox, checkins etc.)
export const getSmartScreenPricing = async () => {
    if (isOffline || !db) return MOCK_SMART_SCREEN_PRICING;
    try {
        const snap = await getDoc(doc(db, 'system', 'pricing'));
        return snap.exists() ? snap.data() as SmartScreenPricing : MOCK_SMART_SCREEN_PRICING;
    } catch (e) { return MOCK_SMART_SCREEN_PRICING; }
};

export const updateSmartScreenPricing = async (pricing: SmartScreenPricing) => {
    if (isOffline || !db) return;
    try {
        await setDoc(doc(db, 'system', 'pricing'), sanitizeData(pricing));
    } catch (e) { console.error("updateSmartScreenPricing failed", e); }
};

export const updateOrganizationBilledStatus = async (id: string, month: string) => {
    if(isOffline || !db || !id) return;
    try {
        await updateDoc(doc(db, 'organizations', id), { lastBilledMonth: month, lastBilledDate: Date.now() });
        return getOrganizationById(id);
    } catch (e) { console.error("updateOrganizationBilledStatus failed", e); }
};

export const uploadImage = async (path: string, image: File | string): Promise<string> => {
    if (typeof image === 'string' && !image.startsWith('data:image')) return image;
    if (isOffline || !storage) return "";
    try {
        const blob = typeof image === 'string' ? await (await fetch(image)).blob() : image;
        const snap = await uploadBytes(ref(storage, path), blob);
        return getDownloadURL(snap.ref);
    } catch (e) { console.error("uploadImage failed", e); return ""; }
};

export const deleteImageByUrl = async (url: string): Promise<void> => {
    if (isOffline || !storage || !url || !url.includes('firebasestorage')) return;
    try { await deleteObject(ref(storage, url)); } catch (e) {}
};

export const getSeasonalThemes = async () => {
    if (isOffline || !db) return [];
    try {
        const snap = await getDoc(doc(db, 'system', 'seasonalThemes'));
        return snap.exists() ? (snap.data() as any).themes : [];
    } catch (e) { return []; }
};

export const updateSeasonalThemes = async (themes: SeasonalThemeSetting[]) => {
    if (isOffline || !db) return;
    try {
        await setDoc(doc(db, 'system', 'seasonalThemes'), { themes: sanitizeData(themes) }, { merge: true });
    } catch (e) { console.error("updateSeasonalThemes failed", e); }
};

export const archiveOrganization = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        await updateDoc(doc(db, 'organizations', id), { status: 'archived' });
    } catch (e) { console.error("archiveOrganization failed", e); }
};

export const restoreOrganization = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        await updateDoc(doc(db, 'organizations', id), { status: 'active' });
    } catch (e) { console.error("restoreOrganization failed", e); }
};

export const deleteOrganizationPermanently = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        await deleteDoc(doc(db, 'organizations', id));
    } catch (e) { console.error("deleteOrganizationPermanently failed", e); }
};

export const updateOrganizationActivity = async (id: string): Promise<void> => {
    if (isOffline || !db || !id) return;
    try { await updateDoc(doc(db, 'organizations', id), { lastActiveAt: Date.now() }); } catch(e){}
};

export const saveRace = async (data: any, orgId: string) => {
    if(isOffline || !db || !orgId) return { id: 'off' };
    try {
        let raceRef;
        if (data.id && !data.id.startsWith('race-')) { // If it's a real firebase ID
             raceRef = doc(db, 'races', data.id);
        } else if (data.id && data.id.startsWith('race-')) {
             // It's a temporary ID generated by the client, we should create a new doc but maybe keep the ID?
             // Actually, doc(collection(db, 'races')) generates a random ID. Let's just use the provided ID if it exists.
             raceRef = doc(db, 'races', data.id);
        } else {
             raceRef = doc(collection(db, 'races'));
        }
        
        const race = { ...sanitizeData(data), id: raceRef.id, organizationId: orgId };
        if (!race.createdAt) race.createdAt = Date.now();
        
        await setDoc(raceRef, race, { merge: true });
        return race;
    } catch (e) { console.error("saveRace failed", e); throw e; }
};

export const deleteRace = async (raceId: string) => {
    if (isOffline || !db || !raceId) return;
    try {
        await deleteDoc(doc(db, 'races', raceId));
    } catch (e) {
        console.error("deleteRace failed", e);
        throw e;
    }
};

export const getPastRaces = async (orgId: string) => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(collection(db, 'races'), where("organizationId", "==", orgId));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as HyroxRace).sort((a,b) => b.createdAt - a.createdAt);
    } catch (e) { return []; }
};

export const getRace = async (id: string) => {
    if (isOffline || !db || !id) return null;
    try {
        const snap = await getDoc(doc(db, 'races', id));
        return snap.exists() ? snap.data() as HyroxRace : null;
    } catch (e) { return null; }
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

export const sendCheckIn = async (orgId: string, userEmail: string) => {
    if (isOffline || !db || !orgId) return;
    try {
        const checkInRef = doc(collection(db, 'active_checkins'));
        const event: CheckInEvent = {
            id: checkInRef.id,
            userId: userEmail,
            firstName: userEmail.split('@')[0],
            lastName: '',
            timestamp: Date.now(),
            organizationId: orgId,
            streak: Math.floor(Math.random() * 20) + 1
        };
        await setDoc(checkInRef, event);
    } catch (e) { console.error("sendCheckIn failed", e); }
};

export const listenForCheckIns = (orgId: string, callback: (event: CheckInEvent) => void) => {
    if (isOffline || !db || !orgId) return () => {};
    const q = query(collection(db, 'active_checkins'), where('organizationId', '==', orgId), orderBy('timestamp', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data() as CheckInEvent;
                if (Date.now() - data.timestamp < 10000) callback(data);
            }
        });
    }, (err) => console.error("listenForCheckIns failed", err));
};

export const getSuggestedExercises = async () => {
    if (isOffline || !db) return [];
    try {
        const snap = await getDocs(collection(db, 'exerciseSuggestions'));
        return snap.docs.map(d => ({ ...d.data(), id: d.id }) as SuggestedExercise);
    } catch (e) { return []; }
};

export const approveExerciseSuggestion = async (s: SuggestedExercise) => {
    try {
        const bankEx: BankExercise = { id: s.id, name: s.name, description: s.description, imageUrl: s.imageUrl, tags: s.tags };
        await saveExerciseToBank(bankEx);
        await deleteExerciseSuggestion(s.id);
    } catch (e) { console.error("approveExerciseSuggestion failed", e); }
};

export const deleteExerciseSuggestion = async (id: string) => {
    if (isOffline || !db) return;
    try {
        await deleteDoc(doc(db, 'exerciseSuggestions', id));
    } catch (e) { console.error("deleteExerciseSuggestion failed", e); }
};

export const updateExerciseSuggestion = async (s: SuggestedExercise) => {
    if (isOffline || !db) return;
    try {
        await setDoc(doc(db, 'exerciseSuggestions', s.id), s, { merge: true });
    } catch (e) { console.error("updateExerciseSuggestion failed", e); }
};
