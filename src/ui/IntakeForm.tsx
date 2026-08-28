import type { FormEvent } from 'react'
import type { Energy, Horizon, Intake } from '../engine/types.ts'

interface Props {
  intake: Intake
  onChange: (intake: Intake) => void
  onThink: () => void
  onSample: () => void
}

export function IntakeForm({ intake, onChange, onThink, onSample }: Props) {
  const ready = intake.dump.trim().length > 12

  function submit(event: FormEvent) {
    event.preventDefault()
    if (ready) onThink()
  }

  return (
    <form className="panel" onSubmit={submit}>
      <p className="lede">
        Dump the true pile — wants, obstacles, hours, half-promises, questions. The Oracle will separate main quests
        from noise and write the plans in your language.
      </p>

      <label className="field">
        <span>Brain dump</span>
        <textarea
          value={intake.dump}
          onChange={(event) => onChange({ ...intake, dump: event.target.value })}
          rows={12}
          placeholder="I want to ship… I only have 8 hours a week… I feel scattered… Should I…?"
        />
      </label>

      <label className="field">
        <span>Already committed (optional)</span>
        <textarea
          value={intake.commitments}
          onChange={(event) => onChange({ ...intake, commitments: event.target.value })}
          rows={3}
          placeholder="Day job, class, caregiving, a deadline that is not optional…"
        />
      </label>

      <div className="dials">
        <label>
          Hours that are really yours
          <input
            type="number"
            min={1}
            max={80}
            value={intake.hoursPerWeek}
            onChange={(event) => onChange({ ...intake, hoursPerWeek: Number(event.target.value) || 1 })}
          />
        </label>
        <label>
          Energy
          <select
            value={intake.energy}
            onChange={(event) => onChange({ ...intake, energy: event.target.value as Energy })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Horizon
          <select
            value={intake.horizon}
            onChange={(event) => onChange({ ...intake, horizon: event.target.value as Horizon })}
          >
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
          </select>
        </label>
      </div>

      <div className="actions">
        <button type="submit" className="primary" disabled={!ready}>
          Think it through
        </button>
        <button type="button" className="ghost" onClick={onSample}>
          Load a sample campaign
        </button>
      </div>
    </form>
  )
}
