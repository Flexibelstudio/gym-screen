import { 
  signInWithEmailAndPassword, 
  signInAnonymously, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  reauthenticateWithCredential,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  User,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  writeBatch, 
  serverTimestamp,
  runTransaction,
  deleteField,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getToken } from 'firebase/messaging';
import { auth, db, functions, isOffline, messaging, sanitizeData, generateInviteCode } from './init';
import { uploadImage } from './misc';
import { 
  UserData, Member, UserRole, MemberGoals, Organization, Location as OrgLocation 
} from '../../types';
import { MOCK_ORG_ADMIN, MOCK_MEMBERS } from '../../data/mockData';

export const onAuthChange = (callback: (user: User | null) => void) => {
    if (isOffline || !auth) return () => {}; 
    return onAuthStateChanged(auth, callback);
};

export const signIn = async (email: string, password: string): Promise<User> => {
    if (isOffline || !auth) throw new Error("Appen är i offline-läge.");
    try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        return credential.user;
    } catch (error) {
        console.error("SignIn failed:", error);
        throw error;
    }
};

export const signInAsStudio = async (): Promise<User> => {
    if (isOffline || !auth) return { uid: 'offline_studio_uid', isAnonymous: true } as User;
    try {
        const credential = await signInAnonymously(auth);
        return credential.user;
    } catch (error) {
        console.error("Anonymous sign-in failed:", error);
        throw error;
    }
};

export const signOut = (): Promise<void> => (isOffline || !auth) ? Promise.resolve() : firebaseSignOut(auth);

export const sendPasswordResetEmail = (email: string) => {
    if (isOffline || !auth) return Promise.resolve();
    
    // Om vi är på app.smartstudio.se (eller i produktion), anger vi ActionCodeSettings
    // så att Firebase djuplänkar direkt tillbaka till appens lösenordsåterställningsvy.
    // Detta tillåter app.smartstudio.se utan att du behöver konfigurera "Custom Action URL" i Firebase-konsolen.
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProd = hostname === 'app.smartstudio.se';
    
    if (isProd) {
        const actionCodeSettings = {
            url: 'https://app.smartstudio.se/reset-password',
            handleCodeInApp: true,
        };
        return firebaseSendPasswordResetEmail(auth, email, actionCodeSettings);
    }
    
    return firebaseSendPasswordResetEmail(auth, email);
};

export const verifyPasswordResetCode = (code: string): Promise<string> => 
  (isOffline || !auth) ? Promise.resolve('test@flexibelfriskvardhalsa.se') : firebaseVerifyPasswordResetCode(auth, code);

export const confirmPasswordReset = (code: string, newPassword: string): Promise<void> => 
  (isOffline || !auth) ? Promise.resolve() : firebaseConfirmPasswordReset(auth, code, newPassword);

export const reauthenticateUser = async (user: User, password: string) => {
  if (isOffline || !auth || !user.email) return;
  const credential = EmailAuthProvider.credential(user.email, password);
  return await reauthenticateWithCredential(user, credential);
};

export const updateUserTermsAccepted = async (uid: string) => {
    if (isOffline || !db || !uid) return;
    try {
        await updateDoc(doc(db, 'users', uid), { termsAcceptedAt: Date.now() });
    } catch (e) { console.error("Terms update failed", e); }
};

export const getMembers = async (orgId: string): Promise<Member[]> => {
    if (isOffline || !db || !orgId) return MOCK_MEMBERS;
    try {
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), uid: d.id, id: d.id }) as Member);
    } catch (e) { console.error("getMembers failed", e); return []; }
};

export const getAdminsForOrganization = async (orgId: string): Promise<UserData[]> => {
    if (isOffline || !db || !orgId) return [MOCK_ORG_ADMIN];
    try {
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId), where('role', '==', 'organizationadmin'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserData);
    } catch (e) { return []; }
};

export const getCoachesForOrganization = async (orgId: string): Promise<UserData[]> => {
    if (isOffline || !db || !orgId) return [];
    try {
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId), where('role', '==', 'coach'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserData);
    } catch (e) { return []; }
};

export const listenToMembers = (orgId: string, onUpdate: (members: Member[]) => void) => {
    if (isOffline || !db || !orgId) {
        onUpdate(MOCK_MEMBERS);
        return () => {};
    }
    const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
    return onSnapshot(q, (snap) => {
        const members = snap.docs.map(d => ({ ...d.data(), uid: d.id, id: d.id }) as Member);
        onUpdate(members);
    }, (err) => console.error("listenToMembers failed", err));
};

export const calculateBodyWeightHistory = (
    currentHistory: { date: string; weight: number }[] = [],
    newWeight: number,
    customDateStr?: string
): { date: string; weight: number }[] => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = customDateStr || `${year}-${month}-${day}`;

    const history = [...currentHistory];
    if (history.length > 0 && history[history.length - 1].date === today) {
        history[history.length - 1] = { date: today, weight: newWeight };
    } else {
        history.push({ date: today, weight: newWeight });
    }
    return history;
};

export const updateUserGoals = async (uid: string, goals: MemberGoals) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), { goals: sanitizeData(goals) });
};

export const updateUserProfile = async (uid: string, data: Partial<UserData> | Record<string, any>) => {
    if (isOffline || !db || !uid) return;

    const plainData: Record<string, any> = {};
    const fieldValues: Record<string, any> = {};

    Object.keys(data).forEach(key => {
        const val = (data as Record<string, any>)[key];
        if (val && typeof val === 'object' && (val._methodName === 'deleteField' || val.constructor?.name === 'FieldValue' || val.constructor?.name === 'FieldValueSentinel')) {
            fieldValues[key] = val;
        } else if (val !== undefined) {
            plainData[key] = val;
        }
    });

    const sanitized = sanitizeData(plainData);
    const finalPayload = { ...sanitized, ...fieldValues };

    await updateDoc(doc(db, 'users', uid), finalPayload);
    
    // If showOnLeaderboard preference changed, update recent workout logs so they disappear/appear immediately
    if (data.showOnLeaderboard !== undefined) {
        try {
            const now = new Date();
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)));
            startOfWeek.setHours(0, 0, 0, 0);
            
            const q = query(
                collection(db, 'workoutLogs'),
                where("memberId", "==", uid),
                where("date", ">=", startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000) // Go back an extra week just in case
            );
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => {
                batch.update(d.ref, { showOnLeaderboard: data.showOnLeaderboard });
            });
            await batch.commit();
        } catch (e) {
            console.error("Failed to update recent logs visibility", e);
        }
    }
};

export const requestPushNotificationPermission = async (uid: string): Promise<string | null> => {
    if (isOffline || !messaging || !db || !uid) return null;
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // Get the token
            const token = await getToken(messaging, {
                // VAPID key is optional if configured in Firebase Console, but recommended.
                // We'll let Firebase use the default sender ID from config.
            });
            
            if (token) {
                // Save token to user profile
                await updateDoc(doc(db, 'users', uid), {
                    fcmToken: token,
                    pushNotificationsEnabled: true
                });
                return token;
            }
        }
        return null;
    } catch (error) {
        console.error('Error requesting push notification permission:', error);
        return null;
    }
};

export const updateUserRoleCloud = async (targetUid: string, newRole: UserRole) => {
    if (isOffline || !functions) throw new Error("Offline eller systemet ej redo.");
    try {
        const func = httpsCallable(functions, 'flexUpdateUserRole');
        const result = await func({ targetUid, newRole });
        return result.data;
    } catch (err: any) {
        console.error("Cloud function error:", err);
        throw new Error(err.message || "Ett fel uppstod vid rollbyte.");
    }
};

export const approveCoach = async (uid: string) => {
    if (isOffline || !db || !uid) return;
    const approveCoachFn = httpsCallable(functions, 'flexApproveCoach');
    try {
        await approveCoachFn({ targetUid: uid });
    } catch (err: any) {
        console.error("Cloud function error:", err);
        throw new Error(err.message || "Ett fel uppstod vid godkännande av coach.");
    }
};

export const updateMemberEndDate = async (uid: string, date: string | null) => {
    if (isOffline || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), { endDate: date });
};

export interface InviteCodeDetails {
    isValid: boolean;
    code: string;
    organizationId?: string;
    organizationName?: string;
    logoUrl?: string;
    locationId?: string;
    locationName?: string;
    locations?: { id: string; name: string }[];
    isCoach?: boolean;
    error?: string;
}

export const getInviteCodeInfo = async (code: string): Promise<InviteCodeDetails> => {
    if (isOffline || !db || !code) {
        return { isValid: false, code: code || '', error: "Länken är ogiltig — be gymmet om en ny" };
    }

    const upperCode = code.trim().toUpperCase();

    try {
        let q = query(collection(db, 'organizations'), where('inviteCode', '==', upperCode));
        let snap = await getDocs(q);

        let isCoach = false;
        if (snap.empty) {
            q = query(collection(db, 'organizations'), where('coachCode', '==', upperCode));
            snap = await getDocs(q);
            if (!snap.empty) {
                isCoach = true;
            }
        }

        if (!snap.empty) {
            const orgDoc = snap.docs[0];
            const orgData = orgDoc.data() as Organization;
            const orgLocations = orgData.locations || [];
            const mappedLocations = orgLocations.map((l: OrgLocation) => ({ id: l.id, name: l.name }));

            const specificLoc = orgLocations.find((l: OrgLocation) => 
                l.inviteCode?.toUpperCase() === upperCode || 
                l.coachCode?.toUpperCase() === upperCode
            );

            let locationId: string | undefined = undefined;
            let locationName: string | undefined = undefined;

            if (specificLoc) {
                locationId = specificLoc.id;
                locationName = specificLoc.name;
            } else if (orgLocations.length === 1) {
                locationId = orgLocations[0].id;
                locationName = orgLocations[0].name;
            } else {
                // Flera orter på org-nivå: sätt ej tyst locations[0]
                locationId = undefined;
                locationName = undefined;
            }

            return {
                isValid: true,
                code: upperCode,
                organizationId: orgDoc.id,
                organizationName: orgData.name,
                logoUrl: orgData.logoUrlLight || orgData.logoUrlDark,
                locationId,
                locationName,
                locations: mappedLocations.length > 0 ? mappedLocations : undefined,
                isCoach
            };
        }

        q = query(collection(db, 'organizations'), where('inviteCodes', 'array-contains', upperCode));
        snap = await getDocs(q);

        if (!snap.empty) {
            const orgDoc = snap.docs[0];
            const orgData = orgDoc.data() as Organization;
            const orgLocations = orgData.locations || [];
            const mappedLocations = orgLocations.map((l: OrgLocation) => ({ id: l.id, name: l.name }));

            const matchedLoc = orgLocations.find((l: OrgLocation) => 
                l.inviteCode?.toUpperCase() === upperCode || 
                l.coachCode?.toUpperCase() === upperCode
            );

            if (matchedLoc) {
                const locCoach = matchedLoc.coachCode?.toUpperCase() === upperCode;
                return {
                    isValid: true,
                    code: upperCode,
                    organizationId: orgDoc.id,
                    organizationName: orgData.name,
                    logoUrl: orgData.logoUrlLight || orgData.logoUrlDark,
                    locationId: matchedLoc.id,
                    locationName: matchedLoc.name,
                    locations: mappedLocations.length > 0 ? mappedLocations : undefined,
                    isCoach: locCoach
                };
            }
        }

        return { isValid: false, code: upperCode, error: "Länken är ogiltig — be gymmet om en ny" };
    } catch (e) {
        console.error("Kunde inte hämta inbjudningskodsinformation:", e);
        return { isValid: false, code: upperCode, error: "Länken är ogiltig — be gymmet om en ny" };
    }
};

export const registerMemberWithCode = async (email: string, pass: string, code: string, additionalData?: any) => {
    if (isOffline || !db || !auth) throw new Error("Systemet är i offline-läge.");

    const upperCode = code.toUpperCase();
    
    // Check for member code first
    let q = query(collection(db, 'organizations'), where('inviteCode', '==', upperCode));
    let snap = await getDocs(q);
    
    let isCoach = false;
    let targetLocationId: string | undefined = undefined;
    
    // If not found, check for coach code
    if (snap.empty) {
        q = query(collection(db, 'organizations'), where('coachCode', '==', upperCode));
        snap = await getDocs(q);
        if (!snap.empty) {
            isCoach = true;
        }
    }

    // Try location codes
    if (snap.empty) {
        q = query(collection(db, 'organizations'), where('inviteCodes', 'array-contains', upperCode));
        snap = await getDocs(q);
        if (!snap.empty) {
            const orgData = snap.docs[0].data() as Organization;
            const loc = orgData.locations?.find(l => l.inviteCode?.toUpperCase() === upperCode || l.coachCode?.toUpperCase() === upperCode);
            if (loc) {
                targetLocationId = loc.id;
                if (loc.coachCode?.toUpperCase() === upperCode) {
                    isCoach = true;
                }
            } else {
                throw new Error("Ogiltig inbjudningskod.");
            }
        }
    } else {
        // If matched organization's general code, resolve a default locationId
        const orgData = snap.docs[0].data() as Organization;
        if (orgData.locations && orgData.locations.length > 0) {
            const matchedLoc = orgData.locations.find(l => l.inviteCode?.toUpperCase() === upperCode || l.coachCode?.toUpperCase() === upperCode);
            if (matchedLoc) {
                targetLocationId = matchedLoc.id;
            } else if (orgData.locations.length === 1) {
                targetLocationId = orgData.locations[0].id;
            }
        }
    }

    if (snap.empty) {
        throw new Error("Ogiltig inbjudningskod.");
    }
    
    const organizationId = snap.docs[0].id;

    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    let photoUrl = null;
    if (additionalData?.photoBase64) {
        try {
            photoUrl = await uploadImage(`users/${user.uid}/profile.jpg`, additionalData.photoBase64);
        } catch (uploadErr) {
            console.error("Kunde inte ladda upp profilbild vid registrering:", uploadErr);
        }
    }

    const userData = {
        uid: user.uid,
        email: email,
        role: isCoach ? 'coach' : 'member',
        status: isCoach ? 'pending_coach' : 'active',
        organizationId: organizationId,
        locationId: targetLocationId || additionalData?.locationId || null,
        firstName: additionalData?.firstName || '',
        lastName: additionalData?.lastName || '',
        photoUrl: photoUrl,
        age: additionalData?.age || null,
        birthDate: additionalData?.birthDate || null,
        gender: additionalData?.gender || 'prefer_not_to_say',
        isTrainingMember: !isCoach,
        createdAt: serverTimestamp(),
        termsAcceptedAt: Date.now() 
    };
    
    try {
        await setDoc(doc(db, 'users', user.uid), userData);
    } catch (dbError) {
        console.error("Firestore setDoc misslyckades vid registrering. Rensar skapat Auth-konto...", dbError);
        try {
            await user.delete();
        } catch (cleanupError) {
            console.error("Kunde inte rensa Firebase Auth-användare efter databasfel:", cleanupError);
        }
        throw dbError;
    }
    return user;
};

import { calculate1RM } from '../../utils/workoutUtils';

