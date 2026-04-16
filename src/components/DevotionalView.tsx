import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateDevotional } from '../services/geminiService';
import { UserProfile } from '../App';

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

export function DevotionalView({ profile }: { profile: UserProfile }) {
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'devotionals'), orderBy('date', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setDevotional(snapshot.docs[0].data() as Devotional);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-serif text-church-primary italic">Pão Diário</h2>
        <div className="flex gap-2">
          {error && <span className="text-red-500 text-xs flex items-center">{error}</span>}
          {devotional && (
            <button 
              onClick={shareOnWhatsApp}
              className="bg-green-500 text-white px-4 py-2 rounded-full text-xs flex items-center gap-2"
            >
              <span>📱</span> Compartilhar
            </button>
          )}
          {profile.role === 'admin' && (
            <button 
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs bg-church-accent/20 text-church-secondary px-4 py-2 rounded-full hover:bg-church-accent/30 transition-colors"
            >
              {generating ? 'Gerando...' : 'Gerar Novo (IA)'}
            </button>
          )}
        </div>
      </div>

      {devotional ? (
        <div className="glass-card p-8 rounded-[2.5rem] space-y-8">
          <div className="text-center space-y-4">
            <h3 className="text-3xl font-bold text-church-secondary">{devotional.title}</h3>
            <p className="text-church-primary font-serif italic text-xl">"{devotional.verse}"</p>
          </div>
          
          <div className="space-y-8 text-stone-700 leading-relaxed">
            <section className="bg-stone-50 p-6 rounded-2xl border-l-4 border-blue-400">
              <h4 className="font-bold text-blue-600 mb-2 uppercase text-xs tracking-widest">🧊 Quebra-gelo</h4>
              <p>{devotional.icebreaker}</p>
            </section>

            <section>
              <h4 className="font-bold text-church-secondary mb-2 uppercase text-xs tracking-widest">📖 Introdução</h4>
              <p>{devotional.introduction}</p>
            </section>

            <section>
              <h4 className="font-bold text-church-secondary mb-2 uppercase text-xs tracking-widest">💡 Desenvolvimento</h4>
              <div className="prose prose-stone max-w-none">
                {devotional.development.split('\n').map((para, i) => (
                  <p key={i} className="mb-4">{para}</p>
                ))}
              </div>
            </section>

            <section className="bg-amber-50 p-6 rounded-2xl border-l-4 border-amber-400">
              <h4 className="font-bold text-amber-600 mb-4 uppercase text-xs tracking-widest">🤔 Perguntas de Reflexão</h4>
              <ul className="list-disc list-inside space-y-2">
                {devotional.reflectionQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="font-bold text-church-secondary mb-2 uppercase text-xs tracking-widest">🏁 Conclusão</h4>
              <p>{devotional.conclusion}</p>
            </section>

            <div className="bg-stone-50 p-6 rounded-2xl border-l-4 border-church-accent">
              <h4 className="font-bold text-church-secondary mb-2 flex items-center gap-2">
                <span>🙏</span> Oração
              </h4>
              <p className="text-stone-600 italic">{devotional.prayer}</p>
            </div>

            <div className="bg-green-50 p-6 rounded-2xl border-l-4 border-church-primary">
              <h4 className="font-bold text-church-primary mb-2 flex items-center gap-2">
                <span>🌱</span> Aplicação Prática
              </h4>
              <p className="text-stone-600">{devotional.application}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 glass-card rounded-[2.5rem]">
          <p className="text-stone-400 italic">Nenhum devocional disponível para hoje.</p>
          {profile.role === 'admin' && (
            <button onClick={handleGenerate} className="mt-4 text-church-primary underline">Gerar o primeiro agora</button>
          )}
        </div>
      )}
    </div>
  );
}
