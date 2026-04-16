import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { DevotionalView } from './components/DevotionalView';
import { EventsView } from './components/EventsView';
import { FinanceView } from './components/FinanceView';
import { SettingsView } from './components/SettingsView';
import { MemberListView } from './components/MemberListView';
import { AttendanceView } from './components/AttendanceView';

export interface UserProfile {
  uid: string;
  name: string;
  address?: string;
  phone: string;
  birthDate?: string;
  isConfirmedMember?: boolean;
  password?: string;
  role: 'admin' | 'member' | 'media' | 'treasurer';
  churchId: string;
  streak: number;
  lastDevotionalDate: string;
  stars?: number;
  totalDevotionals?: number;
  monthlyDevotionals?: number;
}

const GLOBAL_ADMIN_PHONE = "admin";
const GLOBAL_ADMIN_PASS = "12345678";

export function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [church, setChurch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'app'>('login');
  const [currentView, setCurrentView] = useState<'home' | 'devotional' | 'events' | 'finance' | 'settings' | 'census' | 'attendance'>('home');
  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    password: '', 
    address: '', 
    birthDate: '', 
    isMember: 'Sim' 
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (church) {
      // Update Title
      document.title = church.name || 'Árvore da Vida';

      // Update Theme Color meta tag
      let themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        themeMeta.setAttribute('content', church.primaryColor || '#4A6741');
      }

      // Update Icons (Favicon and Apple Touch Icon)
      const updateLinkTag = (rel: string, href: string) => {
        let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = href;
      };

      const iconPath = church.appIcon || '🌳';
      
      if (iconPath.startsWith('http')) {
        updateLinkTag('icon', iconPath);
        updateLinkTag('apple-touch-icon', iconPath);
      } else {
        // Render Emoji as Icon
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.font = '48px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(iconPath, 32, 35);
          const dataUrl = canvas.toDataURL();
          updateLinkTag('icon', dataUrl);
          updateLinkTag('apple-touch-icon', dataUrl);
        }
      }
    }
  }, [church]);

  useEffect(() => {
    const savedUid = localStorage.getItem('tree_uid');
    if (savedUid) {
      if (savedUid === 'global_admin') {
        setProfile({
          uid: 'global_admin',
          name: 'Administrador',
          phone: GLOBAL_ADMIN_PHONE,
          password: GLOBAL_ADMIN_PASS,
          role: 'admin',
          churchId: 'main_church',
          streak: 0,
          lastDevotionalDate: ''
        });
        setAuthMode('app');
        setLoading(false);
        return;
      }
      const unsubscribe = onSnapshot(doc(db, 'users', savedUid), (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
          setAuthMode('app');
        } else {
          localStorage.removeItem('tree_uid');
        }
        setLoading(false);
      }, () => setLoading(false));
      return unsubscribe;
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'churches', 'main_church'), async (docSnap) => {
      if (docSnap.exists()) {
        setChurch(docSnap.data());
      } else {
        // Initialize if missing
        const defaultChurch = {
          name: 'Árvore da Vida',
          pastorName: 'Administrador',
          primaryColor: '#4A6741',
          secondaryColor: '#2D3E27',
          accentColor: '#D4AF37',
          logoUrl: 'https://i.imgur.com/lpVHWTp.png'
        };
        try {
          await setDoc(doc(db, 'churches', 'main_church'), defaultChurch);
          setChurch(defaultChurch);
        } catch (err) {
          console.error("Erro ao inicializar igreja:", err);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Apply Church Theme and Branding
  useEffect(() => {
    if (church) {
      const root = document.documentElement;
      if (church.primaryColor) root.style.setProperty('--color-church-primary', church.primaryColor);
      if (church.secondaryColor) root.style.setProperty('--color-church-secondary', church.secondaryColor);
      if (church.accentColor) root.style.setProperty('--color-church-accent', church.accentColor);
      
      // Update Document Title
      document.title = church.name || 'Árvore da Vida';
      
      // Update Favicon and Apple Touch Icon
      if (church.logoUrl) {
        const updateIcon = (rel: string) => {
          let link: HTMLLinkElement | null = document.querySelector(`link[rel~='${rel}']`);
          if (!link) {
            link = document.createElement('link');
            link.rel = rel;
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = church.logoUrl;
        };
        updateIcon('icon');
        updateIcon('apple-touch-icon');
      }
    }
  }, [church]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const inputPhone = formData.phone.trim().toLowerCase();
    const inputPass = formData.password.trim();

    if (inputPhone === GLOBAL_ADMIN_PHONE && inputPass === GLOBAL_ADMIN_PASS) {
      const adminProfile: UserProfile = {
        uid: 'global_admin',
        name: 'Administrador',
        phone: GLOBAL_ADMIN_PHONE,
        password: GLOBAL_ADMIN_PASS,
        role: 'admin',
        churchId: 'main_church',
        streak: 0,
        lastDevotionalDate: ''
      };

      // Set state immediately to allow entry
      setProfile(adminProfile);
      localStorage.setItem('tree_uid', 'global_admin');
      setAuthMode('app');
      console.log("Admin local login successful");

      // Sync with Firestore in the background
      try {
        await setDoc(doc(db, 'users', 'global_admin'), adminProfile, { merge: true });
        await setDoc(doc(db, 'churches', 'main_church'), {
          name: 'Árvore da Vida',
          pastorName: 'Administrador',
          primaryColor: '#4A6741',
          secondaryColor: '#2D3E27',
          accentColor: '#D4AF37'
        }, { merge: true });
        console.log("Admin Firestore sync successful");
      } catch (err) {
        console.warn("Admin Firestore sync failed (offline?), but login allowed:", err);
      }
      return;
    }

    try {
      const q = query(collection(db, 'users'), where('phone', '==', formData.phone.trim()), where('password', '==', formData.password.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data() as UserProfile;
        setProfile(userData);
        localStorage.setItem('tree_uid', userData.uid);
        setAuthMode('app');
      } else {
        setError('Telefone ou senha incorretos.');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError('Erro ao entrar. Verifique sua conexão.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const uid = `u_${Date.now()}`;
    const newProfile: UserProfile = {
      uid,
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      birthDate: formData.birthDate,
      isConfirmedMember: formData.isMember === 'Sim',
      password: formData.password,
      role: 'member',
      churchId: 'main_church',
      streak: 0,
      lastDevotionalDate: '',
    };

    try {
      await setDoc(doc(db, 'users', uid), newProfile);
      setProfile(newProfile);
      localStorage.setItem('tree_uid', uid);
      setAuthMode('app');
    } catch (err) {
      setError('Erro ao cadastrar.');
    }
  };

  const logout = () => {
    localStorage.removeItem('tree_uid');
    setProfile(null);
    setAuthMode('login');
    setCurrentView('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-pulse flex flex-col items-center">
          {church?.logoUrl ? (
            <img src={church.logoUrl} alt="Logo" className="w-20 h-20 rounded-full object-cover mb-4 shadow-xl" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-16 h-16 bg-church-primary/20 rounded-full mb-4"></div>
          )}
          <p className="text-stone-400 font-serif italic">Cultivando sua Árvore da Vida...</p>
        </div>
      </div>
    );
  }

  if (authMode !== 'app') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="glass-card p-8 rounded-[2rem] max-w-md w-full">
          <div className="flex flex-col items-center mb-8">
            {church?.logoUrl ? (
              <img src={church.logoUrl} alt="Logo" className="w-24 h-24 rounded-full object-cover mb-4 shadow-2xl border-4 border-white" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-20 h-20 bg-church-primary rounded-full flex items-center justify-center text-white text-3xl mb-4">🌳</div>
            )}
            <h1 className="text-3xl font-serif text-church-primary font-bold text-center">
              {church?.name || 'Árvore da Vida'}
            </h1>
          </div>
          <p className="text-stone-500 text-center mb-8 italic">
            {authMode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta e floresça'}
          </p>

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {authMode === 'register' && (
              <>
                <input
                  type="text" placeholder="Nome Completo" required
                  className="w-full p-4 rounded-2xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                />
                <input
                  type="text" placeholder="Endereço" required
                  className="w-full p-4 rounded-2xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary"
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 uppercase ml-2">Nascimento</label>
                    <input
                      type="date" required
                      className="w-full p-4 rounded-2xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary"
                      value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 uppercase ml-2">Já é membro?</label>
                    <select
                      className="w-full p-4 rounded-2xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary"
                      value={formData.isMember} onChange={e => setFormData({...formData, isMember: e.target.value})}
                    >
                      <option>Sim</option>
                      <option>Não</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            <input
              type="text" placeholder="WhatsApp / Telefone" required
              className="w-full p-4 rounded-2xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary"
              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
            />
            <input
              type="password" placeholder="Senha" required
              className="w-full p-4 rounded-2xl bg-stone-100 border-none focus:ring-2 focus:ring-church-primary"
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
            />
            
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

            <button className="w-full bg-church-primary text-white p-4 rounded-2xl font-bold hover:opacity-90 transition-opacity">
              {authMode === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-sm text-stone-500 hover:text-church-primary"
            >
              {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre aqui'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="p-6 flex justify-between items-center max-w-4xl mx-auto">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('home')}>
          {church?.logoUrl ? (
            <img src={church.logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 bg-church-primary rounded-full flex items-center justify-center text-white text-xs">🌳</div>
          )}
          <h1 className="text-xl font-serif text-church-primary font-bold">{church?.name || 'Árvore da Vida'}</h1>
        </div>
        <div className="flex items-center gap-4">
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setCurrentView('home')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-church-primary/10 text-church-primary rounded-full text-xs font-bold hover:bg-church-primary/20 transition-colors"
            >
              ⚙️ Painel ADM
            </button>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-stone-800">{profile?.name}</p>
            <span className="text-[9px] bg-stone-100 px-2 py-0.5 rounded-full text-stone-500 uppercase font-bold tracking-widest">
              {profile?.role === 'admin' ? 'Pastor / ADM' : 
               profile?.role === 'treasurer' ? 'Tesoureiro' : 
               profile?.role === 'media' ? 'Mídia' : 'Membro'}
            </span>
          </div>
          <button onClick={logout} className="p-2 bg-stone-200 rounded-full hover:bg-stone-300 transition-colors">
            🚪
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {currentView === 'home' && (
          <>
            {profile?.role === 'admin' && (
              <div className="mb-12 p-8 bg-church-primary text-white rounded-[2.5rem] shadow-2xl animate-in slide-in-from-top-8 duration-700">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-serif italic">Painel do Pastor</h3>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Acesso Total</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <button onClick={() => setCurrentView('settings')} className="flex flex-col items-center gap-2 p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all hover:scale-105">
                    <span className="text-2xl">🎨</span>
                    <span className="text-xs font-bold">Identidade</span>
                  </button>
                  <button onClick={() => setCurrentView('finance')} className="flex flex-col items-center gap-2 p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all hover:scale-105">
                    <span className="text-2xl">📊</span>
                    <span className="text-xs font-bold">Finanças</span>
                  </button>
                  <button onClick={() => setCurrentView('attendance')} className="flex flex-col items-center gap-2 p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all hover:scale-105">
                    <span className="text-2xl">📝</span>
                    <span className="text-xs font-bold">Frequência</span>
                  </button>
                  <button onClick={() => setCurrentView('census')} className="flex flex-col items-center gap-2 p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all hover:scale-105">
                    <span className="text-2xl">👥</span>
                    <span className="text-xs font-bold">Membros</span>
                  </button>
                </div>
              </div>
            )}

            <div className="mb-12 text-center animate-in fade-in zoom-in duration-700">
              <h2 className="text-4xl font-serif text-church-secondary mb-2 italic">Olá, {profile?.name.split(' ')[0]}</h2>
              <div className="flex items-center justify-center gap-2 text-church-accent">
                <span>🔥</span>
                <span className="font-bold">{profile?.streak || 0} dias de ofensiva</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-stone-200 -z-10"></div>
              
              <div 
                onClick={() => setCurrentView('devotional')}
                className="glass-card p-10 rounded-[3rem] text-center hover:scale-105 transition-all cursor-pointer group"
              >
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-green-100 transition-colors">
                  <span className="text-4xl">🌱</span>
                </div>
                <h3 className="text-xl font-bold text-church-primary">Crescimento</h3>
                <p className="text-sm text-stone-500 mt-2">Devocional Diário</p>
              </div>

              <div 
                onClick={() => setCurrentView('events')}
                className="glass-card p-10 rounded-[3rem] text-center hover:scale-105 transition-all cursor-pointer group border-2 border-church-primary/10"
              >
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-100 transition-colors">
                  <span className="text-4xl">🤝</span>
                </div>
                <h3 className="text-xl font-bold text-church-primary">Comunhão</h3>
                <p className="text-sm text-stone-500 mt-2">Agenda da Igreja</p>
              </div>

              <div 
                onClick={() => setCurrentView('finance')}
                className="glass-card p-10 rounded-[3rem] text-center hover:scale-105 transition-all cursor-pointer group"
              >
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-amber-100 transition-colors">
                  <span className="text-4xl">💰</span>
                </div>
                <h3 className="text-xl font-bold text-church-primary">Mordomia</h3>
                <p className="text-sm text-stone-500 mt-2">Transparência Viva</p>
              </div>
            </div>
          </>
        )}

        {currentView === 'devotional' && profile && <DevotionalView profile={profile} />}
        {currentView === 'events' && profile && <EventsView profile={profile} />}
        {currentView === 'finance' && profile && <FinanceView profile={profile} />}
        {currentView === 'settings' && profile && <SettingsView profile={profile} />}
        {currentView === 'census' && <MemberListView />}
        {currentView === 'attendance' && <AttendanceView />}
      </main>

      {currentView !== 'home' && (
        <button 
          onClick={() => setCurrentView('home')}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-church-primary text-white px-8 py-3 rounded-full shadow-2xl hover:scale-110 transition-transform z-50 font-bold"
        >
          ← Voltar para a Árvore
        </button>
      )}
    </div>
  );
}

export default App;
