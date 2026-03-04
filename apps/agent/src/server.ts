/**
 * Fastify HTTP server — REST API + SSE for real-time updates.
 * v0.2.0: added portfolio tracker, risk engine, /api/portfolio, /api/risk/evaluate
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "crypto";
import { CONFIG } from "./config.js";
import { IntentParser } from "./intent/parser.js";
import { StrategyEngine } from "./intent/strategy-engine.js";
import { Executor } from "./execution/executor.js";
import { BirdeyeClient } from "./market/birdeye.js";
import { PortfolioTracker } from "./portfolio/tracker.js";
import { RiskEngine } from "./risk/risk-engine.js";

const parser = new IntentParser();
const strategyEngine = new StrategyEngine();
const executor = new Executor();
const birdeye = new BirdeyeClient();
const portfolio = new PortfolioTracker();
const riskEngine = new RiskEngine();

// SSE subscribers
const sseClients = new Set<(data: string) => void>();

function broadcast(event: string, data: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((send) => send(msg));
}

export async function createServer() {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, { origin: "*" });

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get("/health", async () => ({
    status: "ok",
    version: "0.2.0",
    simulation: CONFIG.SIMULATION_MODE,
    timestamp: new Date().toISOString(),
    capabilities: [
      "intent-parse",
      "strategy-engine",
      "risk-engine",
      "portfolio-tracker",
      "sse",
    ],
  }));

  // ── Intent endpoint ────────────────────────────────────────────────────────
  app.post<{
    Body: { intent: string; execute?: boolean; walletAddress?: string };
  }>("/api/intent", async (req, reply) => {
    const { intent: userInput, execute = false } = req.body;
    if (!userInput?.trim()) {
      return reply.status(400).send({ error: "intent is required" });
    }

    const intentId = randomUUID();
    broadcast("intent_received", { intentId, input: userInput });

    // Parse
    const parsed = await parser.parse(userInput);
    broadcast("intent_parsed", { intentId, parsed });

    if (parsed.type === "unknown" || parsed.confidence < 0.3) {
      return {
        intentId,
        parsed,
        plan: null,
        risk: null,
        result: null,
        message: "Could not parse intent — please rephrase",
      };
    }

    // Build plan
    const plan = strategyEngine.buildPlan(parsed, intentId);
    broadcast("plan_built", { intentId, plan });

    // Risk evaluation
    const tradeValueUsd = parsed.params.amountUsd || parsed.params.amount || 0;
    const risk = riskEngine.evaluate(plan, tradeValueUsd);
    broadcast("risk_evaluated", { intentId, risk });

    if (!risk.approved) {
      return {
        intentId,
        parsed,
        plan,
        risk,
        result: null,
        message: risk.message,
      };
    }

    // Execute if requested and not requiring confirmation
    let result = null;
    if (execute && !plan.requiresConfirmation) {
      result = await executor.execute(plan);
      broadcast("execution_complete", { intentId, result });
    }

    return { intentId, parsed, plan, risk, result };
  });

  // ── Execute a pre-built plan ───────────────────────────────────────────────
  app.post<{ Body: { intentId: string; plan: any } }>(
    "/api/execute",
    async (req, reply) => {
      const { intentId, plan } = req.body;
      if (!plan) return reply.status(400).send({ error: "plan is required" });

      broadcast("execution_started", { intentId });
      const result = await executor.execute(plan);
      broadcast("execution_complete", { intentId, result });
      return result;
    }
  );

  // ── Portfolio ──────────────────────────────────────────────────────────────
  app.get<{ Querystring: { wallet?: string } }>(
    "/api/portfolio",
    async (req) => {
      const wallet = req.query.wallet || "";
      return portfolio.getSnapshot(wallet);
    }
  );

  app.post<{
    Body: { wallet: string; targetAllocation: Record<string, number> };
  }>("/api/portfolio/rebalance-preview", async (req, reply) => {
    const { wallet, targetAllocation } = req.body;
    if (!targetAllocation)
      return reply.status(400).send({ error: "targetAllocation required" });
    const snapshot = await portfolio.getSnapshot(wallet || "");
    const trades = portfolio.calculateRebalance(snapshot, targetAllocation);
    return {
      snapshot,
      trades,
      estimatedGasUsd: trades.length * 0.002,
    };
  });

  // ── Market data ────────────────────────────────────────────────────────────
  app.get("/api/prices", async () => {
    const prices = await birdeye.getAllPrices();
    return { prices, timestamp: Date.now() };
  });

  app.get<{ Params: { symbol: string } }>(
    "/api/prices/:symbol",
    async (req, reply) => {
      const prices = await birdeye.getAllPrices();
      const price = prices[req.params.symbol.toUpperCase()];
      if (!price) return reply.status(404).send({ error: "Symbol not found" });
      return price;
    }
  );

  app.get("/api/yields", async (req) => {
    const risk = (req.query as any).risk as
      | "low"
      | "medium"
      | "high"
      | undefined;
    const opps = await birdeye.getYieldOpportunities(risk);
    return { opportunities: opps, timestamp: Date.now() };
  });

  // ── Risk check ─────────────────────────────────────────────────────────────
  app.post<{ Body: { plan: any; tradeValueUsd?: number } }>(
    "/api/risk/evaluate",
    async (req, reply) => {
      const { plan, tradeValueUsd = 0 } = req.body;
      if (!plan) return reply.status(400).send({ error: "plan is required" });
      return riskEngine.evaluate(plan, tradeValueUsd);
    }
  );

  // ── SSE stream ─────────────────────────────────────────────────────────────
  app.get("/api/stream", async (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.flushHeaders?.();

    const send = (data: string) => {
      if (!reply.raw.writableEnded) reply.raw.write(data);
    };

    sseClients.add(send);
    send(
      `event: connected\ndata: ${JSON.stringify({
        ts: Date.now(),
        version: "0.2.0",
      })}\n\n`
    );

    const hb = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`:heartbeat\n\n`);
      } else {
        clearInterval(hb);
      }
    }, 15000);

    req.raw.on("close", () => {
      sseClients.delete(send);
      clearInterval(hb);
    });

    await new Promise(() => {});
  });

  return app;
}
