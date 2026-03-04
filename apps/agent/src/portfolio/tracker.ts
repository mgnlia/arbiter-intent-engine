/**
 * Portfolio Tracker — aggregates positions across Drift, Orca, Raydium.
 * In simulation mode returns realistic mock data.
 */
import { CONFIG } from "../config.js";

export interface Position {
  protocol: "drift" | "orca" | "raydium" | "wallet";
  type: "lending" | "lp" | "farming" | "spot";
  token: string;
  amount: number;
  valueUsd: number;
  apy?: number;
  pnlUsd?: number;
  pnlPct?: number;
}

export interface PortfolioSnapshot {
  walletAddress: string;
  totalValueUsd: number;
  totalPnlUsd: number;
  positions: Position[];
  timestamp: number;
  simulated: boolean;
}

const MOCK_POSITIONS: Position[] = [
  {
    protocol: "wallet",
    type: "spot",
    token: "SOL",
    amount: 12.5,
    valueUsd: 2317.75,
    pnlUsd: 312.5,
    pnlPct: 15.6,
  },
  {
    protocol: "wallet",
    type: "spot",
    token: "USDC",
    amount: 850,
    valueUsd: 850,
    pnlUsd: 0,
    pnlPct: 0,
  },
  {
    protocol: "drift",
    type: "lending",
    token: "USDC",
    amount: 2000,
    valueUsd: 2000,
    apy: 8.2,
    pnlUsd: 164,
    pnlPct: 8.2,
  },
  {
    protocol: "orca",
    type: "lp",
    token: "SOL-USDC",
    amount: 1,
    valueUsd: 1450,
    apy: 22.4,
    pnlUsd: 325,
    pnlPct: 22.4,
  },
  {
    protocol: "raydium",
    type: "farming",
    token: "RAY-SOL",
    amount: 1,
    valueUsd: 680,
    apy: 48.2,
    pnlUsd: 328,
    pnlPct: 48.2,
  },
];

export class PortfolioTracker {
  async getSnapshot(walletAddress: string): Promise<PortfolioSnapshot> {
    // Real implementation would call Helius + protocol SDKs
    if (CONFIG.SIMULATION_MODE || !walletAddress) {
      return this.getMockSnapshot(walletAddress || "demo-wallet");
    }
    return this.getRealSnapshot(walletAddress);
  }

  private getMockSnapshot(walletAddress: string): PortfolioSnapshot {
    const totalValueUsd = MOCK_POSITIONS.reduce((s, p) => s + p.valueUsd, 0);
    const totalPnlUsd = MOCK_POSITIONS.reduce((s, p) => s + (p.pnlUsd || 0), 0);
    return {
      walletAddress,
      totalValueUsd,
      totalPnlUsd,
      positions: MOCK_POSITIONS,
      timestamp: Date.now(),
      simulated: true,
    };
  }

  private async getRealSnapshot(walletAddress: string): Promise<PortfolioSnapshot> {
    try {
      const rpcUrl = CONFIG.SOLANA_RPC_URL;
      const resp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [walletAddress],
        }),
      });
      const data = await resp.json();
      const solBalance = (data.result?.value || 0) / 1e9;
      const solValueUsd = solBalance * 185.42;

      const positions: Position[] = [
        {
          protocol: "wallet",
          type: "spot",
          token: "SOL",
          amount: solBalance,
          valueUsd: solValueUsd,
        },
      ];

      return {
        walletAddress,
        totalValueUsd: solValueUsd,
        totalPnlUsd: 0,
        positions,
        timestamp: Date.now(),
        simulated: false,
      };
    } catch {
      return this.getMockSnapshot(walletAddress);
    }
  }

  /**
   * Calculate optimal rebalancing actions to reach a target allocation.
   */
  calculateRebalance(
    current: PortfolioSnapshot,
    targetAllocation: Record<string, number>
  ): Array<{ from: string; to: string; amountUsd: number }> {
    const total = current.totalValueUsd;
    const trades: Array<{ from: string; to: string; amountUsd: number }> = [];

    const currentByToken: Record<string, number> = {};
    for (const pos of current.positions) {
      currentByToken[pos.token] = (currentByToken[pos.token] || 0) + pos.valueUsd;
    }

    for (const [token, targetPct] of Object.entries(targetAllocation)) {
      const targetUsd = total * (targetPct / 100);
      const currentUsd = currentByToken[token] || 0;
      const diff = targetUsd - currentUsd;

      if (Math.abs(diff) > 10) {
        if (diff > 0) {
          trades.push({ from: "USDC", to: token, amountUsd: diff });
        } else {
          trades.push({ from: token, to: "USDC", amountUsd: Math.abs(diff) });
        }
      }
    }

    return trades;
  }
}
