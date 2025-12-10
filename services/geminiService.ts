import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateGiftHint = async (receiverName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a short, festive, rhyming Secret Santa hint for a person named "${receiverName}". 
      It should be 2 lines long. Do not mention specific gifts, just a vague, magical holiday blessing.
      Language: Spanish.`,
      config: {
        temperature: 0.7,
      }
    });
    return response.text || "¡Que la magia de la Navidad ilumine tu regalo!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "¡Un regalo especial espera por ti!";
  }
};
