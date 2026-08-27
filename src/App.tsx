import { useEffect, useMemo, useState } from 'react'
import { SAMPLE_INTAKE, applyRoles, think, writeAllPlans } from './engine/index.ts'
import type { Intake, ProposedGoal } from './engine/types.ts'
import { Codex } from './ui/Codex.tsx'
import { Council } from './ui/Council.tsx'
import { IntakeForm } from './ui/IntakeForm.tsx'
import { Thinking } from './ui/Thinking.tsx'
import { clearState, defaultIntake, loadState, saveState, type CampaignState } from './store.ts'

const empty = (): CampaignState => ({
  step: 'intake',
  intake: defaultIntake(),
  analysis: null,
  roles: {},
  plans: [],
})

export function App() {
  const [state, setState] = useState<CampaignState>(() => loadState() ?? empty())

  useEffect(() => {
    saveState(state)
  }, [state])

  const roleMap = useMemo(() => {
    const roles: Record<string, ProposedGoal['role'] | 'drop'> = { ...state.roles }
    for (const goal of state.analysis?.goals ?? []) {
      if (!roles[goal.id]) roles[goal.id] = goal.role
    }
    return roles
  }, [state.analysis, state.roles])

  function startThinking(intake: Intake) {
    const analysis = think(intake)
    const roles: Record<string, ProposedGoal['role'] | 'drop'> = {}
    for (const goal of analysis.goals) roles[goal.id] = goal.role
    setState({ step: 'thinking', intake, analysis, roles, plans: [] })
  }

  function writePlans() {
    if (!state.analysis) return
    const analysis = applyRoles(state.analysis, roleMap)
    const plans = writeAllPlans(analysis, state.intake)
    setState({ ...state, analysis, roles: roleMap, plans, step: 'codex' })
  }

  return (
    <div className="shell">
      <header className="mast">
        <div>
          <p className="eyebrow">Ai-RPG · Campaign Oracle</p>
          <h1>Think the campaign. Write the plan.</h1>
        </div>
        <ol className="steps" aria-label="Planner steps">
          {(['intake', 'thinking', 'council', 'codex'] as const).map((step, index) => (
            <li key={step} className={state.step === step ? 'on' : ''}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </header>

      {state.step === 'intake' && (
        <IntakeForm
          intake={state.intake}
          onChange={(intake) => setState({ ...state, intake })}
          onThink={() => startThinking(state.intake)}
          onSample={() => startThinking(SAMPLE_INTAKE)}
        />
      )}

      {state.step === 'thinking' && state.analysis && (
        <Thinking
          analysis={state.analysis}
          onContinue={() => setState({ ...state, step: 'council' })}
          onBack={() => setState({ ...state, step: 'intake' })}
        />
      )}

      {state.step === 'council' && state.analysis && (
        <Council
          analysis={state.analysis}
          roles={roleMap}
          onRole={(id, role) => setState({ ...state, roles: { ...state.roles, [id]: role } })}
          onWrite={writePlans}
          onBack={() => setState({ ...state, step: 'thinking' })}
        />
      )}

      {state.step === 'codex' && state.analysis && (
        <Codex
          analysis={state.analysis}
          plans={state.plans}
          onBack={() => setState({ ...state, step: 'council' })}
          onReset={() => {
            clearState()
            setState(empty())
          }}
        />
      )}
    </div>
  )
}
