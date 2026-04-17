import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

interface Attendance {
  id: string;
  eventName: string;
  totalPeople: number;
  hasVisitors: boolean;
  visitorCount: number;
  childrenCount: number;
  date: any;
}

export function AttendanceView() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newRecord, setNewRecord] = useState({ eventName: '', totalPeople: '', hasVisitors: false, visitorCount: '', childrenCount: '' });

  useEffect(() => {
    const q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
    });

    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0,0,0,0);

    const eventsUnsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const allEvents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter events that happen this week (or are recent)
      setEvents(allEvents.filter((ev: any) => {
        const evDate = new Date(ev.date);
        return evDate >= startOfWeek;
      }));
    });

    return () => {
      unsubscribe();
      eventsUnsubscribe();
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'attendance'), {
      ...newRecord,
      totalPeople: parseInt(newRecord.totalPeople),
      visitorCount: parseInt(newRecord.visitorCount || '0'),
      childrenCount: parseInt(newRecord.childrenCount || '0'),
      date: serverTimestamp()
    });
    setShowAdd(false);
    setNewRecord({ eventName: '', totalPeople: '', hasVisitors: false, visitorCount: '', childrenCount: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-serif text-church-primary italic">Controle de Culto</h2>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="bg-church-primary text-white px-4 py-2 rounded-full text-sm"
        >
          {showAdd ? 'Cancelar' : '+ Registrar Culto'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="glass-card p-6 rounded-3xl space-y-4">
          <div className="space-y-4">
            <h4 className="text-[10px] text-stone-400 uppercase font-black tracking-widest px-1">Próximos Eventos da Semana</h4>
            <div className="grid grid-cols-1 gap-2">
              {events.length > 0 ? events.map(ev => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setNewRecord({...newRecord, eventName: ev.title})}
                  className={`p-4 rounded-2xl text-left transition-all border ${
                    newRecord.eventName === ev.title 
                      ? 'bg-church-primary text-white border-church-primary shadow-lg' 
                      : 'bg-stone-50 text-stone-600 border-stone-100 hover:bg-stone-100'
                  }`}
                >
                  <p className="font-bold text-sm">{ev.title}</p>
                  <p className={`text-[10px] ${newRecord.eventName === ev.title ? 'text-white/70' : 'text-stone-400'}`}>
                    {new Date(ev.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              )) : (
                <p className="text-[10px] text-stone-400 italic text-center py-4">Nenhum evento futuro encontrado para esta semana.</p>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100"></div></div>
              <div className="relative flex justify-center text-[8px] uppercase font-bold text-stone-300 bg-white px-2">Ou digite um nome</div>
            </div>
            <input 
              type="text" 
              placeholder="Digite o nome do evento"
              className="w-full p-3 rounded-xl bg-stone-100 border-none text-sm"
              value={newRecord.eventName}
              onChange={e => setNewRecord({...newRecord, eventName: e.target.value})}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input 
              type="number" placeholder="Total de Pessoas" required
              className="w-full p-3 rounded-xl bg-stone-100 border-none"
              value={newRecord.totalPeople} onChange={e => setNewRecord({...newRecord, totalPeople: e.target.value})}
            />
            <input 
              type="number" placeholder="Crianças"
              className="w-full p-3 rounded-xl bg-stone-100 border-none"
              value={newRecord.childrenCount} onChange={e => setNewRecord({...newRecord, childrenCount: e.target.value})}
            />
          </div>
          <div className="flex items-center gap-4 p-3 bg-stone-100 rounded-xl">
            <label className="text-sm text-stone-500 flex-1">Teve visitantes?</label>
            <input 
              type="checkbox" 
              className="w-6 h-6 rounded-lg text-church-primary focus:ring-church-primary"
              checked={newRecord.hasVisitors} onChange={e => setNewRecord({...newRecord, hasVisitors: e.target.checked})}
            />
          </div>
          {newRecord.hasVisitors && (
            <input 
              type="number" placeholder="Quantidade de Visitantes"
              className="w-full p-3 rounded-xl bg-stone-100 border-none"
              value={newRecord.visitorCount} onChange={e => setNewRecord({...newRecord, visitorCount: e.target.value})}
            />
          )}
          <button className="w-full bg-church-primary text-white p-3 rounded-xl font-bold">Salvar Registro</button>
        </form>
      )}

      <div className="space-y-4">
        {records.map(record => (
          <div key={record.id} className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-church-secondary">{record.eventName}</h3>
                <p className="text-xs text-stone-400">{record.date?.toDate().toLocaleDateString()}</p>
              </div>
              <div className="bg-church-primary/10 text-church-primary px-3 py-1 rounded-full text-xs font-bold">
                {record.totalPeople} pessoas
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
              <div className="text-center">
                <p className="text-[10px] text-stone-400 uppercase">Visitantes</p>
                <p className="text-lg font-bold text-stone-700">{record.visitorCount}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-stone-400 uppercase">Crianças</p>
                <p className="text-lg font-bold text-stone-700">{record.childrenCount}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
