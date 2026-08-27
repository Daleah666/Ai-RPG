import type { Analysis, GoalRole } from '../engine/types.ts'
import { DOMAIN_LABEL } from '../engine/types.ts'

interface Props {
  analysis: Analysis
  roles: Record<string, GoalRole | 'drop'>
  onRole: (id: string, role: GoalRole | 'drop') => void
  onWrite: () => void
  onBack: () => void
}

const ROLES: { id: GoalRole | 'drop'; label: string }[] = [
  { id: 'main', label: 'Main' },
  { id: 'side', label: 'Side' },
  { id: 'later', label: 'Later' },
  { id: 'drop', label: 'Drop' },
]

export function Council({ analysis, roles, onRole, onWrite, onBack }: Props) {
  const kept = analysis.goals.filter((goal) => roles[goal.id] !== 'drop')
  const mains = kept.filter((goal) => (roles[goal.id] ?? goal.role) === 'main')

  return (
    <section className="panel">
      <p className="lede">
        {analysis.capacity.note} Promote only what you will actually protect. Then the Oracle writes the full plans.
      </p>

      <aside className="capacity">
        <p>
          <strong>{analysis.capacity.hoursPerWeek}h</strong> / week · {analysis.capacity.energy} energy ·{' '}
          {analysis.capacity.horizonWeeks}-week horizon
        </p>
        {analysis.tensions[0] && <p className="warn">{analysis.tensions[0].why}</p>}
      </aside>

      <div className="quest-grid">
        {analysis.goals.map((goal) => {
          const role = roles[goal.id] ?? goal.role
          return (
            <article key={goal.id} className={`quest ${role}`}>
              <p className="eyebrow">
                {goal.questName} · {DOMAIN_LABEL[goal.domain]}
              </p>
              <h2>{goal.title}</h2>
              <p>{goal.why}</p>
              <p className="done">
                <strong>Done when:</strong> {goal.doneWhen}
              </p>
              <div className="role-row" role="group" aria-label={`Role for ${goal.title}`}>
                {ROLES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={role === option.id ? 'chip on' : 'chip'}
                    onClick={() => onRole(goal.id, option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </article>
          )
        })}
      </div>

      <div className="actions">
        <button type="button" className="ghost" onClick={onBack}>
          Back to thinking
        </button>
        <button type="button" className="primary" onClick={onWrite} disabled={mains.length === 0}>
          Write the plans
        </button>
      </div>
    </section>
  )
}
