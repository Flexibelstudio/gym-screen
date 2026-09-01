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
  User,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode
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
  runTransaction,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
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
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getMessaging, getToken, Messaging, onMessage } from 'firebase/messaging';
import { firebaseConfig } from '../firebaseConfig';

export const listenToForegroundMessages = (callback: (payload: any) => void) => {
    if (isOffline || !messaging) return () => {};
    return onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        callback(payload);
    });
};

// Inloggningens enkla väg (förbi CORS-förhandsfrågan som vissa pekskärmar
// hänger sig på) installeras i index.html, före all annan kod. Se skölden där.

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
export let appCheck: any = null;
export let functions: any = null;
/**
 * Coachkoden ligger i europe-west1, granne med databasen, för att slippa resan
 * över Atlanten mitt i ett pass. Övriga funktioner står kvar i us-central1 —
 * två av dem har fasta webbadresser som Stripe och en extern integration pekar
 * på. Därför två anslutningar.
 */
export let functionsEurope: any = null;

if (!isOffline) {
    try {
        const isNewApp = !getApps().length;
        app = isNewApp ? initializeApp(firebaseConfig) : getApp();
        
        const siteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || '';
        if (typeof window !== 'undefined' && siteKey) {
            appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(siteKey),
                isTokenAutoRefreshEnabled: true
            });
        }
        
        auth = getAuth(app);
        
        try {
            if (isNewApp) {
                db = initializeFirestore(app, {
                    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
                });
            } else {
                db = getFirestore(app);
            }
        } catch (e) {
            console.warn("Could not enable persistence immediately, falling back to default.", e);
            db = getFirestore(app);
        }

        storage = getStorage(app);
        functions = getFunctions(app, 'us-central1');
        functionsEurope = getFunctions(app, 'europe-west1');
        try { (window as any).__bootmark?.('firebase klar'); } catch { /* inget */ }
        
        // Messaging is only supported in browsers that support the required APIs
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            messaging = getMessaging(app);
        }
    } catch (error) {
        console.error("CRITICAL: Firebase init failed.", error);
    }
}

export const sanitizeData = <T>(data: T): T => JSON.parse(JSON.stringify(data));

export const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const getPBId = (name: string) => name.toLowerCase().trim().replace(/[^\w]/g, '_');

export const normalizeString = (str: string) => str.toLowerCase().trim().replace(/[^\w\såäöÅÄÖ]/g, '');

export const getLeaderboardDocId = (orgId: string, locationId: string | "all") => {
    const d = new Date();
    const dISO = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dISO.getUTCDay() || 7;
    dISO.setUTCDate(dISO.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dISO.getUTCFullYear(),0,1));
    const week = Math.ceil((((dISO.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    const year = dISO.getUTCFullYear();
    return `${orgId}_${locationId}_${year}_W${week}`;
};
