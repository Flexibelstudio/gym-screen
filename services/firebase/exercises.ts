import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, writeBatch, serverTimestamp, deleteField 
} from 'firebase/firestore';
import { db, isOffline, sanitizeData, normalizeString } from './init';
import { getOrganizationById } from './organizations';
import { BankExercise, SuggestedExercise, Exercise, Workout } from '../../types';
import { MOCK_EXERCISE_BANK } from '../../data/mockData';

export const getExerciseBank = async (): Promise<BankExercise[]> => {
    if (isOffline || !db) return MOCK_EXERCISE_BANK;
    try {
        const snap = await getDocs(query(collection(db, 'exerciseBank'), orderBy('name')));
        return snap.docs.map(d => d.data() as BankExercise);
    } catch (e) { return MOCK_EXERCISE_BANK; }
};

export const getMemberCustomExercises = async (userId: string): Promise<BankExercise[]> => {
    if (isOffline || !db || !userId) return [];
    try {
        const snap = await getDocs(query(collection(db, 'users', userId, 'customExercises')));
        return snap.docs.map(d => {
            const data = d.data() as BankExercise;
            return {
                ...data,
                name: data.name, // Keep original name
                category: data.category || 'Custom Egen'
            };
        });
    } catch (e) { 
        console.error("Failed to fetch member custom exercises", e);
        return []; 
    }
};

export const addMemberCustomExercise = async (userId: string, exerciseName: string): Promise<BankExercise> => {
    if (!db) throw new Error("DB ej tillgänglig");
    
    // We shouldn't use organizationId for member custom, we just let it be a personal custom collection
    const exercisesRef = collection(db, 'users', userId, 'customExercises');
    const newDocRef = doc(exercisesRef); // Generate auto id
    
    const newExercise: BankExercise = {
        id: newDocRef.id,
        name: exerciseName,
        tags: ['Custom Egen'],
        description: 'Egen skapad övning.',
        category: 'Custom Egen',
    };

    await setDoc(newDocRef, newExercise);
    return newExercise;
};

export const deleteMemberCustomExercise = async (userId: string, exerciseId: string): Promise<void> => {
    if (!db) throw new Error("DB ej tillgänglig");
    await deleteDoc(doc(db, 'users', userId, 'customExercises', exerciseId));
};

export const updateMemberCustomExercise = async (userId: string, exerciseId: string, newName: string): Promise<void> => {
    if (!db) throw new Error("DB ej tillgänglig");
    await updateDoc(doc(db, 'users', userId, 'customExercises', exerciseId), {
        name: newName
    });
};

export const getOrganizationExerciseBank = async (orgId: string): Promise<BankExercise[]> => {
    if (isOffline || !db || !orgId) return MOCK_EXERCISE_BANK;
    try {
        // 1. Fetch Global Bank
        const globalSnap = await getDocs(query(collection(db, 'exerciseBank'), orderBy('name')));
        const globalBank = globalSnap.docs.map(d => d.data() as BankExercise);

        // 2. Fetch Custom Bank
        const customQ = query(collection(db, 'custom_exercises'), where('organizationId', '==', orgId));
        const customSnap = await getDocs(customQ);
        const customBank = customSnap.docs.map(d => d.data() as BankExercise);

        return [...globalBank, ...customBank].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    } catch (e) { 
        console.error("Failed to fetch custom exercises", e);
        return MOCK_EXERCISE_BANK; 
    }
};

// Resolver Function (The logic engine)

export const saveExerciseToBank = async (ex: BankExercise) => {
    if (isOffline || !db || !ex.id) return;
    try {
        // Om övningen har ett organizationId eller ID:t börjar på 'custom_', spara i custom_exercises
        const collectionName = ex.organizationId || ex.id.startsWith('custom_') 
            ? 'custom_exercises' 
            : 'exerciseBank';
            
        await setDoc(doc(db, collectionName, ex.id), sanitizeData(ex), { merge: true });
    } catch (e) { console.error("saveExerciseToBank failed", e); }
};

export const deleteExerciseFromBank = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        // Check if it's a custom exercise based on ID prefix
        const collectionName = id.startsWith('custom_') ? 'custom_exercises' : 'exerciseBank';
        await deleteDoc(doc(db, collectionName, id));
    } catch (e) { console.error("deleteExerciseFromBank failed", e); }
};

export const mergeExercises = async (sourceId: string, targetId: string) => {
    if (isOffline || !db) return;
    try {
        let targetEx: BankExercise | null = null;
        let sourceEx: BankExercise | null = null;
        
        const globalTargetSnap = await getDoc(doc(db, 'exerciseBank', targetId));
        if (globalTargetSnap.exists()) targetEx = globalTargetSnap.data() as BankExercise;
        else {
            const customTargetSnap = await getDoc(doc(db, 'custom_exercises', targetId));
            if (customTargetSnap.exists()) targetEx = customTargetSnap.data() as BankExercise;
        }

        const globalSourceSnap = await getDoc(doc(db, 'exerciseBank', sourceId));
        if (globalSourceSnap.exists()) sourceEx = globalSourceSnap.data() as BankExercise;
        else {
            const customSourceSnap = await getDoc(doc(db, 'custom_exercises', sourceId));
            if (customSourceSnap.exists()) sourceEx = customSourceSnap.data() as BankExercise;
        }

        if (!targetEx || !sourceEx) {
            throw new Error("Kunde inte hitta båda övningarna för sammanslagning.");
        }

        // Hitta alla pass som använder source-övningen
        const workoutsSnap = await getDocs(collection(db, 'workouts'));
        const batch = writeBatch(db);
        let updateCount = 0;

        workoutsSnap.forEach(docSnap => {
            const workout = docSnap.data() as Workout;
            let modified = false;

            if (workout.blocks) {
                workout.blocks.forEach(block => {
                    if (block.exercises) {
                        block.exercises.forEach(ex => {
                            if (ex.id === sourceId || ex.name === sourceEx!.name) {
                                ex.id = targetId;
                                ex.name = targetEx!.name;
                                ex.isFromBank = true;
                                modified = true;
                            }
                        });
                    }
                });
            }

            if (modified) {
                batch.update(docSnap.ref, { blocks: workout.blocks });
                updateCount++;
            }
        });

        if (updateCount > 0) {
            await batch.commit();
            console.log(`Uppdaterade ${updateCount} pass.`);
        }

        // Ta bort source-övningen
        await deleteExerciseFromBank(sourceId);

    } catch (e) {
        console.error("mergeExercises failed", e);
        throw e;
    }
};

export const updateExerciseImageOverride = async (orgId: string, exerciseId: string, imageUrl: string | null) => {
    if (isOffline || !db || !orgId) return;
    try {
        const orgRef = doc(db, 'organizations', orgId);
        if (imageUrl) {
            await updateDoc(orgRef, { [`exerciseOverrides.${exerciseId}`]: { imageUrl } });
        } else {
            await updateDoc(orgRef, { [`exerciseOverrides.${exerciseId}`]: deleteField() });
        }
        return getOrganizationById(orgId);
    } catch (e) { console.error("updateExerciseImageOverride failed", e); }
};

// ... (Rest of the file remains same: billing, images, hyrox, checkins etc.)

export const getSuggestedExercises = async () => {
    if (isOffline || !db) return [];
    try {
        const snap = await getDocs(collection(db, 'exerciseSuggestions'));
        return snap.docs.map(d => ({ ...d.data(), id: d.id }) as SuggestedExercise);
    } catch (e) { return []; }
};

export const approveExerciseSuggestion = async (s: SuggestedExercise) => {
    try {
        const bankEx: BankExercise = { id: s.id, name: s.name, description: s.description, imageUrl: s.imageUrl, tags: s.tags };
        await saveExerciseToBank(bankEx);
        await deleteExerciseSuggestion(s.id);
    } catch (e) { console.error("approveExerciseSuggestion failed", e); }
};

export const deleteExerciseSuggestion = async (id: string) => {
    if (isOffline || !db) return;
    try {
        await deleteDoc(doc(db, 'exerciseSuggestions', id));
    } catch (e) { console.error("deleteExerciseSuggestion failed", e); }
};

export const updateExerciseSuggestion = async (s: SuggestedExercise) => {
    if (isOffline || !db) return;
    try {
        await setDoc(doc(db, 'exerciseSuggestions', s.id), s, { merge: true });
    } catch (e) { console.error("updateExerciseSuggestion failed", e); }
};

