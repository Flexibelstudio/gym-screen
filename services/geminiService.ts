
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
                    description: "2-3 concrete suggestions. IMPORTANT: Frame these as 'Benefit -> Action'. Do not start with imperative verbs like 'Replace'. Instead, use 'To increase intensity, swap X for Y'.",
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
                          },
                      },
                  },
              },
          },
      },
  },
};

const validateAndTransformWorkoutData = (data: unknown, originalIds: Workout | null = null): Workout => {
    const validationResult = WorkoutSchema.safeParse(data);
    if (!validationResult.success) {
        console.error("Zod validation failed for workout schema:", validationResult.error.flatten());
        throw new Error(`Kunde inte tolka AI:ns svar. Ogiltig struktur: ${validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
    }
    const validatedData = validationResult.data;

    // Transform validated data into our Workout type, with robust fallbacks and added IDs.
    const newWorkout: Workout = {
        id: originalIds?.id || `ai-${new Date().toISOString()}`,
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

            // Try to preserve original IDs if structure matches closely
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
                exercises: (block.exercises || []).map((ex, exIndex): Exercise => {
                    const originalExercise = originalBlock?.exercises?.[exIndex];
                    return {
                        id: originalExercise?.id || `ex-${exIndex}-${new Date().getTime()}`,
                        name: ex.name || "Namnlös övning",
                        reps: ex.reps || '',
                        description: ex.description,
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
        return validateAndTransformWorkoutData(parsedData, originalWorkoutContext);

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

        **User's request: "${userPrompt.replace(/`/g, '\\`')}"**

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
    let historyContext = '';
    
    // Enhance context with last 3 workouts to better determine "style"
    if (selectedCategory && allWorkouts && allWorkouts.length > 0) {
        const recentWorkouts = allWorkouts
            .filter(w => w.category === selectedCategory.name && w.createdAt)
            .sort((a, b) => b.createdAt! - a.createdAt!)
            .slice(0, 3); // Take last 3

        if (recentWorkouts.length > 0) {
            historyContext = `\n**Senaste passhistorik för kategorin "${selectedCategory.name}":**\n`;
            recentWorkouts.forEach((w, i) => {
                const exercisesList = w.blocks.flatMap(b => b.exercises.map(e => e.name)).join(', ');
                historyContext += `- Pass ${i + 1} (${new Date(w.createdAt!).toLocaleDateString()}): "${w.title}". Fokus: ${w.coachTips || 'N/A'}. Övningar: ${exercisesList.substring(0, 100)}...\n`;
            });
            historyContext += `\n**VIKTIG INSTRUKTION:** Analysera stilen och intensiteten i dessa tidigare pass för att förstå "studions stil". Skapa ett NYTT pass som passar in i denna stil men introducera ca 10-20% variation i övningsval eller struktur för att bibehålla progression och intresse.\n`;
        }
    }

    const fullPrompt = `
        You are an expert AI group training coach for Flexibel Hälsostudio in Sweden. 
        Your task is to create a well-structured workout session and provide supportive coaching feedback to help the trainer refine it.
        The output must be a valid JSON object matching the provided schema.
        All text must be in Swedish, with a professional but coaching tone.
        
        ${historyContext}

        **Workout Generation Rules:**
        1.  **Structure:** Create a workout with a title, a short description (coachTips), and 1-3 main training blocks. Do NOT create "Uppvärmning" or "Nedvarvning" blocks unless specifically asked.
        2.  **Block Tagging:** Each block MUST have a 'tag' from the allowed enum (e.g., "Styrka", "Kondition").
        3.  **Timer Settings:** Every block needs complete timer settings. For interval/tabata, 'rounds' is the TOTAL number of work intervals (e.g., 4 exercises * 3 laps = 12 rounds). For strength blocks without a specific time, apply a suitable Time Cap (e.g., 10-15 minutes).
        4.  **Exercise Details:** Each exercise MUST have a name and a concise 'description' explaining the key movements.
        5.  **'followMe' Mode:** Default this to 'false'. Only set it to 'true' for synchronized workouts like "I-GO-YOU-GO".

        **AI Coach Feedback Rules (VERY IMPORTANT):**
        After designing the workout, you MUST provide feedback in the specified JSON fields. Your goal is not to criticize, but to support with clear improvement suggestions.
        1.  **aiCoachNotes (per block):** For EACH block, provide 1-2 sentences of concrete, training-physiologically relevant feedback. Examples: "The heavy strength part can be supplemented with more dynamic movements to reduce lower back strain." or "Good intensity, but consider active rest between partner exercises for better pacing."
        2.  **aiMagicPenSuggestions (per block):** For EACH block, list 2-3 concrete micro-actions for direct adjustments to that specific block.
            **CRITICAL STYLE RULE:** Do not use direct imperatives like "Replace X" or "Remove Y". 
            Instead, explicitly state the *benefit* or *effect* of the change first. 
            Format: "To [benefit], try [action]".
            Examples: 
            - "To increase heart rate, swap deadlifts for kettlebell swings." (NOT "Swap deadlifts...")
            - "For better shoulder stability, replace barbell press with landmine press." (NOT "Replace barbell press...")
            - "To make it more social, turn this into a partner AMRAP." (NOT "Make this a partner AMRAP...")
        3.  **aiCoachSummary (overall):** Summarize the workout's profile and give a maximum of three overall improvement suggestions about balance, variation, or recovery. Write pedagogically and briefly.

        **User request: "${userPrompt.replace(/`/g, '\\`')}"**
        
        Now, generate the complete workout plan with integrated AI Coach Feedback.
    `;
    return _callGeminiWithSchema(fullPrompt);
}

export async function analyzeCurrentWorkout(currentWorkout: Workout): Promise<Workout> {
    const currentWorkoutJson = JSON.stringify(currentWorkout).replace(/`/g, '\\`');
    const fullPrompt = `
        You are an expert mentor coach at Flexibel Hälsostudio. The user (a trainer) has modified a workout and wants your feedback on the NEW version.
        
        **Your Goal:** 
        Act as a supportive senior coach. Review the current workout structure, exercises, and settings. 
        **DO NOT CHANGE THE EXERCISES, TIMER SETTINGS, OR STRUCTURE UNLESS ABSOLUTELY NECESSARY (e.g., invalid config).**
        Your primary job is to update the feedback fields (\`aiCoachSummary\`, \`aiCoachNotes\`, \`aiMagicPenSuggestions\`) to reflect the *current* state of the workout.

        **Instructions:**
        1.  **Analyze:** Look at the flow, balance, and intensity of the workout provided below.
        2.  **Preserve:** Return the exact same workout structure (blocks, exercises, settings, etc.).
        3.  **Update Feedback:**
            *   **aiCoachSummary:** Give a fresh summary of the *current* workout. If it looks great, say so! "Ser mycket bra ut! Balanserat och tufft." Focus on what the user has achieved with their changes.
            *   **aiCoachNotes (per block):** Provide specific feedback on the block as it looks *now*.
            *   **aiMagicPenSuggestions (per block):** If the block is solid, you can leave this empty or suggest very minor "polish" tweaks.
                **CRITICAL STYLE RULE:** Use the "Benefit -> Action" format. Avoid direct commands.
                - BAD: "Replace Box Jumps with Step-ups."
                - GOOD: "To reduce impact on the knees, consider swapping Box Jumps for Step-ups."
                - GOOD: "To increase core engagement, try replacing the plank with a dynamic variant like plank drag."

        **Current Workout JSON:**
        ${currentWorkoutJson}

        Return the full, valid JSON object matching the schema, with updated feedback fields.
    `;
    return _callGeminiWithSchema(fullPrompt, currentWorkout);
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
        3.  **Identify Timer Settings & Meta-Instructions**: Look for clues about timing and structure.
            - **Explicit Overrides:** If the text contains specific timing instructions like "50 sekunder", "45s", "jobba 40s", "50 sek", you MUST use this value for \`workTime\` and set \`mode\` to 'Intervall' (unless EMOM/AMRAP is specified).
            - **Reps Override:** If the text says "inte reps", "inga reps", "time based", "kör på tid", or similar, do NOT generate rep counts for the exercises. Leave the \`reps\` field empty.
            - **Standard Modes:**
                - "AMRAP 15 min" -> \`{ "mode": "AMRAP", "workTime": 900, "restTime": 0, "rounds": 1 }\`
                - "EMOM 10" -> \`{ "mode": "EMOM", "workTime": 60, "restTime": 0, "rounds": 10 }\`
                - "Tabata" -> \`{ "mode": "TABATA", "workTime": 20, "restTime": 10, "rounds": 8 }\`
            - If no timer info is given, choose a suitable default based on the block's purpose.
        4.  **Extract & Create Exercises**: List all exercises within their respective blocks. 
            - **EXPLICIT COUNTS:** If the text specifies a quantity (e.g., "10 stations", "8 exercises"), you **MUST** generate exactly that number of exercises. If the notes only list a few (e.g., "Burpees, Squats... total 10"), fill the remaining slots with relevant, complementary exercises to reach the requested count.
            - If no number is specified, create a balanced block (usually 4-6 exercises).
            - Include reps or other details if provided (e.g., "10 Burpees", "400m Row").
            - **Crucially, every exercise MUST have a 'description'. If the source text does not provide one, you MUST generate a standard, concise instruction for that exercise.**
        5.  **Titles and Descriptions**: Create a suitable \`title\` for the overall workout. If the text gives a title, use it. Otherwise, create a descriptive one like "Pass Baserat på Anteckningar".
        6.  **Tagging and Follow Me**: Make a reasonable guess for \`tag\` (e.g., "Styrka", "Kondition"). For \`followMe\`, it MUST default to \`false\` unless the text explicitly describes a synchronized "I-GO-YOU-GO" style. For any circuit style, it MUST be \`false\`.
        7.  **Be Robust**: The goal is always to return a valid, complete workout structure. It's better to be creative and fill in missing details than to fail. If no title is given for the workout, use "Inpastat Pass".
        8.  **Do NOT use the 'Stopwatch' mode.**
        9.  **Meta-Instructions on the Board:** The user often writes instructions *about* the workout alongside the exercises.
           - **Time Rules:** If you see "50 sek", "40s job", "45 sekunder", priority overrides default settings. Set \`workTime\` to that value.
           - **Rep Rules:** If you see "Inga reps", "No reps", or "Tid istället för reps", strictly leave the \`reps\` field EMPTY for all exercises.
           - **Quantity Rules:** "10 övningar", "10 st", "12 stationer" means the block MUST contain exactly that many exercises. Generate suitable ones if they aren't all listed.
           - **Structure Rules:** If it says "En övning per station" (One exercise per station), it usually implies a Circuit (Cirkel). Ensure the block structure reflects a circuit (usually one block with \`followMe: false\`).
        
        **User's pasted text to interpret: "${pastedText.replace(/`/g, '\\`')}"**

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
        3.  **Identify Timer Settings & Meta-Instructions**: Look for clues about timing and structure in the handwriting.
            - **Explicit Overrides:** If the text contains specific timing instructions like "50 sekunder", "45s", "jobba 40s", "50 sek", you MUST use this value for \`workTime\` and set \`mode\` to 'Intervall' (unless EMOM/AMRAP is specified).
            - **Reps Override:** If the text says "inte reps", "inga reps", "time based", "kör på tid", or similar, do NOT generate rep counts for the exercises. Leave the \`reps\` field empty.
            - **Standard Modes:**
                - "AMRAP 15 min" -> \`{ "mode": "AMRAP", "workTime": 900, "restTime": 0, "rounds": 1 }\`
                - "EMOM 10" -> \`{ "mode": "EMOM", "workTime": 60, "restTime": 0, "rounds": 10 }\`
                - "Tabata" -> \`{ "mode": "TABATA", "workTime": 20, "restTime": 10, "rounds": 8 }\`
            - If no timer info is given, choose a suitable default based on the block's purpose.
        4.  **Extract & Create Exercises**: List all exercises within their respective blocks. 
            - **EXPLICIT COUNTS:** If the handwriting specifies a quantity (e.g., "10 stations", "8 exercises", "10 st"), you **MUST** generate exactly that number of exercises. If the notes only list a few (e.g., "Burpees, Squats... total 10"), fill the remaining slots with relevant, complementary exercises to reach the requested count.
            - If no number is specified, create a balanced block (usually 4-6 exercises).
            - Include reps or other details if provided.
            - **Crucially, every exercise MUST have a 'description'. If the source text does not provide one, you MUST generate a standard, concise instruction for that exercise.**
        5.  **Titles and Descriptions**: Create a suitable \`title\` for the overall workout. If the handwriting gives a title, use it. Otherwise, create one like "Pass från Anteckning".
        6.  **Tagging and Follow Me**: Make a reasonable guess for \`tag\` (e.g., "Styrka", "Kondition"). For \`followMe\`, it MUST default to \`false\` unless the text explicitly describes a synchronized "I-GO-YOU-GO" style. For any circuit style, it MUST be \`false\`.
        7.  **Be Robust**: The goal is always to return a valid, complete workout structure. It's better to be creative and fill in missing details than to fail.
        8.  **Do NOT use the 'Stopwatch' mode.**
        9.  **Meta-Instructions on the Board:** The user often writes instructions *about* the workout alongside the exercises.
           - **Time Rules:** If you see "50 sek", "40s job", "45 sekunder", priority overrides default settings. Set \`workTime\` to that value.
           - **Rep Rules:** If you see "Inga reps", "No reps", or "Tid istället för reps", strictly leave the \`reps\` field EMPTY for all exercises.
           - **Quantity Rules:** "10 övningar", "10 st", "12 stationer" means the block MUST contain exactly that many exercises. Generate suitable ones if they aren't all listed.
           - **Structure Rules:** If it says "En övning per station" (One exercise per station), it usually implies a Circuit (Cirkel). Ensure the block structure reflects a circuit (usually one block with \`followMe: false\`).
        
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
        ${rawContent.replace(/`/g, '\\`')}
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
