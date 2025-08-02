

import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, query, where, getDoc, Firestore, deleteDoc } from 'firebase/firestore';
import { Studio, StudioConfig, Organization, CustomPage, UserData, Workout } from '../types';
import { firebaseConfig } from './firebaseConfig';
import { MOCK_ORGANIZATIONS, MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN } from '../data/mockData';

let app: FirebaseApp | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: Firestore | null = null;
export let isOffline = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("Firebase initialized successfully.");
} catch (error) {
  console.warn("Firebase initialization failed. Running in OFFLINE mode.", error);
  isOffline = true;
}

// --- Auth Functions ---
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
    if (isOffline || !auth) {
        // In offline mode, we simulate an authenticated system owner for testing.
        callback({ uid: 'offline_owner_uid', isAnonymous: false } as FirebaseUser);
        return () => {}; // Return an empty unsubscribe function
    }
    return onAuthStateChanged(auth, callback);
};

export const signIn = (email: string, password: string): Promise<FirebaseUser> => {
    if (isOffline || !auth) {
        if(email === MOCK_SYSTEM_OWNER.email) {
            return Promise.resolve({ uid: MOCK_SYSTEM_OWNER.uid, isAnonymous: false } as FirebaseUser);
        }
        return Promise.reject(new Error("Offline mode: Cannot sign in."));
    }
    return signInWithEmailAndPassword(auth, email, password).then(userCredential => userCredential.user);
};

export const signInAsStudio = (): Promise<FirebaseUser> => {
    if (isOffline || !auth) {
         return Promise.resolve({ uid: 'offline_studio_uid', isAnonymous: true } as FirebaseUser);
    }
    return signInAnonymously(auth).then(userCredential => userCredential.user);
};

export const signOut = (): Promise<void> => {
     if (isOffline || !auth) {
        return Promise.resolve();
    }
    return firebaseSignOut(auth);
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
    if (isOffline || !db) {
        if (uid === 'offline_owner_uid') {
             return Promise.resolve(MOCK_SYSTEM_OWNER);
        }
        if (uid === 'offline_admin_uid') {
            return Promise.resolve(MOCK_ORG_ADMIN);
        }
        return Promise.resolve(null);
    }
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
        return { uid, ...docSnap.data() } as UserData;
    }
    return null;
};

// --- Firestore Data Functions ---
const offlineWarning = (operation: string) => {
    console.warn(`OFFLINE MODE: Operation "${operation}" was not sent to the server.`);
    return Promise.resolve();
}

export const getOrganizations = async (): Promise<Organization[]> => {
    if (isOffline || !db) {
        return Promise.resolve(MOCK_ORGANIZATIONS);
    }
    const querySnapshot = await getDocs(collection(db, 'organizations'));
    if (querySnapshot.empty) {
      console.log("No organizations found in Firestore.");
      return [];
    }
    return querySnapshot.docs.map(d => d.data() as Organization);
};

const getUpdatedOrg = async (organizationId: string): Promise<Organization> => {
    if(isOffline || !db) return Promise.resolve(MOCK_ORGANIZATIONS.find(o => o.id === organizationId)!);
    const updatedDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (!updatedDoc.exists()) throw new Error("Organisationen försvann.");
    return updatedDoc.data() as Organization;
};

export const createOrganization = async (name: string, subdomain: string): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('createOrganization');
        const newOrg: Organization = { id: `offline_org_${Date.now()}`, name, subdomain, studios: [], passwords: { coach: '1234'}, globalConfig: MOCK_ORGANIZATIONS[0].globalConfig };
        MOCK_ORGANIZATIONS.push(newOrg);
        return newOrg;
    }
    const q = query(collection(db, 'organizations'), where("subdomain", "==", subdomain.toLowerCase()));
    if (!(await getDocs(q)).empty) throw new Error(`Subdomänen '${subdomain}' är redan upptagen.`);
    
    const newOrgId = `org_${subdomain.replace(/[^a-z0-9]/gi, '').toLowerCase()}_${Date.now()}`;
    const newOrg: Organization = { 
        id: newOrgId, 
        name, 
        subdomain, 
        passwords: { coach: '1234' }, 
        globalConfig: {
            enableBoost: true,
            enableBreathingGuide: true,
            enableWarmup: true,
            customCategories: [{ id: 'default_cat_1', name: 'Styrka & Flås', prompt: 'Skapa ett styrka och flås-pass.' }]
        }, 
        studios: [], 
        customPages: [] 
    };
    await setDoc(doc(db, 'organizations', newOrg.id), newOrg);
    return newOrg;
};

export const updateOrganization = async (organizationId: string, name: string, subdomain: string): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganization');
        return getUpdatedOrg(organizationId);
    }
    await updateDoc(doc(db, 'organizations', organizationId), { name, subdomain });
    return getUpdatedOrg(organizationId);
};

export const deleteOrganization = async (organizationId: string): Promise<void> => {
    if (isOffline || !db) {
        await offlineWarning('deleteOrganization');
        const index = MOCK_ORGANIZATIONS.findIndex(o => o.id === organizationId);
        if (index > -1) {
            MOCK_ORGANIZATIONS.splice(index, 1);
        }
        return;
    }
    const orgDocRef = doc(db, 'organizations', organizationId);
    await deleteDoc(orgDocRef);
};

export const updateOrganizationPasswords = async (organizationId: string, passwords: Organization['passwords']): Promise<Organization> => {
    if(isOffline || !db) {
         await offlineWarning('updateOrganizationPasswords');
        return getUpdatedOrg(organizationId);
    }
    await updateDoc(doc(db, 'organizations', organizationId), { passwords });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationLogo = async (organizationId: string, logoUrl: string): Promise<Organization> => {
     if(isOffline || !db) {
        await offlineWarning('updateOrganizationLogo');
        return getUpdatedOrg(organizationId);
    }
    await updateDoc(doc(db, 'organizations', organizationId), { logoUrl });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationPrimaryColor = async (organizationId: string, primaryColor: string): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationPrimaryColor');
        return getUpdatedOrg(organizationId);
    }
    await updateDoc(doc(db, 'organizations', organizationId), { primaryColor });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationCustomPages = async (organizationId: string, customPages: CustomPage[]): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationCustomPages');
        return getUpdatedOrg(organizationId);
    }
    await updateDoc(doc(db, 'organizations', organizationId), { customPages });
    return getUpdatedOrg(organizationId);
};

export const updateGlobalConfig = async (organizationId: string, newConfig: StudioConfig): Promise<void> => {
    if(isOffline || !db) {
        await offlineWarning('updateGlobalConfig');
        return;
    }
    await updateDoc(doc(db, 'organizations', organizationId), { globalConfig: newConfig });
};

export const updateStudioConfig = async (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>): Promise<Studio> => {
    if(isOffline || !db) {
        await offlineWarning('updateStudioConfig');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        const studio = org?.studios.find(s => s.id === studioId);
        if(!studio) throw new Error("Offline studio not found");
        studio.configOverrides = newConfigOverrides;
        return studio;
    }
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (!orgDoc.exists()) throw new Error("Organisationen hittades inte.");
    const org = orgDoc.data() as Organization;

    let updatedStudio: Studio | null = null;
    const newStudios = org.studios.map(s => {
        if (s.id === studioId) {
            updatedStudio = { ...s, configOverrides: newConfigOverrides };
            return updatedStudio;
        }
        return s;
    });

    if (!updatedStudio) throw new Error("Studion hittades inte.");

    await updateDoc(doc(db, 'organizations', organizationId), { studios: newStudios });
    return updatedStudio;
};


export const createStudio = async (organizationId: string, name: string): Promise<Studio> => {
    if(isOffline || !db) {
        await offlineWarning('createStudio');
        const newStudio: Studio = { id: `offline_studio_${Date.now()}`, name, configOverrides: {} };
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) org.studios.push(newStudio);
        return newStudio;
    }
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (!orgDoc.exists()) throw new Error("Organisationen hittades inte.");
    const org = orgDoc.data() as Organization;
    const newStudio: Studio = { id: `studio_${Date.now()}`, name, configOverrides: {} };
    const newStudios = [...org.studios, newStudio];
    await updateDoc(doc(db, 'organizations', organizationId), { studios: newStudios });
    return newStudio;
};

export const updateStudio = async (organizationId: string, studioId: string, name: string): Promise<Studio> => {
    if(isOffline || !db) {
        await offlineWarning('updateStudio');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        const studio = org?.studios.find(s => s.id === studioId);
        if(!studio) throw new Error("Offline studio not found");
        studio.name = name;
        return studio;
    }
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (!orgDoc.exists()) throw new Error("Organisationen hittades inte.");
    const org = orgDoc.data() as Organization;

    let updatedStudio: Studio | null = null;
    const newStudios = org.studios.map(s => {
        if (s.id === studioId) {
            updatedStudio = { ...s, name };
            return updatedStudio;
        }
        return s;
    });

    if (!updatedStudio) throw new Error("Studion hittades inte.");

    await updateDoc(doc(db, 'organizations', organizationId), { studios: newStudios });
    return updatedStudio;
};

export const deleteStudio = async (organizationId: string, studioId: string): Promise<void> => {
    if(isOffline || !db) {
        await offlineWarning('deleteStudio');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            org.studios = org.studios.filter(s => s.id !== studioId);
        }
        return;
    }
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (!orgDoc.exists()) throw new Error("Organisationen hittades inte.");
    const org = orgDoc.data() as Organization;
    
    const newStudios = org.studios.filter(s => s.id !== studioId);
    
    await updateDoc(doc(db, 'organizations', organizationId), { studios: newStudios });
};


export const getAdminsForOrganization = async (organizationId: string): Promise<UserData[]> => {
    if (isOffline || !db) {
        // Return mock admins for offline mode
        return Promise.resolve([
             MOCK_ORG_ADMIN, // This is a superadmin
             { uid: 'offline_admin_2', email: 'admin@flexibel.app', role: 'organizationadmin', adminRole: 'admin', organizationId: 'org_flexibel_mock' }
        ]);
    }
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("organizationId", "==", organizationId), where("role", "==", "organizationadmin"));
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return [];
    }
    return querySnapshot.docs.map(d => ({ uid: d.id, ...d.data() }) as UserData);
};

export const setAdminRole = async (uid: string, adminRole: 'superadmin' | 'admin'): Promise<void> => {
    if (isOffline || !db) {
        return offlineWarning('setAdminRole');
    }
    await updateDoc(doc(db, 'users', uid), { adminRole });
};

// --- WORKOUTS ---

export const getWorkoutsForOrganization = async (organizationId: string): Promise<Workout[]> => {
    if (isOffline || !db) {
        if (!(window as any).mockWorkouts) (window as any).mockWorkouts = [];
        return Promise.resolve(
            ((window as any).mockWorkouts as Workout[])
            .filter(w => w.organizationId === organizationId)
            .sort((a, b) => (a.title > b.title ? 1 : -1))
        );
    }
    const workoutsCol = collection(db, 'workouts');
    const q = query(workoutsCol, where("organizationId", "==", organizationId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Workout).sort((a, b) => (a.title > b.title ? 1 : -1));
};

export const saveWorkout = async (workout: Workout): Promise<void> => {
    if (isOffline || !db) {
        if (!(window as any).mockWorkouts) (window as any).mockWorkouts = [];
        const workouts: Workout[] = (window as any).mockWorkouts;
        const existingIndex = workouts.findIndex((w: Workout) => w.id === workout.id);
        if (existingIndex > -1) {
            workouts[existingIndex] = workout;
        } else {
            workouts.unshift(workout);
        }
        (window as any).mockWorkouts = workouts;
        return offlineWarning('saveWorkout');
    }
    const workoutDocRef = doc(db, 'workouts', workout.id);
    await setDoc(workoutDocRef, workout, { merge: true });
};

export const deleteWorkout = async (workoutId: string): Promise<void> => {
    if (isOffline || !db) {
        if ((window as any).mockWorkouts) {
            (window as any).mockWorkouts = ((window as any).mockWorkouts as Workout[]).filter((w: Workout) => w.id !== workoutId);
        }
        return offlineWarning('deleteWorkout');
    }
    const workoutDocRef = doc(db, 'workouts', workoutId);
    await deleteDoc(workoutDocRef);
};


// --- SPOTIFY AUTH LOGIC (using localStorage, remains unchanged) ---
const getSpotifyAuthKey = (studioId: string) => `spotify_auth_${studioId}`;
interface SpotifyAuthData { accessToken: string; expiresAt: number; }
export const saveSpotifyAuthData = (studioId: string, accessToken: string, expiresIn: number): void => {
    const expiresAt = new Date().getTime() + expiresIn * 1000;
    localStorage.setItem(getSpotifyAuthKey(studioId), JSON.stringify({ accessToken, expiresAt }));
};
export const getSpotifyAccessToken = async (studioId: string): Promise<string | null> => {
    const storedData = localStorage.getItem(getSpotifyAuthKey(studioId));
    if (!storedData) return null;
    const authData: SpotifyAuthData = JSON.parse(storedData);
    if (new Date().getTime() > authData.expiresAt) {
        localStorage.removeItem(getSpotifyAuthKey(studioId));
        return null;
    }
    return authData.accessToken;
};
export const clearSpotifyAuthData = (studioId: string): void => {
    localStorage.removeItem(getSpotifyAuthKey(studioId));
};
export const getSpotifyAuthUrl = async (studioId: string): Promise<string> => {
    const SPOTIFY_CLIENT_ID = '05a4155a013d42898c5663788c750b37';
    const FAKE_REDIRECT_URI = window.location.origin;
    const scopes = ['streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state', 'user-modify-playback-state'].join(' ');
    return `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(FAKE_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&response_type=token&state=${studioId}&show_dialog=true`;
};