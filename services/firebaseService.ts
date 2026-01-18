
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
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  writeBatch, 
  deleteField,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  FirebaseStorage 
} from 'firebase/storage';

import { firebaseConfig } from './firebaseConfig';
import { 
  Studio, StudioConfig, Organization, UserData, Workout, InfoCarousel, 
  BankExercise, SuggestedExercise, WorkoutResult, CompanyDetails, 
  SmartScreenPricing, HyroxRace, SeasonalThemeSetting, MemberGoals, 
  WorkoutLog, CheckInEvent, Member, UserRole, PersonalBest, StudioEvent,
  CustomPage
} from '../types';
import { MOCK_ORGANIZATIONS, MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN, MOCK_EXERCISE_BANK, MOCK_MEMBERS, MOCK_SMART_SCREEN_PRICING } from '../data/mockData';

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

if (!isOffline) {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
    } catch (error) {
        console.error("CRITICAL: Firebase init failed.", error);
    }
}

// --- HJÄLPMETODER ---

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

// --- AUTHENTICERING ---

export const onAuthChange = (callback: (user: User | null) => void) => {
    if (isOffline || !auth) return () => {}; 
    return onAuthStateChanged(auth, callback);
};

export const signIn = (email: string, password: string): Promise<User> => {
    if (isOffline || !auth) return Promise.reject("Offline");
    return signInWithEmailAndPassword(auth, email, password).then(c => c.user);
};

export const signInAsStudio = (): Promise<User> => {
    if (isOffline || !auth) return Promise.resolve({ uid: 'offline_studio_uid', isAnonymous: true } as User);
    return signInAnonymously(auth).then(c => c.user);
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
    await updateDoc(doc(db, 'users', uid), { termsAcceptedAt: Date.now() });
};

// --- PEOPLE HUB (MEDLEMSHANTERING) ---

export const getMembers = async (orgId: string): Promise<Member[]> => {
    if (isOffline || !db || !orgId) return MOCK_MEMBERS;
    const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), uid: d.id, id: d.id }) as Member);
};

export const getAdminsForOrganization = async (orgId: string): Promise<UserData[]> => {
    if (isOffline || !db || !orgId) return [MOCK_ORG_ADMIN];
    const q = query(collection(db, 'users'), where('organizationId', '==', orgId), where('role', '==', 'organizationadmin'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserData);
};

export const getCoachesForOrganization = async (orgId: string): Promise<UserData[]> => {
    if (isOffline || !db || !orgId) return [];
    const q = query(collection(db, 'users'), where('organizationId', '==', orgId), where('role', '==', 'coach'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserData);
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
    });
};

export const updateUserGoals = async (uid: string, goals: MemberGoals) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), { goals: sanitizeData(goals) });
};

export const updateUserProfile = async (uid: string, data: Partial<UserData>) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), sanitizeData(data));
};

export const updateUserRole = async (uid: string, role: UserRole) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), { role });
};

export const updateMemberEndDate = async (uid: string, date: string | null) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), { endDate: date });
};

export const registerMemberWithCode = async (email: string, pass: string, code: string, additionalData?: any) => {
    if (isOffline || !db || !auth) throw new Error("Offline mode");

    const q = query(collection(db, 'organizations'), where('inviteCode', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Ogiltig inbjudningskod.");
    const organizationId = snap.docs[0].id;

    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    const userData = {
        uid: user.uid,
        email: email,
        role: 'member',
        status: 'active',
        organizationId: organizationId,
        firstName: additionalData?.firstName || '',
        lastName: additionalData?.lastName || '',
        age: additionalData?.age || null,
        gender: additionalData?.gender || 'prefer_not_to_say',
        isTrainingMember: true,
        createdAt: serverTimestamp(),
        termsAcceptedAt: Date.now() 
    };
    
    await setDoc(doc(db, 'users', user.uid), userData);
    return user;
};

// --- DATA & MOTIVATION ---

/**
 * Saves a workout log and calculates Personal Bests.
 * Returns an array of records that were broken during this session.
 */
export const saveWorkoutLog = async (logData: any): Promise<{ log: any, newRecords: { exerciseName: string, weight: number, diff: number }[] }> => {
    console.log("saveWorkoutLog triggered", logData); // Debug log
    if (isOffline || !db || !logData.organizationId) {
        console.warn("Save aborted: Offline or missing organizationId", logData.organizationId);
        return { log: logData, newRecords: [] };
    }
    
    const newLogRef = doc(collection(db, 'workoutLogs'));
    const newLog = { id: newLogRef.id, ...logData };
    const newRecords: { exerciseName: string; weight: number; diff: number }[] = [];

    // 1. Enrich log with member name/photo for feed
    if (logData.memberId) {
        try {
            const userSnap = await getDoc(doc(db, 'users', logData.memberId));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                newLog.memberName = `${userData.firstName || 'Medlem'} ${userData.lastName ? userData.lastName[0] + '.' : ''}`.trim();
                newLog.memberPhotoUrl = userData.photoUrl || null;
            }
        } catch (e) { console.warn("Failed to fetch user data for log enrichment", e); }
    }

    // 2. Save the log itself
    await setDoc(newLogRef, newLog);
    console.log("Log saved to Firestore with ID:", newLogRef.id);

    // 3. Process Personal Bests
    if (logData.memberId && logData.memberId !== 'offline_member_uid' && logData.exerciseResults) {
        try {
            const batch = writeBatch(db);
            const pbCollectionRef = collection(db, 'users', logData.memberId, 'personalBests');
            const currentPBsSnap = await getDocs(pbCollectionRef);
            const currentPBs: Record<string, any> = {};
            currentPBsSnap.forEach(d => currentPBs[d.id] = d.data());

            for (const exResult of logData.exerciseResults) {
                let maxW = 0;
                if (exResult.setDetails) {
                    const weights = exResult.setDetails.map((s: any) => parseFloat(s.weight)).filter((n: number) => !isNaN(n));
                    if (weights.length > 0) maxW = Math.max(...weights);
                } else if (exResult.weight) {
                    maxW = Number(exResult.weight);
                }

                if (maxW > 0 && exResult.exerciseName) {
                    const pbId = getPBId(exResult.exerciseName);
                    const existingPBWeight = currentPBs[pbId]?.weight || 0;

                    if (pbId && maxW > existingPBWeight) {
                        const pbData: PersonalBest = { 
                            id: pbId, 
                            exerciseName: exResult.exerciseName.trim(), 
                            weight: maxW, 
                            date: Date.now() 
                        };
                        batch.set(doc(db, 'users', logData.memberId, 'personalBests', pbId), pbData);
                        
                        newRecords.push({
                            exerciseName: exResult.exerciseName.trim(),
                            weight: maxW,
                            diff: parseFloat((maxW - existingPBWeight).toFixed(2))
                        });
                    }
                }
            }

            // 4. Emit ONE batched PB event to the studio
            if (newRecords.length > 0) {
                console.log("New records found! Creating studio event...", newRecords);
                const eventRef = doc(collection(db, 'studio_events'));
                const eventData: StudioEvent = {
                    id: eventRef.id,
                    type: 'pb_batch',
                    organizationId: logData.organizationId,
                    timestamp: Date.now(),
                    data: { 
                        userName: newLog.memberName || 'En medlem', 
                        userPhotoUrl: newLog.memberPhotoUrl || null, 
                        records: newRecords
                    }
                };
                batch.set(eventRef, eventData);
            }

            await batch.commit();
            console.log("Firestore batch committed (PBs and events)");
        } catch (e) { console.error("PB logic failed", e); }
    }

    return { log: newLog, newRecords };
};

export const updateWorkoutLog = async (logId: string, updates: Partial<WorkoutLog>) => {
    if (isOffline || !db || !logId) return;
    await updateDoc(doc(db, 'workoutLogs', logId), sanitizeData(updates));
};

export const deleteWorkoutLog = async (logId: string) => {
    if (isOffline || !db || !logId) return;
    await deleteDoc(doc(db, 'workoutLogs', logId));
};

export const listenToMemberLogs = (memberId: string, onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db || !memberId) {
        onUpdate([]);
        return () => {};
    }
    const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => d.data() as WorkoutLog));
    });
};

export const listenToCommunityLogs = (orgId: string, onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate([]);
        return () => {};
    }
    const q = query(collection(db, 'workoutLogs'), where("organizationId", "==", orgId), orderBy("date", "desc"), limit(20));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => d.data() as WorkoutLog));
    });
};

export const getMemberLogs = async (memberId: string): Promise<WorkoutLog[]> => {
    if (isOffline || !db || !memberId) return []; 
    const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WorkoutLog);
};

export const getOrganizationLogs = async (orgId: string, limitCount: number = 100): Promise<WorkoutLog[]> => {
    if (isOffline || !db || !orgId) return [];
    const q = query(collection(db, 'workoutLogs'), where("organizationId", "==", orgId), orderBy("date", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WorkoutLog);
};

export const listenToPersonalBests = (userId: string, onUpdate: (pbs: PersonalBest[]) => void, onError?: (err: any) => void) => {
    if (isOffline || !db || !userId) {
        onUpdate([]);
        return () => {};
    }
    return onSnapshot(collection(db, 'users', userId, 'personalBests'), (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() }) as PersonalBest));
    }, onError);
};

export const updatePersonalBest = async (userId: string, exerciseName: string, weight: number) => {
    if (isOffline || !db || !userId) return;
    const pbId = getPBId(exerciseName);
    await setDoc(doc(db, 'users', userId, 'personalBests', pbId), { id: pbId, exerciseName: exerciseName.trim(), weight, date: Date.now() });
};

// --- STUDIO EVENTS ---

export const listenForStudioEvents = (orgId: string, callback: (event: StudioEvent) => void) => {
    if (isOffline || !db || !orgId) return () => {};
    const startTime = Date.now() - 5000; 
    const q = query(collection(db, 'studio_events'), where('organizationId', '==', orgId), orderBy('timestamp', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data() as StudioEvent;
                if (data.timestamp > startTime) callback(data);
            }
        });
    });
};

export const listenToWeeklyPBs = (orgId: string, onUpdate: (events: StudioEvent[]) => void) => {
    if (isOffline || !db || !orgId) { onUpdate([]); return () => {}; }
    const now = new Date();
    const day = now.getDay() || 7;
    if (day !== 1) now.setDate(now.getDate() - (day - 1));
    now.setHours(0, 0, 0, 0);
    const startOfWeek = now.getTime();

    const q = query(collection(db, 'studio_events'), where('organizationId', '==', orgId), where('type', 'in', ['pb', 'pb_batch']), where('timestamp', '>=', startOfWeek), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snap) => onUpdate(snap.docs.map(d => d.data() as StudioEvent)));
};

// --- CORE BUSINESS ---

export const getOrganizations = async (): Promise<Organization[]> => {
    if (isOffline || !db) return MOCK_ORGANIZATIONS;
    const snap = await getDocs(collection(db, 'organizations'));
    return snap.docs.map(d => d.data() as Organization);
};

export const getOrganizationById = async (id: string): Promise<Organization | null> => {
    if (isOffline || !db || !id) return MOCK_ORGANIZATIONS.find(o => o.id === id) || null;
    const snap = await getDoc(doc(db, 'organizations', id));
    return snap.exists() ? snap.data() as Organization : null;
};

export const listenToOrganizationChanges = (id: string, onUpdate: (org: Organization) => void) => {
    if (isOffline || !db || !id) return () => {}; 
    return onSnapshot(doc(db, 'organizations', id), (snap) => {
        if (snap.exists()) onUpdate(snap.data() as Organization);
    });
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

export const updateOrganization = async (id: string, name: string, subdomain: string, inviteCode?: string) => {
    if(isOffline || !db || !id) return;
    const updateData: any = { name, subdomain };
    if (inviteCode) updateData.inviteCode = inviteCode.toUpperCase();
    await updateDoc(doc(db, 'organizations', id), updateData);
    return getOrganizationById(id);
};

export const updateOrganizationPasswords = async (id: string, passwords: Organization['passwords']) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { passwords });
    return getOrganizationById(id);
};

export const updateOrganizationLogos = async (id: string, logos: { light: string, dark: string }) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { logoUrlLight: logos.light, logoUrlDark: logos.dark });
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

export const undoLastBilling = async (id: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { lastBilledMonth: deleteField(), lastBilledDate: deleteField() });
    return getOrganizationById(id);
};

export const updateGlobalConfig = async (id: string, config: any) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { globalConfig: sanitizeData(config) });
};

export const createStudio = async (orgId: string, name: string) => {
    if(isOffline || !db || !orgId) return { id: 'off', name };
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Org missing");
    const studio = { id: `st_${Date.now()}`, name, createdAt: Date.now(), configOverrides: {} };
    await updateDoc(doc(db, 'organizations', orgId), { studios: [...org.studios, studio] });
    return studio;
};

export const updateStudio = async (orgId: string, studioId: string, name: string) => {
    if(isOffline || !db || !orgId) return;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Org missing");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, name } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
};

export const deleteStudio = async (orgId: string, studioId: string) => {
    if(isOffline || !db || !orgId) return;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Org missing");
    const studios = org.studios.filter(s => s.id !== studioId);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
};

export const updateStudioConfig = async (orgId: string, studioId: string, overrides: any) => {
    if(isOffline || !db || !orgId) return {} as Studio;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Org missing");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, configOverrides: sanitizeData(overrides) } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
    return studios.find(s => s.id === studioId) as Studio;
};

// --- TRÄNINGSMOTORN ---

export const getWorkoutsForOrganization = async (orgId: string): Promise<Workout[]> => {
    if (isOffline || !db || !orgId) return [];
    const q = query(collection(db, 'workouts'), where("organizationId", "==", orgId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Workout).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const saveWorkout = async (w: Workout) => {
    if (isOffline || !db || !w.id) return;
    await setDoc(doc(db, 'workouts', w.id), sanitizeData(w), { merge: true });
};

export const deleteWorkout = async (id: string) => {
    if (isOffline || !db || !id) return;
    await deleteDoc(doc(db, 'workouts', id));
};

export const getExerciseBank = async (): Promise<BankExercise[]> => {
    if (isOffline || !db) return MOCK_EXERCISE_BANK;
    const snap = await getDocs(query(collection(db, 'exerciseBank'), orderBy('name')));
    return snap.docs.map(d => d.data() as BankExercise);
};

export const saveExerciseToBank = async (ex: BankExercise) => {
    if (isOffline || !db || !ex.id) return;
    await setDoc(doc(db, 'exerciseBank', ex.id), sanitizeData(ex), { merge: true });
};

export const deleteExerciseFromBank = async (id: string) => {
    if (isOffline || !db || !id) return;
    await deleteDoc(doc(db, 'exerciseBank', id));
};

export const updateExerciseImageOverride = async (orgId: string, exerciseId: string, imageUrl: string | null) => {
    if (isOffline || !db || !orgId) return;
    const orgRef = doc(db, 'organizations', orgId);
    if (imageUrl) {
        await updateDoc(orgRef, { [`exerciseOverrides.${exerciseId}`]: { imageUrl } });
    } else {
        await updateDoc(orgRef, { [`exerciseOverrides.${exerciseId}`]: deleteField() });
    }
    return getOrganizationById(orgId);
};

// --- BILLING ---

export const getSmartScreenPricing = async () => {
    if (isOffline || !db) return MOCK_SMART_SCREEN_PRICING;
    const snap = await getDoc(doc(db, 'system', 'pricing'));
    return snap.exists() ? snap.data() as SmartScreenPricing : MOCK_SMART_SCREEN_PRICING;
};

export const updateSmartScreenPricing = async (pricing: SmartScreenPricing) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'system', 'pricing'), sanitizeData(pricing));
};

export const updateOrganizationBilledStatus = async (id: string, month: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { lastBilledMonth: month, lastBilledDate: Date.now() });
    return getOrganizationById(id);
};

// --- IMAGES & THEMES ---

export const uploadImage = async (path: string, image: File | string): Promise<string> => {
    if (typeof image === 'string' && !image.startsWith('data:image')) return image;
    if (isOffline || !storage) return "";
    const blob = typeof image === 'string' ? await (await fetch(image)).blob() : image;
    const snap = await uploadBytes(ref(storage, path), blob);
    return getDownloadURL(snap.ref);
};

export const deleteImageByUrl = async (url: string): Promise<void> => {
    if (isOffline || !storage || !url || !url.includes('firebasestorage')) return;
    try { await deleteObject(ref(storage, url)); } catch (e) {}
};

export const getSeasonalThemes = async () => {
    if (isOffline || !db) return [];
    const snap = await getDoc(doc(db, 'system', 'seasonalThemes'));
    return snap.exists() ? (snap.data() as any).themes : [];
};

export const updateSeasonalThemes = async (themes: SeasonalThemeSetting[]) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'system', 'seasonalThemes'), { themes: sanitizeData(themes) }, { merge: true });
};

export const archiveOrganization = async (id: string) => {
    if (isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { status: 'archived' });
};

export const restoreOrganization = async (id: string) => {
    if (isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { status: 'active' });
};

export const deleteOrganizationPermanently = async (id: string) => {
    if (isOffline || !db || !id) return;
    await deleteDoc(doc(db, 'organizations', id));
};

export const updateOrganizationActivity = async (id: string): Promise<void> => {
    if (isOffline || !db || !id) return;
    try { await updateDoc(doc(db, 'organizations', id), { lastActiveAt: Date.now() }); } catch(e){}
};

// --- HYROX ---

export const saveRace = async (data: any, orgId: string) => {
    if(isOffline || !db || !orgId) return { id: 'off' };
    const raceRef = doc(collection(db, 'races'));
    const race = { ...sanitizeData(data), id: raceRef.id, organizationId: orgId, createdAt: Date.now() };
    await setDoc(raceRef, race);
    return race;
};

export const getPastRaces = async (orgId: string) => {
    if (isOffline || !db || !orgId) return [];
    const q = query(collection(db, 'races'), where("organizationId", "==", orgId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as HyroxRace).sort((a,b) => b.createdAt - a.createdAt);
};

export const getRace = async (id: string) => {
    if (isOffline || !db || !id) return null;
    const snap = await getDoc(doc(db, 'races', id));
    return snap.exists() ? snap.data() as HyroxRace : null;
};

// --- RESULTS ---
export const saveWorkoutResult = async (result: WorkoutResult) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'workout_results', result.id), sanitizeData(result));
};

export const getWorkoutResults = async (workoutId: string, orgId: string): Promise<WorkoutResult[]> => {
    if (isOffline || !db || !workoutId) return [];
    const q = query(collection(db, 'workout_results'), where('workoutId', '==', workoutId), where('organizationId', '==', orgId), orderBy('finishTime', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WorkoutResult);
};

// --- CHECK-INS ---

export const sendCheckIn = async (orgId: string, userEmail: string) => {
    if (isOffline || !db || !orgId) return;
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
    });
};

export const getSuggestedExercises = async () => {
    if (isOffline || !db) return [];
    const snap = await getDocs(collection(db, 'exerciseSuggestions'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as SuggestedExercise);
};

export const approveExerciseSuggestion = async (s: SuggestedExercise) => {
    const bankEx: BankExercise = { id: s.id, name: s.name, description: s.description, imageUrl: s.imageUrl, tags: s.tags };
    await saveExerciseToBank(bankEx);
    await deleteExerciseSuggestion(s.id);
};

export const deleteExerciseSuggestion = async (id: string) => {
    if (isOffline || !db) return;
    await deleteDoc(doc(db, 'exerciseSuggestions', id));
};

export const updateExerciseSuggestion = async (s: SuggestedExercise) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'exerciseSuggestions', s.id), s, { merge: true });
};
