import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

// Web output must never replace the native installer's dist/.
const base = "/Fortuna-Real/";
const result = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
  stdio: "inherit", env: { ...process.env, VITE_WEB_BASE: base, VITE_WEB_BUILD: "true" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
const root = "dist-web";
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const paths = walk(root).filter(path => !path.endsWith(".map"));
const files = paths.map(path => base + relative(root, path).replaceAll("\\", "/"));
const hash = createHash("sha256");
for (const path of paths.sort()) hash.update(path).update(readFileSync(path));
const cache = `fortuna-real-web-${hash.digest("hex").slice(0, 16)}`;
writeFileSync(join(root, "sw.js"), `// Generated from the complete web build.
const CACHE = ${JSON.stringify(cache)};
const PREFIX = "fortuna-real-web-";
const BASE = ${JSON.stringify(base)};
const FILES = ${JSON.stringify(files)};
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener("activate", event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
// Intentionally no skipWaiting: all open games keep their version until every tab closes.
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === "navigate" && (url.pathname === BASE || url.pathname === BASE + "index.html")) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(BASE + "index.html")) || fetch(event.request)));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});
`, "utf8");
writeFileSync(join(root, ".nojekyll"), "");
console.log(JSON.stringify({ base, output: root, precachedFiles: files.length, cache, excludesNativeVoiceAndInstaller: true }));
