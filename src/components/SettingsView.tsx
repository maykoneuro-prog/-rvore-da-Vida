import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../App';

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!church) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      await updateDoc(doc(db, 'churches', 'main_church'), church);
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
        <section className="glass-card p-8 rounded-[2.5rem] space-y-6">
          <h3 className="text-xl font-bold text-church-secondary border-b pb-2">Identidade Visual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase">Logo URL</label>
              <input 
                type="url" 
                placeholder="https://exemplo.com/logo.png"
                className="w-full p-3 rounded-xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary transition-all"
                value={church.logoUrl || ''} 
                onChange={e => setChurch({...church, logoUrl: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase">Primária</label>
                <input type="color" className="w-full h-10 rounded-lg cursor-pointer" value={church.primaryColor || '#4A6741'} onChange={e => setChurch({...church, primaryColor: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase">Secundária</label>
                <input type="color" className="w-full h-10 rounded-lg cursor-pointer" value={church.secondaryColor || '#2D3E27'} onChange={e => setChurch({...church, secondaryColor: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase">Destaque</label>
                <input type="color" className="w-full h-10 rounded-lg cursor-pointer" value={church.accentColor || '#D4AF37'} onChange={e => setChurch({...church, accentColor: e.target.value})} />
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
              <label className="text-xs font-bold text-stone-400 uppercase">Meta de Custos Fixos (R$)</label>
              <input type="number" className="w-full p-3 rounded-xl bg-stone-100 border-none" value={church.fixedCostsGoal ?? ''} onChange={e => setChurch({...church, fixedCostsGoal: parseFloat(e.target.value) || 0})} />
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
