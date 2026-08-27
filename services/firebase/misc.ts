import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, storage, isOffline, sanitizeData, getLeaderboardDocId } from './init';
import { AdminActivity, StudioEvent, CoachNote, SeasonalThemeSetting, HyroxRace, CheckInEvent, GalleryImage, Partner, Lead } from '../../types';

export const saveAdminActivity = async (activity: Omit<AdminActivity, 'id'>) => {
    if (isOffline || !db) return;
    try {
        const ref = doc(collection(db, 'admin_activity'));
        await setDoc(ref, {
            ...sanitizeData(activity),
            id: ref.id
        });
    } catch (e) {
        console.error("Failed to save admin activity:", e);
    }
};

export const getAdminActivitiesPage = async (
    orgId: string,
    pageSize = 25,
    startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ activities: AdminActivity[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> => {
    if (isOffline || !db || !orgId) return { activities: [], lastDoc: null, hasMore: false };
    try {
        let q = query(
            collection(db, 'admin_activity'),
            where('organizationId', '==', orgId),
            orderBy('timestamp', 'desc'),
            limit(pageSize)
        );
        if (startAfterDoc) {
            q = query(
                collection(db, 'admin_activity'),
                where('organizationId', '==', orgId),
                orderBy('timestamp', 'desc'),
                startAfter(startAfterDoc),
                limit(pageSize)
            );
        }
        const snap = await getDocs(q);
        const activities = snap.docs.map(d => d.data() as AdminActivity);
        const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
        const hasMore = snap.docs.length === pageSize;
        return { activities, lastDoc, hasMore };
    } catch (e) {
        console.error("getAdminActivitiesPage failed", e);
        return { activities: [], lastDoc: null, hasMore: false };
    }
};

export const getAdminActivities = async (orgId: string, limitCount = 100): Promise<AdminActivity[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(
            collection(db, 'admin_activity'), 
            where('organizationId', '==', orgId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as AdminActivity);
    } catch (e) {
        console.error("getAdminActivities failed", e);
        return [];
    }
};

export const listenToAdminActivities = (orgId: string, onUpdate: (activities: AdminActivity[]) => void) => {
    if (isOffline || !db || !orgId) return () => {};
    const q = query(
        collection(db, 'admin_activity'), 
        where('organizationId', '==', orgId),
        orderBy('timestamp', 'desc'),
        limit(100)
    );
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => d.data() as AdminActivity));
    });
};


export const getLeaderboardData = async (orgId: string, locationId: string | 'all' = 'all'): Promise<{ memberId: string, name: string, photoUrl: string, count: number, pbs: number }[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const lId = getLeaderboardDocId(orgId, locationId);
        const ref = doc(db, 'leaderboards', lId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return [];

        const data = snap.data();
        if (!data || !data.members) return [];

        return Object.values(data.members) as { memberId: string, name: string, photoUrl: string, count: number, pbs: number }[];
    } catch (e) {
        console.error("getLeaderboardData failed", e);
        return [];
    }
};

export const listenToLeaderboardData = (orgId: string, locationId: string | 'all' | undefined, members: any[], onUpdate: (data: { memberId: string, name: string, photoUrl: string, count: number, pbs: number }[]) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate([]);
        return () => {};
    }
    
    const lId = getLeaderboardDocId(orgId, locationId || 'all');
    const ref = doc(db, 'leaderboards', lId);
    
    return onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            onUpdate([]);
            return;
        }
        const data = snap.data();
        if (!data || !data.members) {
            onUpdate([]);
            return;
        }
        
        const result = Object.values(data.members) as { memberId: string, name: string, photoUrl: string, count: number, pbs: number }[];
        result.sort((a, b) => b.count - a.count);
        onUpdate(result);
    }, (error) => {
        console.error("listenToLeaderboardData failed", error);
    });
};


export const listenForStudioEvents = (orgId: string, callback: (event: StudioEvent) => void) => {
    if (isOffline || !db || !orgId) return () => {};
    
    // VIKTIGT: Vi tar bort 'where timestamp > ...' från databasfrågan eftersom det kräver 
    // ett sammansatt index som kan krångla. Istället hämtar vi de 20 SENASTE händelserna
    // och filtrerar bort gamla events (äldre än 5 min) här i koden istället.
    // Detta gör lyssnaren mycket snabbare och mer pålitlig.

    const q = query(
        collection(db, 'studio_events'), 
        where('organizationId', '==', orgId), 
        orderBy('timestamp', 'desc'), // Hämta nyaste först
        limit(100)
    );

    return onSnapshot(q, (snapshot) => {
        // Eftersom vi sorterar 'desc' (nyast först), kommer snapshot.docChanges() 
        // leverera de nyaste eventen. Vi itererar igenom dem.
        
        // Vi samlar upp ändringarna och reverserar dem så att om vi får en batch 
        // (t.ex. vid start), så processar vi dem i kronologisk ordning (äldst till nyast)
        // för att kön ska kännas naturlig om flera kom in precis samtidigt.
        const changes = snapshot.docChanges();
        
        // Loopa baklänges eller reversera för att hantera ordningen om det behövs, 
        // men för realtidshändelser kommer de en och en.
        changes.forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data() as StudioEvent;
                
                // CLIENT-SIDE FILTERING:
                // Är eventet skapat för mer än 10 minuter sedan? Ignorera det.
                // Vi har en striktare spärr i PBOverlay (5 min), men detta sparar prestanda.
                const timeDiff = Date.now() - data.timestamp;
                if (timeDiff < 10 * 60 * 1000) { 
                    callback(data);
                }
            }
        });
    });
};

export const listenToWeeklyPBs = (orgId: string, onUpdate: (events: StudioEvent[]) => void) => {
    if (isOffline || !db || !orgId) { onUpdate([]); return () => {}; }
    
    // Vi tar bort tidsbegränsningen för att visa de senaste 20 rekorden oavsett när de sattes.
    // Vi filtrerar på 'type' i minnet för att undvika index-fel i Firestore.
    const q = query(
        collection(db, 'studio_events'), 
        where('organizationId', '==', orgId), 
        orderBy('timestamp', 'desc'), 
        limit(100)
    );
    return onSnapshot(q, (snap) => {
        const allEvents = snap.docs.map(d => d.data() as StudioEvent);
        const pbEvents = allEvents.filter(e => e.type === 'pb' || e.type === 'pb_batch');
        onUpdate(pbEvents.slice(0, 20));
    }, (error) => {
        console.error("Error listening to weekly PBs:", error);
    });
};

export const listenToFeedEvents = (orgId: string, onUpdate: (events: StudioEvent[]) => void) => {
    if (isOffline || !db || !orgId) { onUpdate([]); return () => {}; }
    
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const q = query(
        collection(db, 'studio_events'), 
        where('organizationId', '==', orgId), 
        orderBy('timestamp', 'desc'), 
        limit(100)
    );
    return onSnapshot(q, (snap) => {
        const allEvents = snap.docs.map(d => d.data() as StudioEvent);
        const feedEvents = allEvents.filter(e => (e.type === 'milestone' || e.type === 'test' || e.type === 'anniversary' || e.type === 'streak') && (e.timestamp || 0) >= thirtyDaysAgo);
        onUpdate(feedEvents.slice(0, 20));
    }, (error) => {
        console.error("Error listening to feed events:", error);
    });
};

export const listenToMilestoneEvents = listenToFeedEvents;

// --- COACH NOTES ---

export const saveCoachNote = async (noteData: Omit<CoachNote, 'id' | 'createdAt'>): Promise<CoachNote | null> => {
    if (isOffline || !db) return null;
    try {
        const ref = doc(collection(db, 'coachNotes'));
        const newNote: any = {
            ...noteData,
            id: ref.id,
            createdAt: Date.now()
        };
        // Clean up undefined fields
        Object.keys(newNote).forEach(key => newNote[key] === undefined && delete newNote[key]);
        
        await setDoc(ref, newNote);
        return newNote as CoachNote;
    } catch (e) {
        console.error("saveCoachNote failed", e);
        return null;
    }
};

export const updateCoachNote = async (noteId: string, updates: Partial<Omit<CoachNote, 'id' | 'createdAt'>>): Promise<void> => {
    if (isOffline || !db || !noteId) return;
    try {
        const cleanedUpdates: any = { ...updates };
        // Clean up undefined fields
        Object.keys(cleanedUpdates).forEach(key => cleanedUpdates[key] === undefined && delete cleanedUpdates[key]);
        
        await updateDoc(doc(db, 'coachNotes', noteId), cleanedUpdates);
    } catch (e) {
        console.error("updateCoachNote failed", e);
    }
};

export const listenToCoachNotes = (orgId: string, onUpdate: (notes: CoachNote[]) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate([]);
        return () => {};
    }
    const q = query(
        collection(db, 'coachNotes'),
        where('organizationId', '==', orgId),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => d.data() as CoachNote));
    }, (err) => console.error("listenToCoachNotes failed", err));
};

export const toggleCoachNoteFavorite = async (noteId: string, isFavorite: boolean) => {
    if (isOffline || !db || !noteId) return;
    try {
        await updateDoc(doc(db, 'coachNotes', noteId), { isFavorite });
    } catch (e) { console.error("toggleCoachNoteFavorite failed", e); }
};

export const deleteCoachNote = async (noteId: string, imageUrl?: string) => {
    if (isOffline || !db || !noteId) return;
    try {
        if (imageUrl) {
            await deleteImageByUrl(imageUrl);
        }
        await deleteDoc(doc(db, 'coachNotes', noteId));
    } catch (e) { console.error("deleteCoachNote failed", e); }
};


export const uploadImage = async (path: string, image: File | string): Promise<string> => {
    if (typeof image === 'string' && !image.startsWith('data:image')) return image;
    if (isOffline || !storage) return "";
    try {
        const blob = typeof image === 'string' ? await (await fetch(image)).blob() : image;
        const snap = await uploadBytes(ref(storage, path), blob);
        return getDownloadURL(snap.ref);
    } catch (e) { console.error("uploadImage failed", e); return ""; }
};

export const deleteImageByUrl = async (url: string): Promise<void> => {
    if (isOffline || !storage || !url || !url.includes('firebasestorage')) return;
    try { await deleteObject(ref(storage, url)); } catch (e) {}
};

export const getSeasonalThemes = async () => {
    if (isOffline || !db) return [];
    try {
        const snap = await getDoc(doc(db, 'system', 'seasonalThemes'));
        return snap.exists() ? (snap.data() as any).themes : [];
    } catch (e) { return []; }
};

export const updateSeasonalThemes = async (themes: SeasonalThemeSetting[]) => {
    if (isOffline || !db) return;
    try {
        await setDoc(doc(db, 'system', 'seasonalThemes'), { themes: sanitizeData(themes) }, { merge: true });
    } catch (e) { console.error("updateSeasonalThemes failed", e); }
};

export const getGlobalSummerChallenge = async () => {
    if (isOffline || !db) {
        return {
            title: "Sommarutmaningen ☀️",
            description: "Samla poäng tillsammans genom att träna under sommaren! Träning på gymmet ger 2 poäng, all annan träning minst 30 min ger 1 poäng.",
            startDate: new Date("2026-06-01T00:00:00").getTime(),
            endDate: new Date("2026-08-31T23:59:59").getTime(),
            isPublished: false
        };
    }
    try {
        const snap = await getDoc(doc(db, 'system', 'summerChallenge'));
        return snap.exists() ? snap.data() : {
            title: "Sommarutmaningen ☀️",
            description: "Samla poäng tillsammans genom att träna under sommaren! Träning på gymmet ger 2 poäng, all annan träning minst 30 min ger 1 poäng.",
            startDate: new Date("2026-06-01T00:00:00").getTime(),
            endDate: new Date("2026-08-31T23:59:59").getTime(),
            isPublished: false
        };
    } catch (e) { return null; }
};

export const updateGlobalSummerChallenge = async (data: any) => {
    if (isOffline || !db) return;
    try {
        await setDoc(doc(db, 'system', 'summerChallenge'), sanitizeData(data), { merge: true });
    } catch (e) { console.error("updateGlobalSummerChallenge failed", e); }
};

export const listenToGlobalSummerChallenge = (callback: (data: any) => void) => {
    if (isOffline || !db) {
        callback({
            title: "Sommarutmaningen ☀️",
            description: "Samla poäng tillsammans genom att träna under sommaren! Träning på gymmet ger 2 poäng, all annan träning minst 30 min ger 1 poäng.",
            startDate: new Date("2026-06-01T00:00:00").getTime(),
            endDate: new Date("2026-08-31T23:59:59").getTime(),
            isPublished: false
        });
        return () => {};
    }
    return onSnapshot(doc(db, 'system', 'summerChallenge'), (snap) => {
        if (snap.exists()) {
            callback(snap.data());
        } else {
            callback({
                title: "Sommarutmaningen ☀️",
                description: "Samla poäng tillsammans genom att träna under sommaren! Träning på gymmet ger 2 poäng, all annan träning minst 30 min ger 1 poäng.",
                startDate: new Date("2026-06-01T00:00:00").getTime(),
                endDate: new Date("2026-08-31T23:59:59").getTime(),
                isPublished: false
            });
        }
    });
};


export const saveRace = async (data: any, orgId: string) => {
    if(isOffline || !db || !orgId) return { id: 'off' };
    try {
        let raceRef;
        if (data.id && !data.id.startsWith('race-')) { // If it's a real firebase ID
             raceRef = doc(db, 'races', data.id);
        } else if (data.id && data.id.startsWith('race-')) {
             // It's a temporary ID generated by the client, we should create a new doc but maybe keep the ID?
             // Actually, doc(collection(db, 'races')) generates a random ID. Let's just use the provided ID if it exists.
             raceRef = doc(db, 'races', data.id);
        } else {
             raceRef = doc(collection(db, 'races'));
        }
        
        const race = { ...sanitizeData(data), id: raceRef.id, organizationId: orgId };
        if (!race.createdAt) race.createdAt = Date.now();
        
        await setDoc(raceRef, race, { merge: true });
        return race;
    } catch (e) { console.error("saveRace failed", e); throw e; }
};

export const deleteRace = async (raceId: string) => {
    if (isOffline || !db || !raceId) return;
    try {
        await deleteDoc(doc(db, 'races', raceId));
    } catch (e) {
        console.error("deleteRace failed", e);
        throw e;
    }
};

export const getPastRaces = async (orgId: string) => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(collection(db, 'races'), where("organizationId", "==", orgId));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as HyroxRace).sort((a,b) => b.createdAt - a.createdAt);
    } catch (e) { return []; }
};

export const getRace = async (id: string) => {
    if (isOffline || !db || !id) return null;
    try {
        const snap = await getDoc(doc(db, 'races', id));
        return snap.exists() ? snap.data() as HyroxRace : null;
    } catch (e) { return null; }
};

export const listenToRace = (id: string, onUpdate: (race: HyroxRace | null) => void) => {
    if (isOffline || !db || !id) return () => {};
    return onSnapshot(doc(db, 'races', id), (snap) => {
        if (snap.exists()) {
            onUpdate(snap.data() as HyroxRace);
        } else {
            onUpdate(null);
        }
    }, (err) => console.error("listenToRace failed", err));
};


export const sendCheckIn = async (orgId: string, userEmail: string) => {
    if (isOffline || !db || !orgId) return;
    try {
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
    } catch (e) { console.error("sendCheckIn failed", e); }
};

export const listenForCheckIns = (orgId: string, callback: (event: CheckInEvent) => void) => {
    if (isOffline || !db || !orgId) return () => {};
    const q = query(collection(db, 'active_checkins'), where('organizationId', '==', orgId), orderBy('timestamp', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data() as CheckInEvent;
                if (Date.now() - data.timestamp < 10000) callback(data);
            }
        });
    }, (err) => console.error("listenForCheckIns failed", err));
};


// --- GALLERY IMAGES ---
export const getGalleryImages = async (): Promise<GalleryImage[]> => {
    if (isOffline || !db) return [];
    try {
        const q = query(collection(db, 'system_gallery'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GalleryImage));
    } catch (error) {
        console.error("Error getting gallery images:", error);
        return [];
    }
};

export const addGalleryImage = async (file: File | string, gymName: string): Promise<GalleryImage | null> => {
    if (isOffline || !db || !storage) return null;
    try {
        const fileName = typeof file === 'string' ? 'gallery.jpg' : file.name;
        const storageRef = ref(storage, `gallery/${Date.now()}_${fileName}`);
        const blob = typeof file === 'string' ? await (await fetch(file)).blob() : file;
        await uploadBytes(storageRef, blob);
        const imageUrl = await getDownloadURL(storageRef);
        
        const newDocRef = doc(collection(db, 'system_gallery'));
        const newImage: GalleryImage = {
            id: newDocRef.id,
            imageUrl,
            gymName,
            createdAt: Date.now()
        };
        await setDoc(newDocRef, newImage);
        return newImage;
    } catch (error) {
        console.error("Error adding gallery image:", error);
        return null;
    }
};

export const removeGalleryImage = async (id: string, imageUrl: string): Promise<void> => {
    if (isOffline || !db || !storage) return;
    try {
        await deleteDoc(doc(db, 'system_gallery', id));
        if (imageUrl) {
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef).catch(e => console.log("Image might already be deleted or not found", e));
        }
    } catch (error) {
        console.error("Error removing gallery image:", error);
    }
};

// --- PARTNERS ---
export const getPartners = async (): Promise<Partner[]> => {
    if (isOffline || !db) return [];
    try {
        const q = query(collection(db, 'system_partners'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
    } catch (error) {
        console.error("Error getting partners:", error);
        return [];
    }
};

export const addPartner = async (file: File, name: string, websiteUrl?: string): Promise<Partner | null> => {
    if (isOffline || !db || !storage) return null;
    try {
        const storageRef = ref(storage, `partners/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const logoUrl = await getDownloadURL(storageRef);
        
        const newDocRef = doc(collection(db, 'system_partners'));
        const newPartner: Partner = {
            id: newDocRef.id,
            name,
            logoUrl,
            websiteUrl: websiteUrl || '',
            createdAt: Date.now()
        };
        await setDoc(newDocRef, newPartner);
        return newPartner;
    } catch (error) {
        console.error("Error adding partner:", error);
        return null;
    }
};

export const removePartner = async (id: string, logoUrl: string): Promise<void> => {
    if (isOffline || !db || !storage) return;
    try {
        await deleteDoc(doc(db, 'system_partners', id));
        if (logoUrl) {
            const imageRef = ref(storage, logoUrl);
            await deleteObject(imageRef).catch(e => console.log("Logo might already be deleted or not found", e));
        }
    } catch (error) {
        console.error("Error removing partner:", error);
    }
};

// --- LEADS ---
export const createLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'status'>): Promise<boolean> => {
    if (isOffline || !db) return false;
    try {
        const newDocRef = doc(collection(db, 'leads'));
        const newLead: Lead = {
            id: newDocRef.id,
            ...leadData,
            status: 'new',
            createdAt: Date.now()
        };
        
        // Vi sparar leadet först. Om detta misslyckas kastas ett fel och vi returnerar false.
        await setDoc(newDocRef, newLead);

        // Vi försöker skriva till mail-samlingen, men vi bryr oss inte om det misslyckas 
        // (t.ex. pga saknade regler innan Trigger Email är uppsatt).
        // Vi använder .catch() direkt på Promise:t istället för try/catch för att vara helt säkra på att det inte bubblar upp.
        setDoc(doc(collection(db, 'mail')), {
            to: 'hej@smartstudio.se',
            message: {
                subject: (leadData as any).source === 'klubbsverige'
                    ? `KlubbSverige: ny förfrågan från ${leadData.gymName}`
                    : `Ny förfrågan från ${leadData.gymName}`,
                text: `Ny förfrågan:\n\nKälla: ${(leadData as any).source || 'landningssidan'}\nNamn: ${leadData.name}\nE-post: ${leadData.email}\nGym: ${leadData.gymName}\nOrg.nr: ${(leadData as any).orgNumber || '-'}\nTelefon: ${leadData.phone || '-'}\nAntal skärmar: ${(leadData as any).screensInterested || '-'}\nKampanjkod: ${(leadData as any).campaignCode || '-'}\nMeddelande: ${leadData.message || '-'}`
            }
        }).catch(e => console.log("Mail notification skipped (expected if Trigger Email is not set up):", e.message));

        return true;
    } catch (error) {
        console.error("Error creating lead:", error);
        return false;
    }
};

/**
 * Markerar att org.nr stämts av mot KlubbSveriges medlemsregister. Verifieringen
 * är manuell i version ett — någon jämför numret och kryssar i rutan.
 */
export const updateLeadVerified = async (id: string, memberVerified: boolean): Promise<void> => {
    if (isOffline || !db) return;
    try {
        await updateDoc(doc(db, 'leads', id), { memberVerified });
    } catch (error) {
        console.error("Error updating lead verification:", error);
    }
};

export const getLeads = async (): Promise<Lead[]> => {
    if (isOffline || !db) return [];
    try {
        const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
    } catch (error) {
        console.error("Error getting leads:", error);
        return [];
    }
};

export const updateLeadStatus = async (id: string, status: Lead['status']): Promise<void> => {
    if (isOffline || !db) return;
    try {
        await updateDoc(doc(db, 'leads', id), { status });
    } catch (error) {
        console.error("Error updating lead status:", error);
    }
};

