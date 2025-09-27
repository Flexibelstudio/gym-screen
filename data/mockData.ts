import { Organization, UserData, CustomCategoryWithPrompt, CustomPage, BankExercise, SuggestedExercise, WorkoutResult, SmartScreenPricing } from '../types';

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

// FIX: Add mock data array for suggested exercises.
export const MOCK_SUGGESTED_EXERCISES: SuggestedExercise[] = [];
export const MOCK_WORKOUT_RESULTS: WorkoutResult[] = [];

export const MOCK_SMART_SCREEN_PRICING: SmartScreenPricing = {
    firstScreenPrice: 249,
    additionalScreenPrice: 199,
};

const placeholderImageUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTEyIDEwYTQgNCAwIDAgMS00LTRhNCA0IDAgMCAxIDQtNGMyLjA1IDAgMy44MyAxLjI1IDQuNTkgMy4wNUwxOC40IDhsMy43Ni0xLjI1bC0xLjI1IDMuNzVMMTkgOS4xN0ExIDUgMCAwIDAtMTIgMTBtMi00YTEgMSAwIDEgMC0yIDBhMSAxIDAgMCAwIDIgMFptLTQgN2MtMS45IDAtMy42Mi43NS00LjkyIDJINWEyIDIgMCAwIDAtMiAydjJoM2EzLjg5IDMuODkgMCAwIDEgMS44MS0yLjY3YTYgNiAwIDAgMCA4LjM4IDBsMS44MSA0LjY3SDIxdjZIM3YtMmgxMHYtMmMwLTIuNDYtMS42MS00LjU2LTQtNS42OFYxM0g3djJzMiAwIDIgMmMwIDIuMjEtMS43OSAxLjUtNCA0LjVWMjJoNHYtMmgxMHYySDIydi04YzAtMy4zMS0yLjY5LTUtNS01eiIvPjwvc3ZnPg==';

export const MOCK_EXERCISE_BANK: BankExercise[] = [
    // Kroppsvikt
    { id: 'bank_bw_1', name: 'Knäböj (Air Squat)', description: 'Grundläggande knäböj utan extern vikt, med fokus på teknik och djup.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'kroppsvikt'] },
    { id: 'bank_bw_2', name: 'Armhävningar (Push-ups)', description: 'Klassisk överkroppsövning som tränar bröst, axlar och triceps. Håll kroppen i en rak linje.', imageUrl: placeholderImageUrl, tags: ['bröst', 'axlar', 'triceps', 'kroppsvikt'] },
    { id: 'bank_bw_3', name: 'Utfall (Lunges)', description: 'En övning för ben och säte där du tar ett steg framåt och sänker höften.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'kroppsvikt'] },
    { id: 'bank_bw_4', name: 'Burpees', description: 'En helkroppsövning som kombinerar ett upphopp med en armhävning.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'kondition', 'explosivt', 'kroppsvikt'] },
    { id: 'bank_bw_5', name: 'Planka (Plank)', description: 'Isometrisk bålövning där du håller kroppen i en rak linje, vilande på underarmar och tår.', imageUrl: placeholderImageUrl, tags: ['bål', 'mage', 'isometrisk', 'kroppsvikt'] },
    { id: 'bank_bw_6', name: 'Sit-ups', description: 'Magövning där du från liggande läge lyfter överkroppen mot knäna.', imageUrl: placeholderImageUrl, tags: ['mage', 'bål', 'kroppsvikt'] },
    { id: 'bank_bw_7', name: 'Jumping Jacks', description: 'Klassisk pulshöjande övning där du hoppar isär och ihop med ben och armar.', imageUrl: placeholderImageUrl, tags: ['kondition', 'helkropp', 'uppvärmning', 'kroppsvikt'] },
    { id: 'bank_bw_8', name: 'Mountain Climbers', description: 'Dynamisk bål- och konditionsövning i plankposition där du drar knäna mot bröstet.', imageUrl: placeholderImageUrl, tags: ['bål', 'mage', 'kondition', 'kroppsvikt'] },
    { id: 'bank_bw_9', name: 'Dips (på bänk/låda)', description: 'Tricepsövning där du sänker och höjer kroppen med hjälp av armarna, med händerna på en bänk.', imageUrl: placeholderImageUrl, tags: ['triceps', 'axlar', 'bröst', 'kroppsvikt'] },
    { id: 'bank_bw_10', name: 'Pull-ups / Chins', description: 'Dra kroppsvikten uppåt tills hakan är över en stång. Tränar rygg och biceps.', imageUrl: placeholderImageUrl, tags: ['rygg', 'biceps', 'kroppsvikt'] },
    { id: 'bank_bw_11', name: 'Höga Knän (High Knees)', description: 'Löpning på stället med fokus på att lyfta knäna högt för att öka pulsen.', imageUrl: placeholderImageUrl, tags: ['kondition', 'uppvärmning', 'kroppsvikt'] },
    { id: 'bank_bw_12', name: 'Pistol Squats (Enbensknäböj)', description: 'Avancerad knäböj på ett ben, kräver styrka, balans och rörlighet.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'balans', 'kroppsvikt'] },
    { id: 'bank_bw_13', name: 'Benlyft (Leg Raises)', description: 'Magövning där du från liggande lyfter raka ben mot taket.', imageUrl: placeholderImageUrl, tags: ['mage', 'bål', 'kroppsvikt'] },
    { id: 'bank_bw_14', name: 'Hollow Rocks', description: 'Bålövning där du gungar fram och tillbaka med spänd, båtformad kropp.', imageUrl: placeholderImageUrl, tags: ['bål', 'mage', 'kroppsvikt'] },
    { id: 'bank_bw_15', name: 'Superman', description: 'Ryggövning där du från magliggande lyfter armar och ben från golvet.', imageUrl: placeholderImageUrl, tags: ['rygg', 'ländrygg', 'kroppsvikt'] },
    { id: 'bank_bw_16', name: 'Utfallshopp (Jumping Lunges)', description: 'En explosiv variant av utfall där du byter ben i luften. Utmärkt för kondition och benstyrka.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'kondition', 'explosivt', 'kroppsvikt'] },

    // Kettlebell
    { id: 'bank_kb_1', name: 'Kettlebell Swings', description: 'En explosiv höftfällning där en kettlebell svingas från mellan knäna upp till bröst- eller ögonhöjd.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'säte', 'baksida lår', 'rygg', 'explosivt', 'kettlebell'] },
    { id: 'bank_kb_2', name: 'Goblet Squats', description: 'Knäböj där en kettlebell hålls med båda händerna framför bröstet.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'bål', 'kettlebell'] },
    { id: 'bank_kb_3', name: 'Kettlebell Clean', description: 'En förflyttning av kettlebellen från golvet upp till en rackposition på bröstet.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'explosivt', 'kettlebell'] },
    { id: 'bank_kb_4', name: 'Kettlebell Press', description: 'En axelpress från rackposition till rakt över huvudet.', imageUrl: placeholderImageUrl, tags: ['axlar', 'triceps', 'kettlebell'] },
    { id: 'bank_kb_5', name: 'Kettlebell Snatch', description: 'En explosiv rörelse där kettlebellen lyfts från golvet till rakt över huvudet i en enda rörelse.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'explosivt', 'axlar', 'kettlebell'] },
    { id: 'bank_kb_6', name: 'Turkish Get-up (TGU)', description: 'En komplex helkroppsövning där du reser dig från liggande till stående med en kettlebell över huvudet.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'bål', 'axlar', 'stabilitet', 'kettlebell'] },
    { id: 'bank_kb_7', name: 'Enarmsrodd (Single Arm Row)', description: 'Ryggövning där du drar en kettlebell mot bröstet med en arm.', imageUrl: placeholderImageUrl, tags: ['rygg', 'biceps', 'kettlebell'] },
    { id: 'bank_kb_8', name: 'Windmill', description: 'En rörlighets- och bålövning som utmanar axelstabilitet.', imageUrl: placeholderImageUrl, tags: ['bål', 'axlar', 'rörlighet', 'stabilitet', 'kettlebell'] },
    { id: 'bank_kb_9', name: 'Kettlebell Thruster', description: 'En kombination av en frontböj och en press över huvudet.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'ben', 'axlar', 'explosivt', 'kettlebell'] },
    { id: 'bank_kb_10', name: 'Suitcase Carry', description: 'Gå med en tung kettlebell i ena handen för att utmana bålstyrkan.', imageUrl: placeholderImageUrl, tags: ['bål', 'greppstyrka', 'kettlebell'] },
    { id: 'bank_kb_11', name: 'Kettlebell Figur 8', description: 'En dynamisk övning där en kettlebell passas från hand till hand i en åtta-formad rörelse runt och mellan benen.', imageUrl: placeholderImageUrl, tags: ['bål', 'koordination', 'kettlebell'] },
    { id: 'bank_kb_12', name: 'Kettlebell Halo', description: 'En rörlighetsövning för axlarna där en kettlebell cirkuleras runt huvudet.', imageUrl: placeholderImageUrl, tags: ['axlar', 'rörlighet', 'bål', 'kettlebell'] },
    { id: 'bank_kb_13', name: 'Kettlebell Marklyft', description: 'En variant av marklyft som utförs med en eller två kettlebells, utmärkt för att lära sig höftfällningsmönstret.', imageUrl: placeholderImageUrl, tags: ['rygg', 'ben', 'säte', 'kettlebell'] },
    { id: 'bank_kb_14', name: 'Kettlebell Rysk Vridning', description: 'En bålövning där du från en sittande, tillbakalutad position roterar överkroppen från sida till sida med en kettlebell.', imageUrl: placeholderImageUrl, tags: ['bål', 'mage', 'kettlebell'] },

    // Skivstång
    { id: 'bank_bb_1', name: 'Marklyft (Deadlift)', description: 'Lyft en skivstång från golvet till höftposition med rak rygg. En fundamental styrkeövning.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'rygg', 'ben', 'säte', 'baksida lår', 'styrka', 'skivstång'] },
    { id: 'bank_bb_2', name: 'Knäböj (Back Squat)', description: 'Knäböj med en skivstång vilande på övre delen av ryggen.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'styrka', 'skivstång'] },
    { id: 'bank_bb_3', name: 'Frontböj (Front Squat)', description: 'Knäböj med skivstången vilande på framsidan av axlarna.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'bål', 'styrka', 'skivstång'] },
    { id: 'bank_bb_4', name: 'Bänkpress (Bench Press)', description: 'Pressa en skivstång från bröstet till raka armar i liggande position.', imageUrl: placeholderImageUrl, tags: ['bröst', 'axlar', 'triceps', 'styrka', 'skivstång'] },
    { id: 'bank_bb_5', name: 'Militärpress (Strict Press)', description: 'Pressa en skivstång från axlarna till rakt över huvudet utan hjälp från benen.', imageUrl: placeholderImageUrl, tags: ['axlar', 'triceps', 'styrka', 'skivstång'] },
    { id: 'bank_bb_6', name: 'Stöt (Push Jerk/Split Jerk)', description: 'En explosiv press över huvudet med hjälp av en "dip and drive" från benen.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'axlar', 'explosivt', 'olympiska lyft', 'skivstång'] },
    { id: 'bank_bb_7', name: 'Ryck (Snatch)', description: 'Ett olympiskt lyft där stången förflyttas från golvet till över huvudet i en enda, snabb rörelse.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'explosivt', 'olympiska lyft', 'skivstång'] },
    { id: 'bank_bb_8', name: 'Frivändning (Power Clean)', description: 'Ett olympiskt lyft där stången förflyttas från golvet till en rackposition på axlarna.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'explosivt', 'olympiska lyft', 'skivstång'] },
    { id: 'bank_bb_9', name: 'Thruster (med skivstång)', description: 'En kombination av en frontböj och en press över huvudet.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'ben', 'axlar', 'explosivt', 'skivstång'] },
    { id: 'bank_bb_10', name: 'Overhead Squat', description: 'En knäböj med skivstången hållen på raka armar över huvudet. Kräver exceptionell rörlighet.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'ben', 'axlar', 'bål', 'rörlighet', 'skivstång'] },
    { id: 'bank_bb_11', name: 'Skivstångsrodd (Bent-over Row)', description: 'Dra en skivstång mot magen med en framåtlutad position för att bygga ryggstyrka.', imageUrl: placeholderImageUrl, tags: ['rygg', 'biceps', 'skivstång'] },
    { id: 'bank_bb_12', name: 'Good Mornings', description: 'En övning för baksida lår och ländrygg där du fäller i höften med stången på axlarna.', imageUrl: placeholderImageUrl, tags: ['baksida lår', 'ländrygg', 'säte', 'skivstång'] },
    { id: 'bank_bb_13', name: 'Hip Thrusts', description: 'En övning för sätet där du pressar upp höften med skivstången placerad över höfterna.', imageUrl: placeholderImageUrl, tags: ['säte', 'baksida lår', 'skivstång'] },
    { id: 'bank_bb_14', name: 'Rumänska Marklyft (RDL)', description: 'En variant av marklyft som fokuserar på baksida lår och säte, där stången sänks med raka ben och rak rygg.', imageUrl: placeholderImageUrl, tags: ['baksida lår', 'säte', 'ländrygg', 'skivstång'] },

    // Hantlar
    { id: 'bank_db_1', name: 'Hantelpress (Dumbbell Bench Press)', description: 'Bänkpress med hantlar för ett större rörelseomfång än med skivstång.', imageUrl: placeholderImageUrl, tags: ['bröst', 'axlar', 'triceps', 'hantlar'] },
    { id: 'bank_db_2', name: 'Hantelflyes (Dumbbell Flys)', description: 'Bröstövning där armarna rörs i en svepande rörelse, likt en fågels vingslag.', imageUrl: placeholderImageUrl, tags: ['bröst', 'hantlar'] },
    { id: 'bank_db_3', name: 'Hantelrodd (Dumbbell Row)', description: 'Ryggövning där en hantel dras mot sidan av kroppen, ofta med stöd av en bänk.', imageUrl: placeholderImageUrl, tags: ['rygg', 'biceps', 'hantlar'] },
    { id: 'bank_db_4', name: 'Axelpress (Shoulder Press)', description: 'Pressa hantlar från axelhöjd till rakt över huvudet.', imageUrl: placeholderImageUrl, tags: ['axlar', 'triceps', 'hantlar'] },
    { id: 'bank_db_5', name: 'Sidolyft (Lateral Raises)', description: 'Axelövning där hantlar lyfts rakt ut åt sidorna till axelhöjd.', imageUrl: placeholderImageUrl, tags: ['axlar', 'hantlar'] },
    { id: 'bank_db_6', name: 'Bicep Curls', description: 'Isolationsövning för biceps där hantlar curlas upp mot axlarna.', imageUrl: placeholderImageUrl, tags: ['biceps', 'armar', 'hantlar'] },
    { id: 'bank_db_7', name: 'Hammer Curls', description: 'Bicepsövning med neutralt grepp (som att hålla en hammare) som även tränar underarmarna.', imageUrl: placeholderImageUrl, tags: ['biceps', 'underarmar', 'armar', 'hantlar'] },
    { id: 'bank_db_8', name: 'Triceps Extensions (Overhead)', description: 'Tricepsövning där en hantel sänks bakom huvudet och pressas upp.', imageUrl: placeholderImageUrl, tags: ['triceps', 'armar', 'hantlar'] },
    { id: 'bank_db_9', name: 'Devil Press', description: 'En kombination av en burpee och en hantel-snatch. En mycket krävande helkroppsövning.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'kondition', 'explosivt', 'hantlar'] },
    { id: 'bank_db_10', name: 'Manmakers', description: 'En komplex sekvens: armhävning, rodd med varje arm, och sedan en clean & press. Allt med hantlar.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'styrka', 'kondition', 'hantlar'] },
    { id: 'bank_db_11', name: 'Renegade Rows', description: 'Rodd med hantlar från en plankposition, vilket utmanar bålstabiliteten maximalt.', imageUrl: placeholderImageUrl, tags: ['rygg', 'bål', 'mage', 'hantlar'] },
    { id: 'bank_db_12', name: 'Gående utfall (Walking Lunges)', description: 'Utfall utförda i en framåtgående rörelse, ofta med hantlar för extra motstånd.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'hantlar'] },
    
    // Landmine
    { id: 'bank_lm_1', name: 'Landmine Knäböj', description: 'En knäböjsvariant där skivstångens ena ände är fäst i en landmine-enhet, vilket skapar en bågformad rörelsebana.', imageUrl: placeholderImageUrl, tags: ['ben', 'säte', 'landmine', 'skivstång'] },
    { id: 'bank_lm_2', name: 'Landmine Press', description: 'En axelpress med landmine som är skonsammare för axelleden än traditionella pressar. Kan utföras på knä eller stående.', imageUrl: placeholderImageUrl, tags: ['axlar', 'bröst', 'triceps', 'landmine', 'skivstång'] },
    { id: 'bank_lm_3', name: 'Landmine Rodd', description: 'En ryggövning där du drar skivstången mot bröstet. Kan varieras med olika grepp för att träffa olika delar av ryggen.', imageUrl: placeholderImageUrl, tags: ['rygg', 'biceps', 'landmine', 'skivstång'] },
    { id: 'bank_lm_4', name: 'Landmine Rotation (Twist)', description: 'En bålövning där skivstången roteras från sida till sida, vilket utmanar de sneda magmusklerna.', imageUrl: placeholderImageUrl, tags: ['bål', 'mage', 'rotation', 'landmine', 'skivstång'] },

    // Övrigt / Kondition
    { id: 'bank_misc_1', name: 'Rodd (Rowing)', description: 'Helkroppsträning i roddmaskin som kombinerar styrka och kondition.', imageUrl: placeholderImageUrl, tags: ['kondition', 'helkropp', 'rygg', 'ben', 'roddmaskin'] },
    { id: 'bank_misc_2', name: 'Air Bike', description: 'Högintensiv konditionsträning på en cykel med luftmotstånd.', imageUrl: placeholderImageUrl, tags: ['kondition', 'helkropp', 'air bike'] },
    { id: 'bank_misc_3', name: 'SkiErg', description: 'Konditionsmaskin som simulerar stakning i längdskidåkning.', imageUrl: placeholderImageUrl, tags: ['kondition', 'helkropp', 'rygg', 'armar', 'skierg'] },
    { id: 'bank_misc_4', name: 'Box Jumps', description: 'Explosivt hopp upp på en låda för att träna spänst och benstyrka.', imageUrl: placeholderImageUrl, tags: ['ben', 'explosivt', 'kondition', 'box'] },
    { id: 'bank_misc_5', name: 'Wall Balls', description: 'Kasta en medicinboll mot ett mål på väggen från en knäböjsposition.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'ben', 'axlar', 'kondition', 'medicinboll'] },
    { id: 'bank_misc_6', name: 'Double Unders', description: 'Avancerad hopprepsövning där repet passerar två gånger under fötterna på ett hopp.', imageUrl: placeholderImageUrl, tags: ['kondition', 'koordination', 'hopprep'] },
    { id: 'bank_misc_7', name: 'Toes-to-bar', description: 'Bålövning där du från hängande i en stång lyfter fötterna för att nudda stången.', imageUrl: placeholderImageUrl, tags: ['mage', 'bål', 'greppstyrka', 'kroppsvikt'] },
    { id: 'bank_misc_8', name: 'Wall Sit (Jägarvila)', description: 'Isometrisk benövning där du sitter i en 90-graders vinkel mot en vägg.', imageUrl: placeholderImageUrl, tags: ['ben', 'isometrisk', 'kroppsvikt'] },
    { id: 'bank_misc_9', name: 'Medicinbollskast (Slams)', description: 'Kasta en medicinboll kraftfullt i golvet för att träna explosivitet och bålstyrka.', imageUrl: placeholderImageUrl, tags: ['helkropp', 'explosivt', 'bål', 'medicinboll'] },
].sort((a, b) => a.name.localeCompare(b.name, 'sv'));


const MOCK_CATEGORIES: CustomCategoryWithPrompt[] = [
    { id: 'mock_cat_1', name: 'Styrka & Flås', prompt: 'Skapa ett CrossFit-inspirerat pass med ett styrkemoment och en konditionsdel.' },
    { id: 'mock_cat_2', name: 'HIIT', prompt: 'Skapa ett högintensivt intervallpass som är enkelt att följa.' },
    { id: 'mock_cat_3', name: 'Rörlighet', prompt: 'Skapa ett lugnt rörlighetspass med dynamiska och statiska övningar.' },
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
            enableScreensaver: true,
            screensaverTimeoutMinutes: 15,
            enableExerciseBank: true,
            customCategories: MOCK_CATEGORIES,
        },
        studios: [
            {
                id: 'studio_salem_mock',
                name: 'Salem Centrum',
                configOverrides: {
                    enableBoost: true,
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