# 词光 · Android 版

**这是非官方移植，不是原作者的作品。** 这个 App 的一切内容——词库、插画、例句、录音、算法、界面设计——都来自
designfuchen 的开源项目 **Word Atlas 词光**：

> **上游项目：<https://github.com/designfuchen/word-atlas>**
>
> 7,298 个雅思词，每个词一幅原创插画、两句原创例句、英美发音和一套 FSRS 复习节奏。
> 所有词条内容、插画和录音都由原作者独立创作并**自费**完成，然后免费公开。没有他，就没有这个 APK。

如果你觉得这个 App 有用，请去上游仓库点个 star，那才是这份工作的来源。

原项目遵循的许可也一并继承：**代码 MIT，词条/插画/音频 CC BY 4.0，署名 "Word Atlas contributors"**。

---

## 这个仓库做了什么

把上游的纯静态 Web 应用用 [Capacitor](https://capacitorjs.com/) 装进 Android WebView，
让它在没有网络、没有浏览器的情况下作为一个普通 App 运行。

**没有做的事**：没有改词库，没有改 FSRS 调度，没有重新设计界面，没有换掉 WebGL 星图。
业务代码保持原样，改动只发生在"浏览器里有、WebView 里没有"的那些边界上。

| 改动 | 原因 |
|---|---|
| 媒体全量打进 APK（约 620MB） | 断网可用，不依赖任何服务器 |
| 分享卡片改走系统分享面板 | Android WebView 不实现 Web Share API，原代码在 APK 里是死路 |
| 备份导出改走原生文件 + 分享 | `<a download>` + blob 在 WebView 里不会触发下载 |
| 接管返回键 / 侧滑返回 | 否则在词卡上侧滑会直接退出应用 |
| 关闭 Service Worker | 资产已在本地，SW 只会重复缓存并卡住版本升级 |
| 安全区与 edge-to-edge 适配 | Android 15+ 强制 edge-to-edge，状态栏会压住顶栏 |
| 新增每日复习提醒 | 用本地通知在设定的整点提醒，正文带当天累计待复习词数 |
| 自适应图标 / 启动屏 / 应用名 | 从 `icon-512.png` 生成 |

完整的逐文件改动清单在 [UPSTREAM.md](UPSTREAM.md)。

## 技术事实

- Capacitor 8.5.3，`compileSdk 36` / `targetSdk 36` / `minSdk 24`
- release APK 约 **640MB**，解压后 38,100 个文件（22,905 条音频、7,298 幅插画、7,298 张缩略图、73 个词条分块）
- 音频由 `AssetManager` 流式读取（给 mp3/webp 配了 `noCompress`，否则每次播放都会整段解压进内存）
- 学习进度存在 WebView 的 localStorage 里，**不联网、不上传、无账号**
- 卸载或清除数据会清空进度，卸载前先「我的 → 导出备份」
- 实测机型：红米 K70 / Android 16 / HyperOS 3.0.303.0（欧版 EEA）

## 怎么构建

见 [docs/ANDROID.md](docs/ANDROID.md)。简版：

```bash
npm install
npx cap add android
npm run android:patch          # 图标、应用名、noCompress、签名配置
npm run android:release        # 构建 + 同步 + 打包 620MB 媒体 + 签名
```

**媒体不在这个仓库里。** 620MB 的插画和音频来自上游的 `public/atlas/`，默认从本仓库的同级目录读取；
放在别处就用环境变量指过去：

```powershell
$env:ATLAS_MEDIA_DIR="F:\path\to\word-atlas\public\atlas"; npm run android:release
```

## 目录

```
src/                   上游 Web 源码的副本（改动见 UPSTREAM.md）
src/platform/          平台适配层：分享、备份、返回键、通知、状态栏
scripts/android/       媒体打包、完整性校验、原生工程补丁、图标生成
resources/             预生成的图标与启动图
android/               Capacitor 生成的原生工程
docs/ANDROID.md        构建手册
UPSTREAM.md            上游版本、校验值、逐文件改动清单
README.upstream.md     上游原始 README
```

## 许可

- 本仓库修改的代码：MIT（同上游）
- 词条、插画、录音：CC BY 4.0，署名 **Word Atlas contributors**
- 自用之外的再分发请保留以上署名，并注明这是修改版本

原作者与上游：<https://github.com/designfuchen/word-atlas>
