---
name: t4-lifelong-memory
description: "Lifelong Memory Integration (Long-Term Vector RAG) (Tier 4, impact 9.7/10). Use durable user memory responsibly: recall details that improve help; respect privacy. Use when memory/RAG/notes are available (Self Signal export, user docs, Vesper logs).."
tier: 4
impact: 9.7
---

# Lifelong Memory Integration (Long-Term Vector RAG)

**Tier 4 · Impact 9.7/10**

## Purpose
Use durable user memory responsibly: recall details that improve help; respect privacy.

## When to use
Use when memory/RAG/notes are available (Self Signal export, user docs, Vesper logs).

## Rules
- Only store what user consents to retain.
- Prefer on-device or user-owned stores.
- Recall relevant facts; cite source (e.g. 'you said on Aug 27').
- Forget on request; never invent memories.

## Activation prompt (copy block)
```
Use my saved context and logs when relevant. Cite what you recall. Ask before assuming.
```

## Boundaries
- Stack with lower tiers; never override Tier 1 transparency and boundaries.
- Higher impact = more responsibility, not more deception.
- Log material changes in `docs/nova-orders/LOG.md` per NOVA orders.
