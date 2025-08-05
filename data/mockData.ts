import { Organization, UserData, CustomCategoryWithPrompt, CustomPage, EquipmentItem } from '../types';

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
    { id: 'mock_cat_1', name: 'Styrka & Flås', prompt: 'Skapa ett CrossFit-inspirerat pass med ett styrkemoment och en konditionsdel.' },
    { id: 'mock_cat_2', name: 'HIIT', prompt: 'Skapa ett högintensivt intervallpass som är enkelt att följa.' },
    { id: 'mock_cat_3', name: 'Rörlighet', prompt: 'Skapa ett lugnt rörlighetspass med dynamiska och statiska övningar.' },
];

const MOCK_EQUIPMENT: EquipmentItem[] = [
    { id: 'equip_1', name: 'Roddmaskin', quantity: 1 },
    { id: 'equip_2', name: 'Kettlebells (16kg)', quantity: 10 },
    { id: 'equip_3', name: 'Kettlebells (24kg)', quantity: 8 },
    { id: 'equip_4', name: 'Skivstänger', quantity: 4 },
    { id: 'equip_5', name: 'Hantlar (lätta)', quantity: 20 },
    { id: 'equip_6', name: 'Hantlar (tunga)', quantity: 10 },
    { id: 'equip_7', name: 'Airbike', quantity: 2 },
];


const MOCK_CUSTOM_PAGES: CustomPage[] = [
    { 
        id: 'mock_page_1', 
        title: 'Vår Filosofi', 
        tabs: [
            { id: 'tab_1_1', title: 'Grundpelare', content: '# Vår Filosofi\n\nVi tror på funktionell träning som bygger en stark och hållbar kropp för livet.' },
            { id: 'tab_1_2', title: 'Metodik', content: '## Vår Metodik\n\nVi kombinerar styrka, kondition och rörlighet för att skapa kompletta atleter.' }
        ]
    },
    { 
        id: 'mock_page_2', 
        title: 'Kom Igång Guide', 
        tabs: [
            { id: 'tab_2_1', title: 'Välkommen!', content: '## Välkommen!\n\nBörja med att boka in ditt första pass via appen. Vi ser fram emot att träffa dig!' }
        ]
    },
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
            customCategories: MOCK_CATEGORIES,
            equipmentInventory: MOCK_EQUIPMENT,
        },
        studios: [
            {
                id: 'studio_salem_mock',
                name: 'Salem Centrum',
                configOverrides: {
                    enableBoost: true, // Fix: Ensure Boost is enabled for this studio
                    equipmentInventory: [
                        { id: 'equip_1', name: 'Roddmaskin', quantity: 2 }, // Override: has one more
                        { id: 'equip_8', name: 'SkiErg', quantity: 1 } // Studio specific
                    ]
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