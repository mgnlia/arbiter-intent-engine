import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Arbiter — AI Intent Engine', description: 'Natural language to Solana DeFi execution' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-screen bg-[#0a0a0f] text-slate-100">{children}</body></html>;
}
