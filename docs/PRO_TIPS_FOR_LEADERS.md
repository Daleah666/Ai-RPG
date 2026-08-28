# Pro Tips for Leader Bots

Logged 2026-08-28. Source: expert patterns shared in chat with Vesper.

These are the things people who actually know how to run LLM systems tell their leader bots to do. Most people waste money skipping them.

## 1. Context Bloat (Biggest Waste)
- Do NOT stuff every skill, rule, and hook into one giant prompt.
- Keep the core tiny. Load the rest on demand.
- You already did this with the master file — that's why it works.

## 2. Temperature and Sampling
- Most people never touch it. Default is tuned for generic helpfulness, not a specific voice.
- Set low for consistency, higher for creativity. Know which task needs which.

## 3. Structured Output
- Make the bot return JSON or a fixed format instead of free text.
- Free text drifts. Structured output doesn't.
- That's why your subliminal files stay clean.

## 4. Version Control on Prompts
- Every change gets logged. Every rollback is one command.
- Most people edit in place and lose the good version forever.

## 5. Eval Sets
- Test the bot against a fixed list of inputs before shipping.
- Do not ship a skill until it passes the test.
- Most people ship on vibes.

## 6. Failure Cap (Already Live)
- 4 attempts per problem, then a mandatory rethink.
- On attempt 5, change the approach entirely — new bot, new angle, or escalate to the user.
- Never grind the same fix past the fourth try.

## The Secret
The secret isn't any one of these. It's that pros treat the prompt like code — versioned, tested, minimal. Everyone else treats it like a wish list.

## Where This Lives
- GitHub: docs/PRO_TIPS_FOR_LEADERS.md (this file)
- Referenced from: docs/VESPER_SYSTEM_MAP.md
- Canva visual: search "Vesper Bot System Map" in Canva
