const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function submitIntent(intent: string, execute = false) {
  const r = await fetch(`${BASE}/api/intent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent, execute })
  });
  return r.json();
}

export async function getPrices() {
  try { const r = await fetch(`${BASE}/api/prices`); return r.json(); }
  catch { return { prices: {} }; }
}

export async function getYields(risk?: string) {
  try {
    const url = risk ? `${BASE}/api/yields?risk=${risk}` : `${BASE}/api/yields`;
    const r = await fetch(url); return r.json();
  } catch { return { opportunities: [] }; }
}

export function createSSE(onEvent: (type: string, data: any) => void) {
  const es = new EventSource(`${BASE}/api/stream`);
  ['intent_received','intent_parsed','plan_built','execution_started','execution_complete'].forEach(evt => {
    es.addEventListener(evt, (e: any) => onEvent(evt, JSON.parse(e.data)));
  });
  return es;
}
