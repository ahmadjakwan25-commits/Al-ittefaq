// আল-ইত্তেফাক — অফলাইন সার্ভিস ওয়ার্কার
const CACHE = 'al-ittefaq-v18';
const FONTS = 'al-ittefaq-fonts-v1';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon.jpg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'fonts/TiroBangla-Regular.woff', 'data.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const norm = req => { const u = new URL(req.url); u.search = ''; u.hash = ''; return u.href; };

// নেটওয়ার্ক আগে (৪ সেকেন্ডের মধ্যে), না পেলে ক্যাশ — নতুন তথ্য আগে, অফলাইনে ক্যাশ থেকে
async function netFirst(req) {
  const cache = await caches.open(CACHE), key = norm(req);
  const cached = await cache.match(key);
  const net = fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
    return res;
  });
  net.catch(() => {});
  if (!cached) {
    return net.catch(async () => {
      if (req.mode === 'navigate') {
        const home = await cache.match(new URL('index.html', self.registration.scope).href);
        if (home) return home;
      }
      return Response.error();
    });
  }
  return Promise.race([net, new Promise((_, rej) => setTimeout(rej, 4000))]).catch(() => cached);
}

// ফন্ট: একবার অনলাইনে খুললে পরে অফলাইনেও থাকবে
async function fontsSWR(req) {
  const cache = await caches.open(FONTS);
  const cached = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return cached || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(fontsSWR(req));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(netFirst(req));
});
