
// sw.js

// Using ES module imports for Firebase in the service worker.
// Note: We are using the compat libraries here to match the main app's firebaseService.ts.
// In a real-world scenario, migrating fully to the modular v9+ SDK would be ideal.
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js");

const STATIC_CACHE_NAME = 'smart-skarm-static-v1';
const DYNAMIC_CACHE_NAME = 'smart-skarm-dynamic-v1';
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkdGj5XOkTdpfhSpcvO_TwDTjy204qTq0",
  authDomain: "gym-screen.firebaseapp.com",
  projectId: "gym-screen",
  storageBucket: "gym-screen.firebasestorage.app",
  messagingSenderId: "970379052933",
  appId: "1:970379052933:web:0756911ee508d5c8c1a6ec"
};

// --- IndexedDB Helpers (copied from utils/idb.ts for self-containment) ---
const DB_NAME = 'smart-skarm-db';
const DB_VERSION = 1;
const OUTBOX_STORE = 'offline-writes-outbox';

function getDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject('Error opening IndexedDB');
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function getAllFromOutbox() {
    const db = await getDb();
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const store = tx.objectStore(OUTBOX_STORE);
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function clearOutbox() {
    const db = await getDb();
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(OUTBOX_STORE);
    return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}
// --- End IndexedDB Helpers ---


// --- Service Worker Lifecycle ---
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  // No pre-caching, we'll cache on the fly.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});


// --- Fetch Interception ---
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // KRITISK FIX: Ignorera alla anrop till Firestore och Google Auth APIer helt.
  // Service workern ska inte försöka cacha realtids-trafik.
  if (url.hostname.includes('firestore.googleapis.com') || 
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com')) {
    return; // Låt webbläsaren hantera dessa direkt utan SW-inblandning
  }

  // Serve app shell from cache first
  if (url.origin === self.location.origin && (request.destination === 'document' || request.destination === 'script' || request.destination === 'style')) {
    event.respondWith(caches.match(request).then(response => response || fetch(request)));
    return;
  }

  // Use Stale-While-Revalidate for CDNs
  if (url.hostname.includes('esm.sh') || url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('tailwindcss.com')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  
  // Let other requests pass through (e.g., Firebase Storage uploads)
  event.respondWith(fetch(request));
});


async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    // Only cache successful GET requests
    if (networkResponse.ok && request.method === 'GET') {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(err => {
      console.warn(`[SW] Network fetch failed for ${request.url}`, err);
  });

  return cachedResponse || fetchPromise;
}


// --- Background Sync ---
self.addEventListener('sync', event => {
  console.log('[SW] Background sync event triggered:', event.tag);
  if (event.tag === 'offline-writes') {
    event.waitUntil(processOutbox());
  }
});

async function processOutbox() {
  console.log('[SW] Processing offline outbox...');
  let firebaseApp;
  try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.firestore();
    
    const items = await getAllFromOutbox();
    if (items.length === 0) {
      console.log('[SW] Outbox is empty. Nothing to sync.');
      return;
    }
    
    console.log(`[SW] Syncing ${items.length} items from outbox.`);

    const promises = items.map(item => {
        switch(item.operation) {
            case 'saveWorkout':
                return db.collection('workouts').doc(item.payload.id).set(item.payload, { merge: true });
            case 'deleteWorkout':
                return db.collection('workouts').doc(item.payload.workoutId).delete();
            // Add other operations here as needed
            default:
                console.error(`[SW] Unknown outbox operation: ${item.operation}`);
                return Promise.resolve();
        }
    });

    await Promise.all(promises);
    await clearOutbox();
    
    console.log('[SW] Outbox synced and cleared successfully.');

  } catch (error) {
    console.error('[SW] Error processing outbox:', error);
    // Don't clear outbox if there was an error, so we can retry next time.
  } finally {
      if(firebaseApp) {
          firebaseApp.delete();
      }
  }
}
