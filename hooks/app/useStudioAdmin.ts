import { Studio, StudioConfig, Organization } from '../../types';
import {
  updateStudioConfig,
  updateGlobalConfig,
  createStudio,
  updateStudio,
  deleteStudio
} from '../../services/firebaseService';

export interface UseStudioAdminDeps {
  selectedOrganization: Organization | null;
  allOrganizations: Organization[];
  selectOrganization: (org: Organization | null) => void;
  setAllOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>;
  selectStudio: (studio: Studio | null) => void;
  setAllStudios: React.Dispatch<React.SetStateAction<Studio[]>>;
  setStudioToEditConfig: (studio: Studio | null) => void;
}

export function useStudioAdmin(deps: UseStudioAdminDeps) {
  const {
    selectedOrganization,
    allOrganizations,
    selectOrganization,
    setAllOrganizations,
    selectStudio,
    setAllStudios,
    setStudioToEditConfig,
  } = deps;

  const handleSaveStudioConfig = async (organizationId: string, studioId: string, newConfigOverrides: Partial<StudioConfig>) => {
    try {
      const updatedStudio = await updateStudioConfig(organizationId, studioId, newConfigOverrides);
      selectStudio(updatedStudio); 
      setAllStudios(prev => prev.map(s => s.id === studioId ? updatedStudio : s));
      setStudioToEditConfig(null);
    } catch (error) {
      console.error("Failed to save studio config:", error);
      alert("Kunde inte spara konfigurationen.");
    }
  };

  const handleEditStudioConfig = (studio: Studio) => setStudioToEditConfig(studio);

  const handleSaveGlobalConfig = async (organizationId: string, newConfig: StudioConfig) => {
    try {
      await updateGlobalConfig(organizationId, newConfig);
      const updatedOrg = { ...selectedOrganization!, globalConfig: newConfig };
      selectOrganization(updatedOrg);
      setAllOrganizations(prev => prev.map(o => o.id === organizationId ? updatedOrg : o));
    } catch (error) {
      console.error("Failed to save global config:", error);
      alert("Kunde inte spara global konfiguration.");
    }
  };

  const handleCreateStudio = async (organizationId: string, name: string, locationId?: string) => {
    try {
      const newStudio = await createStudio(organizationId, name, locationId);
      const newOrgs = allOrganizations.length > 0 ? allOrganizations.map(o => o.id === organizationId ? { ...o, studios: [...o.studios, newStudio] } : o) : [];
      setAllOrganizations(newOrgs);
      const updatedOrg = newOrgs.find(o => o.id === organizationId);
      if (updatedOrg) selectOrganization(updatedOrg);
    } catch (error) {
      console.error("Failed to create studio:", error);
      alert("Kunde inte skapa studio.");
    }
  };

  const handleUpdateStudio = async (organizationId: string, studioId: string, name: string, locationId?: string) => {
    try {
      await updateStudio(organizationId, studioId, name, locationId);
      const newOrgs = allOrganizations.map(o => {
        if (o.id === organizationId) {
          return { ...o, studios: o.studios.map(s => s.id === studioId ? { ...s, name, locationId: locationId !== undefined ? locationId : s.locationId } : s) };
        }
        return o;
      });
      setAllOrganizations(newOrgs);
      const updatedOrg = newOrgs.find(o => o.id === organizationId);
      if (updatedOrg) selectOrganization(updatedOrg);
    } catch (error) {
      console.error("Failed to update studio:", error);
      alert("Kunde inte uppdatera studion.");
    }
  };

  const handleDeleteStudio = async (organizationId: string, studioId: string) => {
    try {
      await deleteStudio(organizationId, studioId);
      const newOrgs = allOrganizations.map(o => {
        if (o.id === organizationId) {
          return { ...o, studios: o.studios.filter(s => s.id !== studioId) };
        }
        return o;
      });
      setAllOrganizations(newOrgs);
      const updatedOrg = newOrgs.find(o => o.id === organizationId);
      if (updatedOrg) selectOrganization(updatedOrg);
    } catch (error) {
      console.error("Failed to delete studio:", error);
      alert("Kunde inte ta bort studion.");
    }
  };

  return {
    handleSaveStudioConfig,
    handleEditStudioConfig,
    handleSaveGlobalConfig,
    handleCreateStudio,
    handleUpdateStudio,
    handleDeleteStudio,
  };
}
