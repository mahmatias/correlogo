import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { WorkoutPlan } from '../types';

const CHANNEL_ID = 'workout_reminders';
const NOTIFICATION_HOUR = 7; // 07:00
const NOTIFICATION_MINUTE = 0;

export async function initNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Lembretes de Treino',
      description: 'Notificações para treinos agendados',
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#FF006E',
    });
  } catch (e) {
    console.warn('[notifications] Falha ao criar canal:', e);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (e) {
    console.warn('[notifications] Falha ao solicitar permissão:', e);
    return false;
  }
}

function getNotificationDateTime(planDate: string): Date {
  const date = new Date(planDate);
  date.setHours(NOTIFICATION_HOUR, NOTIFICATION_MINUTE, 0, 0);
  return date;
}

function getNotificationId(planId: string): number {
  // Gerar ID numérico determinístico a partir do planId
  let hash = 0;
  for (let i = 0; i < planId.length; i++) {
    hash = ((hash << 5) - hash) + planId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function scheduleWorkoutReminder(plan: WorkoutPlan): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (plan.isCompleted) return;

  if (!plan.scheduledDate) return;
  const planDate = getNotificationDateTime(plan.scheduledDate);
  const now = new Date();

  // Não agendar se a data já passou
  if (planDate <= now) return;

  const id = getNotificationId(plan.id);

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Treino agendado para hoje!',
          body: plan.activityName || plan.name || 'Treino de corrida',
          schedule: { at: planDate, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          extra: { planId: plan.id, type: 'workout_reminder' },
        },
      ],
    });
    console.log(`[notifications] Lembrete agendado para ${planDate} (plan: ${plan.id})`);
  } catch (e) {
    console.warn('[notifications] Falha ao agendar lembrete:', e);
  }
}

export async function cancelWorkoutReminder(planId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const id = getNotificationId(planId);

  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
    console.log(`[notifications] Lembrete cancelado (plan: ${planId})`);
  } catch (e) {
    console.warn('[notifications] Falha ao cancelar lembrete:', e);
  }
}

export async function rescheduleWorkoutReminder(oldPlanId: string, newPlan: WorkoutPlan): Promise<void> {
  await cancelWorkoutReminder(oldPlanId);
  await scheduleWorkoutReminder(newPlan);
}

export async function cancelAllWorkoutReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Get all pending notifications and cancel them
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    console.log('[notifications] Todos os lembretes cancelados');
  } catch (e) {
    console.warn('[notifications] Falha ao cancelar todos:', e);
  }
}

export async function rescheduleAllReminders(plans: WorkoutPlan[]): Promise<void> {
  await cancelAllWorkoutReminders();
  for (const plan of plans) {
    if (!plan.isCompleted) {
      await scheduleWorkoutReminder(plan);
    }
  }
}