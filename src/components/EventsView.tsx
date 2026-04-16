import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { UserProfile } from '../App';
import { format, addWeeks, addMonths, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, writeBatch } from 'firebase/firestore';

interface ChurchEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  imageUrl?: string;
}

export function EventsView({ profile }: { profile: UserProfile }) {
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ChurchEvent | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [newEvent, setNewEvent] = useState({ 
    title: '', 
    description: '', 
    date: '', 
    location: '', 
    imageUrl: '', 
    isRecurring: false,
    recurrenceDays: [] as number[],
    recurrenceMonths: 1
  });

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChurchEvent)));
    });
    return unsubscribe;
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newEvent.isRecurring && newEvent.recurrenceDays.length > 0) {
      const batch = writeBatch(db);
      const start = new Date(newEvent.date);
      const end = addMonths(start, newEvent.recurrenceMonths);
      
      const days = eachDayOfInterval({ start, end });
      
      days.forEach(day => {
        const dayOfWeek = getDay(day);
        if (newEvent.recurrenceDays.includes(dayOfWeek)) {
          const eventDate = new Date(day);
          eventDate.setHours(start.getHours());
          eventDate.setMinutes(start.getMinutes());
          
          const eventRef = doc(collection(db, 'events'));
          batch.set(eventRef, {
            title: newEvent.title,
            description: newEvent.description,
            date: eventDate.toISOString(),
            location: newEvent.location,
            imageUrl: newEvent.imageUrl
          });
        }
      });
      await batch.commit();
    } else {
      await addDoc(collection(db, 'events'), {
        title: newEvent.title,
        description: newEvent.description,
        date: new Date(newEvent.date).toISOString(),
        location: newEvent.location,
        imageUrl: newEvent.imageUrl
      });
    }
    
    setShowAdd(false);
    setNewEvent({ 
      title: '', 
      description: '', 
      date: '', 
      location: '', 
      imageUrl: '', 
      isRecurring: false,
      recurrenceDays: [],
      recurrenceMonths: 1
    });
  };

  const toggleDay = (day: number) => {
    const current = newEvent.recurrenceDays;
    if (current.includes(day)) {
      setNewEvent({ ...newEvent, recurrenceDays: current.filter(d => d !== day) });
    } else {
      setNewEvent({ ...newEvent, recurrenceDays: [...current, day] });
    }
  };

  const weekDays = [
    { label: 'D', value: 0 },
    { label: 'S', value: 1 },
    { label: 'T', value: 2 },
    { label: 'Q', value: 3 },
    { label: 'Q', value: 4 },
    { label: 'S', value: 5 },
    { label: 'S', value: 6 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-serif text-church-primary italic">Comunhão</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            className="bg-stone-200 text-stone-600 px-4 py-2 rounded-full text-xs font-bold"
          >
            {viewMode === 'list' ? '📅 Mensal' : '📋 Lista'}
          </button>
          {(profile.role === 'admin' || profile.role === 'media') && (
            <button 
              onClick={() => setShowAdd(!showAdd)}
              className="bg-church-primary text-white px-4 py-2 rounded-full text-xs font-bold"
            >
              {showAdd ? 'Cancelar' : '+ Novo Evento'}
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="glass-card p-6 rounded-3xl space-y-4">
          <input 
            type="text" placeholder="Título do Evento" required
            className="w-full p-3 rounded-xl bg-stone-100 border-none"
            value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
          />
          <input 
            type="datetime-local" required
            className="w-full p-3 rounded-xl bg-stone-100 border-none"
            value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})}
          />
          <input 
            type="text" placeholder="Local" required
            className="w-full p-3 rounded-xl bg-stone-100 border-none"
            value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})}
          />
          <input 
            type="url" placeholder="URL da Imagem de Capa"
            className="w-full p-3 rounded-xl bg-stone-100 border-none"
            value={newEvent.imageUrl} onChange={e => setNewEvent({...newEvent, imageUrl: e.target.value})}
          />
          <textarea 
            placeholder="Descrição"
            className="w-full p-3 rounded-xl bg-stone-100 border-none h-24"
            value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
          />
          <div className="space-y-3 p-4 bg-stone-100 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-church-primary"
                checked={newEvent.isRecurring} 
                onChange={e => setNewEvent({...newEvent, isRecurring: e.target.checked})} 
              />
              <span className="text-sm text-stone-600 font-bold">Repetir este evento</span>
            </label>

            {newEvent.isRecurring && (
              <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <p className="text-[10px] text-stone-400 uppercase font-bold">Dias da Semana</p>
                  <div className="flex justify-between">
                    {weekDays.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                          newEvent.recurrenceDays.includes(day.value)
                            ? 'bg-church-primary text-white'
                            : 'bg-white text-stone-400 border border-stone-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-stone-400 uppercase font-bold">Duração</p>
                  <select 
                    className="w-full p-2 rounded-lg bg-white border border-stone-200 text-sm"
                    value={newEvent.recurrenceMonths}
                    onChange={e => setNewEvent({...newEvent, recurrenceMonths: parseInt(e.target.value)})}
                  >
                    <option value={1}>Por 1 mês</option>
                    <option value={2}>Por 2 meses</option>
                    <option value={3}>Por 3 meses</option>
                    <option value={6}>Por 6 meses</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <button className="w-full bg-church-primary text-white p-3 rounded-xl font-bold">Salvar Evento</button>
        </form>
      )}

      {selectedEvent ? (
        <div className="glass-card overflow-hidden rounded-[2.5rem] animate-in zoom-in duration-300">
          <div className="h-64 bg-stone-200 relative">
            {selectedEvent.imageUrl ? (
              <img src={selectedEvent.imageUrl} alt={selectedEvent.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-400 text-6xl">⛪</div>
            )}
            <button 
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <div className="p-8 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-3xl font-bold text-church-secondary">{selectedEvent.title}</h3>
                <p className="text-church-primary font-serif italic">{format(new Date(selectedEvent.date), "EEEE, d 'de' MMMM 'às' HH:mm'h'", { locale: ptBR })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-stone-500">
              <span>📍</span> {selectedEvent.location}
            </div>
            <p className="text-stone-600 leading-relaxed pt-4 border-t border-stone-100">
              {selectedEvent.description}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.length > 0 ? events.map(event => (
            <div 
              key={event.id} 
              onClick={() => setSelectedEvent(event)}
              className="glass-card p-4 rounded-3xl flex gap-4 items-center hover:scale-[1.02] transition-transform cursor-pointer"
            >
              <div className="w-20 h-20 bg-stone-100 rounded-2xl overflow-hidden flex-shrink-0">
                {event.imageUrl ? (
                  <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">⛪</div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-church-secondary">{event.title}</h3>
                <p className="text-xs text-stone-400">{format(new Date(event.date), "d 'de' MMM '•' HH:mm'h'", { locale: ptBR })}</p>
                <p className="text-xs text-stone-500 mt-1 line-clamp-1">📍 {event.location}</p>
              </div>
              {(profile.role === 'admin' || profile.role === 'media') && (
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'events', event.id)); }}
                  className="p-2 text-stone-300 hover:text-red-500"
                >
                  🗑️
                </button>
              )}
            </div>
          )) : (
            <div className="text-center py-20 glass-card rounded-[2.5rem] text-stone-400 italic">
              Nenhum evento programado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
