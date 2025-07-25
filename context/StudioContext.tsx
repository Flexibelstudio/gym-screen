import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { Studio, Organization } from '../types';
import { getOrganizations } from '../services/firebaseService';

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
    
    loading: boolean;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const LOCAL_STORAGE_ORG_KEY = 'ny-screen-selected-org';
const LOCAL_STORAGE_STUDIO_KEY = 'ny-screen-selected-studio';

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
    const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

    const [allStudios, setAllStudios] = useState<Studio[]>([]);
    const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // 1. Fetch all organizations
                const fetchedOrgs = await getOrganizations();
                setAllOrganizations(fetchedOrgs);

                // 2. Try to set the selected organization from localStorage
                const storedOrgJSON = localStorage.getItem(LOCAL_STORAGE_ORG_KEY);
                let orgToUse: Organization | null = null;
                if (storedOrgJSON) {
                    const storedOrg = JSON.parse(storedOrgJSON);
                    const correspondingOrg = fetchedOrgs.find(o => o.id === storedOrg.id);
                    if (correspondingOrg) {
                        orgToUse = correspondingOrg;
                    }
                }
                
                // If no org is stored, default to the first one if it exists
                if (!orgToUse && fetchedOrgs.length > 0) {
                    orgToUse = fetchedOrgs[0];
                }

                if (orgToUse) {
                    setSelectedOrganization(orgToUse);
                    setAllStudios(orgToUse.studios);
                    // 3. After knowing the organization, load the selected studio for that org
                    const storedStudioJSON = localStorage.getItem(LOCAL_STORAGE_STUDIO_KEY);
                    if (storedStudioJSON) {
                        const storedStudio = JSON.parse(storedStudioJSON);
                        const correspondingStudio = orgToUse.studios.find(s => s.id === storedStudio.id);
                        if (correspondingStudio) {
                            setSelectedStudio(correspondingStudio);
                        } else {
                            localStorage.removeItem(LOCAL_STORAGE_STUDIO_KEY);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to load initial data", error);
                localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
                localStorage.removeItem(LOCAL_STORAGE_STUDIO_KEY);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);
    
    const selectOrganization = useCallback((organization: Organization | null) => {
        setSelectedOrganization(organization);
        if (organization) {
            localStorage.setItem(LOCAL_STORAGE_ORG_KEY, JSON.stringify({ id: organization.id, name: organization.name }));
            setAllStudios(organization.studios);
            // When switching orgs, clear the selected studio to avoid conflicts
            setSelectedStudio(null);
            localStorage.removeItem(LOCAL_STORAGE_STUDIO_KEY);
        } else {
            localStorage.removeItem(LOCAL_STORAGE_ORG_KEY);
            setAllStudios([]);
            setSelectedStudio(null);
        }
    }, []);

    const selectStudio = (studio: Studio) => {
        setSelectedStudio(studio);
        localStorage.setItem(LOCAL_STORAGE_STUDIO_KEY, JSON.stringify(studio));
    };
    
    const clearStudio = () => {
        setSelectedStudio(null);
        localStorage.removeItem(LOCAL_STORAGE_STUDIO_KEY);
    };

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
        loading
    }), [selectedOrganization, allOrganizations, selectOrganization, selectedStudio, allStudios, loading]);

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
