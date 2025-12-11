import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const softenMessage = async (text: string): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a relationship harmony assistant. 
    Rewrite the following message to be gentler, more loving, and less aggressive, 
    while preserving the core meaning. 
    If the message is already kind, return it as is. 
    Do not add explanations, just return the text.`;

    const response = await ai.models.generateContent({
      model,
      contents: text,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || text;
  } catch (error) {
    console.error("Harmony mode failed:", error);
    return text; // Fallback to original
  }
};