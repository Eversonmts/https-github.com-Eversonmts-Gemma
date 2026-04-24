import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, X, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

export default function DriverManagement() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    vehicle_plate: '',
    active: true,
    fixed_value: 0,
  });

  const fetchDrivers = async () => {
    const { data } = await supabase.from('drivers').select('*').order('name');
    if (data) setDrivers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
    const sub = supabase.channel('drivers').on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchDrivers()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...formData, updated_at: new Date().toISOString() };
      if (editingDriver) {
        const { error } = await supabase.from('drivers').update(data).eq('id', editingDriver.id);
        if (error) throw error;
        toast.success('Entregador atualizado');
      } else {
        const { error } = await supabase.from('drivers').insert([data]);
        if (error) throw error;
        toast.success('Entregador cadastrado');
      }
      setIsModalOpen(false);
    } catch (err: any) { 
      toast.error(`Erro ao salvar: ${err.message}`); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Equipe de Logística</h3>
        <button onClick={() => { setEditingDriver(null); setFormData({ name: '', email: '', phone: '', vehicle_plate: '', active: true, fixed_value: 0 }); setIsModalOpen(true); }} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
          <Plus className="w-3 h-3" /> Novo Entregador
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {drivers.map(d => (
          <div key={d.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <Truck className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">{d.name}</h4>
                <p className="text-[10px] text-slate-500">{d.email} • {d.vehicle_plate || 'Sem Placa'}</p>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => { setEditingDriver(d); setFormData({ name: d.name, email: d.email, phone: d.phone || '', vehicle_plate: d.vehicle_plate || '', active: d.active, fixed_value: d.fixed_value || 0 }); setIsModalOpen(true); }} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-primary"><Edit2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6">
                <h3 className="font-bold text-lg mb-4">{editingDriver ? 'Editar Entregador' : 'Novo Entregador'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label>
                      <input required type="text" className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">E-mail (Acesso)</label>
                      <input required type="email" className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Placa</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none text-sm" value={formData.vehicle_plate} onChange={e => setFormData({...formData, vehicle_plate: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Taxa Fixa</label>
                        <input type="number" className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none text-sm font-bold" value={formData.fixed_value} onChange={e => setFormData({...formData, fixed_value: parseFloat(e.target.value)})} />
                      </div>
                   </div>
                   <button type="submit" disabled={saving} className="w-full py-3 bg-primary text-white rounded-xl font-bold">{saving ? 'Salvando...' : 'Salvar'}</button>
                   <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-2 text-slate-400 text-sm font-bold">Cancelar</button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
