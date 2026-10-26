# Android 构建手册（android-port）

这个目录是**独立工程**：把上游 Word Atlas 的 Web 应用装进 Capacitor 外壳，打包成可离线运行的 APK。
上游目录 `../` 保持原样不动，媒体文件（620MB）也不复制进来，构建时直接读取。

```
word-atlas-main/
├─ src/ public/ ...          ← 上游项目，只读，不要改
└─ android-port/
   ├─ src/                   ← 复制的 Web 源码 + 平台适配（src/platform/）
   ├─ public/atlas/           ← 只有 index.json + entries（7MB）
   ├─ scripts/android/        ← 打包、校验、调用 gradle
   ├─ capacitor.config.ts
   ├─ vite.config.ts          ← 开发时从 ../public/atlas 提供媒体
   └─ android/                ← npx cap add android 生成的原生工程
```

---

## 0. 先确认 Node 版本

```bash
node -v      # Capacitor 8 要求 >= 22
```

低于 22 就装 Node 22 LTS：https://nodejs.org/en/download

---

## 1. 装工具链（一次性，约 3–5GB / 30–60 分钟）

不需要 Android Studio。用 VS Code + 命令行工具即可。

```bash
# 1) JDK 21 (Temurin)
#    https://adoptium.net/temurin/releases/?os=windows&version=21  下载 x64 .msi 安装
java -version        # 必须显示 21.x

# 2) Android commandline-tools
#    https://developer.android.com/studio#command-line-tools-only
#    下载 commandlinetools-win-*.zip → 解压到 C:\Android\sdk\cmdline-tools\latest
#    注意 zip 内层是 cmdline-tools\ 目录，别解压成 latest\cmdline-tools\...

# 3) 环境变量（系统属性 → 环境变量）
#    ANDROID_HOME = C:\Android\sdk
#    Path 追加：
#      %ANDROID_HOME%\platform-tools
#      %ANDROID_HOME%\cmdline-tools\latest\bin

# 4) 装 SDK 组件（新开一个终端让环境变量生效）
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
sdkmanager --licenses       # 一路 y

# 5) 手机准备（红米 K70 / HyperOS 3）
#    设置 → 我的设备 → 全部参数与信息 → 连点「OS 版本」7 次
#    设置 → 更多设置 → 开发者选项 → 打开「USB 调试」和「USB 安装」
#    数据线连电脑，手机上点「允许 USB 调试」

adb devices                 # 应列出你的设备
```

---

## 2. 首次构建

```bash
cd F:\dev\word-atlas-main\android-port

# 装依赖（第一次会生成 package-lock.json）
npm install

# 类型检查 + Web 构建（android 模式：关闭 Service Worker）
npm run build:android

# 生成原生工程（只需一次）
npx cap add android

# 给原生工程打补丁（图标、应用名、noCompress、启动屏；可重复执行）
npm run android:patch

# 同步 Web 产物到原生工程
npx cap sync android
```

`android:patch` 做的事：覆盖图标与启动图、写入应用名"词光"与包名、给 mp3/webp 加 `noCompress`、
设置 Android 12+ 系统启动屏。补丁脚本是幂等的，重复执行不会叠加改动。

图标与启动图已经预生成在 `resources/`（33 个文件，972KB）。要从上游 `icon-512.png` 重新生成：

```bash
python scripts/android/make-resources.py     # 需要 Pillow
```

改完原生工程后继续：

```bash
# 打包媒体（700MB 进 assets，只在这一步做，别每次 sync 都跑）
npm run android:media

# 校验媒体完整性
npm run android:verify

# 出 debug APK
node scripts/android/gradle.mjs assembleDebug

# 装到手机
npm run android:install
```

---

## 3. 日常开发循环（不碰 700MB）

```bash
npm run dev            # 浏览器里调，媒体从 ../public/atlas 实时读
```

改完只同步壳，不重新拷贝媒体：

```bash
npm run android:sync   # 约 30 秒
node scripts/android/gradle.mjs assembleDebug
npm run android:install
```

⚠️ `cap sync` 会**清空** `android/app/src/main/assets/public`，媒体随之消失。
所以只要跑过 sync 又想出正式包，必须重新 `npm run android:media`。

---

## 4. 看运行时日志

```bash
npm run android:log         # Capacitor + Chromium 控制台
adb logcat | findstr wordatlas
```

前端崩溃一般先看 `Capacitor/Console`。想用 Chrome DevTools，把 `CAP_DEBUG=1` 传给 `cap sync`：

```bash
set CAP_DEBUG=1 && npx cap sync android
# 然后 Chrome 打开 chrome://inspect，能看到 WebView
```

---

## 5. 打正式签名包（release）

debug 包用的是 Android 自动生成的调试证书，跟正式证书签名不同。**两种包不能互相覆盖安装**，
换签名必须先卸载——而卸载会清空学习记录。所以第一次切到正式包之前，先在旧版里「我的 → 导出备份」。

### 5.1 生成签名密钥（只做一次）

```powershell
cd F:\dev\word-atlas-main\android-port\android
New-Item -ItemType Directory -Force app\keystore
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v `
  -keystore app\keystore\word-atlas-release.jks `
  -alias wordatlas -keyalg RSA -keysize 4096 -validity 10000 -storetype PKCS12
```

会要你设密码、填姓名单位（随便填，不上架没人看）。**密码和这个 .jks 文件必须自己备份**：
丢了就无法再给已装的 App 做覆盖升级，只能卸载重装，学习记录全没。

### 5.2 写签名配置

新建 `android\keystore.properties`：

```properties
storeFile=keystore/word-atlas-release.jks
storePassword=你的密码
keyAlias=wordatlas
keyPassword=你的密码
```

`storeFile` 是相对 `android/app/` 的路径，所以别写成绝对路径。

### 5.3 构建

```powershell
cd F:\dev\word-atlas-main\android-port
npm run android:release
```

产物：`android\app\build\outputs\apk\release\app-release.apk`。

### 5.4 安装

```powershell
adb uninstall tech.wordatlas.app
npm run android:install:release
```

（首次从 debug 切到 release 必须卸载；之后版本升级直接用 `adb install -r`，记录会保留。）

### 5.5 升级版本号

改 `package.json` 的 `version`，`patch-native` 会把它写进 `versionName`。
`versionCode` 目前固定为 1，需要递增时用环境变量：

```powershell
$env:VERSION_CODE=2; npm run android:patch
```

---

## 6. 已知坑（都在计划里有对应任务）

| 现象 | 原因 | 处理 |
|---|---|---|
| 音频没声音 | WebView 要求用户手势才能播放 | `capacitor.config.ts` 已由原生层放开；若仍无声，检查 `mediaPlaybackRequiresUserGesture` |
| 进度"丢了" | 改了 `server.hostname` 或卸载重装 | origin 变了 localStorage 就换域；不要改 hostname |
| 分享按钮没反应 | 走了 Web 分支 | 确认 `npm run build:android`，而不是普通 `npm run build` |
| 返回键直接退出 | 没监听 backButton | 已在 `src/App.tsx` 接 `onBackButton` |
| 第一次装 APK 很久 | 700MB 资产 | 正常，1–3 分钟 |

---

## 7. 版本与来源

- 上游：Word Atlas 1.0.0（代码 MIT，内容 CC BY 4.0，署名 "Word Atlas contributors"）
- 复制日期：2026-10-26
- 上游 `src/` 校验值：`b3db0288b5629158744d3e807de91a5969ef757aaa093291701e23d2776d6fae`
  （共 45 个文件；用于将来比对上游更新，见 `UPSTREAM.md`）
- Capacitor：8.5.3（compileSdk 36 / targetSdk 36 / minSdk 24，已从包内 build.gradle 核实）
