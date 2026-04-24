import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, X, UserSquare2, Mail, ShieldCheck, BadgeCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import Fuse from 'fuse.js';
import { useDebounce } from '../hooks/useDebounce';

interface Seller {
  id: string;
  name: string;
  email: string;
  auth_uid: string;
  active: boolean;
  permissions: any;
  created_at: any;
}

export default function Sellers() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    auth_uid: '',
    active: true,
    permissions: {
      can_edit_clients: true,
      can_view_finance: false,
      can_manage_stock: false,
      can_give_discount: false,
    },
  });

  useEffect(() => {
    const fetchSellers = async () => {
      const { data } = await supabase.from('sellers').select('*');
      if (data) setSellers(data as Seller[]);
      setLoading(false);
    };
    fetchSellers();
    const sub = supabase.channel('sellers-page').on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => fetchSellers()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      auth_uid: '',
      active: true,
      permissions: {
        can_edit_clients: true,
        can_view_finance: false,
        can_manage_stock: false,
        can_give_discount: false,
      },
    });
    setEditingSeller(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    const tid = toast.loading('Processando...');

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        active: formData.active,
        permissions: formData.permissions,
        updated_at: new Date().toISOString(),
      };

      if (editingSeller) {
        const { error } = await supabase.from('sellers').update(payload).eq('id', editingSeller.id);
        if (error) throw error;
        toast.success('Vendedor atualizado!', { id: tid });
      } else {
        const { error } = await supabase.from('sellers').insert([payload]);
        if (error) throw error;
        toast.success('Vendedor cadastrado!', { id: tid });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao salvar.', { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: Seller) => {
    setEditingSeller(s);
    setFormData({
      name: s.name,
      email: s.email,
      auth_uid: s.auth_uid || '',
      active: s.active,
      permissions: s.permissions || {
        can_edit_clients: true,
        can_view_finance: false,
        can_manage_stock: false,
        can_give_discount: false,
      },
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Excluir este vendedor?')) {
      try {
        const { error } = await supabase.from('sellers').delete().eq('id', id);
        if (error) throw error;
        toast.success('Vendedor excluído');
      } catch (err) {
        toast.error('Erro ao excluir');
      }
    }
  };

  const filteredSellers = useMemo(() => {
    if (!debouncedSearch) return sellers;
    
    const fuse = new Fuse(sellers, {
      keys: ['name', 'email'],
      threshold: 0.3,
    });
    
    return fuse.search(debouncedSearch).map(r => r.item);
  }, [sellers, debouncedSearch]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display text-left">Vendedores</h1>
          <p className="text-slate-500">Gestão de equipe comercial e permissões.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Novo Vendedor
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar vendedor..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="h-40 bg-white/50 animate-pulse rounded-2xl border border-slate-200" />)
        ) : filteredSellers.length > 0 ? (
          filteredSellers.map((seller) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={seller.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <UserSquare2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{seller.name || 'Sem Nome'}</h3>
                      <div className="flex items-center gap-2">
                         <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", seller.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
                          {seller.active ? 'Ativo' : 'Inativo'}
                        </span>
                        {seller.auth_uid && <BadgeCheck className="w-3.5 h-3.5 text-blue-500" title="Auth Linked" />}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(seller)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(seller.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {seller.email}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50">
                 <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Permissões Especiais</h4>
                 <div className="flex flex-wrap gap-2">
                    {Object.entries(seller.permissions || {}).map(([key, val]) => (
                      val && <span key={key} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{key.replace('can_', '').replace(/_/g, ' ')}</span>
                    ))}
                 </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">Nenhum vendedor cadastrado.</div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-bold font-display">{editingSeller ? 'Editar Vendedor' : 'Novo Vendedor'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Completo *</label>
                    <input required type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail *</label>
                    <input required type="email" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                  </div>
                   <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Auth UID</label>
                    <input type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.auth_uid} onChange={(e) => setFormData({...formData, auth_uid: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-3">
                   <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                     <ShieldCheck className="w-4 h-4" />
                     Permissões Dinâmicas
                   </h4>
                   <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'can_edit_clients', label: 'Editar Clientes' },
                        { id: 'can_view_finance', label: 'Ver Financeiro' },
                        { id: 'can_manage_stock', label: 'Gerenciar Estoque' },
                        { id: 'can_give_discount', label: 'Dar Descontos' }
                      ].map((p) => (
                        <label key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                           <input 
                            type="checkbox" 
                            checked={(formData.permissions as any)[p.id]} 
                            onChange={(e) => setFormData({
                              ...formData, 
                              permissions: { ...formData.permissions, [p.id]: e.target.checked }
                            })}
                            className="w-5 h-5 accent-primary" 
                           />
                           <span className="text-sm font-medium text-slate-700">{p.label}</span>
                        </label>
                      ))}
                   </div>
                </div>

                <div className="flex items-center gap-3">
                  <input type="checkbox" id="activeSeller" checked={formData.active} onChange={(e) => setFormData({...formData, active: e.target.checked})} className="w-5 h-5 accent-primary" />
                  <label htmlFor="activeSeller" className="text-sm font-bold text-slate-700">Vendedor Ativo</label>
                </div>
              </form>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl">Cancelar</button>
                <button onClick={handleSubmit} disabled={saving} className="flex-[2] bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                  {saving ? 'Gravando...' : 'Salvar Vendedor'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
