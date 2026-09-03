import { collection, doc, getDoc, setDoc, deleteDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, isOffline, sanitizeData, auth } from './init';
import { Program, Workout } from '../../types';

// PROGRAM — pass byggda for utvalda medlemmar. Egen samling, egna regler.
// Ett program ar ett Workout med en medlemslista; inget i gymmets vanliga
// pass rors av det har.

export const PROGRAM_ID_PREFIX = 'program-';
export const PROGRAM_CATEGORY = 'Program';

export const isProgramId = (id: string | undefined | null) => !!id && id.startsWith(PROGRAM_ID_PREFIX);

export const newProgramFrom = (organizationId: string, base?: Partial<Workout>): Program => ({
    id: `${PROGRAM_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    blocks: [],
    category: PROGRAM_CATEGORY,
    isPublished: true,
    createdAt: Date.now(),
    organizationId,
    ...(base || {}),
    isProgram: true,
    memberIds: [],
    memberNames: {},
} as Program);

const normalisera = (data: any): Program => {
    const p = { ...data } as Program;
    p.isProgram = true;
    p.memberIds = Array.isArray(p.memberIds) ? p.memberIds : [];
    p.blocks = Array.isArray(p.blocks) ? p.blocks.map(b => ({ ...b, exercises: b.exercises || [] })) : [];
    if (!p.category) p.category = PROGRAM_CATEGORY;
    return p;
};

/** Alla program i en organisation (personal). */
export const subscribeToProgramsForOrganization = (
    orgId: string,
    onUpdate: (programs: Program[]) => void,
    onError?: (e: Error) => void
) => {
    if (isOffline || !db || !orgId) { onUpdate([]); return () => {}; }
    const q = query(collection(db, 'programs'), where('organizationId', '==', orgId));
    return onSnapshot(q, snap => {
        const lista = snap.docs.map(d => normalisera({ id: d.id, ...d.data() }));
        lista.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        onUpdate(lista);
    }, err => { console.error('subscribeToProgramsForOrganization', err); onError?.(err as any); });
};

/** Programmen dar den inloggade medlemmen star med. */
export const subscribeToMyPrograms = (uid: string, onUpdate: (programs: Program[]) => void) => {
    if (isOffline || !db || !uid) { onUpdate([]); return () => {}; }
    const q = query(collection(db, 'programs'), where('memberIds', 'array-contains', uid));
    return onSnapshot(q, snap => {
        const lista = snap.docs.map(d => normalisera({ id: d.id, ...d.data() }));
        lista.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        onUpdate(lista);
    }, err => console.error('subscribeToMyPrograms', err));
};

export const getProgramById = async (id: string): Promise<Program | null> => {
    if (isOffline || !db || !id) return null;
    try {
        const snap = await getDoc(doc(db, 'programs', id));
        if (!snap.exists()) return null;
        return normalisera({ id: snap.id, ...snap.data() });
    } catch (e) {
        console.error('getProgramById', e);
        return null;
    }
};

export const saveProgram = async (program: Program): Promise<Program> => {
    if (isOffline || !db || !program?.id) return program;
    const attSpara: Program = normalisera({
        ...program,
        isPublished: true,
        isMemberDraft: false,
        updatedAt: Date.now(),
        createdByUid: program.createdByUid || auth?.currentUser?.uid || undefined,
    });
    await setDoc(doc(db, 'programs', attSpara.id), sanitizeData(attSpara), { merge: true });
    return attSpara;
};

export const updateProgramMembers = async (id: string, memberIds: string[], memberNames: Record<string, string>) => {
    if (isOffline || !db || !id) return;
    await setDoc(doc(db, 'programs', id), sanitizeData({ memberIds, memberNames, updatedAt: Date.now() }), { merge: true });
};

export const deleteProgram = async (id: string) => {
    if (isOffline || !db || !id) return;
    await deleteDoc(doc(db, 'programs', id));
};

// orderBy importeras for framtida sortering pa servern; lokal sortering racker nu.
void orderBy;
