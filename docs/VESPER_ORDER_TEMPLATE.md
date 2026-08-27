# Order template — Leader Vesper → Nova (code_leader)

Copy this into `CURSOR_DAILY.md` or `LeaderHQ/from_vesper/{order_id}.md`.

```yaml
order_id: ves_YYYYMMDD_01
from: leader_vesper
to: code_leader
priority: P1
status: open
subject: ""
objective: ""
scope:
  in: []
  out: []
repos_paths_or_drive_links: []
acceptance_checks: []
deadline: null
may_delegate_to:
  - drive_ops
  - gemini_worker
  - planner
  - hypno
  - lyoko
do_not: []
notes: ""
```

## Nova reply block (append after work)

```yaml
nova_reply:
  order_id: ves_YYYYMMDD_01
  status: done|blocked|partial
  summary: ""
  artifacts: []
  delegated:
    - bot: planner
      task: ""
  needs_from_vesper: []
```
