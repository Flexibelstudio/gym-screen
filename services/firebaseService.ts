
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, query, where, getDoc, Firestore } from 'firebase/firestore';
import { Studio, StudioConfig, Organization, CustomPage } from '../types';
import { firebaseConfig } from './firebaseConfig';

// --- SEED DATA (used for initial seeding and fallback) ---
const SEED_DATA: Organization[] = [
    {
        id: 'org_flexibel',
        name: 'Flexibel Hälsostudio',
        subdomain: 'flexibel',
        logoUrl: '',
        primaryColor: '#14b8a6',
        passwords: {
            coach: '1234',
            superadmin: 'admin',
        },
        globalConfig: {
            enableBoost: true,
            enableBreathingGuide: true,
            enableWarmup: true,
            customCategories: [
                { id: 'cat_hiit', name: 'HIIT', prompt: `...` },
                { id: 'cat_workout', name: 'Workout', prompt: `...` },
                { id: 'cat_functional', name: 'Funktionell träning', prompt: `...` }
            ]
        },
        studios: [
            { id: 'salem_centrum', name: 'Salem Centrum', configOverrides: { /*...*/ } },
            { id: 'karra_centrum', name: 'Kärra Centrum', configOverrides: { /*...*/ } },
        ],
        customPages: []
    }
];

// --- FALLBACK & STATE MANAGEMENT ---
let db: Firestore | null = null;
let useFirebase = true;
let localOrganizations: Organization[] = JSON.parse(JSON.stringify(SEED_DATA));

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized. App will attempt to use Firestore.");
} catch (e) {
    console.warn("Firebase initialization failed. Falling back to local mock data.", e);
    useFirebase = false;
}

const switchToFallbackMode = (error: any) => {
    if (useFirebase) {
        console.error("Firebase error occurred. Switching to local fallback mode.", error);
        useFirebase = false;
    }
    localOrganizations = JSON.parse(JSON.stringify(SEED_DATA));
};

// --- DATA FUNCTIONS ---

export const getOrganizations = async (): Promise<Organization[]> => {
    if (!useFirebase || !db) {
        console.log("FALLBACK: Using local data for organizations.");
        return Promise.resolve(localOrganizations);
    }
    try {
        const querySnapshot = await getDocs(collection(db, 'organizations'));
        if (querySnapshot.empty) {
            console.log("Firestore is empty, seeding data...");
            await Promise.all(SEED_DATA.map(org => setDoc(doc(db as Firestore, 'organizations', org.id), org)));
            localOrganizations = JSON.parse(JSON.stringify(SEED_DATA));
            return localOrganizations;
        }
        const orgs = querySnapshot.docs.map(d => d.data() as Organization);
        localOrganizations = orgs;
        return orgs;
    } catch (error) {
        switchToFallbackMode(error);
        return getOrganizations();
    }
};

const getUpdatedOrg = async (organizationId: string): Promise<Organization> => {
    if (!useFirebase || !db) {
        return Promise.resolve(localOrganizations.find(o => o.id === organizationId)!);
    }
    const updatedDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (!updatedDoc.exists()) throw new Error("Organisationen försvann.");
    return updatedDoc.data() as Organization;
};

export const createOrganization = async (name: string, subdomain: string): Promise<Organization> => {
    if (!useFirebase || !db) {
        if (localOrganizations.some(o => o.subdomain.toLowerCase() === subdomain.toLowerCase())) throw new Error(`Subdomän upptagen.`);
        const newOrg: Organization = { id: `org_${Date.now()}`, name, subdomain, passwords: { coach: '1234', superadmin: 'admin' }, globalConfig: SEED_DATA[0].globalConfig, studios: [], customPages: [] };
        localOrganizations.push(newOrg);
        return Promise.resolve(newOrg);
    }
    try {
        const q = query(collection(db, 'organizations'), where("subdomain", "==", subdomain.toLowerCase()));
        if (!(await getDocs(q)).empty) throw new Error(`Subdomän upptagen.`);
        const newOrg: Organization = { id: `org_${Date.now()}`, name, subdomain, passwords: { coach: '1234', superadmin: 'admin' }, globalConfig: SEED_DATA[0].globalConfig, studios: [], customPages: [] };
        await setDoc(doc(db, 'organizations', newOrg.id), newOrg);
        localOrganizations.push(newOrg);
        return newOrg;
    } catch (error) {
        switchToFallbackMode(error);
        return createOrganization(name, subdomain);
    }
};

export const updateOrganization = async (organizationId: string, name: string, subdomain: string): Promise<Organization> => {
    if (!useFirebase || !db) {
        const org = localOrganizations.find(o => o.id === organizationId)!;
        org.name = name;
        org.subdomain = subdomain;
        return Promise.resolve(org);
    }
    try {
        await updateDoc(doc(db, 'organizations', organizationId), { name, subdomain });
        const updatedOrg = await getUpdatedOrg(organizationId);
        localOrganizations = localOrganizations.map(o => o.id === organizationId ? updatedOrg : o);
        return updatedOrg;
    } catch (error) {
        switchToFallbackMode(error);
        return updateOrganization(organizationId, name, subdomain);
    }
};

export const updateOrganizationPasswords = async (organizationId: string, passwords: Organization['passwords']): Promise<Organization> => {
    if (!useFirebase || !db) {
        localOrganizations.find(o => o.id === organizationId)!.passwords = passwords;
        return Promise.resolve(localOrganizations.find(o => o.id === organizationId)!);
    }
    try {
        await updateDoc(doc(db, 'organizations', organizationId), { passwords });
        const updatedOrg = await getUpdatedOrg(organizationId);
        localOrganizations.find(o => o.id === organizationId)!.passwords = updatedOrg.passwords;
        return updatedOrg;
    } catch (error) {
        switchToFallbackMode(error);
        return updateOrganizationPasswords(organizationId, passwords);
    }
};

export const updateOrganizationLogo = async (organizationId: string, logoUrl: string): Promise<Organization> => {
    if (!useFirebase || !db) {
        localOrganizations.find(o => o.id === organizationId)!.logoUrl = logoUrl;
        return Promise.resolve(localOrganizations.find(o => o.id === organizationId)!);
    }
    try {
        await updateDoc(doc(db, 'organizations', organizationId), { logoUrl });
        const updatedOrg = await getUpdatedOrg(organizationId);
        localOrganizations.find(o => o.id === organizationId)!.logoUrl = updatedOrg.logoUrl;
        return updatedOrg;
    } catch (error) {
        switchToFallbackMode(error);
        return updateOrganizationLogo(organizationId, logoUrl);
    }
};

export const updateOrganizationPrimaryColor = async (organizationId: string, primaryColor: string): Promise<Organization> => {
    if (!useFirebase || !db) {
        localOrganizations.find(o => o.id === organizationId)!.primaryColor = primaryColor;
        return Promise.resolve(localOrganizations.find(o => o.id === organizationId)!);
    }
    try {
        await updateDoc(doc(db, 'organizations', organizationId), { primaryColor });
        const updatedOrg = await getUpdatedOrg(organizationId);
        localOrganizations.find(o => o.id === organizationId)!.primaryColor = updatedOrg.primaryColor;
        return updatedOrg;
    } catch (error) {
        switchToFallbackMode(error);
        return updateOrganizationPrimaryColor(organizationId, primaryColor);
    }
};

export const updateOrganizationCustomPages = async (organizationId: string, customPages: CustomPage[]): Promise<Organization> => {
    if (!useFirebase || !db) {
        localOrganizations.find(o => o.id === organizationId)!.customPages = customPages;
        return Promise.resolve(localOrganizations.find(o => o.id === organizationId)!);
    }
    try {
        await updateDoc(doc(db, 'organizations', organizationId), { customPages });
        const updatedOrg = await getUpdatedOrg(organizationId);
        localOrganizations.find(o => o.id === organizationId)!.customPages = updatedOrg.customPages;
        return updatedOrg;
    } catch (error) {
        switchToFallbackMode(error);
        return updateOrganizationCustomPages(organizationId, customPages);
    }
};

export const updateGlobalConfig = async (organizationId: string, newConfig: StudioConfig): Promise<void> => {
    if (!useFirebase || !db) {
        localOrganizations.find(o => o.id === organizationId)!.globalConfig = newConfig;
        return Promise.resolve();
    }
    try {
        await updateDoc(doc(db, 'organizations', organizationId), { globalConfig: newConfig });
        localOrganizations.find(o => o.id === organizationId)!.globalConfig = newConfig;
    } catch (error) {
        switchToFallbackMode(error);
        return updateGlobalConfig(organizationId, newConfig);
    }
};

export const updateStudioConfig = async (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>): Promise<Studio> => {
    if (!useFirebase || !db) {
        const org = localOrganizations.find(o => o.id === organizationId)!;
        const studio = org.studios.find(s => s.id === studioId)!;
        studio.configOverrides = newConfigOverrides;
        return Promise.resolve(studio);
    }
    try {
        const org = (await getDoc(doc(db, 'organizations', organizationId))).data() as Organization;
        const newStudios = org.studios.map(s => s.id === studioId ? { ...s, configOverrides: newConfigOverrides } : s);
        await updateDoc(doc(db, 'organizations', organizationId), { studios: newStudios });
        const updatedStudio = newStudios.find(s => s.id === studioId)!;
        localOrganizations.find(o => o.id === organizationId)!.studios = newStudios;
        return updatedStudio;
    } catch (error) {
        switchToFallbackMode(error);
        return updateStudioConfig(organizationId, studioId, newConfigOverrides);
    }
};

export const createStudio = async (organizationId: string, name: string): Promise<Studio> => {
    if (!useFirebase || !db) {
        const org = localOrganizations.find(o => o.id === organizationId)!;
        const newStudio: Studio = { id: `studio_${Date.now()}`, name, configOverrides: {} };
        org.studios.push(newStudio);
        return Promise.resolve(newStudio);
    }
    try {
        const org = (await getDoc(doc(db, 'organizations', organizationId))).data() as Organization;
        const newStudio: Studio = { id: `studio_${Date.now()}`, name, configOverrides: {} };
        const newStudios = [...org.studios, newStudio];
        await updateDoc(doc(db, 'organizations', organizationId), { studios: newStudios });
        localOrganizations.find(o => o.id === organizationId)!.studios = newStudios;
        return newStudio;
    } catch (error) {
        switchToFallbackMode(error);
        return createStudio(organizationId, name);
    }
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
