import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { onAuthChange, signOut as firebaseSignOut, signIn, signInAsStudio, isOffline, sendPasswordResetEmail, updateUserTermsAccepted, db } from '../services/firebaseService';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserData, UserRole } from '../types';
import { MOCK_SYSTEM_OWNER } from '../data/mockData';

interface AuthContextType {
    currentUser: any | null;
    userData: UserData | null;
    role: UserRole;
    isStudioMode: boolean;
    authLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signInAsStudio: () => Promise<void>;
    signOut: () => Promise<void>;
    clearDeviceProvisioning: () => void;
    reauthenticate: (password: string) => Promise<void>;
    sendPasswordResetEmail: (email: string) => Promise<void>;
    isImpersonating: boolean;
    startImpersonation: (impersonation: { role: UserRole, isStudioMode: boolean }) => void;
    stopImpersonation: () => void;
    showTerms: boolean;
    acceptTerms: () => Promise<void>;
    switchSimulatedUser?: (type: 'systemowner' | 'organizationadmin' | 'studio') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IMPERSONATION_KEY = 'ny-screen-impersonation';
const LOCAL_STORAGE_ORG_KEY = 'ny-screen-selected-org';
const DEVICE_LOCKED_KEY = 'ny-screen-device-locked';
const MANUAL_SIGNOUT_FLAG = 'smart-skarm-manual-signout';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [showTerms, setShowTerms] = useState(false);
    
    const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
    const [simulatedStudioMode, setSimulatedStudioMode] = useState<boolean | null>(null);

    const [impersonationState, setImpersonationState] = useState<{ role: UserRole, isStudioMode: boolean } | null>(() => {
        try {
            const storedImpersonation = localStorage.getItem(IMPERSONATION_KEY);
            return storedImpersonation ? JSON.parse(storedImpersonation) : null;
        } catch (error) {
            return null;
        }
    });

    useEffect(() => {
        if (isOffline) {
            setCurrentUser({ uid: MOCK_SYSTEM_OWNER.uid, isAnonymous: false });
            setUserData(MOCK_SYSTEM_OWNER);
            setAuthLoading(false);
            return;
        }

        let unsubscribeDoc: (() => void) | null = null;

        const unsubscribeAuth = onAuthChange(async (user) => {
            if (unsubscribeDoc) {
                unsubscribeDoc();
                unsubscribeDoc = null;
            }

            if (user) {
                // Om vi lyckas logga in, rensa utloggningsflaggan
                sessionStorage.removeItem(MANUAL_SIGNOUT_FLAG);
                setCurrentUser(user);
                if (!user.isAnonymous && db) {
                    const timeoutId = setTimeout(() => {
                        if (authLoading) setAuthLoading(false);
                    }, 5000);

                    unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                        clearTimeout(timeoutId);
                        if (snap.exists()) {
                            const data = { uid: user.uid, ...snap.data() } as UserData;
                            setUserData(data);
                            setShowTerms((data.role === 'organizationadmin' || data.role === 'systemowner') && !data.termsAcceptedAt);
                        } else {
                            setUserData(null);
                        }
                        setAuthLoading(false);
                    }, (err) => {
                        console.error("Firestore error:", err);
                        clearTimeout(timeoutId);
                        setAuthLoading(false);
                    });
                } else {
                    setUserData(null);
                    setAuthLoading(false);
                }
            } else {
                const isManualSignOut = sessionStorage.getItem(MANUAL_SIGNOUT_FLAG) === 'true';
                const isDeviceLocked = localStorage.getItem(DEVICE_LOCKED_KEY) === 'true';
                
                // Endast auto-inloggning om användaren INTE valt att logga ut manuellt
                if (isDeviceLocked && !isManualSignOut) {
                    try { 
                        await signInAsStudio(); 
                        return; 
                    } catch (e) {
                        console.error("Auto anonymous sign-in failed", e);
                    }
                }
                
                setCurrentUser(null);
                setUserData(null);
                setAuthLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeDoc) unsubscribeDoc();
        };
    }, []);

    const handleSignIn = useCallback(async (email: string, password: string) => {
        setAuthLoading(true);
        sessionStorage.removeItem(MANUAL_SIGNOUT_FLAG);
        try { await signIn(email, password); } catch (e) { setAuthLoading(false); throw e; }
    }, []);
    
    const handleSignInAsStudio = useCallback(async () => {
        sessionStorage.removeItem(MANUAL_SIGNOUT_FLAG);
        await signInAsStudio();
    }, []);

    const handleSignOut = useCallback(async () => {
        // Sätt flaggan i sessionStorage (försvinner när fliken stängs, men bryter loopen nu)
        sessionStorage.setItem(MANUAL_SIGNOUT_FLAG, 'true');
        
        localStorage.removeItem(IMPERSONATION_KEY);
        setImpersonationState(null);
        setSimulatedRole(null);
        setSimulatedStudioMode(null);
        await firebaseSignOut();
        setCurrentUser(null);
        setUserData(null);
    }, []);

    const clearDeviceProvisioning = useCallback(() => {
        localStorage.removeItem(DEVICE_LOCKED_KEY);
        localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
        // Vid nollställning vill vi definitivt inte loggas in automatiskt igen
        sessionStorage.setItem(MANUAL_SIGNOUT_FLAG, 'true');
    }, []);

    const startImpersonation = useCallback((impersonation: { role: UserRole, isStudioMode: boolean }) => {
        localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(impersonation));
        setImpersonationState(impersonation);
    }, []);
    
    const stopImpersonation = useCallback(() => {
        localStorage.removeItem(IMPERSONATION_KEY);
        setImpersonationState(null);
    }, []);

    const reauthenticate = useCallback(async (password: string): Promise<void> => {
        if (isOffline) return;
        if (!currentUser) throw new Error("Ej inloggad");
        const { reauthenticateUser } = await import('../services/firebaseService');
        await reauthenticateUser(currentUser, password);
    }, [currentUser]);

    const handleSendPasswordResetEmail = useCallback(async (email: string) => {
        return sendPasswordResetEmail(email);
    }, []);
    
    const acceptTerms = useCallback(async () => {
      if (currentUser) {
        await updateUserTermsAccepted(currentUser.uid);
        setShowTerms(false);
      }
    }, [currentUser]);

    const switchSimulatedUser = useCallback((type: 'systemowner' | 'organizationadmin' | 'studio') => {
        if (type === 'studio') {
            setSimulatedRole('member');
            setSimulatedStudioMode(true);
        } else {
            setSimulatedRole(type as UserRole);
            setSimulatedStudioMode(false);
        }
    }, []);

    const { role, isStudioMode } = useMemo(() => {
        if (simulatedRole !== null) {
            return { role: simulatedRole, isStudioMode: !!simulatedStudioMode };
        }
        if (impersonationState) return impersonationState;
        if (!currentUser) return { role: 'member' as UserRole, isStudioMode: false };
        if (currentUser.isAnonymous) return { role: 'member' as UserRole, isStudioMode: true };
        if (userData) return { role: userData.role as UserRole, isStudioMode: false };
        return { role: 'member' as UserRole, isStudioMode: false };
    }, [currentUser, userData, impersonationState, simulatedRole, simulatedStudioMode]);

    const value = useMemo(() => ({
        currentUser, userData, role, isStudioMode, authLoading,
        signIn: handleSignIn, signInAsStudio: handleSignInAsStudio, signOut: handleSignOut,
        clearDeviceProvisioning, reauthenticate, sendPasswordResetEmail: handleSendPasswordResetEmail,
        isImpersonating: !!impersonationState, startImpersonation, stopImpersonation,
        showTerms, acceptTerms,
        switchSimulatedUser
    }), [currentUser, userData, role, isStudioMode, authLoading, handleSignIn, handleSignInAsStudio, handleSignOut, impersonationState, showTerms, switchSimulatedUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};