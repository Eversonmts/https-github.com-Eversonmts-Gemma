import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  Package, 
  ShoppingCart, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const StatCard = ({ title, value, icon: Icon, trend, color, to }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
  >
    <Link to={to || '#'} className={cn(!to && "pointer-events-none")}>
      <div className="flex justify-between items-start">
        <div className={cn("p-3 rounded-xl", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={cn("flex items-center text-xs font-bold px-2 py-1 rounded-full", trend > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold mt-1 text-slate-900">{value}</h3>
      </div>
    </Link>
  </motion.div>
);

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    activeClients: 0,
    productsStock: 0,
    pendingOrders: 0
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [ordersRes, clientsRes, productsRes, recentRes] = await Promise.all([
        supabase.from('orders').select('total, status'),
        supabase.from('clients').select('id', { count: 'exact' }),
        supabase.from('products').select('stock'),
        supabase.from('orders').select('*, clients(name)').order('created_at', { ascending: false }).limit(5)
      ]);

      if (ordersRes.error) console.warn("Dashboard Orders fetch error:", ordersRes.error);
      if (clientsRes.error) console.warn("Dashboard Clients fetch error:", clientsRes.error);
      if (productsRes.error) console.warn("Dashboard Products fetch error:", productsRes.error);
      if (recentRes.error) console.warn("Dashboard Recent fetch error:", recentRes.error);

      const orders = ordersRes.data || [];
      const entregueStatus = 'entregue';
      const canceladoStatus = 'cancelado';
      const remarcadoStatus = 'remarcado';

      const totalSales = orders
        .filter(o => o.status === entregueStatus)
        .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
        
      const pendingOrders = orders
        .filter(o => o.status !== entregueStatus && o.status !== canceladoStatus && o.status !== remarcadoStatus)
        .length;

      setStats({
        totalSales,
        activeClients: clientsRes.count || 0,
        productsStock: (productsRes.data || []).reduce((acc, p) => acc + (p.stock || 0), 0),
        pendingOrders
      });
      setRecentOrders(recentRes.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Real-time subscriptions
    const sub = supabase.channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display">Visão Geral</h1>
        <p className="text-slate-500">Bem-vindo de volta! Aqui está um resumo do seu negócio hoje.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Nova Venda', to: '/sales/new', icon: ShoppingCart, color: 'bg-primary' },
          { label: 'Novo Cliente', to: '/clients', icon: Users, color: 'bg-slate-800' },
          { label: 'Novo Produto', to: '/products', icon: Package, color: 'bg-slate-800' },
          { label: 'Financeiro', to: '/finance', icon: TrendingUp, color: 'bg-slate-800' },
        ].map((action) => (
          <Link 
            key={action.label}
            to={action.to}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group"
          >
            <div className={cn("p-3 rounded-xl mb-3 text-white transition-transform group-hover:scale-110", action.color)}>
              <action.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">{action.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Vendas Totais" 
          value={`R$ ${stats.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={TrendingUp} 
          color="bg-blue-500"
          trend={12} 
          to="/finance"
        />
        <StatCard 
          title="Clientes Ativos" 
          value={stats.activeClients} 
          icon={Users} 
          color="bg-purple-500"
          trend={5} 
          to="/clients"
        />
        <StatCard 
          title="Produtos em Estoque" 
          value={stats.productsStock} 
          icon={Package} 
          color="bg-orange-500"
          to="/products"
        />
        <StatCard 
          title="Pedidos Pendentes" 
          value={stats.pendingOrders} 
          icon={ShoppingCart} 
          color="bg-emerald-500"
          to="/orders"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Últimos Pedidos
            </h3>
            <Link to="/orders" className="text-sm text-primary font-bold hover:underline">Ver todos</Link>
          </div>
          <div className="space-y-4">
            {loading ? (
              Array(3).fill(0).map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-xl" />)
            ) : recentOrders.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Nenhum pedido encontrado.</p>
            ) : (
              recentOrders.map((order) => (
                <Link 
                  key={order.id} 
                  to="/orders" 
                  className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                      #{order.id.slice(-4).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{order.clients?.name || 'Cliente'}</h4>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {new Date(order.created_at).toLocaleDateString('pt-BR')} às {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">R$ {Number(order.total).toFixed(2)}</p>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                      order.status === 'entregue' ? "bg-green-100 text-green-700" : 
                      order.status === 'cancelado' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {order.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Desempenho de Vendas
            </h3>
          </div>
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-400">Gráfico de evolução (D3/Recharts)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
