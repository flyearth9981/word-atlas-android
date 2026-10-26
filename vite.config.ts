import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * 媒体（插画 199MB / 缩略图 84MB / 音频 419MB）**不复制**进 android-port，
 * 避免同一份文件在磁盘上存两份。开发时直接从上级项目的 public/atlas 读取；
 * 出 APK 时由 scripts/android/pack-media.mjs 直接拷进 android/app/src/main/assets。
 */
const MEDIA_ROOT = path.resolve(here, "../public/atlas");
const MEDIA_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function parentMedia(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const route = (req.url || "").split("?")[0];
  const m = route.match(/^\/atlas\/(img|thumb|audio)\/([\w./-]+)$/);
  if (!m || m[2].includes("..")) return next();

  const file = path.join(MEDIA_ROOT, m[1], m[2]);
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    res.statusCode = 404;
    res.end();
    return;
  }

  const type = MEDIA_EXT[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "max-age=3600");

  // <audio> 会用 Range 请求，开发期这里必须正确应答，否则测不出真机行为
  const range = req.headers.range;
  if (range) {
    const mm = range.match(/^bytes=(\d+)-(\d*)$/);
    const start = mm ? Number(mm[1]) : 0;
    const end = mm && mm[2] ? Math.min(Number(mm[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", end - start + 1);
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }

  res.setHeader("Content-Length", size);
  fs.createReadStream(file).pipe(res);
}

export default defineConfig(() => ({
  base: "/",
  plugins: [
    react(),
    {
      name: "serve-parent-media",
      configureServer(server) {
        server.middlewares.use(parentMedia);
      },
      configurePreviewServer(server) {
        server.middlewares.use(parentMedia);
      },
    },
  ],
  server: { port: 5188, strictPort: true },
  preview: { port: 5188, strictPort: true },
  build: {
    // HyperOS 3 / Android 16 的 WebView 内核足够新，但不要指望老机器
    target: "es2020",
    chunkSizeWarningLimit: 600,
    // 只有 release 才把媒体放进 dist；dev 构建保持约 95MB，避免每次 sync 拷 700MB
    emptyOutDir: true,
  },
}));
