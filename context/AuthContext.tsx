import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { type User as FirebaseUser } from 'firebase/auth';
import { onAuthChange, signOut as firebaseSignOut, signIn, signInAsStudio, getUserData, isOffline } from '../services/firebaseService';
import { UserData, UserRole } from '../types';
import { MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN } from '../data/mockData';

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
    isImpersonating: boolean;
    startImpersonation: (impersonation: { role: UserRole, isStudioMode: boolean }) => void;
    stopImpersonation: () => void;
    // For developer toolbar in offline mode
    switchSimulatedUser?: (userType: SimulatedUserType) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IMPERSONATION_KEY = 'ny-screen-impersonation';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [impersonationState, setImpersonationState] = useState<{ role: UserRole, isStudioMode: boolean } | null>(() => {
        try {
            const storedImpersonation = sessionStorage.getItem(IMPERSONATION_KEY);
            return storedImpersonation ? JSON.parse(storedImpersonation) : null;
        } catch (error) {
            console.error("Failed to parse impersonation state from sessionStorage", error);
            sessionStorage.removeItem(IMPERSONATION_KEY);
            return null;
        }
    });

    const handleAuthChange = useCallback(async (user: FirebaseUser | null) => {
        setCurrentUser(user);
        if (user && !user.isAnonymous) {
            const fetchedUserData = await getUserData(user.uid);
            setUserData(fetchedUserData);
        } else {
            setUserData(null);
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


    const handleSignIn = useCallback(async (email: string, password: string) => {
        await signIn(email, password);
    }, []);
    
    const handleSignInAsStudio = useCallback(async () => {
        await signInAsStudio();
    }, []);

    const handleSignOut = useCallback(async () => {
        await firebaseSignOut();
        setCurrentUser(null);
        setUserData(null);
    }, []);

    const startImpersonation = useCallback((impersonation: { role: UserRole, isStudioMode: boolean }) => {
        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(impersonation));
        setImpersonationState(impersonation);
    }, []);

    const stopImpersonation = useCallback(() => {
        sessionStorage.removeItem(IMPERSONATION_KEY);
        setImpersonationState(null);
    }, []);

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
        isImpersonating: !!impersonationState,
        startImpersonation,
        stopImpersonation,
        switchSimulatedUser: isOffline ? switchSimulatedUser : undefined,
    }), [currentUser, userData, role, isStudioMode, authLoading, handleSignIn, handleSignInAsStudio, handleSignOut, impersonationState, startImpersonation, stopImpersonation, switchSimulatedUser]);

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