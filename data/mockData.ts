import { Organization, UserData, CustomCategoryWithPrompt, CustomPage } from '../types';

export const MOCK_SYSTEM_OWNER: UserData = {
    uid: 'offline_owner_uid',
    email: 'owner@flexibel.app',
    role: 'systemowner'
};

export const MOCK_ORG_ADMIN: UserData = {
    uid: 'offline_admin_uid',
    email: 'admin@flexibel.app',
    role: 'organizationadmin',
    organizationId: 'org_flexibel_mock',
    adminRole: 'superadmin',
};

const MOCK_CATEGORIES: CustomCategoryWithPrompt[] = [
    { id: 'mock_cat_1', name: 'Styrka & Flås', prompt: 'Skapa ett CrossFit-inspirerat pass med ett styrkemoment och en konditionsdel.', enableQrLogging: true },
    { id: 'mock_cat_2', name: 'HIIT', prompt: 'Skapa ett högintensivt intervallpass som är enkelt att följa.', enableQrLogging: true },
    { id: 'mock_cat_3', name: 'Rörlighet', prompt: 'Skapa ett lugnt rörlighetspass med dynamiska och statiska övningar.', enableQrLogging: false },
];

const MOCK_CUSTOM_PAGES: CustomPage[] = [
    { id: 'mock_page_1', title: 'Vår Filosofi', content: '# Vår Filosofi\n\nVi tror på funktionell träning som bygger en stark och hållbar kropp för livet.' },
    { id: 'mock_page_2', title: 'Kom Igång Guide', content: '## Välkommen!\n\nBörja med att boka in ditt första pass via appen.' },
];


export const MOCK_ORGANIZATIONS: Organization[] = [
    {
        id: 'org_flexibel_mock',
        name: 'Flexibel Hälsostudio (Offline)',
        subdomain: 'flexibel-offline',
        logoUrl: 'https://cdn.jsdelivr.net/gh/orling/grommet-icon-loader@1.0.0/src/icons/grommet.svg',
        primaryColor: '#14b8a6',
        passwords: {
            coach: '1234',
        },
        globalConfig: {
            enableBoost: true,
            enableBreathingGuide: true,
            enableWarmup: true,
            enableBoostQrLogging: true,
            customCategories: MOCK_CATEGORIES,
        },
        studios: [
            {
                id: 'studio_salem_mock',
                name: 'Salem Centrum',
                configOverrides: {
                    enableBoost: true // Fix: Ensure Boost is enabled for this studio
                }
            },
            {
                id: 'studio_karra_mock',
                name: 'Kärra Centrum',
                configOverrides: {}
            }
        ],
        customPages: MOCK_CUSTOM_PAGES
    }
];

// Ensure the original mock data is empty as workouts are now managed in state
export const workouts = [];