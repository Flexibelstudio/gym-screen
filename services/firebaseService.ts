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
  Firestore,
  Query
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
  SmartScreenPricing, HyroxRace, SeasonalThemeSetting, MemberGoals, WorkoutLog, CheckInEvent, Member 
} from '../types';
import { MOCK_ORGANIZATIONS, MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN, MOCK_EXERCISE_BANK, MOCK_SUGGESTED_EXERCISES, MOCK_WORKOUT_RESULTS, MOCK_SMART_SCREEN_PRICING, MOCK_RACES, MOCK_MEMBERS } from '../data/mockData';

export const isOffline = (
    typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' 
    ? true 
    : !(import.meta as any).env?.VITE_FIREBASE_API_KEY 
);

const DEFAULT_SEASONAL_THEMES: SeasonalThemeSetting[] = [
    { id: 'winter', name: 'Vinter', isEnabled: true, ranges: [{ startMonth: 12, startDay: 1, endMonth: 1, endDay: 31 }] },
    { id: 'christmas', name: 'Jul', isEnabled: true, ranges: [{ startMonth: 12, startDay: 17, endMonth: 12, endDay: 26 }] },
    { id: 'newyear', name: 'Nyår', isEnabled: true, ranges: [{ startMonth: 12, startDay: 31, endMonth: 12, endDay: 31 }] },
    { id: 'valentines', name: 'Alla hjärtans dag', isEnabled: true, ranges: [{ startMonth: 2, startDay: 14, endMonth: 2, endDay: 14 }] },
    { id: 'easter', name: 'Påsk', isEnabled: true, ranges: [{ startMonth: 4, startDay: 2, endMonth: 4, endDay: 6 }] },
    { id: 'midsummer', name: 'Midsommar', isEnabled: true, ranges: [{ startMonth: 6, startDay: 19, endMonth: 6, endDay: 19 }] },
    { id: 'summer', name: 'Sommar', isEnabled: true, ranges: [{ startMonth: 6, startDay: 1, endMonth: 8, endDay: 31 }] },
    { id: 'halloween', name: 'Halloween', isEnabled: true, ranges: [{ startMonth: 10, startDay: 1, endMonth: 10, endDay: 31, useWeekNumber: true, weekNumber: 44 }] },
];

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isOffline) {
    console.warn("RUNNING IN OFFLINE (MOCK) MODE.");
    if (MOCK_ORGANIZATIONS.length > 0 && !MOCK_ORGANIZATIONS[0].lastActiveAt) {
        MOCK_ORGANIZATIONS[0].lastActiveAt = Date.now() - 1000 * 60 * 60 * 2; 
    }
    if (!(window as any).mockSeasonalThemes) {
        (window as any).mockSeasonalThemes = [...DEFAULT_SEASONAL_THEMES];
    }
} else {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        
        const seedData = async () => {
            if (!db) return;
            const pricingRef = doc(db, 'system', 'pricing');
            if (!(await getDoc(pricingRef)).exists()) await setDoc(pricingRef, MOCK_SMART_SCREEN_PRICING);
            
            const themesRef = doc(db, 'system', 'seasonalThemes');
            if (!(await getDoc(themesRef)).exists()) await setDoc(themesRef, { themes: DEFAULT_SEASONAL_THEMES });

            const bankCol = collection(db, 'exerciseBank');
            const bankSnap = await getDocs(query(bankCol, limit(1)));
            if (bankSnap.empty) {
                console.log("Seeding exercise bank...");
                const batch = writeBatch(db);
                MOCK_EXERCISE_BANK.forEach(ex => batch.set(doc(bankCol, ex.id), ex));
                await batch.commit();
            }
        };
        seedData();
        console.log("Firebase initialized (Modular SDK).");
    } catch (error) {
        console.error("CRITICAL: Firebase init failed.", error);
    }
}

const sanitizeData = <T>(data: T): T => JSON.parse(JSON.stringify(data));
const offlineWarning = (op: string) => { console.warn(`OFFLINE: ${op} skipped.`); return Promise.resolve(); };

// --- Auth ---
export const onAuthChange = (callback: (user: User | null) => void) => {
    if (isOffline || !auth) {
        callback({ uid: 'offline_owner_uid', isAnonymous: false } as User);
        return () => {}; 
    }
    return onAuthStateChanged(auth, callback);
};

export const signIn = (email: string, password: string): Promise<User> => {
    if (isOffline || !auth) return email === MOCK_SYSTEM_OWNER.email ? Promise.resolve({ uid: MOCK_SYSTEM_OWNER.uid } as User) : Promise.reject("Offline login failed");
    return signInWithEmailAndPassword(auth, email, password).then(c => c.user);
};

export const signInAsStudio = (): Promise<User> => {
    if (isOffline || !auth) return Promise.resolve({ uid: 'offline_studio_uid', isAnonymous: true } as User);
    return signInAnonymously(auth).then(c => c.user);
};

export const signOut = (): Promise<void> => (isOffline || !auth) ? Promise.resolve() : firebaseSignOut(auth);

export const getUserData = async (uid: string): Promise<UserData | null> => {
    if (isOffline || !db) {
        if (uid === 'offline_owner_uid') return MOCK_SYSTEM_OWNER;
        if (uid === 'offline_admin_uid') return MOCK_ORG_ADMIN;
        return null;
    }
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { uid, ...snap.data() } as UserData : null;
};

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

export const joinOrganizationWithCode = async (uid: string, code: string) => {
    if (isOffline || !db) throw new Error("Offline: Kan ej ansluta.");
    const q = query(collection(db, 'organizations'), where('inviteCode', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Ogiltig kod.");
    const orgId = snap.docs[0].id;
    await updateDoc(doc(db, 'users', uid), { organizationId: orgId });
    return orgId;
};

interface RegisterAdditionalData {
    firstName: string;
    lastName: string;
    age?: number;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    photoBase64?: string | null;
}

export const registerMemberWithCode = async (email: string, pass: string, code: string, additionalData?: RegisterAdditionalData) => {
    if (isOffline || !db || !auth) {
        throw new Error("Offline mode: Cannot register new users.");
    }
    const q = query(collection(db, 'organizations'), where('inviteCode', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Ogiltig inbjudningskod.");
    const organizationId = snap.docs[0].id;
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    let photoUrl = '';
    if (additionalData?.photoBase64 && storage) {
        try {
            const path = `users/${user.uid}/profile_${Date.now()}.jpg`;
            photoUrl = await uploadImage(path, additionalData.photoBase64);
        } catch (e) {
            console.warn("Failed to upload profile image during registration", e);
        }
    }
    const userData: UserData = {
        uid: user.uid,
        email: email,
        role: 'member',
        organizationId: organizationId,
        firstName: additionalData?.firstName,
        lastName: additionalData?.lastName,
        age: additionalData?.age,
        gender: additionalData?.gender,
        photoUrl: photoUrl
    };
    await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        createdAt: serverTimestamp()
    });
    return user;
};

// --- HÄR ÄR TILLÄGGEN FÖR ADMINVYN (Alternativ A) ---

export const getMembers = async (orgId: string): Promise<Member[]> => {
    if (isOffline || !db) {
        return MOCK_MEMBERS; // För testning i offline/dev-läge
    }
    const q = query(
        collection(db, 'users'), 
        where('organizationId', '==', orgId),
        where('role', '==', 'member')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Member);
};

export const updateMemberStatus = async (uid: string, status: 'active' | 'inactive') => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'users', uid), { status });
};

export const updateMemberEndDate = async (uid: string, date: string | null) => {
    if (isOffline || !db) return;
    await updateDoc(doc(db, 'users', uid), { endDate: date });
};

// --- Slut på tillägg ---

export const uploadImage = async (path: string, image: File | string): Promise<string> => {
    if (typeof image === 'string' && !image.startsWith('data:image')) return image;
    if (isOffline || !storage) return "https://via.placeholder.com/800x800?text=Offline+Image";
    const blob = typeof image === 'string' ? await (await fetch(image)).blob() : image;
    const snap = await uploadBytes(ref(storage, path), blob);
    return getDownloadURL(snap.ref);
};

export const deleteImageByUrl = async (url: string): Promise<void> => {
    if (isOffline || !storage || !url.includes('firebasestorage')) return;
    try { await deleteObject(ref(storage, url)); } catch (e) { console.warn("Image delete failed", e); }
};

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

export const updateOrganizationActivity = async (id: string): Promise<void> => {
    if (!isOffline && !navigator.onLine) return queueOfflineWrite('updateOrganizationActivity', { id });
    if (isOffline || !db) return;
    try { await updateDoc(doc(db, 'organizations', id), { lastActiveAt: Date.now() }); } catch(e){}
};

export const listenToOrganizationChanges = (id: string, onUpdate: (org: Organization) => void) => {
    if (isOffline || !db) return () => {}; 
    return onSnapshot(doc(db, 'organizations', id), (snap) => {
        if (snap.exists()) onUpdate(snap.data() as Organization);
    });
};

export const createOrganization = async (name: string, subdomain: string): Promise<Organization> => {
    if(isOffline || !db) {
        const newOrg = { id: `off_${Date.now()}`, name, subdomain, studios: [], passwords: { coach: '1234'}, globalConfig: MOCK_ORGANIZATIONS[0].globalConfig };
        MOCK_ORGANIZATIONS.push(newOrg as Organization);
        return newOrg as Organization;
    }
    const q = query(collection(db, 'organizations'), where("subdomain", "==", subdomain.toLowerCase()));
    if (!(await getDocs(q)).empty) throw new Error(`Subdomänen '${subdomain}' är upptagen.`);
    const id = `org_${subdomain.replace(/[^a-z0-9]/gi, '').toLowerCase()}_${Date.now()}`;
    const newOrg: Organization = { 
        id, name, subdomain, passwords: { coach: '1234' }, studios: [], customPages: [],
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

export const deleteOrganization = async (id: string) => {
    if (isOffline || !db) {
        const idx = MOCK_ORGANIZATIONS.findIndex(o => o.id === id);
        if (idx > -1) MOCK_ORGANIZATIONS.splice(idx, 1);
        return;
    }
    await deleteDoc(doc(db, 'organizations', id));
};

const updateOrgField = async (id: string, field: string, value: any) => {
    if(isOffline || !db) return getOrganizationById(id) as Promise<Organization>;
    await updateDoc(doc(db, 'organizations', id), { [field]: value });
    return getOrganizationById(id) as Promise<Organization>;
}

export const updateOrganizationPasswords = (id: string, passwords: any) => updateOrgField(id, 'passwords', passwords);
export const updateOrganizationLogos = (id: string, logos: any) => updateOrgField(id, 'logoUrlLight', logos.light).then(() => updateOrgField(id, 'logoUrlDark', logos.dark));
export const updateOrganizationPrimaryColor = (id: string, color: string) => updateOrgField(id, 'primaryColor', color);
export const updateOrganizationCustomPages = (id: string, pages: any) => updateOrgField(id, 'customPages', pages);
export const updateOrganizationInfoCarousel = (id: string, carousel: any) => updateOrgField(id, 'infoCarousel', carousel);
export const updateOrganizationCompanyDetails = (id: string, details: any) => updateOrgField(id, 'companyDetails', details);

export const updateExerciseImageOverride = async (orgId: string, exId: string, url: string | null) => {
    if(isOffline || !db) return getOrganizationById(orgId) as Promise<Organization>;
    await updateDoc(doc(db, 'organizations', orgId), { 
        [`exerciseOverrides.${exId}`]: url ? { imageUrl: url } : deleteField() 
    });
    return getOrganizationById(orgId) as Promise<Organization>;
};

export const updateOrganizationDiscount = async (id: string, d: any) => {
    if(isOffline || !db) return getOrganizationById(id) as Promise<Organization>;
    await updateDoc(doc(db, 'organizations', id), { 
        discountType: d.type, discountValue: d.value, discountPercentage: deleteField() 
    });
    return getOrganizationById(id) as Promise<Organization>;
};

export const updateOrganizationBilledStatus = async (id: string, month: string) => {
    if(isOffline || !db) return getOrganizationById(id) as Promise<Organization>;
    await updateDoc(doc(db, 'organizations', id), { lastBilledMonth: month, lastBilledDate: Date.now() });
    return getOrganizationById(id) as Promise<Organization>;
};

export const undoLastBilling = async (id: string) => {
    if(isOffline || !db) return getOrganizationById(id) as Promise<Organization>;
    await updateDoc(doc(db, 'organizations', id), { lastBilledDate: deleteField() });
    return getOrganizationById(id) as Promise<Organization>;
};

export const createStudio = async (orgId: string, name: string) => {
    const studio = { id: `st_${Date.now()}`, name, createdAt: Date.now(), configOverrides: {} };
    if(isOffline || !db) return studio;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Org missing");
    await updateDoc(doc(db, 'organizations', orgId), { studios: [...org.studios, studio] });
    return studio;
};

export const updateStudio = async (orgId: string, studioId: string, name: string) => {
    if(isOffline || !db) return { id: studioId, name };
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Org missing");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, name } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
    return studios.find(s => s.id === studioId);
};

export const deleteStudio = async (orgId: string, studioId: string) => {
    if(isOffline || !db) return;
    const org = await getOrganizationById(orgId);
    if (!org) return;
    await updateDoc(doc(db, 'organizations', orgId), { studios: org.studios.filter(s => s.id !== studioId) });
};

export const updateStudioConfig = async (orgId: string, studioId: string, overrides: any) => {
    if(isOffline || !db) {
        const org = MOCK_ORGANIZATIONS.find(o => o.id === orgId);
        const existingStudio = org?.studios.find(s => s.id === studioId);
        return { 
            id: studioId, 
            name: existingStudio?.name || 'Offline Studio', 
            createdAt: existingStudio?.createdAt || Date.now(), 
            configOverrides: sanitizeData(overrides) 
        } as Studio;
    }
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
    if(isOffline || !db) return [{ uid: 'mock_coach', email: 'coach@test.com', role: 'coach' } as UserData];
    const q = query(collection(db, 'users'), where("organizationId", "==", id), where("role", "==", "coach"));
    return (await getDocs(q)).docs.map(d => ({ uid: d.id, ...d.data() }) as UserData);
};

export const setAdminRole = async (uid: string, role: string) => {
    if(isOffline || !db) return;
    await updateDoc(doc(db, 'users', uid), { adminRole: role });
};

export const updateUserTermsAccepted = async (uid: string) => {
    if(isOffline || !db) return;
    await updateDoc(doc(db, 'users', uid), { termsAcceptedAt: Date.now() });
};

export const getExerciseBank = async (): Promise<BankExercise[]> => {
    if (isOffline || !db) return MOCK_EXERCISE_BANK;
    const snap = await getDocs(query(collection(db, 'exerciseBank'), orderBy('name')));
    return snap.docs.map(d => d.data() as BankExercise);
};

export const saveExerciseToBank = async (ex: BankExercise) => {
    if (isOffline || !db) return;
    const ref = doc(db, 'exerciseBank', ex.id);
    const snap = await getDoc(ref);
    if(snap.exists()) {
        const old = snap.data() as BankExercise;
        if(old.imageUrl && old.imageUrl !== ex.imageUrl) await deleteImageByUrl(old.imageUrl);
    }
    await setDoc(ref, sanitizeData(ex), { merge: true });
};

export const deleteExerciseFromBank = async (id: string) => {
    if (isOffline || !db) return;
    const ref = doc(db, 'exerciseBank', id);
    const snap = await getDoc(ref);
    if(snap.exists()) {
        const ex = snap.data() as BankExercise;
        if(ex.imageUrl) await deleteImageByUrl(ex.imageUrl);
    }
    await deleteDoc(ref);
};

export const getWorkoutsForOrganization = async (orgId: string): Promise<Workout[]> => {
    if (isOffline || !db) return (window as any).mockWorkouts || [];
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

export const deleteWorkoutResult = async (id: string) => {
    if (isOffline || !db) return;
    await deleteDoc(doc(db, 'workoutResults', id));
};

export const getSuggestedExercises = async (orgId?: string) => {
    if (isOffline || !db) return MOCK_SUGGESTED_EXERCISES;
    let q = query(collection(db, 'exerciseSuggestions'), orderBy('name'));
    if (orgId) q = query(q, where('organizationId', '==', orgId));
    return (await getDocs(q)).docs.map(d => ({ ...d.data(), id: d.id }) as SuggestedExercise);
};

export const approveExerciseSuggestion = async (s: SuggestedExercise) => {
    const bankEx: BankExercise = { id: s.id.replace('sugg', 'bank'), name: s.name, description: s.description, imageUrl: s.imageUrl, tags: s.tags };
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

export const addExerciseSuggestion = async (ex: Exercise, w: Workout) => {
    if (ex.isFromBank || ex.isFromAI || !ex.name || isOffline || !db) return;
    const q = query(collection(db, 'exerciseBank'), where('name', '==', ex.name.trim()));
    if (!(await getDocs(q)).empty) return;
    const id = `sugg_${Date.now()}`;
    const sugg: SuggestedExercise = { id, name: ex.name, description: ex.description || '', imageUrl: ex.imageUrl, sourceWorkoutTitle: w.title, organizationId: w.organizationId! };
    await setDoc(doc(db, 'exerciseSuggestions', id), sugg);
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
    if (isOffline || !db) return DEFAULT_SEASONAL_THEMES;
    const snap = await getDoc(doc(db, 'system', 'seasonalThemes'));
    return snap.exists() ? (snap.data() as any).themes : DEFAULT_SEASONAL_THEMES;
};

export const updateSeasonalThemes = async (themes: SeasonalThemeSetting[]) => {
    if (isOffline || !db) return;
    await setDoc(doc(db, 'system', 'seasonalThemes'), { themes }, { merge: true });
};

export const getPastRaces = async (orgId: string) => {
    if (isOffline || !db) return MOCK_RACES;
    const q = query(collection(db, 'races'), where("organizationId", "==", orgId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as HyroxRace).sort((a,b) => b.createdAt - a.createdAt);
};

export const getRace = async (id: string) => {
    if (isOffline || !db) return MOCK_RACES.find(r => r.id === id) || null;
    const snap = await getDoc(doc(db, 'races', id));
    return snap.exists() ? snap.data() as HyroxRace : null;
};

export const saveRace = async (data: any, orgId: string) => {
    if(isOffline || !db) return { id: 'mock', ...data, organizationId: orgId };
    const ref = doc(collection(db, 'races'));
    const race = { ...sanitizeData(data), id: ref.id, organizationId: orgId, createdAt: Date.now() };
    await setDoc(ref, race);
    return race;
};

export const getMemberLogs = async (memberId: string): Promise<WorkoutLog[]> => {
    if (isOffline || !db) return []; 
    const q = query(collection(db, 'workoutLogs'), where("memberId", "==", memberId), orderBy("date", "desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WorkoutLog);
};

export const saveWorkoutLog = async (logData: Omit<WorkoutLog, 'id'>) => {
    if (isOffline || !db) return;
    const newLogRef = doc(collection(db, 'workoutLogs'));
    const newLog: WorkoutLog = {
        id: newLogRef.id,
        ...logData
    };
    await setDoc(newLogRef, newLog);
    return newLog;
};

export const sendCheckIn = async (orgId: string, userEmail: string) => {
    if (isOffline || !db) {
        console.log("Offline CheckIn:", userEmail);
        return;
    }
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
    const fiveSecondsAgo = Date.now() - 5000;
    const q = query(
        collection(db, 'active_checkins'), 
        where('organizationId', '==', orgId),
        where('timestamp', '>', fiveSecondsAgo),
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