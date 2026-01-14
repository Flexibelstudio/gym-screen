const getEnv = (key: string): string => {
    try {
        // @ts-ignore
        const val = (import.meta.env && import.meta.env[key]) || '';
        if (val) return val;
        // Fallback for process.env
        return process.env[key] || '';
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