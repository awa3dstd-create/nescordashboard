// Service Worker — Ingeniería Nescor Dashboard
// Estrategia (v2.8.0-rc6.1):
//   - Navegaciones HTML (documentos): NETWORK-FIRST. Cada refresh va a la red,
//     solo usa caché si offline. Esto asegura que el usuario siempre vea la
//     última versión desplegada sin tener que cerrar el navegador.
//   - Assets estáticos (CSS/JS/imágenes/fuentes con ruta /vendor/ o /data/):
//     cache-first con TTL corto (5 min) para assets sin hash en URL.
//   - API dinámica (/api/*): network-first, fallback a cache.
//   - Imágenes: cache-first.
//
// IMPORTANTE: bump de versión fuerza limpieza de caches antiguos en activate.

const SW_VERSION = 'v2.8.0-rc6.1';
const SHELL_CACHE = `nescor-shell-${SW_VERSION}`;
const API_CACHE = `nescor-api-${SW_VERSION}`;
const DATA_CACHE = `nescor-data-${SW_VERSION}`;
const IMG_CACHE = `nescor-img-${SW_VERSION}`;

// Recursos del shell que se pre-cachean al instalar (solo fallback offline)
const SHELL_URLS = [
  './',
  'favicon.png',
  'manifest.json',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install', SW_VERSION);
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return Promise.allSettled(SHELL_URLS.map(u => cache.add(u)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', SW_VERSION);
  // Limpiar TODOS los caches que no sean de esta versión
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(k => !k.endsWith(SW_VERSION))
          .map(k => {
            console.log('[SW] Eliminando cache viejo:', k);
            return caches.delete(k);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo manejamos GET; otros métodos pasan al network
  if (req.method !== 'GET') return;

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return; // cross-origin: dejar pasar

  // ── API: network-first con fallback a cache ──────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(API_CACHE).then(c => c.put(req, clone)).catch(()=>{});
          }
          return resp;
        })
        .catch(() => {
          return caches.match(req).then(cached => cached || new Response(
            JSON.stringify({ ok: false, error: 'Sin conexión y sin caché' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          ));
        })
    );
    return;
  }

  // ── Navegaciones HTML (documentos): NETWORK-FIRST ────────────────────
  // Esta es la clave: cada refresh va a la red primero. Solo si la red falla
  // (offline), usamos la versión cacheada. Esto asegura que el usuario SIEMPRE
  // vea la última versión desplegada sin tener que cerrar el navegador.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Cachear la versión fresca para offline futuro
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(SHELL_CACHE).then(c => c.put(req, clone)).catch(()=>{});
          }
          return resp;
        })
        .catch(() => {
          // Offline: servir desde caché
          return caches.match(req).then(cached => {
            return cached || caches.match('./').then(fallback => {
              return fallback || new Response(
                '<html><body><h1>Sin conexión</h1><p>No se puede cargar el dashboard offline y no hay caché disponible.</p></body></html>',
                { status: 503, headers: { 'Content-Type': 'text/html' } }
              );
            });
          });
        })
    );
    return;
  }

  // ── Datos estáticos (/dashboard/data/*): cache-first con TTL 5 min ───
  if (url.pathname.indexOf('/data/') !== -1) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) {
          const cachedTime = new Date(cached.headers.get('date') || 0).getTime();
          if (Date.now() - cachedTime < 5 * 60 * 1000) { // 5 min TTL
            return cached;
          }
        }
        try {
          const resp = await fetch(req);
          if (resp.ok) cache.put(req, resp.clone());
          return resp;
        } catch (e) {
          return cached || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
        }
      })
    );
    return;
  }

  // ── Assets estáticos (vendor, scripts, estilos, fuentes, imágenes) ───
  // Cache-first con fallback a red. Si el asset cambia, el bump de SW_VERSION
  // limpiará estos caches en el próximo activate.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp.ok && ['script', 'style', 'font', 'image'].includes(req.destination)) {
          const clone = resp.clone();
          const cacheName = req.destination === 'image' ? IMG_CACHE : SHELL_CACHE;
          caches.open(cacheName).then(c => c.put(req, clone)).catch(()=>{});
        }
        return resp;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});

// Mensajería con la página (para forzar update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
