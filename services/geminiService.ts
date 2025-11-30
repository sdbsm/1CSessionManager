import { GoogleGenAI, Type } from "@google/genai";
import { Client, SystemEvent } from "../types";

const API_KEY = process.env.API_KEY || ''; 

export const analyzeSystemHealth = async (
  clients: Client[],
  events: SystemEvent[]
): Promise<string> => {
  if (!API_KEY) {
    return "API Key not configured. Please check metadata.json or environment variables.";
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Prepare context for the AI
  const clientSummary = clients.map(c => 
    `${c.name}: ${c.activeSessions}/${c.maxSessions} sessions. Databases: ${c.databases.map(d => d.name).join(', ')}`
  ).join('\n');

  const recentEvents = events.slice(0, 10).map(e => 
    `[${e.level}] ${e.timestamp}: ${e.message}`
  ).join('\n');

  const prompt = `
    You are a System Administrator Assistant for a 1C:Enterprise hosting provider.
    Analyze the current state of our clients and recent system events.
    
    Current Client Load:
    ${clientSummary}

    Recent Events:
    ${recentEvents}

    Provide a concise executive summary (max 3 sentences) and 3 actionable recommendations to improve stability or upsell license packages.
    Format as Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "Analysis failed to generate text.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to perform AI analysis at this time. Please check internet connection and API key.";
  }
};