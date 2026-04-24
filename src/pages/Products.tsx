import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Package, Layers, AlertTriangle, Copy, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import Fuse from 'fuse.js';
import { useDebounce } from '../hooks/useDebounce';

interface KitItem {
  product_id: string;
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  category_id: string;
  type: 'simple' | 'kit';
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  commission_value: number;
  active: boolean;
  image_url: string;
  kit_items?: KitItem[];
  created_at: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category_id: 'geral',
    type: 'simple' as 'simple' | 'kit',
    cost_price: 0,
    sale_price: 0,
    stock: 0,
    min_stock: 5,
    commission_value: 0,
    active: true,
    image_url: '',
    kit_items: [] as KitItem[],
  });

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, kit_items(*)');
      
      if (error) {
        console.error('Products fetch error:', error);
        toast.error('Erro ao carregar produtos');
      } else {
        setProducts(data || []);
      }
    } catch (err) {
      console.error('Products fetch catch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const channel = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kit_items' }, () => fetchProducts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const calculateVirtualStock = (p: Product) => {
    if (p.type === 'simple') return p.stock;
    if (!p.kit_items || p.kit_items.length === 0) return 0;

    const stocks = p.kit_items.map(item => {
      const root = products.find(prod => prod.id === item.product_id);
      if (!root) return 0;
      return Math.floor((root.stock || 0) / item.quantity);
    });

    return Math.min(...stocks);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category_id: 'geral',
      type: 'simple',
      cost_price: 0,
      sale_price: 0,
      stock: 0,
      min_stock: 5,
      commission_value: 0,
      active: true,
      image_url: '',
      kit_items: [],
    });
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.sale_price <= 0) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    const tid = toast.loading('Processando...');

    try {
      const { kit_items, ...cleanData } = formData;
      const productPayload = {
        name: cleanData.name,
        category_id: cleanData.category_id,
        type: cleanData.type,
        cost_price: cleanData.cost_price,
        sale_price: cleanData.sale_price,
        stock: cleanData.stock,
        min_stock: cleanData.min_stock,
        commission_value: cleanData.commission_value,
        active: cleanData.active,
        image_url: cleanData.image_url,
        updated_at: new Date().toISOString()
      };

      let productId = editingProduct?.id;

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([productPayload])
          .select();
        if (error) throw error;
        productId = data[0].id;
      }

      // Handle Kit Items
      if (formData.type === 'kit' && productId) {
        // Clear existing kit items
        await supabase.from('kit_items').delete().eq('kit_id', productId);
        
        const kitPayload = kit_items
          .filter(i => i.product_id)
          .map(i => ({
            kit_id: productId,
            product_id: i.product_id,
            quantity: i.quantity
          }));
        
        if (kitPayload.length > 0) {
          const { error } = await supabase.from('kit_items').insert(kitPayload);
          if (error) throw error;
        }
      }

      toast.success('Produto salvo com sucesso!', { id: tid });
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar: ${err.message}`, { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        toast.success('Produto excluído!');
        fetchProducts();
      } catch (err: any) {
        toast.error('Erro ao excluir: ' + err.message);
      }
    }
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      category_id: p.category_id,
      type: p.type,
      cost_price: p.cost_price,
      sale_price: p.sale_price,
      stock: p.stock,
      min_stock: p.min_stock,
      commission_value: p.commission_value || 0,
      active: p.active,
      image_url: p.image_url || '',
      kit_items: p.kit_items || [],
    });
    setIsModalOpen(true);
  };

  const handleDuplicate = (p: Product) => {
    setFormData({
      ...p,
      name: `${p.name} (Cópia)`,
      id: '', // trigger new
    } as any);
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) { // 800KB limit for base64 in firestore
        toast.error('Imagem muito grande. Máximo 800KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return products;
    
    const fuse = new Fuse(products, {
      keys: ['name', 'category_id'],
      threshold: 0.3,
      distance: 100,
    });
    
    return fuse.search(debouncedSearch).map(result => result.item);
  }, [products, debouncedSearch]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display text-left">Produtos</h1>
          <p className="text-slate-500">Catálogo de produtos e controle de estoque.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={async () => {
              // @ts-ignore
              if (window.deferredPrompt) {
                // @ts-ignore
                window.deferredPrompt.prompt();
              } else {
                alert('O aplicativo já está instalado ou seu navegador não suporta a instalação direta. Procure pela opção "Adicionar à tela de início" no menu do navegador.');
              }
            }}
            className="bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
            Instalar App
          </button>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Novo Produto
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar produto..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Preço (Venda)</th>
                <th className="px-6 py-4">Estoque</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array(5).fill(0).map((_, i) => <tr key={i} className="animate-pulse h-16 bg-white" />)
              ) : filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                        {p.image_url ? (
                          <img src={p.image_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{p.name || 'Sem Nome'}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{p.type === 'kit' ? 'Kit / Combo' : 'Simples'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{p.category_id}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">R$ {p.sale_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4">
                    <div className={cn("flex items-center gap-2 font-bold", calculateVirtualStock(p) <= p.min_stock ? "text-red-500" : "text-slate-600")}>
                      {calculateVirtualStock(p)}
                      {calculateVirtualStock(p) <= p.min_stock && <AlertTriangle className="w-4 h-4" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase", p.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => handleEdit(p)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                       <button onClick={() => handleDuplicate(p)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors" title="Duplicar"><Copy className="w-4 h-4" /></button>
                       <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-bold font-display">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Produto *</label>
                    <input required type="text" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                    <select className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none appearance-none" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value as any})}>
                      <option value="simple">Produto Simples</option>
                      <option value="kit">Kit / Combo</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Imagem do Produto</label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {formData.image_url ? (
                          <img src={formData.image_url} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <label className="flex-1 bg-slate-100 text-slate-700 h-10 rounded-xl border border-slate-200 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors text-sm font-bold">
                            <Upload className="w-4 h-4" />
                            Subir Imagem
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                          </label>
                          <button 
                            type="button" 
                            onClick={() => setFormData({...formData, image_url: ''})}
                            className="px-4 h-10 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-bold"
                          >
                            Limpar
                          </button>
                        </div>
                        <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-xs" placeholder="Ou cole uma URL da imagem..." value={formData.image_url} onChange={(e) => setFormData({...formData, image_url: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preço de Custo (R$)</label>
                    <input type="number" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={formData.cost_price} onChange={(e) => setFormData({...formData, cost_price: parseFloat(e.target.value)})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preço de Venda (R$) *</label>
                    <input required type="number" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={formData.sale_price} onChange={(e) => setFormData({...formData, sale_price: parseFloat(e.target.value)})} />
                  </div>

                  {formData.type === 'simple' ? (
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estoque Atual</label>
                       <input type="number" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={formData.stock} onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value)})} />
                    </div>
                  ) : (
                    <div className="md:col-span-2 space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Composição do Kit (Produtos Base)</label>
                         <button 
                           type="button"
                           onClick={() => setFormData({...formData, kit_items: [...formData.kit_items, { product_id: '', quantity: 1 }]})}
                           className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                        >
                           <Plus className="w-3 h-3" /> Adicionar Item
                         </button>
                      </div>
                      
                      {formData.kit_items.map((item, idx) => (
                        <div key={idx} className="flex gap-3 items-end">
                           <div className="flex-1 space-y-1">
                              <select 
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                value={item.product_id}
                                onChange={(e) => {
                                  const newItems = [...formData.kit_items];
                                  newItems[idx].product_id = e.target.value;
                                  setFormData({...formData, kit_items: newItems});
                                }}
                              >
                                <option value="">Selecionar Produto...</option>
                                {products.filter(prod => prod.type === 'simple').map(prod => (
                                  <option key={prod.id} value={prod.id}>{prod.name} (Saldo: {prod.stock})</option>
                                ))}
                              </select>
                           </div>
                           <div className="w-24 space-y-1">
                              <input 
                                type="number" 
                                min="1"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none font-bold"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...formData.kit_items];
                                  newItems[idx].quantity = parseInt(e.target.value);
                                  setFormData({...formData, kit_items: newItems});
                                }}
                              />
                           </div>
                           <button 
                             type="button"
                             onClick={() => setFormData({...formData, kit_items: formData.kit_items.filter((_, i) => i !== idx)})}
                             className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      ))}
                      
                      {formData.kit_items.length > 0 && (
                        <div className="text-[11px] text-slate-500 italic bg-white/50 p-2 rounded-lg border border-slate-100">
                          O estoque deste kit será calculado automaticamente com base no saldo dos produtos selecionados acima.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estoque Mínimo (Alerta)</label>
                    <input type="number" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: parseInt(e.target.value)})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comissão (R$ Fixo)</label>
                    <input type="number" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={formData.commission_value} onChange={(e) => setFormData({...formData, commission_value: parseFloat(e.target.value)})} />
                  </div>

                  <div className="flex items-center gap-3 pt-8">
                    <input type="checkbox" id="active" checked={formData.active} onChange={(e) => setFormData({...formData, active: e.target.checked})} className="w-5 h-5 accent-primary" />
                    <label htmlFor="active" className="text-sm font-bold text-slate-700">Produto Ativo no Catálogo</label>
                  </div>
                </div>
              </form>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl">Cancelar</button>
                <button onClick={handleSubmit} disabled={saving} className="flex-[2] bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 flex items-center justify-center gap-2">
                  {saving ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
