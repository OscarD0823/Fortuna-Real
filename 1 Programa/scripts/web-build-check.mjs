import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const base = '/Fortuna-Real/';
const origin = 'https://oscard0823.github.io';
const manifest = JSON.parse(read('dist-web/manifest.webmanifest'));
for (const field of ['id', 'scope', 'start_url']) assert.equal(manifest[field], './');
assert.equal(manifest.display, 'standalone');
for (const icon of manifest.icons) {
  const png = readFileSync(`dist-web/${icon.src}`);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
}
assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
const index = read('dist-web/index.html');
assert.ok(index.includes(`${base}manifest.webmanifest`));
assert.ok(index.includes(`${base}assets/`));
assert.ok(!index.includes('/src/'));
assert.ok(existsSync('dist-web/.nojekyll'));
assert.ok(!existsSync('dist-web/resources'));
const project = read('src/shared/project.ts');
assert.ok(project.includes(`${origin}${base}`));
assert.ok(project.includes('/releases/latest'));
assert.ok(read('vite.config.ts').includes('"dist-web" : "dist"'));
for (const path of ['src/App.tsx', 'src/marbles-preview.tsx']) {
  assert.ok(!read(path).includes('./games/pinball/'), `${path}: retired renderer must not be bundled`);
}
assert.ok(!read('src/modules/draw/DrawSetup.tsx').includes('setGame("pinball")'));
assert.ok(!read('src/shared/tutorial/tutorialContent.ts').includes('pinball:'));
const app = read('src/App.tsx');
assert.ok(app.indexOf('<AuthorCard />') > app.indexOf('<header className="topbar">'));
assert.ok(app.indexOf('<AuthorCard />') < app.indexOf('className="fairness-pill results-open"'));

// Execute the actual generated worker with an offline network and isolated caches.
const listeners = new Map();
const saved = new Map();
const foreignCache = new Map([['example', 'unrelated app data']]);
const cacheStore = new Map([['caja-fantasma-v1', foreignCache], ['fortuna-real-web-old', new Map()]]);
let claimed = 0;
let precached = [];
const caches = {
  async open(name) {
    if (!cacheStore.has(name)) cacheStore.set(name, saved);
    const entries = cacheStore.get(name);
    return {
      async addAll(files) {
        precached = [...files];
        for (const path of files) {
          assert.ok(path.startsWith(base));
          assert.ok(!/\.(exe|onnx|dll|key|sig|zip)$/i.test(path));
          assert.ok(existsSync('dist-web/' + path.slice(base.length)), `Missing precache asset ${path}`);
          entries.set(path, `cached:${path}`);
        }
      },
      async match(path) { return entries.get(path); },
    };
  },
  async keys() { return [...cacheStore.keys()]; },
  async delete(name) { return cacheStore.delete(name); },
};
const worker = read('dist-web/sw.js');
runInNewContext(worker, {
  URL, caches,
  fetch() { throw new Error('OFFLINE'); },
  self: {
    location: { origin },
    clients: { async claim() { claimed++; } },
    addEventListener(type, callback) { listeners.set(type, callback); },
    skipWaiting() { throw new Error('Must never interrupt open game windows'); },
  },
});
async function lifecycle(type) {
  let pending;
  listeners.get(type)({ waitUntil(value) { pending = value; } });
  await pending;
}
await lifecycle('install');
assert.equal(claimed, 0, 'An update must not activate during install');
assert.equal(listeners.has('message'), false, 'No forced-activation message');
await lifecycle('activate');
assert.equal(claimed, 1);
assert.equal(cacheStore.has('fortuna-real-web-old'), false);
assert.equal(cacheStore.get('caja-fantasma-v1'), foreignCache);
async function request(path, mode = 'cors', method = 'GET') {
  let response;
  listeners.get('fetch')({
    request: { url: new URL(path, origin).href, mode, method },
    respondWith(value) { response = value; },
  });
  return response;
}
for (const path of [base, base + '?game=cards', base + 'index.html']) {
  assert.equal(await request(path, 'navigate'), `cached:${base}index.html`);
}
for (const path of precached) assert.equal(await request(path), `cached:${path}`);
for (const path of ['/Caja-Fantasma/', base + 'api/room', 'https://github.com/OscarD0823/Fortuna-Real/releases/latest']) {
  assert.equal(await request(path, 'navigate'), undefined, 'Do not capture other apps, rooms or downloads');
}
assert.equal(await request(base, 'navigate', 'POST'), undefined);
assert.equal(await request(base + 'missing.js'), undefined);
console.log(JSON.stringify({ status: 'passed', offlineAssets: precached.length, cachedNavigation: true, nativeOutputSeparate: true, pinballRetired: true, foreignCachesPreserved: true, noForcedUpdates: true }));
