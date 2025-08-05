import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { Studio, Organization } from '../types';
import { getOrganizations } from '../services/firebaseService';
import { useAuth } from './AuthContext'; // Import useAuth

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
    
    studioLoading: boolean;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const LOCAL_STORAGE_ORG_KEY = 'ny-screen-selected-org';
// Studio key is now dynamic based on user ID to support multiple anonymous users on one device
const getLocalStorageStudioKey = (uid: string) => `ny-screen-selected-studio_${uid}`;

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, isStudioMode, authLoading } = useAuth(); // Use the auth context

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
                setAllOrganizations(fetchedOrgs);

                let orgToUse: Organization | null = null;
                
                if (isStudioMode) { // Anonymous studio user
                    const storedOrgJSON = localStorage.getItem(LOCAL_STORAGE_ORG_KEY);
                     if (storedOrgJSON) {
                        const storedOrg = JSON.parse(storedOrgJSON);
                        const correspondingOrg = fetchedOrgs.find(o => o.id === storedOrg.id);
                        if (correspondingOrg) {
                            orgToUse = correspondingOrg;
                        }
                    } else if (fetchedOrgs.length > 0) {
                        orgToUse = fetchedOrgs[0];
                    }

                    if (orgToUse && currentUser) {
                        setSelectedOrganization(orgToUse);
                        setAllStudios(orgToUse.studios);
                        const studioKey = getLocalStorageStudioKey(currentUser.uid);
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
                } else { // Logged-in admin/owner
                    if (fetchedOrgs.length > 0) {
                        orgToUse = fetchedOrgs[0];
                        setSelectedOrganization(orgToUse);
                        setAllStudios(orgToUse.studios);
                        setSelectedStudio(null); // Admins don't have a default studio selected
                    }
                }
            } catch (error) {
                console.error("Failed to load initial data", error);
            } finally {
                setStudioLoading(false);
            }
        };
        loadInitialData();
    }, [authLoading, currentUser, isStudioMode]);
    
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
        studioLoading
    }), [selectedOrganization, allOrganizations, selectOrganization, selectedStudio, allStudios, selectStudio, clearStudio, studioLoading]);

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