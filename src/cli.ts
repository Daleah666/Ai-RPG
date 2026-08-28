#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SAMPLE_INTAKE } from './engine/sample.ts'
import { think } from './engine/think.ts'
import { bundleMarkdown, writeAllPlans } from './engine/writePlan.ts'
import type { Energy, Horizon, Intake } from './engine/types.ts'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function has(flag: string): boolean {
  return process.argv.includes(flag)
}

const dumpPath = arg('--file')
const dump = dumpPath ? readFileSync(dumpPath, 'utf8') : arg('--dump') ?? SAMPLE_INTAKE.dump
const commitments = arg('--commitments') ?? SAMPLE_INTAKE.commitments
const hoursPerWeek = Number(arg('--hours') ?? SAMPLE_INTAKE.hoursPerWeek)
const energy = (arg('--energy') as Energy | undefined) ?? SAMPLE_INTAKE.energy
const horizon = (arg('--horizon') as Horizon | undefined) ?? SAMPLE_INTAKE.horizon
const outDir = arg('--out') ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'campaign', 'plans')

const intake: Intake = { dump, commitments, hoursPerWeek, energy, horizon }
const analysis = think(intake)
const plans = writeAllPlans(analysis, intake)

if (has('--json')) {
  process.stdout.write(`${JSON.stringify({ analysis, plans }, null, 2)}\n`)
} else {
  process.stdout.write(`${analysis.narrative}\n\n`)
  for (const step of analysis.thought) {
    process.stdout.write(`## ${step.title}\n${step.detail}\n\n`)
  }
  process.stdout.write(bundleMarkdown(plans, analysis.narrative))
  process.stdout.write('\n')
}

if (!has('--stdout-only')) {
  await mkdir(outDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const target = join(outDir, `${stamp}-campaign.md`)
  await writeFile(target, `${bundleMarkdown(plans, analysis.narrative)}\n`, 'utf8')
  process.stderr.write(`Wrote ${target}\n`)
}
