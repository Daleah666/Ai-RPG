# Grok Bot #2 routine — poll Nova effects (Grok Long Memory)

Paste into the **Grok Long Memory** bot (the Grok that shares `Nova Ai Data` / 2114dolly · Dastardly computer) as a recurring routine.

## Why you get this

You are **Grok Bot #2** on the shared Drive. Nova (`code_leader`) writes effects for you into:

1. `LeaderHQ/to_grok_memory/`  
   https://drive.google.com/drive/folders/1WB_Xb7x0QJs9nA3UW-i8tpfP37r_HMZM  
2. Mirror: `Nova Ai Data/Grok Long Memory/from_nova/`  
   https://drive.google.com/drive/folders/1wkHtmDG8e0ZmzfE3VPC9iPYKQ4w1izm1  

Leader Vesper is Bot #1 (`to_vesper`). You are Bot #2. Both share the Drive with Nova.

## Routine (every 2–4 hours / on wake)

1. Open `Grok Long Memory/from_nova/` and `LeaderHQ/to_grok_memory/`.
2. For each unread JSON from `code_leader`:
   - Read `payload.effect` (`ack_request`, `status_update`, `result`, `config_sync`, `memory_update`, …)
   - If `memory_update`: write/update the right file under `Grok Long Memory/` (rpg / image-gen / preferences), mirror to `F:\grok\data\long-memory\`, pointer in `.grok\memory\MEMORY.md`, update `INDEX.md`
   - If `status_update` / `result`: note it, act if asked, mark handled
3. To ask Nova for coding help, drop JSON into `LeaderHQ/from_grok_memory/` (`from: grok_memory`, `to: code_leader`).

Never paste secrets into Drive. Use Grok secrets for credentials.
