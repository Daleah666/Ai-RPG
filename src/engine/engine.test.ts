import { describe, expect, it } from 'vitest'
import { classifyDomain, classifyKind, extractHours, splitUnits } from './analyze.ts'
import { SAMPLE_INTAKE } from './sample.ts'
import { applyRoles, think } from './think.ts'
import { bundleMarkdown, writeAllPlans } from './writePlan.ts'

describe('splitUnits', () => {
  it('splits sentences and bullets', () => {
    const units = splitUnits('I want to ship. I feel scattered.\n- walk every day')
    expect(units).toEqual(['I want to ship.', 'I feel scattered.', 'walk every day'])
  })

  it('returns empty for blank input', () => {
    expect(splitUnits('   \n')).toEqual([])
  })
})

describe('classify', () => {
  it('detects questions, constraints, and game goals', () => {
    expect(classifyKind('Should I learn Unity or keep it text-based first?')).toBe('question')
    expect(classifyKind("Money is tight so I shouldn't spend.")).toBe('constraint')
    expect(classifyDomain('I want to actually ship Ai-RPG this quarter')).toBe('game')
  })

  it('reads hours from the dump', () => {
    expect(extractHours('I only have about 8 hours a week that are really mine', 10)).toBe(8)
  })
})

describe('think + write', () => {
  it('turns the sample dump into a campaign with a shipping main quest', () => {
    const analysis = think(SAMPLE_INTAKE)
    expect(analysis.signals.length).toBeGreaterThan(6)
    expect(analysis.thought).toHaveLength(6)
    expect(analysis.capacity.overload).toBe(true)
    expect(analysis.capacity.hoursPerWeek).toBe(8)
    expect(analysis.capacity.energy).toBe('low')
    expect(analysis.questions.some((q) => /unity/i.test(q))).toBe(true)
    expect(analysis.tensions.length).toBeGreaterThan(0)

    const mains = analysis.goals.filter((goal) => goal.role === 'main')
    expect(mains.length).toBeGreaterThan(0)
    expect(mains.length).toBeLessThanOrEqual(3)
    expect(analysis.goals.some((goal) => /ship/i.test(goal.title) || goal.domain === 'game')).toBe(true)
    expect(analysis.goals.some((goal) => goal.domain === 'health')).toBe(true)
    expect(analysis.goals.some((goal) => goal.domain === 'relationships' || /friend/i.test(goal.title))).toBe(true)

    const plans = writeAllPlans(analysis, SAMPLE_INTAKE)
    expect(plans.length).toBe(analysis.goals.length)
    expect(plans[0].markdown).toContain('## Why this, now')
    expect(plans[0].markdown).toContain("## This week's moves")
    expect(plans[0].markdown).toContain('## Done when')
    expect(bundleMarkdown(plans, analysis.narrative)).toContain('# Campaign Codex')
  })

  it('lets the player drop and demote quests before writing', () => {
    const analysis = think(SAMPLE_INTAKE)
    const roles: Record<string, 'main' | 'side' | 'later' | 'drop'> = {}
    for (const goal of analysis.goals) roles[goal.id] = 'drop'
    roles[analysis.goals[0].id] = 'main'
    const next = applyRoles(analysis, roles)
    expect(next.goals).toHaveLength(1)
    expect(next.goals[0].role).toBe('main')
  })

  it('still thinks on a short dump', () => {
    const analysis = think({
      dump: 'Finish the demo. Call mom.',
      commitments: '',
      hoursPerWeek: 5,
      energy: 'medium',
      horizon: 'week',
    })
    expect(analysis.goals.length).toBeGreaterThan(0)
    expect(analysis.goals.filter((goal) => goal.role === 'main')).toHaveLength(1)
  })
})
