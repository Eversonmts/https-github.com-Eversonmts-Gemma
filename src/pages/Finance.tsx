import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  BarChart3, 
  Download
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Finance() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (data) setTransactions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
    const sub = supabase.channel('finance').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchTransactions()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const totals = transactions.reduce((acc, t) => {
    const val = Number(t.value) || 0;
    if (t.type === 'income') acc.income += val;
    if (t.type === 'expense') acc.expense += val;
    if (t.type === 'forecast') acc.forecast += val;
    return acc;
  }, { income: 0, expense: 0, forecast: 0 });

  const filteredTransactions = activeType === 'all' 
    ? transactions 
    : transactions.filter(t => t.type === activeType);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display text-left">Financeiro</h1>
          <p className="text-slate-500">Fluxo de caixa e controle de faturamento.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 flex items-center gap-2 hover:bg-slate-50">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-emerald-500 rounded-xl">
              <ArrowUpCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-slate-500 text-sm font-medium">Entradas Totais</p>
            <h3 className="text-2xl font-bold mt-1 text-emerald-600">R$ {totals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-red-400 rounded-xl">
              <ArrowDownCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-slate-500 text-sm font-medium">Saídas / Despesas</p>
            <h3 className="text-2xl font-bold mt-1 text-red-600">R$ {totals.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-500 rounded-xl">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-slate-500 text-sm font-medium">Saldo Líquido</p>
            <h3 className={cn("text-2xl font-bold mt-1", (totals.income - totals.expense) >= 0 ? "text-slate-900" : "text-red-600")}>
              R$ {(totals.income - totals.expense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </motion.div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            < DollarSign className="w-5 h-5 text-primary" />
            Transações Recentes
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
             {['all', 'income', 'expense', 'forecast'].map(type => (
               <button 
                key={type}
                onClick={() => setActiveType(type)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap",
                  activeType === type ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
               >
                 {type === 'all' ? 'Tudo' : type === 'income' ? 'Entradas' : type === 'expense' ? 'Saídas' : 'Previsões'}
               </button>
             ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
              <tr>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array(4).fill(0).map((_, i) => <tr key={i} className="h-16 animate-pulse bg-white/50" />)
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                       {new Date(t.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{t.description}</div>
                      {t.order_id && <div className="text-[10px] text-primary uppercase font-bold">Pedido #{t.order_id.slice(-6).toUpperCase()}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{t.category || 'Vendas'}</td>
                    <td className={cn("px-6 py-4 text-right font-bold", t.type === 'income' ? "text-emerald-600" : "text-red-500")}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.value.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400 font-medium whitespace-nowrap">Nenhuma transação registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
