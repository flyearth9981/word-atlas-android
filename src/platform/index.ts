import { Capacitor } from "@capacitor/core";

/**
 * 平台适配层。业务组件只通过这里碰原生能力，不要直接 import Capacitor 插件，
 * 否则浏览器构建里会混进一堆用不到的原生桥代码。
 *
 * 这个文件在浏览器里也必须能安全执行（isNative 为 false 时全部退化成 Web 行为）。
 */
export const isNative = Capacitor.isNativePlatform();
export const isAndroid = isNative && Capacitor.getPlatform() === "android";

// 编译期标签（.env.android 里设置），用于关掉 Service Worker 之类的 Web 专属逻辑
export const isAndroidBuild = import.meta.env.VITE_TARGET === "android";

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function webDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * 分享一个文件（PNG 卡片、JSON 备份）。
 * 原生：写进缓存目录再交给系统分享面板（微信、相册、文件管理器都在里面）。
 * Web：优先 Web Share API，不支持就退回下载。
 *
 * 注意：Android WebView 不实现 Web Share API，所以原生分支是**唯一**能在 APK 里
 * 分享到微信的路径，不能省。
 */
export async function shareFile(
  blob: Blob,
  filename: string,
  title?: string,
): Promise<"shared" | "downloaded" | "cancelled" | "failed"> {
  if (isNative) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const data = await blobToBase64(blob);
      const written = await Filesystem.writeFile({
        path: `share/${filename}`,
        data,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({ title, files: [written.uri], dialogTitle: "分享" });
      return "shared";
    } catch (e) {
      // 用户点返回取消分享时插件也会抛错，不当成失败
      const msg = String(e);
      if (/cancel/i.test(msg)) return "cancelled";
      return "failed";
    }
  }

  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title }).catch(() => null);
    return "shared";
  }
  webDownload(blob, filename);
  return "downloaded";
}

/** 保存文本文件（备份 JSON）。原生下同样走分享面板，用户可以存到文件管理器或直接发给自己。 */
export async function saveTextFile(
  filename: string,
  text: string,
  title?: string,
): Promise<"shared" | "downloaded" | "cancelled" | "failed"> {
  return shareFile(new Blob([text], { type: "application/json" }), filename, title);
}

/**
 * 接管 Android 返回键 / 侧滑返回。
 * handler 返回 true 表示已处理（比如关掉了词卡），false 则由系统退出应用。
 *
 * targetSdk 36 上 Android 16 默认启用预测性返回：没有监听器时侧滑会直接退出应用，
 * 用户正在做题时误触就是丢一次会话。
 */
export async function onBackButton(handler: () => boolean): Promise<() => void> {
  if (!isNative) return () => {};
  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("backButton", () => {
    if (!handler()) void App.exitApp();
  });
  return () => void handle.remove();
}

/** App 从后台回到前台时触发。Web 端没有这个概念，返回空函数。 */
export async function onAppResume(cb: () => void): Promise<() => void> {
  if (!isNative) return () => {};
  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) cb();
  });
  return () => void handle.remove();
}

/** 状态栏跟随主题。Android 15+ 强制 edge-to-edge，背景色设置可能无效，用 catch 兜住。 */
export async function syncSystemBars(dark: boolean): Promise<void> {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? "#0D1120" : "#F6F1E7" });
  } catch {
    /* 部分 ROM/版本不支持，忽略 */
  }
}

export async function hideSplash(): Promise<void> {
  if (!isNative) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* 忽略 */
  }
}

/** 真机调试用：把前端错误打到 logcat，否则 WebView 里的异常在 adb 里看不到完整堆栈。 */
export function logToNative(level: "info" | "warn" | "error", message: string): void {
  if (!isNative) return;
  try {
    if (level === "error") console.error(`[word-atlas] ${message}`);
    else if (level === "warn") console.warn(`[word-atlas] ${message}`);
    else console.info(`[word-atlas] ${message}`);
  } catch {
    /* 忽略 */
  }
}
