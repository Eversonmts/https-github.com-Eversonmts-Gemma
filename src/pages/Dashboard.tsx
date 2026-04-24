import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
  >
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
  </motion.div>
);

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    activeClients: 0,
    productsStock: 0,
    pendingOrders: 0
  });

  const fetchStats = async () => {
    try {
      const [ordersRes, clientsRes, productsRes] = await Promise.all([
        supabase.from('orders').select('total, status'),
        supabase.from('clients').select('id', { count: 'exact' }),
        supabase.from('products').select('stock')
      ]);

      if (ordersRes.error) console.warn("Dashboard Orders fetch error:", ordersRes.error);
      if (clientsRes.error) console.warn("Dashboard Clients fetch error:", clientsRes.error);
      if (productsRes.error) console.warn("Dashboard Products fetch error:", productsRes.error);

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
    } catch (error) {
      console.error("Dashboard fetch error:", error);
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Vendas Totais" 
          value={`R$ ${stats.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={TrendingUp} 
          color="bg-blue-500"
          trend={12} 
        />
        <StatCard 
          title="Clientes Ativos" 
          value={stats.activeClients} 
          icon={Users} 
          color="bg-purple-500"
          trend={5} 
        />
        <StatCard 
          title="Produtos em Estoque" 
          value={stats.productsStock} 
          icon={Package} 
          color="bg-orange-500"
        />
        <StatCard 
          title="Pedidos Pendentes" 
          value={stats.pendingOrders} 
          icon={ShoppingCart} 
          color="bg-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Últimos Pedidos
            </h3>
            <button className="text-sm text-primary font-bold hover:underline">Ver todos</button>
          </div>
          <div className="space-y-4">
            <p className="text-slate-400 text-center py-8">Carregando atividades recentes...</p>
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
