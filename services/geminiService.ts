
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai"; 
import { Workout, WorkoutBlock, Exercise, TimerMode, TimerSettings, BankExercise, SuggestedExercise, CustomCategoryWithPrompt, WorkoutLog, MemberGoals, WorkoutDiploma } from '../types';
import { getExerciseBank } from './firebaseService';
import * as Prompts from '../data/aiPrompts';

// MODELLER
const TEXT_MODEL = 'gemini-3-flash-preview'; 
const VISION_MODEL = 'gemini-3-flash-preview';
const IMAGE_GEN_MODEL = 'gemini-2.5-flash-image';

// TYPER
export interface MemberInsightResponse {
    readiness: {
        status: 'high' | 'moderate' | 'low';
        message: string;
    };
    strategy: string;
    suggestions: Record<string, string>;
    scaling: Record<string, string>;
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

const memberInsightSchema = {
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

async function _callGeminiJSON<T>(modelName: string, prompt: string, schema: any): Promise<T> {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
            systemInstruction: Prompts.SYSTEM_COACH_CONTEXT,
            responseMimeType: "application/json",
            responseSchema: schema,
        },
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
    blocks: data.blocks.map((b: any, i: number) => ({
        ...b,
        id: b.id || `block-${Date.now()}-${i}`,
        exercises: b.exercises.map((ex: any, j: number) => ({
            ...ex,
            id: ex.id || `ex-${Date.now()}-${i}-${j}`,
            isFromAI: true
        }))
    }))
});

// --- EXPORTED FUNCTIONS ---

export async function generateWorkout(prompt: string, contextWorkouts?: Workout[]): Promise<Workout> {
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.WORKOUT_GENERATOR_PROMPT(prompt), workoutSchema);
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

export async function parseWorkoutFromText(text: string): Promise<Workout> {
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.TEXT_INTERPRETER_PROMPT(text), workoutSchema);
    // Tolkad text från coachen bör inte vara ett "medlemsutkast" som raderas
    return transformWorkout(data, '', false);
}

export async function parseWorkoutFromImage(base64Image: string, additionalText?: string): Promise<Workout> {
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
    // Tolkad bild (från t.ex. Idétavlan) markeras som draft så den städas om den inte sparas
    return transformWorkout(JSON.parse(response.text.trim()), '', true);
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
            config: { imageConfig: { aspectRatio: "1:1" } }
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
        config: { imageConfig: { aspectRatio: "16:9" } }
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

export async function generateMemberInsights(logs: WorkoutLog[], title: string, exercises: string[]): Promise<MemberInsightResponse> {
    const logStr = JSON.stringify(logs.slice(0, 5));
    const data = await _callGeminiJSON<any>(TEXT_MODEL, Prompts.MEMBER_INSIGHTS_PROMPT(title, exercises, logStr), memberInsightSchema);
    
    // Map arrays back to objects for frontend compatibility
    const suggestions: Record<string, string> = {};
    data.suggestions.forEach((s: any) => suggestions[s.exerciseName] = s.advice);
    const scaling: Record<string, string> = {};
    data.scaling.forEach((s: any) => scaling[s.exerciseName] = s.advice);

    return { ...data, suggestions, scaling };
}

export async function getExerciseDagsformAdvice(exerciseName: string, feeling: string, logs: WorkoutLog[]): Promise<any> {
    const history = logs.flatMap(log => 
        (log.exerciseResults || [])
            .filter(ex => ex.exerciseName.toLowerCase().includes(exerciseName.toLowerCase()))
            .map(ex => ({ date: new Date(log.date).toLocaleDateString('sv-SE'), weight: ex.weight, reps: ex.reps }))
    ).slice(0, 5);

    const schema = {
        type: Type.OBJECT,
        required: ['suggestion', 'reasoning'],
        properties: { suggestion: { type: Type.STRING }, reasoning: { type: Type.STRING } }
    };

    const data = await _callGeminiJSON<any>(TEXT_MODEL, `Ge dagsform-råd för ${exerciseName}. Känsla: ${feeling}. Historik: ${JSON.stringify(history)}`, schema);
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
