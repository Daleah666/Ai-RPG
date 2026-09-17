# TASK: Connect the companion projects to the agent workspace

Status: OPEN
Updated: 2026-09-17
Assigned agent: Unclaimed

## Outcome

Make the existing companion and subliminal-player source available in the owner's Cursor workflow, preserving the current applications and their appearance. This task file records a handoff; it does not start agents or configure an automation.

## Verified checkpoint

- Ai-RPG is the selected shared coordination repository.
- Moonwave's compact player was implemented and published. Its source is in a separate Sites-managed Git repository, not in Ai-RPG.
- The compact player includes play/stop, independent layer volume and mute controls, full-editor access, and a native floating-window option where supported.
- Type checking, a production build, existing playback regressions, simulated three-layer audio tests, and Chrome floating-window lifecycle tests passed.
- Actual playback of the owner's saved track and desktop dragging still need user-environment verification. A compact page embedded in the Codex side panel is not a separate desktop window.
- VV/Vivi is intended as the main companion. Its latest editable source has not yet been verified; the app was updated in place, so version labels alone are insufficient.
- The existing VV installation was not modified by the Moonwave work.
- No new scheduled automation or Cursor agent trigger was enabled.
- Moonwave already has browser-based scheduling and saved project context. Closed or sleeping devices do not run its browser timers.

## First work

1. Establish which source checkouts are available to the executing agent. Obtain the current Moonwave source from the existing owning workspace, preserving its current hosting connection. Do not reconstruct the app from this note.
2. Locate and inspect the latest VV source archive or checkout. Compare its actual files against the delivered app before choosing a baseline.
3. Record the verified source locations, revisions, build commands, and remaining blockers in a follow-up handoff. Keep credentials, private local paths, and user content out of public repository notes.
4. Make the verified projects available in the owner's Cursor workspace. A workspace file only groups local folders; it does not transfer source to GitHub or connect separate agent accounts.

## Work division after source verification

- Player task: reproduce and resolve real saved-track playback or floating-window issues.
- Companion task: connect a Subliminals launch button to the existing player after the VV baseline is established.
- Review task: verify the resulting changes, preservation of existing data, and the actual launch flow.

Each task should name its owner and files before editing. Use isolated branches or worktrees when agents could touch the same files, and review changes before combining them.

## Later work

Scheduled requests, automatic application of prepared results, and optional mood check-ins remain separate work. Timing and instructions are not yet specified. Do not treat a saved task file as evidence that a schedule is active.

## Completion evidence

- Verified source for each app, or a precise unresolved source-location blocker.
- Repeatable build and launch instructions for the verified checkout.
- The compact player opens and plays an existing track in the intended desktop environment.
- Any agent or scheduling connection is marked active only after its trigger and execution have been verified.
