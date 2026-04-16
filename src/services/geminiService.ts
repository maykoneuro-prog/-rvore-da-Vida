import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: any = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateDevotional(churchName: string, theme?: string) {
  const prompt = `Gere um devocional cristão para a igreja "${churchName}". 
  ${theme ? `O tema deve ser: ${theme}.` : 'O tema deve ser encorajamento e crescimento espiritual.'}
  Siga rigorosamente esta estrutura:
  1. Texto bíblico (Referência e texto)
  2. Quebra-gelo (Uma pergunta ou dinâmica simples)
  3. Introdução
  4. Desenvolvimento
  5. Perguntas de reflexão (Mínimo 3)
  6. Conclusão
  7. Oração final
  8. Aplicação prática
  Responda em Português do Brasil.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            verse: { type: Type.STRING },
            icebreaker: { type: Type.STRING },
            introduction: { type: Type.STRING },
            development: { type: Type.STRING },
            reflectionQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            conclusion: { type: Type.STRING },
            prayer: { type: Type.STRING },
            application: { type: Type.STRING }
          },
          required: ["title", "verse", "icebreaker", "introduction", "development", "reflectionQuestions", "conclusion", "prayer", "application"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Erro ao gerar devocional:", error);
    return null;
  }
}
