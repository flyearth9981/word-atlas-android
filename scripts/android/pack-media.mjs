#!/usr/bin/env node
/**
 * 把媒体从上级项目拷进 APK 的 assets。
 *
 * 顺序很重要：cap sync 会清空 assets/public，所以必须在 sync 之后跑这个脚本。
 *   npm run android:sync && npm run android:media
 * 或者直接 npm run android:apk（已经按顺序排好）。
 *
 * 增量策略：已存在且大小相同的文件跳过，重复执行只补缺失的部分。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
// 媒体不在本仓库（620MB，走 .gitignore）。默认取同级上游项目的 public/atlas，
// 单独 clone 本仓库时用 ATLAS_MEDIA_DIR 指过去。
const SRC = process.env.ATLAS_MEDIA_DIR
  ? path.resolve(process.env.ATLAS_MEDIA_DIR)
  : path.resolve(root, "../public/atlas");
const DEST = path.resolve(root, "android/app/src/main/assets/public/atlas");
const DIRS = ["img", "thumb", "audio"];

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
};

const human = (n) => (n / 1024 / 1024).toFixed(1) + "MB";

if (!fs.existsSync(SRC)) {
  console.error(`✗ 找不到媒体源目录：${SRC}`);
  console.error("  媒体不打进仓库，需要单独指定：");
  console.error("    ATLAS_MEDIA_DIR=F:\\path\\to\\word-atlas\\public\\atlas npm run android:media");
  console.error("  或者把上游项目 clone 到本仓库的同级目录。");
  process.exit(1);
}
if (!fs.existsSync(path.join(root, "dist/index.html"))) {
  console.error("✗ dist/ 不存在或没有 index.html。先跑 npm run android:sync。");
  process.exit(1);
}

let copied = 0;
let skipped = 0;
let bytes = 0;
const missing = [];

for (const dir of DIRS) {
  const from = path.join(SRC, dir);
  if (!fs.existsSync(from)) {
    missing.push(dir);
    continue;
  }
  const files = walk(from);
  for (const file of files) {
    const rel = path.relative(SRC, file);
    const to = path.join(DEST, rel);
    const size = fs.statSync(file).size;
    let existing = -1;
    try {
      existing = fs.statSync(to).size;
    } catch {
      /* 不存在 */
    }
    if (existing === size) {
      skipped++;
      continue;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(file, to);
    copied++;
    bytes += size;
  }
  console.log(`  ${dir}: ${files.length} 个文件处理完毕`);
}

if (missing.length) {
  console.error(`✗ 缺少媒体目录：${missing.join(", ")}`);
  process.exit(1);
}
console.log(`✓ 拷贝 ${copied} 个文件（${human(bytes)}），跳过 ${skipped} 个已存在的`);
