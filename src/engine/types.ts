export type Horizon = 'week' | 'month' | 'quarter' | 'year'
export type Energy = 'low' | 'medium' | 'high'
export type Domain =
  | 'health'
  | 'career'
  | 'creative'
  | 'relationships'
  | 'money'
  | 'learning'
  | 'home'
  | 'game'
  | 'wellbeing'
  | 'other'

export type SignalKind =
  | 'goal'
  | 'task'
  | 'constraint'
  | 'obstacle'
  | 'resource'
  | 'value'
  | 'emotion'
  | 'question'
  | 'commitment'

export type GoalRole = 'main' | 'side' | 'later'

export interface Intake {
  dump: string
  commitments: string
  hoursPerWeek: number
  energy: Energy
  horizon: Horizon
}

export interface Signal {
  id: string
  text: string
  kind: SignalKind
  domain: Domain
  urgency: number
  importance: number
  effort: number
  timeframe?: string
}

export interface ThoughtStep {
  id: string
  title: string
  detail: string
}

export interface Tension {
  a: string
  b: string
  why: string
}

export interface Phase {
  name: string
  intent: string
  moves: string[]
}

export interface Risk {
  risk: string
  ifThen: string
}

export interface ProposedGoal {
  id: string
  title: string
  questName: string
  domain: Domain
  role: GoalRole
  why: string
  doneWhen: string
  thisWeek: string[]
  phases: Phase[]
  risks: Risk[]
  sourceSignals: string[]
  score: number
}

export interface DomainCluster {
  domain: Domain
  count: number
  summary: string
}

export interface CapacityView {
  hoursPerWeek: number
  energy: Energy
  horizonWeeks: number
  estimatedLoadHours: number
  overload: boolean
  note: string
}

export interface Analysis {
  signals: Signal[]
  clusters: DomainCluster[]
  capacity: CapacityView
  tensions: Tension[]
  leverage: string[]
  thought: ThoughtStep[]
  goals: ProposedGoal[]
  narrative: string
  questions: string[]
}

export interface WrittenPlan {
  goalId: string
  title: string
  questName: string
  role: GoalRole
  markdown: string
}

export const HORIZON_WEEKS: Record<Horizon, number> = {
  week: 1,
  month: 4,
  quarter: 13,
  year: 52,
}

export const DOMAIN_LABEL: Record<Domain, string> = {
  health: 'Health',
  career: 'Work',
  creative: 'Craft',
  relationships: 'People',
  money: 'Money',
  learning: 'Learning',
  home: 'Camp',
  game: 'The Game',
  wellbeing: 'Spirit',
  other: 'Other',
}
