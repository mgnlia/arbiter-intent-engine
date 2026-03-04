/**
 * Strategy Engine — unit tests (vitest)
 */
import { describe, it, expect } from "vitest";
import { StrategyEngine } from "./strategy-engine.js";
import { ParsedIntent } from "./parser.js";

const engine = new StrategyEngine();

function makeIntent(overrides: Partial<ParsedIntent>): ParsedIntent {
  return {
    type: "swap",
    raw: "test",
    params: {},
    confidence: 0.9,
    strategies: [],
    reasoning: "test",
    ...overrides,
  };
}

describe("StrategyEngine", () => {
  it("builds swap plan with Jito MEV step", () => {
    const intent = makeIntent({
      type: "swap",
      params: { inputToken: "USDC", outputToken: "SOL", amount: 100 },
    });
    const plan = engine.buildPlan(intent, "test-001");
    expect(plan.steps.length).toBeGreaterThan(1);
    expect(plan.steps.some((s) => s.protocol === "jito")).toBe(true);
    expect(plan.steps.some((s) => s.protocol === "jupiter")).toBe(true);
    expect(plan.riskScore).toBeLessThan(50);
  });

  it("builds low-risk yield plan using Drift only", () => {
    const intent = makeIntent({
      type: "yield",
      params: { targetApy: 8, riskLevel: "low", amount: 1000 },
    });
    const plan = engine.buildPlan(intent, "test-002");
    expect(plan.steps.every((s) => s.protocol === "drift")).toBe(true);
    expect(plan.riskScore).toBeLessThan(40);
    expect(plan.expectedApyRange).toBeDefined();
  });

  it("builds medium-risk yield plan with Drift + Orca", () => {
    const intent = makeIntent({
      type: "yield",
      params: { targetApy: 15, riskLevel: "medium", amount: 1000 },
    });
    const plan = engine.buildPlan(intent, "test-003");
    expect(plan.steps.some((s) => s.protocol === "drift")).toBe(true);
    expect(plan.steps.some((s) => s.protocol === "orca")).toBe(true);
  });

  it("builds high-risk yield plan with Raydium + Orca CLMM", () => {
    const intent = makeIntent({
      type: "yield",
      params: { targetApy: 50, riskLevel: "high", amount: 1000 },
    });
    const plan = engine.buildPlan(intent, "test-004");
    expect(plan.steps.some((s) => s.protocol === "raydium")).toBe(true);
    expect(plan.riskScore).toBeGreaterThan(50);
  });

  it("lend plan does not require confirmation for small amounts", () => {
    const intent = makeIntent({
      type: "lend",
      params: { inputToken: "USDC", amount: 100, protocol: "drift" },
    });
    const plan = engine.buildPlan(intent, "test-005");
    expect(plan.requiresConfirmation).toBe(false);
  });

  it("large swap requires confirmation", () => {
    const intent = makeIntent({
      type: "swap",
      params: { inputToken: "USDC", outputToken: "SOL", amount: 1000, amountUsd: 1000 },
    });
    const plan = engine.buildPlan(intent, "test-006");
    expect(plan.requiresConfirmation).toBe(true);
  });

  it("rebalance plan generates steps per token", () => {
    const intent = makeIntent({
      type: "rebalance",
      params: { allocation: { SOL: 60, USDC: 30, JUP: 10 } },
    });
    const plan = engine.buildPlan(intent, "test-007");
    expect(plan.steps.length).toBe(3);
  });
});
