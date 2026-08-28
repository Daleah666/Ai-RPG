# Bootstrap LeaderHQ on Google Drive

Run these steps with the Google Drive MCP (or API). Root title: **LeaderHQ**.

## 1. Create root folder

Create folder `LeaderHQ` in My Drive. Save its `fileId` as `ROOT_ID`.

## 2. Create folder tree under ROOT_ID

```
inbox
outbox
registry
goals
plans
tasks
tasks/pending
tasks/in_progress
tasks/done
bots
bots/drive_ops
bots/drive_ops/inbox
bots/drive_ops/outbox
bots/drive_ops/logs
bots/gemini_worker
bots/gemini_worker/inbox
bots/gemini_worker/outbox
bots/gemini_worker/logs
bots/planner
bots/planner/inbox
bots/planner/outbox
bots/planner/logs
```

## 3. Seed files

Upload (as plain text / JSON, disable Google Docs conversion):

- `README.md` — from local `python -m leader_hq.cli init` output tree
- `registry/bots.json` — copy of `config/bots.registry.json`
- each `bots/<id>/PROFILE.md` and `status.json`

## 4. Smoke test

1. Nova assigns a task into `bots/planner/inbox/`
2. Simulate planner `result` into `inbox/`
3. Confirm Nova can summarize inbox for the human

Local mirror: `.local_bus/LeaderHQ/`
