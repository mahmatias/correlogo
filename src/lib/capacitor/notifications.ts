import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';

export async function scheduleWorkoutReminder(title: string, body: string, date: Date) {
  if (!isNative()) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        title,
        body,
        id: 1,
        schedule: { at: date },
        sound: 'default',
      },
    ],
  });
}

export async function cancelAllNotifications() {
  if (!isNative()) return;
  await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
}
