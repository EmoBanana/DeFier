"use client";

import { BrowserProvider, Contract, parseUnits } from "ethers";

// Sepolia addresses provided by user
export const SPLIT_ADDRESS = "0xE896c58D65A78ca74D9473791eA6555908DF3760" as const;
export const PYUSD_ADDRESS = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9" as const;

export const splitAbi = [
  "function split(address[] to, uint256[] amt) external",
] as const;

export const erc20Abi = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

type ExecuteSplitParams = {
  recipients: `0x${string}`[];
  amounts: number[]; // human amounts (e.g., 1.5 means 1.5 PYUSD)
};

export async function executeSplit({ recipients, amounts }: ExecuteSplitParams): Promise<{ txHash: string; explorerUrl: string }>{
  if (recipients.length === 0 || recipients.length !== amounts.length) {
    throw new Error("Recipients and amounts length mismatch");
  }

  const ethereum = (typeof window !== "undefined" ? (window as any).ethereum : null);
  if (!ethereum) throw new Error("No wallet found. Please install MetaMask.");

  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  const erc20 = new Contract(PYUSD_ADDRESS, erc20Abi, signer);
  const decimals: number = Number(await erc20.decimals());

  const amountsWei = amounts.map((a) => parseUnits(a.toString(), decimals));
  const totalWei = amountsWei.reduce((acc, v) => acc + v, BigInt(0));

  // Auto-approve if allowance is insufficient
  const currentAllowance: bigint = await erc20.allowance(userAddress, SPLIT_ADDRESS);
  if (currentAllowance < totalWei) {
    const approveTx = await erc20.approve(SPLIT_ADDRESS, totalWei);
    await approveTx.wait?.();
  }

  const split = new Contract(SPLIT_ADDRESS, splitAbi, signer);
  const tx = await split.split(recipients, amountsWei);
  const txHash: string = tx?.hash as string;

  const explorerUrl = `https://eth-sepolia.blockscout.com/tx/${txHash}`;
  return { txHash, explorerUrl };
}


