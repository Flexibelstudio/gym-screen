
export interface ChecklistItem { text: string; highlighted?: boolean; }
export interface ChecklistSection { title: string; items: ChecklistItem[]; }

export const checklistData: ChecklistSection[] = [
    {
        title: "Trivsel och praktiska saker",
        items: [
            { text: "Hälsa när du kommer och säg hej då när du går" },
            { text: "Lämna ytterskor vid ytterdörren och lämna ytterkläder, väskor och paket på avsedd plats i hallen vid toaletten" },
            { text: "Kom i tid, minst 5 min innan passet startar, max 15 min innan om det är ett pass i studion.", highlighted: true },
            { text: "Mobil på ljudlöst", highlighted: true },
            { text: "Gratis kaffe och te till alla medlemmar" },
            { text: "Ställ disk i diskmaskinen om det finns plats, annars i diskhon", highlighted: true },
            { text: "Endast medlemmar i studion" },
        ]
    },
    {
        title: "Zoezi",
        items: [
            { text: "Checka in med genom scanna någon av QR-koderna i studion" },
            { text: "Så här bokar du pass" },
            { text: "Pass avbokas senast 4 timmar innan i Zoezi. Vid sent förhinder meddela oss genom att svara på påminnelsemailet om pass du fått från Zoezi." },
            { text: "“No Show”-avgift på 95 kr läggs på kommande dragning om inte dyker upp eller meddelar förhinder på bokat pass." },
            { text: "Så här handlar du i “kiosken”" },
        ]
    },
    {
        title: "Hygien",
        items: [
            { text: "Träna/Yoga alltid i strumpor eller inneskor, aldrig barfota", highlighted: true },
            { text: "Använd alltid de svarta mattorna när du gör övningar på golvet, torka rent din matta efter avslutat pass" },
            { text: "Vi hjälps åt att hålla ordning. Torka av och ställ tillbaka vikter, bänkar och alla andra träningsredskap där du tog dem på pass" },
        ]
    },
    {
        title: "Säkerhet",
        items: [
            { text: "Träna säkert, använd alltid safety arms vid tunga knäböj och bänkpress" },
            { text: "Teknik och säkerhet går alltid före vikt!" },
            { text: "Använd ALLTID viktlås vid användande av skivstänger!" },
            { text: "Sätt ner stången på golvet, droppa eller släpp aldrig vikter" },
        ]
    }
];

export const checklistFooter: string = "TA I, HA KUL OCH BLI STARK!";
