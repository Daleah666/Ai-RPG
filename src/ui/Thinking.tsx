import { useEffect, useState } from 'react'
import type { Analysis } from '../engine/types.ts'

interface Props {
  analysis: Analysis
  onContinue: () => void
  onBack: () => void
}

export function Thinking({ analysis, onContinue, onBack }: Props) {
  const [visible, setVisible] = useState(1)

  useEffect(() => {
    if (visible >= analysis.thought.length) return
    const timer = window.setTimeout(() => setVisible((count) => count + 1), 900)
    return () => window.clearTimeout(timer)
  }, [visible, analysis.thought.length])

  const done = visible >= analysis.thought.length

  return (
    <section className="panel thinking">
      <p className="lede">{done ? analysis.narrative : 'Reading your dump as data. Naming tensions. Cutting the party down to a size that can win.'}</p>

      <ol className="thoughts">
        {analysis.thought.slice(0, visible).map((step) => (
          <li key={step.id}>
            <h2>{step.title}</h2>
            <p>{step.detail}</p>
          </li>
        ))}
      </ol>

      <div className="actions">
        <button type="button" className="ghost" onClick={onBack}>
          Edit dump
        </button>
        {done ? (
          <button type="button" className="primary" onClick={onContinue}>
            Review the quests
          </button>
        ) : (
          <button type="button" className="ghost" onClick={() => setVisible(analysis.thought.length)}>
            Skip the thinking
          </button>
        )}
      </div>
    </section>
  )
}
