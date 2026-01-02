import { GoogleGenAI, GenerateContentResponse, Type, Schema } from "@google/genai";
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise, SuggestedExercise, CustomCategoryWithPrompt, WorkoutLog } from '../types';
import { getExerciseBank } from './firebaseService';
import { z } from 'zod';

// MODELL: Använder senaste rekommenderade modellen för text och komplexa uppgifter
const model = 'gemini-2.0-flash'; // Eller 'gemini-1.5-pro' beroende på tillgång. 2.0-flash är snabb och bra.

// SÄKERHET: Hämta nyckel exklusivt från process.env enligt riktlinjer
const getAIClient = () => {
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    
    // Fallback för lokala utvecklingsmiljöer (Vite)
    const viteKey = (import.meta as any).env.VITE_API_KEY;
    if (viteKey) return new GoogleGenAI({ apiKey: viteKey });

    console.error("CRITICAL: No API Key found.");
    throw new Error("API-nyckel saknas.");
};

// --- Helper Logic for Matching (Nytt från den nya koden) ---
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

// --- Zod Schemas (För att validera SVARET vi får tillbaka) ---
const BankExerciseSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string())
});
const ExerciseSuggestionsResponseSchema = z.array(BankExerciseSuggestionSchema);

// --- Google Schemas (För att BERÄTTA för AI vad vi vill ha) ---
const googleExerciseSchema: Schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        required: ['name', 'description', 'tags'],
        properties: {
            name: { type: Type.STRING, description: "Exercise name in Swedish" },
            description: { type: Type.STRING, description: "Short execution instruction" },
            tags: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Tags like 'styrka', 'ben', 'hantlar'"
            }
        }
    }
};

const googleWorkoutSchema: Schema = {
  type: Type.OBJECT,
  required: ['title', 'coachTips', 'blocks'],
  properties: {
      title: { type: Type.STRING },
      coachTips: { type: Type.STRING },
      aiCoachSummary: { type: Type.STRING },
      blocks: {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              required: ['title', 'tag', 'setupDescription', 'followMe', 'settings', 'exercises'],
              properties: {
                  title: { type: Type.STRING },
                  tag: { type: Type.STRING, enum: ["Styrka", "Kondition", "Rörlighet", "Teknik", "Core/Bål", "Balans", "Uppvärmning"] },
                  setupDescription: { type: Type.STRING },
                  followMe: { type: Type.BOOLEAN },
                  aiCoachNotes: { type: Type.STRING },
                   aiMagicPenSuggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
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
                              name: { type: Type.STRING },
                              reps: { type: Type.STRING },
                              description: { type: Type.STRING },
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
  const MAX_RETRIES = 3;
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
        console.error(`Attempt ${attempt} failed:`, error);
        
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
        You are an expert fitness coach. Generate a list of exercise suggestions based on a user's request. 
        Output must be valid JSON matching the schema. All text in Swedish.
        **Request:** "${userPrompt.replace(/`/g, '\\`')}"
        **Exclude:** ${existingExerciseNames}
        **Format:** JSON Array with name, description, tags.
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
        You are an expert AI coach. Create a workout session in Swedish.
        Input: "${userPrompt.replace(/`/g, '\\`')}"
        Output: JSON matching the schema.
        Rules: 1-3 blocks, valid tags, complete timer settings.
    `;
    return _callGeminiWithSchema(fullPrompt);
}

export async function analyzeCurrentWorkout(currentWorkout: Workout): Promise<Workout> {
    const currentWorkoutJson = JSON.stringify(currentWorkout).replace(/`/g, '\\`');
    const fullPrompt = `Analyze this workout and provide feedback in JSON: ${currentWorkoutJson}`;
    return _callGeminiWithSchema(fullPrompt, currentWorkout);
}

export async function parseWorkoutFromText(pastedText: string): Promise<Workout> {
    const fullPrompt = `
    You are an expert fitness coach. Analyze the input text.

    **INTERPRETATION RULES:**
    1. **Instruction vs. List:**
       - If the text is a specific **request** (e.g., "10 övningar", "Skapa ett benpass"), **GENERATE** a full workout content satisfying that request with suitable exercises.
       - If the text is a **list** of specific exercises, structure it exactly as written.

    2. **CRITICAL RULES FOR EXERCISE DATA:**
       - **CLEAN NAMES:** The \`name\` field must contain **ONLY** the name of the exercise (e.g., "Knäböj").
       - **ABSOLUTELY FORBIDDEN:** Do **NOT** add times, reps, or extra info inside the name string (e.g., "Knäböj (40 sek)" is WRONG. "Knäböj" is CORRECT).
       - **NO HALLUCINATED REPS:** If generating exercises based on a count (e.g. "10 exercises"), leave the \`reps\` field **EMPTY**. Do not invent reps or times unless the user specifically asked for them.
       - **STRICT LIST TRANSCRIPTION:** If interpreting a list, transcribe exactly. If the text says "10 Burpees", then reps="10", name="Burpees". If it just says "Burpees", then reps="".

    Text input: "${pastedText.replace(/`/g, '\\`')}"
    Output: JSON matching the schema in Swedish.`;
     return _callGeminiWithSchema(fullPrompt);
}

export async function parseWorkoutFromImage(base64Image: string): Promise<Workout> {
    const ai = getAIClient();
    const prompt = `
    You are an expert fitness coach. Analyze the handwritten note in the image and create a structured JSON workout.

    **INTERPRETATION RULES:**
    1. **Instruction vs. List:**
       - If the text is a **request** or **instruction** (e.g., "10 övningar", "Gör ett benpass", "Tabata upplägg"), you must **GENERATE** a full workout that fulfills that request.
         *Example:* If it says "10 övningar", create a block with 10 distinct, suitable exercises.
       - If the text is a **list of exercises** (e.g., "1. Knäböj, 2. Press"), transcribe them exactly as written.

    2. **CRITICAL: NO HALLUCINATIONS / EXTRA DATA:**
       - **EXERCISE NAMES:** Must be clean. **NEVER** append time, reps, or calories to the name string (e.g. "Burpees (40 sek)" is FORBIDDEN. Write "Burpees").
       - **REPS:** If generating exercises from a request (e.g. "10 exercises"), leave \`reps\` **EMPTY**. Do not invent "10" or "40s".
       - **SETTINGS:** If no specific timer format (like Tabata/EMOM) is requested, use default settings but do NOT bake times into exercise names.

    3. **Language:**
       - Ensure all output (titles, exercise names) is in **Swedish**.

    **Output:** Return ONLY valid JSON matching the schema.
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
    const prompt = `Skriv en kort instruktion på svenska för: "${exerciseName}".`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (e) { return "Beskrivning saknas."; }
}

export async function enhancePageWithAI(rawContent: string): Promise<string> {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Format as Markdown: ${rawContent}`,
        });
        return response.text;
    } catch (e) { return rawContent; }
}

export async function generateCarouselImage(prompt: string): Promise<string> {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash', // Use standard flash for now as flash-image availability varies
            contents: { parts: [{ text: `Generate an image prompt for: ${prompt}. Then pretend you generated it.` }] }, // Fallback if image model is unavailable
        });
        // OBS: Flash-image implementation depends on API access. 
        // If you have access to Imagen via Gemini API, update model here.
        throw new Error("Bildgenerering kräver Imagen-åtkomst.");
    } catch (e) { throw new Error("Bildgenerering misslyckades."); }
}

export async function interpretHandwriting(base64Image: string): Promise<string> {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Image } }, { text: "Transkribera texten exakt som den står. Lägg inte till egen text, tider eller tolkningar." }] },
        });
        return response.text;
    } catch (e) { throw new Error("Kunde inte tolka."); }
}

export async function generateHyroxWod(): Promise<Workout> {
    return _callGeminiWithSchema("Create a Hyrox workout (JSON, Swedish).");
}

// --- MEMBER INSIGHTS (Ny logik från den nya filen) ---

export interface MemberInsightResponse {
    readiness: {
        status: 'high' | 'moderate' | 'low';
        message: string;
        color?: string;
    };
    suggestions: {
        [exerciseName: string]: string; // "Knäböj": "45kg"
    };
}

export async function generateMemberInsights(
    recentLogs: WorkoutLog[], 
    currentWorkoutTitle: string, 
    currentExercises: string[]
): Promise<MemberInsightResponse> {
    const ai = getAIClient();
    
    // 1. Build Smart History Map using the "Tratt-strategi"
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

    // OPTIMIZATION: Clean up logs to minimal needed data AND filter exercises irrelevant to current session.
    // This dramatically reduces token usage and provides clearer context to the AI.
    const filteredHistory = recentLogs.slice(0, 5).map(log => {
        // Filter exercises in this log that match any of the current session's exercises
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
            // Only include the array if we actually found matches to save tokens.
            // If undefined, AI will just see the general vibe (RPE/Feeling) which is good for Readiness.
            exercises: relevantExercises.length > 0 ? relevantExercises : undefined
        };
    });

    const prompt = `
    You are an expert personal trainer. Analyze the user's last 5 workouts and provide insights for their CURRENT session.

    **User History Summary (Filtered for relevance):**
    ${JSON.stringify(filteredHistory)}

    **Pre-calculated Best Lifts (All-time best for matching exercises):**
    ${JSON.stringify(smartHistoryMap)}

    **Current Session:**
    Title: "${currentWorkoutTitle}"
    Exercises: ${currentExercises.join(', ')}

    **Task:**
    1. **Readiness:** Analyze trends in RPE and Feeling from the history summary. If RPE is consistently high (>8) or feeling is 'heavy'/'injured', suggest a deload. If feeling is 'good'/'top', suggest pushing harder.
    2. **Smart Load:** Look at the "Pre-calculated Best Lifts" and the specific exercise history in the summary.
        - If a weight exists for an exercise, suggest a progression (e.g. +2.5kg or +5kg if recent RPE was low, or maintain if high).
        - If no weight exists in the pre-calculated list, DO NOT make up a weight. Suggest "Hitta dagsform" or similar.
        - Format suggestions like "45kg" or "Samma vikt som sist".

    **Output Schema (JSON Only):**
    {
      "readiness": {
        "status": "high" | "moderate" | "low",
        "message": "Short, punchy advice in Swedish (max 15 words)."
      },
      "suggestions": {
        "Exercise Name from Current Session": "Suggested weight/reps (e.g. '45kg')"
      }
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash', // Fast model is sufficient
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as MemberInsightResponse;
    } catch (e) {
        console.error("Failed to generate member insights", e);
        // Return safe default
        return {
            readiness: { status: 'moderate', message: 'Lyssna på kroppen idag!' },
            suggestions: {}
        };
    }
}

export { getExerciseBank };