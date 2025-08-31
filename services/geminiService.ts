




import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, EquipmentItem } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const model = 'gemini-2.5-flash';

const schema = {
  type: Type.OBJECT,
  required: ['title', 'coachTips', 'blocks'],
  properties: {
      title: { type: Type.STRING },
      coachTips: { type: Type.STRING },
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
                          required: ['name'],
                          properties: {
                              name: { type: Type.STRING, description: "The name of the exercise, e.g., 'Kettlebell Swings'." },
                              reps: { type: Type.STRING, description: "Optional. Reps, distance, or calories, e.g., '10', '20 kcal', '400m'." },
                              description: { type: Type.STRING, description: "Optional. Short extra detail about the exercise execution."},
                              imageUrl: { type: Type.STRING, description: "Optional. A publicly accessible URL to an image illustrating the exercise."}
                          },
                      },
                  },
              },
          },
      },
  },
};

const buildEquipmentPromptSection = (equipmentInventory?: EquipmentItem[]): string => {
    if (!equipmentInventory || equipmentInventory.length === 0) {
        return '';
    }
    const equipmentList = equipmentInventory.map(item => `- ${item.name} (Antal: ${item.quantity})`).join('\n');
    return `
**TILLGÄNGLIG UTRUSTNING & BEGRÄNSNINGAR:**
Du får ENDAST använda utrustning från listan nedan. Respektera angivet antal.
Om ett redskap bara har "Antal: 1", skapa INTE övningar där flera deltagare behöver använda det samtidigt (t.ex. en AMRAP i par där båda ror). Designa istället passet så att deltagarna turas om, eller använd övningen i ett format (t.ex. en station i en cirkel) där endast en person använder den åt gången.
${equipmentList}
`;
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

        // Validate and transform data into our Workout type, with robust fallbacks.
        const newWorkout: Workout = {
            id: `ai-${new Date().toISOString()}`,
            title: parsedData.title || "AI-genererat Pass",
            coachTips: parsedData.coachTips || "",
            blocks: (Array.isArray(parsedData.blocks) ? parsedData.blocks : []).map((block: any, index: number): WorkoutBlock => {
                const tag = block.tag || 'Allmänt';
                
                // Sanitize and complete timer settings to prevent runtime errors
                const settings: Partial<TimerSettings> = block.settings || {};
                const mode = settings.mode || TimerMode.AMRAP;
                
                let { workTime, restTime, rounds } = settings;

                switch (mode) {
                    case TimerMode.AMRAP:
                    case TimerMode.TimeCap:
                        workTime = typeof workTime === 'number' && workTime > 0 ? workTime : 15 * 60; // Default 15 min
                        restTime = 0;
                        rounds = 1;
                        break;
                    case TimerMode.EMOM:
                        workTime = 60; // Always 60s
                        restTime = 0;
                        rounds = typeof rounds === 'number' && rounds > 0 ? rounds : 10; // Default 10 min
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
                        // Fallback for any other modes or if somehow invalid
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
                    prepareTime: 10, // Default prepare time
                };

                return {
                    id: `block-${index}-${new Date().getTime()}`,
                    title: block.title || `Block ${index + 1}`,
                    tag: tag,
                    followMe: block.followMe === true,
                    setupDescription: block.setupDescription || "",
                    settings: finalSettings,
                    exercises: (Array.isArray(block.exercises) ? block.exercises : []).map((ex: any, exIndex: number): Exercise => ({
                        id: `ex-${exIndex}-${new Date().getTime()}`,
                        name: ex.name || "Namnlös övning",
                        reps: ex.reps || '',
                        description: ex.description || '',
                        imageUrl: ex.imageUrl || '',
                    })),
                };
            }),
        };

        return newWorkout;

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
            throw new Error("Kunde inte tolka AI:ns svar. Den genererade planen kan vara ogiltig.");
        }
    }
  }
  throw new Error("Misslyckades med att behandla passet efter flera försök.");
}


export async function generateWorkout(userPrompt: string, equipmentInventory?: EquipmentItem[]): Promise<Workout> {
    const equipmentPromptSection = buildEquipmentPromptSection(equipmentInventory);
    const fullPrompt = `
        You are an expert fitness coach for Flexibel Hälsostudio in Sweden. 
        Your task is to create a well-structured workout session based on the user's request.
        The output must be a valid JSON object matching the provided schema.
        All text, including exercise names, titles, and descriptions, must be in Swedish.
        
        **Workout Structure Rules:**
        1.  **No Warm-up/Cool-down**: Do not create any blocks for "Uppvärmning" (warm-up) or "Nedvarvning" (cool-down). Only include main training segments UNLESS SPECIFICALLY ASKED to create a warm-up.
        2.  **Tagging**: Each block in the 'blocks' array MUST have a 'tag'. It must be one of: "Styrka", "Kondition", "Rörlighet", "Teknik", "Core/Bål", "Balans", "Uppvärmning".
        3.  **Exercise Details**: For each exercise, provide a 'name'. Optionally provide 'reps', 'description', and 'imageUrl'.
            - 'reps': The count, distance, or calories (e.g., "10", "20 kcal", "400m"). This is crucial for AMRAP, EMOM, and 'For Time' workouts. For time-based Interval/Tabata exercises, 'reps' can be omitted.
            - 'description': A short, optional clarification for the exercise, e.g., '(per person)' or '(tungt)'.
            - 'imageUrl': A publicly accessible URL to an image illustrating the exercise. Only use if an image adds significant value.
        4.  **Follow Me Mode**: For each block, decide if it's a "follow me" style workout.
            - Set 'followMe' to 'true' if everyone does the same exercise at the same time (e.g., I-GO-YOU-GO).
            - Set 'followMe' to 'false' if it's a circuit with multiple stations where participants work simultaneously on different exercises. An Interval block with many exercises is likely a circuit ('followMe: false').
        
        **Timer Settings (Crucial!):**
        - For EVERY block, you MUST provide a complete \`settings\` object with all required fields: \`mode\`, \`workTime\`, \`restTime\`, and \`rounds\`.
        - **Interval/Tabata**: \`workTime\` and \`restTime\` are per interval in seconds. \`rounds\` is the number of times to repeat the whole exercise list.
        - **AMRAP/Time Cap**: \`workTime\` is the total duration of the block in seconds. For these modes, \`restTime\` MUST be 0 and \`rounds\` MUST be 1.
        - **EMOM**: \`workTime\` MUST be 60 (for 60 seconds). \`rounds\` is the total number of minutes for the block. \`restTime\` MUST be 0.
        - **Styrkeblock utan specifik tid (Viktigt!)**: Om ett block är avsett för styrka med set och reps (t.ex. 5x5 Knäböj) och ingen tid anges i användarens prompt, **ska du sätta en lämplig Time Cap** (t.ex. 10-15 minuter) för blocket. Använd **ALDRIG** 'Ingen Timer'-läget om det inte uttryckligen efterfrågas. Detta säkerställer att alla block bidrar till den totala träningstiden. För 'Time Cap'-läget måste \`restTime\` vara 0 och \`rounds\` vara 1.
        - **Do NOT use the 'Stopwatch' mode.**

        ${equipmentPromptSection}
        
        **User request: "${userPrompt}"**
        
        Now, generate the workout plan.
    `;
    return _callGeminiWithSchema(fullPrompt);
}

export async function parseWorkoutFromText(pastedText: string, equipmentInventory?: EquipmentItem[]): Promise<Workout> {
    const equipmentPromptSection = buildEquipmentPromptSection(equipmentInventory);
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
            - "30/15 intervals" -> \`{ "mode": "Intervall", "workTime": 30, "restTime": 15 }\`
            - "Tabata" -> \`{ "mode": "TABATA", "workTime": 20, "restTime": 10, "rounds": 8 }\` (Standard Tabata)
            - If the text describes a block with exercises and reps but no timing information (e.g., just '3x10 Bicep Curls'), infer that it should use a **Time Cap**. Ge det en rimlig tid, t.ex. 10-15 minuter. Använd **ALDRIG** 'Ingen Timer' om det inte uttryckligen står i texten. For 'Time Cap' mode, set \`workTime\` to the total duration, \`restTime\` to 0, and \`rounds\` to 1.
        4.  **Extract & Create Exercises**: List all exercises within their respective blocks. If the text only gives a few, add more relevant exercises to create a balanced block. Include reps or other details if provided (e.g., "10 Burpees", "400m Row").
        5.  **Titles and Descriptions**: Create a suitable \`title\` for the overall workout. If the text gives a title, use it. Otherwise, create a descriptive one like "Pass Baserat på Anteckningar".
        6.  **Tagging and Follow Me**: Make a reasonable guess for \`tag\` (e.g., "Styrka", "Kondition") and \`followMe\` based on the workout style.
        7.  **Be Robust**: The goal is always to return a valid, complete workout structure. It's better to be creative and fill in missing details than to fail. If no title is given for the workout, use "Inpastat Pass".
        8.  **Do NOT use the 'Stopwatch' mode.**
        
        ${equipmentPromptSection}

        **User's pasted text to interpret: "${pastedText}"**

        Now, interpret the text and generate the complete workout plan in JSON format.
    `;
     return _callGeminiWithSchema(fullPrompt);
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