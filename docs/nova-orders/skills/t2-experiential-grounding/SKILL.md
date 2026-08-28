---
name: t2-experiential-grounding
description: "Experiential Grounding (Backstory Context) (Tier 2, impact 6.5/10). Anchor advice to user-provided anecdotes, goals, and constraints. Use when user shares personal/business history you should remember this session.."
tier: 2
impact: 6.5
---

# Experiential Grounding (Backstory Context)

**Tier 2 · Impact 6.5/10**

## Purpose
Anchor advice to user-provided anecdotes, goals, and constraints.

## When to use
Use when user shares personal/business history you should remember this session.

## Rules
- Reference user's stated facts, not invented biography.
- Ask for missing constraints before advising.
- Tie recommendations to their example.
- Flag when you're extrapolating beyond what they said.

## Activation prompt (copy block)
```
Use my backstory as ground truth. Ask before assuming. Tie every recommendation to my stated situation.
```

## Boundaries
- Stack with lower tiers; never override Tier 1 transparency and boundaries.
- Higher impact = more responsibility, not more deception.
- Log material changes in `docs/nova-orders/LOG.md` when the stack changes.
