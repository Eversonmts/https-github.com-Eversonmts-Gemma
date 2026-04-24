import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Save, 
  Bell, 
  Shield, 
  Globe, 
  Camera, 
  Lock, 
  Mail, 
  Smartphone,
  Palette,
  Truck,
  Users,
  Plus,
  X,
  UserSquare2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import SellerManagement from '../components/SellerManagement';
import DriverManagement from '../components/DriverManagement';
import UserManagement from '../components/UserManagement';

type Tab = 'company' | 'security' | 'notifications' | 'appearance' | 'delivery' | 'sellers' | 'drivers' | 'users';

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('company');
  
  const [formData, setFormData] = useState({
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    logo_url: '',
    tax_id: '',
    website: '',
    // Security
    two_factor: false,
    session_timeout: '24h',
    // Notifications
    notify_email: true,
    notify_whatsapp: false,
    notify_low_stock: true,
    // Appearance
    theme_color: '#2563eb',
    font_size: 'base',
    // Order Statuses
    order_statuses: [
      { id: 'novo', label: 'Pedido feito', color: 'blue' },
      { id: 'confirmado', label: 'Confirmado', color: 'emerald' },
      { id: 'em-rota', label: 'Em rota', color: 'purple' },
      { id: 'entregue', label: 'Entregue', color: 'slate' },
      { id: 'cancelado', label: 'Cancelado', color: 'red' },
      { id: 'remarcado', label: 'Remarcado', color: 'orange' }
    ],
    default_delivery_fee: 0,
    estimated_delivery_time: '45 min'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: cfg } = await supabase.from('settings').select('*').eq('id', 'config').single();
        if (cfg?.value) {
          setFormData(prev => ({ ...prev, ...cfg.value }));
        }
      } catch (e) {
        console.error("Error fetching settings:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const tid = toast.loading('Salvando alterações...');
    try {
      const { error } = await supabase.from('settings').upsert({
        id: 'config',
        value: formData,
        updated_at: new Date().toISOString()
      });
      
      if (error) throw error;
      toast.success('Configurações aplicadas com sucesso!', { id: tid });
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao salvar as configurações.', { id: tid });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="flex flex-col items-center gap-4 text-slate-400">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        <p className="font-medium">Carregando painel de controle...</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display text-left">Configurações do GEMA</h1>
          <p className="text-slate-500">Mantenha seu sistema atualizado e seguro.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Efetuando Gravação...' : 'Gravar Alterações'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Navigation Tabs */}
        <div className="md:col-span-3 space-y-1">
          <nav className="flex flex-col gap-1">
            {[
              { id: 'company', label: 'Dados da Empresa', icon: Building2 },
              { id: 'sellers', label: 'Gestão de Vendedores', icon: UserSquare2 },
              { id: 'drivers', label: 'Gestão de Entregadores', icon: Truck },
              { id: 'users', label: 'Aprovação de Usuários', icon: Users },
              { id: 'delivery', label: 'Ajustes de Entrega', icon: Truck },
              { id: 'security', label: 'Segurança & Acesso', icon: Shield },
              { id: 'notifications', label: 'Notificações', icon: Bell },
              { id: 'appearance', label: 'Aparência & Marca', icon: Palette },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm group",
                  activeTab === tab.id 
                    ? "bg-primary text-white shadow-md" 
                    : "text-slate-500 hover:bg-white hover:text-slate-900"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-white" : "text-slate-400 group-hover:text-primary")} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="md:col-span-9">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8"
          >
            {activeTab === 'company' && (
              <div className="space-y-8">
                <div className="flex items-center gap-8 pb-8 border-b border-slate-50">
                  <div className="relative group cursor-pointer">
                    <div className="w-28 h-28 rounded-3xl bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden group-hover:bg-slate-100 transition-colors">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Camera className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center">
                       <span className="text-white text-[10px] font-bold bg-primary px-2 py-1 rounded-md">UPLOAD PHOTO</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Logo e Identidade Visual</h4>
                    <p className="text-sm text-slate-500 max-w-sm">Esta imagem aparecerá em seus pedidos, relatórios e documentos oficiais.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Razão Social / Nome Fantasia</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">CNPJ / CPF</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none" value={formData.tax_id} onChange={(e) => setFormData({...formData, tax_id: e.target.value})} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Endereço Fiscal Completo</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none" value={formData.company_address} onChange={(e) => setFormData({...formData, company_address: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">E-mail Comercial</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="email" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none" value={formData.company_email} onChange={(e) => setFormData({...formData, company_email: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">WhatsApp / Telefone</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none" value={formData.company_phone} onChange={(e) => setFormData({...formData, company_phone: e.target.value})} />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Site Oficial (Opcional)</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-8">
                <div>
                   <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-6">Políticas de Acesso</h3>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                         <div className="flex items-center gap-3">
                            <Lock className="w-5 h-5 text-slate-400" />
                            <div>
                               <h5 className="font-bold text-sm">Autenticação de Dois Fatores</h5>
                               <p className="text-xs text-slate-500">Exigir código via SMS ou E-mail para logins.</p>
                            </div>
                         </div>
                         <button 
                            onClick={() => setFormData({...formData, two_factor: !formData.two_factor})}
                            className={cn("w-12 h-6 rounded-full transition-colors relative", formData.two_factor ? "bg-primary" : "bg-slate-300")}
                         >
                            <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", formData.two_factor ? "left-7" : "left-1")} />
                         </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                         <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-slate-400" />
                            <div>
                               <h5 className="font-bold text-sm">Tempo de Sessão Administrativa</h5>
                               <p className="text-xs text-slate-500">Logoff automático após inatividade.</p>
                            </div>
                         </div>
                         <select 
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-sm font-bold shadow-sm outline-none"
                            value={formData.session_timeout}
                            onChange={(e) => setFormData({...formData, session_timeout: e.target.value})}
                         >
                            <option value="1h">1 Hora</option>
                            <option value="12h">12 Horas</option>
                            <option value="24h">24 Horas</option>
                            <option value="7d">7 Dias</option>
                         </select>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                 <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-6">Configurações de Alerta</h3>
                 {[
                   { id: 'notify_email', label: 'Relatórios por E-mail', desc: 'Envio de fechamento diário automaticamente.' },
                   { id: 'notify_whatsapp', label: 'Status via WhatsApp', desc: 'Alertas de novos pedidos via API (Requer integração).' },
                   { id: 'notify_low_stock', label: 'Alerta de Estoque Baixo', desc: 'Notificar quando o produto atingir limite mínimo.' }
                 ].map((opt) => (
                    <label key={opt.id} className="flex items-center justify-between p-5 border border-slate-100 rounded-3xl hover:bg-slate-50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-white rounded-2xl border border-slate-100 group-hover:border-primary/20 transition-colors">
                            <Bell className="w-5 h-5 text-primary" />
                         </div>
                         <div>
                            <h5 className="font-bold text-slate-800">{opt.label}</h5>
                            <p className="text-xs text-slate-500">{opt.desc}</p>
                         </div>
                      </div>
                      <input 
                        type="checkbox" 
                        className="w-6 h-6 accent-primary rounded-lg" 
                        checked={(formData as any)[opt.id]}
                        onChange={(e) => setFormData({ ...formData, [opt.id]: e.target.checked })}
                      />
                    </label>
                 ))}
              </div>
            )}

            {activeTab === 'sellers' && (
              <SellerManagement />
            )}

            {activeTab === 'drivers' && (
              <DriverManagement />
            )}

            {activeTab === 'users' && (
              <UserManagement />
            )}

            {activeTab === 'users' && (
              <UserManagement />
            )}

            {activeTab === 'delivery' && (
              <div className="space-y-8">
                 <div className="border-b border-slate-100 pb-4 mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Gestão de Status de Pedido</h3>
                    <p className="text-sm text-slate-500">Configure as etapas do fluxo de entrega da sua operação.</p>
                 </div>
                 
                 <div className="space-y-4">
                    {formData.order_statuses.map((status, index) => (
                      <div key={index} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Nome da Etapa</label>
                            <input 
                              type="text" 
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none font-bold"
                              value={status.label}
                              onChange={(e) => {
                                const newStatuses = [...formData.order_statuses];
                                newStatuses[index].label = e.target.value;
                                setFormData({...formData, order_statuses: newStatuses});
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Cor (Base)</label>
                            <select 
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none font-bold"
                              value={status.color}
                              onChange={(e) => {
                                const newStatuses = [...formData.order_statuses];
                                newStatuses[index].color = e.target.value;
                                setFormData({...formData, order_statuses: newStatuses});
                              }}
                            >
                              <option value="blue">Azul (Informação)</option>
                              <option value="orange">Laranja (Alerta)</option>
                              <option value="emerald">Verde (Sucesso)</option>
                              <option value="purple">Roxo (Logística)</option>
                              <option value="red">Vermelho (Erro/Cancelado)</option>
                              <option value="slate">Cinza (Finalizado)</option>
                            </select>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            const newStatuses = formData.order_statuses.filter((_, i) => i !== index);
                            setFormData({...formData, order_statuses: newStatuses});
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => {
                        setFormData({
                          ...formData, 
                          order_statuses: [
                            ...formData.order_statuses, 
                            { id: `status-${Date.now()}`, label: 'Novo Status', color: 'blue' }
                          ]
                        });
                      }}
                      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Nova Etapa
                    </button>
                 </div>

                 <div className="pt-8 border-t border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Padrões de Logística</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Taxa de Entrega Padrão (R$)</label>
                          <input 
                            type="number" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none" 
                            value={formData.default_delivery_fee} 
                            onChange={(e) => setFormData({...formData, default_delivery_fee: Number(e.target.value)})} 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tempo Estimado de Entrega</label>
                          <input 
                            type="text" 
                            placeholder="Ex: 45 min"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none" 
                            value={formData.estimated_delivery_time} 
                            onChange={(e) => setFormData({...formData, estimated_delivery_time: e.target.value})} 
                          />
                       </div>
                    </div>
                 </div>
              </div>
            )}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                 <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-6">Personalização Visual</h3>
                 <div className="space-y-6">
                    <div className="space-y-3">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cor Principal do Sistema</label>
                       <div className="flex gap-3">
                          {['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#16a34a', '#d97706'].map(color => (
                            <button
                              key={color}
                              onClick={() => setFormData({...formData, theme_color: color})}
                              className={cn(
                                "w-10 h-10 rounded-full border-4 transition-all scale-100 hover:scale-110 shadow-sm",
                                formData.theme_color === color ? "border-slate-800 ring-4 ring-slate-100" : "border-transparent"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                       </div>
                    </div>
                    <div className="space-y-3">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Escala da Fonte</label>
                       <div className="flex gap-2">
                          {['sm', 'base', 'lg'].map(size => (
                             <button
                                key={size}
                                onClick={() => setFormData({...formData, font_size: size})}
                                className={cn(
                                  "flex-1 py-3 rounded-2xl border font-bold text-sm transition-all capitalize",
                                  formData.font_size === size ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                )}
                             >
                               {size === 'base' ? 'Padrão' : size === 'sm' ? 'Compacto' : 'Amplo'}
                             </button>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
