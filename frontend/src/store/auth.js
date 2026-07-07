import { create } from 'zustand';

let stored = null;
try {
  stored = JSON.parse(localStorage.getItem('sirkasir_auth') || 'null');
} catch {
  stored = null;
}

export const useAuth = create((set) => ({
  token: stored?.token || null,
  user: stored?.user || null,
  setAuth: (token, user) => {
    localStorage.setItem('sirkasir_auth', JSON.stringify({ token, user }));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('sirkasir_auth');
    set({ token: null, user: null });
  },
}));
