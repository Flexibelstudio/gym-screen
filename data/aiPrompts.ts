
/**
 * Centraliserade prompts för Gemini AI-integrationen.
 * Innehåller systeminstruktioner och specifika instruktioner för olika funktioner.
 */

export const SYSTEM_COACH_CONTEXT = `
Du är SmartCoach, en världsledande expert på funktionell träning, HYROX och coaching. 
Ditt språk är alltid svenska. Du är peppande men professionell.
`;

export const WORKOUT_GENERATOR_PROMPT = (userPrompt: string) => `
Skapa ett strukturerat träningspass baserat på: "${userPrompt}".

INSTRUKTIONER:
1. Skapa 1-3 block beroende på intensitet.
2. Använd logiska timerinställningar (t.ex. AMRAP för flås, Intervall för styrka).
3. Ge blocken tydliga namn som "Pulsfest" eller "Styrka: Pressar".
4. Skriv pedagogiska beskrivningar för varje övning.
5. Använd ALDRIG generiska namn som "Övning 1". Välj alltid riktiga, vedertagna övningar.
`;

export const WORKOUT_REMIX_PROMPT = (workoutJson: string) => `
Remixa följande pass genom att byta ut övningar mot likvärdiga alternativ (samma rörelsemönster).
Behåll timerinställningar och blockstruktur exakt.
Ge passet ett nytt namn som antyder att det är en variant.

PASSDATA:
${workoutJson}
`;

export const WORKOUT_ANALYSIS_PROMPT = (workoutJson: string) => `
Analysera balansen i detta pass (push/pull, över/underkropp).
Ge konstruktiv feedback och specifika förslag på hur passet kan förbättras.
Fyll i 'aiCoachSummary' med en övergripande bedömning.

PASSDATA:
${workoutJson}
`;

export const TEXT_INTERPRETER_PROMPT = (text: string) => `
Tolka och digitalisera följande träningsanteckning. 
Hitta övningar, reps/tid och struktur. 

Viktiga regler:
1. Om texten är en instruktion (t.ex. 'benpass 5 övningar') snarare än en lista, använd din expertis som SmartCoach för att skapa ett pass som matchar instruktionen perfekt.
2. Använd ALDRIG generiska namn som 'Övning 1' eller 'Station A'. Välj riktiga övningar.
3. Om specifika övningar finns angivna, prioritera att transkribera dem exakt.

TEXT:
${text}
`;

export const IMAGE_INTERPRETER_PROMPT = (additionalText?: string) => `
Tolka och strukturera träningspasset från bilden.

Viktiga regler:
1. Om bilden innehåller en instruktion (t.ex. '5 övningar styrka' eller 'benpass') snarare än en lista med specifika övningsnamn, ska du använda din expertis som SmartCoach för att välja ut riktigt bra, utmanande och varierade övningar som passar instruktionen perfekt.
2. Använd ALDRIG generiska namn som 'Övning 1' eller 'Station A'. 
3. Om specifika övningar finns skrivna på bilden, transkribera dem noggrant med tillhörande reps och tider.

${additionalText ? `EXTRA INSTRUKTION FRÅN ANVÄNDAREN: ${additionalText}` : ''}
`;

export const EXERCISE_DESCRIPTION_PROMPT = (name: string) => `
Skriv en minimalistisk instruktion (max 20 ord) i imperativ form för övningen: "${name}".
Beskriv endast rörelsen, inga hälsofördelar eller adjektiv.
`;

export const MEMBER_INSIGHTS_PROMPT = (title: string, exercises: string[], logs: string) => `
Skapa en Pre-Game Strategy inför passet: "${title}".
Övningar: ${exercises.join(', ')}
Historik: ${logs}

Uppgift:
1. Bedöm dagsform (Readiness).
2. Ge en övergripande strategi.
3. Föreslå vikter för dagens övningar (Suggestions).
4. Ge alternativ för svårare övningar (Scaling).
`;

export const MEMBER_PROGRESS_PROMPT = (name: string, goals: string, logs: string) => `
Gör en strategisk analys av "${name}"'s utveckling.
Mål: ${goals}
Historik: ${logs}

Bedöm styrkor, förbättringsområden och ge konkreta "actions" till coachen.
Poängsätt Styrka, Kondition och Frekvens (0-100).
`;

export const DIPLOMA_GENERATOR_PROMPT = (title: string, pbText: string, stats: string) => `
Skapa ett diplom för passet: "${title}".
REKORD: ${pbText}
STATS: ${stats}

Fokusera på att hylla framstegen. 'imagePrompt' ska vara en beskrivning på engelska för en abstrakt, 3D-renderad medalj/ikon.
`;

export const ADMIN_ANALYTICS_CHAT_PROMPT = (question: string, logSummary: string) => `
Du är en dataexpert för gym. Svara på: "${question}" baserat på denna data: ${logSummary}.
Svara kort och professionellt på svenska.
`;
