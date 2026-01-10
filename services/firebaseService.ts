
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
import { queueOfflineWrite } from '../utils/idb';
import { 
  Studio, StudioConfig, Organization, CustomPage, UserData, Workout, InfoCarousel, 
  BankExercise, SuggestedExercise, Exercise, WorkoutResult, WorkoutBlock, CompanyDetails, 
  SmartScreenPricing, HyroxRace, SeasonalThemeSetting, MemberGoals, WorkoutLog, CheckInEvent, Member, UserRole, PersonalBest, StudioEvent 
} from '../types';
import { MOCK_ORGANIZATIONS, MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN, MOCK_EXERCISE_BANK, MOCK_SUGGESTED_EXERCISES, MOCK_WORKOUT_RESULTS, MOCK_SMART_SCREEN_PRICING, MOCK_RACES, MOCK_MEMBERS } from '../data/mockData';

// Helper to generate a random 6-char code
const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// FIX: Gå endast live om Firebase-nyckeln faktiskt finns konfigurerad
const hasFirebaseConfig = !!(
    (import.meta as any).env?.VITE_FIREBASE_API_KEY || 
    (process as any).env?.VITE_FIREBASE_API_KEY
);

export const isOffline = !hasFirebaseConfig;

let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export let storage: FirebaseStorage | null = null;

if (isOffline) {
    console.warn("RUNNING IN MOCK MODE (No Firebase config found).");
} else {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
    } catch (error) {
        console.error("CRITICAL: Firebase init failed.", error);
    }
}

const sanitizeData = <T>(data: T): T => JSON.parse(JSON.stringify(data));

// --- Auth ---
// ... (behåll auth functions)
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

// --- Medlemshantering ---

export const updateUserGoals = async (uid: string, goals: MemberGoals) => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'users', uid), { goals });
};

export const updateUserProfile = async (uid: string, data: Partial<UserData>) => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'users', uid), sanitizeData(data));
};

export const updateUserRole = async (uid: string, role: UserRole) => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'users', uid), { role });
};

export const registerMemberWithCode = async (email: string, pass: string, code: string, additionalData?: { firstName: string, lastName: string, age?: number, gender?: string, photoBase64?: string | null }) => {
    if (isOffline || !db || !auth) throw new Error("Offline mode");

    const q = query(collection(db, 'organizations'), where('inviteCode', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Ogiltig inbjudningskod.");
    const organizationId = snap.docs[0].id;

    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    const userData: any = {
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
        createdAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'users', user.uid), userData);

    if (additionalData?.photoBase64 && storage) {
        try {
            const path = `users/${user.uid}/profile.jpg`;
            const photoUrl = await uploadImage(path, additionalData.photoBase64);
            await updateDoc(doc(db, 'users', user.uid), { photoUrl });
        } catch (e) {
            console.warn("Photo upload failed", e);
        }
    }

    return user;
};

export const listenToMembers = (orgId: string, onUpdate: (members: Member[]) => void) => {
    if (isOffline || !db) {
        onUpdate(MOCK_MEMBERS);
        return () => {};
    }
    const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
    return onSnapshot(q, (snap) => {
        const members = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Member);
        onUpdate(members);
    });
};

export const getMembers = async (orgId: string): Promise<Member[]> => {
    if (isOffline || !db) return MOCK_MEMBERS;
    const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Member);
};

export const updateMemberEndDate = async (uid: string, date: string | null) => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'users', uid), { endDate: date });
};

// --- PERSONAL BESTS LOGIC ---

// Helper to normalize exercise ID for PBs
const getPBId = (name: string) => name.toLowerCase().trim().replace(/[^\w]/g, '_');

export const listenToPersonalBests = (userId: string, onUpdate: (pbs: PersonalBest[]) => void, onError?: (error: any) => void) => {
    if (isOffline || !db) {
        onUpdate([]); // Mock implementations if needed
        return () => {};
    }
    const colRef = collection(db, 'users', userId, 'personalBests');
    return onSnapshot(colRef, 
        (snap) => {
            const pbs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as PersonalBest);
            onUpdate(pbs);
        }, 
        (error) => {
            console.error("Error getting personal bests:", error);
            if (onError) onError(error);
        }
    );
};

export const updatePersonalBest = async (userId: string, exerciseName: string, weight: number) => {
    if (isOffline || !db) return;
    const pbId = getPBId(exerciseName);
    const pbRef = doc(db, 'users', userId, 'personalBests', pbId);
    
    // Check if we should update or create
    const snap = await getDoc(pbRef);
    const currentData = snap.exists() ? snap.data() as PersonalBest : null;

    // Only update if manual override or new record
    const pbData: PersonalBest = {
        id: pbId,
        exerciseName: exerciseName.trim(),
        weight: weight,
        date: Date.now()
    };
    
    await setDoc(pbRef, pbData);
};

// --- STUDIO EVENTS / PB ALERTS ---

export const listenForStudioEvents = (orgId: string, callback: (event: StudioEvent) => void) => {
    if (isOffline || !db) return () => {};
    
    // Listen for events created in the last few seconds to avoid re-triggering old ones
    // Note: In a real app, we might use a dedicated 'processed' flag or similar
    const startTime = Date.now() - 5000; 
    
    const q = query(
        collection(db, 'studio_events'), 
        where('organizationId', '==', orgId),
        orderBy('timestamp', 'desc'),
        limit(1)
    );
    
    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data() as StudioEvent;
                // Only trigger if the event is very recent
                if (data.timestamp > startTime && Date.now() - data.timestamp < 10000) {
                    callback(data);
                }
            }
        });
    });
};

export const listenToWeeklyPBs = (orgId: string, onUpdate: (events: StudioEvent[]) => void) => {
    if (isOffline || !db) {
        onUpdate([]);
        return () => {};
    }

    // Calculate start of current week (Monday 00:00)
    const now = new Date();
    const day = now.getDay() || 7; // Get current day number, Sunday is 7
    if (day !== 1) now.setHours(-24 * (day - 1)); // Set to previous Monday
    now.setHours(0, 0, 0, 0);
    
    const startOfWeek = now.getTime();

    const q = query(
        collection(db, 'studio_events'),
        where('organizationId', '==', orgId),
        where('type', '==', 'pb'),
        where('timestamp', '>=', startOfWeek),
        orderBy('timestamp', 'desc'),
        limit(50) // Reasonable limit for the UI
    );

    return onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(d => d.data() as StudioEvent);
        onUpdate(events);
    });
};

// --- IMAGES ---

export const uploadImage = async (path: string, image: File | string): Promise<string> => {
    if (typeof image === 'string' && !image.startsWith('data:image')) return image;
    if (isOffline || !storage) return "";
    const blob = typeof image === 'string' ? await (await fetch(image)).blob() : image;
    const snap = await uploadBytes(ref(storage, path), blob);
    return getDownloadURL(snap.ref);
};

export const deleteImageByUrl = async (url: string): Promise<void> => {
    if (isOffline || !storage || !url.includes('firebasestorage')) return;
    try { await deleteObject(ref(storage, url)); } catch (e) {}
};

// ... (behåll organisationer, studios, configs logik)
export const getOrganizations = async (): Promise<Organization[]> => {
    if (isOffline || !db) return MOCK_ORGANIZATIONS;
    const snap = await getDocs(collection(db, 'organizations'));
    return snap.docs.map(d => d.data() as Organization);
};

export const getOrganizationById = async (id: string): Promise<Organization | null> => {
    if (isOffline || !db) return MOCK_ORGANIZATIONS.find(o => o.id === id) || null;
    const snap = await getDoc(doc(db, 'organizations', id));
    return snap.exists() ? snap.data() as Organization : null;
};

export const listenToOrganizationChanges = (id: string, onUpdate: (org: Organization) => void) => {
    if (isOffline || !db) return () => {}; 
    return onSnapshot(doc(db, 'organizations', id), (snap) => {
        if (snap.exists()) onUpdate(snap.data() as Organization);
    });
};

export const updateOrganizationActivity = async (id: string): Promise<void> => {
    if (isOffline || !db) return;
    try { await updateDoc(doc(db, 'organizations', id), { lastActiveAt: Date.now() }); } catch(e){}
};

export const createOrganization = async (name: string, subdomain: string): Promise<Organization> => {
    if(isOffline || !db) throw new Error("Offline");
    const q = query(collection(db, 'organizations'), where("subdomain", "==", subdomain.toLowerCase()));
    if (!(await getDocs(q)).empty) throw new Error(`Subdomänen '${subdomain}' är upptagen.`);
    const id = `org_${subdomain}_${Date.now()}`;
    const newOrg: Organization = { 
        id, name, subdomain, passwords: { coach: '1234' }, studios: [], customPages: [], status: 'active',
        inviteCode: generateInviteCode(), // AUTO GENERATE CODE ON CREATION
        globalConfig: { enableBreathingGuide: true, enableWarmup: true, customCategories: [{ id: '1', name: 'Standard', prompt: '' }] } 
    };
    await setDoc(doc(db, 'organizations', id), newOrg);
    return newOrg;
};

export const updateOrganization = async (id: string, name: string, subdomain: string, inviteCode?: string) => {
    if(isOffline || !db) return getOrganizationById(id) as Promise<Organization>;
    const updateData: any = { name, subdomain };
    if (inviteCode) updateData.inviteCode = inviteCode.toUpperCase();
    await updateDoc(doc(db, 'organizations', id), updateData);
    return getOrganizationById(id) as Promise<Organization>;
};

export const archiveOrganization = async (id: string): Promise<void> => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'organizations', id), { status: 'archived' });
};

export const restoreOrganization = async (id: string): Promise<void> => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'organizations', id), { status: 'active' });
};

export const deleteOrganizationPermanently = async (id: string): Promise<void> => {
    if (isOffline || !db) return;
    await deleteDoc(doc(db, 'organizations', id));
};

export const updateOrganizationPasswords = (id: string, passwords: any) => updateDoc(doc(db, 'organizations', id), { passwords }).then(() => getOrganizationById(id));
export const updateOrganizationLogos = (id: string, logos: any) => updateDoc(doc(db, 'organizations', id), { logoUrlLight: logos.light, logoUrlDark: logos.dark }).then(() => getOrganizationById(id));
export const updateOrganizationPrimaryColor = (id: string, color: string) => updateDoc(doc(db, 'organizations', id), { primaryColor: color }).then(() => getOrganizationById(id));
export const updateOrganizationCustomPages = (id: string, pages: any) => updateDoc(doc(db, 'organizations', id), { customPages: pages }).then(() => getOrganizationById(id));
export const updateOrganizationInfoCarousel = (id: string, carousel: any) => updateDoc(doc(db, 'organizations', id), { infoCarousel: carousel }).then(() => getOrganizationById(id));
export const updateOrganizationCompanyDetails = (id: string, details: any) => updateDoc(doc(db, 'organizations', id), { companyDetails: details }).then(() => getOrganizationById(id));

export const updateOrganizationDiscount = async (id: string, d: any) => {
    if(isOffline || !db) return getOrganizationById(id) as Promise<Organization>;
    await updateDoc(doc(db, 'organizations', id), { discountType: d.type, discountValue: d.value });
    return getOrganizationById(id) as Promise<Organization>;
};

export const updateOrganizationBilledStatus = async (id: string, month: string) => {
    if(isOffline || !db) return getOrganizationById(id) as Promise<Organization>;
    await updateDoc(doc(db, 'organizations', id), { lastBilledMonth: month, lastBilledDate: Date.now() });
    return getOrganizationById(id) as Promise<Organization>;
};

export const updateExerciseImageOverride = async (orgId: string, exerciseId: string, imageUrl: string | null) => {
    if (isOffline || !db) return getOrganizationById(orgId) as Promise<Organization>;
    const orgRef = doc(db, 'organizations', orgId);
    if (imageUrl) {
        await updateDoc(orgRef, { [`exerciseOverrides.${exerciseId}`]: { imageUrl } });
    } else {
        await updateDoc(orgRef, { [`exerciseOverrides.${exerciseId}`]: deleteField() });
    }
    return getOrganizationById(orgId) as Promise<Organization>;
};

export const undoLastBilling = async (id: string) => {
    if(isOffline || !db) return getOrganizationById(id) as Promise<Organization>;
    await updateDoc(doc(db, 'organizations', id), { lastBilledDate: deleteField() });
    return getOrganizationById(id) as Promise<Organization>;
};

export const createStudio = async (orgId: string, name: string) => {
    if(isOffline || !db) return { id: 'off', name };
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Org missing");
    const studio = { id: `st_${Date.now()}`, name, createdAt: Date.now(), configOverrides: {} };
    await updateDoc(doc(db, 'organizations', orgId), { studios: [...org.studios, studio] });
    return studio;
};

export const updateStudio = async (orgId: string, studioId: string, name: string) => {
    if(isOffline || !db) return;
    const org = await getOrganizationById(orgId);
    if (!org) return;
    const studios = org.studios.map(s => s.id === studioId ? { ...s, name } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
};

export const deleteStudio = async (orgId: string, studioId: string) => {
    if(isOffline || !db) return;
    const org = await getOrganizationById(orgId);
    if (!org) return;
    await updateDoc(doc(db, 'organizations', orgId), { studios: org.studios.filter(s => s.id !== studioId) });
};

export const updateStudioConfig = async (orgId: string, studioId: string, overrides: any) => {
    if(isOffline || !db) return {} as Studio;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Org missing");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, configOverrides: sanitizeData(overrides) } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
    return studios.find(s => s.id === studioId) as Studio;
};

export const updateGlobalConfig = async (id: string, config: any) => {
    if(isOffline || !db) return;
    await updateDoc(doc(db, 'organizations', id), { globalConfig: sanitizeData(config) });
};

export const getAdminsForOrganization = async (id: string) => {
    if(isOffline || !db) return [MOCK_ORG_ADMIN];
    const q = query(collection(db, 'users'), where("organizationId", "==", id), where("role", "==", "organizationadmin"));
    return (await getDocs(q)).docs.map(d => ({ uid: d.id, ...d.data() }) as UserData);
};

export const getCoachesForOrganization = async (id: string) => {
    if(isOffline || !db) return [];
    const q = query(collection(db, 'users'), where("organizationId", "==", id), where("role", "==", "coach"));
    return (await getDocs(q)).docs.map(d => ({ uid: d.id, ...d.data() }) as UserData);
};

export const updateUserTermsAccepted = async (uid: string) => {
    if(isOffline || !db) return;
    await updateUserProfile(uid, { termsAcceptedAt: Date.now() });
};

export const getExerciseBank = async (): Promise<BankExercise[]> => {
    if (isOffline || !db) return MOCK_EXERCISE_BANK;
    const snap = await getDocs(query(collection(db, 'exerciseBank'), orderBy('name')));
    return snap.docs.map(d => d.data() as BankExercise);
};

export const saveExerciseToBank = async (ex: BankExercise) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'exerciseBank', ex.id), sanitizeData(ex), { merge: true });
};

export const deleteExerciseFromBank = async (id: string) => {
    if (isOffline || !db) return;
    await deleteDoc(doc(db, 'exerciseBank', id));
};

export const getWorkoutsForOrganization = async (orgId: string): Promise<Workout[]> => {
    if (isOffline || !db) return [];
    const q = query(collection(db, 'workouts'), where("organizationId", "==", orgId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Workout).sort((a,b) => (a.title > b.title ? 1 : -1));
};

export const saveWorkout = async (w: Workout) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'workouts', w.id), sanitizeData(w), { merge: true });
};

export const deleteWorkout = async (id: string) => {
    if (isOffline || !db) return;
    await deleteDoc(doc(db, 'workouts', id));
};

export const getWorkoutResults = async (wid: string, oid: string) => {
    if (isOffline || !db) return [];
    const q = query(collection(db, 'workoutResults'), where("organizationId", "==", oid), where("workoutId", "==", wid), orderBy("finishTime", "asc"));
    return (await getDocs(q)).docs.map(d => d.data() as WorkoutResult);
};

export const saveWorkoutResult = async (r: WorkoutResult) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'workoutResults', r.id), r);
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

export const getSmartScreenPricing = async () => {
    if (isOffline || !db) return MOCK_SMART_SCREEN_PRICING;
    const snap = await getDoc(doc(db, 'system', 'pricing'));
    return snap.exists() ? snap.data() as SmartScreenPricing : MOCK_SMART_SCREEN_PRICING;
};

export const updateSmartScreenPricing = async (p: SmartScreenPricing) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'system', 'pricing'), p, { merge: true });
};

export const getSeasonalThemes = async () => {
    if (isOffline || !db) return [];
    const snap = await getDoc(doc(db, 'system', 'seasonalThemes'));
    return snap.exists() ? (snap.data() as any).themes : [];
};

export const updateSeasonalThemes = async (themes: SeasonalThemeSetting[]) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'system', 'seasonalThemes'), { themes }, { merge: true });
};

export const getPastRaces = async (orgId: string) => {
    if (isOffline || !db) return [];
    const q = query(collection(db, 'races'), where("organizationId", "==", orgId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as HyroxRace).sort((a,b) => b.createdAt - a.createdAt);
};

export const getRace = async (id: string) => {
    if (isOffline || !db) return null;
    const snap = await getDoc(doc(db, 'races', id));
    return snap.exists() ? snap.data() as HyroxRace : null;
};

export const saveRace = async (data: any, orgId: string) => {
    if(isOffline || !db) return { id: 'off' };
    const ref = doc(collection(db, 'races'));
    const race = { ...sanitizeData(data), id: ref.id, organizationId: orgId, createdAt: Date.now() };
    await setDoc(ref, race);
    return race;
};

export const listenToMemberLogs = (memberId: string, onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db) {
        onUpdate([]);
        return () => {};
    }
    const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
        const logs = snap.docs.map(d => d.data() as WorkoutLog);
        onUpdate(logs);
    });
};

// NEW: Listener for community feed
export const listenToCommunityLogs = (orgId: string, onUpdate: (logs: WorkoutLog[]) => void) => {
    if (isOffline || !db) {
        onUpdate([]);
        return () => {};
    }
    const q = query(
        collection(db, 'workoutLogs'),
        where("organizationId", "==", orgId),
        orderBy("date", "desc"),
        limit(20) // Keep the feed light
    );
    return onSnapshot(q, (snap) => {
        const logs = snap.docs.map(d => d.data() as WorkoutLog);
        onUpdate(logs);
    });
};

export const getMemberLogs = async (memberId: string): Promise<WorkoutLog[]> => {
    if (isOffline || !db) return []; 
    const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WorkoutLog);
};

export const getOrganizationLogs = async (orgId: string, limitCount: number = 100): Promise<WorkoutLog[]> => {
    if (isOffline || !db) return [];
    const q = query(collection(db, 'workoutLogs'), where("organizationId", "==", orgId), orderBy("date", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WorkoutLog);
};

export const saveWorkoutLog = async (logData: WorkoutLog | any) => {
    if (isOffline || !db) return;
    
    const newLogRef = doc(collection(db, 'workoutLogs'));
    const newLog = { id: newLogRef.id, ...logData };

    // --- ENRICH LOG WITH MEMBER SNAPSHOT DATA ---
    if (logData.memberId) {
        try {
            const userSnap = await getDoc(doc(db, 'users', logData.memberId));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                // Format name: "Anna A."
                const firstName = userData.firstName || 'Medlem';
                const lastNameInitial = userData.lastName ? `${userData.lastName[0]}.` : '';
                newLog.memberName = `${firstName} ${lastNameInitial}`.trim();
                newLog.memberPhotoUrl = userData.photoUrl || null;
            }
        } catch (e) {
            console.warn("Could not fetch member snapshot details for log", e);
        }
    }
    // --------------------------------------------

    await setDoc(newLogRef, newLog);

    // AUTO UPDATE PERSONAL BESTS & NOTIFY STUDIO
    if (logData.memberId && logData.exerciseResults) {
        try {
            const batch = writeBatch(db);
            const pbCollectionRef = collection(db, 'users', logData.memberId, 'personalBests');
            
            // Get user's first name for the notification if we haven't already
            let userName = newLog.memberName || 'En medlem'; 

            const currentPBsSnap = await getDocs(pbCollectionRef);
            const currentPBs: Record<string, PersonalBest> = {};
            currentPBsSnap.forEach(doc => {
                currentPBs[doc.id] = doc.data() as PersonalBest;
            });

            let newPBsTriggered: { name: string; exercise: string }[] = [];

            logData.exerciseResults.forEach((exResult: any) => {
                let maxWeight = 0;
                
                if (exResult.setDetails && Array.isArray(exResult.setDetails)) {
                    const weights = exResult.setDetails.map((s: any) => parseFloat(s.weight)).filter((n: number) => !isNaN(n));
                    if (weights.length > 0) maxWeight = Math.max(...weights);
                } else if (exResult.weight) {
                    maxWeight = Number(exResult.weight);
                }

                if (maxWeight > 0 && exResult.exerciseName) {
                    const pbId = getPBId(exResult.exerciseName);
                    const currentPB = currentPBs[pbId];

                    if (!currentPB || maxWeight > currentPB.weight) {
                        const newPB: PersonalBest = {
                            id: pbId,
                            exerciseName: exResult.exerciseName.trim(),
                            weight: maxWeight,
                            date: logData.date
                        };
                        const pbRef = doc(db, 'users', logData.memberId, 'personalBests', pbId);
                        batch.set(pbRef, newPB);
                        
                        newPBsTriggered.push({ name: userName, exercise: exResult.exerciseName.trim() });
                    }
                }
            });

            if (newPBsTriggered.length > 0) {
                // Commit PB updates
                await batch.commit();

                // Trigger Studio Events for PBs
                // We do this after commit to ensure PBs are saved.
                // Create an event for each PB (or could batch them into one, but separate is more fun on screen)
                for (const pbEvent of newPBsTriggered) {
                    const eventRef = doc(collection(db, 'studio_events'));
                    const eventData: StudioEvent = {
                        id: eventRef.id,
                        type: 'pb',
                        organizationId: logData.organizationId,
                        timestamp: Date.now(),
                        data: {
                            userName: pbEvent.name,
                            exerciseName: pbEvent.exercise,
                            isNewRecord: true
                        }
                    };
                    await setDoc(eventRef, eventData);
                }
            }
        } catch (e) {
            console.error("Failed to auto-update personal bests", e);
        }
    }

    return newLog;
};

export const updateWorkoutLog = async (logId: string, updates: Partial<WorkoutLog>) => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'workoutLogs', logId), updates);
};

export const deleteWorkoutLog = async (logId: string) => {
    if (isOffline || !db) return;
    await deleteDoc(doc(db, 'workoutLogs', logId));
};

export const sendCheckIn = async (orgId: string, userEmail: string) => {
    if (isOffline || !db) return;
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
    if (isOffline || !db) return () => {};
    const q = query(
        collection(db, 'active_checkins'), 
        where('organizationId', '==', orgId),
        orderBy('timestamp', 'desc'),
        limit(1)
    );
    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data() as CheckInEvent;
                if (Date.now() - data.timestamp < 10000) { 
                    callback(data);
                }
            }
        });
    });
};