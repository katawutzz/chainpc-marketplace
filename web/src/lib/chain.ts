import { defineChain } from "viem";
import { pcMarketplaceAbi, pcMarketplaceAddress, pcMarketplaceDeployBlock } from "../contracts/pcMarketplace";

const RPC_URL = import.meta.env.VITE_HOODI_RPC_URL || "https://ethereum-hoodi-rpc.publicnode.com";

/** Ethereum Hoodi Testnet — ค่าเดียวกับที่ตั้งใน MetaMask */
export const hoodi = defineChain({
  id: 560048,
  name: "Hoodi",
  nativeCurrency: { name: "Hoodi Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Etherscan", url: "https://hoodi.etherscan.io" } },
  testnet: true,
});

export const marketplace = {
  address: pcMarketplaceAddress[hoodi.id],
  abi: pcMarketplaceAbi,
  deployBlock: pcMarketplaceDeployBlock[hoodi.id],
  chainId: hoodi.id,
} as const;

export const explorer = {
  address: (a: string) => `https://hoodi.etherscan.io/address/${a}`,
  tx: (h: string) => `https://hoodi.etherscan.io/tx/${h}`,
};
