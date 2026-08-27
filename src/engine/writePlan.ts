import type { Analysis, Intake, ProposedGoal, WrittenPlan } from './types.ts'
import { DOMAIN_LABEL } from './types.ts'

function bullets(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join('\n')
}

function numbered(lines: string[]): string {
  return lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
}

export function writePlan(goal: ProposedGoal, analysis: Analysis, intake: Intake): WrittenPlan {
  const constraints = analysis.signals.filter((signal) => signal.kind === 'constraint' || signal.kind === 'obstacle')
  const related = analysis.signals.filter((signal) => goal.sourceSignals.includes(signal.id))
  const horizonLabel =
    intake.horizon === 'week' ? 'this week' : intake.horizon === 'month' ? 'this month' : intake.horizon === 'quarter' ? 'this quarter' : 'this year'

  const constraintBlock = constraints.length
    ? constraints.map((signal) => `- Honor: “${signal.text}”`).join('\n')
    : '- Honor the hours you actually have. Do not plan a second secret life after midnight.'

  const sourceBlock = related.length
    ? related.map((signal) => `- (${signal.kind}) ${signal.text}`).join('\n')
    : '- From your dump, this was the through-line.'

  const phaseBlock = goal.phases
    .map((phase) => `### ${phase.name}\n${phase.intent}\n\n${bullets(phase.moves)}`)
    .join('\n\n')

  const riskBlock = goal.risks.map((risk) => `- **${risk.risk}**\n  If-then: ${risk.ifThen}`).join('\n')

  const roleLine =
    goal.role === 'main'
      ? 'This is a **main quest**. It gets first claim on the hours that are really yours.'
      : goal.role === 'side'
        ? 'This is a **side quest**. It may use leftover energy only. It does not steal the main quest sitting.'
        : 'This is a **later quest**. It is written down so it stops haunting the week. Do not start it unless a main quest is finished or explicitly paused.'

  const markdown = `# ${goal.questName}

**${goal.title}** · ${DOMAIN_LABEL[goal.domain]} · ${horizonLabel}

${roleLine}

## Why this, now

${goal.why}

You named about **${analysis.capacity.hoursPerWeek} hours/week** and **${analysis.capacity.energy} energy**. ${analysis.capacity.note}

${analysis.tensions[0] ? `The plan assumes this tension is real: ${analysis.tensions[0].why}` : 'Keep the scope smaller than your ambition. That is how a campaign lasts.'}

## Done when

${goal.doneWhen}

If you cannot take a picture, paste a file, or tell a friend the outcome in one sentence, it is not done yet.

## Constraints I will honor

${constraintBlock}

## What you already told me

${sourceBlock}

## Campaign map

${phaseBlock}

## This week's moves

Do these in order. If you only finish the first, the quest still moved.

${numbered(goal.thisWeek)}

## If this goes sideways

${riskBlock}

## Review

- **When:** Sunday, 20 minutes. Same seat if you can.
- **Ask:** Did the done-when get closer, or did I only collect tabs?
- **If a sitting slipped twice:** cut scope, do not add motivation.
- **If a new shiny quest appears:** write it at the bottom of Later. Do not promote it mid-week.

## How to work the hours

Protect one sitting on the calendar this week for this quest. A sitting is 25–50 minutes, phone in another room. Start ugly. Stop at the timer. Log one line: what exists now that did not exist before.

---

*Written by Campaign Oracle from your own words. Edit anything that is not true. Do not edit it to be more impressive.*
`

  return {
    goalId: goal.id,
    title: goal.title,
    questName: goal.questName,
    role: goal.role,
    markdown,
  }
}

export function writeAllPlans(analysis: Analysis, intake: Intake): WrittenPlan[] {
  const order = { main: 0, side: 1, later: 2 } as const
  return [...analysis.goals]
    .sort((a, b) => order[a.role] - order[b.role])
    .map((goal) => writePlan(goal, analysis, intake))
}

export function bundleMarkdown(plans: WrittenPlan[], narrative: string): string {
  const body = plans.map((plan) => plan.markdown.trim()).join('\n\n---\n\n')
  return `# Campaign Codex

${narrative}

${body}
`.trim()
}
