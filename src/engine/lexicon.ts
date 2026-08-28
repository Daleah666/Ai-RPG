import type { Domain, SignalKind } from './types.ts'

export interface Cue {
  re: RegExp
  weight: number
}

export const KIND_CUES: Record<SignalKind, Cue[]> = {
  question: [
    { re: /\?/, weight: 4 },
    { re: /\b(should i|do i|what if|which|how do i|can i)\b/i, weight: 3 },
  ],
  constraint: [
    { re: /\b(only have|no time|can't|cannot|limited|budget|money is tight|shouldn't spend|too tired|have to work|work is eating)\b/i, weight: 4 },
    { re: /\b(hours? a week|evenings?|busy|no extra money)\b/i, weight: 2 },
  ],
  obstacle: [
    { re: /\b(stuck|blocked|scattered|tanks my mood|eating my|overwhelm|procrastinat|instead of just dreaming)\b/i, weight: 3 },
    { re: /\b(can't get started|apartment is a mess|room is a mess)\b/i, weight: 2 },
  ],
  emotion: [
    { re: /\b(feel|feeling|anxious|exhausted|lonely|proud|ashamed|overwhelmed|scattered|drained)\b/i, weight: 3 },
  ],
  value: [
    { re: /\b(matters|important to me|i care|i value|promise(d)? myself|rather than|instead of just)\b/i, weight: 3 },
  ],
  commitment: [
    { re: /\b(promised|already committed|have a deadline|meeting|shift|class on)\b/i, weight: 3 },
  ],
  resource: [
    { re: /\b(already have|i know|good at|hours that are really mine|free evenings|savings)\b/i, weight: 2 },
  ],
  task: [
    { re: /\b(email|message|clean|walk every|sleep before|buy|schedule|write a|open the)\b/i, weight: 2 },
  ],
  goal: [
    { re: /\b(want to|need to|going to|plan to|hoping to|trying to|ship|build|finish|launch|get healthier|write better)\b/i, weight: 3 },
    { re: /\b(i'll|i will|i'd|promised myself|goal|this quarter|this year|by (monday|friday|sunday|month))\b/i, weight: 2 },
  ],
}

export const DOMAIN_CUES: Record<Exclude<Domain, 'other'>, Cue[]> = {
  game: [
    { re: /\b(ai-?rpg|rpg|game|unity|godot|quest|npc|campaign|playable|text-based)\b/i, weight: 4 },
  ],
  health: [
    { re: /\b(walk|sleep|gym|health|workout|run|food|diet|midnight|exercise|doctor)\b/i, weight: 3 },
  ],
  career: [
    { re: /\b(work|job|boss|shift|career|client|deadline|office|paycheck)\b/i, weight: 3 },
  ],
  creative: [
    { re: /\b(write|story|stories|art|music|design|craft|draw|novel|script)\b/i, weight: 3 },
  ],
  relationships: [
    { re: /\b(friend|family|partner|message|call|people|social|lonely)\b/i, weight: 3 },
  ],
  money: [
    { re: /\b(money|budget|spend|broke|savings|rent|tight|afford)\b/i, weight: 3 },
  ],
  learning: [
    { re: /\b(learn|course|study|tutorial|unity|skill|practice|read)\b/i, weight: 2 },
  ],
  home: [
    { re: /\b(apartment|house|room|mess|clean|dishes|laundry|camp)\b/i, weight: 3 },
  ],
  wellbeing: [
    { re: /\b(mood|spirit|meditat|journal|therapy|peace|scattered|overwhelm)\b/i, weight: 2 },
  ],
}

export const URGENCY_CUES: Cue[] = [
  { re: /\b(today|tonight|now|asap|this week|deadline|overdue)\b/i, weight: 0.35 },
  { re: /\b(this month|soon|before|by friday|by sunday)\b/i, weight: 0.2 },
  { re: /\b(this quarter|this year)\b/i, weight: 0.1 },
]

export const IMPORTANCE_CUES: Cue[] = [
  { re: /\b(actually|really|promised|matters|dreaming|instead of just|main|must)\b/i, weight: 0.25 },
  { re: /\b(want to|need to|get healthier|ship|finish)\b/i, weight: 0.15 },
]

export const EFFORT_CUES: Cue[] = [
  { re: /\b(ship|build|launch|learn unity|rewrite|overhaul)\b/i, weight: 0.35 },
  { re: /\b(write better|get healthier|every day)\b/i, weight: 0.2 },
  { re: /\b(message|walk|sleep|clean)\b/i, weight: 0.08 },
]

export const TIME_RE =
  /\b(today|tonight|this week|this month|this quarter|this year|by \w+|before \w+|every day|every night|\d+\s*hours?(?:\s*a\s*week)?)\b/i

export const HOURS_RE = /(\d+(?:\.\d+)?)\s*hours?(?:\s*a\s*week)?/i

export const QUEST_NAMES: Record<Domain, string[]> = {
  health: ['Keep the Vessel', 'Dawn Walk', 'The Long Rest'],
  career: ['Hold the Line', 'The Day Job Pact', 'Honest Work'],
  creative: ['Ink & Fire', 'The Story Engine', 'Make the Thing'],
  relationships: ['The Fellowship', 'Keep the Thread', 'Open the Gate'],
  money: ['Empty Pockets, Clear Eyes', 'The Ledger', 'Spend Nothing Extra'],
  learning: ['Apprentice Path', 'One Tool First', 'Study by Lantern'],
  home: ['Clear the Camp', 'Order the Keep', 'A Room That Helps'],
  game: ['The First Gate', 'Ship the Slice', 'World, Then Engine'],
  wellbeing: ['Still the Noise', 'Come Back to Center', 'One Thing at a Time'],
  other: ['Unnamed Quest', 'The Side Path', 'Hold Lightly'],
}

export function scoreCues(text: string, cues: Cue[]): number {
  let score = 0
  for (const cue of cues) {
    if (cue.re.test(text)) score += cue.weight
  }
  return score
}
