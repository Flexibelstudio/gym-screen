import { Type } from "@google/genai"; 
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise, SuggestedExercise, CustomCategoryWithPrompt, WorkoutLog, MemberGoals, WorkoutDiploma } from '../types';
import { getExerciseBank } from './firebaseService';
import * as Prompts from '../data/aiPrompts';

// MODELLER
const TEXT_MODEL = 'gemini-3-flash-preview'; 
const VISION_MODEL = 'gemini-3-flash-preview';
const IMAGE_GEN_MODEL = 'gemini-2.5-flash-image';
const PRO_MODEL = 'gemini-3-pro-preview';

// TYPER

export interface InsightContent {
    readiness: {
        status: 'high' | 'moderate' | 'low';
        message: string;
    };
    strategy: string;
    suggestions: Record<string, string>;
    scaling: Record<string, string>;
}

export interface MemberInsightResponse {
    good: InsightContent;
    neutral: InsightContent;
    bad: InsightContent;
}

export interface MemberProgressAnalysis {
    strengths: string;
    improvements: string;
    actions: string[];
    metrics: {
        strength: number;
        endurance: number;
        frequency: number;
    };
}

export interface ExerciseDagsformAdvice {
    suggestion: string;        // "45 kg"
    suggestedWeight: number;   // 45
    reasoning: string;         // "Baserat på din pigga dagsform..."
    history: any[];
}

// --- KLIENTER & PROXYS ---

const callGeminiProxy = async (model: string, contents: any, config?: any) => {
    const functions = getFunctions(getApp(), 'us-central1');
    const flexGeminiProxy = httpsCallable<any, any>(functions, 'flexGeminiProxy');
    const response = await flexGeminiProxy({ model, contents, config });
    return response.data;
};

// --- BILD-KOMPRESSOR ---
const compressImage = async (base64Str: string, maxDim = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str || base64Str.trim() === '') return resolve("");

        const img = new Image();

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height && width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } else {
                    reject(new Error("Kunde inte skapa canvas-kontext."));
                }
            } catch (e) {
                reject(new Error("Ett fel uppstod vid bildkomprimeringen."));
            }
        };

        img.onerror = () => {
            reject(new Error("Bilden kunde inte läsas. Prova att ladda upp i ett annat format."));
        };

        const prefix = base64Str.startsWith('data:') ? '' : 'data:image/jpeg;base64,';
        img.src = `${prefix}${base64Str}`;
    });
};

// --- SCHEMAS ---

const workoutSchema = {
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
                    tag: { type: Type.STRING }, 
                    setupDescription: { type: Type.STRING },
                    followMe: { type: Type.BOOLEAN },
                    aiCoachNotes: { type: Type.STRING },
                    aiMagicPenSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    settings: {
                        type: Type.OBJECT,
                        required: ['mode', 'workTime', 'restTime', 'rounds'],
                        properties: {
                            mode: { type: Type.STRING }, 
                            workTime: { type: Type.NUMBER },
                            restTime: { type: Type.NUMBER },
                            rounds: { type: Type.NUMBER },
                        }
                    },
                    exercises: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            required: ['name', 'reps', 'description'],
                            properties: {
                                name: { type: Type.STRING },
                                reps: { type: Type.STRING },
                                description: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    }
};

const singleInsightSchema = {
    type: Type.OBJECT,
    required: ['readiness', 'strategy', 'suggestions', 'scaling'],
    properties: {
        readiness: {
            type: Type.OBJECT,
            required: ['status', 'message'],
            properties: {
                status: { type: Type.STRING }, 
                message: { type: Type.STRING }
            }
        },
        strategy: { type: Type.STRING },
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

const fullMemberInsightSchema = {
    type: Type.OBJECT,
    required: ['good', 'neutral', 'bad'],
    properties: {
        good: singleInsightSchema,
        neutral: singleInsightSchema,
        bad: singleInsightSchema
    }
};

const progressAnalysisSchema = {
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

const exerciseBankSchema = {
    type: Type.OBJECT,
    required: ['exercises'],
    properties: {
        exercises: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                required: ['name', 'description', 'tags'],
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    }
};

// --- CORE HANDLERS ---

async function _callGeminiJSON<T>(modelName: string, prompt: string, schema: any, useSearch: boolean = false): Promise<T> {
    try {
        const config: any = {
            systemInstruction: Prompts.SYSTEM_COACH_CONTEXT,
            responseMimeType: "application/json",
            responseSchema: schema,
        };

        if (useSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const data = await callGeminiProxy(modelName, [{ role: 'user', parts: [{ text: prompt }] }], config);
        const textResponse = data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return JSON.parse(textResponse.trim()) as T;
    } catch (error) {
        console.error("AI Service Error:", error);
        throw new Error("Just nu genomgår vi ett planerat underhåll av AI-tjänsten. Vänligen försök igen om en liten stund.");
    }
}

const transformWorkout = (data: any, orgId: string, isDraft: boolean = false): Workout => ({
    ...data,
    id: data.id || `ai-${Date.now()}`,
    organizationId: orgId,
    createdAt: Date.now(),
    isPublished: false,
    isMemberDraft: isDraft,
    title: data.title || 'AI-Genererat Pass',
    category: data.category || 'AI Genererat',
    blocks: (data.blocks || []).map((b: any, i: number) => {
        const exerciseCount = b.exercises?.length || 0;
        let settings = { ...b.settings };
        
        if (settings.mode === 'Interval' && exerciseCount > 0 && settings.rounds > 0 && settings.rounds < exerciseCount) {
             settings.rounds = settings.rounds * exerciseCount;
        }

        return {
            ...b,
            id: b.id || `block-${Date.now()}-${i}`,
            settings,
            exercises: (b.exercises || []).map((ex: any, j: number) => {
                let cleanReps = ex.reps || '';

                if (['Interval', 'Tabata', 'EMOM'].includes(settings.mode)) {
                     cleanReps = cleanReps.replace(/(\d+)\s*(sek|sec|s|min|m)(?![a-z])/gi, '').trim();
                     cleanReps = cleanReps.replace(/^[,.\s]+|[,.\s]+$/g, '');
                }

                return {
                    ...ex,
                    id: ex.id || `ex-${Date.now()}-${i}-${j}`,
                    reps: cleanReps,
                    isFromAI: true
                };
            })
        };
    })
});

// --- EXPORTED FUNCTIONS (TEXT VIA PROXY) ---

export async function generateWorkout(prompt: string, availableExercises: string[] = [], contextWorkouts?: Workout[]): Promise<Workout> {
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.WORKOUT_GENERATOR_PROMPT(prompt, availableExercises), workoutSchema);
    return transformWorkout(data, '');
}

export async function remixWorkout(originalWorkout: Workout): Promise<Workout> {
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.WORKOUT_REMIX_PROMPT(JSON.stringify(originalWorkout)), workoutSchema);
    return transformWorkout(data, originalWorkout.organizationId);
}

export async function analyzeCurrentWorkout(currentWorkout: Workout): Promise<Workout> {
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.WORKOUT_ANALYSIS_PROMPT(JSON.stringify(currentWorkout)), workoutSchema);
    return transformWorkout({ ...currentWorkout, ...data }, currentWorkout.organizationId);
}

export interface AICoachChatResponse {
    replyText: string;
    updatedWorkout?: Workout;
    suggestedExercises?: { name: string; description: string }[];
}

export async function chatWithAICoach(
    currentWorkout: Workout, 
    chatHistory: { role: 'user' | 'assistant', content: string }[], 
    userMessage: string, 
    availableExercises: string[] = []
): Promise<AICoachChatResponse> {
    const aiCoachChatSchema = {
        type: Type.OBJECT,
        required: ['replyText', 'didModifyWorkout'],
        properties: {
            replyText: { type: Type.STRING },
            didModifyWorkout: { type: Type.BOOLEAN },
            updatedWorkout: workoutSchema,
            suggestedExercises: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    required: ['name', 'description'],
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING }
                    }
                }
            }
        }
    };

    const formattedHistory = chatHistory.map(msg => `${msg.role === 'user' ? 'Användare' : 'Coach'}: ${msg.content}`).join('\n');
    
    const data = await _callGeminiJSON<any>(
        TEXT_MODEL, 
        Prompts.AI_COACH_CHAT_PROMPT(JSON.stringify(currentWorkout), formattedHistory, userMessage, availableExercises), 
        aiCoachChatSchema
    );

    return {
        replyText: data.replyText,
        updatedWorkout: data.didModifyWorkout && data.updatedWorkout ? transformWorkout({ ...currentWorkout, ...data.updatedWorkout }, currentWorkout.organizationId) : undefined,
        suggestedExercises: data.suggestedExercises
    };
}

export interface NotesChatResponse {
    replyText: string;
}

export async function chatWithNotesAssistant(
    chatHistory: { role: 'user' | 'assistant', content: string }[], 
    userMessage: string
): Promise<NotesChatResponse> {
    const aiNotesChatSchema = {
        type: Type.OBJECT,
        required: ['replyText'],
        properties: {
            replyText: { type: Type.STRING }
        }
    };

    const formattedHistory = chatHistory.map(msg => `${msg.role === 'user' ? 'Användare' : 'Coach'}: ${msg.content}`).join('\n');
    const PROMPT = `Du är en kreativ och expert-coachande AI ("AI-Coachen") för ett gym. Användaren skriver i sin "Anteckningar"-sektion för att spåna idéer, skapa nya pass eller få tips.
Hjälp dem genom att ge tydliga, roliga och välstrukturerade förslag på träningspass eller övningar.

VIKTIGA REGLER KRING FORMATERING:
1. Ta ALDRIG med uppvärmning, nedvarvning eller stretch om inte användaren uttryckligen ber om det. Det gäller alltid.
2. Presentera alltid passet/upplägget som enkla raka listor utan krångel och brödtext. Exempel:
   3 varv:
   10 knäböj
   10 pushups
   ELLER
   30/15 i 10 min:
   Kb svingar
   Goblet squats
3. ANVÄND ALDRIG NÅGON Markdown (till exempel inga **fetstil** eller *kursiv*). Systemet stöder inte Markdown, använd bara helt vanlig platt text med tydliga radbrytningar. Du kan använda emojis.

Returnera ett JSON-objekt enligt schemat.

Tidigare historik:
${formattedHistory}

Användarens nya meddelande:
${userMessage}
`;
    
    const data = await _callGeminiJSON<any>(TEXT_MODEL, PROMPT, aiNotesChatSchema);
    return { replyText: data.replyText };
}

export async function parseWorkoutFromText(text: string, availableExercises: string[] = []): Promise<Workout> {
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.TEXT_INTERPRETER_PROMPT(text, availableExercises), workoutSchema);
    return transformWorkout(data, '', false);
}

export async function parseWorkoutFromYoutube(url: string): Promise<Workout> {
    const prompt = `Analysera denna YouTube-video: ${url}.
    
    DITT UPPDRAG:
    Skapa ett strukturerat träningspass baserat ENBART på innehållet i videon (titel, beskrivning, transkribering, visuellt innehåll).

    REGLER FÖR TOLKNING:
    1. **KÄLLTROHET (VIKTIGAST):** Hitta inte på övningar som inte nämns eller visas. Om videon handlar om en specifik övning (t.ex. "Teknik i Marklyft"), ska passet bli ett teknikpass för den övningen, inte en slumpmässig WOD.
    2. **KÄNDA BENCHMARKS:** Endast om videon *tydligt* namnger ett känt testpass (t.ex. "Murph", "Hyrox PFT", "Cindy"), använd den officiella standardstrukturen för det passet.
    3. **ENSTAKA ÖVNINGAR:** Om videon är en demo av en enda övning, skapa ett "Teknik & Färdighet"-pass (t.ex. EMOM 10 min med den övningen).
    4. **STRUKTUR:** Försök avgöra om det är AMRAP, EMOM, For Time eller Intervall. Om det är otydligt, skapa en logisk struktur (t.ex. 3-4 set).
    5. **TIMER:** Välj lämplig timerinställning.
    6. **FOLLOW ME:** Om videon är ett realtidspass ("Follow Along"), sätt 'followMe' till true.
    7. **TITEL:** Använd videons titel som grund.
    
    Använd Google Search för att bekräfta passets detaljer via videons metadata.`;
    
    const data = await _callGeminiJSON<any>(PRO_MODEL, prompt, workoutSchema, true);
    return transformWorkout(data, '', false);
}

export async function generateExerciseDescription(name: string): Promise<string> {
    const data = await callGeminiProxy(TEXT_MODEL, [{ role: 'user', parts: [{ text: Prompts.EXERCISE_DESCRIPTION_PROMPT(name) }] }], { systemInstruction: Prompts.SYSTEM_COACH_CONTEXT });
    return data.text.trim();
}

export async function generateExerciseSuggestions(prompt: string): Promise<Partial<BankExercise>[]> {
    const data = await _callGeminiJSON<any>(TEXT_MODEL, `Föreslå övningar för: ${prompt}. Returnera ett JSON-objekt med en array "exercises".`, exerciseBankSchema);
    return data.exercises || [];
}

export async function enhancePageWithAI(content: string): Promise<string> {
    const data = await callGeminiProxy(TEXT_MODEL, [{ role: 'user', parts: [{ text: `Förbättra och strukturera följande text med markdown på svenska:\n${content}` }] }]);
    return data.text.trim();
}

// --- VISION & IMAGE HANDLERS (Säkrad via Proxy) ---

export async function parseWorkoutFromImage(base64Image: string, additionalText?: string, isDraft: boolean = false, availableExercises: string[] = []): Promise<Workout> {
    if (!base64Image || base64Image.trim() === '') {
        if (additionalText) {
            return parseWorkoutFromText(additionalText, availableExercises);
        }
        throw new Error("Ingen bild eller text angavs.");
    }

    const compressedImage = await compressImage(base64Image);
    const cleanBase64 = compressedImage.includes(',') ? compressedImage.split(',')[1] : compressedImage;

    const strictJSONTemplate = `
    VIKTIGT: Du MÅSTE svara med ett giltigt JSON-objekt exakt enligt denna struktur. Returnera INGENTING annat än JSON. Inga förklaringar.
    {
      "title": "Passets namn",
      "coachTips": "Ett peppande tips från coachen",
      "aiCoachSummary": "Kort sammanfattning av passet",
      "blocks": [
        {
          "title": "Blockets namn (t.ex. Uppvärmning)",
          "tag": "Styrka",
          "setupDescription": "Beskrivning av upplägget",
          "followMe": false,
          "aiCoachNotes": "Noteringar till coachen",
          "aiMagicPenSuggestions": [],
          "settings": {
            "mode": "Standard",
            "workTime": 0,
            "restTime": 0,
            "rounds": 1
          },
          "exercises": [
            {
              "name": "Övningsnamn",
              "reps": "10",
              "description": "Kort beskrivning eller tekniktips"
            }
          ]
        }
      ]
    }`;

    const combinedPrompt = `${Prompts.SYSTEM_COACH_CONTEXT}\n\n${Prompts.IMAGE_INTERPRETER_PROMPT(additionalText, availableExercises)}\n\n${strictJSONTemplate}`;

    const contents = [
        {
            role: 'user',
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                { text: combinedPrompt }
            ]
        }
    ];

    const data = await callGeminiProxy(VISION_MODEL, contents);
    let textResponse = data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    try {
        let text = textResponse.trim();
        if (text.startsWith("```json")) text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
        else if (text.startsWith("```")) text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
        
        let parsedData = JSON.parse(text);
        if (!parsedData.blocks) parsedData.blocks = [];
        
        return transformWorkout(parsedData, '', isDraft);
    } catch (e) {
        console.error("Fel vid tolkning av AI-svar:", textResponse, e);
        return transformWorkout({ blocks: [] }, '', isDraft);
    }
}

// Denna rör vi INTE eftersom vi vet att den fungerar felfritt via proxyn (gav 200 OK)!
export async function beautifyDrawing(base64Image: string, width: number, height: number): Promise<any[]> {
    if (!base64Image || base64Image.trim().length === 0) {
        throw new Error("Ingen bilddata skickad.");
    }    
        
    const prompt = `Du är en avancerad bildanalysator och whiteboard-layout-tolk. Din uppgift är att identifiera ritade former, pilar och handskriven text på denna whiteboard-bild.
    
    CRITICAL TEXT GROUPING & LAYOUT RULES (VÄLDIGT VIKTIGT):
    1. GRUPPERA FLERA RADER TILL SAMMANHÄNGANDE BLOCK: Om finns flera rader av text som är skrivna under varandra (till exempel en lista med övningar såsom: "10 situps", "10 pushups", "15 squats"), ska du hålla ihop dem i ETT ENDA "text"-objekt! Dela inte upp varje rad i en egen ruta. Returnera dem i en och samma textruta med radbrytningar ("\n") mellan raderna. Hela träningsblocket ska kunna flyttas och hanteras som en enhet.
    2. DELA ALDRIG UPP ORD PÅ SAMMA RAD: Ord som hör till samma mening/övning (t.ex. "5x5 Backsquats", "10 Kettlebell Swings" eller "AMRAP 12 min") ska absolut ALLTID returneras som ETT ENDA "text"-objekt (aldrig ett objekt för "10" och ett för "situps").
    3. INRAMADE BLOCK: Om användaren har ritat en rektangel/ruta runt flera rader av text, ska all text inuti den rutan grupperas ihop till ett och samma "text"-objekt (med radbrytningar) inuti den rutan eller så representerar du den som en "rect" med "text"-egenskapen satt till hela det flerradiga blocket.
    4. SÄRSTRILDA SPALTER/KOLUMNER: Endast om textblock är helt åtskilda horisontellt (t.ex. i helt olika kolumner eller i olika ändar av tavlan) ska de delas upp i olika "text"-objekt.

    OBJEKTTYPER:
    - type: "rect" (rektanglar/rutor), "circle" (cirklar), "text" (för all handskriven text) eller "arrow" (pilar)
    - x: X-koordinat i pixlar (bilden är ${width}x${height}). För pilar är detta startpunkten.
    - y: Y-koordinat i pixlar. För pilar är detta startpunkten.
    - width: Bredd på objektets bounding box i pixlar (0 för pilar).
    - height: Höjd på objektets bounding box i pixlar (0 för pilar).
    - endX: Endast för pilar, X-koordinat för pilens spets/slutpunkt.
    - endY: Endast för pilar, Y-koordinat för pilens spets/slutpunkt.
    - text: Textinnehåll med radbrytningar ("\n") intakta för flerradiga block av övningar. Tom sträng för rena former utan text.
    - color: Hex-färgkod som matchar ritningens färg på tavlan (default är "#FFFFFF").`;

    const compressedImage = await compressImage(base64Image);
    const cleanBase64 = compressedImage.includes(',') ? compressedImage.split(',')[1] : compressedImage;

    const contents = [
        {
            role: 'user',
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                { text: prompt }
            ]
        }
    ];

    const config = {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            required: ["shapes"],
            properties: {
                shapes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                            width: { type: Type.NUMBER },
                            height: { type: Type.NUMBER },
                            endX: { type: Type.NUMBER },
                            endY: { type: Type.NUMBER },
                            text: { type: Type.STRING },
                            color: { type: Type.STRING }
                        },
                        required: ["type", "x", "y", "width", "height", "color"]
                    }
                }
            }
        }
    };

    const data = await callGeminiProxy(VISION_MODEL, contents, config);
    let textResponse = data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    try {
        let text = textResponse.trim();
        if (text.startsWith("```json")) text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
        else if (text.startsWith("```")) text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
        
        let parsed = JSON.parse(text);
        return parsed.shapes || [];
    } catch (e) {
        console.error("Failed to parse beautified drawing:", e);
        return [];
    }
}

export async function generateImage(prompt: string): Promise<string | null> {
    try {
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `A stylized 3D render of a workout achievement icon: ${prompt}. Clean, cinematic lighting, dark background.` }] 
        }];
        const config = { imageConfig: { aspectRatio: "1:1" } };

        const data = await callGeminiProxy(IMAGE_GEN_MODEL, contents, config);
        const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        return part ? `data:image/png;base64,${part.inlineData.data}` : null;
    } catch (e) { return null; }
}

export async function generateCarouselImage(prompt: string): Promise<string> {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const config = { imageConfig: { aspectRatio: "16:9" } };

    const data = await callGeminiProxy(IMAGE_GEN_MODEL, contents, config);
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!part) throw new Error("Ingen bild genererades.");
    return `data:image/png;base64,${part.inlineData.data}`;
}

export async function interpretHandwriting(base64Image: string): Promise<string> {
    if (!base64Image || base64Image.trim() === '') return "";
    
    const compressedImage = await compressImage(base64Image);
    const cleanBase64 = compressedImage.includes(',') ? compressedImage.split(',')[1] : compressedImage;
    const contents = [
        {
            role: 'user',
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                { text: "Transkribera texten i bilden exakt till svenska. Inget snack." }
            ]
        }
    ];

    const data = await callGeminiProxy(VISION_MODEL, contents);
    return (data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

// --- INSIGHT & DATA HANDLERS ---

const transformInsightContent = (data: any): InsightContent => {
    const suggestions: Record<string, string> = {};
    if (Array.isArray(data.suggestions)) {
        data.suggestions.forEach((s: any) => suggestions[s.exerciseName] = s.advice);
    }
    const scaling: Record<string, string> = {};
    if (Array.isArray(data.scaling)) {
        data.scaling.forEach((s: any) => scaling[s.exerciseName] = s.advice);
    }
    return { ...data, suggestions, scaling };
}

export async function generateSingleMemberInsight(
    logs: WorkoutLog[], 
    title: string, 
    exercises: string[],
    feeling: 'good' | 'neutral' | 'bad',
    aiProgressionPrompt?: string,
    specificHistory?: Record<string, { weight: number, reps: string }>
): Promise<InsightContent> {
    const logStr = JSON.stringify(logs.slice(0, 5));
    const specificHistoryStr = specificHistory && Object.keys(specificHistory).length > 0 ? JSON.stringify(specificHistory) : undefined;
    
    const data = await _callGeminiJSON<any>(
        TEXT_MODEL, 
        Prompts.SINGLE_MEMBER_INSIGHT_PROMPT(title, exercises, logStr, feeling, specificHistoryStr, aiProgressionPrompt), 
        singleInsightSchema
    );
    
    return transformInsightContent(data);
}

export async function generateMemberInsights(
    logs: WorkoutLog[], 
    title: string, 
    exercises: string[],
    aiProgressionPrompt?: string,
    specificHistory?: Record<string, { weight: number, reps: string }>
): Promise<MemberInsightResponse> {
    const logStr = JSON.stringify(logs.slice(0, 5));
    const specificHistoryStr = specificHistory && Object.keys(specificHistory).length > 0 ? JSON.stringify(specificHistory) : undefined;
    const data = await _callGeminiJSON<any>(
        TEXT_MODEL, 
        Prompts.MEMBER_INSIGHTS_PROMPT(title, exercises, logStr, specificHistoryStr, aiProgressionPrompt), 
        fullMemberInsightSchema
    );
    
    return {
        good: transformInsightContent(data.good),
        neutral: transformInsightContent(data.neutral),
        bad: transformInsightContent(data.bad)
    };
}

export async function getExerciseDagsformAdvice(exerciseName: string, feeling: string, logs: WorkoutLog[]): Promise<ExerciseDagsformAdvice> {
    const history = logs.flatMap(log => 
        (log.exerciseResults || [])
            .filter(ex => ex.exerciseName.toLowerCase().includes(exerciseName.toLowerCase()))
            .map(ex => ({ date: new Date(log.date).toLocaleDateString('sv-SE'), weight: ex.weight, reps: ex.reps }))
    ).slice(0, 5);

    const schema = {
        type: Type.OBJECT,
        required: ['suggestion', 'suggestedWeight', 'reasoning'],
        properties: { 
            suggestion: { type: Type.STRING, description: "Textrepresentation, t.ex '45 kg'" }, 
            suggestedWeight: { type: Type.NUMBER, description: "Den numeriska vikten att fylla i" },
            reasoning: { type: Type.STRING, description: "Varför föreslås denna vikt? Basera på dagsform och historik." } 
        }
    };

    const data = await _callGeminiJSON<any>(TEXT_MODEL, `Ge dagsform-råd för ${exerciseName}. Känsla: ${feeling}. Historik: ${JSON.stringify(history)}. VIKTIGT: Returnera en numerisk suggestedWeight som är rimlig för progression.`, schema);
    return { ...data, history };
}

export async function analyzeMemberProgress(logs: WorkoutLog[], name: string, goals?: MemberGoals): Promise<MemberProgressAnalysis> {
    const logStr = JSON.stringify(logs.slice(0, 15));
    const goalStr = goals?.hasSpecificGoals ? goals.selectedGoals.join(', ') : 'Inga satta mål.';
    return await _callGeminiJSON(TEXT_MODEL, Prompts.MEMBER_PROGRESS_PROMPT(name, goalStr, logStr), progressAnalysisSchema);
}

export async function askAdminAnalytics(question: string, logs: WorkoutLog[]): Promise<string> {
    const logSummary = JSON.stringify(logs.slice(0, 50).map(l => ({ date: l.date, title: l.workoutTitle, comment: l.comment })));
    const data = await callGeminiProxy(TEXT_MODEL, [{ role: 'user', parts: [{ text: Prompts.ADMIN_ANALYTICS_CHAT_PROMPT(question, logSummary) }] }], { systemInstruction: Prompts.SYSTEM_COACH_CONTEXT });
    return (data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

export async function generateBusinessActions(logs: WorkoutLog[]): Promise<string> {
    const data = await callGeminiProxy(TEXT_MODEL, [{ role: 'user', parts: [{ text: "Baserat på all träningsdata, ge 3 konkreta affärsåtgärder för gymmet för att öka retention och försäljning. Svara på svenska." }] }], { systemInstruction: Prompts.SYSTEM_COACH_CONTEXT });
    return (data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

export async function generateWorkoutDiploma(logData: any): Promise<WorkoutDiploma> {
    let stats = `Distans: ${logData.totalDistance || 0}km, Kcal: ${logData.totalCalories || 0}`;
    if (logData.benchmarkValue !== undefined) {
        stats += `, Benchmark-resultat: ${logData.benchmarkValue}`;
    }
    const pbText = logData.newPBs?.map((pb: any) => `${pb.exerciseName} (+${pb.diff}kg)`).join(', ') || 'Inga nya PB.';
    
    let exerciseSummary = "Inga specifika övningar hittades.";
    if (logData.exerciseResults && logData.exerciseResults.length > 0) {
        exerciseSummary = logData.exerciseResults.map((ex: any) => {
            let details = [];
            if (ex.sets) details.push(`${ex.sets} set`);
            if (ex.reps) details.push(`${ex.reps} reps`);
            if (ex.weight) details.push(`${ex.weight}kg`);
            if (ex.distance) details.push(`${ex.distance}m`);
            if (ex.time) {
                const m = Math.floor(ex.time / 60);
                const s = ex.time % 60;
                details.push(m > 0 ? `${m}m ${s}s` : `${s}s`);
            }
            return `${ex.exerciseName}: ${details.join(', ')}`;
        }).join(" | ");
    } else if (logData.comment) {
        exerciseSummary = `Användarkommentar: ${logData.comment}`;
    }

    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.DIPLOMA_GENERATOR_PROMPT(logData.workoutTitle, pbText, stats, exerciseSummary, logData.aiProgressionPrompt), diplomaSchema);
    return { ...data, newPBs: logData.newPBs };
}