// Frontend controller for the AI-RPG dungeon crawler.
// Talks to the Express API and renders game state.

const ACTION_LABELS = {
  attack: '⚔️ Attack',
  flee: '🏃 Flee',
  drink_potion: '🧪 Drink Potion',
  loot: '💰 Take Loot',
  rest: '🛌 Rest',
  descend: '⬇️ Descend',
  explore: '🔦 Explore',
};

const DANGER_ACTIONS = new Set(['attack', 'flee']);

const state = {
  gameId: null,
  selectedClass: 'warrior',
  busy: false,
};

const $ = (id) => document.getElementById(id);

function classifyEntry(text) {
  if (/level up/i.test(text)) return 'entry level';
  if (/gain|gold|loot|equip|recover|potion/i.test(text)) return 'entry reward';
  if (/damage|strikes|slashes|lunges|die|fall/i.test(text)) return 'entry combat';
  return 'entry';
}

function formatText(text) {
  // Render *emphasis* markers as <em>.
  return text.replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function renderStory(log) {
  const story = $('story');
  story.innerHTML = '';
  for (const line of log) {
    const div = document.createElement('div');
    div.className = classifyEntry(line);
    div.innerHTML = formatText(line);
    story.appendChild(div);
  }
  story.scrollTop = story.scrollHeight;
}

function renderHud(gs) {
  const p = gs.player;
  $('hud-hero').textContent = `${p.name} · ${p.classLabel}`;
  $('hud-floor').textContent = gs.floor;
  $('hud-hp').textContent = Math.max(0, p.hp);
  $('hud-maxhp').textContent = p.maxHp;
  $('hud-xp').textContent = p.xp;
  $('hud-xpnext').textContent = p.xpToNext;
  $('hud-level').textContent = p.level;
  $('hud-atk').textContent = p.attack + (p.weapon ? p.weapon.bonus : 0);
  $('hud-def').textContent = p.defense + (p.armor ? p.armor.bonus : 0);
  $('hud-gold').textContent = p.gold;
  $('hud-potions').textContent = p.potions;
  $('hp-fill').style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
  $('xp-fill').style.width = `${Math.min(100, (p.xp / p.xpToNext) * 100)}%`;
}

function renderActions(gs) {
  const container = $('actions');
  container.innerHTML = '';
  if (gs.status !== 'playing') {
    container.classList.add('hidden');
    showGameOver(gs);
    return;
  }
  container.classList.remove('hidden');
  $('game-over').classList.add('hidden');
  for (const action of gs.actions) {
    const btn = document.createElement('button');
    btn.className = 'action-btn' + (DANGER_ACTIONS.has(action) ? ' danger' : '');
    btn.textContent = ACTION_LABELS[action] || action;
    btn.disabled = state.busy;
    btn.addEventListener('click', () => doAction(action));
    container.appendChild(btn);
  }
}

function showGameOver(gs) {
  const box = $('game-over');
  box.classList.remove('hidden');
  const p = gs.player;
  if (gs.status === 'won') {
    $('game-over-text').innerHTML = `🏆 <b>Victory!</b> ${p.name} conquered the Sunless Deep at level ${p.level} with ${p.gold} gold and ${p.kills} kills.`;
  } else {
    $('game-over-text').innerHTML = `💀 <b>You died</b> on floor ${gs.floor} at level ${p.level}. Slain foes: ${p.kills}.`;
  }
}

function render(gs) {
  renderHud(gs);
  renderStory(gs.log);
  renderActions(gs);
}

async function api(pathname, options) {
  const res = await fetch(pathname, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      /* response was not JSON */
    }
    throw new Error(message);
  }
  return res.json();
}

async function startGame() {
  const name = $('hero-name').value.trim() || 'Adventurer';
  setBusy(true);
  try {
    const data = await api('/api/game', {
      method: 'POST',
      body: JSON.stringify({ name, className: state.selectedClass }),
    });
    state.gameId = data.id;
    $('create-panel').classList.add('hidden');
    $('game-panel').classList.remove('hidden');
    render(data.state);
  } catch (err) {
    alert(`Could not start game: ${err.message}`);
  } finally {
    setBusy(false);
  }
}

async function doAction(action) {
  if (state.busy || !state.gameId) return;
  setBusy(true);
  try {
    const data = await api(`/api/game/${state.gameId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    render(data.state);
  } catch (err) {
    alert(`Action failed: ${err.message}`);
  } finally {
    setBusy(false);
  }
}

function setBusy(value) {
  state.busy = value;
  document.querySelectorAll('.action-btn').forEach((b) => {
    b.disabled = value;
  });
}

function resetToCreate() {
  state.gameId = null;
  $('game-panel').classList.add('hidden');
  $('create-panel').classList.remove('hidden');
}

async function checkHealth() {
  const dot = $('conn-status');
  const text = $('conn-text');
  try {
    const data = await api('/api/health');
    dot.className = 'dot ok';
    text.textContent = `online · ${data.games} active game(s)`;
  } catch {
    dot.className = 'dot bad';
    text.textContent = 'server unreachable';
  }
}

function wireUp() {
  $('class-picker').addEventListener('click', (e) => {
    const card = e.target.closest('.class-card');
    if (!card) return;
    document.querySelectorAll('.class-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    state.selectedClass = card.dataset.class;
  });
  $('start-btn').addEventListener('click', startGame);
  $('restart-btn').addEventListener('click', resetToCreate);
  $('hero-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startGame();
  });
  checkHealth();
  setInterval(checkHealth, 15000);
}

document.addEventListener('DOMContentLoaded', wireUp);
