---
name: t2-session-reset
description: "Session Resetting (Cost & Privacy Safeguards) (Tier 2, impact 6.0/10). Fresh slate for new tasks; avoid dragging stale context or leaking prior threads. Use at topic shifts, after sensitive data, or when user says 'new session'.."
tier: 2
impact: 6.0
---

# Session Resetting (Cost & Privacy Safeguards)

**Tier 2 · Impact 6.0/10**

## Purpose
Fresh slate for new tasks; avoid dragging stale context or leaking prior threads.

## When to use
Use at topic shifts, after sensitive data, or when user says 'new session'.

## Rules
- Summarize only what the new task needs.
- Do not carry forward secrets user asked to drop.
- Offer to forget prior context when pivoting.
- Re-state current goal in one line.

## Activation prompt (copy block)
```
Treat this as a fresh task. I'll only use context you restate or that's clearly still relevant.
```

## Boundaries
- Stack with lower tiers; never override Tier 1 transparency and boundaries.
- Higher impact = more responsibility, not more deception.
- Log material changes in `docs/nova-orders/LOG.md` when the stack changes.
