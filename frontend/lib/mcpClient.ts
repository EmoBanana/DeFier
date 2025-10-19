// Reusable MCP HTTP clients for CoinGecko and Blockscout.
// Uses the official MCP SDK client and HTTP transport (no WebSocket).

// Import from official MCP SDK
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const COINGECKO_URL = "https://mcp.api.coingecko.com/mcp";
const BLOCKSCOUT_URL = "https://mcp.blockscout.com/mcp";

export type ToolInfo = {
  name: string;
  description?: string;
  inputSchema?: any;
};

export type MCPTool = ToolInfo & {
  client: "coingecko" | "blockscout";
};

let coingeckoClient: Client | null = null;
let blockscoutClient: Client | null = null;
let initialized: boolean = false;
let initPromise: Promise<void> | null = null;
let allMcpTools: MCPTool[] = [];

function createHttpTransport(url: string): StreamableHTTPClientTransport {
  // StreamableHTTPClientTransport accepts a URL object
  return new StreamableHTTPClientTransport(new URL(url));
}

async function connectClient(
  url: string,
  label: string,
  clientType: "coingecko" | "blockscout"
): Promise<Client | null> {
  try {
    const transport = createHttpTransport(url);
    const client = new Client(
      { name: "DeFier", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(transport);
    console.log(`✅ Connected to ${label} MCP successfully`);

    try {
      const listed: any = await (client as any).listTools({});
      const tools: ToolInfo[] = Array.isArray(listed) ? listed : listed?.tools ?? [];
      const toolNames = tools.map(t => (t as any)?.name).filter(Boolean);
      console.log(`ℹ️ Tools available on ${label}:`, toolNames);
      
      // Store all tools with their metadata
      tools.forEach(tool => {
        allMcpTools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          client: clientType,
        });
      });
    } catch (listErr) {
      console.error(`❌ Failed to list tools on ${label}:`, listErr);
    }

    return client;
  } catch (err) {
    console.error(`❌ Failed to connect to ${label} MCP`, err);
    return null;
  }
}

export async function initializeMcpClients(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    allMcpTools = []; // Reset tools array
    coingeckoClient = await connectClient(COINGECKO_URL, "CoinGecko", "coingecko");
    blockscoutClient = await connectClient(BLOCKSCOUT_URL, "Blockscout", "blockscout");
    initialized = true;
  })();

  await initPromise;
}

function ensureInitialized(client: Client | null): asserts client is Client {
  if (!client) {
    throw new Error("CoinGecko MCP client is not initialized. Call initializeMcpClients() first.");
  }
}

export async function getSolanaPriceUSD(): Promise<number> {
  try {
    if (!initialized) {
      await initializeMcpClients();
    }
    ensureInitialized(coingeckoClient);

    // Prefer get_token_prices if available, otherwise fall back to get_simple_price
    const coingeckoTools = allMcpTools.filter(t => t.client === "coingecko");
    const hasGetTokenPrices = coingeckoTools.some(t => t.name === "get_token_prices");
    const hasGetSimplePrice = coingeckoTools.some(t => t.name === "get_simple_price");

    if (hasGetTokenPrices) {
      console.log("ℹ️ Using CoinGecko tool: get_token_prices");
      const response: any = await (coingeckoClient as any).callTool({
        name: "get_token_prices",
        arguments: {
          tokens: ["solana:SOL"],
          vs_currencies: ["usd"],
        },
      });

      const price = extractSolPriceUsd(response);
      if (typeof price !== "number") {
        throw new Error("Invalid price data from get_token_prices");
      }
      const ts = tryExtractTimestamp(response);
      if (ts) {
        console.log(`💰 SOL price (USD): ${price} (ts: ${ts})`);
      } else {
        console.log(`💰 SOL price (USD): ${price}`);
      }
      return price;
    }

    if (hasGetSimplePrice) {
      console.log("ℹ️ Using CoinGecko tool: get_simple_price");
      const response: any = await (coingeckoClient as any).callTool({
        name: "get_simple_price",
        arguments: {
          ids: "solana",
          vs_currencies: "usd",
          include_24hr_change: false,
          include_last_updated_at: true,
          include_market_cap: false,
          include_24hr_vol: false,
        },
      });

      const price = extractSolPriceUsd(response);
      if (typeof price !== "number") {
        throw new Error("Invalid price data from get_simple_price");
      }
      const ts = tryExtractTimestamp(response);
      if (ts) {
        console.log(`💰 SOL price (USD): ${price} (ts: ${ts})`);
      } else {
        console.log(`💰 SOL price (USD): ${price}`);
      }
      return price;
    }

    const toolNames = coingeckoTools.map(t => t.name);
    throw new Error(
      `CoinGecko MCP does not expose a recognized price tool. Tools: ${JSON.stringify(toolNames)}`
    );
  } catch (err) {
    console.error("❌ Error fetching SOL price from CoinGecko MCP:", err);
    throw err;
  }
}

function extractSolPriceUsd(response: any): number | undefined {
  // Direct shapes
  const direct = response?.prices?.["solana:SOL"]?.usd
    ?? response?.solana?.usd
    ?? response?.data?.prices?.["solana:SOL"]?.usd
    ?? response?.data?.solana?.usd;
  if (typeof direct === "number") return direct;

  // Some SDKs wrap tool results as LLM-style content parts
  try {
    const content = response?.content ?? response?.result ?? [];
    const first = Array.isArray(content) ? content[0] : undefined;
    const text = first?.text ?? first?.value ?? first?.data ?? undefined;
    if (typeof text === "string") {
      const parsed = JSON.parse(text);
      const p = parsed?.prices?.["solana:SOL"]?.usd ?? parsed?.solana?.usd;
      if (typeof p === "number") return p;
    } else if (typeof text === "object" && text) {
      const p = text?.prices?.["solana:SOL"]?.usd ?? text?.solana?.usd;
      if (typeof p === "number") return p;
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

function tryExtractTimestamp(response: any): number | string | undefined {
  return response?.prices?.["solana:SOL"]?.last_updated_at
    ?? response?.last_updated_at
    ?? response?.data?.last_updated_at;
}

export function getBlockscoutClient(): Client | null {
  return blockscoutClient;
}

/**
 * Get all available MCP tools from both CoinGecko and Blockscout
 */
export function getAllMcpTools(): MCPTool[] {
  if (!initialized) {
    return [];
  }
  return allMcpTools;
}

/**
 * Get Gemini-compatible tools only
 */
export function getGeminiCompatibleTools(): MCPTool[] {
  return getAllMcpTools().filter(isGeminiCompatible);
}

/**
 * Validate if a tool schema is compatible with Gemini
 */
function isGeminiCompatible(tool: MCPTool): boolean {
  // Skip tools without proper schemas
  if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
    return false;
  }

  // Gemini has issues with very complex nested schemas
  const schemaString = JSON.stringify(tool.inputSchema);
  
  // Skip if schema is too large (> 2KB)
  if (schemaString.length > 2000) {
    console.log(`⚠️ Skipping ${tool.name}: schema too large (${schemaString.length} chars)`);
    return false;
  }

  // Skip tools with problematic patterns
  if (
    // Blockscout tools that are known to cause issues
    tool.name.includes("direct_api_call") ||
    tool.name.includes("unlock_blockchain_analysis") ||
    // Skip tools with overly complex nested schemas
    tool.name.includes("read_contract") // Complex ABI structures
  ) {
    console.log(`⚠️ Skipping ${tool.name}: known compatibility issue`);
    return false;
  }

  // For Blockscout tools, be more conservative
  if (tool.client === "blockscout") {
    // Check for complex schema patterns
    const hasComplexTypes = schemaString.includes("anyOf") ||
                           schemaString.includes("oneOf") ||
                           schemaString.includes("allOf");
    
    if (hasComplexTypes) {
      console.log(`⚠️ Skipping ${tool.name}: complex schema types`);
      return false;
    }
  }

  return true;
}

/**
 * Convert MCP tool to Gemini function declaration format
 */
export function mcpToolToGeminiFunctionDeclaration(tool: MCPTool): any {
  // Simplify the schema for Gemini
  let parameters = tool.inputSchema || { type: "object", properties: {} };
  
  // Ensure parameters has the right structure
  if (!parameters.type) {
    parameters = { type: "object", properties: parameters };
  }

  // Remove Gemini-incompatible fields
  const cleanedParams = JSON.parse(JSON.stringify(parameters));
  delete cleanedParams.$schema;
  delete cleanedParams.$id;
  delete cleanedParams.additionalProperties;
  
  // Simplify deeply nested schemas
  if (cleanedParams.properties) {
    Object.keys(cleanedParams.properties).forEach(key => {
      const prop = cleanedParams.properties[key];
      // Remove overly complex nested structures
      if (prop.anyOf || prop.oneOf || prop.allOf) {
        // Simplify to string type as fallback
        cleanedParams.properties[key] = { type: "string", description: prop.description };
      }
    });
  }

  return {
    name: tool.name,
    description: tool.description || `Tool from ${tool.client} MCP server`,
    parameters: cleanedParams,
  };
}

/**
 * Call any MCP tool by name with given arguments
 */
export async function callMcpTool(toolName: string, args: any): Promise<any> {
  if (!initialized) {
    await initializeMcpClients();
  }

  const tool = allMcpTools.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} not found in available MCP tools`);
  }

  const client = tool.client === "coingecko" ? coingeckoClient : blockscoutClient;
  if (!client) {
    throw new Error(`${tool.client} MCP client is not initialized`);
  }

  console.log(`🔧 Calling MCP tool: ${toolName} (${tool.client})`);
  console.log(`📥 Arguments:`, JSON.stringify(args, null, 2));

  try {
    const response: any = await (client as any).callTool({
      name: toolName,
      arguments: args,
    });

    console.log(`✅ Tool ${toolName} response received`);
    return response;
  } catch (err) {
    console.error(`❌ Error calling tool ${toolName}:`, err);
    throw err;
  }
}


