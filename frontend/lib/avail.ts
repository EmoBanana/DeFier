import { NexusSDK, SUPPORTED_CHAINS, getBlockExplorerUrl } from "@avail-project/nexus-core";
import { Address } from "viem";

type ChainKey = "ethereum" | "arbitrum" | "optimism" | "base" | "polygon";

export type ParsedIntent = {
  action: "transfer";
  token: string;
  amount: string;
  recipient: string;
  chain: string;
};

let nexus: NexusSDK | null = null;
let inited = false;

async function ensureNexus(): Promise<NexusSDK> {
  if (!nexus) {
    // eslint-disable-next-line no-console
    console.log("[avail] Creating NexusSDK instance (testnet)");
    nexus = new NexusSDK({ network: 'testnet'});
  }
  if (!inited) {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("Nexus requires a browser EVM provider (window.ethereum)");
    }
    // eslint-disable-next-line no-console
    console.log("[avail] Initializing with EVM provider");
    await nexus.initialize((window as any).ethereum);
    inited = true;
  }
  return nexus;
}

export async function getUnifiedBalance(_address: Address) {
  const client = await ensureNexus();
  // eslint-disable-next-line no-console
  console.log("[avail] Fetching unified balances");
  try {
    const balances = await client.getUnifiedBalances(true);
    return { assets: balances } as any;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[avail] getUnifiedBalances failed", e);
    return { assets: [] } as any;
  }
}

export async function bridgeFunds(params: {
  fromChain: ChainKey | string;
  toChain: ChainKey | string;
  token: string;
  amount: string;
  toAddress: Address;
}) {
  const client = await ensureNexus();
  // eslint-disable-next-line no-console
  console.log("[avail] Bridging funds", params);
  const chainId = mapChainToTestnetId(params.toChain) as (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];
  const token = normalizeToken(params.token);
  const result = await client.bridge({
    token,
    amount: params.amount,
    chainId,
  });
  return result as any;
}

export async function transferFunds(params: {
  chain: ChainKey | string;
  token: string;
  amount: string;
  toAddress: Address;
  fromAddress: Address;
}) {
  const client = await ensureNexus();
  // eslint-disable-next-line no-console
  console.log("[avail] Transferring funds", params);
  const chainId = mapChainToTestnetId(params.chain) as (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];
  const token = normalizeToken(params.token);
  // Ensure CA is initialized on the target chain before sending
  try { await (client as any).switchChain?.(chainId); } catch {}
  const res = await client.transfer({
    token,
    amount: params.amount,
    chainId,
    recipient: params.toAddress,
  });
  // eslint-disable-next-line no-console
  console.log("[avail] transfer result", res);
  return res as any;
}

// Bridge (if needed) and then execute transfer on destination using NexusSDK.bridgeAndExecute
export async function bridgeAndExecute(params: {
  token: string; // e.g. 'ETH' | 'USDC' | 'USDT' (case-insensitive; 'sepolia' treated as ETH)
  amount: string; // decimal string
  toChain: ChainKey | string; // e.g. 'sepolia', 'arbitrum'
  recipient: Address;
  source?: string; // preferred source chain hint (e.g. 'arbitrum')
}) {
  const client = await ensureNexus();
  const token = normalizeToken(params.token);
  const toChainId = mapChainToTestnetId(params.toChain) as (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];

  // 1) Fetch unified balances
  console.log("[avail] bridgeAndExecute: fetching unified balances");
  const assets: any[] = await client.getUnifiedBalances(true);

  // 2) Determine source chain
  let sourceChainId: number | undefined;
  if (params.source) {
    sourceChainId = mapChainToTestnetId(params.source);
  }
  // If no hint, try unified balances
  const tokenAsset = assets.find((a) => String(a?.symbol || '').toUpperCase() === token);
  if (tokenAsset && Array.isArray(tokenAsset.breakdown)) {
    const withBalance = tokenAsset.breakdown.find((b: any) => {
      try {
        const v = Number(b?.balanceInFiat ?? 0);
        return v > 0;
      } catch {
        return true; // fallback assume non-zero
      }
    });
    if (!sourceChainId) sourceChainId = withBalance?.chain?.id;
  }

  // Fallback: try a heuristic mapping if not found
  if (!sourceChainId) {
    console.warn("[avail] bridgeAndExecute: could not infer source chain from balances; defaulting to destination chain");
    sourceChainId = toChainId;
  }

  // 3) If source equals destination, perform direct transfer
  if (sourceChainId === toChainId) {
    console.log("[avail] bridgeAndExecute: source == destination → direct transfer");
    try { await (client as any).switchChain?.(toChainId); } catch {}
    return await client.transfer({ token, amount: params.amount, chainId: toChainId, recipient: params.recipient });
  }

  // 4) Otherwise, bridge and then execute
  console.log("[avail] bridgeAndExecute: bridging from", sourceChainId, "to", toChainId, "token", token, "amount", params.amount);
  // Switch CA to source chain so approvals/permits originate correctly
  try { await (client as any).switchChain?.(sourceChainId); } catch {}
  const result = await client.bridgeAndExecute({
    toChainId,
    token,
    amount: params.amount,
    recipient: params.recipient,
    sourceChains: [sourceChainId],
  } as any);
  console.log("[avail] bridgeAndExecute result", result);
  return result as any;
}

function mapChainToTestnetId(chain: string): number {
  const c = String(chain).toLowerCase();
  // Map both mainnet names and explicit testnet names to testnet IDs
  if (c.includes("sepolia") || c === "ethereum" || c === "mainnet" || c === "eth") return SUPPORTED_CHAINS.SEPOLIA;
  if (c.includes("base")) return SUPPORTED_CHAINS.BASE_SEPOLIA;
  if (c.includes("arbitrum") || c === "arb") return SUPPORTED_CHAINS.ARBITRUM_SEPOLIA;
  if (c.includes("optimism") || c === "op") return SUPPORTED_CHAINS.OPTIMISM_SEPOLIA;
  if (c.includes("amoy") || c.includes("polygon") || c.includes("matic")) return SUPPORTED_CHAINS.POLYGON_AMOY;
  // Default to Sepolia
  return SUPPORTED_CHAINS.SEPOLIA;
}

function normalizeToken(token: string): 'ETH' | 'USDC' | 'USDT' {
  const t = String(token).toUpperCase();
  if (t === 'USDC') return 'USDC';
  if (t === 'USDT') return 'USDT';
  // Treat everything else as native ETH (including 'ETH', 'NATIVE', chain names like 'SEPOLIA')
  return 'ETH';
}

// Public helpers for UI logic
export function toTestnetChainId(chain: string): number {
  return mapChainToTestnetId(chain);
}
export function normalizeTokenSymbol(token: string): 'ETH' | 'USDC' | 'USDT' {
  return normalizeToken(token);
}

export function getExplorerUrl(chain: string, txHash: string): string {
  try {
    const chainId = mapChainToTestnetId(chain) as (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];
    return getBlockExplorerUrl(chainId, txHash);
  } catch {
    return '';
  }
}


