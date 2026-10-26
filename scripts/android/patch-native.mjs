#!/usr/bin/env node
/**
 * 给 `npx cap add android` 生成的原生工程打补丁。可重复执行（幂等）。
 *
 * 只做在生成物上改会更稳的事：
 *   · 已压缩媒体不参与 deflate（否则 AssetManager 每次都整段解压进内存）
 *   · 应用名、包名与 capacitor.config 对齐
 *   · 图标 / 启动图（由 make-resources.py 预生成）
 *   · Android 12+ 系统启动屏的背景色与图标
 *
 * 不在这里做的事：通知权限、FileProvider 路径、predictive back 开关——
 * 那些等对应功能真正写的时候再加，避免留下"配了但没用"的死配置。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const APP = path.resolve(root, "android/app/src/main");
const RES = path.join(APP, "res");
const RES_SRC = path.resolve(root, "resources");

const pkg = JSON.parse(fs.readFileSync(path.resolve(root, "package.json"), "utf8"));
const APP_ID = "tech.wordatlas.app";
const APP_NAME = "词光";

if (!fs.existsSync(path.join(root, "android"))) {
  console.error("✗ android/ 不存在。先跑 npx cap add android。");
  process.exit(1);
}

const changes = [];
const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s, "utf8");

/** 把 srcDir 下的文件按相对路径覆盖到 destDir */
function overlay(srcDir, destDir) {
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, e.name);
    const d = path.join(destDir, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      overlay(s, d);
    } else if (e.isFile()) {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      const same = fs.existsSync(d) && Buffer.compare(fs.readFileSync(s), fs.readFileSync(d)) === 0;
      if (same) continue;
      fs.copyFileSync(s, d);
      changes.push("res/" + path.relative(RES, d));
    }
  }
}

/* 1. 图标与启动图 */
if (fs.existsSync(RES_SRC)) {
  overlay(path.join(RES_SRC, "icon"), RES);
  overlay(path.join(RES_SRC, "splash"), RES);
} else {
  console.warn("⚠ resources/ 不存在，跳过图标。先跑 python scripts/android/make-resources.py");
}

/* 2. app/build.gradle */
const gradlePath = path.resolve(root, "android/app/build.gradle");
let gradle = read(gradlePath);
const before = gradle;

// 签名配置：只有当 android/keystore.properties 存在时才注入，
// 否则 release 构建会产出 unsigned 包（Gradle 不报错，装不上才发现）
const keystoreProps = path.resolve(root, "android/keystore.properties");
if (!gradle.includes("signingConfigs")) {
  gradle = gradle.replace(
    /^apply plugin: 'com\.android\.application'/m,
    `apply plugin: 'com.android.application'

def keystorePropsFile = rootProject.file("keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) {
    keystoreProps.load(new FileInputStream(keystorePropsFile))
}`,
  );
  gradle = gradle.replace(
    /android\s*\{/,
    `android {
    signingConfigs {
        release {
            if (keystorePropsFile.exists()) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }
`,
  );
  gradle = gradle.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
    `$1
            if (keystorePropsFile.exists()) {
                signingConfig signingConfigs.release
            }`,
  );
}

if (!gradle.includes("noCompress")) {
  gradle = gradle.replace(
    /android\s*\{/,
    `android {
    androidResources {
        // mp3/webp 本身已压缩，再 deflate 只会拖慢构建，
        // 并且让 AssetManager 无法按流读取（音频播放依赖这一点）
        noCompress += ['mp3', 'webp', 'wav', 'ogg']
    }
`,
  );
}

gradle = gradle.replace(/applicationId\s+"[^"]*"/, `applicationId "${APP_ID}"`);
gradle = gradle.replace(/namespace\s*=\s*"[^"]*"/, `namespace = "${APP_ID}"`);
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${process.env.VERSION_CODE ?? 1}`);
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);

if (gradle !== before) {
  write(gradlePath, gradle);
  changes.push("app/build.gradle");
}

/* 3. strings.xml */
const stringsPath = path.join(RES, "values/strings.xml");
let strings = read(stringsPath);
const s0 = strings;
strings = strings
  .replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${APP_NAME}</string>`)
  .replace(/<string name="title_activity_main">[^<]*<\/string>/, `<string name="title_activity_main">${APP_NAME}</string>`)
  .replace(/<string name="package_name">[^<]*<\/string>/, `<string name="package_name">${APP_ID}</string>`)
  .replace(/<string name="custom_url_scheme">[^<]*<\/string>/, `<string name="custom_url_scheme">${APP_ID}</string>`);
if (strings !== s0) {
  write(stringsPath, strings);
  changes.push("res/values/strings.xml");
}

/* 4. Android 12+ 系统启动屏 */
const stylesPath = path.join(RES, "values/styles.xml");
let styles = read(stylesPath);
const st0 = styles;
if (!styles.includes("windowSplashScreenBackground")) {
  styles = styles.replace(
    /<style name="AppTheme\.NoActionBarLaunch"[^>]*>([\s\S]*?)<\/style>/,
    (m, body) =>
      `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">` +
      body.trimEnd() +
      `
        <item name="windowSplashScreenBackground">#11172E</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`,
  );
}
if (styles !== st0) {
  write(stylesPath, styles);
  changes.push("res/values/styles.xml");
}

/* 5. gradle.properties：700MB 资产打包时默认 1.5G 堆容易 OOM */
const propsPath = path.resolve(root, "android/gradle.properties");
let props = read(propsPath);
const p0 = props;
props = props.replace(/^org\.gradle\.jvmargs=.*$/m, "org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8");
if (props !== p0) {
  write(propsPath, props);
  changes.push("gradle.properties");
}

/* 6. local.properties：把 SDK 路径写死，省掉最常见的 "SDK location not found" */
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const localProps = path.resolve(root, "android/local.properties");
if (sdk) {
  const line = `sdk.dir=${sdk.replace(/\\/g, "/")}\n`;
  if (!fs.existsSync(localProps) || read(localProps) !== line) {
    write(localProps, line);
    changes.push("local.properties");
  }
} else {
  console.warn("⚠ 没读到 ANDROID_HOME，跳过了 local.properties；Gradle 可能需要它才能找到 SDK");
}

if (!changes.length) {
  console.log("✓ 没有需要改动的地方（补丁已应用过）");
} else {
  console.log(`✓ 已应用 ${changes.length} 项改动：`);
  for (const c of changes.slice(0, 8)) console.log("  · " + c);
  if (changes.length > 8) console.log(`  · …… 其余 ${changes.length - 8} 项`);
}
