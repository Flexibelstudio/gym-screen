import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { onAuthChange, signOut as firebaseSignOut, signIn, signInAsStudio, getUserData, isOffline, sendPasswordResetEmail, updateUserTermsAccepted } from '../services/firebaseService';
import { UserData, UserRole } from '../types';
import { MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN } from '../data/mockData';

type FirebaseUser = firebase.User;
type SimulatedUserType = 'systemowner' | 'organizationadmin' | 'studio';

interface AuthContextType {
    currentUser: FirebaseUser | null;
    userData: UserData | null;
    role: UserRole;
    isStudioMode: boolean;
    authLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signInAsStudio: () => Promise<void>;
    signOut: () => Promise<void>;
    reauthenticate: (password: string) => Promise<void>;
    sendPasswordResetEmail: (email: string) => Promise<void>;
    isImpersonating: boolean;
    startImpersonation: (impersonation: { role: UserRole, isStudioMode: boolean }) => void;
    stopImpersonation: () => void;
    showTerms: boolean;
    acceptTerms: () => Promise<void>;
    // For developer toolbar in offline mode
    switchSimulatedUser?: (userType: SimulatedUserType) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IMPERSONATION_KEY = 'ny-screen-impersonation';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [showTerms, setShowTerms] = useState(false);
    const [impersonationState, setImpersonationState] = useState<{ role: UserRole, isStudioMode: boolean } | null>(() => {
        try {
            // Use localStorage for more persistent state across sessions
            const storedImpersonation = localStorage.getItem(IMPERSONATION_KEY);
            return storedImpersonation ? JSON.parse(storedImpersonation) : null;
        } catch (error) {
            console.error("Failed to parse impersonation state from localStorage", error);
            localStorage.removeItem(IMPERSONATION_KEY);
            return null;
        }
    });

    const handleAuthChange = useCallback(async (user: FirebaseUser | null) => {
        setCurrentUser(user);
        if (user && !user.isAnonymous) {
            const fetchedUserData = await getUserData(user.uid);
            setUserData(fetchedUserData);
             if (fetchedUserData && (fetchedUserData.role === 'organizationadmin' || fetchedUserData.role === 'systemowner') && !fetchedUserData.termsAcceptedAt) {
              setShowTerms(true);
            } else {
              setShowTerms(false);
            }
        } else {
            setUserData(null);
            setShowTerms(false);
        }
        setAuthLoading(false);
    }, []);

    // Effect for handling real authentication state changes
    useEffect(() => {
        if (isOffline) {
            // In offline mode, we don't listen to real auth changes.
            // The simulation logic below will handle it.
            return;
        }
        const unsubscribe = onAuthChange(handleAuthChange);
        return () => unsubscribe();
    }, [handleAuthChange]);


    // --- OFFLINE SIMULATION LOGIC ---
    const [simulatedUserType, setSimulatedUserType] = useState<SimulatedUserType>('systemowner');

    useEffect(() => {
        if (!isOffline) return;

        const simulateUser = async () => {
            setAuthLoading(true);
            let simulatedFirebaseUser: FirebaseUser | null = null;
            let simulatedUserData: UserData | null = null;

            if (simulatedUserType === 'systemowner') {
                simulatedFirebaseUser = { uid: MOCK_SYSTEM_OWNER.uid, isAnonymous: false } as FirebaseUser;
                simulatedUserData = MOCK_SYSTEM_OWNER;
            } else if (simulatedUserType === 'organizationadmin') {
                simulatedFirebaseUser = { uid: MOCK_ORG_ADMIN.uid, isAnonymous: false } as FirebaseUser;
                simulatedUserData = MOCK_ORG_ADMIN;
            } else if (simulatedUserType === 'studio') {
                simulatedFirebaseUser = { uid: 'offline_studio_uid', isAnonymous: true } as FirebaseUser;
                simulatedUserData = null;
            }
            
            setCurrentUser(simulatedFirebaseUser);
            setUserData(simulatedUserData);
            setAuthLoading(false);
        };

        simulateUser();
    }, [isOffline, simulatedUserType]);
    
    const switchSimulatedUser = useCallback((userType: SimulatedUserType) => {
        if (isOffline) {
            setSimulatedUserType(userType);
        } else {
            console.warn("Cannot switch simulated user when online.");
        }
    }, []);
    // --- END OFFLINE SIMULATION LOGIC ---


    const stopImpersonation = useCallback(() => {
        localStorage.removeItem(IMPERSONATION_KEY);
        setImpersonationState(null);
    }, []);

    const handleSignIn = useCallback(async (email: string, password: string) => {
        await signIn(email, password);
    }, []);
    
    const handleSignInAsStudio = useCallback(async () => {
        await signInAsStudio();
    }, []);

    const handleSignOut = useCallback(async () => {
        stopImpersonation(); // Clear impersonation state on sign out
        await firebaseSignOut();
        setCurrentUser(null);
        setUserData(null);
    }, [stopImpersonation]);

    const startImpersonation = useCallback((impersonation: { role: UserRole, isStudioMode: boolean }) => {
        localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(impersonation));
        setImpersonationState(impersonation);
    }, []);
    
    const reauthenticate = useCallback(async (password: string): Promise<void> => {
        if (isOffline) {
            // In offline mode, assume success since we can't truly re-authenticate.
            return Promise.resolve();
        }

        if (!currentUser || !currentUser.email) {
            throw new Error("Ingen användare inloggad för återautentisering.");
        }
        
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
        await currentUser.reauthenticateWithCredential(credential);
    }, [currentUser]);

    const handleSendPasswordResetEmail = useCallback(async (email: string) => {
        return sendPasswordResetEmail(email);
    }, []);
    
    const acceptTerms = useCallback(async () => {
      if (currentUser) {
        await updateUserTermsAccepted(currentUser.uid);
        // Optimistically update local state to hide modal immediately
        const updatedUserData = { ...userData, termsAcceptedAt: Date.now() };
        setUserData(updatedUserData as UserData);
        setShowTerms(false);
      }
    }, [currentUser, userData]);

    const { role, isStudioMode } = useMemo(() => {
        if (impersonationState) {
            return impersonationState;
        }

        if (!currentUser) {
            return { role: 'member' as UserRole, isStudioMode: false };
        }
        if (currentUser.isAnonymous) {
            return { role: 'member' as UserRole, isStudioMode: true };
        }
        if (userData) {
            return { role: userData.role as UserRole, isStudioMode: false };
        }
        return { role: 'member' as UserRole, isStudioMode: false };
    }, [currentUser, userData, impersonationState]);

    const value = useMemo(() => ({
        currentUser,
        userData,
        role,
        isStudioMode,
        authLoading,
        signIn: handleSignIn,
        signInAsStudio: handleSignInAsStudio,
        signOut: handleSignOut,
        reauthenticate,
        sendPasswordResetEmail: handleSendPasswordResetEmail,
        isImpersonating: !!impersonationState,
        startImpersonation,
        stopImpersonation,
        showTerms,
        acceptTerms,
        switchSimulatedUser: isOffline ? switchSimulatedUser : undefined,
    }), [currentUser, userData, role, isStudioMode, authLoading, handleSignIn, handleSignInAsStudio, handleSignOut, reauthenticate, handleSendPasswordResetEmail, impersonationState, startImpersonation, stopImpersonation, showTerms, acceptTerms, switchSimulatedUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};