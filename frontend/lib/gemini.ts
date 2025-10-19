// Gemini integration that enriches prompts with SOL price from CoinGecko MCP

import { getSolanaPriceUSD, initializeMcpClients } from "./mcpClient";

type GenerateResponse = unknown;

async function generateWithGemini(prompt: string): Promise<GenerateResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
  const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${t}`);
  }
  return res.json();
}

export async function generateSolanaMarketAnalysis(): Promise<void> {
  try {
    await initializeMcpClients();
    const solPrice = await getSolanaPriceUSD();
    const prompt = `The current price of SOL is $${solPrice}. Please provide a short market analysis.`;
    const response = await generateWithGemini(prompt);
    console.log("💬 Gemini response:", response);
  } catch (err) {
    console.error("❌ Error generating Gemini market analysis:", err);
    throw err;
  }
}


