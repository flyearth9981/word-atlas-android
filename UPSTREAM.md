# 上游来源与合并说明

本目录是上游项目的**整份复制**（布局 C），不是 fork 后的长期分家。目的：上游可以继续更新，
你这边改动可控、可对比。

## 来源

| 项 | 值 |
|---|---|
| 项目 | Word Atlas 词光 |
| 版本 | 1.0.0（`../package.json`） |
| 复制日期 | 2026-10-26 |
| 代码许可 | MIT |
| 内容许可 | CC BY 4.0，署名 "Word Atlas contributors" |
| `src/` 文件数 | 45 |
| `src/` 目录树校验值 | `b3db0288b5629158744d3e807de91a5969ef757aaa093291701e23d2776d6fae` |

重新计算校验值（在仓库根目录执行）：

```bash
find src -type f | sort | xargs sha256sum | sha256sum
```

## 本目录相对上游的改动（保持这份清单的准确性）

| 文件 | 改动 | 原因 |
|---|---|---|
| `src/platform/index.ts` | **新增** | 原生分享、备份保存、返回键、状态栏、启动图、回到前台事件的统一入口 |
| `src/platform/notify.ts` | **新增** | 每日复习提醒：算 7 天到期数、排本地通知 |
| `src/App.tsx` | 新增 4 个 useEffect | 接返回键、状态栏跟随主题、收起原生启动图、重排复习提醒 |
| `src/main.tsx` | SW 条件注册 | APK 内资产已在本地，SW 只会重复缓存并卡住升级 |
| `src/store/store.ts` | Settings 增加 `reminder` / `reminderHour` | 提醒开关与时间 |
| `src/ui/share.ts` | 分享改走 `shareFile()` | WebView 无 Web Share API |
| `src/ui/shareSession.ts` | 同上 | 同上 |
| `src/pages/Me.tsx` | 备份改走 `saveTextFile()`；新增提醒开关 | `<a download>` + blob 在 WebView 不触发下载 |
| `src/styles/app.css` | 末尾追加 Android 外壳段 | safe-area、overscroll、dvh |
| `vite.config.ts` | 重写 | 开发期从 `../public/atlas` 提供媒体；去掉 `.local` 私有词库中间件 |
| `index.html` | 未改 | — |

## 合并上游更新的步骤

1. 用上游新版本覆盖 `../`（保留本目录不动）
2. 对上表之外的文件做 `diff`，逐个决定是否同步
3. 同步后重新计算校验值，更新本文件
4. 重跑 `npm run build:android` + `npm test`
