import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import History from './pages/History.jsx';
import MenuManager from './pages/MenuManager.jsx';
import Tables from './pages/Tables.jsx';
import OrderScreen from './pages/OrderScreen.jsx';
import Kitchen from './pages/Kitchen.jsx';
import Shift from './pages/Shift.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Purchases from './pages/Purchases.jsx';
import Opname from './pages/Opname.jsx';
import Reports from './pages/Reports.jsx';
import Customers from './pages/Customers.jsx';
import Promo from './pages/Promo.jsx';
import Analytics from './pages/Analytics.jsx';
import TableManager from './pages/TableManager.jsx';
import Ingredients from './pages/Ingredients.jsx';
import UsersManager from './pages/UsersManager.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ children }) {
  const token = useAuth((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// Halaman awal sesuai peran: owner/manager langsung ke Dashboard, kasir ke Meja.
function Home() {
  const user = useAuth((s) => s.user);
  const isManager = user?.role === 'owner' || user?.role === 'manager';
  return <Navigate to={isManager ? '/dashboard' : '/tables'} replace />;
}

function RoleRoute({ roles, children }) {
  const user = useAuth((s) => s.user);
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

function Manager({ children }) {
  return <RoleRoute roles={['owner', 'manager']}>{children}</RoleRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/order/:id" element={<OrderScreen />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/history" element={<History />} />
        <Route path="/shift" element={<Shift />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/dashboard" element={<Manager><Dashboard /></Manager>} />
        <Route path="/analytics" element={<Manager><Analytics /></Manager>} />
        <Route path="/reports" element={<Manager><Reports /></Manager>} />
        <Route path="/menu" element={<Manager><MenuManager /></Manager>} />
        <Route path="/promo" element={<Manager><Promo /></Manager>} />
        <Route path="/table-manager" element={<Manager><TableManager /></Manager>} />
        <Route path="/ingredients" element={<Manager><Ingredients /></Manager>} />
        <Route path="/suppliers" element={<Manager><Suppliers /></Manager>} />
        <Route path="/purchases" element={<Manager><Purchases /></Manager>} />
        <Route path="/opname" element={<Manager><Opname /></Manager>} />
        <Route path="/users" element={<Manager><UsersManager /></Manager>} />
        <Route path="/settings" element={<Manager><Settings /></Manager>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
