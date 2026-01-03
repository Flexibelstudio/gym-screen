
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { onAuthChange, signOut as firebaseSignOut, signIn, signInAsStudio, getUserData, isOffline, sendPasswordResetEmail, updateUserTermsAccepted, reauthenticateUser, db } from '../services/firebaseService';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserData, UserRole } from '../types';
import { MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN } from '../data/mockData';

type FirebaseUser = firebase.User;
type SimulatedUserType = 'systemowner' | 'organizationadmin' | 'studio';

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
    switchSimulatedUser?: (userType: SimulatedUserType) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IMPERSONATION_KEY = 'ny-screen-impersonation';
const LOCAL_STORAGE_ORG_KEY = 'ny-screen-selected-org';
const DEVICE_LOCKED_KEY = 'ny-screen-device-locked';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [showTerms, setShowTerms] = useState(false);
    const [impersonationState, setImpersonationState] = useState<{ role: UserRole, isStudioMode: boolean } | null>(() => {
        try {
            const storedImpersonation = localStorage.getItem(IMPERSONATION_KEY);
            return storedImpersonation ? JSON.parse(storedImpersonation) : null;
        } catch (error) {
            return null;
        }
    });

    useEffect(() => {
        if (isOffline || !db) return;

        let unsubscribeDoc: (() => void) | null = null;

        const unsubscribeAuth = onAuthChange(async (user) => {
            if (unsubscribeDoc) {
                unsubscribeDoc();
                unsubscribeDoc = null;
            }

            if (user) {
                setCurrentUser(user);
                if (!user.isAnonymous) {
                    // Starta realtids-lyssnare på användardokumentet
                    unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                        if (snap.exists()) {
                            const data = { uid: user.uid, ...snap.data() } as UserData;
                            setUserData(data);
                            if ((data.role === 'organizationadmin' || data.role === 'systemowner') && !data.termsAcceptedAt) {
                                setShowTerms(true);
                            } else {
                                setShowTerms(false);
                            }
                        }
                        setAuthLoading(false);
                    }, (err) => {
                        console.error("User doc listener error:", err);
                        setAuthLoading(false);
                    });
                } else {
                    setUserData(null);
                    setShowTerms(false);
                    setAuthLoading(false);
                }
            } else {
                // Endast auto-login om enheten är explicit låst som en skärm
                const isDeviceLocked = localStorage.getItem(DEVICE_LOCKED_KEY) === 'true';
                const hasProvisionedOrg = localStorage.getItem(LOCAL_STORAGE_ORG_KEY);
                
                if (isDeviceLocked && hasProvisionedOrg) {
                    try {
                        await signInAsStudio();
                        return; 
                    } catch (e) {}
                }

                setCurrentUser(null);
                setUserData(null);
                setShowTerms(false);
                setAuthLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeDoc) unsubscribeDoc();
        };
    }, []);

    const [simulatedUserType, setSimulatedUserType] = useState<SimulatedUserType>('systemowner');

    useEffect(() => {
        if (!isOffline) return;
        const simulateUser = async () => {
            setAuthLoading(true);
            let simulatedFirebaseUser: any | null = null;
            let simulatedUserData: UserData | null = null;

            if (simulatedUserType === 'systemowner') {
                simulatedFirebaseUser = { uid: MOCK_SYSTEM_OWNER.uid, isAnonymous: false };
                simulatedUserData = MOCK_SYSTEM_OWNER;
            } else if (simulatedUserType === 'organizationadmin') {
                simulatedFirebaseUser = { uid: MOCK_ORG_ADMIN.uid, isAnonymous: false };
                simulatedUserData = MOCK_ORG_ADMIN;
            } else if (simulatedUserType === 'studio') {
                simulatedFirebaseUser = { uid: 'offline_studio_uid', isAnonymous: true };
                simulatedUserData = null;
            }
            
            setCurrentUser(simulatedFirebaseUser);
            setUserData(simulatedUserData);
            setAuthLoading(false);
        };
        simulateUser();
    }, [isOffline, simulatedUserType]);
    
    const switchSimulatedUser = useCallback((userType: SimulatedUserType) => {
        if (isOffline) setSimulatedUserType(userType);
    }, []);

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
        stopImpersonation();
        await firebaseSignOut();
        setCurrentUser(null);
        setUserData(null);
    }, [stopImpersonation]);

    const clearDeviceProvisioning = useCallback(() => {
        localStorage.removeItem(DEVICE_LOCKED_KEY);
        localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('ny-screen-selected-studio')) {
                localStorage.removeItem(key);
            }
        });
    }, []);

    const startImpersonation = useCallback((impersonation: { role: UserRole, isStudioMode: boolean }) => {
        localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(impersonation));
        setImpersonationState(impersonation);
    }, []);
    
    const reauthenticate = useCallback(async (password: string): Promise<void> => {
        if (isOffline) return Promise.resolve();
        if (!currentUser) throw new Error("Ingen användare inloggad.");
        await reauthenticateUser(currentUser, password);
    }, [currentUser]);

    const handleSendPasswordResetEmail = useCallback(async (email: string) => {
        return sendPasswordResetEmail(email);
    }, []);
    
    const acceptTerms = useCallback(async () => {
      if (currentUser) {
        await updateUserTermsAccepted(currentUser.uid);
        const updatedUserData = { ...userData, termsAcceptedAt: Date.now() };
        setUserData(updatedUserData as UserData);
        setShowTerms(false);
      }
    }, [currentUser, userData]);

    const { role, isStudioMode } = useMemo(() => {
        if (impersonationState) return impersonationState;
        if (!currentUser) return { role: 'member' as UserRole, isStudioMode: false };
        if (currentUser.isAnonymous) return { role: 'member' as UserRole, isStudioMode: true };
        if (userData) return { role: userData.role as UserRole, isStudioMode: false };
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
        clearDeviceProvisioning,
        reauthenticate,
        sendPasswordResetEmail: handleSendPasswordResetEmail,
        isImpersonating: !!impersonationState,
        startImpersonation,
        stopImpersonation,
        showTerms,
        acceptTerms,
        switchSimulatedUser: isOffline ? switchSimulatedUser : undefined,
    }), [currentUser, userData, role, isStudioMode, authLoading, handleSignIn, handleSignInAsStudio, handleSignOut, clearDeviceProvisioning, reauthenticate, handleSendPasswordResetEmail, impersonationState, startImpersonation, stopImpersonation, showTerms, acceptTerms, switchSimulatedUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
