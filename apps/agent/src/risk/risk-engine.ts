/**
 * Risk Engine — evaluates execution plans for risk before submission.
 * Guards against excessive slippage, concentration risk, and size limits.
 */
import { ExecutionPlan } from "../intent/strategy-engine.js";
import { CONFIG } from "../config.js";

export type RiskLevel = "safe" | "caution" | "high" | "blocked";

export interface RiskReport {
  level: RiskLevel;
  score: number; // 0-100
  flags: RiskFlag[];
  approved: boolean;
  message: string;
}

export interface RiskFlag {
  code: string;
  severity: "info" | "warning" | "critical";
  description: string;
}

export class RiskEngine {
  evaluate(plan: ExecutionPlan, tradeValueUsd: number = 0): RiskReport {
    const flags: RiskFlag[] = [];
    let score = plan.riskScore;

    // 1. Size check
    if (tradeValueUsd > CONFIG.MAX_TRADE_USD) {
      flags.push({
        code: "SIZE_EXCEEDED",
        severity: "critical",
        description: `Trade size $${tradeValueUsd} exceeds max $${CONFIG.MAX_TRADE_USD}`,
      });
      score = Math.min(100, score + 30);
    }

    // 2. Multi-protocol concentration
    const protocols = new Set(plan.steps.map((s) => s.protocol));
    if (protocols.size === 1 && plan.steps.length > 2) {
      flags.push({
        code: "PROTOCOL_CONCENTRATION",
        severity: "warning",
        description: `All steps use single protocol: ${[...protocols][0]}`,
      });
      score = Math.min(100, score + 10);
    }

    // 3. High-risk protocol combos
    const hasRaydium = plan.steps.some((s) => s.protocol === "raydium");
    const hasOrca = plan.steps.some((s) => s.protocol === "orca");
    if (hasRaydium && hasOrca && tradeValueUsd > 500) {
      flags.push({
        code: "HIGH_RISK_COMBO",
        severity: "warning",
        description: "Raydium farming + Orca LP combo carries elevated IL risk",
      });
      score = Math.min(100, score + 15);
    }

    // 4. Missing MEV protection on large swaps
    const hasJupiter = plan.steps.some((s) => s.protocol === "jupiter");
    const hasJito = plan.steps.some((s) => s.protocol === "jito");
    if (hasJupiter && !hasJito && tradeValueUsd > 100) {
      flags.push({
        code: "NO_MEV_PROTECTION",
        severity: "info",
        description: "Large swap without Jito MEV protection — sandwich risk",
      });
    }

    // 5. Simulation mode info
    if (CONFIG.SIMULATION_MODE) {
      flags.push({
        code: "SIMULATION_MODE",
        severity: "info",
        description: "Running in simulation mode — no real funds at risk",
      });
    }

    // Determine level
    let level: RiskLevel;
    let approved: boolean;
    let message: string;

    if (score >= 90) {
      level = "blocked";
      approved = false;
      message = "Risk score too high — execution blocked. Reduce size or choose lower-risk strategy.";
    } else if (score >= 65) {
      level = "high";
      approved = false;
      message = "High risk detected — human confirmation required.";
    } else if (score >= 35) {
      level = "caution";
      approved = true;
      message = "Moderate risk — proceed with caution.";
    } else {
      level = "safe";
      approved = true;
      message = "Risk within acceptable parameters.";
    }

    return { level, score, flags, approved, message };
  }
}
