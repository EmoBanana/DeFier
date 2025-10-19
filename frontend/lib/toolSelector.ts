// Tool selector: intelligently filters MCP tools based on user intent

import type { MCPTool } from "./mcpClient";

/**
 * Categorize tools by their purpose
 */
export function categorizeTool(tool: MCPTool): string[] {
  const name = tool.name.toLowerCase();
  const desc = (tool.description || "").toLowerCase();
  const categories: string[] = [];

  // Price and market data
  if (
    name.includes("price") ||
    name.includes("market") ||
    name.includes("simple") ||
    name.includes("ohlc") ||
    desc.includes("price") ||
    desc.includes("market")
  ) {
    categories.push("price");
  }

  // Coin/token information
  if (
    name.includes("coin") ||
    name.includes("token") ||
    name.includes("info") ||
    desc.includes("coin") ||
    desc.includes("metadata")
  ) {
    categories.push("coin_info");
  }

  // NFT data
  if (name.includes("nft") || desc.includes("nft")) {
    categories.push("nft");
  }

  // Exchange data
  if (name.includes("exchange") || desc.includes("exchange")) {
    categories.push("exchange");
  }

  // Blockchain data (blocks, transactions)
  if (
    name.includes("block") ||
    name.includes("transaction") ||
    name.includes("tx") ||
    desc.includes("block") ||
    desc.includes("transaction")
  ) {
    categories.push("blockchain");
  }

  // Address/wallet data
  if (
    name.includes("address") ||
    name.includes("wallet") ||
    desc.includes("address") ||
    desc.includes("wallet")
  ) {
    categories.push("address");
  }

  // Contract interaction
  if (
    name.includes("contract") ||
    name.includes("abi") ||
    name.includes("read_contract") ||
    desc.includes("contract") ||
    desc.includes("smart contract")
  ) {
    categories.push("contract");
  }

  // Token transfers
  if (
    name.includes("transfer") ||
    name.includes("holder") ||
    desc.includes("transfer") ||
    desc.includes("holder")
  ) {
    categories.push("transfers");
  }

  // Trending/search
  if (
    name.includes("trend") ||
    name.includes("search") ||
    name.includes("top") ||
    desc.includes("trending") ||
    desc.includes("search")
  ) {
    categories.push("search");
  }

  // On-chain/DEX data
  if (
    name.includes("onchain") ||
    name.includes("pool") ||
    name.includes("dex") ||
    desc.includes("on-chain") ||
    desc.includes("liquidity")
  ) {
    categories.push("onchain");
  }

  return categories.length > 0 ? categories : ["other"];
}

/**
 * Extract intent from user prompt using simple keyword matching
 */
export function extractIntentFromPrompt(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const intents: Set<string> = new Set();

  // Price queries
  if (
    /price|cost|worth|value|trading at|how much/i.test(lower) ||
    /\$|usd|dollars/i.test(lower)
  ) {
    intents.add("price");
  }

  // Coin/token info
  if (
    /what is|tell me about|information about|details|describe/i.test(lower) &&
    /coin|token|crypto/i.test(lower)
  ) {
    intents.add("coin_info");
  }

  // NFT queries
  if (/nft|non-fungible|collectible|artwork/i.test(lower)) {
    intents.add("nft");
  }

  // Exchange queries
  if (/exchange|cex|dex|trading platform|binance|coinbase/i.test(lower)) {
    intents.add("exchange");
  }

  // Blockchain queries
  if (
    /block|transaction|tx|hash|confirm|pending|mined|latest|chain|mainnet|testnet/i.test(lower) ||
    /ethereum|eth|optimism|arbitrum|polygon|base|network/i.test(lower)
  ) {
    intents.add("blockchain");
  }

  // Address/wallet queries
  if (/address|wallet|balance|holdings|portfolio|0x[a-fA-F0-9]{40}/i.test(lower)) {
    intents.add("address");
  }

  // Contract queries
  if (/contract|abi|function|call|read contract|smart contract/i.test(lower)) {
    intents.add("contract");
  }

  // Transfer queries
  if (/transfer|sent|received|holder|owner|distribution/i.test(lower)) {
    intents.add("transfers");
  }

  // Trending/search queries
  if (/trend|popular|top|hot|search|find|look for/i.test(lower)) {
    intents.add("search");
  }

  // On-chain/DEX queries
  if (/pool|liquidity|swap|dex|uniswap|pancakeswap|on-chain/i.test(lower)) {
    intents.add("onchain");
  }

  // If no specific intent found, include price and coin_info as defaults
  if (intents.size === 0) {
    intents.add("price");
    intents.add("coin_info");
  }

  return Array.from(intents);
}

/**
 * Filter tools based on detected intents
 */
export function filterToolsByIntent(tools: MCPTool[], prompt: string): MCPTool[] {
  const intents = extractIntentFromPrompt(prompt);
  console.log(`🎯 Detected intents from prompt:`, intents);

  const filtered = tools.filter(tool => {
    const categories = categorizeTool(tool);
    // Include tool if any of its categories match any of the detected intents
    return categories.some(cat => intents.includes(cat));
  });

  console.log(`📊 Filtered ${tools.length} tools down to ${filtered.length} relevant tools`);
  return filtered;
}

/**
 * Get priority tools that are commonly used (always include these)
 */
export function getPriorityTools(tools: MCPTool[]): MCPTool[] {
  const priorityNames = [
    "get_simple_price",
    "get_coins_markets",
    "get_search",
    "get_id_coins",
    "get_latest_block",
    "get_address_info",
    "get_transactions_by_address",
    "get_token_transfers_by_address",
  ];

  return tools.filter(tool => priorityNames.includes(tool.name));
}

/**
 * Smart tool selection: combine priority tools with intent-based filtering
 */
export function selectRelevantTools(tools: MCPTool[], prompt: string): MCPTool[] {
  const priority = getPriorityTools(tools);
  const intentBased = filterToolsByIntent(tools, prompt);

  // Combine and deduplicate
  const combined = new Map<string, MCPTool>();
  
  priority.forEach(tool => combined.set(tool.name, tool));
  intentBased.forEach(tool => combined.set(tool.name, tool));

  const result = Array.from(combined.values());
  
  console.log(`✨ Selected ${result.length} tools for Gemini (${priority.length} priority + ${intentBased.length - priority.length} intent-based)`);
  
  return result;
}

