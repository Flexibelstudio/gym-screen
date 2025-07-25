import { StartProgramSession } from '../types';

export const startProgramData: StartProgramSession[] = [
    {
        id: 'pass-1',
        title: 'Startprogram: Pass 1',
        shortTitle: 'Pass 1',
        content: {
            sections: [
                {
                    title: 'Innan träningen',
                    icon: 'check',
                    points: [
                        'InBody-mätning',
                        'Genomgång av gymmet: visa kunden studion, gå igenom checklistan.',
                        'Boka in resterande pass i startprogrammet.',
                        'Berätta att vi på pass 4 kommer prata om fortsättning, om de inte redan signat upp.'
                    ]
                },
                {
                    title: 'Loggning & Progression',
                    icon: 'log',
                    points: [
                        'Påbörja loggning och fortsätt sedan på resterande pass i startprogrammet.',
                        'Visa hur vi loggar träningen i appen och berätta varför – för att tydligt kunna se sin progression och för att komma ihåg vad vi gjorde på förra passet.'
                    ]
                }
            ],
            training: {
                title: 'Träning',
                exercises: [
                    {
                        name: 'Back squat',
                        details: '3 × 5 reps',
                        notes: [
                            'Knäböj utan vikt och vidare pinne och sen stång på ryggen, anpassat till kunden.',
                            'Se till att knäna går över fötterna och justera vid behov hur brett de står och hur mycket tårna pekar utåt.',
                            'Upphöjda hälar vid behov.',
                            'Lyft upp till en “lagom” tung vikt.'
                        ]
                    },
                    {
                        name: 'Axelpress',
                        details: '3 × 5 reps',
                        notes: [
                            'Med skivstång om kunden kan. Anpassas vid behov.',
                            'Håll precis vid axlarna och få fram armbågarna.',
                            'Lyft upp till en “lagom” tung vikt.'
                        ]
                    }
                ]
            },
            finisher: {
                title: 'Finisher - Tabata (8 × 20/10)',
                points: ['KB thrusters']
            }
        }
    },
    {
        id: 'pass-2',
        title: 'Startprogram: Pass 2',
        shortTitle: 'Pass 2',
        content: {
            sections: [
                {
                    title: 'Fortsätt med loggning',
                    icon: 'log',
                    points: []
                }
            ],
            training: {
                title: 'Träning',
                exercises: [
                    {
                        name: 'Marklyft',
                        details: '3 × 5 reps',
                        notes: [
                            'Tanken är att visa kunden marklyft med skivstång.',
                            'Anpassa vid behov, tex med KB eller upphöjda beroende på kundens rörlighet.',
                            'Lyft upp till en “lagom” tung vikt.'
                        ]
                    },
                    {
                        name: 'Bänkpress',
                        details: '3 × 5 reps',
                        notes: [
                            'Fötterna stadigt i golvet, sänka stången kontrollerat, 90 grader mellan underarm och stång i bottenläget.',
                            'Lyft upp till en “lagom” tung vikt.'
                        ]
                    },
                    {
                        name: '2h sving',
                        details: '3 × 10 reps',
                        notes: [
                            'Lås ut knä och höft.'
                        ]
                    }
                ]
            },
            finisher: {
                title: 'Finisher EMOM 6',
                points: ['5 KB marklyft', '5 Svingar', '5 kb Bröstpress']
            }
        }
    },
    {
        id: 'pass-3',
        title: 'Startprogram: Pass 3',
        shortTitle: 'Pass 3',
        content: {
            sections: [
                {
                    title: 'Fortsätt med loggning',
                    icon: 'log',
                    points: []
                }
            ],
            training: {
                title: 'Träningsförberedelser',
                description: 'Uppvärmning ca 5 min\nLåt kunden “ställa in” rack, ta fram skivstång, vikter och viktlås.\nStarta klockan.\nVisa kunden hur vi “värmer upp i lyftet”, dvs att vi gör 2-3 reps på olika vikter på vägen upp till vikten som ska lyftas.',
                exercises: [
                    {
                        name: 'Knäböj/goblet squat/back squat',
                        details: '15 min, X set x 5 reps',
                        notes: ['Fortsätt på pass 1, öka vikten']
                    },
                    {
                        name: 'Axelpress',
                        details: '15 min, X set x 5 reps',
                        notes: ['Fortsätt på pass 1, öka vikten']
                    },
                ]
            },
            finisher: {
                title: 'Finisher - AMRAP 6 min',
                points: ['10 Goblet squat', '10 ballistic row', '10 KB svingar']
            }
        }
    },
    {
        id: 'pass-4',
        title: 'Startprogram: Pass 4',
        shortTitle: 'Pass 4',
        content: {
            sections: [
                {
                    title: 'Uppföljning & Planering',
                    icon: 'check',
                    points: [
                        'Grundläggande kost: Gå igenom presentationen med information om energibehov, kaloriunderskott och protein, som finns utskriven i “startpärmen”.',
                        'Prata om fortsättning om de inte redan signat upp och boka deras nästa pass.',
                        'Schemalägg din träning, bestäm dagar och boka i förväg.',
                        'Boka avstämning om ca 30 dagar.'
                    ]
                }
            ],
            training: {
                title: 'Träningsförberedelser',
                description: 'Fortsätt med loggning\nUppvärmning ca 5 min\nLåt kunden ta fram skivstång, vikter, viktlås och “ställa in” racket\nStarta klockan.\nPåminn om att värma upp i lyftet, dvs att göra 2-3 reps på olika vikter på vägen upp till vikten som ska lyftas.',
                exercises: [
                    {
                        name: 'Marklyft',
                        details: '15 min, X set x 5 reps',
                        notes: ['Fortsätt på pass 2, öka vikten']
                    },
                    {
                        name: 'Bänkpress',
                        details: '15 min, X set x 5 reps',
                        notes: ['Fortsätt på pass 2, öka vikten']
                    },
                ]
            },
            finisher: {
                title: 'Finisher - Stege (for time) (max 5 min)',
                points: ['1-2-3-4-5-4-3-2-1', 'Burpee', 'Situps', 'Armhävning']
            }
        }
    }
];
