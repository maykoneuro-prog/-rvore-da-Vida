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
  const [fixedExpenses, setFixedExpenses] = useState<{category: string, amount: number, startDate?: string, installments?: number}[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }); // Default to current month

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

  // Calculate active fixed costs for the filtering period
  const activeFixedExpensesForPeriod = useMemo(() => {
    if (filterMonth === 'all') {
      return fixedExpenses.map(e => ({ ...e, isLiability: false }));
    }

    const [fYear, fMonth] = filterMonth.split('-').map(Number);
    const filterDate = new Date(fYear, fMonth - 1, 1);

    return fixedExpenses.filter(e => {
      if (!e.startDate) return true; // Legacy or always active
      const [sYear, sMonth] = e.startDate.split('-').map(Number);
      const startDate = new Date(sYear, sMonth - 1, 1);
      
      if (filterDate < startDate) return false;
      
      if (!e.installments || e.installments === 0) return true; // Continuous

      const monthsDiff = (filterDate.getFullYear() - startDate.getFullYear()) * 12 + (filterDate.getMonth() - startDate.getMonth());
      return monthsDiff < e.installments;
    }).map(e => ({ ...e, isLiability: true }));
  }, [fixedExpenses, filterMonth]);

  const totalFixedExpensesForPeriod = activeFixedExpensesForPeriod.reduce((acc, e) => acc + e.amount, 0);

  // Filtered transactions for the selected month/year
  const filteredTransactions = transactions.filter(t => {
    if (filterMonth === 'all') return true;
    const d = t.date?.toDate();
    if (!d) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === filterMonth;
  });

  const displayIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const actualExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  
  // Total expenses for the month includes fixed costs as "liability" if a month is selected
  const displayExpense = filterMonth === 'all' ? actualExpense : actualExpense + totalFixedExpensesForPeriod;
  
  // Real Balance is ALWAYS all-time actual money
  const globalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const globalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const currentInitialBalance = parseFloat(initialBalance) || 0;
  const balance = currentInitialBalance + globalIncome - globalExpense;

  const fixedCostsGoal = totalFixedExpensesForPeriod || 1;
  const progress = Math.min((displayIncome / fixedCostsGoal) * 100, 100);

  const expenseData = useMemo(() => {
    const data: { name: string, value: number }[] = [];
    
    // Add physical expenses
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
      const existing = data.find(d => d.name === t.category);
      if (existing) existing.value += t.amount;
      else data.push({ name: t.category, value: t.amount });
    });

    // Add fixed costs liabilities if not already paid/recorded as expense in this month
    if (filterMonth !== 'all') {
      activeFixedExpensesForPeriod.forEach(fe => {
        const existing = data.find(d => d.name === `[Prev] ${fe.category}`);
        if (existing) existing.value += fe.amount;
        else data.push({ name: `[Prev] ${fe.category}`, value: fe.amount });
      });
    }

    return data;
  }, [filteredTransactions, filterMonth, activeFixedExpensesForPeriod]);

  const barData = [
    { name: 'Entradas', valor: displayIncome },
    { name: 'Saídas', valor: actualExpense },
    { name: 'Custo Fixo', valor: totalFixedExpensesForPeriod }
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
      fixedExpenses: fixedExpenses
    });
    setShowSettings(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Balancete Financeiro - Árvore da Vida', 14, 15);
    doc.text(`Saldo Inicial: R$ ${currentInitialBalance.toLocaleString()}`, 14, 25);
    doc.text(`Total Entradas: R$ ${globalIncome.toLocaleString()}`, 14, 32);
    doc.text(`Total Saídas: R$ ${globalExpense.toLocaleString()}`, 14, 39);
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

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentFilterMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const currentMonthFixedExpenses = useMemo(() => {
    const filterDate = new Date(currentYear, currentMonth, 1);
    return fixedExpenses.filter(e => {
      if (!e.startDate) return true;
      const [sYear, sMonth] = e.startDate.split('-').map(Number);
      const startDate = new Date(sYear, sMonth - 1, 1);
      if (filterDate < startDate) return false;
      if (!e.installments || e.installments === 0) return true;
      const monthsDiff = (filterDate.getFullYear() - startDate.getFullYear()) * 12 + (filterDate.getMonth() - startDate.getMonth());
      return monthsDiff < e.installments;
    }).reduce((acc, e) => acc + e.amount, 0);
  }, [fixedExpenses]);

  const [previewMemberMode, setPreviewMemberMode] = useState(false);
  const isPrivileged = (profile?.role === 'admin' || profile?.role === 'treasurer') && !previewMemberMode;

  const monthlyTransactions = transactions.filter(t => {
    const d = t.date?.toDate();
    return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthlyIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const monthlySustainabilityProgress = Math.min((monthlyIncome / (currentMonthFixedExpenses || 1)) * 100, 100);

  // Clean Member View Component
  const MemberView = () => {
    const statusInfo = monthlySustainabilityProgress >= 100 
      ? { label: 'Excelente', color: 'text-green-600' }
      : monthlySustainabilityProgress >= 80 
        ? { label: 'Estável', color: 'text-church-primary' }
        : { label: 'Insuficiente', color: 'text-red-500' };

    return (
      <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-serif text-church-primary italic">Mordomia</h2>
          <p className="text-stone-400 text-sm tracking-widest uppercase font-bold">Transparência e Reino</p>
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setPreviewMemberMode(false)}
              className="mt-4 bg-red-50 text-red-600 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-colors"
            >
              Sair do Modo Preview
            </button>
          )}
        </div>

        {/* Hero Sustainability Chart */}
        <div className="glass-card p-12 rounded-[4rem] text-center border-2 border-church-primary/10 shadow-2xl bg-gradient-to-b from-white to-stone-50/50">
          <div className="space-y-2 mb-8">
            <h3 className="text-2xl font-serif text-church-secondary italic">Sustentabilidade Mensal</h3>
            <p className="text-xs text-stone-400 font-bold uppercase tracking-thinner">Cobertura de Custos Fixos</p>
          </div>

          <div className="relative w-64 h-64 mx-auto mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Coberto', value: monthlyIncome },
                    { name: 'Restante', value: Math.max(0, (currentMonthFixedExpenses || 1) - monthlyIncome) }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={85}
                  outerRadius={110}
                  startAngle={225}
                  endAngle={-45}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#4A6741" />
                  <Cell fill="#ef4444" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
              <span className={`text-6xl font-bold tracking-tighter ${statusInfo.color}`}>{Math.round(monthlySustainabilityProgress)}%</span>
              <span className="text-[10px] text-stone-400 uppercase font-black tracking-widest mt-1">{statusInfo.label}</span>
            </div>
          </div>

        <div className="bg-stone-100/50 p-6 rounded-3xl border border-stone-200/50">
          <p className="text-sm text-stone-600 italic leading-relaxed">
            "Trazei todos os dízimos à casa do tesouro, para que haja mantimento na minha casa..."
            <br/>
            <span className="text-[10px] font-bold text-church-primary uppercase mt-2 block tracking-widest">— Malaquias 3:10</span>
          </p>
        </div>
      </div>

      {/* Prominent PIX Section */}
      <div className="bg-church-primary p-12 rounded-[4rem] text-white space-y-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
          <Wallet size={120} />
        </div>
        
        <div className="relative space-y-4">
          <div className="inline-block bg-white/20 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Apoie esta Obra</div>
          <h4 className="text-3xl font-serif italic">Ofertas e Dízimos</h4>
          <p className="text-sm opacity-80 max-w-sm">Sua contribuição sustenta missões, assistência social e a manutenção da nossa casa.</p>
        </div>

        <div className="relative bg-white/10 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/20 space-y-6">
          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Chave PIX Oficial</p>
            <p className="text-2xl font-mono font-bold break-all select-all tracking-tight bg-white/5 py-4 rounded-2xl">{church?.pixKey || 'Consulte o Pastor'}</p>
          </div>
          <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[10px] uppercase font-bold tracking-widest opacity-60">
            <span>Favorecido: {church?.pixBeneficiary || church?.name}</span>
            <span>Banco Digital</span>
          </div>
        </div>
      </div>

      {/* Recents list - Minimalist */}
      <div className="space-y-6">
        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest text-center px-6">Transparência em Atividades</h4>
        <div className="grid grid-cols-1 gap-3">
          {monthlyTransactions.slice(0, 5).map(t => (
            <div key={t.id} className="glass-card p-5 rounded-[2rem] flex justify-between items-center border-none shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {t.type === 'income' ? '🌱' : '💧'}
                </div>
                <div>
                  <p className="font-serif italic text-church-secondary text-lg leading-none">{t.category}</p>
                  <p className="text-[10px] text-stone-400 uppercase font-bold mt-1 tracking-tighter">{t.date?.toDate().toLocaleDateString()}</p>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full mr-2 ${t.type === 'income' ? 'bg-green-400' : 'bg-red-400'}`}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
  };

  if (!isPrivileged) return <MemberView />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-serif text-church-primary italic">Painel de Mordomia</h2>
          <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Gestão de Tesouraria</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setPreviewMemberMode(true)}
              className="bg-church-primary/10 text-church-primary px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-church-primary/20 transition-all border border-church-primary/20"
            >
              Visão do Membro
            </button>
          )}
          <select 
            className="bg-stone-100 p-2 rounded-full text-[10px] font-bold uppercase tracking-widest border-none outline-none focus:ring-2 focus:ring-church-primary/20"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="all">Acumulado Total</option>
            {/* Generate last 12 months for filtering */}
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              return <option key={val} value={val}>{label}</option>;
            })}
          </select>
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setPreviewMemberMode(true)}
              className="px-6 py-2 bg-stone-100 text-stone-500 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-all shadow-sm"
            >
              🎭 Ver como Membro
            </button>
          )}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-stone-100 text-stone-600 rounded-full hover:bg-stone-200 transition-colors"
          >
            <Settings size={22} />
          </button>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="bg-church-primary text-white px-6 py-2 rounded-full text-sm flex items-center gap-2 shadow-xl hover:scale-105 transition-all font-bold"
          >
            <Plus size={18} /> {showAdd ? 'Cancelar' : 'Lançamento'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-3xl border-l-8 border-blue-400 shadow-lg">
          <p className="text-[10px] text-stone-400 uppercase font-bold mb-1 tracking-widest">Saldo Inicial</p>
          <p className="text-2xl font-bold text-stone-700">{currentInitialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl border-l-8 border-green-500 shadow-lg">
          <p className="text-[10px] text-stone-400 uppercase font-bold mb-1 tracking-widest">Entradas {filterMonth === 'all' ? '(Total)' : '(Mês)'}</p>
          <p className="text-2xl font-bold text-green-600">{displayIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl border-l-8 border-red-500 shadow-lg relative group">
          <p className="text-[10px] text-stone-400 uppercase font-bold mb-1 tracking-widest flex items-center gap-1">
            Saídas {filterMonth === 'all' ? '(Total)' : '(Projetado)'}
            {filterMonth !== 'all' && <span className="text-[8px] bg-red-50 text-red-500 px-1 rounded cursor-help" title="Inclui despesas reais + custos fixos do mês">i</span>}
          </p>
          <p className="text-2xl font-bold text-red-600">{displayExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl border-l-8 border-church-primary shadow-lg bg-church-primary/5">
          <p className="text-[10px] text-stone-400 uppercase font-bold mb-1 tracking-widest">Saldo em Caixa</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-church-primary' : 'text-red-800'}`}>
            {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-8 rounded-[3rem] space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-church-secondary">
              <TrendingUp size={20} />
              <h3 className="font-bold uppercase text-[10px] tracking-widest">Dashboard Geral</h3>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]} barSize={40}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 1 ? '#ef4444' : index === 2 ? '#4A6741' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-[3rem] space-y-6">
          <div className="flex items-center gap-2 text-church-secondary">
            <PieIcon size={20} />
            <h3 className="font-bold uppercase text-[10px] tracking-widest">Distribuição de Saídas</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '9px', paddingTop: '20px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card p-10 rounded-[4rem] bg-gradient-to-br from-church-primary to-church-secondary text-white shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="text-center md:text-left space-y-2">
            <p className="text-white/60 text-[10px] uppercase font-bold tracking-[0.2em]">Saúde Mensal (Meta)</p>
            <h3 className="text-5xl font-serif font-black italic tracking-tighter">
              {progress >= 100 ? 'Superavitária' : progress >= 80 ? 'Estável' : 'Atenção'}
            </h3>
            <p className="text-xs text-white/60 font-medium">
              Meta baseada em R$ {totalFixedExpensesForPeriod.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de custos fixos {filterMonth === 'all' ? 'acumulados' : 'mensais'}.
            </p>
          </div>
          <div className="w-full md:w-80 space-y-4">
            <div className="flex justify-between text-[11px] uppercase font-black tracking-widest">
              <span>{filterMonth === 'all' ? 'Arrecadação vs Custos' : 'Arrecadação vs Custos'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-4 bg-white/20 rounded-full overflow-hidden p-1">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-green-400' : 'bg-amber-400'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/10 pt-12">
          {activeFixedExpensesForPeriod.length > 0 ? activeFixedExpensesForPeriod.map((exp, idx) => (
            <div key={idx} className="bg-white/5 p-4 rounded-3xl border border-white/10">
              <p className="text-[9px] uppercase font-bold opacity-60 mb-1">{exp.category || 'Sem Nome'}</p>
              <p className="text-lg font-bold">{exp.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              {exp.installments ? (
                <p className="text-[8px] opacity-40 uppercase font-black mt-1">Parcelado ({exp.installments}x)</p>
              ) : (
                <p className="text-[8px] opacity-40 uppercase font-black mt-1">Custo Contínuo</p>
              )}
            </div>
          )) : (
            <div className="col-span-full text-center py-4 bg-white/5 rounded-3xl border border-dashed border-white/20">
              <p className="text-xs opacity-50 italic">Nenhum custo fixo ativo para este período.</p>
            </div>
          )}
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
              <p className="text-xs font-bold text-stone-400 uppercase">Gerenciamento de Custos Fixos</p>
              <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                {fixedExpenses.map((exp, idx) => (
                  <div key={idx} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
                    <div className="flex gap-2">
                      <input 
                        type="text" placeholder="Categoria (ex: Aluguel)"
                        className="flex-1 p-2 rounded-lg bg-white border border-stone-200 text-sm"
                        value={exp.category}
                        onChange={e => {
                          const newExp = [...fixedExpenses];
                          newExp[idx].category = e.target.value;
                          setFixedExpenses(newExp);
                        }}
                      />
                      <input 
                        type="number" placeholder="Valor"
                        className="w-28 p-2 rounded-lg bg-white border border-stone-200 text-sm font-bold"
                        value={exp.amount}
                        onChange={e => {
                          const newExp = [...fixedExpenses];
                          newExp[idx].amount = parseFloat(e.target.value) || 0;
                          setFixedExpenses(newExp);
                        }}
                      />
                      <button 
                        onClick={() => setFixedExpenses(fixedExpenses.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 px-1"
                      >✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-stone-400 uppercase">Início</label>
                        <input 
                          type="month"
                          className="w-full p-1.5 rounded-lg bg-white border border-stone-200 text-xs"
                          value={exp.startDate?.substring(0, 7) || ''}
                          onChange={e => {
                            const newExp = [...fixedExpenses];
                            newExp[idx].startDate = `${e.target.value}-01`;
                            setFixedExpenses(newExp);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-stone-400 uppercase">Parcelas (0=Fixo)</label>
                        <input 
                          type="number"
                          className="w-full p-1.5 rounded-lg bg-white border border-stone-200 text-xs"
                          value={exp.installments || 0}
                          onChange={e => {
                            const newExp = [...fixedExpenses];
                            newExp[idx].installments = parseInt(e.target.value) || 0;
                            setFixedExpenses(newExp);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
          {filteredTransactions.map(t => (
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
                  {t.type === 'income' ? '+' : '-'} {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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

