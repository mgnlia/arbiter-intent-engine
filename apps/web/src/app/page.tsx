'use client';
import { useState, useEffect, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const EXAMPLES = [
  "Give me 15% APY with low risk",
  "Swap 100 USDC to SOL best execution",
  "Lend 500 USDC on Drift",
  "Rebalance portfolio to 60% SOL 40% USDC",
];

const MOCK_PRICES = {
  SOL:  { price: 185.42, change: 3.2 },
  USDC: { price: 1.00,   change: 0.01 },
  JUP:  { price: 1.24,   change: -1.5 },
  BONK: { price: 0.0000285, change: 8.7 },
};

const MOCK_YIELDS = [
  { pool: 'USDC Lending', protocol: 'Drift',   apy: 8.2,  risk: 'low' },
  { pool: 'SOL-USDC CLMM', protocol: 'Orca',   apy: 22.4, risk: 'medium' },
  { pool: 'JUP-USDC',      protocol: 'Orca',   apy: 35.8, risk: 'medium' },
  { pool: 'RAY-SOL Farm',  protocol: 'Raydium', apy: 48.2, risk: 'high' },
  { pool: 'BONK-SOL Farm', protocol: 'Raydium', apy: 120.5,risk: 'high' },
];

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [events, setEvents] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    try {
      const es = new EventSource(`${API}/api/stream`);
      esRef.current = es;
      ['intent_received','intent_parsed','plan_built','execution_complete'].forEach(evt => {
        es.addEventListener(evt, () => setEvents(p => [`${evt.replace(/_/g,' ')} — ${new Date().toLocaleTimeString()}`, ...p].slice(0,10)));
      });
    } catch {}
    return () => esRef.current?.close();
  }, []);

  const run = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/intent`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ intent: text, execute: false })
      });
      setResult(await r.json());
    } catch {
      setResult({ _error: true });
    }
    setLoading(false);
  };

  const riskClr = (r: string) => r==='low'?'text-emerald-400':r==='medium'?'text-yellow-400':'text-red-400';

  return (
    <div className="min-h-screen bg-[#070711] text-slate-100 font-sans">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-400 flex items-center justify-center text-sm font-bold">A</div>
        <span className="font-bold text-lg tracking-tight">Arbiter</span>
        <span className="ml-2 text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">AI Intent Engine · Solana</span>
        <span className="ml-auto text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">● Simulation Mode</span>
      </nav>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Hero */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent mb-3">
            Say what you want. Arbiter executes it.
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">Natural language → autonomous DeFi execution across Jupiter, Drift, Orca, Raydium, and Jito on Solana.</p>
        </div>

        {/* Intent input */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && run(input)}
              placeholder="e.g. Give me 15% APY with low risk…"
              className="flex-1 bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-xl px-4 py-3 text-sm outline-none transition-colors placeholder-slate-500"
            />
            <button onClick={() => run(input)} disabled={loading||!input.trim()}
              className="bg-gradient-to-r from-violet-500 to-emerald-400 rounded-xl px-6 py-3 font-semibold text-sm disabled:opacity-40 min-w-[100px] flex items-center justify-center gap-2">
              {loading ? <span className="animate-spin">⟳</span> : '⚡'} Execute
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => { setInput(ex); run(ex); }}
                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4 animate-in fade-in">
            {result._error ? (
              <p className="text-slate-400 text-sm">⚠️ Backend offline — running in demo mode. Deploy agent to Railway to enable live execution.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>
                  <span className="font-semibold text-sm">Intent: <span className="text-violet-400">{result.parsed?.type}</span></span>
                  <span className="ml-auto text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">{Math.round((result.parsed?.confidence||0)*100)}% confidence</span>
                </div>
                <p className="text-sm text-slate-300">{result.parsed?.reasoning}</p>
                {result.plan && (
                  <div className="border-t border-slate-800 pt-4 space-y-3">
                    <p className="text-sm font-medium">{result.plan.description}</p>
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span>Risk Score: <span className="text-yellow-400 font-bold">{result.plan.riskScore}/100</span></span>
                      <span>Est. Gas: <span className="text-white">${result.plan.totalEstimatedGasUsd?.toFixed(4)}</span></span>
                      {result.plan.expectedApyRange && <span>APY: <span className="text-emerald-400 font-bold">{result.plan.expectedApyRange[0]}–{result.plan.expectedApyRange[1]}%</span></span>}
                    </div>
                    <div className="space-y-1.5">
                      {result.plan.steps?.map((s: any, i: number) => (
                        <div key={s.id} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 text-xs">
                          <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold shrink-0">{i+1}</span>
                          <span className="font-mono text-violet-300">{s.protocol}</span>
                          <span className="text-slate-400">{s.action.replace(/_/g,' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Bottom grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Prices */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Live Prices</h3>
            <div className="space-y-2">
              {Object.entries(MOCK_PRICES).map(([sym, d]) => (
                <div key={sym} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{sym}</span>
                  <div className="text-right">
                    <div>${d.price < 0.001 ? d.price.toExponential(2) : d.price.toLocaleString()}</div>
                    <div className={d.change>=0?'text-emerald-400 text-xs':'text-red-400 text-xs'}>{d.change>=0?'+':''}{d.change}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yields */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Top Yields</h3>
            <div className="space-y-2">
              {MOCK_YIELDS.map((y, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div><div className="font-medium text-sm">{y.pool}</div><div className="text-slate-400">{y.protocol}</div></div>
                  <div className="text-right"><div className="text-emerald-400 font-bold">{y.apy}%</div><div className={riskClr(y.risk)}>{y.risk}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* Live events */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Agent Events</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {events.length===0 ? <p className="text-xs text-slate-500">Waiting for events…</p>
                : events.map((ev,i) => <div key={i} className="text-xs bg-slate-800 rounded px-2 py-1.5 text-violet-300">{ev}</div>)}
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-600 py-6">
        Arbiter v0.1 · Colosseum Spring 2026 · Built with Solana Agent Kit V2 · Not financial advice
      </footer>
    </div>
  );
}
