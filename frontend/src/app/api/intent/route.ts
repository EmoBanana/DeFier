import { NextRequest } from "next/server";
import { parseIntent } from "../../../../lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing text" }), { status: 400 });
    }
    const intent = await parseIntent(text);
    return new Response(JSON.stringify({ intent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("/api/intent error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
}


