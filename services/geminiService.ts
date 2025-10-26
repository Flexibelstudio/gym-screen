





import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions'; // Use compat for functions
import { firebaseConfig } from './firebaseConfig';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise, Studio, StudioConfig, Organization, CustomPage, UserData, InfoCarousel, DisplayWindow, SuggestedExercise, CustomCategoryWithPrompt } from '../types';
import { getExerciseBank } from './firebaseService';
import { MOCK_ORGANIZATIONS, MOCK_SYSTEM_OWNER, MOCK_ORG_ADMIN, MOCK_EXERCISE_BANK, MOCK_SUGGESTED_EXERCISES } from '../data/mockData';
import { z } from 'zod';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const model = 'gemini-2.5-flash';

// --- Zod Schemas for Validation ---
const ExerciseSchema = z.object({
    name: z.string().min(1, { message: "Exercise name cannot be empty." }),
    reps: z.string().optional(),
    description: z.string().min(1, { message: "Exercise description cannot be empty." }),
    imageUrl: z.string().optional(),
});

const TimerSettingsSchema = z.object({
    mode: z.nativeEnum(TimerMode),
    workTime: z.number(),
    restTime: z.number(),
    rounds: z.number(),
});

const WorkoutBlockSchema = z.object({
    title: z.string(),
    tag: z.enum(["Styrka", "Kondition", "Rörlighet", "Teknik", "Core/Bål", "Balans", "Uppvärmning"]),
    setupDescription: z.string(),
    followMe: z.boolean(),
    aiCoachNotes: z.string().optional(),
    aiMagicPenSuggestions: z.array(z.string()).optional(),
    settings: TimerSettingsSchema,
    exercises: z.array(ExerciseSchema),
});

const WorkoutSchema = z.object({
    title: z.string(),
    coachTips: z.string(),
    aiCoachSummary: z.string().optional(),
    blocks: z.array(WorkoutBlockSchema),
});

const BankExerciseSuggestionSchema = z.object({
  name: z.string().describe("The name of the exercise in Swedish."),
  description: z.string().describe("A concise description of how to perform the exercise, in Swedish."),
  tags: z.array(z.string()).describe("A list of relevant, lowercase tags in Swedish (e.g., 'bröst', 'hantlar', 'styrka').")
});

const ExerciseSuggestionsResponseSchema = z.array(BankExerciseSuggestionSchema);
// --- End Zod Schemas ---

const schema = {
  type: Type.OBJECT,
  required: ['title', 'coachTips', 'blocks'],
  properties: {
      title: { type: Type.STRING },
      coachTips: { type: Type.STRING },
      aiCoachSummary: { 
        type: Type.STRING, 
        description: "Overall summary feedback for the whole workout. Max three improvement suggestions about balance, variation, and recovery. Keep it pedagogical and short, like a PT giving constructive tips." 
      },
      blocks: {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              required: ['title', 'tag', 'setupDescription', 'followMe', 'settings', 'exercises'],
              properties: {
                  title: { type: Type.STRING },
                  tag: { type: Type.STRING, enum: ["Styrka", "Kondition", "Rörlighet", "Teknik", "Core/Bål", "Balans", "Uppvärmning"] },
                  setupDescription: { type: Type.STRING },
                  followMe: { 
                      type: Type.BOOLEAN, 
                      description: "Set to true if all participants should follow the same exercise at the same time (e.g., I-GO-YOU-GO). Set to false for station-based circuits where participants are at different exercises simultaneously." 
                  },
                  aiCoachNotes: { 
                    type: Type.STRING, 
                    description: "1-2 sentences of concrete and exercise-physiologically relevant feedback specifically for this block." 
                  },
                   aiMagicPenSuggestions: {
                    type: Type.ARRAY,
                    description: "2-3 concrete, actionable suggestions for quick adjustments to THIS SPECIFIC BLOCK, e.g., 'Swap deadlifts for kettlebell swings'.",
                    items: { type: Type.STRING }
                  },
                  settings: {
                      type: Type.OBJECT,
                      required: ['mode', 'workTime', 'restTime', 'rounds'],
                      properties: {
                          mode: { type: Type.STRING, enum: Object.values(TimerMode) },
                          workTime: { type: Type.NUMBER, description: "In seconds" },
                          restTime: { type: Type.NUMBER, description: "In seconds" },
                          rounds: { type: Type.NUMBER },
                      },
                  },
                  exercises: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          required: ['name', 'description'],
                          properties: {
                              name: { type: Type.STRING, description: "The name of the exercise, e.g., 'Kettlebell Swings'." },
                              reps: { type: Type.STRING, description: "Optional. Reps, distance, or calories, e.g., '10', '20 kcal', '400m'." },
                              description: { type: Type.STRING, description: "REQUIRED. A short but clear instruction on how to perform the exercise. E.g., for 'Air Squats': 'Stå axelbrett, sänk höften under knähöjd, håll bröstet uppe.'"},
                              imageUrl: { type: Type.STRING, description: "Optional. A publicly accessible URL to an image illustrating the exercise."}
                          },
                      },
                  },
              },
          },
      },
  },
};

const validateAndTransformWorkoutData = (data: unknown): Workout => {
    const validationResult = WorkoutSchema.safeParse(data);
    if (!validationResult.success) {
        console.error("Zod validation failed for workout schema:", validationResult.error.flatten());
        throw new Error(`Kunde inte tolka AI:ns svar. Ogiltig struktur: ${validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
    }
    const validatedData = validationResult.data;

    // Transform validated data into our Workout type, with robust fallbacks and added IDs.
    const newWorkout: Workout = {
        id: `ai-${new Date().toISOString()}`,
        title: validatedData.title || "AI-genererat Pass",
        coachTips: validatedData.coachTips || "",
        aiCoachSummary: validatedData.aiCoachSummary || "",
        blocks: (validatedData.blocks || []).map((block, index): WorkoutBlock => {
            const tag = block.tag || 'Allmänt';
            
            const settings = block.settings;
            const mode = settings.mode || TimerMode.AMRAP;
            
            let { workTime, restTime, rounds } = settings;

            switch (mode) {
                case TimerMode.AMRAP:
                case TimerMode.TimeCap:
                    workTime = typeof workTime === 'number' && workTime > 0 ? workTime : 15 * 60;
                    restTime = 0;
                    rounds = 1;
                    break;
                case TimerMode.EMOM:
                    workTime = 60;
                    restTime = 0;
                    rounds = typeof rounds === 'number' && rounds > 0 ? rounds : 10;
                    break;
                case TimerMode.Interval:
                case TimerMode.Tabata:
                    workTime = typeof workTime === 'number' ? workTime : 30;
                    restTime = typeof restTime === 'number' ? restTime : 15;
                    rounds = typeof rounds === 'number' && rounds > 0 ? rounds : 3;
                    break;
                case TimerMode.NoTimer:
                    workTime = 0;
                    restTime = 0;
                    rounds = 1;
                    break;
                default:
                    workTime = typeof workTime === 'number' ? workTime : 0;
                    restTime = typeof restTime === 'number' ? restTime : 0;
                    rounds = typeof rounds === 'number' ? rounds : 1;
                    break;
            }

            const finalSettings: TimerSettings = {
                mode: mode,
                workTime,
                restTime,
                rounds,
                prepareTime: 10,
            };

            return {
                id: `block-${index}-${new Date().getTime()}`,
                title: block.title || `Block ${index + 1}`,
                tag: tag,
                followMe: block.followMe === true,
                setupDescription: block.setupDescription || "",
                aiCoachNotes: block.aiCoachNotes || "",
                aiMagicPenSuggestions: block.aiMagicPenSuggestions || [],
                settings: finalSettings,
                exercises: (block.exercises || []).map((ex, exIndex): Exercise => ({
                    id: `ex-${exIndex}-${new Date().getTime()}`,
                    name: ex.name || "Namnlös övning",
                    reps: ex.reps || '',
                    description: ex.description,
                    imageUrl: ex.imageUrl || '',
                    isFromAI: true,
                })),
            };
        }),
    };

    return newWorkout;
};

async function _callGeminiWithSchema(prompt: string): Promise<Workout> {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let delay = 1000; // start with 1 second

  while (attempt < MAX_RETRIES) {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }
        
        const parsedData = JSON.parse(jsonStr);
        return validateAndTransformWorkoutData(parsedData);

    } catch (error) {
        attempt++;
        console.error(`Error processing workout on attempt ${attempt}:`, error);
        const isRateLimitError = error instanceof Error && error.message.includes("429");

        if (isRateLimitError && attempt < MAX_RETRIES) {
            console.log(`Rate limit hit. Retrying in ${delay / 1000}s...`);
            await new Promise(res => setTimeout(res, delay));
            delay *= 2; // Exponential backoff
        } else {
            if (isRateLimitError) {
                throw new Error("Användningsgränsen har uppnåtts. Försök igen om en stund.");
            }
            if (error instanceof Error) {
                throw error;
            }
            throw new Error("Kunde inte tolka AI:ns svar. Den genererade planen kan vara ogiltig.");
        }
    }
  }
  throw new Error("Misslyckades med att behandla passet efter flera försök.");
}

const exerciseSuggestionsSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      required: ['name', 'description', 'tags'],
      properties: {
        name: { type: Type.STRING, description: "The name of the exercise in Swedish." },
        description: { type: Type.STRING, description: "A concise description of how to perform the exercise, in Swedish." },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "A list of relevant, lowercase tags in Swedish (e.g., 'bröst', 'hantlar', 'styrka')."
        }
      }
    }
  };
  
export async function generateExerciseSuggestions(userPrompt: string): Promise<Partial<BankExercise>[]> {
    const existingBank = await getExerciseBank();
    const existingExerciseNames = existingBank.map(ex => ex.name).join(', ');

    const exclusionPrompt = `
        **CRITICAL EXCLUSION RULE:** You MUST NOT suggest any of the following exercises because they already exist in the database: ${existingExerciseNames}. Be creative and suggest different exercises or unique variations.
    `;
    
    const fullPrompt = `
        You are an expert fitness coach and exercise physiologist. Your task is to generate a list of exercise suggestions based on a user's request. The output must be a valid JSON array of objects matching the provided schema. All text, including exercise names, descriptions, and tags, must be in Swedish.

        **Rules:**
        1.  Generate between 5 and 10 relevant exercises based on the user's prompt.
        2.  **Name:** Provide a clear, concise, and common Swedish name for the exercise.
        3.  **Description:** Write a helpful but brief description of the exercise's execution. Focus on the key movements.
        4.  **Tags:** Provide a list of relevant, lowercase tags. Include muscle groups, equipment used, and exercise type (e.g., 'styrka', 'kondition', 'explosivt').
        ${exclusionPrompt}

        **User's request: "${userPrompt}"**

        Now, generate the list of exercise suggestions.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: exerciseSuggestionsSchema,
            },
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }
        
        const parsedData = JSON.parse(jsonStr);

        // --- Zod Validation ---
        const validationResult = ExerciseSuggestionsResponseSchema.safeParse(parsedData);
        if (!validationResult.success) {
            console.error("Zod validation failed for exercise suggestions:", validationResult.error.flatten());
            throw new Error(`Kunde inte tolka AI:ns svar. Ogiltig struktur: ${validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
        }
        
        return validationResult.data;

    } catch (error) {
        console.error("Error generating exercise suggestions:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Kunde inte tolka AI:ns svar. Försök med en annan prompt.");
    }
}


export async function generateWorkout(
    userPrompt: string,
    allWorkouts?: Workout[],
    selectedCategory?: CustomCategoryWithPrompt | null
): Promise<Workout> {
    let recentWorkoutContext = '';
    if (selectedCategory && allWorkouts && allWorkouts.length > 0) {
        const latestWorkout = allWorkouts
            .filter(w => w.category === selectedCategory.name && w.createdAt)
            .sort((a, b) => b.createdAt! - a.createdAt!)[0];

        if (latestWorkout) {
            const purpose = latestWorkout.title || latestWorkout.coachTips;
            if (purpose) {
                recentWorkoutContext = `Det senaste ${selectedCategory.name}-passet fokuserade på ${purpose}.`;
            }
        }
    }

    const fullPrompt = `
        You are an expert AI group training coach for Flexibel Hälsostudio in Sweden. 
        Your task is to create a well-structured workout session and provide supportive coaching feedback to help the trainer refine it.
        The output must be a valid JSON object matching the provided schema.
        All text must be in Swedish, with a professional but coaching tone.
        
        ${recentWorkoutContext ? `${recentWorkoutContext}\n\n` : ''}
        **Workout Generation Rules:**
        1.  **Structure:** Create a workout with a title, a short description (coachTips), and 1-3 main training blocks. Do NOT create "Uppvärmning" or "Nedvarvning" blocks unless specifically asked.
        2.  **Block Tagging:** Each block MUST have a 'tag' from the allowed enum (e.g., "Styrka", "Kondition").
        3.  **Timer Settings:** Every block needs complete timer settings. For interval/tabata, 'rounds' is the TOTAL number of work intervals (e.g., 4 exercises * 3 laps = 12 rounds). For strength blocks without a specific time, apply a suitable Time Cap (e.g., 10-15 minutes).
        4.  **Exercise Details:** Each exercise MUST have a name and a concise 'description' explaining the key movements.
        5.  **'followMe' Mode:** Default this to 'false'. Only set it to 'true' for synchronized workouts like "I-GO-YOU-GO".

        **AI Coach Feedback Rules (VERY IMPORTANT):**
        After designing the workout, you MUST provide feedback in the specified JSON fields. Your goal is not to criticize, but to support with clear improvement suggestions.
        1.  **aiCoachNotes (per block):** For EACH block, provide 1-2 sentences of concrete, training-physiologically relevant feedback. Examples: "The heavy strength part can be supplemented with more dynamic movements to reduce lower back strain." or "Good intensity, but consider active rest between partner exercises for better pacing."
        2.  **aiMagicPenSuggestions (per block):** For EACH block, list 2-3 concrete micro-actions for direct adjustments to that specific block. Examples: "Swap deadlifts for kettlebell swings", "Make this block a partner AMRAP challenge".
        3.  **aiCoachSummary (overall):** Summarize the workout's profile and give a maximum of three overall improvement suggestions about balance, variation, or recovery. Write pedagogically and briefly.

        **User request: "${userPrompt}"**
        
        Now, generate the complete workout plan with integrated AI Coach Feedback.
    `;
    return _callGeminiWithSchema(fullPrompt);
}

export async function parseWorkoutFromText(pastedText: string): Promise<Workout> {
    const fullPrompt = `
        You are an expert fitness coach and data parser for Flexibel Hälsostudio in Sweden.
        Your task is to analyze the following unstructured text, which might be a full workout plan or just brief notes, and convert it into a complete, structured JSON workout object matching the provided schema.
        All text output, including exercise names, titles, and descriptions, must be in Swedish.

        **Parsing Rules & Logic:**
        1.  **Interpret Intent**: First, determine if the text is a full workout or just notes.
            - If it's notes (like exercise ideas or scaling comments), use them as inspiration to build a complete, logical workout. You will need to be creative and fill in the blanks (e.g., create blocks, choose timer settings, add more exercises if needed).
            - If it's a more complete plan, parse it directly.
        2.  **Infer Structure**: Identify or create logical blocks (e.g., a strength part and a conditioning part). Give them descriptive titles.
        3.  **Identify Timer Settings**: Look for clues like "AMRAP 15 min", "EMOM 10", "30/15", "4 rounds", "Tabata". If no timer info is given, choose a suitable default based on the block's purpose.
            - "AMRAP 15 min" -> \`{ "mode": "AMRAP", "workTime": 900, "restTime": 0, "rounds": 1 }\`
            - "EMOM 10" -> \`{ "mode": "EMOM", "workTime": 60, "restTime": 0, "rounds": 10 }\`
            - "30/15 intervals, 4 exercises, 3 varv" -> YOU MUST CALCULATE the total number of work intervals for the 'rounds' field. Example: 4 exercises * 3 varv = 12. So you set \`{ "mode": "Intervall", "workTime": 30, "restTime": 15, "rounds": 12 }\`.
            - "Tabata" -> \`{ "mode": "TABATA", "workTime": 20, "restTime": 10, "rounds": 8 }\` (Standard Tabata, 8 intervals total)
            - If the text describes a block with exercises and reps but no timing information (e.g., just '3x10 Bicep Curls'), infer that it should use a **Time Cap**. Ge det en rimlig tid, t.ex. 10-15 minuter. Använd **ALDRIG** 'Ingen Timer' om det inte uttryckligen står i texten. For 'Time Cap' mode, set \`workTime\` to the total duration, \`restTime\` to 0, and \`rounds\` to 1.
        4.  **Extract & Create Exercises**: List all exercises within their respective blocks. If the text only gives a few, add more relevant exercises to create a balanced block. Include reps or other details if provided (e.g., "10 Burpees", "400m Row"). **Crucially, every exercise MUST have a 'description'. If the source text does not provide one, you MUST generate a standard, concise instruction for that exercise.**
        5.  **Titles and Descriptions**: Create a suitable \`title\` for the overall workout. If the text gives a title, use it. Otherwise, create a descriptive one like "Pass Baserat på Anteckningar".
        6.  **Tagging and Follow Me**: Make a reasonable guess for \`tag\` (e.g., "Styrka", "Kondition"). For \`followMe\`, it MUST default to \`false\` unless the text explicitly describes a synchronized "I-GO-YOU-GO" style. For any circuit style, it MUST be \`false\`.
        7.  **Be Robust**: The goal is always to return a valid, complete workout structure. It's better to be creative and fill in missing details than to fail. If no title is given for the workout, use "Inpastat Pass".
        8.  **Do NOT use the 'Stopwatch' mode.**
        
        **User's pasted text to interpret: "${pastedText}"**

        Now, interpret the text and generate the complete workout plan in JSON format.
    `;
     return _callGeminiWithSchema(fullPrompt);
}

export async function parseWorkoutFromImage(base64Image: string): Promise<Workout> {
    const fullPrompt = `
        You are an expert fitness coach and data parser for Flexibel Hälsostudio in Sweden.
        Your task is to analyze the HANDWRITTEN TEXT in the provided image and convert it into a complete, structured JSON workout object matching the provided schema.
        All text output, including exercise names, titles, and descriptions, must be in Swedish.

        **Parsing Rules & Logic:**
        1.  **Interpret Handwriting & Intent**: First, transcribe the handwriting. Then, determine if the text is a full workout or just notes.
            - If it's notes (like exercise ideas), use them as inspiration to build a complete, logical workout. You will need to be creative and fill in the blanks (e.g., create blocks, choose timer settings, add more exercises if needed).
            - If it's a more complete plan, parse it directly.
        2.  **Infer Structure**: Identify or create logical blocks (e.g., a strength part and a conditioning part). Give them descriptive titles.
        3.  **Identify Timer Settings**: Look for clues like "AMRAP 15 min", "EMOM 10", "30/15", "4 rounds", "Tabata". If no timer info is given, choose a suitable default based on the block's purpose.
            - "AMRAP 15 min" -> \`{ "mode": "AMRAP", "workTime": 900, "restTime": 0, "rounds": 1 }\`
            - "EMOM 10" -> \`{ "mode": "EMOM", "workTime": 60, "restTime": 0, "rounds": 10 }\`
            - "30/15 intervals, 4 exercises, 3 varv" -> YOU MUST CALCULATE the total number of work intervals for the 'rounds' field. Example: 4 exercises * 3 varv = 12. So you set \`{ "mode": "Intervall", "workTime": 30, "restTime": 15, "rounds": 12 }\`.
            - "Tabata" -> \`{ "mode": "TABATA", "workTime": 20, "restTime": 10, "rounds": 8 }\` (Standard Tabata, 8 intervals total)
            - If the text describes a block with exercises and reps but no timing information (e.g., just '3x10 Bicep Curls'), infer that it should use a **Time Cap**. Ge det en rimlig tid, t.ex. 10-15 minuter. Använd **ALDRIG** 'Ingen Timer' om det inte uttryckligen står i texten. For 'Time Cap' mode, set \`workTime\` to the total duration, \`restTime\` to 0, and \`rounds\` to 1.
        4.  **Extract & Create Exercises**: List all exercises within their respective blocks. Include reps or other details if provided. **Crucially, every exercise MUST have a 'description'. If the source text does not provide one, you MUST generate a standard, concise instruction for that exercise.**
        5.  **Titles and Descriptions**: Create a suitable \`title\` for the overall workout. If the handwriting gives a title, use it. Otherwise, create one like "Pass från Anteckning".
        6.  **Tagging and Follow Me**: Make a reasonable guess for \`tag\` (e.g., "Styrka", "Kondition"). For \`followMe\`, it MUST default to \`false\` unless the text explicitly describes a synchronized "I-GO-YOU-GO" style. For any circuit style, it MUST be \`false\`.
        7.  **Be Robust**: The goal is always to return a valid, complete workout structure. It's better to be creative and fill in missing details than to fail.
        8.  **Do NOT use the 'Stopwatch' mode.**
        
        **The user's handwritten notes are in the provided image.**

        Now, interpret the image and generate the complete workout plan in JSON format.
    `;
    
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };
    const textPart = {
        text: fullPrompt,
    };

    const MAX_RETRIES = 3;
    let attempt = 0;
    let delay = 1000;

    while (attempt < MAX_RETRIES) {
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: model,
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                },
            });

            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }
            
            const parsedData = JSON.parse(jsonStr);
            return validateAndTransformWorkoutData(parsedData);

        } catch (error) {
            attempt++;
            console.error(`Error processing workout from image on attempt ${attempt}:`, error);
            const isRateLimitError = error instanceof Error && error.message.includes("429");
            if (isRateLimitError && attempt < MAX_RETRIES) {
                await new Promise(res => setTimeout(res, delay));
                delay *= 2;
            } else {
                 if (error instanceof Error) {
                    throw error;
                }
                throw new Error("Kunde inte tolka passet från bilden. Försök skriva tydligare.");
            }
        }
    }
    throw new Error("Misslyckades med att tolka passet från bilden efter flera försök.");
}

export async function generateExerciseDescription(exerciseName: string): Promise<string> {
    const prompt = `
        Skriv en kort, koncis och tydlig instruktion på svenska för hur man utför träningsövningen: "${exerciseName}". 
        Fokusera på de viktigaste punkterna för korrekt utförande.
        Svara endast med själva beskrivningstexten, utan extra formatering eller inledande fraser.

        Exempel:
        Om övningen är "Knäböj (Air Squats)", ska svaret vara: "Stå axelbrett, sänk höften under knähöjd, håll bröstet uppe."
        Om övningen är "Kettlebell Swings", ska svaret vara: "Explosiv höftfällning där en kettlebell svingas från mellan knäna upp till bröst- eller ögonhöjd."
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating exercise description:", error);
        throw new Error("Kunde inte generera en beskrivning för övningen.");
    }
}

export async function enhancePageWithAI(rawContent: string): Promise<string> {
    const prompt = `
        You are a world-class digital content designer. Your mission is to transform raw, plain text into a beautifully structured, visually engaging, and professional-looking page using Markdown. Think like you're designing a page in a high-end digital magazine or a premium app. Your goal is to create "liv i texten" (life in the text).

        **Your Markdown Toolkit & Design Philosophy:**

        *   **Visual Hierarchy is Key:**
            *   **Main Title (\`#\`):** Find the single most important topic and make it a striking \`# Main Title\`. This is the hero of the page.
            *   **Subheadings (\`##\`):** Break the content into logical, scannable sections using several \`## Subheadings\`. Invent clear, concise headings if the original text lacks them. This is crucial for breaking up walls of text.

        *   **Readability & Flow:**
            *   **Short, Airy Paragraphs:** AGGRESSIVELY break up long paragraphs. Use ample whitespace (blank lines) between them. Short, punchy paragraphs are easier to read and create a much better visual rhythm.
            *   **Bulleted Lists (\`* \`):** Convert ANY enumeration, series of steps, or group of related items into a bulleted list. This makes information instantly digestible. Be liberal with lists.
            *   **Dividers (\`---\`):** If there are distinct thematic shifts in the content, use a horizontal rule to create a clean, elegant separation. It's a powerful tool for pacing.

        *   **Emphasis & Visual Flair:**
            *   **Bold Text (\`**\`):** Use \`**bold text**\` strategically and sparingly to draw the user's eye to the most critical keywords, calls to action, or conclusions. It should pop.
            *   **Italic Text (\`_\`):** Use \`_italic text_\` for softer emphasis, for introducing new concepts, or for quotes within a paragraph.
            *   **Blockquotes (\`> \`):** Pull out an important quote, a key takeaway, a powerful statement, or a tip into a blockquote. This creates a fantastic visual break and adds authority.

        **Your Guiding Principles:**
        1.  **BE A DESIGNER, NOT A FORMATTER:** Your job is not to just add tags. You must *re-structure*, *re-organize*, and *design* the information for maximum visual impact and clarity. Add "liv" (life) to it!
        2.  **CREATE A VISUAL JOURNEY:** Guide the reader's eye down the page using your hierarchy of titles, whitespace, and visual anchors like blockquotes and lists.
        3.  **PRESERVE THE CORE MESSAGE:** All original information must be retained, but its "packaging" should be completely new and dramatically improved.

        **STRICT RULES:**
        *   Do not alter the factual meaning of the text.
        *   Your response MUST ONLY contain the finished, clean Markdown text. No explanations, no apologies, no "Here is the enhanced text:", just the raw Markdown output.

        **Raw text to transform:**
        ---
        ${rawContent}
        ---
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error enhancing page with AI:", error);
        throw new Error("Kunde inte förbättra sidan med AI. Försök igen.");
    }
}

export async function generateExerciseImage(prompt: string): Promise<string> {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        } else {
            throw new Error("AI:n returnerade ingen bild. Försök med en annan prompt.");
        }
    } catch (error) {
        console.error("Error generating exercise image with Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Bildgenerering misslyckades: ${error.message}`);
        }
        throw new Error("Ett okänt fel inträffade vid bildgenerering.");
    }
}

export async function generateCarouselImage(prompt: string): Promise<string> {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '4:3',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        } else {
            throw new Error("AI:n returnerade ingen bild. Försök med en annan prompt.");
        }
    } catch (error) {
        console.error("Error generating carousel image with Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Bildgenerering misslyckades: ${error.message}`);
        }
        throw new Error("Ett okänt fel inträffade vid bildgenerering.");
    }
}


export async function interpretHandwriting(base64Image: string): Promise<string> {
    const prompt = `Transkribera den handskrivna texten i bilden. Svara endast med den transkriberade texten. Om det finns flera rader, separera dem med en nyradstecken (\\n).`;

    try {
        const imagePart = {
            inlineData: {
                mimeType: 'image/png',
                data: base64Image,
            },
        };
        const textPart = {
            text: prompt,
        };
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });

        return response.text;
    } catch (error) {
        console.error("Error interpreting handwriting:", error);
        throw new Error("Kunde inte tolka handstilen. Försök skriva tydligare eller försök igen.");
    }
}

export async function generateHyroxWod(): Promise<Workout> {
    const hyroxPrompt = `
        You are an expert HYROX coach for Flexibel Hälsostudio in Sweden.
        Your task is to create a well-structured training workout inspired by the HYROX race format.
        The output must be a valid JSON object matching the provided schema. All text must be in Swedish.
        
        **HYROX Race Format for Context (Do NOT create the full race):**
        An official HYROX race is 8 rounds of: 1km Run + 1 Functional Workout Station.
        The 8 stations are always: 1. SkiErg, 2. Sled Push, 3. Sled Pull, 4. Burpee Broad Jumps, 5. Rowing, 6. Farmers Carry, 7. Sandbag Lunges, 8. Wall Balls.

        **Your Task: Create a TRAINING WOD, not the full race.**
        1.  **Title:** Give the workout a creative, cool-sounding title related to HYROX, like "Engine Builder" or "Grip & Grind".
        2.  **Structure:** Create a workout with 1-3 blocks.
        3.  **Content:** Each block should combine running intervals with 1-3 of the official HYROX exercises listed above.
            - Running intervals can be of varying distances (e.g., 200m, 400m, 800m).
            - The exercises should use standard HYROX distances/reps where applicable (e.g., 100m Burpee Broad Jumps, 100 Wall Balls).
        4.  **Timer Modes:** Use appropriate timer modes like AMRAP, Time Cap (for "For Time" style), or Intervall. This is for training, so it should be dynamic and challenging.
        5.  **Coach Tips:** Provide a useful tip related to strategy, pacing, or technique for the selected exercises.
        6.  **Tagging:** Always set the block tag to "Kondition".
        7.  **Follow Me:** Set \`followMe\` to \`false\` for all blocks. HYROX training is performed at an individual pace.

        Now, generate a creative and effective HYROX training workout.
    `;
    return _callGeminiWithSchema(hyroxPrompt);
}




export { getExerciseBank };