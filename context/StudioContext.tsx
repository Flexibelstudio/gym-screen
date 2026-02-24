
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { Studio, Organization, StudioConfig } from '../types';
import { getOrganizations, getOrganizationById, listenToOrganizationChanges } from '../services/firebaseService';
import { useAuth } from './AuthContext'; // Import useAuth

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

    const studioOverrides = studio.configOverrides;

    return {
        ...orgConfig,
        ...studioOverrides,
    };
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
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn("Failed to parse JSON from localStorage:", e);
        return null;
    }
};

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, userData, isStudioMode, authLoading, isImpersonating } = useAuth();

    const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
    const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

    const [allStudios, setAllStudios] = useState<Studio[]>([]);
    const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
    const [studioLoading, setStudioLoading] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            if (authLoading) return;
            
            setStudioLoading(true);
            try {
                let fetchedOrgs: Organization[] = [];
                let orgToUse: Organization | null = null;

                // 1. Hantera Roll-baserad laddning
                if (userData?.role === 'systemowner') {
                    fetchedOrgs = await getOrganizations();
                    // Systemägare: prioritera redan vald org (från state eller localStorage) framför profil-ID
                    const storedOrgJSON = localStorage.getItem(LOCAL_STORAGE_ORG_KEY);
                    const storedOrgData = safeJsonParse(storedOrgJSON);
                    
                    if (selectedOrganization) {
                        orgToUse = selectedOrganization;
                    } else if (storedOrgData?.id) {
                        orgToUse = await getOrganizationById(storedOrgData.id);
                    }
                    
                    // Fallback för Systemägare: Om inget valts i localStorage, kolla profilens ID.
                    // Men gissa ALDRIG fetchedOrgs[0].
                    if (!orgToUse && userData?.organizationId) {
                        orgToUse = await getOrganizationById(userData.organizationId);
                    }
                } else if (userData?.organizationId) {
                    const org = await getOrganizationById(userData.organizationId);
                    if (org) {
                        fetchedOrgs = [org];
                        orgToUse = org;
                        
                        // SÄKERHET: Om inloggad användare har en org, rensa localStorage om den pekar fel
                        const storedOrgJSON = localStorage.getItem(LOCAL_STORAGE_ORG_KEY);
                        const storedOrgData = safeJsonParse(storedOrgJSON);
                        if (storedOrgData && storedOrgData.id !== userData.organizationId) {
                            localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
                            if (currentUser) localStorage.removeItem(getLocalStorageStudioKey(currentUser.uid));
                        }
                    }
                } else if (isStudioMode && !isImpersonating) {
                    const storedOrgJSON = localStorage.getItem(LOCAL_STORAGE_ORG_KEY);
                    const storedOrgData = safeJsonParse(storedOrgJSON);
                    
                    if (storedOrgData?.id) {
                        const org = await getOrganizationById(storedOrgData.id);
                        if (org) {
                            fetchedOrgs = [org];
                            orgToUse = org;
                        } else {
                            localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
                        }
                    }
                }

                if (isImpersonating && selectedOrganization) {
                    orgToUse = selectedOrganization;
                }
                
                setAllOrganizations(fetchedOrgs);

                if (orgToUse) {
                    setSelectedOrganization(orgToUse);
                    setAllStudios(orgToUse.studios);

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
                            const storedStudioJSON = localStorage.getItem(studioKey);
                            const storedStudio = safeJsonParse(storedStudioJSON);
                            
                            if (storedStudio?.id) {
                                const correspondingStudio = orgToUse.studios.find(s => s.id === storedStudio.id);
                                if (correspondingStudio) {
                                    setSelectedStudio(correspondingStudio);
                                }
                            }
                        }
                    }
                } else {
                    // Ingen organisation hittades att auto-ladda. 
                    setSelectedOrganization(null);
                    setAllStudios([]);
                    setSelectedStudio(null);
                }

            } catch (error) {
                console.error("Failed to load initial data", error);
            } finally {
                setStudioLoading(false);
            }
        };
        loadInitialData();
    }, [authLoading, currentUser?.uid, isStudioMode, userData?.organizationId, userData?.role, isImpersonating]);
    
    useEffect(() => {
        if (authLoading || !selectedOrganization?.id) return;

        const unsubscribe = listenToOrganizationChanges(selectedOrganization.id, (updatedOrg) => {
            setSelectedOrganization(updatedOrg);
            setAllOrganizations(prevOrgs => 
                prevOrgs.map(o => o.id === updatedOrg.id ? updatedOrg : o)
            );
            setAllStudios(updatedOrg.studios);

            // FIX: Update selectedStudio if it exists in the updated list to ensure we have the latest remoteState
            setSelectedStudio(prevStudio => {
                if (!prevStudio) return null;
                const updated = updatedOrg.studios.find(s => s.id === prevStudio.id);
                // Only update if actually changed to avoid unnecessary re-renders (though object ref change will trigger it anyway)
                return updated || prevStudio;
            });
        });

        return () => unsubscribe();
    }, [selectedOrganization?.id, authLoading]);

    const selectOrganization = useCallback((organization: Organization | null) => {
        setSelectedOrganization(organization);
        if (organization) {
            localStorage.setItem(LOCAL_STORAGE_ORG_KEY, JSON.stringify({ id: organization.id, name: organization.name }));
            setAllStudios(organization.studios);
            if (isStudioMode && currentUser) {
                 localStorage.removeItem(getLocalStorageStudioKey(currentUser.uid));
            }
            setSelectedStudio(null);
        } else {
            localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
            setAllStudios([]);
            setSelectedStudio(null);
        }
    }, [currentUser, isStudioMode]);

    const selectStudio = useCallback((studio: Studio) => {
        setSelectedStudio(studio);
        if (currentUser && isStudioMode) {
            localStorage.setItem(getLocalStorageStudioKey(currentUser.uid), JSON.stringify(studio));
        }
    }, [currentUser, isStudioMode]);
    
    const clearStudio = useCallback(() => {
        setSelectedStudio(null);
        if (currentUser && isStudioMode) {
            localStorage.removeItem(getLocalStorageStudioKey(currentUser.uid));
        }
    }, [currentUser, isStudioMode]);

    const studioConfig = useMemo(() => getEffectiveConfig(selectedStudio, selectedOrganization), [selectedStudio, selectedOrganization]);

    const value = useMemo(() => ({
        selectedOrganization,
        allOrganizations,
        selectOrganization,
        setAllOrganizations,
        selectedStudio,
        allStudios,
        setAllStudios,
        selectStudio,
        clearStudio,
        studioConfig,
        studioLoading
    }), [selectedOrganization, allOrganizations, selectOrganization, selectedStudio, allStudios, selectStudio, clearStudio, studioConfig, studioLoading]);

    return (
        <StudioContext.Provider value={value}>
            {children}
        </StudioContext.Provider>
    );
};

export const useStudio = (): StudioContextType => {
    const context = useContext(StudioContext);
    if (context === undefined) {
        throw new Error('useStudio must be used within a StudioProvider');
    }
    return context;
};
