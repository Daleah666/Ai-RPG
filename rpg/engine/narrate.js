// The narrator: every battle event becomes one mechanical line (dice first) and one paragraph of prose.
// Owner: Battle Engineer. Pure, browser-safe, no imports. A template is chosen from the event's own numbers
// (its roll, its round, its damage), so a replay of the same fight reads the same.
//
// Voice: present tense, warm slapstick, PG-13. "You" are the person inside Valerie. She is the butt of the
// physics, never of the story. When she wings it, a success looks like an accident; when you think, it looks
// competent. Every paragraph is one to three sentences. Event shapes are listed in blueprint/08_battle_runner.md.

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** 12345 -> "12,345". */
export const fmt = (v) => Math.round(num(v)).toLocaleString('en-US');

const STAT = { STR: 'Might', INT: 'Arcana', AGI: 'Finesse', CON: 'Constitution', WIL: 'Willpower', LCK: 'Luck' };
const STANCE = { wing: 'Wing It', think: 'Think It Through' };
const CHOICE = { storm_off: 'Storm Off', have_it_out: 'Have It Out', bottle_it: 'Bottle It' };
const TIED = { head: 'a ringing head', arms: 'both arms in a tangle', legs: 'both legs in a knot' };

const turnsOf = (n) => (n === 1 ? '1 turn' : `${n} turns`);
const poss = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const be = (part) => (part === 'head' ? 'is' : 'are');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const signed = (v) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(-v)}` : '0');

function andList(names) {
  if (names.length <= 1) return names[0] ?? 'nobody';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

// Which variant: an event from the runner carries `voice`, a counter the battle keeps for each family of line
// (see voiceKey), offset by the first initiative roll. The variants are dealt in turn, so the same sentence never
// comes up twice running, and the same fight always reads the same. An event built by hand has no `voice`: it is
// read off its own roll, round and size instead. Either way there is no hidden state.
function seedOf(e) {
  if (Number.isFinite(e.voice)) return e.voice >>> 0;
  const size = num(e.damage ?? e.amount ?? e.taken ?? e.base);
  return (num(e.roll) * 7 + num(e.round) * 3 + Math.abs(Math.round(size)) + hash(String(e.target ?? e.actor ?? e.type))) >>> 0;
}

function pick(list, e) {
  return list[seedOf(e) % list.length];
}

// Names for a group: Valerie is "you", and "you" takes a plural verb.
function group(e) {
  const rows = e.targets ?? (e.target ? [{ id: e.target, name: e.targetName, you: e.targetYou }] : []);
  const names = rows.map((r) => (r.you ? 'you' : r.name));
  const plural = rows.length > 1 || rows.some((r) => r.you);
  const onlyYou = rows.length === 1 && Boolean(rows[0].you);
  return { rows, names, plural, onlyYou, N: andList(names), verb: (one, many) => (plural ? many : one) };
}

function view(e, ctx = {}) {
  const A = e.actorName ?? 'Someone';
  const T = e.targetName ?? 'someone';
  const basic = !e.skillName || e.skill === 'basic_attack';
  return {
    A,
    T,
    As: poss(A),
    Ts: poss(T),
    move: basic ? 'attack' : e.skillName,
    the: basic ? 'the attack' : e.skillName,
    own: basic ? `${poss(A)} attack` : `${poss(A)} ${e.skillName}`,
    dmg: fmt(e.damage),
    ref: fmt(e.reflected),
    sword: ctx.sword ?? 'Happenstance',
  };
}

// ---------------------------------------------------------------- attacks

const ATTACK = {
  hero_hit: [
    (v) => `${v.own} connects cleanly. ${v.T} staggers, ${v.dmg} HP poorer.`,
    (v) => `${v.A} finds the gap and ${v.the} goes through it for ${v.dmg}.`,
    (v) => `${v.T} sees ${v.own} coming and can do nothing useful about it: ${v.dmg} damage.`,
  ],
  hero_crit: [
    (v) => `${v.own} lands on the exact spot every instructor points at. ${v.T} folds around ${v.dmg} damage.`,
    (v) => `Perfect timing, perfect angle: ${v.own} hits for ${v.dmg} and ${v.T} feels every point of it.`,
    (v) => `${v.T} zigs straight into ${v.own}. ${v.dmg} damage, and a wince from everyone watching.`,
  ],
  hero_miss: [
    (v) => `${v.own} goes wide. ${v.T} looks almost offended by the attempt.`,
    (v) => `${v.T} leans out of the way and ${v.own} hits nothing but air.`,
    (v) => `${v.A} commits fully to where ${v.T} was a moment ago.`,
  ],
  hero_fumble: [
    (v) => `${v.own} goes badly enough that ${v.T} stops to watch. Nothing is hurt except ${v.As} pride.`,
    (v) => `${v.A} slips at the worst moment and ${v.the} ends up pointed at the ceiling. There will be notes.`,
    (v) => `Wrong foot, wrong grip, wrong direction: ${v.A} fumbles ${v.the} completely.`,
  ],
  hero_effect: [
    (v) => `${v.own} lands, and ${v.T} is having a worse day for it.`,
    (v) => `${v.T} takes ${v.own} personally, which was the idea.`,
  ],
  absorbed: [
    (v) => `${v.T} drinks in ${v.own} and looks better for it: ${v.dmg} HP restored.`,
    (v) => `Wrong element. ${cap(v.own)} soaks in like rain and mends ${v.dmg} HP on ${v.T}.`,
  ],
  nulled: [
    (v) => `${cap(v.own)} lands and does precisely nothing. ${v.T} is immune to that.`,
  ],
  foe_hit: [
    (v) => `${v.own} gets through. ${v.T} takes ${v.dmg} and says a word the bards will leave out.`,
    (v) => `${v.T} sees ${v.own} coming and still cannot get clear: ${v.dmg} damage.`,
    (v) => `${v.A} lands ${v.the} on ${v.T} for ${v.dmg}. It looks like it hurts about that much.`,
  ],
  foe_crit: [
    (v) => `${v.own} catches ${v.T} flat-footed for ${v.dmg}. That one is going to need a sit-down.`,
    (v) => `A horrible, perfect hit: ${v.A} puts ${v.the} exactly where ${v.T} keeps the important parts. ${v.dmg} damage.`,
  ],
  foe_miss: [
    (v) => `${v.T} slips ${v.own} with room to spare.`,
    (v) => `${v.own} whistles past ${v.Ts} ear and takes a chunk out of the scenery instead.`,
    (v) => `${v.A} goes for ${v.T}. ${v.T} is simply elsewhere.`,
  ],
  foe_fumble: [
    (v) => `${v.A} loses the thread halfway through ${v.the} and spends the moment retrieving some dignity.`,
    (v) => `${v.own} goes so wrong that ${v.T} offers a small, sarcastic clap.`,
  ],
  foe_effect: [
    (v) => `${v.own} lands on ${v.T}, and it shows.`,
    (v) => `${v.T} cannot shake off ${v.own}.`,
  ],
  you_wing_hit: [
    (v) => `You let ${v.sword} go where it wants, and where it wants is ${v.T}. ${v.dmg} damage, and you very nearly keep your footing.`,
    (v) => `You stumble forward, the sword comes round on its own, and ${v.T} is somehow in the way: ${v.dmg} damage.`,
    (v) => `You trip over your own cloak and arrive blade-first. ${v.T} takes ${v.dmg}; you take the credit.`,
    (v) => `Your ${v.move} is mostly a matter of holding on. ${v.T} takes ${v.dmg} anyway.`,
  ],
  you_wing_crit: [
    (v) => `Your foot finds a loose stone, ${v.sword} finds the one soft spot on ${v.T}, and neither of you planned it. ${v.dmg} damage, critical and entirely accidental.`,
    (v) => `You sneeze mid-swing. The blade dips under ${v.Ts} guard at the worst possible moment for ${v.T}: ${v.dmg} damage.`,
    (v) => `The sword swings you, not the other way round, and it swings you perfectly. ${v.T} takes ${v.dmg} and looks at you with real fear.`,
  ],
  you_think_hit: [
    (v) => `You plant her feet, pick your spot and put the blade there. ${v.T} takes ${v.dmg}, exactly as planned.`,
    (v) => `For once the sword goes where you tell it. Your ${v.move} lands square on ${v.T} for ${v.dmg}.`,
    (v) => `You read the opening, take it, and ${v.T} pays ${v.dmg} for leaving it there.`,
  ],
  you_think_crit: [
    (v) => `You see the gap half a second before ${v.T} does and drive your ${v.move} through it: ${v.dmg} damage. That one was all you.`,
    (v) => `Textbook. You line it up, breathe out, and ${v.T} takes ${v.dmg} right on the seam.`,
  ],
  you_wing_miss: [
    (v) => `${v.sword} takes you on a full tour of the area around ${v.T} without touching any of it.`,
    (v) => `You swing, spin, and end up facing the wrong way. ${v.T} is unharmed and slightly confused.`,
    (v) => `The sword goes left and you go right. ${v.T} has not had to move an inch.`,
  ],
  you_think_miss: [
    (v) => `You aim carefully, and her arms carefully do something else. Your ${v.move} misses ${v.T} by a respectable margin.`,
    (v) => `The plan was sound. The body had notes, and ${v.T} steps aside.`,
  ],
  you_wing_fumble: [
    (v) => `Your ${v.move} never arrives. Your greaves have found each other, and you are already on the way down.`,
    () => `Halfway through the swing your centre of gravity files a complaint. The floor is coming up to meet you, and it is bringing friends.`,
    () => `You trip. Not a stumble: a proper trip, the kind with a wind-up.`,
  ],
  you_think_fumble: [
    (v) => `You overthink the footwork and sit down hard in the middle of your ${v.move}. No lucky chaos this time, just a bruise.`,
    (v) => `You are so busy planning the second step that you botch the first. ${v.T} watches you untangle yourself.`,
  ],
  you_wing_effect: [
    (v) => `Your ${v.move} lands, more or less by accident, and ${v.T} is worse off for it.`,
  ],
  you_think_effect: [
    (v) => `Your ${v.move} lands exactly as you meant it to. ${v.T} is worse off for it.`,
  ],
  at_you_hit: [
    (v) => `${v.own} catches you square. ${v.dmg} damage, and the gold plate rings like a dinner gong.`,
    (v) => `No luck this time: ${v.A} connects, and you feel all ${v.dmg} of it through the armor.`,
    (v) => `You see ${v.the} coming, which turns out to be the problem. ${v.dmg} damage, right in the breastplate.`,
  ],
  at_you_crit: [
    (v) => `${v.own} lands flush for ${v.dmg} and knocks the wind, a hair ribbon and one pauldron off you.`,
    (v) => `A truly great shot gets through everything: ${v.dmg} damage. You sit down in the dirt, surprised, and get back up anyway.`,
  ],
  at_you_effect: [
    (v) => `${v.own} lands on you, and you feel it take hold.`,
  ],
  dodge: [
    (v) => `${v.A} attacks; you trip on nothing and go under it. From the outside it looks like footwork.`,
    (v) => `You bend to check a bootlace at the exact moment ${v.own} passes through where your head was.`,
    (v) => `Your greaves tangle, you sit down hard, and ${v.own} sails over the top of you. You believe you are being agile.`,
  ],
  at_you_miss: [
    (v) => `${v.own} goes wide all on its own. You wave, in case that helped.`,
    (v) => `${v.A} misses you by a clear yard. You had braced and everything.`,
  ],
  bounce: [
    (v) => `${v.own} meets your physics-defying breastplate, stops, reconsiders, and leaves the way it came. All ${v.ref} damage goes back to ${v.A}, return to sender.`,
    (v) => `The shot hits your chest with a cheerful boing and goes home. ${v.A} catches it for ${v.ref} and looks betrayed.`,
    (v) => `You think you bounced it off, and you are not wrong: ${v.own} comes straight back for ${v.ref}.`,
  ],
  befuddled: [
    (v, e) => `${v.A} winds up for ${v.the}, forgets which end is the business end, and finishes with ${TIED[e.selfBind] ?? 'a tangle'}. Nobody connects it to you, least of all you.`,
    (v, e) => `Halfway through ${v.the}, ${v.A} trips on nothing at all and ends up with ${TIED[e.selfBind] ?? 'a tangle'}. You ask if everything is all right.`,
    (v, e) => `${v.A} drops everything, steps on it, and goes down with ${TIED[e.selfBind] ?? 'a tangle'}. You assume this is normal.`,
  ],
};

function attackKey(e) {
  const landed = e.outcome === 'hit' || e.outcome === 'crit';
  const effectOnly = landed && !e.damage && !e.powered;
  if (landed && e.absorbed) return 'absorbed';
  if (landed && !e.damage && e.powered) return 'nulled';
  if (e.actorYou) {
    const stance = e.stance === 'think' ? 'think' : 'wing';
    if (effectOnly) return `you_${stance}_effect`;
    return `you_${stance}_${e.outcome}`;
  }
  if (e.targetYou && e.actorSide === 'enemies') {
    if (e.outcome === 'bounce') return 'bounce';
    if (e.outcome === 'fumble') return 'befuddled';
    if (e.outcome === 'miss') return e.dodged ? 'dodge' : 'at_you_miss';
    if (effectOnly) return 'at_you_effect';
    return `at_you_${e.outcome}`;
  }
  const side = e.actorSide === 'heroes' ? 'hero' : 'foe';
  if (effectOnly) return `${side}_effect`;
  return `${side}_${e.outcome}`;
}

// One lead-in sentence at most, so an attack never runs past three.
function leadIn(e, v) {
  if (e.counter) return e.actorYou ? 'You answer at once.' : `${v.A} answers at once.`;
  if (e.friendly) return 'It is not aimed where anyone hoped.';
  const why = e.redirect?.why;
  if (why === 'taunt') return e.targetYou ? 'Every eye is on you, as requested.' : `${v.T} has made sure of being the target.`;
  if (why === 'provoked') return `${v.A} is still furious with ${v.T}.`;
  if (why === 'bulwark') return e.targetYou ? 'You are in the way of everything.' : `${v.T} is in the way of everything.`;
  if (why === 'covered' || why === 'cover' || why === 'reflex') {
    const from = e.redirect.fromName ?? 'a friend';
    return e.targetYou ? `You step in front of ${from}.` : `${v.T} steps in front of ${from}.`;
  }
  return null;
}

function attackText(e, ctx) {
  const v = view(e, ctx);
  const list = ATTACK[attackKey(e)] ?? ATTACK.foe_miss;
  const body = pick(list, e)(v, e);
  const lead = leadIn(e, v);
  return lead ? `${lead} ${body}` : body;
}

// ---------------------------------------------------------------- stress

const STRESS_BY_SOURCE = {
  horror: [
    (g) => `${cap(g.N)} ${g.verb('feels', 'feel')} that one in the pit of the stomach.`,
    (g) => `A cold little silence settles over ${g.N}.`,
    (g) => `${cap(g.N)} ${g.verb('takes', 'take')} a step back without deciding to.`,
  ],
  mental: [
    (g) => `It gets under the skin and stays there. ${cap(g.N)} ${g.verb('starts', 'start')} second-guessing things that were fine a minute ago.`,
    (g) => `${cap(g.N)} ${g.verb('has', 'have')} heard worse, but not recently.`,
  ],
  embarrassment: [
    (g) => `${cap(g.N)} ${g.verb('goes', 'go')} pink to the ears.`,
    (g) => `${cap(g.N)} would very much like the ground to open up.`,
  ],
  wound: [
    (g) => `${cap(g.N)} ${g.verb('grits', 'grit')} teeth and ${g.verb('counts', 'count')} the damage.`,
    (g) => `The pain files itself somewhere ${g.N} will find it later.`,
  ],
  death: [
    (g) => `${cap(g.N)} ${g.verb('does', 'do')} the arithmetic on how this ends and ${g.verb('does', 'do')} not like the answer.`,
    (g) => `For a moment ${g.N} can see the headstone.`,
  ],
  realization: [
    (g) => `It is true, and ${g.N} ${g.verb('knows', 'know')} it.`,
  ],
  general: [
    (g) => `The strain shows on ${g.N}.`,
    (g) => `${cap(g.N)} ${g.verb('winds', 'wind')} a notch tighter.`,
  ],
};

const STRESS_BY_REASON = {
  resolve: [(g, e) => `Watching ${e.actorYou ? 'you' : e.byName ?? 'a friend'} come apart does ${g.N} no good at all.`],
  breakdown: [(g, e) => `${e.actorYou ? 'Your' : poss(e.byName ?? 'A friend')} breakdown lands on ${g.N} like a dropped tray.`],
  act_out: [(g, e) => `${e.actorYou ? 'You make' : `${e.byName ?? 'A friend'} makes`} it everybody's problem, and ${g.N} ${g.verb('feels', 'feel')} it.`],
  heckle: [(g, e) => `${e.actorYou ? 'You have' : `${e.byName ?? 'A friend'} has`} notes. ${cap(g.N)} did not ask for notes.`],
  crit_taken: [
    (g) => `${cap(g.N)} ${g.verb('takes', 'take')} that one personally.`,
    (g) => `A hit like that stays with ${g.N}.`,
  ],
  brink: [
    (g) => `${cap(g.N)} ${g.verb('is', 'are')} running on fumes, and ${g.verb('knows', 'know')} it.`,
    (g) => `There is not much left of ${g.N}, and the arithmetic is not comforting.`,
  ],
  ally_down: [
    (g) => `${cap(g.N)} ${g.verb('watches', 'watch')} a friend go down, and it lands hard.`,
    (g) => `One fewer standing. ${cap(g.N)} ${g.verb('feels', 'feel')} the gap.`,
  ],
  downed: [(g) => `${cap(g.N)} ${g.verb('remembers', 'remember')} exactly how the ground felt.`],
  fumble: [
    (g) => `${cap(g.N)} would like everyone to forget that immediately.`,
    (g) => `${cap(g.N)} ${g.verb('checks', 'check')} whether anyone saw. Everyone saw.`,
    (g) => `That one is going to come up at dinner, and ${g.N} ${g.verb('knows', 'know')} it.`,
  ],
};

const UNNOTICED = [
  (e) => `You face it with the calm of someone who has not understood the situation.${e.allyRelief ? ' The party mistakes it for courage and finds some of their own.' : ''}`,
  (e) => `It is probably very frightening. You were looking at a butterfly.${e.allyRelief ? ' Around you, shoulders come down an inch.' : ''}`,
  (e) => `You smile politely at the horror, since it seems to want something.${e.allyRelief ? ' The party watches you do it and breathes out.' : ''}`,
];

const TRUTH = [
  (e) => `The words go in, and there is no armor on the inside. You cannot out-stubborn the truth: stress ${e.after}, gauge down to ${e.gaugeAfter}.`,
  (e) => `For one clear second you see how it really happened. It costs you: stress ${e.after}, and the comfortable fog thins to ${e.gaugeAfter}.`,
  (e) => `Somebody said it out loud. The luck flinches, the gauge drops to ${e.gaugeAfter}, and you feel every point of it.`,
];

const YOU_NOTICED = {
  horror: (e) => `You see it clearly, which is the whole trouble. Stress climbs to ${e.after}.`,
  mental: (e) => `It gets into your head, and it is crowded in there already. Stress ${e.after}.`,
  embarrassment: (e) => `You noticed. Oh, you noticed: your ears are on fire and your stress is at ${e.after}.`,
  wound: (e) => `That hurt in the ordinary way, and you feel it. Stress ${e.after}.`,
  death: (e) => `For a moment you can see exactly how this ends. Stress ${e.after}.`,
  general: (e) => `It wears on you. Stress ${e.after}.`,
};

function stressText(e) {
  const g = group(e);
  if (g.onlyYou) {
    const row = g.rows[0];
    const view = { ...e, after: row.after, gaugeAfter: row.gaugeAfter, allyRelief: e.allyRelief };
    if (row.noticed === false) {
      if (e.source === 'embarrassment') return 'It would be mortifying if you had caught any of it. You did not.';
      // A friend cracking nearby is not a horror, and she misses that too.
      if (['resolve', 'breakdown', 'act_out', 'heckle'].includes(e.reason)) {
        return `Whatever is going on with ${e.byName ?? 'your friend'}, it sails clean past you.${e.allyRelief ? ' The rest of the party sees your untroubled face and steadies a little.' : ''}`;
      }
      return pick(UNNOTICED, e)(view);
    }
    if (e.source === 'realization' && row.taken > 0) return pick(TRUTH, e)(view);
    if (!row.taken) return 'Nothing gets through to you at all. You are a good hero, and that is that.';
    if (STRESS_BY_REASON[e.reason]) return `${pick(STRESS_BY_REASON[e.reason], e)(g, e)} Stress ${row.after}.`;
    return (YOU_NOTICED[e.source] ?? YOU_NOTICED.general)(view);
  }
  if (e.targetSide === 'enemies') {
    return pick([
      () => `${cap(g.N)} did not need to hear that. It rattles around behind the eyes.`,
      () => `That lands somewhere soft. ${cap(g.N)} ${g.verb('looks', 'look')} a good deal less sure.`,
    ], e)();
  }
  const list = STRESS_BY_REASON[e.reason] ?? STRESS_BY_SOURCE[e.source] ?? STRESS_BY_SOURCE.general;
  return pick(list, e)(g, e);
}

function reliefText(e) {
  const g = group(e);
  if (g.rows.length && g.rows.every((r) => r.refused)) return `${cap(g.N)} ${g.verb('is', 'are')} in no mood to be comforted.`;
  if (e.reason === 'virtue') return `${poss(e.actorName ?? 'Someone')} nerve is catching. ${cap(g.N)} ${g.verb('stands', 'stand')} a little straighter.`;
  if (g.onlyYou) return 'You feel better, for reasons you could not explain.';
  return pick([
    () => `${cap(g.N)} ${g.verb('breathes', 'breathe')} out. A little weight comes off.`,
    () => `Some of the strain goes out of ${g.N}.`,
  ], e)();
}

// ---------------------------------------------------------------- statuses

const STATUS_TEXT = {
  taunt: (g) => (g.onlyYou ? 'You plant her feet and wave. Every enemy on the field turns to look at the knight in gold.' : `${cap(g.N)} ${g.verb('makes', 'make')} sure nobody is looking anywhere else.`),
  guard: (g) => `${cap(g.N)} ${g.verb('gets', 'get')} behind a guard.`,
  fortified: (g) => `${cap(g.N)} ${g.verb('digs', 'dig')} in like furniture.`,
  bulwark: (g) => `${cap(g.N)} ${g.verb('becomes', 'become')} the door. Everything aimed at the party now has to go through it.`,
  covered: (g, e) => `${e.actorName ?? 'Someone'} steps in front of ${g.N}.`,
  counter: (g) => `${cap(g.N)} ${g.verb('sets', 'set')} a stance and an invitation.`,
  provoked: (g, e) => `${cap(g.N)} now ${g.verb('has', 'have')} a personal problem with ${e.actorYou ? 'you' : e.actorName ?? 'someone'}.`,
  hidden: (g) => (g.onlyYou ? 'You are, improbably, nowhere to be seen.' : `${cap(g.N)} ${g.verb('is', 'are')} simply not there any more.`),
  marked: (g) => `${cap(g.N)} ${g.verb('is', 'are')} wearing a target and ${g.verb('does', 'do')} not know it yet.`,
  exposed: (g) => `${cap(g.N)} ${g.verb('is', 'are')} wide open.`,
  focused: (g) => `${cap(g.N)} ${g.verb('stops', 'stop')}, and ${g.verb('states', 'state')} exactly what is about to happen.`,
  analyzed: (g, e) => (e.guardStripped
    ? `You squint with her eyes and your brain, and there it is: the one thing ${g.N} was hiding. The guard comes down with it.`
    : `You squint with her eyes and your brain. ${cap(g.N)} ${g.verb('comes', 'come')} apart into weak points.`),
  sitting_out: (g) => `${cap(g.N)} ${g.verb('is', 'are')} going to miss a turn.`,
  all_nighter: (g) => `${cap(g.N)} ${g.verb('stops', 'stop')} counting the cost. The bill comes later.`,
  guard_broken: (g) => (g.onlyYou ? 'Your guard comes apart.' : `The guard comes apart around ${g.N}.`),
  extra_slippery: () => 'You go completely boneless. Good luck hitting that.',
  good_hero: () => 'Cloak up, chin up: "I\'m just a good hero!" For a little while the luck stops asking the gauge for permission.',
  auto_crit_next_think: () => 'It all clicks. The next thing you plan will land exactly where it hurts.',
  book_exposed: (g) => `${poss(cap(g.N))} heart-book lands face up, in plain sight. There will be no hiding it for a while.`,
  ledger_flipped: () => 'The ledger flips. Your luck now runs backwards: it only works while you are thinking.',
  ledger_restored: () => 'The ledger flips back the right way up, and your luck with it.',
  buffs_repossessed: (g, e) => `${e.actorName ?? 'She'} takes back every advantage ${g.N} ${g.verb('was', 'were')} holding, and tries them on.`,
  surprised: (g) => `${cap(g.N)} ${g.verb('is', 'are')}, for the first time on record, surprised.`,
  vindicated: (g) => `${cap(g.N)} sits down on the bridge, heard at last.`,
  on_the_record: (g) => `${cap(g.N)} writes it down, every word, and closes the book.`,
  lucky_once: (g) => `The Wheel lands on the one number it has never landed on. ${cap(g.N)} has won something, for the first time ever.`,
  lose_next_action: (g) => `${cap(g.N)} ${g.verb('scrabbles', 'scrabble')} to recover what just slid away.`,
  formation_broken: () => 'The formation is a heap of shields and elbows.',
  formation_reformed: () => 'The line snaps back into shape.',
  gate_shut: () => 'The portcullis is down, and half of them are hammering on the wrong side of it.',
  dot: (g, e) => `${cap(g.N)} ${g.verb('is', 'are')} left ${e.element === 'fire' ? 'burning' : 'smarting'}, and it is not finished.`,
};

function statusText(e) {
  const g = group(e);
  if (e.blocked) return `${cap(g.N)} ${g.verb('tries', 'try')} to raise a guard and cannot.`;
  if (e.refused) return `${cap(g.N)} ${g.verb('wants', 'want')} none of it, and the help is wasted.`;
  const fn = STATUS_TEXT[e.status];
  if (fn) return fn(g, e);
  return `${cap(g.N)} ${g.verb('is', 'are')} now ${e.statusName ?? e.status}.`;
}

// ---------------------------------------------------------------- everything else

const NARRATORS = {
  start(e, ctx) {
    const sword = ctx.sword ?? 'Happenstance';
    const scene = e.scene ? `${e.scene} ` : '';
    return pick([
      () => `${scene}You draw ${sword}, or possibly it draws you.`,
      () => `${scene}You check which end of ${sword} is the dangerous one, and step up.`,
    ], e)();
  },
  round(e) {
    const first = e.firstYou ? 'you are' : `${e.first} is`;
    return pick([
      () => `Round ${e.round}. This time ${first} quickest off the mark.`,
      () => `Round ${e.round}: everyone still standing takes a breath, and ${first} first to spend it.`,
      () => `A new round, number ${e.round}. ${cap(first)} moving before anyone else has decided anything.`,
    ], e)();
  },
  stance(e) {
    const g = e.gaugeAfter;
    if (e.gaugeBefore === e.gaugeAfter) {
      if (e.stance === 'think') {
        return pick([
          () => `You take the wheel. The gauge stays pinned at ${g}.`,
          () => `You think it through, for all the good it does the gauge: still ${g}.`,
        ], e)();
      }
      return pick([
        () => `You let go of the wheel, though the gauge has nowhere left to go: ${g}.`,
        () => `Nobody is steering, and nobody has been for a while. The gauge holds at ${g}.`,
        () => `You leave her body to it. Airhead ${g}, as far from the controls as it gets.`,
      ], e)();
    }
    if (e.stance === 'think') {
      return pick([
        () => `You take the wheel. The gauge drops to ${g}, and the inside of this head is exactly as loud as you remembered.`,
        () => `You make yourself think it through, one step at a time. Airhead ${g}; looking at things this clearly costs a little nerve.`,
        () => `Deep breath, eyes open, your brain in her skull. The gauge falls to ${g} and the headache arrives on schedule.`,
      ], e)();
    }
    return pick([
      () => `You stop steering. The gauge drifts up to ${g} and your shoulders come down from around your ears.`,
      () => `You let go of the wheel and let her body get on with it. Airhead ${g}, and a little less to worry about.`,
      () => `Thinking is how people get hurt, so you don't. The gauge climbs to ${g}.`,
    ], e)();
  },
  skill(e) {
    const A = e.actorName ?? 'Someone';
    const S = e.skillName ?? 'something';
    if (e.actorYou) {
      if (e.flavor) return e.stance === 'think' ? `${e.flavor} You talk her body through it, one step at a time.` : `${e.flavor} You let her body handle the details.`;
      return e.stance === 'think'
        ? `You walk her body through ${S}, one careful step at a time.`
        : `You try ${S} the only way her body knows: all at once.`;
    }
    if (e.actorSide === 'enemies') {
      if (e.flavor) {
        return pick([
          () => `${A} uses ${S}. ${e.flavor}`,
          () => `${S}: ${A} does not ask first. ${e.flavor}`,
        ], e)();
      }
      return e.auto ? `${A} uses ${S}, and there is no ducking it.` : `${A} falls back on ${S}.`;
    }
    return pick([
      () => `${A} goes for ${S}, and makes it look like the plan all along.`,
      () => `${S}. ${A} commits to it without a flicker of doubt.`,
      () => `${A} calls ${S}, and the party shifts to make room.`,
    ], e)();
  },
  attack: attackText,
  bind(e, ctx) {
    const v = view(e, ctx);
    const part = e.part;
    const span = turnsOf(e.turns ?? 0);
    if (e.own && !e.success) {
      if (e.backfire) return `${v.A} fumbles ${v.the} and is caught in it instead: ${part} bound for 1 turn.`;
      if (e.fumble && e.actorYou) return `Your ${v.move} goes wrong before it starts. You are already falling.`;
      if (e.actorYou) return `Your ${v.move} catches nothing. ${v.T} steps over your foot without noticing it.`;
      return pick([
        () => `${cap(v.own)} does not take. ${v.T} shrugs it off.`,
        () => `${v.T} wriggles clear of ${v.own}.`,
      ], e)();
    }
    if (e.source === 'contraption') return `${v.Ts} ${part} ${be(part)} pinned under the wreckage for ${span}.`;
    if (e.source === 'crash') return e.targetYou ? `The bill arrives. Your head is bound for ${span}.` : `The bill arrives. ${v.Ts} head is bound for ${span}.`;
    if (e.self) return e.targetYou ? `It costs you: ${part} bound for ${span}.` : `It costs ${v.T}: ${part} bound for ${span}.`;
    if (e.actorYou) {
      if (e.stance === 'think') return `You hook ${v.Ts} ${part} on purpose, and it works. Bound for ${span}.`;
      if (e.riding) return `The blow lands exactly where it hurts, which is news to you: ${v.Ts} ${part} ${be(part)} bound for ${span}.`;
      return `Your foot finds theirs, entirely by accident. ${v.Ts} ${part} ${be(part)} bound for ${span}.`;
    }
    if (e.targetYou) return `Your ${part} ${be(part)} caught fast, bound for ${span}. Her body treats this as a suggestion.`;
    if (e.targetSide === 'heroes') {
      return pick([
        () => `${v.Ts} ${part} ${be(part)} caught fast: bound for ${span}.`,
        () => `${v.A} leaves ${v.T} with ${part} out of action for ${span}.`,
      ], e)();
    }
    return pick([
      () => `${cap(v.own)} ties up ${v.Ts} ${part} for ${span}.`,
      () => `${v.Ts} ${part} ${be(part)} suddenly not taking orders: bound for ${span}.`,
      () => `A neat bit of work from ${v.A}. ${v.Ts} ${part} ${be(part)} out of the fight for ${span}.`,
    ], e)();
  },
  damage(e) {
    const T = e.targetYou ? 'you' : e.targetName;
    const amt = fmt(e.amount);
    if (e.source === 'dot') {
      return e.element === 'fire'
        ? `${cap(T)} ${e.targetYou ? 'are' : 'is'} still burning: ${amt} damage.`
        : `${e.skillName ?? 'The spell'} is not done with ${T}: ${amt} more damage.`;
    }
    if (e.source === 'contraption') return `${e.name ?? 'The machine'} catches ${T} for ${amt}.`;
    if (e.source === 'jackpot') return `The wave picks ${T} up and puts ${e.targetYou ? 'you' : 'them'} down somewhere worse: ${amt} damage.`;
    if (e.source === 'meltdown') return `${cap(T)} ${e.targetYou ? 'walk' : 'walks'} into the nearest hazard on purpose. ${amt} damage, self-inflicted.`;
    return `${cap(T)} ${e.targetYou ? 'take' : 'takes'} ${amt} damage.`;
  },
  heal(e) {
    const A = e.actorName ?? 'Someone';
    const T = e.targetName ?? 'someone';
    const S = e.skillName ?? 'the healing';
    const amt = fmt(e.amount);
    if (e.refused) return e.targetYou ? `You wave ${poss(A)} ${S} away without quite knowing why. The healing goes nowhere.` : `${T} waves ${poss(A)} ${S} away. The healing goes nowhere.`;
    if (e.source === 'regen' || e.source === 'resolve') return e.targetYou ? `You get a second wind: ${amt} HP.` : `${T} gets a second wind: ${amt} HP.`;
    if (e.source === 'virtue') return `${A} fusses over ${e.targetYou ? 'you' : T} until ${amt} HP of the damage gives up.`;
    if (e.source === 'absorb') return `${T} soaks it up: ${amt} HP restored.`;
    if (e.actor && e.actor === e.target) {
      if (e.actorYou) return `You catch your breath, and ${amt} HP of you comes back.`;
      return pick([
        () => `${A} shakes it off: ${amt} HP back.`,
        () => `${A} decides it is not that bad after all. ${amt} HP restored.`,
      ], e)();
    }
    if (e.targetYou) return `${poss(A)} ${S} washes over you. ${amt} HP, and the ache in your everything eases.`;
    if (e.actorYou) return `Your ${S} somehow works: ${T} gets ${amt} HP back.`;
    return pick([
      () => `${poss(A)} ${S} knits ${T} back together: ${amt} HP.`,
      () => `${T} straightens up as ${poss(A)} ${S} takes hold. ${amt} HP, and the colour comes back.`,
    ], e)();
  },
  stress: stressText,
  relief: reliefText,
  resolve(e) {
    const T = e.targetName ?? 'Someone';
    const tail = `${e.entryName}${e.quote ? `: "${e.quote}"` : '.'}`;
    const mark = e.permanent ? ' This one will leave a mark.' : '';
    let lead;
    if (e.targetYou) {
      lead = e.kind === 'virtue'
        ? pick(['You wait for the panic and it never arrives.', 'The fear looks for somewhere to land and finds nothing but confidence.'], e)
        : pick(['The stress finally finds somewhere it can do damage.', 'It all catches up with you at once.'], e);
    } else {
      lead = e.kind === 'virtue'
        ? pick([`${T} hits the wall and goes straight through it.`, `Everything that was about to snap in ${T} locks into place instead.`], e)
        : pick([`Something in ${T} gives way.`, `${T} has had enough, and it shows all at once.`], e);
    }
    return `${lead} ${tail}${mark}`;
  },
  breakdown(e) {
    const T = e.targetName ?? 'Someone';
    const lead = e.forced ? 'A second time in one fight is one too many. ' : '';
    if (e.choice === 'have_it_out') return `${lead}${e.targetYou ? 'You say' : `${T} says`} all of it, out loud, to everyone. The air is clearer and nobody feels better.`;
    if (e.choice === 'bottle_it') return `${lead}${e.targetYou ? 'You swallow' : `${T} swallows`} the whole thing and ${e.targetYou ? 'keep' : 'keeps'} fighting. It will leave a mark.`;
    return e.targetYou
      ? `${lead}You have had enough. You turn round and walk out of the fight, cloak and all.`
      : `${lead}${T} throws down the nearest throwable thing and walks out of the fight.`;
  },
  calm(e) {
    return e.targetYou ? `Your head clears. ${e.stateName ?? 'It'} is over.` : `${e.targetName} comes back to the room. ${e.stateName ?? 'It'} is over.`;
  },
  status: statusText,
  mod(e) {
    const g = group(e);
    const stat = STAT[e.stat] ?? e.stat;
    if (e.refused) return `${cap(g.N)} ${g.verb('wants', 'want')} none of it, and the help is wasted.`;
    if (e.mult >= 1) {
      return pick([
        () => `${cap(g.N)} ${g.verb('stands', 'stand')} a little taller: ${stat} is up.`,
        () => `${stat} rises for ${g.N}.`,
      ], e)();
    }
    return pick([
      () => `${cap(g.N)} ${g.verb('loses', 'lose')} a step: ${stat} is down.`,
      () => `${stat} drains out of ${g.N}.`,
    ], e)();
  },
  cleanse(e) {
    const T = e.targetYou ? 'you' : e.targetName;
    if (!e.removed) return `There is nothing on ${T} to take off.`;
    if (e.what === 'binds') return e.targetYou ? 'You are free again: every bind comes off.' : `${e.targetName} is free again: every bind comes off.`;
    if (e.targetSide !== e.actorSide) return `${poss(e.actorName ?? 'Someone')} ${e.skillName ?? 'work'} strikes out every advantage ${T} was holding.`;
    return e.targetYou ? 'You shake off what was dragging you down.' : `${e.targetName} shakes off what was dragging them down.`;
  },
  revive(e) {
    return e.targetYou
      ? `You sit up, look around, and ask what you missed. Back in the fight with ${fmt(e.hp)} HP.`
      : `${e.targetName} sits up, looks around, and asks what they missed. Back in the fight with ${fmt(e.hp)} HP.`;
  },
  limit(e) {
    if (e.amount < 0) return e.targetYou ? `You spend it all. Main Character Energy: ${e.after}.` : `${poss(e.targetName)} Limit gauge empties to ${e.after}.`;
    return e.targetYou ? `Main Character Energy: ${e.after}.` : `${poss(e.targetName)} Limit gauge climbs to ${e.after}.`;
  },
  airhead(e) {
    if (e.reset) return `The moment passes, and the gauge snaps back to ${e.after}.`;
    if (e.after > e.before) return `You let go completely, and the gauge leaps to ${e.after}.`;
    if (e.after < e.before) return `Everything comes into focus at once. The gauge drops to ${e.after}.`;
    return `The gauge holds at ${e.after}.`;
  },
  chaos_wave(e) {
    if (e.jackpot) return `A natural 100: you fall over so completely that it counts as an attack. Everything on the other side of the field is off balance, off guard and about to meet the scenery.`;
    if (e.only) {
      return pick([
        () => `You land hard, and the floor takes ${e.only} with it: off balance, guard down. Your Main Character Energy jumps to ${e.limitAfter}.`,
        () => `Your sword clips something structural on the way down. ${e.only} staggers, off balance, with no guard left to speak of.`,
        () => `It is less a fall than an event. When the dust settles you are sitting up, unhurt, and ${e.only} is still looking for the floor.`,
      ], e)();
    }
    return pick([
      () => `You land hard, and the floor disagrees with everyone else. Every enemy staggers, every guard drops, and your Main Character Energy jumps to ${e.limitAfter}.`,
      () => `Your sword clips something structural on the way down. The whole field lurches: ${e.enemies} off balance, every guard broken.`,
      () => `It is less a fall than an event. When the dust settles you are sitting up, unhurt, and the enemy line is a mess.`,
    ], e)();
  },
  contraption(e) {
    const name = e.name ?? 'the machine';
    return pick([
      () => `Your fall sets off ${name}. Something expensive starts happening.`,
      () => `Somewhere behind you, ${name} goes off. You did not touch it; you are fairly sure you did not touch it.`,
      () => `${cap(name)} lets go all at once.`,
    ], e)();
  },
  phase(e) {
    const A = e.actorName ?? 'The boss';
    const lead = pick([`${A} is not finished.`, `The fight turns.`, `${A} changes the question.`], e);
    return e.phaseText ? `${lead} ${e.phaseText}` : `${lead} ${e.phaseName ?? 'A new phase'} begins.`;
  },
  telegraph(e) {
    const A = e.actorName ?? 'The boss';
    const when = e.rounds === 1 ? 'next round' : `in ${e.rounds} rounds`;
    return pick([
      () => `${A} begins ${e.skillName}. ${e.moveName} is coming ${when}, and everyone can see it coming.`,
      () => `That is a wind-up if you ever saw one. ${e.moveName} lands ${when} unless somebody stops it.`,
      () => `${e.flavor ?? `${A} starts ${e.skillName}.`} ${e.moveName} follows ${when}.`,
    ], e)();
  },
  cancel(e) {
    const A = e.actorName ?? 'The boss';
    if (e.reason === 'contraption') return `${e.moveName} goes up with the machinery. ${A} will have to start all over again.`;
    if (e.reason === 'phase') return `${A} lets ${e.moveName} go. There are new plans now.`;
    return `With ${e.part ?? 'that'} bound, ${A} cannot finish it. ${e.moveName} is called off and the wind-up is wasted.`;
  },
  act_out(e) {
    const T = e.targetName ?? 'Someone';
    const name = e.stateName ?? 'It';
    const act = e.actName ? `${e.actName}.` : '';
    const what = e.actText ? ` ${e.actText}` : '';
    if (e.outcome === 'composed') return e.targetYou ? 'You hold it together, this turn.' : pick([`${T} holds it together, this turn.`, `${T} keeps a lid on it, for now.`], e);
    if (e.outcome === 'steady') return e.targetYou ? 'You carry on, calm as you like.' : pick([`${T} stays steady.`, `${T} carries on, calm as you like.`], e);
    if (e.outcome === 'flourish') return e.targetYou ? `You are flying: ${act}${what}` : `${T} is flying: ${act}${what}`;
    if (e.outcome === 'meltdown') return e.targetYou ? `You lose it completely: ${act}${what}` : `${T} loses it completely: ${act}${what}`;
    return e.targetYou ? `${name} gets the better of you: ${act}${what}` : `${name} gets the better of ${T}: ${act}${what}`;
  },
  skip(e) {
    const A = e.actorName ?? 'Someone';
    if (e.actorYou) return 'You lose the turn. Her body is busy with something else.';
    if (e.reason === 'sitting_out') return `${A} sits this one out.`;
    if (e.reason === 'routed') return `${A} wastes the moment trying not to run.`;
    if (e.reason === 'stuck') return `${A} can find nothing useful to do, and does it.`;
    return `${A} loses an action recovering.`;
  },
  defeat(e) {
    const T = e.targetName ?? 'Someone';
    if (e.targetYou) return 'Your legs go. The last thing you see is the sky, looking surprised.';
    if (e.targetSide === 'heroes') return pick([`${T} drops. The fight gets quieter and worse.`, `${T} goes down hard, and does not get up.`], e);
    if (e.routed) return pick([`${T} decides this is somebody else's problem and runs.`, `${T} has seen enough, and leaves at speed.`], e);
    if (e.boss) return `${T} sits down heavily and does not get up. It is over.`;
    return pick([
      `${T} goes down and stays down.`,
      `That is enough for ${T}, who folds up neatly and takes no further part.`,
      `${T} is out of the fight.`,
    ], e);
  },
  enemy_stress(e) {
    const T = e.targetName ?? 'It';
    if (e.status === 'rattled') return `${T} is rattled. The swagger is gone and the grip is slippery.`;
    if (e.defeated) return `${T} cracks. The nerve goes first, and the feet follow.`;
    return `${T} has to stop and collect itself, and loses the moment.`;
  },
  concede(e) {
    const B = e.targetName ?? 'the boss';
    return e.actorYou
      ? `You give ${B} the one thing that was actually wanted: ${e.name}. It costs you something, and the fighting stops.`
      : `${e.actorName} gives ${B} the one thing that was actually wanted: ${e.name}. The fighting stops.`;
  },
  guard(e) {
    if (e.actorYou) return 'You raise the shield arm on purpose. No accidents this turn: just a knight holding still.';
    return pick([`${e.actorName} braces behind a raised guard.`, `${e.actorName} sets both feet and waits for it.`], e);
  },
  breather(e) {
    if (e.refused) return e.actorYou ? 'You will not hear of slowing down.' : `${e.actorName} will not hear of slowing down.`;
    return e.actorYou
      ? `You count to four, the way you used to before exams. Stress eases to ${e.after}.`
      : `${e.actorName} takes a breath. Stress eases to ${e.after}.`;
  },
  pay(e) {
    if (e.lethal) return `${e.targetName} refuses to fall over, on principle, and pays for it: ${fmt(e.mp)} MP.`;
    return e.targetYou
      ? `You pay in MP rather than nerve: ${fmt(e.mp)} gone.`
      : `${e.targetName} pays in MP rather than nerve: ${fmt(e.mp)} gone.`;
  },
  plot_armor(e) {
    return e.success
      ? 'That should have dropped you. The story disagrees: you are on your feet with 1 HP and no idea why.'
      : 'For once the story looks the other way.';
  },
  expire(e) {
    const what = andList(e.what ?? []);
    const runs = e.what?.length > 1 ? 'run' : 'runs';
    return e.targetYou ? `${cap(what)} ${runs} out on you.` : `${cap(what)} ${runs} out on ${e.targetName}.`;
  },
  end(e) {
    if (e.result === 'win' && e.outcome === 'concession') return 'Nobody won that with a sword. It still counts, and the party walks away from it.';
    if (e.result === 'win' && e.bossName) return `${e.bossName} is finished, and you are somehow the one holding the sword. Everyone will tell this story wrong.`;
    if (e.result === 'win') return pick(['The dust settles, and the party is still standing in it.', 'It is over. You are upright, which you decide to count as a plan.'], e);
    if (e.result === 'loss') return 'The party goes down, and the story stops here for now.';
    return 'The fight grinds on past the point where anyone can call it.';
  },
};

/**
 * The family of sentences an event draws from. The runner keeps one counter per key so variants rotate.
 * Two events with the same key are told with the same list of templates.
 */
export function voiceKey(event) {
  const e = event ?? {};
  switch (e.type) {
    case 'attack': return `attack:${attackKey(e)}`;
    case 'stress': {
      const rows = e.targets ?? [];
      const who = rows.length === 1 && rows[0].you ? 'you' : e.targetSide ?? 'heroes';
      return `stress:${who}:${e.reason ?? e.source ?? 'general'}`;
    }
    case 'status': return `status:${e.status}`;
    case 'bind': return `bind:${e.targetSide ?? ''}:${e.own ? 'own' : e.self ? 'self' : e.source ?? 'ride'}`;
    case 'defeat': return `defeat:${e.targetSide ?? ''}:${e.routed ? 'routed' : 'down'}`;
    case 'stance': return `stance:${e.stance}`;
    case 'skill': return `skill:${e.actorYou ? 'you' : e.actorSide ?? ''}`;
    case 'heal': return `heal:${e.source ?? 'skill'}`;
    case 'mod': return `mod:${e.mult >= 1 ? 'up' : 'down'}`;
    case 'resolve': return `resolve:${e.kind}`;
    case 'act_out': return `act_out:${e.outcome}`;
    default: return String(e.type);
  }
}

/** The narrative paragraph for an event: one to three sentences. ctx: { sword } (optional). */
export function narrate(event, ctx = {}) {
  const fn = NARRATORS[event?.type];
  if (!fn) return `Something happens: ${event?.type ?? 'nobody is sure what'}.`;
  return fn(event, ctx ?? {});
}

// ---------------------------------------------------------------- the mechanical line

const arrow = (e) => (e.actorName && e.targetName && e.actor !== e.target ? `${e.actorName} → ${e.targetName}` : e.actorName ?? e.targetName ?? '');
const hpSpan = (e) => (Number.isFinite(e.hpBefore) ? ` (HP ${fmt(e.hpBefore)} → ${fmt(e.hpAfter)})` : '');
const rowsOf = (e) => e.targets ?? [];
const costNote = (e) => {
  const cost = [e.cost?.mp ? `${fmt(e.cost.mp)} MP` : null, e.cost?.limit ? `${e.cost.limit} Limit` : null].filter(Boolean).join(', ');
  return cost ? ` · ${cost}` : '';
};

const LINES = {
  start: (e) => `[battle] ${e.name} · level ${e.level} · ${andList(e.heroes ?? [])} vs ${e.enemies}`,
  round: (e) => `[round ${e.round}] order: ${(e.order ?? []).join(', ')}`,
  stance: (e) => `[${STANCE[e.stance] ?? e.stance}] ${e.actorName} · Airhead ${e.gaugeBefore} → ${e.gaugeAfter} · stress ${e.stressBefore} → ${e.stressAfter}`,
  skill(e) {
    const to = e.targetLabel ? ` → ${e.targetLabel}` : '';
    return `[${e.auto ? 'no roll: cannot miss' : 'no roll'}] ${e.actorName} · ${e.skillName}${to}${costNote(e)}`;
  },
  attack(e) {
    const crit = e.critPct ? `, crit ≤${e.critPct}` : '';
    const fumble = e.fumbleFrom && e.fumbleFrom <= 100 ? `, fumble ${e.fumbleFrom}+` : '';
    const what = e.dodged ? 'dodge' : e.outcome;
    let detail;
    if (e.outcome === 'bounce') detail = `the shot returns for ${fmt(e.reflected)}`;
    else if (e.outcome === 'fumble') detail = e.selfBind ? `self-bind: ${e.selfBind}, 1 turn` : e.wave ? 'Chaos Wave' : 'fumble';
    else if (e.outcome === 'miss') detail = e.dodged ? `she trips under it (ceiling ${e.hitPct})` : 'no damage';
    else if (e.absorbed) detail = `absorbed: heals ${fmt(e.damage)}${hpSpan(e)}`;
    else if (!e.damage) detail = e.powered ? 'no damage (immune)' : 'lands';
    else detail = `${e.outcome === 'crit' ? 'critical ' : ''}${fmt(e.damage)} damage${hpSpan(e)}`;
    const notes = [];
    if (e.redirect?.why) notes.push(e.redirect.fromName ? `${e.redirect.why}: meant for ${e.redirect.fromName}` : e.redirect.why);
    if (e.counter) notes.push('counter');
    if (e.guarded && e.damage > 0) notes.push('guarded');
    if (e.affinity && e.affinity !== 'normal' && (e.outcome === 'hit' || e.outcome === 'crit')) notes.push(e.affinity);
    if (e.autoCrit) notes.push('automatic crit');
    if (e.limitGain) notes.push(`Limit +${e.limitGain}`);
    return `[d100 ${e.roll} vs ${e.hitPct}${crit}${fumble}: ${what}] ${arrow(e)} · ${e.skillName} · ${detail}${notes.length ? ` · ${notes.join(', ')}` : ''}`;
  },
  bind(e) {
    const span = `${e.part} bound ${turnsOf(e.turns ?? 0)}`;
    if (e.own) {
      const what = e.success ? (e.crit ? 'bound, critical' : 'bound') : e.fumble ? 'fumble' : 'no bind';
      const detail = e.success ? span : e.backfire ? `backfires: own ${e.part} bound 1 turn` : 'nothing';
      return `[d100 ${e.roll} vs ${e.pct}: ${what}] ${arrow(e)} · ${e.skillName} · ${detail}`;
    }
    if (e.riding) return `[bind on the same d100: ${e.roll} vs ${e.pct}] ${arrow(e)} · ${span}`;
    if (e.roll != null) return `[d100 ${e.roll} vs ${e.pct}: bound] ${arrow(e)} · ${span}`;
    return `[bind, no roll] ${e.targetName} · ${span}${e.self ? ` · the price of ${e.skillName}` : e.source ? ` · ${e.source}` : ''}`;
  },
  damage: (e) => `[damage ${fmt(e.amount)}, no roll] ${e.targetName} · ${e.source}${e.skillName ? ` (${e.skillName})` : ''}${hpSpan(e)}`,
  heal(e) {
    if (e.refused) return `[heal refused] ${arrow(e)} · ${e.skillName ?? e.source}`;
    return `[heal ${fmt(e.amount)}, no roll] ${arrow(e)} · ${e.skillName ?? e.source}${hpSpan(e)}${costNote(e)}`;
  },
  stress(e) {
    const rows = rowsOf(e);
    const you = rows.length === 1 && rows[0].you ? rows[0] : null;
    const head = `stress ${e.base} ${e.source}${e.flat || (you && e.source === 'realization') ? ', ignores Willpower' : ''}`;
    if (you && you.noticed === false) return `[${head}: not noticed] ${e.targetName} · 0 taken${e.allyRelief ? ` · allies shed ${e.allyRelief}` : ''}`;
    const list = rows.map((r) => `${r.name} ${signed(r.taken)} (${r.before} → ${r.after})`).join(', ');
    const gauge = you && you.gaugeAfter !== you.gaugeBefore ? ` · Airhead ${you.gaugeBefore} → ${you.gaugeAfter}` : '';
    const from = e.actorName && !(rows.length === 1 && rows[0].id === e.actor) ? `${e.actorName} → ` : '';
    return `[${head}] ${from}${list}${gauge}${e.reason ? ` · ${e.reason.replace(/_/g, ' ')}` : ''}`;
  },
  relief(e) {
    const list = rowsOf(e).map((r) => (r.refused ? `${r.name} refuses` : `${r.name} −${r.relieved} (${r.before} → ${r.after})`)).join(', ');
    return `[relief ${e.amount}] ${e.actorName ? `${e.actorName} → ` : ''}${list}${e.reason ? ` · ${e.reason}` : ''}`;
  },
  resolve(e) {
    const party = e.partyStress ? ` · allies ${signed(e.partyStress)} stress` : '';
    return `[d100 ${e.roll} vs virtue ≤${e.virtuePct}: ${e.kind}] ${e.targetName} · ${e.entryName}${e.personal ? ' (her own)' : ''}${e.permanent ? ' · permanent' : ''} · stress ${e.stress}${party}`;
  },
  breakdown: (e) => `[breakdown at 200${e.forced ? ', forced' : ''}] ${e.targetName} · ${CHOICE[e.choice] ?? e.choice} · stress ${e.stress}${e.partyStress ? ` · allies +${e.partyStress}` : ''}${e.mark ? ` · scar: ${e.mark}` : ''}`,
  calm: (e) => `[calmed] ${e.targetName} · ${e.stateName} ends${e.mark ? ` · leaves ${e.mark}` : ''}`,
  status(e) {
    const names = rowsOf(e).map((r) => r.name).join(', ') || e.targetName;
    const span = e.turns ? ` · ${turnsOf(e.turns)}` : '';
    return `[status${e.blocked ? ' blocked' : e.refused ? ' refused' : ''}] ${names} · ${e.statusName ?? e.status}${span}${e.skillName ? ` · ${e.skillName}` : ''}${costNote(e)}`;
  },
  mod(e) {
    const names = rowsOf(e).map((r) => r.name).join(', ') || e.targetName;
    return `[mod${e.refused ? ' refused' : ''}] ${names} · ${STAT[e.stat] ?? e.stat} ×${e.mult} · ${turnsOf(e.turns ?? 0)}${e.skillName ? ` · ${e.skillName}` : ''}`;
  },
  cleanse: (e) => `[cleanse ${e.what}] ${arrow(e)} · ${e.removed} removed${e.skillName ? ` · ${e.skillName}` : ''}`,
  revive: (e) => `[revive] ${arrow(e)} · back at ${fmt(e.hp)} HP`,
  limit: (e) => `[limit ${signed(e.amount)}] ${e.targetName} · ${e.before} → ${e.after}`,
  airhead: (e) => `[airhead] ${e.targetName} · ${e.before} → ${e.after}`,
  chaos_wave: (e) => `[chaos wave on d100 ${e.roll}${e.jackpot ? ': jackpot' : ''}] ${e.actorName} · ${e.enemies} Off-Balance (Finesse ×0.75, 2 turns), ${e.guardsBroken} guards broken · Limit ${e.limitBefore} → ${e.limitAfter}`,
  contraption: (e) => `[contraption] ${e.name} · set off by the Chaos Wave · ${e.uses}`,
  phase: (e) => `[phase ${e.phase} at ${e.at}% HP] ${e.actorName} · ${e.phaseName} · HP ${fmt(e.hp)} of ${fmt(e.maxHp)}`,
  telegraph: (e) => `[telegraph, no roll] ${e.actorName} · ${e.skillName} · ${e.moveName} fires in round ${e.due}`,
  cancel: (e) => `[cancelled] ${e.actorName} · ${e.moveName} · ${e.reason === 'bind' ? `${e.part} bound` : e.reason}`,
  act_out(e) {
    const bands = e.kind === 'virtue' ? `flourish ≤${e.pct}` : `acts out ${101 - e.pct}+, meltdown 96+`;
    return `[d100 ${e.roll}, ${bands}: ${e.outcome}] ${e.targetName} · ${e.stateName}${e.actName ? ` · ${e.actName}` : ''}`;
  },
  skip: (e) => `[${e.actions ? `${e.actions} ${e.actions === 1 ? 'action' : 'actions'} lost` : 'turn lost'}] ${e.actorName} · ${String(e.reason).replace(/_/g, ' ')}`,
  defeat: (e) => `[${e.routed ? 'routed' : 'defeated'}] ${e.targetName}${e.byName ? ` · by ${e.byName}` : ''}`,
  enemy_stress: (e) => `[stress ${e.stress}: ${e.status}] ${e.targetName}${e.defeated ? ' · runs' : e.loseTurn ? ' · loses its next action' : ' · −10 to hit, fumbles on 91+'}`,
  concede: (e) => `[concession] ${arrow(e)} · ${e.name}`,
  guard: (e) => `[guard] ${e.actorName} · half damage until their next turn`,
  breather: (e) => (e.refused ? `[breather refused] ${e.actorName}` : `[breather −${e.relieved}] ${e.actorName} · stress ${e.before} → ${e.after}`),
  pay: (e) => (e.lethal
    ? `[paid ${fmt(e.mp)} MP] ${e.targetName} · ${e.skillName} · stays on 1 HP`
    : `[paid ${fmt(e.mp)} MP] ${e.targetName} · instead of ${e.amount} stress${e.skillName ? ` · ${e.skillName}` : ''}`),
  plot_armor: (e) => `[d100 ${e.roll} vs ${e.pct}: ${e.success ? 'saved' : 'not saved'}] ${e.targetName} · Plot Armor`,
  expire: (e) => `[wears off] ${e.targetName} · ${(e.what ?? []).join(', ')}`,
  end(e) {
    const loot = e.rewards && (e.rewards.exp || e.rewards.gold) ? ` · ${fmt(e.rewards.exp)} EXP each, ${fmt(e.rewards.gold)} gold` : '';
    const story = [e.story?.trust ? `Party Trust ${signed(e.story.trust)}` : null, e.story?.rep ? `Hero Rep ${signed(e.story.rep)}` : null].filter(Boolean).join(', ');
    return `[end: ${e.result}${e.outcome && e.outcome !== e.result ? `, ${e.outcome}` : ''}] ${e.name} · ${e.rounds} ${e.rounds === 1 ? 'round' : 'rounds'}${loot}${story ? ` · ${story}` : ''}`;
  },
};

/** The mechanics of an event in one line, dice first. */
export function lineFor(event) {
  const fn = LINES[event?.type];
  return fn ? fn(event) : `[${event?.type ?? 'event'}]`;
}

/** Every event type the narrator has prose for. */
export const NARRATED_TYPES = Object.freeze(Object.keys(NARRATORS));

/**
 * A whole log as one string. For each event: its dice line, a blank line, its paragraph, a blank line.
 * The paragraph stands apart from the arithmetic.
 */
export function formatLog(events = []) {
  return events.map((e) => `${e.line ?? lineFor(e)}\n\n${e.text ?? narrate(e)}\n`).join('\n');
}
