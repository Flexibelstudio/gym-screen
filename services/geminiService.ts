
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai"; 
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

// SÄKERHET: Hämta nyckel exklusivt från process.env
const getAIClient = () => {
    const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || (import.meta as any).env.VITE_API_KEY;
    if (!apiKey) throw new Error("API-nyckel saknas.");
    return new GoogleGenAI({ apiKey });
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
                    tag: { type: Type.STRING, enum: ["Styrka", "Kondition", "Rörlighet", "Teknik", "Core/Bål", "Balans", "Uppvärmning"] },
                    setupDescription: { type: Type.STRING },
                    followMe: { type: Type.BOOLEAN },
                    aiCoachNotes: { type: Type.STRING },
                    aiMagicPenSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    settings: {
                        type: Type.OBJECT,
                        required: ['mode', 'workTime', 'restTime', 'rounds'],
                        properties: {
                            mode: { type: Type.STRING, enum: Object.values(TimerMode) },
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
                status: { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
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
};

// --- CORE HANDLERS ---

async function _callGeminiJSON<T>(modelName: string, prompt: string, schema: any, useSearch: boolean = false): Promise<T> {
    const ai = getAIClient();
    const config: any = {
        systemInstruction: Prompts.SYSTEM_COACH_CONTEXT,
        responseMimeType: "application/json",
        responseSchema: schema,
    };

    if (useSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: config,
    });
    return JSON.parse(response.text.trim()) as T;
}

const transformWorkout = (data: any, orgId: string, isDraft: boolean = false): Workout => ({
    ...data,
    id: data.id || `ai-${Date.now()}`,
    organizationId: orgId,
    createdAt: Date.now(),
    isPublished: false,
    isMemberDraft: isDraft,
    category: data.category || 'AI Genererat',
    blocks: data.blocks.map((b: any, i: number) => {
        // Logic fix: Timer Math Correction
        // If AI sets rounds to e.g. 3, but there are 7 exercises, it implies 3 LAPS.
        // For Interval mode, 'rounds' means total intervals (exercises * laps).
        const exerciseCount = b.exercises?.length || 0;
        let settings = { ...b.settings };
        
        if (settings.mode === 'Interval' && exerciseCount > 0 && settings.rounds > 0 && settings.rounds < exerciseCount) {
             // Heuristic: If rounds < exercises, assume AI meant laps.
             // Multiply laps * exercises to get correct total rounds.
             settings.rounds = settings.rounds * exerciseCount;
        }

        return {
            ...b,
            id: b.id || `block-${Date.now()}-${i}`,
            settings, // Use the corrected settings
            exercises: b.exercises.map((ex: any, j: number) => {
                let cleanReps = ex.reps || '';

                // Logic fix: Remove Time from Reps
                // If timer mode implies timed work (Interval/Tabata/EMOM), strip time strings from reps.
                if (['Interval', 'Tabata', 'EMOM'].includes(settings.mode)) {
                     // Regex to remove "40 sek", "30s", "1 min", etc.
                     cleanReps = cleanReps.replace(/(\d+)\s*(sek|sec|s|min|m)(?![a-z])/gi, '').trim();
                     // Cleanup trailing punctuation
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

// --- EXPORTED FUNCTIONS ---

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

export async function parseWorkoutFromText(text: string): Promise<Workout> {
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.TEXT_INTERPRETER_PROMPT(text), workoutSchema);
    // Tolkad text från coachen bör inte vara ett "medlemsutkast" som raderas
    return transformWorkout(data, '', false);
}

export async function parseWorkoutFromImage(base64Image: string, additionalText?: string, isDraft: boolean = false): Promise<Workout> {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: VISION_MODEL,
        contents: [
            { inlineData: { mimeType: 'image/png', data: base64Image } },
            { text: Prompts.IMAGE_INTERPRETER_PROMPT(additionalText) }
        ],
        config: {
            systemInstruction: Prompts.SYSTEM_COACH_CONTEXT,
            responseMimeType: "application/json",
            responseSchema: workoutSchema,
        }
    });
    return transformWorkout(JSON.parse(response.text.trim()), '', isDraft);
}

export async function beautifyDrawing(base64Image: string, width: number, height: number): Promise<any[]> {
    const ai = getAIClient();
    const prompt = `Analysera denna handritade whiteboard-bild. Identifiera former (rutor, cirklar), text och pilar. 
    Returnera en JSON-array med objekt. Varje objekt måste ha:
    - type: "rect", "circle", "text" eller "arrow"
    - x: X-koordinat i pixlar (bilden är ${width}x${height}). För pilar är detta startpunkten.
    - y: Y-koordinat i pixlar. För pilar är detta startpunkten.
    - width: Bredd i pixlar (används ej för pilar, sätt till 0)
    - height: Höjd i pixlar (används ej för pilar, sätt till 0)
    - endX: Endast för pilar, X-koordinat för slutpunkten (där spetsen är).
    - endY: Endast för pilar, Y-koordinat för slutpunkten (där spetsen är).
    - text: Om det är text, eller text inuti en form. Annars tom sträng. Använd \\n för radbrytningar om texten är på flera rader.
    - color: Hex-färgkod som matchar ritningens färg (t.ex. "#FFFFFF", "#FACC15", "#3B82F6", "#4ADE80", "#EF4444"). Standard är "#FFFFFF".
    
    Returnera ENDAST JSON-arrayen.`;

    const response = await ai.models.generateContent({
        model: VISION_MODEL,
        contents: [
            { inlineData: { mimeType: 'image/png', data: base64Image } },
            { text: prompt }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ["rect", "circle", "text"] },
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        text: { type: Type.STRING },
                        color: { type: Type.STRING }
                    },
                    required: ["type", "x", "y", "width", "height", "color"]
                }
            }
        }
    });

    try {
        let text = response.text?.trim() || "[]";
        if (text.startsWith("```json")) {
            text = text.replace(/^```json\n/, "").replace(/\n```$/, "");
        } else if (text.startsWith("```")) {
            text = text.replace(/^```\n/, "").replace(/\n```$/, "");
        }
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse beautified drawing:", e);
        return [];
    }
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
    
    // Vi använder gemini-3-pro-preview och aktiverar googleSearch (true)
    const data = await _callGeminiJSON<any>(PRO_MODEL, prompt, workoutSchema, true);
    return transformWorkout(data, '', false);
}

export async function generateExerciseDescription(name: string): Promise<string> {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: Prompts.EXERCISE_DESCRIPTION_PROMPT(name),
        config: { systemInstruction: Prompts.SYSTEM_COACH_CONTEXT }
    });
    return response.text.trim();
}

export async function generateExerciseSuggestions(prompt: string): Promise<Partial<BankExercise>[]> {
    return await _callGeminiJSON<any[]>(TEXT_MODEL, `Föreslå övningar för: ${prompt}`, exerciseBankSchema);
}

export async function enhancePageWithAI(content: string): Promise<string> {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: `Förbättra och strukturera följande text med markdown på svenska:\n${content}`,
    });
    return response.text.trim();
}

export async function generateImage(prompt: string): Promise<string | null> {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: IMAGE_GEN_MODEL,
            contents: `A stylized 3D render of a workout achievement icon: ${prompt}. Clean, cinematic lighting, dark background.`,
            config: { imageConfig: { aspectRatio: "1:1" } } as any
        });
        const part = response.candidates[0].content.parts.find(p => p.inlineData);
        return part ? `data:image/png;base64,${part.inlineData.data}` : null;
    } catch (e) { return null; }
}

export async function generateCarouselImage(prompt: string): Promise<string> {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: IMAGE_GEN_MODEL,
        contents: prompt,
        config: { imageConfig: { aspectRatio: "16:9" } } as any
    });
    const part = response.candidates[0].content.parts.find(p => p.inlineData);
    if (!part) throw new Error("Ingen bild genererades.");
    return `data:image/png;base64,${part.inlineData.data}`;
}

export async function interpretHandwriting(base64Image: string): Promise<string> {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: VISION_MODEL,
        contents: [
            { inlineData: { mimeType: 'image/png', data: base64Image } },
            { text: "Transkribera texten i bilden exakt till svenska. Inget snack." }
        ],
    });
    return response.text.trim();
}

// Helper to transform the array-based AI response to object-based frontend struct
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

export async function generateMemberInsights(
    logs: WorkoutLog[], 
    title: string, 
    exercises: string[]
): Promise<MemberInsightResponse> {
    const logStr = JSON.stringify(logs.slice(0, 5));
    const data = await _callGeminiJSON<any>(
        TEXT_MODEL, 
        Prompts.MEMBER_INSIGHTS_PROMPT(title, exercises, logStr), 
        fullMemberInsightSchema
    );
    
    // Transform all three scenarios
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
    const ai = getAIClient();
    const logSummary = JSON.stringify(logs.slice(0, 50).map(l => ({ date: l.date, title: l.workoutTitle, comment: l.comment })));
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: Prompts.ADMIN_ANALYTICS_CHAT_PROMPT(question, logSummary),
        config: { systemInstruction: Prompts.SYSTEM_COACH_CONTEXT }
    });
    return response.text.trim();
}

export async function generateBusinessActions(logs: WorkoutLog[]): Promise<string> {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: "Baserat på all träningsdata, ge 3 konkreta affärsåtgärder för gymmet för att öka retention och försäljning. Svara på svenska.",
        config: { systemInstruction: Prompts.SYSTEM_COACH_CONTEXT }
    });
    return response.text.trim();
}

export async function generateWorkoutDiploma(logData: any): Promise<WorkoutDiploma> {
    const stats = `Distans: ${logData.totalDistance}km, Kcal: ${logData.totalCalories}`;
    const pbText = logData.newPBs?.map((pb: any) => `${pb.exerciseName} (+${pb.diff}kg)`).join(', ') || 'Inga nya PB.';
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.DIPLOMA_GENERATOR_PROMPT(logData.workoutTitle, pbText, stats), diplomaSchema);
    return { ...data, newPBs: logData.newPBs };
}
