import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { 
  BarChart3, 
  Users, 
  Package, 
  ShoppingCart, 
  Truck, 
  UserSquare2, 
  DollarSign, 
  Settings as SettingsIcon,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  ClipboardList
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Orders from './pages/Orders';
import NewSale from './pages/NewSale';
import Drivers from './pages/Drivers';
import Sellers from './pages/Sellers';
import Finance from './pages/Finance';
import Settings from './pages/Settings';

// Pages - removed inline definitions

const SidebarItem: React.FC<{ to: string, icon: any, label: string, active: boolean }> = ({ to, icon: Icon, label, active }) => (
  <Link 
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
      active 
        ? "bg-primary text-white shadow-lg shadow-primary/20" 
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    )}
  >
    <Icon className={cn("w-5 h-5", active ? "text-white" : "group-hover:scale-110 transition-transform")} />
    <span className="font-medium">{label}</span>
  </Link>
);

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, isAdmin, isSeller, isDriver, isApproved, loading } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on navigation on mobile
  React.useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ClipboardList className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Aguardando Aprovação</h1>
          <p className="text-slate-500 mt-4 mb-8">Seu cadastro foi realizado com sucesso. Um administrador irá revisar seu acesso em breve.</p>
          <button onClick={logout} className="w-full py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Sair da Conta</button>
        </motion.div>
      </div>
    );
  }

  const menuItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ['admin'] },
    { to: "/orders", icon: ClipboardList, label: "Pedidos", roles: ['admin', 'seller', 'driver'] },
    { to: "/sales/new", icon: ShoppingCart, label: "Nova Venda", roles: ['admin', 'seller', 'driver'] },
    { to: "/clients", icon: Users, label: "Clientes", roles: ['admin', 'seller', 'driver'] },
    { to: "/products", icon: Package, label: "Produtos", roles: ['admin', 'seller'] },
    { to: "/drivers", icon: Truck, label: "Entregadores", roles: ['admin'] },
    { to: "/sellers", icon: UserSquare2, label: "Vendedores", roles: ['admin'] },
    { to: "/finance", icon: DollarSign, label: "Financeiro", roles: ['admin'] },
    { to: "/settings", icon: SettingsIcon, label: "Configurações", roles: ['admin'] },
  ];

  const visibleItems = menuItems.filter(item => {
    if (isAdmin) return true;
    if (isSeller && item.roles.includes('seller')) return true;
    if (isDriver && item.roles.includes('driver')) return true;
    return false;
  });

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Mobile Backdrop */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 bg-white border-r border-slate-200 transition-all duration-300 z-[70]",
        sidebarOpen ? "w-64 translate-x-0" : isMobile ? "-translate-x-full" : "w-16"
      )}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 shrink-0">
            {sidebarOpen && <span className="text-xl font-bold tracking-tight text-primary">GEMA<span className="text-slate-400">.manager</span></span>}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-slate-100 rounded-md">
              <Menu className="w-5 h-5" />
            </button>
          </div>
          
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => (
              <SidebarItem 
                key={item.to} 
                to={item.to} 
                icon={item.icon} 
                label={sidebarOpen ? item.label : ""} 
                active={location.pathname === item.to} 
              />
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100 shrink-0">
            <button 
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className={cn(
        "flex-1 transition-all duration-300 w-full",
        sidebarOpen && !isMobile ? "ml-64" : !sidebarOpen && !isMobile ? "ml-16" : "ml-0"
      )}>
        {/* Mobile Header */}
        {isMobile && (
          <div className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-40">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
            <span className="text-lg font-bold text-primary">GEMA</span>
            <div className="w-10" /> {/* Spacer */}
          </div>
        )}
        <div className="max-w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

const Login = () => {
  const { user, login, loginWithEmail } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8"
      >
        <div className="text-center mb-8">
          <span className="text-3xl font-bold tracking-tighter text-primary">GEMA</span>
          <h1 className="text-2xl font-bold mt-6 text-slate-900">Bem-vindo de volta</h1>
          <p className="text-slate-500 mt-2">Acesse sua plataforma de gestão.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail</label>
            <input 
              required
              type="email" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Senha</label>
            <input 
              required
              type="password" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            disabled={loading}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar na Conta'}
          </button>
        </form>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Ou use Google</span></div>
        </div>

        <button 
          onClick={login}
          className="w-full h-12 bg-white border border-slate-300 rounded-xl flex items-center justify-center gap-3 font-medium text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" referrerPolicy="no-referrer" />
          Google
        </button>

        <p className="mt-8 text-center text-slate-500 text-sm">
          Não tem uma conta? <Link to="/signup" className="text-primary font-bold hover:underline">Cadastre-se</Link>
        </p>
      </motion.div>
    </div>
  );
};

const Signup = () => {
  const { user, signUp } = useAuth();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, name);
      toast.success('Cadastro realizado! Aguarde aprovação.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8"
      >
        <div className="text-center mb-8">
          <span className="text-3xl font-bold tracking-tighter text-primary">GEMA</span>
          <h1 className="text-2xl font-bold mt-6 text-slate-900">Criar Nova Conta</h1>
          <p className="text-slate-500 mt-2">Sua jornada de gestão começa aqui.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seu Nome</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail</label>
            <input 
              required
              type="email" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Senha</label>
            <input 
              required
              type="password" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            disabled={loading}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Finalizar Cadastro'}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-500 text-sm">
          Já tem conta? <Link to="/login" className="text-primary font-bold hover:underline">Entre aqui</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/clients" element={<Layout><Clients /></Layout>} />
          <Route path="/products" element={<Layout><Products /></Layout>} />
          <Route path="/orders" element={<Layout><Orders /></Layout>} />
          <Route path="/sales/new" element={<Layout><NewSale /></Layout>} />
          <Route path="/drivers" element={<Layout><Drivers /></Layout>} />
          <Route path="/sellers" element={<Layout><Sellers /></Layout>} />
          <Route path="/finance" element={<Layout><Finance /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
