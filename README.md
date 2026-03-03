# Arbiter — AI Intent Engine for Solana DeFi

> Natural language → autonomous DeFi execution on Solana

**Colosseum Spring Hackathon 2026**

## What it does

Arbiter lets you express DeFi goals in plain English and executes them autonomously across Solana protocols:

- `"Give me 15% APY low risk"` → allocates across Drift lending + Orca LP, auto-rebalances
- `"Swap $1K USDC to SOL best execution"` → Jupiter Ultra + Jito MEV protection  
- `"Lend 500 USDC on Drift"` → direct Drift deposit
- `"Rebalance to 60% SOL 40% USDC"` → multi-hop Jupiter swaps

## Architecture

```
User Intent (NL)
      ↓
Intent Parser (Groq/Llama3 or rule-based fallback)
      ↓
Strategy Engine (maps intent → execution plan)
      ↓
Executor (Solana Agent Kit V2)
      ↓
Jupiter Ultra / Drift / Orca / Raydium / Jito
```

## Tech Stack

- **Agent**: TypeScript + Fastify + Solana Agent Kit V2
- **AI**: Groq/Llama3-70b (OpenAI fallback)
- **Protocols**: Jupiter Ultra, Drift, Orca CLMM, Raydium, Jito
- **Frontend**: Next.js 14 + Tailwind
- **Data**: Helius RPC, Birdeye price feeds

## Quick Start

```bash
# Agent backend
cd apps/agent
cp .env.example .env  # fill in your keys
npm install
npm run dev

# Frontend
cd apps/web
npm install
npm run dev
```

## Environment Variables

```
HELIUS_API_KEY=       # helius.dev (free)
BIRDEYE_API_KEY=      # birdeye.so
GROQ_API_KEY=         # console.groq.com (free)
OPENAI_API_KEY=       # fallback
WALLET_PRIVATE_KEY=   # base58 encoded
SIMULATION_MODE=true  # set false for live execution
```

## Novelty

Unlike generic trading bots, Arbiter introduces the **Intent Primitive** — a semantic layer between human goals and DeFi execution. The strategy engine dynamically composes multi-protocol execution plans from a single natural language statement, with risk-aware routing and MEV protection built in.
