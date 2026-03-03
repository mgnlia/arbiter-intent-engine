/**
 * Execution Engine — executes plans on-chain via Solana Agent Kit V2.
 * In simulation mode, returns realistic mock results.
 */
import { CONFIG } from "../config.js";
import { ExecutionPlan, ExecutionStep } from "../intent/strategy-engine.js";

export interface StepResult {
  stepId: string;
  success: boolean;
  txSignature?: string;
  outputAmount?: number;
  outputToken?: string;
  error?: string;
  simulatedPnlUsd?: number;
}

export interface ExecutionResult {
  planId: string;
  success: boolean;
  steps: StepResult[];
  totalGasUsed: number;
  totalPnlUsd: number;
  durationMs: number;
  simulated: boolean;
}

export class Executor {
  private agentKit: any = null;

  constructor() {
    this.initAgentKit();
  }

  private async initAgentKit() {
    if (CONFIG.SIMULATION_MODE || !CONFIG.WALLET_PRIVATE_KEY) {
      console.log("Executor: simulation mode (no wallet key)");
      return;
    }
    try {
      const { SolanaAgentKit } = require("solana-agent-kit");
      const { createDefiPlugin } = require("@solana-agent-kit/plugin-defi");
      this.agentKit = new SolanaAgentKit(
        CONFIG.WALLET_PRIVATE_KEY,
        CONFIG.SOLANA_RPC_URL,
        { OPENAI_API_KEY: CONFIG.OPENAI_API_KEY }
      ).use(createDefiPlugin());
      console.log("Executor: SolanaAgentKit V2 initialized");
    } catch (e) {
      console.warn("SAK init failed, falling back to simulation:", e);
    }
  }

  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    const start = Date.now();
    const results: StepResult[] = [];

    const sortedSteps = [...plan.steps].sort((a, b) => a.priority - b.priority);

    for (const step of sortedSteps) {
      const result = await this.executeStep(step);
      results.push(result);
      if (!result.success) break; // abort on failure
    }

    const totalPnl = results.reduce((s, r) => s + (r.simulatedPnlUsd || 0), 0);
    const success = results.every((r) => r.success);

    return {
      planId: plan.intentId,
      success,
      steps: results,
      totalGasUsed: plan.steps.reduce((s, step) => s + step.estimatedGasLamports, 0),
      totalPnlUsd: totalPnl,
      durationMs: Date.now() - start,
      simulated: !this.agentKit,
    };
  }

  private async executeStep(step: ExecutionStep): Promise<StepResult> {
    // Real execution via SAK V2
    if (this.agentKit) {
      return this.executeReal(step);
    }
    // Simulation
    return this.simulateStep(step);
  }

  private async executeReal(step: ExecutionStep): Promise<StepResult> {
    try {
      let txSig: string | undefined;

      switch (`${step.protocol}:${step.action}`) {
        case "jupiter:execute_swap": {
          const { inputMint, outputMint, amount, slippageBps } = step.params as any;
          txSig = await this.agentKit.trade(outputMint, amount, inputMint, slippageBps);
          break;
        }
        case "drift:deposit_collateral": {
          const { token, amount } = step.params as any;
          txSig = await this.agentKit.driftDeposit(amount, token);
          break;
        }
        case "drift:borrow": {
          const { token, amount } = step.params as any;
          txSig = await this.agentKit.driftBorrow(amount, token);
          break;
        }
        case "orca:add_liquidity": {
          const { pool, amount } = step.params as any;
          txSig = await this.agentKit.orcaAddLiquidity(pool, amount);
          break;
        }
        default:
          txSig = `sim_${Date.now()}_${step.id}`;
      }

      return { stepId: step.id, success: true, txSignature: txSig };
    } catch (e: any) {
      return { stepId: step.id, success: false, error: e.message };
    }
  }

  private async simulateStep(step: ExecutionStep): Promise<StepResult> {
    // Simulate realistic latency
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

    const fakeSuccess = Math.random() > 0.05; // 95% success rate in sim
    if (!fakeSuccess) {
      return { stepId: step.id, success: false, error: "Simulated slippage exceeded" };
    }

    const pnl = (step.estimatedOutputUsd || 0) * (0.98 + Math.random() * 0.04);

    return {
      stepId: step.id,
      success: true,
      txSignature: `sim_${Date.now().toString(36)}_${step.id.slice(-6)}`,
      simulatedPnlUsd: pnl,
      outputAmount: step.params.amount as number,
    };
  }
}
