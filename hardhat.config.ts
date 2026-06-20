import dotenv from "dotenv";

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

dotenv.config({ path: ".env.local" });
dotenv.config();

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
const amoyRpcUrl = process.env.AMOY_RPC_URL;
const mumbaiRpcUrl = process.env.MUMBAI_RPC_URL;

function normalizePrivateKey(privateKey: string | undefined): string | undefined {
  if (!privateKey) return undefined;

  const trimmed = privateKey.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return undefined;

  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(prefixed) ? prefixed : undefined;
}

const normalizedPrivateKey = normalizePrivateKey(deployerPrivateKey);

const optionalAccounts = normalizedPrivateKey ? [normalizedPrivateKey] : [];

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    amoy: {
      type: "http",
      chainType: "l1",
      url: amoyRpcUrl ?? "https://rpc-amoy.polygon.technology",
      accounts: optionalAccounts,
    },
    mumbai: {
      type: "http",
      chainType: "l1",
      url: mumbaiRpcUrl ?? "https://rpc-mumbai.maticvigil.com",
      accounts: optionalAccounts,
    },
  },
});
