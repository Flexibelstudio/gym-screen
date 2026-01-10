// utils/idb.ts

const DB_NAME = 'smart-skarm-db';
const DB_VERSION = 1;
const OUTBOX_STORE = 'offline-writes-outbox';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                return reject('IndexedDB is not supported');
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject('Error opening IndexedDB');
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
                    db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }
    return dbPromise;
}

export async function addToOutbox(item: { operation: string; payload: any }): Promise<void> {
    try {
        const db = await getDb();
        const tx = db.transaction(OUTBOX_STORE, 'readwrite');
        const store = tx.objectStore(OUTBOX_STORE);
        // Using a promise-based wrapper for the IDBRequest
        await new Promise((resolve, reject) => {
            const req = store.add({ ...item, timestamp: Date.now() });
            req.onsuccess = resolve;
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.error("Failed to add to outbox:", error);
    }
}

async function registerBackgroundSync() {
    try {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            // FIX: Cast registration to 'any' to access the 'sync' property, which is part of the Background Sync API and may not be in default TS types.
            await (registration as any).sync.register('offline-writes');
            console.log('Background sync registered');
        }
    } catch (error) {
        console.error('Background sync registration failed:', error);
    }
}

export async function queueOfflineWrite(operation: string, payload: any) {
    await addToOutbox({ operation, payload });
    await registerBackgroundSync();
}
