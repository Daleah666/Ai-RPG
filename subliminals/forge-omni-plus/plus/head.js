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
