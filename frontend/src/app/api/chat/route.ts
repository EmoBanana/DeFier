import { NextRequest } from "next/server";
import {
  initializeMcpClients,
  getGeminiCompatibleTools,
  mcpToolToGeminiFunctionDeclaration,
  callMcpTool,
} from "../../../../lib/mcpClient";
import { selectRelevantTools } from "../../../../lib/toolSelector";
import { BLOCKCHAIN_SYSTEM_PROMPT } from "../../../../lib/systemPrompt";

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Minimal formatter: leave text unchanged so single backticks like `Hello`
 * are kept intact. The UI component renders inline and block code safely.
 */
function formatGeminiResponse(text: string): string {
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), { status: 500 });
    }

    // Decide if this is an actionable request (run Avail, no MCP tools needed)
    const history = Array.isArray(messages) ? messages : [];
    const lastUserMessage = messages
      .filter((m: any) => m.role === "user")
      .pop()?.content || "";
    const isAction = /\b(send|transfer|bridge|swap)\b/i.test(String(lastUserMessage));

    // Initialize MCP tools only for non-action queries
    let allTools: any[] = [];
    if (!isAction) {
      await initializeMcpClients();
      allTools = getGeminiCompatibleTools();
      console.log(`ℹ️ Gemini-compatible MCP tools: ${allTools.length}`);
    } else {
      console.log("ℹ️ Action intent detected; skipping MCP tool initialization");
    }

    // Build Gemini "contents" from chat history with system prompt
    
    // Prepend system prompt as first user message
    const contents = [
      {
        role: "user",
        parts: [{ text: BLOCKCHAIN_SYSTEM_PROMPT }],
      },
      {
        role: "model",
        parts: [{ text: "Understood. I will use the available blockchain and cryptocurrency tools to answer your questions accurately. I'll infer chain IDs from context (defaulting to Ethereum chain_id='1' when not specified) and provide clear, data-driven responses." }],
      },
      ...history.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content ?? "") }],
      })),
    ];

    // lastUserMessage computed above

    // Smart tool selection based on user prompt
    const relevantTools = isAction ? [] : selectRelevantTools(allTools, lastUserMessage);

    // Convert selected tools to Gemini function declarations
    const tools = relevantTools.length > 0 ? [{
      functionDeclarations: relevantTools.map(mcpToolToGeminiFunctionDeclaration),
    }] : undefined;

    let body: any = { contents };
    if (tools && !isAction) {
      body.tools = tools;
    }

    // Initial call to Gemini with function calling enabled
    console.log("🤖 Calling Gemini with", isAction ? 0 : relevantTools.length, "relevant MCP tools");
    
    // Log tool names for debugging
    if (!isAction && relevantTools.length > 0) {
      const toolNames = relevantTools.map(t => t.name).join(", ");
      console.log("📋 Tools being sent:", toolNames);
    }

    let res = await fetch(`${API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("❌ Gemini API error:", res.status, t);
      
      // If 400 error with tools, try without tools as fallback
      if (res.status === 400 && tools) {
        console.log("⚠️ Retrying without MCP tools...");
        body = { contents };
        res = await fetch(`${API_URL}?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        
        if (!res.ok) {
          const t2 = await res.text();
          console.error("❌ Retry also failed:", t2);
          return new Response(
            JSON.stringify({ 
              reply: "I'm having trouble processing your request right now. Please try:\n\n• Asking a simpler question\n• Being more specific about what you need\n• Trying again in a moment\n\n**Examples of questions I can help with:**\n- `What's the price of Bitcoin?`\n- `Show me the latest Ethereum block`\n- `Get info for address 0x...`"
            }), 
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      } else if (res.status === 400) {
        // 400 error without tools - likely a malformed request
        return new Response(
          JSON.stringify({ 
            reply: "I couldn't process that request. Could you try rephrasing it?\n\nI work best with clear questions like:\n- `What's the price of SOL?`\n- `Show me the latest Ethereum block`\n- `Get transactions for address 0x...`"
          }), 
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Other errors (rate limits, auth, etc.)
        return new Response(
          JSON.stringify({ 
            reply: "I'm experiencing technical difficulties. Please try again in a moment."
          }), 
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    let data = await res.json();
    let candidate = data?.candidates?.[0];

    // Handle function calls from Gemini
    const maxIterations = 5; // Prevent infinite loops
    let iteration = 0;

    while (candidate?.content?.parts && iteration < maxIterations) {
      const parts = candidate.content.parts;
      
      // Check if there are function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);
      
      if (functionCalls.length === 0) {
        // No function calls, return the text response
        break;
      }

      iteration++;
      console.log(`🔄 Iteration ${iteration}: Processing ${functionCalls.length} function call(s)`);

      // Execute all function calls in parallel
      const functionResponses = await Promise.all(
        functionCalls.map(async (part: any) => {
          const funcCall = part.functionCall;
          const toolName = funcCall.name;
          const args = funcCall.args || {};

          try {
            const result = await callMcpTool(toolName, args);
            
            // Return function response in Gemini format
            return {
              functionResponse: {
                name: toolName,
                response: {
                  content: JSON.stringify(result),
                },
              },
            };
          } catch (err: any) {
            console.error(`❌ Error calling tool ${toolName}:`, err);
            return {
              functionResponse: {
                name: toolName,
                response: {
                  error: err?.message || "Tool execution failed",
                },
              },
            };
          }
        })
      );

      // Add function responses to conversation and call Gemini again
      contents.push({
        role: "model",
        parts: functionCalls,
      });

      contents.push({
        role: "user",
        parts: functionResponses,
      });

      body = { contents };
      if (tools) {
        body.tools = tools;
      }

      console.log("🤖 Calling Gemini with function results");
      res = await fetch(`${API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        return new Response(JSON.stringify({ error: t }), { status: res.status });
      }

      data = await res.json();
      candidate = data?.candidates?.[0];
    }

    // Extract final text response
    let text = candidate?.content?.parts?.find((p: any) => p.text)?.text ?? "";

    // Robust INTENT extraction helper
    function extractIntent(raw: string): any | null {
      if (!raw) return null;
      const src = String(raw);
      // 1) Case-insensitive INTENT label, allow optional colon, allow trailing content
      const m1 = src.match(/intent\s*:?\s*(\{[\s\S]*?\})/i);
      if (m1) {
        try { return JSON.parse(m1[1]); } catch {}
      }
      // 2) Strip fenced code blocks markers if present and re-try
      const unfenced = src.replace(/```[a-zA-Z]*\n([\s\S]*?)\n```/g, '$1');
      const m2 = unfenced.match(/intent\s*:?\s*(\{[\s\S]*?\})/i);
      if (m2) {
        try { return JSON.parse(m2[1]); } catch {}
      }
      // 3) Fallback: scan for any JSON object with required keys
      const objs = unfenced.match(/\{[\s\S]*?\}/g) || [];
      for (const o of objs.reverse()) { // prefer last
        try {
          const j = JSON.parse(o);
          if (j && typeof j === 'object' && ['action','token','amount','recipient','chain'].every(k => k in j)) {
            return j;
          }
        } catch {}
      }
      return null;
    }

    let intent: any = extractIntent(text);
    if (intent) {
      // remove visible INTENT line if present
      text = text.replace(/intent\s*:?\s*\{[\s\S]*?\}\s*/i, "").trim();
      // If user specified a source chain ("from <chain>") but the model intent omitted it, attach it
      if (typeof lastUserMessage === 'string') {
        const fromMatch = lastUserMessage.match(/\bfrom\s+([a-zA-Z0-9_-]+)\b/i);
        const onMatch = lastUserMessage.match(/\bon\s+([a-zA-Z0-9_-]+)\b/i);
        if (fromMatch) {
          const srcRaw = fromMatch[1].toLowerCase();
          const source = srcRaw === 'arb' ? 'arbitrum' : srcRaw === 'op' ? 'optimism' : srcRaw;
          if (!('source' in intent)) (intent as any).source = source;
        }
        if (onMatch) {
          const dstRaw = onMatch[1].toLowerCase();
          const chain = dstRaw === 'arb' ? 'arbitrum' : dstRaw === 'op' ? 'optimism' : dstRaw;
          (intent as any).chain = chain; // prefer explicit user-specified destination
        }
      }
    }

    // Heuristic fallback: parse last user prompt if model omitted intent
    if (!intent && typeof lastUserMessage === 'string' && lastUserMessage.trim()) {
      function normalizeChain(x: string) {
        const c = x.toLowerCase();
        if (c === 'arb' || c.includes('arbitrum')) return 'arbitrum';
        if (c === 'op' || c.includes('optimism')) return 'optimism';
        if (c.includes('base')) return 'base';
        if (c.includes('amoy') || c.includes('polygon') || c.includes('matic')) return 'polygon';
        if (c.includes('sepolia')) return 'sepolia';
        return c;
      }
      function normalizeToken(x: string) {
        const t = x.toUpperCase();
        if (t === 'SEPOLIA') return 'ETH';
        if (t === 'ETH' || t === 'WETH') return 'ETH';
        if (t === 'USDC') return 'USDC';
        if (t === 'USDT') return 'USDT';
        return t;
      }
      const msg = lastUserMessage.replace(/\s+/g, ' ').trim();
      // amount+token like "0.002eth" or "0.002 eth"
      const amtTok = msg.match(/\b(\d+(?:\.\d+)?)\s*([a-zA-Z]{2,10})\b/);
      // to 0x... or ENS after "to"
      const toMatch = msg.match(/\bto\s+([0-9a-zA-Z\.]+)\b/i);
      // on <chain>
      const onMatch = msg.match(/\bon\s+([a-zA-Z0-9_-]+)\b/i);
      // from <chain>
      const fromMatch = msg.match(/\bfrom\s+([a-zA-Z0-9_-]+)\b/i);
      if (amtTok && toMatch && onMatch) {
        const amount = amtTok[1];
        const token = normalizeToken(amtTok[2]);
        const recipient = toMatch[1];
        const chain = normalizeChain(onMatch[1]);
        const source = fromMatch ? normalizeChain(fromMatch[1]) : undefined;
        intent = { action: 'transfer', token, amount, recipient, chain, source } as any;
      }
    }
    
    // If no text response (e.g., due to errors), provide a helpful message
    if (!text || text.trim() === "") {
      return new Response(
        JSON.stringify({ 
          reply: "I apologize, but I encountered an issue processing your request.\n\nCould you please try:\n• Rephrasing your question\n• Being more specific\n• Asking something else\n\n**Example queries:**\n- `What's the latest Ethereum block?`\n- `Show me the price of Bitcoin`\n- `Get info for address 0x742d35Cc...`"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Format the response to render inline code properly
    text = formatGeminiResponse(text);
    
    return new Response(
      JSON.stringify({ reply: text, intent }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("❌ Chat API error:", e);
    return new Response(
      JSON.stringify({ 
        reply: "Oops! Something unexpected happened. Please try asking your question again. If the issue persists, try a different question or refresh the page."
      }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
