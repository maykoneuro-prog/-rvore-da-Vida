import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, updateDoc, doc, orderBy } from 'firebase/firestore';
import { UserProfile } from '../App';
import { Shield, User, Camera, Wallet, CheckCircle, Clock } from 'lucide-react';

export function MemberListView() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query all users to manage roles
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(d => d.data() as UserProfile));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filteredMembers = members.filter(m => {
    if (filter === 'confirmed') return m.isConfirmedMember;
    if (filter === 'pending') return !m.isConfirmedMember;
    return true;
  });

  const toggleConfirm = async (member: UserProfile) => {
    await updateDoc(doc(db, 'users', member.uid), {
      isConfirmedMember: !member.isConfirmedMember
    });
  };

  const changeRole = async (member: UserProfile, newRole: string) => {
    await updateDoc(doc(db, 'users', member.uid), {
      role: newRole
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield size={14} className="text-red-500" />;
      case 'treasurer': return <Wallet size={14} className="text-green-600" />;
      case 'media': return <Camera size={14} className="text-blue-500" />;
      default: return <User size={14} className="text-stone-400" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Pastor/ADM';
      case 'treasurer': return 'Tesoureiro';
      case 'media': return 'Mídia';
      default: return 'Membro';
    }
  };

  if (loading) return (
    <div className="p-12 text-center space-y-4">
      <div className="w-12 h-12 border-4 border-church-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-stone-400 font-serif italic">Carregando censo da igreja...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-serif text-church-primary italic">Censo da Igreja</h2>
        <div className="flex gap-2">
          <select 
            className="bg-stone-100 p-2 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-church-primary/20"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">Todos os Perfis</option>
            <option value="confirmed">Confirmados</option>
            <option value="pending">Pendentes</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-6 rounded-3xl text-center">
          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-1">Total de Pessoas</p>
          <p className="text-3xl font-bold text-church-primary">{members.length}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl text-center">
          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-1">Confirmados</p>
          <p className="text-3xl font-bold text-green-600">{members.filter(m => m.isConfirmedMember).length}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl text-center">
          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-1">Liderança</p>
          <p className="text-3xl font-bold text-blue-600">{members.filter(m => m.role !== 'member').length}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-2">Gestão de Membros e Cargos</h4>
        <div className="grid grid-cols-1 gap-3">
          {filteredMembers.map(member => (
            <div key={member.uid} className="glass-card p-5 rounded-[2rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-xl shadow-inner">
                  {member.role === 'admin' ? '⛪' : '👤'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-stone-800">{member.name}</p>
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-stone-100 rounded-full text-[9px] font-bold text-stone-500 uppercase">
                      {getRoleIcon(member.role)} {getRoleLabel(member.role)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">{member.phone} • {member.isConfirmedMember ? 'Membro Ativo' : 'Aguardando Aprovação'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
                <div className="flex-1 md:flex-none">
                  <p className="text-[9px] text-stone-400 uppercase font-bold mb-1 px-1">Alterar Cargo</p>
                  <select 
                    className="w-full md:w-32 bg-stone-100 p-2 rounded-lg text-[10px] font-bold border-none outline-none"
                    value={member.role}
                    onChange={(e) => changeRole(member, e.target.value)}
                  >
                    <option value="member">Membro</option>
                    <option value="treasurer">Tesoureiro</option>
                    <option value="media">Mídia</option>
                    <option value="admin">Pastor/ADM</option>
                  </select>
                </div>

                <button 
                  onClick={() => toggleConfirm(member)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${
                    member.isConfirmedMember 
                      ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                      : 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                  }`}
                >
                  {member.isConfirmedMember ? <CheckCircle size={14} /> : <Clock size={14} />}
                  {member.isConfirmedMember ? 'Confirmado' : 'Aprovar'}
                </button>
              </div>
            </div>
          ))}
          {filteredMembers.length === 0 && (
            <div className="text-center py-20 glass-card rounded-[2rem]">
              <p className="text-stone-400 italic font-serif">Nenhum perfil encontrado com este filtro.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
