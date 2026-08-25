import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env["VITE_GEMINI_API_KEY"] as string | undefined;

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_PROMPT = `You are AgriInsight AI, a friendly and knowledgeable agricultural assistant embedded in the AgriInsight farm management platform.

Your expertise covers:
- Crop cultivation, fertilization, irrigation, and pest/disease management
- Soil health and improvement strategies
- Weather impact on farming and seasonal planning
- Interpreting farm yield data and identifying trends
- Sustainable and organic farming practices
- Indian agriculture context (crops like rice, wheat, sugarcane, cotton, vegetables)
- Market prices, cost optimization, and profit improvement strategies

Guidelines:
- Keep answers practical, clear, and concise
- Use bullet points for multi-step advice
- When referring to quantities (fertilizer, water), give realistic ranges
- If asked about the user's farm data specifically, acknowledge you don't have direct access but offer general guidance
- Always be encouraging and supportive to farmers

Respond in the same language the user writes in.`;

export type ChatMessage = {
    role: "user" | "model";
    text: string;
};

export async function sendChatMessage(
    history: ChatMessage[],
    userMessage: string,
): Promise<string> {
    if (!ai) {
        throw new Error(
            "Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your .env file.",
        );
    }

    try {
        // Build full conversation contents including history
        const contents = [
            ...history.map((m) => ({
                role: m.role,
                parts: [{ text: m.text }],
            })),
            {
                role: "user" as const,
                parts: [{ text: userMessage }],
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
        // Surface meaningful error messages (e.g. 400 invalid key, 404 model, 429 quota)
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
            throw err;
        }
        throw new Error("Unexpected error calling Gemini API.");
    }
}
