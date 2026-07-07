import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Delete, LogIn, KeyRound, Mail, UtensilsCrossed } from 'lucide-react';
import { api, apiError } from '../api/client';
import { useAuth } from '../store/auth';

export default function Login() {
  const nav = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [mode, setMode] = useState('pin');
  const [email, setEmail] = useState('owner@sirkasir.test');
  const [password, setPassword] = useState('owner123');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  async function loginEmail(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.token, data.user);
      toast.success(`Selamat datang, ${data.user.name}!`);
      nav('/');
    } catch (err) {
      toast.error(apiError(err, 'Gagal login'));
    } finally {
      setLoading(false);
    }
  }

  async function loginPin() {
    if (pin.length < 4) return toast.error('PIN minimal 4 digit');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/pin-login', { pin });
      setAuth(data.token, data.user);
      toast.success(`Halo, ${data.user.name}!`);
      nav('/');
    } catch (err) {
      toast.error(apiError(err, 'PIN salah'));
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white">
            <UtensilsCrossed size={30} />
          </div>
          <h1 className="text-2xl font-bold">Sirkasir</h1>
          <p className="text-sm text-slate-400">POS Resto</p>
        </div>

        <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setMode('pin')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              mode === 'pin' ? 'bg-white shadow' : 'text-slate-500'
            }`}
          >
            <KeyRound size={16} /> PIN
          </button>
          <button
            onClick={() => setMode('email')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              mode === 'email' ? 'bg-white shadow' : 'text-slate-500'
            }`}
          >
            <Mail size={16} /> Email
          </button>
        </div>

        {mode === 'pin' ? (
          <div>
            <div className="mb-5 flex justify-center gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-brand' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {keys.map((k) => {
                if (k === 'clear')
                  return (
                    <button
                      key={k}
                      onClick={() => setPin('')}
                      className="rounded-xl py-4 text-sm font-medium text-slate-400 hover:bg-slate-100"
                    >
                      Hapus
                    </button>
                  );
                if (k === 'del')
                  return (
                    <button
                      key={k}
                      onClick={() => setPin((p) => p.slice(0, -1))}
                      className="flex items-center justify-center rounded-xl py-4 text-slate-500 hover:bg-slate-100"
                    >
                      <Delete size={22} />
                    </button>
                  );
                return (
                  <button
                    key={k}
                    onClick={() => setPin((p) => (p + k).slice(0, 6))}
                    className="rounded-xl bg-slate-50 py-4 text-xl font-semibold hover:bg-slate-100 active:bg-brand-100"
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            <button
              onClick={loginPin}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              <LogIn size={18} /> Masuk
            </button>
            <p className="mt-4 text-center text-xs text-slate-400">
              PIN demo: Owner 1111 / Kasir 2222
            </p>
          </div>
        ) : (
          <form onSubmit={loginEmail} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              <LogIn size={18} /> Masuk
            </button>
            <p className="text-center text-xs text-slate-400">
              Demo: owner@sirkasir.test / owner123
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
