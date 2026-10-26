#!/usr/bin/env node
/** 跨平台调用 gradlew（Windows 用 gradlew.bat），省得记两套命令。 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const androidDir = path.resolve(here, "../../android");

if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  console.warn("⚠ 未检测到 ANDROID_HOME / ANDROID_SDK_ROOT，Gradle 可能找不到 SDK。");
}

const isWin = process.platform === "win32";
const cmd = isWin ? "gradlew.bat" : "./gradlew";
const args = process.argv.slice(2);
if (!args.length) args.push("assembleDebug");

const r = spawnSync(cmd, args, { cwd: androidDir, stdio: "inherit", shell: isWin });
process.exit(r.status ?? 1);
