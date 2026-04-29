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
  type: 'simple' | 'kit' | 'raw_material';
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  commission_value: number;
  active: boolean;
  image_url: string;
  kit_items?: KitItem[];
  is_virtual?: boolean;
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

  const [formData, setFormData] = useState<any>({
    name: '',
    category_id: '',
    type: 'simple',
    cost_price: '',
    sale_price: '',
    stock: '',
    min_stock: 5,
    commission_value: '',
    active: true,
    image_url: '',
    kit_items: [] as KitItem[],
    is_virtual: false
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Clear current state to avoid stale data display
      setProducts([]);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Products fetch error:', error);
        toast.error('Erro ao buscar produtos: ' + error.message);
      } else {
        console.log('Successfully fetched products count:', data?.length);
        setProducts(data || []);
      }
    } catch (err: any) {
      console.error('Products fetch catch:', err);
      toast.error('Falha na comunicação com o banco');
    } finally {
      setLoading(false);
    }
  };

  const seedWaterProducts = async () => {
    const tid = toast.loading('Criando produtos de água...');
    try {
      const waterPayload = [
        {
          name: 'Água Mineral com Gás',
          type: 'simple',
          sale_price: 5.00,
          cost_price: 2.00,
          stock: 20,
          min_stock: 5,
          active: true,
          category_id: null
        },
        {
          name: 'Água Mineral sem Gás',
          type: 'simple',
          sale_price: 3.50,
          cost_price: 1.50,
          stock: 20,
          min_stock: 5,
          active: true,
          category_id: null
        }
      ];

      const { error } = await supabase.from('products').insert(waterPayload);
      if (error) throw error;
      
      toast.success('Produtos de água criados!', { id: tid });
      fetchProducts();
    } catch (err: any) {
      toast.error('Erro ao criar: ' + err.message, { id: tid });
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
    const currentStock = p.stock ?? 0;
    if (p.type === 'raw_material') return currentStock;
    if (p.type === 'simple' && !p.is_virtual) return currentStock;
    if (!p.kit_items || p.kit_items.length === 0) return p.is_virtual ? 0 : currentStock;

    const stocks = p.kit_items.map(item => {
      const root = products.find(prod => prod.id === item.product_id);
      if (!root) return 0;
      return Math.floor((root.stock ?? 0) / item.quantity);
    });

    return Math.min(...stocks);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category_id: '',
      type: 'simple',
      cost_price: '',
      sale_price: '',
      stock: '',
      min_stock: 5,
      commission_value: '',
      active: true,
      image_url: '',
      kit_items: [],
      is_virtual: false
    });
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || (formData.type !== 'raw_material' && Number(formData.sale_price) <= 0)) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    const tid = toast.loading('Processando...');

    try {
      const { kit_items, ...cleanData } = formData;
      
      // Validação do category_id: Se não for um UUID válido, envia null
      const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
      const catId = isValidUUID(cleanData.category_id) ? cleanData.category_id : null;

      const productPayload: any = {
        name: cleanData.name,
        category_id: catId,
        type: cleanData.type,
        cost_price: Number(cleanData.cost_price) || 0,
        sale_price: Number(cleanData.sale_price) || 0,
        stock: (cleanData.is_virtual || cleanData.type === 'kit') ? 0 : (Number(cleanData.stock) || 0),
        min_stock: Number(cleanData.min_stock) || 0,
        commission_value: Number(cleanData.commission_value) || 0,
        active: cleanData.active,
        image_url: cleanData.image_url,
        is_virtual: cleanData.is_virtual || cleanData.type === 'kit',
        updated_at: new Date().toISOString()
      };

      let productId = editingProduct?.id;
      let saveError;

      const attemptSave = async (payload: any) => {
        if (editingProduct) {
          return supabase.from('products').update(payload).eq('id', editingProduct.id);
        } else {
          return supabase.from('products').insert([payload]).select();
        }
      };

      let result = await attemptSave(productPayload);
      
      // Fallback 1: Column 'is_virtual' might be missing
      if (result.error && result.error.message?.includes('is_virtual')) {
        console.warn('Fallback: Saving without is_virtual column');
        const { is_virtual, ...fallbackPayload } = productPayload;
        result = await attemptSave(fallbackPayload);
      }

      // Fallback 2: Constraint 'products_type_check' might not allow 'raw_material' yet
      if (result.error && (result.error.message?.includes('products_type_check') || result.error.code === '23514') && productPayload.type === 'raw_material') {
        console.warn('Fallback: Saving raw_material as simple due to constraint restriction');
        const fallbackPayload = { ...productPayload, type: 'simple' };
        result = await attemptSave(fallbackPayload);
      }

      if (result.error) throw result.error;
      
      if (!editingProduct && result.data) {
        productId = result.data[0].id;
      }

      // Handle Kit Items / Raw Material Composition
      if ((formData.type === 'kit' || formData.is_virtual) && productId) {
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
      cost_price: p.cost_price === 0 ? '' : p.cost_price,
      sale_price: p.sale_price === 0 ? '' : p.sale_price,
      stock: p.stock === 0 ? '' : p.stock,
      min_stock: p.min_stock,
      commission_value: p.commission_value === 0 ? '' : p.commission_value,
      active: p.active,
      image_url: p.image_url || '',
      kit_items: p.kit_items || [],
      is_virtual: p.is_virtual || false
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
    // Show all products by default, even those with missing fields
    let list = products;
    
    if (!debouncedSearch) return list;
    
    const fuse = new Fuse(list, {
      keys: ['name', 'category_id'],
      threshold: 0.4, // slightly more permissive for better matching
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
        <div className="flex flex-wrap gap-2">
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
                Array(5).fill(0).map((_, i) => <tr key={i} className="animate-pulse h-16 bg-white border-b border-gray-100" />)
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-12 h-12 opacity-20" />
                      <p className="font-medium text-lg">Nenhum produto encontrado</p>
                      <p className="text-sm">Clique em "Novo Produto" para começar.</p>
                      <button onClick={fetchProducts} className="mt-2 text-primary font-bold hover:underline">Tentar Recarregar</button>
                    </div>
                  </td>
                </tr>
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
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                          {p.type === 'kit' ? 'Kit / Combo' : p.type === 'raw_material' ? 'Matéria-Prima' : 'Simples'}
                          {p.is_virtual && ' • Estoque Virtual'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{p.category_id}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {p.type === 'raw_material' && (p.sale_price === 0 || !p.sale_price) 
                      ? <span className="text-slate-400 font-normal">N/A</span>
                      : `R$ ${p.sale_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    }
                  </td>
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
                  <div className="md:col-span-1 space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Produto *</label>
                    <input required type="text" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Cadastro</label>
                    <select className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none appearance-none font-bold text-slate-700" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value as any, is_virtual: e.target.value === 'kit' ? true : formData.is_virtual})}>
                      <option value="simple">Produto Final (Simples)</option>
                      <option value="kit">Produto Kit / Combo</option>
                      <option value="raw_material">Matéria-Prima</option>
                    </select>
                  </div>

                  {formData.type === 'simple' && (
                    <div className="md:col-span-2 flex items-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                       <input type="checkbox" id="is_virtual" checked={formData.is_virtual} onChange={(e) => setFormData({...formData, is_virtual: e.target.checked})} className="w-5 h-5 accent-primary" />
                       <label htmlFor="is_virtual" className="text-sm font-bold text-blue-800 flex flex-col">
                         <span>Estoque Virtual (Dará baixa em matérias primas)</span>
                         <span className="text-[10px] font-medium opacity-70">Marque esta opção se este produto for produzido a partir de ingredientes.</span>
                       </label>
                    </div>
                  )}

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
                    <input type="number" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" value={formData.cost_price} onChange={(e) => setFormData({...formData, cost_price: e.target.value})} placeholder="R$ 0,00" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Preço de Venda (R$){formData.type !== 'raw_material' ? ' *' : ''}
                    </label>
                    <input 
                      required={formData.type !== 'raw_material'} 
                      type="number" 
                      step="0.01" 
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" 
                      value={formData.sale_price} 
                      onChange={(e) => setFormData({...formData, sale_price: e.target.value})} 
                      placeholder="R$ 0,00" 
                    />
                  </div>

                  {(formData.type !== 'kit' && !formData.is_virtual) ? (
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estoque Atual</label>
                       <input type="number" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} placeholder="0" />
                    </div>
                  ) : (
                    <div className="md:col-span-2 space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Composição / Receita (Matérias-Primas)</label>
                         <button 
                           type="button"
                           onClick={() => setFormData({...formData, kit_items: [...formData.kit_items, { product_id: '', quantity: 1 }]})}
                           className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                        >
                           <Plus className="w-3 h-3" /> Adicionar Matéria-Prima
                         </button>
                      </div>
                      
                      {formData.kit_items.map((item: any, idx: number) => (
                        <div key={idx} className="flex gap-3 items-end">
                           <div className="flex-1 space-y-1">
                              <select 
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none font-bold"
                                value={item.product_id}
                                onChange={(e) => {
                                  const newItems = [...formData.kit_items];
                                  newItems[idx].product_id = e.target.value;
                                  setFormData({...formData, kit_items: newItems});
                                }}
                              >
                                <option value="">Selecionar...</option>
                                {products.filter(prod => prod.type === 'raw_material' || prod.type === 'simple').map(prod => (
                                  <option key={prod.id} value={prod.id}>{prod.name} (Saldo: {calculateVirtualStock(prod)})</option>
                                ))}
                              </select>
                           </div>
                           <div className="w-24 space-y-1">
                              <input 
                                type="number" 
                                min="1"
                                placeholder="Qtd"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none font-bold"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...formData.kit_items];
                                  newItems[idx].quantity = parseInt(e.target.value) || 0;
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
                          O estoque deste item será calculado automaticamente com base no saldo dos componentes acima.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estoque Mínimo (Alerta)</label>
                    <input type="number" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: e.target.value})} placeholder="5" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comissão (R$ Fixo)</label>
                    <input type="number" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold" value={formData.commission_value} onChange={(e) => setFormData({...formData, commission_value: e.target.value})} placeholder="R$ 0,00" />
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
