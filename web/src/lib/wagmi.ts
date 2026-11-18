import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { hoodi } from "./chain";

/** เชื่อมต่อผ่าน MetaMask (browser extension) เท่านั้น */
export const wagmiConfig = createConfig({
  chains: [hoodi],
  connectors: [injected({ target: "metaMask" })],
  transports: { [hoodi.id]: http() },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
