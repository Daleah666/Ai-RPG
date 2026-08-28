import { useState } from 'react'
import { bundleMarkdown } from '../engine/writePlan.ts'
import type { Analysis, WrittenPlan } from '../engine/types.ts'

interface Props {
  analysis: Analysis
  plans: WrittenPlan[]
  onBack: () => void
  onReset: () => void
}

export function Codex({ analysis, plans, onBack, onReset }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const bundle = bundleMarkdown(plans, analysis.narrative)

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 1600)
  }

  function download() {
    const blob = new Blob([`${bundle}\n`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'campaign-codex.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel">
      <p className="lede">{analysis.narrative}</p>
      <div className="actions sticky">
        <button type="button" className="ghost" onClick={onBack}>
          Adjust quests
        </button>
        <button type="button" className="ghost" onClick={() => copy(bundle, 'all')}>
          {copied === 'all' ? 'Copied' : 'Copy all'}
        </button>
        <button type="button" className="primary" onClick={download}>
          Download markdown
        </button>
        <button type="button" className="ghost" onClick={onReset}>
          New dump
        </button>
      </div>

      <div className="codex">
        {plans.map((plan) => (
          <article key={plan.goalId} className="plan">
            <div className="plan-head">
              <p className="eyebrow">
                {plan.role} quest · {plan.questName}
              </p>
              <button type="button" className="chip" onClick={() => copy(plan.markdown, plan.goalId)}>
                {copied === plan.goalId ? 'Copied' : 'Copy plan'}
              </button>
            </div>
            <pre>{plan.markdown}</pre>
          </article>
        ))}
      </div>
    </section>
  )
}
