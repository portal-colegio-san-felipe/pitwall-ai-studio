# Confirmed Product Requirements

## Event/session configuration
- Create an event with configurable identity and parameters.
- Unlimited-by-design team list (reasonable technical limits only; never hardcode 4).
- Team: name, short name if useful, color, optional number, optional kart name/identity, participants/roster as configuration evolves.
- Create sessions/rounds and choose participating teams.
- Session type should support at least generic/qualifying/race concepts without assuming unresolved sporting behavior.
- Target laps should be configurable per session rather than globally hardcoded.

## Timing
- Manual lap registration from team Pit Wall clients.
- Server-authoritative acceptance timestamp.
- Derive lap count, last lap, best lap, session elapsed information, and overall fastest lap where meaningful.
- Protect against accidental rapid double taps / duplicate intents.
- Maintain raw timing facts independently of penalties.
- Support correction/invalidation with audit history.

## Team Pit Wall
- Mobile-first.
- Unique team access link/token; multiple devices may use the same team access.
- Prominent `REGISTRAR VUELTA` action.
- Current lap/timing information and history.
- Presence/connectivity state and explicit reconnect behavior.
- Neutral measurement controls for strategy facts as they become available: pit in/out, equipment change/current equipment, personnel change/current participants, laps since changes, totals/stints.
- Show Race Control directives/penalties clearly.

## Race Control / stewarding
- Designed for teacher/race director, not developer-only operation.
- Monitor teams, live timing, connections, recent events.
- Start/close/officialize sessions.
- Manual correction/invalidation of timing events.
- Manual stewarding primitives:
  - warning/note
  - configurable time penalty in seconds + reason
  - PIT_REQUIRED directive + reason + lifecycle (pending/served/cancelled)
  - DISQUALIFIED state + reason, reversible only deliberately/audited
- Do not automatically infer infringement -> sanction mappings before rulebook.
- Dangerous actions require confirmation.

## Competition/team states
Keep operational/competitive concepts distinct where useful. Candidate session/team states include ACTIVE, FINISHED, RETIRED, DISQUALIFIED. Pit presence may be better modeled separately as operational state/event rather than mutually exclusive competition status. Final model should avoid forcing unrelated concepts into one enum.

## Finish/results
- Live leaderboard during running session.
- Human-controlled timing close/freeze.
- Provisional/frozen results stage.
- Race Director explicitly declares results official.
- Official classification stored as immutable-style snapshot plus audit metadata.
- Deliberate audited reopen if correction is required.
- Display can show `SESIÓN FINALIZADA / RESULTADOS EN REVISIÓN` after close, then a winner/final-classification animation after officialization.

## Persistence
- Reload/device replacement must not lose authoritative race state.
- Server restart/deployment recovery should be designed safely for the chosen stack.
- Preserve concrete historical events and final results for the event.

## Read-only surfaces
- `/display`: large-screen live/final display.
- `/broadcast`: 16:9 read-only graphics suitable for capture.
