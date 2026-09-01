import { 
  collection, doc, getDoc, getDocs, setDoc, getDocsFromServer, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, writeBatch, serverTimestamp, deleteField 
} from 'firebase/firestore';
import { db, isOffline, sanitizeData, normalizeString, auth } from './init';
import { getOrganizationExerciseBank } from './exercises';
import { Workout, Exercise, BankExercise } from '../../types';
import { isWorkoutVisibleNow, isWorkoutVisibleForLocations, isWorkoutVisibleForMember } from '../../utils/workoutUtils';

export const getFreshCategoryWorkouts = async (orgId: string, category: string, memberLocationIds?: string[]): Promise<Workout[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(
          collection(db, 'workouts'), 
          where("organizationId", "==", orgId),
          where("category", "==", category),
          where("isPublished", "==", true),
          where("isMemberDraft", "==", false),
          where("publishAt", "<=", Date.now()),
          orderBy("publishAt", "desc")
        );
        const snap = await getDocsFromServer(q);
        
        return snap.docs
            .map(d => {
                const data = d.data() as Workout;
                if (!data.blocks) data.blocks = [];
                else {
                    data.blocks = data.blocks.map(block => ({
                        ...block,
                        exercises: block.exercises || []
                    }));
                }
                return data;
            })
            .filter(w => memberLocationIds ? isWorkoutVisibleForLocations(w, memberLocationIds) : isWorkoutVisibleNow(w));
    } catch (error) {
        console.error("Error fetching fresh category workouts:", error);
        return [];
    }
};

export const getVisibleWorkoutsForMembers = async (orgId: string, memberLocationIds?: string[], memberUid?: string | null): Promise<Workout[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(
          collection(db, 'workouts'), 
          where("organizationId", "==", orgId),
          where("isPublished", "==", true),
          where("isMemberDraft", "==", false),
          where("publishAt", "<=", Date.now()),
          orderBy("publishAt", "desc")
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data() as Workout;
            if (!data.blocks) {
                data.blocks = [];
            } else {
                data.blocks = data.blocks.map(block => ({
                    ...block,
                    exercises: block.exercises || []
                }));
            }
            return data;
        }).filter(w => memberLocationIds
            ? isWorkoutVisibleForLocations(w, memberLocationIds, Date.now(), memberUid)
            : (isWorkoutVisibleNow(w) && isWorkoutVisibleForMember(w, memberUid)));
    } catch (e: any) { 
        console.error("getVisibleWorkoutsForMembers failed", e);
        const errMsg = e?.message || String(e);
        if (errMsg.includes("requires an index")) {
            console.warn("VARNING: Firestore-frågan kräver ett index!", errMsg);
        }
        return []; 
    }
};

export const getWorkoutsForOrganization = async (orgId: string): Promise<Workout[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(
          collection(db, 'workouts'), 
          where("organizationId", "==", orgId)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data() as Workout;
            if (!data.blocks) {
                data.blocks = [];
            } else {
                data.blocks = data.blocks.map(block => ({
                    ...block,
                    exercises: block.exercises || []
                }));
            }
            return data;
        }).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (e) { 
        console.error("getWorkoutsForOrganization failed", e);
        return []; 
    }
};

export const subscribeToWorkoutsForOrganization = (orgId: string, onUpdate: (workouts: Workout[]) => void, onError: (error: Error) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate([]);
        return () => {};
    }
    
    const q = query(
      collection(db, 'workouts'), 
      where("organizationId", "==", orgId)
    );

    return onSnapshot(q, (snap) => {
        const workouts = snap.docs.map(d => {
            const data = d.data() as Workout;
            if (!data.blocks) {
                data.blocks = [];
            } else {
                data.blocks = data.blocks.map(block => ({
                    ...block,
                    exercises: block.exercises || []
                }));
            }
            return data;
        }).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
        onUpdate(workouts);
    }, (error) => {
        console.error("subscribeToWorkoutsForOrganization failed", error);
        onError(error);
    });
};

export const getWorkoutById = async (id: string): Promise<Workout | null> => {
    if (isOffline || !db || !id) return null;
    try {
        const snap = await getDoc(doc(db, 'workouts', id));
        if (!snap.exists()) return null;
        const data = snap.data() as Workout;
        if (!data.blocks) {
            data.blocks = [];
        } else {
            data.blocks = data.blocks.map(block => ({
                ...block,
                exercises: block.exercises || []
            }));
        }
        return data;
    } catch (e) {
        console.error("getWorkoutById failed", e);
        return null;
    }
};

export const saveWorkout = async (w: Workout): Promise<Workout> => {
    if (isOffline || !db || !w.id) return w;
    try {
        const workoutToSave = { ...w };

        // publishAt ska alltid finnas som ett timestamp. Saknas det sätter vi det till createdAt eller nu.
        if (!workoutToSave.publishAt) {
            workoutToSave.publishAt = workoutToSave.createdAt || Date.now();
        }

        // isMemberDraft ska alltid ha ett boolean-värde (false som default)
        if (workoutToSave.isMemberDraft === undefined) {
            workoutToSave.isMemberDraft = false;
        }

        // Skaparen stämplas EN gång — vid första sparningen. Ett pass byter aldrig
        // upphovsperson för att någon annan redigerar det senare.
        if (!workoutToSave.createdByUid && auth?.currentUser) {
            workoutToSave.createdByUid = auth.currentUser.uid;
            if (auth.currentUser.displayName) {
                workoutToSave.createdByName = auth.currentUser.displayName;
            }
        }

        // Om publishAt är satt och ligger i framtiden sätter vi silentPublish till true.
        // Detta förhindrar att Cloud Functions (onWorkoutCreated / onWorkoutUpdated i functions/src/training.js)
        // skickar push-notiser ("Nytt pass tillgängligt!") i förtid till alla medlemmar när coachen skapar
        // eller uppdaterar schemalagda pass.
        // Notera: Notis vid den FAKTISKA publiceringstidpunkten kräver en schemalagd Cloud Function (crontab/scheduled task) i backend.
        if (workoutToSave.publishAt && workoutToSave.publishAt > Date.now()) {
            workoutToSave.silentPublish = true;
        }

        const payload: Record<string, any> = sanitizeData(workoutToSave);
        if (workoutToSave.expiresAt === undefined) {
            payload.expiresAt = deleteField();
        }
        // Skrivningen startar direkt, men vi vantar hogst ett par sekunder pa
        // serverns kvitto. Pa gamla skarmar kan kvittot droja en halv minut
        // fast passet redan ar pa vag in — den vantan ska ingen sitta i.
        // Svarar servern snabbt (dator, mobil) marks ingen skillnad alls,
        // och ett riktigt fel (t.ex. nekad behorighet) kastas som vanligt.
        const skrivning = setDoc(doc(db, 'workouts', workoutToSave.id), payload, { merge: true });
        const utfall = await Promise.race([
            skrivning.then(() => 'ok' as const, (fel) => { console.error('saveWorkout skrivfel', fel); return 'fel' as const; }),
            new Promise<'vantar'>((res) => setTimeout(() => res('vantar'), 2500))
        ]);
        if (utfall === 'fel') {
            throw new Error('Passet kunde inte sparas.');
        }
        // 'vantar': skrivningen fortsatter i bakgrunden — slapp anvandaren vidare.
        return workoutToSave;
    } catch (e) { 
        console.error("saveWorkout failed", e); 
        // Throw the error so the caller knows it failed
        throw e;
    }
};

export const backfillWorkoutsPublishAt = async (
    orgId: string, 
    dryRun: boolean = true
): Promise<{ totalExamined: number; missingPublishAtCount: number; updatedCount: number }> => {
    if (isOffline || !db || !orgId) return { totalExamined: 0, missingPublishAtCount: 0, updatedCount: 0 };

    try {
        const q = query(collection(db, 'workouts'), where("organizationId", "==", orgId));
        const snap = await getDocs(q);
        
        const docsToUpdate: { id: string; publishAt: number }[] = [];

        snap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.publishAt === undefined || data.publishAt === null) {
                const createdAt = data.createdAt || Date.now();
                docsToUpdate.push({ id: docSnap.id, publishAt: createdAt });
            }
        });

        if (dryRun) {
            console.log(`[DryRun Backfill] Org: ${orgId}, Totalt undersökta: ${snap.size}, Saknar publishAt: ${docsToUpdate.length}`);
            return {
                totalExamined: snap.size,
                missingPublishAtCount: docsToUpdate.length,
                updatedCount: 0
            };
        }

        let updatedCount = 0;
        const BATCH_SIZE = 400;
        for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
            const batchChunk = docsToUpdate.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            batchChunk.forEach(item => {
                const ref = doc(db, 'workouts', item.id);
                batch.update(ref, { publishAt: item.publishAt });
            });
            await batch.commit();
            updatedCount += batchChunk.length;
        }

        return {
            totalExamined: snap.size,
            missingPublishAtCount: docsToUpdate.length,
            updatedCount
        };
    } catch (e) {
        console.error("backfillWorkoutsPublishAt error:", e);
        throw e;
    }
};

export const deleteWorkout = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        await deleteDoc(doc(db, 'workouts', id));
    } catch (e) { console.error("deleteWorkout failed", e); }
};


export const resolveAndCreateExercises = async (orgId: string, workout: Workout, createMissing: boolean = false): Promise<Workout> => {
    if (isOffline || !db) return workout; // Safety

    // 1. Get combined banks
    const combinedBank = await getOrganizationExerciseBank(orgId);
    const bankMap = new Map(combinedBank.map(b => [b.id, b])); // Create Map for O(1) lookup
    const newlyCreatedCache: Record<string, BankExercise> = {};

    const seenInstanceIds = new Set<string>();
    const ensureInstanceId = (ex: Exercise): string => {
        let id = ex.id;
        if (!id || !id.startsWith('ex-') || seenInstanceIds.has(id)) {
            id = `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        seenInstanceIds.add(id);
        return id;
    };

    // 2. Helper for matching
    const findMatch = (name: string) => {
        const nName = normalizeString(name);
        
        // Try exact normalized match first
        let match = combinedBank.find(b => normalizeString(b.name) === nName);
        if(match) return match;

        // Try "contains" match (reversed)
        match = combinedBank.find(b => normalizeString(b.name).includes(nName));
        
        if (!match) {
             match = combinedBank.find(b => nName.includes(normalizeString(b.name)));
         }

        return match;
    };

    // 3. Process blocks
    const resolvedBlocks = await Promise.all(workout.blocks.map(async (block) => {
        const resolvedExercises = await Promise.all(block.exercises.map(async (ex) => {
            // Case 1: It claims to be from the bank
            if (ex.isFromBank) {
                const bankExId = ex.originalBankId || ex.id;
                // If it claims to be from bank, we MUST verify the ID exists.
                // If it doesn't exist (deleted), we downgrade it to ad-hoc.
                if (bankMap.has(bankExId)) {
                    // Valid link. Optionally sync details? 
                    const bankEx = bankMap.get(bankExId);
                    return {
                        ...ex,
                        id: ensureInstanceId(ex),
                        originalBankId: bankExId,
                        imageUrl: bankEx?.imageUrl || ex.imageUrl, // Sync image
                        description: bankEx?.description || ex.description, // Optional: Sync desc
                        // Keep the existing loggingEnabled state, or default to false if undefined
                        loggingEnabled: ex.loggingEnabled !== undefined ? ex.loggingEnabled : false
                    };
                } else {
                    // INVALID LINK (Deleted from bank). Downgrade to Ad-hoc.
                    return {
                        ...ex,
                        id: ensureInstanceId(ex),
                        originalBankId: null,
                        isFromBank: false,
                        loggingEnabled: false,
                        // Keep existing name/reps/desc as they are in the workout
                    };
                }
            }

            // Case 2: Ad-hoc (Try to match by name or create new)
            const match = findMatch(ex.name);

            if (match) {
                return {
                    ...ex,
                    id: ensureInstanceId(ex),
                    originalBankId: match.id, // THE MAGIC: Link to Master ID
                    description: ex.description || match.description, 
                    imageUrl: match.imageUrl || ex.imageUrl,
                    isFromBank: true,
                    loggingEnabled: ex.loggingEnabled !== undefined ? ex.loggingEnabled : false
                };
            }

            // If no match found, and we are NOT allowed to create missing exercises (e.g. Ad-hoc/AI)
            // Just return the exercise as-is but ensure logging is disabled to keep data clean
            if (!createMissing) {
                return {
                    ...ex,
                    id: ensureInstanceId(ex),
                    isFromBank: false,
                    loggingEnabled: false
                };
            }

            // Check cache for duplicates in same workout session
            const nName = normalizeString(ex.name);
            if (newlyCreatedCache[nName]) {
                const cached = newlyCreatedCache[nName];
                return { 
                    ...ex, 
                    id: ensureInstanceId(ex),
                    originalBankId: cached.id,
                    isFromBank: true, 
                    loggingEnabled: ex.loggingEnabled !== undefined ? ex.loggingEnabled : false
                };
            }

            // Create new Custom Exercise
            const newId = `custom_${orgId}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
            const newBankEx: BankExercise = {
                id: newId,
                name: ex.name, // Use the provided name
                description: ex.description || '',
                tags: [], 
                organizationId: orgId
            };

            // Add to Firestore
            await setDoc(doc(db, 'custom_exercises', newId), newBankEx);

            // Add to cache
            newlyCreatedCache[nName] = newBankEx;
            
            return {
                ...ex,
                id: ensureInstanceId(ex),
                originalBankId: newId,
                isFromBank: true,
                loggingEnabled: ex.loggingEnabled !== undefined ? ex.loggingEnabled : false
            };
        }));

        return { ...block, exercises: resolvedExercises };
    }));

    return { ...workout, blocks: resolvedBlocks };
};


export const saveCustomProgram = async (userId: string, program: Workout): Promise<void> => {
    if (isOffline || !db) return;
    try {
        const docRef = doc(db, `users/${userId}/customPrograms`, program.id);
        await setDoc(docRef, sanitizeData(program));
        window.dispatchEvent(new Event('customProgramsUpdated'));
    } catch (e) {
        console.error("saveCustomProgram failed", e);
        throw e;
    }
};

export const fetchCustomPrograms = async (userId: string): Promise<Workout[]> => {
    if (isOffline || !db || !userId) return [];
    try {
        const q = query(collection(db, `users/${userId}/customPrograms`), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Workout);
    } catch (e) {
        console.error("fetchCustomPrograms failed", e);
        return [];
    }
};

export const deleteCustomProgram = async (userId: string, programId: string): Promise<void> => {
    if (isOffline || !db) return;
    try {
        await deleteDoc(doc(db, `users/${userId}/customPrograms`, programId));
        window.dispatchEvent(new Event('customProgramsUpdated'));
    } catch (e) {
        console.error("deleteCustomProgram failed", e);
        throw e;
    }
};


