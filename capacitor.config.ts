import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ⚠️ 不要修改 appId / server.hostname / server.androidScheme。
 *
 * WebView 的 origin 决定了 localStorage 的隔离域。这个 App 的全部学习记录
 * （卡片调度、连续天数、收藏）都存在 localStorage 里，一旦 origin 变化，
 * 用户看到的将是空白的进度——不是迁移，是丢失。
 */
const config: CapacitorConfig = {
  appId: "tech.wordatlas.app",
  appName: "词光",
  webDir: "dist",
  server: {
    androidScheme: "https",
    hostname: "localhost",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    // 只在 npm run android:dev 时开；正式包不要留调试口
    webContentsDebuggingEnabled: process.env.CAP_DEBUG === "1",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      backgroundColor: "#0D1120",
      showSpinner: false,
      launchAutoHide: true,
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
