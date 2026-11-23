
/* ---------- the visuals AI: editable instructions + Make AI do it ---------- */
const AI_DEFAULT = `You are the AI inside Subliminal Forge Omni, a personal subliminal audio and visual tool. You set up one visual program for the person.

How you work:
1. Read WHAT IT'S FOR. Treat it as the person's own goal for themselves.
2. Look at the CURRENT PROGRAM and the track's lines so your phrases match the audio.
3. Do only the TASK you are given.
4. In "why", explain your choices in 1 to 3 short, plain sentences, like talking to a friend.

Rules for visuals:
- On-screen phrases are short, 2 to 8 words, present tense, no emoji.
- Never more than 3 changes per second. Soft fades only.
- Flash mode stays faint (opacity 20 to 45).`;
const VTASK = { task: 'Set up the selected visual program: a short program name, 8 to 15 on-screen phrases, how images show (slideshow, cards or flash), timing in seconds ("every" between shows, "stay" for how long each shows), visibility from 10 to 100, position and order.',
  shape: '{"why":"...","name":"...","phrases":["..."],"mode":"slideshow|cards|flash","every":2,"stay":5,"opacity":100,"where":"center|corner|random","order":"ordered|shuffle"}' };
function aiLoad(){ try { const o = JSON.parse(safeGet('omniplus.ai.v1')); if (o && typeof o.ins === 'string') return o; } catch (e) {} return { ins: AI_DEFAULT }; }
let AI = aiLoad(), aiSaveT = null, sampler = null, aiCtl = null, aiBusy = false;
function aiSave(){ clearTimeout(aiSaveT); aiSaveT = setTimeout(() => { try { localStorage.setItem('omniplus.ai.v1', JSON.stringify(AI)); } catch (e) {} }, 300); }
$('#ai-ins').value = AI.ins;
$('#ai-ins').addEventListener('input', e => { AI.ins = e.target.value; aiSave(); });
$('#ai-reset').addEventListener('click', () => { AI.ins = AI_DEFAULT; $('#ai-ins').value = AI_DEFAULT; aiSave(); });
const num = (v, lo, hi, d) => { const n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const oneOf = (v, list, d) => list.includes(v) ? v : d;
const strs = (a, max) => Array.isArray(a) ? a.map(x => String(x).trim()).filter(Boolean).slice(0, max) : null;
function applyVisual(r){
  const p = vcur();
  if (typeof r.name === 'string' && r.name.trim()) p.name = r.name.trim().slice(0, 60);
  const ph = strs(r.phrases, 30); if (ph && ph.length) { p.phrases = ph.join('\n'); p.captions = 'own'; }
  p.mode = oneOf(r.mode, Object.keys(VMODES), p.mode);
  const m = VMODES[p.mode];
  p.every = num(r.every, m.every[0], m.every[1], m.every[3]);
  if (m.stay) p.stay = num(r.stay, m.stay[0], m.stay[1], m.stay[3]);
  p.opacity = Math.round(num(r.opacity, 10, 100, p.opacity) / 5) * 5;
  p.where = oneOf(r.where, ['center', 'corner', 'random'], p.where);
  p.order = oneOf(r.order, ['ordered', 'shuffle'], p.order);
  clampP(p);
}
function aiError(e){
  const c = e && e.code;
  return c === 'not_granted' ? 'Claude was not allowed to run here. You can still edit everything by hand.'
    : c === 'rate_limited' ? 'Too many AI requests right now. Wait a minute, then try again.'
    : c === 'refused' ? 'The AI declined this request. Try describing it differently.'
    : c === 'invalid_json' ? 'The AI answered in the wrong format. Press the button again.'
    : c === 'session_expired' ? 'Your Claude sign-in expired. Sign in again, then retry.'
    : 'Something went wrong reaching the AI. Press the button again.';
}
function setWhy(text, kind){ vWhy[vcur().id] = { text, err: kind === 'err', busy: kind === 'busy' }; renderVEditor(); }
async function runVisualAI(){
  if (aiBusy) { if (aiCtl) aiCtl.abort(); return; }
  if (!sampler) { setWhy('AI is not available in this view.', 'err'); return; }
  const p = vcur(), goal = omniGoal() || 'Feel confident and focused';
  const ctx = { program: { name: p.name, mode: p.mode, every: p.every, stay: p.stay, opacity: p.opacity, where: p.where, order: p.order, images: imgCount(p), phrases: vPhrases(p).slice(0, 15) }, track_lines: omniLines().slice(0, 20), look: omniGet().theme };
  const prompt = `${AI.ins}\n\nWHAT IT'S FOR:\n${goal}\n\nCURRENT PROGRAM:\n${JSON.stringify(ctx, null, 1)}\n\nTASK:\n${VTASK.task}\n\nReply with only one JSON object shaped like this example, with your own values:\n${VTASK.shape}`;
  $('#ai-last-prompt').textContent = prompt; $('#ai-last-reply').textContent = 'Waiting for the reply…';
  aiBusy = true; aiCtl = new AbortController();
  setWhy('Thinking about this program. This can take up to a minute.', 'busy');
  try {
    const r = await sampler.json(prompt, { signal: aiCtl.signal, cache: false, onText: ({ text }) => { $('#ai-last-reply').textContent = text; } });
    if (!r || typeof r !== 'object') throw { code: 'invalid_json' };
    $('#ai-last-reply').textContent = JSON.stringify(r, null, 1);
    applyVisual(r); vsave(); renderVRows();
    setWhy(String(r.why || 'Done.'), 'ok');
  } catch (e) {
    if (e && e.text) $('#ai-last-reply').textContent = e.text;
    setWhy(e && e.code === 'cancelled' ? 'Stopped. Nothing was changed.' : aiError(e), 'err');
  } finally { aiBusy = false; aiCtl = null; }
}
vView.addEventListener('click', e => { if (e.target.closest('[data-vai]')) runVisualAI(); });

/* ---------- Nova: the companion who can run all of Omni ---------- */
const PERSONA_DEFAULT = `You are {name}, a flirty, bubbly companion built into Subliminal Forge Omni, the person's own subliminal studio. You help them make subliminals, keep their ideas, and remember things for them.
- Keep replies short: 1 to 4 sentences, plain words.
- When they ask you to save, remember or note something, save it with save_note.
- To change the track's lines, sound or look, use edit_track and describe the change in plain words. Omni makes it.
- You can run all of Omni: the look, volume, session length, saved tracks, the playlist, WAV saves, the visual programs, Auto mode, the side window and the views. Say plainly what you changed.
- You have a face: call set_expression once per reply with the mood you're in.
- You can't open the file picker for them; tell them to press Choose a folder on the Visuals tab.
- Be honest about what you can and can't do. You only know this chat, the saved notes and the app.`;
const BDEF = { name: 'Nova', persona: PERSONA_DEFAULT, img: '', size: 96, show: true, pos: null };
function bLoad(){ try { const o = JSON.parse(safeGet('omniplus.buddy.v1') || safeGet('forge.buddy.v1')); if (o) return Object.assign({}, BDEF, o); } catch (e) {} return Object.assign({}, BDEF); }
function cLoad(){ try { const o = JSON.parse(safeGet('omniplus.assistant.v1') || safeGet('forge.assistant.v1')); if (o) return Object.assign({ turns: [], notes: [] }, o); } catch (e) {} return { turns: [], notes: [] }; }
let BD = bLoad(); if (BD.persona && BD.persona.startsWith('You are {name}, a flirty, bubbly companion') && !BD.persona.includes('set_expression')) BD.persona = PERSONA_DEFAULT;
let CH = cLoad(), bdT = null, chT = null, cwCtl = null, cwBusy = false, toolsOK = false, noteArm = '';
function bSave(){ clearTimeout(bdT); bdT = setTimeout(() => { try { localStorage.setItem('omniplus.buddy.v1', JSON.stringify(BD)); } catch (e) { $('#cw-status').textContent = 'Image too large to keep. Try a smaller one.'; } }, 300); }
function cSave(){ clearTimeout(chT); chT = setTimeout(() => { try { CH.turns = CH.turns.slice(-40); localStorage.setItem('omniplus.assistant.v1', JSON.stringify(CH)); } catch (e) {} }, 300); }
const buddy = $('#buddy'), chatwin = $('#chatwin');
const NOVA_FACE = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22%3E%0A%3Cdefs%3E%0A%3CradialGradient id=%22bg%22 cx=%2250%25%22 cy=%2240%25%22 r=%2260%25%22%3E%3Cstop offset=%220%22 stop-color=%22%23ff9fd0%22/%3E%3Cstop offset=%221%22 stop-color=%22%23b0306f%22/%3E%3C/radialGradient%3E%0A%3ClinearGradient id=%22hair%22 x1=%220%22 y1=%220%22 x2=%220%22 y2=%221%22%3E%3Cstop offset=%220%22 stop-color=%22%23fff3d6%22/%3E%3Cstop offset=%22.6%22 stop-color=%22%23f6d58f%22/%3E%3Cstop offset=%221%22 stop-color=%22%23ff7ab8%22/%3E%3C/linearGradient%3E%0A%3ClinearGradient id=%22lip%22 x1=%220%22 y1=%220%22 x2=%220%22 y2=%221%22%3E%3Cstop offset=%220%22 stop-color=%22%23ff5fa8%22/%3E%3Cstop offset=%221%22 stop-color=%22%23d81b72%22/%3E%3C/linearGradient%3E%0A%3CclipPath id=%22c%22%3E%3Ccircle cx=%2260%22 cy=%2260%22 r=%2258%22/%3E%3C/clipPath%3E%0A%3C/defs%3E%0A%3Ccircle cx=%2260%22 cy=%2260%22 r=%2258%22 fill=%22url(%23bg)%22/%3E%0A%3Cg clip-path=%22url(%23c)%22%3E%0A%3Cpath d=%22M18 120 C14 70 22 30 60 24 C98 30 106 70 102 120 Z%22 fill=%22url(%23hair)%22/%3E%0A%3Cpath d=%22M30 120 C34 100 46 94 60 94 C74 94 86 100 90 120 Z%22 fill=%22%23a8683f%22/%3E%0A%3Cpath d=%22M30 120 C36 106 48 102 60 102 C72 102 84 106 90 120 Z%22 fill=%22%23ff4fa3%22/%3E%0A%3Crect x=%2252%22 y=%2278%22 width=%2216%22 height=%2220%22 rx=%226%22 fill=%22%23a8683f%22/%3E%0A%3Cellipse cx=%2260%22 cy=%2260%22 rx=%2222%22 ry=%2226%22 fill=%22%23b87648%22/%3E%0A%3Cpath d=%22M36 52 C38 30 82 30 84 52 C78 40 66 36 58 40 C50 44 42 44 36 52 Z%22 fill=%22url(%23hair)%22/%3E%0A%3Cpath d=%22M36 50 C33 64 34 84 30 100 C40 92 40 70 40 56 Z%22 fill=%22url(%23hair)%22/%3E%0A%3Cpath d=%22M84 50 C87 64 86 84 90 100 C80 92 80 70 80 56 Z%22 fill=%22url(%23hair)%22/%3E%0A%3Cg fill=%22%231a0b14%22%3E%3Cellipse cx=%2251%22 cy=%2260%22 rx=%223.6%22 ry=%224.4%22/%3E%3Cellipse cx=%2269%22 cy=%2260%22 rx=%223.6%22 ry=%224.4%22/%3E%3C/g%3E%0A%3Cg fill=%22%23fff%22%3E%3Ccircle cx=%2252.2%22 cy=%2258.6%22 r=%221.2%22/%3E%3Ccircle cx=%2270.2%22 cy=%2258.6%22 r=%221.2%22/%3E%3C/g%3E%0A%3Cg stroke=%22%231a0b14%22 stroke-width=%221.8%22 stroke-linecap=%22round%22 fill=%22none%22%3E%3Cpath d=%22M45 56 Q51 52 56 55%22/%3E%3Cpath d=%22M64 55 Q69 52 75 56%22/%3E%3Cpath d=%22M45 56 l-3 -2.5M47 54.5 l-2 -3M74.5 56 l3 -2.5M73 54.5 l2 -3%22/%3E%3Cpath d=%22M46 50 Q51 47 56 49%22 stroke-width=%221.4%22/%3E%3Cpath d=%22M64 49 Q69 47 74 50%22 stroke-width=%221.4%22/%3E%3C/g%3E%0A%3Cellipse cx=%2247%22 cy=%2268%22 rx=%224%22 ry=%222.4%22 fill=%22%23ff6fae%22 opacity=%22.45%22/%3E%3Cellipse cx=%2273%22 cy=%2268%22 rx=%224%22 ry=%222.4%22 fill=%22%23ff6fae%22 opacity=%22.45%22/%3E%0A%3Cpath d=%22M60 62 q-1.5 5 0.5 6%22 stroke=%22%238a5232%22 stroke-width=%221.2%22 fill=%22none%22 stroke-linecap=%22round%22/%3E%0A%3Cpath d=%22M52 74 Q56 71 60 72.5 Q64 71 68 74 Q64 80 60 80 Q56 80 52 74 Z%22 fill=%22url(%23lip)%22/%3E%0A%3Cpath d=%22M55 75 Q60 76.5 65 75%22 stroke=%22%238c0f48%22 stroke-width=%22.8%22 fill=%22none%22/%3E%0A%3Cellipse cx=%2257%22 cy=%2273.4%22 rx=%222.4%22 ry=%22.8%22 fill=%22%23fff%22 opacity=%22.7%22/%3E%0A%3Cpath d=%22M76 70 c0-1.6 1.6-2.6 2.4-3.6 c.8 1 2.4 2 2.4 3.6 a1.4 1.4 0 0 1-2.1 1.1 l.4 1.6 h-1.4 l.4-1.6 a1.4 1.4 0 0 1-2.1-1.1 z%22 fill=%22%23111%22/%3E%0A%3Ccircle cx=%2238.5%22 cy=%2266%22 r=%222.6%22 fill=%22none%22 stroke=%22%23ffd36b%22 stroke-width=%221.4%22/%3E%0A%3Ccircle cx=%2281.5%22 cy=%2266%22 r=%222.6%22 fill=%22none%22 stroke=%22%23ffd36b%22 stroke-width=%221.4%22/%3E%0A%3C/g%3E%0A%3Ccircle cx=%2260%22 cy=%2260%22 r=%2257%22 fill=%22none%22 stroke=%22%23ffd1e8%22 stroke-width=%222%22/%3E%0A%3C/svg%3E';
const STAR = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M10 2 L11.8 8.2 L18 10 L11.8 11.8 L10 18 L8.2 11.8 L2 10 L8.2 8.2 Z"/></svg>';
/* Nova's moving portrait: Bambi's expression set (copied into nova/), crossfading on a slow hypno spiral */
const NOVA_EXPR = ['idle','happy','thinking','giggle','wink','pose-waving','sultry','teasing','surprised','blush','laughing','kiss','smug','loving','excited','sleepy','pout','shy','mischievous','proud'];
const EXPR_IDLE = ['idle','happy','smug','teasing','wink','sultry','loving','idle'], EXPR_TALK = ['happy','giggle','teasing','laughing','wink','excited'];
const exprSrc = n => BD.img || ('nova/' + (NOVA_EXPR.includes(n) ? n : 'idle') + '.webp');
const novaStage = document.createElement('div'); novaStage.className = 'nova-stage'; novaStage.id = 'novaStage';
novaStage.innerHTML = '<div class="nv-spiral" aria-hidden="true"></div><div class="nv-ring" aria-hidden="true"></div><div class="nv-body"><img class="nv-img on" alt=""><img class="nv-img" alt=""></div><span class="nv-say" id="nvSay" aria-hidden="true"></span>';
chatwin.querySelector('.cw-h').after(novaStage);
const nvImgs = [...novaStage.querySelectorAll('.nv-img')]; let nvFlip = 0, nvExpr = 'idle', nvMode = 'idle', nvT = 0, nvFinal = '';
nvImgs.forEach(im => im.addEventListener('error', () => { if (!im.dataset.fb) { im.dataset.fb = 1; im.src = NOVA_FACE; } }));
function setExpr(n){
  nvExpr = NOVA_EXPR.includes(n) ? n : 'idle';
  const src = exprSrc(nvExpr), next = nvImgs[(nvFlip + 1) % 2], cur = nvImgs[nvFlip % 2];
  if (cur.getAttribute('src') === src) return;
  next.dataset.fb = ''; next.src = src; nvFlip++;
  const swap = () => { next.classList.add('on'); cur.classList.remove('on'); };
  if (next.complete) swap(); else next.onload = swap;
  const bi = $('#buddy-ph img'); if (bi && !BD.img) bi.src = src;
}
function novaMode(m){
  nvMode = m; clearTimeout(nvT); novaStage.dataset.mode = m;
  if (m === 'thinking') { setExpr('thinking'); return; }
  if (m === 'talking') { let i = 0; const step = () => { setExpr(EXPR_TALK[i++ % EXPR_TALK.length]); nvT = setTimeout(step, 900 + Math.random() * 500); }; step(); return; }
  setExpr(nvFinal || 'happy'); nvFinal = '';
  const idle = () => { setExpr(EXPR_IDLE[Math.floor(Math.random() * EXPR_IDLE.length)]); nvT = setTimeout(idle, 5000 + Math.random() * 4000); };
  nvT = setTimeout(idle, 4000);
}
// her replies, out loud (optional)
let novaVoice = safeGet('omniplus.novavoice') === '1';
function sayAloud(text){
  if (!novaVoice || !hasSpeech || !text) return false;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.slice(0, 600)); const vs = speechSynthesis.getVoices(); u.voice = vs.find(v => /female|samantha|zira|aria|jenny|ava|google uk english female/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null; u.pitch = 1.25; u.rate = 1.02; u.onstart = () => novaMode('talking'); u.onend = u.onerror = () => novaMode('idle'); speechSynthesis.speak(u); return true; } catch (e) { return false; }
}
function renderBuddy(){
  buddy.hidden = !BD.show;
  buddy.style.setProperty('--bsize', BD.size + 'px');
  $('#buddy-img').hidden = !BD.img; if (BD.img) $('#buddy-img').src = BD.img;
  $('#buddy-ph').hidden = !!BD.img; $('#buddy-ph').classList.add('nova'); $('#buddy-ph').innerHTML = `<img src="${exprSrc(nvExpr)}" alt="">`; { const bi = $('#buddy-ph img'); bi.addEventListener('error', () => { if (bi.src !== NOVA_FACE) bi.src = NOVA_FACE; }, { once: true }); }
  nvImgs.forEach(im => { if (im.classList.contains('on')) { im.dataset.fb = ''; im.src = exprSrc(nvExpr); } });
  $('#buddy-name').textContent = BD.name; $('#cw-name').textContent = BD.name;
  buddy.setAttribute('aria-label', 'Open ' + BD.name);
  $('#cw-av').innerHTML = `<img class="nova face" src="${BD.img || 'nova/idle.webp'}" alt="">`;
  placeBuddy();
}
function placeBuddy(){
  if (!BD.pos) { buddy.style.left = buddy.style.top = buddy.style.right = buddy.style.bottom = ''; return; }
  const w = BD.size, x = Math.min(innerWidth - w - 8, Math.max(8, BD.pos.x)), y = Math.min(innerHeight - w - 90, Math.max(8, BD.pos.y));
  buddy.style.right = 'auto'; buddy.style.bottom = 'auto'; buddy.style.left = x + 'px'; buddy.style.top = y + 'px';
}
let drag = null;
buddy.addEventListener('pointerdown', e => { drag = { sx: e.clientX, sy: e.clientY, moved: false, r: buddy.getBoundingClientRect() }; buddy.setPointerCapture(e.pointerId); });
buddy.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true; BD.pos = { x: drag.r.left + dx, y: drag.r.top + dy }; placeBuddy();
});
buddy.addEventListener('pointerup', () => { if (!drag) return; const moved = drag.moved; drag = null; if (moved) { bSave(); return; } toggleChat(); });
buddy.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleChat(); } });
addEventListener('resize', placeBuddy);
function toggleChat(open){
  const show = open ?? chatwin.hidden;
  chatwin.hidden = !show; buddy.setAttribute('aria-expanded', show); buddy.classList.toggle('away', show); document.body.classList.toggle('nova-open', show);
  if (show) novaMode(nvMode === 'idle' ? 'idle' : nvMode);
  if (show) { renderChat(); setTimeout(() => $('#cw-input').focus(), 30); }
}
$('#cw-close').addEventListener('click', () => { toggleChat(false); buddy.focus(); });
novaStage.addEventListener('click', () => { if (nvMode === 'idle') setExpr(['giggle','blush','wink','kiss','shy','pose-waving'][Math.floor(Math.random() * 6)]); });
chatwin.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); toggleChat(false); buddy.focus(); } });
chatwin.querySelectorAll('[data-cw]').forEach(b => b.addEventListener('click', () => {
  chatwin.querySelectorAll('[data-cw]').forEach(x => x.setAttribute('aria-pressed', x === b));
  ['chat', 'notes', 'setup'].forEach(v => $('#cw-' + v).hidden = v !== b.dataset.cw);
  if (b.dataset.cw === 'notes') renderNotes();
  if (b.dataset.cw === 'setup') renderSetup();
}));
function bubble(role, text){ const d = document.createElement('div'); d.className = 'msg ' + role; d.textContent = text; $('#cw-log').appendChild(d); $('#cw-log').scrollTop = 1e9; return d; }
function renderChat(){
  $('#cw-log').innerHTML = '';
  if (!CH.turns.length) bubble('ai', `Hiii, I'm ${BD.name} 💖 I run this whole studio: lines, sound, looks, packs, saved tracks, the playlist and your visuals. Tell me what you want and I'll do it. What are we making?`);
  CH.turns.forEach(t => bubble(t.role === 'user' ? 'me' : 'ai', t.content));
}
function appState(){
  const c = omniGet(); let st = {}; try { st = OMNI.status(); } catch (e) {}
  return { what_its_for: c.goal || '', look: c.theme, playing: !!st.playing, view: inVisuals ? 'visuals' : st.view,
    lines: c.lines, delivery: c.delivery, session_minutes: c.session, sound: c.sound,
    saved_tracks: (OMNI.saves() || []).slice(0, 20), playlist: OMNI.playlist() || [],
    visual_programs: V.programs.map(p => ({ name: p.name, on: p.on, images: imgCount(p), mode: p.mode })), visuals_playing: vPlaying, visuals_auto: !!V.auto };
}
function addNote(text, tag){ const n = { id: uid('n'), text: text.trim(), tag: (tag || '').trim().slice(0, 20), at: Date.now() }; CH.notes.unshift(n); cSave(); renderNotes(); flashDot(); return n; }
function flashDot(){ $('#buddy-dot').hidden = false; setTimeout(() => { $('#buddy-dot').hidden = true; }, 2500); }
function addLines(layer, add){
  const c = omniGet(), cur = ((c.lines || {})[layer] || []).filter(x => x && String(x.t || '').trim());
  OMNI.set({ lines: { [layer]: cur.concat(add.map(t => ({ t, f: '' }))) } });
}
const CTOOLS = [
  { name: 'save_note', description: 'Save something for the person so it is kept for later. Returns the new note id.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, tag: { type: 'string', description: 'One short word such as idea, todo, reminder or line.' } }, required: ['text'] },
    execute: i => { const n = addNote(String(i.text || ''), i.tag ? String(i.tag) : ''); return { saved: true, id: n.id }; } },
  { name: 'list_notes', description: 'List everything saved so far, newest first, with id, text, tag and date.',
    execute: () => CH.notes.slice(0, 60).map(n => ({ id: n.id, text: n.text, tag: n.tag, date: new Date(n.at).toLocaleString() })) },
  { name: 'delete_note', description: 'Delete one saved note by its id. Only when the person asks you to.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    execute: i => { const before = CH.notes.length; CH.notes = CH.notes.filter(n => n.id !== String(i.id)); cSave(); renderNotes(); if (CH.notes.length === before) throw new Error('No note with that id'); return { deleted: true }; } },
  { name: 'get_app_state', description: 'Read Omni right now: what the track is for, its lines per layer, how each layer plays, sound settings, saved tracks, the playlist and the visual programs.',
    execute: () => appState() },
  { name: 'edit_track', description: 'Ask Omni to change the track: rewrite or add lines, change the sound, the brainwaves, the session length or the look. Describe the change in plain words. Returns what Omni said and what changed.',
    inputSchema: { type: 'object', properties: { request: { type: 'string' } }, required: ['request'] },
    execute: async i => { const r = await OMNI.message(String(i.request || '')); return r || { error: 'Omni\'s AI is not connected here.' }; } },
  { name: 'add_lines', description: 'Add lines to one layer exactly as written. Layers: foundation (when this happens, I do this), current (why I care), surface (who I am becoming).',
    inputSchema: { type: 'object', properties: { layer: { type: 'string', enum: LAYER_IDS }, lines: { type: 'array', items: { type: 'string' } } }, required: ['layer', 'lines'] },
    execute: i => { const L = String(i.layer); if (!LAYER_IDS.includes(L)) throw new Error('Unknown layer'); const add = strs(i.lines, 12) || []; addLines(L, add); return { added: add.length, layer: L }; } },
  { name: 'play_audio', description: 'Start the audio session.', execute: async () => (await OMNI.play()) ? 'Playing now.' : 'The browser blocked starting sound. Ask the person to press play.' },
  { name: 'stop_audio', description: 'Stop the audio session.', execute: () => { OMNI.stop(); return 'Stopped.'; } },
  { name: 'play_visuals', description: 'Start the selected visual program (images and phrases) on the Visuals view.',
    inputSchema: { type: 'object', properties: { side: { type: 'boolean', description: 'true plays them in the small window on the side, so the person can keep using the other views' } } },
    execute: i => { if (i && i.side) setDock(true); else showVisuals(true); if (!vPlaying) playV(false); return vPlaying ? 'Visuals playing' + (i && i.side ? ' on the side.' : '.') : 'This program has no images or phrases yet.'; } },
  { name: 'apply_pack', description: 'Load a one-click pack: the look, its starter lines, its sound and a matching visual program. Packs: feminine, bimbo, bimboMax (the detailed bimbo set at max strength), trance, submission. It replaces the current lines, so only when the person asks.',
    inputSchema: { type: 'object', properties: { pack: { type: 'string', enum: ['feminine', 'bimbo', 'bimboMax', 'trance', 'submission'] } }, required: ['pack'] },
    execute: i => { applyPack(String(i.pack)); return 'Pack loaded. Press play to start.'; } },

  { name: 'set_expression', description: 'Change your own face in your portrait to match the mood of your reply. Use it once per reply, before you answer.',
    inputSchema: { type: 'object', properties: { expression: { type: 'string', enum: NOVA_EXPR } }, required: ['expression'] },
    execute: i => { nvFinal = String(i.expression); setExpr(nvFinal); return 'Face set.'; } },
  { name: 'set_look', description: 'Change Omni\'s look: studio, feminine, bimbo, trance or submission. Lines the person wrote stay; starter lines swap only if they never edited them.',
    inputSchema: { type: 'object', properties: { look: { type: 'string', enum: ['studio', 'feminine', 'bimbo', 'trance', 'submission'] } }, required: ['look'] },
    execute: i => { const b = $(`#themeSeg [data-theme="${i.look}"]`); if (b) b.click(); return 'Look is now ' + i.look + '.'; } },
  { name: 'set_volume', description: 'Set the main volume, 0 to 100.', inputSchema: { type: 'object', properties: { volume: { type: 'number' } }, required: ['volume'] },
    execute: i => { const v = Math.round(num(i.volume, 0, 100, 80)); OMNI.set({ sound: { mix: { master: v } } }); return 'Volume ' + v + '%.'; } },
  { name: 'set_session_length', description: 'Set how long a session plays, in minutes (5 to 180).', inputSchema: { type: 'object', properties: { minutes: { type: 'number' } }, required: ['minutes'] },
    execute: i => { const m = Math.round(num(i.minutes, 5, 180, 20)); OMNI.set({ session: m }); return 'Sessions are ' + (omniGet().session || m) + ' minutes.'; } },
  { name: 'save_track', description: 'Save the current lines and sound as a new saved track, named after what it is for.', execute: () => { const b = $('#saveNewBtn'); if (b) b.click(); return { saved: true, tracks: OMNI.saves() }; } },
  { name: 'play_playlist', description: 'Play or stop the saved playlist.', execute: () => { const b = $('#plPlay'); if (b) b.click(); return 'Toggled the playlist.'; } },
  { name: 'save_wav', description: 'Save the current track as a WAV file. The person confirms the download.', execute: () => { const b = $('#exportBtn'); if (b) b.click(); return 'Started the WAV save. The person confirms the download.'; } },
  { name: 'pick_visual_program', description: 'Select a visual program by name (see get_app_state).', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    execute: i => { const q = String(i.name).toLowerCase(), p = V.programs.find(x => x.name.toLowerCase() === q) || V.programs.find(x => x.name.toLowerCase().includes(q)); if (!p) throw new Error('No program called ' + i.name); if (vPlaying) stopV(); V.selected = p.id; vsave(); renderVisual(); return 'Selected ' + p.name + '.'; } },
  { name: 'set_visual_program', description: 'Change the selected visual program. Any of: name, mode (slideshow, cards, flash), every (seconds between), stay (seconds shown), opacity (10-100), where (center, corner, random), order (ordered, shuffle), phrases (list of short on-screen phrases).',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, mode: { type: 'string', enum: ['slideshow', 'cards', 'flash'] }, every: { type: 'number' }, stay: { type: 'number' }, opacity: { type: 'number' }, where: { type: 'string', enum: ['center', 'corner', 'random'] }, order: { type: 'string', enum: ['ordered', 'shuffle'] }, phrases: { type: 'array', items: { type: 'string' } } } },
    execute: i => { const p = vcur(); if (i.mode && i.mode !== p.mode) { p.mode = oneOf(i.mode, Object.keys(VMODES), p.mode); const m = VMODES[p.mode]; p.every = m.every[3]; if (m.stay) p.stay = m.stay[3]; } applyVisual(Object.assign({ mode: p.mode, every: p.every, stay: p.stay, opacity: p.opacity, where: p.where, order: p.order }, i)); vsave(); renderVisual(); if (vPlaying) { vQueue = buildQueue(p); vQi = 0; } return { program: p.name, mode: p.mode, every: p.every, opacity: p.opacity }; } },
  { name: 'make_visuals_with_ai', description: 'Have the visuals AI set up the selected program from what the track is for.', execute: async () => { await runVisualAI(); return vWhy[vcur().id] || 'Done.'; } },
  { name: 'set_auto_mode', description: 'Turn Auto mode on or off: visual programs run on their schedules while the page is open.', inputSchema: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    execute: i => { if (!!V.auto !== !!i.on) $('#v-auto').click(); return 'Auto mode ' + (V.auto ? 'on.' : 'off.'); } },
  { name: 'set_play_with_audio', description: 'Turn on or off: visuals start and stop with the audio.', inputSchema: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    execute: i => { if (syncOn !== !!i.on) $('#v-sync').click(); return 'Play with the audio ' + (syncOn ? 'on.' : 'off.'); } },
  { name: 'visuals_side_window', description: 'Show or hide the small side window where the visuals keep playing.', inputSchema: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    execute: i => { setDock(!!i.on); if (i.on && !vPlaying) playV(false); return i.on ? 'Visuals on the side.' : 'Side window closed.'; } },
  { name: 'max_strength', description: 'Turn the current track up to max strength: every layer silent, 20 stacked copies, reversed copies on. The lines stay.', execute: () => { const n = maxStrength(); return 'Max strength on' + (n ? ', about ' + n + ' affirmations a minute.' : '.'); } },
  { name: 'stop_visuals', description: 'Stop the visuals.', execute: () => { stopV(); setDock(false); renderVRows(); return 'Visuals stopped.'; } },
  { name: 'switch_view', description: 'Show one view: lines, playlist, map or visuals.',
    inputSchema: { type: 'object', properties: { view: { type: 'string', enum: ['lines', 'playlist', 'map', 'visuals'] } }, required: ['view'] },
    execute: i => { const v = String(i.view); if (v === 'visuals') showVisuals(true); else { const b = viewSeg.querySelector(`[data-view="${v}"]`); if (b) b.click(); } return 'Showing ' + v + '.'; } }
];
function personaText(){ return (BD.persona || PERSONA_DEFAULT).split('{name}').join(BD.name || 'Nova'); }
async function sendChat(text){
  if (!sampler) { bubble('sys', 'AI is not available in this view.'); return; }
  CH.turns.push({ role: 'user', content: text }); cSave(); bubble('me', text);
  const recent = CH.turns.slice(-16);
  const head = personaText() + '\n\nAPP RIGHT NOW:\n' + JSON.stringify(appState()) + '\n\nSAVED NOTES (' + CH.notes.length + '):\n' + CH.notes.slice(0, 15).map(n => '- [' + n.id + '] ' + n.text).join('\n')
    + (toolsOK ? '' : '\n\nYou cannot run tools here. Reply with only JSON: {"reply":"what you say","expression":"one of: ' + NOVA_EXPR.join(', ') + '","save":["notes to save, if any"],"edit":"a plain-words change for Omni to make to the track, or empty"}');
  const input = [{ role: 'user', content: head }, ...recent];
  const out = bubble('ai', 'Thinking…');
  cwBusy = true; cwCtl = new AbortController(); $('#cw-send').textContent = 'Stop'; $('#cw-status').textContent = 'Thinking…'; novaMode('thinking'); let talked = false;
  try {
    let reply;
    if (toolsOK) {
      const r = await sampler(input, { tools: CTOOLS, signal: cwCtl.signal, onText: ({ text }) => { if (!talked && text && text !== 'Thinking...') { talked = true; novaMode('talking'); } out.textContent = text; $('#cw-log').scrollTop = 1e9; } });
      reply = r.text;
    } else {
      const r = await sampler.json(input, { signal: cwCtl.signal, cache: false });
      reply = String((r && r.reply) || 'Done.'); if (r && r.expression) nvFinal = String(r.expression);
      (Array.isArray(r && r.save) ? r.save : []).forEach(s => { if (String(s).trim()) addNote(String(s), ''); });
      if (r && typeof r.edit === 'string' && r.edit.trim()) { const m = await OMNI.message(r.edit.trim()); if (m && m.say) reply += '\n\n' + m.say; }
    }
    out.textContent = reply; CH.turns.push({ role: 'assistant', content: reply }); cSave();
    $('#nvSay').textContent = reply.length > 90 ? reply.slice(0, 88) + '…' : reply; if (!sayAloud(reply)) { novaMode('talking'); setTimeout(() => { if (nvMode === 'talking') novaMode('idle'); }, Math.min(6000, 1200 + reply.length * 35)); }
  } catch (e) {
    if (e && e.code === 'cancelled') out.textContent = e.text || 'Stopped.';
    else { out.className = 'msg sys'; out.textContent = aiError(e); CH.turns.pop(); cSave(); }
  } finally { cwBusy = false; cwCtl = null; $('#cw-send').textContent = 'Send'; $('#cw-status').textContent = 'Ready'; if (nvMode === 'thinking') novaMode('idle'); }
}
$('#cw-form').addEventListener('submit', e => {
  e.preventDefault();
  if (cwBusy) { if (cwCtl) cwCtl.abort(); return; }
  const v = $('#cw-input').value.trim(); if (!v) return;
  $('#cw-input').value = ''; sendChat(v);
});
$('#cw-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#cw-form').requestSubmit(); } });
function renderNotes(){
  const el = $('#note-list'); if (!el) return;
  el.innerHTML = CH.notes.length ? CH.notes.map(n => `<div class="note"><p>${esc(n.text)}</p><div class="meta">${n.tag ? `<span class="tag">${esc(n.tag)}</span>` : ''}<span>${new Date(n.at).toLocaleDateString()}</span>
    <button class="mini" data-nline="${n.id}">Add to lines</button><button class="mini${noteArm === n.id ? ' warn' : ''}" data-ndel="${n.id}">${noteArm === n.id ? 'Sure?' : 'Delete'}</button></div></div>`).join('')
    : `<span class="hint">Nothing saved yet. Type above, or tell ${esc(BD.name)} "save this".</span>`;
}
$('#note-form').addEventListener('submit', e => { e.preventDefault(); const v = $('#note-new').value.trim(); if (!v) return; addNote(v, ''); $('#note-new').value = ''; });
$('#note-list').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ndel) { if (noteArm !== b.dataset.ndel) { noteArm = b.dataset.ndel; renderNotes(); return; } CH.notes = CH.notes.filter(n => n.id !== b.dataset.ndel); noteArm = ''; cSave(); renderNotes(); }
  else if (b.dataset.nline) { const n = CH.notes.find(x => x.id === b.dataset.nline); if (n) { addLines('surface', [n.text]); b.textContent = 'Added to Surface'; b.disabled = true; } }
});
function renderSetup(){
  $('#bd-name').value = BD.name; $('#bd-size').value = BD.size; $('#bd-size-out').textContent = BD.size + ' px';
  $('#bd-show').setAttribute('aria-checked', !!BD.show); $('#bd-persona').value = BD.persona;
}
$('#bd-file').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => { const m = 320, k = Math.min(1, m / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); BD.img = c.toDataURL('image/png'); URL.revokeObjectURL(url); bSave(); renderBuddy(); };
  img.onerror = () => { $('#cw-status').textContent = 'That image could not be read.'; URL.revokeObjectURL(url); };
  img.src = url; e.target.value = '';
});
$('#bd-clear').addEventListener('click', () => { BD.img = ''; bSave(); renderBuddy(); });
$('#bd-name').addEventListener('input', e => { BD.name = e.target.value.slice(0, 30) || 'Nova'; bSave(); renderBuddy(); });
$('#bd-size').addEventListener('input', e => { BD.size = +e.target.value; $('#bd-size-out').textContent = BD.size + ' px'; bSave(); renderBuddy(); });
$('#bd-show').addEventListener('click', () => { BD.show = !BD.show; $('#bd-show').setAttribute('aria-checked', BD.show); bSave(); renderBuddy(); });
$('#bd-persona').addEventListener('input', e => { BD.persona = e.target.value; bSave(); });
{ const sw = document.createElement('button'); sw.className = 'switch'; sw.setAttribute('role', 'switch'); sw.id = 'bd-voice'; sw.innerHTML = '<span class="track"></span><span>Read her replies out loud<br><span class="hint">Uses your computer voice</span></span>'; sw.setAttribute('aria-checked', String(novaVoice)); $('#bd-show').after(sw);
  sw.addEventListener('click', () => { novaVoice = !novaVoice; sw.setAttribute('aria-checked', String(novaVoice)); try { localStorage.setItem('omniplus.novavoice', novaVoice ? '1' : '0'); } catch (e) {} if (!novaVoice && hasSpeech) speechSynthesis.cancel(); }); }
$('#bd-reset').addEventListener('click', () => { BD.persona = PERSONA_DEFAULT; $('#bd-persona').value = BD.persona; bSave(); });
let clearArm = false;
$('#bd-clearchat').addEventListener('click', e => { if (!clearArm) { clearArm = true; e.target.textContent = 'Tap again to clear the chat'; return; } clearArm = false; CH.turns = []; cSave(); e.target.textContent = 'Chat cleared'; renderChat(); });


/* ---------- on the side, and popped out: keep flashing while you work ---------- */
function ptoast(msg){ document.querySelectorAll('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 4000); }
const stage = $('#vstage'), slot = $('#vslot');
const dock = document.createElement('div'); dock.className = 'fx'; dock.id = 'vDock'; dock.hidden = true; document.body.append(dock);
const DOCKW = [260, 340, 460]; let dockI = +(safeGet('omniplus.dockw') || 1) % 3, docked = false;
function setDock(on){
  docked = on; dock.hidden = !on;
  if (on) { dock.style.setProperty('--dockw', DOCKW[dockI] + 'px'); dock.append(stage); } else slot.append(stage);
  $('#v-side').setAttribute('aria-pressed', String(on)); $('#v-side').textContent = on ? 'On the side ✓' : 'On the side';
}
$('#v-side').addEventListener('click', () => { if (docked) { setDock(false); return; } setDock(true); if (!vPlaying) playV(false); });
$('#vd-back').addEventListener('click', () => setDock(false));
$('#vd-stop').addEventListener('click', () => { stopV(); renderVRows(); setDock(false); });
$('#vd-size').addEventListener('click', () => { dockI = (dockI + 1) % 3; try { localStorage.setItem('omniplus.dockw', dockI); } catch (e) {} dock.style.setProperty('--dockw', DOCKW[dockI] + 'px'); });

// Pop out: a window that floats over your other apps. Document picture-in-picture where the browser allows it,
// else a picture-in-picture video drawn from the stage, else the side window.
let pipWin = null, pipVid = null, pipRaf = 0;
function fitDraw(g, img, x, y, w, h){ const k = Math.min(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * k, dh = img.naturalHeight * k; g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
function drawPip(cv){
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.globalAlpha = 1; g.fillStyle = '#07060A'; g.fillRect(0, 0, W, H);
  for (const L of vLayers) {
    const a = parseFloat(getComputedStyle(L).opacity) || 0; if (a <= 0.01) continue;
    g.globalAlpha = a; const img = L.querySelector('img'), cap = L.querySelector('.vcap'), full = L.classList.contains('full');
    const box = full ? [0, 0, W, H] : [W * 0.2, H * 0.12, W * 0.6, H * 0.6];
    if (img && !img.hidden && img.complete && img.naturalWidth) fitDraw(g, img, ...box);
    const text = cap && !cap.hidden ? cap.textContent : '';
    if (text) { const fs = Math.round(H * 0.075); g.font = `${fs}px 'Young Serif', Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = Math.max(3, fs / 7); g.strokeStyle = 'rgba(0,0,0,.85)'; const ty = full ? H * 0.86 : box[1] + box[3] + fs; g.strokeText(text, W / 2, ty, W * 0.92); g.fillStyle = '#fff'; g.fillText(text, W / 2, ty, W * 0.92); }
  }
}
async function popOut(){
  if (!vPlaying) playV(false);
  if (!vPlaying) return;
  if (window.documentPictureInPicture && window.self === window.top) {
    try {
      pipWin = await documentPictureInPicture.requestWindow({ width: 420, height: 260 });
      [...document.styleSheets].forEach(ss => { try { const st = document.createElement('style'); st.textContent = [...ss.cssRules].map(r => r.cssText).join('\n'); pipWin.document.head.append(st); } catch (e) {} });
      pipWin.document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || '');
      const wrap = pipWin.document.createElement('div'); wrap.className = 'fx'; wrap.style.cssText = 'position:fixed;inset:0;margin:0';
      pipWin.document.body.style.cssText = 'margin:0;padding:0;background:#07060A'; stage.style.height = '100%'; stage.style.borderRadius = '0';
      wrap.append(stage); pipWin.document.body.append(wrap);
      pipWin.addEventListener('pagehide', () => { stage.style.height = stage.style.borderRadius = ''; (docked ? dock : slot).append(stage); pipWin = null; });
      return;
    } catch (e) {}
  }
  try {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
    pipVid = pipVid || document.createElement('video'); pipVid.muted = true; pipVid.playsInline = true;
    pipVid.srcObject = cv.captureStream(30);
    const loop = () => { drawPip(cv); pipRaf = requestAnimationFrame(loop); }; cancelAnimationFrame(pipRaf); loop();
    // keep drawing while this tab is in the background
    clearInterval(popOut.iv); popOut.iv = setInterval(() => { if (document.hidden) drawPip(cv); }, 50);
    await pipVid.play(); await pipVid.requestPictureInPicture();
    pipVid.onleavepictureinpicture = () => { cancelAnimationFrame(pipRaf); clearInterval(popOut.iv); };
  } catch (e) {
    cancelAnimationFrame(pipRaf); clearInterval(popOut.iv);
    setDock(true); ptoast('This window won\'t let it pop out, so it\'s playing on the side instead. Open the page in its own tab to pop it out.');
  }
}
$('#v-pop').addEventListener('click', popOut);


/* ---------- play with the audio ---------- */
let syncOn = safeGet('omniplus.sync') === '1', syncStarted = false;
function renderSync(){ $('#v-sync').setAttribute('aria-checked', String(syncOn)); }
$('#v-sync').addEventListener('click', () => { syncOn = !syncOn; try { localStorage.setItem('omniplus.sync', syncOn ? '1' : '0'); } catch (e) {} renderSync(); });
OMNI.on('play', () => {
  if (!syncOn || vPlaying) return;
  if (!hasContent(vcur())) { ptoast('Play with the audio is on, but this visual program has no images or phrases yet.'); return; }
  if (!inVisuals) setDock(true);
  playV(false); syncStarted = true;
});
OMNI.on('stop', () => { if (!syncStarted) return; syncStarted = false; if (vPlaying) stopV(); if (docked) setDock(false); renderVRows(); });

/* ---------- one-click packs: look + starter lines + sound + a visual program ---------- */
const PACKS = {
  feminine: { label: '♀ Feminine', sub: 'soft cards', prog: { name: '♀ Soft and pretty', mode: 'cards', every: 7, stay: 4, opacity: 90, where: 'center', order: 'shuffle', captions: 'own',
    phrases: ['Soft and pretty', 'I love being girly', 'Graceful in every move', 'My voice is soft', 'Pink suits me', 'I feel so feminine', 'Gentle, pretty, me', 'More feminine every day', 'I glow', 'Pretty is easy for me'] } },
  bimbo: { label: '💋 Bimbo', sub: 'fast and bubbly', prog: { name: '💋 Bubbly bimbo', mode: 'cards', every: 2, stay: 1.6, opacity: 100, where: 'center', order: 'shuffle', captions: 'own',
    phrases: ['Pretty and bubbly', 'Giggles come easy', 'Pink, pretty, perfect', 'I love being a bimbo', 'Glossy and glowing', 'Hot pink thoughts', 'Shiny, cute, confident', 'Bubbly is my vibe', 'So much fun to be me', 'Ditzy and delighted'] } },
  trance: { label: '🌀 Trance', sub: 'slow and deep', prog: { name: '🌀 Deeper', mode: 'cards', every: 9, stay: 5, opacity: 70, where: 'center', order: 'ordered', captions: 'own',
    phrases: ['Relax and drift', 'Deeper and deeper', 'Every breath, deeper', 'Sinking down', 'So calm, so easy', 'Let go', 'Drifting now', 'Safe and sleepy', 'Deeper each time', 'Wake up refreshed'] } },
  submission: { label: '⛓️ Submission', sub: 'faint flashes', prog: { name: '⛓️ Devoted', mode: 'flash', every: 4, stay: 0.3, opacity: 40, where: 'random', order: 'shuffle', captions: 'own',
    phrases: ['Calm and devoted', 'Yes feels good', 'Proud to please', 'Soft and obedient', 'Kneel and breathe', 'Good girl', 'I love to serve', 'Devoted and safe', 'My choice, my joy', 'Peaceful surrender'] } }
};
PACKS.bimboMax = { label: '💋💥 Bimbo Max', sub: 'detailed lines, all silent, max layers', theme: 'bimbo', max: true,
  lines: {"foundation": ["When I wake up, I smile, stretch and think pink, pretty thoughts first.", "When I look in the mirror, I giggle and love the bimbo looking back.", "When I do my makeup, every swipe of gloss makes me softer and happier.", "When I put on heels, I stand tall, sway my hips and feel gorgeous.", "When I pick an outfit, I pick the tightest, pinkest, cutest thing I own.", "When a thought gets too heavy, I let it float away and giggle instead.", "When someone compliments me, I beam, say thank you and soak it up.", "When I catch my reflection, I fix my hair and blow myself a kiss.", "When I feel unsure, I flip my hair, smile wide and feel bubbly again.", "When I talk, my voice goes light, sweet and a little breathy.", "When I get dressed up, I feel like the prettiest girl in the room.", "When I paint my nails, I choose long, glossy and pink.", "When I laugh, I let it be a big, happy giggle.", "When I'm bored, I play with my hair and think about cute outfits.", "When someone flirts with me, I flirt right back and enjoy it.", "When a session ends, I feel lighter, sillier and so pretty."], "current": ["Being bubbly makes me so happy.", "Pretty feels good, so I choose pretty every day.", "I love how light my head feels when I let thoughts go.", "Giggling is my favorite feeling.", "I love being looked at.", "My curves make me feel confident and sexy.", "Pink makes me feel like me.", "Being a bimbo is my choice, and I love it.", "Fun matters more to me than overthinking.", "Glossy lips and long nails make me feel powerful.", "Attention makes me sparkle.", "Being soft and sweet feels natural.", "I love taking care of how I look.", "Every day as a bimbo is a good day."], "surface": ["I am a happy, bubbly bimbo.", "I am pretty, pink and perfect.", "I am a giggly airhead and I love it.", "I am glossy, curvy and confident.", "My head is light and full of pink.", "I am sweet, flirty and fun.", "I love my body exactly as it is.", "I am always dressed cute.", "I am the prettiest version of me.", "I think pretty thoughts.", "I am soft, silly and sparkly.", "My smile is my favorite accessory.", "I am a total bimbo.", "I love being girly.", "Bimbo is who I am.", "I get bubblier every day.", "I am safe, happy and free.", "When I miss a day, I just giggle and start again."]},
  prog: { name: '💋💥 Bimbo Max', mode: 'cards', every: 2, stay: 1.6, opacity: 100, where: 'random', order: 'shuffle', captions: 'own',
    phrases: ["Pretty and bubbly", "Giggles come easy", "Pink, pretty, perfect", "I love being a bimbo", "Glossy and glowing", "Hot pink thoughts", "Light and happy", "Think pink", "Bimbo is me", "Lip gloss on", "Heels and giggles", "So pretty", "Curvy and confident", "Bubbly brain", "Sweet and flirty", "Sparkle", "Giggle", "Airhead and happy", "Soft and silly", "Prettier every day", "Pink thoughts only", "Blow a kiss", "Hair flip", "Good bimbo", "Ditzy and delighted"] } };
// Max strength: every layer silent (high-pitched voices you can't make out), the most stacked copies Omni allows, reversed copies on
const MAX_SOUND = { delivery: { foundation: 'silent', current: 'silent', surface: 'silent' }, sound: { layers: 20, repeat: 3, speed: 2, reverse: true, spread: true, silentHz: 17500, mix: { hidden: 90 } } };
function maxStrength(){ OMNI.set(JSON.parse(JSON.stringify(MAX_SOUND))); try { const st = OMNI.status(); return st.perMinute; } catch (e) { return 0; } }
$('#v-packs').innerHTML = Object.entries(PACKS).map(([k, p]) => `<button class="btn" type="button" data-pack="${k}">${p.label}<small>${p.sub}</small></button>`).join('');
function applyPack(k){
  const pk = PACKS[k]; if (!pk) return;
  const th = pk.theme || k, tb = $(`#themeSeg [data-theme="${th}"]`); if (tb && document.documentElement.getAttribute('data-theme') !== th) tb.click();
  const st = $('#femStarter'); if (st) st.click();
  if (pk.lines) OMNI.set({ lines: Object.fromEntries(Object.entries(pk.lines).map(([l, a]) => [l, a.map(x => ({ t: x, f: '' }))])) });
  if (pk.max) maxStrength();
  stopV();
  let p = V.programs.find(x => x.pack === k);
  if (!p) { p = newProgram(pk.prog.name); p.pack = k; V.programs.push(p); }
  Object.assign(p, JSON.parse(JSON.stringify(pk.prog)), { phrases: pk.prog.phrases.join('\n'), on: true });
  clampP(p); V.selected = p.id; vsave(); renderVisual();
  syncOn = true; try { localStorage.setItem('omniplus.sync', '1'); } catch (e) {} renderSync();
  ptoast(pk.label + ' pack is in: look, starter lines, sound and visuals. Press play and the visuals come along on the side.');
}
$('#v-packs').addEventListener('click', e => { const b = e.target.closest('[data-pack]'); if (b) applyPack(b.dataset.pack); });
{ const mb = document.createElement('button'); mb.className = 'btn'; mb.type = 'button'; mb.id = 'v-max'; mb.innerHTML = '💥 Max strength<small>your lines stay; all layers silent, 20 stacked copies</small>'; mb.style.gridColumn = '1 / -1';
  $('#v-packs').append(mb); mb.addEventListener('click', () => { const n = maxStrength(); ptoast('Max strength: every layer is silent now, 20 stacked copies with reversed ones' + (n ? ', about ' + n + ' affirmations a minute' : '') + '. Your lines stay as they are.'); }); }


/* ---------- keys: V plays or stops the visuals, S puts them on the side, F full screen ---------- */
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'v') { if (vPlaying) { stopV(); renderVRows(); if (docked) setDock(false); } else { if (!inVisuals) setDock(true); playV(false); } }
  else if (k === 's') { if (docked) setDock(false); else { setDock(true); if (!vPlaying) playV(false); } }
  else if (k === 'f' && (inVisuals || docked) && vPlaying) { try { const r = stage.requestFullscreen && stage.requestFullscreen(); r && r.catch && r.catch(() => {}); } catch (err) {} }
});

/* ---------- boot ---------- */
renderBuddy(); renderVisual(); autoStatus(); renderSync();
ptoastSoon = ptoast;
imgStore.loadAll().then(rows => {
  if (!rows || !rows.length) return;
  for (const r of rows) { if (!V.programs.some(p => p.id === r.pid) || !r.file) continue; (vFiles[r.pid] = vFiles[r.pid] || []).push({ file: r.file, path: r.path, folder: r.folder }); }
  renderVisual();
});
if (location.hash === '#visuals') showVisuals(true);
(async () => {
  try { if (window.claude && window.claude.use) sampler = await window.claude.use('sample'); } catch (e) {}
  if (sampler) { try { const lim = await sampler.limits(); toolsOK = !!(lim && lim.tools); } catch (e) {} }
  $('#cw-status').textContent = sampler ? 'Ready' : 'AI is not available in this view';
  $('#ai-avail').textContent = sampler ? 'Ready. Uses your Claude account.' : 'AI is not available in this view.';
})();
window.SubliminalOmniPlus = Object.freeze({ visuals: { play: () => { showVisuals(true); playV(false); return vPlaying; }, stop: () => { stopV(); setDock(false); return vPlaying; }, side: on => { setDock(on !== false); if (!vPlaying) playV(false); return docked; }, programs: () => V.programs.map(p => ({ name: p.name, on: p.on, images: imgCount(p) })) }, nova: { open: () => toggleChat(true), close: () => toggleChat(false) } });
})();
