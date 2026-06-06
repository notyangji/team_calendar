import * as Notifications from "expo-notifications";
import { Platform, Alert } from "react-native";

// [임시 디버그] 확인 후 제거
const DEBUG_NOTIF = true;

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
  let scheduled = 0;
  let skippedPast = 0;
  let lastErr = null;
  let nextFire = null;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const ev of events) {
      if (!ev?.reminder?.enabled || !ev?.startDate) continue;
      const minutes = ev.reminder.minutes ?? 30;
      const fireAt = new Date(ev.startDate).getTime() - minutes * 60 * 1000;
      if (isNaN(fireAt) || fireAt <= now) { skippedPast++; continue; }
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
      scheduled++;
      if (!nextFire || fireAt < nextFire) nextFire = fireAt;
    }
  } catch (e) {
    lastErr = e?.message || String(e);
    console.error("알림 예약 실패:", lastErr);
  }

  if (DEBUG_NOTIF) {
    try {
      const perm = await Notifications.getPermissionsAsync();
      const all = await Notifications.getAllScheduledNotificationsAsync();
      Alert.alert(
        "알림 디버그",
        `권한: ${perm.status}\n` +
        `reminder 켜진 일정 예약: ${scheduled}건\n` +
        `과거라 건너뜀: ${skippedPast}건\n` +
        `실제 예약됨(OS): ${all.length}건\n` +
        `가장 빠른 발송: ${nextFire ? new Date(nextFire).toLocaleString() : "없음"}\n` +
        `현재시각: ${new Date().toLocaleString()}\n` +
        `에러: ${lastErr || "없음"}`
      );
    } catch (e) {
      Alert.alert("알림 디버그 실패", e?.message || String(e));
    }
  }
}
