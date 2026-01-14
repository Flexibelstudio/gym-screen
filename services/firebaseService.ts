import { GoogleGenAI, GenerateContentResponse, Type, Schema } from "@google/genai";
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise, SuggestedExercise, CustomCategoryWithPrompt, WorkoutLog, MemberGoals, WorkoutDiploma } from '../types';
import { getExerciseBank } from './firebaseService';
import { z } from 'zod';

// MODELL: Uppdaterad till korrekt version enligt instruktioner
const model = 'gemini-3-flash-preview'; 

// SÄKERHET: Hämta nyckel exklusivt från process.env enligt riktlinjer
const getAIClient = () => {
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    
    const viteKey = (import.meta as any).env.VITE_API_KEY;
    if (viteKey) return new GoogleGenAI({ apiKey: viteKey });

    console.error("CRITICAL: No API Key found.");
    throw new Error("API-nyckel saknas. Kontrollera dina inställningar.");
};

// --- Helper Logic for Matching ---
const normalizeString = (str: string) => {
    return str.toLowerCase().trim().replace(/[^\w\såäöÅÄÖ]/g, ''); 
};

const isExerciseMatch = (targetName: string, candidateName: string): boolean => {
    const nTarget = normalizeString(targetName);
    const nCandidate = normalizeString(candidateName);
    if (nTarget === nCandidate) return true;
    if (nCandidate.includes(nTarget) && nTarget.length > 3) return true;
    return false;
};

// --- Zod Schemas ---
const BankExerciseSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string())
});
const ExerciseSuggestionsResponseSchema = z.array(BankExerciseSuggestionSchema);

// --- Google Schemas ---
const googleExerciseSchema: Schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        required: ['name', 'description', 'tags'],
        properties: {
            name: { type: Type.STRING, description: "Exercise name in Swedish" },
            description: { type: Type.STRING, description: "Short execution instruction in Swedish" },
            tags: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Tags like 'styrka', 'ben', 'hantlar' in Swedish"
            }
        }
    }
};

const googleWorkoutSchema: Schema = {
  type: Type.OBJECT,
  required: ['title', 'coachTips', 'blocks'],
  properties: {
      title: { type: Type.STRING, description: "Workout title in Swedish" },
      coachTips: { type: Type.STRING, description: "Tips for the coach in Swedish" },
      aiCoachSummary: { type: Type.STRING, description: "Summary of analysis in Swedish" },
      blocks: {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              required: ['title', 'tag', 'setupDescription', 'followMe', 'settings', 'exercises'],
              properties: {
                  title: { type: Type.STRING, description: "Block title in Swedish" },
                  tag: { type: Type.STRING, enum: ["Styrka", "Kondition", "Rörlighet", "Teknik", "Core/Bål", "Balans", "Uppvärmning"] },
                  setupDescription: { type: Type.STRING, description: "Setup description in Swedish" },
                  followMe: { type: Type.BOOLEAN },
                  aiCoachNotes: { type: Type.STRING, description: "Analysis notes in Swedish" },
                   aiMagicPenSuggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Suggestions in Swedish"
                  },
                  settings: {
                      type: Type.OBJECT,
                      required: ['mode', 'workTime', 'restTime', 'rounds'],
                      properties: {
                          mode: { type: Type.STRING, enum: Object.values(TimerMode) },
                          workTime: { type: Type.NUMBER },
                          restTime: { type: Type.NUMBER },
                          rounds: { type: Type.NUMBER },
                      },
                  },
                  exercises: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          required: ['name', 'description'],
                          properties: {
                              name: { type: Type.STRING, description: "Exercise name in Swedish" },
                              reps: { type: Type.STRING },
                              description: { type: Type.STRING, description: "Exercise description in Swedish" },
                          },
                      },
                  },
              },
          },
      },
  },
};

// --- VALIDATION HELPER ---
const validateAndTransformWorkoutData = (data: unknown, originalIds: Workout | null = null): Workout => {
    const d = data as any;

    const newWorkout: Workout = {
        id: originalIds?.id || `ai-${new Date().toISOString()}`,
        title: d.title || "AI-genererat Pass",
        coachTips: d.coachTips || "",
        aiCoachSummary: d.aiCoachSummary || "",
        category: 'AI Genererat',
        isPublished: false,
        createdAt: Date.now(),
        organizationId: originalIds?.organizationId || '',
        blocks: (d.blocks || []).map((block: any, index: number): WorkoutBlock => {
            const tag = block.tag || 'Allmänt';
            const settings = block.settings || {};
            const mode = settings.mode || TimerMode.AMRAP;
            
            let { workTime, restTime, rounds } = settings;

            if (mode === TimerMode.AMRAP && (!workTime || workTime === 0)) workTime = 600;
            if (mode === TimerMode.EMOM && (!rounds || rounds === 0)) rounds = 10;

            const finalSettings: TimerSettings = {
                mode: mode,
                workTime: Number(workTime) || 0,
                restTime: Number(restTime) || 0,
                rounds: Number(rounds) || 1,
                prepareTime: 10,
            };

            const originalBlock = originalIds?.blocks?.[index];

            return {
                id: originalBlock?.id || `block-${index}-${new Date().getTime()}`,
                title: block.title || `Block ${index + 1}`,
                tag: tag,
                followMe: block.followMe === true,
                setupDescription: block.setupDescription || "",
                aiCoachNotes: block.aiCoachNotes || "",
                aiMagicPenSuggestions: block.aiMagicPenSuggestions || [],
                settings: finalSettings,
                exercises: (block.exercises || []).map((ex: any, exIndex: number): Exercise => {
                    const originalExercise = originalBlock?.exercises?.[exIndex];
                    return {
                        id: originalExercise?.id || `ex-${exIndex}-${new Date().getTime()}`,
                        name: ex.name || "Namnlös övning",
                        reps: ex.reps || '',
                        description: ex.description || '',
                        isFromAI: true,
                        isFromBank: originalExercise?.isFromBank
                    }
                }),
            };
        }),
    };

    return newWorkout;
};

async function _callGeminiWithSchema(prompt: string, originalWorkoutContext: Workout | null = null): Promise<Workout> {
  const ai = getAIClient();
  const MAX_RETRIES = 2;
  let attempt = 0;
  let delay = 1000;

  while (attempt < MAX_RETRIES) {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: googleWorkoutSchema,
            },
        });

        const jsonStr = response.text.trim();
        const parsedData = JSON.parse(jsonStr);
        return validateAndTransformWorkoutData(parsedData, originalWorkoutContext);

    } catch (error) {
        attempt++;
        console.error(`Gemini Attempt ${attempt} failed:`, error);
        
        const isRateLimitError = error instanceof Error && error.message.includes("429");
        if (isRateLimitError && attempt < MAX_RETRIES) {
            await new Promise(res => setTimeout(res, delay));
            delay *= 2; 
        } else {
            if (error instanceof Error) throw error;
            throw new Error("Kunde inte tolka AI:ns svar.");
        }
    }
  }
  throw new Error("Misslyckades med att behandla passet.");
}

// --- STANDARD WORKOUT GENERATION FUNCTIONS ---

export async function generateExerciseSuggestions(userPrompt: string): Promise<Partial<BankExercise>[]> {
    const ai = getAIClient();
    const existingBank = await getExerciseBank();
    const existingExerciseNames = existingBank.map(ex => ex.name).join(', ');

    const fullPrompt = `
        Du är en expert på funktionell träning. Generera förslag på övningar baserat på användarens önskemål.
        VIKTIGT: Svaret måste vara valid JSON och all text MÅSTE vara på SVENSKA.
        
        Användarens önskemål: "${userPrompt.replace(/`/g, '\\`')}"
        Exkludera dessa övningar (finns redan): ${existingExerciseNames}
        Format: JSON Array med fälten 'name', 'description', 'tags'.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: googleExerciseSchema,
            },
        });

        const jsonStr = response.text.trim();
        const parsedData = JSON.parse(jsonStr);
        const validationResult = ExerciseSuggestionsResponseSchema.safeParse(parsedData);
        if (!validationResult.success) {
            if(Array.isArray(parsedData)) return parsedData;
            throw new Error("Ogiltigt svar från AI.");
        }
        return validationResult.data;

    } catch (error) {
        console.error("Error generating suggestions:", error);
        throw error;
    }
}

export async function generateWorkout(userPrompt: string, allWorkouts?: Workout[], selectedCategory?: CustomCategoryWithPrompt | null): Promise<Workout> {
    const fullPrompt = `
        Du är en expertcoach på ett gym. Skapa ett träningspass på SVENSKA.
        
        Önskemål: "${userPrompt.replace(/`/g, '\\`')}"
        
        REGLER:
        1. All text (titlar, beskrivningar, coach-tips, övningsnamn) SKA vara på svenska.
        2. Skapa 1-3 logiska block.
        3. Välj passande timer-inställningar för syftet.
        4. Returnera strikt JSON som matchar schemat.
    `;
    return _callGeminiWithSchema(fullPrompt);
}

export async function remixWorkout(originalWorkout: Workout): Promise<Workout> {
    const workoutJson = JSON.stringify(originalWorkout);
    const fullPrompt = `
        Du är en expertcoach inom funktionell träning. Din uppgift är att "remixa" detta träningspass.
        
        INSTRUKTIONER:
        1. **Behåll strukturen:** Behåll exakt samma antal block, samma timer-inställningar (tidsdomäner, varv) och samma "intent" (syfte).
        2. **Byt övningar:** Byt ut övningarna mot likvärdiga alternativ (samma muskelgrupper/rörelsemönster). 
           - Exempel: Byt Wall Balls mot Thrusters. Byt Rodd mot SkiErg. Byt Pushups mot Dips.
        3. **Språk:** All text ska vara på SVENSKA.
        4. **Namn:** Ge passet ett nytt, kreativt namn som antyder att det är en remix eller variation (t.ex. "Remix: [Gammalt Namn]" eller "Variant B").

        PASSDATA ATT REMIXA:
        ${workoutJson}
    `;
    console.log("Sending remix request to Gemini...");
    return _callGeminiWithSchema(fullPrompt);
}

export async function analyzeCurrentWorkout(currentWorkout: Workout): Promise<Workout> {
    const currentWorkoutJson = JSON.stringify(currentWorkout).replace(/`/g, '\\`');
    const fullPrompt = `
        Du är en senior träningscoach. Analysera detta träningspass och ge feedback.
        
        VIKTIGT OM SPRÅKET:
        - All output MÅSTE vara på SVENSKA. Inga engelska frases.
        - Fyll i fältet 'aiCoachSummary' med en sammanfattning på svenska.
        - Fyll i 'aiCoachNotes' och 'aiMagicPenSuggestions' för varje block på svenska.
        
        Uppgift:
        1. Granska balansen (push/pull, underkropp/överkropp).
        2. Föreslå konkreta förbättringar i 'aiMagicPenSuggestions' (t.ex. "Lägg till rodd för balans").
        3. Ge beröm och tips i 'aiCoachSummary'.

        Passdata att analysera: ${currentWorkoutJson}
    `;
  return _callGeminiWithSchema(fullPrompt, currentWorkout);
}

export async function parseWorkoutFromText(pastedText: string): Promise<Workout> {
    const fullPrompt = `
    Du är en expertcoach. Din uppgift är att tolka texten och skapa ett strukturerat träningspass.

    REGLER FÖR TOLKNING:
    1. **Instruktion vs Lista:**
       - Om texten är en **begäran** (t.ex. "Gör ett benpass"), SKAPA ett pass som uppfyller önskemålet.
       - Om texten är en **lista** (klistrat från mail/notes), strukturera den exakt som den står.

    2. **KRITISKA REGLER:**
       - **SPRÅK:** All text i JSON-svaret (titlar, övningar, beskrivningar) MÅSTE vara på SVENSKA. Översätt om nödvändigt.
       - **ÖVNINGSNAMN:** Fältet \`name\` får ENDAST innehålla övningens namn. Inga tider eller reps.
       - **REPS:** Lägg antal/tid i \`reps\`-fältet, inte i namnet. Hitta inte på reps om det inte står.

    Text att tolka: "${pastedText.replace(/`/g, '\\`')}"
    Output: JSON som matchar schemat.
    `;
     return _callGeminiWithSchema(fullPrompt);
}

export async function parseWorkoutFromImage(base64Image: string, additionalText: string = ''): Promise<Workout> {
    const ai = getAIClient();
    const prompt = `
    Du är en expertcoach. Analysera den handskrivna anteckningen eller bilden på ett träningspass och skapa ett strukturerat JSON-träningspass.

    YTTERLIGARE INSTRUKTIONER: "${additionalText}"

    REGLER:
    1. **SPRÅK:** All output (titlar, övningar, beskrivningar) SKA vara på SVENSKA.
    2. **Transkribering vs Skapande:**
       - Om bilden visar ett färdigt pass (whiteboard/anteckning): Transkribera det exakt.
       - Om bilden är något annat: Försök skapa ett pass inspirerat av bilden.
    3. **Inga Hallucinationer:**
       - Baka inte in reps/tid i övningsnamnet. Använd rätt fält i JSON-schemat.
       - Hitta inte på reps om det inte står i bilden eller instruktionerna.

    Output: Returnera ENDAST valid JSON som matchar schemat.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Image } }, { text: prompt }] },
            config: { 
                responseMimeType: "application/json", 
                responseSchema: googleWorkoutSchema
            },
        });
        
        const jsonStr = response.text.trim();
        return validateAndTransformWorkoutData(JSON.parse(jsonStr));
    } catch (e) { throw new Error("Kunde inte läsa bilden."); }
}

export async function generateExerciseDescription(exerciseName: string): Promise<string> {
    const ai = getAIClient();
    const prompt = `
    Du är en minimalistisk träningsapp. Din uppgift är att skriva en extremt kort instruktion på SVENSKA för övningen: "${exerciseName}".

    REGLER:
    1. Maxlängd: 15-20 ord.
    2. Stil: Telegram-stil / Imperativ (Gör så här).
    3. Innehåll: Beskriv ENDAST rörelsen.
    4. FÖRBJUDET:
       - Inga adjektiv (t.ex. "långsamt", "kontrollerat", "noggrant").
       - Inga form-tips (t.ex. "spänn bålen", "rak rygg", "blick framåt").
       - Inga hälsofördelar.

    Målet är att användaren ska förstå rörelsen på 2 sekunder.
    `;
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (e) { return "Beskrivning saknas."; }
}

export async function enhancePageWithAI(rawContent: string): Promise<string> {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: `Förbättra följande text. Gör den professionell, tydlig och inspirerande. Använd Markdown för formatering. Texten ska vara på SVENSKA. Input: ${rawContent}`,
        });
        return response.text;
    } catch (e) { return rawContent; }
}

export async function generateCarouselImage(prompt: string): Promise<string> {
    // Note: We're simulating this for now as per previous context, or use imagen if enabled.
    const ai = getAIClient();
    try {
        // Placeholder for real image generation logic using Imagen if available
        const response = await ai.models.generateContent({
            model: model, 
            contents: { parts: [{ text: `Generate an image description for: ${prompt}.` }] }, 
        });
        throw new Error("Bildgenerering kräver Imagen-åtkomst.");
    } catch (e) { throw new Error("Bildgenerering misslyckades."); }
}

// --- NEW IMAGE GENERATION FUNCTION FOR DIPLOMA ---
export async function generateImage(prompt: string): Promise<string | null> {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
            config: {
                imageConfig: {
                    aspectRatio: "1:1"
                }
            }
        });
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (e) {
        console.error("Image generation failed", e);
        return null;
    }
}

export async function interpretHandwriting(base64Image: string): Promise<string> {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Image } }, { text: "Transkribera texten exakt som den står till svenska. Lägg inte till egen text, tider eller tolkningar." }] },
        });
        return response.text;
    } catch (e) { throw new Error("Kunde inte tolka."); }
}

export async function generateHyroxWod(): Promise<Workout> {
    return _callGeminiWithSchema("Create a Hyrox workout (JSON, Swedish).");
}

// --- MEMBER INSIGHTS ---

export interface MemberInsightResponse {
    readiness: {
        status: 'high' | 'moderate' | 'low';
        message: string;
        color?: string;
    };
    strategy?: string; 
    suggestions: {
        [exerciseName: string]: string; 
    };
    scaling?: {
        [exerciseName: string]: string; 
    };
}

export async function generateMemberInsights(
    recentLogs: WorkoutLog[], 
    currentWorkoutTitle: string, 
    currentExercises: string[]
): Promise<MemberInsightResponse> {
    const ai = getAIClient();
    
    const smartHistoryMap: Record<string, number> = {};
    
    currentExercises.forEach(currentExName => {
        let maxWeight = 0;
        recentLogs.forEach(log => {
            log.exerciseResults?.forEach(logEx => {
                if (logEx.weight && isExerciseMatch(currentExName, logEx.exerciseName)) {
                    if (logEx.weight > maxWeight) {
                        maxWeight = logEx.weight;
                    }
                }
            });
        });
        if (maxWeight > 0) {
            smartHistoryMap[currentExName] = maxWeight;
        }
    });

    const filteredHistory = recentLogs.slice(0, 5).map(log => {
        const relevantExercises = log.exerciseResults?.filter(logEx =>
            currentExercises.some(currEx => isExerciseMatch(currEx, logEx.exerciseName))
        ).map(ex => ({
            name: ex.exerciseName,
            weight: ex.weight,
            reps: ex.reps
        })) || [];

        return {
            date: new Date(log.date).toISOString().split('T')[0],
            title: log.workoutTitle,
            rpe: log.rpe,
            feeling: log.feeling,
            exercises: relevantExercises.length > 0 ? relevantExercises : undefined
        };
    });

    const prompt = `
    Du är en expert PT och strateg. Analysera medlemmens 5 senaste pass och ge en "Pre-Game Strategy" inför DAGENS pass.
    
    VIKTIGT: All output ska vara på SVENSKA.

    **Historik (Filtrerad):**
    ${JSON.stringify(filteredHistory)}

    **Personbästa (för matchande övningar):**
    ${JSON.stringify(smartHistoryMap)}

    **Dagens Pass:**
    Titel: "${currentWorkoutTitle}"
    Övningar: ${currentExercises.join(', ')}

    **Uppgift:**
    1. **Strategi:** Ge en kort, peppande strategi (max 1 mening) baserat på passets typ (styrka vs kondition) och medlemmens historik.
    2. **Dagsform (Readiness):** Analysera RPE/Känsla.
    3. **Smart Load:** Föreslå vikter baserat på PB. Om inget PB finns, skriv "Hitta dagsform".
    4. **Skalning:** Om passet innehåller komplexa/tunga övningar (t.ex. Box Jumps, Tunga lyft, Muscle-ups), ge ett enklare alternativ i 'scaling'-fältet.

    **Output Schema (JSON):**
    {
      "readiness": {
        "status": "high" | "moderate" | "low",
        "message": "Kort råd om dagsform."
      },
      "strategy": "Kort peppande strategi för passet (t.ex. 'Håll igen i början, öka på slutet!')",
      "suggestions": {
        "Exercise Name": "45kg"
      },
      "scaling": {
        "Hard Exercise Name": "Alternative Exercise Name (Reason)" 
      }
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: model, 
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as MemberInsightResponse;
    } catch (e) {
        console.error("Failed to generate member insights", e);
        return {
            readiness: { status: 'moderate', message: 'Lyssna på kroppen idag!' },
            suggestions: {}
        };
    }
}

// --- DAGSFORM / EXERCISE SPECIFIC ADVICE ---

export interface ExerciseDagsformAdvice {
    suggestion: string;
    reasoning: string;
    history: { date: string, weight: number, reps: string }[];
}

export async function getExerciseDagsformAdvice(
    exerciseName: string,
    feeling: 'good' | 'neutral' | 'bad',
    allLogs: WorkoutLog[]
): Promise<ExerciseDagsformAdvice> {
    const ai = getAIClient();

    // 1. Extract history for this specific exercise
    const history = allLogs.flatMap(log => 
        (log.exerciseResults || [])
            .filter(ex => isExerciseMatch(exerciseName, ex.exerciseName))
            .map(ex => ({
                date: new Date(log.date).toLocaleDateString('sv-SE'),
                weight: ex.weight || 0,
                reps: ex.reps || "Mixed"
            }))
    ).slice(0, 5);

    const prompt = `
    Du är en expert PT. Ge ett konkret viktförslag och tips för övningen "${exerciseName}" för IDAG.
    
    MEDLEMMENS DAGSFORM: "${feeling === 'good' ? 'Pigg/Stark' : feeling === 'bad' ? 'Seg/Skadad' : 'Normal'}"
    HISTORIK FÖR DENNA ÖVNING: ${JSON.stringify(history)}

    DIN UPPGIFT:
    1. Analysera trenden (ökar/minskar/stilla).
    2. Föreslå en specifik vikt för idag baserat på dagsform.
    3. Ge en kort motivering (max 2 meningar).

    Svara på SVENSKA i JSON-format.
    {
      "suggestion": "T.ex. 45 kg",
      "reasoning": "Din motivering här..."
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const data = JSON.parse(response.text.trim());
        return {
            ...data,
            history
        };
    } catch (e) {
        console.error("Dagsform advice failed", e);
        return {
            suggestion: "Hitta dagsform",
            reasoning: "Datan räckte inte för ett specifikt råd. Börja lätt och känn efter.",
            history: history
        };
    }
}

// --- NEW MEMBER ANALYSIS FOR COACHES ---

export interface MemberProgressAnalysis {
    strengths: string;
    improvements: string;
    actions: string[];
    metrics: {
        strength: number;
        endurance: number;
        frequency: number;
    }
}

export async function analyzeMemberProgress(
    logs: WorkoutLog[], 
    memberName: string, 
    goals?: MemberGoals
): Promise<MemberProgressAnalysis> {
    const ai = getAIClient();

    const logSummary = logs.slice(0, 20).map(log => ({
        date: new Date(log.date).toISOString().split('T')[0],
        title: log.workoutTitle,
        rpe: log.rpe,
        feeling: log.feeling,
        comment: log.comment,
        tags: log.tags,
        exercises: log.exerciseResults?.map(e => `${e.exerciseName} (${e.weight || 0}kg)`).join(', ')
    }));

    const prompt = `
    Du är en senior huvudcoach på ett gym. Analysera träningsdatan för medlemmen "${memberName}" och ge en strategisk analys till deras coach.
    
    MÅL FÖR MEDLEMMEN: ${goals?.hasSpecificGoals ? goals.selectedGoals.join(', ') : 'Inga specifika mål angivna.'}
    
    TRÄNINGSHISTORIK (20 senaste):
    ${JSON.stringify(logSummary)}

    DIN UPPGIFT:
    1. **Styrkor:** Vad gör de bra? (Consistency, fokus, progression).
    2. **Förbättringsområden:** Vad saknas eller stagnerar?
    3. **Coach Actions:** 2-3 konkreta saker coachen bör säga eller göra nästa gång de ses.
    4. **Metrics (0-100):** Uppskatta Styrka, Uthållighet och Frekvens baserat på datan.

    VIKTIGT: Svara på SVENSKA i JSON-format.
    
    SCHEMA:
    {
      "strengths": "Beskrivning på svenska",
      "improvements": "Beskrivning på svenska",
      "actions": ["Punkt 1", "Punkt 2"],
      "metrics": {
        "strength": number,
        "endurance": number,
        "frequency": number
      }
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        return JSON.parse(response.text.trim()) as MemberProgressAnalysis;
    } catch (e) {
        console.error("Member analysis failed", e);
        return {
            strengths: "Kunde inte generera analys.",
            improvements: "Datan räcker inte till en fullständig analys.",
            actions: ["Fortsätt peppa medlemmen på golvet."],
            metrics: { strength: 50, endurance: 50, frequency: 50 }
        };
    }
}

// --- ADMIN ANALYTICS CHAT ---

export async function askAdminAnalytics(userQuestion: string, logs: WorkoutLog[]): Promise<string> {
    const ai = getAIClient();

    const logSummary = logs.map(log => ({
        date: new Date(log.date).toISOString().split('T')[0],
        title: log.workoutTitle,
        rpe: log.rpe,
        feeling: log.feeling,
        comment: log.comment,
        tags: log.tags, 
        exercises: log.exerciseResults?.map(e => e.exerciseName).join(', ')
    }));

    const prompt = `
    Du är en expert på dataanalys och affärsutveckling för gym. Du pratar med gymmets administratörer/ägare.
    
    DATASET (JSON):
    ${JSON.stringify(logSummary.slice(0, 50))} 

    ANVÄNDARENS FRÅGA: "${userQuestion}"

    INSTRUKTIONER:
    1. Extremt kortfattade och professionella (Executive Summary-stil).
    2. Befriade från "filler-fraser". Börja ALDRIG med "Okej, jag förstår", "Tack för frågan" eller "Jag är din analytiker...". Gå direkt på svaret.
    3. Fria från stjärnor (**) runt namn på gym eller varumärken.
    4. Svara på svenska.

    HANTERING AV DATA:
    - Om data/dataset saknas eller är tomt: Skriv ENDAST: "Underlaget saknar data för denna period." Ge inga hypotetiska listor på vad du *skulle* ha gjort om data fanns, såvida inte användaren uttryckligen ber om generella råd.
    - Om data finns: Presentera insikterna direkt i punktform utan långa inledningar.

    Exempel på bra svar vid saknad data:
    "Data saknas för att analysera den generella stämningen. Vänligen ladda upp träningsloggar för perioden."
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (e) {
        console.error("Analytics chat failed", e);
        return "Tyvärr, jag kunde inte analysera datan just nu. Försök igen senare.";
    }
}

export async function generateBusinessActions(logs: WorkoutLog[]): Promise<string> {
    const ai = getAIClient();

    const logSummary = logs.map(log => ({
        date: new Date(log.date).toISOString().split('T')[0],
        title: log.workoutTitle,
        rpe: log.rpe,
        feeling: log.feeling,
        comment: log.comment,
        tags: log.tags
    }));

    const prompt = `
    Analysera datan och ge 3 korta, konkreta åtgärdsförslag (Action Points).

    DATASET (JSON):
    ${JSON.stringify(logSummary.slice(0, 75))}

    REGLER:
    1. Max 3 punkter.
    2. Max 1-2 meningar per punkt.
    3. Ingen inledning eller avslutning. Rakt på sak.
    4. Fokusera på återkommande problem eller önskemål i kommentarerna.

    FORMAT:
    Markdown punktlista.

    Språk: Svenska.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (e) {
        console.error("Business actions generation failed", e);
        return "Kunde inte generera åtgärdsförslag just nu. Försök igen senare.";
    }
}

// --- PREMIUM DIPLOMA GENERATOR ---

export async function generateWorkoutDiploma(logData: WorkoutLog): Promise<WorkoutDiploma> {
    const ai = getAIClient();

    // Summarize exercises for context
    const exercisesSummary = logData.exerciseResults
        ?.map(e => `${e.exerciseName}: ${e.weight ? e.weight + 'kg' : ''} ${e.reps ? 'x ' + e.reps : ''}`)
        .join(', ');

    // Additional Stats for context
    const statsInfo = [
        logData.totalDistance ? `Distans: ${logData.totalDistance} km` : '',
        logData.totalCalories ? `Kalorier: ${logData.totalCalories} kcal` : '',
        logData.durationMinutes ? `Tid: ${logData.durationMinutes} min` : ''
    ].filter(Boolean).join(', ');

    const prompt = `
    Roll: Du är en AI-copywriter och Art Director för en premium träningsapp. Ditt jobb är att paketera ett avslutat träningspass till en snygg "award".
    Tonläge: Auktoritärt men varmt. Datadrivet. Premium/Exklusivt.

    INPUT DATA:
    - Passnamn: "${logData.workoutTitle}"
    - RPE (1-10): ${logData.rpe || 'Okänt'}
    - Känsla: ${logData.feeling || 'Okänd'}
    - Kommentar: "${logData.comment || ''}"
    - Övningsdata (Stickprov): ${exercisesSummary}
    - Stats: ${statsInfo}

    DIN UPPGIFT:
    Generera ett JSON-objekt med exakt dessa 5 fält baserat på reglerna nedan:

    1. title (Rubrik): Kort & Kraftfull (Max 2-3 ord).
       - 1-5 reps => REN STYRKA / TUNGT LYFT
       - 6-12 reps => BYGGPASS / VOLYM & KONTROLL
       - 15+ reps => UTHÅLLIGHET / MENTAL STYRKA
       - PB/Rekord => NY NIVÅ / REKORDPASS
       - Cardio/Distans => LÅNGDISTANS / KONDITION

    2. subtitle (Underrad): En mening som förklarar passets identitet.
       - Ex: "Låga repetitioner med maximal belastning."

    3. achievement (Prestation): Hjälte-raden.
       - Om data finns i input (t.ex. tunga vikter), nämn det! Ex: "Du hanterade tunga vikter i marklyft."
       - Om distans eller kalorier finns, inkludera detta (t.ex. "Du sprang 5 km idag!").
       - Om RPE var högt: "Du genomförde, trots att det var tungt."
       - Annars: "Kontinuitet är nyckeln till resultat."

    4. footer (Avslut): Kort, slående mening.
       - Ex: "Styrka är en färskvara. Du fyllde på idag."

    5. imagePrompt (Bild):
       - MÅSTE vara på ENGELSKA.
       - Inga accentfärger: Monokrom (Svart, Vit, Grå) eller neutrala material (Stål, Betong, Sten, Svart marmor).
       - Stil: 3D Render, Minimalist, High Contrast, Cinematic Lighting.
       - Motiv: Abstrakt representation (t.ex. tung sten, block, kedjor). Inga människor/text.
       - Format: [Motiv], material made of [Concrete/Steel/Stone], dramatic lighting, dark background, monochrome, 8k, unreal engine 5 render, minimalist style, no colors.

    Output Schema (JSON):
    {
        "title": "string",
        "subtitle": "string",
        "achievement": "string",
        "footer": "string",
        "imagePrompt": "string"
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const rawJson = response.text.trim();
        let parsed: any;
        
        try {
            parsed = JSON.parse(rawJson);
        } catch (e) {
            // Backup handling if it returned an array or has extra chars
            const match = rawJson.match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
            else throw e;
        }

        // Handle array wrap if AI returned [{...}]
        const data = Array.isArray(parsed) ? parsed[0] : parsed;
        
        // Ensure backwards compatibility if fields are missing
        return {
            title: data.title || "BRA JOBBAT",
            subtitle: data.subtitle || "Passet är genomfört.",
            achievement: data.achievement || "Kontinuitet ger resultat.",
            footer: data.footer || "Vila nu.",
            imagePrompt: data.imagePrompt || "Abstract dark concrete texture, 8k, monochrome",
            // Include old fields for safety if accessed elsewhere
            message: data.subtitle,
            comparison: data.achievement
        };
    } catch (e) {
        console.error("Diploma generation failed", e);
        return {
            title: "BRA JOBBAT",
            subtitle: "Du tog dig igenom passet.",
            achievement: "Starkt jobbat!",
            footer: "Ses snart igen.",
            imagePrompt: "Abstract dark stone texture, cinematic lighting, 8k, monochrome",
            message: "Du tog dig igenom passet.",
            comparison: "Starkt jobbat!"
        };
    }
}

export { getExerciseBank };