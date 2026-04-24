import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Truck, Phone, Mail, Car, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import Fuse from 'fuse.js';
import { useDebounce } from '../hooks/useDebounce';

interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  vehicle_plate: string;
  payment_type: string;
  fixed_value: number;
  active: boolean;
  auth_uid: string;
  created_at: any;
}

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    vehicle: '',
    vehicle_plate: '',
    payment_type: 'fixo',
    fixed_value: 0,
    active: true,
    auth_uid: '',
  });

  useEffect(() => {
    const fetchDrivers = async () => {
      const { data } = await supabase.from('drivers').select('*');
      if (data) setDrivers(data as Driver[]);
      setLoading(false);
    };
    fetchDrivers();
    const sub = supabase.channel('drivers-page').on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchDrivers()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      vehicle: '',
      vehicle_plate: '',
      payment_type: 'fixo',
      fixed_value: 0,
      active: true,
      auth_uid: '',
    });
    setEditingDriver(null);
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
      const data = {
        ...formData,
        updated_at: new Date().toISOString(),
      };

      if (editingDriver) {
        const { error } = await supabase.from('drivers').update(data).eq('id', editingDriver.id);
        if (error) throw error;
        toast.success('Entregador atualizado!', { id: tid });
      } else {
        const { error } = await supabase.from('drivers').insert([data]);
        if (error) throw error;
        toast.success('Entregador cadastrado!', { id: tid });
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

  const handleEdit = (d: Driver) => {
    setEditingDriver(d);
    setFormData({
      name: d.name,
      phone: d.phone,
      email: d.email,
      vehicle: d.vehicle,
      vehicle_plate: d.vehicle_plate || '',
      payment_type: d.payment_type,
      fixed_value: d.fixed_value,
      active: d.active,
      auth_uid: d.auth_uid || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Excluir este entregador?')) {
      try {
        const { error } = await supabase.from('drivers').delete().eq('id', id);
        if (error) throw error;
        toast.success('Entregador excluído');
      } catch (err) {
        toast.error('Erro ao excluir');
      }
    }
  };

  const filteredDrivers = useMemo(() => {
    if (!debouncedSearch) return drivers;
    
    const fuse = new Fuse(drivers, {
      keys: ['name', 'email', 'phone', 'vehicle', 'vehicle_plate'],
      threshold: 0.3,
    });
    
    return fuse.search(debouncedSearch).map(r => r.item);
  }, [drivers, debouncedSearch]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display text-left">Entregadores</h1>
          <p className="text-slate-500">Gerencie sua equipe de entregas e veículos.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Novo Entregador
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar entregador..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="h-48 bg-white/50 animate-pulse rounded-2xl border border-slate-100" />)
        ) : filteredDrivers.length > 0 ? (
          filteredDrivers.map((driver) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={driver.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Truck className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{driver.name || 'Sem Nome'}</h3>
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", driver.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
                      {driver.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(driver)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(driver.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {driver.email}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {driver.phone || 'N/A'}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Car className="w-4 h-4 text-slate-400" />
                  {driver.vehicle || 'N/A'} {driver.vehicle_plate ? `(${driver.vehicle_plate})` : ''}
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/5 p-2 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                  R$ {driver.fixed_value.toFixed(2)} ({driver.payment_type})
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">Nenhum entregador cadastrado.</div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-bold font-display">{editingDriver ? 'Editar Entregador' : 'Novo Entregador'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-4 max-h-[75vh] overflow-y-auto">
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
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                    <input type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Veículo</label>
                    <input type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" placeholder="Moto, Carro..." value={formData.vehicle} onChange={(e) => setFormData({...formData, vehicle: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Placa do Veículo</label>
                    <input type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" placeholder="ABC-1234" value={formData.vehicle_plate} onChange={(e) => setFormData({...formData, vehicle_plate: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Pagamento</label>
                    <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none" value={formData.payment_type} onChange={(e) => setFormData({...formData, payment_type: e.target.value})}>
                      <option value="fixo">Valor Fixo por Entrega</option>
                      <option value="diaria">Diária Fixa</option>
                      <option value="comissao">Comissão (%)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor do Repasse (R$)</label>
                    <input type="number" step="0.01" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.fixed_value} onChange={(e) => setFormData({...formData, fixed_value: parseFloat(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">UID de Autenticação (Opcional)</label>
                    <input type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.auth_uid} onChange={(e) => setFormData({...formData, auth_uid: e.target.value})} />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <input type="checkbox" id="activeDriver" checked={formData.active} onChange={(e) => setFormData({...formData, active: e.target.checked})} className="w-5 h-5 accent-primary" />
                    <label htmlFor="activeDriver" className="text-sm font-bold text-slate-700">Entregador Ativo</label>
                  </div>
                </div>
              </form>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button onClick={handleSubmit} disabled={saving} className="flex-[2] bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                  {saving ? 'Gravando...' : 'Salvar Entregador'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
