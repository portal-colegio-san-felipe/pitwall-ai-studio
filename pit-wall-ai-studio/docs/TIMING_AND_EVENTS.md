# Timing, Events, Corrections

## Authority
Client sends intent; backend validates permissions/session state/deduplication and records authoritative receipt/acceptance time. Never use a client-supplied wall-clock timestamp as authoritative race timing.

## Lap timing
Define a clear reference/start model during implementation and document it. The first accepted crossing/reference and subsequent differences must be deterministic and recoverable from persisted data. Because exact sporting start procedure remains open, avoid coupling core event storage to one specific F1-style start assumption.

## Event examples
- SESSION_STARTED
- SESSION_TIMING_CLOSED
- RESULTS_OFFICIALIZED
- RESULTS_REOPENED
- LAP_REGISTERED
- LAP_INVALIDATED / correction metadata
- PIT_IN / PIT_OUT
- EQUIPMENT_CHANGED
- PERSONNEL_CHANGED
- PENALTY_ISSUED / PENALTY_REVOKED
- DIRECTIVE_ISSUED / DIRECTIVE_SERVED / DIRECTIVE_CANCELLED
- TEAM_STATUS_CHANGED
- RACE_STATUS_CHANGED

Events should be sufficient to explain how current state was reached. Derived projections/snapshots may be stored for performance/realtime UI, but audit facts must remain recoverable.

## Corrections
Prefer invalidate/revise + audit over destructive deletion. A mistaken lap correction must cause dependent last/best/lap count/leaderboard projections to recompute consistently and propagate realtime.

## Offline safety
Timing-critical intents are not accepted offline. UI must disable them when authoritative connectivity is unavailable. On reconnect, fetch/resubscribe to authoritative state before re-enabling controls.
