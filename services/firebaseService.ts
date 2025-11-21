import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/functions'; // Use compat for functions
import { firebaseConfig } from './firebaseConfig';
import { queueOfflineWrite } from '../utils/idb';

import { Studio, StudioConfig, Organization, CustomPage, UserData, Workout, InfoCarousel, DisplayWindow, BankExercise, SuggestedExercise, Exercise, WorkoutResult, WorkoutBlock, CompanyDetails, SmartScreenPricing, HyroxRace } from '../types';
import { MOCK_ORGANIZATIONS, MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN, MOCK_EXERCISE_BANK, MOCK_SUGGESTED_EXERCISES, MOCK_WORKOUT_RESULTS, MOCK_SMART_SCREEN_PRICING, MOCK_RACES } from '../data/mockData';

export const isOffline = process.env.NODE_ENV !== 'production';


let app: firebase.app.App | null = null;
let auth: firebase.auth.Auth | null = null;
let db: firebase.firestore.Firestore | null = null;
let storage: firebase.storage.Storage | null = null;

if (isOffline) {
    console.warn("RUNNING IN OFFLINE (DEVELOPMENT) MODE. No data will be sent to Firebase.");
} else {
    try {
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app(); 
        }
        
        auth = firebase.auth();
        db = firebase.firestore();
        storage = firebase.storage();
        
        const seedExerciseBankIfNeeded = async () => {
            if (!db) return;
            const exerciseBankRef = db.collection('exerciseBank');
            try {
                const snapshot = await exerciseBankRef.limit(1).get();
                if (snapshot.empty) {
                    console.log("Firestore 'exerciseBank' is empty. Seeding from local mock data...");
                    const batch = db.batch();
                    MOCK_EXERCISE_BANK.forEach(exercise => {
                        const docRef = exerciseBankRef.doc(exercise.id); 
                        batch.set(docRef, exercise);
                    });
                    await batch.commit();
                    console.log(`Successfully seeded exercise bank with ${MOCK_EXERCISE_BANK.length} exercises.`);
                }
            } catch (error) {
                console.error("Error during exercise bank seeding check:", error);
            }
        };
        seedExerciseBankIfNeeded();
        
        console.log("Firebase initialized successfully. Running in ONLINE (PRODUCTION) mode.");
    } catch (error) {
        console.error("CRITICAL: Firebase initialization failed in production mode. The app will not function correctly.", error);
    }
}


// --- Auth Functions ---
export const onAuthChange = (callback: (user: firebase.User | null) => void) => {
    if (isOffline || !auth) {
        callback({ uid: 'offline_owner_uid', isAnonymous: false } as firebase.User);
        return () => {}; 
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

export const sendPasswordResetEmail = (email: string): Promise<void> => {
    if (isOffline || !auth) {
        console.warn(`OFFLINE MODE: Password reset for ${email} simulated.`);
        if (!email.includes('@')) { 
             return Promise.reject(new Error("Invalid email format."));
        }
        return Promise.resolve();
    }
    return auth.sendPasswordResetEmail(email);
};

export const clearSpotifyAuthData = (studioId: string): void => {
    console.warn(`Spotify feature not fully implemented. clearSpotifyAuthData called for ${studioId}.`);
    localStorage.removeItem(`spotify_token_${studioId}`);
    localStorage.removeItem(`spotify_expiry_${studioId}`);
};

export const getSpotifyAccessToken = async (studioId: string): Promise<string | null> => {
    console.warn(`Spotify feature not fully implemented. getSpotifyAccessToken called for ${studioId}.`);
    const token = localStorage.getItem(`spotify_token_${studioId}`);
    const expiry = localStorage.getItem(`spotify_expiry_${studioId}`);
    
    if (token && expiry && new Date().getTime() < Number(expiry)) {
        return token;
    }
    
    clearSpotifyAuthData(studioId);
    return null;
};

export const saveSpotifyAuthData = (studioId: string, accessToken: string, expiresIn: number): void => {
    console.warn(`Spotify feature not fully implemented. saveSpotifyAuthData called for ${studioId}.`);
    const expiryTime = new Date().getTime() + expiresIn * 1000;
    localStorage.setItem(`spotify_token_${studioId}`, accessToken);
    localStorage.setItem(`spotify_expiry_${studioId}`, expiryTime.toString());
};

export const getSpotifyAuthUrl = async (studioId: string): Promise<string> => {
    console.warn(`Spotify feature not fully implemented. getSpotifyAuthUrl called for ${studioId}.`);
    return ``;
};


const offlineWarning = (operation: string) => {
    console.warn(`OFFLINE MODE: Operation "${operation}" was not sent to the server.`);
    return Promise.resolve();
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
}

export const uploadImage = async (path: string, image: File | string): Promise<string> => {
    if (typeof image === 'string' && !image.startsWith('data:image')) {
        return image;
    }
    
    if (isOffline || !storage) {
        console.warn(`OFFLINE: File upload skipped for path: ${path}`);
        return `https://firebasestorage.googleapis.com/v0/b/gym-screen.appspot.com/o/placeholders%2Fplaceholder.jpg?alt=media&token=e6a3c20c-7221-42e1-a20c-3a32d16a12a5`;
    }
    
    let fileToUpload: Blob;
    if (typeof image === 'string') {
        fileToUpload = await dataUrlToBlob(image);
    } else {
        fileToUpload = image;
    }

    const storageRef = storage.ref();
    const fileRef = storageRef.child(path);
    const snapshot = await fileRef.put(fileToUpload);
    return snapshot.ref.getDownloadURL();
};

export const deleteImageByUrl = async (imageUrl: string): Promise<void> => {
    if (isOffline || !storage || !imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) {
        if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
            console.warn(`OFFLINE: Deletion skipped for image: ${imageUrl}`);
        }
        return Promise.resolve();
    }

    try {
        const imageRef = storage.refFromURL(imageUrl);
        await imageRef.delete();
    } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            console.warn(`Image not found in Storage, skipping deletion: ${imageUrl}`);
        } else {
            console.error(`Error deleting image from Storage: ${imageUrl}`, error);
        }
    }
};


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

export const listenToOrganizationChanges = (
    organizationId: string,
    onUpdate: (org: Organization) => void,
): (() => void) => {
    if (isOffline || !db) {
        return () => {}; 
    }
    const docRef = db.collection('organizations').doc(organizationId);
    const unsubscribe = docRef.onSnapshot(
        (docSnap) => {
            if (docSnap.exists) {
                onUpdate(docSnap.data() as Organization);
            } else {
                console.warn(`Organization document with ID ${organizationId} does not exist.`);
            }
        },
        (error) => {
            console.error(`Error listening to organization ${organizationId}:`, error);
        }
    );
    return unsubscribe;
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

export const updateOrganizationInfoCarousel = async (organizationId: string, infoCarousel: InfoCarousel): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationInfoCarousel');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            org.infoCarousel = infoCarousel;
        }
        return getUpdatedOrg(organizationId);
    }

    const cleanedCarousel = {
      ...infoCarousel,
      messages: (infoCarousel.messages || []).map(msg => ({
        ...msg,
        imageUrl: msg.imageUrl || '',
        startDate: msg.startDate || '',
        endDate: msg.endDate || '',
      })),
    };

    await db.collection('organizations').doc(organizationId).update({ infoCarousel: cleanedCarousel });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationDisplayWindows = async (organizationId: string, displayWindows: DisplayWindow[]): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationDisplayWindows');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            org.displayWindows = displayWindows;
        }
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ displayWindows });
    return getUpdatedOrg(organizationId);
};

export const updateExerciseImageOverride = async (organizationId: string, exerciseId: string, imageUrl: string | null): Promise<Organization> => {
    if (isOffline || !db) {
        await offlineWarning('updateExerciseImageOverride');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            if (!org.exerciseOverrides) {
                org.exerciseOverrides = {};
            }
            if (imageUrl) {
                org.exerciseOverrides[exerciseId] = { imageUrl };
            } else {
                delete org.exerciseOverrides[exerciseId];
            }
        }
        return getUpdatedOrg(organizationId);
    }
    const orgRef = db.collection('organizations').doc(organizationId);

    if (imageUrl) {
        await orgRef.update({
            [`exerciseOverrides.${exerciseId}`]: { imageUrl }
        });
    } else {
        await orgRef.update({
            [`exerciseOverrides.${exerciseId}`]: firebase.firestore.FieldValue.delete()
        });
    }

    return getUpdatedOrg(organizationId);
};

export const updateOrganizationCompanyDetails = async (organizationId: string, companyDetails: CompanyDetails): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationCompanyDetails');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            org.companyDetails = companyDetails;
        }
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ companyDetails });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationDiscount = async (organizationId: string, discount: { type: 'percentage' | 'fixed', value: number }): Promise<Organization> => {
    if (isOffline || !db) {
        await offlineWarning('updateOrganizationDiscount');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            org.discountType = discount.type;
            org.discountValue = discount.value;
            delete org.discountPercentage; // Clean up old field
        }
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ 
        discountType: discount.type, 
        discountValue: discount.value,
        discountPercentage: firebase.firestore.FieldValue.delete(), // Clean up old field
    });
    return getUpdatedOrg(organizationId);
};

export const updateOrganizationBilledStatus = async (organizationId: string, monthToMarkAsBilled: string): Promise<Organization> => {
    if(isOffline || !db) {
        await offlineWarning('updateOrganizationBilledStatus');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            org.lastBilledMonth = monthToMarkAsBilled;
            org.lastBilledDate = Date.now();
        }
        return getUpdatedOrg(organizationId);
    }
    await db.collection('organizations').doc(organizationId).update({ 
        lastBilledMonth: monthToMarkAsBilled,
        lastBilledDate: Date.now()
     });
    return getUpdatedOrg(organizationId);
};

export const undoLastBilling = async (organizationId: string): Promise<Organization> => {
    if (isOffline || !db) {
        await offlineWarning('undoLastBilling');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org && org.lastBilledMonth) {
            const [year, month] = org.lastBilledMonth.split('-').map(Number);
            const prevDate = new Date(year, month - 2, 1); // Go back one month from the billed month
            org.lastBilledMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
            delete org.lastBilledDate;
        }
        return getUpdatedOrg(organizationId);
    }
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) throw new Error("Organisationen hittades inte.");
    const org = orgDoc.data() as Organization;

    if (!org.lastBilledMonth) {
        return org;
    }

    const [year, month] = org.lastBilledMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const previousMonthString = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    await db.collection('organizations').doc(organizationId).update({ 
        lastBilledMonth: previousMonthString,
        lastBilledDate: firebase.firestore.FieldValue.delete()
     });

    return getUpdatedOrg(organizationId);
};


export const updateGlobalConfig = async (organizationId: string, newConfig: StudioConfig): Promise<void> => {
    if(isOffline || !db) {
        await offlineWarning('updateGlobalConfig');
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) {
            org.globalConfig = newConfig;
        }
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
    const creationTime = Date.now();
    if(isOffline || !db) {
        await offlineWarning('createStudio');
        const newStudio: Studio = { id: `offline_studio_${creationTime}`, name, createdAt: creationTime, configOverrides: {} };
        const org = MOCK_ORGANIZATIONS.find(o => o.id === organizationId);
        if (org) org.studios.push(newStudio);
        return newStudio;
    }
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) throw new Error("Organisationen hittades inte.");
    const org = orgDoc.data() as Organization;
    const newStudio: Studio = { id: `studio_${creationTime}`, name, createdAt: creationTime, configOverrides: {} };
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
        return Promise.resolve([
             MOCK_ORG_ADMIN, 
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

export const getCoachesForOrganization = async (organizationId: string): Promise<UserData[]> => {
    if (isOffline || !db) {
        return Promise.resolve([
             { uid: 'offline_coach_1', email: 'coach@flexibel.app', role: 'coach', organizationId: 'org_flexibel_mock' }
        ]);
    }
    const usersRef = db.collection('users');
    const q = usersRef.where("organizationId", "==", organizationId).where("role", "==", "coach");
    
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

export const getExerciseBank = async (): Promise<BankExercise[]> => {
    if (isOffline || !db) {
        if (!(window as any).mockExerciseBank) {
            (window as any).mockExerciseBank = JSON.parse(JSON.stringify(MOCK_EXERCISE_BANK));
        }
        return Promise.resolve((window as any).mockExerciseBank);
    }
    const querySnapshot = await db.collection('exerciseBank').orderBy('name').get();
    if (querySnapshot.empty) {
        return [];
    }
    return querySnapshot.docs.map(d => d.data() as BankExercise);
};

export const saveExerciseToBank = async (exercise: BankExercise): Promise<void> => {
    if (!isOffline && !navigator.onLine) {
        await queueOfflineWrite('saveExerciseToBank', { exercise });
        console.log("Offline: Queued saving exercise to bank.");
        return;
    }

    if (isOffline || !db) {
        if (!(window as any).mockExerciseBank) {
            (window as any).mockExerciseBank = JSON.parse(JSON.stringify(MOCK_EXERCISE_BANK));
        }
        const exercises: BankExercise[] = (window as any).mockExerciseBank;
        const existingIndex = exercises.findIndex((ex: BankExercise) => ex.id === exercise.id);
        if (existingIndex > -1) {
            exercises[existingIndex] = exercise;
        } else {
            exercises.unshift(exercise);
        }
        (window as any).mockExerciseBank = exercises.sort((a,b) => a.name.localeCompare(b.name));
        return offlineWarning('saveExerciseToBank');
    }
    const exerciseDocRef = db.collection('exerciseBank').doc(exercise.id);

    // Get the existing document to check for an old image URL
    const doc = await exerciseDocRef.get();
    if (doc.exists) {
        const oldExercise = doc.data() as BankExercise;
        const oldImageUrl = oldExercise.imageUrl;
        // If the URL has changed and the old one existed, delete the old one
        if (oldImageUrl && oldImageUrl !== exercise.imageUrl) {
            await deleteImageByUrl(oldImageUrl);
        }
    }

    await exerciseDocRef.set(exercise, { merge: true });
};

export const deleteExerciseFromBank = async (exerciseId: string): Promise<void> => {
    if (!isOffline && !navigator.onLine) {
        await queueOfflineWrite('deleteExerciseFromBank', { exerciseId });
        console.log("Offline: Queued deleting exercise from bank.");
        return;
    }
    
    if (isOffline || !db) {
        if ((window as any).mockExerciseBank) {
            (window as any).mockExerciseBank = ((window as any).mockExerciseBank as BankExercise[]).filter((ex: BankExercise) => ex.id !== exerciseId);
        }
        return offlineWarning('deleteExerciseFromBank');
    }
    const exerciseDocRef = db.collection('exerciseBank').doc(exerciseId);
    
    // First, get the document to find the imageUrl
    const doc = await exerciseDocRef.get();
    if (doc.exists) {
        const exercise = doc.data() as BankExercise;
        if (exercise.imageUrl) {
            await deleteImageByUrl(exercise.imageUrl);
        }
    }
    
    await exerciseDocRef.delete();
};

export const getSuggestedExercises = async (): Promise<SuggestedExercise[]> => {
    if (isOffline || !db) {
        if (!(window as any).mockSuggestedExercises) (window as any).mockSuggestedExercises = [...MOCK_SUGGESTED_EXERCISES];
        return Promise.resolve((window as any).mockSuggestedExercises);
    }
    const querySnapshot = await db.collection('exerciseSuggestions').orderBy('name').get();
    if (querySnapshot.empty) {
        return [];
    }
    return querySnapshot.docs.map(d => d.data() as SuggestedExercise);
};

export const approveExerciseSuggestion = async (suggestion: SuggestedExercise): Promise<void> => {
    if (isOffline || !db) {
        const bankExercise: BankExercise = {
            id: suggestion.id.replace('sugg_', 'bank_'), 
            name: suggestion.name,
            description: suggestion.description,
            imageUrl: suggestion.imageUrl,
        };
        await saveExerciseToBank(bankExercise);
        await deleteExerciseSuggestion(suggestion.id);
        return offlineWarning('approveExerciseSuggestion');
    }
    const { sourceWorkoutTitle, organizationId, ...bankExerciseData } = suggestion;
    
    const bankExercise: BankExercise = {
        ...bankExerciseData,
        id: `bank_${Date.now()}`
    };
    await saveExerciseToBank(bankExercise);
    await deleteExerciseSuggestion(suggestion.id);
};

export const deleteExerciseSuggestion = async (suggestionId: string): Promise<void> => {
    if (isOffline || !db) {
        if (!(window as any).mockSuggestedExercises) (window as any).mockSuggestedExercises = [...MOCK_SUGGESTED_EXERCISES];
        (window as any).mockSuggestedExercises = ((window as any).mockSuggestedExercises as SuggestedExercise[]).filter(s => s.id !== suggestionId);
        return offlineWarning('deleteExerciseSuggestion');
    }
    await db.collection('exerciseSuggestions').doc(suggestionId).delete();
};

export const updateExerciseSuggestion = async (suggestion: SuggestedExercise): Promise<void> => {
     if (isOffline || !db) {
        if (!(window as any).mockSuggestedExercises) (window as any).mockSuggestedExercises = [...MOCK_SUGGESTED_EXERCISES];
        const suggestions: SuggestedExercise[] = (window as any).mockSuggestedExercises;
        const index = suggestions.findIndex(s => s.id === suggestion.id);
        if (index > -1) {
            suggestions[index] = suggestion;
        }
        return offlineWarning('updateExerciseSuggestion');
    }
    await db.collection('exerciseSuggestions').doc(suggestion.id).set(suggestion, { merge: true });
};


export const addExerciseSuggestion = async (exercise: Exercise, workout: Workout): Promise<void> => {
    if (exercise.isFromBank || exercise.isFromAI) {
        return;
    }

    if (isOffline || !db) {
        const normalizedName = exercise.name.trim().toLowerCase();
        if (!normalizedName) return;

        const bank = await getExerciseBank(); 
        const existsInBank = bank.some(be => be.name.trim().toLowerCase() === normalizedName);
        if (existsInBank) return;
        
        const suggestions = await getSuggestedExercises();
        const existsInSuggestions = suggestions.some(se => se.name.trim().toLowerCase() === normalizedName);
        if (existsInSuggestions) return;
        
        const newSuggestion: SuggestedExercise = {
            id: `sugg_${Date.now()}`,
            name: exercise.name,
            description: exercise.description || '',
            imageUrl: exercise.imageUrl || '',
            organizationId: workout.organizationId!,
            sourceWorkoutTitle: workout.title,
        };

        (window as any).mockSuggestedExercises.push(newSuggestion);
        return offlineWarning('addExerciseSuggestion');
    }

    const normalizedName = exercise.name.trim().toLowerCase();
    if (!normalizedName) return;
    
    const bankRef = db.collection('exerciseBank');
    const bankQuery = bankRef.where('name', '==', exercise.name.trim());
    const bankSnapshot = await bankQuery.get();
    if (!bankSnapshot.empty) {
        return; 
    }

    const suggestionsRef = db.collection('exerciseSuggestions');
    const suggQuery = suggestionsRef.where('name', '==', exercise.name.trim());
    const suggSnapshot = await suggQuery.get();
    if (!suggSnapshot.empty) {
        return; 
    }

    const suggestionId = `sugg_${Date.now()}`;
    const newSuggestion: SuggestedExercise = {
        id: suggestionId,
        name: exercise.name.trim(),
        description: exercise.description || '',
        imageUrl: exercise.imageUrl || '',
        sourceWorkoutTitle: workout.title,
        organizationId: workout.organizationId!,
    };
    
    await suggestionsRef.doc(suggestionId).set(newSuggestion);
};

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
    if (!isOffline && !navigator.onLine) {
        await queueOfflineWrite('saveWorkout', workout);
        console.log("Offline: Queued workout save.");
        return;
    }

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
     if (!isOffline && !navigator.onLine) {
        await queueOfflineWrite('deleteWorkout', { workoutId });
        console.log("Offline: Queued workout deletion.");
        return;
    }
    
    if (isOffline || !db) {
        if ((window as any).mockWorkouts) {
            (window as any).mockWorkouts = ((window as any).mockWorkouts as Workout[]).filter((w: Workout) => w.id !== workoutId);
        }
        return offlineWarning('deleteWorkout');
    }
    const workoutDocRef = db.collection('workouts').doc(workoutId);
    
    // First, get the document to find all image URLs
    const doc = await workoutDocRef.get();
    if (doc.exists) {
        const workout = doc.data() as Workout;
        const imageUrls = (workout.blocks || [])
            .flatMap((block: WorkoutBlock) => (block.exercises || []).map(ex => ex.imageUrl).filter(Boolean)) as string[];
        
        if (imageUrls.length > 0) {
            const deletePromises = imageUrls.map(url => deleteImageByUrl(url));
            await Promise.all(deletePromises);
        }
    }
    
    await workoutDocRef.delete();
};

export const saveWorkoutResult = async (result: WorkoutResult): Promise<void> => {
    if (isOffline || !db) {
        if (!(window as any).mockWorkoutResults) (window as any).mockWorkoutResults = [...MOCK_WORKOUT_RESULTS];
        (window as any).mockWorkoutResults.push(result);
        return offlineWarning('saveWorkoutResult');
    }
    await db.collection('workoutResults').doc(result.id).set(result);
};

export const deleteWorkoutResult = async (resultId: string): Promise<void> => {
    if (isOffline || !db) {
        if ((window as any).mockWorkoutResults) {
            (window as any).mockWorkoutResults = ((window as any).mockWorkoutResults as WorkoutResult[]).filter((r: WorkoutResult) => r.id !== resultId);
        }
        return offlineWarning('deleteWorkoutResult');
    }
    const resultDocRef = db.collection('workoutResults').doc(resultId);
    await resultDocRef.delete();
};

export const getWorkoutResults = async (workoutId: string): Promise<WorkoutResult[]> => {
    if (isOffline || !db) {
        if (!(window as any).mockWorkoutResults) (window as any).mockWorkoutResults = [...MOCK_WORKOUT_RESULTS];
        return Promise.resolve(
            ((window as any).mockWorkoutResults as WorkoutResult[])
            .filter(r => r.workoutId === workoutId)
            .sort((a, b) => a.finishTime - b.finishTime)
        );
    }
    const resultsCol = db.collection('workoutResults');
    const q = resultsCol.where("workoutId", "==", workoutId).orderBy("finishTime", "asc");
    const querySnapshot = await q.get();
    return querySnapshot.docs.map(doc => doc.data() as WorkoutResult);
};

export const updateUserTermsAccepted = async (uid: string): Promise<void> => {
    if (isOffline || !db) {
        console.warn(`OFFLINE: User terms accepted for UID ${uid}`);
        return Promise.resolve();
    }
    // Use Cloud Function to bypass Firestore rules limitation for self-update if rules aren't configured
    const functions = firebase.app().functions('us-central1');
    const acceptTermsFn = functions.httpsCallable('acceptTerms');
    await acceptTermsFn({});
};

export const getSmartScreenPricing = async (): Promise<SmartScreenPricing> => {
    if (isOffline || !db) {
        if (!(window as any).mockSmartScreenPricing) {
            (window as any).mockSmartScreenPricing = MOCK_SMART_SCREEN_PRICING;
        }
        return Promise.resolve((window as any).mockSmartScreenPricing);
    }
    const docRef = db.collection('system').doc('pricing');
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        return docSnap.data() as SmartScreenPricing;
    }
    // Return a default if it doesn't exist
    return { firstScreenPrice: 995, additionalScreenPrice: 995 };
};

export const updateSmartScreenPricing = async (pricing: SmartScreenPricing): Promise<void> => {
    if (isOffline || !db) {
         if ((window as any).mockSmartScreenPricing) {
            (window as any).mockSmartScreenPricing = pricing;
        }
        return offlineWarning('updateSmartScreenPricing');
    }
    const docRef = db.collection('system').doc('pricing');
    await docRef.set(pricing, { merge: true });
};

export const getPastRaces = async (organizationId: string): Promise<HyroxRace[]> => {
    if (isOffline || !db) {
        if (!(window as any).mockRaces) {
            (window as any).mockRaces = [...MOCK_RACES];
        }
        const allRaces: HyroxRace[] = (window as any).mockRaces;
        return Promise.resolve(allRaces.filter(r => r.organizationId === organizationId).sort((a, b) => b.createdAt - a.createdAt));
    }
    const racesCol = db.collection('races');
    const q = racesCol.where("organizationId", "==", organizationId).orderBy("createdAt", "desc");
    const querySnapshot = await q.get();
    return querySnapshot.docs.map(doc => doc.data() as HyroxRace);
};

export const getRace = async (raceId: string): Promise<HyroxRace | null> => {
    if (isOffline || !db) {
        if (!(window as any).mockRaces) {
            (window as any).mockRaces = [...MOCK_RACES];
        }
        const allRaces: HyroxRace[] = (window as any).mockRaces;
        return Promise.resolve(allRaces.find(r => r.id === raceId) || null);
    }
    const raceDoc = await db.collection('races').doc(raceId).get();
    if (raceDoc.exists) {
        return raceDoc.data() as HyroxRace;
    }
    return null;
};

export const saveRace = async (raceData: Omit<HyroxRace, 'id' | 'createdAt' | 'organizationId'>, organizationId: string): Promise<HyroxRace> => {
    if (isOffline || !db) {
        await offlineWarning('saveRace');
        const newRace: HyroxRace = {
            ...raceData,
            id: `mock_race_${Date.now()}`,
            createdAt: Date.now(),
            organizationId,
        };
        if (!(window as any).mockRaces) {
            (window as any).mockRaces = [...MOCK_RACES];
        }
        (window as any).mockRaces.unshift(newRace);
        return newRace;
    }
    const newRaceRef = db.collection('races').doc();
    const newRace: HyroxRace = {
        ...raceData,
        id: newRaceRef.id,
        createdAt: Date.now(),
        organizationId,
    };
    await newRaceRef.set(newRace);
    return newRace;
};