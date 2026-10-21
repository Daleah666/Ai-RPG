/* Local shelf. Stands in for the artifact runtime so the library, saves,
   tag dictionary and file store work in an ordinary browser.
   Live pages that already have window.claude are left alone. */
(() => {
  if (window.claude && typeof window.claude.use === "function") {
    window.shelfOk = (x) => !!(x && x.url);
    window.shelfSrc = (x) => (typeof x === "string" ? x : (x && x.url) || "");
    window.shelfPublished = () => Promise.resolve(null);
    return;
  }

  const DB = "redz-shelf";
  const VER = 1;
  const urls = new Map();
  const docs = new Map();
  const listeners = new Map();
  let dbp = null;

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

  function txDone(tx) {
    return new Promise((ok, no) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => no(tx.error);
      tx.onabort = () => no(tx.error || new Error("aborted"));
    });
  }

  async function loadAll(db) {
    const docsReq = db.transaction("docs").objectStore("docs").getAll();
    const keysReq = db.transaction("docs").objectStore("docs").getAllKeys();
    const blobsReq = db.transaction("blobs").objectStore("blobs").getAll();
    const blobKeys = db.transaction("blobs").objectStore("blobs").getAllKeys();
    const [rows, keys, blobs, bkeys] = await Promise.all([
      req(docsReq), req(keysReq), req(blobsReq), req(blobKeys)
    ]);
    keys.forEach((k, i) => { if (rows[i]) docs.set(k, rows[i]); });
    bkeys.forEach((k, i) => {
      const rec = blobs[i];
      if (rec && rec.blob) urls.set(k, URL.createObjectURL(rec.blob));
    });
  }

  function req(r) {
    return new Promise((ok, no) => {
      r.onsuccess = () => ok(r.result || []);
      r.onerror = () => no(r.error);
    });
  }

  async function putDoc(path, data) {
    const db = await ready;
    docs.set(path, data);
    const tx = db.transaction("docs", "readwrite");
    tx.objectStore("docs").put(data, path);
    await txDone(tx);
    const col = path.split("/")[0];
    (listeners.get(col) || []).forEach((fn) => { try { fn(); } catch (e) {} });
  }

  async function delDoc(path) {
    const db = await ready;
    docs.delete(path);
    const tx = db.transaction("docs", "readwrite");
    tx.objectStore("docs").delete(path);
    await txDone(tx);
    const col = path.split("/")[0];
    (listeners.get(col) || []).forEach((fn) => { try { fn(); } catch (e) {} });
  }

  function rows(col) {
    const out = [];
    docs.forEach((data, path) => {
      if (path.startsWith(col + "/")) out.push({ id: path.slice(col.length + 1), data });
    });
    return out;
  }

  function watch(col, fn) {
    const list = listeners.get(col) || [];
    list.push(fn);
    listeners.set(col, list);
    return () => {
      const cur = listeners.get(col) || [];
      listeners.set(col, cur.filter((f) => f !== fn));
    };
  }

  function snap(list) {
    return {
      docs: list.map((d) => ({ id: d.id, data: () => Object.assign({}, d.data) }))
    };
  }

  function apply(list, q) {
    let out = list.filter((d) => q.filters.every((f) => {
      const v = d.data ? d.data[f.field] : undefined;
      if (f.op === "==") return v === f.value;
      return true;
    }));
    if (q.order) {
      const { field, dir } = q.order;
      out = out.slice().sort((a, b) => {
        const av = a.data[field], bv = b.data[field];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av > bv ? 1 : -1) * (dir === "desc" ? -1 : 1);
      });
    }
    if (q.limit != null) out = out.slice(0, q.limit);
    return out;
  }

  function query(col, q) {
    const api = {
      limit(n) { return query(col, Object.assign({}, q, { limit: n })); },
      where(field, op, value) { return query(col, Object.assign({}, q, { filters: q.filters.concat([{ field, op, value }]) })); },
      orderBy(field, dir) { return query(col, Object.assign({}, q, { order: { field, dir: dir || "asc" } })); },
      get: async () => snap(apply(rows(col), q)),
      onSnapshot(next, err) {
        const fire = () => { try { next(snap(apply(rows(col), q))); } catch (e) { if (err) err(e); } };
        const stop = watch(col, fire);
        fire();
        return stop;
      },
      doc: (id) => docApi(col + "/" + id),
      add: async (data) => {
        const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).replace(/-/g, "").slice(0, 20);
        await putDoc(col + "/" + id, Object.assign({}, data));
        return { id };
      }
    };
    return api;
  }

  function docApi(path) {
    return {
      id: path.split("/").slice(1).join("/"),
      path,
      get: async () => {
        const data = docs.get(path);
        return { exists: !!data, id: path.split("/").slice(1).join("/"), data: () => (data ? Object.assign({}, data) : undefined) };
      },
      set: async (data) => putDoc(path, Object.assign({}, data)),
      update: async (patch) => {
        const cur = docs.get(path);
        if (!cur) return;
        await putDoc(path, Object.assign({}, cur, patch));
      },
      delete: async () => delDoc(path),
      onSnapshot(next, err) {
        const col = path.split("/")[0];
        const fire = () => {
          try {
            const data = docs.get(path);
            next({ exists: !!data, id: path.split("/").slice(1).join("/"), data: () => (data ? Object.assign({}, data) : undefined) });
          } catch (e) { if (err) err(e); }
        };
        const stop = watch(col, fire);
        fire();
        return stop;
      }
    };
  }

  const dbApi = {
    doc: (path) => docApi(path),
    collection: (name) => query(name, { filters: [] })
  };

  function hexId() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  const assets = {
    async upload(file) {
      if (!file) throw Object.assign(new Error("no file"), { code: "unsupported_type" });
      const type = file.type || "";
      if (!/^(image|video)\//.test(type) && !/\.(gif|png|jpe?g|webp|avif|mp4|webm|mov)$/i.test(file.name || "")) {
        throw Object.assign(new Error("type"), { code: "unsupported_type" });
      }
      const id = hexId();
      const db = await ready;
      try {
        const tx = db.transaction("blobs", "readwrite");
        tx.objectStore("blobs").put({ blob: file, type: type || "application/octet-stream", name: file.name || "", bytes: file.size || 0 }, id);
        await txDone(tx);
      } catch (e) {
        throw Object.assign(new Error("quota"), { code: "quota_exceeded" });
      }
      urls.set(id, URL.createObjectURL(file));
      return { id, url: "/_blob/" + id };
    },
    async list() {
      const out = [];
      urls.forEach((_, id) => out.push({ id, url: "/_blob/" + id }));
      return out;
    },
    async delete(id) {
      const db = await ready;
      const tx = db.transaction("blobs", "readwrite");
      tx.objectStore("blobs").delete(id);
      await txDone(tx);
      const u = urls.get(id);
      if (u) URL.revokeObjectURL(u);
      urls.delete(id);
    }
  };

  const artifact = {
    async publish(files) {
      const json = files && files["card.json"];
      if (typeof json !== "string") throw Object.assign(new Error("nothing to publish"), { code: "invalid" });
      await putDoc("published/card", { json, at: new Date().toISOString() });
      return { ok: true };
    }
  };

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([typeof data === "string" ? data : JSON.stringify(data)], { type: "application/octet-stream" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  };

  async function seedTags() {
    let list = [];
    try {
      const r = await fetch("library/tags.json", { cache: "no-store" });
      if (r.ok) list = await r.json();
    } catch (e) { list = []; }
    if (!Array.isArray(list) || !list.length) return;
    const db = await dbp;
    const tx = db.transaction("docs", "readwrite");
    const store = tx.objectStore("docs");
    let n = 0;
    list.forEach((t) => {
      if (!t || !t.tag) return;
      const id = String(t.tag).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "tag";
      const path = "tags/" + id;
      const cur = docs.get(path);
      if (cur && String(cur.meaning || "").trim()) return;
      const data = {
        tag: t.tag,
        group: (cur && cur.group) || t.group || "saved",
        uses: (cur && cur.uses) || 0,
        last: (cur && cur.last) || "",
        meaning: t.meaning || "",
        source: (cur && cur.source) || "library"
      };
      docs.set(path, data);
      store.put(data, path);
      n++;
    });
    await txDone(tx);
    if (n) (listeners.get("tags") || []).forEach((fn) => { try { fn(); } catch (e) {} });
  }

  const ready = openDb().then(async (db) => {
    dbp = db;
    await loadAll(db);
    await seedTags();
    return db;
  });

  function srcOf(x) {
    const u = typeof x === "string" ? x : (x && x.url) || "";
    const m = String(u).match(/\/_blob\/([0-9a-f]{32})/i);
    if (!m) return u;
    return urls.get(m[1].toLowerCase()) || "";
  }

  window.shelfSrc = srcOf;
  window.shelfOk = (x) => {
    const u = typeof x === "string" ? x : (x && x.url) || "";
    if (!u) return false;
    if (/\/_blob\/[0-9a-f]{32}/i.test(u)) return !!srcOf(u);
    return true;
  };
  window.shelfPublished = async () => {
    await ready;
    const d = docs.get("published/card");
    if (!d || !d.json) return null;
    try { return JSON.parse(d.json); } catch (e) { return null; }
  };

  window.claude = {
    use(name) {
      if (name === "sample") return Promise.resolve(null);
      if (name === "assets") return ready.then(() => assets);
      if (name === "db") return ready.then(() => dbApi);
      if (name === "artifact") return ready.then(() => artifact);
      if (name === "downloads") return Promise.resolve(downloads);
      return Promise.resolve(null);
    }
  };

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("shelf-sw.js").catch(() => {});
  }

  ready.then(() => {
    window.shelfReady = true;
    window.dispatchEvent(new Event("shelf-ready"));
  }).catch(() => {});
})();
