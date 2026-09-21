# Milestones

Milestones are ordered to push rulebook ambiguity toward the end. Complete and verify each before proceeding.

## M0 — Foundation
- Clean project, environment/config handling, chosen persistence connection.
- Core routing/layout and Spanish front-facing language rule.
- Health/error handling basics.
- Automated test foundation.
Acceptance: app starts cleanly; persistence reachable; no production seed/demo race data.

## M1 — Event, teams, sessions
- Event creation/configuration.
- Teams with configurable name/color/optional number/optional kart name; no max=4 assumption.
- Sessions/rounds with selected participating teams and configurable type/target laps.
- Stable IDs and persistence.
Acceptance: create/reload event with >4 teams and multiple sessions without data loss.

## M2 — Access + presence + recovery
- Unique team access links/tokens.
- Multiple devices per team.
- Race Control/technical privileges and read-only display/broadcast roles.
- Presence/last seen, online/reconnecting/offline UX, reconnect/resync, leave/kick, token regeneration as appropriate.
Acceptance: multi-tab/device test; disconnect/reconnect restores authoritative state; offline timing controls disabled.

## M3 — Authoritative timing engine
- Session start/reference model documented.
- Register lap intent with server timestamp.
- Lap count, last, best, fastest lap where meaningful.
- Dedup/double-tap protection.
- Persist timing history.
Acceptance: simultaneous teams, refresh, rapid double taps, invalid/late actions tested.

## M4 — Realtime projections
- Race Control, team clients, Display/Broadcast update live.
- Reconnect obtains current state without stale overwrites.
Acceptance: several clients stay consistent through lap activity and reconnection.

## M5 — Corrections + audit
- Invalidate/correct mistaken timing events without destructive hidden deletion.
- Recompute affected derived stats/classification.
- Audit actor/reason/time.
Acceptance: invalidate a best/last lap and verify every connected view/persistence updates correctly.

## M6 — Neutral strategy measurement
NO automatic sporting enforcement.
- Pit in/out measurement/history.
- Equipment/compound configuration and changes; current equipment; stint/laps since change; totals by equipment.
- Personnel/crew configuration and change events; current assignment and laps since change.
- Surface objective counts/history in Team and Race Control.
Acceptance: facts remain correct through refresh/corrections; no red warnings/DQ/penalty is inferred from unresolved rules.

## M7 — Manual stewarding
- Warning/note.
- Time penalty seconds + reason, preserving raw timing separately.
- PIT_REQUIRED directive with pending/served/cancelled lifecycle.
- DISQUALIFIED team-session state with reason and deliberate audited reversal.
- Clear team notification.
Acceptance: Race Director can operate sanctions manually without any rulebook mapping; history persists.

## M8 — Session lifecycle + provisional/official results
- RUNNING -> FINISHING/PROVISIONAL -> OFFICIAL flow (exact internal naming may vary).
- Close/freeze timing deliberately.
- Review/correct before officialization.
- Persist final result snapshot.
- Deliberate audited reopen.
- Display provisional state and official winner/final animation.
Acceptance: late team actions cannot mutate an official frozen result; reopen is explicit and auditable.

## M9 — Race Control usability + role separation
- Optimize teacher/Race Director workflow; normal race should require little central interaction.
- Technical-only recovery controls separated from sporting controls.
- Pre-race readiness/presence overview.
Acceptance: a non-developer can run normal start, monitoring, sanction, correction, close and officialization flow.

## RULEBOOK GATE
Before implementing M10, ingest the official rulebook and resolve/update `OPEN_RULES.md`. Do not infer missing answers.

## M10 — Confirmed sporting rules / automation
ONLY confirmed rules:
- qualifying interpretation/grid if required
- pit requirements
- personnel cadence/requirements
- equipment/footwear requirements
- penalty effects on classification
- safety kart/flag behavior if app-relevant
- compliance indicators/alerts
Prefer advisory detection + human stewarding where ambiguity/judgment remains.
Acceptance: every automated consequence traces to a documented confirmed rule and has tests.

## M11 — Display/broadcast polish
Only after reliability:
- team identity polish/headshots if supplied
- subtle technical background
- fastest-lap/personal-best/leader-change callouts
- position-change animations
- official winner sequence
Acceptance: no animation changes authoritative state or blocks updates.

## M12 — Real-world race hardening
- Multi-device school-network test.
- Test missed/late clicks, duplicate clicks, simultaneous crossings, Wi-Fi loss, refresh/device replacement, corrections, DQ/directives, close/officialize/reopen.
- Fix defects; feature freeze before event.
- Export/backup final results as appropriate.
Acceptance: core race can continue despite a client reconnect/replacement and audiovisual system failure.
