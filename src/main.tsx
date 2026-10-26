import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { isAndroidBuild } from "./platform";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (isAndroidBuild) {
  // 资产就在 APK 里，Service Worker 只会把同一批文件再缓存一份（最多 1500 条媒体），
  // 既浪费空间，又可能在版本升级后继续返回旧文件。这里顺手清掉既往注册。
  navigator.serviceWorker
    ?.getRegistrations?.()
    .then((rs) => Promise.all(rs.map((r) => r.unregister())))
    .catch(() => null);
} else if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => null);
  });
}
