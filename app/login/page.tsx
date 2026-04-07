'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    }

    setLoading(false);
  }

  return (
    <>
      <div className="mesh-bg" />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center mb-4">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">GPU Deals</h1>
            <p className="text-[11px] text-zinc-600 font-mono mt-1">GPU NEWS MONITOR</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="panel rounded-xl p-6 space-y-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-zinc-600 block mb-2">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-zinc-300 outline-none focus:border-accent/50 transition-colors"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-zinc-600 block mb-2">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-zinc-300 outline-none focus:border-accent/50 transition-colors"
                placeholder="Enter password"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/8 border border-rose-500/10">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-xs text-rose-400">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-2.5 bg-gradient-to-r from-accent to-indigo-600 hover:from-accent/90 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all glow-btn flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">Signing in...</span>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-zinc-800 font-mono mt-6">GPU DEALS v2.0</p>
        </div>
      </div>
    </>
  );
}
