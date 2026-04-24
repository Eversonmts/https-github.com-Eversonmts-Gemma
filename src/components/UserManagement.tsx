import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  Truck, 
  UserSquare2, 
  Mail,
  UserCheck,
  UserX,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    // Realtime sub
    const sub = supabase.channel('profiles-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchUsers()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleUpdateUser = async (uid: string, updates: any) => {
    setUpdating(uid);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', uid);

      if (error) throw error;
      
      // If role is updated, sync with respective tables if needed
      // (Simplified logic: we mostly care about profiles.role now)
      
      toast.success('Usuário atualizado!');
    } catch (err: any) {
      toast.error('Erro ao atualizar usuário');
    } finally {
      setUpdating(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = users.filter(u => !u.approved).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            Controle de Acessos
            {pendingCount > 0 && <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">{pendingCount} PENDENTE(S)</span>}
          </h3>
          <p className="text-xs text-slate-500">Aprove novos usuários e atribua funções no sistema.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Pesquisar usuários..."
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/10 w-full md:w-64"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-2xl" />)
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((u) => (
            <motion.div 
              layout
              key={u.id}
              className={cn(
                "p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                u.approved ? "bg-white border-slate-100" : "bg-orange-50/30 border-orange-100 shadow-sm shadow-orange-100"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                   <div className={cn(
                     "w-12 h-12 rounded-2xl flex items-center justify-center",
                     u.approved ? "bg-slate-100 text-slate-400" : "bg-orange-100 text-orange-500"
                   )}>
                     {u.photo_url ? <img src={u.photo_url} className="w-full h-full object-cover rounded-2xl" /> : <Users className="w-6 h-6" />}
                   </div>
                   {u.approved ? (
                     <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-0.5 rounded-full border-2 border-white">
                       <CheckCircle2 className="w-3 h-3" />
                     </div>
                   ) : (
                     <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white p-0.5 rounded-full border-2 border-white">
                       <Shield className="w-3 h-3" />
                     </div>
                   )}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    {u.name || 'Sem Nome'}
                    {!u.approved && <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Aguardando</span>}
                  </h4>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Mail className="w-3 h-3" />
                    {u.email}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                {/* Role Switcher */}
                <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
                   {[
                     { id: 'admin', icon: Shield, label: 'Admin' },
                     { id: 'seller', icon: UserSquare2, label: 'Vendedor' },
                     { id: 'driver', icon: Truck, label: 'Entregador' }
                   ].map((role) => (
                     <button
                       key={role.id}
                       onClick={() => handleUpdateUser(u.id, { role: role.id })}
                       disabled={updating === u.id || u.role === role.id}
                       className={cn(
                         "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                         u.role === role.id 
                           ? "bg-white text-primary shadow-sm" 
                           : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                       )}
                       title={role.label}
                     >
                       <role.icon className="w-3 h-3" />
                       <span className="hidden sm:inline">{role.label}</span>
                     </button>
                   ))}
                </div>

                <div className="h-8 w-px bg-slate-100 hidden md:block" />

                {/* Approval Toggles */}
                {u.approved ? (
                  <button 
                    onClick={() => handleUpdateUser(u.id, { approved: false })}
                    disabled={updating === u.id || u.email === 'mattos.mmn@gmail.com'}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30"
                    title="Suspender Acesso"
                  >
                    <UserX className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={() => handleUpdateUser(u.id, { approved: true })}
                    disabled={updating === u.id || u.role === 'pending'}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-xs transition-all",
                      u.role === 'pending' 
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                        : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95"
                    )}
                  >
                    <UserCheck className="w-4 h-4" />
                    Aprovar Acesso
                  </button>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
             <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-400 font-medium">Nenhum usuário encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
