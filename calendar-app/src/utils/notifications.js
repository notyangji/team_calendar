import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForNotifications() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "일정 알림",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4A90E2",
    });
  }
  return status === "granted";
}

export async function syncEventReminders(events) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const ev of events) {
      if (!ev?.reminder?.enabled || !ev?.startDate) continue;
      const minutes = ev.reminder.minutes ?? 30;
      const fireAt = new Date(ev.startDate).getTime() - minutes * 60 * 1000;
      if (isNaN(fireAt) || fireAt <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: ev.title || "일정 알림",
          body: minutes > 0 ? `${minutes}분 후 일정이 시작됩니다.` : "일정이 시작됩니다.",
          data: { eventId: ev._id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt),
          channelId: "reminders",
        },
      });
    }
  } catch (e) {
    console.error("알림 예약 실패:", e?.message);
  }
}
