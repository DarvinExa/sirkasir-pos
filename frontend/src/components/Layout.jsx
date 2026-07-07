import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Receipt,
  UtensilsCrossed,
  Grid3x3,
  ChefHat,
  Wallet,
  Truck,
  ShoppingBasket,
  ClipboardCheck,
  BarChart3,
  Users,
  TicketPercent,
  LineChart,
  LayoutGrid,
  Boxes,
  UserCog,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../store/auth';

// Menu operasional (semua peran)
const OPS = [
  { to: '/tables', label: 'Meja & Kasir', icon: Grid3x3 },
  { to: '/kitchen', label: 'Dapur (KDS)', icon: ChefHat },
  { to: '/shift', label: 'Shift & Kas', icon: Wallet },
  { to: '/customers', label: 'Pelanggan', icon: Users },
  { to: '/history', label: 'Riwayat', icon: Receipt },
];

// Back office (owner/manager)
const BACK_OFFICE = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analitik', icon: LineChart },
  { to: '/reports', label: 'Laporan', icon: BarChart3 },
  { to: '/menu', label: 'Kelola Menu', icon: UtensilsCrossed },
  { to: '/promo', label: 'Promo & Diskon', icon: TicketPercent },
  { to: '/table-manager', label: 'Kelola Meja', icon: LayoutGrid },
  { to: '/ingredients', label: 'Bahan & Stok', icon: Boxes },
  { to: '/suppliers', label: 'Supplier', icon: Truck },
  { to: '/purchases', label: 'Pembelian / PO', icon: ShoppingBasket },
  { to: '/opname', label: 'Stok Opname', icon: ClipboardCheck },
  { to: '/users', label: 'Pengguna', icon: UserCog },
  { to: '/settings', label: 'Pengaturan', icon: SettingsIcon },
];

function NavItem({ item }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          isActive ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      <item.icon size={19} />
      <span className="hidden sm:inline">{item.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isManager = user?.role === 'owner' || user?.role === 'manager';

  function handleLogout() {
    logout();
    nav('/login');
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <aside className="flex w-20 flex-col items-center gap-1 overflow-y-auto border-r border-slate-200 bg-white py-4 sm:w-56 sm:items-stretch sm:px-3">
        <div className="mb-4 flex items-center gap-2 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <UtensilsCrossed size={20} />
          </div>
          <div className="hidden sm:block">
            <div className="font-bold leading-tight">Sirkasir</div>
            <div className="text-xs text-slate-400">POS Resto</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {OPS.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
          {isManager && (
            <>
              <div className="mt-3 hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:block">
                Back Office
              </div>
              <div className="mt-2 border-t border-slate-100 pt-2 sm:hidden" />
              {BACK_OFFICE.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <div className="hidden rounded-xl bg-slate-50 px-3 py-2 sm:block">
            <div className="truncate text-sm font-semibold">{user?.name}</div>
            <div className="text-xs capitalize text-slate-400">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={19} />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
