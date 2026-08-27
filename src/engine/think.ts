import { QUEST_NAMES } from './lexicon.ts'
import { parseIntake } from './analyze.ts'
import type {
  Analysis,
  Domain,
  DomainCluster,
  Energy,
  Horizon,
  Intake,
  Phase,
  ProposedGoal,
  Signal,
  Tension,
  ThoughtStep,
} from './types.ts'
import { DOMAIN_LABEL, HORIZON_WEEKS } from './types.ts'

const MAIN_CAP: Record<Horizon, number> = {
  week: 1,
  month: 2,
  quarter: 3,
  year: 3,
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

function quote(text: string): string {
  const trimmed = text.trim().replace(/[.]+$/, '.')
  return `“${trimmed}”`
}

function verbTitle(text: string): string {
  const cleaned = text
    .replace(/^(i\s+)?(want to|need to|keep saying i('ll| will)|i'll|i will|hoping to|trying to|plan to|should|promised myself i('d| would))\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!:]+$/, '')
    .trim()

  if (/^actually\s+ship/i.test(cleaned)) return 'Ship a playable slice, not a dream'
  if (/get healthier/i.test(cleaned)) return 'Rebuild a daily health floor'
  if (/write better stor/i.test(cleaned)) return 'Write stronger stories for the game'
  if (/message friends/i.test(cleaned)) return 'Keep a living thread with friends'
  if (/apartment is a mess|mess/i.test(cleaned) && /mood/i.test(text)) return 'Make camp livable again'
  if (/learn unity/i.test(cleaned) || /text-based/i.test(cleaned)) return 'Choose the smallest shippable form'
  if (/sleep/i.test(cleaned)) return 'Protect sleep before midnight'
  if (/walk/i.test(cleaned)) return 'Walk every day'
  if (cleaned.length > 72) return `${cleaned.slice(0, 69).trim()}…`
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function questName(domain: Domain, title: string, used: Set<string>): string {
  if (/ship/i.test(title) && !used.has('The First Gate')) {
    used.add('The First Gate')
    return 'The First Gate'
  }
  const options = QUEST_NAMES[domain]
  const pick = options.find((name) => !used.has(name)) ?? `${options[0]} ${used.size + 1}`
  used.add(pick)
  return pick
}

function doneWhen(title: string, domain: Domain, horizon: Horizon): string {
  const span =
    horizon === 'week'
      ? 'by the end of this week'
      : horizon === 'month'
        ? 'within four weeks'
        : horizon === 'quarter'
          ? 'this quarter'
          : 'this year'

  if (domain === 'game' || /ship/i.test(title)) {
    return `A stranger can play a complete loop ${span}: start, a choice that matters, and an ending. Not a vision doc — a build.`
  }
  if (domain === 'health') {
    return `The health floor is boring and real ${span}: movement most days, lights-out before midnight on weeknights, no heroic streak required.`
  }
  if (domain === 'home') {
    return `The main living space is reset and stays reset for seven days. Mood is no longer tanked by the room.`
  }
  if (domain === 'relationships') {
    return `Two real check-ins have happened, and the next one is already on the calendar.`
  }
  if (domain === 'creative') {
    return `One finished scene or story fragment exists in the project, not only in your head.`
  }
  if (domain === 'learning') {
    return `A decision is written down and the first tutorial or prototype matches that decision.`
  }
  if (domain === 'money') {
    return `No unplanned spending this horizon, and you can name where the hours went instead of shopping for progress.`
  }
  return `You can point to a finished outcome for “${title}” ${span}, not only effort.`
}

function whyFor(goalSignals: Signal[], constraints: Signal[]): string {
  const voice = goalSignals[0]?.text ?? 'this matters'
  const drag = constraints[0]?.text
  const extra = goalSignals.slice(1, 3).map((signal) => signal.text)
  const parts = [`You said: ${quote(voice)}`]
  if (extra.length) parts.push(`It also showed up as: ${extra.map(quote).join(' / ')}.`)
  if (drag) parts.push(`The plan has to respect ${quote(drag)}`)
  return parts.join(' ')
}

function weekMoves(title: string, domain: Domain, energy: Energy): string[] {
  const slow = energy === 'low'
  if (domain === 'game' || /ship|slice|form/i.test(title)) {
    return [
      slow ? 'Write the one-sentence loop: who the player is, one choice, one payoff.' : 'Draft the playable loop on paper, then open the project the same day.',
      'Choose text-first unless a tool you already know is faster. Write the decision in one line.',
      'Build the smallest scene that can be finished in two sittings — not the world map.',
    ]
  }
  if (domain === 'health') {
    return [
      'Pick a 20-minute walk window that survives work days. Put it on the calendar as if it were a raid.',
      'Set a lights-out alarm 40 minutes before midnight. Phone charges outside the bed.',
      slow ? 'Do four days, not seven. Streaks are how this dies.' : 'Walk today, even if it is a lap around the block.',
    ]
  }
  if (domain === 'home') {
    return [
      'Clear one surface that you see when you wake up. Ten minutes, timer on.',
      'Bag trash and laundry in one pass. Do not reorganize the whole keep.',
      'Photograph the room after. That is the save point you return to this week.',
    ]
  }
  if (domain === 'relationships') {
    return [
      'Send one specific message today — not “we should hang,” a real sentence about them.',
      'Propose a time for a call or walk with one person. If they bounce, propose one other.',
      'Keep it short. The quest is contact, not a reunion speech.',
    ]
  }
  if (domain === 'creative') {
    return [
      'Write 300 words of a scene the player will actually meet.',
      'Stop at a mid-sentence so tomorrow has a door.',
      'Do not open a new engine, tool, or aesthetic moodboard this week.',
    ]
  }
  if (domain === 'learning') {
    return [
      'Write the tool decision: text-based now, heavier engine later.',
      'If you still want Unity, park it as a later quest with a date, not a secret second main quest.',
      'Spend one sitting following the path you chose — not comparing paths.',
    ]
  }
  return [
    `Define done for “${title}” in one sentence.`,
    'Do the smallest irreversible step in the next 48 hours.',
    'Schedule the second sitting now, while the first is still imaginary.',
  ]
}

function phasesFor(domain: Domain, horizon: Horizon): Phase[] {
  const long = horizon === 'quarter' || horizon === 'year'
  if (domain === 'game') {
    return [
      {
        name: 'Phase 1 — The loop',
        intent: 'Prove the feeling of play before building a world.',
        moves: ['Lock the player fantasy in one sentence.', 'Write or script one complete encounter.', 'Play it out loud. Cut anything that does not change a choice.'],
      },
      {
        name: 'Phase 2 — The slice',
        intent: 'Make something another person can finish.',
        moves: ['Connect start → choice → ending.', 'Add one NPC or oracle voice that reacts.', 'Ship to one friend. Watch where they stall.'],
      },
      ...(long
        ? [
            {
              name: 'Phase 3 — The campaign',
              intent: 'Only after the slice is real.',
              moves: ['Expand content, not architecture.', 'Add a second loop variation.', 'Name the next gate. Do not rebuild the engine.'],
            },
          ]
        : []),
    ]
  }
  if (domain === 'health') {
    return [
      { name: 'Phase 1 — Floor', intent: 'Make the minimum automatic.', moves: ['Walk most days.', 'Lights-out rule on weeknights.', 'Track only yes/no, not performance.'] },
      { name: 'Phase 2 — Hold', intent: 'Survive a messy week without quitting.', moves: ['Write the if-then for late work.', 'Keep the walk even when the gym fantasy shows up.', 'Review Sunday: four days counts as a win.'] },
    ]
  }
  if (domain === 'home') {
    return [
      { name: 'Phase 1 — Visible reset', intent: 'Win the room you live in first.', moves: ['Trash and dishes.', 'One surface.', 'Bed as a save point.'] },
      { name: 'Phase 2 — Keep', intent: 'A 10-minute nightly close.', moves: ['Timer after dinner.', 'Do not start a renovation.', 'Stop when the timer ends.'] },
    ]
  }
  return [
    { name: 'Phase 1 — Make it real', intent: 'Move from intention to artifact.', moves: ['Write done-when.', 'Do the first sitting.', 'Show someone or log it.'] },
    { name: 'Phase 2 — Repeat', intent: 'A small cadence beats a surge.', moves: ['Two sittings on the calendar.', 'Protect them from optional quests.', 'Cut scope if a sitting slips twice.'] },
  ]
}

function risksFor(domain: Domain, tensions: Tension[]): { risk: string; ifThen: string }[] {
  const risks = [
    {
      risk: 'Too many main quests start at once and none of them land.',
      ifThen: 'If a second goal tries to become main this week, park it in writing and keep one boss fight.',
    },
  ]
  if (domain === 'game' || domain === 'learning') {
    risks.push({
      risk: 'Tool-shopping (Unity vs text, new engines) disguises itself as progress.',
      ifThen: 'If you catch a tutorial binge, return to the playable loop and add one piece of content instead.',
    })
  }
  if (domain === 'health') {
    risks.push({
      risk: 'Work evenings erase the walk and then the sleep, then the mood.',
      ifThen: 'If work runs late, the walk shrinks to 10 minutes and bedtime still stands. The quest is the floor, not the PR.',
    })
  }
  if (tensions[0]) {
    risks.push({
      risk: tensions[0].why,
      ifThen: `If “${tensions[0].a}” and “${tensions[0].b}” collide on the same evening, the main quest wins and the other waits 24 hours.`,
    })
  }
  return risks.slice(0, 3)
}

function cluster(signals: Signal[]): DomainCluster[] {
  const groups = new Map<Domain, Signal[]>()
  for (const signal of signals) {
    const list = groups.get(signal.domain) ?? []
    list.push(signal)
    groups.set(signal.domain, list)
  }
  return [...groups.entries()]
    .map(([domain, list]) => ({
      domain,
      count: list.length,
      summary: `${DOMAIN_LABEL[domain]}: ${list
        .slice(0, 2)
        .map((signal) => signal.text)
        .join(' · ')}`,
    }))
    .sort((a, b) => b.count - a.count)
}

function findTensions(signals: Signal[], goals: Signal[]): Tension[] {
  const tensions: Tension[] = []
  const work = signals.find((signal) => signal.domain === 'career' || /work is eating|evenings/i.test(signal.text))
  const health = goals.find((signal) => signal.domain === 'health')
  const game = goals.find((signal) => signal.domain === 'game' || signal.domain === 'creative')
  const learn = signals.find((signal) => /unity|text-based/i.test(signal.text))
  const money = signals.find((signal) => signal.domain === 'money' || signal.kind === 'constraint' && /money|spend/i.test(signal.text))
  const home = goals.find((signal) => signal.domain === 'home')
  const people = goals.find((signal) => signal.domain === 'relationships')

  if (work && health) {
    tensions.push({
      a: 'Work evenings',
      b: health.text,
      why: 'The hours you named as yours are the same hours work already eats. Health will lose unless it is smaller than your pride wants.',
    })
  }
  if (work && game) {
    tensions.push({
      a: 'Work evenings',
      b: game.text,
      why: 'Shipping the game and surviving the job are fighting for one evening window. The game has to fit the window, not the other way around.',
    })
  }
  if (game && learn && /unity/i.test(learn.text)) {
    tensions.push({
      a: 'Ship something playable',
      b: 'Learn Unity first',
      why: 'A new engine is a second campaign. Text-first ships; Unity-first delays the First Gate.',
    })
  }
  if (game && home) {
    tensions.push({
      a: game.text,
      b: home.text,
      why: 'A wrecked room steals the mood you need to write. Camp-clearing is support for the main quest, not a rival RPG.',
    })
  }
  if (money && /spend|unity|course|buy/i.test(signals.map((s) => s.text).join(' '))) {
    tensions.push({
      a: 'Money is tight',
      b: 'Buying a path forward',
      why: 'Spending cannot be how this campaign progresses. Use tools you already have.',
    })
  }
  if (people && game) {
    tensions.push({
      a: people.text,
      b: game.text,
      why: 'Isolation is easy when a world is being built. People are a short side quest, not a guilt spiral.',
    })
  }
  return tensions.slice(0, 4)
}

function leverageOf(signals: Signal[]): string[] {
  const text = signals.map((signal) => signal.text).join(' ')
  const leverage: string[] = []
  if (/mess|apartment|mood/i.test(text)) {
    leverage.push('A ten-minute camp reset is leverage: mood comes back, and the game gets a usable evening.')
  }
  if (/walk|sleep/i.test(text)) {
    leverage.push('Sleep and a walk are not side content. They are the stamina bar for every other quest.')
  }
  if (/unity|text-based/i.test(text)) {
    leverage.push('Text-first is leverage: you practice story, ship a loop, and keep Unity as a later expansion pack.')
  }
  if (/scattered|overwhelm/i.test(text)) {
    leverage.push('Naming one main quest is leverage. Scattered attention is the actual boss, not the to-do list.')
  }
  if (/friends|message/i.test(text)) {
    leverage.push('One specific message is leverage. Social repair does not need a new personality, just a sent sentence.')
  }
  return leverage.slice(0, 4)
}

function goalCandidates(signals: Signal[]): Signal[] {
  const wanted = signals.filter(
    (signal) =>
      signal.kind === 'goal' ||
      signal.kind === 'task' ||
      signal.kind === 'question' ||
      (signal.kind === 'commitment' && /promised myself/i.test(signal.text)) ||
      (signal.domain === 'relationships' && signal.kind !== 'constraint') ||
      (signal.kind === 'obstacle' && (signal.domain === 'home' || signal.domain === 'health')),
  )
  const merged: Signal[] = []
  for (const signal of wanted) {
    const twin = merged.find((item) => item.domain === signal.domain && item.kind !== 'question')
    if (twin && signal.kind !== 'question') {
      twin.importance = Math.max(twin.importance, signal.importance)
      twin.urgency = Math.max(twin.urgency, signal.urgency)
      twin.effort = Math.max(twin.effort, signal.effort)
      twin.text = twin.importance >= signal.importance ? twin.text : signal.text
      continue
    }
    merged.push({ ...signal })
  }
  return merged.sort((a, b) => b.importance + b.urgency - (a.importance + a.urgency))
}

function scoreGoal(signal: Signal, energy: Energy): number {
  let score = signal.importance * 1.4 + signal.urgency * 0.8 + (signal.kind === 'goal' ? 0.3 : 0)
  if (signal.domain === 'game' || signal.domain === 'creative') score += 0.25
  if (energy === 'low' && signal.effort > 0.55) score -= 0.2
  if (signal.kind === 'question') score -= 0.15
  return score
}

export function think(intake: Intake): Analysis {
  const parsed = parseIntake(intake)
  const { signals, hoursPerWeek, energy, horizon } = parsed
  const constraints = signals.filter((signal) => signal.kind === 'constraint' || signal.kind === 'obstacle')
  const questions = unique(signals.filter((signal) => signal.kind === 'question').map((signal) => signal.text))
  const clusters = cluster(signals)
  const candidates = goalCandidates(signals)
  const tensions = findTensions(signals, candidates)
  const leverage = leverageOf(signals)

  const estimatedLoadHours = candidates.reduce((sum, signal) => sum + 1.5 + signal.effort * 4, 0)
  const budget = hoursPerWeek * (horizon === 'week' ? 1 : horizon === 'month' ? 0.7 : 0.55)
  const overload = estimatedLoadHours > budget || candidates.length > MAIN_CAP[horizon] + 2

  const ranked = [...candidates].sort((a, b) => scoreGoal(b, energy) - scoreGoal(a, energy))
  const mainSlots = MAIN_CAP[horizon]
  const usedNames = new Set<string>()
  const goals: ProposedGoal[] = ranked.map((signal, index) => {
    const title = verbTitle(signal.text)
    let role: ProposedGoal['role'] = 'later'
    if (index < mainSlots) role = 'main'
    else if (index < mainSlots + 2) role = 'side'
    if (signal.kind === 'question' && role === 'main') role = 'side'
    if (energy === 'low' && role === 'main' && index > 0) role = 'side'
    const related = signals.filter((item) => item.domain === signal.domain)
    return {
      id: `g-${index + 1}`,
      title,
      questName: questName(signal.domain, title, usedNames),
      domain: signal.domain,
      role,
      why: whyFor(related.filter((item) => item.kind === 'goal' || item.kind === 'task' || item.id === signal.id), constraints),
      doneWhen: doneWhen(title, signal.domain, horizon),
      thisWeek: weekMoves(title, signal.domain, energy),
      phases: phasesFor(signal.domain, horizon),
      risks: risksFor(signal.domain, tensions),
      sourceSignals: related.map((item) => item.id),
      score: scoreGoal(signal, energy),
    }
  })

  if (goals.filter((goal) => goal.role === 'main').length === 0 && goals[0]) {
    goals[0].role = 'main'
  }

  const extraSides = goals.filter((goal) => goal.role === 'side').slice(2)
  for (const goal of extraSides) goal.role = 'later'

  const mains = goals.filter((goal) => goal.role === 'main')
  const sides = goals.filter((goal) => goal.role === 'side')
  const later = goals.filter((goal) => goal.role === 'later')

  const thought: ThoughtStep[] = [
    {
      id: 't1',
      title: 'Read the dump as data, not vibes',
      detail:
        signals.length === 0
          ? 'Nothing to parse yet. A messy paragraph is enough — goals, constraints, feelings, questions.'
          : `Found ${signals.length} signals. ${signals.filter((s) => s.kind === 'goal').length} look like aims, ${constraints.length} like limits or drag, ${questions.length} like open questions.`,
    },
    {
      id: 't2',
      title: 'Map the realms',
      detail:
        clusters.length === 0
          ? 'No domains yet.'
          : `Attention is split across ${clusters.map((c) => `${DOMAIN_LABEL[c.domain]} (${c.count})`).join(', ')}.`,
    },
    {
      id: 't3',
      title: 'Check the stamina bar',
      detail: `You have about ${hoursPerWeek} hours a week that are really yours, energy ${energy}, horizon ${horizon} (${HORIZON_WEEKS[horizon]} weeks). Treating every wish as a main quest would cost ~${estimatedLoadHours.toFixed(0)} hours of serious effort. ${overload ? 'That is overload. We cut.' : 'That can work if the mains stay few.'}`,
    },
    {
      id: 't4',
      title: 'Name the tensions',
      detail: tensions.length ? tensions.map((t) => `${t.a} vs ${t.b}: ${t.why}`).join(' ') : 'No sharp collisions. The risk is still doing all of it at half-power.',
    },
    {
      id: 't5',
      title: 'Find leverage, not more quests',
      detail: leverage.length ? leverage.join(' ') : 'The leverage is sequencing: one finished thing beats four almosts.',
    },
    {
      id: 't6',
      title: 'Choose the party',
      detail:
        goals.length === 0
          ? 'No quests yet. Add what you want, what is in the way, and how many hours you actually have.'
          : `Main quest${mains.length === 1 ? '' : 's'}: ${mains.map((g) => g.title).join('; ') || 'none'}. Side: ${sides.map((g) => g.title).join('; ') || 'none'}. Later: ${later.map((g) => g.title).join('; ') || 'none'}. A ${horizon} can hold ${mainSlots} main quest${mainSlots === 1 ? '' : 's'} without lying.`,
    },
  ]

  const capacityNote = overload
    ? `Too many aims for ${hoursPerWeek}h/week. Main quests are capped at ${mainSlots} for a ${horizon}. Everything else is side or later so the campaign can actually move.`
    : `Capacity looks honest for a ${horizon} if you protect the main quest hours and keep side quests small.`

  const narrative = buildNarrative({ goals, tensions, leverage, energy, hoursPerWeek, horizon, questions, overload })

  return {
    signals,
    clusters,
    capacity: {
      hoursPerWeek,
      energy,
      horizonWeeks: HORIZON_WEEKS[horizon],
      estimatedLoadHours: Math.round(estimatedLoadHours * 10) / 10,
      overload,
      note: capacityNote,
    },
    tensions,
    leverage,
    thought,
    goals,
    narrative,
    questions,
  }
}

function buildNarrative(input: {
  goals: ProposedGoal[]
  tensions: Tension[]
  leverage: string[]
  energy: Energy
  hoursPerWeek: number
  horizon: Horizon
  questions: string[]
  overload: boolean
}): string {
  const main = input.goals.filter((goal) => goal.role === 'main')
  const side = input.goals.filter((goal) => goal.role === 'side')
  if (!input.goals.length) {
    return 'Dump the true pile — wants, obstacles, hours, and the questions you are circling. I will separate the main quest from the noise and write the plan in your language.'
  }
  const mainLine = main.length
    ? `The campaign for this ${input.horizon} is ${main.map((goal) => `“${goal.title}”`).join(' and ')}.`
    : 'There is no main quest yet — only fragments.'
  const sideLine = side.length
    ? ` Side quests stay small on purpose: ${side.map((goal) => goal.title).join('; ')}.`
    : ''
  const tensionLine = input.tensions[0] ? ` The live conflict is ${input.tensions[0].a} versus ${input.tensions[0].b}.` : ''
  const energyLine =
    input.energy === 'low'
      ? ` Energy is low, so the plan uses floors and short sittings, not a personality reboot.`
      : ` You get about ${input.hoursPerWeek} honest hours a week; the plan is built to that number, not to a fantasy week.`
  const overloadLine = input.overload ? ' Wanting all of it is data. Doing all of it is how nothing ships.' : ''
  const qLine = input.questions[0] ? ` Open question parked, not solved by shopping: “${input.questions[0]}.”` : ''
  const lev = input.leverage[0] ? ` ${input.leverage[0]}` : ''
  return `${mainLine}${sideLine}${tensionLine}${energyLine}${overloadLine}${qLine}${lev} Next I write the plans in full — done-when, this week, phases, and if-thens — so you are not left holding a vibe.`
}

export function applyRoles(analysis: Analysis, roles: Record<string, ProposedGoal['role'] | 'drop'>): Analysis {
  const goals = analysis.goals
    .filter((goal) => roles[goal.id] !== 'drop')
    .map((goal) => ({ ...goal, role: (roles[goal.id] as ProposedGoal['role'] | undefined) ?? goal.role }))
  return { ...analysis, goals, narrative: buildNarrative({ ...analysis, goals, questions: analysis.questions, overload: analysis.capacity.overload, energy: analysis.capacity.energy, hoursPerWeek: analysis.capacity.hoursPerWeek, horizon: weeksToHorizon(analysis.capacity.horizonWeeks) }) }
}

function weeksToHorizon(weeks: number): Horizon {
  if (weeks <= 1) return 'week'
  if (weeks <= 4) return 'month'
  if (weeks <= 13) return 'quarter'
  return 'year'
}
