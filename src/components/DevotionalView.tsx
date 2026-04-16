import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, where, doc, updateDoc, getDocs, setDoc } from 'firebase/firestore';
import { generateDevotional } from '../services/geminiService';
import { UserProfile } from '../App';
import { Star, Trophy, Target, ChevronRight, CheckCircle2, FileText } from 'lucide-react';

interface Devotional {
  title: string;
  verse: string;
  icebreaker: string;
  introduction: string;
  development: string;
  reflectionQuestions: string[];
  conclusion: string;
  prayer: string;
  application: string;
  date: any;
}

interface RankedMember {
  uid: string;
  name: string;
  monthlyDevotionals: number;
  streak: number;
  stars: number;
}

export function DevotionalView({ profile }: { profile: UserProfile }) {
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [ranking, setRanking] = useState<RankedMember[]>([]);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const daysInMonth = new Date(new Date().getFullYear(), currentMonth + 1, 0).getDate();

  useEffect(() => {
    const q = query(collection(db, 'devotionals'), orderBy('date', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setDevotional(snapshot.docs[0].data() as Devotional);
      }
      setLoading(false);
    });

    const rankQuery = query(
      collection(db, 'users'),
      orderBy('stars', 'desc'),
      limit(3)
    );
    const stopRank = onSnapshot(rankQuery, (snapshot) => {
      setRanking(snapshot.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          name: data.name,
          monthlyDevotionals: data.monthlyDevotionals || 0,
          streak: data.streak || 0,
          stars: data.stars || 0
        };
      }));
    });

    // Log the daily devotional reading for the member
    if (profile.uid && !hasLoggedToday) {
      logDevotional();
    }

    return () => {
      unsubscribe();
      stopRank();
    };
  }, [profile.uid]);

  const logDevotional = async () => {
    try {
      const logRef = doc(db, 'churches', 'main_church', 'devotionalLogs', `${profile.uid}_${today}`);
      const logSnap = await getDocs(query(collection(db, 'churches', 'main_church', 'devotionalLogs'), where('userId', '==', profile.uid), where('date', '==', today)));
      
      if (logSnap.empty) {
        // Not logged today, Create log
        await setDoc(logRef, {
          userId: profile.uid,
          userName: profile.name,
          date: today,
          timestamp: serverTimestamp()
        });

        // Update user stats
        const userRef = doc(db, 'users', profile.uid);
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

        const isStreak = profile.lastDevotionalDate === yesterdayStr;
        const newStreak = isStreak ? (profile.streak || 0) + 1 : 1;
        
        await updateDoc(userRef, {
          streak: newStreak,
          lastDevotionalDate: today,
          totalDevotionals: (profile.totalDevotionals || 0) + 1,
          monthlyDevotionals: (profile.monthlyDevotionals || 0) + 1,
          stars: (profile.stars || 0) + 10 // Gamification: 10 stars per devotional
        });
        setHasLoggedToday(true);
      } else {
        setHasLoggedToday(true);
      }
    } catch (err) {
      console.error("Erro ao logar devocional:", err);
    }
  };

  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const data = await generateDevotional('Minha Igreja');
      if (data) {
        await addDoc(collection(db, 'devotionals'), {
          ...data,
          date: serverTimestamp()
        });
      } else {
        setError('Não foi possível gerar o devocional. Tente novamente.');
      }
    } catch (err) {
      console.error("Erro ao gerar devocional:", err);
      setError('Erro de conexão ao gerar devocional.');
    }
    setGenerating(false);
  };

  const shareOnWhatsApp = () => {
    if (!devotional) return;
    const text = `*${devotional.title}*\n\n"${devotional.verse}"\n\nLeia mais no nosso app: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando palavra do dia...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-4">
        <div>
          <h2 className="text-4xl font-serif text-church-primary italic tracking-tight">Pão Diário</h2>
          <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mt-1">Alimento Espiritual Diário</p>
        </div>
        
        <div className="flex gap-2">
          {error && <span className="text-red-500 text-xs flex items-center">{error}</span>}
          {devotional && (
            <button 
              onClick={shareOnWhatsApp}
              className="bg-green-500 text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg shadow-green-200"
            >
              <span>📱</span> Compartilhar
            </button>
          )}
          {profile.role === 'admin' && (
            <button 
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs font-bold bg-church-accent/10 text-church-secondary px-5 py-2.5 rounded-full hover:bg-church-accent/20 transition-all border border-church-accent/20"
            >
              {generating ? 'Gerando...' : 'IA: Gerar Novo'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {devotional ? (
            <div className="glass-card p-10 rounded-[3rem] space-y-10 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                <FileText size={180} className="text-church-primary" />
              </div>
              
              <div className="text-center space-y-6 relative">
                <div className="inline-block bg-church-primary/5 text-church-primary px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Palavra do Dia</div>
                <h3 className="text-4xl font-bold text-church-secondary font-serif italic tracking-tight leading-tight">{devotional.title}</h3>
                <div className="max-w-xl mx-auto">
                  <p className="text-church-primary font-serif italic text-2xl leading-relaxed">"{devotional.verse}"</p>
                </div>
              </div>
              
              <div className="space-y-10 text-stone-700 leading-relaxed text-lg">
                <section className="bg-blue-50/50 p-8 rounded-[2rem] border-l-8 border-blue-400">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-blue-500">🧊</span>
                    <h4 className="font-bold text-blue-600 uppercase text-[10px] tracking-widest">Quebra-gelo</h4>
                  </div>
                  <p>{devotional.icebreaker}</p>
                </section>

                <div className="prose prose-stone prose-lg max-w-none">
                  <h4 className="font-bold text-church-secondary mb-4 uppercase text-[10px] tracking-widest italic">📖 Introdução</h4>
                  <p className="mb-8">{devotional.introduction}</p>

                  <h4 className="font-bold text-church-secondary mb-4 uppercase text-[10px] tracking-widest italic">💡 Desenvolvimento</h4>
                  <div className="space-y-6">
                    {devotional.development.split('\n').map((para, i) => (para.trim() && <p key={i}>{para}</p>))}
                  </div>
                </div>

                <section className="bg-amber-50/50 p-8 rounded-[2rem] border-l-8 border-amber-400">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-amber-500">🤔</span>
                    <h4 className="font-bold text-amber-600 uppercase text-[10px] tracking-widest">Perguntas de Reflexão</h4>
                  </div>
                  <ul className="space-y-3">
                    {devotional.reflectionQuestions.map((q, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="text-amber-400 font-bold">•</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="prose prose-stone prose-lg max-w-none">
                  <h4 className="font-bold text-church-secondary mb-4 uppercase text-[10px] tracking-widest italic">🏁 Conclusão</h4>
                  <p>{devotional.conclusion}</p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-stone-50 p-8 rounded-[2.5rem] border-t-8 border-church-accent">
                    <h4 className="font-bold text-church-secondary mb-3 flex items-center gap-2 text-sm">
                      <span>🙏</span> Oração
                    </h4>
                    <p className="text-stone-600 italic text-base leading-relaxed">{devotional.prayer}</p>
                  </div>

                  <div className="bg-green-50 p-8 rounded-[2.5rem] border-t-8 border-church-primary">
                    <h4 className="font-bold text-church-primary mb-3 flex items-center gap-2 text-sm">
                      <span>🌱</span> Aplicação Prática
                    </h4>
                    <p className="text-stone-600 text-base leading-relaxed">{devotional.application}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 glass-card rounded-[3rem]">
              <p className="text-stone-400 italic">Nenhum devocional disponível para hoje.</p>
              {profile.role === 'admin' && (
                <button onClick={handleGenerate} className="mt-4 text-church-primary underline font-bold">Gerar o primeiro agora</button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Progress Widget */}
          <div className="glass-card p-8 rounded-[3rem] bg-gradient-to-br from-church-primary to-church-secondary text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Target size={120} />
            </div>
            <div className="relative space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="font-serif italic text-xl">Minha Jornada</h4>
                <div className="bg-white/20 p-2 rounded-full"><Trophy size={16} /></div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-80">
                  <span>Meta do Mês</span>
                  <span>{profile.monthlyDevotionals || 0} de {daysInMonth}</span>
                </div>
                <div className="h-4 bg-white/20 rounded-full overflow-hidden p-1">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-1000"
                    style={{ width: `${((profile.monthlyDevotionals || 0) / daysInMonth) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <div className="bg-white/10 p-4 rounded-3xl flex-1 text-center border border-white/10">
                  <p className="text-[9px] uppercase font-bold opacity-60 mb-1">🔥 Streak</p>
                  <p className="text-2xl font-bold">{profile.streak || 0}d</p>
                </div>
                <div className="bg-white/10 p-4 rounded-3xl flex-1 text-center border border-white/10">
                  <p className="text-[9px] uppercase font-bold opacity-60 mb-1">⭐ Estrelas</p>
                  <p className="text-2xl font-bold">{profile.stars || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ranking Top 3 */}
          <div className="glass-card p-8 rounded-[3rem] space-y-6 shadow-lg border-2 border-stone-50">
            <div className="flex items-center gap-2 border-b pb-4">
              <Star className="text-church-accent fill-church-accent" size={18} />
              <h4 className="font-bold text-xs uppercase tracking-widest text-church-secondary">Membros Mais Ativos</h4>
            </div>

            <div className="space-y-4">
              {ranking.map((member, index) => (
                <div key={member.uid} className={`flex items-center gap-4 p-4 rounded-[2rem] ${index === 0 ? 'bg-amber-50 border border-amber-100' : 'bg-stone-50'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${
                    index === 0 ? 'bg-amber-400 text-white' : 
                    index === 1 ? 'bg-stone-300 text-stone-600' : 
                    'bg-orange-200 text-orange-700'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-stone-800">{member.name}</p>
                    <div className="flex items-center gap-1 text-[9px] text-stone-400 font-bold uppercase">
                      <Star size={8} className="fill-stone-300 text-stone-300" />
                      {member.stars} Estrelas • {member.streak}d Fogo
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[...Array(3 - index)].map((_, i) => (
                      <Star key={i} size={10} className="fill-church-accent text-church-accent" />
                    ))}
                  </div>
                </div>
              ))}
              {ranking.length === 0 && <p className="text-center text-stone-400 italic py-4">Ranking em formação...</p>}
            </div>

            <div className="bg-blue-50 p-6 rounded-[2rem] border-2 border-blue-100 flex items-center gap-4">
              <div className="bg-white p-3 rounded-2xl shadow-sm">
                <Target className="text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none mb-1">Missão Diária</p>
                <p className="text-xs text-stone-600 font-medium">Leia o devocional de hoje para manter seu fogo!</p>
              </div>
              <div className="ml-auto">
                <CheckCircle2 className={hasLoggedToday ? "text-green-500" : "text-stone-300"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
