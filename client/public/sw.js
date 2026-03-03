// VesselPDA Service Worker — PWA support for maritime field agents
const CACHE_VERSION = "vpda-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const SYNC_QUEUE_KEY = "vpda-sync-queue";

// App shell assets — these are cached on install
const SHELL_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // Cache shell assets — ignore failures for optional assets
      return Promise.allSettled(
        SHELL_ASSETS.map((url) => cache.add(url).catch(() => {}))
      );
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (handled by background sync)
  if (request.method !== "GET") return;

  // Skip extension requests, cross-origin, websockets
  if (!url.origin.includes(self.location.origin)) return;
  if (url.pathname.startsWith("/ws") || url.pathname.startsWith("/socket.io")) return;

  // API requests — Network First with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Static assets (JS, CSS, images) — Cache First
  if (
    url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2|woff|ttf)$/) ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(cacheFirstWithNetwork(request, SHELL_CACHE));
    return;
  }

  // HTML navigation — Network First, fallback to cached shell or offline page
  event.respondWith(navigationHandler(request));
});

// Network first — try network, store in cache, fallback to cache
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline", cached: false }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Cache first — serve from cache, update in background
async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Revalidate in background
    fetch(request.clone()).then((r) => { if (r.ok) cache.put(request, r); }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request.clone());
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 404 });
  }
}

// Navigation handler — network first, fallback to cached /, then /offline.html
async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match("/")) ||
      (await cache.match("/offline.html"));
    if (cached) return cached;
    return new Response(
      `<!DOCTYPE html><html><head><title>VesselPDA - Offline</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;background:#0B1120;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}div{text-align:center;padding:2rem}h1{font-size:2rem;color:#60a5fa}p{color:#94a3b8}</style></head><body><div><h1>⚓ VesselPDA</h1><p>You are offline. Please check your connection.</p><p>Your recent data is still available.</p><button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1.5rem;background:#1e40af;color:white;border:none;border-radius:.5rem;cursor:pointer;font-size:1rem">Retry</button></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }
}

// ── BACKGROUND SYNC ───────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "vpda-sync-queue") {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const clients = await self.clients.matchAll();
  // Notify clients that sync is starting
  clients.forEach((c) => c.postMessage({ type: "SYNC_STARTED" }));

  // Read queue from IndexedDB via message to client
  // (LocalStorage not accessible in SW; queue managed via postMessage)
  try {
    const db = await openSyncDB();
    const requests = await getAllQueuedRequests(db);
    let successCount = 0;
    for (const req of requests) {
      try {
        const response = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });
        if (response.ok) {
          await deleteQueuedRequest(db, req.id);
          successCount++;
        }
      } catch {}
    }
    clients.forEach((c) =>
      c.postMessage({ type: "SYNC_COMPLETE", synced: successCount, total: requests.length })
    );
  } catch {}
}

// Minimal IndexedDB helpers for sync queue
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("vpda-sync", 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e);
  });
}

function getAllQueuedRequests(db) {
  return new Promise((resolve) => {
    const tx = db.transaction("queue", "readonly");
    const req = tx.objectStore("queue").getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve([]);
  });
}

function deleteQueuedRequest(db, id) {
  return new Promise((resolve) => {
    const tx = db.transaction("queue", "readwrite");
    tx.objectStore("queue").delete(id);
    tx.oncomplete = resolve;
  });
}

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "VesselPDA", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "VesselPDA", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      tag: payload.tag || "vpda-notification",
      data: payload.url ? { url: payload.url } : {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(url);
        } else {
          self.clients.openWindow(url);
        }
      })
  );
});

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "QUEUE_REQUEST") {
    openSyncDB().then((db) => {
      const tx = db.transaction("queue", "readwrite");
      tx.objectStore("queue").add(event.data.request);
      // Register background sync
      self.registration.sync?.register("vpda-sync-queue").catch(() => {});
    });
  }
  if (event.data?.type === "CLEAR_CACHE") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
