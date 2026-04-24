import React, { useState, useEffect } from 'react';
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
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function Orders() {
  const { isDriver, isSeller, isAdmin, profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    const { data: oData } = await supabase
      .from('orders')
      .select('*, order_items(*)');
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

  const filteredOrders = orders.filter(o => {
    // Basic status match
    if (o.status !== activeTab) return false;

    // Direct role restrictions
    if (isAdmin) return true;
    
    if (isSeller) {
      // Seller sees everything or could be restricted to their sales (optional based on user preference)
      return true; 
    }

    if (isDriver) {
      // Driver sees orders specifically in 'confirmado' or 'em-rota' stages
      // AND optionally filters by assignment
      const relevantStatuses = ['confirmado', 'em-rota', 'entregue'];
      if (!relevantStatuses.includes(o.status)) return false;
      
      // If order is already assigned to another driver, hide it? 
      // User says "sent to one of the delivery people", implying assignment.
      if (o.driver_id && o.driver_id !== profile?.id) return false;
      
      return true;
    }

    return true;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display">Pedidos</h1>
          <p className="text-slate-500">Acompanhe e gerencie o fluxo de entregas.</p>
        </div>
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
              const nextStatus = currentStatusIndex < statuses.length - 1 && 
                                statuses[currentStatusIndex + 1].id !== 'cancelado' && 
                                statuses[currentStatusIndex + 1].id !== 'remarcado'
                                ? statuses[currentStatusIndex + 1] 
                                : null;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  key={order.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex gap-4 items-start">
                      <div className={cn("p-3 rounded-xl border shrink-0", getColorClass(statuses.find(s => s.id === order.status)?.color))}>
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-slate-900">#{order.id.slice(-6).toUpperCase()}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">{order.payment_method}</span>
                        </div>
                        <div className="text-sm text-slate-500 font-medium flex items-center gap-1">
                          <User className="w-3 h-3" />
                          ID Cliente: {order.client_id}
                        </div>
                        <div className="text-sm text-slate-500 font-medium flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {order.items?.length || 0} Itens • Total: R$ {order.total?.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {nextStatus && (
                        <button 
                          onClick={() => updateStatus(order.id, nextStatus.id)} 
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors",
                            nextStatus.color === 'emerald' ? "bg-emerald-600 hover:bg-emerald-700" :
                            nextStatus.color === 'orange' ? "bg-orange-500 hover:bg-orange-600" :
                            nextStatus.color === 'purple' ? "bg-purple-600 hover:bg-purple-700" :
                            nextStatus.color === 'red' ? "bg-red-500 hover:bg-red-600" :
                            nextStatus.color === 'slate' ? "bg-slate-700 hover:bg-black" :
                            "bg-primary hover:opacity-90"
                          )}
                        >
                          {nextStatus.label}
                        </button>
                      )}
                      
                      {order.status !== 'entregue' && order.status !== 'cancelado' && (
                        <div className="flex gap-1">
                          <button 
                            onClick={() => updateStatus(order.id, 'cancelado')} 
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="Cancelar"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => updateStatus(order.id, 'remarcado')} 
                            className="p-2 text-orange-500 hover:bg-orange-50 rounded-xl transition-colors"
                            title="Remarcar"
                          >
                            <Calendar className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      
                      <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><ChevronRight className="w-5 h-5" /></button>
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
