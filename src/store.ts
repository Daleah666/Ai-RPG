import type { Analysis, Intake, WrittenPlan } from './engine/types.ts'

const KEY = 'ai-rpg-campaign-v1'

export interface CampaignState {
  step: 'intake' | 'thinking' | 'council' | 'codex'
  intake: Intake
  analysis: Analysis | null
  roles: Record<string, 'main' | 'side' | 'later' | 'drop'>
  plans: WrittenPlan[]
}

export const defaultIntake = (): Intake => ({
  dump: '',
  commitments: '',
  hoursPerWeek: 8,
  energy: 'medium',
  horizon: 'quarter',
})

export function loadState(): CampaignState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as CampaignState
  } catch {
    return null
  }
}

export function saveState(state: CampaignState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function clearState(): void {
  localStorage.removeItem(KEY)
}
