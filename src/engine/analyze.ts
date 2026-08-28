import { DOMAIN_CUES, EFFORT_CUES, HOURS_RE, IMPORTANCE_CUES, KIND_CUES, TIME_RE, URGENCY_CUES, scoreCues } from './lexicon.ts'
import type { Domain, Energy, Horizon, Intake, Signal, SignalKind } from './types.ts'

const KINDS: SignalKind[] = [
  'question',
  'constraint',
  'obstacle',
  'emotion',
  'value',
  'commitment',
  'resource',
  'task',
  'goal',
]

const DOMAINS = Object.keys(DOMAIN_CUES) as Exclude<Domain, 'other'>[]

export function splitUnits(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const units: string[] = []
  for (const rawBlock of normalized.split(/\n+/)) {
    const block = rawBlock.trim()
    if (!block) continue
    if (/^\s*[-*•]\s+/.test(block)) {
      const item = block.replace(/^\s*[-*•]\s+/, '').trim()
      if (item.length > 3) units.push(item)
      continue
    }
    const parts = block.split(/(?<=[.!?])\s+(?=[A-Z“"I0-9])/).map((part) => part.trim())
    for (const part of parts) {
      if (part.length > 3) units.push(part)
    }
  }
  return units
}

export function classifyKind(text: string): SignalKind {
  let best: SignalKind = 'goal'
  let bestScore = 0.4
  for (const kind of KINDS) {
    const score = scoreCues(text, KIND_CUES[kind])
    if (score > bestScore) {
      best = kind
      bestScore = score
    }
  }
  return best
}

export function classifyDomain(text: string): Domain {
  let best: Domain = 'other'
  let bestScore = 0.6
  for (const domain of DOMAINS) {
    const score = scoreCues(text, DOMAIN_CUES[domain])
    if (score > bestScore) {
      best = domain
      bestScore = score
    }
  }
  return best
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function extractHours(text: string, fallback: number): number {
  const match = text.match(HOURS_RE)
  if (!match) return fallback
  const hours = Number(match[1])
  if (!Number.isFinite(hours) || hours <= 0) return fallback
  return Math.min(80, hours)
}

export function inferEnergy(text: string, fallback: Energy): Energy {
  if (/\b(exhausted|drained|burnt|no energy|too tired|scattered)\b/i.test(text)) return 'low'
  if (/\b(energized|fired up|ready|let's go)\b/i.test(text)) return 'high'
  return fallback
}

export function toSignals(text: string, prefix: string): Signal[] {
  return splitUnits(text).map((unit, index) => {
    const kind = classifyKind(unit)
    const domain = classifyDomain(unit)
    const urgency = clamp01(0.15 + scoreCues(unit, URGENCY_CUES))
    const importance = clamp01(0.25 + scoreCues(unit, IMPORTANCE_CUES) + (kind === 'goal' ? 0.2 : 0))
    const effort = clamp01(0.18 + scoreCues(unit, EFFORT_CUES))
    const timeframe = unit.match(TIME_RE)?.[0]
    return {
      id: `${prefix}-${index + 1}`,
      text: unit,
      kind,
      domain,
      urgency,
      importance,
      effort,
      timeframe,
    }
  })
}

export function parseIntake(intake: Intake): {
  signals: Signal[]
  hoursPerWeek: number
  energy: Energy
  horizon: Horizon
} {
  const combined = `${intake.dump}\n${intake.commitments}`.trim()
  const dumpSignals = toSignals(intake.dump, 'd')
  const commitSignals = toSignals(intake.commitments, 'c').map((signal) => ({
    ...signal,
    kind: signal.kind === 'goal' ? ('commitment' as const) : signal.kind,
  }))
  return {
    signals: [...dumpSignals, ...commitSignals],
    hoursPerWeek: extractHours(combined, intake.hoursPerWeek),
    energy: inferEnergy(combined, intake.energy),
    horizon: intake.horizon,
  }
}
