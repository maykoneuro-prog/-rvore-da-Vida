
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("Este navegador não suporta notificações.");
    return false;
  }

  if (Notification.permission === "granted") return true;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function sendLocalNotification(title: string, body: string, icon = "/icons/icon-192.png") {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon,
      badge: icon,
    });
  }
}

// Function to schedule a check
export function checkAndNotify(events: any[], devotionalLogged: boolean) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // 1. Daily Devotional Reminder (6:00 AM)
  if (hours === 6 && minutes === 0 && !devotionalLogged) {
    const lastReminder = localStorage.getItem('last_devotional_reminder');
    const today = now.toISOString().split('T')[0];
    if (lastReminder !== today) {
      sendLocalNotification(
        "🔥 Chama Acesa!", 
        "Bom dia! Seu devocional de hoje já está disponível. Vamos começar o dia com Deus?"
      );
      localStorage.setItem('last_devotional_reminder', today);
    }
  }

  // 2. Event Reminder (1 day before)
  events.forEach(event => {
    const eventDate = new Date(event.date);
    const oneDayBefore = new Date(eventDate);
    oneDayBefore.setDate(eventDate.getDate() - 1);
    
    // Set reminder time to 9:00 AM the day before
    oneDayBefore.setHours(9, 0, 0, 0);

    const diff = Math.abs(now.getTime() - oneDayBefore.getTime());
    const fiveMinutes = 5 * 60 * 1000;

    if (diff < fiveMinutes) {
      const reminderKey = `reminder_event_${event.id}`;
      if (!localStorage.getItem(reminderKey)) {
        sendLocalNotification(
          "📅 Evento Amanhã!",
          `Não esqueça: Amanhã teremos "${event.title}" às ${format(eventDate, 'HH:mm')}h.`
        );
        localStorage.setItem(reminderKey, 'sent');
      }
    }
  });
}

function format(date: Date, fmt: string) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
