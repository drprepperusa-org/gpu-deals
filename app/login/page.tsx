'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, LogIn, UserPlus, AlertCircle, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 800);
      } else {
        setError(data.error || 'Login failed');
        setLoading(false);
      }
    } catch {
      setError('Connection error');
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 800);
      } else {
        setError(data.error || 'Registration failed');
        setLoading(false);
      }
    } catch {
      setError('Connection error');
      setLoading(false);
    }
  }

  function switchMode(newMode: 'login' | 'register') {
    setMode(newMode);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
  }

  return (
    <>
      <div className="mesh-bg" />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center mb-3 sm:mb-4">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">GPU Deals</h1>
            <p className="text-[11px] text-zinc-600 font-mono mt-1">GPU NEWS MONITOR</p>
          </div>

          {/* ═══ LOGIN FORM ═══ */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="panel rounded-xl p-5 sm:p-6 space-y-4 fade-in">
              <h2 className="text-sm font-bold text-white text-center mb-2">Sign In</h2>

              <div>
                <label className="text-[10px] font-bold tracking-widest text-zinc-600 block mb-2">EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-zinc-300 outline-none focus:border-accent/50 transition-colors"
                  placeholder="you@example.com"
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
                disabled={loading || success}
                className="w-full px-6 py-2.5 bg-gradient-to-r from-accent to-indigo-600 hover:from-accent/90 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all glow-btn flex items-center justify-center gap-2"
              >
                {success ? (
                  <><CheckCircle className="w-4 h-4 text-accent2" /> Welcome back!</>
                ) : loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                ) : (
                  <><LogIn className="w-4 h-4" /> Sign In</>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-zinc-600">No account? </span>
                <button type="button" onClick={() => switchMode('register')} className="text-xs text-accent hover:text-accent/80 font-semibold transition-colors">
                  Create one
                </button>
              </div>
            </form>
          )}

          {/* ═══ REGISTER FORM ═══ */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="panel rounded-xl p-5 sm:p-6 space-y-4 fade-in">
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => switchMode('login')} className="p-1 rounded-lg hover:bg-dark-surface2 text-zinc-500 hover:text-white transition-all">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-bold text-white">Create Account</h2>
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest text-zinc-600 block mb-2">NAME</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-zinc-300 outline-none focus:border-accent/50 transition-colors"
                  placeholder="Your name"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest text-zinc-600 block mb-2">EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-zinc-300 outline-none focus:border-accent/50 transition-colors"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest text-zinc-600 block mb-2">PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-zinc-300 outline-none focus:border-accent/50 transition-colors"
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
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
                disabled={loading || success}
                className="w-full px-6 py-2.5 bg-gradient-to-r from-accent2 to-teal-600 hover:from-accent2/90 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all glow-btn flex items-center justify-center gap-2"
              >
                {success ? (
                  <><CheckCircle className="w-4 h-4 text-white" /> Account created!</>
                ) : loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Create Account</>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-zinc-600">Already have an account? </span>
                <button type="button" onClick={() => switchMode('login')} className="text-xs text-accent hover:text-accent/80 font-semibold transition-colors">
                  Sign in
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-[10px] text-zinc-800 font-mono mt-6">GPU DEALS v2.0</p>
        </div>

        {/* Success overlay */}
        {success && (
          <div className="fixed inset-0 z-50 bg-dark-bg/80 backdrop-blur-sm flex items-center justify-center fade-in">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
              <p className="text-sm text-zinc-400">Redirecting to dashboard...</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
