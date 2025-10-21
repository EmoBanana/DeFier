import { NexusSDK, SUPPORTED_CHAINS } from "@avail-project/nexus-core";
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

function mapChainToTestnetId(chain: string): number {
  const c = String(chain).toLowerCase();
  // Map both mainnet names and explicit testnet names to testnet IDs
  if (c.includes("sepolia") || c === "ethereum" || c === "mainnet" || c === "eth") return SUPPORTED_CHAINS.SEPOLIA;
  if (c.includes("base")) return SUPPORTED_CHAINS.BASE_SEPOLIA;
  if (c.includes("arbitrum")) return SUPPORTED_CHAINS.ARBITRUM_SEPOLIA;
  if (c.includes("optimism")) return SUPPORTED_CHAINS.OPTIMISM_SEPOLIA;
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


