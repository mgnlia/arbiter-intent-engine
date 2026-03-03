'use client';
import { useState, useEffect, useRef } from 'react';
import { submitIntent, getPrices, getYields, createSSE } from '@/lib/api';
import { Zap, TrendingUp, Shield, Activity, ChevronRight, Loader2 } from 'lucide-react';

const EXAMPLES = [
  "Give me 15% APY with low risk",
  "Swap 100 USDC to SOL best execution",
  "Lend 500 USDC on Drift",
  "Rebalance my portfolio to 60% SOL 40% USDC",
  "Show me the highest yield opportunities",
];

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [prices, setPrices] = useState<any>({});
  const [yields, setYields] = useState<any[]>([]);
  const [events, setEvents] = useState<{type: string; data: any; ts: number}[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    getPrices().then(d => setPrices(d.prices || {}));
    getYields().then(d => setYields(d.opportunities || []));

    esRef.current = createSSE((type, data) => {
      setEvents(prev => [{type, data, ts: Date.now()}, ...prev].slice(0, 20));
    });
    return () => esRef.current?.close();
  }, []);

  const handleSubmit = async (intentText?: string) => {
    const text = intentText || input;
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await submitIntent(text, false);
      setResult(res);
    } catch (e) {
      setResult({ error: 'Failed to connect to agent backend' });
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (r: string) =>
    r === 'low' ? 'text-green-400' : r === 'medium' ? 'text-yellow-400' : 'text-red-400';

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-slate-100 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
            Arbiter
          </h1>
        </div>
        <p className="text-slate-400 text-sm">AI Intent Engine · Natural Language → Solana DeFi Execution</p>
      </div>

      {/* Price Ticker */}
      <div className="flex gap-4 overflow-x-auto mb-8 pb-2">
        {Object.entries(prices).map(([sym, p]: [string, any]) => (
          <div key={sym} className="flex-shrink-0 bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
            <div className="text-xs text-slate-400">{sym}</div>
            <div className="font-bold">${p.price < 0.001 ? p.price.toExponential(2) : p.price.toLocaleString()}</div>
            <div className={`text-xs ${p.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {p.priceChange24h >= 0 ? '+' : ''}{p.priceChange24h?.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Intent Box */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
            <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">What do you want to do?</h2>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. Give me 15% APY with low risk..."
                className="flex-1 bg-slate-800 rounded-xl px-4 py-3 text-sm outline-none border border-slate-700 focus:border-[#9945FF] transition-colors"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-xl px-5 py-3 font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Execute
              </button>
            </div>

            {/* Examples */}
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => { setInput(ex); handleSubmit(ex); }}
                  className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors border border-slate-700">
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              {result.error ? (
                <div className="text-red-400 text-sm">{result.error}</div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#14F195]" />
                    <span className="text-sm font-semibold">Intent Parsed</span>
                    <span className="ml-auto text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                      {result.parsed?.type} · {Math.round((result.parsed?.confidence || 0) * 100)}% confident
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{result.parsed?.reasoning}</p>

                  {result.plan && (
                    <>
                      <div className="border-t border-slate-800 pt-4">
                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Execution Plan</div>
                        <p className="text-sm text-slate-300 mb-3">{result.plan.description}</p>
                        <div className="flex gap-4 text-xs">
                          <span className="text-slate-400">Risk: <span className="text-yellow-400">{result.plan.riskScore}/100</span></span>
                          <span className="text-slate-400">Gas: <span className="text-slate-200">${result.plan.totalEstimatedGasUsd?.toFixed(4)}</span></span>
                          {result.plan.expectedApyRange && (
                            <span className="text-slate-400">APY: <span className="text-green-400">{result.plan.expectedApyRange[0]}-{result.plan.expectedApyRange[1]}%</span></span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {result.plan.steps?.map((step: any, i: number) => (
                          <div key={step.id} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-[#9945FF]/20 text-[#9945FF] flex items-center justify-center font-bold">{i+1}</span>
                            <span className="font-mono text-slate-300">{step.protocol}</span>
                            <span className="text-slate-400">{step.action.replace(/_/g,' ')}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Yield Opps */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#14F195]" />
              <h3 className="text-sm font-semibold">Top Yields</h3>
            </div>
            <div className="space-y-2">
              {yields.slice(0, 5).map((y, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium">{y.pool}</div>
                    <div className="text-slate-400">{y.protocol}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">{y.apy?.toFixed(1)}%</div>
                    <div className={riskColor(y.risk)}>{y.risk}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Events */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-[#9945FF]" />
              <h3 className="text-sm font-semibold">Live Events</h3>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {events.length === 0 ? (
                <div className="text-xs text-slate-500">Waiting for events...</div>
              ) : events.map((ev, i) => (
                <div key={i} className="text-xs bg-slate-800 rounded px-2 py-1.5">
                  <span className="text-[#9945FF] font-mono">{ev.type.replace(/_/g,' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Legend */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-semibold">Risk Levels</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex gap-2"><span className="text-green-400 font-bold">LOW</span><span className="text-slate-400">Drift lending, stablecoins (6-12% APY)</span></div>
              <div className="flex gap-2"><span className="text-yellow-400 font-bold">MED</span><span className="text-slate-400">Orca LP, diversified yield (12-25% APY)</span></div>
              <div className="flex gap-2"><span className="text-red-400 font-bold">HIGH</span><span className="text-slate-400">Raydium farms, meme pools (25%+ APY)</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-600">
        Arbiter v0.1 · Colosseum Spring 2026 · Simulation Mode · Not financial advice
      </div>
    </main>
  );
}
