/**
 * Intent Parser — converts natural language to structured DeFi intents.
 * The core primitive that makes Arbiter novel vs generic bots.
 */
import { z } from "zod";
import { CONFIG } from "../config.js";

// ─── Intent Schema ────────────────────────────────────────────────────────────

export const IntentTypeSchema = z.enum([
  "swap",           // "swap 100 USDC to SOL"
  "yield",          // "earn 15% APY low risk"
  "lend",           // "lend 500 USDC on Drift"
  "borrow",         // "borrow 200 USDC against my SOL"
  "lp",             // "provide liquidity to SOL/USDC pool"
  "rebalance",      // "rebalance my portfolio to 60% SOL 40% USDC"
  "info",           // "what's the best APY right now?"
  "unknown",
]);

export type IntentType = z.infer<typeof IntentTypeSchema>;

export const ParsedIntentSchema = z.object({
  type: IntentTypeSchema,
  raw: z.string(),
  params: z.object({
    inputToken: z.string().optional(),
    outputToken: z.string().optional(),
    amount: z.number().optional(),
    amountUsd: z.number().optional(),
    targetApy: z.number().optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
    protocol: z.string().optional(),
    allocation: z.record(z.string(), z.number()).optional(),
  }),
  confidence: z.number().min(0).max(1),
  strategies: z.array(z.string()),  // suggested execution strategies
  reasoning: z.string(),
});

export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

// ─── Parser ───────────────────────────────────────────────────────────────────

export class IntentParser {
  private aiClient: any = null;
  private useGroq: boolean;

  constructor() {
    this.useGroq = !!CONFIG.GROQ_API_KEY;
    this.initClient();
  }

  private initClient() {
    try {
      if (CONFIG.GROQ_API_KEY) {
        const Groq = require("groq-sdk");
        this.aiClient = new Groq.default({ apiKey: CONFIG.GROQ_API_KEY });
      } else if (CONFIG.OPENAI_API_KEY) {
        const OpenAI = require("openai");
        this.aiClient = new OpenAI.default({ apiKey: CONFIG.OPENAI_API_KEY });
        this.useGroq = false;
      }
    } catch (e) {
      console.warn("AI client init failed, using rule-based parser");
    }
  }

  async parse(userInput: string): Promise<ParsedIntent> {
    if (this.aiClient) {
      try {
        return await this.aiParse(userInput);
      } catch (e) {
        console.warn("AI parse failed, falling back to rules:", e);
      }
    }
    return this.ruleParse(userInput);
  }

  private async aiParse(userInput: string): Promise<ParsedIntent> {
    const systemPrompt = `You are Arbiter's intent parser for Solana DeFi. 
Parse user intents into structured JSON. Available protocols: Jupiter (swaps), 
Drift (lending/perps), Orca (LP), Raydium (LP/farming), Jito (MEV protection).

Respond ONLY with valid JSON matching this schema:
{
  "type": "swap|yield|lend|borrow|lp|rebalance|info|unknown",
  "params": {
    "inputToken": "USDC",
    "outputToken": "SOL",
    "amount": 100,
    "amountUsd": 100,
    "targetApy": 15,
    "riskLevel": "low|medium|high",
    "protocol": "jupiter|drift|orca|raydium",
    "allocation": {"SOL": 60, "USDC": 40}
  },
  "confidence": 0.95,
  "strategies": ["jupiter_ultra_swap", "jito_mev_protection"],
  "reasoning": "User wants to swap USDC to SOL with best execution"
}`;

    const model = this.useGroq ? CONFIG.AI_MODEL : "gpt-4o-mini";
    const resp = await this.aiClient.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput },
      ],
      max_tokens: 400,
      temperature: 0.1,
    });

    const content = resp.choices[0].message.content || "{}";
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}") + 1;
    const json = JSON.parse(content.slice(start, end));

    return ParsedIntentSchema.parse({ ...json, raw: userInput });
  }

  private ruleParse(userInput: string): ParsedIntent {
    const lower = userInput.toLowerCase();

    // Swap intent
    const swapMatch = lower.match(/swap\s+\$?(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|for)\s+(\w+)/);
    if (swapMatch) {
      return {
        type: "swap",
        raw: userInput,
        params: {
          amount: parseFloat(swapMatch[1]),
          inputToken: swapMatch[2].toUpperCase(),
          outputToken: swapMatch[3].toUpperCase(),
        },
        confidence: 0.9,
        strategies: ["jupiter_ultra_swap", "jito_mev_protection"],
        reasoning: `Swap ${swapMatch[1]} ${swapMatch[2].toUpperCase()} to ${swapMatch[3].toUpperCase()} via Jupiter Ultra`,
      };
    }

    // Yield intent
    const yieldMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s*apy/);
    const riskMatch = lower.match(/\b(low|medium|high)\s+risk\b/);
    if (yieldMatch || lower.includes("yield") || lower.includes("earn")) {
      return {
        type: "yield",
        raw: userInput,
        params: {
          targetApy: yieldMatch ? parseFloat(yieldMatch[1]) : undefined,
          riskLevel: (riskMatch?.[1] as "low" | "medium" | "high") || "medium",
        },
        confidence: 0.8,
        strategies: ["drift_lending", "orca_lp", "raydium_vault"],
        reasoning: `Yield optimization targeting ${yieldMatch?.[1] || "best"}% APY with ${riskMatch?.[1] || "medium"} risk`,
      };
    }

    // Lend intent
    if (lower.includes("lend") || lower.includes("deposit")) {
      const amtMatch = lower.match(/\$?(\d+(?:\.\d+)?)/);
      const tokenMatch = lower.match(/\b(usdc|sol|usdt|eth|bonk|jup)\b/);
      return {
        type: "lend",
        raw: userInput,
        params: {
          amount: amtMatch ? parseFloat(amtMatch[1]) : undefined,
          inputToken: tokenMatch?.[1].toUpperCase() || "USDC",
          protocol: "drift",
        },
        confidence: 0.85,
        strategies: ["drift_lending"],
        reasoning: "Lend assets on Drift Protocol for yield",
      };
    }

    // Rebalance
    if (lower.includes("rebalance") || lower.includes("portfolio")) {
      return {
        type: "rebalance",
        raw: userInput,
        params: { riskLevel: "medium" },
        confidence: 0.7,
        strategies: ["jupiter_ultra_swap", "drift_lending", "orca_lp"],
        reasoning: "Portfolio rebalancing across Solana DeFi",
      };
    }

    return {
      type: "unknown",
      raw: userInput,
      params: {},
      confidence: 0.1,
      strategies: [],
      reasoning: "Could not parse intent — please rephrase",
    };
  }
}
