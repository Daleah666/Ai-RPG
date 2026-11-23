/* ---------- visual programs ---------- */
const DAYN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const VMODES = {
  slideshow:{name:'Slideshow',   desc:'Images flip one after another, like FlipFlip.',      every:[0.4,10,0.1,2],  stay:null},
  cards:    {name:'Cards',       desc:'An image and phrase fade in, stay, then fade out.',  every:[2,120,1,20],    stay:[1,15,0.5,5]},
  flash:    {name:'Quick flash', desc:'A brief, faint pop in a random spot.',               every:[0.4,60,0.1,6],  stay:[0.1,1,0.05,0.3]}
};
const WHERE = [['center','Center'],['corner','Corner'],['random','Random']];
const CAPS = [['none','None'],['script','My audio lines'],['own','My own list']];
const PDEF = {on:true, days:[1,1,1,1,1,1,1], order:'shuffle', mode:'slideshow', every:2, stay:5, opacity:100, where:'center', captions:'script', phrases:'', folders:[],
  schedType:'weekly', dates:[], allDay:true, from:'09:00', to:'22:00', burst:false, onMin:3, offMin:30, random:true, talk:false, talkEvery:120};
function normP(p){ return Object.assign(JSON.parse(JSON.stringify(PDEF)), p); }
function newProgram(name){ return normP({id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), name:name||'New program'}); }
function vload(){
  try{ const o = JSON.parse(safeGet('forge.visual.v1')); if(o && o.programs && o.programs.length){ o.programs = o.programs.map(normP); o.auto = false; return o; } }catch(e){}
  const p = newProgram('My image folder'); return {programs:[p], selected:p.id, auto:false};
}
const pad2 = n => String(n).padStart(2,'0');
const localDate = d => d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
const toMin = s => { const [h,m] = String(s||'0:0').split(':').map(Number); return (h||0)*60 + (m||0); };
const clock = ms => new Date(ms).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let calY = new Date().getFullYear(), calM = new Date().getMonth();
let V = vload(), vSaveT = null, vDelArm = false;
const vWhy = {};
function vsave(){ clearTimeout(vSaveT); vSaveT = setTimeout(()=>{ try{ localStorage.setItem('forge.visual.v1', JSON.stringify(V)); }catch(e){} }, 300); }
const vFiles = {};
const vcur = ()=> V.programs.find(p=>p.id===V.selected) || V.programs[0];
const todayIdx = ()=> (new Date().getDay()+6)%7;
function daySummary(d){
  const n = d.filter(Boolean).length;
  if(n===7) return 'Every day'; if(!n) return 'No days';
  if(n===5 && d.slice(0,5).every(Boolean)) return 'Weekdays';
  if(n===2 && d[5] && d[6]) return 'Weekends';
  return DAYN.filter((x,i)=>d[i]).join(' ');
}
const imgCount = p => (vFiles[p.id]||[]).length;
const secs = v => (v < 1 ? (+v).toFixed(2) : (+v).toFixed(1).replace(/\.0$/,'')) + ' s';
function vPhrases(p){
  if(p.captions==='none') return [];
  if(p.captions==='own') return (p.phrases||'').split('\n').map(s=>s.trim()).filter(Boolean);
  return omniLines();
}
function clampP(p){
  const m = VMODES[p.mode];
  p.every = Math.min(m.every[1], Math.max(m.every[0], p.every));
  if(m.stay) p.stay = Math.min(m.stay[1], Math.max(m.stay[0], p.stay));
}
function schedSummary(p){
  const when = p.schedType==='dates' ? (p.dates.length + (p.dates.length===1 ? ' date' : ' dates')) : daySummary(p.days);
  const time = p.allDay ? '' : ' ' + p.from + '–' + p.to;
  return when + time + (p.burst ? ' · now and then' : '');
}
const minFmt = v => v + ' min';
const talkFmt = v => v < 60 ? v + ' s' : (v/60).toFixed(1).replace(/\.0$/,'') + ' min';
const VFMT = {every:secs, stay:secs, opacity:v=>v+'%', onMin:minFmt, offMin:minFmt, talkEvery:talkFmt};
function swRow(key, on, label, sub){
  return `<button class="switch" role="switch" aria-checked="${!!on}" data-vsw="${key}"><span class="track"></span><span>${label}${sub ? `<br><span class="hint">${sub}</span>` : ''}</span></button>`;
}
function calendarHtml(p){
  const first = new Date(calY, calM, 1), padN = (first.getDay()+6)%7, n = new Date(calY, calM+1, 0).getDate();
  const today = localDate(new Date());
  let cells = '';
  for(let i=0;i<padN;i++) cells += '<span></span>';
  for(let d=1; d<=n; d++){
    const ds = calY + '-' + pad2(calM+1) + '-' + pad2(d);
    cells += `<button class="cal-d" aria-pressed="${p.dates.includes(ds)}" data-vcal="${ds}" aria-label="${MONTHS[calM]} ${d}"${ds===today ? ' data-today="1"' : ''}${ds<today ? ' data-past="1"' : ''}>${d}</button>`;
  }
  const chev = d => `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="${d}"/></svg>`;
  return `<div class="cal">
    <div class="cal-h"><button class="x" data-vcalnav="-1" aria-label="Previous month">${chev('M10 3 L5 8 L10 13')}</button><b>${MONTHS[calM]} ${calY}</b><button class="x" data-vcalnav="1" aria-label="Next month">${chev('M6 3 L11 8 L6 13')}</button></div>
    <div class="cal-g">${DAYN.map(d=>`<span class="cal-w">${d.slice(0,2)}</span>`).join('')}${cells}</div>
    <span class="hint">${p.dates.length} picked. Tap a day to add or remove it.</span>
  </div>`;
}
function sliderRow(key, label, range, val, fmt){
  return `<div class="sl"><label for="v-${key}">${label}</label><input type="range" id="v-${key}" data-vrange="${key}" min="${range[0]}" max="${range[1]}" step="${range[2]}" value="${val}"><output id="v-${key}-out" for="v-${key}">${fmt(val)}</output></div>`;
}
function seg(label, id, items, current, attr){
  return `<span class="label" id="${id}">${label}</span><div class="seg" role="group" aria-labelledby="${id}">${items.map(([k,t])=>`<button aria-pressed="${current===k}" data-${attr}="${k}">${t}</button>`).join('')}</div>`;
}
function renderVRows(){
  const t = todayIdx();
  const td = localDate(new Date());
  const on = V.programs.filter(p=>p.on && (p.schedType==='dates' ? p.dates.includes(td) : p.days[t])).length;
  $('#v-today').textContent = `Today is ${DAYN[t]}. ${on} program${on===1?'':'s'} scheduled today.`;
  $('#v-auto').setAttribute('aria-checked', !!V.auto);
  $('#v-rows').innerHTML = V.programs.map(p=>{
    const n = imgCount(p), saved = p.folders.reduce((a,f)=>a+f.count,0);
    const imgs = n ? n + ' images' : saved ? saved + ' images (pick again)' : 'No images';
    return `<div class="prow" aria-current="${p.id===V.selected}">
      <button class="pick" data-vsel="${p.id}"><b>${esc(p.name)}</b><span>${imgs} · ${VMODES[p.mode].name}${p.talk ? ' · talks' : ''}</span><span>${schedSummary(p)}</span></button>
      <button class="switch" role="switch" aria-checked="${p.on}" data-vtog="${p.id}" aria-label="${p.on?'Turn off':'Turn on'} ${esc(p.name)}"><span class="track"></span></button>
    </div>`;
  }).join('');
}
function renderVEditor(){
  const p = vcur(); clampP(p);
  const m = VMODES[p.mode], n = imgCount(p);
  const stale = p.folders.filter(f=>!(vFiles[p.id]||[]).some(x=>x.folder===f.name));
  const xIcon = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3 L13 13 M13 3 L3 13"/></svg>';
  $('#v-editor').innerHTML = `
    <div class="panel">
      <div class="step-h"><label class="label" for="v-name">Program name</label><button class="btn ai-btn" data-vai="1"><svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 2 L10.6 7.4 L16 9 L10.6 10.6 L9 16 L7.4 10.6 L2 9 L7.4 7.4 Z"/></svg>Make AI do it</button></div>
      <input class="field" id="v-name" value="${esc(p.name)}">
      <span class="hint">The AI sets phrases, style and timing from what your track is for (the first # line on the Lines tab).</span>
      ${vWhy[p.id] ? `<div class="ai-why${vWhy[p.id].err ? ' err' : ''}"><b>${vWhy[p.id].err ? 'Note' : vWhy[p.id].busy ? 'Working' : "AI's view"}</b><span>${esc(vWhy[p.id].text)}</span></div>` : ''}
    </div>
    <div class="panel">
      <b style="font-size:17px">When it runs</b>
      ${seg('Schedule', 'v-sched-l', [['weekly','Every week'],['dates','Pick dates']], p.schedType, 'vsched')}
      ${p.schedType==='weekly'
        ? `<div class="days" role="group" aria-label="Days this program runs">${DAYN.map((d,i)=>`<button aria-pressed="${!!p.days[i]}" data-vday="${i}">${d}</button>`).join('')}</div>`
        : calendarHtml(p)}
      ${swRow('allDay', p.allDay, 'All day')}
      ${p.allDay ? '' : `<div class="times"><label class="hint" for="v-from">From</label><input class="field" type="time" id="v-from" value="${p.from}"><label class="hint" for="v-to">to</label><input class="field" type="time" id="v-to" value="${p.to}"></div>`}
      ${swRow('burst', p.burst, 'Every once in a while', 'Runs for a bit, rests, then comes back')}
      ${p.burst ? `${sliderRow('onMin', 'Runs for', [1,30,1], p.onMin, minFmt)}${sliderRow('offMin', 'Then rests for', [1,180,1], p.offMin, minFmt)}${swRow('random', p.random, 'Mix up the timing', 'Each run and rest is a little shorter or longer')}` : ''}
    </div>
    <div class="panel">
      <b style="font-size:17px">Talk</b>
      ${swRow('talk', p.talk, 'Say a phrase out loud now and then', 'Uses your computer voice')}
      ${p.talk ? sliderRow('talkEvery', 'Talk every', [10,900,10], p.talkEvery, talkFmt) : ''}
    </div>
    <div class="panel">
      <div class="step-h"><b style="font-size:17px">Images</b><span class="hint">${n} loaded</span></div>
      <div class="fchips">${p.folders.length ? p.folders.map(f=>`<span class="fchip">${esc(f.name)} <b>${f.count}</b><button class="x" data-vrm="${esc(f.name)}" aria-label="Remove ${esc(f.name)}">${xIcon}</button></span>`).join('') : '<span class="hint">No images yet.</span>'}</div>
      ${stale.length ? `<span class="hint" style="color:var(--warn)">Pick ${stale.map(f=>esc(f.name)).join(', ')} again to load ${stale.length>1?'them':'it'}. They weren't saved on this computer last time.</span>` : ''}
      <div class="row"><label class="btn primary" for="v-folder">Choose a folder</label><label class="btn" for="v-files">Add single images</label></div>
      <span class="hint">Pick a folder on your G: drive, like the one in FlipFlip. Your browser asks you to confirm. Nothing leaves your computer. Images are remembered here, so you only pick them once.</span>
      ${seg('Order', 'v-order-l', [['ordered','In order'],['shuffle','Shuffle']], p.order, 'vorder')}
    </div>
    <div class="panel">
      ${seg('Show as', 'v-mode-l', Object.entries(VMODES).map(([k,v])=>[k,v.name]), p.mode, 'vmode')}
      <span class="hint">${m.desc}</span>
      ${sliderRow('every', p.mode==='slideshow' ? 'Change every' : 'Show every', m.every, p.every, secs)}
      ${m.stay ? sliderRow('stay', 'Stays for', m.stay, p.stay, secs) : ''}
      ${sliderRow('opacity', 'Visibility', [10,100,5], p.opacity, v=>v+'%')}
      ${p.mode!=='slideshow' ? seg('Where', 'v-where-l', WHERE, p.where, 'vwhere') : ''}
      <ul class="checks"><li>Safety lock: never more than 3 changes per second, soft fades only.</li></ul>
    </div>
    <div class="panel">
      ${seg('Phrases on top', 'v-cap-l', CAPS, p.captions, 'vcap')}
      ${p.captions==='script' ? '<span class="hint">Uses the lines from the Lines tab.</span>' : ''}
      ${p.captions==='own' ? `<label class="sr" for="v-phrases">Phrases, one per line</label><textarea class="field" id="v-phrases" style="height:170px;padding:12px 14px;line-height:1.7;resize:vertical" placeholder="One phrase per line">${esc(p.phrases)}</textarea>` : ''}
    </div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-vdel="1">${vDelArm ? 'Tap again to delete' : 'Delete program'}</button></div>`;
}
function renderVisual(){ renderVRows(); renderVEditor(); vEmptyMsg(); }
function vEmptyMsg(msg){
  const e = $('#vempty');
  if(vPlaying){ e.hidden = true; return; }
  const p = vcur();
  e.hidden = false;
  e.textContent = msg || (imgCount(p) ? `${imgCount(p)} images ready. Press play.` : vPhrases(p).length ? 'No images yet. Play shows phrases only, or pick a folder.' : 'Pick a folder of images, then press play.');
}

/* player */
const vLayers = [$('#vlayer-a'), $('#vlayer-b')];
let vPlaying = false, vT = null, vHideT = null, vQueue = [], vQi = 0, vPi = 0, vFlip = 0, vUrls = [];
function buildQueue(p){
  const list = (vFiles[p.id]||[]).slice();
  if(p.order==='shuffle'){ for(let i=list.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [list[i],list[j]] = [list[j],list[i]]; } }
  else list.sort((a,b)=>a.path.localeCompare(b.path, undefined, {numeric:true, sensitivity:'base'}));
  return list;
}
function urlFor(item){ const u = URL.createObjectURL(item.file); vUrls.push(u); while(vUrls.length > 4) URL.revokeObjectURL(vUrls.shift()); return u; }
function placeLayer(L, p){
  L.style.left = L.style.top = L.style.right = L.style.bottom = L.style.transform = '';
  if(p.mode==='slideshow') return;
  const where = p.mode==='flash' && p.where==='center' ? 'center' : p.where;
  if(where==='center'){ L.style.left = '50%'; L.style.top = '50%'; L.style.transform = 'translate(-50%,-50%)'; }
  else if(where==='corner'){ L.style.right = '4%'; L.style.bottom = '6%'; }
  else { L.style.left = (4 + Math.random()*44) + '%'; L.style.top = (4 + Math.random()*40) + '%'; }
}
function vShow(){
  if(!vPlaying) return;
  const p = vcur();
  if(vQi >= vQueue.length){ vQueue = buildQueue(p); vQi = 0; }
  const item = vQueue[vQi++], ph = vPhrases(p), text = ph.length ? ph[vPi++ % ph.length] : '';
  if(!item && !text){ stopV(); vEmptyMsg('Add images or phrases to this program first.'); return; }
  const L = vLayers[vFlip%2], O = vLayers[(vFlip+1)%2]; vFlip++;
  const img = L.querySelector('img'), cap = L.querySelector('.vcap');
  if(item){ img.src = urlFor(item); img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
  cap.textContent = text; cap.hidden = !text;
  L.className = 'vlayer ' + (p.mode==='slideshow' ? 'full' : 'card');
  placeLayer(L, p);
  $('#v-count').textContent = item ? `${vQi} of ${vQueue.length} · ${item.file.name}` : 'Phrases only';
  const op = p.opacity/100, every = Math.max(0.34, p.every);
  clearTimeout(vHideT);
  if(p.mode==='slideshow'){
    L.style.transition = O.style.transition = 'opacity .25s ease';
    L.style.opacity = op; O.style.opacity = 0; const oc = O.querySelector('.vcap'); if (oc) oc.hidden = true;
  } else {
    const stay = Math.min(p.stay, Math.max(0.1, every - 0.25));
    const fade = p.mode==='flash' ? '.08s' : '.4s';
    O.style.opacity = 0; L.style.transition = 'opacity ' + fade + ' ease';
    requestAnimationFrame(()=>{ L.style.opacity = op; });
    vHideT = setTimeout(()=>{ L.style.opacity = 0; }, stay*1000);
  }
  vT = setTimeout(vShow, every*1000);
}
/* talk now and then */
let vTalkT = null, vTalkI = 0;
function talkPhrases(p){ return p.captions==='own' ? vPhrases(p) : omniLines(); }
function speakPlain(text){
  if(!hasSpeech || !text || speechSynthesis.speaking) return;
  const u = new SpeechSynthesisUtterance(text);
  const os = omniGet().sound || {}, vs = speechSynthesis.getVoices(), v = vs.find(v=>v.name===os.osVoice); if(v) u.voice = v;
  u.rate = 0.95; u.pitch = 1; u.volume = 0.9;
  speechSynthesis.speak(u);
}
function scheduleTalk(first){
  clearTimeout(vTalkT);
  const p = vcur(); if(!vPlaying || !p.talk) return;
  const base = p.talkEvery*1000, wait = first ? 2500 : (p.random ? base*(0.6 + Math.random()*0.8) : base);
  vTalkT = setTimeout(()=>{ const ph = talkPhrases(p); if(ph.length) speakPlain(ph[vTalkI++ % ph.length]); scheduleTalk(false); }, wait);
}
function hasContent(p){ return imgCount(p) > 0 || vPhrases(p).length > 0; }
let vAutoStarted = false;
function playV(fromAuto){
  const p = vcur();
  if(!hasContent(p)){ vEmptyMsg('Add images or phrases to this program first.'); return; }
  vPlaying = true; vAutoStarted = !!fromAuto; vQueue = buildQueue(p); vQi = 0; vPi = 0;
  $('#vempty').hidden = true; $('#v-play').textContent = 'Stop';
  vShow(); scheduleTalk(true);
}
function stopV(){
  vPlaying = false; vAutoStarted = false; clearTimeout(vT); clearTimeout(vHideT); clearTimeout(vTalkT);
  vLayers.forEach(L=>L.style.opacity = 0);
  $('#v-play').textContent = 'Play'; $('#v-count').textContent = '';
  vEmptyMsg();
}
function addFiles(list, isFolder){
  const p = vcur();
  const imgs = list.filter(f=>/^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(f.name));
  if(!imgs.length){ vEmptyMsg('No images found there. Pick a folder with JPG, PNG, GIF or WEBP files.'); return; }
  const groups = {};
  imgs.forEach(f=>{ const path = f.webkitRelativePath || f.name; const folder = isFolder ? path.split('/')[0] : 'Added images'; (groups[folder] = groups[folder] || []).push({file:f, path, folder}); });
  vFiles[p.id] = vFiles[p.id] || [];
  for(const [name, arr] of Object.entries(groups)){
    const keep = isFolder ? vFiles[p.id].filter(x=>x.folder!==name) : vFiles[p.id];
    (isFolder ? imgStore.removeFolder(p.id, name) : Promise.resolve()).then(() => imgStore.put(p.id, arr));
    vFiles[p.id] = keep.concat(arr);
    const count = vFiles[p.id].filter(x=>x.folder===name).length;
    const i = p.folders.findIndex(x=>x.name===name);
    if(i>=0) p.folders[i] = {name, count}; else p.folders.push({name, count});
  }
  vsave(); renderVisual();
  if(vPlaying){ vQueue = buildQueue(p); vQi = 0; }
}
$('#v-folder').addEventListener('change', e=>{ addFiles([...e.target.files], true); e.target.value = ''; });
$('#v-files').addEventListener('change', e=>{ addFiles([...e.target.files], false); e.target.value = ''; });
$('#v-play').addEventListener('click', ()=>{
  if(vPlaying){ if(vAutoStarted && V.auto){ V.auto = false; vsave(); } stopV(); renderVRows(); autoStatus(); }
  else playV(false);
});

/* auto mode: runs programs on their schedule while the page is open */
const burst = {};
function inWindow(p, now){
  const dayOk = p.schedType==='dates' ? p.dates.includes(localDate(now)) : !!p.days[(now.getDay()+6)%7];
  if(!dayOk) return false;
  if(p.allDay) return true;
  const m = now.getHours()*60 + now.getMinutes(), f = toMin(p.from), t = toMin(p.to);
  return f <= t ? (m >= f && m < t) : (m >= f || m < t);
}
function burstLen(p, phase){ const base = (phase==='on' ? p.onMin : p.offMin)*60000; return p.random ? base*(0.5 + Math.random()) : base; }
function burstOn(p, ms){
  if(!p.burst){ delete burst[p.id]; return true; }
  let st = burst[p.id];
  if(!st) st = burst[p.id] = {phase:'on', until: ms + burstLen(p,'on')};
  while(ms >= st.until){ st.phase = st.phase==='on' ? 'off' : 'on'; st.until += burstLen(p, st.phase); }
  return st.phase==='on';
}
let autoLine = '';
function autoTick(){
  if(!V.auto){ autoStatus(); return; }
  const now = new Date(), ms = now.getTime();
  const active = V.programs.filter(p=>p.on && hasContent(p) && inWindow(p, now));
  V.programs.forEach(p=>{ if(!active.includes(p)) delete burst[p.id]; });
  const run = active.find(p=>burstOn(p, ms));
  if(run){
    if(!vPlaying || V.selected!==run.id){ if(vPlaying) stopV(); V.selected = run.id; vsave(); renderVisual(); playV(true); }
    autoLine = 'Running ' + run.name + (run.burst && burst[run.id] ? ' · rests at ' + clock(burst[run.id].until) : '');
  } else {
    if(vPlaying && vAutoStarted) stopV();
    const resting = active.find(p=>burst[p.id]);
    autoLine = resting ? resting.name + ' is resting until ' + clock(burst[resting.id].until) : 'Nothing scheduled right now. Waiting for the next program.';
  }
  autoStatus();
}
function autoStatus(){ $('#v-auto-status').textContent = V.auto ? autoLine : 'Off. Press play to run a program by hand.'; $('#v-auto').setAttribute('aria-checked', !!V.auto); }
$('#v-auto').addEventListener('click', ()=>{ V.auto = !V.auto; vsave(); if(!V.auto && vAutoStarted) stopV(); autoLine = 'Checking the schedule…'; autoStatus(); autoTick(); });
setInterval(autoTick, 5000);
$('#v-full').addEventListener('click', ()=>{ const s = $('#vstage'); try{ const r = s.requestFullscreen && s.requestFullscreen(); r && r.catch && r.catch(()=>{}); }catch(e){} });
$('#v-new').addEventListener('click', ()=>{ stopV(); const p = newProgram(); V.programs.push(p); V.selected = p.id; vDelArm = false; vsave(); renderVisual(); $('#v-name').focus(); $('#v-name').select(); });
$('#vView').addEventListener('click', e=>{
  const t = e.target.closest('button'); if(!t) return;
  const p = vcur(), d = t.dataset;
  if(d.vdel===undefined && vDelArm){ vDelArm = false; }
  if(d.vsel){ if(d.vsel!==V.selected){ stopV(); V.selected = d.vsel; } }
  else if(d.vtog){ const q = V.programs.find(x=>x.id===d.vtog); q.on = !q.on; }
  else if(d.vday){ p.days[+d.vday] = p.days[+d.vday] ? 0 : 1; }
  else if(d.vsched){ p.schedType = d.vsched; }
  else if(d.vcal){ const i = p.dates.indexOf(d.vcal); if(i>=0) p.dates.splice(i,1); else p.dates.push(d.vcal); p.dates.sort(); }
  else if(d.vcalnav){ calM += +d.vcalnav; if(calM<0){ calM = 11; calY--; } if(calM>11){ calM = 0; calY++; } }
  else if(d.vsw){ p[d.vsw] = !p[d.vsw]; if(d.vsw==='burst') delete burst[p.id]; if(d.vsw==='talk' && vPlaying) scheduleTalk(true); }
  else if(d.vorder){ p.order = d.vorder; if(vPlaying){ vQueue = buildQueue(p); vQi = 0; } }
  else if(d.vmode){ p.mode = d.vmode; const m = VMODES[p.mode]; p.every = m.every[3]; if(m.stay) p.stay = m.stay[3]; p.opacity = p.mode==='flash' ? 35 : 100; if(p.mode==='flash') p.where = 'random'; }
  else if(d.vwhere){ p.where = d.vwhere; }
  else if(d.vcap){ p.captions = d.vcap; }
  else if(d.vrm){ imgStore.removeFolder(p.id, d.vrm); vFiles[p.id] = (vFiles[p.id]||[]).filter(x=>x.folder!==d.vrm); p.folders = p.folders.filter(f=>f.name!==d.vrm); if(vPlaying){ vQueue = buildQueue(p); vQi = 0; } }
  else if(d.vdel){
    if(!vDelArm){ vDelArm = true; renderVEditor(); return; }
    stopV(); imgStore.removeProgram(p.id); delete vFiles[p.id]; V.programs = V.programs.filter(x=>x.id!==p.id);
    if(!V.programs.length) V.programs.push(newProgram('My image folder'));
    V.selected = V.programs[0].id; vDelArm = false;
  }
  else return;
  vsave(); renderVisual();
});
$('#vView').addEventListener('input', e=>{
  const t = e.target, p = vcur();
  if(t.dataset.vrange){
    const k = t.dataset.vrange; p[k] = +t.value;
    $('#v-'+k+'-out').textContent = (VFMT[k] || secs)(+t.value);
    if(k==='onMin' || k==='offMin') delete burst[p.id];
    vsave(); renderVRows();
  } else if(t.id==='v-name'){ p.name = t.value; vsave(); renderVRows(); }
  else if(t.id==='v-from' || t.id==='v-to'){ p[t.id==='v-from' ? 'from' : 'to'] = t.value; vsave(); renderVRows(); }
  else if(t.id==='v-phrases'){ p.phrases = t.value; vsave(); }
});

