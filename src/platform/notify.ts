import type { Progress, Settings } from "../store/store";
import { isNative } from "./index";

/**
 * 每日复习提醒。
 *
 * 设计取舍：
 * 1. 用「未来 7 天各排一条」而不是「每天重复一条」。前者能在通知里写明当天
 *    累计待复习的词数（FSRS 的 due 是本地算出来的，排程时就能知道），
 *    后者只能写死一句话。代价是需要在每次打开 App 时重排一次。
 * 2. `isExactNotification: false`——见下面 schedule 里的注释，这不是可选项。
 * 3. 提醒时间允许迟到几分钟。学习提醒不是闹钟，没必要为此要「闹钟与提醒」权限。
 */

const DAYS = 7;
const BASE_ID = 7310;
const CHANNEL = "review";

type CardLike = { due: number };

/** 未来数天里，每天 hour 点时的「累计待复习」词数（含逾期）。 */
export function dueForecast(cards: Record<string, CardLike>, hour: number, days = DAYS) {
  const now = Date.now();
  const out: { at: Date; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date();
    at.setDate(at.getDate() + i);
    at.setHours(hour, 0, 0, 0);
    if (at.getTime() <= now) continue; // 今天的提醒时间已过，从明天开始
    const end = new Date(at);
    end.setHours(23, 59, 59, 999);
    let count = 0;
    for (const c of Object.values(cards)) if (c.due <= end.getTime()) count++;
    if (count > 0) out.push({ at, count });
  }
  return out;
}

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!isNative) return false;
  const LN = await plugin();
  const cur = await LN.checkPermissions();
  if (cur.display === "granted") return true;
  const res = await LN.requestPermissions();
  return res.display === "granted";
}

export async function cancelReminders(): Promise<void> {
  if (!isNative) return;
  try {
    const LN = await plugin();
    const pending = await LN.getPending();
    if (pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch {
    /* 没有权限或没有已排的通知，都当作无事发生 */
  }
}

/** 依据当前进度重排未来 7 天的提醒。App 启动、回到前台、改设置时调用。 */
export async function syncReminders(progress: Progress, settings: Settings): Promise<void> {
  if (!isNative) return;
  await cancelReminders();
  if (!settings.reminder) return;
  if (!(await requestReminderPermission())) return;

  const items = dueForecast(progress.cards, settings.reminderHour);
  if (!items.length) return;

  const LN = await plugin();
  await LN.createChannel({
    id: CHANNEL,
    name: "复习提醒",
    description: "到点提醒你复习今天该见面的词",
    importance: 3,
    visibility: 1,
  }).catch(() => null);

  await LN.schedule({
    notifications: items.map((it, i) => ({
      id: BASE_ID + i,
      title: "词光 · 该复习了",
      body: `累计 ${it.count} 个词等着你点亮`,
      channelId: CHANNEL,
      // 关键：默认 true 会让插件在缺「闹钟与提醒」权限时拉起系统设置页，
      // 把用户从 App 里弹走。设为 false 后走 setAndAllowWhileIdle，
      // 允许迟到几分钟，换来零额外授权。
      isExactNotification: false,
      schedule: { at: it.at, allowWhileIdle: true },
    })),
  });
}
