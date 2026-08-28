# Smoke test — Drive bus round-trip

1. `python -m leader_hq.cli init`
2. `python -m leader_hq.cli assign --to planner --subject "Smoke" --instruction "Return a tiny plan"`
3. `python -m leader_hq.cli simulate-result --from-bot planner --subject "Smoke result" --result '{"ok":true}'`
4. `python -m leader_hq.cli inbox` shows the result
5. Mirror the same JSON files into Drive LeaderHQ via MCP
