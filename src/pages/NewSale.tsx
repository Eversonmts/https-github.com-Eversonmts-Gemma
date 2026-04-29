import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ShoppingCart, User, Plus, Trash2, CheckCircle2, X, Minus, MapPin, Banknote, Tag, Package, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { useLocation } from 'react-router-dom';
import Fuse from 'fuse.js';
import { useDebounce } from '../hooks/useDebounce';

export default function NewSale() {
  const location = useLocation();
  const preSelectedClientId = location.state?.clientId;
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchProduct, setSearchProduct] = useState('');
  const debouncedSearchProduct = useDebounce(searchProduct, 300);
  const [cart, setCart] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedSeller, setSelectedSeller] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [deliveryFee, setDeliveryFee] = useState<any>(0);
  const [discount, setDiscount] = useState<any>(0);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  const fetchRecentSales = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) setRecentSales(data);
    } catch (err) {
      console.warn('Error fetching recent sales:', err);
    }
  };

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const [p, c, s, d, cfg] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('sellers').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('settings').select('*').eq('id', 'config').maybeSingle()
      ]);

      if (p.data) setProducts(p.data);
      if (c.data) {
        setClients(c.data);
        if (preSelectedClientId) {
          const client = c.data.find(cli => cli.id === preSelectedClientId);
          if (client) setSelectedClient(client);
        }
      }
      
      if (s.data) {
        setSellers(s.data);
        // Tenta auto-vincular o vendedor logado pelo email ou auth_uid
        if (user) {
          const matchingSeller = s.data.find(sell => 
            sell.email === user.email || 
            sell.auth_uid === user.id
          );
          if (matchingSeller) {
            setSelectedSeller(matchingSeller);
          }
        }
      }

      if (d.data) setDrivers(d.data);
      if (cfg.data?.value?.default_delivery_fee) {
        setDeliveryFee(cfg.data.value.default_delivery_fee);
      }
      fetchRecentSales();
    } catch (err: any) {
      console.error('Error fetching data for sale:', err);
      toast.error('Erro ao conectar ao banco de dados');
    }
  };

  useEffect(() => {
    fetchData();

    // Set up real-time (optional for this view, but good for stock awareness)
    const productSub = supabase.channel('newsale-products').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData()).subscribe();
    
    return () => { supabase.removeChannel(productSub); };
  }, [preSelectedClientId]);

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} adicionado!`, { duration: 1000 });
  };

  const removeFromCart = (id: string) => setCart(cart.filter(item => item.id !== id));
  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const subtotal = cart.reduce((acc, item) => acc + (Number(item.sale_price) * item.quantity), 0);
  const total = subtotal + Number(deliveryFee) - Number(discount);

  const finalizeSale = async () => {
    if (!selectedClient) return toast.error('Selecione um cliente');
    if (!selectedSeller) return toast.error('Selecione um vendedor');
    if (cart.length === 0) return toast.error('Carrinho vazio');
    
    if (discount > 0 && selectedSeller?.permissions?.can_give_discount === false) {
      return toast.error('Este vendedor não tem permissão para dar descontos.');
    }

    setSaving(true);
    const tid = toast.loading('Processando venda...');

    try {
      const sellerId = (selectedSeller?.id && sellers.some(s => s.id === selectedSeller.id)) ? selectedSeller.id : null;
      const driverId = (selectedDriver?.id && drivers.some(d => d.id === selectedDriver.id)) ? selectedDriver.id : null;

      if (selectedSeller && !sellerId) {
        throw new Error('O vendedor selecionado é inválido ou não foi encontrado no banco de dados.');
      }

      console.log('Sending payload:', {
        client_id: selectedClient.id,
        seller_id: sellerId,
        driver_id: driverId
      });

      // 1. Create Order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert([{
          client_id: selectedClient.id,
          seller_id: sellerId,
          driver_id: driverId,
          total: Number(total),
          subtotal: Number(subtotal),
          delivery_fee: Number(deliveryFee) || 0,
          discount: Number(discount) || 0,
          payment_method: paymentMethod,
          status: 'novo'
        }])
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Create Order Items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.sale_price,
        unit_price: item.sale_price,
        total_price: Number(item.sale_price) * item.quantity,
        commission: item.commission_value || 0
      }));

      let { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      
      if (itemsErr && (itemsErr.message?.includes('column "price"') || itemsErr?.message?.includes('column "total_price"') || itemsErr?.message?.includes('column "unit_price"'))) {
        console.warn('Retrying save without some columns due to schema cache issues');
        const retryItems = orderItems.map(item => {
          const { price, total_price, unit_price, ...rest } = item as any;
          const newItem: any = { ...rest };
          if (!itemsErr?.message?.includes('column "price"')) newItem.price = price;
          if (!itemsErr?.message?.includes('column "total_price"')) newItem.total_price = total_price;
          if (!itemsErr?.message?.includes('column "unit_price"')) newItem.unit_price = unit_price;
          return newItem;
        });
        const result = await supabase.from('order_items').insert(retryItems);
        itemsErr = result.error;
      }

      if (itemsErr) throw itemsErr;

      // 3. Update Stock & Movements
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (!product) continue;

        if ((product.type === 'kit' || product.is_virtual) && product.kit_items) {
          for (const kitItem of product.kit_items) {
            const qtyToDeduct = item.quantity * kitItem.quantity;
            
            // Get current stock
            const { data: pData } = await supabase.from('products').select('stock').eq('id', kitItem.product_id).single();
            const currentStock = pData?.stock ?? 0;

            await supabase.from('products').update({ stock: currentStock - qtyToDeduct }).eq('id', kitItem.product_id);
            await supabase.from('stock_movements').insert({
               product_id: kitItem.product_id,
               type: 'out',
               quantity: qtyToDeduct,
               reason: `Venda #${order.id.slice(-6)} (${product.type === 'kit' ? 'Kit' : 'Produzido'}: ${product.name})`
            });
          }
        } else if (product.type !== 'kit') {
          // Simple item (not kit and not virtual producer)
          const { data: pData } = await supabase.from('products').select('stock').eq('id', item.id).single();
          const currentStock = pData?.stock ?? 0;

          await supabase.from('products').update({ stock: currentStock - item.quantity }).eq('id', item.id);
          await supabase.from('stock_movements').insert({
             product_id: item.id,
             type: 'out',
             quantity: item.quantity,
             reason: `Venda #${order.id.slice(-6)}`
          });
        }
      }

      // 4. Create Transaction
      await supabase.from('transactions').insert({
        type: 'income',
        value: total,
        description: `Venda #${order.id.slice(-6)} - ${selectedClient.name}`,
        order_id: order.id,
        date: new Date().toISOString().split('T')[0]
      });

      toast.success('Venda finalizada!', { id: tid });
      setCart([]);
      setStep(1);
      setSelectedClient(null);
      fetchRecentSales();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro: ${err.message}`, { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    // Show all active products (or all if active is undefined)
    let activeProducts = products.filter(p => p.active !== false);
    
    if (!debouncedSearchProduct) return activeProducts;
    
    const fuse = new Fuse(activeProducts, {
      keys: ['name'],
      threshold: 0.4,
    });
    
    return fuse.search(debouncedSearchProduct).map(r => r.item);
  }, [products, debouncedSearchProduct]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50 font-sans">
      {/* Header Stepper */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                step >= s ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
              )}>
                {s}
              </div>
              {s < 3 && <div className={cn("w-8 h-0.5 rounded-full", step > s ? "bg-primary" : "bg-slate-100")} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="max-w-md mx-auto p-4 space-y-4">
          
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Selecione o Cliente
                  </h3>
                  <button onClick={() => setIsClientModalOpen(true)} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-lg font-black uppercase">Novo</button>
                </div>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-sm"
                  value={selectedClient?.id || ''}
                  onChange={(e) => setSelectedClient(clients.find(c => c.id === e.target.value))}
                >
                  <option value="">Para quem é a venda?</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedClient && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500 font-medium">{selectedClient.address}, {selectedClient.number} - {selectedClient.city}</p>
                  </div>
                )}
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Produtos em Estoque
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar produto..." 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredProducts.slice(0, 10).map((p) => (
                    <button 
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={cn(
                        "p-2 rounded-xl border transition-all text-left flex flex-col gap-1 relative overflow-hidden",
                        cart.some(i => i.id === p.id) ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50"
                      )}
                    >
                      <h4 className="font-bold text-[10px] line-clamp-1">{p.name}</h4>
                      <span className="text-primary font-black text-xs">R$ {(p.sale_price || 0).toFixed(2)}</span>
                      {cart.find(i => i.id === p.id) && (
                        <div className="absolute top-0 right-0 bg-primary text-white text-[8px] px-1.5 py-0.5 rounded-bl-lg font-bold">
                          {cart.find(i => i.id === p.id).quantity}x
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  Items no Carrinho
                </h3>
                {cart.length === 0 ? (
                   <p className="text-center py-8 text-slate-400 text-xs italic">Seu carrinho está vazio...</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{item.name}</h4>
                          <button onClick={() => removeFromCart(item.id)}><X className="w-4 h-4 text-slate-300" /></button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                            <button onClick={() => updateQuantity(item.id, -1)} className="p-1"><Minus className="w-3 h-3 text-slate-400" /></button>
                            <span className="w-6 text-center font-black text-xs">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="p-1"><Plus className="w-3 h-3 text-slate-400" /></button>
                          </div>
                          <span className="font-black text-primary text-sm">R$ {((item.sale_price || 0) * item.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                 <h3 className="text-sm font-bold text-slate-900">Ajustes de Valor</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Taxa Entrega</label>
                      <input type="number" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={deliveryFee === 0 ? '' : deliveryFee} onChange={e => setDeliveryFee(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Desconto</label>
                      <input 
                        type="number" 
                        disabled={selectedSeller?.permissions?.can_give_discount === false}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold disabled:opacity-50" 
                        value={discount === 0 ? '' : discount} 
                        onChange={e => setDiscount(e.target.value)} 
                        placeholder="0"
                      />
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Agendamento & Pessoal</h3>
                <div className="space-y-3">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Data e Hora de Entrega</label>
                      <input type="datetime-local" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Entregador</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                        value={selectedDriver?.id || ''}
                        onChange={e => setSelectedDriver(drivers.find(d => d.id === e.target.value))}
                      >
                        <option value="">Selecione...</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.vehicle_plate || 'S/ Placa'})</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Vendedor</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                        value={selectedSeller?.id || ''}
                        onChange={e => setSelectedSeller(sellers.find(s => s.id === e.target.value))}
                      >
                        <option value="">Selecione...</option>
                        {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Cobrança</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'pix', label: 'PIX', icon: CheckCircle2 },
                    { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                    { id: 'cartao', label: 'Cartão', icon: Tag },
                    { id: 'local', label: 'S/ Entrega', icon: MapPin },
                  ].map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setPaymentMethod(p.id)}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col items-center gap-1 transition-all",
                        paymentMethod === p.id ? "bg-primary border-primary text-white shadow-lg" : "bg-slate-50 border-slate-100 text-slate-500"
                      )}
                    >
                      <p.icon className="w-4 h-4" />
                      <span className="text-[8px] font-black uppercase tracking-tighter">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Observações</h3>
                 <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none min-h-[80px]" placeholder="Instruções extras..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {/* Nova Tabela de Vendas Recentes para confirmação visual */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Últimas Vendas Realizadas</h3>
                </div>
                <div className="space-y-3 overflow-hidden">
                  {recentSales.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 italic">Nenhuma venda realizada recentemente.</p>
                  ) : (
                    recentSales.map((sale: any) => {
                      const saleId = sale.id || '';
                      return (
                        <div key={saleId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">
                              #{saleId.slice(-4).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{sale.clients?.name || 'Cliente'}</p>
                              <p className="text-[10px] text-slate-500">
                                {sale.created_at ? new Date(sale.created_at).toLocaleTimeString() : '--:--'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-primary">R$ {Number(sale.total || 0).toFixed(2)}</p>
                            <span className="text-[8px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full uppercase">Salvo</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          {step > 1 ? (
             <button onClick={() => setStep(step - 1)} className="px-6 py-3 text-slate-400 font-bold text-sm">Voltar</button>
          ) : (
            <div className="flex-1">
               <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none mb-1">Subtotal</span>
               <span className="text-xl font-black text-slate-900 leading-none">R$ {total.toFixed(2)}</span>
            </div>
          )}
          
          {step < 3 ? (
            <button 
              disabled={step === 1 && (!selectedClient || cart.length === 0)}
              onClick={() => setStep(step + 1)} 
              className="flex-1 bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:bg-primary/95 transition-all text-center disabled:opacity-30"
            >
              CONTINUAR
            </button>
          ) : (
            <button 
              disabled={saving}
              onClick={finalizeSale}
              className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-slate-900/20 hover:bg-black transition-all text-center disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {saving ? 'PROCESSANDO...' : 'FINALIZAR PEDIDO'}
            </button>
          )}
        </div>
      </div>

      {/* Client Modal */}
      <AnimatePresence>
        {isClientModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsClientModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-bold">Clientes Rápido</h3>
                  <button onClick={() => setIsClientModalOpen(false)}><X className="w-4 h-4" /></button>
                </div>
                <form className="p-4 space-y-4" onSubmit={async (e) => {
                   e.preventDefault();
                   const form = e.target as any;
                   const name = form.name.value;
                   const whatsapp = form.whatsapp.value;
                   const address = form.address.value;
                   if (!name || !whatsapp || !address) return;
                   
                   setSaving(true);
                   try {
                     const { data, error } = await supabase
                       .from('clients')
                       .insert([{ 
                         name, 
                         whatsapp, 
                         address, 
                         type: 'final', 
                         updated_at: new Date().toISOString() 
                       }])
                       .select();

                     if (error) throw error;

                     setSelectedClient(data?.[0]);
                     setIsClientModalOpen(false);
                     toast.success('Cliente pronto!');
                   } catch (e) { toast.error('Erro ao criar cliente'); } finally { setSaving(false); }
                }}>
                   <input name="name" required placeholder="Nome do Cliente" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
                   <input name="whatsapp" required placeholder="WhatsApp" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
                   <input name="address" required placeholder="Endereço Completo" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
                   <button type="submit" disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl font-bold">Salvar e Selecionar</button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
