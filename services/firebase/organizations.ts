import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, writeBatch, deleteField, serverTimestamp 
} from 'firebase/firestore';
import { db, isOffline, sanitizeData, generateInviteCode } from './init';
import { Organization, CustomPage, InfoCarousel, CompanyDetails, BenchmarkDefinition, Studio, SmartScreenPricing } from '../../types';
import { MOCK_ORGANIZATIONS, MOCK_SMART_SCREEN_PRICING } from '../../data/mockData';

export const getOrganizations = async (): Promise<Organization[]> => {
    if (isOffline || !db) return MOCK_ORGANIZATIONS;
    try {
        const snap = await getDocs(collection(db, 'organizations'));
        return snap.docs.map(d => {
            const data = { id: d.id, ...d.data() } as Organization;
            if (!data.studios) data.studios = [];
            return data;
        });
    } catch (e) { return []; }
};

export const getOrganizationById = async (id: string): Promise<Organization | null> => {
    if (isOffline || !db || !id) return MOCK_ORGANIZATIONS.find(o => o.id === id) || null;
    try {
        const snap = await getDoc(doc(db, 'organizations', id));
        if (!snap.exists()) return null;
        const data = { id: snap.id, ...snap.data() } as Organization;
        if (!data.studios) data.studios = [];
        return data;
    } catch (e) { return null; }
};

export const listenToOrganizationChanges = (id: string, onUpdate: (org: Organization) => void) => {
    if (isOffline || !db || !id) return () => {}; 
    return onSnapshot(doc(db, 'organizations', id), (snap) => {
        if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as Organization;
            if (!data.studios) data.studios = [];
            onUpdate(data);
        }
    }, (err) => console.error("listenToOrganizationChanges failed", err));
};



export const createOrganization = async (name: string, subdomain: string): Promise<Organization> => {
    if(isOffline || !db) throw new Error("Offline");
    const id = `org_${subdomain}_${Date.now()}`;
    const initialInviteCode = generateInviteCode();
    const initialCoachCode = generateInviteCode();
    
    const defaultLocation = {
        id: `loc_${Date.now()}`,
        name: name,
        createdAt: Date.now(),
        inviteCode: initialInviteCode,
        coachCode: initialCoachCode
    };

    const newOrg: Organization = { 
        id, name, subdomain, passwords: { coach: '1234' }, studios: [], locations: [defaultLocation], customPages: [], status: 'active',
        inviteCode: initialInviteCode,
        coachCode: initialCoachCode,
        globalConfig: { customCategories: [{ id: '1', name: 'Standard', prompt: '' }] } 
    };
    await setDoc(doc(db, 'organizations', id), newOrg);
    return newOrg;
};

// ... (updateOrganization functions)
export const updateOrganizationName = async (id: string, name: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { name });
    return getOrganizationById(id);
};

export const updateOrganization = async (id: string, name: string, subdomain: string, inviteCode?: string, coachCode?: string, maxFreeCoaches?: number) => {
    if(isOffline || !db || !id) return;
    const updateData: any = { name, subdomain };
    if (inviteCode) updateData.inviteCode = inviteCode.toUpperCase();
    if (coachCode) updateData.coachCode = coachCode.toUpperCase();
    if (maxFreeCoaches !== undefined) updateData.maxFreeCoaches = maxFreeCoaches;
    await updateDoc(doc(db, 'organizations', id), updateData);
    return getOrganizationById(id);
};

export const updateOrganizationPasswords = async (id: string, passwords: Organization['passwords']) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { passwords });
    return getOrganizationById(id);
};

export const updateOrganizationLogos = async (id: string, logos: { light: string; dark: string }) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { logoUrlLight: logos.light, logoUrlDark: logos.dark });
    return getOrganizationById(id);
};

export const updateOrganizationFavicon = async (id: string, faviconUrl: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { faviconUrl });
    return getOrganizationById(id);
};

export const updateOrganizationAppIcon = async (id: string, appIconUrl: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { appIconUrl });
    return getOrganizationById(id);
};

export const updateOrganizationPrimaryColor = async (id: string, color: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { primaryColor: color });
    return getOrganizationById(id);
};

export const updateOrganizationCustomPages = async (id: string, customPages: CustomPage[]) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { customPages: sanitizeData(customPages) });
    return getOrganizationById(id);
};

export const updateOrganizationLocations = async (id: string, locations: any[]) => {
    if(isOffline || !db || !id) return;
    
    const inviteCodes: string[] = [];
    locations.forEach(loc => {
        if (loc.inviteCode) inviteCodes.push(loc.inviteCode.toUpperCase());
        if (loc.coachCode) inviteCodes.push(loc.coachCode.toUpperCase());
    });

    await updateDoc(doc(db, 'organizations', id), { 
        locations: sanitizeData(locations),
        inviteCodes 
    });
};

export const updateOrganizationInfoCarousel = async (id: string, infoCarousel: InfoCarousel) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { infoCarousel: sanitizeData(infoCarousel) });
    return getOrganizationById(id);
};

export const updateOrganizationCompanyDetails = async (id: string, details: CompanyDetails) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { companyDetails: sanitizeData(details) });
    return getOrganizationById(id);
};

export const updateOrganizationDiscount = async (id: string, discount: { type: 'percentage' | 'fixed', value: number }) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { discountType: discount.type, discountValue: discount.value });
    return getOrganizationById(id);
};

export const updateOrganizationFreeCoaches = async (id: string, count: number) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { freeCoachAccounts: count });
    return getOrganizationById(id);
};

export const undoLastBilling = async (id: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { lastBilledMonth: deleteField(), lastBilledDate: deleteField() });
    return getOrganizationById(id);
};

export const updateGlobalConfig = async (id: string, config: any) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { globalConfig: sanitizeData(config) });
};

export const updateOrganizationBenchmarks = async (id: string, benchmarks: BenchmarkDefinition[]) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { benchmarkDefinitions: sanitizeData(benchmarks) });
    return getOrganizationById(id);
};

export const createStudio = async (orgId: string, name: string, locationId?: string) => {
    if(isOffline || !db || !orgId) return { id: 'off', name };
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studio = { id: `st_${Date.now()}`, name, createdAt: Date.now(), configOverrides: {}, locationId };
    await updateDoc(doc(db, 'organizations', orgId), { studios: [...org.studios, studio] });
    return studio;
};

export const updateStudio = async (orgId: string, studioId: string, name: string, locationId?: string) => {
    if(isOffline || !db || !orgId) return;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, name, locationId: locationId !== undefined ? locationId : s.locationId } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
};

export const deleteStudio = async (orgId: string, studioId: string) => {
    if(isOffline || !db || !orgId) return;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studios = org.studios.filter(s => s.id !== studioId);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
};

export const updateStudioConfig = async (orgId: string, studioId: string, overrides: any) => {
    if(isOffline || !db || !orgId) return {} as Studio;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, configOverrides: sanitizeData(overrides) } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
    return studios.find(s => s.id === studioId) as Studio;
};

export const updateStudioRemoteState = async (orgId: string, studioId: string, remoteState: any) => {
    if (isOffline || !db || !orgId || !studioId) return;
    const org = await getOrganizationById(orgId);
    if (!org) throw new Error("Organisationen hittades inte.");
    const studios = org.studios.map(s => s.id === studioId ? { ...s, remoteState: sanitizeData(remoteState) } : s);
    await updateDoc(doc(db, 'organizations', orgId), { studios });
};


export const getSmartScreenPricing = async () => {
    if (isOffline || !db) return MOCK_SMART_SCREEN_PRICING;
    try {
        const snap = await getDoc(doc(db, 'system', 'pricing'));
        return snap.exists() ? snap.data() as SmartScreenPricing : MOCK_SMART_SCREEN_PRICING;
    } catch (e) { return MOCK_SMART_SCREEN_PRICING; }
};

export const updateSmartScreenPricing = async (pricing: SmartScreenPricing) => {
    if (isOffline || !db) return;
    try {
        await setDoc(doc(db, 'system', 'pricing'), sanitizeData(pricing));
    } catch (e) { console.error("updateSmartScreenPricing failed", e); }
};

export const updateOrganizationMigrationOption = async (id: string, allow: boolean) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { allowMigrationOption: allow });
    return getOrganizationById(id);
};

export const updateOrganizationStripeBypassOption = async (id: string, allow: boolean) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { allowStripeBypass: allow });
    return getOrganizationById(id);
};

export const updateOrganizationMemberPromotionCode = async (id: string, code: string) => {
    if(isOffline || !db || !id) return;
    await updateDoc(doc(db, 'organizations', id), { memberPromotionCode: code.trim() });
    return getOrganizationById(id);
};

export const updateOrganizationBilledStatus = async (id: string, month: string) => {
    if(isOffline || !db || !id) return;
    try {
        await updateDoc(doc(db, 'organizations', id), { lastBilledMonth: month, lastBilledDate: Date.now() });
        return getOrganizationById(id);
    } catch (e) { console.error("updateOrganizationBilledStatus failed", e); }
};


export const archiveOrganization = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        await updateDoc(doc(db, 'organizations', id), { status: 'archived' });
    } catch (e) { console.error("archiveOrganization failed", e); }
};

export const restoreOrganization = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        await updateDoc(doc(db, 'organizations', id), { status: 'active' });
    } catch (e) { console.error("restoreOrganization failed", e); }
};

export const deleteOrganizationPermanently = async (id: string) => {
    if (isOffline || !db || !id) return;
    try {
        await deleteDoc(doc(db, 'organizations', id));
    } catch (e) { console.error("deleteOrganizationPermanently failed", e); }
};

export const updateOrganizationActivity = async (id: string): Promise<void> => {
    if (isOffline || !db || !id) return;
    try { await updateDoc(doc(db, 'organizations', id), { lastActiveAt: Date.now() }); } catch(e){}
};

