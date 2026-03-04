/**
 * Intent Parser — unit tests (vitest)
 * Run: npm test
 */
import { describe, it, expect } from "vitest";
import { IntentParser } from "./parser.js";

const parser = new IntentParser();

describe("IntentParser — rule-based (no AI key)", () => {
  it("parses swap intent", async () => {
    const r = await parser.parse("swap 100 USDC to SOL");
    expect(r.type).toBe("swap");
    expect(r.params.inputToken).toBe("USDC");
    expect(r.params.outputToken).toBe("SOL");
    expect(r.params.amount).toBe(100);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("parses yield intent with APY target", async () => {
    const r = await parser.parse("Give me 15% APY with low risk");
    expect(r.type).toBe("yield");
    expect(r.params.targetApy).toBe(15);
    expect(r.params.riskLevel).toBe("low");
  });

  it("parses lend intent", async () => {
    const r = await parser.parse("lend 500 USDC on Drift");
    expect(r.type).toBe("lend");
    expect(r.params.inputToken).toBe("USDC");
  });

  it("parses rebalance intent", async () => {
    const r = await parser.parse("rebalance my portfolio to 60% SOL 40% USDC");
    expect(r.type).toBe("rebalance");
  });

  it("returns unknown for gibberish", async () => {
    const r = await parser.parse("xyzzy plugh foo bar");
    expect(r.type).toBe("unknown");
    expect(r.confidence).toBeLessThan(0.5);
  });

  it("includes strategies array", async () => {
    const r = await parser.parse("swap 50 SOL to USDC");
    expect(Array.isArray(r.strategies)).toBe(true);
    expect(r.strategies.length).toBeGreaterThan(0);
  });
});
