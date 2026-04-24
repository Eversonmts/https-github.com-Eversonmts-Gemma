import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, MapPin, Phone, MessageSquare, Edit2, Trash2, X, ShoppingCart, UserCheck, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import Fuse from 'fuse.js';
import { useDebounce } from '../hooks/useDebounce';

interface Client {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  number: string;
  district: string;
  city: string;
  notes: string;
  type: 'final' | 'reseller';
  cpf: string;
  birth_date: string;
  extra_details: string;
  lat: number;
  lng: number;
  created_at: string;
}

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'final' | 'reseller'>('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    address: '',
    number: '',
    district: '',
    city: '',
    notes: '',
    type: 'final' as 'final' | 'reseller',
    cpf: '',
    birth_date: '',
    extra_details: '',
    lat: 0,
    lng: 0,
  });

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Clients fetch error:', error);
        toast.error('Erro ao carregar clientes');
      } else {
        setClients(data || []);
      }
    } catch (err) {
      console.error('Clients fetch catch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();

    const channel = supabase
      .channel('public:clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchClients();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      whatsapp: '',
      address: '',
      number: '',
      district: '',
      city: '',
      notes: '',
      type: 'final',
      cpf: '',
      birth_date: '',
      extra_details: '',
      lat: 0,
      lng: 0,
    });
    setEditingClient(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('O nome é obrigatório');
      return;
    }

    setSaving(true);
    const toastId = toast.loading(editingClient ? 'Atualizando cliente...' : 'Salvando cliente...');

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingClient.id);
        
        if (error) throw error;
        toast.success('Cliente atualizado!', { id: toastId });
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([{
            ...formData,
            updated_at: new Date().toISOString()
          }]);
        
        if (error) throw error;
        toast.success('Cliente cadastrado!', { id: toastId });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Supabase Client Error:", error);
      toast.error(`Erro: ${error.message}`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone || '',
      whatsapp: client.whatsapp,
      address: client.address,
      number: client.number,
      district: client.district,
      city: client.city,
      notes: client.notes,
      type: client.type || 'final',
      cpf: client.cpf || '',
      birth_date: client.birth_date || '',
      extra_details: client.extra_details || '',
      lat: client.lat,
      lng: client.lng,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        toast.success('Cliente excluído!');
      } catch (error) {
        toast.error('Erro ao excluir.');
      }
    }
  };

  const filteredClients = useMemo(() => {
    let result = clients;
    
    // Filter by tab first
    if (activeTab !== 'all') {
      result = result.filter(c => c.type === activeTab);
    }
    
    // Then fuzzy search
    if (!debouncedSearch) return result;
    
    const fuse = new Fuse(result, {
      keys: ['name', 'whatsapp', 'phone', 'city', 'district', 'address'],
      threshold: 0.3,
      distance: 100,
    });
    
    return fuse.search(debouncedSearch).map(r => r.item);
  }, [clients, debouncedSearch, activeTab]);

  const handleQuickSale = (client: Client) => {
    // Navigate to new sale with client pre-selected
    navigate('/sales/new', { state: { clientId: client.id } });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display">Clientes</h1>
          <p className="text-slate-500">Gerencie sua base de contatos e endereços.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Novo Cliente
        </button>
      </div>

      <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 w-fit">
        {[
          { id: 'all', label: 'Todos', icon: UserCheck },
          { id: 'final', label: 'Clientes Finais', icon: UserCheck },
          { id: 'reseller', label: 'Revendas', icon: Briefcase },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === tab.id ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar por nome ou telefone..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array(6).fill(0).map((_, i) => <div key={i} className="h-48 bg-white/50 animate-pulse rounded-2xl border border-slate-100" />)
        ) : filteredClients.length > 0 ? (
          filteredClients.map((client) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={client.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg text-slate-800">{client.name || 'Sem Nome'}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleQuickSale(client)} className="p-2 hover:bg-primary/10 rounded-lg text-primary" title="Nova Venda"><ShoppingCart className="w-4 h-4" /></button>
                    <button onClick={() => handleEdit(client)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                   <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full", client.type === 'reseller' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700")}>
                     {client.type === 'reseller' ? 'Revenda' : 'Consumidor Final'}
                   </span>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">{client.whatsapp || 'N/A'}</span>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {(client.address) && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <span className="break-words">
                        {client.address}
                        {client.number ? `, ${client.number}` : ''}
                        {client.district ? ` - ${client.district}` : ''}
                        {client.city ? `, ${client.city}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <a 
                  href={`tel:${client.phone || client.whatsapp}`}
                  className="p-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                  title="Ligar"
                >
                  <Phone className="w-5 h-5" />
                </a>
                <a 
                  href={`https://wa.me/55${(client.whatsapp || '').replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className={cn(
                    "flex-1 text-white py-2 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity",
                    client.whatsapp ? "bg-[#25D366]" : "bg-slate-300 pointer-events-none"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp
                </a >
                <button 
                  onClick={() => {
                    const addr = encodeURIComponent(`${client.address}, ${client.number}, ${client.city}`);
                    if (window.confirm('Abrir no Waze? Clique Cancelar para Google Maps.')) {
                      window.open(`https://waze.com/ul?q=${addr}`, '_blank');
                    } else {
                      window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank');
                    }
                  }}
                  className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Rota
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center">
            <p className="text-slate-500">Nenhum cliente encontrado.</p>
          </div>
        )}
      </div>

      {/* Modal Reutilizável */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !saving && setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                <button onClick={() => !saving && setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Tipo de Cliente */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", formData.type === 'reseller' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600")}>
                      {formData.type === 'reseller' ? <Briefcase className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{formData.type === 'reseller' ? 'Revenda' : 'Cliente Final'}</h4>
                      <p className="text-xs text-slate-500">Defina se este é um consumidor ou revendedor.</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, type: formData.type === 'final' ? 'reseller' : 'final'})}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none",
                      formData.type === 'reseller' ? "bg-primary" : "bg-slate-300"
                    )}
                  >
                    <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", formData.type === 'reseller' ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome Completo *</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                      WhatsApp *
                      <span className="text-[10px] text-green-500">(Obrigatório)</span>
                    </label>
                    <input 
                      required
                      type="text" 
                      placeholder="(41) 99999-9999"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Telefone Principal</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>

                  <div className="md:col-span-2 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                       <MapPin className="w-4 h-4 text-primary" />
                       Endereço (Curitiba e Região)
                    </h3>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rua / Logradouro *</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Rua das Flores"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Número</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        value={formData.number}
                        onChange={(e) => setFormData({...formData, number: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bairro</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        value={formData.district}
                        onChange={(e) => setFormData({...formData, district: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cidade</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    />
                  </div>

                  <div className="md:col-span-2 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                       <Plus className="w-4 h-4 text-primary" />
                       Dados Adicionais
                    </h3>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">CPF / CNPJ</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={formData.cpf}
                      onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data de Nascimento</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observações / Detalhes</label>
                  <textarea 
                    placeholder="Ex: Ponto de referência, preferências..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[100px]"
                    value={formData.extra_details}
                    onChange={(e) => setFormData({...formData, extra_details: e.target.value})}
                  />
                </div>
              </form>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button 
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-[2] bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : 'Salvar Cliente'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
