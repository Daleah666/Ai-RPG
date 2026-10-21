/* Serves /_blob/<id> from the same IndexedDB shelf the page writes. */
const DB = "redz-shelf";
const VER = 1;

function openDb() {
  return new Promise((ok, no) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("docs")) db.createObjectStore("docs");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

async function blobOf(id) {
  const db = await openDb();
  return new Promise((ok, no) => {
    const q = db.transaction("blobs").objectStore("blobs").get(id);
    q.onsuccess = () => ok(q.result || null);
    q.onerror = () => no(q.error);
  });
}

self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const hit = url.pathname.match(/\/_blob\/([0-9a-f]{32})$/i);
  if (!hit) return;
  e.respondWith((async () => {
    const rec = await blobOf(hit[1].toLowerCase());
    if (!rec || !rec.blob) return new Response("missing", { status: 404 });
    return new Response(rec.blob, {
      headers: {
        "Content-Type": rec.type || rec.blob.type || "application/octet-stream",
        "Cache-Control": "no-cache"
      }
    });
  })());
});
