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
        logoUrlLight: 'https://icongr.am/clarity/tools.svg?size=128&color=000000',
        logoUrlDark: 'https://cdn.jsdelivr.net/gh/orling/grommet-icon-loader@1.0.0/src/icons/grommet.svg',
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
                    enableBoost: true,
                    equipmentInventory: [
                        { id: 'equip_1', name: 'Roddmaskin', quantity: 2 }, 
                        { id: 'equip_8', name: 'SkiErg', quantity: 1 }
                    ],
                }
            },
            {
                id: 'studio_karra_mock',
                name: 'Kärra Centrum',
                configOverrides: {
                    checkInImageEnabled: true,
                    checkInImageUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij48cGF0aCBmaWxsPSIjRkZGRkZGIiBkPSJNMjA4IDMySDQ4YTggOCAwIDAgMC04IDh2NTZhOCA4IDAgMCAwIDggOGg0YTY4IDY4IDAgMCAxIDY4IDY4djRhOCA4IDAgMCAwIDggOGg1NmE4IDggMCAwIDAgOC04di04YTQwIDQwIDAgMCAwLTI4Ljc5LTM4LjEybDYuNDUtMS44NWE4IDggMCAwIDAgNS4xMy05LjI5VjQwYTggOCAwIDAgMC04LThabS04IDY0di4xNmwtOS4zNCAyLjY3YTU2IDU2IDAgMCAxLTIuNjYtMjMuNzlWNDBoNTZ2NDhhOCA4IDAgMCAxLTggOFpNNTIgNDBoNDB2NDhBNDAgNDAgMCAwIDAgODAgMTI0LjQzVjE2OEg1MlpNNjggNzZhOCA4IDAgMSAxLTggOGE4IDggMCAwIDEgOC04Wm0xMTIgOGE4IDggMCAxIDEtOCA4YTggOCAwIDAgMSA4LThabS00MCA3MmgtNDhhOCA4IDAgMCAwLTggOHY0OGE4IDggMCAwIDAgOCA4aDQ4YTggOCAwIDAgMCA4LTh2LTQ4YTggOCAwIDAgMC04LThabS04IDQ4aC0zMnYtMzJoMzJaTTk2IDEyMGE4IDggMCAxIDEtOCA4YTggOCAwIDAgMSA4LThabTQ4IDU2YTggOCAwIDEgMS04IDhhOCA4IDAgMCAxIDgtOFoiLz48L3N2Zz4=',
                }
            }
        ],
        customPages: MOCK_CUSTOM_PAGES,
        infoCarousel: {
            isEnabled: true,
            messages: [
                {
                    id: 'msg1',
                    internalTitle: 'Välkomstkampanj',
                    headline: 'Välkommen tillbaka!',
                    body: 'Nu kör vi igång höstterminen med ny energi. Boka din plats på passen i appen!',
                    layout: 'text-only',
                    animation: 'fade',
                    durationSeconds: 10,
                    visibleInStudios: ['all']
                },
                {
                    id: 'msg2',
                    internalTitle: 'Teknikvecka Kärra',
                    headline: 'Teknikvecka i Kärra!',
                    body: 'Denna vecka fokuserar vi extra på tekniken i ryck och stöt. Kom och finslipa formen!',
                    layout: 'image-left',
                    imageUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZmZmZiI+PHBhdGggZD0iTTEyLDE3QTJDMywyIDMsMiwyLDNWNUExLDEsMCwwLDAsMyw2SDVWOGgtM2wtMSw0SDEzbC0xLTRINVY5SDNhMSwxLDAsMCwwLTEsMVYyMUg1SDIxVjEwYTEsMSwwLDAsMC0xLTFIN1Y4aDVWNmExLDEsMCwwLDAsMS0xVjNhMiwyLDAsMCwxLDIsMlpNMTcsMTFWN2ExLDEsMCwwLDAtMS0xSDE1YTIsMiwwLDAsMC0yLDJWN2ExLDEsMCwwLDAsMSwxVjExWm0tNy01YTIsMiwwLDAsMC0yLDJWN2ExLDEsMCwwLDAsMSwxVjExaDJWOFY3YTIsMiwwLDAsMC0yLTJaTTUsMjFIN1YxNUg1Wm0xNCwwSDE3VjE1aDJabS00LDBIMTNWMTVoMlptLTQsMEg5VjE1aDJabS00LDBINVjE1aDJabS0yLTEwSDd2Mkg1VjExWiIvPjwvc3ZnPg==',
                    animation: 'slide-left',
                    durationSeconds: 15,
                    startDate: '2024-01-01T00:00:00.000Z',
                    endDate: '2025-12-31T23:59:59.000Z',
                    visibleInStudios: ['studio_karra_mock']
                }
            ]
        },
    }
];

// Ensure the original mock data is empty as workouts are now managed in state
export const workouts = [];