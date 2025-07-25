
export interface NutritionContent { type: 'paragraph' | 'callout'; text: string; }
export interface NutritionSection { title:string; content: NutritionContent[]; }

export const basicNutritionData: NutritionSection[] = [
    {
        title: "Energibehov",
        content: [
            { type: 'paragraph', text: 'En "kilokalori" (kcal) är ett mått på hur mycket energi något innehåller eller kräver. Kroppen använder energi på många sätt.' },
            { type: 'paragraph', text: 'Även i koma kräver din kropp mycket energi för att upprätthålla alla vitala funktioner (basalmetabolism). Utöver det tillkommer det vardagliga energibehovet. Utför vi dessutom arbete, som promenader eller träning, med det märkliga är att det kräver förvånansvärt lite energi att hålla igång. Varför är det enkelt bra att arbeta effektivt. Slutligen finns det energi som behövs för att bryta ner och smälta mat.'},
            { type: 'paragraph', text: 'Alla dessa "energibehov" bildar tillsammans ett tal för mängden energi du behöver varje dag (totalmetabolism), vilket är där din kropp förblir i balans, dvs ingen viktförändring.'}
        ]
    },
    {
        title: "",
        content: [
            { type: 'callout', text: 'FÖR ATT GÅ NER I VIKT BEHÖVER MAN FÅ I SIG FÄRRE KALORIER ÄN MAN GÖR AV MED OCH DETTA KALLAS ATT HA ETT "KALORIUNDERSKOTT".' }
        ]
    },
    {
        title: "Fördelarna med Protein för Viktminskning",
        content: [
            { type: 'paragraph', text: 'Viktminskning och uppgång bestäms av mer än vad vi äter som styr hur förlusten och vinsten ser ut.' },
            { type: 'paragraph', text: 'Du vill egentligen inte gå ner i "vikt" - du vill gå ner i fett, samtidigt som du behåller så mycket muskler som möjligt. Och för att förändra kroppskompositionen – förlora fett och behålla muskelmassa – är det viktigt att äta tillräckligt med protein. Muskler gör dig starkare, ökar ämnesomsättningen, bygger en buffert av hälsa och ger din kropp form.' },
            { type: 'paragraph', text: 'Det finns två nycklar till framgång:' },
            { type: 'paragraph', text: '1. Styrketräna regelbundet.' },
            { type: 'paragraph', text: '2. Ät tillräckligt med protein.' }
        ]
    },
    {
        title: "",
        content: [
            { type: 'callout', text: 'SIKTA PÅ ATT ÄTA 1,5 GRAM PROTEIN PER KILO KROPPSVIKT VARJE DAG, FÖRDELAT ÖVER DAGEN FÖR ATT UNDERHÅLLA MUSKELMASSAN OCH GE KROPPEN DE SIGNALER DEN BEHÖVER.' }
        ]
    }
];
