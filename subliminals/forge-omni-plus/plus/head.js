/* Omni Plus: Forge's visual programs, Nova and the visuals AI, bolted onto Omni.
   Everything here talks to Omni only through window.SubliminalOmni, so Omni's own code stays untouched. */
(function(){
const OMNI = window.SubliminalOmni;
if (!OMNI) return;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safeGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const hasSpeech = 'speechSynthesis' in window;
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const LAYER_IDS = ['foundation', 'current', 'surface'];
function omniGet(){ try { return OMNI.get() || {}; } catch (e) { return {}; } }
function omniLines(){ const L = omniGet().lines || {}; return LAYER_IDS.flatMap(id => (L[id] || []).map(x => String((x && (x.f || x.t)) || x || '').trim()).filter(Boolean)); }
function omniGoal(){ return String(omniGet().goal || '').trim(); }

/* ---------- a fourth view: Visuals ---------- */
const vView = $("#vView"), viewSeg = $("#viewSeg");
let inVisuals = false;
function showVisuals(on){
  inVisuals = on; vView.hidden = !on;
  if (on) {
    ['#make', '#omap', '#plView'].forEach(s => { const el = $(s); if (el) el.hidden = true; });
    viewSeg.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === 'visuals')));
    renderVisual(); scrollTo(0, 0);
  }
}
viewSeg.addEventListener('click', e => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  if (b.dataset.view === 'visuals') { e.stopImmediatePropagation(); showVisuals(true); return; }
  if (inVisuals) {
    // put Omni's current view back on screen, then let Omni switch as usual
    const cur = (OMNI.view() || {}).view || 'lines';
    $('#make').hidden = cur !== 'lines'; $('#omap').hidden = cur !== 'map'; $('#plView').hidden = cur !== 'playlist';
    showVisuals(false);
    viewSeg.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.view === cur)));
  }
}, true);
OMNI.on('view', () => { if (inVisuals) showVisuals(false); });

/* ---------- images remembered on this computer (IndexedDB), so folders survive a reload ---------- */
const imgStore = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    try { const r = indexedDB.open('omniplus-images', 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore('imgs', { keyPath: 'key' }); s.createIndex('pid', 'pid'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); }
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('imgs', mode), s = t.objectStore('imgs'); const out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const each = (s, pid, test, act) => { const c = s.index('pid').openCursor(IDBKeyRange.only(pid)); c.onsuccess = () => { const k = c.result; if (!k) return; if (test(k.value)) act(k); k.continue(); }; };
  return {
    put: (pid, items) => tx('readwrite', s => items.forEach(x => s.put({ key: pid + '|' + x.folder + '|' + x.path, pid, path: x.path, folder: x.folder, file: x.file }))).catch(() => { ptoastSoon('Your browser is out of room to remember these images. They play now, but pick them again after a reload.'); }),
    removeFolder: (pid, folder) => tx('readwrite', s => each(s, pid, v => v.folder === folder, k => k.delete())).catch(() => {}),
    removeProgram: pid => tx('readwrite', s => each(s, pid, () => true, k => k.delete())).catch(() => {}),
    loadAll: () => tx('readonly', s => s.getAll()).catch(() => [])
  };
})();
let ptoastSoon = msg => { try { console.warn(msg); } catch (e) {} };
