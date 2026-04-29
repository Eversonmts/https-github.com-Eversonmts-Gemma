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
  ShoppingBag,
  Edit3,
  RefreshCcw,
  ShieldCheck,
  ShieldAlert,
  Save,
  Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import Fuse from 'fuse.js';
import { useDebounce } from '../hooks/useDebounce';

export default function Orders() {
  const { isDriver: realIsDriver, isSeller: realIsSeller, isAdmin: realIsAdmin, profile } = useAuth();
  
  // Role Simulation State
  const [simulatedRole, setSimulatedRole] = useState<'admin' | 'seller' | 'driver' | null>(null);
  
  const isAdmin = simulatedRole ? simulatedRole === 'admin' : realIsAdmin;
  const isSeller = simulatedRole ? (simulatedRole === 'seller' || simulatedRole === 'admin') : realIsSeller;
  const isDriver = simulatedRole ? (simulatedRole === 'driver' || simulatedRole === 'admin') : realIsDriver;

  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({
    items: [],
    delivery_fee: 0,
    seller_id: '',
    driver_id: ''
  });

  const fetchAuxData = async () => {
    const [s, d, p] = await Promise.all([
      supabase.from('sellers').select('*'),
      supabase.from('drivers').select('*'),
      supabase.from('products').select('*')
    ]);
    if (s.data) setSellers(s.data);
    if (d.data) setDrivers(d.data);
    if (p.data) setProducts(p.data);
  };

  const fetchOrders = async () => {
    const { data: oData } = await supabase
      .from('orders')
      .select(`
        *, 
        clients(name, phone, address), 
        seller:seller_id(name), 
        driver:driver_id(name), 
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
    if (realIsAdmin) fetchAuxData();

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

  const openEditModal = (order: any) => {
    setEditingOrder(order);
    setEditFormData({
      items: order.order_items || [],
      delivery_fee: order.delivery_fee || 0,
      seller_id: order.seller_id || '',
      driver_id: order.driver_id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;
    const tid = toast.loading('Calculando e salvando...');
    try {
      // 1. Atualiza itens do pedido (simplificado: remove antigos e insere novos)
      // Nota: Em produção, seria melhor fazer um diff real.
      await supabase.from('order_items').delete().eq('order_id', editingOrder.id);
      const itemsToInsert = editFormData.items.map((item: any) => ({
        order_id: editingOrder.id,
        product_id: item.product_id,
        name: item.products?.name || item.name || 'Produto',
        quantity: item.quantity,
        price: item.unit_price,
        unit_price: item.unit_price,
        total_price: Number(item.unit_price) * item.quantity,
        commission: item.commission || 0
      }));

      let itemsResult = await supabase.from('order_items').insert(itemsToInsert);

      if (itemsResult.error && (itemsResult.error.message?.includes('column "price"') || itemsResult.error.message?.includes('column "total_price"') || itemsResult.error.message?.includes('column "unit_price"'))) {
        console.warn('Retrying update without some columns due to schema cache issues');
        const retryItems = itemsToInsert.map(item => {
          const { price, total_price, unit_price, ...rest } = item as any;
          const newItem: any = { ...rest };
          if (!itemsResult.error?.message?.includes('column "price"')) newItem.price = price;
          if (!itemsResult.error?.message?.includes('column "total_price"')) newItem.total_price = total_price;
          if (!itemsResult.error?.message?.includes('column "unit_price"')) newItem.unit_price = unit_price;
          return newItem;
        });
        itemsResult = await supabase.from('order_items').insert(retryItems);
      }

      if (itemsResult.error) throw itemsResult.error;

      // 2. Calcula novo total
      const subtotal = editFormData.items.reduce((acc: number, item: any) => acc + (Number(item.unit_price) * item.quantity), 0);
      const total = subtotal + Number(editFormData.delivery_fee) - (Number(editingOrder.discount) || 0);

      // 3. Atualiza pedido
      const sellerIdToSave = (editFormData.seller_id && sellers.some(s => s.id === editFormData.seller_id)) ? editFormData.seller_id : null;
      const driverIdToSave = (editFormData.driver_id && drivers.some(d => d.id === editFormData.driver_id)) ? editFormData.driver_id : null;

      const { error } = await supabase
        .from('orders')
        .update({
          delivery_fee: Number(editFormData.delivery_fee),
          seller_id: sellerIdToSave,
          driver_id: driverIdToSave,
          subtotal: Number(subtotal),
          total: Number(total),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingOrder.id);

      if (error) throw error;
      
      toast.success('Pedido atualizado com sucesso!', { id: tid });
      setIsEditModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message, { id: tid });
    }
  };

  const addItemToOrder = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    setEditFormData({
      ...editFormData,
      items: [...editFormData.items, {
        product_id: product.id,
        products: { name: product.name },
        quantity: 1,
        unit_price: product.sale_price,
        commission: product.commission_value || 0
      }]
    });
  };

  const removeItemFromOrder = (idx: number) => {
    const newItems = [...editFormData.items];
    newItems.splice(idx, 1);
    setEditFormData({ ...editFormData, items: newItems });
  };

  const updateItemQuantity = (idx: number, qty: number) => {
    const newItems = [...editFormData.items];
    newItems[idx].quantity = Math.max(1, qty);
    setEditFormData({ ...editFormData, items: newItems });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 text-left pb-24">
      {/* Botões de Simulação para Teste */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 scale-90 md:scale-100 origin-bottom-right">
        <label className="text-[10px] font-black text-slate-400 uppercase text-right mr-2 tracking-tighter">Simular Visão</label>
        <div className="flex flex-col gap-2 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-2xl">
          <button 
            onClick={() => setSimulatedRole(null)}
            className={cn(
              "p-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold whitespace-nowrap",
              !simulatedRole ? "bg-primary text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
          >
            <RefreshCcw className="w-4 h-4" /> Real
          </button>
          <button 
            onClick={() => setSimulatedRole('admin')}
            className={cn(
              "p-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold whitespace-nowrap",
              simulatedRole === 'admin' ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
          >
            <ShieldCheck className="w-4 h-4" /> Admin
          </button>
          <button 
            onClick={() => setSimulatedRole('seller')}
            className={cn(
              "p-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold whitespace-nowrap",
              simulatedRole === 'seller' ? "bg-orange-500 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
          >
            <User className="w-4 h-4" /> Vendedor
          </button>
          <button 
            onClick={() => setSimulatedRole('driver')}
            className={cn(
              "p-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold whitespace-nowrap",
              simulatedRole === 'driver' ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
          >
            <Truck className="w-4 h-4" /> Entregador
          </button>
        </div>
      </div>
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
                              <span className="text-[11px] font-bold text-slate-600">{order.seller?.name || 'Venda Direta'}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Entregador</label>
                            <div className="flex items-center gap-1.5">
                              <Truck className="w-3 h-3 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{order.driver?.name || 'A definir'}</span>
                            </div>
                          </div>
                        </div>

                          <div className="flex items-center gap-2">
                             {isAdmin && (
                               <button 
                                 onClick={() => openEditModal(order)}
                                 className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors bg-primary/5 border border-primary/10"
                               >
                                 <Edit3 className="w-4 h-4" />
                               </button>
                             )}
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

      {/* Modal de Edição (Admin) */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <div>
                   <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Editar Pedido</h3>
                   <span className="text-xs font-bold text-slate-400">#{editingOrder?.id.slice(-6).toUpperCase()}</span>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><XCircle className="w-5 h-5 text-slate-300" /></button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6 scrollbar-hide">
                {/* Itens do Pedido */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produtos / Quantidade</label>
                    <div className="relative group">
                       <select 
                         className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-black uppercase appearance-none"
                         onChange={(e) => {
                           if (e.target.value) addItemToOrder(e.target.value);
                           e.target.value = '';
                         }}
                       >
                         <option value="">+ Add Produto</option>
                         {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {editFormData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800">{item.products?.name || 'Produto'}</p>
                          <p className="text-[10px] font-medium text-slate-400">R$ {item.unit_price?.toFixed(2)} / un</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1">
                          <button onClick={() => updateItemQuantity(idx, item.quantity - 1)} className="p-1 hover:bg-slate-50 rounded-lg"><Clock className="w-3 h-3 text-slate-400 rotate-180" /></button>
                          <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                          <button onClick={() => updateItemQuantity(idx, item.quantity + 1)} className="p-1 hover:bg-slate-50 rounded-lg"><RefreshCcw className="w-3 h-3 text-slate-400" /></button>
                        </div>
                        <button onClick={() => removeItemFromOrder(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa de Entrega</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold"
                      value={editFormData.delivery_fee}
                      onChange={(e) => setEditFormData({ ...editFormData, delivery_fee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold appearance-none"
                      value={editFormData.seller_id}
                      onChange={(e) => setEditFormData({ ...editFormData, seller_id: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      {sellers.map(s => <option key={s.id} value={s.id}>{s.name || s.full_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entregador</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold appearance-none"
                    value={editFormData.driver_id}
                    onChange={(e) => setEditFormData({ ...editFormData, driver_id: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name || d.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-6 border-t bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-4 rounded-xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleUpdateOrder}
                  className="flex-[2] py-4 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 hover:bg-black transition-all"
                >
                  <Save className="w-4 h-4" /> SALVAR ALTERAÇÕES
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
