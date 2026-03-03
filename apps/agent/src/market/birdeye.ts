/**
 * Birdeye market data client — prices, trending tokens, APY data.
 */
import { CONFIG } from "../config.js";

export interface TokenPrice {
  address: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
}

export interface YieldOpportunity {
  protocol: string;
  pool: string;
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
  token: string;
}

const MOCK_PRICES: Record<string, TokenPrice> = {
  SOL: { address: "So11111111111111111111111111111111111111112", symbol: "SOL", price: 185.42, priceChange24h: 3.2, volume24h: 2_100_000_000, liquidity: 8_500_000_000 },
  USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", price: 1.0, priceChange24h: 0.01, volume24h: 5_000_000_000, liquidity: 20_000_000_000 },
  JUP: { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", price: 1.24, priceChange24h: -1.5, volume24h: 45_000_000, liquidity: 180_000_000 },
  BONK: { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", price: 0.0000285, priceChange24h: 8.7, volume24h: 120_000_000, liquidity: 350_000_000 },
  WIF: { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", price: 2.87, priceChange24h: 5.1, volume24h: 80_000_000, liquidity: 220_000_000 },
};

const MOCK_YIELDS: YieldOpportunity[] = [
  { protocol: "drift", pool: "USDC Lending", apy: 8.2, tvl: 180_000_000, risk: "low", token: "USDC" },
  { protocol: "drift", pool: "SOL Lending", apy: 6.5, tvl: 95_000_000, risk: "low", token: "SOL" },
  { protocol: "orca", pool: "SOL-USDC CLMM", apy: 22.4, tvl: 45_000_000, risk: "medium", token: "SOL" },
  { protocol: "orca", pool: "JUP-USDC", apy: 35.8, tvl: 12_000_000, risk: "medium", token: "JUP" },
  { protocol: "raydium", pool: "RAY-SOL Farm", apy: 48.2, tvl: 8_000_000, risk: "high", token: "RAY" },
  { protocol: "raydium", pool: "BONK-SOL Farm", apy: 120.5, tvl: 3_000_000, risk: "high", token: "BONK" },
];

export class BirdeyeClient {
  private baseUrl = "https://public-api.birdeye.so";
  private apiKey: string;

  constructor() {
    this.apiKey = CONFIG.BIRDEYE_API_KEY;
  }

  async getPrice(tokenAddress: string): Promise<TokenPrice | null> {
    if (!this.apiKey) return this.getMockPrice(tokenAddress);

    try {
      const resp = await fetch(`${this.baseUrl}/defi/price?address=${tokenAddress}`, {
        headers: { "X-API-KEY": this.apiKey },
      });
      if (!resp.ok) return this.getMockPrice(tokenAddress);
      const data = await resp.json();
      return {
        address: tokenAddress,
        symbol: data.data?.symbol || "UNKNOWN",
        price: data.data?.value || 0,
        priceChange24h: data.data?.priceChange24h || 0,
        volume24h: data.data?.v24hUSD || 0,
        liquidity: data.data?.liquidity || 0,
      };
    } catch {
      return this.getMockPrice(tokenAddress);
    }
  }

  async getAllPrices(): Promise<Record<string, TokenPrice>> {
    if (!this.apiKey) return MOCK_PRICES;
    const prices: Record<string, TokenPrice> = {};
    for (const [sym, info] of Object.entries(MOCK_PRICES)) {
      const p = await this.getPrice(info.address);
      if (p) prices[sym] = p;
    }
    return prices;
  }

  async getYieldOpportunities(riskLevel?: "low" | "medium" | "high"): Promise<YieldOpportunity[]> {
    const opps = MOCK_YIELDS;
    if (riskLevel) return opps.filter((o) => o.risk === riskLevel);
    return opps.sort((a, b) => b.apy - a.apy);
  }

  private getMockPrice(address: string): TokenPrice | null {
    return Object.values(MOCK_PRICES).find((p) => p.address === address) || null;
  }
}
