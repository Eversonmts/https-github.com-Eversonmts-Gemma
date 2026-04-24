import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle, 
  ChevronRight, 
  User, 
  Package, 
  Calendar,
  Search,
  MapPin,
  Phone,
  MessageCircle,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import Fuse from 'fuse.js';
import { useDebounce } from '../hooks/useDebounce';

export default function Orders() {
  const { isDriver, isSeller, isAdmin, profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const fetchOrders = async () => {
    const { data: oData } = await supabase
      .from('orders')
      .select(`
        *, 
        clients(name, phone, address), 
        seller:seller_id(full_name), 
        driver:driver_id(full_name), 
        order_items(*, products(name))
      `);
    if (oData) setOrders(oData);
    setLoading(false);
  };

  useEffect(() => {
    const fetchStatuses = async () => {
      const { data: cfg } = await supabase.from('settings').select('*').eq('id', 'config').single();
      let s = [];
      if (cfg?.value?.order_statuses) {
        s = cfg.value.order_statuses;
      } else {
        s = [
          { id: 'novo', label: 'Pedido feito', color: 'blue' },
          { id: 'confirmado', label: 'Confirmado', color: 'emerald' },
          { id: 'em-rota', label: 'Em rota', color: 'purple' },
          { id: 'entregue', label: 'Entregue', color: 'slate' },
          { id: 'cancelado', label: 'Cancelado', color: 'red' },
          { id: 'remarcado', label: 'Remarcado', color: 'orange' }
        ];
      }
      setStatuses(s);
      
      if (isDriver) {
        const confirmed = s.find((x: any) => x.id === 'confirmado');
        setActiveTab(confirmed ? confirmed.id : (s[0]?.id || ''));
      } else {
        if (s.length > 0) setActiveTab(s[0].id);
      }
    };
    
    fetchStatuses();
    fetchOrders();

    const channel = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isDriver]);

  const updateStatus = async (orderId: string, newStatusId: string) => {
    try {
      const statusLabel = statuses.find(s => s.id === newStatusId)?.label || newStatusId;
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatusId,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (error) throw error;
      toast.success(`Pedido movido para ${statusLabel}`);
    } catch (e) {
      toast.error('Erro ao atualizar status.');
    }
  };

  const getColorClass = (colorName: string) => {
    const maps: any = {
      blue: 'text-blue-500 bg-blue-50 border-blue-200',
      orange: 'text-orange-500 bg-orange-50 border-orange-200',
      emerald: 'text-emerald-500 bg-emerald-50 border-emerald-200',
      purple: 'text-purple-500 bg-purple-50 border-purple-200',
      red: 'text-red-500 bg-red-50 border-red-200',
      slate: 'text-slate-500 bg-slate-50 border-slate-200',
    };
    return maps[colorName] || maps.blue;
  };

  const getStatusIcon = (statusId: string) => {
    if (statusId === 'cancelado') return XCircle;
    if (statusId === 'entregue' || statusId === 'confirmado') return CheckCircle2;
    if (statusId === 'em-rota') return Truck;
    if (statusId === 'novo') return Clock;
    return Package;
  };

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      // Basic status match
      if (o.status !== activeTab) return false;

      // Direct role restrictions
      if (isAdmin) return true;
      
      if (isSeller) return true; 

      if (isDriver) {
        const relevantStatuses = ['confirmado', 'em-rota', 'entregue'];
        if (!relevantStatuses.includes(o.status)) return false;
        if (o.driver_id && o.driver_id !== profile?.id) return false;
        return true;
      }
      return true;
    });

    if (!debouncedSearch) return result;

    const fuse = new Fuse(result, {
      keys: ['id', 'status', 'notes', 'payment_method'],
      threshold: 0.3,
    });

    return fuse.search(debouncedSearch).map(r => r.item);
  }, [orders, activeTab, isAdmin, isSeller, isDriver, profile, debouncedSearch]);

  return (
    <div className="p-4 md:p-8 space-y-6 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display">Pedidos</h1>
          <p className="text-slate-500">Acompanhe e gerencie o fluxo de entregas.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar por ID, observação ou forma de pgto..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {statuses.map((status) => {
          const count = orders.filter(o => o.status === status.id).length;
          const Icon = getStatusIcon(status.id);
          return (
            <button
              key={status.id}
              onClick={() => setActiveTab(status.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap font-bold text-sm",
                activeTab === status.id 
                  ? "bg-white border-primary text-primary shadow-sm ring-2 ring-primary/10" 
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              <Icon className="w-4 h-4" />
              {status.label}
              {count > 0 && (
                <span className={cn("ml-1 px-1.5 py-0.5 rounded-full text-[10px]", activeTab === status.id ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => {
              const currentStatusIndex = statuses.findIndex(s => s.id === order.status);
              let nextStatus = null;
              if (currentStatusIndex !== -1 && currentStatusIndex < statuses.length - 1) {
                const candidate = statuses[currentStatusIndex + 1];
                if (candidate.id !== 'cancelado' && candidate.id !== 'remarcado') {
                  nextStatus = candidate;
                }
              }

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={order.id}
                  className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
                >
                  <div className="p-0">
                    {/* Header do Card - ID e Status */}
                    <div className={cn("px-6 py-3 shrink-0 flex items-center justify-between border-b", getColorClass(statuses.find(s => s.id === order.status)?.color))}>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs tracking-widest uppercase opacity-70">Pedido</span>
                        <span className="font-bold text-base tracking-tighter">#{order.id.slice(-6).toUpperCase()}</span>
                        <span className="ml-2 px-2 py-0.5 rounded-md bg-white/30 text-[10px] font-black uppercase text-slate-700 border border-white/20 whitespace-nowrap">
                          {order.payment_method}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                           <span className="text-[10px] font-black uppercase opacity-60 tracking-wider">Situação Atual</span>
                           <span className="text-xs font-black uppercase text-slate-800">{statuses.find(s => s.id === order.status)?.label || order.status}</span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center border border-white/50 backdrop-blur-sm shadow-inner">
                          {(() => {
                            const StatusIcon = getStatusIcon(order.status);
                            return <StatusIcon className="w-5 h-5" />;
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Cliente e WhatsApp */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</label>
                          <h4 className="text-xl font-black text-slate-900 leading-none">{order.clients?.name || 'Cliente Geral'}</h4>
                          <div className="flex items-center gap-3 mt-2">
                            {order.clients?.phone && (
                              <a 
                                href={`https://wa.me/55${order.clients.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors shadow-sm"
                              >
                                <MessageCircle className="w-4 h-4" />
                                WhatsApp
                              </a>
                            )}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                              <Phone className="w-4 h-4" />
                              {order.clients?.phone || 'Sem fone'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Geral</label>
                          <p className="text-2xl font-black text-primary tracking-tighter">R$ {Number(order.total || 0).toFixed(2).replace('.', ',')}</p>
                        </div>
                      </div>

                      {/* Endereço */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                          <MapPin className="w-6 h-6 text-red-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Endereço de Entrega</label>
                            {order.clients?.address && (
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.clients.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-black text-blue-600 hover:underline"
                              >
                                ABRIR NO MAPS
                              </a>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-700 mt-1.5 leading-tight">{order.clients?.address || 'Endereço não informado'}</p>
                        </div>
                      </div>

                      {/* Produtos e Itens */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                           <ShoppingBag className="w-4 h-4 text-slate-400" />
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Resumo do Pedido ({order.order_items?.length || 0} itens)</label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(order.order_items || []).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl shadow-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                  {item.quantity}x
                                </div>
                                <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{item.products?.name || `Produto #${item.product_id?.slice(0, 4)}`}</span>
                              </div>
                              <span className="text-xs font-black text-slate-900">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Equipe Responsável */}
                      <div className="flex items-center justify-between pt-4 border-t border-dashed border-slate-200">
                        <div className="flex gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Vendido por</label>
                            <div className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{order.seller?.full_name || 'Venda Direta'}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Entregador</label>
                            <div className="flex items-center gap-1.5">
                              <Truck className="w-3 h-3 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{order.driver?.full_name || 'A definir'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {nextStatus && (
                            <button 
                              onClick={() => updateStatus(order.id, nextStatus.id)} 
                              className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg",
                                nextStatus.color === 'emerald' ? "bg-emerald-600 shadow-emerald-200" :
                                nextStatus.color === 'orange' ? "bg-orange-500 shadow-orange-200" :
                                nextStatus.color === 'purple' ? "bg-purple-600 shadow-purple-200" :
                                nextStatus.color === 'red' ? "bg-red-500 shadow-red-200" :
                                nextStatus.color === 'slate' ? "bg-slate-800 shadow-slate-200" :
                                "bg-primary shadow-primary/30"
                              )}
                            >
                              MOVER PARA: {nextStatus.label.toUpperCase()}
                            </button>
                          )}
                          
                          {order.status !== 'entregue' && order.status !== 'cancelado' && (
                            <div className="flex gap-1">
                              <button 
                                onClick={() => updateStatus(order.id, 'cancelado')} 
                                className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                title="Cancelar"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => updateStatus(order.id, 'remarcado')} 
                                className="p-2.5 text-orange-500 hover:bg-orange-50 rounded-xl transition-colors"
                                title="Remarcar"
                              >
                                <Calendar className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                          <button className="p-2.5 text-slate-300 hover:bg-slate-100 rounded-xl transition-colors"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-16 text-center">
              <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Nenhum pedido nesta etapa.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
