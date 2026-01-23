
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { Studio, Organization, StudioConfig } from '../types';
import { getOrganizations, getOrganizationById, listenToOrganizationChanges } from '../services/firebaseService';
import { useAuth } from './AuthContext';

const DEFAULT_CONFIG: StudioConfig = {
    customCategories: [
        { id: 'default_cat_1', name: 'HIIT', prompt: 'Skapa ett standard HIIT pass.' },
        { id: 'default_cat_2', name: 'Workout', prompt: 'Skapa ett standard Workout pass.' },
        { id: 'default_cat_3', name: 'Funktionell träning', prompt: 'Skapa ett standard Funktionell träning pass.' },
    ],
};

const getEffectiveConfig = (studio: Studio | null, org: Organization | null): StudioConfig => {
    const orgConfig = org ? org.globalConfig : DEFAULT_CONFIG;
    if (!studio || !studio.configOverrides) return orgConfig;
    return { ...orgConfig, ...studio.configOverrides };
};

interface StudioContextType {
    selectedOrganization: Organization | null;
    allOrganizations: Organization[];
    selectOrganization: (organization: Organization | null) => void;
    setAllOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>;
    selectedStudio: Studio | null;
    allStudios: Studio[];
    setAllStudios: React.Dispatch<React.SetStateAction<Studio[]>>;
    selectStudio: (studio: Studio) => void;
    clearStudio: () => void;
    studioConfig: StudioConfig;
    studioLoading: boolean;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const LOCAL_STORAGE_ORG_KEY = 'ny-screen-selected-org';
const getLocalStorageStudioKey = (uid: string) => `ny-screen-selected-studio_${uid}`;
const PENDING_STUDIO_KEY = 'ny-screen-pending-studio-id';

const safeJsonParse = (jsonString: string | null) => {
    if (!jsonString) return null;
    try { return JSON.parse(jsonString); } catch (e) { return null; }
};

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, userData, isStudioMode, authLoading, isImpersonating } = useAuth();
    const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
    const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
    const [allStudios, setAllStudios] = useState<Studio[]>([]);
    const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
    const [studioLoading, setStudioLoading] = useState(true);

    // Hjälpfunktion för att ladda en specifik organisation
    const loadOrganization = useCallback(async (orgId: string) => {
        setStudioLoading(true);
        try {
            const org = await getOrganizationById(orgId);
            if (org) {
                setSelectedOrganization(org);
                setAllStudios(org.studios);
                return org;
            }
        } catch (error) {
            console.error("Error loading organization:", error);
        } finally {
            setStudioLoading(false);
        }
        return null;
    }, []);

    // 1. Initial laddning och synk mot profil
    useEffect(() => {
        const loadInitialData = async () => {
            if (authLoading) return;
            
            setStudioLoading(true);
            try {
                let orgToUse: Organization | null = null;
                const storedOrgData = safeJsonParse(localStorage.getItem(LOCAL_STORAGE_ORG_KEY));

                // Prioritering:
                // 1. Användarens uttryckliga organisation i profil (userData)
                // 2. Sparad org i localStorage (viktigt för låsta skärmar)
                const targetOrgId = isStudioMode 
                    ? (storedOrgData?.id || userData?.organizationId)
                    : (userData?.organizationId || storedOrgData?.id);

                if (targetOrgId) {
                    orgToUse = await getOrganizationById(targetOrgId);
                }

                // Om vi är System Owner, hämta hela listan oavsett
                if (userData?.role === 'systemowner') {
                    const fetchedOrgs = await getOrganizations();
                    setAllOrganizations(fetchedOrgs);
                } else if (orgToUse) {
                    setAllOrganizations([orgToUse]);
                }

                if (orgToUse) {
                    setSelectedOrganization(orgToUse);
                    setAllStudios(orgToUse.studios);

                    // Hantera studio-val för skärmar
                    if (isStudioMode && currentUser) {
                        const pendingStudioId = localStorage.getItem(PENDING_STUDIO_KEY);
                        const studioKey = getLocalStorageStudioKey(currentUser.uid);
                        
                        if (pendingStudioId) {
                            const correspondingStudio = orgToUse.studios.find(s => s.id === pendingStudioId);
                            if (correspondingStudio) {
                                setSelectedStudio(correspondingStudio);
                                localStorage.setItem(studioKey, JSON.stringify(correspondingStudio));
                            }
                            localStorage.removeItem(PENDING_STUDIO_KEY);
                        } else {
                            const storedStudio = safeJsonParse(localStorage.getItem(studioKey));
                            if (storedStudio?.id) {
                                const correspondingStudio = orgToUse.studios.find(s => s.id === storedStudio.id);
                                if (correspondingStudio) setSelectedStudio(correspondingStudio);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("StudioContext initial load error:", error);
            } finally {
                setStudioLoading(false);
            }
        };
        loadInitialData();
    }, [authLoading, currentUser?.uid, isStudioMode]); // Vi kör denna bara vid start eller auth-ändring

    // 2. REAKTIV SYNK: Lyssna på ändringar i userData.organizationId
    // Detta löser problemet när en ny org skapas eller man byter org i profilen
    useEffect(() => {
        if (authLoading || isStudioMode || !userData?.organizationId) return;

        if (selectedOrganization?.id !== userData.organizationId) {
            console.log("Org mismatch detected, syncing to profile...", userData.organizationId);
            loadOrganization(userData.organizationId);
        }
    }, [userData?.organizationId, authLoading, isStudioMode, selectedOrganization?.id, loadOrganization]);
    
    // 3. Realtidsuppdateringar för den valda organisationen
    useEffect(() => {
        if (authLoading || !selectedOrganization?.id) return;
        const unsubscribe = listenToOrganizationChanges(selectedOrganization.id, (updatedOrg) => {
            setSelectedOrganization(updatedOrg);
            // Uppdatera även i listan om den finns där
            setAllOrganizations(prevOrgs => prevOrgs.map(o => o.id === updatedOrg.id ? updatedOrg : o));
            setAllStudios(updatedOrg.studios);
        });
        return () => unsubscribe();
    }, [selectedOrganization?.id, authLoading]);

    const selectOrganization = useCallback((organization: Organization | null) => {
        setSelectedOrganization(organization);
        if (organization) {
            localStorage.setItem(LOCAL_STORAGE_ORG_KEY, JSON.stringify({ id: organization.id, name: organization.name }));
            setAllStudios(organization.studios);
            if (isStudioMode && currentUser) localStorage.removeItem(getLocalStorageStudioKey(currentUser.uid));
            setSelectedStudio(null);
        } else {
            localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
            setAllStudios([]);
            setSelectedStudio(null);
        }
    }, [currentUser, isStudioMode]);

    const selectStudio = useCallback((studio: Studio) => {
        setSelectedStudio(studio);
        if (currentUser && isStudioMode) localStorage.setItem(getLocalStorageStudioKey(currentUser.uid), JSON.stringify(studio));
    }, [currentUser, isStudioMode]);
    
    const clearStudio = useCallback(() => {
        setSelectedStudio(null);
        if (currentUser && isStudioMode) localStorage.removeItem(getLocalStorageStudioKey(currentUser.uid));
    }, [currentUser, isStudioMode]);

    const studioConfig = useMemo(() => getEffectiveConfig(selectedStudio, selectedOrganization), [selectedStudio, selectedOrganization]);

    const value = useMemo(() => ({
        selectedOrganization, allOrganizations, selectOrganization, setAllOrganizations,
        selectedStudio, allStudios, setAllStudios, selectStudio, clearStudio,
        studioConfig, studioLoading
    }), [selectedOrganization, allOrganizations, selectOrganization, selectedStudio, allStudios, selectStudio, clearStudio, studioConfig, studioLoading]);

    return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export const useStudio = (): StudioContextType => {
    const context = useContext(StudioContext);
    if (context === undefined) throw new Error('useStudio must be used within a StudioProvider');
    return context;
};
