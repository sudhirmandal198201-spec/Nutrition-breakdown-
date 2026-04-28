import { GoogleGenAI, Type } from "@google/genai";
import { NutritionAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const NUTRITION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    foods: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
          fiber: { type: Type.NUMBER },
          sugar: { type: Type.NUMBER },
          vitamins: { type: Type.ARRAY, items: { type: Type.STRING } },
          minerals: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["name", "quantity", "calories", "protein", "carbs", "fat"],
      },
    },
    totalCalories: { type: Type.NUMBER },
    healthScore: { type: Type.NUMBER },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["foods", "totalCalories", "healthScore", "suggestions", "warnings", "alternatives"],
};

export async function analyzeFoodByImage(base64Image: string, mimeType: string): Promise<NutritionAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: "Analyze this meal image. Identify all food items, estimate their quantities, and provide a full nutritional breakdown. Include health score (1-100), personalized suggestions, warnings (like allergens), and healthier alternative suggestions. Support regional Indian foods like dal, roti, etc.",
          },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: NUTRITION_SCHEMA,
    },
  });

  return JSON.parse(response.text) as NutritionAnalysis;
}

export async function analyzeFoodByText(text: string): Promise<NutritionAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this food entry: "${text}". Provide a full nutritional breakdown, health score, suggestions, and warnings. Support regional Indian foods.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: NUTRITION_SCHEMA,
    },
  });

  return JSON.parse(response.text) as NutritionAnalysis;
}

export async function getWeeklyReport(mealHistory: any[], userProfile: any): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this meal history: ${JSON.stringify(mealHistory)} and user profile: ${JSON.stringify(userProfile)}, provide a weekly nutrition report with insights, deficiency detections, and improvement tips. Return as Markdown.`,
  });

  return response.text;
}

export async function getDietSuggestions(userProfile: any): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide personalized diet suggestions for a user with these profile details: ${JSON.stringify(userProfile)}. Focus on their goal (${userProfile.goal}) and activity level. Include Indian food options. Return as Markdown.`,
  });

  return response.text;
}
