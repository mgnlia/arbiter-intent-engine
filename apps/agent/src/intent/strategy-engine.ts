/**
 * Strategy Engine — maps parsed intents to concrete execution plans.
 * Routes to the right protocol(s) based on intent type + risk profile.
 */
import { ParsedIntent } from "./parser.js";

export interface ExecutionStep {
  id: string;
  protocol: "jupiter" | "drift" | "orca" | "raydium" | "jito";
  action: string;
  params: Record<string, unknown>;
  estimatedGasLamports: number;
  estimatedOutputUsd?: number;
  priority: number;
}

export interface ExecutionPlan {
  intentId: string;
  steps: ExecutionStep[];
  totalEstimatedGasUsd: number;
  expectedApyRange?: [number, number];
  riskScore: number; // 0-100
  description: string;
  requiresConfirmation: boolean;
}

export class StrategyEngine {
  buildPlan(intent: ParsedIntent, intentId: string): ExecutionPlan {
    switch (intent.type) {
      case "swap":
        return this.buildSwapPlan(intent, intentId);
      case "yield":
        return this.buildYieldPlan(intent, intentId);
      case "lend":
        return this.buildLendPlan(intent, intentId);
      case "borrow":
        return this.buildBorrowPlan(intent, intentId);
      case "lp":
        return this.buildLpPlan(intent, intentId);
      case "rebalance":
        return this.buildRebalancePlan(intent, intentId);
      default:
        return this.buildInfoPlan(intent, intentId);
    }
  }

  private buildSwapPlan(intent: ParsedIntent, intentId: string): ExecutionPlan {
    const { inputToken = "USDC", outputToken = "SOL", amount = 0 } = intent.params;
    const steps: ExecutionStep[] = [
      {
        id: `${intentId}-quote`,
        protocol: "jupiter",
        action: "get_quote",
        params: { inputMint: tokenToMint(inputToken), outputMint: tokenToMint(outputToken), amount },
        estimatedGasLamports: 5000,
        priority: 1,
      },
      {
        id: `${intentId}-mev`,
        protocol: "jito",
        action: "bundle_tip",
        params: { tipLamports: 10000 },
        estimatedGasLamports: 0,
        priority: 2,
      },
      {
        id: `${intentId}-swap`,
        protocol: "jupiter",
        action: "execute_swap",
        params: { inputMint: tokenToMint(inputToken), outputMint: tokenToMint(outputToken), amount, slippageBps: 50 },
        estimatedGasLamports: 5000,
        priority: 3,
      },
    ];

    return {
      intentId,
      steps,
      totalEstimatedGasUsd: 0.002,
      riskScore: 15,
      description: `Swap ${amount} ${inputToken} → ${outputToken} via Jupiter Ultra with Jito MEV protection`,
      requiresConfirmation: (intent.params.amountUsd || 0) > 500,
    };
  }

  private buildYieldPlan(intent: ParsedIntent, intentId: string): ExecutionPlan {
    const { targetApy = 10, riskLevel = "medium" } = intent.params;
    const steps: ExecutionStep[] = [];

    if (riskLevel === "low") {
      // Low risk: Drift lending only
      steps.push({
        id: `${intentId}-drift-lend`,
        protocol: "drift",
        action: "deposit_collateral",
        params: { token: "USDC", amount: intent.params.amount || 1000 },
        estimatedGasLamports: 5000,
        estimatedOutputUsd: (intent.params.amount || 1000) * 0.08,
        priority: 1,
      });
    } else if (riskLevel === "medium") {
      // Medium: 60% Drift + 40% Orca LP
      steps.push(
        {
          id: `${intentId}-drift`,
          protocol: "drift",
          action: "deposit_collateral",
          params: { token: "USDC", amount: (intent.params.amount || 1000) * 0.6 },
          estimatedGasLamports: 5000,
          priority: 1,
        },
        {
          id: `${intentId}-orca-lp`,
          protocol: "orca",
          action: "add_liquidity",
          params: { pool: "SOL-USDC", amount: (intent.params.amount || 1000) * 0.4 },
          estimatedGasLamports: 10000,
          priority: 2,
        }
      );
    } else {
      // High risk: Raydium farming + Orca concentrated LP
      steps.push(
        {
          id: `${intentId}-raydium`,
          protocol: "raydium",
          action: "stake_farm",
          params: { pool: "RAY-SOL", amount: (intent.params.amount || 1000) * 0.5 },
          estimatedGasLamports: 8000,
          priority: 1,
        },
        {
          id: `${intentId}-orca-clmm`,
          protocol: "orca",
          action: "add_concentrated_liquidity",
          params: { pool: "SOL-USDC", amount: (intent.params.amount || 1000) * 0.5, tickRange: "narrow" },
          estimatedGasLamports: 15000,
          priority: 2,
        }
      );
    }

    const apyRanges: Record<string, [number, number]> = {
      low: [6, 10], medium: [12, 20], high: [25, 60],
    };

    return {
      intentId,
      steps,
      totalEstimatedGasUsd: 0.005,
      expectedApyRange: apyRanges[riskLevel],
      riskScore: riskLevel === "low" ? 20 : riskLevel === "medium" ? 45 : 75,
      description: `Yield optimization: ${riskLevel} risk, targeting ${apyRanges[riskLevel][0]}-${apyRanges[riskLevel][1]}% APY`,
      requiresConfirmation: true,
    };
  }

  private buildLendPlan(intent: ParsedIntent, intentId: string): ExecutionPlan {
    return {
      intentId,
      steps: [{
        id: `${intentId}-lend`,
        protocol: "drift",
        action: "deposit_collateral",
        params: { token: intent.params.inputToken || "USDC", amount: intent.params.amount || 100 },
        estimatedGasLamports: 5000,
        priority: 1,
      }],
      totalEstimatedGasUsd: 0.001,
      expectedApyRange: [6, 12],
      riskScore: 15,
      description: `Lend ${intent.params.amount || "?"} ${intent.params.inputToken || "USDC"} on Drift Protocol`,
      requiresConfirmation: false,
    };
  }

  private buildBorrowPlan(intent: ParsedIntent, intentId: string): ExecutionPlan {
    return {
      intentId,
      steps: [{
        id: `${intentId}-borrow`,
        protocol: "drift",
        action: "borrow",
        params: { token: intent.params.outputToken || "USDC", amount: intent.params.amount || 100 },
        estimatedGasLamports: 5000,
        priority: 1,
      }],
      totalEstimatedGasUsd: 0.001,
      riskScore: 55,
      description: `Borrow ${intent.params.amount || "?"} ${intent.params.outputToken || "USDC"} on Drift`,
      requiresConfirmation: true,
    };
  }

  private buildLpPlan(intent: ParsedIntent, intentId: string): ExecutionPlan {
    return {
      intentId,
      steps: [{
        id: `${intentId}-lp`,
        protocol: "orca",
        action: "add_liquidity",
        params: { pool: `${intent.params.inputToken || "SOL"}-${intent.params.outputToken || "USDC"}`, amount: intent.params.amount || 100 },
        estimatedGasLamports: 10000,
        priority: 1,
      }],
      totalEstimatedGasUsd: 0.002,
      expectedApyRange: [15, 40],
      riskScore: 50,
      description: `Add liquidity to ${intent.params.inputToken || "SOL"}/${intent.params.outputToken || "USDC"} pool on Orca`,
      requiresConfirmation: true,
    };
  }

  private buildRebalancePlan(intent: ParsedIntent, intentId: string): ExecutionPlan {
    const alloc = intent.params.allocation || { SOL: 60, USDC: 40 };
    const steps: ExecutionStep[] = Object.entries(alloc).map(([token, pct], i) => ({
      id: `${intentId}-rebal-${token}`,
      protocol: "jupiter" as const,
      action: "rebalance_swap",
      params: { targetToken: token, targetPct: pct },
      estimatedGasLamports: 5000,
      priority: i + 1,
    }));

    return {
      intentId,
      steps,
      totalEstimatedGasUsd: 0.003 * steps.length,
      riskScore: 30,
      description: `Rebalance portfolio: ${Object.entries(alloc).map(([t, p]) => `${p}% ${t}`).join(", ")}`,
      requiresConfirmation: true,
    };
  }

  private buildInfoPlan(intent: ParsedIntent, intentId: string): ExecutionPlan {
    return {
      intentId,
      steps: [],
      totalEstimatedGasUsd: 0,
      riskScore: 0,
      description: "Information query — no on-chain execution required",
      requiresConfirmation: false,
    };
  }
}

// Token mint addresses (mainnet)
function tokenToMint(symbol: string): string {
  const mints: Record<string, string> = {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  };
  return mints[symbol.toUpperCase()] || symbol;
}
