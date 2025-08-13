import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

import { Studio, StudioConfig, Organization, CustomPage, UserData, Workout } from '../types';
import { MOCK_ORGANIZATIONS, MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN } from '../data/mockData';

// =========================================================================
//  DEV TOGGLE: Set to 'true' to force offline mode for development.
//  This will enable the developer toolbar for simulating user roles.
//  Set to 'false' for normal online operation (production mode).
// =========================================================================
const FORCE_OFFLINE_FOR_DEV = false;
// =========================================================================

let app: firebase.app.App | null = null;
let auth: firebase.auth.Auth | null = null;
let db: firebase.firestore.Firestore | null = null;
export let isOffline = false;

// Create config from environment variables for security and flexibility.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

try {
  if (FORCE_OFFLINE_FOR_DEV) {
    throw new Error("Forcing offline mode for development via toggle.");
  }
  
  // Verify that all Firebase config values are provided via environment variables.
  const allConfigValuesPresent = Object.values(firebaseConfig).every(val => val && typeof val === 'string' && val.length > 0);
  if (!allConfigValuesPresent) {
      throw new Error("Firebase configuration from environment variables is incomplete or missing.");
  }

  // Check if Firebase is already initialized to prevent errors.
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app(); // Use existing app
  }
  
  auth = firebase.auth();
  db = firebase.firestore();
  console.log("Firebase initialized successfully. Running in ONLINE mode.");
} catch (error) {
  if (FORCE_OFFLINE_FOR_DEV) {
      console.warn("RUNNING IN OFFLINE MODE (forced for development).");
  } else {
      console.warn("Firebase initialization failed. Falling back to OFFLINE mode.", error);
  }
  isOffline = true;
}

// --- Auth Functions ---
export const onAuthChange = (callback: (user: firebase.User | null) => void) => {
    if (isOffline || !auth) {
        // In offline mode, we simulate an authenticated system owner for testing.
        callback({ uid: 'offline_owner_uid', isAnonymous: false } as firebase.User);
        return () => {}; // Return an empty unsubscribe function
    }
    return auth.onAuthStateChanged(callback);
};

export const signIn = (email: string, password: string): Promise<firebase.User> => {
    if (isOffline || !auth) {
        if(email === MOCK_SYSTEM_OWNER.email) {
            return Promise.resolve({ uid: MOCK_SYSTEM_OWNER.uid, isAnonymous: false } as firebase.User);
        }
        return Promise.reject(new Error("Offline mode: Cannot sign in."));
    }
    return auth.signInWithEmailAndPassword(email, password).then(userCredential => userCredential.user as firebase.User);
};

export const signInAsStudio = (): Promise<firebase.User> => {
    if (isOffline || !auth) {
         return Promise.resolve({ uid: 'offline_studio_uid', isAnonymous: true } as firebase.User);
    }
    return auth.signInAnonymously().then(userCredential => userCredential.user as firebase.User);
};

export const signOut = (): Promise<void> => {
     if (isOffline || !auth) {
        return Promise.resolve();
    }
    return auth.signOut();
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
    const userDocRef = db.collection('users').doc(uid);
    const docSnap = await userDocRef.get();
    if (docSnap.exists) {
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
    const querySnapshot = await db.collection('organizations').get();
    if (querySnapshot.empty) {
      console.log("No organizations found in Firestore.");
      return [];
    }
    return querySnapshot.docs.map(d => d.data() as Organization);
};

const getUpdatedOrg = async (organizationId: string): Promise<Organization> => {
    if(isOffline || !db) return Promise.resolve(MOCK_ORGANIZATIONS.find(o => o.id === organizationId)!);
    const updatedDoc = await db.collection('organizations').doc(organizationId).get();
    if (!updatedDoc.exists) throw new Error("Organisationen försvann.");
    return updatedDoc.data() as Organization;
};

export const createOrganization = async (name: string, subdomain: string): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('createOrganization');
        const newOrg: Organization = { id: `offline_org_${Date.now()}`, name, subdomain, studios: [], passwords: { coach: '1234'}, globalConfig: MOCK_ORGANIZATIONS[0].globalConfig };
        MOCK_ORGANIZATIONS.push(newOrg);
        return newOrg;
    }
    const q = db.collection('organizations').where("subdomain", "==", subdomain.toLowerCase());
    if (!(await q.get()).empty) throw new Error(`Subdomänen '${subdomain}' är redan upptagen.`);
    
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
    await db.collection('organizations').doc(newOrg.id).set(newOrg);
    return newOrg;
};

export const updateOrganization = async (organizationId: string, name: string, subdomain: string): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganization');
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ name, subdomain });
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
    await db.collection('organizations').doc(organizationId).delete();
};

export const updateOrganizationPasswords = async (organizationId: string, passwords: Organization['passwords']): Promise<Organization> => {
    if(isOffline || !db) {
         await offlineWarning('updateOrganizationPasswords');
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ passwords });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationLogos = async (organizationId: string, logos: { light?: string, dark?: string }): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationLogos');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            org.logoUrlLight = logos.light;
            org.logoUrlDark = logos.dark;
        }
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ 
        logoUrlLight: logos.light,
        logoUrlDark: logos.dark
    });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationPrimaryColor = async (organizationId: string, primaryColor: string): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationPrimaryColor');
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ primaryColor });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationCustomPages = async (organizationId: string, customPages: CustomPage[]): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationCustomPages');
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ customPages });
    return getUpdatedOrg(organizationId);
};

export const updateGlobalConfig = async (organizationId: string, newConfig: StudioConfig): Promise<void> => {
    if(isOffline || !db) {
        await offlineWarning('updateGlobalConfig');
        return;
    }
    await db.collection('organizations').doc(organizationId).update({ globalConfig: newConfig });
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
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) throw new Error("Organisationen hittades inte.");
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

    await db.collection('organizations').doc(organizationId).update({ studios: newStudios });
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
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) throw new Error("Organisationen hittades inte.");
    const org = orgDoc.data() as Organization;
    const newStudio: Studio = { id: `studio_${Date.now()}`, name, configOverrides: {} };
    const newStudios = [...org.studios, newStudio];
    await db.collection('organizations').doc(organizationId).update({ studios: newStudios });
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
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) throw new Error("Organisationen hittades inte.");
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

    await db.collection('organizations').doc(organizationId).update({ studios: newStudios });
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
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) throw new Error("Organisationen hittades inte.");
    const org = orgDoc.data() as Organization;
    
    const newStudios = org.studios.filter(s => s.id !== studioId);
    
    await db.collection('organizations').doc(organizationId).update({ studios: newStudios });
};


export const getAdminsForOrganization = async (organizationId: string): Promise<UserData[]> => {
    if (isOffline || !db) {
        // Return mock admins for offline mode
        return Promise.resolve([
             MOCK_ORG_ADMIN, // This is a superadmin
             { uid: 'offline_admin_2', email: 'admin@flexibel.app', role: 'organizationadmin', adminRole: 'admin', organizationId: 'org_flexibel_mock' }
        ]);
    }
    const usersRef = db.collection('users');
    const q = usersRef.where("organizationId", "==", organizationId).where("role", "==", "organizationadmin");
    
    const querySnapshot = await q.get();
    if (querySnapshot.empty) {
      return [];
    }
    return querySnapshot.docs.map(d => ({ uid: d.id, ...d.data() }) as UserData);
};

export const setAdminRole = async (uid: string, adminRole: 'superadmin' | 'admin'): Promise<void> => {
    if (isOffline || !db) {
        return offlineWarning('setAdminRole');
    }
    await db.collection('users').doc(uid).update({ adminRole });
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
    const workoutsCol = db.collection('workouts');
    const q = workoutsCol.where("organizationId", "==", organizationId);
    const querySnapshot = await q.get();
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
    const workoutDocRef = db.collection('workouts').doc(workout.id);
    await workoutDocRef.set(workout, { merge: true });
};

export const deleteWorkout = async (workoutId: string): Promise<void> => {
    if (isOffline || !db) {
        if ((window as any).mockWorkouts) {
            (window as any).mockWorkouts = ((window as any).mockWorkouts as Workout[]).filter((w: Workout) => w.id !== workoutId);
        }
        return offlineWarning('deleteWorkout');
    }
    const workoutDocRef = db.collection('workouts').doc(workoutId);
    await workoutDocRef.delete();
};

// --- Spotify Integration ---

// NOTE: In a real production app, these functions would be Cloud Functions
// to securely handle the OAuth flow and token management. For this frontend-only
// project, we are simulating this by storing tokens in Firestore, which is
// NOT a secure practice for refresh tokens.

export const getSpotifyAuthUrl = (studioId: string): Promise<string> => {
    // This would call a cloud function which returns the Spotify auth URL.
    // For now, we return a placeholder.
    return Promise.resolve(`https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&...&state=${studioId}`);
};

export const saveSpotifyAuthData = (studioId: string, accessToken: string, expiresIn: number): Promise<void> => {
    if (isOffline || !db) return offlineWarning('saveSpotifyAuthData');
    const expiryDate = new Date().getTime() + expiresIn * 1000;
    return db.collection('spotify_tokens').doc(studioId).set({
        accessToken,
        expiryDate
    }, { merge: true });
};

export const clearSpotifyAuthData = (studioId: string): Promise<void> => {
    if (isOffline || !db) return offlineWarning('clearSpotifyAuthData');
    return db.collection('spotify_tokens').doc(studioId).delete();
};

export const getSpotifyAccessToken = async (studioId: string): Promise<string | null> => {
    if (isOffline || !db) {
        // No token management in offline mode
        return Promise.resolve(null);
    }
    const tokenDoc = await db.collection('spotify_tokens').doc(studioId).get();
    if (!tokenDoc.exists) return null;

    const data = tokenDoc.data() as { accessToken: string, expiryDate: number };
    if (new Date().getTime() > data.expiryDate) {
        // Token expired. A real app would use a refresh token here via a cloud function.
        await clearSpotifyAuthData(studioId);
        return null;
    }
    return data.accessToken;
};
