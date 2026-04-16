import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../App';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Download, Settings, Plus, TrendingUp, TrendingDown, Wallet, PieChart as PieIcon, FileText, Table } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: any;
}

const INCOME_CATEGORIES = [
  'Dízimos',
  'Ofertas',
  'Ofertas Designadas',
  'Eventos',
  'Doações',
  'Outros'
];

const EXPENSE_CATEGORIES = [
  'Água',
  'Energia',
  'Aluguel',
  'Limpeza',
  'Manutenção',
  'Som/Vídeo',
  'Social',
  'Missões',
  'Outros'
];

const COLORS = ['#4A6741', '#2D3E27', '#D4AF37', '#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F4A460'];

export function FinanceView({ profile }: { profile: UserProfile }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [church, setChurch] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newTx, setNewTx] = useState({ type: 'income' as 'income' | 'expense', amount: '', category: INCOME_CATEGORIES[0], description: '' });
  
  const [initialBalance, setInitialBalance] = useState('');
  const [fixedExpenses, setFixedExpenses] = useState<{category: string, amount: number}[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });
    
    const churchUnsubscribe = onSnapshot(doc(db, 'churches', 'main_church'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChurch(data);
        setInitialBalance(data.initialBalance?.toString() || '0');
        setFixedExpenses(data.fixedExpenses || []);
      }
    });

    return () => {
      unsubscribe();
      churchUnsubscribe();
    };
  }, []);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const currentInitialBalance = parseFloat(initialBalance) || 0;
  const balance = currentInitialBalance + totalIncome - totalExpense;
  
  const totalFixedExpenses = fixedExpenses.reduce((acc, e) => acc + e.amount, 0);
  const fixedCostsGoal = church?.fixedCostsGoal || totalFixedExpenses || 1000;
  const progress = Math.min((totalIncome / fixedCostsGoal) * 100, 100);

  const expenseData = useMemo(() => {
    const data: { name: string, value: number }[] = [];
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const existing = data.find(d => d.name === t.category);
      if (existing) existing.value += t.amount;
      else data.push({ name: t.category, value: t.amount });
    });
    return data;
  }, [transactions]);

  const barData = [
    { name: 'Entradas', valor: totalIncome },
    { name: 'Saídas', valor: totalExpense },
    { name: 'Saldo', valor: balance }
  ];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'transactions'), {
      ...newTx,
      amount: parseFloat(newTx.amount),
      date: serverTimestamp()
    });
    setShowAdd(false);
    setNewTx({ type: 'income', amount: '', category: INCOME_CATEGORIES[0], description: '' });
  };

  const handleSaveSettings = async () => {
    await updateDoc(doc(db, 'churches', 'main_church'), {
      initialBalance: parseFloat(initialBalance),
      fixedExpenses: fixedExpenses,
      fixedCostsGoal: totalFixedExpenses
    });
    setShowSettings(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Balancete Financeiro - Árvore da Vida', 14, 15);
    doc.text(`Saldo Inicial: R$ ${currentInitialBalance.toLocaleString()}`, 14, 25);
    doc.text(`Total Entradas: R$ ${totalIncome.toLocaleString()}`, 14, 32);
    doc.text(`Total Saídas: R$ ${totalExpense.toLocaleString()}`, 14, 39);
    doc.text(`Saldo Atual: R$ ${balance.toLocaleString()}`, 14, 46);

    const tableData = transactions.map(t => [
      t.date?.toDate().toLocaleDateString() || '-',
      t.type === 'income' ? 'Entrada' : 'Saída',
      t.category,
      t.description,
      `R$ ${t.amount.toLocaleString()}`
    ]);

    (doc as any).autoTable({
      head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']],
      body: tableData,
      startY: 55
    });

    doc.save('balancete.pdf');
  };

  const exportExcel = () => {
    const data = transactions.map(t => ({
      Data: t.date?.toDate().toLocaleDateString() || '-',
      Tipo: t.type === 'income' ? 'Entrada' : 'Saída',
      Categoria: t.category,
      Descrição: t.description,
      Valor: t.amount
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transações");
    XLSX.writeFile(wb, "balancete.xlsx");
  };

  const isPrivileged = profile.role === 'admin' || profile.role === 'treasurer';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-serif text-church-primary italic">Mordomia</h2>
        <div className="flex gap-2">
          {isPrivileged && (
            <>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 bg-stone-100 text-stone-600 rounded-full hover:bg-stone-200 transition-colors"
              >
                <Settings size={20} />
              </button>
              <button 
                onClick={() => setShowAdd(!showAdd)}
                className="bg-church-primary text-white px-4 py-2 rounded-full text-sm flex items-center gap-2"
              >
                <Plus size={16} /> {showAdd ? 'Cancelar' : 'Lançamento'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dashboard Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-[2.5rem] space-y-6">
          <div className="flex items-center gap-2 text-church-secondary">
            <TrendingUp size={20} />
            <h3 className="font-bold uppercase text-xs tracking-widest">Resumo Financeiro</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 1 ? '#ef4444' : '#4A6741'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 rounded-[2.5rem] space-y-6">
          <div className="flex items-center gap-2 text-church-secondary">
            <PieIcon size={20} />
            <h3 className="font-bold uppercase text-xs tracking-widest">Despesas por Categoria</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-3xl border-l-4 border-blue-400">
          <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">Saldo Inicial</p>
          <p className="text-xl font-bold text-stone-700">R$ {currentInitialBalance.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl border-l-4 border-green-500">
          <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">Entradas</p>
          <p className="text-xl font-bold text-green-600">R$ {totalIncome.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl border-l-4 border-red-500">
          <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">Saídas</p>
          <p className="text-xl font-bold text-red-600">R$ {totalExpense.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl border-l-4 border-church-primary">
          <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">Saldo Atual</p>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-church-primary' : 'text-red-800'}`}>
            R$ {balance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Financial Health & Progress */}
      <div className="glass-card p-8 rounded-[3rem] bg-gradient-to-br from-white to-stone-50">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <p className="text-stone-500 text-sm uppercase tracking-widest mb-1">Saúde Financeira</p>
            <h3 className={`text-4xl font-serif font-bold ${balance >= totalFixedExpenses ? 'text-green-600' : 'text-red-600'}`}>
              {balance >= totalFixedExpenses ? 'Saudável' : 'Atenção'}
            </h3>
            <p className="text-xs text-stone-400 mt-2">
              Meta de Custos Fixos: R$ {totalFixedExpenses.toLocaleString()}
            </p>
          </div>
          <div className="w-full md:w-64 space-y-2">
            <div className="flex justify-between text-[10px] uppercase text-stone-400 font-bold">
              <span>Cobertura de Custos</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-4 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
              <div 
                className={`h-full transition-all duration-1000 ${progress >= 100 ? 'bg-green-500' : 'bg-church-primary'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && isPrivileged && (
        <div className="glass-card p-8 rounded-[2.5rem] space-y-6 animate-in zoom-in duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-church-secondary">Configurações Financeiras</h3>
            <button onClick={() => setShowSettings(false)} className="text-stone-400">✕</button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Saldo Inicial do Banco (R$)</label>
              <input 
                type="number" 
                className="w-full p-3 rounded-xl bg-stone-100 border-none"
                value={initialBalance}
                onChange={e => setInitialBalance(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-stone-400 uppercase">Despesas Fixas Mensais</p>
              {fixedExpenses.map((exp, idx) => (
                <div key={idx} className="flex gap-2">
                  <input 
                    type="text" placeholder="Categoria"
                    className="flex-1 p-2 rounded-lg bg-stone-100 border-none text-sm"
                    value={exp.category}
                    onChange={e => {
                      const newExp = [...fixedExpenses];
                      newExp[idx].category = e.target.value;
                      setFixedExpenses(newExp);
                    }}
                  />
                  <input 
                    type="number" placeholder="Valor"
                    className="w-32 p-2 rounded-lg bg-stone-100 border-none text-sm"
                    value={exp.amount}
                    onChange={e => {
                      const newExp = [...fixedExpenses];
                      newExp[idx].amount = parseFloat(e.target.value) || 0;
                      setFixedExpenses(newExp);
                    }}
                  />
                  <button 
                    onClick={() => setFixedExpenses(fixedExpenses.filter((_, i) => i !== idx))}
                    className="text-red-400 px-2"
                  >✕</button>
                </div>
              ))}
              <button 
                onClick={() => setFixedExpenses([...fixedExpenses, { category: '', amount: 0 }])}
                className="text-xs text-church-primary font-bold hover:underline"
              >
                + Adicionar Despesa Fixa
              </button>
            </div>

            <button 
              onClick={handleSaveSettings}
              className="w-full bg-church-primary text-white p-3 rounded-xl font-bold"
            >
              Salvar Configurações
            </button>
          </div>
        </div>
      )}

      {/* Add Transaction Form */}
      {showAdd && isPrivileged && (
        <form onSubmit={handleAdd} className="glass-card p-6 rounded-3xl space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => setNewTx({...newTx, type: 'income', category: INCOME_CATEGORIES[0]})}
              className={`flex-1 p-3 rounded-xl font-bold transition-colors ${newTx.type === 'income' ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-400'}`}
            >
              Entrada
            </button>
            <button 
              type="button"
              onClick={() => setNewTx({...newTx, type: 'expense', category: EXPENSE_CATEGORIES[0]})}
              className={`flex-1 p-3 rounded-xl font-bold transition-colors ${newTx.type === 'expense' ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-400'}`}
            >
              Saída
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              type="number" placeholder="Valor (R$)" required
              className="w-full p-3 rounded-xl bg-stone-100 border-none"
              value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})}
            />
            <select 
              className="w-full p-3 rounded-xl bg-stone-100 border-none"
              value={newTx.category}
              onChange={e => setNewTx({...newTx, category: e.target.value})}
              required
            >
              {(newTx.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <input 
            type="text" placeholder="Descrição"
            className="w-full p-3 rounded-xl bg-stone-100 border-none"
            value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})}
          />
          <button className="w-full bg-church-primary text-white p-3 rounded-xl font-bold">Confirmar Lançamento</button>
        </form>
      )}

      {/* Transactions List & Export */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h4 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Transparência Viva</h4>
          <div className="flex gap-2">
            <button onClick={exportPDF} className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase">
              <FileText size={14} /> PDF
            </button>
            <button onClick={exportExcel} className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase">
              <Table size={14} /> Excel
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {transactions.map(t => (
            <div key={t.id} className="glass-card p-4 rounded-2xl flex justify-between items-center hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                </div>
                <div>
                  <p className="font-bold text-stone-800">{t.category}</p>
                  <p className="text-[10px] text-stone-400 uppercase">{t.date?.toDate().toLocaleDateString()} • {t.description || 'Sem descrição'}</p>
                </div>
              </div>
              {isPrivileged ? (
                <p className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString()}
                </p>
              ) : (
                <div className={`w-3 h-3 rounded-full ${t.type === 'income' ? 'bg-green-400' : 'bg-red-400'}`}></div>
              )}
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center py-10 text-stone-400 italic">Nenhuma transação registrada.</div>
          )}
        </div>
      </div>
    </div>
  );
}

