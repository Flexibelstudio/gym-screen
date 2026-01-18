import { GoogleGenAI, GenerateContentResponse } from "@google/genai"; 
import { Type } from "@google/genai"; 

import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise, SuggestedExercise, CustomCategoryWithPrompt, WorkoutLog, MemberGoals, WorkoutDiploma } from '../types';
import { getExerciseBank } from './firebaseService';
import { z } from 'zod';

// MODELL: Gemini 3 Flash för snabbhet och precision
const model = 'gemini-3-flash-preview'; 

// SÄKERHET: Hämta nyckel exklusivt från process.env
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

// --- Zod Schemas (Behålls för säkerhet) ---
const BankExerciseSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string())
});
const ExerciseSuggestionsResponseSchema = z.array(BankExerciseSuggestionSchema);

// --- Google Schemas (Strukturerad output för SDK) ---

const googleExerciseSchema = {
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

const googleWorkoutSchema = {
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

// --- GENERIC CALL HANDLER (Robust felhantering) ---
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

// --- API CALLS ---

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
                // schema name corrected from googleWorkoutSchema
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
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: model, 
            contents: { parts: [{ text: `Generate an image description for: ${prompt}.` }] }, 
        });
        throw new Error("Bildgenerering kräver Imagen-åtkomst.");
    } catch (e) { throw new Error("Bildgenerering misslyckades."); }
}

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

// --- MEMBER INSIGHTS & DIPLOMA ---

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

// Gemini structured response schema (without unsupported additionalProperties)
const memberInsightSchema = {
    type: Type.OBJECT,
    required: ['readiness', 'suggestions', 'scaling', 'strategy'],
    properties: {
        readiness: {
            type: Type.OBJECT,
            required: ['status', 'message'],
            properties: {
                status: { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
                message: { type: Type.STRING }
            }
        },
        strategy: { type: Type.STRING },
        // Use arrays of objects for maps to avoid "additionalProperties" error
        suggestions: { 
            type: Type.ARRAY, 
            items: {
                type: Type.OBJECT,
                required: ['exerciseName', 'advice'],
                properties: {
                    exerciseName: { type: Type.STRING },
                    advice: { type: Type.STRING }
                }
            }
        },
        scaling: { 
            type: Type.ARRAY, 
            items: {
                type: Type.OBJECT,
                required: ['exerciseName', 'advice'],
                properties: {
                    exerciseName: { type: Type.STRING },
                    advice: { type: Type.STRING }
                }
            }
        }
    }
};

export async function generateMemberInsights(
    recentLogs: WorkoutLog[], 
    currentWorkoutTitle: string, 
    currentExercises: string[]
): Promise<MemberInsightResponse> {
    const ai = getAIClient();
    
    const prompt = `
    Du är en expert PT och strateg. Analysera medlemmens historik och ge en "Pre-Game Strategy" inför DAGENS pass: "${currentWorkoutTitle}".
    
    VIKTIGT: All output ska vara på SVENSKA.

    Övningar i passet: ${currentExercises.join(', ')}
    Historik: ${JSON.stringify(recentLogs.slice(0, 5))}

    Uppgift:
    1. Readiness: Bedöm dagsform baserat på frekvens och kommentarer.
    2. Suggestions: Föreslå vikter för dagens övningar baserat på historik.
    3. Scaling: Ge alternativ för svåra övningar.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model, 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: memberInsightSchema
            }
        });

        const jsonStr = response.text.trim();
        const data = JSON.parse(jsonStr);

        // Map array format back to expected object format for the frontend
        const suggestions: Record<string, string> = {};
        if (Array.isArray(data.suggestions)) {
            data.suggestions.forEach((s: any) => {
                suggestions[s.exerciseName] = s.advice;
            });
        }

        const scaling: Record<string, string> = {};
        if (Array.isArray(data.scaling)) {
            data.scaling.forEach((s: any) => {
                scaling[s.exerciseName] = s.advice;
            });
        }

        return {
            readiness: data.readiness,
            strategy: data.strategy,
            suggestions,
            scaling
        } as MemberInsightResponse;

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

const exerciseDagsformSchema = {
    type: Type.OBJECT,
    required: ['suggestion', 'reasoning'],
    properties: {
        suggestion: { type: Type.STRING },
        reasoning: { type: Type.STRING }
    }
};

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
                reps: ex.reps ? ex.reps.toString() : "Mixed"
            }))
    ).slice(0, 5);

    const prompt = `
    Du är en expert PT. Ge ett konkret viktförslag och tips för övningen "${exerciseName}" för IDAG.
    
    MEDLEMMENS DAGSFORM: "${feeling === 'good' ? 'Pigg/Stark' : feeling === 'bad' ? 'Seg/Skadad' : 'Normal'}"
    HISTORIK FÖR DENNA ÖVNING: ${JSON.stringify(history)}

    DIN UPPGIFT:
    1. Analysera trenden.
    2. Föreslå en specifik vikt.
    3. Ge en kort motivering.

    Svara på SVENSKA.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: exerciseDagsformSchema }
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
            reasoning: "Datan räckte inte för ett specifikt råd.",
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

const memberProgressSchema = {
    type: Type.OBJECT,
    required: ['strengths', 'improvements', 'actions', 'metrics'],
    properties: {
        strengths: { type: Type.STRING },
        improvements: { type: Type.STRING },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        metrics: {
            type: Type.OBJECT,
            required: ['strength', 'endurance', 'frequency'],
            properties: {
                strength: { type: Type.NUMBER },
                endurance: { type: Type.NUMBER },
                frequency: { type: Type.NUMBER }
            }
        }
    }
};

export async function analyzeMemberProgress(
    logs: WorkoutLog[], 
    memberName: string, 
    goals?: MemberGoals
): Promise<MemberProgressAnalysis> {
    const ai = getAIClient();

    const logSummary = logs.slice(0, 20).map(log => ({
        date: new Date(log.date).toISOString().split('T')[0],
        title: log.workoutTitle,
        exercises: log.exerciseResults?.map(e => `${e.exerciseName} (${e.weight || 0}kg)`).join(', ')
    }));

    const prompt = `
    Analysera träningsdatan för "${memberName}" och ge en strategisk analys till deras coach.
    MÅL: ${goals?.hasSpecificGoals ? goals.selectedGoals.join(', ') : 'Inga specifika mål.'}
    HISTORIK: ${JSON.stringify(logSummary)}
    
    Svara på SVENSKA.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: memberProgressSchema }
        });

        return JSON.parse(response.text.trim()) as MemberProgressAnalysis;
    } catch (e) {
        console.error("Member analysis failed", e);
        return {
            strengths: "Kunde inte generera analys.",
            improvements: "Datan räcker inte.",
            actions: ["Fortsätt peppa medlemmen."],
            metrics: { strength: 50, endurance: 50, frequency: 50 }
        };
    }
}

// --- ADMIN ANALYTICS CHAT ---

export async function askAdminAnalytics(userQuestion: string, logs: WorkoutLog[]): Promise<string> {
    const ai = getAIClient();
    // Simplified log summary for token efficiency
    const logSummary = logs.slice(0, 50).map(log => ({
        date: new Date(log.date).toISOString().split('T')[0],
        title: log.workoutTitle,
        comment: log.comment
    }));

    const prompt = `
    Du är en dataexpert för gym. Svara på frågan: "${userQuestion}".
    DATA: ${JSON.stringify(logSummary)}
    Svara kort och professionellt på SVENSKA.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (e) {
        return "Tyvärr, jag kunde inte analysera datan just nu.";
    }
}

export async function generateBusinessActions(logs: WorkoutLog[]): Promise<string> {
    const ai = getAIClient();
    const response = await ai.models.generateContent({ 
        model: model, 
        contents: "Ge 3 affärsåtgärder baserat på träningsdatan (t.ex. populära tider, pass). SVENSKA." 
    });
    return response.text.trim();
}

// --- PREMIUM DIPLOMA GENERATOR ---

const diplomaSchema = {
    type: Type.OBJECT,
    required: ['title', 'subtitle', 'achievement', 'footer', 'imagePrompt'],
    properties: {
        title: { type: Type.STRING },
        subtitle: { type: Type.STRING },
        achievement: { type: Type.STRING },
        footer: { type: Type.STRING },
        imagePrompt: { type: Type.STRING }
    }
};

export async function generateWorkoutDiploma(logData: any): Promise<WorkoutDiploma> {
    const ai = getAIClient();

    // Explicitly focus AI on the exercise names from the record list
    const pbText = logData.newPBs?.map((pb: any) => `${pb.name} (${pb.diff > 0 ? '+' + pb.diff + 'kg' : 'Nytt!'})`).join(', ') || 'Inga nya rekord.';

    const prompt = `
    Skapa en premium träningsbelöning ("award") i JSON-format för ett nyss avslutat pass på SVENSKA.
    Pass: "${logData.workoutTitle}"
    NYA REKORD SOM SATTS: ${pbText}
    Stats: Distans ${logData.totalDistance} km, Kcal ${logData.totalCalories}.

    INSTRUKTION FÖR RUBRIK (title):
    - Skapa en engagerande och varierad rubrik.
    - Om det finns nya rekord (newPBs), välj något kraftfullt som "LEGENDARISKT", "REKORDKROSSARE" eller "NY NIVÅ UPPNÅDD".
    - Om inga rekord finns, fokusera på insatsen: "STARKARE ÄN IGÅR", "ENORM KÄMPAGLÖD" eller "SNYGGT JOBBAT".
    - Undvik att bara skriva "Nytt PB" varje gång.

    ÖVRIGT:
    1. 'subtitle': Hylla specifika framsteg eller records.
    2. 'achievement': En inspirerande text om medlemmens prestation.
    3. 'imagePrompt': Ett abstrakt 3D-motiv på ENGELSKA som symboliserar styrka (t.ex. "Polished chrome dumbbell, cinematic lighting, neon teal accents").

    Svara på SVENSKA.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: diplomaSchema }
        });
        
        const result = JSON.parse(response.text.trim());
        
        return {
            ...result,
            newPBs: logData.newPBs
        };
    } catch (e) {
        console.error("Diploma generation failed", e);
        return {
            title: logData.newPBs?.length > 0 ? "NYTT REKORD!" : "BRA JOBBAT",
            subtitle: "Passet genomfört.",
            achievement: "Varje droppe svett tar dig närmare ditt mål.",
            footer: "Vila och ladda om.",
            imagePrompt: "Heavy steel plate, dramatic lighting, monochrome",
            newPBs: logData.newPBs
        };
    }
}