#!/usr/bin/env node
/**
 * 校验 APK 里的媒体是否完整。默认只比对文件数与抽样大小（快）；
 * --full 会统计总字节（慢，22k 个文件在机械盘/网络盘上要一两分钟）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const SRC = process.env.ATLAS_MEDIA_DIR
  ? path.resolve(process.env.ATLAS_MEDIA_DIR)
  : path.resolve(root, "../public/atlas");
const DEST = path.resolve(root, "android/app/src/main/assets/public/atlas");
const DIRS = ["img", "thumb", "audio"];

const walk = (dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
};

const full = process.argv.includes("--full");
let bad = 0;

for (const dir of DIRS) {
  const s = walk(path.join(SRC, dir));
  let d;
  try {
    d = walk(path.join(DEST, dir));
  } catch {
    console.error(`✗ 目标目录缺失：atlas/${dir}`);
    bad++;
    continue;
  }
  const name = (p) => path.relative(path.join(SRC, dir), p);
  const srcSet = new Set(s.map(name));
  const set = new Set(d.map((p) => path.relative(path.join(DEST, dir), p)));
  const missing = s.map(name).filter((n) => !set.has(n));
  const extra = [...set].filter((n) => !srcSet.has(n));

  let bytesS = 0;
  let bytesD = 0;
  if (full) {
    for (const p of s) bytesS += fs.statSync(p).size;
    for (const p of d) bytesD += fs.statSync(p).size;
  }

  const ok = missing.length === 0 && extra.length === 0 && (!full || bytesS === bytesD);
  console.log(
    `${ok ? "✓" : "✗"} atlas/${dir}: 源 ${s.length} → 目标 ${d.length}` +
      (full ? ` ｜ ${(bytesS / 1048576).toFixed(1)}MB vs ${(bytesD / 1048576).toFixed(1)}MB` : ""),
  );
  if (missing.length) console.log(`    缺 ${missing.length} 个，例：${missing.slice(0, 3).join(", ")}`);
  if (extra.length) console.log(`    多 ${extra.length} 个，例：${extra.slice(0, 3).join(", ")}`);
  if (!ok) bad++;
}

for (const f of ["index.json", "entries/0.json"]) {
  const p = path.join(DEST, f);
  if (!fs.existsSync(p)) {
    console.error(`✗ 缺少 atlas/${f}——dist 没同步进来？先跑 npm run android:sync`);
    bad++;
  }
}

if (bad) {
  console.error("\n校验未通过。APK 里的词库或媒体不完整，不要拿去打正式包。");
  process.exit(1);
}
console.log("\n校验通过。");
