import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../App';
import { Upload, X } from 'lucide-react';

export function SettingsView({ profile }: { profile: UserProfile }) {
  const [church, setChurch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'churches', 'main_church'), (docSnap) => {
      if (docSnap.exists()) setChurch(docSnap.data());
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('icon', file);

    try {
      const response = await fetch('/api/upload-icon', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setChurch({ ...church, appIcon: data.url });
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Erro no upload:', err);
      setSaveStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!church) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      // Update app metadata (name)
      await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: church.name, icon: church.appIcon })
      });

      // Calculate total fixed costs from the list to synchronize with Finance dashboard
      const total = (church.fixedExpenses || []).reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
      const updatedChurch = {
        ...church,
        fixedCostsGoal: total > 0 ? total : church.fixedCostsGoal
      };
      
      await updateDoc(doc(db, 'churches', 'main_church'), updatedChurch);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      setSaveStatus('error');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center">Carregando configurações...</div>;
  if (!church) return (
    <div className="p-8 text-center">
      <p className="text-red-500 mb-4">Configurações da igreja não encontradas.</p>
      <button 
        onClick={() => window.location.reload()} 
        className="bg-church-primary text-white px-6 py-2 rounded-full"
      >
        Tentar Novamente
      </button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-serif text-church-primary italic">Administração e Customização</h2>
        {saveStatus === 'success' && (
          <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-xs font-bold animate-bounce">
            ✅ Salvo com sucesso!
          </span>
        )}
      </div>
      
      <form onSubmit={handleSave} className="space-y-8">
        <section className="glass-card p-8 rounded-[2.5rem] space-y-6 text-stone-800">
          <h3 className="text-xl font-bold text-church-secondary border-b pb-2">Identidade e Aplicativo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase">Ícone do App</label>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="🌳 ou URL da imagem"
                      className="flex-1 p-3 rounded-xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary transition-all text-sm"
                      value={church.appIcon || '🌳'} 
                      onChange={e => setChurch({...church, appIcon: e.target.value})}
                    />
                    <div className="w-12 h-12 bg-white rounded-xl shadow-inner flex items-center justify-center text-2xl border border-stone-100 overflow-hidden shrink-0">
                      {church.appIcon?.startsWith('http') || church.appIcon?.startsWith('/') ? (
                        <img src={church.appIcon} alt="Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        church.appIcon || '🌳'
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*,.ico"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-600 p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <Upload size={16} />
                      {isUploading ? 'Enviando...' : 'Fazer Upload de Ícone (.ico, .png, .jpg)'}
                    </button>
                    {church.appIcon?.startsWith('/') && (
                      <button
                        type="button"
                        onClick={() => setChurch({...church, appIcon: '🌳'})}
                        className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
                        title="Remover upload"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-stone-400 italic">Este ícone aparecerá no atalho do celular quando os membros instalarem o app. Recomendamos uma imagem quadrada.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase">Logo da Igreja (URL)</label>
                <input 
                  type="url" 
                  placeholder="https://exemplo.com/logo.png"
                  className="w-full p-3 rounded-xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary transition-all"
                  value={church.logoUrl || ''} 
                  onChange={e => setChurch({...church, logoUrl: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-bold text-stone-400 uppercase block mb-2">Paleta de Cores</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase">Primária</label>
                  <input type="color" className="w-full h-12 rounded-xl cursor-pointer shadow-sm" value={church.primaryColor || '#4A6741'} onChange={e => setChurch({...church, primaryColor: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase">Secundária</label>
                  <input type="color" className="w-full h-12 rounded-xl cursor-pointer shadow-sm" value={church.secondaryColor || '#2D3E27'} onChange={e => setChurch({...church, secondaryColor: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase">Destaque</label>
                  <input type="color" className="w-full h-12 rounded-xl cursor-pointer shadow-sm" value={church.accentColor || '#D4AF37'} onChange={e => setChurch({...church, accentColor: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card p-8 rounded-[2.5rem] space-y-6">
          <h3 className="text-xl font-bold text-church-secondary border-b pb-2">Informações Institucionais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Nome da Igreja</label>
              <input type="text" className="w-full p-3 rounded-xl bg-stone-100 border-none" value={church.name || ''} onChange={e => setChurch({...church, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Pastor Principal</label>
              <input type="text" className="w-full p-3 rounded-xl bg-stone-100 border-none" value={church.pastorName || ''} onChange={e => setChurch({...church, pastorName: e.target.value})} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Endereço Completo</label>
              <input type="text" className="w-full p-3 rounded-xl bg-stone-100 border-none" value={church.address || ''} onChange={e => setChurch({...church, address: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Chave PIX</label>
              <input type="text" className="w-full p-3 rounded-xl bg-stone-100 border-none" value={church.pixKey || ''} onChange={e => setChurch({...church, pixKey: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Nome do Favorecido (PIX)</label>
              <input type="text" className="w-full p-3 rounded-xl bg-stone-100 border-none" value={church.pixBeneficiary || ''} onChange={e => setChurch({...church, pixBeneficiary: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Meta Global de Custos Fixos (R$)</label>
              <input type="number" className="w-full p-3 rounded-xl bg-stone-100 border-none" value={church.fixedCostsGoal ?? ''} onChange={e => setChurch({...church, fixedCostsGoal: parseFloat(e.target.value) || 0})} />
              <p className="text-[10px] text-stone-400 italic">Dica: Se você detalhar as despesas abaixo, este valor será usado como meta.</p>
            </div>
            <div className="space-y-4 md:col-span-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Detalhamento de Despesas Fixas</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(church.fixedExpenses || []).map((exp: any, idx: number) => (
                  <div key={idx} className="bg-stone-50 p-4 rounded-3xl border border-stone-100 space-y-3">
                    <div className="flex gap-2">
                      <input 
                        type="text" placeholder="Ex: Aluguel"
                        className="flex-1 bg-white p-2 rounded-xl border border-stone-200 text-sm focus:ring-0"
                        value={exp.category}
                        onChange={e => {
                          const newExp = [...(church.fixedExpenses || [])];
                          newExp[idx].category = e.target.value;
                          setChurch({...church, fixedExpenses: newExp});
                        }}
                      />
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">R$</span>
                        <input 
                          type="number" placeholder="0.00"
                          className="w-full bg-white pl-8 pr-3 py-2 rounded-xl border border-stone-200 text-sm font-bold text-church-primary focus:ring-0"
                          value={exp.amount}
                          onChange={e => {
                            const newExp = [...(church.fixedExpenses || [])];
                            newExp[idx].amount = parseFloat(e.target.value) || 0;
                            setChurch({...church, fixedExpenses: newExp});
                          }}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          const newExp = (church.fixedExpenses || []).filter((_: any, i: number) => i !== idx);
                          setChurch({...church, fixedExpenses: newExp});
                        }}
                        className="text-red-400 hover:text-red-600 px-1"
                      >✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-stone-400 uppercase">Data de Início</label>
                        <input 
                          type="month"
                          className="w-full p-2 rounded-xl bg-white border border-stone-200 text-[10px]"
                          value={exp.startDate?.substring(0, 7) || ''}
                          onChange={e => {
                            const newExp = [...(church.fixedExpenses || [])];
                            newExp[idx].startDate = `${e.target.value}-01`;
                            setChurch({...church, fixedExpenses: newExp});
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-stone-400 uppercase">Duração (0=Infinito)</label>
                        <input 
                          type="number"
                          placeholder="Meses"
                          className="w-full p-2 rounded-xl bg-white border border-stone-200 text-[10px]"
                          value={exp.installments || 0}
                          onChange={e => {
                            const newExp = [...(church.fixedExpenses || [])];
                            newExp[idx].installments = parseInt(e.target.value) || 0;
                            setChurch({...church, fixedExpenses: newExp});
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                type="button"
                onClick={() => {
                  const newExp = [...(church.fixedExpenses || []), { category: '', amount: 0, startDate: new Date().toISOString().split('T')[0], installments: 0 }];
                  setChurch({...church, fixedExpenses: newExp});
                }}
                className="text-xs font-bold text-church-primary hover:underline"
              >
                + Adicionar Item de Despesa
              </button>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Sobre a Igreja</label>
              <textarea className="w-full p-3 rounded-xl bg-stone-100 border-none h-32" value={church.bio || ''} onChange={e => setChurch({...church, bio: e.target.value})} />
            </div>
          </div>
        </section>

        <button 
          disabled={saving}
          className={`w-full p-4 rounded-2xl font-bold shadow-xl transition-all ${saving ? 'bg-stone-400' : 'bg-church-primary hover:scale-[1.02]'} text-white`}
        >
          {saving ? 'Salvando...' : 'Salvar Todas as Alterações'}
        </button>
        {saveStatus === 'error' && <p className="text-center text-red-500 text-sm">Erro ao salvar. Verifique sua conexão.</p>}
      </form>
    </div>
  );
}
