
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { Studio, Organization, StudioConfig } from '../types';
import { getOrganizations, listenToOrganizationChanges } from '../services/firebaseService';
import { useAuth } from './AuthContext'; // Import useAuth

const DEFAULT_CONFIG: StudioConfig = {
    enableWarmup: true,
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
// Studio key is now dynamic based on user ID to support multiple anonymous users on one device
const getLocalStorageStudioKey = (uid: string) => `ny-screen-selected-studio_${uid}`;
const PENDING_STUDIO_KEY = 'ny-screen-pending-studio-id';

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, userData, isStudioMode, authLoading } = useAuth(); // Use the auth context

    const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
    const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

    const [allStudios, setAllStudios] = useState<Studio[]>([]);
    const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
    const [studioLoading, setStudioLoading] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            if (authLoading) return; // Wait for auth to be ready
            
            setStudioLoading(true);
            try {
                const fetchedOrgs = await getOrganizations();
                
                let orgToUse: Organization | null = null;
                
                if (isStudioMode) { // Anonymous studio user
                    const storedOrgJSON = localStorage.getItem(LOCAL_STORAGE_ORG_KEY);
                     if (storedOrgJSON) {
                        const storedOrg = JSON.parse(storedOrgJSON);
                        const correspondingOrg = fetchedOrgs.find(o => o.id === storedOrg.id);
                        if (correspondingOrg) {
                            orgToUse = correspondingOrg;
                        } else {
                            // Org was deleted or ID is invalid, clear storage
                            localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
                        }
                    } 
                    // CRITICAL CHANGE: We do NOT default to the first organization if none is found.
                    // The device must be provisioned.
                    
                    if (orgToUse && currentUser) {
                        setSelectedOrganization(orgToUse);
                        // In Studio Mode, we only want to expose the relevant organization
                        setAllOrganizations([orgToUse]);
                        setAllStudios(orgToUse.studios);
                        
                        // Check for pending studio activation (freshly provisioned)
                        const pendingStudioId = localStorage.getItem(PENDING_STUDIO_KEY);
                        const studioKey = getLocalStorageStudioKey(currentUser.uid);
                        
                        if (pendingStudioId) {
                            // This device was just provisioned. Bind the studio to this new anonymous user.
                            const correspondingStudio = orgToUse.studios.find(s => s.id === pendingStudioId);
                            if (correspondingStudio) {
                                setSelectedStudio(correspondingStudio);
                                localStorage.setItem(studioKey, JSON.stringify(correspondingStudio));
                            }
                            localStorage.removeItem(PENDING_STUDIO_KEY); // Clear pending flag
                        } else {
                            // Normal load
                            const storedStudioJSON = localStorage.getItem(studioKey);
                            if (storedStudioJSON) {
                                const storedStudio = JSON.parse(storedStudioJSON);
                                const correspondingStudio = orgToUse.studios.find(s => s.id === storedStudio.id);
                                if (correspondingStudio) {
                                    setSelectedStudio(correspondingStudio);
                                } else {
                                    localStorage.removeItem(studioKey);
                                }
                            }
                        }
                    } else {
                        // Not provisioned or organization invalid
                        setAllOrganizations([]);
                    }
                } else { // Logged-in admin/owner
                    setAllOrganizations(fetchedOrgs);
                    
                    if (userData && userData.organizationId) {
                        // Find the organization that matches the user's data
                        orgToUse = fetchedOrgs.find(o => o.id === userData.organizationId) || null;
                    }

                    // Fallback: If no matching org was found, or user has no orgId, default to the first one.
                    if (!orgToUse && fetchedOrgs.length > 0) {
                        console.warn("User's organizationId not found or not set, defaulting to first organization.");
                        orgToUse = fetchedOrgs[0];
                    }
                    
                    if (orgToUse) {
                        setSelectedOrganization(orgToUse);
                        setAllStudios(orgToUse.studios);
                    }
                    // Always clear selected studio for admins/coaches on initial load
                    setSelectedStudio(null);
                }
            } catch (error) {
                console.error("Failed to load initial data", error);
            } finally {
                setStudioLoading(false);
            }
        };
        loadInitialData();
    }, [authLoading, currentUser, isStudioMode, userData]);
    
    // Effect to listen for real-time updates on the selected organization
    useEffect(() => {
        if (authLoading || !selectedOrganization?.id) {
            return; // Don't listen if not ready or no org is selected
        }

        const unsubscribe = listenToOrganizationChanges(selectedOrganization.id, (updatedOrg) => {
            console.log("Real-time update received for organization:", updatedOrg.name);
            // Update the selected organization state
            setSelectedOrganization(updatedOrg);
            
            // Update the list of all organizations to keep it in sync
            setAllOrganizations(prevOrgs => 
                prevOrgs.map(o => o.id === updatedOrg.id ? updatedOrg : o)
            );

            // Also update the list of studios derived from the organization
            setAllStudios(updatedOrg.studios);
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
