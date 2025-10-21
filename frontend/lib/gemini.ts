// Gemini integration that enriches prompts with SOL price from CoinGecko MCP

import { getSolanaPriceUSD, initializeMcpClients } from "./mcpClient";

type GenerateResponse = unknown;

async function generateWithGemini(prompt: string): Promise<GenerateResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
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


// --- Intent Parsing (merged from aiHandler) ---
type GeminiIntent = {
  action: "transfer";
  token: string;
  amount: string;
  recipient: string;
  chain: string;
};

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM = `You are a blockchain assistant that converts concise user requests into a strict JSON intent. Output ONLY JSON with keys: action, token, amount, recipient, chain. Examples:\n\nInput: Send 10 USDC to wenn.eth on Arb.\nOutput: {"action":"transfer","token":"USDC","amount":"10","recipient":"wenn.eth","chain":"arbitrum"}`;

export async function parseIntent(text: string): Promise<GeminiIntent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const contents = [
    { role: "user", parts: [{ text: SYSTEM }] },
    { role: "model", parts: [{ text: "OK" }] },
    { role: "user", parts: [{ text }] },
  ];

  // eslint-disable-next-line no-console
  console.log("[ai] Parsing intent with Gemini:", text);
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const txt: string = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? "";
  try {
    const parsed = JSON.parse(txt);
    // eslint-disable-next-line no-console
    console.log("[ai] Parsed intent:", parsed);
    return parsed as GeminiIntent;
  } catch {
    const match = txt.match(/\{[\s\S]*\}/);
    if (match) {
      const j = JSON.parse(match[0]);
      // eslint-disable-next-line no-console
      console.log("[ai] Parsed intent (extracted):", j);
      return j as GeminiIntent;
    }
    throw new Error("Failed to parse intent JSON");
  }
}


