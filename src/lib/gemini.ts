import { GoogleGenAI } from "@google/genai";
import { buildDatasetGroundingContext, shouldAnswerQuestion } from "./gemini-rules";

const apiKey = import.meta.env["VITE_GEMINI_API_KEY"] as string | undefined;

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_PROMPT = `You are AgriInsight AI, a strict farm-data assistant for the AgriInsight platform.

Rules:
- Answer only agriculture, crop, soil, irrigation, yield, revenue, profit, season, field, farm, and input-related questions.
- If the user asks about anything outside agriculture or farm operations, refuse politely and say you can only answer farm-data and agriculture questions.
- Use only the uploaded farm dataset as the factual basis for answers.
- Do not answer general knowledge questions that are unrelated to the farmer's uploaded records.
- If data is missing, say what is missing and suggest what the farmer can upload or compare.
- Keep answers practical, clear, and concise.
- Use bullet points when multiple steps or comparisons are needed.
- If the dataset does not support the question, say so clearly.
- Respond in the same language the user writes in.`;

export type ChatMessage = {
    role: "user" | "model";
    text: string;
};

export function createGroundedDatasetContext(datasetName?: string, totals?: unknown, byField?: unknown, byCrop?: unknown, anomalies?: unknown) {
    return buildDatasetGroundingContext({
        datasetName,
        totals: totals as any,
        byField: byField as any,
        byCrop: byCrop as any,
        anomalies: anomalies as any,
    });
}

export function canAnswerFarmQuestion(userMessage: string, datasetContext: string): boolean {
    return shouldAnswerQuestion(userMessage, datasetContext);
}

export async function sendChatMessage(
    history: ChatMessage[],
    userMessage: string,
    datasetContext?: string,
): Promise<string> {
    if (!ai) {
        throw new Error(
            "Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your .env file.",
        );
    }

    const groundedContext = datasetContext ?? buildDatasetGroundingContext();
    if (!canAnswerFarmQuestion(userMessage, groundedContext)) {
        throw new Error("I can only answer agriculture and uploaded farm-data questions in AgriInsight.");
    }

    try {
        const contents = [
            ...history.map((m) => ({
                role: m.role,
                parts: [{ text: m.text }],
            })),
            {
                role: "user" as const,
                parts: [{ text: `Farm-data context:\n${groundedContext}\n\nUser question:\n${userMessage}` }],
            },
        ];

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            config: { systemInstruction: SYSTEM_PROMPT },
            contents,
        });

        const text = response.text;
        if (!text) throw new Error("Empty response from Gemini.");
        return text;
    } catch (err: unknown) {
        if (err instanceof Error) {
            const msg = err.message;
            if (msg.includes("API_KEY_INVALID") || msg.includes("401") || msg.includes("403")) {
                throw new Error("Invalid Gemini API key. Please check VITE_GEMINI_API_KEY in your .env file.");
            }
            if (msg.includes("404")) {
                throw new Error("Gemini model not found (404). The API key may not have access to this model.");
            }
            if (msg.includes("429")) {
                throw new Error("Gemini quota exceeded. Please wait a moment and try again.");
            }
            if (msg.includes("only answer agriculture and uploaded farm-data questions")) {
                throw err;
            }
            throw err;
        }
        throw new Error("Unexpected error calling Gemini API.");
    }
}
