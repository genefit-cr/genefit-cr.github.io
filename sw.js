/* Service worker de Genefit: permite instalar la app y abrirla sin señal.
   - La página se pide primero a internet (así siempre llega la versión nueva) y,
     si no hay señal, se usa la copia guardada.
   - Librerías, letras y fotos de ejercicios se guardan la primera vez.
   - Los datos de Firebase NO pasan por aquí: Firebase tiene su propio modo sin señal. */
const VERSION = 'gf-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'];
const GUARDAR = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/|raw\.githubusercontent\.com\/yuhonas\/|cdn\.jsdelivr\.net\/gh\/yuhonas\/)/;
const MAX_FOTOS = 400;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION && x !== 'gf-fotos').map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

async function recortar() {
  const c = await caches.open('gf-fotos'), k = await c.keys();
  for (let i = 0; i < k.length - MAX_FOTOS; i++) await c.delete(k[i]);
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  // Página: primero internet, si no, la copia.
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copia)); }
      return res;
    }).catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }
  // Archivos propios (íconos, manifiesto, pasos.json): copia y se actualiza por detrás.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(r).then(hit => {
      const red = fetch(r).then(res => { if (res.ok) { const c2 = res.clone(); caches.open(VERSION).then(c => c.put(r, c2)); } return res; });
      return hit || red;
    }));
    return;
  }
  // Librerías, letras y fotos de ejercicios: se guardan una vez.
  if (GUARDAR.test(r.url)) {
    const esFoto = /\.(jpg|png)$/.test(url.pathname);
    const cache = esFoto ? 'gf-fotos' : VERSION;
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') { const c2 = res.clone(); caches.open(cache).then(c => c.put(r, c2)).then(() => esFoto && recortar()); }
      return res;
    })));
  }
});

// Al tocar el aviso de "Descanso terminado", volver a la app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => l.length ? l[0].focus() : self.clients.openWindow('./')));
});
