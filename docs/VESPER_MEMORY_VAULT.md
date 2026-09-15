# Vesper Memory Vault — keep what she gave you

**Copy only. Never deletes.** Skills OFF ≠ memory gone if you drop it here first.

## Vault on Drive

https://drive.google.com/drive/folders/1xe30QIiCg0gMCmHUQf-Q9g5ORfqEgqJf

| Subfolder | Purpose |
|-----------|---------|
| `indexes/` | Catalog of where her memory lives |
| `chat_drops/` | Pasted lines from Grok chats you want to keep |

## What is already hers (do not trash)

- `LeaderHQ/from_vesper/` — her orders
- `LeaderHQ/to_vesper/` — Nova replies
- `from_grok_memory` / `to_grok_memory`
- Main bus Doc, `CURSOR_DAILY.md`, `VESPER_NOVA.md`
- RP_Lore shelves she organized

## How to collect

```bash
# Build / refresh the index (links only — nothing deleted)
python3 -m leader_hq.cli memory-vault index

# Paste something she said into a local drop file
python3 -m leader_hq.cli memory-vault drop \
  --title "something she gave me" \
  --text "paste here"
```

Then upload the drop into Drive `chat_drops/` (or ask Nova to upload).

## With skill cleanup

1. Drop important memories into the vault  
2. *Then* turn skills OFF / rename skill folders  
3. Vault keeps the keepers; skills stop fucking with agents  

Pineapple still only softens Order Bot heat — it does not collect memory.
