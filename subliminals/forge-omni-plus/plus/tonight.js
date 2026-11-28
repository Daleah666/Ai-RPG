/* ---------- Tonight's sub: every evening Nova makes a fresh subliminal from her brain ----------
   - made once a day after the evening hour (auto), or any time with Make another
   - 💖 More like this / 🙅 Less like this teach her brain and steer the next night
   - a nightly streak with XP and levels for playing it
   - 🌀 Trance with Nova: hands-free, she talks you down, runs the whole session and wakes you up
   Kept in this browser (localStorage omniplus.tonight). Front Stage reads the same key to light its 🌀 Forge tab. */
const TN_KEY = 'omniplus.tonight', LOOKS = ['studio', 'feminine', 'bimbo', 'trance', 'submission'], TN_SESS = [10, 20, 30, 60, 90];
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
function tnLoad(){
  let o = null; try { o = JSON.parse(safeGet(TN_KEY) || 'null'); } catch (e) {}
  o = o && typeof o === 'object' ? o : {};
  return { cur: o.cur || null, hist: Array.isArray(o.hist) ? o.hist : [], auto: o.auto !== false, hour: Number.isFinite(o.hour) ? o.hour : 19, streak: { n: 0, best: 0, last: '', xp: 0, nights: 0, ...(o.streak || {}) }, greeted: o.greeted || '' };
}
let TN = tnLoad(), tnBusy = false, tnLoaded = '', tnPlayAt = 0, tnPlayTonight = false, tnErr = '';
function tnSave(){ try { localStorage.setItem(TN_KEY, JSON.stringify(TN)); } catch (e) {} }
const LEVELS = ['Glossy rookie', 'Pink apprentice', 'Bubbly adept', 'Trance darling', 'Glow goddess', 'Bimbo royalty'];
function tnLevel(xp){ const lv = Math.floor(Math.sqrt((xp || 0) / 60)) + 1, lo = 60 * (lv - 1) * (lv - 1), hi = 60 * lv * lv; return { lv, title: LEVELS[Math.min(LEVELS.length - 1, lv - 1)], pct: Math.round(((xp - lo) / (hi - lo)) * 100), next: hi - xp }; }
const isEvening = () => new Date().getHours() >= TN.hour || new Date().getHours() < 4;
const ready = () => !!(TN.cur && TN.cur.date === dayKey());
const pickSess = m => TN_SESS.reduce((a, b) => Math.abs(b - m) < Math.abs(a - m) ? b : a, 20);
const asYou = s => String(s).replace(/\bI am\b/g, 'You are').replace(/\bI'm\b/g, "You're").replace(/\bI've\b/g, "You've").replace(/\bI'll\b/g, "You'll").replace(/\bI\b/g, 'You')
  .replace(/\bmyself\b/gi, 'yourself').replace(/\bMy\b/g, 'Your').replace(/\bmy\b/g, 'your').replace(/\bmine\b/g, 'yours').replace(/\bme\b/g, 'you');

/* ---------- making it ---------- */
function topPack(){ const p = Object.entries((BR.taste || {}).pack || {}).sort((a, b) => b[1] - a[1])[0]; return p && PACKS[p[0]] ? p[0] : 'bimbo'; }
function offlineTonight(like){
  const k = like && like.pack && PACKS[like.pack] ? like.pack : topPack(), pk = PACKS[k], look = pk.theme || k;
  const shuffle = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const base = pk.lines ? Object.values(pk.lines).flat() : (pk.prog.phrases || []).map(p => p.replace(/^I /, 'I ').replace(/^([A-Z])/, (m) => m));
  const lines = shuffle(base.length ? base : ['I am confident', 'I glow every day', 'I love who I am becoming']);
  const third = Math.ceil(lines.length / 3);
  return { name: `Tonight: ${pk.prog.name.replace(/^\S+\s/, '')}`, why: `Your favorite pack lately is ${pk.label.replace(/^\S+\s/, '')}, so tonight leans into it.`, goal: omniGoal() || pk.prog.name.replace(/^\S+\s/, ''), look, minutes: 20, pack: k,
    lines: { foundation: lines.slice(0, third), current: lines.slice(third, third * 2), surface: lines.slice(third * 2) }, phrases: shuffle(pk.prog.phrases).slice(0, 10),
    visual: { mode: pk.prog.mode, every: pk.prog.every, stay: pk.prog.stay },
    script: { induction: ['Hi, gorgeous. Get comfy for me.', 'Take a slow breath in… and let it go.', 'Let your shoulders drop. Your eyes can get heavy now.', 'Just listen to my voice and the music, and let everything else fade.'],
      deepener: ['With every breath you sink a little deeper.', 'Deeper and softer, nice and easy.', 'Nothing to do but drift and listen.'], wake: ['Time to come back up for me now.', 'Three… feeling light. Two… feeling bright. One… eyes open, glowing and wide awake.'] }, by: 'offline' };
}
async function makeTonight(opts = {}){
  if (tnBusy) return false; tnBusy = true; tnErr = ''; renderTonight();
  const like = opts.like || null;
  try {
    let t = null;
    if (sampler) {
      const recent = TN.hist.slice(0, 10).map(h => `- ${h.date}: “${h.name}” (${h.look})${h.rating > 0 ? ' — loved it' : h.rating < 0 ? ' — not for them' : ''}`).join('\n') || '(none yet)';
      const prompt = `You are ${BD.name || 'Nova'}, the companion inside this person's own subliminal studio. Make TONIGHT'S SUBLIMINAL for them from everything you know.${like ? `\n\nThey just said "more like this" about “${like.name}” (${like.look}; ${like.goal}). Make a fresh variation in the same spirit: same feel, new lines.` : '\n\nMake it feel new: don\'t repeat a recent night, lean towards nights they loved and away from ones that weren\'t for them.'}\n\nWHAT YOU KNOW ABOUT THEM:\n${brainText()}\n\nRECENT NIGHTS:\n${recent}\n\nRULES: lines are positive, present tense, first person ("I…"), under 12 words, no negatives. It is about who they want to be and how they want to feel; keep it consensual and kind. Nothing about race or ethnicity.${adultOn() ? ' ADULT MODE IS ON (they are 18+ and opted in): explicit sexual themes are welcome if their brain and recent nights point that way, still only consenting adults.' : ''} Phrases for the visuals are 2 to 5 words. The script is what you say out loud in a hands-free trance session: warm, slow, second person, short sentences.\n\nReply with only JSON shaped like: {"name":"short title","why":"one sentence, why this one tonight","goal":"what it's for, in their words","look":"one of ${LOOKS.join('|')}","minutes":20,"lines":{"foundation":["8 lines"],"current":["8 lines"],"surface":["8 lines"]},"phrases":["10 phrases"],"visual":{"mode":"cards|flash|slideshow","every":6,"stay":3},"script":{"induction":["5 sentences"],"deepener":["4 sentences"],"wake":["3 sentences"]}}`;
      const r = await sampler.json(prompt, { cache: false });
      if (r && r.lines && typeof r.name === 'string') t = { ...r, by: 'ai' };
    }
    if (!t) t = offlineTonight(like);
    // tidy whatever came back
    const clean = (a, n, len) => (Array.isArray(a) ? a : []).map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, n).map(x => x.slice(0, len));
    const L = t.lines || {};
    const cur = { date: dayKey(), made: Date.now(), name: String(t.name || 'Tonight').slice(0, 60), why: String(t.why || '').slice(0, 220), goal: String(t.goal || omniGoal() || '').slice(0, 160),
      look: LOOKS.includes(t.look) ? t.look : 'bimbo', minutes: pickSess(Number(t.minutes) || 20), pack: t.pack || '',
      lines: { foundation: clean(L.foundation, 12, 90), current: clean(L.current, 12, 90), surface: clean(L.surface, 12, 90) }, phrases: clean(t.phrases, 14, 40),
      visual: { mode: VMODES[(t.visual || {}).mode] ? t.visual.mode : 'cards', every: Number((t.visual || {}).every) || 6, stay: Number((t.visual || {}).stay) || 3 },
      script: { induction: clean((t.script || {}).induction, 8, 200), deepener: clean((t.script || {}).deepener, 6, 200), wake: clean((t.script || {}).wake, 5, 200) }, by: t.by, played: false, rating: 0, like: like ? like.name : '' };
    if (!cur.script.induction.length) cur.script = offlineTonight().script;
    if (TN.cur && TN.cur.date && TN.cur.name !== cur.name) TN.hist.unshift({ date: TN.cur.date, name: TN.cur.name, look: TN.cur.look, goal: TN.cur.goal, rating: TN.cur.rating || 0, played: !!TN.cur.played });
    TN.hist = TN.hist.slice(0, 30); TN.cur = cur; tnLoaded = ''; tnSave();
    return true;
  } catch (e) { tnErr = aiError(e); return false; }
  finally { tnBusy = false; renderTonight(); }
}
async function ensureTonight(){ if (ready() || tnBusy) return ready(); await aiReady.catch(() => {}); return makeTonight(); }

/* ---------- putting it in the studio ---------- */
function loadTonight(){
  const c = TN.cur; if (!c) return false;
  const tb = $(`#themeSeg [data-theme="${c.look}"]`); if (tb && document.documentElement.getAttribute('data-theme') !== c.look) tb.click();
  const lines = Object.fromEntries(Object.entries(c.lines).map(([l, a]) => [l, a.map(t => ({ t, f: '' }))]));
  OMNI.set({ goal: c.goal || c.name, lines, session: c.minutes });
  if (c.phrases.length) {
    stopV();
    let p = V.programs.find(x => x.tonight);
    if (!p) { p = newProgram('🌙 Tonight'); p.tonight = true; V.programs.push(p); }
    Object.assign(p, { name: '🌙 ' + c.name.slice(0, 40), mode: c.visual.mode, every: c.visual.every, stay: c.visual.stay, opacity: 95, where: 'center', order: 'shuffle', captions: 'own', phrases: c.phrases.join('\n'), on: true });
    clampP(p); V.selected = p.id; vsave(); renderVisual();
    syncOn = true; try { localStorage.setItem('omniplus.sync', '1'); } catch (e) {} renderSync();
  }
  tnLoaded = c.date; return true;
}
async function playTonight(){ if (!TN.cur) return false; if (tnLoaded !== TN.cur.date) loadTonight(); const ok = await OMNI.play(); return ok; }

/* ---------- streak and XP ---------- */
function award(xp, why){ TN.streak.xp = (TN.streak.xp || 0) + xp; tnSave(); renderTonight(); flashXP(`+${xp} XP · ${why}`); }
function flashXP(text){ const t = document.createElement('div'); t.className = 'tn-xp'; t.textContent = text; document.body.append(t); setTimeout(() => t.remove(), 2600); }
OMNI.on('play', () => { tnPlayAt = Date.now(); tnPlayTonight = !!(TN.cur && tnLoaded === TN.cur.date && TN.cur.date === dayKey()); });
OMNI.on('stop', () => {
  if (!tnPlayAt) return; const mins = (Date.now() - tnPlayAt) / 60000; tnPlayAt = 0;
  const need = tnPlayTonight ? Math.min(8, (TN.cur.minutes || 20) * 0.6) : 8;
  if (mins < need) return;
  if (tnPlayTonight && !TN.cur.played) {
    TN.cur.played = true; const S = TN.streak, today = dayKey();
    if (S.last !== today) { S.n = S.last === yesterdayKey() ? (S.n || 0) + 1 : 1; S.best = Math.max(S.best || 0, S.n); S.last = today; S.nights = (S.nights || 0) + 1; }
    award(50 + Math.min(50, (S.n - 1) * 10), `${S.n}-night streak 🔥`);
    learn(`Played tonight's sub “${TN.cur.name}” (${TN.cur.look}) for ${Math.round(mins)} minutes`, 'habits');
  } else award(10, 'session done');
});
function rateTonight(v){
  const c = TN.cur; if (!c) return;
  const was = c.rating; c.rating = v; tnSave();
  if (was !== v) {
    learn(v > 0 ? `Loved the sub “${c.name}”: ${c.look} look, about ${c.goal}. More like this.` : `“${c.name}” (${c.look}, ${c.goal}) wasn't for them. Less like this.`, 'ratings');
    if (!was) award(5, 'taught Nova your taste');
  }
  renderTonight();
}

/* ---------- 🌀 Trance with Nova: hands-free ---------- */
let TR = null;
function speakQ(text, rate = 0.86, force = false){
  return new Promise(res => {
    if (!force && (!TR || TR.stop)) return res();
    const cap = $('#trSay'); if (cap) { cap.textContent = text; cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in'); }
    if (!hasSpeech) { setTimeout(res, 1400 + text.length * 55); return; }
    try {
      const u = new SpeechSynthesisUtterance(text), vs = speechSynthesis.getVoices();
      u.voice = vs.find(v => /female|samantha|zira|aria|jenny|ava|google uk english female/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null;
      u.rate = rate; u.pitch = 1.12; u.volume = 1;
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin; setTimeout(fin, 4000 + text.length * 120);
      speechSynthesis.speak(u);
    } catch (e) { setTimeout(res, 1400 + text.length * 55); }
  });
}
const wait = ms => new Promise(r => { const t = setTimeout(r, ms); if (TR) TR.timers.push(t); });
function tranceOverlay(){
  let o = $('#trance'); if (o) return o;
  o = document.createElement('div'); o.id = 'trance'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Trance with ' + (BD.name || 'Nova'));
  o.innerHTML = `<div class="tr-spiral" aria-hidden="true"></div><div class="tr-ring" aria-hidden="true"></div><img class="tr-nova" alt=""><div class="tr-phrase" id="trPhrase" aria-hidden="true"></div><p class="tr-say" id="trSay" aria-live="polite"></p><div class="tr-foot"><span id="trTime"></span><button type="button" class="btn" id="trWake">Wake me up</button><span class="tr-hint">Esc or Space wakes you any time</span></div>`;
  document.body.append(o);
  o.querySelector('#trWake').addEventListener('click', () => endTrance('woke'));
  return o;
}
document.addEventListener('keydown', e => { if (TR && !TR.ending && (e.key === 'Escape' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); endTrance('woke'); } }, true);
async function startTrance(){
  if (TR) return false;
  if (!TN.cur) { await makeTonight(); if (!TN.cur) return false; }
  const c = TN.cur, o = tranceOverlay();
  const me = TR = { stop: false, ending: false, timers: [], t0: Date.now(), phraseT: null, tick: null };
  loadTonight(); syncOn = false; renderSync();       // the trance screen is the visuals; the side window stays shut
  o.querySelector('.tr-nova').src = exprSrc('sultry'); o.querySelector('.tr-nova').onerror = function(){ this.src = NOVA_FACE; this.onerror = null; };
  o.hidden = false; document.body.classList.add('trancing'); toggleChat(false);
  try { o.requestFullscreen && o.requestFullscreen().catch(() => {}); } catch (e) {}
  let pi = 0; const ph = $('#trPhrase');
  TR.phraseT = setInterval(() => { if (!c.phrases.length) return; ph.textContent = c.phrases[pi++ % c.phrases.length]; ph.classList.remove('in'); void ph.offsetWidth; ph.classList.add('in'); }, 7000);
  TR.tick = setInterval(() => { const s = Math.round((Date.now() - me.t0) / 1000); $('#trTime').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' / ' + c.minutes + ':00'; }, 1000);
  OMNI.set({ session: c.minutes });
  OMNI.play().catch(() => {});
  for (const s of c.script.induction) { if (me.stop) return true; await speakQ(s); await wait(2200); }
  for (const s of c.script.deepener) { if (me.stop) return true; await speakQ(s, 0.8); await wait(3200); }
  // through the session: one affirmation every ~45 s, in "you", until the track ends
  const all = [...c.lines.foundation, ...c.lines.current, ...c.lines.surface].filter(Boolean); let ai = 0;
  const end = me.t0 + c.minutes * 60000;
  while (!me.stop && Date.now() < end - 40000) {
    await wait(42000 + Math.random() * 8000); if (me.stop) return true;
    if (all.length) await speakQ(asYou(all[ai++ % all.length]), 0.82);
  }
  if (!me.stop) await endTrance('done');
  return true;
}
async function endTrance(how){
  if (!TR || TR.ending) return; const me = TR; me.ending = true; me.stop = true;
  me.timers.forEach(clearTimeout); clearInterval(me.phraseT); clearInterval(me.tick);
  try { speechSynthesis.cancel(); } catch (e) {}
  const c = TN.cur, mins = (Date.now() - me.t0) / 60000;
  const wake = (c && c.script.wake.length) ? c.script.wake : offlineTonight().script.wake;
  for (const s of wake.slice(0, how === 'woke' ? 2 : 3)) await speakQ(s, 0.95, true);
  OMNI.stop();
  const o = $('#trance'); if (o) o.hidden = true; document.body.classList.remove('trancing');
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  TR = null;
  if (mins >= 5) award(30, 'trance with ' + (BD.name || 'Nova'));
  toggleChat(true); openTonightTab();
  bubble('ai', mins >= 5 ? `Welcome back, gorgeous 💖 How was “${c ? c.name : 'that'}”? Tap 💖 More like this or 🙅 Less like this so I get it even righter next time.` : `Okay, you're back. We can go again whenever you want 💕`);
}

/* ---------- the Tonight tab ---------- */
function openTonightTab(){ const b = chatwin.querySelector('[data-cw="tonight"]'); if (b) b.click(); }
function renderTonight(){
  const box = $('#tn-card'); if (!box) return;
  const S = TN.streak, L = tnLevel(S.xp || 0), c = TN.cur, today = ready();
  $('#tn-streak').innerHTML = `<b>🔥 ${S.last === dayKey() || S.last === yesterdayKey() ? S.n || 0 : 0}</b><span>night streak · best ${S.best || 0}</span><span class="tn-lv">Lv ${L.lv} ${esc(L.title)}</span><span class="tn-bar"><i style="width:${Math.max(3, Math.min(100, L.pct))}%"></i></span><small>${S.xp || 0} XP · ${L.next} to next level</small>`;
  if (tnBusy) box.innerHTML = `<p class="tn-name">${esc(BD.name || 'Nova')} is making tonight's sub…</p><p class="hint">Reading your brain, picking a look, writing lines and her trance script.</p>`;
  else if (!c) box.innerHTML = `<p class="tn-name">No sub yet</p><p class="hint">${TN.auto ? `She makes one by herself after ${String(TN.hour).padStart(2, '0')}:00, or press Make one now.` : 'Press Make one now.'}</p>`;
  else box.innerHTML = `<p class="tn-name">${today ? '🌙 ' : ''}${esc(c.name)}</p><p class="hint">${esc(c.why || c.goal)}</p>
    <p class="tn-chips"><span class="tag">${esc(c.look)}</span><span class="tag">${c.minutes} min</span><span class="tag">${c.lines.foundation.length + c.lines.current.length + c.lines.surface.length} lines</span>${c.played ? '<span class="tag">played ✓</span>' : ''}${today ? '' : `<span class="tag">from ${esc(c.date)}</span>`}</p>
    <p class="tn-lines">${[...c.lines.surface].slice(0, 3).map(esc).join('<br>')}</p>`;
  if (tnErr) box.insertAdjacentHTML('beforeend', `<p class="hint">${esc(tnErr)}</p>`);
  const has = !!c && !tnBusy;
  ['#tn-play', '#tn-trance', '#tn-load', '#tn-like', '#tn-dislike'].forEach(s => { const b = $(s); if (b) b.disabled = !has; });
  $('#tn-make').textContent = tnBusy ? 'Making…' : c ? '🎲 Make another' : '✨ Make one now'; $('#tn-make').disabled = tnBusy;
  $('#tn-like').setAttribute('aria-pressed', String(!!c && c.rating > 0)); $('#tn-dislike').setAttribute('aria-pressed', String(!!c && c.rating < 0));
  $('#tn-auto').setAttribute('aria-checked', String(TN.auto)); $('#tn-hour').value = String(TN.hour);
  $('#tn-hist').innerHTML = TN.hist.length ? TN.hist.slice(0, 10).map(h => `<div class="note"><p>${esc(h.name)}</p><div class="meta"><span class="tag">${esc(h.look)}</span><span>${esc(h.date)}</span><span>${h.played ? 'played' : 'skipped'}${h.rating > 0 ? ' · 💖' : h.rating < 0 ? ' · 🙅' : ''}</span></div></div>`).join('') : '<span class="hint">Past nights show up here.</span>';
}
function wireTonight(){
  if (!$('#cw-tonight')) return;
  $('#tn-hour').innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('');
  $('#tn-play').addEventListener('click', async () => { const ok = await playTonight(); ptoast(ok ? 'Tonight\'s sub is playing. Visuals come along on the side.' : 'Press play on the bar below to start the sound.'); });
  $('#tn-load').addEventListener('click', () => { loadTonight(); ptoast('Tonight\'s sub is in the studio: lines, look, length and visuals.'); });
  $('#tn-trance').addEventListener('click', () => startTrance());
  $('#tn-make').addEventListener('click', async () => { const ok = await makeTonight(); if (ok) ptoast('Fresh one ready: ' + TN.cur.name); });
  $('#tn-like').addEventListener('click', async () => { rateTonight(1); ptoast('Got it, more like this. Making a sister one…'); await makeTonight({ like: TN.cur }); });
  $('#tn-dislike').addEventListener('click', () => { rateTonight(-1); ptoast('Noted. Next one goes a different way.'); });
  $('#tn-auto').addEventListener('click', () => { TN.auto = !TN.auto; tnSave(); renderTonight(); });
  $('#tn-hour').addEventListener('change', e => { TN.hour = Number(e.target.value) || 19; tnSave(); });
}
const TTOOLS = [
  { name: 'make_tonight', description: "Make tonight's subliminal now from what you know about them (lines, look, length, visual phrases and your trance script). like=true makes a variation of the current one.",
    inputSchema: { type: 'object', properties: { like: { type: 'boolean' } } },
    execute: async i => { const ok = await makeTonight({ like: i.like ? TN.cur : null }); return ok ? { made: TN.cur.name, why: TN.cur.why, look: TN.cur.look, minutes: TN.cur.minutes } : (tnErr || 'Could not make it.'); } },
  { name: 'play_tonight', description: "Load tonight's subliminal into the studio and start it.", execute: async () => { if (!TN.cur) return 'No sub yet. Make one first.'; const ok = await playTonight(); return ok ? 'Playing tonight\'s sub.' : 'Loaded. The browser wants the person to press play.'; } },
  { name: 'rate_tonight', description: "Record their verdict on tonight's sub: 1 = more like this, -1 = less like this.", inputSchema: { type: 'object', properties: { rating: { type: 'number', enum: [1, -1] } }, required: ['rating'] },
    execute: i => { rateTonight(i.rating > 0 ? 1 : -1); return 'Noted.'; } },
  { name: 'open_tonight', description: 'Show the Tonight tab (their sub, streak, XP and the 🌀 Trance button). A hands-free trance needs them to press 🌀 Trance with Nova themselves.', execute: () => { openTonightTab(); return 'Showing the Tonight tab.'; } }
];
function tonightState(){ const c = TN.cur; return { ready: ready(), name: c ? c.name : '', why: c ? c.why : '', look: c ? c.look : '', played: !!(c && c.played), streak: (TN.streak.last === dayKey() || TN.streak.last === yesterdayKey()) ? TN.streak.n || 0 : 0, xp: TN.streak.xp || 0, level: tnLevel(TN.streak.xp || 0).lv, title: tnLevel(TN.streak.xp || 0).title }; }
async function tonightBoot(){
  wireTonight(); renderTonight();
  await aiReady.catch(() => {});
  if (TN.auto && isEvening() && !ready() && sampler) makeTonight();
}
// Nova mentions it once a day when you open her
function tonightGreet(){
  if (!ready() || TN.greeted === dayKey()) return;
  TN.greeted = dayKey(); tnSave();
  bubble('ai', `🌙 Tonight's sub is ready: “${TN.cur.name}”. ${TN.cur.why} Open the moon tab to play it, or press 🌀 for a hands-free trance with me.`);
}
