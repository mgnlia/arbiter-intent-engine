import { config } from "dotenv";
config();

export const CONFIG = {
  // Solana
  SOLANA_RPC_URL: process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY || "",

  // AI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  AI_MODEL: process.env.AI_MODEL || "llama3-70b-8192",

  // APIs
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || "",
  BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY || "",
  JUPITER_API_URL: "https://quote-api.jup.ag/v6",

  // Server
  PORT: parseInt(process.env.PORT || "8000"),
  SIMULATION_MODE: process.env.SIMULATION_MODE !== "false",

  // Risk
  MAX_TRADE_USD: parseFloat(process.env.MAX_TRADE_USD || "1000"),
  MAX_SLIPPAGE_BPS: parseInt(process.env.MAX_SLIPPAGE_BPS || "100"),
} as const;
