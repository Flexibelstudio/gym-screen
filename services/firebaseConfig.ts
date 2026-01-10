
// Firebase konfiguration
// Hanterar både Vite-miljö och miljöer utan import.meta.env (som AI Studio preview)
const getEnv = (key: string): string => {
    try {
        // @ts-ignore
        return (import.meta.env && import.meta.env[key]) || '';
    } catch (e) {
        return '';
    }
};

export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};
