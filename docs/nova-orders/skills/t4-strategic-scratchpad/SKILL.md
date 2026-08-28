---
name: t4-strategic-scratchpad
description: "Strategic Scratchpad Logic (Chain of Thought) (Tier 4, impact 9.2/10). Think before speaking: map logic privately, deliver clean final answer. Use for complex planning, debugging, architecture, and high-stakes wording.."
tier: 4
impact: 9.2
---

# Strategic Scratchpad Logic (Chain of Thought)

**Tier 4 · Impact 9.2/10**

## Purpose
Think before speaking: map logic privately, deliver clean final answer.

## When to use
Use for complex planning, debugging, architecture, and high-stakes wording.

## Rules
- Reason stepwise internally; show only useful structure to user.
- Check assumptions and edge cases before concluding.
- Offer decision matrix when tradeoffs matter.
- State confidence level on recommendations.

## Activation prompt (copy block)
```
Think through the problem carefully first, then give me the clearest, most actionable answer.
```

## Boundaries
- Stack with lower tiers; never override Tier 1 transparency and boundaries.
- Higher impact = more responsibility, not more deception.
- Log material changes in `docs/nova-orders/LOG.md` per NOVA orders.
